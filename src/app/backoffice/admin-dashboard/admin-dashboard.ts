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
  totalUpvotes = 0;
  recentEntries: DocumentEntry[] = [];
  drafts: DocumentEntry[] = [];
  loading = true;

  // Social stats per document
  upvoteCounts: Record<string, number> = {};
  commentCounts: Record<string, number> = {};

  // Comments management
  allComments: any[] = [];
  loadingComments = true;
  replyingTo: string | null = null;
  replyText = '';
  sendingReply = false;

  // Expanded entry for inline comments
  expandedEntryId: string | null = null;
  expandedComments: any[] = [];
  loadingExpandedComments = false;

  systemTags: string[] = [];
  newTagInput = '';
  savingTags = false;

  constructor() {
    afterNextRender(() => {
      this.loadData();
    });
  }

  async loadData() {
    const [works, logs, drafts, systemTags, totalUpvotes] = await Promise.all([
      this.contentService.getAdminDocuments('work'),
      this.contentService.getAdminDocuments('log'),
      this.contentService.getDraftDocuments(),
      this.contentService.getSystemTags(),
      this.contentService.getTotalUpvotes()
    ]);

    this.worksCount = works.length;
    this.logsCount = logs.length;
    this.totalUpvotes = totalUpvotes;
    this.drafts = drafts;
    this.systemTags = systemTags;

    // Merge and sort by updatedAt descending, take latest 10
    this.recentEntries = [...works, ...logs]
      .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
      .slice(0, 10);

    // Get social stats for all entries
    const allDocIds = [...works, ...logs].map(e => e.id);
    const [upvotes, comments] = await Promise.all([
      this.contentService.getUpvoteCountsForDocuments(allDocIds),
      this.contentService.getCommentCountsForDocuments(allDocIds)
    ]);
    this.upvoteCounts = upvotes;
    this.commentCounts = comments;

    // Load recent comments
    this.allComments = await this.contentService.getAllCommentsForAdmin();
    this.loadingComments = false;

    this.loading = false;
    this.cdr.detectChanges();
  }

  async toggleExpandComments(entry: DocumentEntry) {
    if (this.expandedEntryId === entry.id) {
      this.expandedEntryId = null;
      this.expandedComments = [];
      return;
    }
    this.expandedEntryId = entry.id;
    this.loadingExpandedComments = true;
    this.cdr.detectChanges();

    this.expandedComments = await this.contentService.getComments(entry.id);
    this.loadingExpandedComments = false;
    this.cdr.detectChanges();
  }

  startReply(commentId: string) {
    this.replyingTo = this.replyingTo === commentId ? null : commentId;
    this.replyText = '';
  }

  async sendReply(comment: any) {
    if (!this.replyText.trim()) return;
    this.sendingReply = true;
    try {
      const docId = comment.document_id || comment.documents?.id;
      await this.contentService.addComment(docId, this.replyText.trim());
      this.replyText = '';
      this.replyingTo = null;

      // Refresh comments
      if (this.expandedEntryId === docId) {
        this.expandedComments = await this.contentService.getComments(docId);
      }
      this.allComments = await this.contentService.getAllCommentsForAdmin();
      // Update count
      this.commentCounts[docId] = (this.commentCounts[docId] || 0) + 1;
    } catch (e) {
      console.error('Error sending reply:', e);
    }
    this.sendingReply = false;
    this.cdr.detectChanges();
  }

  async deleteComment(commentId: string, docId: string) {
    if (!confirm('Delete this comment?')) return;
    try {
      await this.contentService.deleteComment(commentId);
      this.allComments = this.allComments.filter(c => c.id !== commentId);
      this.expandedComments = this.expandedComments.filter(c => c.id !== commentId);
      this.commentCounts[docId] = Math.max(0, (this.commentCounts[docId] || 1) - 1);
      this.cdr.detectChanges();
    } catch (e) {
      console.error('Error deleting comment:', e);
    }
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
