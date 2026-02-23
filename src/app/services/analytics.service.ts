import { Injectable, inject } from '@angular/core';
import { Router, NavigationEnd } from '@angular/router';
import { filter } from 'rxjs/operators';

declare var gtag: Function;
declare var dataLayer: any[];

@Injectable({
    providedIn: 'root'
})
export class AnalyticsService {
    private router = inject(Router);

    /**
     * Initializes the route tracking listener.
     * This should be called once at the start of the application.
     */
    initRouteTracking() {
        this.router.events.pipe(
            filter(event => event instanceof NavigationEnd)
        ).subscribe((event: any) => {
            this.trackPageView(event.urlAfterRedirects);
        });
    }

    /**
   * Pushes a page_view event using gtag.
   * @param url The URL of the page being viewed.
   */
    private trackPageView(url: string) {
        // 1. Direct GA4 (gtag.js)
        if (typeof gtag !== 'undefined') {
            gtag('config', 'G-PYC66B2X1J', {
                'page_path': url
            });
        }

        // 2. GTM dataLayer push
        if (typeof dataLayer !== 'undefined') {
            dataLayer.push({
                event: 'page_view',
                page_path: url
            });
        }
    }

    /**
     * Helper to track custom events using gtag.
     */
    trackEvent(eventName: string, params: any = {}) {
        // 1. Direct GA4
        if (typeof gtag !== 'undefined') {
            gtag('event', eventName, params);
        }

        // 2. GTM dataLayer push
        if (typeof dataLayer !== 'undefined') {
            dataLayer.push({
                event: eventName,
                ...params
            });
        }
    }
}
