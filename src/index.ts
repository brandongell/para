import * as dotenv from 'dotenv';
import { DocumentClassifierService } from './services/documentClassifier';
import { FileOrganizerService } from './services/fileOrganizer';
import { FileMonitorService } from './services/fileMonitor';
import { MetadataService } from './services/metadataService';
import { TemplatePromptService } from './services/templatePromptService';
import { CLIUtils } from './utils/cli';

// Load environment variables
dotenv.config();

class LegalDocumentOrganizer {
  private cli: CLIUtils;
  private classifier: DocumentClassifierService | null = null;
  private organizer: FileOrganizerService;
  private monitor: FileMonitorService | null = null;
  private metadataService: MetadataService | null = null;
  private templatePromptService: TemplatePromptService | null = null;

  constructor() {
    this.cli = new CLIUtils();
    this.organizer = new FileOrganizerService();
  }

  async run(): Promise<void> {
    try {
      this.cli.displayWelcome();
      
      // Check for API keys
      const apiKey = await this.getOpenAIApiKey();
      const geminiApiKey = this.getGeminiApiKey();
      const documensoConfig = this.getDocumensoConfig();
      
      // Initialize services
      this.classifier = new DocumentClassifierService(apiKey, geminiApiKey);
      this.monitor = new FileMonitorService(apiKey, geminiApiKey, documensoConfig);
      this.metadataService = new MetadataService(apiKey, geminiApiKey);
      this.templatePromptService = new TemplatePromptService(documensoConfig);
      
      // Set metadata service in organizer
      this.organizer.setMetadataService(this.metadataService);
      
      // Get folder path from user
      const folderPath = await this.cli.getFolderPath();
      
      // Ask user what they want to do
      const shouldOrganize = await this.cli.confirmAction(
        '\n🗂️  Do you want to organize existing files in this folder?'
      );
      
      if (shouldOrganize) {
        await this.organizeExistingFiles(folderPath);
      } else {
        // Ask if they want to generate metadata for existing organized files
        const shouldGenerateMetadata = await this.cli.confirmAction(
          '\n📋 Do you want to generate metadata for existing organized files?'
        );
        
        if (shouldGenerateMetadata) {
          await this.generateMetadataForExistingFiles(folderPath);
        }
      }
      
      // Ask if they want to monitor for new files
      const shouldMonitor = await this.cli.confirmAction(
        '\n👀 Do you want to monitor this folder for new files and organize them automatically?'
      );
      
      if (shouldMonitor) {
        await this.startMonitoring(folderPath);
      } else {
        this.cli.displaySuccess('Organization complete! Exiting...');
        this.cleanup();
      }
      
    } catch (error) {
      this.cli.displayError('Application error', error as Error);
      this.cleanup();
      process.exit(1);
    }
  }

  private getGeminiApiKey(): string | undefined {
    const geminiApiKey = process.env.GEMINI_API_KEY;
    
    if (!geminiApiKey || geminiApiKey.trim() === '' || geminiApiKey === 'PASTE_YOUR_GEMINI_API_KEY_HERE') {
      this.cli.displayWarning('Gemini API key not found - PDF extraction will not work');
      this.cli.displayInfo('To enable PDF extraction, add your Gemini API key to the .env file:');
      this.cli.displayInfo('GEMINI_API_KEY=your_gemini_api_key_here');
      return undefined;
    }
    
    return geminiApiKey;
  }

  private getDocumensoConfig(): { apiUrl: string; apiToken: string; appUrl?: string } | undefined {
    const apiUrl = process.env.DOCUMENSO_API_URL;
    const apiToken = process.env.DOCUMENSO_API_TOKEN;
    const appUrl = process.env.DOCUMENSO_APP_URL;
    
    if (!apiUrl || !apiToken) {
      this.cli.displayWarning('Documenso integration not configured - template upload prompts will be disabled');
      this.cli.displayInfo('To enable Documenso integration, add to your .env file:');
      this.cli.displayInfo('DOCUMENSO_API_URL=your_documenso_api_url');
      this.cli.displayInfo('DOCUMENSO_API_TOKEN=your_documenso_api_token');
      return undefined;
    }
    
    this.cli.displayInfo('✅ Documenso integration enabled for template uploads');
    
    return {
      apiUrl,
      apiToken,
      appUrl
    };
  }

  private async getOpenAIApiKey(): Promise<string> {
    const apiKey = process.env.OPENAI_API_KEY;
    
    if (!apiKey) {
      this.cli.displayError('OpenAI API key not found in .env file');
      this.cli.displayInfo('Please add your OpenAI API key to the .env file:');
      this.cli.displayInfo('OPENAI_API_KEY=your_api_key_here');
      throw new Error('Missing OpenAI API key');
    }
    
    if (apiKey.trim() === '' || apiKey === 'your_openai_api_key_here') {
      this.cli.displayError('Please set a valid OpenAI API key in the .env file');
      throw new Error('Invalid OpenAI API key');
    }
    
    return apiKey;
  }

