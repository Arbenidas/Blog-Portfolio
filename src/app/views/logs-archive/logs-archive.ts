import { Component, inject, OnInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { ContentService, DocumentEntry } from '../../services/content.service';
import { SeoService } from '../../services/seo.service';

@Component({
  selector: 'app-logs-archive',
  imports: [CommonModule, RouterModule],
  templateUrl: './logs-archive.html',
  styleUrl: './logs-archive.css',
})
export class LogsArchive implements OnInit {
  private contentService = inject(ContentService);
  private seoService = inject(SeoService);
  private cdr = inject(ChangeDetectorRef);

  logs: DocumentEntry[] = [];
  isLoading = true;

  popularTags: { name: string, class: string }[] = [];
  chartData: { month: string, height: number, cx: number, cy: number }[] = [];
  chartPath = '';

  async ngOnInit() {
    this.seoService.updateMetaTags({
      title: 'Mission Logs',
      description: 'Field notes, thoughts, and technical logs written by Arbe on software engineering.',
      type: 'website'
    });

    this.isLoading = true;
    this.logs = await this.contentService.getAllLogs();

    this.generateTopicMatrix();
    this.generateChartData();

    this.isLoading = false;
    this.cdr.detectChanges();
  }

  generateTopicMatrix() {
    const tagClasses = [
      'tag-item-primary tag-item-rotate-neg',
      'tag-item-cream tag-item-rotate-pos',
      'tag-item-orange',
      'tag-item-cream tag-item-rotate-neg',
      'tag-item-cream'
    ];

    const counts: Record<string, number> = {};
    for (const log of this.logs) {
      for (const t of log.tags) {
        const u = t.toUpperCase();
        counts[u] = (counts[u] || 0) + 1;
      }
    }

    this.popularTags = Object.keys(counts)
      .sort((a, b) => counts[b] - counts[a])
      .slice(0, 5)
      .map((name, index) => ({
        name: `#${name}`,
        class: tagClasses[index % tagClasses.length]
      }));
  }

  generateChartData() {
    const months = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];
    const now = new Date();
    const baseCount = this.logs.length;

    // Create somewhat dynamic heights and map them to SVG coordinates. 
    // Heights are out of 100%. SVG viewBox is 100x100. Y is inverted (100 - height)
    const h1 = 20 + (baseCount % 15);
    const h2 = 40 + (baseCount % 25);
    const h3 = 70 + (baseCount % 10);
    const h4 = 50 + (baseCount % 35);

    this.chartData = [
      { month: months[(now.getMonth() - 3 + 12) % 12], height: h1, cx: 12.5, cy: 100 - h1 },
      { month: months[(now.getMonth() - 2 + 12) % 12], height: h2, cx: 37.5, cy: 100 - h2 },
      { month: months[(now.getMonth() - 1 + 12) % 12], height: h3, cx: 62.5, cy: 100 - h3 },
      { month: months[now.getMonth()], height: h4, cx: 87.5, cy: 100 - h4 }
    ];

    // Smooth curve through the 4 points
    const p = this.chartData;
    this.chartPath = `M0,${p[0].cy + 10} Q${p[0].cx},${p[0].cy} ${p[1].cx},${p[1].cy} T${p[2].cx},${p[2].cy} T${p[3].cx},${p[3].cy} Q100,${p[3].cy} 100,${p[3].cy + 10}`;
  }
}
