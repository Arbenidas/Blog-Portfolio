import { AngularAppEngine, createRequestHandler } from '@angular/ssr';
import { getContext } from '@netlify/angular-runtime/context.mjs';
import { createClient } from '@supabase/supabase-js';

const angularAppEngine = new AngularAppEngine();

const SUPABASE_URL = 'https://xadheyltgskjprmjbzvh.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhhZGhleWx0Z3NranBybWpienZoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzE3NDUwMDQsImV4cCI6MjA4NzMyMTAwNH0.IJ-uk4dUpk8ojsfs3ZYnR91--vzkfAYi7Kj8UysOCD0';
const SITE_URL = 'https://arbe.blog';

/** Fetch all published slugs from Supabase for sitemap generation */
async function getPublishedDocuments(): Promise<{ slug: string; category: string; updated_at: string }[]> {
  const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  const { data, error } = await supabase
    .from('documents')
    .select('slug, category, updated_at')
    .eq('status', 'published')
    .in('category', ['log', 'guide', 'work']);
  if (error) {
    console.error('Sitemap fetch error:', error);
    return [];
  }
  return data || [];
}

/** Build the XML sitemap string */
function buildSitemapXml(docs: { slug: string; category: string; updated_at: string }[]): string {
  const staticUrls = [
    { loc: `${SITE_URL}/`, changefreq: 'weekly', priority: '1.0' },
    { loc: `${SITE_URL}/logs`, changefreq: 'daily', priority: '0.9' },
    { loc: `${SITE_URL}/guides`, changefreq: 'weekly', priority: '0.9' },
    { loc: `${SITE_URL}/works`, changefreq: 'monthly', priority: '0.8' },
    { loc: `${SITE_URL}/manifesto`, changefreq: 'monthly', priority: '0.5' },
    { loc: `${SITE_URL}/contact`, changefreq: 'yearly', priority: '0.4' },
  ];

  const categoryPath: Record<string, string> = {
    log: 'logs',
    guide: 'guides',
    work: 'works',
  };

  const dynamicUrls = docs.map(doc => ({
    loc: `${SITE_URL}/${categoryPath[doc.category] || doc.category}/${doc.slug}`,
    lastmod: doc.updated_at ? doc.updated_at.split('T')[0] : '',
    changefreq: doc.category === 'log' ? 'monthly' : 'yearly',
    priority: doc.category === 'log' ? '0.8' : '0.7',
  }));

  const allUrls = [...staticUrls, ...dynamicUrls];

  const urlEntries = allUrls.map(u => `
  <url>
    <loc>${u.loc}</loc>
    ${(u as any).lastmod ? `<lastmod>${(u as any).lastmod}</lastmod>` : ''}
    <changefreq>${u.changefreq}</changefreq>
    <priority>${u.priority}</priority>
  </url>`).join('');

  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urlEntries}
</urlset>`;
}

export async function netlifyAppEngineHandler(request: Request): Promise<Response> {
  const context = getContext();
  const url = new URL(request.url);

  // ===== DYNAMIC SITEMAP ENDPOINT =====
  if (url.pathname === '/sitemap.xml') {
    const docs = await getPublishedDocuments();
    const xml = buildSitemapXml(docs);
    return new Response(xml, {
      status: 200,
      headers: {
        'Content-Type': 'application/xml; charset=utf-8',
        'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=86400',
      },
    });
  }

  // Dejamos que Angular renderice la aplicación
  const result = await angularAppEngine.handle(request, context);

  if (result) {
    if (url.pathname.startsWith('/logs/') || url.pathname.startsWith('/works/') || url.pathname.startsWith('/guides/')) {
      result.headers.set('Cache-Control', 'public, s-maxage=86400, stale-while-revalidate');
    }
    return result;
  }

  return new Response('Not found', { status: 404 });
}

/**
 * The request handler used by the Angular CLI (dev-server and during build).
 */
export const reqHandler = createRequestHandler(netlifyAppEngineHandler);