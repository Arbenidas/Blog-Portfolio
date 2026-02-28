import { Injectable, inject, signal, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { SupabaseService } from './supabase.service';

export interface AppNotification {
    id: string; // The ID of the like or comment
    type: 'like' | 'comment';
    document_id: string;
    user_id: string;
    created_at: string;
    content?: string;
    is_read: boolean; // Computed virtually based on Last Checked Time
}

@Injectable({
    providedIn: 'root'
})
export class NotificationService {
    private supabase = inject(SupabaseService);
    private platformId = inject(PLATFORM_ID);

    private readonly LAST_CHECKED_KEY = 'arbe_notifications_last_checked';

    // State
    unreadCount = signal<number>(0);
    notifications = signal<AppNotification[]>([]);

    constructor() {
        if (isPlatformBrowser(this.platformId)) {
            this.supabase.currentUser$.subscribe(user => {
                if (user) {
                    this.fetchNotifications(user.id);
                } else {
                    // Reset
                    this.unreadCount.set(0);
                    this.notifications.set([]);
                }
            });
        }
    }

    /**
     * Fetch recent comments and likes on the user's published documents.
     * Compare 'created_at' against the last time the user cleared notifications.
     */
    async fetchNotifications(userId: string) {
        if (!isPlatformBrowser(this.platformId)) return;

        try {
            // Get all published docs for this user
            const { data: docs } = await this.supabase.from('documents')
                .select('id')
                .eq('author_id', userId)
                .eq('status', 'published');

            if (!docs || docs.length === 0) return;

            const docIds = docs.map(d => d.id);

            let allInteractions: AppNotification[] = [];

            // Fetch Likes
            const { data: likes } = await this.supabase.from('upvotes')
                .select('id, document_id, created_at, user_id')
                .in('document_id', docIds)
                .neq('user_id', userId) // Don't notify for their own likes
                .order('created_at', { ascending: false })
                .limit(20);

            if (likes) {
                likes.forEach(l => allInteractions.push({ ...l, type: 'like', is_read: false }));
            }

            // Fetch Comments
            const { data: comments } = await this.supabase.from('comments')
                .select('id, document_id, created_at, user_id, content')
                .in('document_id', docIds)
                .neq('user_id', userId) // Don't notify for their own comments
                .order('created_at', { ascending: false })
                .limit(20);

            if (comments) {
                comments.forEach(c => allInteractions.push({ ...c, type: 'comment', is_read: false }));
            }

            // Sort combined
            allInteractions.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

            // Limit to max 30 to prevent huge memory
            allInteractions = allInteractions.slice(0, 30);

            this.notifications.set(allInteractions);
            this.calculateUnread();

        } catch (e) {
            console.error('Error fetching notifications API:', e);
        }
    }

    private calculateUnread() {
        if (!isPlatformBrowser(this.platformId)) return;

        const lastCheckedStr = localStorage.getItem(this.LAST_CHECKED_KEY);
        let lastCheckedTime = 0;

        if (lastCheckedStr) {
            lastCheckedTime = new Date(lastCheckedStr).getTime();
        }

        let count = 0;
        const currentList = this.notifications();

        const updatedList = currentList.map(notif => {
            const itemTime = new Date(notif.created_at).getTime();
            const isUnread = itemTime > lastCheckedTime;
            if (isUnread) count++;

            return { ...notif, is_read: !isUnread };
        });

        this.notifications.set(updatedList);
        this.unreadCount.set(count);
    }

    /**
     * Call this when the user opens the notification panel or Author Hub
     * to mark everything up to "right now" as read.
     */
    markAllAsRead() {
        if (!isPlatformBrowser(this.platformId)) return;

        const now = new Date().toISOString();
        localStorage.setItem(this.LAST_CHECKED_KEY, now);
        this.calculateUnread();
    }
}
