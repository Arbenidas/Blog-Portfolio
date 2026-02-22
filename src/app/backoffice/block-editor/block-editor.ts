import { Component, ChangeDetectorRef, inject, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterModule, ActivatedRoute, Router } from '@angular/router';
import { CdkDragDrop, moveItemInArray, CdkDrag, CdkDropList, CdkDragHandle } from '@angular/cdk/drag-drop';
import { ContentService, EditorBlock, DocumentEntry, CustomWidget, DiagramNodeConfig } from '../../services/content.service';
import { DomSanitizer, SafeHtml, SafeResourceUrl } from '@angular/platform-browser';

@Component({
  selector: 'app-block-editor',
  imports: [CommonModule, FormsModule, RouterModule, CdkDrag, CdkDropList, CdkDragHandle],
  templateUrl: './block-editor.html',
  styleUrl: './block-editor.css',
})
export class BlockEditor implements OnInit {
  contentService = inject(ContentService);
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private cdr = inject(ChangeDetectorRef);
  private sanitizer = inject(DomSanitizer);

  documentId: string | null = null;
  documentSlug: string | null = null;
  title = '';
  slug = '';
  coverPhoto = '';
  tags = '';
  category: 'work' | 'log' = 'work';
  indexLog = '';
  showPublishSticker = false;
  showWidgetGallery = false;
  isUploadingVideo = false;

  availableWidgets = signal<CustomWidget[]>([]);
  availableDiagramNodes = signal<DiagramNodeConfig[]>([]);

  contentBlocks: EditorBlock[] = [
    { id: '1', type: 'h1', content: 'Initial Draft' },
    { id: '2', type: 'p', content: 'Write here...' }
  ];
  widgetBlocks: EditorBlock[] = [];

  editingDiagramBlock: EditorBlock | null = null;

  // Arrow connection state
  arrowMode = false;
  arrowFromNode: string | null = null;
  selectedArrowType = 'solid';

  arrowTypes = [
    { id: 'solid', label: 'Solid', desc: 'Clean Line' },
    { id: 'dashed', label: 'Dashed', desc: 'Dashed Line' },
    { id: 'zigzag', label: 'Zigzag', desc: 'ZigZag Path' },
    { id: 'graffiti', label: 'Spray', desc: 'Street Paint' },
    { id: 'dotted', label: 'Dotted', desc: 'Chain Dots' },
  ];

  ngOnInit() {
    this.route.paramMap.subscribe(params => {
      const routeSlug = params.get('slug');
      if (routeSlug) {
        this.loadDocument(routeSlug);
      } else {
        // If it's a new document, check query params for category
        this.category = this.route.snapshot.queryParamMap.get('category') as 'work' | 'log' || 'work';
      }
    });

    this.loadWidgets();
  }

  async loadWidgets() {
    const [widgets, diagramNodes] = await Promise.all([
      this.contentService.getCustomWidgets(),
      this.contentService.getDiagramNodes()
    ]);
    this.availableWidgets.set(widgets);
    this.availableDiagramNodes.set(diagramNodes);
  }

  async loadDocument(slug: string) {
    const doc = await this.contentService.getDocument(slug);
    if (doc) {
      this.documentId = doc.id; // Save real ID for updates
      this.title = doc.title;
      this.slug = doc.slug;
      this.coverPhoto = doc.coverPhoto || '';
      this.category = doc.category;
      this.tags = doc.tags.join(', ');
      this.indexLog = doc.indexLog || '';
      // Separating standard blocks from widgets
      this.contentBlocks = JSON.parse(JSON.stringify(doc.blocks.filter((b: EditorBlock) => b.type !== 'widget')));
      this.widgetBlocks = JSON.parse(JSON.stringify(doc.blocks.filter((b: EditorBlock) => b.type === 'widget')));
      this.cdr.detectChanges();
    } else {
      console.error('Document not found:', slug);
    }
  }

