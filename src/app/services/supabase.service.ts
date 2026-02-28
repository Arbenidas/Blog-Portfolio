import { Injectable, inject, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { createClient, SupabaseClient, User, Session } from '@supabase/supabase-js';
import { environment } from '../../environments/environment';
import { BehaviorSubject, Observable } from 'rxjs';

@Injectable({
    providedIn: 'root'
})
export class SupabaseService {
    private supabase: SupabaseClient;
    private platformId = inject(PLATFORM_ID);

    // Auth State
    private _currentUser = new BehaviorSubject<User | null>(null);

    constructor() {
        this.supabase = createClient(environment.supabaseUrl, environment.supabaseKey, {
            auth: {
                persistSession: isPlatformBrowser(this.platformId)
            }
        });

        this.setupAuthListener();
    }

    private setupAuthListener() {
        if (!isPlatformBrowser(this.platformId)) return;

        // Initialize with whatever session we might already have
        this.supabase.auth.getSession().then(({ data: { session } }) => {
            this.updateAuthState(session);
        });

        // Listen for changes
        this.supabase.auth.onAuthStateChange((_event, session) => {
            this.updateAuthState(session);
        });
    }

    private updateAuthState(session: Session | null) {
        if (session && session.user) {
            this._currentUser.next(session.user);
        } else {
            this._currentUser.next(null);
        }
    }

    get currentUser$(): Observable<User | null> {
        return this._currentUser.asObservable();
    }

    get currentUserVal(): User | null {
        return this._currentUser.value;
    }

    async signOut() {
        const { error } = await this.supabase.auth.signOut();
        if (error) {
            console.error('Error signing out:', error);
            throw error;
        }
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
