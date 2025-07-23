import { DocumentMetadata, DocumentClassification } from '../../src/types';

export const mockDocuments = {
  executedSAFE: {
    path: '/test/documents/SAFE_Agreement_Executed.pdf',
    content: 'This is a SAFE Agreement between Company ABC and Investor XYZ...',
    metadata: {
      filename: 'SAFE_Agreement_Executed.pdf',
      status: 'executed' as const,
      category: 'Finance_and_Investment',
      signers: [
        { name: 'John Doe', date_signed: '2024-01-15' },
        { name: 'Jane Smith', date_signed: '2024-01-16' }
      ],
      fully_executed_date: '2024-01-16',
      document_type: 'SAFE Agreement',
      primary_parties: [
        {
          name: 'Company ABC',
          organization: 'ABC Corp',
          role: 'Company'
        },
        {
          name: 'Investor XYZ',
          organization: 'XYZ Ventures',
          role: 'Investor'
        }
      ],
      contract_value: '$100,000',
      effective_date: '2024-01-16',
      governing_law: 'Delaware'
    } as DocumentMetadata,
    classification: {
      primaryFolder: '03_Finance_and_Investment',
      subFolder: 'SAFE_Agreements',
      documentType: 'SAFE Agreement',
      parties: ['Company ABC', 'Investor XYZ'],
      reasoning: 'SAFE investment agreement between company and investor'
    } as DocumentClassification
  },
  
  templateNDA: {
    path: '/test/documents/NDA_Template_[BLANK].pdf',
    content: 'MUTUAL NON-DISCLOSURE AGREEMENT between [PARTY A] and [PARTY B]...',
    metadata: {
      filename: 'NDA_Template_[BLANK].pdf',
      status: 'template' as const,
      category: 'Risk_and_Compliance',
      signers: [],
      fully_executed_date: null,
      document_type: 'NDA',
      template_analysis: {
        is_template: true,
        confidence: 'HIGH' as const,
        indicators: ['[BLANK] in filename', 'Placeholder fields found'],
        template_type: 'Mutual NDA',
        field_placeholders: ['[PARTY A]', '[PARTY B]', '[DATE]'],
        typical_use_case: 'Standard mutual non-disclosure agreement for business discussions'
      }
    } as DocumentMetadata,
    classification: {
      primaryFolder: '09_Templates',
      subFolder: 'Legal_Templates',
      documentType: 'NDA Template',
      parties: [],
      reasoning: 'Template document with placeholder fields'
    } as DocumentClassification
  },

  partiallyExecutedContract: {
    path: '/test/documents/Service_Agreement_Partial.docx',
    content: 'SERVICE AGREEMENT between Provider LLC and Client Corp...',
    metadata: {
      filename: 'Service_Agreement_Partial.docx',
      status: 'partially_executed' as const,
      category: 'Operations_and_Vendors',
      signers: [
        { name: 'Alice Johnson', date_signed: '2024-02-01' },
        { name: 'Bob Williams', date_signed: null }
      ],
      fully_executed_date: null,
      document_type: 'Service Agreement',
      primary_parties: [
        {
          name: 'Provider LLC',
          organization: 'Provider LLC',
          role: 'Service Provider'
        },
        {
          name: 'Client Corp',
          organization: 'Client Corp',
          role: 'Client'
        }
      ],
      contract_value: '$50,000',
      effective_date: null,
      governing_law: 'California',
      renewal_terms: 'automatic_annual'
    } as DocumentMetadata,
    classification: {
      primaryFolder: '05_Operations_and_Vendors',
      subFolder: 'Service_Agreements',
      documentType: 'Service Agreement',
      parties: ['Provider LLC', 'Client Corp'],
      reasoning: 'Service agreement between vendor and client'
    } as DocumentClassification
  },

  plainTextMemo: {
    path: '/test/documents/Internal_Memo.txt',
    content: 'MEMORANDUM\nTo: All Staff\nFrom: CEO\nSubject: New Policy\n\nEffective immediately...',
    metadata: {
      filename: 'Internal_Memo.txt',
      status: 'not_executed' as const,
      category: 'Corporate_and_Governance',
      signers: [],
      fully_executed_date: null,
      document_type: 'Internal Memo',
      confidentiality_level: 'internal'
    } as DocumentMetadata,
    classification: {
      primaryFolder: '01_Corporate_and_Governance',
      subFolder: 'Internal_Policies',
      documentType: 'Memo',
      parties: [],
      reasoning: 'Internal company memorandum'
    } as DocumentClassification
  },

  corruptedFile: {
    path: '/test/documents/Corrupted_Contract.pdf',
    content: null,
    error: 'Failed to read file: Invalid PDF structure'
  },

  unsupportedFile: {
    path: '/test/documents/Presentation.pptx',
    content: null,
    error: 'Unsupported file type: .pptx'
  }
};

export const mockSearchQueries = {
  basicSearch: 'SAFE agreements',
  signerSearch: 'documents signed by John Doe',
  dateSearch: 'contracts from January 2024',
  statusSearch: 'show me all executed documents',
  templateSearch: 'I need an NDA template',
  complexSearch: 'executed SAFE agreements signed by John Doe in 2024',
  naturalLanguage: 'Find all investment documents that are fully signed',
  contextualSearch: 'show me more like this',
  numberReference: 'tell me about document #3'
};

export const mockDiscordAttachments = [
  {
    id: '1234567890',
    name: 'Employment_Agreement.pdf',
    url: 'https://cdn.discordapp.com/attachments/123/456/Employment_Agreement.pdf',
    size: 1024000, // 1MB
    contentType: 'application/pdf'
  },
  {
    id: '0987654321',
    name: 'Template_[BLANK]_NDA.pdf',
    url: 'https://cdn.discordapp.com/attachments/123/456/Template_[BLANK]_NDA.pdf',
    size: 512000, // 512KB
    contentType: 'application/pdf'
  }
];