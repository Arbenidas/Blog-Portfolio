-- ==========================================
-- PHASE 3.1: SOCIAL INTERACTIONS & GUIDES
-- ==========================================

-- 1. Create table for Upvotes (Likes)
CREATE TABLE IF NOT EXISTS public.document_upvotes (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    document_id uuid REFERENCES public.documents(id) ON DELETE CASCADE,
    user_id uuid REFERENCES public.profiles(id) ON DELETE CASCADE,
    created_at timestamp with time zone DEFAULT now(),
    UNIQUE(document_id, user_id) -- A user can only like a document once
);

-- Enable RLS for Upvotes
ALTER TABLE public.document_upvotes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public can view upvotes" ON public.document_upvotes;
DROP POLICY IF EXISTS "Users can toggle their own upvotes" ON public.document_upvotes;
DROP POLICY IF EXISTS "Users can delete their own upvotes" ON public.document_upvotes;

CREATE POLICY "Public can view upvotes"
ON public.document_upvotes FOR SELECT
USING (true);

CREATE POLICY "Users can toggle their own upvotes"
ON public.document_upvotes FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own upvotes"
ON public.document_upvotes FOR DELETE
USING (auth.uid() = user_id);

-- ==========================================

-- 2. Create table for Comments
CREATE TABLE IF NOT EXISTS public.document_comments (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    document_id uuid REFERENCES public.documents(id) ON DELETE CASCADE,
    user_id uuid REFERENCES public.profiles(id) ON DELETE CASCADE,
    content text NOT NULL,
    created_at timestamp with time zone DEFAULT now()
);

-- Enable RLS for Comments
ALTER TABLE public.document_comments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public can view comments" ON public.document_comments;
DROP POLICY IF EXISTS "Users can insert their own comments" ON public.document_comments;
DROP POLICY IF EXISTS "Users can update their own comments" ON public.document_comments;
DROP POLICY IF EXISTS "Users can delete their own comments" ON public.document_comments;

CREATE POLICY "Public can view comments"
ON public.document_comments FOR SELECT
USING (true);

CREATE POLICY "Users can insert their own comments"
ON public.document_comments FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own comments"
ON public.document_comments FOR UPDATE
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own comments"
ON public.document_comments FOR DELETE
USING (auth.uid() = user_id);
