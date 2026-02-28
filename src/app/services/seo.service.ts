import { Injectable, inject, PLATFORM_ID } from '@angular/core';
import { Title, Meta } from '@angular/platform-browser';
import { DOCUMENT, isPlatformBrowser } from '@angular/common';

export interface MetaConfig {
    title?: string;
    description?: string;
    image?: string;
    url?: string;
    type?: string;
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

    updateMetaTags(config: MetaConfig) {
        const title = config.title ? `${config.title} | arbes.blog` : this.DEFAULT_TITLE;
        const description = config.description || this.DEFAULT_DESC;
        const image = config.image ? this.getTransformedImageUrl(config.image) : this.DEFAULT_IMAGE;

        let url = this.DEFAULT_URL;
        if (config.url) {
            url = `https://arbe.blog${config.url}`;
        } else if (isPlatformBrowser(this.platformId)) {
            // Safe access to location object in browser
            url = this.document.location?.href || this.DEFAULT_URL;
        }

        const type = config.type || 'website';

        // Standard Tags
        this.titleService.setTitle(title);
        this.metaService.updateTag({ name: 'description', content: description });

        // Open Graph (Facebook, LinkedIn, Discord)
        this.metaService.updateTag({ property: 'og:site_name', content: 'arbes.blog' });
        this.metaService.updateTag({ property: 'og:title', content: title });
        this.metaService.updateTag({ property: 'og:description', content: description });
        this.metaService.updateTag({ property: 'og:image', content: image });
        this.metaService.updateTag({ property: 'og:image:alt', content: title });
        if (image.includes('?width=')) {
            this.metaService.updateTag({ property: 'og:image:width', content: '1200' });
            this.metaService.updateTag({ property: 'og:image:height', content: '630' });
        }
        this.metaService.updateTag({ property: 'og:url', content: url });
        this.metaService.updateTag({ property: 'og:type', content: type });

        // Twitter Cards (X, Slack)
        this.metaService.updateTag({ name: 'twitter:card', content: 'summary_large_image' });
        this.metaService.updateTag({ name: 'twitter:title', content: title });
        this.metaService.updateTag({ name: 'twitter:description', content: description });
        this.metaService.updateTag({ name: 'twitter:image', content: image });
        this.metaService.updateTag({ name: 'twitter:image:alt', content: title });
    }

    /**
     * Optimizes Supabase image URLs for social media.
     * Generates a 1200x630 image (standard for summary_large_image)
     */
    private getTransformedImageUrl(imageUrl: string): string {
        if (!imageUrl) return this.DEFAULT_IMAGE;
        // If it's a Supabase storage URL, we can append transformation parameters
        if (imageUrl.includes('supabase.co/storage/v1/object/public/')) {
            const baseUrl = imageUrl.split('?')[0];
            return `${baseUrl}?width=1200&height=630&resize=cover`;
        }
        return imageUrl;
    }

    resetMetaTags() {
        this.updateMetaTags({});
    }
}
