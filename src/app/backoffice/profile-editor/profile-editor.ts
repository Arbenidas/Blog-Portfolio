import { Component, inject, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
import { ContentService, ProfileData, TechEntry, CustomWidget } from '../../services/content.service';

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
    languages: [
      { name: 'JavaScript (ES6+)' },
      { name: 'TypeScript' },
      { name: 'Python' }
    ],
    frameworks: [
      { name: 'Angular' },
      { name: 'Next.js' },
      { name: 'Node.js' }
    ],
    technologies: [
      { name: 'Docker' },
      { name: 'Git' }
    ],
    widgets: []
  });

  isSaving = signal(false);
  saveToast = signal<'success' | 'error' | null>(null);
  draggingWidget = signal<CustomWidget | null>(null);

  // Inputs for adding new tech
  newLangInput = '';
  newFwInput = '';
  newTechInput = '';

  // The tech currently being edited (to show description/link fields inline)
  editingTech: TechEntry | null = null;

  ngOnInit() {
    this.loadData();
  }

  async loadData() {
    const widgets = await this.contentService.getCustomWidgets();
    this.availableWidgets.set(widgets);

    const p = await this.contentService.getProfile();
    if (p) {
      this.profile.set(p);
    }
  }

  // ===== LANGUAGE METHODS =====
  addLanguage() {
    const val = this.newLangInput.trim();
    if (!val) return;
    if (!this.profile().languages.find(l => l.name === val)) {
      this.profile.update(p => ({ ...p, languages: [...p.languages, { name: val }] }));
    }
    this.newLangInput = '';
  }

  removeLanguage(tech: TechEntry) {
    this.profile.update(p => ({ ...p, languages: p.languages.filter(l => l !== tech) }));
    if (this.editingTech === tech) this.editingTech = null;
  }

  // ===== FRAMEWORK METHODS =====
  addFramework() {
    const val = this.newFwInput.trim();
    if (!val) return;
    if (!this.profile().frameworks.find(f => f.name === val)) {
      this.profile.update(p => ({ ...p, frameworks: [...p.frameworks, { name: val }] }));
    }
    this.newFwInput = '';
  }

  removeFramework(tech: TechEntry) {
    this.profile.update(p => ({ ...p, frameworks: p.frameworks.filter(f => f !== tech) }));
    if (this.editingTech === tech) this.editingTech = null;
  }

  // ===== TECHNOLOGIES METHODS =====
  addTechnology() {
    const val = this.newTechInput.trim();
    if (!val) return;
    if (!this.profile().technologies.find(t => t.name === val)) {
      this.profile.update(p => ({ ...p, technologies: [...p.technologies, { name: val }] }));
    }
    this.newTechInput = '';
  }

  removeTechnology(tech: TechEntry) {
    this.profile.update(p => ({ ...p, technologies: p.technologies.filter(t => t !== tech) }));
    if (this.editingTech === tech) this.editingTech = null;
  }

  // Toggle editing panel for a tech chip
  toggleEditTech(tech: TechEntry) {
    this.editingTech = this.editingTech === tech ? null : tech;
  }

  // ===== EXPERIENCE METHODS =====
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

  // ===== WIDGET DRAG & DROP =====
  onDragStart(event: DragEvent, widget: CustomWidget) {
    this.draggingWidget.set(widget);
    if (event.dataTransfer) {
      event.dataTransfer.effectAllowed = 'copy';
      event.dataTransfer.setData('text/plain', widget.id || '');
    }
  }

  onDragOver(event: DragEvent) {
    event.preventDefault();
    if (event.dataTransfer) {
      event.dataTransfer.dropEffect = 'copy';
    }
  }

  onDrop(event: DragEvent) {
    event.preventDefault();
    const widget = this.draggingWidget();
    if (!widget || !widget.id) return;

    const rect = (event.currentTarget as HTMLElement).getBoundingClientRect();
    const x = event.clientX - rect.left - 50;
    const y = event.clientY - rect.top - 50;

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

  // ===== TEMPLATE HELPERS =====
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
      this.saveToast.set('success');
      setTimeout(() => this.saveToast.set(null), 3500);
    } catch (e) {
      console.error(e);
      this.saveToast.set('error');
      setTimeout(() => this.saveToast.set(null), 4000);
    } finally {
      this.isSaving.set(false);
    }
  }
}
