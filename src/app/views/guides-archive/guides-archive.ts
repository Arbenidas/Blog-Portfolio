import { Component, inject, OnInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { ContentService, DocumentEntry } from '../../services/content.service';
import { SeoService } from '../../services/seo.service';

@Component({
  selector: 'app-guides-archive',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './guides-archive.html',
  styleUrl: './guides-archive.css',
})
export class GuidesArchive implements OnInit {
  private contentService = inject(ContentService);
  private seoService = inject(SeoService);
  private cdr = inject(ChangeDetectorRef);

  guides: DocumentEntry[] = [];
  isLoading = true;

  async ngOnInit() {
    this.seoService.updateMetaTags({
      title: 'Field Guides',
      description: 'In-depth guides and tutorials by the Arbe Workshop community.',
      type: 'website'
    });

    this.isLoading = true;
    this.guides = await this.contentService.getAllGuides();
    this.isLoading = false;
    this.cdr.detectChanges();
  }
}
