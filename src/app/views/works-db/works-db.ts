import { Component, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { ContentService, DocumentEntry } from '../../services/content.service';

@Component({
  selector: 'app-works-db',
  imports: [CommonModule, RouterModule],
  templateUrl: './works-db.html',
  styleUrl: './works-db.css',
})
export class WorksDb implements OnInit {
  private contentService = inject(ContentService);
  works: DocumentEntry[] = [];

  async ngOnInit() {
    this.works = await this.contentService.getAllWorks();
  }
}

