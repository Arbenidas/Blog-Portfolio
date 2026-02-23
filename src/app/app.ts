import { Component, signal, inject, OnInit } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { AnalyticsService } from './services/analytics.service';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet],
  templateUrl: './app.html',
  styleUrl: './app.css'
})
export class App implements OnInit {
  private analytics = inject(AnalyticsService);
  protected readonly title = signal('portfolio');

  ngOnInit() {
    this.analytics.initRouteTracking();
  }
}
