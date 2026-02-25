import { Component, OnInit, AfterViewInit, inject, PLATFORM_ID, Input } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';

@Component({
    selector: 'app-native-ad',
    standalone: true,
    templateUrl: './native-ad.html',
    styleUrl: './native-ad.css'
})
export class NativeAdComponent implements AfterViewInit {
    private platformId = inject(PLATFORM_ID);
    @Input() adSlot = '4531784987';

    ngAfterViewInit() {
        if (isPlatformBrowser(this.platformId)) {
            try {
                ((window as any).adsbygoogle = (window as any).adsbygoogle || []).push({});
            } catch (e) {
                // AdSense not loaded or ad blocker active
            }
        }
    }
}
