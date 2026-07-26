
-- Create app_role enum
CREATE TYPE public.app_role AS ENUM ('super_admin', 'admin', 'moderator', 'user');

-- Create app_permission enum
CREATE TYPE public.app_permission AS ENUM (
  'manage_movies', 'manage_anime', 'manage_articles', 
  'manage_backgrounds', 'moderate_comments', 'manage_users'
);

-- Profiles table
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  username TEXT,
  avatar_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view all profiles" ON public.profiles
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Users can update own profile" ON public.profiles
  FOR UPDATE TO authenticated USING (auth.uid() = id);

CREATE POLICY "Users can insert own profile" ON public.profiles
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = id);

-- User roles table
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role app_role NOT NULL DEFAULT 'user',
  UNIQUE (user_id, role)
);

ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- Security definer function to check roles
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  )
$$;

CREATE POLICY "Users can view own roles" ON public.user_roles
  FOR SELECT TO authenticated USING (auth.uid() = user_id);

CREATE POLICY "Super admins can manage roles" ON public.user_roles
  FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'super_admin'));

-- Admin permissions table
CREATE TABLE public.admin_permissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  permission app_permission NOT NULL,
  granted_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, permission)
);

ALTER TABLE public.admin_permissions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own permissions" ON public.admin_permissions
  FOR SELECT TO authenticated USING (auth.uid() = user_id);

CREATE POLICY "Super admins can manage permissions" ON public.admin_permissions
  FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'super_admin'));

-- Security definer function for permissions
CREATE OR REPLACE FUNCTION public.has_permission(_user_id UUID, _permission app_permission)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = 'super_admin'
  ) OR EXISTS (
    SELECT 1 FROM public.admin_permissions WHERE user_id = _user_id AND permission = _permission
  )
$$;

-- Movies table
CREATE TABLE public.movies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  poster_url TEXT,
  trailer_url TEXT,
  rating NUMERIC(3,1) DEFAULT 0,
  year INTEGER,
  genre TEXT[] DEFAULT '{}',
  description TEXT,
  trending BOOLEAN DEFAULT false,
  pinned BOOLEAN DEFAULT false,
  watch_servers JSONB DEFAULT '[]',
  download_servers JSONB DEFAULT '[]',
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.movies ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can view movies" ON public.movies FOR SELECT USING (true);
CREATE POLICY "Admins can manage movies" ON public.movies FOR ALL TO authenticated
  USING (public.has_permission(auth.uid(), 'manage_movies'));

-- Anime table
CREATE TABLE public.anime (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  poster_url TEXT,
  trailer_url TEXT,
  rating NUMERIC(3,1) DEFAULT 0,
  year INTEGER,
  genre TEXT[] DEFAULT '{}',
  description TEXT,
  trending BOOLEAN DEFAULT false,
  pinned BOOLEAN DEFAULT false,
  watch_servers JSONB DEFAULT '[]',
  download_servers JSONB DEFAULT '[]',
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.anime ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can view anime" ON public.anime FOR SELECT USING (true);
CREATE POLICY "Admins can manage anime" ON public.anime FOR ALL TO authenticated
  USING (public.has_permission(auth.uid(), 'manage_anime'));

-- Backgrounds table
CREATE TABLE public.backgrounds (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  image_url TEXT NOT NULL,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.backgrounds ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can view backgrounds" ON public.backgrounds FOR SELECT USING (true);
CREATE POLICY "Admins can manage backgrounds" ON public.backgrounds FOR ALL TO authenticated
  USING (public.has_permission(auth.uid(), 'manage_backgrounds'));

-- Articles table
CREATE TABLE public.articles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  cover_url TEXT,
  excerpt TEXT,
  content TEXT,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.articles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can view articles" ON public.articles FOR SELECT USING (true);
CREATE POLICY "Admins can manage articles" ON public.articles FOR ALL TO authenticated
  USING (public.has_permission(auth.uid(), 'manage_articles'));

-- Comments table (polymorphic)
CREATE TABLE public.comments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  content_type TEXT NOT NULL CHECK (content_type IN ('movie', 'anime', 'background', 'article')),
  content_id UUID NOT NULL,
  body TEXT NOT NULL,
  pinned BOOLEAN DEFAULT false,
  highlighted BOOLEAN DEFAULT false,
  highlight_color TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.comments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can view comments" ON public.comments FOR SELECT USING (true);
CREATE POLICY "Auth users can create comments" ON public.comments FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own comments" ON public.comments FOR UPDATE TO authenticated
  USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own comments" ON public.comments FOR DELETE TO authenticated
  USING (auth.uid() = user_id);
CREATE POLICY "Admins can manage comments" ON public.comments FOR ALL TO authenticated
  USING (public.has_permission(auth.uid(), 'moderate_comments'));

-- Likes table (polymorphic)
CREATE TABLE public.likes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  content_type TEXT NOT NULL CHECK (content_type IN ('movie', 'anime', 'background', 'article')),
  content_id UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, content_type, content_id)
);

