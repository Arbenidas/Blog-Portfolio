import { Component, inject, OnInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { ContentService, DocumentEntry } from '../../services/content.service';

@Component({
  selector: 'app-logs-archive-admin',
  imports: [CommonModule, RouterModule],
  templateUrl: './logs-archive.html',
  styleUrl: './logs-archive.css'
})
export class LogsArchiveAdmin implements OnInit {
  private contentService = inject(ContentService);
  private cdr = inject(ChangeDetectorRef);
  logs: DocumentEntry[] = [];

  ngOnInit() {
    this.loadLogs();
  }

  async loadLogs() {
    this.logs = await this.contentService.getAllLogs();
    this.cdr.detectChanges();
  }

  async deleteLog(id: string) {
    if (confirm('Are you sure you want to delete this log? This action cannot be undone.')) {
      await this.contentService.deleteDocument(id);
      this.loadLogs(); // Refresh the list
    }
  }
}
