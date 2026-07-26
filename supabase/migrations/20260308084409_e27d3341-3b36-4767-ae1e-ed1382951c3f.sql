
-- Attach the handle_new_user trigger to auth.users
CREATE OR REPLACE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Ensure the existing user has a profile
INSERT INTO public.profiles (id, username)
VALUES ('52f6c860-413a-43de-82dd-9c55fa3720ae', 'yassiniramo8')
ON CONFLICT (id) DO NOTHING;

-- Ensure the existing user has super_admin role
INSERT INTO public.user_roles (user_id, role)
VALUES ('52f6c860-413a-43de-82dd-9c55fa3720ae', 'super_admin')
ON CONFLICT (user_id, role) DO NOTHING;
