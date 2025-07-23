import { DiscordBotService } from '../../../src/services/discordBotService';
import { DocumentClassifierService } from '../../../src/services/documentClassifier';
import { FileOrganizerService } from '../../../src/services/fileOrganizer';
import { MetadataService } from '../../../src/services/metadataService';
import { EnhancedSmartSearchService } from '../../../src/services/enhancedSmartSearchService';
import { Client, Message, Attachment, TextChannel } from 'discord.js';
import * as fs from 'fs';
import * as path from 'path';
import fetch from 'node-fetch';
import { createTestDirectory, cleanupTestDirectory, createMockDiscordMessage, createMockAttachment } from '../../utils/testHelpers';
import { mockDocuments, mockDiscordAttachments } from '../../fixtures/documents';

// Mock dependencies
jest.mock('../../../src/services/documentClassifier');
jest.mock('../../../src/services/fileOrganizer');
jest.mock('../../../src/services/metadataService');
jest.mock('../../../src/services/enhancedSmartSearchService');
jest.mock('discord.js');
jest.mock('node-fetch');

describe('Discord Bot File Upload Integration Tests', () => {
  let discordBot: DiscordBotService;
  let mockClient: jest.Mocked<Client>;
  let mockClassifier: jest.Mocked<DocumentClassifierService>;
  let mockOrganizer: jest.Mocked<FileOrganizerService>;
  let mockMetadataService: jest.Mocked<MetadataService>;
  let mockSearchService: jest.Mocked<EnhancedSmartSearchService>;
  let testDir: string;
  let tempDir: string;

  beforeEach(async () => {
    jest.clearAllMocks();
    
    // Create test directories
    testDir = await createTestDirectory('/tmp');
    tempDir = path.join(testDir, 'temp');
    await fs.promises.mkdir(tempDir, { recursive: true });
    
    // Setup mocks
    mockClassifier = new DocumentClassifierService('test-key') as jest.Mocked<DocumentClassifierService>;
    mockOrganizer = new FileOrganizerService() as jest.Mocked<FileOrganizerService>;
    mockMetadataService = new MetadataService('test-key') as jest.Mocked<MetadataService>;
    mockSearchService = new EnhancedSmartSearchService(testDir, 'test-key') as jest.Mocked<EnhancedSmartSearchService>;
    
    // Mock constructors
    (DocumentClassifierService as jest.MockedClass<typeof DocumentClassifierService>)
      .mockImplementation(() => mockClassifier);
    (FileOrganizerService as jest.MockedClass<typeof FileOrganizerService>)
      .mockImplementation(() => mockOrganizer);
    (MetadataService as jest.MockedClass<typeof MetadataService>)
      .mockImplementation(() => mockMetadataService);
    (EnhancedSmartSearchService as jest.MockedClass<typeof EnhancedSmartSearchService>)
      .mockImplementation(() => mockSearchService);
    
    // Setup Discord client mock
    mockClient = {
      login: jest.fn().mockResolvedValue(undefined),
      on: jest.fn().mockReturnThis(),
      once: jest.fn().mockReturnThis(),
      user: { tag: 'TestBot#1234' }
    } as any;
    
    (Client as jest.MockedClass<typeof Client>).mockImplementation(() => mockClient);
    
    // Mock fs operations
    jest.spyOn(fs, 'existsSync').mockReturnValue(true);
    jest.spyOn(fs, 'mkdirSync').mockImplementation(() => undefined);
    jest.spyOn(fs.promises, 'writeFile').mockResolvedValue(undefined);
    
    // Create bot service
    discordBot = new DiscordBotService(
      'test-token',
      'test-openai-key',
      testDir
    );
  });

  afterEach(async () => {
    await cleanupTestDirectory(testDir);
  });

  describe('single file upload', () => {
    it('should process and organize uploaded PDF file', async () => {
      const mockAttachment = createMockAttachment('Employment_Agreement.pdf');
      const mockMessage = createMockDiscordMessage('Please organize this contract', [mockAttachment]);
      
      // Mock file download
      (fetch as jest.MockedFunction<typeof fetch>).mockResolvedValue({
        ok: true,
        buffer: jest.fn().mockResolvedValue(Buffer.from('PDF content'))
      } as any);
      
      // Mock classification
      mockClassifier.classifyFile.mockResolvedValue({
        primaryFolder: '02_People_and_Employment',
        subfolder: 'Employment_Agreements',
        confidence: 0.95,
        reasoning: 'Employment agreement document'
      });
      
      // Mock organization
      mockOrganizer.organizeFile.mockResolvedValue({
        success: true,
        originalPath: mockAttachment.name,
        newPath: path.join(testDir, '02_People_and_Employment/Employment_Agreements/Employment_Agreement.pdf'),
        metadataPath: path.join(testDir, '02_People_and_Employment/Employment_Agreements/Employment_Agreement.pdf.metadata.json')
      });
      
      // Mock metadata generation
      mockMetadataService.generateMetadataForOrganizedFile.mockResolvedValue({
        metadata: {
          filename: 'Employment_Agreement.pdf',
          status: 'executed',
          category: 'People_and_Employment',
          signers: [],
          fully_executed_date: null
        },
        metadataPath: path.join(testDir, '02_People_and_Employment/Employment_Agreements/Employment_Agreement.pdf.metadata.json')
      });
      
      // Process message
      const messageHandler = mockClient.on.mock.calls.find(call => call[0] === 'messageCreate')?.[1];
      await messageHandler!(mockMessage);
      
      // Verify download
      expect(fetch).toHaveBeenCalledWith(mockAttachment.url);
      
      // Verify classification
      expect(mockClassifier.classifyFile).toHaveBeenCalledWith(
        expect.stringContaining('Employment_Agreement.pdf')
      );
      
      // Verify organization
      expect(mockOrganizer.organizeFile).toHaveBeenCalledWith(
        expect.stringContaining('Employment_Agreement.pdf'),
        expect.objectContaining({
          primaryFolder: '02_People_and_Employment'
        }),
        testDir,
        true
      );
      
      // Verify response
      expect(mockMessage.channel.send).toHaveBeenCalledWith(
        expect.objectContaining({
          content: expect.stringContaining('successfully organized')
        })
      );
    });

    it('should detect and organize template files correctly', async () => {
      const mockAttachment = createMockAttachment('Template_[BLANK]_NDA.pdf');
      const mockMessage = createMockDiscordMessage('Here is a template', [mockAttachment]);
      
      (fetch as jest.MockedFunction<typeof fetch>).mockResolvedValue({
        ok: true,
        buffer: jest.fn().mockResolvedValue(Buffer.from('Template PDF content'))
      } as any);
      
      mockClassifier.classifyFile.mockResolvedValue(mockDocuments.templateNDA.classification);
      
      mockOrganizer.organizeFile.mockResolvedValue({
        success: true,
        originalPath: mockAttachment.name,
        newPath: path.join(testDir, '09_Templates/Legal_Templates/Template_[BLANK]_NDA.pdf'),
        metadataPath: path.join(testDir, '09_Templates/Legal_Templates/Template_[BLANK]_NDA.pdf.metadata.json')
      });
      
      mockMetadataService.generateMetadataForOrganizedFile.mockResolvedValue({
        metadata: mockDocuments.templateNDA.metadata,
        metadataPath: path.join(testDir, '09_Templates/Legal_Templates/Template_[BLANK]_NDA.pdf.metadata.json')
      });
      
      const messageHandler = mockClient.on.mock.calls.find(call => call[0] === 'messageCreate')?.[1];
      await messageHandler!(mockMessage);
      
      // Should classify as template
      expect(mockOrganizer.organizeFile).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          primaryFolder: '09_Templates'
        }),
        testDir,
        true
      );
      
      // Should indicate template in response
      expect(mockMessage.channel.send).toHaveBeenCalledWith(
        expect.objectContaining({
          content: expect.stringContaining('template')
        })
      );
    });
  });

  describe('multiple file upload', () => {
    it('should process multiple files in batch', async () => {
      const attachments = [
        createMockAttachment('Contract1.pdf'),
        createMockAttachment('Agreement2.docx'),
        createMockAttachment('Memo3.txt')
      ];
      
      const mockMessage = createMockDiscordMessage('Please organize these documents', attachments);
      
      (fetch as jest.MockedFunction<typeof fetch>).mockResolvedValue({
        ok: true,
        buffer: jest.fn().mockResolvedValue(Buffer.from('File content'))
      } as any);
      
      mockClassifier.classifyFile.mockResolvedValue({
        primaryFolder: '01_Corporate_and_Governance',
        subfolder: 'Contracts',
        confidence: 0.85,
        reasoning: 'Corporate contract'
      });
      
      mockOrganizer.organizeFile.mockResolvedValue({
        success: true,
        originalPath: 'document.pdf',
        newPath: path.join(testDir, '01_Corporate_and_Governance/Contracts/document.pdf'),
        metadataPath: path.join(testDir, '01_Corporate_and_Governance/Contracts/document.pdf.metadata.json')
      });
      
      const messageHandler = mockClient.on.mock.calls.find(call => call[0] === 'messageCreate')?.[1];
      await messageHandler!(mockMessage);
      
      // Should process all files
      expect(fetch).toHaveBeenCalledTimes(3);
      expect(mockClassifier.classifyFile).toHaveBeenCalledTimes(3);
      expect(mockOrganizer.organizeFile).toHaveBeenCalledTimes(3);
      
      // Should send progress updates
      expect(mockMessage.channel.send).toHaveBeenCalledWith(
        expect.objectContaining({
          content: expect.stringContaining('Processing 3 files')
        })
      );
    });

    it('should handle mixed success and failure in batch', async () => {
      const attachments = [
        createMockAttachment('Valid.pdf'),
        createMockAttachment('Invalid.exe', 1024, 'application/exe'),
        createMockAttachment('Error.pdf')
      ];
      
      const mockMessage = createMockDiscordMessage('Organize these', attachments);
      
      (fetch as jest.MockedFunction<typeof fetch>)
        .mockResolvedValueOnce({
          ok: true,
          buffer: jest.fn().mockResolvedValue(Buffer.from('Valid PDF'))
        } as any)
        .mockResolvedValueOnce({
          ok: true,
          buffer: jest.fn().mockResolvedValue(Buffer.from('Invalid file'))
        } as any)
        .mockResolvedValueOnce({
          ok: false,
          status: 404,
          statusText: 'Not Found'
        } as any);
      
      mockClassifier.classifyFile
        .mockResolvedValueOnce({
          primaryFolder: '01_Corporate_and_Governance',
          subfolder: 'Contracts',
          confidence: 0.9,
          reasoning: 'Valid document'
        })
        .mockResolvedValueOnce({
          primaryFolder: '10_Archive',
          subfolder: 'Unorganized',
          confidence: 0.0,
          reasoning: 'Unsupported file type'
        });
      
      mockOrganizer.organizeFile
        .mockResolvedValueOnce({
          success: true,
          originalPath: 'Valid.pdf',
          newPath: path.join(testDir, '01_Corporate_and_Governance/Contracts/Valid.pdf')
        })
        .mockResolvedValueOnce({
          success: true,
          originalPath: 'Invalid.exe',
          newPath: path.join(testDir, '10_Archive/Unorganized/Invalid.exe')
        });
      
      const messageHandler = mockClient.on.mock.calls.find(call => call[0] === 'messageCreate')?.[1];
      await messageHandler!(mockMessage);
      
      // Should report mixed results
      expect(mockMessage.channel.send).toHaveBeenCalledWith(
        expect.objectContaining({
          embeds: expect.arrayContaining([
            expect.objectContaining({
              description: expect.stringContaining('2 files organized successfully')
            })
          ])
        })
      );
    });
  });

  describe('error handling', () => {
    it('should handle download failures gracefully', async () => {
      const mockAttachment = createMockAttachment('Document.pdf');
      const mockMessage = createMockDiscordMessage('Organize this', [mockAttachment]);
      
      (fetch as jest.MockedFunction<typeof fetch>).mockRejectedValue(
        new Error('Network error')
      );
      
      const messageHandler = mockClient.on.mock.calls.find(call => call[0] === 'messageCreate')?.[1];
      await messageHandler!(mockMessage);
      
      expect(mockMessage.channel.send).toHaveBeenCalledWith(
        expect.objectContaining({
          content: expect.stringContaining('Failed to download')
        })
      );
    });

    it('should handle classification failures', async () => {
      const mockAttachment = createMockAttachment('Document.pdf');
      const mockMessage = createMockDiscordMessage('Organize this', [mockAttachment]);
      
      (fetch as jest.MockedFunction<typeof fetch>).mockResolvedValue({
        ok: true,
        buffer: jest.fn().mockResolvedValue(Buffer.from('PDF content'))
      } as any);
      
      mockClassifier.classifyFile.mockRejectedValue(
        new Error('Classification API error')
      );
      
      const messageHandler = mockClient.on.mock.calls.find(call => call[0] === 'messageCreate')?.[1];
      await messageHandler!(mockMessage);
      
      expect(mockMessage.channel.send).toHaveBeenCalledWith(
        expect.objectContaining({
          content: expect.stringContaining('Failed to classify')
        })
      );
    });

    it('should handle organization failures', async () => {
      const mockAttachment = createMockAttachment('Document.pdf');
      const mockMessage = createMockDiscordMessage('Organize this', [mockAttachment]);
      
      (fetch as jest.MockedFunction<typeof fetch>).mockResolvedValue({
        ok: true,
        buffer: jest.fn().mockResolvedValue(Buffer.from('PDF content'))
      } as any);
      
      mockClassifier.classifyFile.mockResolvedValue({
        primaryFolder: '01_Corporate_and_Governance',
        subfolder: 'Contracts',
        confidence: 0.85,
        reasoning: 'Test'
      });
      
      mockOrganizer.organizeFile.mockResolvedValue({
        success: false,
        originalPath: 'Document.pdf',
        error: 'Permission denied'
      });
      
      const messageHandler = mockClient.on.mock.calls.find(call => call[0] === 'messageCreate')?.[1];
      await messageHandler!(mockMessage);
      
      expect(mockMessage.channel.send).toHaveBeenCalledWith(
        expect.objectContaining({
          content: expect.stringContaining('Failed to organize')
        })
      );
    });
  });

  describe('file validation', () => {
    it('should reject oversized files', async () => {
      const largeAttachment = createMockAttachment('HugeFile.pdf', 60 * 1024 * 1024); // 60MB
      const mockMessage = createMockDiscordMessage('Organize this', [largeAttachment]);
      
      const messageHandler = mockClient.on.mock.calls.find(call => call[0] === 'messageCreate')?.[1];
      await messageHandler!(mockMessage);
      
      expect(fetch).not.toHaveBeenCalled();
      expect(mockMessage.channel.send).toHaveBeenCalledWith(
        expect.objectContaining({
          content: expect.stringContaining('too large')
        })
      );
    });

    it('should handle unsupported file types appropriately', async () => {
      const unsupportedAttachment = createMockAttachment('Video.mp4', 1024000, 'video/mp4');
      const mockMessage = createMockDiscordMessage('Organize this', [unsupportedAttachment]);
      
      (fetch as jest.MockedFunction<typeof fetch>).mockResolvedValue({
        ok: true,
        buffer: jest.fn().mockResolvedValue(Buffer.from('Video content'))
      } as any);
      
      mockClassifier.classifyFile.mockResolvedValue({
        primaryFolder: '10_Archive',
        subfolder: 'Unorganized',
        confidence: 0.0,
        reasoning: 'Unsupported file type'
      });
      
      mockOrganizer.organizeFile.mockResolvedValue({
        success: true,
        originalPath: 'Video.mp4',
        newPath: path.join(testDir, '10_Archive/Unorganized/Video.mp4')
      });
      
      const messageHandler = mockClient.on.mock.calls.find(call => call[0] === 'messageCreate')?.[1];
      await messageHandler!(mockMessage);
      
      expect(mockOrganizer.organizeFile).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          primaryFolder: '10_Archive',
          subfolder: 'Unorganized'
        }),
        testDir,
        false // Should not generate metadata for unsupported files
      );
    });
  });

  describe('filename handling', () => {
    it('should preserve original filenames without timestamp prefixes', async () => {
      const mockAttachment = createMockAttachment('Important_Contract_2024.pdf');
      const mockMessage = createMockDiscordMessage('Organize this', [mockAttachment]);
      
      (fetch as jest.MockedFunction<typeof fetch>).mockResolvedValue({
        ok: true,
        buffer: jest.fn().mockResolvedValue(Buffer.from('PDF content'))
      } as any);
      
      mockClassifier.classifyFile.mockResolvedValue({
        primaryFolder: '01_Corporate_and_Governance',
        subfolder: 'Contracts',
        confidence: 0.85,
        reasoning: 'Corporate contract'
      });
      
      const messageHandler = mockClient.on.mock.calls.find(call => call[0] === 'messageCreate')?.[1];
      await messageHandler!(mockMessage);
      
      // Should classify with original filename
      expect(mockClassifier.classifyFile).toHaveBeenCalledWith(
        expect.stringContaining('Important_Contract_2024.pdf')
      );
      
      // Should not have timestamp prefix
      expect(mockClassifier.classifyFile).not.toHaveBeenCalledWith(
        expect.stringMatching(/\d{13}_Important_Contract_2024\.pdf/)
      );
    });
  });
});