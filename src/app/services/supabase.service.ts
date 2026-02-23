import { Injectable, inject, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { createClient, SupabaseClient, User } from '@supabase/supabase-js';
import { environment } from '../../environments/environment';

@Injectable({
    providedIn: 'root'
})
export class SupabaseService {
    private supabase: SupabaseClient;
    private platformId = inject(PLATFORM_ID);

    constructor() {
        this.supabase = createClient(environment.supabaseUrl, environment.supabaseKey, {
            auth: {
                persistSession: isPlatformBrowser(this.platformId)
            }
        });
    }

    get auth() {
        return this.supabase.auth;
    }

    get from() {
        return this.supabase.from.bind(this.supabase);
    }

    get client() {
        return this.supabase;
    }
}
