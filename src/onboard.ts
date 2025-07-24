import * as dotenv from 'dotenv';
import { DocumentClassifierService } from './services/documentClassifier';
import { FileOrganizerService } from './services/fileOrganizer';
import { MetadataService } from './services/metadataService';
import { MemoryService } from './services/memoryService';
import { CLIUtils } from './utils/cli';
import * as path from 'path';
import * as fs from 'fs';

// Load environment variables
dotenv.config();

class FolderOnboarder {
  private cli: CLIUtils;
  private classifier: DocumentClassifierService | null = null;
  private organizer: FileOrganizerService;
  private metadataService: MetadataService | null = null;
  private memoryService: MemoryService | null = null;

  constructor() {
    this.cli = new CLIUtils();
    this.organizer = new FileOrganizerService();
  }

  async onboardFolder(targetFolder: string): Promise<void> {
    try {
      this.cli.displayWelcome();
      
      // Verify target folder exists
      if (!fs.existsSync(targetFolder)) {
        this.cli.displayError(`Target folder does not exist: ${targetFolder}`);
        throw new Error('Target folder not found');
      }
      
      const absolutePath = path.resolve(targetFolder);
      this.cli.displayInfo(`🎯 Onboarding folder: ${absolutePath}`);
      
      // Check for API keys
      const apiKey = await this.getOpenAIApiKey();
      const geminiApiKey = this.getGeminiApiKey();
      
      // Initialize services
      this.classifier = new DocumentClassifierService(apiKey, geminiApiKey);
      this.metadataService = new MetadataService(apiKey, geminiApiKey);
      this.memoryService = new MemoryService(absolutePath);
      
      // Set metadata service in organizer
      this.organizer.setMetadataService(this.metadataService);
      
      // Step 1: Find all files to organize BEFORE creating memory files
      this.cli.displayInfo('🔍 Scanning for existing files...');
      const files = await this.organizer.getAllFiles(absolutePath);
      
      // Step 2: Create PARA folder structure
      this.cli.displayInfo('📁 Creating PARA folder structure...');
      await this.organizer.createFolderStructure(absolutePath);
      this.cli.displaySuccess('✅ Folder structure created successfully!');
      
      // Step 3: Create company configuration file
      this.cli.displayInfo('📝 Creating company configuration...');
      await this.createCompanyConfig(absolutePath);
      this.cli.displaySuccess('✅ Company configuration created!');
      
      if (files.length === 0) {
        this.cli.displayWarning('No files found to organize. Onboarding complete!');
        this.cli.close();
        return;
      }
      
      this.cli.displayInfo(`Found ${files.length} files to organize.`);
      
      // Step 4: Process and organize all files
      this.cli.displayInfo('🚀 Starting automated organization...');
      
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
          const result = await this.organizer.organizeFile(file, classification, absolutePath);
          
          if (result.success) {
            successCount++;
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
      
      // Step 5: Build comprehensive memory from all documents
      if (successCount > 0 && this.memoryService) {
        this.cli.displayInfo('\n🧠 Building comprehensive memory from all documents...');
        try {
          await this.memoryService.refreshAllMemory();
          this.cli.displaySuccess('✅ Memory files created successfully!');
        } catch (error) {
          console.error('⚠️  Memory refresh failed:', error);
        }
      }
      
      this.cli.displaySuccess(`\n✅ Onboarding complete for: ${absolutePath}`);
      this.cli.displayInfo('📂 Your documents are now organized in the PARA structure!');
      this.cli.displayInfo('🧠 Memory files are available in the memory folder');
      this.cli.close();
      
    } catch (error) {
      this.cli.displayError('Onboarding error', error as Error);
      this.cli.close();
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
  
  private async createCompanyConfig(folderPath: string): Promise<void> {
    const companyName = path.basename(folderPath);
    const timestamp = new Date().toISOString();
    
    // Create company config file
    const configContent = {
      company_name: companyName,
      folder_path: folderPath,
      onboarded_date: timestamp,
      configuration: {
        auto_organize: true,
        generate_metadata: true,
        monitor_enabled: false,
        custom_rules: []
      },
      statistics: {
        total_documents: 0,
        organized_documents: 0,
        templates_identified: 0,
        last_processed: null
      }
    };
    
    const configPath = path.join(folderPath, '.para_config.json');
    await fs.promises.writeFile(configPath, JSON.stringify(configContent, null, 2), 'utf8');
  }
}

// Parse command line arguments
function parseArgs(): string | null {
  const args = process.argv.slice(2);
  
  // Handle both --folder=value and --folder value formats
  for (let i = 0; i < args.length; i++) {
    if (args[i].startsWith('--folder=')) {
      return args[i].substring('--folder='.length);
    }
    if (args[i] === '--folder' && i + 1 < args.length) {
      return args[i + 1];
    }
  }
  
  return null;
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

// Run the onboarding
if (require.main === module) {
  const targetFolder = parseArgs();
  
  if (!targetFolder) {
    console.error('❌ Error: Please specify a target folder');
    console.error('Usage: npm run onboard -- --folder="/path/to/folder"');
    process.exit(1);
  }
  
  const onboarder = new FolderOnboarder();
  onboarder.onboardFolder(targetFolder).catch((error) => {
    console.error('\n💥 Onboarding failed:', error.message);
    process.exit(1);
  });
}