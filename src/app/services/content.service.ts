import { Injectable, signal, inject } from '@angular/core';
import { SupabaseService } from './supabase.service';

export interface EditorBlock {
    id: string;
    type: 'h1' | 'h2' | 'p' | 'image' | 'code' | 'objective-header' | 'objectives' | 'divider' | 'tech-stack' | 'diagram';
    content: string;
    data?: any;
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
    createdAt: string;
    updatedAt: string;
}

@Injectable({
    providedIn: 'root'
})
export class ContentService {
    private supabase = inject(SupabaseService);
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
        if (typeof sessionStorage !== 'undefined') {
            const previewStored = sessionStorage.getItem('portfolio_preview');
            if (previewStored) {
                try {
                    this.previewDocSignal.set(JSON.parse(previewStored));
                } catch (e) {
                    console.error('Error parsing preview content', e);
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
            createdAt: d.created_at,
            updatedAt: d.updated_at
        };
    }

    async getAllWorks(): Promise<DocumentEntry[]> {
        const { data, error } = await this.supabase
            .from('documents')
            .select('*')
            .eq('category', 'work')
            .order('created_at', { ascending: false });
        if (error) console.error(error);
        return data ? data.map(this.mapToEntry) : [];
    }

    async getAllLogs(): Promise<DocumentEntry[]> {
        const { data, error } = await this.supabase
            .from('documents')
            .select('*')
            .eq('category', 'log')
            .order('created_at', { ascending: false });
        if (error) console.error(error);
        return data ? data.map(this.mapToEntry) : [];
    }

    async getDocument(slugOrPreview: string): Promise<DocumentEntry | undefined> {
        if (slugOrPreview === 'preview') {
            return this.previewDocSignal() || undefined;
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
        return data ? this.mapToEntry(data) : undefined;
    }

    setPreviewDocument(doc: Partial<DocumentEntry>) {
        const now = new Date().toISOString();
        const previewDoc: DocumentEntry = {
            id: 'preview',
            slug: 'preview',
            title: doc.title || 'Preview Title',
            coverPhoto: doc.coverPhoto || '',
            category: doc.category || 'work',
            tags: doc.tags || [],
            indexLog: doc.indexLog || '',
            blocks: doc.blocks || [],
            createdAt: now,
            updatedAt: now
        };
        this.previewDocSignal.set(previewDoc);
        if (typeof sessionStorage !== 'undefined') {
            sessionStorage.setItem('portfolio_preview', JSON.stringify(previewDoc));
        }
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
}
