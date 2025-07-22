import * as fs from 'fs';
import * as path from 'path';
import { DocumentClassification, OrganizationResult, FolderStructure } from '../types';
import { MetadataService } from './metadataService';

export class FileOrganizerService {
  private metadataService: MetadataService | null = null;
  private folderStructure: FolderStructure = {
    '01_Corporate_and_Governance': [
      'Formation_and_Structure',
      'Board_and_Stockholder_Governance', 
      'Corporate_Transactions',
      'Founder_Documents'
    ],
    '02_People_and_Employment': [
      'Employment_Agreements',
      'Consulting_and_Services',
      'Equity_and_Compensation',
      'Confidentiality_and_IP'
    ],
    '03_Finance_and_Investment': [
      'Investment_and_Fundraising',
      'Banking_and_Finance',
      'Insurance_and_Risk',
      'Tax_and_Compliance'
    ],
    '04_Sales_and_Revenue': [
      'Customer_Agreements',
      'Terms_and_Policies',
      'Customer_NDAs',
      'Revenue_Operations'
    ],
    '05_Operations_and_Vendors': [
      'Vendor_Agreements',
      'Technology_Vendors',
      'Facilities_and_Real_Estate',
      'Operations_NDAs'
    ],
    '06_Technology_and_IP': [
      'Intellectual_Property',
      'Technology_Licensing',
      'Development_Agreements',
      'Data_and_Security'
    ],
    '07_Marketing_and_Partnerships': [
      'Partnership_Agreements',
      'Marketing_Agreements',
      'Business_Development',
      'Brand_and_Content'
    ],
    '08_Risk_and_Compliance': [
      'Regulatory_Compliance',
      'Legal_Proceedings',
      'Data_Privacy',
      'International_Compliance'
    ],
    '09_Templates': [
      'By_Category',
      'By_Department',
      'Template_Management'
    ],
    '10_Archive': [
      'By_Year',
      'By_Category',
      'Archive_Management'
    ]
  };

  setMetadataService(metadataService: MetadataService): void {
    this.metadataService = metadataService;
  }

  async organizeFile(
    filePath: string, 
    classification: DocumentClassification, 
    targetRootPath: string,
    generateMetadata: boolean = true
  ): Promise<OrganizationResult> {
    try {
      const filename = path.basename(filePath);
      
      // Validate classification
      const validatedClassification = this.validateClassification(classification);
      
      // Create target directory path
      const targetDir = path.join(
        targetRootPath,
        validatedClassification.primaryFolder,
        validatedClassification.subfolder
      );
      
      // Ensure target directory exists
      await this.ensureDirectoryExists(targetDir);
      
      // Create target file path
      const targetFilePath = path.join(targetDir, filename);
      
      // Handle duplicate filenames
      const finalTargetPath = await this.handleDuplicateFilename(targetFilePath);
      
      // Move the file
      await this.moveFile(filePath, finalTargetPath);
      
      console.log(`📁 Moved: ${filename} → ${path.relative(targetRootPath, finalTargetPath)}`);
      
      let metadataPath: string | undefined;
      
      // Generate metadata if requested and service is available
      if (generateMetadata && this.metadataService) {
        try {
          const metadataResult = await this.metadataService.generateMetadataForOrganizedFile(
            filePath, 
            finalTargetPath
          );
          
          if (metadataResult.success) {
            metadataPath = this.metadataService.getMetadataPath(finalTargetPath);
            console.log(`📋 Metadata created: ${path.basename(metadataPath)}`);
          } else {
            console.warn(`⚠️  Failed to generate metadata: ${metadataResult.error}`);
          }
        } catch (error) {
          console.warn(`⚠️  Metadata generation failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
      }
      
      return {
        success: true,
        originalPath: filePath,
        newPath: finalTargetPath,
        metadataPath: metadataPath
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      console.error(`❌ Failed to organize file ${filePath}:`, errorMessage);
      
      return {
        success: false,
        originalPath: filePath,
        error: errorMessage
      };
    }
  }

  private validateClassification(classification: DocumentClassification): DocumentClassification {
    // Ensure primary folder exists in our structure
    if (!this.folderStructure[classification.primaryFolder]) {
      console.warn(`⚠️  Invalid primary folder: ${classification.primaryFolder}, using default`);
      classification.primaryFolder = '01_Corporate_and_Governance';
    }
    
    // Ensure subfolder exists for this primary folder
    const validSubfolders = this.folderStructure[classification.primaryFolder];
    if (!validSubfolders.includes(classification.subfolder)) {
      console.warn(`⚠️  Invalid subfolder: ${classification.subfolder}, using first available subfolder`);
      classification.subfolder = validSubfolders[0]; // Use the first valid subfolder as fallback
    }
    
    return classification;
  }

  private async ensureDirectoryExists(dirPath: string): Promise<void> {
    if (!fs.existsSync(dirPath)) {
      fs.mkdirSync(dirPath, { recursive: true });
      console.log(`📂 Created directory: ${dirPath}`);
    }
  }

  private async handleDuplicateFilename(targetPath: string): Promise<string> {
    if (!fs.existsSync(targetPath)) {
      return targetPath;
    }
    
    const dir = path.dirname(targetPath);
    const ext = path.extname(targetPath);
    const nameWithoutExt = path.basename(targetPath, ext);
    
    let counter = 1;
    let newPath: string;
    
    do {
      newPath = path.join(dir, `${nameWithoutExt}_${counter}${ext}`);
      counter++;
    } while (fs.existsSync(newPath));
    
    console.log(`⚠️  Duplicate filename detected, using: ${path.basename(newPath)}`);
    return newPath;
  }

  private async moveFile(sourcePath: string, targetPath: string): Promise<void> {
    return new Promise((resolve, reject) => {
      fs.rename(sourcePath, targetPath, (error) => {
        if (error) {
          reject(error);
        } else {
          resolve();
        }
      });
    });
  }

  async createFolderStructure(rootPath: string): Promise<void> {
    console.log(`🏗️  Creating folder structure at: ${rootPath}`);
    
    for (const [primaryFolder, subfolders] of Object.entries(this.folderStructure)) {
      const primaryPath = path.join(rootPath, primaryFolder);
      await this.ensureDirectoryExists(primaryPath);
      
      for (const subfolder of subfolders) {
        const subfolderPath = path.join(primaryPath, subfolder);
        await this.ensureDirectoryExists(subfolderPath);
      }
    }
    
    console.log(`✅ Folder structure created successfully!`);
  }

  async getAllFiles(dirPath: string): Promise<string[]> {
    const files: string[] = [];
    
    const items = fs.readdirSync(dirPath);
    
    for (const item of items) {
      const fullPath = path.join(dirPath, item);
      const stat = fs.statSync(fullPath);
      
      if (stat.isFile()) {
        // Skip hidden files and system files
        if (!item.startsWith('.') && !item.startsWith('~')) {
          files.push(fullPath);
        }
      } else if (stat.isDirectory()) {
        // Skip the organized folders we create
        if (!Object.keys(this.folderStructure).includes(item)) {
          const subFiles = await this.getAllFiles(fullPath);
          files.push(...subFiles);
        }
      }
    }
    
    return files;
  }

  getFolderStructure(): FolderStructure {
    return this.folderStructure;
  }
}