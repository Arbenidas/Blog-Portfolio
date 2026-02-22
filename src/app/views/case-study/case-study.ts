import { Component, inject, OnInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, RouterModule } from '@angular/router';
import { ContentService, DocumentEntry } from '../../services/content.service';
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

  work: DocumentEntry | undefined;

  ngOnInit() {
    this.route.paramMap.subscribe(async params => {
      const slug = params.get('slug');
      if (slug) {
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
}
