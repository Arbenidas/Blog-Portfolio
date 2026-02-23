import { TranslateLoader } from '@ngx-translate/core';
import { HttpClient } from '@angular/common/http';
import { Observable, of } from 'rxjs';
import { join } from 'path';
import * as fs from 'fs';

export class UniversalTranslateLoader implements TranslateLoader {
    constructor(
        private http: HttpClient,
        private prefix: string = 'assets/i18n/',
        private suffix: string = '.json'
    ) { }

    public getTranslation(lang: string): Observable<any> {
        if (typeof window !== 'undefined') {
            // Browser
            return this.http.get(`./${this.prefix}${lang}${this.suffix}`);
        } else {
            // Server / Prerender
            try {
                const filePath = join(process.cwd(), 'public', this.prefix, `${lang}${this.suffix}`);
                const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
                return of(data);
            } catch (err) {
                console.error(`[UniversalTranslateLoader] Error loading ${lang} on server:`, err);
                return of({});
            }
        }
    }
}
