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
    linkCategory?: 'work' | 'log' | 'guide';
}

export interface ProfileData {
    name: string;
    username?: string;
    avatar_url?: string;
    personnel_photo?: string;
    username_updated_at?: string;
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

    // Database metadata
    id?: string;
    created_at?: string;
}

export interface DocumentEntry {
    id: string; // the database ID
    slug: string; // user-friendly URL part
    title: string;
    tags: string[];
    createdAt: string;
    blocks: EditorBlock[];
    // optional fields depending on type
    status?: 'draft' | 'published' | 'archived';
    author?: { username: string; avatar_url: string; full_name: string } | any; // Temporary type until fully implemented
    // for works specifically
    coverPhoto?: string;
    category: 'work' | 'log';
    indexLog?: string;
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

    async getTrendingLogs(limit: number = 5): Promise<DocumentEntry[]> {
        // Get all published documents (logs, works, guides)
        const { data: docs, error } = await this.supabase.client
            .from('documents')
            .select('*, profiles:author_id(username, avatar_url, full_name)')
            .eq('status', 'published')
            .order('created_at', { ascending: false });

        if (error || !docs?.length) {
            console.error('Error fetching trending:', error);
            return [];
        }

        const docIds = docs.map((d: any) => d.id);

        // Fetch upvote and comment counts in bulk
        const [upvoteData, commentData] = await Promise.all([
            this.supabase.client.from('document_upvotes').select('document_id').in('document_id', docIds),
            this.supabase.client.from('document_comments').select('document_id').in('document_id', docIds)
        ]);

        const upvoteCounts: Record<string, number> = {};
        (upvoteData.data || []).forEach((r: any) => {
            upvoteCounts[r.document_id] = (upvoteCounts[r.document_id] || 0) + 1;
        });

        const commentCounts: Record<string, number> = {};
        (commentData.data || []).forEach((r: any) => {
            commentCounts[r.document_id] = (commentCounts[r.document_id] || 0) + 1;
        });

        // Map to entries and attach real counts
        const entries = (docs as any[]).map(doc => {
            const entry = this.mapToEntry(doc);
            (entry as any).upvoteCount = upvoteCounts[doc.id] || 0;
            (entry as any).commentCount = commentCounts[doc.id] || 0;
            (entry as any).totalEngagement = (upvoteCounts[doc.id] || 0) + (commentCounts[doc.id] || 0);
            return entry;
        });

        // Sort by total engagement (upvotes + comments) descending
        entries.sort((a: any, b: any) => b.totalEngagement - a.totalEngagement);

        return entries.slice(0, limit);
    }

    async getPlatformStats(): Promise<{ activeAgents: number, publishedLogs: number, archivedWorks: number }> {
        try {
            // Query 1: Active Agents (Count of profiles)
            const { count: agentsCount, error: agentsError } = await this.supabase.client
                .from('profiles')
                .select('*', { count: 'exact', head: true });
            if (agentsError) throw agentsError;

            // Query 2: Published Logs (Count of documents category='log', status='published')
            const { count: logsCount, error: logsError } = await this.supabase.client
                .from('documents')
                .select('*', { count: 'exact', head: true })
                .eq('category', 'log')
                .eq('status', 'published');
            if (logsError) throw logsError;

            // Query 3: Archived Works (Count of documents category='work', status='published')
            const { count: worksCount, error: worksError } = await this.supabase.client
                .from('documents')
                .select('*', { count: 'exact', head: true })
                .eq('category', 'work')
                .eq('status', 'published');
            if (worksError) throw worksError;

            return {
                activeAgents: agentsCount || 0,
                publishedLogs: logsCount || 0,
                archivedWorks: worksCount || 0
            };
        } catch (error) {
            console.error('Error fetching platform stats:', error);
            // Fallback mock data in case of error
            return { activeAgents: 2543, publishedLogs: 89104, archivedWorks: 14201 };
        }
    }

