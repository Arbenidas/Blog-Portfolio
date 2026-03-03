import { Component, ChangeDetectorRef, inject, OnInit, OnDestroy, signal, HostListener, ViewChild, ElementRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterModule, ActivatedRoute, Router } from '@angular/router';
import { CdkDragDrop, moveItemInArray, CdkDrag, CdkDropList, CdkDragHandle } from '@angular/cdk/drag-drop';
import { ContentService, EditorBlock, DocumentEntry, CustomWidget, DiagramNodeConfig, SavedDiagram } from '../../services/content.service';
import { DomSanitizer, SafeHtml, SafeResourceUrl } from '@angular/platform-browser';
import imageCompression from 'browser-image-compression';
import { FFlowModule } from '@foblex/flow';
import { MarkdownComponent } from 'ngx-markdown';
import html2canvas from 'html2canvas';
import { DesignStudio } from '../design-studio/design-studio';

@Component({
  selector: 'app-block-editor',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    RouterModule,
    FFlowModule,
    MarkdownComponent,
    DesignStudio
  ],
  templateUrl: './block-editor.html',
  styleUrl: './block-editor.css',
})
export class BlockEditor implements OnInit, OnDestroy {
  contentService = inject(ContentService);
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private cdr = inject(ChangeDetectorRef);
  private sanitizer = inject(DomSanitizer);

  documentId: string | null = null;
  documentSlug: string | null = null;
  title = '';
  slug = '';
  tags = '';
  bibliography = '';
  category: 'work' | 'log' | 'guide' = 'work';
  indexLog = '';
  deployStatus = 'LIVE_PRODUCTION';
  documentStatus: 'draft' | 'published' | 'archived' = 'draft';
  autoSaveInterval: any;

  coverPhotoUrl = '';
  coverPosX = 50;
  coverPosY = 50;
  coverScale = 100;
  isDraggingBanner = false;
  dragStartX = 0;
  dragStartY = 0;
  dragInitPosX = 50;
  dragInitPosY = 50;

  showPublishSticker = false;
  showWidgetGallery = false;
  isUploadingCover = false;
  isUploadingVideo = false;
  lastAutoSaveTime: string = '';
  showToast = false;
  toastMessage = '';
  toastType: 'draft' | 'live' = 'draft';
  showDraftModal = false;
  pendingDraftData: any = null;
  isExiting = false;
  zenMode = false;
  isPreviewing = false;
  previewIframeUrl: SafeResourceUrl | null = null;
  showZenHelp = false;
  isToolbarCollapsed = false;

  pastedMarkdown = '';
  markdownContent = '';
  renderedMarkdown: SafeHtml = '';
  showPasteMdModal = false;

  @ViewChild('editorPane') editorPane!: ElementRef<HTMLDivElement>;
  @ViewChild('previewPane') previewPane!: ElementRef<HTMLDivElement>;
  private scrollTimeout: any;
  private currentScrollSource: 'editor' | 'preview' | null = null;

  contentBlocks: EditorBlock[] = [];
  // Widget/Sticker Layer (Keeping the array for backwards compatibility of data model)
  widgetBlocks: EditorBlock[] = [];

  // === GESTIÓN DE LA PORTADA ===
  pendingCoverFile: File | null = null;

  customNodeTemplates: DiagramNodeConfig[] = [];
  systemTags: string[] = [];

  historyStack: string[] = [];
  historyPointer = -1;
  typingTimer: any;

  editingDiagramBlock: EditorBlock | null = null;
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

  get wordCount(): number {
    const text = this.markdownContent || '';
    const words = text.trim().split(/\s+/).filter(w => w.length > 0);
    return words.length;
  }

  get readingTime(): number {
    return Math.max(1, Math.ceil(this.wordCount / 200));
  }

  toggleZenHelp() {
    this.showZenHelp = !this.showZenHelp;
    this.cdr.detectChanges();
  }

  ngOnInit() {
    this.route.paramMap.subscribe(params => {
      const routeSlug = params.get('slug');
      if (routeSlug) {
        this.loadDocument(routeSlug);
      } else {
        this.category = this.route.snapshot.queryParamMap.get('category') as 'work' | 'log' | 'guide' || 'work';
      }
    });

    this.loadWidgets();

    this.saveSnapshot();

    this.autoSaveInterval = setInterval(() => {
      this.saveDraftLocally();
    }, 10000);
  }

  ngOnDestroy() {
    // Apagar el temporizador si salimos de la página
    if (this.autoSaveInterval) {
      clearInterval(this.autoSaveInterval);
    }

    // MUY IMPORTANTE: Quitamos la clase del body por si le das al botón de "Atrás" 
    // en tu navegador mientras estabas en Modo Zen, para no romper el dashboard.
    document.body.classList.remove('zen-is-active');
  }

  // Escuchamos el teclado en toda la pantalla para capturar el Ctrl+Z / Cmd+Z
  @HostListener('document:keydown', ['$event'])
  handleKeyboardShortcuts(event: KeyboardEvent) {
    const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0;
    const cmdOrCtrl = isMac ? event.metaKey : event.ctrlKey;

    if (cmdOrCtrl && event.key.toLowerCase() === 'z') {
      event.preventDefault();
      if (event.shiftKey) {
        this.redo(); // Ctrl+Shift+Z
      } else {
        this.undo(); // Ctrl+Z
      }
    } else if (cmdOrCtrl && event.key.toLowerCase() === 'y') {
      event.preventDefault();
      this.redo(); // Ctrl+Y
    }
  }

  // =========================================================
  // DOCUMENT MAP (DYNAMIC TOC)
  // =========================================================
  tocList: { id: string, label: string, level: number }[] = [];
  activeTocId: string = '';

