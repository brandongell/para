import { FileReaderService } from '../../../src/services/fileReader';
import * as fs from 'fs';
import * as mammoth from 'mammoth';
import { GoogleGenerativeAI } from '@google/generative-ai';

// Mock dependencies
jest.mock('fs');
jest.mock('mammoth');
jest.mock('@google/generative-ai');

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
  });

  describe('getFileInfo', () => {
    it('should return correct file info', () => {
      const filePath = '/test/document.pdf';
      jest.spyOn(mockFs, 'statSync').mockReturnValue({ size: 1024000 } as any);

      const fileInfo = fileReaderService.getFileInfo(filePath);

      expect(fileInfo).toEqual({
        size: 1024000,
        extension: '.pdf',
        name: 'document.pdf'
      });
    });

    it('should handle files without extension', () => {
      const filePath = '/test/README';
      jest.spyOn(mockFs, 'statSync').mockReturnValue({ size: 500 } as any);

      const fileInfo = fileReaderService.getFileInfo(filePath);

      expect(fileInfo).toEqual({
        size: 500,
        extension: '',
        name: 'README'
      });
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
      
      mockFs.promises = {
        readFile: jest.fn().mockResolvedValue(content)
      } as any;

      const result = await fileReaderService.readFile(filePath);

      expect(result).toEqual({
        content,
        type: 'txt'
      });
      expect(mockFs.promises.readFile).toHaveBeenCalledWith(filePath, 'utf-8');
    });

    it('should read DOCX files successfully', async () => {
      const filePath = '/test/document.docx';
      const extractedText = 'This is extracted DOCX content';
      
      mockMammoth.extractRawText = jest.fn().mockResolvedValue({
        value: extractedText
      });

      const result = await fileReaderService.readFile(filePath);

      expect(result).toEqual({
        content: extractedText,
        type: 'docx'
      });
      expect(mockMammoth.extractRawText).toHaveBeenCalledWith({ path: filePath });
    });

    it('should handle DOC files as DOCX', async () => {
      const filePath = '/test/document.doc';
      const extractedText = 'This is extracted DOC content';
      
      mockMammoth.extractRawText = jest.fn().mockResolvedValue({
        value: extractedText
      });

      const result = await fileReaderService.readFile(filePath);

      expect(result).toEqual({
        content: extractedText,
        type: 'doc'
      });
    });

    it('should return error for PDF files without Gemini API key', async () => {
      const filePath = '/test/document.pdf';

      const result = await fileReaderService.readFile(filePath);

      expect(result).toEqual({
        content: 'Error: PDF extraction requires Gemini API key',
        type: 'pdf'
      });
    });

    it('should handle unsupported file types', async () => {
      const filePath = '/test/image.jpg';

      await expect(fileReaderService.readFile(filePath))
        .rejects.toThrow('Unsupported file type: .jpg');
    });

    it('should handle file read errors', async () => {
      const filePath = '/test/document.txt';
      const error = new Error('Permission denied');
      
      mockFs.promises = {
        readFile: jest.fn().mockRejectedValue(error)
      } as any;

      await expect(fileReaderService.readFile(filePath))
        .rejects.toThrow('Permission denied');
    });

    it('should handle mammoth extraction errors', async () => {
      const filePath = '/test/corrupted.docx';
      const error = new Error('Invalid DOCX structure');
      
      mockMammoth.extractRawText = jest.fn().mockRejectedValue(error);

      await expect(fileReaderService.readFile(filePath))
        .rejects.toThrow('Invalid DOCX structure');
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
      const pdfBuffer = Buffer.from('mock pdf content');
      
      mockFs.promises = {
        readFile: jest.fn().mockResolvedValue(pdfBuffer)
      } as any;

      const result = await fileReaderService.readFile(filePath);

      expect(result).toEqual({
        content: 'Extracted PDF content with Gemini',
        type: 'pdf'
      });
      expect(mockGeminiModel.generateContent).toHaveBeenCalled();
    });

    it('should handle Gemini API errors gracefully', async () => {
      const filePath = '/test/document.pdf';
      const pdfBuffer = Buffer.from('mock pdf content');
      
      mockFs.promises = {
        readFile: jest.fn().mockResolvedValue(pdfBuffer)
      } as any;

      mockGeminiModel.generateContent = jest.fn()
        .mockRejectedValue(new Error('Gemini API error'));

      const result = await fileReaderService.readFile(filePath);

      expect(result).toEqual({
        content: 'Error extracting PDF content: Gemini API error',
        type: 'pdf'
      });
    });
  });

  describe('extractMetadataWithGemini', () => {
    let mockGeminiModel: any;

    beforeEach(() => {
      mockGeminiModel = {
        generateContent: jest.fn().mockResolvedValue({
          response: {
            text: () => JSON.stringify({
              signers: [
                { name: 'John Doe', date_signed: '2024-01-15' }
              ],
              status: 'executed',
              contract_value: '$100,000'
            })
          }
        })
      };

      (GoogleGenerativeAI as jest.MockedClass<typeof GoogleGenerativeAI>)
        .mockImplementation(() => ({
          getGenerativeModel: jest.fn().mockReturnValue(mockGeminiModel)
        } as any));

      fileReaderService = new FileReaderService('test-gemini-key');
    });

    it('should extract metadata from PDF using Gemini', async () => {
      const filePath = '/test/document.pdf';
      const pdfBuffer = Buffer.from('mock pdf content');
      
      mockFs.promises = {
        readFile: jest.fn().mockResolvedValue(pdfBuffer)
      } as any;

      const result = await fileReaderService.extractMetadataWithGemini(filePath);

      expect(result).toEqual({
        signers: [
          { name: 'John Doe', date_signed: '2024-01-15' }
        ],
        status: 'executed',
        contract_value: '$100,000'
      });
    });

    it('should return null when Gemini is not configured', async () => {
      fileReaderService = new FileReaderService(); // No Gemini key
      
      const result = await fileReaderService.extractMetadataWithGemini('/test/document.pdf');
      
      expect(result).toBeNull();
    });

    it('should handle invalid JSON response', async () => {
      const filePath = '/test/document.pdf';
      const pdfBuffer = Buffer.from('mock pdf content');
      
      mockFs.promises = {
        readFile: jest.fn().mockResolvedValue(pdfBuffer)
      } as any;

      mockGeminiModel.generateContent = jest.fn().mockResolvedValue({
        response: {
          text: () => 'Invalid JSON response'
        }
      });

      const result = await fileReaderService.extractMetadataWithGemini(filePath);

      expect(result).toBeNull();
    });
  });
});