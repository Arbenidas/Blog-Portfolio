import { Component, OnInit, inject, PLATFORM_ID, ChangeDetectorRef } from '@angular/core';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { RouterModule } from '@angular/router';
import { SupabaseService } from '../../services/supabase.service';
import { NotificationService } from '../../services/notification.service';

interface InteractionMetric {
  id: number;
  collectionId: string;
  type: 'like' | 'comment';
  created_at: string;
  user_id: string;
  content?: string;
}

@Component({
  selector: 'app-author-dashboard',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './author-dashboard.html',
  styleUrl: './author-dashboard.css'
})
export class AuthorDashboard implements OnInit {
  private supabase = inject(SupabaseService);
  private cdr = inject(ChangeDetectorRef);
  private platformId = inject(PLATFORM_ID);
  private notifications = inject(NotificationService);

  isLoading = true;
  totalWorks = 0;
  totalLogs = 0;
  totalGuides = 0;
  totalLikes = 0;
  totalComments = 0;

  publishedDocs: any[] = [];
  recentInteractions: InteractionMetric[] = [];

  async ngOnInit() {
    if (!isPlatformBrowser(this.platformId)) return;

    try {
      const { data: { session } } = await this.supabase.auth.getSession();
      if (!session) return;

      this.notifications.markAllAsRead();

      const userId = session.user.id;

      // 1. Fetch user's documents
      const { data: docs, error: docError } = await this.supabase.from('documents')
        .select('id, title, category, slug, status, created_at')
        .eq('author_id', userId)
        .order('created_at', { ascending: false });

      if (docError) throw docError;

      if (docs) {
        this.publishedDocs = docs;
        this.totalWorks = docs.filter(d => d.category === 'work').length;
        this.totalLogs = docs.filter(d => d.category === 'log').length;
        this.totalGuides = docs.filter(d => d.category === 'guide').length;

        const publishedDocIds = docs.filter(d => d.status === 'published').map(d => d.id);

        if (publishedDocIds.length > 0) {
          // 2. Aggregate Likes
          const { data: likes, error: likesError } = await this.supabase.from('upvotes')
            .select('id, document_id, created_at, user_id')
            .in('document_id', publishedDocIds);

          if (!likesError && likes) {
            this.totalLikes = likes.length;
            likes.forEach(like => {
              this.recentInteractions.push({
                id: like.id,
                collectionId: like.document_id,
                type: 'like',
                created_at: like.created_at,
                user_id: like.user_id
              });
            });
          }

          // 3. Aggregate Comments
          const { data: comments, error: commentsError } = await this.supabase.from('comments')
            .select('id, document_id, content, created_at, user_id')
            .in('document_id', publishedDocIds);

          if (!commentsError && comments) {
            this.totalComments = comments.length;
            comments.forEach(comment => {
              this.recentInteractions.push({
                id: comment.id,
                collectionId: comment.document_id,
                type: 'comment',
                created_at: comment.created_at,
                user_id: comment.user_id,
                content: comment.content
              });
            });
          }

          // Sort interactions by newest first
          this.recentInteractions.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
        }
      }
    } catch (e) {
      console.error('Error fetching author metrics:', e);
    } finally {
      this.isLoading = false;
      this.cdr.detectChanges();
    }
  }

  getDocumentTitle(collectionId: string): string {
    const doc = this.publishedDocs.find(d => d.id === collectionId);
    return doc ? doc.title : 'Unknown Document';
  }

  getFrontendLink(category: string, slug: string): string {
    switch (category) {
      case 'work': return `/works/${slug}`;
      case 'log': return `/logs/${slug}`;
      case 'guide': return `/guides/${slug}`;
      default: return '/';
    }
  }
}
