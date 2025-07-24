import * as fs from 'fs';
import * as path from 'path';
import FormData = require('form-data');
import fetch from 'node-fetch';
import { DocumentMetadata, DocumensoTemplateField } from '../types';

export interface DocumensoConfig {
  apiUrl: string;
  apiToken: string;
  appUrl?: string; // For generating UI links
}

export interface DocumensoDocument {
  id: number;
  title: string;
  status: string;
  createdAt: string;
  documentDataId: string;
}

export interface DocumensoUploadResponse {
  documentId: number;
  title: string;
  documentDataId: string;
  status: string;
}

export interface DocumensoTemplateLink {
  documentId: number;
  templateCreationUrl: string;
  apiUrl: string;
}

export interface DocumensoCreateResponse {
  documentId: number;
  uploadUrl?: string;
  recipients?: Array<{
    recipientId: number;
    name: string;
    email: string;
    token: string;
    role: string;
    signingOrder: number;
    signingUrl: string;
  }>;
}

export interface DocumensoTemplate {
  id: string;
  title: string;
  fields: Array<{
    id: string;
    name: string;
    type: string;
    required: boolean;
    placeholder?: string;
    defaultValue?: string;
  }>;
  recipients: Array<{
    id: string;
    name: string;
    email: string;
    role: string;
    signingOrder: number;
  }>;
}

export class DocumensoService {
  private config: DocumensoConfig;

  constructor(config: DocumensoConfig) {
    this.config = {
      ...config,
      appUrl: config.appUrl || 'https://app.documenso.com'
    };
  }

