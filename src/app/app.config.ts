import { ApplicationConfig, provideBrowserGlobalErrorListeners, provideZonelessChangeDetection, APP_INITIALIZER, PLATFORM_ID, inject } from '@angular/core';
import { provideRouter } from '@angular/router';
import { provideHttpClient, withFetch } from '@angular/common/http';
import { provideTranslateService, TranslateLoader } from '@ngx-translate/core';
import { TranslateHttpLoader, provideTranslateHttpLoader } from '@ngx-translate/http-loader';
import { provideMarkdown } from 'ngx-markdown';
import { SecurityContext } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';

import { routes } from './app.routes';
import { provideClientHydration, withEventReplay } from '@angular/platform-browser';
import { provideAnimationsAsync } from '@angular/platform-browser/animations/async';

/** Load PrismJS only in the browser — never in SSR (Node.js has no document) */
function initPrism(): () => Promise<void> {
  const platformId = inject(PLATFORM_ID);
  return async () => {
    if (!isPlatformBrowser(platformId)) return;
    await import('prismjs');
    await Promise.all([
      import('prismjs/components/prism-typescript.min.js' as any),
      import('prismjs/components/prism-javascript.min.js' as any),
      import('prismjs/components/prism-css.min.js' as any),
      import('prismjs/components/prism-scss.min.js' as any),
      import('prismjs/components/prism-json.min.js' as any),
      import('prismjs/components/prism-bash.min.js' as any),
      import('prismjs/components/prism-java.min.js' as any),
      import('prismjs/components/prism-properties.min.js' as any),
      import('prismjs/components/prism-markdown.min.js' as any),
    ]);
  };
}

export const appConfig: ApplicationConfig = {
  providers: [
    provideZonelessChangeDetection(),
    provideBrowserGlobalErrorListeners(),
    provideRouter(routes),
    provideClientHydration(withEventReplay()),
    provideAnimationsAsync(),
    provideHttpClient(withFetch()),
    {
      provide: APP_INITIALIZER,
      useFactory: initPrism,
      multi: true,
    },
    provideTranslateService({
      fallbackLang: 'es',
      loader: {
        provide: TranslateLoader,
        useClass: TranslateHttpLoader,
      },
    }),
    provideTranslateHttpLoader({
      prefix: './assets/i18n/',
      suffix: '.json',
    }),
    provideMarkdown(),
  ]
};

