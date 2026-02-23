import { TranslateLoader } from '@ngx-translate/core';
import { Observable, of } from 'rxjs';
import { join } from 'path';
import * as fs from 'fs';

export class ServerTranslateLoader implements TranslateLoader {
    constructor(
        private prefix: string = 'public/assets/i18n/',
        private suffix: string = '.json'
    ) { }

    public getTranslation(lang: string): Observable<any> {
        try {
            const fullPath = join(process.cwd(), this.prefix, lang + this.suffix);
            const data = JSON.parse(fs.readFileSync(fullPath, 'utf8'));
            return of(data);
        } catch (err) {
            console.error(`[ServerTranslateLoader] Error loading ${lang}:`, err);
            return of({});
        }
    }
}