  drop(event: CdkDragDrop<EditorBlock[]>) {
    moveItemInArray(this.contentBlocks, event.previousIndex, event.currentIndex);
    this.updateIndexLogLive();
  }

  addBlock(type: 'h1' | 'h2' | 'p' | 'image' | 'video' | 'code' | 'objective-header' | 'objectives' | 'divider' | 'tech-stack' | 'diagram') {
    const block: EditorBlock = {
      id: Math.random().toString(36).substr(2, 9),
      type,
      content: ''
    };

    switch (type) {
      case 'objective-header':
        block.data = { title: '02_MISSION_OBJECTIVES', subtitle: '/TARGETS' };
        break;
      case 'objectives':
        block.data = [
          { label: 'OBJ_ALPHA', title: 'Latency Reduction', desc: 'Reduce data-to-screen latency.', progress: 80 },
          { label: 'OBJ_BETA', title: 'Modular Design', desc: 'Create a drag-and-drop grid system.', progress: 40 },
          { label: 'OBJ_GAMMA', title: 'Accessibility', desc: 'Ensure WCAG 2.1 AA compliance.', progress: 95 }
        ];
        break;
      case 'tech-stack':
        block.content = 'REACT.JS, D3.JS, TAILWIND, NODE.JS';
        block.data = { status: 'LIVE_PRODUCTION' };
        break;
      case 'diagram':
        block.data = { nodes: [] };
        break;
      case 'video':
        block.data = { source: 'youtube' };
        break;
    }

    this.contentBlocks.push(block);
    if (type === 'h1' || type === 'h2') {
      this.updateIndexLogLive();
    }
  }
  addDiagramNode(block: EditorBlock, type: 'postgres' | 'api' | 'client' | 'mobile' | 'text', label: string) {
    if (!block.data) block.data = { nodes: [] };
    block.data.nodes.push({
      id: Math.random().toString(36).substr(2, 9),
      type,
      label,
      x: 50,
      y: 50
    });
  }

  addCustomDiagramNode(block: EditorBlock, nodeConfig: DiagramNodeConfig) {
    if (!block.data) block.data = { nodes: [] };
    block.data.nodes.push({
      id: Math.random().toString(36).substr(2, 9),
      type: 'custom',
      label: nodeConfig.name,
      x: 50,
      y: 50,
      config: {
        shape: nodeConfig.shape,
        bg_color: nodeConfig.bg_color,
        text_color: nodeConfig.text_color,
        border_style: nodeConfig.border_style,
        shadow_style: nodeConfig.shadow_style,
        icon: nodeConfig.icon,
        font: nodeConfig.font
      }
    });
  }

  openWidgetGallery() {
    this.showWidgetGallery = true;
  }

  closeWidgetGallery() {
    this.showWidgetGallery = false;
  }

  addWidget(widgetId: string) {
    this.widgetBlocks.push({
      id: Math.random().toString(36).substring(2, 9),
      type: 'widget',
      content: widgetId,
      data: { x: -200, y: 100 } // Default to the top-left margin
    });
    this.closeWidgetGallery();
  }

  getWidgetHtml(widgetId: string): SafeHtml {
    const w = this.availableWidgets().find((x: CustomWidget) => x.id === widgetId);
    if (w) {
      return this.sanitizer.bypassSecurityTrustHtml(w.html_content);
    }
    return this.sanitizer.bypassSecurityTrustHtml('<span>[Missing Sticker]</span>');
  }

  removeWidget(index: number) {
    this.widgetBlocks.splice(index, 1);
  }

  // === ARROW CONNECTION METHODS ===
  toggleArrowMode() {
    this.arrowMode = !this.arrowMode;
    this.arrowFromNode = null;
  }

