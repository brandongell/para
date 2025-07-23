import { MetadataService } from '../../../src/services/metadataService';
import { FileReaderService } from '../../../src/services/fileReader';
import { OpenAIService } from '../../../src/services/openai';
import { DocumentMetadata } from '../../../src/types';
import * as fs from 'fs';
import * as path from 'path';
import { mockDocuments } from '../../fixtures/documents';

// Mock dependencies
jest.mock('../../../src/services/fileReader');
jest.mock('../../../src/services/openai');
jest.mock('fs');

describe('MetadataService', () => {
  let metadataService: MetadataService;
  let mockFileReader: jest.Mocked<FileReaderService>;
  let mockOpenAI: jest.Mocked<OpenAIService>;
  const mockFs = fs as jest.Mocked<typeof fs>;

  beforeEach(() => {
    jest.clearAllMocks();
    
    // Setup mocks
    mockFileReader = new FileReaderService() as jest.Mocked<FileReaderService>;
    mockOpenAI = new OpenAIService('test-key') as jest.Mocked<OpenAIService>;
    
    // Mock the constructor calls
    (FileReaderService as jest.MockedClass<typeof FileReaderService>)
      .mockImplementation(() => mockFileReader);
    (OpenAIService as jest.MockedClass<typeof OpenAIService>)
      .mockImplementation(() => mockOpenAI);
    
    metadataService = new MetadataService('test-openai-key');
    
    // Setup fs mocks
    jest.spyOn(mockFs, 'existsSync').mockReturnValue(false);
    jest.spyOn(mockFs, 'writeFileSync').mockImplementation(() => {});
    jest.spyOn(mockFs, 'readFileSync').mockImplementation(() => '');
  });

  describe('generateMetadataFile', () => {
    it('should generate metadata for non-PDF document', async () => {
      const filePath = '/test/Agreement.docx';
      const expectedMetadata = mockDocuments.executedSAFE.metadata;
      
      mockFileReader.isFileSupported.mockReturnValue(true);
      mockFileReader.readFile.mockResolvedValue({
        content: mockDocuments.executedSAFE.content,
        filename: 'Agreement.docx',
        extension: '.docx'
      });

      mockOpenAI.extractMetadata.mockResolvedValue(expectedMetadata);

      const result = await metadataService.generateMetadataFile(filePath);

      expect(result.success).toBe(true);
      expect(result.metadata).toEqual(expectedMetadata);
      expect(mockFs.writeFileSync).toHaveBeenCalledWith(
        '/test/Agreement.docx.metadata.json',
        JSON.stringify(expectedMetadata, null, 2)
      );
    });

    it('should use Gemini for PDF files', async () => {
      const filePath = '/test/SAFE_Agreement.pdf';
      const expectedMetadata = mockDocuments.executedSAFE.metadata;
      
      mockFileReader.isFileSupported.mockReturnValue(true);
      mockFileReader.extractMetadataWithGemini.mockResolvedValue(expectedMetadata);

      const result = await metadataService.generateMetadataFile(filePath);

      expect(result.success).toBe(true);
      expect(result.metadata).toEqual(expectedMetadata);
      expect(mockFileReader.extractMetadataWithGemini).toHaveBeenCalledWith(filePath);
      expect(mockOpenAI.extractMetadata).not.toHaveBeenCalled();
    });

    it('should handle unsupported file types', async () => {
      const filePath = '/test/image.jpg';
      
      mockFileReader.isFileSupported.mockReturnValue(false);

      const result = await metadataService.generateMetadataFile(filePath);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Unsupported file type');
      expect(mockFileReader.readFile).not.toHaveBeenCalled();
    });

    it('should handle empty file content', async () => {
      const filePath = '/test/empty.txt';
      
      mockFileReader.isFileSupported.mockReturnValue(true);
      mockFileReader.readFile.mockResolvedValue({
        content: '',
        filename: 'empty.txt',
        extension: '.txt'
      });

      const result = await metadataService.generateMetadataFile(filePath);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Empty file content');
      expect(mockOpenAI.extractMetadata).not.toHaveBeenCalled();
    });

    it('should handle file read errors', async () => {
      const filePath = '/test/corrupted.docx';
      
      mockFileReader.isFileSupported.mockReturnValue(true);
      mockFileReader.readFile.mockRejectedValue(new Error('Read error'));

      const result = await metadataService.generateMetadataFile(filePath);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Read error');
    });

    it('should handle OpenAI API errors', async () => {
      const filePath = '/test/document.txt';
      
      mockFileReader.isFileSupported.mockReturnValue(true);
      mockFileReader.readFile.mockResolvedValue({
        content: 'Document content',
        filename: 'document.txt',
        extension: '.txt'
      });

      mockOpenAI.extractMetadata.mockRejectedValue(new Error('API error'));

      const result = await metadataService.generateMetadataFile(filePath);

      expect(result.success).toBe(false);
      expect(result.error).toBe('API error');
    });
  });

  describe('generateMetadataForOrganizedFile', () => {
    it('should generate metadata using original filename', async () => {
      const originalPath = '/temp/1234567890_Employment_Agreement.pdf';
      const organizedPath = '/organized/02_People/Employment_Agreement_1.pdf';
      const originalFilename = 'Employment_Agreement.pdf';
      
      mockFileReader.isFileSupported.mockReturnValue(true);
      mockFileReader.readFile.mockResolvedValue({
        content: 'Employment agreement content',
        filename: 'Employment_Agreement_1.pdf',
        extension: '.pdf'
      });

      mockOpenAI.extractMetadata.mockResolvedValue({
        filename: originalFilename,
        status: 'executed',
        category: 'People_and_Employment',
        signers: [],
        fully_executed_date: null
      });

      const result = await metadataService.generateMetadataForOrganizedFile(
        originalPath,
        organizedPath
      );

      expect(result.success).toBe(true);
      expect(result.metadata?.filename).toBe(originalFilename);
      
      // Should read from organized path but use original filename in prompt
      expect(mockFileReader.readFile).toHaveBeenCalledWith(organizedPath);
      expect(mockOpenAI.extractMetadata).toHaveBeenCalledWith(
        'Employment agreement content',
        originalFilename
      );
    });
  });

  describe('readMetadataFile', () => {
    it('should read and parse metadata file', async () => {
      const metadataPath = '/test/document.pdf.metadata.json';
      const metadata = mockDocuments.executedSAFE.metadata;
      
      mockFs.existsSync.mockReturnValue(true);
      mockFs.readFileSync.mockReturnValue(JSON.stringify(metadata));

      const result = await metadataService.readMetadataFile(metadataPath);

      expect(result).toEqual(metadata);
      expect(mockFs.readFileSync).toHaveBeenCalledWith(metadataPath, 'utf-8');
    });

    it('should return null if file does not exist', async () => {
      const metadataPath = '/test/missing.pdf.metadata.json';
      
      mockFs.existsSync.mockReturnValue(false);

      const result = await metadataService.readMetadataFile(metadataPath);

      expect(result).toBeNull();
      expect(mockFs.readFileSync).not.toHaveBeenCalled();
    });

    it('should handle JSON parse errors', async () => {
      const metadataPath = '/test/corrupted.pdf.metadata.json';
      
      mockFs.existsSync.mockReturnValue(true);
      mockFs.readFileSync.mockReturnValue('Invalid JSON');

      await expect(metadataService.readMetadataFile(metadataPath))
        .rejects.toThrow();
    });
  });

  describe('template detection', () => {
    it('should properly handle template documents', async () => {
      const filePath = '/test/NDA_Template_[BLANK].docx';
      const templateMetadata: DocumentMetadata = {
        filename: 'NDA_Template_[BLANK].docx',
        status: 'template' as const,
        category: 'Legal',
        signers: [],
        fully_executed_date: null,
        template_analysis: {
          is_template: true,
          confidence: 'HIGH' as const,
          indicators: ['Filename contains [BLANK]'],
          template_type: 'Non-Disclosure Agreement',
          field_placeholders: ['[PARTY_NAME]', '[DATE]'],
          typical_use_case: 'Standard NDA template for confidentiality agreements'
        }
      };
      
      mockFileReader.isFileSupported.mockReturnValue(true);
      mockFileReader.readFile.mockResolvedValue({
        content: 'Template content with [PARTY_NAME] and [DATE] placeholders',
        filename: 'NDA_Template_[BLANK].docx',
        extension: '.docx'
      });

      mockOpenAI.extractMetadata.mockResolvedValue(templateMetadata);

      const result = await metadataService.generateMetadataFile(filePath);

      expect(result.success).toBe(true);
      expect(result.metadata?.status).toBe('template');
      expect(result.metadata?.template_analysis?.is_template).toBe(true);
    });

    it('should not mark executed documents as templates', async () => {
      const filePath = '/test/NDA_Executed_2024.pdf';
      
      mockFileReader.isFileSupported.mockReturnValue(true);
      mockFileReader.extractMetadataWithGemini.mockResolvedValue({
        filename: 'NDA_Executed_2024.pdf',
        status: 'executed',
        category: 'Legal',
        signers: [{ name: 'John Doe', date_signed: '2024-01-15' }],
        fully_executed_date: '2024-01-15'
      });

      const result = await metadataService.generateMetadataFile(filePath);
      
      expect(result.success).toBe(true);
      expect(result.metadata?.status).toBe('executed');
      expect(result.metadata?.template_analysis).toBeUndefined();
    });
  });
});