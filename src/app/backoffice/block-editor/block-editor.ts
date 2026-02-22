import { Component, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterModule, ActivatedRoute, Router } from '@angular/router';
import { CdkDragDrop, moveItemInArray, CdkDrag, CdkDropList, CdkDragHandle } from '@angular/cdk/drag-drop';
import { ContentService, EditorBlock, DocumentEntry } from '../../services/content.service';

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

  documentId: string | null = null;
  documentSlug: string | null = null;
  title = '';
  slug = '';
  coverPhoto = '';
  tags = '';
  category: 'work' | 'log' = 'work';
  indexLog = '';
  blocks: EditorBlock[] = [
    { id: '1', type: 'h1', content: 'Initial Draft' },
    { id: '2', type: 'p', content: 'Write here...' }
  ];

  editingDiagramBlock: EditorBlock | null = null;

  ngOnInit() {
    this.route.paramMap.subscribe(params => {
      this.documentId = params.get('id');
      if (this.documentId) {
        this.loadDocument(this.documentId);
      } else {
        // If it's a new document, check query params for category
        this.category = this.route.snapshot.queryParamMap.get('category') as 'work' | 'log' || 'work';
      }
    });
  }

  async loadDocument(id: string) {
    const doc = await this.contentService.getDocument(id);
    if (doc) {
      this.title = doc.title;
      this.slug = doc.slug;
      this.coverPhoto = doc.coverPhoto || '';
      this.category = doc.category;
      this.tags = doc.tags.join(', ');
      this.indexLog = doc.indexLog || '';
      // make a deep copy so drag drop doesn't mutate service state directly
      this.blocks = JSON.parse(JSON.stringify(doc.blocks));
    }
  }

  drop(event: CdkDragDrop<EditorBlock[]>) {
    moveItemInArray(this.blocks, event.previousIndex, event.currentIndex);
    this.updateIndexLogLive();
  }

  addBlock(type: 'h1' | 'h2' | 'p' | 'image' | 'code' | 'objective-header' | 'objectives' | 'divider' | 'tech-stack' | 'diagram') {
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
    }

    this.blocks.push(block);
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

  onNodeDragEnded(event: any, node: any) {
    const position = event.source.getFreeDragPosition();
    node.x = position.x;
    node.y = position.y;
  }

  removeBlock(index: number) {
    const block = this.blocks[index];
    this.blocks.splice(index, 1);
    if (block && (block.type === 'h1' || block.type === 'h2')) {
      this.updateIndexLogLive();
    }
  }

  updateIndexLogLive() {
    let headingCount = 0;
    const newIndexLogLines: string[] = [];

    for (const block of this.blocks) {
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
    for (const block of this.blocks) {
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
    const savedSlug = await this.contentService.saveDocument({
      id: this.documentId || undefined,
      slug: this.slug,
      title: this.title,
      coverPhoto: this.coverPhoto,
      category: this.category,
      tags: tagArray,
      indexLog: this.indexLog,
      blocks: this.blocks
    });

    if (!this.documentId) {
      this.router.navigate(['/admin/editor', savedSlug]);
    }

    alert('Document published successfully!');
  }

  autoResize(element: HTMLElement) {
    element.style.height = 'auto';
    element.style.height = element.scrollHeight + 'px';
  }

  preview() {
    this.formatHeadings();
    const tagArray = this.tags.split(',').map(t => t.trim()).filter(t => t.length > 0);

    // Save to the temporary preview memory
    this.contentService.setPreviewDocument({
      title: this.title,
      coverPhoto: this.coverPhoto,
      category: this.category,
      tags: tagArray,
      indexLog: this.indexLog,
      blocks: this.blocks
    });

    // Open in new tab
    const url = this.category === 'work' ? '/works/preview' : '/logs/preview';
    window.open(url, '_blank');
  }
}
