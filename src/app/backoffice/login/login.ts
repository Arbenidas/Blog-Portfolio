import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { SupabaseService } from '../../services/supabase.service';

@Component({
    selector: 'app-login',
    standalone: true,
    imports: [CommonModule, FormsModule],
    templateUrl: './login.html',
    styleUrl: './login.css'
})
export class Login {
    private supabaseService = inject(SupabaseService);
    private router = inject(Router);

    email = '';
    password = '';
    loading = false;
    errorMsg = '';

    async signIn() {
        try {
            this.loading = true;
            this.errorMsg = '';
            const { error } = await this.supabaseService.auth.signInWithPassword({
                email: this.email,
                password: this.password,
            });

            if (error) {
                this.errorMsg = error.message;
            } else {
                this.router.navigate(['/admin']);
            }
        } catch (e: any) {
            this.errorMsg = e.message;
        } finally {
            this.loading = false;
        }
    }
}
