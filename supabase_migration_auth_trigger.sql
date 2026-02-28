-- ==========================================
-- AUTHENTICATION TRIGGER FOR NEW USERS
-- ==========================================
-- This script ensures that whenever a new user registers through Supabase auth,
-- a corresponding row is automatically created in the public.profiles table.
-- Without this, users cannot interact with documents, logs, or comments 
-- due to foreign key constraints.

-- 1. Create a function to automatically create a profile for new users
CREATE OR REPLACE FUNCTION public.handle_new_user() 
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, avatar_url)
  VALUES (
    new.id,
    new.raw_user_meta_data->>'full_name',
    new.raw_user_meta_data->>'avatar_url'
  );
  RETURN new;
END;
$$;

-- 2. Create the trigger on auth.users
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();
