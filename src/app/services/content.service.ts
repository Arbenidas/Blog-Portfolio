import { Injectable, signal, inject, PLATFORM_ID, TransferState, makeStateKey } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { SupabaseService } from './supabase.service';

export interface EditorBlock {
    id: string;
    type: 'h1' | 'h2' | 'p' | 'image' | 'video' | 'code' | 'objective-header' | 'objectives' | 'divider' | 'tech-stack' | 'diagram' | 'widget' | 'comparison' | 'bibliography';
    content: string;
    data?: any;
}

export interface CustomWidget {
    id?: string;
    name: string;
    html_content: string;
    created_at?: string;
}

export interface DiagramNodeConfig {
    id?: string;
    name: string;
    shape: 'box' | 'circle' | 'text';
    bg_color: string;
    text_color: string;
    border_style: string;
    shadow_style: string;
    icon?: string;
    font?: string;
    created_at?: string;
}

export interface ProfileExperience {
    role: string;
    company: string;
    location: string;
    years: string;
    description: string;
}

export interface TechEntry {
    name: string;
    description?: string;    // Brief description shown on hover
    linkSlug?: string;       // Slug of a related work or log
    linkCategory?: 'work' | 'log';
}

export interface ProfileData {
    name: string;
    role: string;
    location: string;
    clearance: string;
    status: string;
    coreMission: string;
    experience: ProfileExperience[];
    languages: TechEntry[];
    frameworks: TechEntry[];
    technologies: TechEntry[];
    widgets: { widgetId: string, x: number, y: number }[];
}

export interface DocumentEntry {
    id: string;
    slug: string;
    title: string;
    coverPhoto?: string;
    category: 'work' | 'log';
    tags: string[];
    indexLog?: string;
    blocks: EditorBlock[];
    status?: 'draft' | 'published';
    createdAt: string;
    updatedAt: string;
}

@Injectable({
    providedIn: 'root'
})
export class ContentService {
    private supabase = inject(SupabaseService);
    private platformId = inject(PLATFORM_ID);
    private transferState = inject(TransferState);
    private previewDocSignal = signal<DocumentEntry | null>(null);

    constructor() {
        this.loadPreviewFromStorage();
    }

    /** Converts a title like "My Cool Project 2024" to "my-cool-project-2024" */
    generateSlug(title: string): string {
        return title
            .toLowerCase()
            .normalize('NFD')                        // decompose accented chars
            .replace(/[\u0300-\u036f]/g, '')         // strip accent diacritics
            .replace(/[^a-z0-9\s-]/g, '')            // remove non-alphanumeric
            .trim()
            .replace(/\s+/g, '-')                    // spaces to hyphens
            .replace(/-+/g, '-')                     // collapse multiple hyphens
            .slice(0, 80);                           // max length for clean URLs
    }

    private loadPreviewFromStorage() {
        if (isPlatformBrowser(this.platformId)) {
            const previewStored = localStorage.getItem('portfolio_preview');
            if (previewStored) {
                // Guard: si el preview guardado tiene un Base64 enorme, lo descartamos
                if (previewStored.includes('"data:image')) {
                    console.warn('Preview descartado: contiene imagen Base64 pesada. Limpiando...');
                    localStorage.removeItem('portfolio_preview');
                    return;
                }
                try {
                    this.previewDocSignal.set(JSON.parse(previewStored));
                } catch (e) {
                    console.error('Error parsing preview content', e);
                    localStorage.removeItem('portfolio_preview');
                }
            }
        }
    }

    private mapToEntry(d: any): DocumentEntry {
        return {
            id: d.id,
            slug: d.slug,
            title: d.title,
            coverPhoto: d.cover_photo,
            category: d.category,
            tags: d.tags || [],
            indexLog: d.index_log,
            blocks: d.blocks || [],
            status: d.status || 'published',
            createdAt: d.created_at,
            updatedAt: d.updated_at
        };
    }

