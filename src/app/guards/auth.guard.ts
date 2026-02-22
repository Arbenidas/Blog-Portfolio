import { Injectable, inject } from '@angular/core';
import { CanActivate, Router, UrlTree } from '@angular/router';
import { SupabaseService } from '../services/supabase.service';

@Injectable({
    providedIn: 'root'
})
export class AuthGuard implements CanActivate {
    private supabaseService = inject(SupabaseService);
    private router = inject(Router);

    async canActivate(): Promise<boolean | UrlTree> {
        const { data: { session } } = await this.supabaseService.auth.getSession();

        if (session) {
            return true;
        }

        return this.router.parseUrl('/admin/login');
    }
}
