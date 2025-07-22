import * as fs from 'fs';
import * as path from 'path';
import { DocumentMetadata, SearchResult } from '../types';
import { DocumensoService, DocumensoTemplateLink } from './documensoService';
import { MetadataService } from './metadataService';
import { SmartSearchService } from './smartSearchService';

export interface TemplateUploadResult {
  success: boolean;
  filename: string;
  documentId?: number;
  templateLink?: string;
  error?: string;
}

export class TemplateManagementService {
  private documensoService: DocumensoService | null = null;
  private metadataService: MetadataService;
  private searchService: SmartSearchService;
  private organizeFolderPath: string;

  constructor(
    organizeFolderPath: string,
    metadataService: MetadataService,
    searchService: SmartSearchService,
    documensoApiUrl?: string,
    documensoApiToken?: string,
    documensoAppUrl?: string
  ) {
    this.organizeFolderPath = organizeFolderPath;
    this.metadataService = metadataService;
    this.searchService = searchService;

    // Initialize Documenso service if credentials provided
    if (documensoApiUrl && documensoApiToken) {
      this.documensoService = new DocumensoService({
        apiUrl: documensoApiUrl,
        apiToken: documensoApiToken,
        appUrl: documensoAppUrl
      });
    }
  }

  /**
   * Mark a document as a template and optionally upload to Documenso
   */
  async markAsTemplate(
    documentPath: string,
    uploadToDocumenso: boolean = false
  ): Promise<TemplateUploadResult> {
    try {
      const filename = path.basename(documentPath);
      console.log(`📄 Marking ${filename} as template...`);

      // Get or create metadata
      const metadataPath = this.metadataService.getMetadataPath(documentPath);
      let metadata = await this.metadataService.readMetadataFile(metadataPath);

      if (!metadata) {
        console.log('📋 No metadata found, generating...');
        const result = await this.metadataService.generateMetadataFile(documentPath);
        if (result.success && result.metadata) {
          metadata = result.metadata;
        } else {
          throw new Error('Failed to generate metadata');
        }
      }

      // Update metadata to mark as template
      metadata.status = 'template';
      if (!metadata.template_analysis) {
        metadata.template_analysis = {
          is_template: true,
          confidence: 'HIGH',
          indicators: ['Manually marked as template'],
          template_type: metadata.document_type || 'Legal Document Template'
        };
      }

      // Initialize Documenso tracking
      if (!metadata.documenso) {
        metadata.documenso = {};
      }

      let templateLink: DocumensoTemplateLink | undefined;

      // Upload to Documenso if requested and service is available
      if (uploadToDocumenso && this.documensoService) {
        try {
          console.log('📤 Uploading to Documenso...');
          
          // Check if it's a PDF
          if (!documentPath.toLowerCase().endsWith('.pdf')) {
            throw new Error('Only PDF files can be uploaded to Documenso');
          }

          templateLink = await this.documensoService.createTemplateLink(
            documentPath,
            metadata
          );

          // Update metadata with Documenso info
          metadata.documenso = {
            document_id: templateLink.documentId,
            template_link: templateLink.templateCreationUrl,
            status: 'uploaded',
            uploaded_at: new Date().toISOString()
          };

          console.log('✅ Successfully uploaded to Documenso');
        } catch (error) {
          console.error('❌ Failed to upload to Documenso:', error);
          metadata.documenso.status = 'error';
          metadata.documenso.error_message = error instanceof Error ? error.message : 'Unknown error';
          
          return {
            success: false,
            filename,
            error: `Failed to upload to Documenso: ${error instanceof Error ? error.message : 'Unknown error'}`
          };
        }
      }

      // Save updated metadata
      await this.metadataService.writeMetadataFile(metadataPath, metadata);
      console.log('✅ Metadata updated successfully');

      return {
        success: true,
        filename,
        documentId: templateLink?.documentId,
        templateLink: templateLink?.templateCreationUrl
      };

    } catch (error) {
      console.error('❌ Error marking document as template:', error);
      return {
        success: false,
        filename: path.basename(documentPath),
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Find templates in the system that haven't been uploaded to Documenso
   */
  async findUnuploadedTemplates(): Promise<SearchResult[]> {
    // Search for all templates
    const allTemplates = await this.searchService.searchByStatus('template');

    // Filter for templates not yet uploaded to Documenso
    const unuploadedTemplates = allTemplates.filter(template => {
      if (!template.metadata?.documenso) return true;
      return template.metadata.documenso.status !== 'uploaded' && 
             template.metadata.documenso.status !== 'template_created';
    });

    return unuploadedTemplates;
  }

  /**
   * Bulk upload templates to Documenso
   */
  async bulkUploadTemplates(
    templatePaths: string[]
  ): Promise<TemplateUploadResult[]> {
    const results: TemplateUploadResult[] = [];

    for (const templatePath of templatePaths) {
      const result = await this.markAsTemplate(templatePath, true);
      results.push(result);

      // Add delay to avoid rate limiting
      if (templatePaths.indexOf(templatePath) < templatePaths.length - 1) {
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }

    return results;
  }

  /**
   * Get template status including Documenso info
   */
  async getTemplateStatus(documentPath: string): Promise<{
    isTemplate: boolean;
    documensoStatus?: string;
    templateLink?: string;
    documentId?: number;
  }> {
    const metadataPath = this.metadataService.getMetadataPath(documentPath);
    const metadata = await this.metadataService.readMetadataFile(metadataPath);

    if (!metadata) {
      return { isTemplate: false };
    }

    return {
      isTemplate: metadata.status === 'template',
      documensoStatus: metadata.documenso?.status,
      templateLink: metadata.documenso?.template_link,
      documentId: metadata.documenso?.document_id
    };
  }

  /**
   * Check if Documenso is configured
   */
  isDocumensoConfigured(): boolean {
    return this.documensoService !== null;
  }
}