ALTER TABLE public.likes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can view likes" ON public.likes FOR SELECT USING (true);
CREATE POLICY "Auth users can like" ON public.likes FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can unlike" ON public.likes FOR DELETE TO authenticated
  USING (auth.uid() = user_id);

-- Watch history
CREATE TABLE public.watch_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  content_type TEXT NOT NULL CHECK (content_type IN ('movie', 'anime')),
  content_id UUID NOT NULL,
  watched_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, content_type, content_id)
);

ALTER TABLE public.watch_history ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own history" ON public.watch_history FOR SELECT TO authenticated
  USING (auth.uid() = user_id);
CREATE POLICY "Users can add to history" ON public.watch_history FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can delete history" ON public.watch_history FOR DELETE TO authenticated
  USING (auth.uid() = user_id);

-- Watch later
CREATE TABLE public.watch_later (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  content_type TEXT NOT NULL CHECK (content_type IN ('movie', 'anime')),
  content_id UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, content_type, content_id)
);

ALTER TABLE public.watch_later ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own watch later" ON public.watch_later FOR SELECT TO authenticated
  USING (auth.uid() = user_id);
CREATE POLICY "Users can add to watch later" ON public.watch_later FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can remove from watch later" ON public.watch_later FOR DELETE TO authenticated
  USING (auth.uid() = user_id);

-- User bans table
CREATE TABLE public.user_bans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  banned_by UUID REFERENCES auth.users(id),
  reason TEXT,
  ban_type TEXT NOT NULL CHECK (ban_type IN ('ban', 'suspend')),
  expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id)
);

ALTER TABLE public.user_bans ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins can manage bans" ON public.user_bans FOR ALL TO authenticated
  USING (public.has_permission(auth.uid(), 'manage_users'));
CREATE POLICY "Users can view own ban" ON public.user_bans FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

-- Trigger to auto-create profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, username)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'username', split_part(NEW.email, '@', 1)));
  
  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, 'user');
  
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

-- Create storage bucket for avatars
INSERT INTO storage.buckets (id, name, public) VALUES ('avatars', 'avatars', true);

-- Storage policies for avatars
CREATE POLICY "Anyone can view avatars" ON storage.objects
  FOR SELECT USING (bucket_id = 'avatars');
CREATE POLICY "Auth users can upload avatars" ON storage.objects
  FOR INSERT TO authenticated WITH CHECK (bucket_id = 'avatars');
CREATE POLICY "Users can update own avatar" ON storage.objects
  FOR UPDATE TO authenticated USING (bucket_id = 'avatars');
CREATE POLICY "Users can delete own avatar" ON storage.objects
  FOR DELETE TO authenticated USING (bucket_id = 'avatars');

-- Create storage bucket for content media
INSERT INTO storage.buckets (id, name, public) VALUES ('content', 'content', true);

CREATE POLICY "Anyone can view content" ON storage.objects
  FOR SELECT USING (bucket_id = 'content');
CREATE POLICY "Admins can upload content" ON storage.objects
  FOR INSERT TO authenticated WITH CHECK (bucket_id = 'content');
CREATE POLICY "Admins can update content" ON storage.objects
  FOR UPDATE TO authenticated USING (bucket_id = 'content');
CREATE POLICY "Admins can delete content" ON storage.objects
  FOR DELETE TO authenticated USING (bucket_id = 'content');
