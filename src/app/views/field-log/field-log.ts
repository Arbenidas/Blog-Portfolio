import { Component, inject, OnInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, RouterModule } from '@angular/router';
import { ContentService, DocumentEntry } from '../../services/content.service';
import { SeoService } from '../../services/seo.service';

@Component({
  selector: 'app-field-log',
  imports: [CommonModule, RouterModule],
  templateUrl: './field-log.html',
  styleUrl: './field-log.css',
})
export class FieldLog implements OnInit {
  private contentService = inject(ContentService);
  private seoService = inject(SeoService);
  private route = inject(ActivatedRoute);
  private cdr = inject(ChangeDetectorRef);

  log: DocumentEntry | undefined;

  ngOnInit() {
    this.route.paramMap.subscribe(async params => {
      const slug = params.get('slug');
      if (slug) {
        this.log = await this.contentService.getDocument(slug);
        if (this.log) {
          this.seoService.updateMetaTags({
            title: this.log.title,
            description: this.log.blocks.find(b => b.type === 'p')?.content || `Field log: ${this.log.title}`,
            image: this.log.coverPhoto,
            type: 'article'
          });
        }
        this.cdr.detectChanges();
      }
    });
  }
}
