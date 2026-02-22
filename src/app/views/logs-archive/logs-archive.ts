import { Component, inject, OnInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { ContentService, DocumentEntry } from '../../services/content.service';
import { SeoService } from '../../services/seo.service';

@Component({
  selector: 'app-logs-archive',
  imports: [CommonModule, RouterModule],
  templateUrl: './logs-archive.html',
  styleUrl: './logs-archive.css',
})
export class LogsArchive implements OnInit {
  private contentService = inject(ContentService);
  private seoService = inject(SeoService);
  private cdr = inject(ChangeDetectorRef);
  logs: DocumentEntry[] = [];

  async ngOnInit() {
    this.seoService.updateMetaTags({
      title: 'Mission Logs',
      description: 'Field notes, thoughts, and technical logs written by Arbe on software engineering.',
      type: 'website'
    });
    this.logs = await this.contentService.getAllLogs();
    this.cdr.detectChanges();
  }
}