    async getAllLogs(page: number = 1, limitCount: number = 10): Promise<DocumentEntry[]> {
        // Basic Recommendation System: Get favorite tags from localStorage
        let favoriteTags: string[] = [];
        if (isPlatformBrowser(this.platformId)) {
            try {
                const stored = localStorage.getItem('hub_favorite_tags');
                if (stored) {
                    const tagsMap = JSON.parse(stored);
                    // Sort by score descending and get top 3
                    favoriteTags = Object.keys(tagsMap)
                        .sort((a, b) => tagsMap[b] - tagsMap[a])
                        .slice(0, 3);
                }
            } catch (e) {
                console.error('Error reading favorite tags', e);
            }
        }

        const offset = (page - 1) * limitCount;

        let query = this.supabase.client
            .from('documents')
            .select('*, profiles:author_id(username, avatar_url, full_name)')
            .eq('category', 'log')
            .eq('status', 'published');

        // Optional: If we wanted to strictly filter by tags, we could use .contains('tags', favoriteTags).
        // However, we just want to fetch the latest. For basic recommendation, we will fetch standard order,
        // and let the frontend array sort or highlight them. Or we can just rely on standard chronological for now 
        // until we add a proper RPC in Supabase. We will stick to chronological for simplicity here,
        // but expose the favoriteTags sorting in the UI later if needed.

        query = query.order('created_at', { ascending: false })
            .range(offset, offset + limitCount - 1);

        const { data, error } = await query;

        if (error) {
            console.error('Error fetching all logs:', error);
            return [];
        }

        return data ? data.map((d: any) => this.mapToEntry(d)) : [];
    }

    async getAllGuides(): Promise<DocumentEntry[]> {
        const { data, error } = await this.supabase.client
            .from('documents')
            .select('*, profiles:author_id(username, avatar_url, full_name)')
            .eq('category', 'guide')
            .eq('status', 'published')
            .order('created_at', { ascending: false });

        if (error) {
            console.error('Error fetching all guides:', error);
            return [];
        }

        return data ? data.map((d: any) => this.mapToEntry(d)) : [];
    }

    recordTagView(tags: string[]) {
        if (!tags || tags.length === 0 || !isPlatformBrowser(this.platformId)) return;
        try {
            const stored = localStorage.getItem('hub_favorite_tags');
            const tagsMap: Record<string, number> = stored ? JSON.parse(stored) : {};

            tags.forEach(tag => {
                tagsMap[tag] = (tagsMap[tag] || 0) + 1;
            });

            localStorage.setItem('hub_favorite_tags', JSON.stringify(tagsMap));
        } catch (e) {
            console.error('Error saving tag view', e);
        }
    }

    async getRecentActivity(limit: number = 4): Promise<{ title: string, category: string, author: string, time: string, slug: string }[]> {
        const { data, error } = await this.supabase.client
            .from('documents')
            .select('title, category, created_at, slug, profiles:author_id(username)')
            .eq('status', 'published')
            .order('created_at', { ascending: false })
            .limit(limit);

        if (error) {
            console.error('Error fetching recent activity:', error);
            return [];
        }

        return data.map((d: any) => ({
            title: d.title,
            category: d.category,
            author: d.profiles?.username || 'sys_admin_01',
            time: d.created_at,
            slug: d.slug
        }));
    }

    async getAdminDocuments(category: 'work' | 'log'): Promise<DocumentEntry[]> {
        const session = await this.supabase.client.auth.getSession();
        const user = session.data.session?.user;
        if (!user) return [];

        const { data, error } = await this.supabase
            .from('documents')
            .select('id, slug, title, category, tags, status, index_log, created_at, updated_at')
            .eq('category', category)
            .eq('author_id', user.id)
            .order('created_at', { ascending: false });

        if (error) console.error(error);
        return data ? data.map((d: any) => this.mapToListEntry(d)) : [];
    }

