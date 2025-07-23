import { DocumentClassification, DocumentMetadata } from '../../src/types';

export const mockOpenAIService = {
  generateCompletion: jest.fn().mockResolvedValue({
    content: JSON.stringify({
      primaryFolder: '03_Finance_and_Investment',
      subFolder: 'SAFE_Agreements',
      documentType: 'SAFE Agreement',
      parties: ['Company ABC', 'Investor XYZ'],
      reasoning: 'SAFE investment agreement'
    })
  })
};

export const mockGeminiService = {
  generateContent: jest.fn().mockResolvedValue({
    response: {
      text: () => JSON.stringify({
        signers: [
          { name: 'John Doe', date_signed: null },
          { name: 'Jane Smith', date_signed: null }
        ],
        primary_parties: [
          {
            name: 'Company ABC',
            organization: 'ABC Corp',
            role: 'Company'
          }
        ],
        status: 'executed',
        contract_value: '$100,000'
      })
    }
  })
};

export const mockFileReaderService = {
  readFile: jest.fn().mockResolvedValue({
    content: 'Mock document content',
    type: 'pdf'
  }),
  isFileSupported: jest.fn().mockReturnValue(true),
  getFileInfo: jest.fn().mockResolvedValue({
    size: 1024000,
    extension: '.pdf',
    name: 'test-document.pdf'
  })
};

export const mockDocumentClassifierService = {
  classifyFile: jest.fn().mockResolvedValue({
    primaryFolder: '03_Finance_and_Investment',
    subFolder: 'SAFE_Agreements',
    documentType: 'SAFE Agreement',
    parties: ['Company ABC', 'Investor XYZ'],
    reasoning: 'SAFE investment agreement'
  } as DocumentClassification)
};

export const mockMetadataService = {
  generateMetadataFile: jest.fn().mockResolvedValue({
    metadataPath: '/test/document.pdf.metadata.json',
    metadata: {
      filename: 'document.pdf',
      status: 'executed',
      category: 'Finance_and_Investment',
      signers: [],
      fully_executed_date: null
    } as DocumentMetadata
  }),
  generateMetadataForOrganizedFile: jest.fn().mockResolvedValue({
    metadataPath: '/test/organized/document.pdf.metadata.json',
    metadata: {
      filename: 'document.pdf',
      status: 'executed',
      category: 'Finance_and_Investment',
      signers: [],
      fully_executed_date: null
    } as DocumentMetadata
  }),
  readMetadataFile: jest.fn().mockResolvedValue({
    filename: 'document.pdf',
    status: 'executed',
    category: 'Finance_and_Investment',
    signers: [],
    fully_executed_date: null
  } as DocumentMetadata)
};

export const mockFileOrganizerService = {
  organizeFile: jest.fn().mockResolvedValue({
    success: true,
    newPath: '/organized/03_Finance_and_Investment/SAFE_Agreements/document.pdf',
    metadataPath: '/organized/03_Finance_and_Investment/SAFE_Agreements/document.pdf.metadata.json'
  }),
  createFolderStructure: jest.fn().mockResolvedValue(undefined),
  getAllFiles: jest.fn().mockResolvedValue([]),
  setMetadataService: jest.fn()
};

export const mockMemoryService = {
  refreshAllMemory: jest.fn().mockResolvedValue(undefined),
  updateMemoryForDocument: jest.fn().mockResolvedValue(undefined),
  queryMemory: jest.fn().mockResolvedValue({
    answer: 'Found 3 SAFE agreements',
    sources: ['document1.pdf', 'document2.pdf']
  }),
  scanAllDocuments: jest.fn().mockResolvedValue([])
};

export const mockSearchService = {
  search: jest.fn().mockResolvedValue({
    results: [],
    totalCount: 0,
    searchType: 'fast',
    processingTime: 100,
    filters: {}
  }),
  getDocumentByFilename: jest.fn().mockResolvedValue(null),
  getDocumentStatistics: jest.fn().mockResolvedValue({
    totalDocuments: 0,
    byCategory: {},
    byStatus: {},
    byType: {}
  })
};

export const mockDiscordClient = {
  login: jest.fn().mockResolvedValue(undefined),
  on: jest.fn(),
  once: jest.fn(),
  user: { tag: 'TestBot#1234' }
};

export const mockDocumensoService = {
  uploadDocumentForTemplate: jest.fn().mockResolvedValue({
    documentId: 123,
    title: 'Test Template',
    documentDataId: 'abc123',
    status: 'DRAFT'
  }),
  generateTemplateCreationLink: jest.fn().mockReturnValue({
    documentId: 123,
    templateCreationUrl: 'https://app.documenso.com/documents/123/convert-to-template',
    apiUrl: 'https://api.documenso.com/api/v1/documents/123'
  }),
  createDocumentFromTemplate: jest.fn().mockResolvedValue({
    documentId: 456,
    recipients: []
  })
};