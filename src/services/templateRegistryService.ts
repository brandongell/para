import { DocumentMetadata } from '../types';
import * as fs from 'fs';
import * as path from 'path';
import { glob } from 'glob';

export interface TemplateEntry {
  filePath: string;
  metadata: DocumentMetadata;
  documensoTemplateId?: string;
  commonNames: string[]; // Alternative names for natural language matching
  lastUpdated: Date;
}

export class TemplateRegistryService {
  private registry: Map<string, TemplateEntry> = new Map();
  private nameIndex: Map<string, string[]> = new Map(); // Maps common names to template IDs
  private organizePath: string;
  private lastRefresh: Date | null = null;
  private refreshInterval: number = 5 * 60 * 1000; // 5 minutes

  constructor(organizePath: string) {
    this.organizePath = organizePath;
  }

  /**
   * Initialize the registry by scanning for templates
   */
  async initialize(): Promise<void> {
    await this.refreshRegistry();
  }

  /**
   * Refresh the registry by scanning for templates
   */
  async refreshRegistry(): Promise<void> {
    console.log('🔄 Refreshing template registry...');
    
    try {
      // Find all metadata files
      const metadataFiles = await glob('**/*.metadata.json', {
        cwd: this.organizePath,
        absolute: true
      });

      // Clear existing registry
      this.registry.clear();
      this.nameIndex.clear();

      // Process each metadata file
      for (const metadataPath of metadataFiles) {
        try {
          const metadataContent = await fs.promises.readFile(metadataPath, 'utf-8');
          const metadata = JSON.parse(metadataContent) as DocumentMetadata;

          // Only process templates
          if (metadata.status === 'template') {
            const documentPath = metadataPath.replace('.metadata.json', '');
            const templateId = this.generateTemplateId(metadata);
            
            const entry: TemplateEntry = {
              filePath: documentPath,
              metadata,
              documensoTemplateId: metadata.documenso?.template_id,
              commonNames: this.generateCommonNames(metadata),
              lastUpdated: new Date()
            };

            // Add to registry
            this.registry.set(templateId, entry);

            // Index by common names
            for (const name of entry.commonNames) {
              const normalizedName = this.normalizeTemplateName(name);
              if (!this.nameIndex.has(normalizedName)) {
                this.nameIndex.set(normalizedName, []);
              }
              this.nameIndex.get(normalizedName)!.push(templateId);
            }

            // Index by Documenso template ID if available
            if (entry.documensoTemplateId) {
              this.registry.set(`documenso:${entry.documensoTemplateId}`, entry);
            }
          }
        } catch (error) {
          console.error(`Failed to process metadata file ${metadataPath}:`, error);
        }
      }

      this.lastRefresh = new Date();
      console.log(`✅ Template registry refreshed. Found ${this.registry.size} templates.`);
    } catch (error) {
      console.error('Failed to refresh template registry:', error);
      throw error;
    }
  }

  /**
   * Generate a unique template ID based on metadata
   */
  private generateTemplateId(metadata: DocumentMetadata): string {
    // Use filename as base, removing extension
    const baseName = metadata.filename.replace(/\.[^/.]+$/, '');
    return `template:${baseName}`;
  }

  /**
   * Generate common names for natural language matching
   */
  private generateCommonNames(metadata: DocumentMetadata): string[] {
    const names: string[] = [];

    // Add filename without extension
    names.push(metadata.filename.replace(/\.[^/.]+$/, ''));

    // Add document type if available
    if (metadata.document_type) {
      names.push(metadata.document_type);
    }

    // Add template name from Documenso if available
    if (metadata.documenso?.template_name) {
      names.push(metadata.documenso.template_name);
    }

    // Add template type from analysis
    if (metadata.template_analysis?.template_type) {
      names.push(metadata.template_analysis.template_type);
    }

    // Add common abbreviations and variations
    const abbreviations = this.generateAbbreviations(names);
    names.push(...abbreviations);

    return [...new Set(names)]; // Remove duplicates
  }

