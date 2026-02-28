-- Migration: Add username_updated_at to profiles table
-- Tracks when the username was last changed (enforces 1x/month limit)

ALTER TABLE profiles 
ADD COLUMN IF NOT EXISTS username_updated_at TIMESTAMPTZ DEFAULT NULL;

-- Note: avatar_url and username already exist on the profiles table
-- from Supabase Auth's default schema
