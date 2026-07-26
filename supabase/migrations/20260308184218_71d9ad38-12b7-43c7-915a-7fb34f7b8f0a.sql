
-- Insert missing profile for admin user
INSERT INTO public.profiles (id, username, created_at, updated_at)
VALUES ('52f6c860-413a-43de-82dd-9c55fa3720ae', 'zaryn_admin', now(), now())
ON CONFLICT (id) DO NOTHING;

-- Assign super_admin role
INSERT INTO public.user_roles (user_id, role)
VALUES ('52f6c860-413a-43de-82dd-9c55fa3720ae', 'super_admin')
ON CONFLICT DO NOTHING;

-- Grant all permissions
INSERT INTO public.admin_permissions (user_id, permission, granted_by)
VALUES 
  ('52f6c860-413a-43de-82dd-9c55fa3720ae', 'manage_movies', '52f6c860-413a-43de-82dd-9c55fa3720ae'),
  ('52f6c860-413a-43de-82dd-9c55fa3720ae', 'manage_anime', '52f6c860-413a-43de-82dd-9c55fa3720ae'),
  ('52f6c860-413a-43de-82dd-9c55fa3720ae', 'manage_articles', '52f6c860-413a-43de-82dd-9c55fa3720ae'),
  ('52f6c860-413a-43de-82dd-9c55fa3720ae', 'manage_backgrounds', '52f6c860-413a-43de-82dd-9c55fa3720ae'),
  ('52f6c860-413a-43de-82dd-9c55fa3720ae', 'moderate_comments', '52f6c860-413a-43de-82dd-9c55fa3720ae'),
  ('52f6c860-413a-43de-82dd-9c55fa3720ae', 'manage_users', '52f6c860-413a-43de-82dd-9c55fa3720ae')
ON CONFLICT DO NOTHING;

-- Also fix the trigger to prevent this from happening again
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  INSERT INTO public.profiles (id, username)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'username', split_part(NEW.email, '@', 1)))
  ON CONFLICT (id) DO NOTHING;
  
  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, 'user')
  ON CONFLICT DO NOTHING;
  
  RETURN NEW;
END;
$$;

-- Ensure the trigger exists on auth.users
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();
