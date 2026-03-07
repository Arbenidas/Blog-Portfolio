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
import { MarkdownComponent } from 'ngx-markdown';

@Component({
  selector: 'app-field-log',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule, ShareButtons, FFlowModule, AdModalComponent, MarkdownComponent],
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
  renderedMarkdown: SafeHtml = '';

  // Reading Progress
  readProgress = 0;
  private scrollListener: (() => void) | null = null;

  // Font Size (persisted)
  fontSize: 'sm' | 'md' | 'lg' = 'md';

  // Related posts
  relatedLogs: DocumentEntry[] = [];

  // Social State
  upvoteCount = 0;
  userHasUpvoted = false;
  comments: any[] = [];
  newCommentText = '';

  // Read Mode State (false = light, true = dark)
  isReadMode = false;
  isDarkReadMode = false;

  // #8 Prev/Next Navigation
  prevLog: DocumentEntry | null = null;
  nextLog: DocumentEntry | null = null;

  // #9 View Count
  viewCount = 0;

  // #11 Scroll-to-top button visibility
  showScrollTop = false;

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

    // If we have markdownContent, extract TOC from it
    if (this.log.markdownContent) {
      const items: { level: number; text: string; id: string; icon: string | null }[] = [];
      const lines = this.log.markdownContent.split('\n');
      let hCount = 0;
      lines.forEach(line => {
        const hMatch = line.match(/^(#{1,2})\s+(.+)$/);
        if (hMatch) {
          const level = hMatch[1].length;
          const text = hMatch[2].trim();
          items.push({ level, text, id: 'md-h-' + hCount++, icon: null });
        }
      });
      return items;
    }

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

  /** #6 — Estimated read time using 238 wpm average */
  get readingTime(): number {
    if (!this.log) return 1;
    let words = 0;
    if (this.log.markdownContent) {
      words = this.log.markdownContent.split(/\s+/).length;
    } else {
      words = this.log.blocks
        .filter((b: any) => b.type !== 'image' && b.type !== 'gallery' && b.type !== 'video' && b.type !== 'diagram')
        .map((b: any) => (b.content || '').split(/\s+/).length)
        .reduce((a: number, b: number) => a + b, 0);
    }
    return Math.max(1, Math.ceil(words / 238));
  }

  /** #12 — True if the post was updated after creation (>1 min difference) */
  get isUpdated(): boolean {
    if (!this.log?.updatedAt || !this.log?.createdAt) return false;
    const diff = Math.abs(new Date(this.log.updatedAt).getTime() - new Date(this.log.createdAt).getTime());
    return diff > 60000; // more than 1 minute
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
    if (this.scrollListener) {
      window.removeEventListener('scroll', this.scrollListener);
    }
  }

  private setupProgressBar(): void {
    if (!isPlatformBrowser(this.platformId)) return;
    this.scrollListener = () => {
      const el = document.getElementById('pdf-content-area');
      if (!el) return;
      const total = el.scrollHeight - window.innerHeight;
      this.readProgress = total > 0 ? Math.min(100, Math.round((window.scrollY / total) * 100)) : 0;
      // #11 Show scroll-to-top when past 30%
      this.showScrollTop = this.readProgress > 30;
      this.cdr.markForCheck();
    };
    window.addEventListener('scroll', this.scrollListener, { passive: true });
  }

  /** #11 — Scroll smoothly to the top of the page */
  scrollToTop(): void {
    if (isPlatformBrowser(this.platformId)) {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  }

  setFontSize(size: 'sm' | 'md' | 'lg'): void {
    this.fontSize = size;
    if (isPlatformBrowser(this.platformId)) {
      localStorage.setItem('reader_font_size', size);
    }
    this.cdr.markForCheck();
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
              const [upvoteData, commentData, viewCount] = await Promise.all([
                this.contentService.getUpvoteCount(entry.id),
                this.contentService.getComments(entry.id),
                this.contentService.getViewCount(entry.id)
              ]);
              this.upvoteCount = upvoteData.count;
              this.userHasUpvoted = upvoteData.userHasUpvoted;
              this.comments = commentData;
              this.viewCount = viewCount;

              // #9 Record the view (fire-and-forget)
              this.contentService.recordDocumentView(entry.id);
            }

            if (entry.tags && entry.tags.length > 0) {
              this.contentService.recordTagView(entry.tags);
              const [relatedLogs, prevNext] = await Promise.all([
                this.contentService.getRelatedDocuments(entry.tags, entry.id, entry.category, 3),
                this.contentService.getPrevNextLogs(entry.id, entry.category)
              ]);
              this.relatedLogs = relatedLogs;
              this.prevLog = prevNext.prev;
              this.nextLog = prevNext.next;
            } else if (entry.id) {
              // Still fetch prev/next even if no tags
              const prevNext = await this.contentService.getPrevNextLogs(entry.id, entry.category);
              this.prevLog = prevNext.prev;
              this.nextLog = prevNext.next;
            }
          } else {
            // If entry is null for some reason, reset to initial state
            this.log = undefined;
          }
        } finally {
          this.isLoading = false;
          this.cdr.markForCheck();
          this.setupScrollObserver();
          this.setupProgressBar();
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
      let description = `Field log: ${this.log.title}`;
      if (this.log.markdownContent) {
        description = this.log.markdownContent.substring(0, 160).replace(/[#*`]/g, '');
      } else {
        const pBlock = this.log.blocks.find(b => b.type === 'p');
        if (pBlock) description = pBlock.content;
      }

      const slug = this.log.slug || this.log.id;
      const coverImage = this.getCoverUrl(this.log.coverPhoto);

      this.seoService.updateMetaTags({
        title: this.log.title,
        description: description,
        image: coverImage,
        type: 'article',
        url: `/logs/${slug}`,
        tags: this.log.tags,
        publishedAt: this.log.createdAt,
      });

      // JSON-LD: Article structured data for Google rich snippets
      this.seoService.setJsonLd({
        '@context': 'https://schema.org',
        '@type': 'TechArticle',
        'headline': this.log.title,
        'description': description,
        'image': coverImage || 'https://arbe.blog/logo.png',
        'datePublished': this.log.createdAt,
        'dateModified': this.log.updatedAt || this.log.createdAt,
        'author': {
          '@type': 'Person',
          'name': this.log.author?.full_name || this.log.author?.username || 'Arbe',
          'url': 'https://arbe.blog'
        },
        'publisher': {
          '@type': 'Person',
          'name': 'arbes.blog',
          'logo': {
            '@type': 'ImageObject',
            'url': 'https://arbe.blog/logo.png'
          }
        },
        'mainEntityOfPage': {
          '@type': 'WebPage',
          '@id': `https://arbe.blog/logs/${slug}`
        },
        'keywords': this.log.tags?.join(', ') || '',
        'articleSection': 'Field Logs'
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
      const element = document.getElementById('pdf-clean-content-area');
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

  // --- Read Mode (#16 dark variant) ---
  toggleReadMode() {
    this.isReadMode = !this.isReadMode;
    if (this.isReadMode) {
      // First toggle → light read mode
      this.isDarkReadMode = false;
      document.body.classList.add('read-mode-active');
      document.body.classList.remove('dark-read-mode-active');
    } else {
      document.body.classList.remove('read-mode-active');
      document.body.classList.remove('dark-read-mode-active');
      this.isDarkReadMode = false;
    }
  }

  toggleDarkReadMode() {
    this.isDarkReadMode = !this.isDarkReadMode;
    if (this.isDarkReadMode) {
      document.body.classList.add('dark-read-mode-active');
    } else {
      document.body.classList.remove('dark-read-mode-active');
    }
    this.cdr.markForCheck();
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

  onMarkdownReady() {
    if (!isPlatformBrowser(this.platformId)) return;
    setTimeout(() => {
      const headings = document.querySelectorAll('.markdown-body h1, .markdown-body h2');
      headings.forEach((h, i) => {
        h.id = 'md-h-' + i;
      });
      this.setupScrollObserver();

      // Inject copy buttons into markdown-rendered code blocks
      const preBlocks = document.querySelectorAll('.markdown-body pre');
      preBlocks.forEach((pre) => {
        if (pre.querySelector('.btn-copy-code-md')) return;
        const code = pre.querySelector('code');
        if (!code) return;

        const btn = document.createElement('button');
        btn.className = 'btn-copy-code btn-copy-code-md';
        btn.innerHTML = '<span class="material-symbols-outlined" style="font-size: 14px;">content_copy</span> COPY';
        btn.style.cssText = 'position: absolute; top: 0.75rem; right: 0.75rem;';

        btn.addEventListener('click', async (e) => {
          e.stopPropagation();
          const originalHTML = btn.innerHTML;
          try {
            await navigator.clipboard.writeText(code.textContent || '');
            btn.innerHTML = '<span class="material-symbols-outlined" style="font-size: 14px;">check</span> COPIED!';
            btn.classList.add('btn-copy-success');
          } catch {
            btn.innerHTML = '<span class="material-symbols-outlined" style="font-size: 14px;">error</span> ERROR';
          }
          setTimeout(() => {
            btn.innerHTML = originalHTML;
            btn.classList.remove('btn-copy-success');
          }, 2000);
        });

        (pre as HTMLElement).style.position = 'relative';
        pre.appendChild(btn);
      });

      // Inject lightbox on markdown images
      const mdImages = document.querySelectorAll('.markdown-body img');
      mdImages.forEach((img) => {
        if ((img as HTMLElement).dataset['lightboxAttached']) return;
        (img as HTMLElement).style.cursor = 'zoom-in';
        (img as HTMLElement).dataset['lightboxAttached'] = '1';
        img.addEventListener('click', () => {
          this.lightboxImage = (img as HTMLImageElement).src;
          this.cdr.markForCheck();
        });
      });
    }, 50);
  }

  async copyToClipboard(content: string, event: MouseEvent) {
    if (!isPlatformBrowser(this.platformId)) return;
    const btn = event.currentTarget as HTMLButtonElement;
    const originalText = btn.innerHTML;

    try {
      await navigator.clipboard.writeText(content);
      btn.innerHTML = '<span class="material-symbols-outlined" style="font-size: 14px;">check</span> COPIED!';
      btn.classList.add('btn-copy-success');
    } catch (err) {
      console.error('Failed to copy: ', err);
      btn.innerHTML = '<span class="material-symbols-outlined" style="font-size: 14px;">error</span> ERROR';
    }

    setTimeout(() => {
      btn.innerHTML = originalText;
      btn.classList.remove('btn-copy-success');
    }, 2000);
  }

}
