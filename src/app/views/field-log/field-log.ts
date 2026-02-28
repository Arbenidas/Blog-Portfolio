import { Component, inject, OnInit, OnDestroy, ChangeDetectorRef, ChangeDetectionStrategy, PLATFORM_ID, PendingTasks, ViewChild } from '@angular/core';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, RouterModule } from '@angular/router';
import { distinctUntilChanged, map } from 'rxjs/operators';
import { ContentService, DocumentEntry, CustomWidget } from '../../services/content.service';
import { DomSanitizer, SafeHtml, SafeResourceUrl } from '@angular/platform-browser';
import { SeoService } from '../../services/seo.service';

import { ShareButtons } from '../../components/share-buttons/share-buttons.component';
import { AdModalComponent } from '../../components/ad-modal/ad-modal';
import { PdfService } from '../../services/pdf.service';
import { FFlowModule } from '@foblex/flow';

@Component({
  selector: 'app-field-log',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule, ShareButtons, FFlowModule, AdModalComponent],
  templateUrl: './field-log.html',
  styleUrl: './field-log.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class FieldLog implements OnInit, OnDestroy {
  // Gallery Lightbox
  lightboxImage: string | null = null;
  openLightbox(src: string) { this.lightboxImage = src; }
  closeLightbox() { this.lightboxImage = null; }
  private contentService = inject(ContentService);
  private seoService = inject(SeoService);
  private route = inject(ActivatedRoute);
  private cdr = inject(ChangeDetectorRef);
  private sanitizer = inject(DomSanitizer);
  private platformId = inject(PLATFORM_ID);
  private pendingTasks = inject(PendingTasks);
  private pdfService = inject(PdfService);

  @ViewChild('adModal') adModal!: AdModalComponent;
  isModalOpen = false;

  log: DocumentEntry | undefined;
  availableWidgets: CustomWidget[] = [];
  isLoading = true;

  showBibliography = false;

  // Social State
  upvoteCount = 0;
  userHasUpvoted = false;
  comments: any[] = [];
  newCommentText = '';

  // Read Mode State
  isReadMode = false;

  get bibliographyBlock(): any {
    return this.log?.blocks.find(b => b.type === 'bibliography');
  }

  toggleBibliography(event?: Event) {
    if (event) {
      event.preventDefault();
      event.stopPropagation();
    }
    this.showBibliography = !this.showBibliography;
    this.cdr.markForCheck();
  }

  /** Auto-generated table of contents from indexable blocks */
  get tocItems(): { level: number; text: string; id: string; icon: string | null }[] {
    if (!this.log) return [];
    const items: { level: number; text: string; id: string; icon: string | null }[] = [];
    this.log.blocks.forEach((b: any, i: number) => {
      if (b.type === 'h1') {
        items.push({ level: 1, text: b.content, id: 'blk-' + i, icon: null });
      } else if (b.type === 'h2') {
        items.push({ level: 2, text: b.content, id: 'blk-' + i, icon: null });
      } else if (b.type === 'objective-header') {
        items.push({ level: 1, text: b.data?.title || 'Objectives', id: 'blk-' + i, icon: 'grid_view' });
      } else if (b.type === 'diagram') {
        items.push({ level: 2, text: 'System Diagram', id: 'blk-' + i, icon: 'account_tree' });
      } else if (b.type === 'comparison') {
        const label = b.data?.col1Title && b.data?.col2Title
          ? b.data.col1Title + ' vs ' + b.data.col2Title
          : 'Comparison';
        items.push({ level: 2, text: label, id: 'blk-' + i, icon: 'compare_arrows' });
      }
    });
    return items;
  }

  /** Estimated read time in minutes */
  get readingTime(): number {
    if (!this.log) return 1;
    const words = this.log.blocks
      .filter((b: any) => b.type === 'p' || b.type === 'h1' || b.type === 'h2')
      .map((b: any) => b.content.split(/\s+/).length)
      .reduce((a: number, b: number) => a + b, 0);
    return Math.max(1, Math.ceil(words / 200));
  }

  /** Currently visible section id (for TOC active highlight) */
  activeSectionId = '';

  /** Smooth-scroll to a block, offset for the fixed navbar */
  scrollToSection(id: string): void {
    const el = document.getElementById(id);
    if (el) {
      const navbarHeight = 80;
      const extraPadding = 16;
      const top = el.getBoundingClientRect().top + window.scrollY - navbarHeight - extraPadding;
      window.scrollTo({ top, behavior: 'smooth' });
    }
  }

  /** IntersectionObserver instance — destroyed on ngOnDestroy */
  private sectionObserver: IntersectionObserver | null = null;

  /** Re-creates the observer after content loads */
  private setupScrollObserver(): void {
    if (!isPlatformBrowser(this.platformId)) return;
    this.sectionObserver?.disconnect();

    const ids = this.tocItems.map(item => item.id);
    if (ids.length === 0) return;

    // rootMargin: push top boundary down by navbar height; bottom at -55% so only ~45% of page triggers
    this.sectionObserver = new IntersectionObserver(entries => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          // Use the first (topmost) intersecting TOC id
          const id = entry.target.id;
          if (ids.includes(id)) {
            this.activeSectionId = id;
            this.cdr.markForCheck();
          }
        }
      });
    }, {
      rootMargin: '-96px 0px -55% 0px',
      threshold: 0
    });

    // Wait one tick for Angular to render the [id] bindings
    setTimeout(() => {
      ids.forEach(id => {
        const el = document.getElementById(id);
        if (el) this.sectionObserver!.observe(el);
      });
    }, 0);
  }

  ngOnDestroy(): void {
    this.sectionObserver?.disconnect();
  }

  ngOnInit() {
    this.route.paramMap.pipe(
      map(p => p.get('slug') ?? ''),
      distinctUntilChanged()          // skip if same slug fires twice (e.g. on reload)
    ).subscribe(async slug => {
      // Always reset to loading state for each navigation
      this.isLoading = true;
      this.log = undefined;
      this.cdr.markForCheck();

      if (slug) {
        const removeTask = this.pendingTasks.add();
        try {
          this.availableWidgets = await this.contentService.getCustomWidgets();

          let entry: DocumentEntry | undefined;

          if (slug === 'preview') {
            if (isPlatformBrowser(this.platformId)) {
              const raw = localStorage.getItem('portfolio_preview');
              if (raw) {
                entry = JSON.parse(raw);
              }
            }
          } else {
            entry = await this.contentService.getDocument(slug);
          }

          if (entry) {
            this.log = entry;
            this.updateSeo();

            // Fetch social data
            if (entry.id) {
              const upvoteData = await this.contentService.getUpvoteCount(entry.id);
              this.upvoteCount = upvoteData.count;
              this.userHasUpvoted = upvoteData.userHasUpvoted;
              this.comments = await this.contentService.getComments(entry.id);
            }

            // Phase 2.5: Record viewed tags for the local recommendation engine
            if (entry.tags && entry.tags.length > 0) {
              this.contentService.recordTagView(entry.tags);
            }
          } else {
            // If entry is null for some reason, reset to initial state
            this.log = undefined;
          }
        } finally {
          this.isLoading = false;
          this.cdr.markForCheck();
          this.setupScrollObserver();
          removeTask();
        }
      } else {
        this.isLoading = false;
        this.cdr.markForCheck();
      }
    });
  }

  private updateSeo() {
    if (this.log) {
      this.seoService.updateMetaTags({
        title: this.log.title,
        description: this.log.blocks.find(b => b.type === 'p')?.content || `Field log: ${this.log.title}`,
        image: this.getCoverUrl(this.log.coverPhoto),
        type: 'article'
      });
    }
  }

  // --- BANNER HELPERS ---
  getCoverUrl(photoStr: string | undefined | null): string {
    if (!photoStr) return '';
    return photoStr.split('#')[0]; // Quita los parámetros para obtener la imagen limpia
  }

  getCoverStyles(photoStr: string | undefined | null): any {
    if (!photoStr || !photoStr.includes('#')) {
      // Si no hay recortes, todo se centra por defecto
      return { 'object-position': '50% 50%', 'transform-origin': '50% 50%', 'transform': 'scale(1)' };
    }
    const params = new URLSearchParams(photoStr.split('#')[1]);
    const x = params.get('x') || '50';
    const y = params.get('y') || '50';
    const s = params.get('s') || '100';

    // Le aplicamos el X y el Y tanto a la posición como al origen del zoom
    return {
      'object-position': `${x}% ${y}%`,
      'transform-origin': `${x}% ${y}%`,
      'transform': `scale(${Number(s) / 100})`
    };
  }

  getWidgetHtml(widgetId: string): SafeHtml {
    const w = this.availableWidgets.find(x => x.id === widgetId);
    if (w) {
      return this.sanitizer.bypassSecurityTrustHtml(w.html_content);
    }
    return this.sanitizer.bypassSecurityTrustHtml('');
  }

  getBgColor(id: string): string {
    const m: Record<string, string> = { 'bg-white': '#fff', 'bg-charcoal': '#1a1a1a', 'bg-accent-orange': '#d94e1e', 'bg-yellow-100': '#fef9c3', 'bg-paper-cream': '#f5f0e8', 'bg-teal-500': '#14b8a6', 'bg-red-500': '#ef4444' };
    return m[id] || '#fff';
  }
  getTextColor(id: string): string {
    const m: Record<string, string> = { 'text-charcoal': '#1a1a1a', 'text-white': '#fff', 'text-accent-orange': '#d94e1e', 'text-teal-600': '#0d9488' };
    return m[id] || '#1a1a1a';
  }
  getBorderCss(id: string): string {
    const m: Record<string, string> = { 'border-2 border-charcoal': '2px solid #1a1a1a', 'border-2 border-dashed border-charcoal': '2px dashed #1a1a1a', 'border-none': 'none' };
    return m[id] || '2px solid #1a1a1a';
  }
  getShadowCss(id: string): string {
    const m: Record<string, string> = { 'shadow-[4px_4px_0_#1a1a1a]': '4px 4px 0 #1a1a1a', 'shadow-[4px_4px_0_#d94e1e]': '4px 4px 0 #d94e1e', 'shadow-md': '0 4px 6px -1px rgba(0,0,0,0.1)', 'shadow-none': 'none' };
    return m[id] || 'none';
  }
  getFontFamily(id: string): string {
    const m: Record<string, string> = { 'font-mono': "'Space Mono',monospace", 'font-display': "'Space Grotesk',sans-serif", 'font-hand': "'Caveat',cursive", 'font-body': "'Inter',sans-serif", 'font-nixie': "'Nixie One',system-ui" };
    return m[id] || "'Space Mono',monospace";
  }
  getNodeSize(node: any): { w: number, h: number } {
    switch (node.type) {
      case 'postgres': return { w: 180, h: 80 };
      case 'api': return { w: 96, h: 96 };
      case 'client': case 'mobile': return { w: 160, h: 70 };
      case 'text': return { w: 200, h: 40 };
      case 'custom': return node.config?.shape === 'circle' ? { w: 100, h: 100 } : { w: 120, h: 60 };
      default: return { w: 120, h: 60 };
    }
  }
  getNodeEdgePoint(block: any, nodeId: string, otherNodeId: string): { x: number, y: number } {
    const node = block.data?.nodes?.find((n: any) => n.id === nodeId);
    const other = block.data?.nodes?.find((n: any) => n.id === otherNodeId);
    if (!node) return { x: 0, y: 0 };
    const size = this.getNodeSize(node);
    const cx = node.x + size.w / 2, cy = node.y + size.h / 2;
    if (!other) return { x: cx, y: cy };
    const os = this.getNodeSize(other);
    const dx = (other.x + os.w / 2) - cx, dy = (other.y + os.h / 2) - cy;
    if (Math.abs(dx) > Math.abs(dy)) {
      return dx > 0 ? { x: node.x + size.w, y: cy } : { x: node.x, y: cy };
    }
    return dy > 0 ? { x: cx, y: node.y + size.h } : { x: cx, y: node.y };
  }
  getArrowDashArray(type: string): string {
    switch (type) { case 'dashed': return '12,6'; case 'zigzag': return '4,4'; case 'dotted': return '3,8'; case 'graffiti': return '2,3,8,3'; default: return 'none'; }
  }
  getArrowStrokeWidth(type: string): number {
    switch (type) { case 'graffiti': return 4; case 'zigzag': return 3; default: return 2.5; }
  }
  getMarkerUrl(type: string, prefix = 'fl-arrowhead-'): string {
    if (!isPlatformBrowser(this.platformId)) {
      return `url(#${prefix}${type})`;
    }
    const base = window.location.href.split('?')[0].split('#')[0];
    return `url(${base}#${prefix}${type})`;
  }

  getSafeVideoUrl(url: string): SafeResourceUrl {
    const ytId = this.contentService.extractYoutubeId(url);
    if (ytId) {
      return this.sanitizer.bypassSecurityTrustResourceUrl(`https://www.youtube.com/embed/${ytId}`);
    }
    return this.sanitizer.bypassSecurityTrustResourceUrl(url);
  }

  isYoutubeUrl(url: string): boolean {
    return !!this.contentService.extractYoutubeId(url);
  }

  // --- PDF DOWNLOAD ---
  openPdfModal() {
    this.isModalOpen = true;
    setTimeout(() => {
      if (this.adModal) {
        this.adModal.open();
      }
    }, 0);
  }

  async generatePdf() {
    try {
      if (!isPlatformBrowser(this.platformId)) return;
      const element = document.getElementById('pdf-content-area');
      if (!element) {
        console.error('PDF content area not found.');
        return;
      }

      const filename = this.log?.title ? `FieldLog_${this.log.title.replace(/\s+/g, '_')}` : 'FieldLog_Download';
      await this.pdfService.downloadElementToPdf(element, filename);
    } catch (error) {
      console.error('Failed to generate PDF', error);
      alert('Error generating PDF.');
    } finally {
      this.isModalOpen = false;
      if (this.adModal) {
        this.adModal.isDownloading = false;
      }
    }
  }

  // --- Read Mode ---
  toggleReadMode() {
    this.isReadMode = !this.isReadMode;
    if (this.isReadMode) {
      document.body.classList.add('read-mode-active');
    } else {
      document.body.classList.remove('read-mode-active');
    }
  }

  // --- SOCIAL (Upvotes & Comments) ---
  async toggleUpvote() {
    if (!this.log || !this.log.id) return;
    try {
      this.userHasUpvoted = await this.contentService.toggleUpvote(this.log.id, this.userHasUpvoted);
      // Update count optimistically
      this.upvoteCount += this.userHasUpvoted ? 1 : -1;
      this.cdr.markForCheck();
    } catch (e) {
      console.error('Error toggling upvote:', e);
      alert('You must be logged in to like this document.');
    }
  }

  async submitComment() {
    if (!this.log || !this.log.id || !this.newCommentText.trim()) return;
    try {
      await this.contentService.addComment(this.log.id, this.newCommentText);
      this.newCommentText = '';
      // Reload comments
      this.comments = await this.contentService.getComments(this.log.id);
      this.cdr.markForCheck();
    } catch (e) {
      console.error('Error adding comment:', e);
      alert('Failed to post comment. Make sure you are logged in.');
    }
  }

}
