import { Component, signal, inject } from '@angular/core';
import { UpperCasePipe } from '@angular/common';
import { RouterModule, RouterOutlet } from '@angular/router';
import { TranslateModule } from '@ngx-translate/core';
import { LanguageService } from '../../services/language/language.service';
import { routeAnimations } from './route-animations';

@Component({
  selector: 'app-public-layout',
  imports: [RouterModule, TranslateModule, UpperCasePipe],
  templateUrl: './public-layout.html',
  styleUrl: './public-layout.css',
  animations: [routeAnimations]
})
export class PublicLayout {
  protected languageService = inject(LanguageService);
  animationState = signal<string>('Home');

  prepareRoute(outlet: RouterOutlet) {
    if (outlet.isActivated) {
      this.animationState.set(outlet.activatedRouteData['animation']);
    }
  }
}