  parseToc() {
    if (!this.markdownContent) {
      this.tocList = [];
      return;
    }

    const lines = this.markdownContent.split('\n');
    const toc: { id: string, label: string, level: number }[] = [];

    // Pattern to catch #, ##, ###
    const headingRegex = /^(#{1,3})\s+(.*)$/;

    lines.forEach((line, index) => {
      const match = line.match(headingRegex);
      if (match) {
        const level = match[1].length; // number of '#'
        const rawLabel = match[2];
        const label = rawLabel.trim();
        // Generamos un ID seguro para usar en anclas HTML
        const id = 'toc-' + label.toLowerCase().replace(/[^a-z0-9]+/g, '-') + '-' + index;

        toc.push({ id, label, level });
      }
    });

    this.tocList = toc;
  }

  scrollToHeading(id: string) {
    // Cuando el TOC se renderiza en la Vista Previa, los headings necesitan IDs
    // Para simplificar, confiaremos en un scroll manual para la versión en crudo
    // o usaremos marcadores en la vista previa del bloque
    const el = document.getElementById(id);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'start' });
      this.activeTocId = id;
    }
  }

  async loadWidgets() {
    const [diagramNodes, sysTags] = await Promise.all([
      this.contentService.getDiagramNodes(),
      this.contentService.getSystemTags()
    ]);
    this.customNodeTemplates = diagramNodes;
    this.systemTags = sysTags;
  }

  async loadDocument(slug: string) {
    const doc = await this.contentService.getDocument(slug);
    if (doc) {
      this.documentId = doc.id; // Save real ID for updates
      this.title = doc.title;
      this.slug = doc.slug;

      // Extraer configuración del banner
      if (doc.coverPhoto && doc.coverPhoto.startsWith('data:')) {
        // ⚠️ AUTO-REPAIR: El cover_photo es un Base64 enorme guardado en la BD.
        // Lo limpiamos en la BD ahora para que futuros loads sean instantáneos.
        // El usuario tendrá que re-subir la imagen.
        console.warn('[AutoRepair] Cover photo es Base64. Limpiando de Supabase...');
        this.coverPhotoUrl = '';
        if (this.documentId) {
          this.contentService.clearCoverPhoto(this.documentId);
        }
        alert('⚠️ La portada de este documento estaba guardada como Base64 (formato antiguo muy pesado). Se eliminó automáticamente. Por favor, re-sube la imagen desde el editor.');
      } else if (doc.coverPhoto) {
        if (doc.coverPhoto.includes('#')) {
          const parts = doc.coverPhoto.split('#');
          this.coverPhotoUrl = parts[0];
          const params = new URLSearchParams(parts[1]);
          this.coverPosX = Number(params.get('x')) || 50;
          this.coverPosY = Number(params.get('y')) || 50;
          this.coverScale = Number(params.get('s')) || 100;
        } else {
          this.coverPhotoUrl = doc.coverPhoto;
          this.coverPosX = 50;
          this.coverPosY = 50;
          this.coverScale = 100;
        }
      } else {
        this.coverPhotoUrl = '';
      }

      // MIGRATION LOGIC: If we have markdownContent, use it. 
      // If NOT, but we HAVE blocks, migrate them.
      if (doc.markdownContent) {
        this.markdownContent = doc.markdownContent;
      } else if (doc.blocks && doc.blocks.length > 0) {
        console.info('[Migration] Document has legacy blocks. Converting to Markdown...');
        this.markdownContent = this.migrateLegacyBlocksToMarkdown(doc.blocks);
      } else {
        this.markdownContent = '';
      }

      this.contentBlocks = doc.blocks || []; // Keep for compatibility during transition if needed
      this.documentStatus = doc.status || 'draft';
      this.category = doc.category || 'work';
      this.indexLog = doc.indexLog || '';
      this.tags = (doc.tags || []).join(', ');

      // Extract tech stack status and bibliography from blocks if migrating
      if (!doc.markdownContent && doc.blocks) {
        const techBlock = doc.blocks.find((b: EditorBlock) => b.type === 'tech-stack');
        if (techBlock && techBlock.data?.status) {
          this.deployStatus = techBlock.data.status;
        }
        const biblioBlock = doc.blocks.find((b: EditorBlock) => b.type === 'bibliography');
        if (biblioBlock) {
          this.bibliography = biblioBlock.content;
        }
      }

      this.parseToc(); // Initialize TOC on load
      this.cdr.detectChanges();
      this.saveSnapshot();
      this.checkLocalDraft(slug);
    } else {
      console.error('Document not found or access denied:', slug);
      this.router.navigate(['/404']);
    }
  }

  onMarkdownChange(newValue: string) {
    this.markdownContent = newValue;
    this.saveSnapshot();
    // Trigger scroll sync on change to follow cursor/new lines
    setTimeout(() => this.syncScroll('editor'), 0);
  }

  onMarkdownKeyDown(event: KeyboardEvent) {
    const textarea = event.target as HTMLTextAreaElement;
    if (!textarea) return;

    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const text = this.markdownContent;

    // === 1. Auto-closing pairs ===
    const pairs: Record<string, string> = {
      '(': ')',
      '[': ']',
      '{': '}',
      '*': '*',
      '_': '_',
      '`': '`'
    };

    if (pairs[event.key]) {
      // If text is selected, wrap it
      if (start !== end) {
        event.preventDefault();
        const selectedText = text.substring(start, end);
        const wrappedText = event.key + selectedText + pairs[event.key];
        this.markdownContent = text.substring(0, start) + wrappedText + text.substring(end);

        setTimeout(() => {
          textarea.setSelectionRange(start + 1, start + 1 + selectedText.length);
        }, 0);
        return;
      } else {
        // Just insert pair and put cursor in middle
        event.preventDefault();
        const pair = event.key + pairs[event.key];
        this.markdownContent = text.substring(0, start) + pair + text.substring(end);

        setTimeout(() => {
          textarea.setSelectionRange(start + 1, start + 1);
        }, 0);
        return;
      }
    }

    // === 2. Smart List Continuation ===
    if (event.key === 'Enter') {
      // Find the current line
      const textToCursor = text.substring(0, start);
      const lines = textToCursor.split('\n');
      const currentLine = lines[lines.length - 1];

      // Check if line starts with a list marker (-, *, 1., etc)
      const listMatch = currentLine.match(/^(\s*)([-*]|\d+\.)\s+(.*)$/);

      if (listMatch) {
        event.preventDefault(); // Stop normal enter

        const [_, indent, marker, content] = listMatch;

        // If the line is JUST the marker (empty list item), delete it to break the list
        if (!content.trim()) {
          const beforeLine = textToCursor.substring(0, textToCursor.lastIndexOf(currentLine));
          this.markdownContent = beforeLine + '\n' + text.substring(end);
          setTimeout(() => {
            textarea.setSelectionRange(beforeLine.length + 1, beforeLine.length + 1);
          }, 0);
          return;
        }

        // Otherwise, continue the list
        let nextMarker = marker;
        if (marker.match(/\d+\./)) {
          const num = parseInt(marker, 10);
          nextMarker = `${num + 1}.`;
        }

        const insertion = `\n${indent}${nextMarker} `;
        this.markdownContent = text.substring(0, start) + insertion + text.substring(end);

        setTimeout(() => {
          textarea.setSelectionRange(start + insertion.length, start + insertion.length);
          this.syncScroll('editor');
        }, 0);
        return;
      }
    }
  }

  // renderPreview removed as ngx-markdown handles it

  migrateLegacyBlocksToMarkdown(blocks: EditorBlock[]): string {
    let md = '';
    blocks.forEach(block => {
      switch (block.type) {
        case 'h1': md += `# ${block.content}\n\n`; break;
        case 'h2': md += `## ${block.content}\n\n`; break;
        case 'p': md += `${block.content}\n\n`; break;
        case 'blockquote': md += `> ${block.content}\n\n`; break;
        case 'divider': md += `---\n\n`; break;
        case 'image':
          const alt = block.data?.text || 'image';
          md += `![${alt}](${block.content})\n\n`;
          break;
        case 'code':
          const lang = block.data?.language || 'typescript';
          md += `\`\`\`${lang}\n${block.content}\n\`\`\`\n\n`;
          break;
        case 'comparison':
          md += `| ${block.data?.col1Title || 'Col 1'} | ${block.data?.col2Title || 'Col 2'} |\n`;
          md += `|---|---|\n`;
          (block.data?.rows || []).forEach((row: any) => {
            md += `| ${row.col1} | ${row.col2} |\n`;
          });
          md += `\n`;
          break;
        case 'tech-stack':
          md += `### Tech Stack\n\n`;
          md += `- **Tags**: ${block.data?.tags}\n`;
          md += `- **Status**: ${block.data?.status}\n\n`;
          break;
        default:
          if (block.content) md += `${block.content}\n\n`;
      }
    });
    return md.trim();
  }

  drop(event: CdkDragDrop<EditorBlock[]>) {
    moveItemInArray(this.contentBlocks, event.previousIndex, event.currentIndex);
    this.updateIndexLogLive();
  }

  addBlock(type: 'h1' | 'h2' | 'p' | 'image' | 'gallery' | 'video' | 'code' | 'blockquote' | 'objective-header' | 'objectives' | 'divider' | 'diagram') {
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
      case 'diagram':
        block.data = {
          nodes: [
            { id: 'node_start', text: 'START', position: { x: 50, y: 150 } },
            { id: 'node_end', text: 'END', position: { x: 350, y: 150 } }
          ],
          connections: []
        };
        break;
      case 'code':
        block.data = { language: 'typescript', filename: '', error: '', errorType: 'error' };
        break;
      case 'image':
        block.data = { size: 'full', align: 'center' };
        break;
      case 'gallery':
        block.data = { images: [], layout: 'grid' };
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

  addTableBlock() {
    const block: EditorBlock = {
      id: Math.random().toString(36).substr(2, 9),
      type: 'table',
      content: '',
      data: {
        headers: ['Header 1', 'Header 2', 'Header 3'],
        rows: [
          ['Item 1', 'Item 2', 'Item 3'],
          ['Item 4', 'Item 5', 'Item 6']
        ]
      }
    };
    this.contentBlocks.push(block);
    this.saveSnapshot();
  }

  addTreeBlock() {
    const block: EditorBlock = {
      id: Math.random().toString(36).substr(2, 9),
      type: 'tree',
      content: 'project-root/\n├── src/\n│   ├── main.tf\n│   └── variables.tf\n├── tests/\n│   └── main_test.go\n└── README.md',
      data: {}
    };
    this.contentBlocks.push(block);
    this.saveSnapshot();
  }

  // === MÉTODOS DE TABLA ===
  addTableRow(block: EditorBlock) {
    if (block.type !== 'table' || !block.data?.rows) return;
    const cols = block.data.headers.length;
    block.data.rows.push(new Array(cols).fill(''));
    this.saveSnapshot();
  }

  removeTableRow(block: EditorBlock, index: number) {
    if (block.type !== 'table' || !block.data?.rows) return;
    block.data.rows.splice(index, 1);
    this.saveSnapshot();
  }

  addTableColumn(block: EditorBlock) {
    if (block.type !== 'table' || !block.data?.headers) return;
    block.data.headers.push('New Header');
    block.data.rows.forEach((row: any[]) => row.push(''));
    this.saveSnapshot();
  }

  removeTableColumn(block: EditorBlock, index: number) {
    if (block.type !== 'table' || !block.data?.headers) return;
    block.data.headers.splice(index, 1);
    block.data.rows.forEach((row: any[]) => row.splice(index, 1));
    this.saveSnapshot();
  }


  async onCoverPhotoSelected(event: any) {
    let file = event.target.files[0];
    if (file) {
      this.isUploadingCover = true;
      this.cdr.detectChanges();

      try {
        if (file.size > 1 * 1024 * 1024) { // Compress if > 1MB
          const options = { maxSizeMB: 0.8, maxWidthOrHeight: 1920, useWebWorker: true };
          file = await imageCompression(file, options);
        }
      } catch (err) {
        console.warn('Compression error:', err);
      }

      this.isUploadingCover = false;
      this.cdr.detectChanges();

      // 1. Guardamos el archivo físico en la RAM (No en el documento)
      this.pendingCoverFile = file;

      // 2. Creamos una URL temporal (blob:http://...) 
      // Esto engaña al navegador para mostrar la imagen, y es súper ligero para el localStorage.
      const tempUrl = URL.createObjectURL(file);

      // 3. Asignamos la URL temporal al documento
      this.coverPhotoUrl = tempUrl;
      this.coverPosX = 50;
      this.coverPosY = 50;
      this.coverScale = 100;

      // 4. Guardamos en localStorage. ¡Como es un texto corto, jamás dará QuotaExceededError!
      this.saveDraftLocally();
      this.saveSnapshot();
    }
  }

  async uploadPendingCover(): Promise<string> {
    if (!this.pendingCoverFile) throw new Error('No hay archivo pendiente.');

    this.isUploadingCover = true;
    this.cdr.detectChanges();

    try {
      const publicUrl = await this.contentService.uploadCoverImage(this.pendingCoverFile);
      this.pendingCoverFile = null;
      return publicUrl;
    } finally {
      this.isUploadingCover = false;
      this.cdr.detectChanges();
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

  appendSystemTag(t: string) {
    const currentTags = this.tags.split(',').map(tag => tag.trim()).filter(Boolean);
    if (!currentTags.includes(t)) {
      currentTags.push(t);
      this.tags = currentTags.join(', ');
    }
  }

  async save() {
    // 1. ¡INTERCEPTAMOS! Si hay una imagen pendiente, la subimos primero.
    if (this.pendingCoverFile) {
      try {
        const realUrl = await this.uploadPendingCover();
        this.coverPhotoUrl = realUrl;
      } catch (err) {
        console.error('No se pudo subir la portada:', err);
        alert('ERROR: No se pudo subir la imagen de portada a Supabase. Verifica que el bucket "blog_covers" exista y tenga permisos de escritura.');
        return; // Cancelamos para no guardar con un blob: URL en la BD
      }
    }

    this.formatHeadings();
    const tagArray = this.tags.split(',').map(t => t.trim()).filter(t => t.length > 0);
    // Auto-update slug if empty (new document) or if user hasn't manually set one
    if (!this.slug) {
      this.slug = this.contentService.generateSlug(this.title);
    }

    const allBlocks = [...this.contentBlocks, ...this.widgetBlocks];
    if (this.category === 'work') {
      const techStackBlock: EditorBlock = {
        id: 'tech-stack-static',
        type: 'tech-stack',
        content: this.tags, // Keep tags in content for backwards compatibility
        data: { status: this.deployStatus }
      };
      allBlocks.unshift(techStackBlock);
    }

    if (this.bibliography.trim()) {
      allBlocks.push({
        id: 'bibliography-static',
        type: 'bibliography',
        content: this.bibliography
      });
    }

    // Final cover photo with framing parameters
    let finalCover = this.coverPhotoUrl;
    if (finalCover && (this.coverPosX !== 50 || this.coverPosY !== 50 || this.coverScale !== 100)) {
      finalCover += `#x=${this.coverPosX}&y=${this.coverPosY}&s=${this.coverScale}`;
    }

    const savedSlug = await this.contentService.saveDocument({
      id: this.documentId || undefined,
      slug: this.slug,
      title: this.title,
      coverPhoto: finalCover,
      category: this.category as any,
      tags: tagArray,
      indexLog: this.indexLog,
      blocks: [], // We are moving away from blocks
      markdownContent: this.markdownContent,
      status: this.documentStatus
    });

    // ¡DISPARAMOS EL TOAST MÁGICO!
    this.toastType = this.documentStatus === 'published' ? 'live' : 'draft';
    this.toastMessage = this.documentStatus === 'published' ? 'ON LIVE!' : 'DRAFT';
    this.showToast = true;
    this.cdr.detectChanges(); // Forzamos a Angular a mostrar la animación

    // Limpiamos el autoguardado porque ya lo vamos a guardar de verdad
    localStorage.removeItem(`autosave_${this.slug || 'new'}`);

    // 4. Esperamos 1.5 segundos para leer el Toast...
    setTimeout(() => {
      this.showToast = false;
      this.isExiting = true; // ¡Bajamos el telón!
      this.cdr.detectChanges();

      // 5. Esperamos 400ms a que la animación de la cortina termine para cambiar de ruta
      setTimeout(() => {
        this.router.navigate(['/admin']);
      }, 400);

    }, 1500);
  }

  public autoResize(element: HTMLElement) {
    if (element.classList.contains('raw-markdown-editor')) return; // Allow native scrolling for main editor
    element.style.height = 'auto';
    element.style.height = (element.scrollHeight) + 'px';
  }

  syncScroll(source: 'editor' | 'preview') {
    if (this.currentScrollSource && this.currentScrollSource !== source) return;

    const editor = this.editorPane?.nativeElement;
    const preview = this.previewPane?.nativeElement;
    if (!editor || !preview) return;

    this.currentScrollSource = source;

    if (source === 'editor') {
      const denom = editor.scrollHeight - editor.clientHeight;
      if (denom > 0) {
        const percentage = editor.scrollTop / denom;
        preview.scrollTop = percentage * (preview.scrollHeight - preview.clientHeight);
      }
    } else {
      const denom = preview.scrollHeight - preview.clientHeight;
      if (denom > 0) {
        const percentage = preview.scrollTop / denom;
        editor.scrollTop = percentage * (editor.scrollHeight - editor.clientHeight);
      }
    }

    // Reset the source after a short delay to allow the other pane to finish its programmatic scroll
    clearTimeout(this.scrollTimeout);
    this.scrollTimeout = setTimeout(() => {
      this.currentScrollSource = null;
    }, 50);
  }

  public insertMarkdownSnippet(snippet: string, forceStart?: number) {
    console.log('Inserting snippet:', snippet);
    const textarea = document.querySelector('.raw-markdown-editor') as HTMLTextAreaElement;
    if (!textarea) {
      this.markdownContent += snippet;
      return;
    }

    const start = forceStart !== undefined && forceStart !== null ? forceStart : textarea.selectionStart;
    const end = forceStart !== undefined && forceStart !== null ? forceStart : textarea.selectionEnd;
    const text = this.markdownContent;

    this.markdownContent = text.substring(0, start) + snippet + text.substring(end);

    // Devolver el foco y posicionar cursor
    setTimeout(() => {
      textarea.focus();
      textarea.setSelectionRange(start + snippet.length, start + snippet.length);
      this.autoResize(textarea);
    }, 0);

    this.onMarkdownChange(this.markdownContent);
  }

  editorCursorPos: number | null = null;

  public openDiagramBuilder() {
    const textarea = document.querySelector('.raw-markdown-editor') as HTMLTextAreaElement;
    if (textarea) {
      this.editorCursorPos = textarea.selectionStart;
    }

    this.diagramName = '';
    this.editingDiagramId = null;
    this.diagramData = {
      nodes: [
        { id: 'node_start', text: 'START', position: { x: 50, y: 150 }, shape: 'box', bg_color: 'bg-white', text_color: 'text-charcoal', border_style: 'border-2 border-charcoal', shadow_style: 'shadow-[4px_4px_0_#1a1a1a]' }
      ],
      connections: []
    };
    this.showDiagramModal = true;
    this.loadSavedDiagrams();
    this.refreshNodeTemplates();
  }

  // =========================================================
  // === DIAGRAM BUILDER MODAL ===
  // =========================================================
  showDiagramModal = false;
  isUploadingDiagram = false;
  isSavingDiagram = false;
  showDesignStudioPanel = false;
  diagramData: any = { nodes: [], connections: [] };

  // Diagram persistence
  savedDiagrams: SavedDiagram[] = [];
  diagramName = '';
  editingDiagramId: string | null = null;
  sidebarTab: 'templates' | 'saved' = 'templates';

  closeDiagramModal() {
    this.showDiagramModal = false;
    this.showDesignStudioPanel = false;
    this.diagramName = '';
    this.editingDiagramId = null;
    this.sidebarTab = 'templates';
  }

  toggleDesignStudioPanel() {
    this.showDesignStudioPanel = !this.showDesignStudioPanel;
    // Refresh node templates when closing studio (user may have saved/deleted nodes)
    if (!this.showDesignStudioPanel) {
      this.refreshNodeTemplates();
    }
  }

  async refreshNodeTemplates() {
    this.customNodeTemplates = await this.contentService.getDiagramNodes();
    this.cdr.detectChanges();
  }

  addNodeFromStudio(config: DiagramNodeConfig) {
    this.addModalDiagramNode(config);
  }

  addModalDiagramNode(templateIdOrConfig?: string | DiagramNodeConfig) {
    // Stagger position so nodes don't stack on top of each other
    const offset = this.diagramData.nodes.length * 40;
    let newNode: any = {
      id: 'node_' + Math.random().toString(36).substr(2, 6),
      text: 'NEW_NODE',
      position: { x: 200 + offset, y: 150 + offset },
      shape: 'box', icon: null,
      bg_color: 'bg-white', text_color: 'text-charcoal',
      border_style: 'border-2 border-charcoal', shadow_style: 'shadow-[4px_4px_0_#1a1a1a]'
    };

    if (typeof templateIdOrConfig === 'string') {
      const tpl = this.customNodeTemplates.find(t => t.id === templateIdOrConfig);
      if (tpl) {
        newNode.text = tpl.name;
        newNode.icon = tpl.icon;
        newNode.shape = tpl.shape;
        newNode.bg_color = tpl.bg_color;
        newNode.text_color = tpl.text_color;
        newNode.border_style = tpl.border_style;
        newNode.shadow_style = tpl.shadow_style;
        newNode.font = tpl.font;
      }
    } else if (templateIdOrConfig && typeof templateIdOrConfig === 'object') {
      const config = templateIdOrConfig as DiagramNodeConfig;
      newNode.text = config.name;
      newNode.icon = config.icon || null;
      newNode.shape = config.shape || 'box';
      newNode.bg_color = config.bg_color || 'bg-white';
      newNode.text_color = config.text_color || 'text-charcoal';
      newNode.border_style = config.border_style || 'border-2 border-charcoal';
      newNode.shadow_style = config.shadow_style || 'shadow-[4px_4px_0_#1a1a1a]';
      newNode.font = config.font || 'font-mono';
    }

    this.diagramData.nodes.push(newNode);
  }

  onModalNodeDrag(event: any, node: any) {
    node.position.x = event.x;
    node.position.y = event.y;
  }

  trackNodeById(index: number, node: any): string {
    return node.id;
  }

  onModalNodeDragEnded(event: any, node: any) {
    // No-op: position is already tracked via fNodePositionChange
  }

  onModalConnectionCreated(event: any) {
    this.diagramData.connections.push({
      from: event.fOutputId,
      to: event.fInputId
    });
  }

  removeModalDiagramNode(nodeId: string) {
    this.diagramData.nodes = this.diagramData.nodes.filter((n: any) => n.id !== nodeId);
    this.diagramData.connections = this.diagramData.connections.filter((c: any) => !c.from.startsWith(nodeId) && !c.to.startsWith(nodeId));
  }

  async exportDiagramToImage() {
    const canvasElement = document.getElementById('diagram-export-area');
    if (!canvasElement) return;

    this.isUploadingDiagram = true;
    this.cdr.detectChanges();

    try {
      const canvas = await html2canvas(canvasElement, {
        backgroundColor: '#ffffff',
        scale: 2, // Higher resolution
        logging: false
      });

      canvas.toBlob(async (blob) => {
        if (!blob) {
          throw new Error('Canvas to Blob conversion failed.');
        }

        const file = new File([blob], `diagram_${new Date().getTime()}.png`, { type: 'image/png' });

        // Optimizamos el tamaño del diagrama (opcional)
        const options = { maxSizeMB: 0.5, maxWidthOrHeight: 1920, useWebWorker: true };
        const compressedFile = await imageCompression(file, options);

        // Subimos a Supabase Storage
        const publicUrl = await this.contentService.uploadGalleryImage(compressedFile);

        // Insertamos el Markdown
        this.insertMarkdownSnippet(`\n![Diagram](${publicUrl})\n`, this.editorCursorPos ?? undefined);

        this.closeDiagramModal();
      }, 'image/png');
    } catch (err) {
      console.error('Failed to export diagram:', err);
      alert('Error exporting diagram. Please try again.');
    } finally {
      this.isUploadingDiagram = false;
      this.cdr.detectChanges();
    }
  }

  // === DIAGRAM PERSISTENCE ===

  async loadSavedDiagrams() {
    this.savedDiagrams = await this.contentService.getSavedDiagrams();
    this.cdr.detectChanges();
  }

  async saveDiagram() {
    if (!this.diagramName.trim()) {
      this.diagramName = 'Untitled Diagram';
    }

    this.isSavingDiagram = true;
    this.cdr.detectChanges();

    try {
      // Generate thumbnail from current canvas
      let thumbnailUrl = '';
      const canvasEl = document.getElementById('diagram-export-area');
      if (canvasEl) {
        const canvas = await html2canvas(canvasEl, {
          backgroundColor: '#ffffff',
          scale: 1,
          logging: false
        });
        const blob = await new Promise<Blob | null>(resolve => canvas.toBlob(resolve, 'image/png'));
        if (blob) {
          const file = new File([blob], `diagram_thumb_${Date.now()}.png`, { type: 'image/png' });
          const options = { maxSizeMB: 0.2, maxWidthOrHeight: 600, useWebWorker: true };
          const compressed = await imageCompression(file, options);
          thumbnailUrl = await this.contentService.uploadGalleryImage(compressed);
        }
      }

      const saved = await this.contentService.saveDiagram({
        id: this.editingDiagramId || undefined,
        name: this.diagramName.trim(),
        diagram_data: {
          nodes: JSON.parse(JSON.stringify(this.diagramData.nodes)),
          connections: JSON.parse(JSON.stringify(this.diagramData.connections))
        },
        thumbnail_url: thumbnailUrl
      });

      this.editingDiagramId = saved.id || null;
      await this.loadSavedDiagrams();
      this.sidebarTab = 'saved';
    } catch (err) {
      console.error('Error saving diagram:', err);
      alert('Error saving diagram. Please try again.');
    } finally {
      this.isSavingDiagram = false;
      this.cdr.detectChanges();
    }
  }

  loadDiagram(diagram: SavedDiagram) {
    this.diagramName = diagram.name;
    this.editingDiagramId = diagram.id || null;
    this.diagramData = {
      nodes: JSON.parse(JSON.stringify(diagram.diagram_data.nodes)),
      connections: JSON.parse(JSON.stringify(diagram.diagram_data.connections))
    };
    this.cdr.detectChanges();
  }

  async deleteSavedDiagram(id: string) {
    if (!confirm('Delete this diagram permanently?')) return;
    try {
      await this.contentService.deleteSavedDiagram(id);
      if (this.editingDiagramId === id) {
        this.editingDiagramId = null;
        this.diagramName = '';
      }
      await this.loadSavedDiagrams();
    } catch (err) {
      console.error('Error deleting diagram:', err);
    }
  }

  insertDiagramAsImage(thumbnailUrl: string) {
    if (!thumbnailUrl) {
      alert('This diagram has no thumbnail. Open it and export it first.');
      return;
    }
    this.insertMarkdownSnippet(`\n![Diagram](${thumbnailUrl})\n`, this.editorCursorPos ?? undefined);
    this.closeDiagramModal();
  }

  toggleZenMode() {
    this.zenMode = !this.zenMode;

    if (this.zenMode) {
      // Le avisamos a toda la página que entramos en modo Zen
      document.body.classList.add('zen-is-active');

      setTimeout(() => {
        const textareas = document.querySelectorAll('.input-p');
        textareas.forEach(ta => this.autoResize(ta as HTMLElement));
      }, 50);
    } else {
      // Quitamos el aviso
      document.body.classList.remove('zen-is-active');
    }
  }

  toggleToolbar() {
    this.isToolbarCollapsed = !this.isToolbarCollapsed;
  }

  closePreview() {
    this.isPreviewing = false;
    this.previewIframeUrl = null;
    this.cdr.detectChanges();
  }

  async preview() {
    // 1. ¡INTERCEPTAMOS! Si hay una imagen pendiente, la subimos primero.
    // IMPORTANTE: Los blob: URLs son locales a la pestaña que los creó y NO funcionan
    // en otras pestañas. Por eso debemos subir la imagen ANTES de abrir el preview.
    if (this.pendingCoverFile) {
      try {
        const realUrl = await this.uploadPendingCover();
        this.coverPhotoUrl = realUrl;
      } catch (err) {
        console.error('No se pudo subir la portada para el preview:', err);
        alert('ERROR: No se pudo subir la imagen de portada a Supabase. Verifica que el bucket "blog_covers" exista y tenga permisos de escritura.');
        return; // Cancelamos el preview para no abrir una ventana con imagen rota
      }
    }

    this.formatHeadings();
    const tagArray = this.tags.split(',').map(t => t.trim()).filter(t => t.length > 0);

    const allBlocks = [...this.contentBlocks, ...this.widgetBlocks];
    if (this.category === 'work') {
      const techStackBlock: EditorBlock = {
        id: 'tech-stack-static',
        type: 'tech-stack',
        content: this.tags,
        data: { status: this.deployStatus }
      };
      allBlocks.unshift(techStackBlock);
    }

    if (this.bibliography.trim()) {
      allBlocks.push({
        id: 'bibliography-static',
        type: 'bibliography',
        content: this.bibliography
      });
    }

    // Construct final cover photo URL with framing params for preview
    let finalCover = this.coverPhotoUrl;
    if (finalCover && (this.coverPosX !== 50 || this.coverPosY !== 50 || this.coverScale !== 100)) {
      finalCover += `#x=${this.coverPosX}&y=${this.coverPosY}&s=${this.coverScale}`;
    }

    // Save to the temporary preview memory synchronously
    this.contentService.setPreviewDocument({
      slug: this.slug,
      title: this.title,
      coverPhoto: finalCover,
      category: this.category as any,
      tags: tagArray,
      indexLog: this.indexLog,
      blocks: [],
      markdownContent: this.markdownContent
    });

    const routeBase = this.category === 'work' ? 'works' : (this.category === 'guide' ? 'guides' : 'logs');
    this.previewIframeUrl = this.sanitizer.bypassSecurityTrustResourceUrl(`/${routeBase}/preview`);
    this.isPreviewing = true;
    this.cdr.detectChanges();
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

  // =========================================================
  // === CÓDIGO NUEVO (DENTRO DE LA CLASE, ANTES DE LA ÚLTIMA LLAVE) ===
  // =========================================================

  showSlashMenu = false;
  activeBlockIndex = -1;
  slashMenuSelectedIndex = 0;
  slashCommands = [
    { type: 'h1', label: 'Título 1', icon: 'format_h1' },
    { type: 'h2', label: 'Título 2', icon: 'format_h2' },
    { type: 'image', label: 'Imagen', icon: 'image' },
    { type: 'video', label: 'Video', icon: 'videocam' },
    { type: 'code', label: 'Bloque de Código', icon: 'code' },
    { type: 'blockquote', label: 'Cita / Blockquote', icon: 'format_quote' },
    { type: 'diagram', label: 'Diagrama', icon: 'account_tree' },
    { type: 'divider', label: 'Separador', icon: 'horizontal_rule' },
    { type: 'objective-header', label: 'Cabecera de Obj.', icon: 'hdr_strong' },
    { type: 'objectives', label: 'Grid de Objetivos', icon: 'grid_view' },
    { type: 'comparison', label: 'Cuadro Comparativo', icon: 'splitscreen' },
    { type: 'gallery', label: 'Galería de Imágenes', icon: 'auto_awesome_mosaic' }
  ];

  onBlockKeyDown(event: KeyboardEvent, index: number) {
    const block = this.contentBlocks[index];
    if (!block) return;

    if (this.showSlashMenu && this.activeBlockIndex === index) {
      if (event.key === 'ArrowDown') {
        event.preventDefault();
        this.slashMenuSelectedIndex = (this.slashMenuSelectedIndex + 1) % this.slashCommands.length;
        return;
      }
      if (event.key === 'ArrowUp') {
        event.preventDefault();
        this.slashMenuSelectedIndex = (this.slashMenuSelectedIndex - 1 + this.slashCommands.length) % this.slashCommands.length;
        return;
      }
      if (event.key === 'Enter') {
        event.preventDefault();
        this.executeSlashCommand(this.slashCommands[this.slashMenuSelectedIndex].type);
        return;
      }
      if (event.key === 'Escape') {
        this.closeSlashMenu();
        return;
      }
    }

    // Flujo Notion: 'Enter' crea un nuevo bloque de párrafo abajo
    if (event.key === 'Enter' && !event.shiftKey && !this.showSlashMenu) {
      event.preventDefault();

      this.contentBlocks.splice(index + 1, 0, {
        id: Math.random().toString(36).substr(2, 9),
        type: 'p',
        content: ''
      });

      this.saveSnapshot(); // ¡GUARDAMOS HISTORIAL!

      setTimeout(() => {
        const el = document.getElementById(`block-input-${index + 1}`);
        if (el) el.focus();
        this.centerActiveBlock(index + 1); // <--- AÑADE ESTA LÍNEA
      }, 50);
      return;
    }

    // Flujo Notion: 'Backspace' borra bloque vacío
    if (event.key === 'Backspace' && block.content === '' && index > 0) {
      event.preventDefault();
      this.contentBlocks.splice(index, 1);

      this.saveSnapshot(); // ¡GUARDAMOS HISTORIAL!

      setTimeout(() => {
        const el = document.getElementById(`block-input-${index - 1}`);
        if (el) el.focus();
      }, 50);
    }
  }

  onBlockInput(event: any, index: number) {
    const value = event.target.value;
    const block = this.contentBlocks[index];
    if (!block) return;

    // === 1. ATAJOS MARKDOWN NATIVOS ===
    if (block.type === 'p') {
      if (value === '# ') {
        block.type = 'h1';
        block.content = '';
        setTimeout(() => document.getElementById(`block-input-${index}`)?.focus(), 50);
        this.saveSnapshot();
        return; // Detenemos la función aquí
      }

      if (value === '## ') {
        block.type = 'h2';
        block.content = '';
        setTimeout(() => document.getElementById(`block-input-${index}`)?.focus(), 50);
        this.saveSnapshot();
        return;
      }

      if (value === '---') {
        block.type = 'divider';
        block.content = '';
        // El separador no es de texto, así que creamos un párrafo vacío abajo para seguir escribiendo
        this.contentBlocks.splice(index + 1, 0, {
          id: Math.random().toString(36).substr(2, 9),
          type: 'p',
          content: ''
        });
        setTimeout(() => document.getElementById(`block-input-${index + 1}`)?.focus(), 50);
        this.saveSnapshot();
        return;
      }

      // NUEVO: Bloque de Código
      if (value === '```') {
        block.type = 'code';
        block.content = '';
        block.data = { language: 'typescript', filename: '', error: '', errorType: 'error' };
        setTimeout(() => document.getElementById(`block-input-${index}`)?.focus(), 50);
        this.saveSnapshot();
        return;
      }

      // NUEVO: Blockquote
      if (value === '> ') {
        block.type = 'blockquote';
        block.content = '';
        setTimeout(() => document.getElementById(`block-input-${index}`)?.focus(), 50);
        this.saveSnapshot();
        return;
      }
    }

    // === 2. MENÚ MÁGICO '/' ===
    if (value === '/') {
      this.showSlashMenu = true;
      this.activeBlockIndex = index;
      this.slashMenuSelectedIndex = 0;
    } else if (this.showSlashMenu && this.activeBlockIndex === index && !value.startsWith('/')) {
      this.closeSlashMenu();
    }

    // === 3. AUTOGUARDADO EN HISTORIAL (MÁQUINA DEL TIEMPO) ===
    clearTimeout(this.typingTimer);
    this.typingTimer = setTimeout(() => {
      this.saveSnapshot();
    }, 1000);
  }

  closeSlashMenu() {
    this.showSlashMenu = false;
    this.activeBlockIndex = -1;
  }

  executeSlashCommand(type: string) {
    const block = this.contentBlocks[this.activeBlockIndex];
    if (!block) return;
    block.type = type as any;
    block.content = '';

    switch (type) {
      case 'objective-header':
        block.data = { title: '02_MISSION_OBJECTIVES', subtitle: '/TARGETS' };
        break;
      case 'objectives':
        block.data = [{ label: 'OBJ', title: 'Nuevo Objetivo', desc: '...', progress: 50 }];
        break;
      case 'diagram':
        // Instead of creating a block, we open the Diagram Builder modal
        // and remove the empty paragraph where the slash command was typed.
        this.contentBlocks.splice(this.activeBlockIndex, 1);
        this.closeSlashMenu();
        this.cdr.detectChanges();
        this.openDiagramBuilder();
        return; // Early return to avoid focusing on deleted block
      case 'video':
        block.data = { source: 'youtube' };
        break;
      case 'comparison':
        block.data = {
          col1Title: 'OPCIÓN A',
          col2Title: 'OPCIÓN B',
          rows: [
            { col1: '', col2: '' },
            { col1: '', col2: '' }
          ]
        };
        block.content = '';
        break;
      case 'code':
        block.data = { language: 'typescript', filename: '', error: '', errorType: 'error' };
        break;
      case 'gallery':
        block.data = { images: [], layout: 'grid' };
        break;
      case 'table':
        block.data = {
          headers: ['Header 1', 'Header 2', 'Header 3'],
          rows: [
            ['Item 1', 'Item 2', 'Item 3'],
            ['Item 4', 'Item 5', 'Item 6']
          ]
        };
        break;
      case 'tree':
        block.content = 'project-root/\n├── src/\n│   ├── main.tf\n│   └── variables.tf\n├── tests/\n│   └── main_test.go\n└── README.md';
        block.data = {};
        break;
    }

    this.closeSlashMenu();
    this.cdr.detectChanges();

    if (type === 'h1' || type === 'h2') {
      setTimeout(() => {
        const el = document.getElementById(`block-input-${this.activeBlockIndex}`);
        if (el) el.focus();
      }, 50);
    }
  }

  // --- GALLERY BLOCK: MULTI-IMAGE UPLOAD ---
  async onGalleryImagesSelected(event: any, block: EditorBlock) {
    const files: FileList = event.target.files;
    if (!files || files.length === 0) return;

    if (!block.data) block.data = { images: [], layout: 'grid' };
    if (!block.data.images) block.data.images = [];

    for (let i = 0; i < files.length; i++) {
      let file = files[i];
      try {
        if (file.size > 1 * 1024 * 1024) {
          const options = { maxSizeMB: 0.8, maxWidthOrHeight: 1920, useWebWorker: true };
          file = await imageCompression(file, options);
        }
      } catch (err) {
        console.warn('Gallery compression error:', err);
      }

      // Upload to Supabase
      try {
        const url = await this.contentService.uploadGalleryImage(file);
        block.data.images.push(url);
      } catch (uploadErr) {
        console.warn('Gallery upload error:', uploadErr);
        // Fallback: use blob URL for preview
        block.data.images.push(URL.createObjectURL(file));
      }
    }
    this.cdr.detectChanges();
  }

  removeGalleryImage(block: EditorBlock, imgIndex: number) {
    if (block.data?.images) {
      block.data.images.splice(imgIndex, 1);
    }
  }

  // --- LIGHTBOX ---
  lightboxImage: string | null = null;

  openLightbox(src: string) {
    this.lightboxImage = src;
  }

  closeLightbox() {
    this.lightboxImage = null;
  }

  // --- LÓGICA DE ARRASTRE DEL BANNER ---
  onBannerDragStart(event: MouseEvent | TouchEvent) {
    event.preventDefault(); // Evita el comportamiento fantasma de arrastrar imágenes por defecto del navegador
    this.isDraggingBanner = true;

    // Soporte para Mouse o Pantalla Táctil
    const clientX = event instanceof MouseEvent ? event.clientX : event.touches[0].clientX;
    const clientY = event instanceof MouseEvent ? event.clientY : event.touches[0].clientY;

    this.dragStartX = clientX;
    this.dragStartY = clientY;
    this.dragInitPosX = this.coverPosX;
    this.dragInitPosY = this.coverPosY;
  }

  onBannerDragMove(event: MouseEvent | TouchEvent) {
    if (!this.isDraggingBanner) return;

    const clientX = event instanceof MouseEvent ? event.clientX : event.touches[0].clientX;
    const clientY = event instanceof MouseEvent ? event.clientY : event.touches[0].clientY;

    const deltaX = clientX - this.dragStartX;
    const deltaY = clientY - this.dragStartY;

    // Sensibilidad del mouse (0.2 suele sentirse natural)
    const sensitivity = 0.2;

    let newX = this.dragInitPosX - (deltaX * sensitivity);
    let newY = this.dragInitPosY - (deltaY * sensitivity);

    // Evitamos que la imagen se salga de los límites (0% a 100%)
    this.coverPosX = Math.max(0, Math.min(100, Math.round(newX)));
    this.coverPosY = Math.max(0, Math.min(100, Math.round(newY)));
  }

  onBannerDragEnd() {
    this.isDraggingBanner = false;
  }

  // === LÓGICA DE AUTOGUARDADO ===
  saveDraftLocally() {
    // No guardamos si el documento está completamente vacío
    if (!this.title && this.contentBlocks.length === 0) return;

    // IMPORTANTE: No guardamos blob: URLs (solo válidas en la pestaña actual)
    // ni data: URLs de Base64 (pesan demasiado y rompen el localStorage).
    // Si la URL es una de estas, guardamos un string vacío — se perderá en el draft
    // pero se subirá a Supabase cuando hagas Save/Preview.
    const safeCoverUrl = (this.coverPhotoUrl &&
      !this.coverPhotoUrl.startsWith('blob:') &&
      !this.coverPhotoUrl.startsWith('data:'))
      ? this.coverPhotoUrl
      : '';

    const draftData = {
      title: this.title,
      blocks: this.contentBlocks,
      coverPhoto: safeCoverUrl,
      status: this.documentStatus,
      timestamp: new Date().getTime()
    };

    // Guardamos en la memoria del navegador usando el slug actual o 'new'
    const storageKey = `autosave_${this.slug || 'new'}`;
    try {
      localStorage.setItem(storageKey, JSON.stringify(draftData));
    } catch (e) {
      // QuotaExceededError: el draft sigue siendo demasiado grande
      console.warn('Autosave fallido (localStorage lleno):', e);
    }

    const now = new Date();
    this.lastAutoSaveTime = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;
    this.cdr.detectChanges();
  }

  // === LÓGICA DE RECUPERACIÓN ===
  checkLocalDraft(slug: string) {
    const storageKey = `autosave_${slug || 'new'}`;
    const rawDraft = localStorage.getItem(storageKey);

    if (rawDraft) {
      // Guard: Si el draft guardado contiene una imagen Base64 enorme,
      // lo descartamos automáticamente para no congelar el parse.
      if (rawDraft.includes('"data:image')) {
        console.warn('Draft descartado: contiene imagen Base64 pesada. Limpiando...');
        localStorage.removeItem(storageKey);
        return;
      }

      // En lugar de usar 'confirm()', guardamos los datos temporalmente y mostramos nuestro modal
      this.pendingDraftData = JSON.parse(rawDraft);
      this.showDraftModal = true;
      this.cdr.detectChanges();
    }
  }

  acceptDraft() {
    if (this.pendingDraftData) {
      this.title = this.pendingDraftData.title || '';
      this.contentBlocks = this.pendingDraftData.blocks || [];
      // Solo restauramos la portada si es una URL real (no base64, no blob)
      const savedCover = this.pendingDraftData.coverPhoto || '';
      if (savedCover && !savedCover.startsWith('data:') && !savedCover.startsWith('blob:')) {
        this.coverPhotoUrl = savedCover;
      }
      this.documentStatus = this.pendingDraftData.status || 'draft';

      this.cdr.detectChanges();
      this.saveSnapshot();
    }
    this.closeDraftModal();
  }

  discardDraft() {
    // Si descarta, limpiamos el localStorage para que no vuelva a salir este mensaje molesto
    const storageKey = `autosave_${this.slug || 'new'}`;
    localStorage.removeItem(storageKey);
    this.closeDraftModal();
  }

  closeDraftModal() {
    this.showDraftModal = false;
    this.pendingDraftData = null;
    this.cdr.detectChanges();
  }

  // === LÓGICA DE UNDO / REDO ===

  // Toma una foto del documento actual y la guarda
  saveSnapshot() {
    const snapshot = JSON.stringify(this.contentBlocks);

    // Si no es igual a la última foto, la guardamos
    if (this.historyPointer === -1 || snapshot !== this.historyStack[this.historyPointer]) {
      // Si habíamos retrocedido, borramos el "futuro" alternativo
      this.historyStack = this.historyStack.slice(0, this.historyPointer + 1);
      this.historyStack.push(snapshot);
      this.historyPointer++;

      // === CAP DE MEMORIA: máximo 50 snapshots en el historial ===
      // Cada snapshot puede pesar varios KB; sin límite puede acumular MBs.
      const MAX_HISTORY = 50;
      if (this.historyStack.length > MAX_HISTORY) {
        this.historyStack.shift(); // Eliminamos el snapshot más antiguo
        this.historyPointer--;    // Ajustamos el puntero
      }
    }
  }

  undo() {
    if (this.historyPointer > 0) {
      this.historyPointer--;
      this.contentBlocks = JSON.parse(this.historyStack[this.historyPointer]);
      this.cdr.detectChanges();
    }
  }

  redo() {
    if (this.historyPointer < this.historyStack.length - 1) {
      this.historyPointer++;
      this.contentBlocks = JSON.parse(this.historyStack[this.historyPointer]);
      this.cdr.detectChanges();
    }
  }

  // === SCROLL DE MÁQUINA DE ESCRIBIR (TYPEWRITER FOCUS) ===
  centerActiveBlock(index: number) {
    // Solo activamos esta magia si estamos en el Modo Zen
    if (!this.zenMode) return;

    setTimeout(() => {
      const el = document.getElementById(`block-input-${index}`);
      if (el) {
        // La API nativa del navegador centra el elemento en la pantalla suavemente
        el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    }, 50);
  }

  // =========================================================
  // === FLOATING QUICK ACTIONS (TEXT SELECTION) ===
  // =========================================================
  showFloatingToolbar = false;
  floatToolbarLeft = 0;
  floatToolbarTop = 0;
  selectedTextRange: { start: number, end: number } | null = null;

  @ViewChild('editorPane', { static: false }) editorTextarea!: ElementRef<HTMLTextAreaElement>;

  onMarkdownSelect(event: any) {
    const textarea = event.target as HTMLTextAreaElement;
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;

    // Solo mostramos la barra rápida si hay texto seleccionado
    if (start !== end) {
      this.selectedTextRange = { start, end };

      // Intentamos posicionar el popup brutalista justo arriba del cursor
      try {
        const textToCursor = textarea.value.substring(0, start);
        const lines = textToCursor.split('\n');
        const currentLineIndex = lines.length;

        // Un cálculo aproximado y estable para textarea brutalista sin librerías complejas:
        // Cada línea de nuestro textarea (line-height 2, font 1.15rem) ocupa aprox 36px
        // La fuente es monoespaciada, estimamos ~9px por caracter
        const lineHeight = 36;
        const charWidth = 9;
        const currentLineText = lines[lines.length - 1];

        // scrollTop y scrollLeft base
        const scrollTop = textarea.scrollTop;
        const scrollLeft = textarea.scrollLeft;

        // X e Y base relativas al textarea
        // Le sumamos el padding interno de 3rem (48px) o 8vh
        const baseY = (currentLineIndex * lineHeight) - scrollTop;
        const baseX = (currentLineText.length * charWidth) - scrollLeft + 48; // aprox padding

        // Calculamos las coordenadas FINALES respecto a la pantalla
        const rect = textarea.getBoundingClientRect();

        this.floatToolbarTop = rect.top + baseY - 60; // 60px arriba del texto
        this.floatToolbarLeft = rect.left + Math.min(baseX, rect.width - 200); // 200px max width

        this.showFloatingToolbar = true;
      } catch (e) {
        // Fallback al centro inferior si falla el cálculo manual
        this.showFloatingToolbar = true;
        this.floatToolbarTop = window.innerHeight - 100;
        this.floatToolbarLeft = window.innerWidth / 2;
      }
    } else {
      this.showFloatingToolbar = false;
      this.selectedTextRange = null;
    }
  }

  applyQuickFormat(syntax: string) {
    if (!this.selectedTextRange || !this.editorTextarea) return;

    const { start, end } = this.selectedTextRange;
    const textarea = this.editorTextarea.nativeElement;

    const text = this.markdownContent;
    const prefix = text.substring(0, start);
    const selected = text.substring(start, end);
    const suffix = text.substring(end);

    let formattedText = '';

    if (syntax === 'link') {
      formattedText = `[${selected}](url)`;
    } else if (syntax === 'bold') {
      formattedText = `**${selected}**`;
    } else if (syntax === 'italic') {
      formattedText = `*${selected}*`;
    } else if (syntax === 'code') {
      formattedText = `\`${selected}\``;
    }

    this.markdownContent = prefix + formattedText + suffix;
    this.saveSnapshot();
    this.showFloatingToolbar = false;
    this.selectedTextRange = null;
    this.saveDraftLocally();

    // Devolvemos el foco
    setTimeout(() => {
      textarea.focus();
      textarea.setSelectionRange(start + syntax.length, start + formattedText.length);
    }, 50);
  }
  // === LÓGICA DE DIAGRAMAS FOBLEX ===

  // Actualizamos la función para que acepte un ID de plantilla opcional
  addDiagramNode(block: any, templateId?: string) {
    if (!block.data) block.data = {}; // Ensure block.data exists
    if (!block.data.nodes) block.data.nodes = [];

    // 1. Definimos la estructura básica del nuevo nodo
    let newNode: any = {
      id: 'node_' + Math.random().toString(36).substr(2, 6),
      text: 'NEW_NODE',
      x: 200, y: 160, // Posición inicial (ajustada al grid)
      shape: 'box', icon: null, // Valores por defecto
      // Clases de Tailwind por defecto si no se elige plantilla
      bg_color: 'bg-white', text_color: 'text-charcoal',
      border_style: 'border-2 border-charcoal', shadow_style: 'shadow-[4px_4px_0_#1a1a1a]'
    };

    // 2. Si hicieron clic en un botón de plantilla, aplicamos sus estilos INMEDIATAMENTE
    if (templateId) {
      const tpl = this.customNodeTemplates.find(t => t.id === templateId);
      if (tpl) {
        newNode.text = tpl.name;       // El nombre de la plantilla (ej. "Database")
        newNode.icon = tpl.icon;       // ¡RECUPERAMOS EL ÍCONO!
        newNode.shape = tpl.shape;
        newNode.bg_color = tpl.bg_color;
        newNode.text_color = tpl.text_color;
        newNode.border_style = tpl.border_style;
        newNode.shadow_style = tpl.shadow_style;
        newNode.font = tpl.font;
        newNode.templateId = tpl.id; // Guardamos la referencia
      }
    }

    block.data.nodes.push(newNode);
    this.saveSnapshot();
  }

  onConnectionCreated(event: any, block: any) {
    if (!block.data) block.data = {};
    if (!block.data.connections) block.data.connections = [];

    // Foblex nos devuelve el ID de salida y el ID de entrada que el usuario conectó
    block.data.connections.push({
      from: event.fOutputId,
      to: event.fInputId
    });
    this.saveSnapshot();
  }

  onNodeDrag(event: any, node: any) {
    node.x = event.x;
    node.y = event.y;
  }

  // === PLANTILLAS DEL DESIGN STUDIO ===
  applyNodeTemplate(node: any, templateId: string) {
    const template = this.customNodeTemplates.find(t => t.id === templateId);
    if (template) {
      node.templateId = template.id;
      node.shape = template.shape;
      node.icon = template.icon; // Added icon update
      node.bg_color = template.bg_color;
      node.text_color = template.text_color;
      node.border_style = template.border_style;
      node.shadow_style = template.shadow_style;
      node.font = template.font;

      if (node.text === 'NEW_NODE') node.text = template.name;

      this.saveSnapshot();
      this.cdr.detectChanges();
    }
  }

  removeDiagramNode(block: any, nodeId: string) {
    // Borramos el nodo
    block.data.nodes = block.data.nodes.filter((n: any) => n.id !== nodeId);
    // Borramos cualquier cable que estuviera conectado a ese nodo
    block.data.connections = block.data.connections.filter((c: any) => c.from !== nodeId && c.to !== nodeId);
    this.saveSnapshot();
  }

  // =========================================================
  // LOGICA DEL CUADRO COMPARATIVO (COMPARISON MATRIX)
  // =========================================================

  // 1. Insertar el cuadro desde la barra lateral
  addComparisonBlock() {
    this.contentBlocks.push({
      id: Math.random().toString(36).substr(2, 9),
      type: 'comparison',
      content: '',
      data: {
        col1Title: 'OPCIÓN A',
        col2Title: 'OPCIÓN B',
        rows: [
          { col1: '', col2: '' }, // Fila 1 vacía
          { col1: '', col2: '' }  // Fila 2 vacía
        ]
      }
    });

    this.saveSnapshot(); // Guarda en el historial para el Ctrl+Z

    // Hace scroll automático hacia abajo para que veas el nuevo cuadro
    setTimeout(() => {
      window.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' });
    }, 100);
  }

  // 2. Agregar una nueva fila al cuadro
  addComparisonRow(block: any) {
    if (!block.data.rows) block.data.rows = [];
    block.data.rows.push({ col1: '', col2: '' });
    this.saveSnapshot();
  }

  removeComparisonRow(block: any, rowIndex: number) {
    block.data.rows.splice(rowIndex, 1);
    this.saveSnapshot();
  }

  // =========================================================
  // MARKDOWN IMPORT FEATURE
  // =========================================================
  importMarkdownFile(event: any) {
    const file = event.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e: any) => {
      const markdown = e.target.result;
      const parsedBlocks = this.parseMarkdownToBlocks(markdown);

      if (this.contentBlocks.length > 0) {
        if (confirm('¿Quieres reemplazar el contenido actual? Cancelar si quieres añadirlo al final.')) {
          this.contentBlocks = parsedBlocks;
        } else {
          this.contentBlocks = [...this.contentBlocks, ...parsedBlocks];
        }
      } else {
        this.contentBlocks = parsedBlocks;
      }

      this.saveSnapshot();
      event.target.value = null; // Reset input
    };
    reader.readAsText(file);
  }

  importPastedMarkdown() {
    if (!this.pastedMarkdown.trim()) return;

    const parsedBlocks = this.parseMarkdownToBlocks(this.pastedMarkdown);

    if (this.contentBlocks.length > 0) {
      if (confirm('¿Quieres reemplazar el contenido actual? Cancelar si quieres añadirlo al final.')) {
        this.contentBlocks = parsedBlocks;
      } else {
        this.contentBlocks = [...this.contentBlocks, ...parsedBlocks];
      }
    } else {
      this.contentBlocks = parsedBlocks;
    }

    this.saveSnapshot();
    this.showPasteMdModal = false;
    this.pastedMarkdown = '';
  }

  parseMarkdownToBlocks(markdown: string): EditorBlock[] {
    const lines = markdown.split('\n');
    const blocks: EditorBlock[] = [];
    let inCodeBlock = false;
    let codeLanguage = '';
    let codeContent: string[] = [];
    let currentParagraph: string[] = [];

    const flushParagraph = () => {
      if (currentParagraph.length > 0) {
        blocks.push({
          id: Math.random().toString(36).substr(2, 9),
          type: 'p',
          content: currentParagraph.join('\n')
        });
        currentParagraph = [];
      }
    };

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];

      // Code Block handling
      if (line.trim().startsWith('```')) {
        if (inCodeBlock) {
          blocks.push({
            id: Math.random().toString(36).substr(2, 9),
            type: 'code',
            content: codeContent.join('\n'),
            data: { language: codeLanguage || 'typescript', filename: '', error: '', errorType: 'error' }
          });
          inCodeBlock = false;
          codeContent = [];
          codeLanguage = '';
        } else {
          flushParagraph();
          inCodeBlock = true;
          codeLanguage = line.trim().replace('```', '').trim().toLowerCase();
        }
        continue;
      }

      if (inCodeBlock) {
        codeContent.push(line);
        continue;
      }

      // Headings
      if (line.startsWith('# ')) {
        flushParagraph();
        blocks.push({
          id: Math.random().toString(36).substr(2, 9),
          type: 'h1',
          content: line.substring(2).trim()
        });
        continue;
      }
      if (line.startsWith('## ')) {
        flushParagraph();
        blocks.push({
          id: Math.random().toString(36).substr(2, 9),
          type: 'h2',
          content: line.substring(3).trim()
        });
        continue;
      }

      // Blockquote
      if (line.startsWith('> ')) {
        flushParagraph();
        blocks.push({
          id: Math.random().toString(36).substr(2, 9),
          type: 'blockquote',
          content: line.substring(2).trim()
        });
        continue;
      }

      // Divider
      if (line.trim() === '---' || line.trim() === '***') {
        flushParagraph();
        blocks.push({
          id: Math.random().toString(36).substr(2, 9),
          type: 'divider',
          content: ''
        });
        continue;
      }

      // Images ![alt](url)
      const imageMatch = line.match(/^!\[(.*?)\]\(([^)\s]+)(?:\s+"(.*?)")?\)$/);
      if (imageMatch) {
        flushParagraph();
        blocks.push({
          id: Math.random().toString(36).substr(2, 9),
          type: 'image',
          content: imageMatch[2],
          data: { text: imageMatch[1] || '' }
        });
        continue;
      }

      // Empty Lines (Paragraph break)
      if (line.trim() === '') {
        flushParagraph();
        continue;
      }

      currentParagraph.push(line);
    }

    // Flush any remaining
    flushParagraph();

    return blocks;
  }

  trackByIndex(index: number, obj: any): any {
    return index;
  }

  // === MÉTODOS DE PEGAR MARKDOWN E INTELIGENCIA ARTIFICIAL ===

  @HostListener('window:paste', ['$event'])
  onGlobalPaste(event: ClipboardEvent) {
    if (this.showPasteMdModal) return;

    const target = event.target as HTMLElement;
    const isInputOrTextarea = target.tagName === 'INPUT' || target.tagName === 'TEXTAREA';
    const textData = event.clipboardData?.getData('text/plain');
    if (!textData) return;

    // Detect if the pasted text has multiple lines or contains strong markdown patterns like images, code blocks, or headings
    const isMarkdownPattern = /(^#{1,6}\s|^!\[.*?\]\(.*?|^```|^- \[[ x]\])/m.test(textData);
    const isMultiLine = textData.split('\n').length > 2;

    if (isMarkdownPattern || (isMultiLine && !isInputOrTextarea)) {
      event.preventDefault();
      this.pastedMarkdown = textData;
      this.showPasteMdModal = true;
    }
  }

  onPasteModal(event: ClipboardEvent) {
    const htmlData = event.clipboardData?.getData('text/html');
    if (htmlData) {
      event.preventDefault();

      const newBlocks = this.parseHtmlToBlocks(htmlData);

      if (newBlocks.length === 0) return;

      if (this.contentBlocks.length > 0) {
        if (confirm('Se detectó contenido enriquecido (IA). ¿Quieres reemplazar el contenido actual del editor? Cancelar si quieres añadirlo al final.')) {
          this.contentBlocks = newBlocks;
        } else {
          this.contentBlocks = [...this.contentBlocks, ...newBlocks];
        }
      } else {
        this.contentBlocks = newBlocks;
      }

      this.updateIndexLogLive();
      this.saveSnapshot();
      this.showPasteMdModal = false;
      this.pastedMarkdown = '';
    }
  }

  parseHtmlToBlocks(html: string): EditorBlock[] {
    const parser = new DOMParser();
    const doc = parser.parseFromString(html, 'text/html');
    const blocks: EditorBlock[] = [];

    const newId = () => Math.random().toString(36).substr(2, 9);

    const processElement = (el: HTMLElement) => {
      let text = el.textContent?.trim() || '';
      if (!text && el.tagName !== 'TR' && el.tagName !== 'TABLE' && el.tagName !== 'IMG') return;

      if (['H1', 'H2', 'H3', 'H4', 'H5', 'H6'].includes(el.tagName)) {
        blocks.push({
          id: newId(),
          type: el.tagName === 'H1' ? 'h1' : 'h2', // Mapping all headings to h2 except h1
          content: text
        });
      } else if (el.tagName === 'P') {
        let innerMd = this.convertInlineTextNode(el).trim();
        if (innerMd) {
          blocks.push({ id: newId(), type: 'p', content: innerMd });
        }
      } else if (el.tagName === 'CODE' || el.tagName === 'PRE') {
        let lang = 'plaintext';
        const codeEl = el.tagName === 'PRE' ? el.querySelector('code') : el;
        if (codeEl?.className) {
          const m = codeEl.className.match(/language-(\w+)/);
          if (m) lang = m[1];
        }
        const content = (codeEl ? codeEl.textContent : el.textContent) || '';

        // Heuristic for Directory Tree vs Normal Code
        if (content.match(/[├└│]/) || content.includes('├──') || content.includes('└──')) {
          blocks.push({ id: newId(), type: 'tree', content: content.trim(), data: {} });
        } else {
          blocks.push({ id: newId(), type: 'code', content: content.trim(), data: { language: lang, filename: '', error: '', errorType: 'error' } });
        }
      } else if (el.tagName === 'UL' || el.tagName === 'OL') {
        let listMd = '';
        let isOl = el.tagName === 'OL';
        let i = 1;
        Array.from(el.querySelectorAll(':scope > li')).forEach(li => {
          listMd += (isOl ? `${i}. ` : '- ') + this.convertInlineTextNode(li).replace(/\n/g, '') + '\n';
          i++;
        });
        blocks.push({ id: newId(), type: 'p', content: listMd.trim() });
      } else if (el.tagName === 'TABLE') {
        const headers: string[] = [];
        const rows: string[][] = [];

        const trs = Array.from(el.querySelectorAll('tr'));
        if (trs.length === 0) return;

        trs.forEach((tr, index) => {
          const cells = Array.from(tr.querySelectorAll(index === 0 ? 'th, td' : 'td'));
          const cellTexts = cells.map(c => this.convertInlineTextNode(c as HTMLElement).trim());
          if (index === 0) {
            headers.push(...cellTexts);
          } else {
            while (cellTexts.length < headers.length) cellTexts.push(''); // pad
            rows.push(cellTexts);
          }
        });

        if (headers.length === 0 && rows.length > 0) {
          rows[0].forEach((_, i) => headers.push(`Col ${i + 1}`));
        }

        blocks.push({ id: newId(), type: 'table', content: '', data: { headers, rows } });
      } else if (el.tagName === 'DIV' || el.tagName === 'SECTION' || el.tagName === 'ARTICLE' || el.tagName === 'MAIN' || el.tagName === 'BODY') {
        Array.from(el.children).forEach(child => processElement(child as HTMLElement));
      } else {
        let innerMd = this.convertInlineTextNode(el).trim();
        if (innerMd) {
          blocks.push({ id: newId(), type: 'p', content: innerMd });
        }
      }
    };

    processElement(doc.body);
    return blocks;
  }

  convertInlineTextNode(node: Node): string {
    if (node.nodeType === Node.TEXT_NODE) {
      return (node.textContent || '').replace(/\s+/g, ' ');
    }
    if (node.nodeType === Node.ELEMENT_NODE) {
      const el = node as HTMLElement;
      // Skip structural blocks that we will parse separately at the top level
      if (['DIV', 'P', 'UL', 'OL', 'LI', 'PRE', 'TABLE'].includes(el.tagName)) {
        let text = '';
        Array.from(el.childNodes).forEach(c => text += this.convertInlineTextNode(c));
        return text;
      }

      let innerText = '';
      Array.from(el.childNodes).forEach(child => {
        innerText += this.convertInlineTextNode(child);
      });

      switch (el.tagName) {
        case 'STRONG': case 'B': return `**${innerText.trim()}**`;
        case 'EM': case 'I': return `_${innerText.trim()}_`;
        case 'CODE': return `\`${innerText.trim()}\``;
        case 'A': return `[${innerText.trim()}](${el.getAttribute('href') || ''})`;
        case 'BR': return '\n';
        default: return innerText;
      }
    }
    return '';
  }

}
