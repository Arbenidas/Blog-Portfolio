import { Injectable, inject, signal, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { TranslateService } from '@ngx-translate/core';

@Injectable({
    providedIn: 'root'
})
export class LanguageService {
    private translate = inject(TranslateService);
    private platformId = inject(PLATFORM_ID);

    activeLang = signal<'es' | 'en'>('es');

    constructor() {
        this.initLanguage();
    }

    private initLanguage() {
        let lang: string | null = 'es';

        if (isPlatformBrowser(this.platformId)) {
            lang = localStorage.getItem('user_lang');
            if (!lang) {
                const browserLang = this.translate.getBrowserLang();
                lang = browserLang?.match(/en|es/) ? browserLang : 'es';
            }
        }

        this.setLanguage(lang as 'es' | 'en');
    }

    setLanguage(lang: 'es' | 'en') {
        this.activeLang.set(lang);
        this.translate.use(lang);

        if (isPlatformBrowser(this.platformId)) {
            localStorage.setItem('user_lang', lang);
        }
    }

    toggleLanguage() {
        const nextLang = this.activeLang() === 'es' ? 'en' : 'es';
        this.setLanguage(nextLang);
    }
}
