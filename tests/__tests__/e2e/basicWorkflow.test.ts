import * as fs from 'fs';
import * as path from 'path';
import { FileMonitorService } from '../../../src/services/fileMonitor';
import { createTestDirectory, cleanupTestDirectory, createTestFile, waitFor } from '../../utils/testHelpers';

describe('Basic E2E Workflow Tests', () => {
  let testDir: string;
  let organizedDir: string;
  
  beforeEach(async () => {
    // Create test directories
    testDir = await createTestDirectory('/tmp');
    organizedDir = path.join(testDir, 'organized');
    await fs.promises.mkdir(organizedDir, { recursive: true });
    
    // Set environment variables
    process.env.OPENAI_API_KEY = 'test-key';
    process.env.ORGANIZE_FOLDER_PATH = organizedDir;
  });
  
  afterEach(async () => {
    await cleanupTestDirectory(testDir);
  });
  
  describe('File Organization', () => {
    it('should organize a simple text file', async () => {
      // Create a test file
      const testContent = `
        EMPLOYMENT AGREEMENT
        
        This Employment Agreement is entered into between Company ABC and John Doe.
        
        Position: Software Engineer
        Start Date: January 1, 2024
        Salary: $100,000 per year
        
        Signed:
        John Doe
        Jane Smith (HR Manager)
      `;
      
      const testFile = await createTestFile(testDir, 'employment_agreement.txt', testContent);
      
      // Create file monitor service
      const monitor = new FileMonitorService(process.env.OPENAI_API_KEY!);
      
      // Start monitoring
      await monitor.startMonitoring(organizedDir);
      
      // Copy file to monitored directory
      const targetFile = path.join(organizedDir, 'employment_agreement.txt');
      await fs.promises.copyFile(testFile, targetFile);
      
      // Wait for file to be processed
      await waitFor(async () => {
        const files = await fs.promises.readdir(organizedDir);
        return files.some(f => f.startsWith('02_People_and_Employment'));
      }, 10000);
      
      // Verify file was organized
      const files = await fs.promises.readdir(organizedDir);
      const employmentFolder = files.find(f => f.startsWith('02_People_and_Employment'));
      expect(employmentFolder).toBeDefined();
      
      // Stop monitoring
      monitor.stopMonitoring();
    });
    
    it('should detect and organize template files', async () => {
      const templateContent = `
        EMPLOYMENT AGREEMENT TEMPLATE
        
        This Employment Agreement is entered into between [COMPANY NAME] and [EMPLOYEE NAME].
        
        Position: [JOB TITLE]
        Start Date: [START DATE]
        Salary: $[SALARY] per year
        
        Signed:
        _________________________
        Employee
        
        _________________________
        Company Representative
      `;
      
      const testFile = await createTestFile(testDir, 'Employment_Agreement_[BLANK].txt', templateContent);
      
      const monitor = new FileMonitorService(process.env.OPENAI_API_KEY!);
      await monitor.startMonitoring(organizedDir);
      
      const targetFile = path.join(organizedDir, 'Employment_Agreement_[BLANK].txt');
      await fs.promises.copyFile(testFile, targetFile);
      
      await waitFor(async () => {
        const files = await fs.promises.readdir(organizedDir);
        return files.some(f => f === '09_Templates');
      }, 10000);
      
      // Verify template was organized correctly
      const templateFolder = path.join(organizedDir, '09_Templates');
      const templateExists = await fs.promises.access(templateFolder).then(() => true).catch(() => false);
      expect(templateExists).toBe(true);
      
      monitor.stopMonitoring();
    });
  });
  
  describe('Metadata Generation', () => {
    it('should create metadata file alongside organized document', async () => {
      const testContent = 'Simple legal document content';
      const testFile = await createTestFile(testDir, 'contract.txt', testContent);
      
      const monitor = new FileMonitorService(process.env.OPENAI_API_KEY!);
      await monitor.startMonitoring(organizedDir);
      
      const targetFile = path.join(organizedDir, 'contract.txt');
      await fs.promises.copyFile(testFile, targetFile);
      
      await waitFor(async () => {
        const files = await fs.promises.readdir(organizedDir, { recursive: true });
        return files.some(f => f.toString().endsWith('.metadata.json'));
      }, 10000);
      
      // Find metadata file
      const allFiles: string[] = [];
      const findFiles = async (dir: string) => {
        const entries = await fs.promises.readdir(dir, { withFileTypes: true });
        for (const entry of entries) {
          const fullPath = path.join(dir, entry.name);
          if (entry.isDirectory()) {
            await findFiles(fullPath);
          } else {
            allFiles.push(fullPath);
          }
        }
      };
      
      await findFiles(organizedDir);
      const metadataFile = allFiles.find(f => f.endsWith('.metadata.json'));
      expect(metadataFile).toBeDefined();
      
      if (metadataFile) {
        const metadata = JSON.parse(await fs.promises.readFile(metadataFile, 'utf-8'));
        expect(metadata).toHaveProperty('filename');
        expect(metadata).toHaveProperty('status');
        expect(metadata).toHaveProperty('category');
      }
      
      monitor.stopMonitoring();
    });
  });
});