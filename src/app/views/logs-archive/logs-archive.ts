import { Component, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { ContentService, DocumentEntry } from '../../services/content.service';

@Component({
  selector: 'app-logs-archive',
  imports: [CommonModule, RouterModule],
  templateUrl: './logs-archive.html',
  styleUrl: './logs-archive.css',
})
export class LogsArchive implements OnInit {
  private contentService = inject(ContentService);
  logs: DocumentEntry[] = [];

  async ngOnInit() {
    this.logs = await this.contentService.getAllLogs();
  }
}
