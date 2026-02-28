import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterModule } from '@angular/router';
import { SupabaseService } from '../../../services/supabase.service';

@Component({
  selector: 'app-register',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule],
  templateUrl: './register.html',
  styleUrl: './register.css'
})
export class Register {
  private supabaseService = inject(SupabaseService);
  private router = inject(Router);

  email = signal('');
  password = signal('');
  fullName = signal('');
  errorMsg = signal('');
  successMsg = signal('');
  isLoading = signal(false);

  async onRegister() {
    this.errorMsg.set('');
    this.successMsg.set('');

    if (!this.email() || !this.password() || !this.fullName()) {
      this.errorMsg.set('PLEASE_COMPLETE_ALL_FIELDS');
      return;
    }

    if (this.password().length < 6) {
      this.errorMsg.set('ACCESS_CODE_TOO_SHORT (Min 6)');
      return;
    }

    this.isLoading.set(true);

    try {
      const { data, error } = await this.supabaseService.auth.signUp({
        email: this.email(),
        password: this.password(),
        options: {
          data: {
            full_name: this.fullName(),
          }
        }
      });

      if (error) throw error;

      if (data.user && data.session === null) {
        // Email confirmation required by Supabase settings
        this.successMsg.set('VERIFICATION_REQUIRED. PLEASE_CHECK_COMM_CHANNELS (Email)');
      } else {
        // Auto logged in or no confirmation required
        this.router.navigate(['/']);
      }

    } catch (err: any) {
      console.error('Registration error:', err);
      this.errorMsg.set(err.message || 'REGISTRATION_FAILED');
    } finally {
      this.isLoading.set(false);
    }
  }
}
