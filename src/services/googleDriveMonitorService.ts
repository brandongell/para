import { GoogleDriveService, DriveFile } from './googleDriveService';
import { DocumentClassifierService } from './documentClassifier';
import { FileOrganizerService } from './fileOrganizer';
import { MetadataService } from './metadataService';
import { MemoryService } from './memoryService';
import * as path from 'path';
import * as fs from 'fs/promises';
import * as os from 'os';
import { v4 as uuidv4 } from 'uuid';

export interface ProcessingJob {
  id: string;
  fileId: string;
  fileName: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  error?: string;
  createdAt: Date;
}

export class GoogleDriveMonitorService {
  private driveService: GoogleDriveService;
  private classifier: DocumentClassifierService;
  private organizer: FileOrganizerService;
  private metadataService: MetadataService;
  private memoryService: MemoryService | null = null;
  
  private monitoredFolderId: string;
  private organizationFolderMap: Map<string, string> = new Map();
  private processingQueue: ProcessingJob[] = [];
  private isProcessing: boolean = false;
  private pageToken: string = '';
  private tempDir: string;

  constructor(
    driveService: GoogleDriveService,
    openaiApiKey: string,
    geminiApiKey?: string,
    monitoredFolderId: string = ''
  ) {
    this.driveService = driveService;
    this.classifier = new DocumentClassifierService(openaiApiKey, geminiApiKey);
    this.organizer = new FileOrganizerService();
    this.metadataService = new MetadataService(openaiApiKey, geminiApiKey);
    this.monitoredFolderId = monitoredFolderId;
    this.tempDir = path.join(os.tmpdir(), 'legal-doc-organizer');
    
    // Set metadata service in organizer
    this.organizer.setMetadataService(this.metadataService);
    
    // Create temp directory
    this.initializeTempDir();
  }

  private async initializeTempDir(): Promise<void> {
    try {
      await fs.mkdir(this.tempDir, { recursive: true });
    } catch (error) {
      console.error('Error creating temp directory:', error);
    }
  }

  /**
   * Initialize the monitor with a folder ID
   */
  async initialize(folderId: string): Promise<void> {
    this.monitoredFolderId = folderId;
    
    // Initialize memory service with Drive folder
    this.memoryService = new MemoryService(this.tempDir);
    
    // Create folder structure in Drive
    console.log('📁 Creating organized folder structure in Google Drive...');
    this.organizationFolderMap = await this.driveService.createFolderStructure(folderId);
    
    // Get initial page token for changes
    this.pageToken = await this.driveService.getStartPageToken();
    
    console.log('✅ Google Drive monitor initialized');
    console.log(`📂 Monitoring folder ID: ${folderId}`);
  }

  /**
   * Process webhook notification
   */
  async handleWebhookNotification(headers: any, body: any): Promise<void> {
    console.log('🔔 Webhook notification received');
    
    // Google sends a sync message first
    if (headers['x-goog-resource-state'] === 'sync') {
      console.log('📡 Sync message received');
      return;
    }
    
    // Queue processing of changes
    this.queueChangesProcessing();
  }

  /**
   * Queue processing of changes
   */
  private queueChangesProcessing(): void {
    // Debounce multiple notifications
    if (!this.isProcessing) {
      setTimeout(() => this.processChanges(), 1000);
    }
  }

  /**
   * Process changes from Google Drive
   */
  private async processChanges(): Promise<void> {
    if (this.isProcessing) return;
    
    this.isProcessing = true;
    
    try {
      console.log('🔍 Checking for changes...');
      
      const { changes, newPageToken } = await this.driveService.getChanges(this.pageToken);
      this.pageToken = newPageToken;
      
      for (const change of changes) {
        if (change.removed) {
          console.log(`🗑️  File removed: ${change.fileId}`);
          continue;
        }
        
        const file = change.file;
        if (!file || !this.isFileInMonitoredFolder(file)) {
          continue;
        }
        
        // Check if it's a supported file type
        if (this.isSupportedFileType(file.mimeType)) {
          this.addToProcessingQueue(file);
        }
      }
      
      // Process the queue
      await this.processQueue();
      
    } catch (error) {
      console.error('❌ Error processing changes:', error);
    } finally {
      this.isProcessing = false;
    }
  }

  /**
   * Check if file is in monitored folder
   */
  private isFileInMonitoredFolder(file: any): boolean {
    return file.parents && file.parents.includes(this.monitoredFolderId);
  }

  /**
   * Check if file type is supported
   */
  private isSupportedFileType(mimeType: string): boolean {
    const supportedTypes = [
      'application/pdf',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/msword',
      'text/plain'
    ];
    
    return supportedTypes.includes(mimeType);
  }

  /**
   * Add file to processing queue
   */
  private addToProcessingQueue(file: DriveFile): void {
    const job: ProcessingJob = {
      id: uuidv4(),
      fileId: file.id,
      fileName: file.name,
      status: 'pending',
      createdAt: new Date()
    };
    
    this.processingQueue.push(job);
    console.log(`📥 Added to queue: ${file.name}`);
  }

