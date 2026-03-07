import { Injectable, inject, PLATFORM_ID } from '@angular/core';
import { Title, Meta } from '@angular/platform-browser';
import { DOCUMENT, isPlatformBrowser } from '@angular/common';

export interface MetaConfig {
    title?: string;
    description?: string;
    image?: string;
    url?: string;
    type?: string;
    publishedAt?: string;
    tags?: string[];
    authorName?: string;
}

@Injectable({
    providedIn: 'root'
})
export class SeoService {
    private titleService = inject(Title);
    private metaService = inject(Meta);
    private document = inject(DOCUMENT);
    private platformId = inject(PLATFORM_ID);

    private readonly DEFAULT_TITLE = "arbes.blog - Portfolio";
    private readonly DEFAULT_DESC = "A showcase of industrial design, engineering projects, and creative logs.";
    private readonly DEFAULT_IMAGE = "https://arbe.blog/logo.png";
    private readonly DEFAULT_URL = "https://arbe.blog/";
    private readonly SITE_NAME = "arbes.blog";

    updateMetaTags(config: MetaConfig) {
        const title = config.title ? `${config.title} | ${this.SITE_NAME}` : this.DEFAULT_TITLE;
        const description = config.description || this.DEFAULT_DESC;
        const image = config.image ? this.getTransformedImageUrl(config.image) : this.DEFAULT_IMAGE;

        let url = this.DEFAULT_URL;
        if (config.url) {
            url = `https://arbe.blog${config.url}`;
        } else if (isPlatformBrowser(this.platformId)) {
            url = this.document.location?.href || this.DEFAULT_URL;
        }

        const type = config.type || 'website';

        // Standard Tags
        this.titleService.setTitle(title);
        this.metaService.updateTag({ name: 'description', content: description });
        if (config.tags?.length) {
            this.metaService.updateTag({ name: 'keywords', content: config.tags.join(', ') });
        }

        // Canonical Link Tag
        this.setCanonical(url);

        // Open Graph
        this.metaService.updateTag({ property: 'og:site_name', content: this.SITE_NAME });
        this.metaService.updateTag({ property: 'og:locale', content: 'es_ES' });
        this.metaService.updateTag({ property: 'og:title', content: title });
        this.metaService.updateTag({ property: 'og:description', content: description });
        this.metaService.updateTag({ property: 'og:image', content: image });
        this.metaService.updateTag({ property: 'og:image:alt', content: title });
        this.metaService.updateTag({ property: 'og:image:width', content: '1200' });
        this.metaService.updateTag({ property: 'og:image:height', content: '630' });
        this.metaService.updateTag({ property: 'og:image:type', content: 'image/jpeg' });
        this.metaService.updateTag({ property: 'og:url', content: url });
        this.metaService.updateTag({ property: 'og:type', content: type });
        if (config.publishedAt) {
            this.metaService.updateTag({ property: 'article:published_time', content: config.publishedAt });
        }
        // #13 — article:tag for each post tag
        if (config.tags?.length) {
            // Remove any existing article:tag tags first
            config.tags.forEach((tag, i) => {
                this.metaService.updateTag({ property: 'article:tag', content: tag });
            });
        }

        // Twitter Cards
        this.metaService.updateTag({ name: 'twitter:card', content: 'summary_large_image' });
        this.metaService.updateTag({ name: 'twitter:site', content: '@arbe_dev' });
        this.metaService.updateTag({ name: 'twitter:title', content: title });
        this.metaService.updateTag({ name: 'twitter:description', content: description });
        this.metaService.updateTag({ name: 'twitter:image', content: image });
        this.metaService.updateTag({ name: 'twitter:image:alt', content: title });
    }

    /** Inject/update a JSON-LD <script> structured data block */
    setJsonLd(data: object): void {
        const id = 'json-ld-structured-data';
        let script = this.document.getElementById(id) as HTMLScriptElement | null;
        if (!script) {
            script = this.document.createElement('script');
            script.type = 'application/ld+json';
            script.id = id;
            this.document.head.appendChild(script);
        }
        script.textContent = JSON.stringify(data);
    }

    removeJsonLd(): void {
        this.document.getElementById('json-ld-structured-data')?.remove();
    }

    private setCanonical(url: string): void {
        let link: HTMLLinkElement | null = this.document.querySelector('link[rel="canonical"]');
        if (!link) {
            link = this.document.createElement('link');
            link.setAttribute('rel', 'canonical');
            this.document.head.appendChild(link);
        }
        link.setAttribute('href', url);
    }

    private getTransformedImageUrl(imageUrl: string): string {
        if (!imageUrl) return this.DEFAULT_IMAGE;
        if (imageUrl.includes('supabase.co/storage/v1/object/public/')) {
            const baseUrl = imageUrl.split('?')[0];
            return `${baseUrl}?width=1200&height=630&resize=cover`;
        }
        return imageUrl;
    }

    resetMetaTags() {
        this.updateMetaTags({});
        this.removeJsonLd();
    }
}
