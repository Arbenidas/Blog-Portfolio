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
    this.logs = await this.contentService.getAllLogs();

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

  // --- GETTERS ---

  get filteredLogs(): DocumentEntry[] {
    return this.logs.filter(log => {
      // 1. Search Query Match
      if (this.searchQuery) {
        const titleMatch = log.title.toLowerCase().includes(this.searchQuery);
        const contentMatch = (log.blocks && log.blocks.length > 0)
          ? log.blocks[0].content.toLowerCase().includes(this.searchQuery)
          : false;

        if (!titleMatch && !contentMatch) return false;
      }

      // 2. Filter Protocols (Tags)
      if (this.activeFilters.size > 0) {
        if (!log.tags || log.tags.length === 0) return false;
        const logTagsLower = log.tags.map(t => t.toLowerCase());

        const activeCategoryTags: string[] = [];
        if (this.activeFilters.has('FRONTEND_DEV')) activeCategoryTags.push('frontend', 'angular', 'react', 'vue', 'html', 'css', 'ui', 'tailwind', 'typescript', 'javascript');
        if (this.activeFilters.has('BACKEND_SYS')) activeCategoryTags.push('backend', 'node', 'express', 'nestjs', 'python', 'database', 'api', 'supabase', 'postgres', 'docker');
        if (this.activeFilters.has('UI_DESIGN')) activeCategoryTags.push('design', 'figma', 'ux', 'ui/ux', 'prototype', 'interface', 'wireframe', 'architecture');
        if (this.activeFilters.has('EXP_RESEARCH')) activeCategoryTags.push('research', 'case study', 'experiment', 'webgl', 'three.js', 'analysis');

        // Log must contain AT LEAST ONE of the active category's mapped tags or match the filter name exactly
        let hasMatchedTag = false;

        for (const tag of logTagsLower) {
          if (activeCategoryTags.includes(tag)) {
            hasMatchedTag = true;
            break;
          }
        }

        // Also check exact match against the filter name just in case
        if (!hasMatchedTag) {
          for (const activeTag of this.activeFilters) {
            if (logTagsLower.includes(activeTag.toLowerCase())) {
              hasMatchedTag = true;
              break;
            }
          }
        }

        if (!hasMatchedTag) return false;
      }

      return true;
    });
  }
}
