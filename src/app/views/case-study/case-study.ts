import { Component, inject, OnInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, RouterModule } from '@angular/router';
import { ContentService, DocumentEntry, CustomWidget } from '../../services/content.service';
import { DomSanitizer, SafeHtml, SafeResourceUrl } from '@angular/platform-browser';
import { SeoService } from '../../services/seo.service';
import { environment } from '../../../environments/environment';

@Component({
  selector: 'app-case-study',
  imports: [CommonModule, RouterModule],
  templateUrl: './case-study.html',
  styleUrl: './case-study.css',
})
export class CaseStudy implements OnInit {
  private contentService = inject(ContentService);
  private seoService = inject(SeoService);
  private route = inject(ActivatedRoute);
  private cdr = inject(ChangeDetectorRef);
  private sanitizer = inject(DomSanitizer);

  work: DocumentEntry | undefined;
  availableWidgets: CustomWidget[] = [];

  ngOnInit() {
    this.route.paramMap.subscribe(async params => {
      const slug = params.get('slug');
      if (slug) {
        this.availableWidgets = await this.contentService.getCustomWidgets();

        if (slug === 'preview') {
          // Load from localStorage preview data (localStorage is shared across tabs)
          if (typeof localStorage !== 'undefined') {
            const raw = localStorage.getItem('portfolio_preview');
            if (raw) {
              this.work = JSON.parse(raw);
              this.cdr.detectChanges();
              return;
            }
          }
        }

        this.work = await this.contentService.getDocument(slug);
        if (this.work) {
          this.seoService.updateMetaTags({
            title: this.work.title,
            description: this.work.blocks.find(b => b.type === 'p')?.content || `Case study: ${this.work.title}`,
            image: this.work.coverPhoto,
            type: 'article'
          });
        }
        this.cdr.detectChanges();
      }
    });
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
  getNodeCenter(block: any, nodeId: string): { x: number, y: number } {
    const node = block.data?.nodes?.find((n: any) => n.id === nodeId);
    return node ? { x: node.x + 60, y: node.y + 40 } : { x: 0, y: 0 };
  }
  getArrowDashArray(type: string): string {
    switch (type) { case 'dashed': return '12,6'; case 'zigzag': return '4,4'; case 'dotted': return '3,8'; case 'graffiti': return '2,3,8,3'; default: return 'none'; }
  }
  getArrowStrokeWidth(type: string): number {
    switch (type) { case 'graffiti': return 4; case 'zigzag': return 3; default: return 2.5; }
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
}
