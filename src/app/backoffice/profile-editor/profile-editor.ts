import { Component, inject, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
import { ContentService, ProfileData, CustomWidget } from '../../services/content.service';

@Component({
  selector: 'app-profile-editor',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './profile-editor.html',
  styleUrl: './profile-editor.css'
})
export class ProfileEditor implements OnInit {
  private contentService = inject(ContentService);
  private sanitizer = inject(DomSanitizer);

  // Raw widgets available from DB
  availableWidgets = signal<CustomWidget[]>([]);

  // Default fallback profile structure
  profile = signal<ProfileData>({
    name: 'Arbe [REDACTED]',
    role: 'Full Stack Operative',
    location: 'Sector 7 (Remote)',
    clearance: 'Top Level / Admin',
    status: 'Active Duty',
    coreMission: 'To engineer digital ecosystems that merge Industrial reliability with futuristic interactivity.',
    experience: [
      { role: 'Senior Engineer', company: 'CyberDyne Systems', location: 'San Francisco, CA', years: '2021 - Present', description: 'Spearheading the development of neural network interfaces.' }
    ],
    languages: ['JavaScript (ES6+)', 'TypeScript', 'Python'],
    frameworks: ['Angular', 'Next.js', 'Node.js'],
    widgets: []
  });

  isSaving = signal(false);
  draggingWidget = signal<CustomWidget | null>(null);

  ngOnInit() {
    this.loadData();
  }

  async loadData() {
    // 1. Fetch available custom widgets
    const widgets = await this.contentService.getCustomWidgets();
    this.availableWidgets.set(widgets);

    // 2. Fetch profile data
    const p = await this.contentService.getProfile();
    if (p) {
      this.profile.set(p);
    }
  }

  // Helper arrays for strings
  get languagesStr() { return this.profile().languages.join(', '); }
  set languagesStr(val: string) {
    this.profile.update(p => ({ ...p, languages: val.split(',').map(s => s.trim()).filter(Boolean) }));
  }

  get frameworksStr() { return this.profile().frameworks.join(', '); }
  set frameworksStr(val: string) {
    this.profile.update(p => ({ ...p, frameworks: val.split(',').map(s => s.trim()).filter(Boolean) }));
  }

  addExperience() {
    this.profile.update(p => ({
      ...p,
      experience: [...p.experience, { role: 'New Role', company: 'Company', location: 'City', years: 'Year', description: '' }]
    }));
  }

  removeExperience(index: number) {
    this.profile.update(p => {
      const arr = [...p.experience];
      arr.splice(index, 1);
      return { ...p, experience: arr };
    });
  }

  // Widget Drag & Drop
  onDragStart(event: DragEvent, widget: CustomWidget) {
    this.draggingWidget.set(widget);
    if (event.dataTransfer) {
      event.dataTransfer.effectAllowed = 'copy';
      // Required for Firefox
      event.dataTransfer.setData('text/plain', widget.id || '');
    }
  }

  onDragOver(event: DragEvent) {
    event.preventDefault(); // allow drop
    if (event.dataTransfer) {
      event.dataTransfer.dropEffect = 'copy';
    }
  }

  onDrop(event: DragEvent) {
    event.preventDefault();
    const widget = this.draggingWidget();
    if (!widget || !widget.id) return;

    // Get position relative to the preview container
    const rect = (event.currentTarget as HTMLElement).getBoundingClientRect();
    const x = event.clientX - rect.left - 50; // Offset by ~half widget width
    const y = event.clientY - rect.top - 50;  // Offset by ~half widget height

    this.profile.update(p => ({
      ...p,
      widgets: [...p.widgets, { widgetId: widget.id!, x, y }]
    }));

    this.draggingWidget.set(null);
  }

  removePlacedWidget(index: number) {
    this.profile.update(p => {
      const arr = [...p.widgets];
      arr.splice(index, 1);
      return { ...p, widgets: arr };
    });
  }

  // Template helpers
  getWidgetHtml(id: string): SafeHtml {
    const w = this.availableWidgets().find(w => w.id === id);
    return w ? this.sanitizer.bypassSecurityTrustHtml(w.html_content) : '';
  }

  getSafeHtml(html: string): SafeHtml {
    return this.sanitizer.bypassSecurityTrustHtml(html);
  }

  async save() {
    this.isSaving.set(true);
    try {
      await this.contentService.saveProfile(this.profile());
      alert('Personnel File saved! (It is now live on the public site)');
    } catch (e) {
      console.error(e);
      alert('Error saving profile');
    } finally {
      this.isSaving.set(false);
    }
  }
}
