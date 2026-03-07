import { mergeApplicationConfig, ApplicationConfig } from '@angular/core';
import { provideServerRendering, withRoutes } from '@angular/ssr';
import { TranslateLoader } from '@ngx-translate/core';
import { appConfig } from './app.config';
import { serverRoutes } from './app.routes.server';
import { ServerTranslateLoader } from './services/language/server-translate.loader';
import { CLIPBOARD_OPTIONS, provideMarkdown } from 'ngx-markdown';

const serverConfig: ApplicationConfig = {
  providers: [
    provideServerRendering(withRoutes(serverRoutes)),
    {
      provide: TranslateLoader,
      useClass: ServerTranslateLoader
    },
    // Override provideMarkdown for SSR: disable clipboard (uses DOM) to prevent crashes
    provideMarkdown(),
    {
      provide: CLIPBOARD_OPTIONS,
      useValue: {},
    },
  ]
};

export const config = mergeApplicationConfig(appConfig, serverConfig);

