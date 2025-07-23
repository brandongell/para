import * as readline from 'readline';
import { DocumensoService, DocumensoTemplateLink } from './documensoService';
import { DocumentMetadata } from '../types';
import * as path from 'path';

export class TemplatePromptService {
  private documensoService: DocumensoService | null = null;
  private rl: readline.Interface;

  constructor(documensoConfig?: { apiUrl: string; apiToken: string; appUrl?: string }) {
    if (documensoConfig && documensoConfig.apiUrl && documensoConfig.apiToken) {
      this.documensoService = new DocumensoService(documensoConfig);
    }
    
    this.rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout
    });
  }

  /**
   * Prompt user about uploading a template to Documenso
   */
  async promptForTemplateUpload(
    filePath: string, 
    metadata: DocumentMetadata
  ): Promise<DocumensoTemplateLink | null> {
    if (!this.documensoService) {
      console.log('⚠️  Documenso integration not configured. Skipping template upload prompt.');
      return null;
    }

    const filename = path.basename(filePath);
    console.log('\n🎯 Template Document Detected!');
    console.log(`📄 File: ${filename}`);
    console.log(`📋 Type: ${metadata.document_type || 'Unknown'}`);
    console.log(`🏷️  Category: ${metadata.category || 'Not categorized'}`);
    
    if (metadata.template_analysis) {
      console.log(`🔍 Confidence: ${metadata.template_analysis.confidence}`);
      if (metadata.template_analysis.template_type) {
        console.log(`📝 Template Type: ${metadata.template_analysis.template_type}`);
      }
    }

    const question = '\n🤔 Would you like to upload this template to Documenso for configuration? (yes/no): ';
    
    return new Promise((resolve) => {
      this.rl.question(question, async (answer) => {
        const normalizedAnswer = answer.toLowerCase().trim();
        
        if (normalizedAnswer === 'yes' || normalizedAnswer === 'y') {
          try {
            console.log('\n📤 Uploading template to Documenso...');
            const templateLink = await this.documensoService!.createTemplateLink(filePath, metadata);
            
            console.log('\n✅ Template uploaded successfully!');
            console.log('🔗 Configure your template here:');
            console.log(`   ${templateLink.templateCreationUrl}`);
            console.log('\n📌 Document ID:', templateLink.documentId);
            console.log('💡 Tip: Add signature fields, text fields, and other elements in the Documenso interface.');
            
            resolve(templateLink);
          } catch (error) {
            console.error('\n❌ Failed to upload template to Documenso:', error);
            resolve(null);
          }
        } else {
          console.log('✅ Skipping Documenso upload. Template will be organized locally.');
          resolve(null);
        }
      });
    });
  }

  /**
   * Check if template prompting is enabled (Documenso is configured)
   */
  isEnabled(): boolean {
    return this.documensoService !== null;
  }

  /**
   * Close the readline interface
   */
  close(): void {
    this.rl.close();
  }
}