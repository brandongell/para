import { DocumentMetadata, DocumentClassification } from '../../src/types';
import { DocumentBuilder } from './builders';

// Use realistic legal document content
const SAFE_AGREEMENT_CONTENT = `SIMPLE AGREEMENT FOR FUTURE EQUITY

THIS CERTIFIES THAT in exchange for the payment by XYZ Ventures LLC (the "Investor") 
of $100,000 (the "Purchase Amount") on or about January 16, 2024, ABC Corp, 
a Delaware corporation (the "Company"), hereby issues to the Investor the right to 
certain shares of the Company's capital stock, subject to the terms set forth below.

The "Valuation Cap" is $10,000,000.
The "Discount Rate" is 80%.

SIGNED AND AGREED:

COMPANY:                          INVESTOR:
ABC Corp                          XYZ Ventures LLC

By: /s/ John Doe                  By: /s/ Jane Smith
Name: John Doe                    Name: Jane Smith
Title: CEO                        Title: Managing Partner
Date: January 15, 2024           Date: January 16, 2024`;

export const mockDocuments = {
  executedSAFE: {
    path: '/test/documents/SAFE_Agreement_ABC_XYZ_Executed.pdf',
    content: SAFE_AGREEMENT_CONTENT,
    metadata: {
      filename: 'SAFE_Agreement_ABC_XYZ_Executed.pdf',
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
          name: 'John Doe',
          organization: 'ABC Corp',
          title: 'CEO',
          role: 'Company'
        },
        {
          name: 'Jane Smith',
          organization: 'XYZ Ventures LLC',
          title: 'Managing Partner',
          role: 'Investor'
        }
      ],
      contract_value: '$100,000',
      effective_date: '2024-01-16',
      governing_law: 'Delaware',
      critical_facts: {
        'valuation_cap': '$10,000,000',
        'discount_rate': '80%',
        'purchase_amount': '$100,000'
      }
    } as DocumentMetadata,
    classification: {
      primaryFolder: '03_Finance_and_Investment',
      subfolder: 'SAFE_Agreements',
      confidence: 0.95,
      reasoning: 'SAFE investment agreement between company and investor with $100k investment, valuation cap, and discount rate terms'
    } as DocumentClassification
  },
  
  templateNDA: {
    path: '/test/documents/NDA_Template_[BLANK].pdf',
    content: `MUTUAL NON-DISCLOSURE AGREEMENT

This Mutual Non-Disclosure Agreement ("Agreement") is entered into as of [DATE] 
between [PARTY A NAME], a [PARTY A JURISDICTION] [PARTY A ENTITY TYPE] 
("[PARTY A SHORT NAME]") and [PARTY B NAME], a [PARTY B JURISDICTION] 
[PARTY B ENTITY TYPE] ("[PARTY B SHORT NAME]").

1. Definition of Confidential Information. "Confidential Information" means...
2. Obligations of Receiving Party. The Receiving Party agrees to:
   (a) Hold the Confidential Information in strict confidence
   (b) Not disclose the Confidential Information to any third parties
   
Term: This Agreement shall remain in effect for [TERM LENGTH] from the date first written above.

PARTY A:                          PARTY B:
_____________________________    _____________________________
By: [SIGNATORY A NAME]           By: [SIGNATORY B NAME]
Title: [SIGNATORY A TITLE]       Title: [SIGNATORY B TITLE]
Date: _______________________    Date: _______________________`,
    metadata: {
      filename: 'NDA_Template_[BLANK].pdf',
      status: 'template' as const,
      category: 'Risk_and_Compliance',
      signers: [],
      fully_executed_date: null,
      document_type: 'Mutual NDA',
      template_analysis: {
        is_template: true,
        confidence: 'HIGH' as const,
        indicators: ['[BLANK] in filename', 'Placeholder fields throughout document', 'Signature lines blank'],
        template_type: 'Mutual Non-Disclosure Agreement',
        field_placeholders: [
          '[DATE]', '[PARTY A NAME]', '[PARTY A JURISDICTION]', '[PARTY A ENTITY TYPE]',
          '[PARTY A SHORT NAME]', '[PARTY B NAME]', '[PARTY B JURISDICTION]', 
          '[PARTY B ENTITY TYPE]', '[PARTY B SHORT NAME]', '[TERM LENGTH]',
          '[SIGNATORY A NAME]', '[SIGNATORY A TITLE]', '[SIGNATORY B NAME]', '[SIGNATORY B TITLE]'
        ],
        typical_use_case: 'Standard mutual NDA for business discussions, partnerships, or vendor evaluations'
      }
    } as DocumentMetadata,
    classification: {
      primaryFolder: '09_Templates',
      subfolder: 'Legal_Templates',
      confidence: 0.99,
      reasoning: 'Template document with [BLANK] indicator and multiple placeholder fields for party information and terms'
    } as DocumentClassification
  },

  partiallyExecutedContract: {
    path: '/test/documents/Service_Agreement_Partial.docx',
    content: `PROFESSIONAL SERVICES AGREEMENT

This Agreement is entered into as of February 1, 2024 between Provider LLC,
a California limited liability company ("Service Provider") and Client Corp,
a Delaware corporation ("Client").

Services: Software development and maintenance as detailed in Exhibit A
Contract Value: $50,000 per month
Term: 12 months with automatic annual renewal

SIGNED:
Service Provider: /s/ Alice Johnson    Date: February 1, 2024
Client: ________________________    Date: _________________
        Bob Williams, CTO`,
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
          name: 'Alice Johnson',
          organization: 'Provider LLC',
          role: 'Service Provider'
        },
        {
          name: 'Bob Williams',
          organization: 'Client Corp',
          title: 'CTO',
          role: 'Client'
        }
      ],
      contract_value: '$50,000/month',
      effective_date: null,
      governing_law: 'California',
      renewal_terms: 'automatic_annual',
      critical_facts: {
        'monthly_value': '$50,000',
        'annual_value': '$600,000',
        'auto_renewal': true,
        'pending_signature': 'Client (Bob Williams)'
      }
    } as DocumentMetadata,
    classification: {
      primaryFolder: '05_Operations_and_Vendors',
      subfolder: 'Service_Agreements',
      confidence: 0.92,
      reasoning: 'Professional services agreement for software development, partially executed with client signature pending'
    } as DocumentClassification
  },

  plainTextMemo: {
    path: '/test/documents/Internal_Policy_Update_Memo.txt',
    content: `MEMORANDUM

To: All Staff
From: Sarah Chen, CEO
Date: March 15, 2024
Subject: Remote Work Policy Update

Effective April 1, 2024, our remote work policy will be updated as follows:

1. Hybrid Schedule: All employees are required to be in office Tuesday-Thursday
2. Remote Days: Monday and Friday are designated remote work days
3. Core Hours: 10:00 AM - 3:00 PM [Time Zone] for all locations

This policy supersedes all previous remote work arrangements.

Questions should be directed to HR at hr@company.com.

Sarah Chen
Chief Executive Officer`,
    metadata: {
      filename: 'Internal_Policy_Update_Memo.txt',
      status: 'not_executed' as const,
      category: 'Corporate_and_Governance',
      signers: [],
      fully_executed_date: null,
      document_type: 'Policy Memorandum',
      confidentiality_level: 'internal',
      effective_date: '2024-04-01',
      critical_facts: {
        'policy_type': 'Remote Work',
        'hybrid_days': 'Tuesday-Thursday',
        'remote_days': 'Monday, Friday',
        'core_hours': '10:00 AM - 3:00 PM'
      }
    } as DocumentMetadata,
    classification: {
      primaryFolder: '01_Corporate_and_Governance',
      subfolder: 'Internal_Policies',
      confidence: 0.88,
      reasoning: 'Internal policy memorandum regarding remote work arrangements, issued by CEO'
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
  // Basic searches
  basicSearch: 'SAFE agreements',
  signerSearch: 'documents signed by John Doe',
  dateSearch: 'contracts from January 2024',
  statusSearch: 'show me all executed documents',
  templateSearch: 'I need an NDA template',
  
  // Complex searches
  complexSearch: 'executed SAFE agreements signed by John Doe in 2024 over $50k',
  naturalLanguage: 'Find all investment documents that are fully signed and have Delaware as governing law',
  multiCriteria: 'partially executed service agreements with automatic renewal',
  
  // Edge cases
  typoSearch: 'SAEF agreemnts singed by Jon', // Typos in keywords
  colloquialSearch: 'gimme that contract we did with ABC last month',
  mixedCaseSearch: 'sAfE AGREEments EXECUTED in 2024',
  
  // Filter-based searches
  valueRangeSearch: 'contracts worth between $10k and $100k',
  excludeSearch: 'all agreements except employment contracts',
  
  // Context-aware searches
  contextualSearch: 'show me more documents like this one',
  numberReference: 'tell me about document #3 from the last search',
  followUpSearch: 'what\'s the governing law for that one?',
  
  // Special characters and edge cases
  emptySearch: '',
  specialCharsSearch: 'contracts with $ amounts & percentages',
  unicodeSearch: 'agreements with José García or 李明',
  sqlInjectionAttempt: "'; DROP TABLE documents; --",
  veryLongQuery: 'find '.repeat(100) + 'documents'
};

export const mockDiscordAttachments = [
  {
    id: '1234567890',
    name: 'Employment_Agreement_JohnDoe_2024.pdf',
    url: 'https://cdn.discordapp.com/attachments/123/456/Employment_Agreement_JohnDoe_2024.pdf',
    size: 1024000, // 1MB
    contentType: 'application/pdf',
    proxyURL: 'https://media.discordapp.net/attachments/123/456/Employment_Agreement_JohnDoe_2024.pdf'
  },
  {
    id: '0987654321',
    name: 'Mutual_NDA_Template_[BLANK]_v2.pdf',
    url: 'https://cdn.discordapp.com/attachments/123/456/Mutual_NDA_Template_[BLANK]_v2.pdf',
    size: 512000, // 512KB
    contentType: 'application/pdf',
    proxyURL: 'https://media.discordapp.net/attachments/123/456/Mutual_NDA_Template_[BLANK]_v2.pdf'
  },
  {
    id: '1122334455',
    name: 'Board_Resolution_Q1_2024.docx',
    url: 'https://cdn.discordapp.com/attachments/123/456/Board_Resolution_Q1_2024.docx',
    size: 256000, // 256KB
    contentType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    proxyURL: 'https://media.discordapp.net/attachments/123/456/Board_Resolution_Q1_2024.docx'
  },
  {
    id: '5544332211',
    name: 'Vendor_Invoice_12345.xlsx',
    url: 'https://cdn.discordapp.com/attachments/123/456/Vendor_Invoice_12345.xlsx',
    size: 128000, // 128KB
    contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    proxyURL: 'https://media.discordapp.net/attachments/123/456/Vendor_Invoice_12345.xlsx'
  },
  {
    id: '9988776655',
    name: 'Huge_Merger_Agreement.pdf',
    url: 'https://cdn.discordapp.com/attachments/123/456/Huge_Merger_Agreement.pdf',
    size: 60 * 1024 * 1024, // 60MB - over size limit
    contentType: 'application/pdf',
    proxyURL: 'https://media.discordapp.net/attachments/123/456/Huge_Merger_Agreement.pdf'
  }
];