import { Component, inject, OnInit } from '@angular/core';
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
  logs: DocumentEntry[] = [];

  ngOnInit() {
    this.loadLogs();
  }

  async loadLogs() {
    this.logs = await this.contentService.getAllLogs();
  }

  async deleteLog(id: string) {
    if (confirm('Are you sure you want to delete this log? This action cannot be undone.')) {
      await this.contentService.deleteDocument(id);
      this.loadLogs(); // Refresh the list
    }
  }
}
