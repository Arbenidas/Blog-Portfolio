import { RenderMode, ServerRoute } from '@angular/ssr';

export const serverRoutes: ServerRoute[] = [
  { path: 'works/:slug', renderMode: RenderMode.Client },
  { path: 'logs/:slug', renderMode: RenderMode.Client },
  { path: 'guides/:slug', renderMode: RenderMode.Client },
  { path: 'admin/editor/:id', renderMode: RenderMode.Client },
  { path: 'u/:username', renderMode: RenderMode.Client },
  {
    path: '**',
    renderMode: RenderMode.Prerender
  }
];
