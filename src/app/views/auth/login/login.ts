import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterModule } from '@angular/router';
import { SupabaseService } from '../../../services/supabase.service';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule],
  templateUrl: './login.html',
  styleUrl: './login.css'
})
export class Login {
  private supabaseService = inject(SupabaseService);
  private router = inject(Router);

  email = signal('');
  password = signal('');
  errorMsg = signal('');
  isLoading = signal(false);

  async onLogin() {
    this.errorMsg.set('');

    if (!this.email() || !this.password()) {
      this.errorMsg.set('PLEASE_INPUT_CREDENTIALS');
      return;
    }

    this.isLoading.set(true);

    try {
      const { error } = await this.supabaseService.auth.signInWithPassword({
        email: this.email(),
        password: this.password()
      });

      if (error) throw error;

      // Navigate to home or dashboard on success
      this.router.navigate(['/']);
    } catch (err: any) {
      console.error('Login error:', err);
      this.errorMsg.set(err.message || 'AUTH_VALIDATION_FAILED');
    } finally {
      this.isLoading.set(false);
    }
  }
}
