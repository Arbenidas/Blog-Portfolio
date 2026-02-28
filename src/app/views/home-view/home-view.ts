import { Component, OnDestroy, OnInit, signal, inject, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { SeoService } from '../../services/seo.service';
import { ContentService, DocumentEntry, ProfileData, CustomWidget } from '../../services/content.service';
import { SupabaseService } from '../../services/supabase.service';
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
  private supabaseService = inject(SupabaseService);
  private cdr = inject(ChangeDetectorRef);
  private sanitizer = inject(DomSanitizer);

  works: DocumentEntry[] = [];
  logs: DocumentEntry[] = [];
  trendingLogs: DocumentEntry[] = [];
  recentActivities: { title: string, category: string, author: string, time: string, slug: string }[] = [];
  isLoading = signal(true);
  currentUser = this.supabaseService.currentUser$;

  activeAgents = 0;
  publishedLogs = 0;
  archivedWorks = 0;

  currentPage = 1;
  logsPerPage = 10;
  hasMoreLogs = true;
  isLoadingMore = false;

  profile = signal<ProfileData | null>(null);
  widgets = signal<CustomWidget[]>([]);

  // Real social data per document
  upvoteCounts: Record<string, number> = {};
  commentCounts: Record<string, number> = {};

  cpuGhz = signal(88.4);
  tempCelsius = signal(45.2);
  uptime = signal('12:04:11');

  activeTab = signal<'works' | 'about' | 'logs'>('about');

  setTab(tab: 'works' | 'about' | 'logs') {
    this.activeTab.set(tab);
  }

  private intervalId: any;
  private uptimeSeconds = 12 * 3600 + 4 * 60 + 11;

  ngOnInit() {
    this.seoService.updateMetaTags({
      title: 'Arbe | Developer & Architect',
      description: 'Personal portfolio, blog, and engineering field logs of Arbe. Focusing on Angular, Node.js, and solid architectures.',
      type: 'website'
    });

    this.loadData();

    this.intervalId = setInterval(() => {
      this.cpuGhz.set(86 + Math.random() * 3.9);
      this.tempCelsius.set(44 + Math.random() * 2.5);
      this.uptimeSeconds++;
      const h = Math.floor(this.uptimeSeconds / 3600);
      const m = Math.floor((this.uptimeSeconds % 3600) / 60);
      const s = this.uptimeSeconds % 60;
      this.uptime.set(`${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`);
    }, 1000);
  }

  async loadData() {
    this.isLoading.set(true);
    this.currentPage = 1;
    this.hasMoreLogs = true;
    try {
      const [works, logs, profile, widgets, stats, trending, activity] = await Promise.all([
        this.contentService.getAllWorks(3),
        this.contentService.getAllLogs(this.currentPage, this.logsPerPage),
        this.contentService.getProfile(),
        this.contentService.getCustomWidgets(),
        this.contentService.getPlatformStats(),
        this.contentService.getTrendingLogs(5),
        this.contentService.getRecentActivity(4)
      ]);

      this.works = works;
      this.logs = logs;
      this.profile.set(profile);
      this.widgets.set(widgets);

      this.activeAgents = stats.activeAgents;
      this.publishedLogs = stats.publishedLogs;
      this.archivedWorks = stats.archivedWorks;
      this.trendingLogs = trending;
      this.recentActivities = activity;

      if (logs.length < this.logsPerPage) {
        this.hasMoreLogs = false;
      }

      // Load real social counts for displayed logs
      const allDocIds = [...logs.map(l => l.id), ...trending.map(t => t.id)];
      const uniqueIds = [...new Set(allDocIds)];
      const [upvotes, comments] = await Promise.all([
        this.contentService.getUpvoteCountsForDocuments(uniqueIds),
        this.contentService.getCommentCountsForDocuments(uniqueIds)
      ]);
      this.upvoteCounts = upvotes;
      this.commentCounts = comments;

    } catch (error) {
      console.error('Error loading home data:', error);
    } finally {
      this.isLoading.set(false);
      this.cdr.detectChanges();
    }
  }

  async loadMoreLogs() {
    if (this.isLoadingMore || !this.hasMoreLogs) return;

    this.isLoadingMore = true;
    this.currentPage++;

    try {
      const moreLogs = await this.contentService.getAllLogs(this.currentPage, this.logsPerPage);
      if (moreLogs.length > 0) {
        this.logs = [...this.logs, ...moreLogs];

        // Load social counts for new logs
        const newIds = moreLogs.map(l => l.id);
        const [upvotes, comments] = await Promise.all([
          this.contentService.getUpvoteCountsForDocuments(newIds),
          this.contentService.getCommentCountsForDocuments(newIds)
        ]);
        this.upvoteCounts = { ...this.upvoteCounts, ...upvotes };
        this.commentCounts = { ...this.commentCounts, ...comments };
      }

      if (moreLogs.length < this.logsPerPage) {
        this.hasMoreLogs = false;
      }
    } catch (error) {
      console.error('Error loading more logs:', error);
    } finally {
      this.isLoadingMore = false;
      this.cdr.detectChanges();
    }
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
