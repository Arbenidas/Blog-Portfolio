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

  analyzeTags() {
    const tagClasses = [
      'tag-item-primary',
      'tag-item-cream',
      'tag-item-orange',
      'tag-item-cream',
      'tag-item-primary'
    ];

    const counts: Record<string, number> = {};
    const primaryCounts: Record<string, number> = {};

    for (const log of this.logs) {
      if (!log.tags || log.tags.length === 0) continue;

      // The first tag is considered the primary theme
      const primaryTag = log.tags[0].toUpperCase();
      primaryCounts[primaryTag] = (primaryCounts[primaryTag] || 0) + 1;

      for (const t of log.tags) {
        const u = t.toUpperCase();
        counts[u] = (counts[u] || 0) + 1;
      }
    }

    // Sort all tags by frequency
    const sortedTags = Object.keys(counts).sort((a, b) => counts[b] - counts[a]);

    // 1. FILTER PROTOCOLS: Predetermined toggles
    this.filterProtocols = [
      { name: 'FRONTEND_DEV', active: false, class: 'tag-item-primary' },
      { name: 'BACKEND_SYS', active: false, class: 'tag-item-cream' },
      { name: 'UI_DESIGN', active: false, class: 'tag-item-orange' },
      { name: 'EXP_RESEARCH', active: false, class: 'tag-item-primary' }
    ];

    // 2. TECH STACK DENSITY: All tags with counts and percentages
    const maxCount = sortedTags.length > 0 ? counts[sortedTags[0]] : 1;
    this.techStackDensity = sortedTags.map(name => ({
      name: name,
      count: counts[name],
      isPrimary: (primaryCounts[name] || 0) > 0, // Flag if it's ever been a primary theme
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

      // 2. Filter Protocols (Tags) - Strict AND Logic
      if (this.activeFilters.size > 0) {
        if (!log.tags || log.tags.length === 0) return false;
        const logTagsLower = log.tags.map(t => t.toLowerCase());

        // For EACH active filter, the log must satisfy it
        for (const activeFilter of this.activeFilters) {

          // Map to specific tags if it's a known category
          let categoryTags: string[] = [];
          if (activeFilter === 'FRONTEND_DEV') categoryTags = ['frontend', 'angular', 'react', 'vue', 'html', 'css', 'ui', 'tailwind', 'typescript', 'javascript'];
          else if (activeFilter === 'BACKEND_SYS') categoryTags = ['backend', 'node', 'express', 'nestjs', 'python', 'database', 'api', 'supabase', 'postgres', 'docker'];
          else if (activeFilter === 'UI_DESIGN') categoryTags = ['design', 'figma', 'ux', 'ui/ux', 'prototype', 'interface', 'wireframe', 'architecture'];
          else if (activeFilter === 'EXP_RESEARCH') categoryTags = ['research', 'case study', 'experiment', 'webgl', 'three.js', 'analysis'];
          else categoryTags = [activeFilter.toLowerCase()]; // Fallback if clicking a specific tag name directly later

          // Check if the log satisfies THIS specific filter
          let satisfiesFilter = false;

          for (const expectedTag of categoryTags) {
            if (logTagsLower.includes(expectedTag)) {
              satisfiesFilter = true;
              break;
            }
          }

          // If the log doesn't satisfy even one active filter, reject it (AND logic)
          if (!satisfiesFilter) return false;
        }
      }

      return true;
    });
  }
}