  onNodeClickForArrow(nodeId: string) {
    if (!this.arrowMode || !this.editingDiagramBlock) return;
    if (!this.arrowFromNode) {
      this.arrowFromNode = nodeId;
    } else {
      if (this.arrowFromNode !== nodeId) {
        if (!this.editingDiagramBlock.data!.arrows) {
          this.editingDiagramBlock.data!.arrows = [];
        }
        this.editingDiagramBlock.data!.arrows.push({
          from: this.arrowFromNode,
          to: nodeId,
          type: this.selectedArrowType
        });
      }
      this.arrowFromNode = null;
    }
  }

  deleteArrow(block: EditorBlock, index: number) {
    if (block.data?.arrows) {
      block.data.arrows.splice(index, 1);
    }
  }

  getNodeCenter(block: EditorBlock, nodeId: string): { x: number; y: number } {
    const node = block.data?.nodes?.find((n: any) => n.id === nodeId);
    if (!node) return { x: 0, y: 0 };
    // Estimate center based on node position + rough half-size
    return { x: node.x + 60, y: node.y + 40 };
  }

  getArrowDashArray(type: string): string {
    switch (type) {
      case 'dashed': return '12,6';
      case 'zigzag': return '4,4';
      case 'dotted': return '3,8';
      case 'graffiti': return '2,3,8,3';
      default: return 'none';
    }
  }

  getArrowStrokeWidth(type: string): number {
    switch (type) {
      case 'graffiti': return 4;
      case 'zigzag': return 3;
      default: return 2.5;
    }
  }

  getFontFamily(id: string): string {
    const map: Record<string, string> = {
      'font-mono': "'Space Mono', monospace",
      'font-display': "'Space Grotesk', sans-serif",
      'font-hand': "'Caveat', cursive",
      'font-body': "'Inter', sans-serif",
      'font-nixie': "'Nixie One', system-ui",
    };
    return map[id] || "'Space Mono', monospace";
  }

  onWidgetDragEnded(event: any, widget: EditorBlock) {
    const position = event.source.getFreeDragPosition();
    if (!widget.data) widget.data = {};
    widget.data.x = position.x;
    widget.data.y = position.y;
  }

  openDiagramEditor(block: EditorBlock) {
    this.editingDiagramBlock = block;
    // Prevent body scrolling when modal is open
    document.body.style.overflow = 'hidden';
  }

  closeDiagramEditor() {
    this.editingDiagramBlock = null;
    document.body.style.overflow = '';
  }

