import { Component, signal, inject } from '@angular/core';
import { UpperCasePipe } from '@angular/common';
import { RouterModule, RouterOutlet, Router } from '@angular/router';
import { TranslateModule } from '@ngx-translate/core';
import { CommonModule } from '@angular/common';
import { LanguageService } from '../../services/language/language.service';
import { SupabaseService } from '../../services/supabase.service';
import { SiteFooter } from '../site-footer/site-footer';
import { routeAnimations } from './route-animations';
import { NotificationService } from '../../services/notification.service';

@Component({
  selector: 'app-public-layout',
  standalone: true,
  imports: [CommonModule, RouterModule, TranslateModule, UpperCasePipe, SiteFooter],
  templateUrl: './public-layout.html',
  styleUrl: './public-layout.css',
  animations: [routeAnimations]
})
export class PublicLayout {
  protected languageService = inject(LanguageService);
  protected supabaseService = inject(SupabaseService);
  protected router = inject(Router);
  public notifications = inject(NotificationService);

  animationState = signal<string>('Home');

  currentUser = this.supabaseService.currentUser$;

  prepareRoute(outlet: RouterOutlet) {
    if (outlet.isActivated) {
      this.animationState.set(outlet.activatedRouteData['animation']);
    }
  }

  async logout() {
    try {
      await this.supabaseService.signOut();
      this.router.navigate(['/']);
    } catch (err) {
      console.error('Logout error', err);
    }
  }
}

