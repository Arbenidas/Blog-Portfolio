import { AngularAppEngine, createRequestHandler } from '@angular/ssr';
import { getContext } from '@netlify/angular-runtime/context.mjs';

const angularAppEngine = new AngularAppEngine();

export async function netlifyAppEngineHandler(request: Request): Promise<Response> {
  const context = getContext();
  const url = new URL(request.url);

  // Dejamos que Angular renderice la aplicación
  const result = await angularAppEngine.handle(request, context);

  if (result) {
    // ¡AQUÍ RESCATAMOS TU LÓGICA DE CACHÉ!
    // Si la ruta es de logs o works, le inyectamos los headers para Netlify Edge
    if (url.pathname.startsWith('/logs/') || url.pathname.startsWith('/works/')) {
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