import { DocumentClassifierService } from '../../../src/services/documentClassifier';
import { FileReaderService } from '../../../src/services/fileReader';
import { OpenAIService } from '../../../src/services/openai';
import { DocumentClassification } from '../../../src/types';
import { mockDocuments } from '../../fixtures/documents';

// Mock dependencies
jest.mock('../../../src/services/fileReader');
jest.mock('../../../src/services/openai');

describe('DocumentClassifierService', () => {
  let classifierService: DocumentClassifierService;
  let mockFileReader: jest.Mocked<FileReaderService>;
  let mockOpenAI: jest.Mocked<OpenAIService>;

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
    
    classifierService = new DocumentClassifierService('test-openai-key');
  });

  describe('classifyFile', () => {
    it('should classify supported files successfully', async () => {
      const filePath = '/test/SAFE_Agreement.pdf';
      const fileContent = mockDocuments.executedSAFE.content;
      const expectedClassification = mockDocuments.executedSAFE.classification;

      mockFileReader.isFileSupported.mockReturnValue(true);
      mockFileReader.readFile.mockResolvedValue({
        content: fileContent,
        type: 'pdf'
      });

      mockOpenAI.generateCompletion.mockResolvedValue({
        content: JSON.stringify(expectedClassification)
      });

      const result = await classifierService.classifyFile(filePath);

      expect(result).toEqual(expectedClassification);
      expect(mockFileReader.readFile).toHaveBeenCalledWith(filePath);
      expect(mockOpenAI.generateCompletion).toHaveBeenCalledWith(
        expect.stringContaining('You are a legal document classification expert'),
        expect.stringContaining(fileContent),
        expect.objectContaining({
          temperature: 0.3,
          max_tokens: 1000
        })
      );
    });

    it('should use template classification when API response has is_template=true', async () => {
      const filePath = '/test/NDA_Template_[BLANK].pdf';
      const fileContent = mockDocuments.templateNDA.content;

      mockFileReader.isFileSupported.mockReturnValue(true);
      mockFileReader.readFile.mockResolvedValue({
        content: fileContent,
        type: 'pdf'
      });

      // API returns classification with is_template flag
      mockOpenAI.generateCompletion.mockResolvedValue({
        content: JSON.stringify({
          ...mockDocuments.templateNDA.classification,
          is_template: true
        })
      });

      const result = await classifierService.classifyFile(filePath);

      expect(result).toEqual({
        primaryFolder: '09_Templates',
        subfolder: 'Legal_Templates',
        confidence: expect.any(Number),
        reasoning: expect.stringContaining('template')
      });
    });

    it('should handle template detection from filename', async () => {
      const filePath = '/test/Employment_Agreement_[FORM].docx';
      
      mockFileReader.isFileSupported.mockReturnValue(true);
      mockFileReader.readFile.mockResolvedValue({
        content: 'Employment agreement template content',
        type: 'docx'
      });

      mockOpenAI.generateCompletion.mockResolvedValue({
        content: JSON.stringify({
          primaryFolder: '02_People_and_Employment',
          subfolder: 'Employment_Agreements',
          confidence: 0.9,
          reasoning: 'Employment agreement document'
        })
      });

      const result = await classifierService.classifyFile(filePath);

      // Should detect template from filename and override classification
      expect(result.primaryFolder).toBe('09_Templates');
      expect(result.subfolder).toBe('Legal_Templates');
      expect(result.reasoning).toContain('template');
    });

    it('should return default classification for unsupported files', async () => {
      const filePath = '/test/image.jpg';

      mockFileReader.isFileSupported.mockReturnValue(false);

      const result = await classifierService.classifyFile(filePath);

      expect(result).toEqual({
        primaryFolder: '10_Archive',
        subfolder: 'Unorganized',
        confidence: 0.0,
        reasoning: 'Unsupported file type'
      });
      expect(mockFileReader.readFile).not.toHaveBeenCalled();
    });

    it('should handle API errors gracefully', async () => {
      const filePath = '/test/document.pdf';

      mockFileReader.isFileSupported.mockReturnValue(true);
      mockFileReader.readFile.mockResolvedValue({
        content: 'Document content',
        type: 'pdf'
      });

      mockOpenAI.generateCompletion.mockRejectedValue(
        new Error('OpenAI API error')
      );

      const result = await classifierService.classifyFile(filePath);

      expect(result).toEqual({
        primaryFolder: '10_Archive',
        subfolder: 'Unorganized',
        confidence: 0.0,
        reasoning: 'Classification failed: OpenAI API error'
      });
    });

    it('should handle invalid JSON response from API', async () => {
      const filePath = '/test/document.pdf';

      mockFileReader.isFileSupported.mockReturnValue(true);
      mockFileReader.readFile.mockResolvedValue({
        content: 'Document content',
        type: 'pdf'
      });

      mockOpenAI.generateCompletion.mockResolvedValue({
        content: 'Invalid JSON'
      });

      const result = await classifierService.classifyFile(filePath);

      expect(result).toEqual({
        primaryFolder: '10_Archive',
        subfolder: 'Unorganized',
        confidence: 0.0,
        reasoning: 'Classification failed: Invalid response format'
      });
    });

    it('should handle file read errors', async () => {
      const filePath = '/test/corrupted.pdf';

      mockFileReader.isFileSupported.mockReturnValue(true);
      mockFileReader.readFile.mockRejectedValue(
        new Error('Failed to read file')
      );

      const result = await classifierService.classifyFile(filePath);

      expect(result).toEqual({
        primaryFolder: '10_Archive',
        subfolder: 'Unorganized',
        confidence: 0.0,
        reasoning: 'Classification failed: Failed to read file'
      });
    });
  });

  describe('batchClassify', () => {
    it('should classify multiple files with rate limiting', async () => {
      const filePaths = [
        '/test/doc1.pdf',
        '/test/doc2.docx',
        '/test/doc3.txt'
      ];

      mockFileReader.isFileSupported.mockReturnValue(true);
      mockFileReader.readFile.mockResolvedValue({
        content: 'Document content',
        type: 'pdf'
      });

      mockOpenAI.generateCompletion.mockResolvedValue({
        content: JSON.stringify({
          primaryFolder: '01_Corporate_and_Governance',
          subfolder: 'Contracts',
          confidence: 0.85,
          reasoning: 'Standard contract'
        })
      });

      const startTime = Date.now();
      const results = await classifierService.batchClassify(filePaths);
      const endTime = Date.now();

      expect(results).toHaveLength(3);
      expect(results.every(r => r.classification.primaryFolder === '01_Corporate_and_Governance')).toBe(true);
      
      // Should have delays between calls (at least 1 second for 3 files)
      expect(endTime - startTime).toBeGreaterThanOrEqual(1000);
    });

    it('should handle mixed success and failure in batch', async () => {
      const filePaths = [
        '/test/valid.pdf',
        '/test/unsupported.jpg',
        '/test/error.pdf'
      ];

      mockFileReader.isFileSupported
        .mockReturnValueOnce(true)    // valid.pdf
        .mockReturnValueOnce(false)   // unsupported.jpg
        .mockReturnValueOnce(true);   // error.pdf

      mockFileReader.readFile
        .mockResolvedValueOnce({ content: 'Valid content', type: 'pdf' })
        .mockRejectedValueOnce(new Error('Read error'));

      mockOpenAI.generateCompletion.mockResolvedValueOnce({
        content: JSON.stringify({
          primaryFolder: '03_Finance_and_Investment',
          subfolder: 'Contracts',
          confidence: 0.9,
          reasoning: 'Valid classification'
        })
      });

      const results = await classifierService.batchClassify(filePaths);

      expect(results).toHaveLength(3);
      expect(results[0].classification.primaryFolder).toBe('03_Finance_and_Investment');
      expect(results[1].classification.primaryFolder).toBe('10_Archive'); // Unsupported
      expect(results[2].classification.primaryFolder).toBe('10_Archive'); // Error
    });
  });

  describe('getDefaultClassification', () => {
    it('should check for template indicators in reason', () => {
      const service = new DocumentClassifierService('test-key');
      
      // Test various template indicators
      const templateReasons = [
        'File has [BLANK] indicator',
        'Contains [FORM] in name',
        'This is a (Template)',
        'Document marked as FORM',
        'Template document detected'
      ];

      templateReasons.forEach(reason => {
        const result = service['getDefaultClassification'](reason);
        expect(result.primaryFolder).toBe('09_Templates');
        expect(result.subfolder).toBe('Legal_Templates');
        expect(result.reasoning).toContain('template');
      });
    });

    it('should return archive classification for non-template errors', () => {
      const service = new DocumentClassifierService('test-key');
      const result = service['getDefaultClassification']('Generic error occurred');
      
      expect(result).toEqual({
        primaryFolder: '10_Archive',
        subfolder: 'Unorganized',
        confidence: 0.0,
        reasoning: 'Generic error occurred'
      });
    });
  });
});