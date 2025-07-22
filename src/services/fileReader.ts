import * as fs from 'fs';
import * as path from 'path';
import * as mammoth from 'mammoth';
import { GeminiPdfService } from './geminiPdfService';
import { FileContent } from '../types';

export class FileReaderService {
  private geminiService?: GeminiPdfService;

  constructor(geminiApiKey?: string) {
    if (geminiApiKey) {
      this.geminiService = new GeminiPdfService(geminiApiKey);
    }
  }

  async extractMetadataWithGemini(pdfPath: string) {
    if (!this.geminiService) {
      throw new Error('Gemini service not initialized - provide API key in constructor');
    }
    
    return await this.geminiService.extractMetadataFromPdf(pdfPath);
  }
  
  async readFile(filePath: string): Promise<FileContent> {
    const filename = path.basename(filePath);
    const extension = path.extname(filePath).toLowerCase();

    try {
      let content: string;

      switch (extension) {
        case '.pdf':
          content = await this.readPDFWithGemini(filePath);
          break;
        case '.docx':
          content = await this.readDOCX(filePath);
          break;
        case '.doc':
          content = await this.readDOC(filePath);
          break;
        case '.txt':
          content = await this.readTXT(filePath);
          break;
        default:
          // Try to read as text for other extensions
          content = await this.readTXT(filePath);
          break;
      }

      return {
        content: content.trim(),
        filename,
        extension
      };
    } catch (error) {
      console.error(`Error reading file ${filename}:`, error);
      throw new Error(`Failed to read file: ${filename}`);
    }
  }

  private async readPDFWithGemini(filePath: string): Promise<string> {
    if (!this.geminiService) {
      throw new Error('Gemini service not initialized - PDF extraction requires API key in constructor');
    }
    
    console.log('🔮 Using Gemini multimodal PDF extraction...');
    
    try {
      const metadata = await this.geminiService.extractMetadataFromPdf(filePath);
      
      // Convert metadata to readable content format
      let content = `Document: ${metadata.filename}\n`;
      content += `Type: ${metadata.document_type || 'Unknown'}\n`;
      content += `Status: ${metadata.status}\n`;
      
      if (metadata.signers && metadata.signers.length > 0) {
        content += '\nSigners:\n';
        metadata.signers.forEach((signer, i) => {
          content += `  ${i + 1}. ${signer.name}${signer.date_signed ? ` (${signer.date_signed})` : ''}\n`;
        });
      }
      
      if (metadata.primary_parties && metadata.primary_parties.length > 0) {
        content += '\nParties:\n';
        metadata.primary_parties.forEach((party, i) => {
          content += `  ${i + 1}. ${party.name}`;
          if (party.organization) content += ` - ${party.organization}`;
          if (party.role) content += ` (${party.role})`;
          content += '\n';
          if (party.address) content += `     Address: ${party.address}\n`;
          if (party.email) content += `     Email: ${party.email}\n`;
        });
      }
      
      if (metadata.effective_date) content += `\nEffective Date: ${metadata.effective_date}\n`;
      if (metadata.contract_value) content += `Contract Value: ${metadata.contract_value}\n`;
      if (metadata.governing_law) content += `Governing Law: ${metadata.governing_law}\n`;
      
      if (metadata.tags && metadata.tags.length > 0) {
        content += `\nTags: ${metadata.tags.join(', ')}\n`;
      }
      
      if (metadata.notes) content += `\nNotes: ${metadata.notes}\n`;
      
      console.log(`✅ Gemini extraction complete: ${content.length} chars`);
      return content;
      
    } catch (error) {
      console.error('Gemini PDF extraction failed:', error);
      throw new Error(`Failed to extract PDF content with Gemini: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }




  private async readDOCX(filePath: string): Promise<string> {
    const result = await mammoth.extractRawText({ path: filePath });
    return result.value;
  }

  private async readDOC(filePath: string): Promise<string> {
    // For older .doc files, mammoth can sometimes work, but may need additional handling
    try {
      const result = await mammoth.extractRawText({ path: filePath });
      return result.value;
    } catch (error) {
      console.warn(`Warning: Could not read .doc file ${filePath}, treating as text`);
      return this.readTXT(filePath);
    }
  }

  private async readTXT(filePath: string): Promise<string> {
    return fs.readFileSync(filePath, 'utf-8');
  }

  getSupportedExtensions(): string[] {
    return ['.pdf', '.docx', '.doc', '.txt'];
  }

  isFileSupported(filePath: string): boolean {
    const extension = path.extname(filePath).toLowerCase();
    return this.getSupportedExtensions().includes(extension);
  }

  async getFileInfo(filePath: string): Promise<{ size: number; modified: Date }> {
    const stats = fs.statSync(filePath);
    return {
      size: stats.size,
      modified: stats.mtime
    };
  }
}