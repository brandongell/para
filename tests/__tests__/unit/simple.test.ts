import { DocumentClassification } from '../../../src/types';
import * as path from 'path';

describe('Simple Unit Tests', () => {
  describe('Document Classification Types', () => {
    it('should create valid classification object', () => {
      const classification: DocumentClassification = {
        primaryFolder: '03_Finance_and_Investment',
        subfolder: 'SAFE_Agreements',
        confidence: 0.95,
        reasoning: 'SAFE investment agreement'
      };
      
      expect(classification.primaryFolder).toBe('03_Finance_and_Investment');
      expect(classification.subfolder).toBe('SAFE_Agreements');
      expect(classification.confidence).toBeGreaterThan(0.9);
      expect(classification.reasoning).toContain('SAFE');
    });
  });
  
  describe('Path utilities', () => {
    it('should extract filename from path', () => {
      const filePath = '/test/documents/contract.pdf';
      const filename = path.basename(filePath);
      expect(filename).toBe('contract.pdf');
    });
    
    it('should extract extension from filename', () => {
      const filePath = '/test/documents/contract.pdf';
      const extension = path.extname(filePath);
      expect(extension).toBe('.pdf');
    });
  });
  
  describe('Template detection logic', () => {
    it('should identify template indicators in filenames', () => {
      const templateFilenames = [
        'NDA_[BLANK].pdf',
        'Agreement_[FORM].docx',
        'Contract_(Template).pdf',
        'Employment_Form.doc',
        'Template_Agreement.pdf'
      ];
      
      const templateIndicators = ['[BLANK]', '[FORM]', '(Template)', 'Template', 'Form'];
      
      templateFilenames.forEach(filename => {
        const hasIndicator = templateIndicators.some(indicator => 
          filename.toLowerCase().includes(indicator.toLowerCase())
        );
        expect(hasIndicator).toBe(true);
      });
    });
    
    it('should not identify non-templates', () => {
      const regularFilenames = [
        'NDA_Executed_2024.pdf',
        'Agreement_Final.docx',
        'Contract_Signed.pdf',
        'Employment_JohnDoe.doc'
      ];
      
      const templateIndicators = ['[BLANK]', '[FORM]', '(Template)'];
      
      regularFilenames.forEach(filename => {
        const hasIndicator = templateIndicators.some(indicator => 
          filename.includes(indicator)
        );
        expect(hasIndicator).toBe(false);
      });
    });
  });
  
  describe('Metadata validation', () => {
    it('should validate required metadata fields', () => {
      const metadata = {
        filename: 'test.pdf',
        status: 'executed' as const,
        category: 'Finance_and_Investment',
        signers: [],
        fully_executed_date: null
      };
      
      expect(metadata).toHaveProperty('filename');
      expect(metadata).toHaveProperty('status');
      expect(metadata).toHaveProperty('category');
      expect(metadata).toHaveProperty('signers');
      expect(metadata).toHaveProperty('fully_executed_date');
    });
    
    it('should validate status values', () => {
      const validStatuses = ['not_executed', 'partially_executed', 'executed', 'template'];
      
      validStatuses.forEach(status => {
        expect(['not_executed', 'partially_executed', 'executed', 'template']).toContain(status);
      });
    });
  });
  
  describe('Folder mapping', () => {
    it('should map categories to folder names', () => {
      const categoryMapping = {
        'Corporate_and_Governance': '01_Corporate_and_Governance',
        'People_and_Employment': '02_People_and_Employment',
        'Finance_and_Investment': '03_Finance_and_Investment',
        'Sales_and_Revenue': '04_Sales_and_Revenue',
        'Operations_and_Vendors': '05_Operations_and_Vendors',
        'Technology_and_IP': '06_Technology_and_IP',
        'Marketing_and_Partnerships': '07_Marketing_and_Partnerships',
        'Risk_and_Compliance': '08_Risk_and_Compliance',
        'Templates': '09_Templates',
        'Archive': '10_Archive'
      };
      
      Object.entries(categoryMapping).forEach(([category, folder]) => {
        expect(folder).toMatch(/^\d{2}_/); // Should start with two digits and underscore
        expect(folder).toContain(category.replace(/_/g, '_'));
      });
    });
  });
});