    /** Mapper ligero para vistas de lista (sin blocks ni cover_photo) */
    private mapToListEntry(d: any): DocumentEntry {
        return {
            id: d.id,
            slug: d.slug,
            title: d.title,
            coverPhoto: undefined,
            category: d.category,
            tags: d.tags || [],
            indexLog: d.index_log,
            blocks: [],
            status: d.status || 'published',
            createdAt: d.created_at,
            updatedAt: d.updated_at
        };
    }

    async getAllWorks(limitCount?: number): Promise<DocumentEntry[]> {
        // Solo columnas ligeras: sin blocks ni cover_photo para no transferir datos pesados
        let query = this.supabase
            .from('documents')
            .select('id, slug, title, category, tags, status, index_log, created_at, updated_at')
            .eq('category', 'work')
            .eq('status', 'published')
            .neq('slug', 'system-settings')
            .order('created_at', { ascending: false });

        if (limitCount) {
            query = query.limit(limitCount);
        }

        const { data, error } = await query;
        if (error) console.error(error);
        return data ? data.map((d: any) => this.mapToListEntry(d)) : [];
    }

    async getAllLogs(limitCount?: number): Promise<DocumentEntry[]> {
        // Solo columnas ligeras: sin blocks ni cover_photo
        let query = this.supabase
            .from('documents')
            .select('id, slug, title, category, tags, status, index_log, created_at, updated_at')
            .eq('category', 'log')
            .eq('status', 'published')
            .order('created_at', { ascending: false });

        if (limitCount) {
            query = query.limit(limitCount);
        }

        const { data, error } = await query;
        if (error) console.error(error);
        return data ? data.map((d: any) => this.mapToListEntry(d)) : [];
    }

    async getDraftDocuments(): Promise<DocumentEntry[]> {
        // Solo columnas ligeras: sin blocks ni cover_photo
        const { data, error } = await this.supabase
            .from('documents')
            .select('id, slug, title, category, tags, status, index_log, created_at, updated_at')
            .eq('status', 'draft')
            .order('updated_at', { ascending: false });

        if (error) console.error(error);
        return data ? data.map((d: any) => this.mapToListEntry(d)) : [];
    }

    async getDocument(slugOrPreview: string): Promise<DocumentEntry | undefined> {
        if (slugOrPreview === 'preview') {
            return this.previewDocSignal() || undefined;
        }

        const DOC_KEY = makeStateKey<DocumentEntry | undefined>(`doc-${slugOrPreview}`);
        if (this.transferState.hasKey(DOC_KEY)) {
            const cached = this.transferState.get(DOC_KEY, undefined);
            this.transferState.remove(DOC_KEY); // Clean up memory
            if (cached) return cached;
        }

        const { data, error } = await this.supabase
            .from('documents')
            .select('*')
            .eq('slug', slugOrPreview)
            .single();

        if (error) {
            console.error(error);
            return undefined;
        }

        const entry = data ? this.mapToEntry(data) : undefined;

        if (entry && !isPlatformBrowser(this.platformId)) {
            this.transferState.set(DOC_KEY, entry);
        }

        return entry;
    }

    setPreviewDocument(doc: Partial<DocumentEntry>) {
        const now = new Date().toISOString();

        // Strip data: (Base64) and blob: URLs from the cover before storing in localStorage.
        // Both are too large or cross-tab-invalid and will cause QuotaExceededError.
        const rawCover = doc.coverPhoto || '';
        const safeCoverForStorage = (rawCover.startsWith('data:') || rawCover.startsWith('blob:'))
            ? ''
            : rawCover;

        const previewDoc: DocumentEntry = {
            id: 'preview',
            slug: 'preview',
            title: doc.title || 'Preview Title',
            coverPhoto: rawCover,  // en memoria: URL completa (funciona para preview en misma pestaña)
            category: doc.category || 'work',
            tags: doc.tags || [],
            indexLog: doc.indexLog || '',
            blocks: doc.blocks || [],
            createdAt: now,
            updatedAt: now
        };
        this.previewDocSignal.set(previewDoc);

        if (isPlatformBrowser(this.platformId)) {
            // Para localStorage: usamos la versión sin base64/blob para no desbordar la cuota
            const storageDoc = { ...previewDoc, coverPhoto: safeCoverForStorage };
            try {
                localStorage.setItem('portfolio_preview', JSON.stringify(storageDoc));
            } catch (e) {
                console.warn('No se pudo guardar el preview en localStorage (QuotaExceededError):', e);
            }
        }
    }


