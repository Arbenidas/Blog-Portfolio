import { Component, inject, OnInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { ContentService, DocumentEntry } from '../../services/content.service';
import { SeoService } from '../../services/seo.service';

@Component({
  selector: 'app-works-db',
  imports: [CommonModule, RouterModule],
  templateUrl: './works-db.html',
  styleUrl: './works-db.css',
})
export class WorksDb implements OnInit {
  private contentService = inject(ContentService);
  private seoService = inject(SeoService);
  private cdr = inject(ChangeDetectorRef);
  works: DocumentEntry[] = [];

  async ngOnInit() {
    this.seoService.updateMetaTags({
      title: 'Works Database',
      description: 'Archive of engineering projects, case studies, and digital experiments by Arbe.',
      type: 'website'
    });
    this.works = await this.contentService.getAllWorks();
    this.cdr.detectChanges();
  }
}

