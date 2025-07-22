import * as fs from 'fs';
import * as path from 'path';
import { OpenAIService } from './openai';
import { FileReaderService } from './fileReader';
import { DocumentMetadata, MetadataExtractionResult, FileContent } from '../types';

export class MetadataService {
  private openaiService: OpenAIService;
  private fileReaderService: FileReaderService;

  constructor(openaiApiKey: string, geminiApiKey?: string) {
    this.openaiService = new OpenAIService(openaiApiKey);
    this.fileReaderService = new FileReaderService(geminiApiKey);
  }

  async generateMetadataFile(filePath: string): Promise<MetadataExtractionResult> {
    try {
      console.log(`📋 Generating metadata for: ${path.basename(filePath)}`);
      
      // Check if file is supported
      if (!this.fileReaderService.isFileSupported(filePath)) {
        console.warn(`⚠️  Unsupported file type for metadata extraction: ${filePath}`);
        return {
          success: false,
          error: 'Unsupported file type'
        };
      }

      // Read file content
      const fileContent: FileContent = await this.fileReaderService.readFile(filePath);
      
      if (!fileContent.content || fileContent.content.trim().length === 0) {
        console.warn(`⚠️  Empty file content for metadata extraction: ${filePath}`);
        return {
          success: false,
          error: 'Empty file content'
        };
      }

      // Extract metadata using AI
      const metadata = await this.openaiService.extractMetadata(
        fileContent.content,
        fileContent.filename
      );

      // Generate metadata file path
      const metadataPath = `${filePath}.metadata.json`;
      
      // Write metadata file
      await this.writeMetadataFile(metadataPath, metadata);
      
      console.log(`✅ Metadata generated: ${path.basename(metadataPath)}`);
      
      return {
        success: true,
        metadata: metadata
      };

    } catch (error) {
      console.error(`❌ Error generating metadata for ${filePath}:`, error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  async generateMetadataForOrganizedFile(
    originalFilePath: string, 
    organizedFilePath: string
  ): Promise<MetadataExtractionResult> {
    try {
      console.log(`📋 Generating metadata for organized file: ${path.basename(organizedFilePath)}`);
      
      // Check if file is supported
      if (!this.fileReaderService.isFileSupported(organizedFilePath)) {
        console.warn(`⚠️  Unsupported file type for metadata extraction: ${organizedFilePath}`);
        return {
          success: false,
          error: 'Unsupported file type'
        };
      }

      // Read file content from the organized location
      const fileContent: FileContent = await this.fileReaderService.readFile(organizedFilePath);
      
      if (!fileContent.content || fileContent.content.trim().length === 0) {
        console.warn(`⚠️  Empty file content for metadata extraction: ${organizedFilePath}`);
        return {
          success: false,
          error: 'Empty file content'
        };
      }

      // Extract metadata using AI with original filename for better context
      const originalFilename = path.basename(originalFilePath);
      const metadata = await this.openaiService.extractMetadata(
        fileContent.content,
        originalFilename
      );

      // Generate metadata file path next to the organized file
      const metadataPath = `${organizedFilePath}.metadata.json`;
      
      // Write metadata file
      await this.writeMetadataFile(metadataPath, metadata);
      
      console.log(`✅ Metadata generated: ${path.basename(metadataPath)}`);
      
      return {
        success: true,
        metadata: metadata
      };

    } catch (error) {
      console.error(`❌ Error generating metadata for ${organizedFilePath}:`, error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  private async writeMetadataFile(metadataPath: string, metadata: DocumentMetadata): Promise<void> {
    return new Promise((resolve, reject) => {
      const jsonContent = JSON.stringify(metadata, null, 2);
      
      fs.writeFile(metadataPath, jsonContent, 'utf8', (error) => {
        if (error) {
          reject(error);
        } else {
          resolve();
        }
      });
    });
  }

  async readMetadataFile(metadataPath: string): Promise<DocumentMetadata | null> {
    try {
      if (!fs.existsSync(metadataPath)) {
        return null;
      }

      const content = fs.readFileSync(metadataPath, 'utf8');
      return JSON.parse(content) as DocumentMetadata;
    } catch (error) {
      console.error(`❌ Error reading metadata file ${metadataPath}:`, error);
      return null;
    }
  }

  metadataFileExists(filePath: string): boolean {
    const metadataPath = `${filePath}.metadata.json`;
    return fs.existsSync(metadataPath);
  }

  getMetadataPath(filePath: string): string {
    return `${filePath}.metadata.json`;
  }

  async generateMetadataForExistingFiles(
    rootPath: string, 
    onProgress?: (current: number, total: number, filename: string) => void
  ): Promise<{ success: number; failed: number; skipped: number }> {
    const results = { success: 0, failed: 0, skipped: 0 };
    
    console.log(`🔍 Searching for files without metadata in: ${rootPath}`);
    const allFiles = await this.getAllOrganizedFiles(rootPath);
    
    if (allFiles.length === 0) {
      console.log('No files found for metadata generation.');
      return results;
    }

    console.log(`Found ${allFiles.length} files to check for metadata.`);

    for (let i = 0; i < allFiles.length; i++) {
      const filePath = allFiles[i];
      const filename = path.basename(filePath);
      
      if (onProgress) {
        onProgress(i + 1, allFiles.length, filename);
      }

      // Skip if metadata already exists
      if (this.metadataFileExists(filePath)) {
        results.skipped++;
        console.log(`⏭️  Skipping ${filename} - metadata already exists`);
        continue;
      }

      // Generate metadata
      const result = await this.generateMetadataFile(filePath);
      
      if (result.success) {
        results.success++;
      } else {
        results.failed++;
        console.error(`❌ Failed to generate metadata for ${filename}: ${result.error}`);
      }

      // Small delay to avoid overwhelming the API
      if (i < allFiles.length - 1) {
        await new Promise(resolve => setTimeout(resolve, 500));
      }
    }

    return results;
  }

  private async getAllOrganizedFiles(dirPath: string): Promise<string[]> {
    const files: string[] = [];
    
    if (!fs.existsSync(dirPath)) {
      return files;
    }

    const items = fs.readdirSync(dirPath);
    
    for (const item of items) {
      const fullPath = path.join(dirPath, item);
      const stat = fs.statSync(fullPath);
      
      if (stat.isFile()) {
        // Skip metadata files, hidden files, and system files
        if (!item.endsWith('.metadata.json') && 
            !item.startsWith('.') && 
            !item.startsWith('~')) {
          files.push(fullPath);
        }
      } else if (stat.isDirectory()) {
        // Recursively search subdirectories
        const subFiles = await this.getAllOrganizedFiles(fullPath);
        files.push(...subFiles);
      }
    }
    
    return files;
  }
}