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

  availableWidgets = signal<CustomWidget[]>([]);

  profile = signal<ProfileData>({
    name: '',
    username: '',
    avatar_url: '',
    role: '',
    location: '',
    clearance: '',
    status: 'Active Duty',
    coreMission: '',
    experience: [],
    languages: [],
    frameworks: [],
    technologies: [],
    widgets: []
  });

  isSaving = signal(false);
  saveToast = signal<'success' | 'error' | null>(null);
  draggingWidget = signal<CustomWidget | null>(null);

  // Nickname
  nicknameInput = '';
  nicknameError = '';
  nicknameSaving = false;
  canChangeNickname = true;
  daysUntilChange = 0;

  // Photo upload
  uploadingAvatar = false;
  uploadingPhoto = false;

  newLangInput = '';
  newFwInput = '';
  newTechInput = '';
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
      this.nicknameInput = p.username || '';

      // Check if nickname change is allowed
      if (p.username_updated_at) {
        const lastChange = new Date(p.username_updated_at);
        const daysSince = (Date.now() - lastChange.getTime()) / (1000 * 60 * 60 * 24);
        if (daysSince < 30) {
          this.canChangeNickname = false;
          this.daysUntilChange = Math.ceil(30 - daysSince);
        }
      }
    }
  }

  // ===== NICKNAME =====
  async changeNickname() {
    const nick = this.nicknameInput.trim();
    if (!nick) return;
    if (nick === this.profile().username) return;

    this.nicknameSaving = true;
    this.nicknameError = '';

    const result = await this.contentService.updateUsername(nick);
    if (result.success) {
      this.profile.update(p => ({ ...p, username: nick, username_updated_at: new Date().toISOString() }));
      this.canChangeNickname = false;
      this.daysUntilChange = 30;
      this.saveToast.set('success');
      setTimeout(() => this.saveToast.set(null), 3500);
    } else {
      this.nicknameError = result.error || 'Failed to update nickname.';
    }
    this.nicknameSaving = false;
  }

  // ===== AVATAR UPLOAD =====
  async onAvatarFileSelected(event: Event) {
    const input = event.target as HTMLInputElement;
    if (!input.files?.length) return;
    const file = input.files[0];

    if (file.size > 2 * 1024 * 1024) {
      alert('Image must be less than 2MB.');
      return;
    }

    this.uploadingAvatar = true;
    try {
      const url = await this.contentService.uploadAvatar(file);
      this.profile.update(p => ({ ...p, avatar_url: url }));
    } catch (e) {
      console.error('Avatar upload failed:', e);
      alert('Failed to upload avatar. Check console.');
    }
    this.uploadingAvatar = false;
  }

  // ===== PERSONNEL PHOTO UPLOAD =====
  async onPersonnelPhotoSelected(event: Event) {
    const input = event.target as HTMLInputElement;
    if (!input.files?.length) return;
    const file = input.files[0];

    if (file.size > 2 * 1024 * 1024) {
      alert('Image must be less than 2MB.');
      return;
    }

    this.uploadingAvatar = true;
    try {
      const url = await this.contentService.uploadAvatar(file);
      this.profile.update(p => ({ ...p, personnel_photo: url }));
    } catch (e) {
      console.error('Personnel photo upload failed:', e);
      alert('Failed to upload photo. Check console.');
    }
    this.uploadingAvatar = false;
  }

  // ===== LANGUAGE METHODS =====
  addLanguage() {
    const val = this.newLangInput.trim();
    if (!val) return;
    if (!this.profile().languages?.find(l => l.name === val)) {
      this.profile.update(p => ({ ...p, languages: [...(p.languages || []), { name: val }] }));
    }
    this.newLangInput = '';
  }

  removeLanguage(tech: TechEntry) {
    this.profile.update(p => ({ ...p, languages: (p.languages || []).filter(l => l !== tech) }));
    if (this.editingTech === tech) this.editingTech = null;
  }

  // ===== FRAMEWORK METHODS =====
  addFramework() {
    const val = this.newFwInput.trim();
    if (!val) return;
    if (!this.profile().frameworks?.find(f => f.name === val)) {
      this.profile.update(p => ({ ...p, frameworks: [...(p.frameworks || []), { name: val }] }));
    }
    this.newFwInput = '';
  }

  removeFramework(tech: TechEntry) {
    this.profile.update(p => ({ ...p, frameworks: (p.frameworks || []).filter(f => f !== tech) }));
    if (this.editingTech === tech) this.editingTech = null;
  }

  // ===== TECHNOLOGIES METHODS =====
  addTechnology() {
    const val = this.newTechInput.trim();
    if (!val) return;
    if (!this.profile().technologies?.find(t => t.name === val)) {
      this.profile.update(p => ({ ...p, technologies: [...(p.technologies || []), { name: val }] }));
    }
    this.newTechInput = '';
  }

  removeTechnology(tech: TechEntry) {
    this.profile.update(p => ({ ...p, technologies: (p.technologies || []).filter(t => t !== tech) }));
    if (this.editingTech === tech) this.editingTech = null;
  }

  toggleEditTech(tech: TechEntry) {
    this.editingTech = this.editingTech === tech ? null : tech;
  }

  // ===== EXPERIENCE METHODS =====
  addExperience() {
    this.profile.update(p => ({
      ...p,
      experience: [...(p.experience || []), { role: 'New Role', company: 'Company', location: 'City', years: 'Year', description: '' }]
    }));
  }

  removeExperience(index: number) {
    this.profile.update(p => {
      const arr = [...(p.experience || [])];
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
