import { Injectable, inject } from '@angular/core';
import { Title, Meta } from '@angular/platform-browser';

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

    private readonly DEFAULT_TITLE = "Arbe's Digital Workshop - Portfolio";
    private readonly DEFAULT_DESC = "A showcase of industrial design, engineering projects, and creative logs.";
    private readonly DEFAULT_IMAGE = "https://arbe.blog/logo.png";
    private readonly DEFAULT_URL = "https://arbe.blog/";

    updateMetaTags(config: MetaConfig) {
        const title = config.title ? `${config.title} | Arbe_Workshop` : this.DEFAULT_TITLE;
        const description = config.description || this.DEFAULT_DESC;
        const image = config.image || this.DEFAULT_IMAGE;
        const url = config.url ? `https://arbe.blog${config.url}` : this.DEFAULT_URL;
        const type = config.type || 'website';

        // Standard Tags
        this.titleService.setTitle(title);
        this.metaService.updateTag({ name: 'description', content: description });

        // Open Graph
        this.metaService.updateTag({ property: 'og:title', content: title });
        this.metaService.updateTag({ property: 'og:description', content: description });
        this.metaService.updateTag({ property: 'og:image', content: image });
        this.metaService.updateTag({ property: 'og:url', content: url });
        this.metaService.updateTag({ property: 'og:type', content: type });

        // Twitter
        this.metaService.updateTag({ name: 'twitter:title', content: title });
        this.metaService.updateTag({ name: 'twitter:description', content: description });
        this.metaService.updateTag({ name: 'twitter:image', content: image });
    }

    resetMetaTags() {
        this.updateMetaTags({});
    }
}
