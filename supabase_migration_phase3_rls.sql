-- ==========================================
-- PHASE 3: MULTI-USER SECURITY & RLS ENFORCEMENT
-- ==========================================

-- 1. Add 'role' column to profiles if it doesn't exist
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS role text DEFAULT 'user';

-- 2. Secure the 'documents' table
ALTER TABLE public.documents ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if any (to avoid conflicts during re-runs)
DROP POLICY IF EXISTS "Public can view published documents" ON public.documents;
DROP POLICY IF EXISTS "Authors can view all their own documents" ON public.documents;
DROP POLICY IF EXISTS "Authors can insert their own documents" ON public.documents;
DROP POLICY IF EXISTS "Authors can update their own documents" ON public.documents;
DROP POLICY IF EXISTS "Authors can delete their own documents" ON public.documents;

-- Policy: Anyone can read published documents
CREATE POLICY "Public can view published documents"
ON public.documents FOR SELECT
USING (status = 'published');

-- Policy: Authors can read all their own documents (including drafts)
CREATE POLICY "Authors can view all their own documents"
ON public.documents FOR SELECT
USING (auth.uid() = author_id);

-- Policy: Authors can insert documents only as themselves
CREATE POLICY "Authors can insert their own documents"
ON public.documents FOR INSERT
WITH CHECK (auth.uid() = author_id);

-- Policy: Authors can update only their own documents
CREATE POLICY "Authors can update their own documents"
ON public.documents FOR UPDATE
USING (auth.uid() = author_id);

-- Policy: Authors can delete only their own documents
CREATE POLICY "Authors can delete their own documents"
ON public.documents FOR DELETE
USING (auth.uid() = author_id);


-- 3. Secure the profiles table (make sure users can only update their own profile)
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public can view profiles" ON public.profiles;
DROP POLICY IF EXISTS "Users can update their own profiles" ON public.profiles;
DROP POLICY IF EXISTS "Users can insert their own profiles" ON public.profiles;

CREATE POLICY "Public can view profiles"
ON public.profiles FOR SELECT
USING (true);

CREATE POLICY "Users can update their own profiles"
ON public.profiles FOR UPDATE
USING (auth.uid() = id);

CREATE POLICY "Users can insert their own profiles"
ON public.profiles FOR INSERT
WITH CHECK (auth.uid() = id);

-- (Assuming Storage buckets 'covers' and 'avatars' exist, establishing RLS there)
-- Note: Supabase storage policies use auth.uid() and path patterns.
-- The below assumes the folder structure is: bucket_id/user_id/...
-- These require executing through the SQL editor via Supabase Dashboard.

-- For covers:
-- CREATE POLICY "User can upload covers to their folder" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'covers' AND auth.uid()::text = (storage.foldername(name))[1]);
-- For avatars:
-- CREATE POLICY "User can upload avatars to their folder" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'avatars' AND auth.uid()::text = (storage.foldername(name))[1]);
