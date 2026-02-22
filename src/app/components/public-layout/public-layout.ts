import { Component, inject } from '@angular/core';
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
  getRouteAnimationData(outlet: RouterOutlet) {
    return outlet && outlet.activatedRouteData && outlet.activatedRouteData['animation'];
  }
}
