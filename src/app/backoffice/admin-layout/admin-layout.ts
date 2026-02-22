import { Component, inject } from '@angular/core';
import { RouterModule, Router } from '@angular/router';
import { SupabaseService } from '../../services/supabase.service';

@Component({
  selector: 'app-admin-layout',
  imports: [RouterModule],
  templateUrl: './admin-layout.html',
  styleUrl: './admin-layout.css',
})
export class AdminLayout {
  private supabaseService = inject(SupabaseService);
  private router = inject(Router);

  async logout() {
    await this.supabaseService.auth.signOut();
    this.router.navigate(['/']);
  }
}
