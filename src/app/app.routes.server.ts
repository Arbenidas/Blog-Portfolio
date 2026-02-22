import { RenderMode, ServerRoute } from '@angular/ssr';

export const serverRoutes: ServerRoute[] = [
  { path: 'works/:slug', renderMode: RenderMode.Server },
  { path: 'logs/:slug', renderMode: RenderMode.Server },
  { path: 'admin/editor/:id', renderMode: RenderMode.Client },
  {
    path: '**',
    renderMode: RenderMode.Prerender
  }
];
