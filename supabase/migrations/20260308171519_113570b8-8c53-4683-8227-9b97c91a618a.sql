
-- Table to archive deleted users for record keeping
CREATE TABLE public.archived_users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  original_user_id uuid NOT NULL,
  username text,
  email text,
  avatar_url text,
  subscription_plan text,
  subscription_expired_at timestamptz,
  was_vip boolean DEFAULT false,
  archived_at timestamptz NOT NULL DEFAULT now(),
  archived_by uuid,
  reason text
);

ALTER TABLE public.archived_users ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage archived users"
  ON public.archived_users FOR ALL
  TO authenticated
  USING (has_role(auth.uid(), 'super_admin'::app_role) OR has_role(auth.uid(), 'admin'::app_role));