    async getDraftDocuments(): Promise<DocumentEntry[]> {
        const session = await this.supabase.client.auth.getSession();
        const user = session.data.session?.user;
        if (!user) return [];

        // Solo columnas ligeras: sin blocks ni cover_photo
        const { data, error } = await this.supabase
            .from('documents')
            .select('id, slug, title, category, tags, status, index_log, created_at, updated_at')
            .eq('status', 'draft')
            .eq('author_id', user.id)
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
            const { data: { user } } = await this.supabase.client.auth.getUser();
            const fullPayload = { ...payload, author_id: user?.id };
            const { data, error } = await this.supabase
                .from('documents')
                .insert(fullPayload)
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

    async getProfile(identifier?: string, useUsername: boolean = false): Promise<ProfileData | null> {
        let query = this.supabase.from('profiles').select('*');

        if (identifier) {
            if (useUsername) {
                query = query.eq('username', identifier);
            } else {
                query = query.eq('id', identifier);
            }
        } else {
            // Get current user's profile if no identifier provided
            const session = await this.supabase.client.auth.getSession();
            if (!session.data.session?.user) return null;
            query = query.eq('id', session.data.session.user.id);
        }

        const { data, error } = await query.single();

        if (error && error.code !== 'PGRST116') { // PGRST116 = not found
            console.error('Error fetching profile', error);
        }
        if (!data) return null;

        // Backward-compat migration: old profiles store languages/frameworks as string[].
        // Convert to TechEntry[] automatically.
        const p = data.data as ProfileData;

        // Ensure name, bio etc are pulled from top level
        if (p) {
            p.id = data.id;
            p.created_at = data.created_at;
            p.name = data.full_name || p.name;
            p.coreMission = data.bio || p.coreMission;
            p.avatar_url = data.avatar_url || undefined;
            p.personnel_photo = data.data?.personnel_photo || undefined;
            p.username = data.username || undefined;
            p.username_updated_at = data.username_updated_at || undefined;
        }
        if (p.languages?.length && typeof p.languages[0] === 'string') {
            p.languages = (p.languages as unknown as string[]).map(name => ({ name }));
        }
        if (p.frameworks?.length && typeof p.frameworks[0] === 'string') {
            p.frameworks = (p.frameworks as unknown as string[]).map(name => ({ name }));
        }
        if (p.technologies?.length && typeof p.technologies[0] === 'string') {
            p.technologies = (p.technologies as unknown as string[]).map(name => ({ name }));
        }

        // Ensure all arrays are initialized to prevent spread errors in UI
        if (!p.experience) p.experience = [];
        if (!p.languages) p.languages = [];
        if (!p.frameworks) p.frameworks = [];
        if (!p.technologies) p.technologies = [];
        if (!p.widgets) p.widgets = [];

        return p;
    }

    async saveProfile(profileData: Partial<ProfileData>): Promise<void> {
        const session = await this.supabase.client.auth.getSession();
        if (!session.data.session?.user) throw new Error('Not authenticated');

        const payload: any = {
            full_name: profileData.name,
            bio: profileData.coreMission,
            data: {
                role: profileData.role,
                location: profileData.location,
                clearance: profileData.clearance,
                status: profileData.status,
                experience: profileData.experience,
                languages: profileData.languages,
                frameworks: profileData.frameworks,
                technologies: profileData.technologies,
                widgets: profileData.widgets,
                personnel_photo: profileData.personnel_photo
            },
            updated_at: new Date().toISOString()
        };

        // Handle avatar_url if provided
        if (profileData.avatar_url !== undefined) {
            payload.avatar_url = profileData.avatar_url;
        }

        const { error } = await this.supabase.client
            .from('profiles')
            .update(payload)
            .eq('id', session.data.session.user.id);

        if (error) throw error;
    }

    async updateUsername(newUsername: string): Promise<{ success: boolean, error?: string }> {
        const session = await this.supabase.client.auth.getSession();
        if (!session.data.session?.user) return { success: false, error: 'Not authenticated' };

        // Check if username was changed in the last 30 days
        const { data: profile } = await this.supabase.client
            .from('profiles')
            .select('username, username_updated_at')
            .eq('id', session.data.session.user.id)
            .single();

        if (profile?.username_updated_at) {
            const lastChange = new Date(profile.username_updated_at);
            const daysSince = (Date.now() - lastChange.getTime()) / (1000 * 60 * 60 * 24);
            if (daysSince < 30) {
                const daysLeft = Math.ceil(30 - daysSince);
                return { success: false, error: `You can change your nickname again in ${daysLeft} days.` };
            }
        }

        // Check if username is already taken
        const { data: existing } = await this.supabase.client
            .from('profiles')
            .select('id')
            .eq('username', newUsername)
            .neq('id', session.data.session.user.id)
            .single();

        if (existing) {
            return { success: false, error: 'This nickname is already taken.' };
        }

        const { error } = await this.supabase.client
            .from('profiles')
            .update({
                username: newUsername,
                username_updated_at: new Date().toISOString()
            })
            .eq('id', session.data.session.user.id);

        if (error) return { success: false, error: error.message };
        return { success: true };
    }

    async uploadAvatar(file: File): Promise<string> {
        const session = await this.supabase.client.auth.getSession();
        const userId = session.data.session?.user?.id;
        if (!userId) throw new Error('Not authenticated');

        const ext = file.name.split('.').pop() || 'jpg';
        const fileName = `${userId}_avatar_${Date.now()}.${ext}`;
        const filePath = `avatars/${fileName}`;

        const { error } = await this.supabase.client.storage
            .from('videos')  // Reuse existing bucket
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
        const fileExt = file.name.split('.').pop();
        const fileName = `${Math.random()}.${fileExt}`;
        const filePath = `videos/${fileName}`;

        const { error: uploadError } = await this.supabase.client
            .storage
            .from('covers')
            .upload(filePath, file);

        if (uploadError) throw uploadError;

        const { data } = this.supabase.client
            .storage
            .from('covers')
            .getPublicUrl(filePath);

        return data.publicUrl;
    }

    // ==========================================
    // SOCIAL INTERACTIONS (Upvotes & Comments)
    // ==========================================

    async getUpvoteCount(documentId: string): Promise<{ count: number, userHasUpvoted: boolean }> {
        const session = await this.supabase.client.auth.getSession();
        const userId = session.data.session?.user?.id;

        // 1. Get total count
        const { count, error } = await this.supabase.client
            .from('document_upvotes')
            .select('*', { count: 'exact', head: true })
            .eq('document_id', documentId);

        if (error) console.error('Error fetching upvotes:', error);

        // 2. Check if current user has upvoted
        let userHasUpvoted = false;
        if (userId) {
            const { data } = await this.supabase.client
                .from('document_upvotes')
                .select('id')
                .eq('document_id', documentId)
                .eq('user_id', userId)
                .single();
            if (data) userHasUpvoted = true;
        }

        return { count: count || 0, userHasUpvoted };
    }

    async toggleUpvote(documentId: string, currentStatus: boolean): Promise<boolean> {
        const session = await this.supabase.client.auth.getSession();
        const userId = session.data.session?.user?.id;
        if (!userId) throw new Error('User not logged in');

        if (currentStatus) {
            // Remove upvote
            const { error } = await this.supabase.client
                .from('document_upvotes')
                .delete()
                .eq('document_id', documentId)
                .eq('user_id', userId);
            if (error) throw error;
            return false;
        } else {
            // Add upvote
            const { error } = await this.supabase.client
                .from('document_upvotes')
                .insert({ document_id: documentId, user_id: userId });
            if (error) throw error;
            return true;
        }
    }

    async getComments(documentId: string): Promise<any[]> {
        const { data, error } = await this.supabase.client
            .from('document_comments')
            .select(`
                id, 
                content, 
                created_at, 
                profiles:user_id(username, avatar_url, full_name)
            `)
            .eq('document_id', documentId)
            .order('created_at', { ascending: true });

        if (error) {
            console.error('Error fetching comments:', error);
            return [];
        }
        return data || [];
    }

    async addComment(documentId: string, content: string): Promise<void> {
        const session = await this.supabase.client.auth.getSession();
        const userId = session.data.session?.user?.id;
        if (!userId) throw new Error('User not logged in');

        const { error } = await this.supabase.client
            .from('document_comments')
            .insert({
                document_id: documentId,
                user_id: userId,
                content: content
            });

        if (error) throw error;
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

    // --- DASHBOARD SOCIAL STATS ---

    async getTotalUpvotes(): Promise<number> {
        const { count, error } = await this.supabase.client
            .from('document_upvotes')
            .select('*', { count: 'exact', head: true });
        if (error) console.error('Error fetching total upvotes:', error);
        return count || 0;
    }

    async getUpvoteCountsForDocuments(documentIds: string[]): Promise<Record<string, number>> {
        if (!documentIds.length) return {};
        const { data, error } = await this.supabase.client
            .from('document_upvotes')
            .select('document_id')
            .in('document_id', documentIds);

        if (error) {
            console.error('Error fetching upvote counts:', error);
            return {};
        }

        const counts: Record<string, number> = {};
        (data || []).forEach((row: any) => {
            counts[row.document_id] = (counts[row.document_id] || 0) + 1;
        });
        return counts;
    }

    async getCommentCountsForDocuments(documentIds: string[]): Promise<Record<string, number>> {
        if (!documentIds.length) return {};
        const { data, error } = await this.supabase.client
            .from('document_comments')
            .select('document_id')
            .in('document_id', documentIds);

        if (error) {
            console.error('Error fetching comment counts:', error);
            return {};
        }

        const counts: Record<string, number> = {};
        (data || []).forEach((row: any) => {
            counts[row.document_id] = (counts[row.document_id] || 0) + 1;
        });
        return counts;
    }

    async getAllCommentsForAdmin(): Promise<any[]> {
        const { data, error } = await this.supabase.client
            .from('document_comments')
            .select(`
                id,
                content,
                created_at,
                document_id,
                profiles:user_id(username, avatar_url, full_name),
                documents:document_id(title, slug, category)
            `)
            .order('created_at', { ascending: false })
            .limit(50);

        if (error) {
            console.error('Error fetching all comments:', error);
            return [];
        }
        return data || [];
    }

    async deleteComment(commentId: string): Promise<void> {
        const { error } = await this.supabase.client
            .from('document_comments')
            .delete()
            .eq('id', commentId);
        if (error) throw error;
    }
}
