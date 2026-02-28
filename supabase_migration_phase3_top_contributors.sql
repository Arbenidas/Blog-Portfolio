-- ==========================================
-- Phase 3 - Top Contributors RPC
-- Date: 2026-02-28
-- Description: Creates a PostgreSQL function to aggregate 
-- author engagement data (likes + comments) and return a ranked list.
-- ==========================================

-- Drop previously existing function if updating signature
DROP FUNCTION IF EXISTS public.get_top_contributors(integer);

CREATE OR REPLACE FUNCTION public.get_top_contributors(limit_count integer DEFAULT 5)
RETURNS TABLE (
    user_id uuid,
    username text,
    avatar_url text,
    total_score bigint,
    badge text,
    is_top boolean
) AS $$
BEGIN
    RETURN QUERY
    WITH doc_stats AS (
        -- Aggregate published documents per author
        SELECT 
            d.author_id,
            COUNT(d.id) as published_count,
            ARRAY_AGG(d.id) as author_doc_ids
        FROM public.documents d
        WHERE d.status = 'published'
        GROUP BY d.author_id
    ),
    engagement_stats AS (
        -- Calculate Total Likes across all documents for an author
        SELECT 
            ds.author_id,
            ds.published_count,
            (SELECT COUNT(*) FROM public.document_upvotes du WHERE du.document_id = ANY(ds.author_doc_ids)) as total_likes,
            (SELECT COUNT(*) FROM public.document_comments dc WHERE dc.document_id = ANY(ds.author_doc_ids)) as total_comments
        FROM doc_stats ds
    ),
    ranked_users AS (
        -- Calculate final score: (Likes * 5) + (Comments * 3) + (Docs * 10)
        SELECT 
            es.author_id,
            p.username,
            p.avatar_url,
            (es.total_likes * 5) + (es.total_comments * 3) + (es.published_count * 10) as total_score,
            ROW_NUMBER() OVER (ORDER BY ((es.total_likes * 5) + (es.total_comments * 3) + (es.published_count * 10)) DESC) as rank
        FROM engagement_stats es
        JOIN public.profiles p ON p.id = es.author_id
        WHERE p.username IS NOT NULL
    )
    SELECT 
        ru.author_id,
        ru.username,
        ru.avatar_url,
        ru.total_score,
        -- Assign badges based on rank
        CASE 
            WHEN ru.rank = 1 THEN 'A1'::text
            WHEN ru.rank = 2 THEN 'B2'::text
            WHEN ru.rank = 3 THEN 'C3'::text
            ELSE 'D4'::text
        END as badge,
        -- is_top flag for UI rendering
        (ru.rank = 1)::boolean as is_top
    FROM ranked_users ru
    ORDER BY ru.rank ASC
    LIMIT limit_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execution to authenticated and anon users
GRANT EXECUTE ON FUNCTION public.get_top_contributors(integer) TO authenticated, anon;
