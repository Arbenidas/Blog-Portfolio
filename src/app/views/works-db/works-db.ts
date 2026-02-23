import { Component, inject, OnInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { ContentService, DocumentEntry } from '../../services/content.service';
import { SeoService } from '../../services/seo.service';

@Component({
  selector: 'app-works-db',
  imports: [CommonModule, RouterModule, FormsModule],
  templateUrl: './works-db.html',
  styleUrl: './works-db.css',
})
export class WorksDb implements OnInit {
  private contentService = inject(ContentService);
  private seoService = inject(SeoService);
  private cdr = inject(ChangeDetectorRef);

  works: DocumentEntry[] = [];
  filteredWorks: DocumentEntry[] = [];
  isLoading = true;

  searchQuery = '';

  filters = {
    frontend: false,
    backend: false,
    design: false,
    research: false
  };

  techStackDensity: { name: string; count: number }[] = [];

  async ngOnInit() {
    this.seoService.updateMetaTags({
      title: 'Works Database',
      description: 'Archive of engineering projects, case studies, and digital experiments by Arbe.',
      type: 'website'
    });

    this.isLoading = true;
    this.works = await this.contentService.getAllWorks();
    this.calculateTechStack();
    this.applyFilters();

    this.isLoading = false;
    this.cdr.detectChanges();
  }

  applyFilters() {
    let result = this.works;

    if (this.searchQuery.trim()) {
      const q = this.searchQuery.toLowerCase();
      result = result.filter(w =>
        w.title.toLowerCase().includes(q) ||
        (w.tags && w.tags.some(t => t.toLowerCase().includes(q)))
      );
    }

    const hasActiveFilters = this.filters.frontend || this.filters.backend || this.filters.design || this.filters.research;

    if (hasActiveFilters) {
      const activeTags: string[] = [];
      if (this.filters.frontend) activeTags.push('frontend', 'angular', 'react', 'vue', 'html', 'css', 'ui', 'tailwind', 'typescript', 'javascript');
      if (this.filters.backend) activeTags.push('backend', 'node', 'express', 'nestjs', 'python', 'database', 'api', 'supabase', 'postgres', 'docker');
      if (this.filters.design) activeTags.push('design', 'figma', 'ux', 'ui/ux', 'prototype', 'interface', 'wireframe');
      if (this.filters.research) activeTags.push('research', 'case study', 'experiment', 'webgl', 'three.js', 'analysis');

      result = result.filter(w => {
        if (!w.tags) return false;
        return w.tags.some(tag => activeTags.includes(tag.toLowerCase()));
      });
    }

    this.filteredWorks = result;
  }

  calculateTechStack() {
    const counts: Record<string, number> = {};
    for (const w of this.works) {
      if (!w.tags || w.tags.length === 0) continue;

      for (const t of w.tags) {
        const u = t.toUpperCase();
        counts[u] = (counts[u] || 0) + 1;
      }
    }

    this.techStackDensity = Object.keys(counts)
      .map(k => ({ name: k, count: counts[k] }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10); // increased to 10 to show a nice block of tags
  }
}

