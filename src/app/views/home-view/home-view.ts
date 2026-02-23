import { Component, OnDestroy, OnInit, signal, inject, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { SeoService } from '../../services/seo.service';
import { ContentService, DocumentEntry, ProfileData, CustomWidget } from '../../services/content.service';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';

@Component({
  selector: 'app-home-view',
  imports: [CommonModule, RouterModule],
  templateUrl: './home-view.html',
  styleUrl: './home-view.css',
})
export class HomeView implements OnInit, OnDestroy {
  private seoService = inject(SeoService);
  private contentService = inject(ContentService);
  private cdr = inject(ChangeDetectorRef);
  private sanitizer = inject(DomSanitizer);

  works: DocumentEntry[] = [];
  logs: DocumentEntry[] = [];

  profile = signal<ProfileData | null>(null);
  widgets = signal<CustomWidget[]>([]);

  cpuGhz = signal(88.4);
  tempCelsius = signal(45.2);
  uptime = signal('12:04:11');

  activeTab = signal<'works' | 'about' | 'logs'>('about');

  setTab(tab: 'works' | 'about' | 'logs') {
    this.activeTab.set(tab);
  }

  private intervalId: any;
  private uptimeSeconds = 12 * 3600 + 4 * 60 + 11; // 12:04:11 in seconds

  ngOnInit() {
    this.seoService.updateMetaTags({
      title: 'Arbe | Developer & Architect',
      description: 'Personal portfolio, digital workshop, and engineering field logs of Arbe. Focusing on Angular, Node.js, and solid architectures.',
      type: 'website'
    });

    this.loadData();

    // Start the diagnostics simulation loop
    this.intervalId = setInterval(() => {
      // Simulate CPU fluctuation between 86.0 and 89.9
      this.cpuGhz.set(86 + Math.random() * 3.9);

      // Simulate Temp fluctuation between 44.0 and 46.5
      this.tempCelsius.set(44 + Math.random() * 2.5);

      // Update uptime counter
      this.uptimeSeconds++;
      const h = Math.floor(this.uptimeSeconds / 3600);
      const m = Math.floor((this.uptimeSeconds % 3600) / 60);
      const s = this.uptimeSeconds % 60;

      const formattedTime = `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
      this.uptime.set(formattedTime);
    }, 1000);
  }

  async loadData() {
    const [allWorks, allLogs, profileObj, customWidgets] = await Promise.all([
      this.contentService.getAllWorks(4),
      this.contentService.getAllLogs(3),
      this.contentService.getProfile(),
      this.contentService.getCustomWidgets()
    ]);

    this.works = allWorks;
    this.logs = allLogs;

    if (profileObj) {
      this.profile.set(profileObj);
    }
    if (customWidgets) {
      this.widgets.set(customWidgets);
    }

    this.cdr.detectChanges();
  }

  getWidgetHtml(id: string): SafeHtml {
    const w = this.widgets().find(w => w.id === id);
    return w ? this.sanitizer.bypassSecurityTrustHtml(w.html_content) : '';
  }

  getSafeHtml(html: string): SafeHtml {
    return this.sanitizer.bypassSecurityTrustHtml(html);
  }

  ngOnDestroy() {
    if (this.intervalId) {
      clearInterval(this.intervalId);
    }
  }
}