  /**
   * Process the file queue
   */
  private async processQueue(): Promise<void> {
    while (this.processingQueue.length > 0) {
      const job = this.processingQueue.find(j => j.status === 'pending');
      if (!job) break;
      
      job.status = 'processing';
      
      try {
        await this.processFile(job);
        job.status = 'completed';
        console.log(`✅ Processed: ${job.fileName}`);
      } catch (error) {
        job.status = 'failed';
        job.error = error instanceof Error ? error.message : 'Unknown error';
        console.error(`❌ Failed to process ${job.fileName}:`, error);
      }
      
      // Remove completed/failed jobs after 5 minutes
      setTimeout(() => {
        const index = this.processingQueue.findIndex(j => j.id === job.id);
        if (index > -1) {
          this.processingQueue.splice(index, 1);
        }
      }, 5 * 60 * 1000);
    }
  }

  /**
   * Process a single file
   */
  private async processFile(job: ProcessingJob): Promise<void> {
    console.log(`\n🔄 Processing: ${job.fileName}`);
    
    // Download file to temp directory
    const tempFilePath = path.join(this.tempDir, `${job.id}_${job.fileName}`);
    
    try {
      // Download the file
      await this.driveService.downloadFile(job.fileId, tempFilePath);
      
      // Classify the document
      const classification = await this.classifier.classifyFile(tempFilePath);
      
      // Determine destination folder
      const destFolderId = this.getDestinationFolderId(classification.category);
      
      if (!destFolderId) {
        throw new Error(`No destination folder for category: ${classification.category}`);
      }
      
      // Move file to organized folder
      await this.driveService.moveFile(job.fileId, destFolderId);
      
      // Generate metadata
      const metadata = await this.metadataService.generateMetadata(tempFilePath, classification);
      
      // Save metadata as Drive file properties
      if (metadata) {
        const properties: { [key: string]: string } = {
          status: metadata.status || 'unknown',
          category: metadata.category || '',
          document_type: metadata.document_type || '',
          classification_confidence: classification.confidence || ''
        };
        
        if (metadata.signers && metadata.signers.length > 0) {
          properties.signers = JSON.stringify(metadata.signers);
        }
        
        if (metadata.effective_date) {
          properties.effective_date = metadata.effective_date;
        }
        
        await this.driveService.updateFileProperties(job.fileId, properties);
        
        // Update memory if available
        if (this.memoryService && metadata) {
          try {
            // Get the new file location for memory update
            const fileMetadata = await this.driveService.getFileMetadata(job.fileId);
            await this.memoryService.updateMemoryForDocument(
              fileMetadata.webViewLink || job.fileName,
              metadata
            );
            console.log(`🧠 Memory updated for: ${job.fileName}`);
          } catch (error) {
            console.error(`⚠️  Failed to update memory:`, error);
          }
        }
      }
      
      console.log(`📂 Moved to: ${classification.category}`);
      
    } finally {
      // Clean up temp file
      try {
        await fs.unlink(tempFilePath);
      } catch (error) {
        console.error('Error cleaning up temp file:', error);
      }
    }
  }

  /**
   * Get destination folder ID for a category
   */
  private getDestinationFolderId(category: string): string | undefined {
    // Map categories to folder names
    const categoryToFolder: { [key: string]: string } = {
      'Corporate_Governance': '01_Corporate_and_Governance',
      'People_Employment': '02_People_and_Employment',
      'Finance_Investment': '03_Finance_and_Investment',
      'Sales_Revenue': '04_Sales_and_Revenue',
      'Operations_Vendors': '05_Operations_and_Vendors',
      'Technology_IP': '06_Technology_and_IP',
      'Marketing_Partnerships': '07_Marketing_and_Partnerships',
      'Risk_Compliance': '08_Risk_and_Compliance',
      'Templates': '09_Templates',
      'Archive': '10_Archive'
    };
    
    const folderName = categoryToFolder[category];
    return folderName ? this.organizationFolderMap.get(folderName) : undefined;
  }

  /**
   * Manually scan and process all files in monitored folder
   */
  async scanAndProcessFolder(): Promise<void> {
    console.log('🔍 Scanning folder for unorganized files...');
    
    try {
      const files = await this.driveService.listFiles(this.monitoredFolderId);
      
      for (const file of files) {
        if (this.isSupportedFileType(file.mimeType)) {
          this.addToProcessingQueue(file);
        }
      }
      
      if (this.processingQueue.length > 0) {
        console.log(`📋 Found ${this.processingQueue.length} files to process`);
        await this.processQueue();
      } else {
        console.log('✅ No unorganized files found');
      }
      
    } catch (error) {
      console.error('❌ Error scanning folder:', error);
    }
  }

  /**
   * Get processing status
   */
  getStatus(): {
    isProcessing: boolean;
    queueLength: number;
    jobs: ProcessingJob[];
    monitoredFolderId: string;
  } {
    return {
      isProcessing: this.isProcessing,
      queueLength: this.processingQueue.length,
      jobs: this.processingQueue,
      monitoredFolderId: this.monitoredFolderId
    };
  }
}