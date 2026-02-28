import { Component, OnInit, signal, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { ContentService, DocumentEntry } from '../../services/content.service';
import { SeoService } from '../../services/seo.service';

@Component({
  selector: 'app-feed',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './feed.html',
  styleUrl: './feed.css'
})
export class Feed implements OnInit {
  private contentService = inject(ContentService);
  private seoService = inject(SeoService);

  documents = signal<DocumentEntry[]>([]);
  isLoading = signal(true);
  isLoadingMore = signal(false);
  hasMore = signal(true);

  currentPage = 1;
  limitPerPage = 15;

  activeFilters = signal<string[]>(['all']);
  activeTagFilters = signal<string[]>([]);
  availableTags = signal<string[]>([]);

  // Top contributors array from DB
  topContributors = signal<any[]>([]);

  ngOnInit() {
    this.seoService.updateMetaTags({
      title: 'Arbe | Community Feed Gallery',
      description: 'A continuous stream of public field logs, project bluepints, and guides from the arbes.blog collective.',
      type: 'website'
    });

    this.initialFetchData();
  }

  async initialFetchData() {
    this.loadFeed(true);

    // Fetch unique tags
    const tags = await this.contentService.getUniqueTags();
    this.availableTags.set(tags);

    // Fetch top contributors
    const contributors = await this.contentService.getTopContributors(4);
    this.topContributors.set(contributors);
  }

  async loadFeed(reset: boolean = false) {
    if (reset) {
      this.currentPage = 1;
      this.hasMore.set(true);
      this.documents.set([]);
      this.isLoading.set(true);
    } else {
      this.isLoadingMore.set(true);
    }

    try {
      const filters = this.activeFilters();

      // Local filtering mechanism for tags before passing to API (since API doesn't support tag filtering yet without a new query mod)
      // Note: Ideally, tag filtering happens at the Supabase query level to maintain pagination integrity.
      // But for this step, we'll try to fetch with category and filter locally, OR we can append tag filtering logic if needed.
      const docs = await this.contentService.getFeedDocuments(this.currentPage, this.limitPerPage, filters);

      // Local tag filtering if active
      const selectedTags = this.activeTagFilters();
      let filteredDocs = docs;

      if (selectedTags.length > 0) {
        filteredDocs = docs.filter(doc => doc.tags && doc.tags.some(t => selectedTags.includes(t)));
      }

      if (docs.length < this.limitPerPage) {
        this.hasMore.set(false);
      }

      if (reset) {
        this.documents.set(filteredDocs);
      } else {
        this.documents.update(prev => {
          // Prevent duplicates on local tag filtering reload
          const newItems = filteredDocs.filter(fd => !prev.some(p => p.id === fd.id));
          return [...prev, ...newItems];
        });
      }
    } catch (error) {
      console.error('Error loading feed:', error);
    } finally {
      this.isLoading.set(false);
      this.isLoadingMore.set(false);
    }
  }

  async loadMore() {
    if (this.isLoadingMore() || !this.hasMore()) return;
    this.currentPage++;
    await this.loadFeed();
  }

  toggleFilter(category: string) {
    const filters = this.activeFilters();

    if (category === 'all') {
      this.activeFilters.set(['all']);
    } else {
      let newFilters = filters.filter(f => f !== 'all');

      if (newFilters.includes(category)) {
        newFilters = newFilters.filter(f => f !== category);
        if (newFilters.length === 0) newFilters = ['all'];
      } else {
        newFilters.push(category);
      }

      this.activeFilters.set(newFilters);
    }

    this.loadFeed(true);
  }

  toggleTagFilter(tag: string) {
    const currentTags = this.activeTagFilters();
    if (currentTags.includes(tag)) {
      this.activeTagFilters.set(currentTags.filter(t => t !== tag));
    } else {
      this.activeTagFilters.set([...currentTags, tag]);
    }
    this.loadFeed(true); // reload with tag filter applied
  }

  isTagActive(tag: string): boolean {
    return this.activeTagFilters().includes(tag);
  }

  isFilterActive(category: string): boolean {
    return this.activeFilters().includes(category);
  }

  getExcerpt(doc: DocumentEntry): string {
    if (!doc.blocks || doc.blocks.length === 0) return 'No content preview available.';
    const textBlock = doc.blocks.find(b => b.type === 'p' || b.type === 'h1' || b.type === 'h2' || b.type === 'objective-header' || b.type === 'objectives');
    if (!textBlock) return 'Content encrypted or unreadable.';

    // Strip HTML tags for preview and truncate
    const plainText = textBlock.content.replace(/<[^>]*>?/gm, '');
    return plainText.length > 150 ? plainText.substring(0, 150) + '...' : plainText;
  }
}