    // --- SYSTEM SETTINGS (TAG MANAGER) ---
    async getSystemTags(): Promise<string[]> {
        const doc = await this.getDocument('system-settings');
        return doc ? doc.tags : [];
    }

    async saveSystemTags(tags: string[]): Promise<void> {
        const doc = await this.getDocument('system-settings');
        // Filter out empty tag strings and duplicates just in case
        const cleanTags = Array.from(new Set(tags.filter(t => t.trim().length > 0)));

        const payload: Partial<DocumentEntry> = {
            id: doc?.id, // undefined means it will be created if not exists
            title: 'System Settings',
            slug: 'system-settings',
            category: 'work',
            tags: cleanTags,
            blocks: []
        };
        await this.saveDocument(payload);
    }

    async saveDocument(doc: Partial<DocumentEntry>): Promise<string> {
        // Auto-generate slug from title if not provided or if title changed
        const slug = doc.slug || this.generateSlug(doc.title || 'untitled');

        const payload = {
            title: doc.title || 'Untitled',
            slug,
            cover_photo: doc.coverPhoto || '',
            category: doc.category || 'work',
            tags: doc.tags || [],
            index_log: doc.indexLog || '',
            blocks: doc.blocks || [],
            status: doc.status || 'published',
            updated_at: new Date().toISOString()
        };

        if (doc.id) {
            const { error } = await this.supabase
                .from('documents')
                .update(payload)
                .eq('id', doc.id);
            if (error) throw error;
            return slug;
        } else {
            const { data, error } = await this.supabase
                .from('documents')
                .insert([payload])
                .select('slug')
                .single();
            if (error) throw error;
            return data.slug;
        }
    }

    async deleteDocument(id: string) {
        const { error } = await this.supabase
            .from('documents')
            .delete()
            .eq('id', id);
        if (error) throw error;
    }

    /** Limpia el cover_photo de un documento (usado para auto-reparar Base64 pesados) */
    async clearCoverPhoto(id: string): Promise<void> {
        const { error } = await this.supabase
            .from('documents')
            .update({ cover_photo: '' })
            .eq('id', id);
        if (error) console.error('Error limpiando cover_photo:', error);
    }

    // --- CUSTOM WIDGETS ---

    async getCustomWidgets(): Promise<CustomWidget[]> {
        const WIDGETS_KEY = makeStateKey<CustomWidget[]>('custom-widgets');
        if (this.transferState.hasKey(WIDGETS_KEY)) {
            const cached = this.transferState.get(WIDGETS_KEY, []);
            this.transferState.remove(WIDGETS_KEY);
            if (cached.length) return cached;
        }

        const { data, error } = await this.supabase
            .from('custom_widgets')
            .select('*')
            .order('created_at', { ascending: false });

        if (error) console.error(error);
        const widgets = data || [];

        if (widgets.length && !isPlatformBrowser(this.platformId)) {
            this.transferState.set(WIDGETS_KEY, widgets);
        }
        return widgets;
    }

    async saveCustomWidget(widget: CustomWidget): Promise<void> {
        const payload = {
            name: widget.name,
            html_content: widget.html_content
        };

        if (widget.id) {
            const { error } = await this.supabase
                .from('custom_widgets')
                .update(payload)
                .eq('id', widget.id);
            if (error) throw error;
        } else {
            const { error } = await this.supabase
                .from('custom_widgets')
                .insert([payload]);
            if (error) throw error;
        }
    }

    async deleteCustomWidget(id: string): Promise<void> {
        const { error } = await this.supabase
            .from('custom_widgets')
            .delete()
            .eq('id', id);
        if (error) throw error;
    }

    // --- DIAGRAM NODES ---
    async getDiagramNodes(): Promise<DiagramNodeConfig[]> {
        const { data, error } = await this.supabase
            .from('diagram_nodes')
            .select('*')
            .order('created_at', { ascending: false });
        if (error) console.error(error);
        return data || [];
    }

