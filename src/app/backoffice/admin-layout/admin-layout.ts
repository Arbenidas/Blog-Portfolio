import { Component, inject, HostListener, OnInit } from '@angular/core';
import { RouterModule, Router } from '@angular/router';
import { CommonModule } from '@angular/common';
import { SupabaseService } from '../../services/supabase.service';
import { NotificationService } from '../../services/notification.service';

@Component({
  selector: 'app-admin-layout',
  imports: [RouterModule, CommonModule],
  templateUrl: './admin-layout.html',
  styleUrl: './admin-layout.css',
})
export class AdminLayout implements OnInit {
  private supabaseService = inject(SupabaseService);
  private router = inject(Router);
  public notifications = inject(NotificationService);

  isSidebarCollapsed = false;

  ngOnInit() {
    this.checkScreenSize();
  }

  @HostListener('window:resize', ['$event'])
  onResize(event: any) {
    this.checkScreenSize();
  }

  checkScreenSize() {
    // iPad Mini 6 Landscape is 1133px. Let's auto-collapse if width is <= 1133px
    if (window.innerWidth <= 1133) {
      if (!this.isSidebarCollapsed) {
        this.isSidebarCollapsed = true;
      }
    }
  }

  toggleSidebar() {
    this.isSidebarCollapsed = !this.isSidebarCollapsed;
  }

  async logout() {
    await this.supabaseService.auth.signOut();
    this.router.navigate(['/']);
  }
}