  private async organizeExistingFiles(folderPath: string): Promise<void> {
    try {
      this.cli.displayInfo('📁 Creating folder structure...');
      await this.organizer.createFolderStructure(folderPath);
      
      this.cli.displayInfo('🔍 Finding files to organize...');
      const files = await this.organizer.getAllFiles(folderPath);
      
      if (files.length === 0) {
        this.cli.displayWarning('No files found to organize.');
        return;
      }
      
      this.cli.displayInfo(`Found ${files.length} files to organize.`);
      
      const shouldProceed = await this.cli.confirmAction(
        `\n⚠️  This will move ${files.length} files into organized folders. Continue?`
      );
      
      if (!shouldProceed) {
        this.cli.displayInfo('Organization cancelled by user.');
        return;
      }
      
      // Process files
      let successCount = 0;
      let failCount = 0;
      
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        this.cli.displayProgress(i + 1, files.length, file);
        
        try {
          if (!this.classifier) {
            throw new Error('Classifier not initialized');
          }
          
          const classification = await this.classifier.classifyFile(file);
          const result = await this.organizer.organizeFile(file, classification, folderPath);
          
          if (result.success) {
            successCount++;
            
            // Check if it's a template and prompt for Documenso upload
            if (result.metadataPath && this.templatePromptService?.isEnabled()) {
              try {
                const fs = require('fs');
                const metadataContent = fs.readFileSync(result.metadataPath, 'utf-8');
                const metadata = JSON.parse(metadataContent);
                
                if (metadata.status === 'template') {
                  const templateLink = await this.templatePromptService.promptForTemplateUpload(
                    result.newPath!,
                    metadata
                  );
                  
                  // Update metadata with Documenso information if uploaded
                  if (templateLink) {
                    metadata.documenso = {
                      template_id: templateLink.documentId.toString(), // Convert to string for consistency
                      template_link: templateLink.templateCreationUrl,
                      template_name: metadata.document_type || metadata.filename.replace(/\.[^/.]+$/, ''), // User-friendly name
                      template_uploaded_at: new Date().toISOString(),
                      status: 'template_created',
                      uploaded_at: new Date().toISOString()
                    };
                    
                    // Write updated metadata back to file
                    fs.writeFileSync(result.metadataPath, JSON.stringify(metadata, null, 2));
                    console.log(`📋 Metadata updated with Documenso information`);
                  }
                }
              } catch (error) {
                console.error(`⚠️  Failed to check template status:`, error);
              }
            }
          } else {
            failCount++;
            console.error(`\n❌ Failed: ${file} - ${result.error}`);
          }
          
        } catch (error) {
          failCount++;
          console.error(`\n❌ Error processing ${file}:`, error);
        }
        
        // Small delay to avoid overwhelming the API
        if (i < files.length - 1) {
          await new Promise(resolve => setTimeout(resolve, 500));
        }
      }
      
      // Display summary
      this.cli.displaySummary({
        success: successCount,
        failed: failCount,
        total: files.length
      });
      
    } catch (error) {
      this.cli.displayError('Error organizing existing files', error as Error);
      throw error;
    }
  }

  private async generateMetadataForExistingFiles(folderPath: string): Promise<void> {
    try {
      if (!this.metadataService) {
        throw new Error('Metadata service not initialized');
      }
      
      this.cli.displayInfo('📋 Generating metadata for existing organized files...');
      
      const results = await this.metadataService.generateMetadataForExistingFiles(
        folderPath,
        (current, total, filename) => {
          this.cli.displayProgress(current, total, filename);
        }
      );
      
      // Display summary
      this.cli.displaySummary({
        success: results.success,
        failed: results.failed,
        total: results.success + results.failed + results.skipped,
        skipped: results.skipped
      });
      
    } catch (error) {
      this.cli.displayError('Error generating metadata for existing files', error as Error);
      throw error;
    }
  }

  private async startMonitoring(folderPath: string): Promise<void> {
    try {
      if (!this.monitor) {
        throw new Error('Monitor not initialized');
      }
      
      await this.monitor.startMonitoring(folderPath);
      
    } catch (error) {
      this.cli.displayError('Error starting file monitoring', error as Error);
      throw error;
    }
  }

  private cleanup(): void {
    this.cli.close();
    if (this.templatePromptService) {
      this.templatePromptService.close();
    }
  }
}

// Handle uncaught errors
process.on('uncaughtException', (error) => {
  console.error('\n💥 Uncaught Exception:', error.message);
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('\n💥 Unhandled Rejection at:', promise, 'reason:', reason);
  process.exit(1);
});

// Run the application
if (require.main === module) {
  const app = new LegalDocumentOrganizer();
  app.run().catch((error) => {
    console.error('\n💥 Application failed:', error.message);
    process.exit(1);
  });
}