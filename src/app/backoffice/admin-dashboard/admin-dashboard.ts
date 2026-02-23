import { Component, inject, afterNextRender, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { ContentService, DocumentEntry } from '../../services/content.service';

@Component({
  selector: 'app-admin-dashboard',
  imports: [CommonModule, RouterModule, FormsModule],
  templateUrl: './admin-dashboard.html',
  styleUrl: './admin-dashboard.css',
})
export class AdminDashboard {
  private contentService = inject(ContentService);
  private cdr = inject(ChangeDetectorRef);

  worksCount = 0;
  logsCount = 0;
  recentEntries: DocumentEntry[] = [];
  loading = true;

  systemTags: string[] = [];
  newTagInput = '';
  savingTags = false;

  constructor() {
    afterNextRender(() => {
      this.loadData();
    });
  }

  async loadData() {
    const [works, logs, systemTags] = await Promise.all([
      this.contentService.getAllWorks(),
      this.contentService.getAllLogs(),
      this.contentService.getSystemTags()
    ]);

    this.worksCount = works.length;
    this.logsCount = logs.length;
    this.systemTags = systemTags;

    // Merge and sort by updatedAt descending, take latest 6
    this.recentEntries = [...works, ...logs]
      .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
      .slice(0, 6);

    this.loading = false;
    this.cdr.detectChanges();
  }

  async addTag() {
    const t = this.newTagInput.trim();
    if (!t || this.systemTags.includes(t)) {
      this.newTagInput = '';
      return;
    }

    this.savingTags = true;
    this.systemTags.push(t);
    await this.contentService.saveSystemTags(this.systemTags);
    this.newTagInput = '';
    this.savingTags = false;
    this.cdr.detectChanges();
  }

  async removeTag(tag: string) {
    if (!confirm(`Remove tag "${tag}" from the system dictionary?`)) return;
    this.savingTags = true;
    this.systemTags = this.systemTags.filter(t => t !== tag);
    await this.contentService.saveSystemTags(this.systemTags);
    this.savingTags = false;
    this.cdr.detectChanges();
  }

  async deleteEntry(entry: DocumentEntry) {
    if (!confirm(`Delete "${entry.title}"? This cannot be undone.`)) return;
    await this.contentService.deleteDocument(entry.id);
    this.recentEntries = this.recentEntries.filter(e => e.id !== entry.id);
    if (entry.category === 'work') this.worksCount--;
    else this.logsCount--;
  }

  timeAgo(dateStr: string): string {
    const now = Date.now();
    const then = new Date(dateStr).getTime();
    const diffMs = now - then;
    const mins = Math.floor(diffMs / 60000);
    if (mins < 1) return 'just now';
    if (mins < 60) return `${mins} min ago`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    if (days < 30) return `${days}d ago`;
    const months = Math.floor(days / 30);
    return `${months}mo ago`;
  }
}
