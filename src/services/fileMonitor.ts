import * as chokidar from 'chokidar';
import * as path from 'path';
import { DocumentClassifierService } from './documentClassifier';
import { FileOrganizerService } from './fileOrganizer';
import { MetadataService } from './metadataService';
import { MemoryService } from './memoryService';
import { TemplatePromptService } from './templatePromptService';

export class FileMonitorService {
  private watcher: chokidar.FSWatcher | null = null;
  private classifier: DocumentClassifierService;
  private organizer: FileOrganizerService;
  private metadataService: MetadataService;
  private memoryService: MemoryService | null = null;
  private templatePromptService: TemplatePromptService;
  private watchPath: string = '';
  private isProcessing: Map<string, boolean> = new Map();

  constructor(
    openaiApiKey: string, 
    geminiApiKey?: string,
    documensoConfig?: { apiUrl: string; apiToken: string; appUrl?: string }
  ) {
    this.classifier = new DocumentClassifierService(openaiApiKey, geminiApiKey);
    this.organizer = new FileOrganizerService();
    this.metadataService = new MetadataService(openaiApiKey, geminiApiKey);
    this.templatePromptService = new TemplatePromptService(documensoConfig);
    
    // Set metadata service in organizer
    this.organizer.setMetadataService(this.metadataService);
  }

  async startMonitoring(folderPath: string): Promise<void> {
    this.watchPath = folderPath;
    
    // Initialize memory service
    this.memoryService = new MemoryService(folderPath);
    
    console.log(`\n👀 Starting file monitoring for: ${folderPath}`);
    console.log('📝 Watching for new files to organize automatically...');
    console.log('🧠 Memory system enabled for quick information retrieval');
    console.log('⏹️  Press Ctrl+C to stop monitoring\n');

    // Configure watcher options
    const watchOptions = {
      ignored: [
        // Ignore organized folders we create
        path.join(folderPath, '0*_*/**'),
        // Ignore temporary and system files
        '**/.DS_Store',
        '**/Thumbs.db',
        '**/*.tmp',
        '**/*.temp',
        '**/~*',
        // Ignore very large files (>50MB)
        (filePath: string) => this.isFileTooLarge(filePath)
      ],
      ignoreInitial: true, // Don't trigger for existing files
      persistent: true,
      depth: 10, // Monitor subdirectories up to 10 levels deep
    };

    // Create and configure watcher
    this.watcher = chokidar.watch(folderPath, watchOptions);

    // Set up event handlers
    this.watcher
      .on('add', (filePath) => {
        console.log(`🔍 File watcher detected: ${filePath}`);
        this.handleNewFile(filePath);
      })
      .on('error', (error) => this.handleError(error))
      .on('ready', () => {
        console.log('✅ File monitoring is active and ready!');
      });

    // Handle graceful shutdown
    process.on('SIGINT', () => {
      console.log('\n\n🛑 Stopping file monitoring...');
      this.stopMonitoring();
      process.exit(0);
    });
  }

  private async handleNewFile(filePath: string): Promise<void> {
    const filename = path.basename(filePath);
    
    // Prevent duplicate processing
    if (this.isProcessing.get(filePath)) {
      return;
    }
    
    this.isProcessing.set(filePath, true);

    try {
      console.log(`\n🆕 New file detected: ${filename}`);
      
      // Small delay to ensure file is fully written
      await this.waitForFileStability(filePath);
      
      // Check if file still exists (might have been moved/deleted)
      if (!this.fileExists(filePath)) {
        console.log(`⚠️  File no longer exists, skipping: ${filename}`);
        return;
      }

      // Classify the document
      const classification = await this.classifier.classifyFile(filePath);
      
      // Organize the file with metadata generation
      const result = await this.organizer.organizeFile(
        filePath,
        classification,
        this.watchPath,
        true // Ensure metadata is generated
      );

      if (result.success) {
        console.log(`🎉 Successfully organized: ${filename}`);
        if (result.metadataPath) {
          console.log(`📋 Metadata created: ${path.basename(result.metadataPath)}`);
          
          // Read metadata to check if it's a template
          try {
            const fs = require('fs');
            const metadataContent = fs.readFileSync(result.metadataPath, 'utf-8');
            const metadata = JSON.parse(metadataContent);
            
            // Skip Documenso upload prompt in monitor mode to avoid readline errors
            // Template upload should be done through Discord bot instead
            if (metadata.status === 'template') {
              console.log(`📋 Template detected - skipping interactive upload prompt in monitor mode`);
            }
            
            // Update memory with new document
            if (this.memoryService) {
              console.log(`🧠 Updating memory with new document...`);
              try {
                await this.memoryService.updateMemoryForDocument(result.newPath!, metadata);
                console.log(`✅ Memory updated successfully`);
              } catch (memoryError) {
                console.error(`❌ Failed to update memory:`, memoryError);
                console.error(`   Document: ${result.newPath}`);
                console.error(`   Status: ${metadata.status}`);
                // Don't throw - continue processing other files
              }
            }
          } catch (error) {
            console.error(`⚠️  Failed to process metadata:`, error);
          }
        }
      } else {
        console.log(`❌ Failed to organize: ${filename} - ${result.error}`);
      }
      
    } catch (error) {
      console.error(`❌ Error processing file ${filename}:`, error);
    } finally {
      this.isProcessing.delete(filePath);
    }
  }

  private async waitForFileStability(filePath: string, maxWait: number = 5000): Promise<void> {
    const checkInterval = 500;
    let lastSize = 0;
    let stableCount = 0;
    let waited = 0;

    while (waited < maxWait) {
      try {
        const currentSize = this.getFileSize(filePath);
        
        if (currentSize === lastSize) {
          stableCount++;
          if (stableCount >= 2) { // File size stable for 2 checks
            return;
          }
        } else {
          stableCount = 0;
          lastSize = currentSize;
        }
        
        await new Promise(resolve => setTimeout(resolve, checkInterval));
        waited += checkInterval;
      } catch (error) {
        // File might not be accessible yet, wait a bit more
        await new Promise(resolve => setTimeout(resolve, checkInterval));
        waited += checkInterval;
      }
    }
  }

  private getFileSize(filePath: string): number {
    try {
      const fs = require('fs');
      const stats = fs.statSync(filePath);
      return stats.size;
    } catch {
      return 0;
    }
  }

  private fileExists(filePath: string): boolean {
    try {
      const fs = require('fs');
      return fs.existsSync(filePath);
    } catch {
      return false;
    }
  }

  private isFileTooLarge(filePath: string): boolean {
    try {
      const maxSize = 50 * 1024 * 1024; // 50MB
      const size = this.getFileSize(filePath);
      return size > maxSize;
    } catch {
      return false;
    }
  }

  private handleError(error: Error): void {
    console.error('❌ File monitoring error:', error.message);
  }

  stopMonitoring(): void {
    if (this.watcher) {
      this.watcher.close();
      this.watcher = null;
      console.log('✅ File monitoring stopped.');
    }
  }

  isMonitoring(): boolean {
    return this.watcher !== null;
  }

  getWatchedPath(): string {
    return this.watchPath;
  }
}