    async saveDiagramNode(node: DiagramNodeConfig): Promise<void> {
        const payload = {
            name: node.name,
            shape: node.shape,
            bg_color: node.bg_color,
            text_color: node.text_color,
            border_style: node.border_style,
            shadow_style: node.shadow_style,
            icon: node.icon,
            font: node.font
        };

        if (node.id) {
            const { error } = await this.supabase
                .from('diagram_nodes')
                .update(payload)
                .eq('id', node.id);
            if (error) throw error;
        } else {
            const { error } = await this.supabase
                .from('diagram_nodes')
                .insert([payload]);
            if (error) throw error;
        }
    }

    async deleteDiagramNode(id: string): Promise<void> {
        const { error } = await this.supabase
            .from('diagram_nodes')
            .delete()
            .eq('id', id);
        if (error) throw error;
    }

    // --- PERSONNEL PROFILE (About Me) ---

    async getProfile(): Promise<ProfileData | null> {
        const { data, error } = await this.supabase
            .from('personnel_profile')
            .select('data')
            .eq('id', 1)
            .single();

        if (error && error.code !== 'PGRST116') { // PGRST116 = not found
            console.error('Error fetching profile', error);
        }
        if (!data) return null;

        // Backward-compat migration: old profiles store languages/frameworks as string[].
        // Convert to TechEntry[] automatically.
        const p = data.data as ProfileData;
        if (p.languages?.length && typeof p.languages[0] === 'string') {
            p.languages = (p.languages as unknown as string[]).map(name => ({ name }));
        }
        if (p.frameworks?.length && typeof p.frameworks[0] === 'string') {
            p.frameworks = (p.frameworks as unknown as string[]).map(name => ({ name }));
        }
        if (p.technologies?.length && typeof p.technologies[0] === 'string') {
            p.technologies = (p.technologies as unknown as string[]).map(name => ({ name }));
        }
        // If profile doesn't have technologies array, initialize it
        if (!p.technologies) {
            p.technologies = [];
        }
        return p;
    }

    async saveProfile(profileData: ProfileData): Promise<void> {
        const { error } = await this.supabase
            .from('personnel_profile')
            .upsert({ id: 1, data: profileData, updated_at: new Date().toISOString() });

        if (error) throw error;
    }

    // --- COVER IMAGE UPLOAD ---

    async uploadCoverImage(file: File): Promise<string> {
        const ext = file.name.split('.').pop() || 'jpg';
        const fileName = `${Date.now()}_cover.${ext}`;
        const filePath = `covers/${fileName}`;

        const { error } = await this.supabase.client.storage
            .from('videos') // Reutilizamos el bucket que ya existe
            .upload(filePath, file, {
                cacheControl: '3600',
                upsert: false
            });

        if (error) throw error;

        const { data } = this.supabase.client.storage
            .from('videos')
            .getPublicUrl(filePath);

        return data.publicUrl;
    }

    // --- VIDEO UPLOAD ---

    async uploadVideo(file: File): Promise<string> {
        const ext = file.name.split('.').pop() || 'mp4';
        const fileName = `${Date.now()}_${Math.random().toString(36).substr(2, 9)}.${ext}`;
        const filePath = `uploads/${fileName}`;

        const { error } = await this.supabase.client.storage
            .from('videos')
            .upload(filePath, file, {
                cacheControl: '3600',
                upsert: false
            });

        if (error) throw error;

        const { data } = this.supabase.client.storage
            .from('videos')
            .getPublicUrl(filePath);

        return data.publicUrl;
    }

    extractYoutubeId(url: string): string | null {
        const patterns = [
            /(?:youtube\.com\/watch\?v=)([a-zA-Z0-9_-]{11})/,
            /(?:youtu\.be\/)([a-zA-Z0-9_-]{11})/,
            /(?:youtube\.com\/embed\/)([a-zA-Z0-9_-]{11})/,
            /(?:youtube\.com\/shorts\/)([a-zA-Z0-9_-]{11})/
        ];
        for (const pattern of patterns) {
            const match = url.match(pattern);
            if (match) return match[1];
        }
        return null;
    }
}
