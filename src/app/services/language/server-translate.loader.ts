import { TranslateLoader } from '@ngx-translate/core';
import { Observable, of } from 'rxjs';

// Importamos los JSON directamente en el bundle del servidor
import * as esTranslation from '../../../../public/assets/i18n/es.json';
import * as enTranslation from '../../../../public/assets/i18n/en.json';

export class ServerTranslateLoader implements TranslateLoader {
    getTranslation(lang: string): Observable<any> {
        // Por cómo TypeScript compila los JSON, extraemos la data de forma segura
        const es = (esTranslation as any).default || esTranslation;
        const en = (enTranslation as any).default || enTranslation;

        return of(lang === 'en' ? en : es);
    }
}