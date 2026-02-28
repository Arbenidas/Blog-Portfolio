import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, RouterModule, Router } from '@angular/router';
import { SupabaseService } from '../../services/supabase.service';
import { ContentService, ProfileData } from '../../services/content.service';
import { ChangeDetectorRef } from '@angular/core';

@Component({
  selector: 'app-user-profile',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './user-profile.html',
  styleUrl: './user-profile.css'
})
export class UserProfile implements OnInit {
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private supabaseService = inject(SupabaseService);
  private contentService = inject(ContentService);
  private cdr = inject(ChangeDetectorRef);

  username = signal<string | null>(null);
  profileData = signal<ProfileData | null>(null);
  userWorks = signal<any[]>([]);
  userLogs = signal<any[]>([]);
  isLoading = signal<boolean>(true);
  errorMsg = signal<string | null>(null);

  isOwnProfile = signal<boolean>(false);
  activeTab = signal<'logs' | 'works'>('logs');

  ngOnInit() {
    this.route.paramMap.subscribe(params => {
      const uname = params.get('username');
      if (uname) {
        this.username.set(uname);
        this.fetchProfile(uname);
      } else {
        this.router.navigate(['/']);
      }
    });

    // Check if the viewed profile belongs to the currently logged in user
    this.supabaseService.currentUser$.subscribe(user => {
      this.checkOwnership(user);
    });
  }

  async fetchProfile(uname: string) {
    this.isLoading.set(true);
    this.errorMsg.set(null);

    try {
      let identifier: string | undefined = undefined;
      let useUsername = false;

      if (uname === 'me') {
        let currentUser = this.supabaseService.currentUserVal;
        if (!currentUser) {
          const { data: { session } } = await this.supabaseService.auth.getSession();
          currentUser = session?.user || null;
        }
        if (!currentUser) {
          this.errorMsg.set('You must be logged in to view your profile.');
          this.isLoading.set(false);
          return;
        }
        identifier = currentUser.id;
        useUsername = false;
      } else {
        identifier = uname;
        useUsername = true;
      }

      const data = await this.contentService.getProfile(identifier, useUsername);

      if (!data) {
        if (uname === 'me') {
          this.router.navigate(['/admin/profile']);
          return;
        }
        this.errorMsg.set(`User '${uname}' not found.`);
      } else {
        this.profileData.set(data);
        this.checkOwnership(this.supabaseService.currentUserVal);

        // Fetch user's documents
        if (data && (data as any).id) {
          const { data: docs, error: docError } = await this.supabaseService.from('documents')
            .select('slug, title, category, created_at, status')
            .eq('author_id', (data as any).id)
            .eq('status', 'published')
            .order('created_at', { ascending: false });

          if (!docError && docs) {
            this.userWorks.set(docs.filter(d => d.category === 'work'));
            this.userLogs.set(docs.filter(d => d.category === 'log'));
          }
        }
      }
    } catch (err: any) {
      console.error('Error fetching profile:', err);
      this.errorMsg.set('Failed to load profile.');
    } finally {
      this.isLoading.set(false);
      this.cdr.detectChanges();
    }
  }

  checkOwnership(user: any) {
    const profile = this.profileData();
    if (user && profile && user.id === profile.id) {
      this.isOwnProfile.set(true);
    } else {
      this.isOwnProfile.set(false);
    }
  }

  getAvatarInitials(): string {
    const p = this.profileData();
    if (!p) return '?';

    if (p.name) {
      const names = p.name.split(' ');
      if (names.length >= 2) {
        return (names[0][0] + names[1][0]).toUpperCase();
      }
      return p.name.substring(0, 2).toUpperCase();
    }

    if (p.username) {
      return p.username.substring(0, 2).toUpperCase();
    }

    return 'U';
  }
}