  /**
   * Upload a document to Documenso as a draft for template creation
   */
  async uploadDocumentForTemplate(
    filePath: string,
    metadata: DocumentMetadata
  ): Promise<DocumensoUploadResponse> {
    try {
      console.log('📤 Uploading document to Documenso for template creation...');
      
      const fileName = path.basename(filePath);
      const title = this.generateTemplateTitle(metadata);
      
      // Step 1: Create document metadata
      const createPayload = {
        title: title,
        recipients: [
          {
            name: "Template Placeholder",
            email: "template@placeholder.com",
            role: "SIGNER",
            signingOrder: 1
          }
        ]
      };
      
      const createResponse = await fetch(`${this.config.apiUrl}/api/v1/documents`, {
        method: 'POST',
        headers: {
          'Authorization': this.config.apiToken,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(createPayload)
      });

      if (!createResponse.ok) {
        const errorText = await createResponse.text();
        throw new Error(`Documenso document creation failed: ${createResponse.status} - ${errorText}`);
      }

      const createResult = await createResponse.json() as DocumensoCreateResponse;
      console.log(`✅ Document created: ID ${createResult.documentId}`);
      
      // Step 2: Upload the file if upload URL is provided
      if (createResult.uploadUrl) {
        const fileContent = fs.readFileSync(filePath);
        
        const uploadResponse = await fetch(createResult.uploadUrl, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/pdf'
          },
          body: fileContent
        });
        
        if (!uploadResponse.ok) {
          throw new Error(`File upload failed: ${uploadResponse.status}`);
        }
        
        console.log(`✅ File uploaded successfully`);
      }
      
      // Return formatted response
      return {
        documentId: createResult.documentId,
        title: title,
        documentDataId: '',
        status: 'DRAFT'
      };
      
    } catch (error) {
      console.error('❌ Failed to upload document to Documenso:', error);
      throw error;
    }
  }

  /**
   * Generate a link for the user to convert the uploaded document to a template
   */
  generateTemplateCreationLink(documentId: number): DocumensoTemplateLink {
    // Generate link to Documenso's template creation interface
    // This assumes Documenso has a UI route for converting documents to templates
    const templateCreationUrl = `${this.config.appUrl}/documents/${documentId}/convert-to-template`;
    
    return {
      documentId,
      templateCreationUrl,
      apiUrl: `${this.config.apiUrl}/api/v1/documents/${documentId}`
    };
  }

  /**
   * Upload a template document and get a link for template creation
   */
  async createTemplateLink(
    filePath: string,
    metadata: DocumentMetadata
  ): Promise<DocumensoTemplateLink> {
    // Upload the document
    const uploadResult = await this.uploadDocumentForTemplate(filePath, metadata);
    
    // Generate the template creation link
    const templateLink = this.generateTemplateCreationLink(uploadResult.documentId);
    
    console.log('🔗 Template creation link generated:', templateLink.templateCreationUrl);
    
    return templateLink;
  }

  /**
   * Generate a user-friendly title for the template
   */
  private generateTemplateTitle(metadata: DocumentMetadata): string {
    let title = metadata.document_type || 'Legal Document';
    
    // Add template indicator
    title += ' [TEMPLATE]';
    
    // Add category if available
    if (metadata.category && metadata.category !== 'Other') {
      title += ` - ${metadata.category.replace(/_/g, ' ')}`;
    }
    
    return title;
  }

  /**
   * Check if a document exists in Documenso
   */
  async getDocument(documentId: number): Promise<DocumensoDocument | null> {
    try {
      const response = await fetch(`${this.config.apiUrl}/api/v1/documents/${documentId}`, {
        method: 'GET',
        headers: {
          'Authorization': this.config.apiToken,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        if (response.status === 404) {
          return null;
        }
        throw new Error(`Failed to get document: ${response.status}`);
      }

      return await response.json() as DocumensoDocument;
    } catch (error) {
      console.error('❌ Failed to get document from Documenso:', error);
      throw error;
    }
  }

  /**
   * Delete a document from Documenso
   */
  async deleteDocument(documentId: number): Promise<boolean> {
    try {
      const response = await fetch(`${this.config.apiUrl}/api/v1/documents/${documentId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': this.config.apiToken
        }
      });

      return response.ok;
    } catch (error) {
      console.error('❌ Failed to delete document from Documenso:', error);
      return false;
    }
  }

  /**
   * Create a document from a template
   */
  async createDocumentFromTemplate(
    templateId: string,
    recipients: Array<{ name: string; email: string; signingOrder?: number }>,
    formValues?: Record<string, string>
  ): Promise<any> {
    try {
      const payload = {
        title: `Document created from template ${templateId}`,
        recipients,
        formValues: formValues || {},
        meta: {
          dateFormat: 'MM/DD/YYYY',
          timezone: 'America/New_York'
        }
      };

      const response = await fetch(
        `${this.config.apiUrl}/api/v1/templates/${templateId}/generate-document`,
        {
          method: 'POST',
          headers: {
            'Authorization': this.config.apiToken,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(payload)
        }
      );

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Failed to create document from template: ${response.status} - ${errorText}`);
      }

      return await response.json();
    } catch (error) {
      console.error('❌ Failed to create document from template:', error);
      throw error;
    }
  }

  /**
   * Get template details including fields
   */
  async getTemplate(templateId: string): Promise<DocumensoTemplate | null> {
    try {
      const response = await fetch(
        `${this.config.apiUrl}/api/v1/templates/${templateId}`,
        {
          method: 'GET',
          headers: {
            'Authorization': this.config.apiToken,
            'Content-Type': 'application/json'
          }
        }
      );

      if (!response.ok) {
        if (response.status === 404) {
          return null;
        }
        throw new Error(`Failed to get template: ${response.status}`);
      }

      return await response.json() as DocumensoTemplate;
    } catch (error) {
      console.error('❌ Failed to get template from Documenso:', error);
      throw error;
    }
  }

  /**
   * Get template fields
   */
  async getTemplateFields(templateId: string): Promise<DocumensoTemplateField[]> {
    try {
      const template = await this.getTemplate(templateId);
      if (!template) {
        throw new Error('Template not found');
      }

      // Transform Documenso fields to our format
      return template.fields.map(field => ({
        id: field.id,
        name: field.name,
        type: this.mapFieldType(field.type),
        required: field.required,
        placeholder: field.placeholder,
        defaultValue: field.defaultValue,
        description: field.placeholder // Use placeholder as description for now
      }));
    } catch (error) {
      console.error('❌ Failed to get template fields:', error);
      throw error;
    }
  }

  /**
   * Map Documenso field types to our types
   */
  private mapFieldType(documensoType: string): 'text' | 'email' | 'date' | 'number' | 'signature' | 'initials' {
    const typeMap: Record<string, 'text' | 'email' | 'date' | 'number' | 'signature' | 'initials'> = {
      'TEXT': 'text',
      'EMAIL': 'email',
      'DATE': 'date',
      'NUMBER': 'number',
      'SIGNATURE': 'signature',
      'INITIALS': 'initials'
    };

    return typeMap[documensoType.toUpperCase()] || 'text';
  }

  /**
   * Create and send document from template in one operation
   */
  async createAndSendDocument(
    templateId: string,
    recipients: Array<{ name: string; email: string; signingOrder?: number }>,
    formValues?: Record<string, string>,
    options?: {
      title?: string;
      message?: string;
      subject?: string;
    }
  ): Promise<{
    documentId: number;
    recipients: Array<{
      email: string;
      signingUrl: string;
    }>;
  }> {
    try {
      // Create document from template
      const createResult = await this.createDocumentFromTemplate(templateId, recipients, formValues);
      
      // Send the document for signing
      if (createResult.status === 'DRAFT') {
        const sendPayload = {
          subject: options?.subject || 'Please sign this document',
          message: options?.message || 'You have been requested to sign this document.',
          sendDocument: true
        };

        const sendResponse = await fetch(
          `${this.config.apiUrl}/api/v1/documents/${createResult.documentId}/send`,
          {
            method: 'POST',
            headers: {
              'Authorization': this.config.apiToken,
              'Content-Type': 'application/json'
            },
            body: JSON.stringify(sendPayload)
          }
        );

        if (!sendResponse.ok) {
          const errorText = await sendResponse.text();
          throw new Error(`Failed to send document: ${sendResponse.status} - ${errorText}`);
        }

        const sendResult = await sendResponse.json();
        
        return {
          documentId: createResult.documentId,
          recipients: (sendResult as any)?.recipients || createResult.recipients?.map((r: any) => ({
            email: r.email,
            signingUrl: r.signingUrl
          })) || []
        };
      }

      // Document was already sent
      return {
        documentId: createResult.documentId,
        recipients: createResult.recipients?.map((r: any) => ({
          email: r.email,
          signingUrl: r.signingUrl
        })) || []
      };
    } catch (error) {
      console.error('❌ Failed to create and send document:', error);
      throw error;
    }
  }
}