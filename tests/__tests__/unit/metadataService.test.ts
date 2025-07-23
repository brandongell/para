import { MetadataService } from '../../../src/services/metadataService';
import { FileReaderService } from '../../../src/services/fileReader';
import { OpenAIService } from '../../../src/services/openai';
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
    it('should generate metadata for regular document', async () => {
      const filePath = '/test/SAFE_Agreement.pdf';
      const expectedMetadata = mockDocuments.executedSAFE.metadata;
      
      mockFileReader.readFile.mockResolvedValue({
        content: mockDocuments.executedSAFE.content,
        type: 'pdf'
      });

      mockOpenAI.generateCompletion.mockResolvedValue({
        content: JSON.stringify(expectedMetadata)
      });

      const result = await metadataService.generateMetadataFile(filePath);

      expect(result.metadataPath).toBe('/test/SAFE_Agreement.pdf.metadata.json');
      expect(result.metadata).toEqual(expectedMetadata);
      expect(mockFs.writeFileSync).toHaveBeenCalledWith(
        '/test/SAFE_Agreement.pdf.metadata.json',
        JSON.stringify(expectedMetadata, null, 2)
      );
    });

    it('should detect and generate metadata for template', async () => {
      const filePath = '/test/NDA_Template_[BLANK].pdf';
      const expectedMetadata = mockDocuments.templateNDA.metadata;
      
      mockFileReader.readFile.mockResolvedValue({
        content: mockDocuments.templateNDA.content,
        type: 'pdf'
      });

      // OpenAI returns metadata with template analysis
      mockOpenAI.generateCompletion.mockResolvedValue({
        content: JSON.stringify(expectedMetadata)
      });

      const result = await metadataService.generateMetadataFile(filePath);

      expect(result.metadata.status).toBe('template');
      expect(result.metadata.template_analysis).toBeDefined();
      expect(result.metadata.template_analysis?.is_template).toBe(true);
      expect(result.metadata.template_analysis?.confidence).toBe('HIGH');
    });

    it('should skip if metadata file already exists', async () => {
      const filePath = '/test/existing.pdf';
      
      mockFs.existsSync.mockReturnValue(true);

      const result = await metadataService.generateMetadataFile(filePath);

      expect(result.metadataPath).toBe('/test/existing.pdf.metadata.json');
      expect(result.metadata).toBeNull();
      expect(mockFileReader.readFile).not.toHaveBeenCalled();
      expect(mockOpenAI.generateCompletion).not.toHaveBeenCalled();
    });

    it('should handle file read errors', async () => {
      const filePath = '/test/corrupted.pdf';
      
      mockFileReader.readFile.mockRejectedValue(new Error('Read error'));

      await expect(metadataService.generateMetadataFile(filePath))
        .rejects.toThrow('Failed to generate metadata: Read error');
    });

    it('should handle invalid JSON response from OpenAI', async () => {
      const filePath = '/test/document.pdf';
      
      mockFileReader.readFile.mockResolvedValue({
        content: 'Document content',
        type: 'pdf'
      });

      mockOpenAI.generateCompletion.mockResolvedValue({
        content: 'Invalid JSON'
      });

      await expect(metadataService.generateMetadataFile(filePath))
        .rejects.toThrow('Invalid metadata format from AI');
    });

    it('should use Gemini for PDF metadata when available', async () => {
      const filePath = '/test/document.pdf';
      const geminiMetadata = {
        signers: [{ name: 'John Doe', date_signed: null }],
        status: 'executed',
        contract_value: '$50,000'
      };
      
      // Create service with Gemini key
      metadataService = new MetadataService('test-openai-key', 'test-gemini-key');
      
      mockFileReader.extractMetadataWithGemini.mockResolvedValue(geminiMetadata);
      mockFileReader.readFile.mockResolvedValue({
        content: 'PDF content',
        type: 'pdf'
      });

      mockOpenAI.generateCompletion.mockResolvedValue({
        content: JSON.stringify({
          filename: 'document.pdf',
          status: 'not_executed',
          category: 'Finance_and_Investment',
          signers: [],
          fully_executed_date: null
        })
      });

      const result = await metadataService.generateMetadataFile(filePath);

      // Should merge Gemini results with OpenAI results
      expect(result.metadata.signers).toEqual(geminiMetadata.signers);
      expect(result.metadata.status).toBe('executed');
      expect(result.metadata.contract_value).toBe('$50,000');
      expect(mockFileReader.extractMetadataWithGemini).toHaveBeenCalledWith(filePath);
    });
  });

  describe('generateMetadataForOrganizedFile', () => {
    it('should generate metadata using original filename', async () => {
      const originalPath = '/temp/1234567890_Employment_Agreement.pdf';
      const organizedPath = '/organized/02_People/Employment_Agreement_1.pdf';
      
      mockFileReader.readFile.mockResolvedValue({
        content: 'Employment agreement content',
        type: 'pdf'
      });

      mockOpenAI.generateCompletion.mockResolvedValue({
        content: JSON.stringify({
          filename: 'Employment_Agreement.pdf', // Should use original filename
          status: 'executed',
          category: 'People_and_Employment',
          signers: [],
          fully_executed_date: null
        })
      });

      const result = await metadataService.generateMetadataForOrganizedFile(
        originalPath,
        organizedPath
      );

      expect(result.metadata.filename).toBe('Employment_Agreement.pdf');
      expect(result.metadataPath).toBe('/organized/02_People/Employment_Agreement_1.pdf.metadata.json');
      
      // Should read from organized path but use original filename in prompt
      expect(mockFileReader.readFile).toHaveBeenCalledWith(organizedPath);
      expect(mockOpenAI.generateCompletion).toHaveBeenCalledWith(
        expect.any(String),
        expect.stringContaining('Employment_Agreement.pdf'),
        expect.any(Object)
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

  describe('generateMetadataForExistingFiles', () => {
    it('should generate metadata for multiple files with progress', async () => {
      const rootPath = '/test/documents';
      const files = [
        { path: '/test/documents/doc1.pdf', metadata: null },
        { path: '/test/documents/doc2.pdf', metadata: null },
        { path: '/test/documents/doc3.pdf', metadata: null }
      ];
      
      const progressCallback = jest.fn();
      
      mockFileReader.readFile.mockResolvedValue({
        content: 'Document content',
        type: 'pdf'
      });

      mockOpenAI.generateCompletion.mockResolvedValue({
        content: JSON.stringify({
          filename: 'document.pdf',
          status: 'executed',
          category: 'Finance_and_Investment',
          signers: [],
          fully_executed_date: null
        })
      });

      // Mock the file system operations
      const originalGenerateMetadataFile = metadataService.generateMetadataFile;
      metadataService.generateMetadataFile = jest.fn()
        .mockImplementation(async (filePath) => {
          // Simulate delay
          await new Promise(resolve => setTimeout(resolve, 100));
          return originalGenerateMetadataFile.call(metadataService, filePath);
        });

      await metadataService.generateMetadataForExistingFiles(rootPath, progressCallback);

      // Progress should be called for each file
      expect(progressCallback).toHaveBeenCalledTimes(files.length);
      expect(progressCallback).toHaveBeenCalledWith(expect.objectContaining({
        current: expect.any(Number),
        total: files.length,
        file: expect.any(String)
      }));
    });
  });

  describe('template detection', () => {
    it('should detect templates from filename indicators', async () => {
      const templateFiles = [
        '/test/NDA_[BLANK].pdf',
        '/test/Agreement_[FORM].docx',
        '/test/Contract_(Template).pdf',
        '/test/Employment_Form.doc',
        '/test/Template_Agreement.pdf'
      ];

      mockFileReader.readFile.mockResolvedValue({
        content: 'Template content with [PLACEHOLDER] fields',
        type: 'pdf'
      });

      for (const filePath of templateFiles) {
        mockOpenAI.generateCompletion.mockResolvedValue({
          content: JSON.stringify({
            filename: path.basename(filePath),
            status: 'executed', // API might not detect template
            category: 'Legal',
            signers: [],
            fully_executed_date: null,
            template_analysis: {
              is_template: true,
              confidence: 'HIGH',
              indicators: ['Filename contains template indicator'],
              template_type: 'Legal Agreement',
              field_placeholders: ['[PLACEHOLDER]']
            }
          })
        });

        const result = await metadataService.generateMetadataFile(filePath);
        
        expect(result.metadata.status).toBe('template');
        expect(result.metadata.template_analysis?.is_template).toBe(true);
      }
    });

    it('should not mark executed documents as templates', async () => {
      const filePath = '/test/NDA_Executed_2024.pdf';
      
      mockFileReader.readFile.mockResolvedValue({
        content: 'Executed NDA between parties',
        type: 'pdf'
      });

      mockOpenAI.generateCompletion.mockResolvedValue({
        content: JSON.stringify({
          filename: 'NDA_Executed_2024.pdf',
          status: 'executed',
          category: 'Legal',
          signers: [{ name: 'John Doe', date_signed: '2024-01-15' }],
          fully_executed_date: '2024-01-15'
        })
      });

      const result = await metadataService.generateMetadataFile(filePath);
      
      expect(result.metadata.status).toBe('executed');
      expect(result.metadata.template_analysis).toBeUndefined();
    });
  });
});