  /**
   * Generate common abbreviations for template names
   */
  private generateAbbreviations(names: string[]): string[] {
    const abbreviations: string[] = [];

    for (const name of names) {
      // Common legal document abbreviations
      const abbrevMap: Record<string, string[]> = {
        'non-disclosure agreement': ['NDA', 'MNDA'],
        'mutual non-disclosure agreement': ['MNDA', 'mutual NDA'],
        'employment agreement': ['employment contract', 'work agreement'],
        'independent contractor agreement': ['ICA', 'contractor agreement'],
        'terms of service': ['TOS', 'terms'],
        'privacy policy': ['privacy', 'data policy'],
        'stock purchase agreement': ['SPA'],
        'simple agreement for future equity': ['SAFE'],
        'convertible note': ['note'],
        'board resolution': ['resolution'],
        'stock option agreement': ['option agreement', 'ISO', 'NSO']
      };

      const lowerName = name.toLowerCase();
      for (const [full, abbrevs] of Object.entries(abbrevMap)) {
        if (lowerName.includes(full) || abbrevs.some(abbrev => lowerName.includes(abbrev.toLowerCase()))) {
          abbreviations.push(...abbrevs);
        }
      }
    }

    return abbreviations;
  }

  /**
   * Normalize template name for matching
   */
  private normalizeTemplateName(name: string): string {
    return name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, ' ')
      .trim()
      .replace(/\s+/g, ' ');
  }

  /**
   * Find templates matching a query
   */
  async findTemplates(query: string): Promise<TemplateEntry[]> {
    // Refresh if needed
    if (this.shouldRefresh()) {
      await this.refreshRegistry();
    }

    const normalizedQuery = this.normalizeTemplateName(query);
    const results: Map<string, TemplateEntry> = new Map();

    // Exact match by template ID
    if (this.registry.has(`template:${query}`)) {
      const entry = this.registry.get(`template:${query}`)!;
      results.set(`template:${query}`, entry);
    }

    // Match by Documenso template ID
    if (this.registry.has(`documenso:${query}`)) {
      const entry = this.registry.get(`documenso:${query}`)!;
      results.set(`documenso:${query}`, entry);
    }

    // Match by common names
    const templateIds = this.nameIndex.get(normalizedQuery) || [];
    for (const id of templateIds) {
      const entry = this.registry.get(id);
      if (entry) {
        results.set(id, entry);
      }
    }

    // Fuzzy match on common names
    for (const [name, ids] of this.nameIndex.entries()) {
      if (name.includes(normalizedQuery) || normalizedQuery.includes(name)) {
        for (const id of ids) {
          const entry = this.registry.get(id);
          if (entry) {
            results.set(id, entry);
          }
        }
      }
    }

    return Array.from(results.values());
  }

  /**
   * Get a template by its Documenso template ID
   */
  async getTemplateByDocumensoId(documensoTemplateId: string): Promise<TemplateEntry | null> {
    if (this.shouldRefresh()) {
      await this.refreshRegistry();
    }

    return this.registry.get(`documenso:${documensoTemplateId}`) || null;
  }

  /**
   * Get all templates
   */
  async getAllTemplates(): Promise<TemplateEntry[]> {
    if (this.shouldRefresh()) {
      await this.refreshRegistry();
    }

    return Array.from(this.registry.values()).filter(
      entry => entry.metadata.status === 'template'
    );
  }

  /**
   * Check if registry should be refreshed
   */
  private shouldRefresh(): boolean {
    if (!this.lastRefresh) return true;
    const now = new Date();
    return now.getTime() - this.lastRefresh.getTime() > this.refreshInterval;
  }

  /**
   * Update a template entry (e.g., after uploading to Documenso)
   */
  async updateTemplate(filePath: string, updates: Partial<TemplateEntry>): Promise<void> {
    // Find the template by file path
    let templateId: string | null = null;
    for (const [id, entry] of this.registry.entries()) {
      if (entry.filePath === filePath) {
        templateId = id;
        break;
      }
    }

    if (templateId) {
      const existing = this.registry.get(templateId)!;
      const updated: TemplateEntry = {
        ...existing,
        ...updates,
        lastUpdated: new Date()
      };
      this.registry.set(templateId, updated);

      // Update Documenso index if needed
      if (updated.documensoTemplateId) {
        this.registry.set(`documenso:${updated.documensoTemplateId}`, updated);
      }
    }
  }
}