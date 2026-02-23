import { Component, inject, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
import { ContentService, CustomWidget, DiagramNodeConfig } from '../../services/content.service';

type StudioMode = 'sticker' | 'node';

interface ShapeOption { id: string; label: string; icon: string; }
interface ColorOption { id: string; label: string; preview: string; tailwind: string; }
interface BorderOption { id: string; label: string; tailwind: string; }
interface ShadowOption { id: string; label: string; tailwind: string; }
interface FontOption { id: string; label: string; family: string; }

@Component({
  selector: 'app-design-studio',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './design-studio.html',
  styleUrl: './design-studio.css'
})
export class DesignStudio implements OnInit {
  private contentService = inject(ContentService);
  private sanitizer = inject(DomSanitizer);

  // Mode toggle: sticker vs node
  mode = signal<StudioMode>('sticker');

  // Saved items lists
  widgets = signal<CustomWidget[]>([]);
  nodes = signal<DiagramNodeConfig[]>([]);

  isSaving = signal(false);

  // === STICKER MODE STATE ===
  editingWidget = signal<CustomWidget>({
    name: 'New Sticker',
    html_content: '<div style="padding: 10px; background: yellow; border: 2px solid black; font-weight: bold;">DRAFT</div>'
  });

  // === NODE MODE STATE ===
  nodeName = '';
  nodeIcon = '';
  nodeLabel = 'My Node';
  selectedShape = 'box';
  selectedBg = 'bg-white';
  selectedText = 'text-charcoal';
  selectedBorder = 'border-2 border-charcoal';
  selectedShadow = 'shadow-[4px_4px_0_#1a1a1a]';
  selectedFont = 'font-mono';

  // Icon gallery for quick selection (comprehensive subset of Material Symbols)
  popularIcons: string[] = [
    // Tech & IT
    'database', 'hub', 'devices', 'phone_iphone', 'cloud', 'storage', 'dns', 'router', 'terminal', 'code', 'api', 'webhook', 'data_object', 'bug_report', 'integration_instructions', 'memory', 'developer_board', 'developer_mode', 'devices_other', 'laptop_mac', 'laptop_windows', 'desktop_mac', 'desktop_windows', 'smartphone', 'tablet_mac', 'keyboard', 'mouse', 'headphones', 'watch', 'gamepad', 'sd_card', 'sim_card', 'battery_full', 'usb', 'bluetooth', 'wifi', 'cast',
    // Security
    'lock', 'lock_open', 'shield', 'security', 'key', 'vpn_key', 'fingerprint', 'token', 'enhanced_encryption', 'no_encryption', 'password', 'policy', 'privacy_tip',
    // Work & Business
    'work', 'business', 'business_center', 'apartment', 'corporate_fare', 'store', 'engineering', 'precision_manufacturing', 'biotech', 'science', 'architecture', 'plumbing', 'construction', 'gavel', 'lightbulb', 'emoji_objects', 'rocket', 'rocket_launch',
    // Analytics & Metrics
    'analytics', 'monitoring', 'speed', 'trending_up', 'trending_down', 'bar_chart', 'pie_chart', 'timeline', 'show_chart', 'insights', 'query_stats', 'stacked_bar_chart', 'waterfall_chart',
    // Files & Folders
    'folder', 'folder_open', 'create_new_folder', 'description', 'article', 'note', 'inventory_2', 'inventory', 'archive', 'unarchive', 'attachment', 'cloud_download', 'cloud_upload', 'cloud_done', 'cloud_off', 'cloud_sync',
    // Editor & Text
    'edit', 'edit_square', 'drive_file_rename_outline', 'format_bold', 'format_italic', 'format_underlined', 'format_quote', 'format_list_bulleted', 'format_list_numbered', 'title', 'text_fields', 'translate', 'spellcheck', 'content_copy', 'content_paste', 'content_cut',
    // Social & People
    'person', 'person_add', 'person_remove', 'group', 'group_add', 'diversity_1', 'diversity_2', 'diversity_3', 'support_agent', 'smart_toy', 'face', 'sentiment_satisfied', 'sentiment_dissatisfied', 'thumb_up', 'thumb_down', 'favorite', 'favorite_border', 'star', 'star_border', 'star_half', 'share', 'share_location',
    // Navigation & Map
    'home', 'search', 'menu', 'more_vert', 'more_horiz', 'arrow_back', 'arrow_forward', 'arrow_upward', 'arrow_downward', 'chevron_left', 'chevron_right', 'expand_less', 'expand_more', 'location_on', 'map', 'my_location', 'navigation', 'explore', 'flight', 'local_shipping', 'directions_car', 'directions_bus', 'directions_railway', 'two_wheeler', 'pedal_bike',
    // UI Actions
    'add', 'remove', 'close', 'check', 'check_circle', 'cancel', 'delete', 'delete_outline', 'done', 'done_all', 'refresh', 'sync', 'update', 'settings', 'tune', 'filter_list', 'sort', 'view_list', 'view_module', 'view_quilt', 'view_column', 'view_array', 'grid_view', 'list', 'apps', 'more',
    // Communication
    'email', 'mail', 'mark_email_read', 'mark_email_unread', 'chat', 'forum', 'message', 'comment', 'call', 'call_end', 'phone', 'contact_phone', 'rss_feed', 'notifications', 'notifications_active', 'notifications_off',
    // AV & Media
    'play_arrow', 'pause', 'stop', 'play_circle', 'pause_circle', 'skip_next', 'skip_previous', 'fast_forward', 'fast_rewind', 'volume_up', 'volume_down', 'volume_off', 'mic', 'mic_off', 'videocam', 'videocam_off', 'camera_alt', 'image', 'photo', 'photo_library', 'portrait', 'music_note',
    // Alerts & Status
    'warning', 'error', 'info', 'help', 'help_outline', 'new_releases', 'report', 'report_problem', 'dangerous', 'brightness_1'
  ];

  // === CONFIG OPTIONS ===
  shapes: ShapeOption[] = [
    { id: 'box', label: 'Box', icon: 'crop_square' },
    { id: 'circle', label: 'Circle', icon: 'circle' },
    { id: 'text', label: 'Text Only', icon: 'text_fields' }
  ];

  bgColors: ColorOption[] = [
    { id: 'bg-white', label: 'White', preview: '#ffffff', tailwind: 'bg-white' },
    { id: 'bg-charcoal', label: 'Charcoal', preview: '#1a1a1a', tailwind: 'bg-[#1a1a1a]' },
    { id: 'bg-accent-orange', label: 'Orange', preview: '#d94e1e', tailwind: 'bg-[#d94e1e]' },
    { id: 'bg-yellow-100', label: 'Yellow', preview: '#fef9c3', tailwind: 'bg-yellow-100' },
    { id: 'bg-paper-cream', label: 'Paper', preview: '#f5f0e8', tailwind: 'bg-[#f5f0e8]' },
    { id: 'bg-teal-500', label: 'Teal', preview: '#14b8a6', tailwind: 'bg-teal-500' },
    { id: 'bg-red-500', label: 'Red', preview: '#ef4444', tailwind: 'bg-red-500' },
  ];

  textColors: ColorOption[] = [
    { id: 'text-charcoal', label: 'Dark', preview: '#1a1a1a', tailwind: 'text-[#1a1a1a]' },
    { id: 'text-white', label: 'White', preview: '#ffffff', tailwind: 'text-white' },
    { id: 'text-accent-orange', label: 'Orange', preview: '#d94e1e', tailwind: 'text-[#d94e1e]' },
    { id: 'text-teal-600', label: 'Teal', preview: '#0d9488', tailwind: 'text-teal-600' },
  ];

  borders: BorderOption[] = [
    { id: 'border-2 border-charcoal', label: 'Solid', tailwind: 'border-2 border-[#1a1a1a]' },
    { id: 'border-2 border-dashed border-charcoal', label: 'Dashed', tailwind: 'border-2 border-dashed border-[#1a1a1a]' },
    { id: 'border-none', label: 'None', tailwind: '' }
  ];

  shadows: ShadowOption[] = [
    { id: 'shadow-[4px_4px_0_#1a1a1a]', label: 'Brutalist', tailwind: 'shadow-[4px_4px_0_#1a1a1a]' },
    { id: 'shadow-[4px_4px_0_#d94e1e]', label: 'Orange', tailwind: 'shadow-[4px_4px_0_#d94e1e]' },
    { id: 'shadow-md', label: 'Soft', tailwind: 'shadow-md' },
    { id: 'shadow-none', label: 'None', tailwind: '' }
  ];

  fonts: FontOption[] = [
    { id: 'font-mono', label: 'Mono', family: "'Space Mono', monospace" },
    { id: 'font-display', label: 'Display', family: "'Space Grotesk', sans-serif" },
    { id: 'font-hand', label: 'Handwritten', family: "'Caveat', cursive" },
    { id: 'font-body', label: 'Body', family: "'Inter', sans-serif" },
    { id: 'font-nixie', label: 'Nixie', family: "'Nixie One', system-ui" },
  ];

  ngOnInit() {
    this.loadAll();
  }

  async loadAll() {
    const [w, n] = await Promise.all([
      this.contentService.getCustomWidgets(),
      this.contentService.getDiagramNodes()
    ]);
    this.widgets.set(w);
    this.nodes.set(n);
  }

  setMode(m: StudioMode) {
    this.mode.set(m);
  }

  // ====== STICKER METHODS ====== //
  getSafeHtml(html: string): SafeHtml {
    return this.sanitizer.bypassSecurityTrustHtml(html);
  }

  createNewSticker() {
    this.editingWidget.set({
      name: 'New Sticker',
      html_content: '<div style="padding: 10px; background: yellow; border: 2px solid black; font-weight: bold;">DRAFT</div>'
    });
  }

  editSticker(widget: CustomWidget) {
    this.editingWidget.set({ ...widget });
  }

  async saveSticker() {
    const current = this.editingWidget();
    if (!current.name || !current.html_content) return;

    this.isSaving.set(true);
    try {
      await this.contentService.saveCustomWidget(current);
      await this.loadAll();
      this.createNewSticker();
    } catch (e) {
      console.error(e);
    } finally {
      this.isSaving.set(false);
    }
  }

  async deleteSticker(id: string) {
    if (!confirm('Delete this sticker?')) return;
    try {
      await this.contentService.deleteCustomWidget(id);
      await this.loadAll();
      if (this.editingWidget().id === id) this.createNewSticker();
    } catch (e) { console.error(e); }
  }

  // ====== NODE METHODS ====== //
  getNodePreviewClasses(): string {
    const shape = this.selectedShape;
    const parts = [this.selectedBg, this.selectedText, this.selectedBorder, this.selectedShadow];
    if (shape === 'circle') parts.push('rounded-full w-28 h-28');
    else if (shape === 'box') parts.push('min-w-[140px] p-4');
    else parts.push('bg-transparent border-none shadow-none');
    return parts.join(' ');
  }

  getNodePreviewStyle(): Record<string, string> {
    // Map tailwind color names to actual CSS for inline preview
    const bgMap: Record<string, string> = {
      'bg-white': '#ffffff', 'bg-charcoal': '#1a1a1a', 'bg-accent-orange': '#d94e1e',
      'bg-yellow-100': '#fef9c3', 'bg-paper-cream': '#f5f0e8', 'bg-teal-500': '#14b8a6',
      'bg-red-500': '#ef4444'
    };
    const textMap: Record<string, string> = {
      'text-charcoal': '#1a1a1a', 'text-white': '#ffffff',
      'text-accent-orange': '#d94e1e', 'text-teal-600': '#0d9488'
    };
    const borderMap: Record<string, string> = {
      'border-2 border-charcoal': '2px solid #1a1a1a',
      'border-2 border-dashed border-charcoal': '2px dashed #1a1a1a',
      'border-none': 'none'
    };
    const shadowMap: Record<string, string> = {
      'shadow-[4px_4px_0_#1a1a1a]': '4px 4px 0 #1a1a1a',
      'shadow-[4px_4px_0_#d94e1e]': '4px 4px 0 #d94e1e',
      'shadow-md': '0 4px 6px -1px rgba(0,0,0,0.1)',
      'shadow-none': 'none'
    };

    const style: Record<string, string> = {
      'background-color': bgMap[this.selectedBg] || '#ffffff',
      'color': textMap[this.selectedText] || '#1a1a1a',
      'border': borderMap[this.selectedBorder] || '2px solid #1a1a1a',
      'box-shadow': shadowMap[this.selectedShadow] || 'none',
      'font-family': this.getFontFamily(this.selectedFont),
    };

    if (this.selectedShape === 'circle') {
      style['border-radius'] = '50%';
      style['width'] = '112px';
      style['height'] = '112px';
    } else if (this.selectedShape === 'text') {
      style['background-color'] = 'transparent';
      style['border'] = 'none';
      style['box-shadow'] = 'none';
    }
    return style;
  }

  resetNode() {
    this.nodeName = '';
    this.nodeIcon = '';
    this.nodeLabel = 'My Node';
    this.selectedShape = 'box';
    this.selectedBg = 'bg-white';
    this.selectedText = 'text-charcoal';
    this.selectedBorder = 'border-2 border-charcoal';
    this.selectedShadow = 'shadow-[4px_4px_0_#1a1a1a]';
    this.selectedFont = 'font-mono';
  }

  editNode(node: DiagramNodeConfig) {
    this.nodeName = node.name;
    this.nodeIcon = node.icon || '';
    this.nodeLabel = node.name;
    this.selectedShape = node.shape;
    this.selectedBg = node.bg_color;
    this.selectedText = node.text_color;
    this.selectedBorder = node.border_style;
    this.selectedShadow = node.shadow_style;
    this.selectedFont = node.font || 'font-mono';
  }

  async saveNode() {
    if (!this.nodeName) return;
    this.isSaving.set(true);
    try {
      await this.contentService.saveDiagramNode({
        name: this.nodeName,
        shape: this.selectedShape as 'box' | 'circle' | 'text',
        bg_color: this.selectedBg,
        text_color: this.selectedText,
        border_style: this.selectedBorder,
        shadow_style: this.selectedShadow,
        icon: this.nodeIcon || undefined,
        font: this.selectedFont
      });
      await this.loadAll();
      this.resetNode();
    } catch (e) { console.error(e); }
    finally { this.isSaving.set(false); }
  }

  async deleteNode(id: string) {
    if (!confirm('Delete this diagram node?')) return;
    try {
      await this.contentService.deleteDiagramNode(id);
      await this.loadAll();
    } catch (e) { console.error(e); }
  }

  getBgPreview(id: string): string {
    const c = this.bgColors.find(x => x.id === id);
    return c ? c.preview : '#ffffff';
  }

  getTextPreview(id: string): string {
    const c = this.textColors.find(x => x.id === id);
    return c ? c.preview : '#1a1a1a';
  }

  getFontFamily(id: string): string {
    const f = this.fonts.find(x => x.id === id);
    return f ? f.family : "'Space Mono', monospace";
  }
}
