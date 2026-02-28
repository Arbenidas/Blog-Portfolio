import { Component, inject, OnInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { ContentService, DocumentEntry } from '../../services/content.service';

@Component({
  selector: 'app-guides-archive-admin',
  imports: [CommonModule, RouterModule],
  templateUrl: './guides-archive.html',
  styleUrl: './guides-archive.css'
})
export class GuidesArchiveAdmin implements OnInit {
  private contentService = inject(ContentService);
  private cdr = inject(ChangeDetectorRef);
  guides: DocumentEntry[] = [];
  isLoading = true;

  ngOnInit() {
    this.loadGuides();
  }

  async loadGuides() {
    this.isLoading = true;
    this.guides = await this.contentService.getAdminDocuments('guide');
    this.isLoading = false;
    this.cdr.detectChanges();
  }

  async deleteGuide(id: string) {
    if (confirm('Are you sure you want to delete this guide? This action cannot be undone.')) {
      await this.contentService.deleteDocument(id);
      this.loadGuides(); // Refresh the list
    }
  }
}
