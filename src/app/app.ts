import { Component, signal, inject, OnInit } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { AnalyticsService } from './services/analytics.service';
import { LanguageService } from './services/language/language.service';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet],
  templateUrl: './app.html',
  styleUrl: './app.css'
})
export class App implements OnInit {
  private analytics = inject(AnalyticsService);
  private languageService = inject(LanguageService);
  protected readonly title = signal('portfolio');

  ngOnInit() {
    this.analytics.initRouteTracking();
  }
}
