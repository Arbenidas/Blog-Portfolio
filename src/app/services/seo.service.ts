import { Injectable, inject } from '@angular/core';
import { Title, Meta } from '@angular/platform-browser';
import { DOCUMENT } from '@angular/common';

interface SeoTags {
    title: string;
    description: string;
    image?: string;
    url?: string;
    type?: 'website' | 'article';
}

@Injectable({
    providedIn: 'root'
})
export class SeoService {
    private title = inject(Title);
    private meta = inject(Meta);
    private doc = inject(DOCUMENT);

    private readonly siteName = "Arbe's Digital Workshop";
    private readonly defaultImage = '/assets/og-default.jpg';

    updateMetaTags(tags: SeoTags): void {
        const fullTitle = `${tags.title} | ${this.siteName}`;
        const description = tags.description.slice(0, 160); // Google truncates at 160 chars
        const image = tags.image || this.defaultImage;
        const type = tags.type || 'website';

        // Standard SEO tags
        this.title.setTitle(fullTitle);
        this.meta.updateTag({ name: 'description', content: description });

        // Open Graph (Facebook, LinkedIn, WhatsApp previews)
        this.meta.updateTag({ property: 'og:title', content: fullTitle });
        this.meta.updateTag({ property: 'og:description', content: description });
        this.meta.updateTag({ property: 'og:image', content: image });
        this.meta.updateTag({ property: 'og:type', content: type });
        this.meta.updateTag({ property: 'og:site_name', content: this.siteName });
        if (tags.url) {
            this.meta.updateTag({ property: 'og:url', content: tags.url });
            this.updateCanonicalUrl(tags.url);
        }

        // Twitter Card
        this.meta.updateTag({ name: 'twitter:card', content: 'summary_large_image' });
        this.meta.updateTag({ name: 'twitter:title', content: fullTitle });
        this.meta.updateTag({ name: 'twitter:description', content: description });
        this.meta.updateTag({ name: 'twitter:image', content: image });
    }

    private updateCanonicalUrl(url: string): void {
        let link: HTMLLinkElement = this.doc.querySelector("link[rel='canonical']") as HTMLLinkElement;
        if (link) {
            link.href = url;
        } else {
            link = this.doc.createElement('link');
            link.rel = 'canonical';
            link.href = url;
            this.doc.head.appendChild(link);
        }
    }
}
