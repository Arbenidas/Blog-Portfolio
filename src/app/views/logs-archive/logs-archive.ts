import { Component, inject, OnInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { ContentService, DocumentEntry } from '../../services/content.service';
import { SeoService } from '../../services/seo.service';
import { NativeAdComponent } from '../../components/native-ad/native-ad';

@Component({
  selector: 'app-logs-archive',
  imports: [CommonModule, RouterModule, NativeAdComponent],
  templateUrl: './logs-archive.html',
  styleUrl: './logs-archive.css',
})
export class LogsArchive implements OnInit {
  private contentService = inject(ContentService);
  private seoService = inject(SeoService);
  private cdr = inject(ChangeDetectorRef);

  logs: DocumentEntry[] = [];
  isLoading = true;

  // Search & Filter State
  searchQuery: string = '';
  activeFilters: Set<string> = new Set<string>();

  // View toggle: 'timeline' | 'grid'
  viewMode: 'timeline' | 'grid' = 'timeline';

  // UI Data
  filterProtocols: { name: string, active: boolean, class: string }[] = [];
  techStackDensity: { name: string, count: number, isPrimary: boolean, percentage: number }[] = [];

  async ngOnInit() {
    this.seoService.updateMetaTags({
      title: 'Mission Logs',
      description: 'Field notes, thoughts, and technical logs written by Arbe on software engineering.',
      type: 'website'
    });

    this.isLoading = true;
    this.logs = await this.contentService.getAllLogs(1, 1000, ['log']);

    this.analyzeTags();

    this.isLoading = false;
    this.cdr.detectChanges();
  }

  /** #4 — Date of the most recent log, dynamically */
  get latestLogDate(): string {
    if (!this.logs || this.logs.length === 0) return '—';
    const latest = this.logs[0]?.createdAt;
    if (!latest) return '—';
    const d = new Date(latest);
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    return `${yyyy}.${mm}.${dd}`;
  }

  /** #5 — Toggle between timeline and grid view */
  toggleViewMode() {
    this.viewMode = this.viewMode === 'timeline' ? 'grid' : 'timeline';
    this.cdr.markForCheck();
  }

  analyzeTags() {
    const counts: Record<string, number> = {};
    const primaryCounts: Record<string, number> = {};

    for (const log of this.logs) {
      if (!log.tags || log.tags.length === 0) continue;

      const primaryTag = log.tags[0].toUpperCase();
      primaryCounts[primaryTag] = (primaryCounts[primaryTag] || 0) + 1;

      for (const t of log.tags) {
        const u = t.toUpperCase();
        counts[u] = (counts[u] || 0) + 1;
      }
    }

    const sortedTags = Object.keys(counts).sort((a, b) => counts[b] - counts[a]);

    this.filterProtocols = [
      { name: 'FRONTEND_DEV', active: false, class: 'tag-item-primary' },
      { name: 'BACKEND_SYS', active: false, class: 'tag-item-cream' },
      { name: 'UI_DESIGN', active: false, class: 'tag-item-orange' },
      { name: 'EXP_RESEARCH', active: false, class: 'tag-item-primary' }
    ];

    const maxCount = sortedTags.length > 0 ? counts[sortedTags[0]] : 1;
    this.techStackDensity = sortedTags.map(name => ({
      name: name,
      count: counts[name],
      isPrimary: (primaryCounts[name] || 0) > 0,
      percentage: Math.round((counts[name] / maxCount) * 100)
    }));
  }

  // --- ACTIONS ---

  onSearchChange(event: Event) {
    const target = event.target as HTMLInputElement;
    this.searchQuery = target.value.toLowerCase();
    this.cdr.markForCheck();
  }

  toggleFilter(tagName: string) {
    const protocol = this.filterProtocols.find(p => p.name === tagName);
    if (protocol) {
      protocol.active = !protocol.active;
      if (protocol.active) {
        this.activeFilters.add(tagName);
      } else {
        this.activeFilters.delete(tagName);
      }
      this.cdr.markForCheck();
    }
  }

  /** #2 — Filter by clicking a density tag directly */
  toggleTagFilter(tagName: string) {
    const normalizedTag = tagName.toUpperCase();
    if (this.activeFilters.has(normalizedTag)) {
      this.activeFilters.delete(normalizedTag);
    } else {
      this.activeFilters.add(normalizedTag);
    }
    this.cdr.markForCheck();
  }

  isTagFilterActive(tagName: string): boolean {
    return this.activeFilters.has(tagName.toUpperCase());
  }

  getExcerpt(log: DocumentEntry): string {
    if (log.markdownContent) {
      return log.markdownContent.replace(/[#*`>\-|!\[\]()]/g, '').trim().substring(0, 150) + '...';
    }
    if (log.blocks && log.blocks.length > 0) {
      return log.blocks[0].content.substring(0, 150) + '...';
    }
    return '[ENCRYPTED_DATA_PACKET]';
  }

  get filteredLogs(): DocumentEntry[] {
    return this.logs.filter(log => {
      // 1. Search Query Match
      if (this.searchQuery) {
        const titleMatch = log.title.toLowerCase().includes(this.searchQuery);
        let contentMatch = false;
        if (log.markdownContent) {
          contentMatch = log.markdownContent.toLowerCase().includes(this.searchQuery);
        } else if (log.blocks && log.blocks.length > 0) {
          contentMatch = log.blocks[0].content.toLowerCase().includes(this.searchQuery);
        }

        if (!titleMatch && !contentMatch) return false;
      }

      // 2. Filter Protocols (Tags) — supports both protocol-button filters and direct tag filters
      if (this.activeFilters.size > 0) {
        if (!log.tags || log.tags.length === 0) return false;
        const logTagsUpper = log.tags.map(t => t.toUpperCase());

        for (const activeFilter of this.activeFilters) {
          let categoryTags: string[] = [];
          if (activeFilter === 'FRONTEND_DEV') categoryTags = ['FRONTEND', 'ANGULAR', 'REACT', 'VUE', 'HTML', 'CSS', 'UI', 'TAILWIND', 'TYPESCRIPT', 'JAVASCRIPT'];
          else if (activeFilter === 'BACKEND_SYS') categoryTags = ['BACKEND', 'NODE', 'EXPRESS', 'NESTJS', 'PYTHON', 'DATABASE', 'API', 'SUPABASE', 'POSTGRES', 'DOCKER'];
          else if (activeFilter === 'UI_DESIGN') categoryTags = ['DESIGN', 'FIGMA', 'UX', 'UI/UX', 'PROTOTYPE', 'INTERFACE', 'WIREFRAME', 'ARCHITECTURE'];
          else if (activeFilter === 'EXP_RESEARCH') categoryTags = ['RESEARCH', 'CASE STUDY', 'EXPERIMENT', 'WEBGL', 'THREE.JS', 'ANALYSIS'];
          else categoryTags = [activeFilter]; // Direct tag filter from density panel

          let satisfiesFilter = false;
          for (const expectedTag of categoryTags) {
            if (logTagsUpper.includes(expectedTag)) {
              satisfiesFilter = true;
              break;
            }
          }

          if (!satisfiesFilter) return false;
        }
      }

      return true;
    });
  }
}
