-- Migration: Add author_id to documents and link it to profiles

-- 1. Add the column (allowing nulls initially in case you have existing documents without authors)
ALTER TABLE public.documents 
ADD COLUMN IF NOT EXISTS author_id UUID;

-- 2. Create the foreign key relationship to the profiles table
ALTER TABLE public.documents
ADD CONSTRAINT fk_documents_author
FOREIGN KEY (author_id) 
REFERENCES public.profiles(id)
ON DELETE SET NULL;

-- 3. Update existing documents to belong to your admin user (Optional, but recommended so they show up)
-- Replace the UUID below with YOUR actual admin user ID from the auth.users or profiles table
-- UPDATE public.documents SET author_id = 'YOUR-ADMIN-UUID-HERE' WHERE author_id IS NULL;

-- 4. Rebuild the schema cache so PostgREST knows about the new relation immediately
NOTIFY pgrst, 'reload schema';
