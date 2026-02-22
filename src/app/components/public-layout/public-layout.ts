import { Component, signal } from '@angular/core';
import { RouterModule, RouterOutlet } from '@angular/router';
import { routeAnimations } from './route-animations';

@Component({
  selector: 'app-public-layout',
  imports: [RouterModule],
  templateUrl: './public-layout.html',
  styleUrl: './public-layout.css',
  animations: [routeAnimations]
})
export class PublicLayout {
  animationState = signal<string>('Home');

  prepareRoute(outlet: RouterOutlet) {
    if (outlet.isActivated) {
      this.animationState.set(outlet.activatedRouteData['animation']);
    }
  }
}
