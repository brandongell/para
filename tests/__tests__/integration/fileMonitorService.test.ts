import { FileMonitorService } from '../../../src/services/fileMonitor';
import { DocumentClassifierService } from '../../../src/services/documentClassifier';
import { FileOrganizerService } from '../../../src/services/fileOrganizer';
import { MetadataService } from '../../../src/services/metadataService';
import { MemoryService } from '../../../src/services/memoryService';
import * as fs from 'fs';
import * as path from 'path';
import * as chokidar from 'chokidar';
import { createTestDirectory, cleanupTestDirectory, createTestFile, waitFor } from '../../utils/testHelpers';
import { mockDocuments } from '../../fixtures/documents';

// Mock dependencies
jest.mock('../../../src/services/documentClassifier');
jest.mock('../../../src/services/fileOrganizer');
jest.mock('../../../src/services/metadataService');
jest.mock('../../../src/services/memoryService');
jest.mock('chokidar');

describe('FileMonitorService Integration Tests', () => {
  let fileMonitorService: FileMonitorService;
  let mockClassifier: jest.Mocked<DocumentClassifierService>;
  let mockOrganizer: jest.Mocked<FileOrganizerService>;
  let mockMetadataService: jest.Mocked<MetadataService>;
  let mockMemoryService: jest.Mocked<MemoryService>;
  let mockWatcher: jest.Mocked<chokidar.FSWatcher>;
  let testDir: string;

  beforeEach(async () => {
    jest.clearAllMocks();
    
    // Create test directory
    testDir = await createTestDirectory('/tmp');
    
    // Setup mocks
    mockClassifier = new DocumentClassifierService('test-key') as jest.Mocked<DocumentClassifierService>;
    mockOrganizer = new FileOrganizerService() as jest.Mocked<FileOrganizerService>;
    mockMetadataService = new MetadataService('test-key') as jest.Mocked<MetadataService>;
    mockMemoryService = new MemoryService(testDir) as jest.Mocked<MemoryService>;
    
    // Mock constructors
    (DocumentClassifierService as jest.MockedClass<typeof DocumentClassifierService>)
      .mockImplementation(() => mockClassifier);
    (FileOrganizerService as jest.MockedClass<typeof FileOrganizerService>)
      .mockImplementation(() => mockOrganizer);
    (MetadataService as jest.MockedClass<typeof MetadataService>)
      .mockImplementation(() => mockMetadataService);
    (MemoryService as jest.MockedClass<typeof MemoryService>)
      .mockImplementation(() => mockMemoryService);
    
    // Setup chokidar mock
    mockWatcher = {
      on: jest.fn().mockReturnThis(),
      close: jest.fn(),
    } as any;
    
    (chokidar.watch as jest.Mock).mockReturnValue(mockWatcher);
    
    // Create service
    fileMonitorService = new FileMonitorService('test-openai-key');
  });

  afterEach(async () => {
    await cleanupTestDirectory(testDir);
  });

  describe('startMonitoring', () => {
    it('should initialize monitoring with correct configuration', async () => {
      await fileMonitorService.startMonitoring(testDir);

      expect(chokidar.watch).toHaveBeenCalledWith(testDir, expect.objectContaining({
        ignored: expect.any(Array),
        ignoreInitial: true,
        persistent: true,
        depth: 10
      }));
      
      expect(mockWatcher.on).toHaveBeenCalledWith('add', expect.any(Function));
      expect(mockWatcher.on).toHaveBeenCalledWith('error', expect.any(Function));
      expect(mockWatcher.on).toHaveBeenCalledWith('ready', expect.any(Function));
    });

    it('should process new file when detected', async () => {
      const testFile = path.join(testDir, 'SAFE_Agreement.pdf');
      
      // Setup mocks for file processing
      mockClassifier.classifyFile.mockResolvedValue(mockDocuments.executedSAFE.classification);
      mockOrganizer.organizeFile.mockResolvedValue({
        success: true,
        newPath: path.join(testDir, '03_Finance_and_Investment/SAFE_Agreements/SAFE_Agreement.pdf'),
        metadataPath: path.join(testDir, '03_Finance_and_Investment/SAFE_Agreements/SAFE_Agreement.pdf.metadata.json')
      });
      
      // Mock file system
      jest.spyOn(fs, 'existsSync').mockReturnValue(true);
      jest.spyOn(fs, 'readFileSync').mockReturnValue(JSON.stringify(mockDocuments.executedSAFE.metadata));
      
      await fileMonitorService.startMonitoring(testDir);
      
      // Get the 'add' event handler
      const addHandler = mockWatcher.on.mock.calls.find(call => call[0] === 'add')?.[1];
      expect(addHandler).toBeDefined();
      
      // Trigger file detection
      await addHandler!(testFile);
      
      // Wait for processing
      await waitFor(() => mockClassifier.classifyFile.mock.calls.length > 0);
      
      expect(mockClassifier.classifyFile).toHaveBeenCalledWith(testFile);
      expect(mockOrganizer.organizeFile).toHaveBeenCalledWith(
        testFile,
        mockDocuments.executedSAFE.classification,
        testDir,
        true
      );
    });

    it('should update memory after successful organization', async () => {
      const testFile = path.join(testDir, 'document.pdf');
      const organizedPath = path.join(testDir, '01_Corporate/document.pdf');
      const metadataPath = `${organizedPath}.metadata.json`;
      
      mockClassifier.classifyFile.mockResolvedValue({
        primaryFolder: '01_Corporate_and_Governance',
        subFolder: 'Contracts',
        documentType: 'Contract',
        parties: [],
        reasoning: 'Test'
      });
      
      mockOrganizer.organizeFile.mockResolvedValue({
        success: true,
        newPath: organizedPath,
        metadataPath: metadataPath
      });
      
      const metadata = mockDocuments.executedSAFE.metadata;
      jest.spyOn(fs, 'existsSync').mockReturnValue(true);
      jest.spyOn(fs, 'readFileSync').mockReturnValue(JSON.stringify(metadata));
      
      await fileMonitorService.startMonitoring(testDir);
      
      const addHandler = mockWatcher.on.mock.calls.find(call => call[0] === 'add')?.[1];
      await addHandler!(testFile);
      
      await waitFor(() => mockMemoryService.updateMemoryForDocument.mock.calls.length > 0);
      
      expect(mockMemoryService.updateMemoryForDocument).toHaveBeenCalledWith(
        organizedPath,
        metadata
      );
    });

    it('should skip template prompt for templates in monitor mode', async () => {
      const templateFile = path.join(testDir, 'NDA_Template_[BLANK].pdf');
      
      mockClassifier.classifyFile.mockResolvedValue(mockDocuments.templateNDA.classification);
      mockOrganizer.organizeFile.mockResolvedValue({
        success: true,
        newPath: path.join(testDir, '09_Templates/Legal_Templates/NDA_Template_[BLANK].pdf'),
        metadataPath: path.join(testDir, '09_Templates/Legal_Templates/NDA_Template_[BLANK].pdf.metadata.json')
      });
      
      jest.spyOn(fs, 'existsSync').mockReturnValue(true);
      jest.spyOn(fs, 'readFileSync').mockReturnValue(JSON.stringify(mockDocuments.templateNDA.metadata));
      
      await fileMonitorService.startMonitoring(testDir);
      
      const addHandler = mockWatcher.on.mock.calls.find(call => call[0] === 'add')?.[1];
      await addHandler!(templateFile);
      
      await waitFor(() => mockOrganizer.organizeFile.mock.calls.length > 0);
      
      // Should process template without prompting
      expect(mockOrganizer.organizeFile).toHaveBeenCalled();
      expect(mockMemoryService.updateMemoryForDocument).toHaveBeenCalled();
    });
  });

  describe('file filtering', () => {
    it('should ignore system files', async () => {
      await fileMonitorService.startMonitoring(testDir);
      
      const addHandler = mockWatcher.on.mock.calls.find(call => call[0] === 'add')?.[1];
      
      // Try to process system files
      await addHandler!(path.join(testDir, '.DS_Store'));
      await addHandler!(path.join(testDir, 'Thumbs.db'));
      await addHandler!(path.join(testDir, '~temp.docx'));
      
      // Should not process any of these
      expect(mockClassifier.classifyFile).not.toHaveBeenCalled();
    });

    it('should ignore files in organized folders', async () => {
      await fileMonitorService.startMonitoring(testDir);
      
      const ignoredPaths = [
        path.join(testDir, '01_Corporate_and_Governance/document.pdf'),
        path.join(testDir, '09_Templates/template.pdf'),
        path.join(testDir, '03_Finance_and_Investment/SAFE_Agreements/safe.pdf')
      ];
      
      // The watcher configuration should include ignore patterns
      const watchCall = (chokidar.watch as jest.Mock).mock.calls[0];
      const ignorePatterns = watchCall[1].ignored;
      
      expect(ignorePatterns).toContain(path.join(testDir, '0*_*/**'));
    });
  });

  describe('error handling', () => {
    it('should handle classification errors gracefully', async () => {
      const testFile = path.join(testDir, 'error-document.pdf');
      
      mockClassifier.classifyFile.mockRejectedValue(new Error('Classification failed'));
      
      await fileMonitorService.startMonitoring(testDir);
      
      const addHandler = mockWatcher.on.mock.calls.find(call => call[0] === 'add')?.[1];
      await addHandler!(testFile);
      
      await waitFor(() => mockClassifier.classifyFile.mock.calls.length > 0);
      
      // Should not crash and should not call organizer
      expect(mockOrganizer.organizeFile).not.toHaveBeenCalled();
    });

    it('should handle organization errors gracefully', async () => {
      const testFile = path.join(testDir, 'document.pdf');
      
      mockClassifier.classifyFile.mockResolvedValue({
        primaryFolder: '01_Corporate_and_Governance',
        subFolder: 'Contracts',
        documentType: 'Contract',
        parties: [],
        reasoning: 'Test'
      });
      
      mockOrganizer.organizeFile.mockResolvedValue({
        success: false,
        error: 'Failed to move file'
      });
      
      await fileMonitorService.startMonitoring(testDir);
      
      const addHandler = mockWatcher.on.mock.calls.find(call => call[0] === 'add')?.[1];
      await addHandler!(testFile);
      
      await waitFor(() => mockOrganizer.organizeFile.mock.calls.length > 0);
      
      // Should not update memory on failure
      expect(mockMemoryService.updateMemoryForDocument).not.toHaveBeenCalled();
    });

    it('should continue processing after memory update failure', async () => {
      const testFile = path.join(testDir, 'document.pdf');
      
      mockClassifier.classifyFile.mockResolvedValue({
        primaryFolder: '01_Corporate_and_Governance',
        subFolder: 'Contracts',
        documentType: 'Contract',
        parties: [],
        reasoning: 'Test'
      });
      
      mockOrganizer.organizeFile.mockResolvedValue({
        success: true,
        newPath: path.join(testDir, '01_Corporate/document.pdf'),
        metadataPath: path.join(testDir, '01_Corporate/document.pdf.metadata.json')
      });
      
      jest.spyOn(fs, 'existsSync').mockReturnValue(true);
      jest.spyOn(fs, 'readFileSync').mockReturnValue(JSON.stringify({
        filename: 'document.pdf',
        status: 'executed',
        category: 'Corporate',
        signers: [],
        fully_executed_date: null
      }));
      
      mockMemoryService.updateMemoryForDocument.mockRejectedValue(new Error('Memory update failed'));
      
      await fileMonitorService.startMonitoring(testDir);
      
      const addHandler = mockWatcher.on.mock.calls.find(call => call[0] === 'add')?.[1];
      await addHandler!(testFile);
      
      await waitFor(() => mockMemoryService.updateMemoryForDocument.mock.calls.length > 0);
      
      // Should complete processing despite memory error
      expect(mockOrganizer.organizeFile).toHaveBeenCalled();
    });
  });

  describe('file stability', () => {
    it('should wait for file to stabilize before processing', async () => {
      const testFile = path.join(testDir, 'large-file.pdf');
      let fileSize = 1000;
      
      // Mock changing file size
      jest.spyOn(fs, 'statSync')
        .mockReturnValueOnce({ size: fileSize } as any)
        .mockReturnValueOnce({ size: fileSize + 1000 } as any)
        .mockReturnValueOnce({ size: fileSize + 2000 } as any)
        .mockReturnValue({ size: fileSize + 2000 } as any); // Stable
      
      jest.spyOn(fs, 'existsSync').mockReturnValue(true);
      
      mockClassifier.classifyFile.mockResolvedValue({
        primaryFolder: '01_Corporate_and_Governance',
        subFolder: 'Contracts',
        documentType: 'Contract',
        parties: [],
        reasoning: 'Test'
      });
      
      await fileMonitorService.startMonitoring(testDir);
      
      const addHandler = mockWatcher.on.mock.calls.find(call => call[0] === 'add')?.[1];
      const startTime = Date.now();
      await addHandler!(testFile);
      
      await waitFor(() => mockClassifier.classifyFile.mock.calls.length > 0);
      const endTime = Date.now();
      
      // Should have waited for stability
      expect(endTime - startTime).toBeGreaterThanOrEqual(500); // At least 2 checks
    });
  });

  describe('lifecycle management', () => {
    it('should stop monitoring when requested', () => {
      fileMonitorService.startMonitoring(testDir);
      fileMonitorService.stopMonitoring();
      
      expect(mockWatcher.close).toHaveBeenCalled();
      expect(fileMonitorService.isMonitoring()).toBe(false);
    });

    it('should track monitoring state', async () => {
      expect(fileMonitorService.isMonitoring()).toBe(false);
      
      await fileMonitorService.startMonitoring(testDir);
      expect(fileMonitorService.isMonitoring()).toBe(true);
      
      fileMonitorService.stopMonitoring();
      expect(fileMonitorService.isMonitoring()).toBe(false);
    });

    it('should return watched path', async () => {
      await fileMonitorService.startMonitoring(testDir);
      expect(fileMonitorService.getWatchedPath()).toBe(testDir);
    });
  });
});