
CREATE TABLE public.contact_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  email text NOT NULL,
  subject text NOT NULL,
  message text NOT NULL,
  user_id uuid,
  status text NOT NULL DEFAULT 'unread',
  admin_reply text,
  replied_at timestamp with time zone,
  replied_by uuid,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.contact_messages ENABLE ROW LEVEL SECURITY;

-- Anyone can submit a contact message
CREATE POLICY "Anyone can submit contact messages"
  ON public.contact_messages FOR INSERT
  WITH CHECK (true);

-- Users can view their own messages
CREATE POLICY "Users can view own messages"
  ON public.contact_messages FOR SELECT
  USING (auth.uid() = user_id);

-- Admins can manage all messages
CREATE POLICY "Admins can manage contact messages"
  ON public.contact_messages FOR ALL
  USING (has_role(auth.uid(), 'super_admin'::app_role) OR has_role(auth.uid(), 'admin'::app_role));
