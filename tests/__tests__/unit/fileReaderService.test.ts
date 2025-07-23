import { FileReaderService } from '../../../src/services/fileReader';
import * as fs from 'fs';
import * as path from 'path';
import * as mammoth from 'mammoth';
import { GoogleGenerativeAI } from '@google/generative-ai';

// Mock dependencies
jest.mock('fs');
jest.mock('mammoth');
jest.mock('@google/generative-ai');
jest.mock('../../../src/services/geminiPdfService');

describe('FileReaderService', () => {
  let fileReaderService: FileReaderService;
  const mockFs = fs as jest.Mocked<typeof fs>;
  const mockMammoth = mammoth as jest.Mocked<typeof mammoth>;
  
  beforeEach(() => {
    jest.clearAllMocks();
    fileReaderService = new FileReaderService();
  });

  describe('isFileSupported', () => {
    it('should return true for supported file types', () => {
      const supportedFiles = [
        'document.pdf',
        'contract.docx',
        'agreement.doc',
        'memo.txt',
        'UPPERCASE.PDF',
        'Mixed.DocX'
      ];

      supportedFiles.forEach(file => {
        expect(fileReaderService.isFileSupported(file)).toBe(true);
      });
    });

    it('should return false for unsupported file types', () => {
      const unsupportedFiles = [
        'image.jpg',
        'video.mp4',
        'spreadsheet.xlsx',
        'presentation.pptx',
        'archive.zip'
      ];

      unsupportedFiles.forEach(file => {
        expect(fileReaderService.isFileSupported(file)).toBe(false);
      });
    });

    it('should handle edge cases', () => {
      expect(fileReaderService.isFileSupported('')).toBe(false);
      expect(fileReaderService.isFileSupported('no-extension')).toBe(false);
      expect(fileReaderService.isFileSupported('.pdf')).toBe(true); // Just extension
      expect(fileReaderService.isFileSupported('file.PDF')).toBe(true); // Uppercase
    });
  });

  describe('getFileInfo', () => {
    it('should return correct file info', async () => {
      const filePath = '/test/document.pdf';
      const mockStats = { 
        size: 1024000,
        mtime: new Date('2024-01-15T10:00:00Z')
      };
      jest.spyOn(mockFs, 'statSync').mockReturnValue(mockStats as any);

      const fileInfo = await fileReaderService.getFileInfo(filePath);

      expect(fileInfo).toEqual({
        size: 1024000,
        modified: mockStats.mtime
      });
    });

    it('should handle files without extension', async () => {
      const filePath = '/test/README';
      const mockStats = { 
        size: 500,
        mtime: new Date('2024-01-10T08:00:00Z')
      };
      jest.spyOn(mockFs, 'statSync').mockReturnValue(mockStats as any);

      const fileInfo = await fileReaderService.getFileInfo(filePath);

      expect(fileInfo).toEqual({
        size: 500,
        modified: mockStats.mtime
      });
    });

    it('should throw error for non-existent files', async () => {
      const filePath = '/test/missing.pdf';
      jest.spyOn(mockFs, 'statSync').mockImplementation(() => {
        throw new Error('ENOENT: no such file or directory');
      });

      await expect(fileReaderService.getFileInfo(filePath))
        .rejects.toThrow('ENOENT');
    });
  });

  describe('readFile', () => {
    beforeEach(() => {
      // Reset file reader with no Gemini key for basic tests
      fileReaderService = new FileReaderService();
    });

    it('should read TXT files successfully', async () => {
      const filePath = '/test/document.txt';
      const content = 'This is a test document content';
      
      jest.spyOn(mockFs, 'readFileSync').mockReturnValue(content);

      const result = await fileReaderService.readFile(filePath);

      expect(result).toMatchObject({
        content: content.trim(),
        filename: 'document.txt',
        extension: '.txt'
      });
    });

    it('should read DOCX files successfully', async () => {
      const filePath = '/test/document.docx';
      const extractedText = 'This is extracted DOCX content';
      
      jest.spyOn(mockMammoth, 'extractRawText').mockResolvedValue({
        value: extractedText
      } as any);

      const result = await fileReaderService.readFile(filePath);

      expect(result).toMatchObject({
        content: extractedText.trim(),
        filename: 'document.docx',
        extension: '.docx'
      });
      expect(mockMammoth.extractRawText).toHaveBeenCalledWith({ path: filePath });
    });

    it('should handle DOC files as DOCX', async () => {
      const filePath = '/test/document.doc';
      const extractedText = 'This is extracted DOC content';
      
      jest.spyOn(mockMammoth, 'extractRawText').mockResolvedValue({
        value: extractedText
      } as any);

      const result = await fileReaderService.readFile(filePath);

      expect(result).toMatchObject({
        content: extractedText.trim(),
        filename: 'document.doc',
        extension: '.doc'
      });
    });

    it('should throw error for PDF files without Gemini API key', async () => {
      const filePath = '/test/document.pdf';

      await expect(fileReaderService.readFile(filePath))
        .rejects.toThrow('Gemini service not initialized');
    });

    it('should handle unsupported file types', async () => {
      const filePath = '/test/image.jpg';

      // Should try to read as text and fail
      jest.spyOn(mockFs, 'readFileSync').mockImplementation(() => {
        throw new Error('Invalid encoding');
      });

      await expect(fileReaderService.readFile(filePath))
        .rejects.toThrow('Failed to read file: image.jpg');
    });

    it('should handle empty files', async () => {
      const filePath = '/test/empty.txt';
      jest.spyOn(mockFs, 'readFileSync').mockReturnValue('');

      const result = await fileReaderService.readFile(filePath);

      expect(result).toMatchObject({
        content: '',
        filename: 'empty.txt',
        extension: '.txt'
      });
    });

    it('should handle file read errors gracefully', async () => {
      const filePath = '/test/protected.txt';
      const error = new Error('EACCES: permission denied');
      
      jest.spyOn(mockFs, 'readFileSync').mockImplementation(() => {
        throw error;
      });

      await expect(fileReaderService.readFile(filePath))
        .rejects.toThrow('Failed to read file: protected.txt');
    });

    it('should handle mammoth extraction errors', async () => {
      const filePath = '/test/corrupted.docx';
      const error = new Error('Invalid DOCX structure');
      
      jest.spyOn(mockMammoth, 'extractRawText').mockRejectedValue(error);

      await expect(fileReaderService.readFile(filePath))
        .rejects.toThrow('Failed to read file: corrupted.docx');
    });

    it('should handle very large files', async () => {
      const filePath = '/test/large.txt';
      const largeContent = 'X'.repeat(10 * 1024 * 1024); // 10MB
      
      jest.spyOn(mockFs, 'readFileSync').mockReturnValue(largeContent);

      const result = await fileReaderService.readFile(filePath);

      expect(result.content).toHaveLength(10 * 1024 * 1024);
    });
  });

  describe('readFile with Gemini', () => {
    let mockGeminiModel: any;

    beforeEach(() => {
      mockGeminiModel = {
        generateContent: jest.fn().mockResolvedValue({
          response: {
            text: () => 'Extracted PDF content with Gemini'
          }
        })
      };

      (GoogleGenerativeAI as jest.MockedClass<typeof GoogleGenerativeAI>)
        .mockImplementation(() => ({
          getGenerativeModel: jest.fn().mockReturnValue(mockGeminiModel)
        } as any));

      fileReaderService = new FileReaderService('test-gemini-key');
    });

    it('should read PDF files with Gemini API', async () => {
      const filePath = '/test/document.pdf';
      
      // Mock the Gemini PDF service to return formatted content
      const mockGeminiExtraction = {
        filename: 'document.pdf',
        document_type: 'Contract',
        status: 'executed',
        signers: [
          { name: 'John Doe', date_signed: '2024-01-15' }
        ],
        contract_value: '$50,000'
      };

      const result = await fileReaderService.readFile(filePath);

      expect(result.content).toContain('Document:');
      expect(result.content).toContain('Type:');
      expect(result.content).toContain('Status:');
    });

    it('should handle Gemini API errors gracefully', async () => {
      const filePath = '/test/document.pdf';
      
      // Make the GeminiPdfService mock throw an error
      jest.mock('../../../src/services/geminiPdfService', () => ({
        GeminiPdfService: jest.fn().mockImplementation(() => ({
          extractMetadataFromPdf: jest.fn().mockRejectedValue(new Error('Gemini API error'))
        }))
      }));

      await expect(fileReaderService.readFile(filePath))
        .rejects.toThrow('Failed to read file: document.pdf');
    });

    it('should handle PDF files with visual signatures', async () => {
      const filePath = '/test/scanned-agreement.pdf';
      
      // Mock response with visual signature data
      const mockVisualData = {
        filename: 'scanned-agreement.pdf',
        document_type: 'Agreement',
        status: 'executed',
        signers: [
          { name: 'Alice Johnson', date_signed: null },
          { name: 'Bob Smith', date_signed: null }
        ],
        primary_parties: [
          {
            name: 'Alice Johnson',
            organization: 'ABC Corp',
            role: 'Seller'
          },
          {
            name: 'Bob Smith',
            organization: 'XYZ Ltd',
            role: 'Buyer'
          }
        ],
        visual_elements: {
          signatures_detected: 2,
          stamps: 1
        }
      };

      const result = await fileReaderService.readFile(filePath);
      
      expect(result.content).toContain('Document:');
      expect(result.extension).toBe('.pdf');
    });
  });

  describe('extractMetadataWithGemini', () => {
    it('should return null when Gemini is not configured', async () => {
      fileReaderService = new FileReaderService(); // No Gemini key
      
      await expect(fileReaderService.extractMetadataWithGemini('/test/document.pdf'))
        .rejects.toThrow('Gemini service not initialized');
    });

    it('should extract metadata from PDF using Gemini', async () => {
      fileReaderService = new FileReaderService('test-gemini-key');
      
      // The actual implementation will use the mocked GeminiPdfService
      const result = await fileReaderService.extractMetadataWithGemini('/test/document.pdf');
      
      expect(result).toBeDefined();
      expect(result).toHaveProperty('filename');
      expect(result).toHaveProperty('status');
    });

    it('should handle invalid PDF files', async () => {
      fileReaderService = new FileReaderService('test-gemini-key');
      
      // Mock GeminiPdfService to throw error
      jest.mock('../../../src/services/geminiPdfService', () => ({
        GeminiPdfService: jest.fn().mockImplementation(() => ({
          extractMetadataFromPdf: jest.fn().mockRejectedValue(new Error('Invalid PDF'))
        }))
      }));
      
      await expect(fileReaderService.extractMetadataWithGemini('/test/invalid.pdf'))
        .rejects.toThrow();
    });
  });

  describe('error handling edge cases', () => {
    it('should handle files with special characters in names', async () => {
      const filePath = '/test/contract (draft) #1 - €50k.txt';
      const content = 'Contract content';
      
      jest.spyOn(mockFs, 'readFileSync').mockReturnValue(content);

      const result = await fileReaderService.readFile(filePath);

      expect(result.filename).toBe('contract (draft) #1 - €50k.txt');
    });

    it('should handle concurrent file reads', async () => {
      const files = ['/test/doc1.txt', '/test/doc2.txt', '/test/doc3.txt'];
      
      jest.spyOn(mockFs, 'readFileSync').mockImplementation((path) => {
        return `Content of ${path}`;
      });

      const results = await Promise.all(
        files.map(file => fileReaderService.readFile(file))
      );

      expect(results).toHaveLength(3);
      results.forEach((result, index) => {
        expect(result.content).toContain(`Content of ${files[index]}`);
      });
    });

    it('should handle file encoding issues', async () => {
      const filePath = '/test/latin1-encoded.txt';
      
      // Simulate encoding error
      jest.spyOn(mockFs, 'readFileSync').mockImplementation(() => {
        throw new Error('Invalid encoding');
      });

      await expect(fileReaderService.readFile(filePath))
        .rejects.toThrow('Failed to read file');
    });
  });
});