  onCoverPhotoSelected(event: any) {
    const file = event.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (e: any) => {
        this.coverPhoto = e.target.result;
      };
      reader.readAsDataURL(file);
    }
  }

  async onVideoFileSelected(event: any, block: EditorBlock) {
    const file = event.target.files[0];
    if (!file) return;
    this.isUploadingVideo = true;
    try {
      const publicUrl = await this.contentService.uploadVideo(file);
      block.content = publicUrl;
      block.data = { source: 'upload' };
    } catch (err) {
      console.error('Video upload failed:', err);
      alert('Video upload failed. Check console for details.');
    } finally {
      this.isUploadingVideo = false;
    }
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

  onNodeDragEnded(event: any, node: any) {
    const position = event.source.getFreeDragPosition();
    node.x = position.x;
    node.y = position.y;
  }

  removeBlock(index: number) {
    const block = this.contentBlocks[index];
    this.contentBlocks.splice(index, 1);
    if (block && (block.type === 'h1' || block.type === 'h2')) {
      this.updateIndexLogLive();
    }
  }

  updateIndexLogLive() {
    let headingCount = 0;
    const newIndexLogLines: string[] = [];

    for (const block of this.contentBlocks) {
      if (block.type === 'h1' || block.type === 'h2') {
        const textToFormat = block.content ? block.content.trim() : '';
        if (textToFormat) {
          headingCount++;
          const numStr = headingCount.toString().padStart(2, '0');
          let text = textToFormat.replace(/^\d+_+/, '');
          let formatted = text.replace(/\s+/g, '_');
          newIndexLogLines.push(`${numStr}_${formatted.toUpperCase()}`);
        }
      }
    }

    this.indexLog = newIndexLogLines.join('\n');
  }

  formatHeadings() {
    let headingCount = 0;
    for (const block of this.contentBlocks) {
      if (block.type === 'h1' || block.type === 'h2') {
        const textToFormat = block.content ? block.content.trim() : '';
        if (textToFormat) {
          headingCount++;
          const numStr = headingCount.toString().padStart(2, '0');
          let text = textToFormat.replace(/^\d+_+/, '');
          let formatted = text.replace(/\s+/g, '_');
          // Preserve their casing for the block, only space->underscore and prefix
          block.content = `${numStr}_${formatted}`;
        }
      }
    }
    this.updateIndexLogLive();
  }

  async save() {
    this.formatHeadings();
    const tagArray = this.tags.split(',').map(t => t.trim()).filter(t => t.length > 0);
    // Auto-update slug if empty (new document) or if user hasn't manually set one
    if (!this.slug) {
      this.slug = this.contentService.generateSlug(this.title);
    }

    const allBlocks = [...this.contentBlocks, ...this.widgetBlocks];

    const savedSlug = await this.contentService.saveDocument({
      id: this.documentId || undefined,
      slug: this.slug,
      title: this.title,
      coverPhoto: this.coverPhoto,
      category: this.category,
      tags: tagArray,
      indexLog: this.indexLog,
      blocks: allBlocks
    });

    if (!this.documentId) {
      this.router.navigate(['/admin/editor', savedSlug]);
    }

    // Trigger the stamp animation
    this.showPublishSticker = true;
    setTimeout(() => {
      this.showPublishSticker = false;
    }, 2000);
  }

  autoResize(element: HTMLElement) {
    element.style.height = 'auto';
    element.style.height = element.scrollHeight + 'px';
  }

  preview() {
    this.formatHeadings();
    const tagArray = this.tags.split(',').map(t => t.trim()).filter(t => t.length > 0);

    const allBlocks = [...this.contentBlocks, ...this.widgetBlocks];

    // Save to the temporary preview memory
    this.contentService.setPreviewDocument({
      title: this.title,
      coverPhoto: this.coverPhoto,
      category: this.category,
      tags: tagArray,
      indexLog: this.indexLog,
      blocks: allBlocks
    });

    // Open in new tab
    const url = this.category === 'work' ? '/works/preview' : '/logs/preview';
    window.open(url, '_blank');
  }

  // === CSS helpers for custom diagram nodes ===
  getBgColor(id: string): string {
    const map: Record<string, string> = {
      'bg-white': '#ffffff', 'bg-charcoal': '#1a1a1a', 'bg-accent-orange': '#d94e1e',
      'bg-yellow-100': '#fef9c3', 'bg-paper-cream': '#f5f0e8', 'bg-teal-500': '#14b8a6',
      'bg-red-500': '#ef4444'
    };
    return map[id] || '#ffffff';
  }

  getTextColor(id: string): string {
    const map: Record<string, string> = {
      'text-charcoal': '#1a1a1a', 'text-white': '#ffffff',
      'text-accent-orange': '#d94e1e', 'text-teal-600': '#0d9488'
    };
    return map[id] || '#1a1a1a';
  }

  getBorderCss(id: string): string {
    const map: Record<string, string> = {
      'border-2 border-charcoal': '2px solid #1a1a1a',
      'border-2 border-dashed border-charcoal': '2px dashed #1a1a1a',
      'border-none': 'none'
    };
    return map[id] || '2px solid #1a1a1a';
  }

  getShadowCss(id: string): string {
    const map: Record<string, string> = {
      'shadow-[4px_4px_0_#1a1a1a]': '4px 4px 0 #1a1a1a',
      'shadow-[4px_4px_0_#d94e1e]': '4px 4px 0 #d94e1e',
      'shadow-md': '0 4px 6px -1px rgba(0,0,0,0.1)',
      'shadow-none': 'none'
    };
    return map[id] || 'none';
  }
}
