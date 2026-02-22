import { Component, inject, OnInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { ContentService, DocumentEntry } from '../../services/content.service';

@Component({
  selector: 'app-works-vault-admin',
  imports: [CommonModule, RouterModule],
  templateUrl: './works-vault.html',
  styleUrl: './works-vault.css'
})
export class WorksVaultAdmin implements OnInit {
  private contentService = inject(ContentService);
  private cdr = inject(ChangeDetectorRef);
  works: DocumentEntry[] = [];

  ngOnInit() {
    this.loadWorks();
  }

  async loadWorks() {
    this.works = await this.contentService.getAllWorks();
    this.cdr.detectChanges();
  }

  async deleteWork(id: string) {
    if (confirm('Are you sure you want to delete this work? This action cannot be undone.')) {
      await this.contentService.deleteDocument(id);
      this.loadWorks(); // Refresh the list
    }
  }
}
