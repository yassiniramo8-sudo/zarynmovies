
-- ============= ad_placement_settings =============
CREATE TABLE IF NOT EXISTS public.ad_placement_settings (
  placement TEXT PRIMARY KEY,
  intensity INTEGER NOT NULL DEFAULT 100 CHECK (intensity >= 0 AND intensity <= 100),
  enabled BOOLEAN NOT NULL DEFAULT true,
  note TEXT,
  updated_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT ON public.ad_placement_settings TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.ad_placement_settings TO authenticated;
GRANT ALL ON public.ad_placement_settings TO service_role;

ALTER TABLE public.ad_placement_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "placement settings readable by all"
  ON public.ad_placement_settings FOR SELECT
  USING (true);

CREATE POLICY "placement settings admin write"
  ON public.ad_placement_settings FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'super_admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'super_admin'));

CREATE OR REPLACE FUNCTION public.touch_ad_placement_settings()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_touch_ad_placement_settings ON public.ad_placement_settings;
CREATE TRIGGER trg_touch_ad_placement_settings
  BEFORE UPDATE ON public.ad_placement_settings
  FOR EACH ROW EXECUTE FUNCTION public.touch_ad_placement_settings();

-- ============= ad_audit_log =============
CREATE TABLE IF NOT EXISTS public.ad_audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ad_id UUID,
  actor_id UUID,
  action TEXT NOT NULL,
  reason TEXT,
  details JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ad_audit_log_ad_id ON public.ad_audit_log(ad_id);
CREATE INDEX IF NOT EXISTS idx_ad_audit_log_created_at ON public.ad_audit_log(created_at DESC);

GRANT SELECT, INSERT ON public.ad_audit_log TO authenticated;
GRANT ALL ON public.ad_audit_log TO service_role;

ALTER TABLE public.ad_audit_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "audit log admin read"
  ON public.ad_audit_log FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'super_admin'));

CREATE POLICY "audit log insert authenticated"
  ON public.ad_audit_log FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- ============= Trigger: auto-log ad changes =============
CREATE OR REPLACE FUNCTION public.log_ad_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_action TEXT;
  v_reason TEXT;
  v_details JSONB;
  v_actor UUID;
BEGIN
  v_actor := auth.uid();

  IF TG_OP = 'INSERT' THEN
    v_action := 'create';
    v_details := jsonb_build_object(
      'title', NEW.title,
      'placement', NEW.placement,
      'ad_type', NEW.ad_type,
      'active', NEW.active,
      'start_at', NEW.start_at,
      'end_at', NEW.end_at
    );
    INSERT INTO public.ad_audit_log(ad_id, actor_id, action, reason, details)
      VALUES (NEW.id, v_actor, v_action, NULL, v_details);
    RETURN NEW;
  ELSIF TG_OP = 'UPDATE' THEN
    -- Prefer specific action labels for common changes
    IF NEW.active IS DISTINCT FROM OLD.active THEN
      v_action := CASE WHEN NEW.active THEN 'activate' ELSE 'deactivate' END;
    ELSIF NEW.placement IS DISTINCT FROM OLD.placement THEN
      v_action := 'move';
    ELSIF NEW.start_at IS DISTINCT FROM OLD.start_at
       OR NEW.end_at IS DISTINCT FROM OLD.end_at THEN
      v_action := 'schedule';
    ELSE
      v_action := 'edit';
    END IF;

    v_details := jsonb_build_object(
      'changed', (
        SELECT jsonb_object_agg(key, jsonb_build_object('from', o.value, 'to', n.value))
        FROM jsonb_each(to_jsonb(OLD)) o
        JOIN jsonb_each(to_jsonb(NEW)) n USING (key)
        WHERE o.value IS DISTINCT FROM n.value
          AND key NOT IN ('updated_at', 'impressions_count', 'clicks_count')
      )
    );

    INSERT INTO public.ad_audit_log(ad_id, actor_id, action, reason, details)
      VALUES (NEW.id, v_actor, v_action, NULL, v_details);
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    v_details := jsonb_build_object('title', OLD.title, 'placement', OLD.placement);
    INSERT INTO public.ad_audit_log(ad_id, actor_id, action, reason, details)
      VALUES (OLD.id, v_actor, 'delete', NULL, v_details);
    RETURN OLD;
  END IF;
  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS trg_log_ad_change ON public.advertisements;
CREATE TRIGGER trg_log_ad_change
  AFTER INSERT OR UPDATE OR DELETE ON public.advertisements
  FOR EACH ROW EXECUTE FUNCTION public.log_ad_change();

-- Realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.ad_placement_settings;
ALTER PUBLICATION supabase_realtime ADD TABLE public.ad_audit_log;
