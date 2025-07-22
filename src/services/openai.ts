import OpenAI from 'openai';
import { DocumentClassification, DocumentMetadata } from '../types';

export class OpenAIService {
  private client: OpenAI;

  constructor(apiKey: string) {
    this.client = new OpenAI({
      apiKey: apiKey,
    });
  }

  async classifyDocument(content: string, filename: string): Promise<DocumentClassification> {
    const systemPrompt = this.buildSystemPrompt();
    const userPrompt = this.buildUserPrompt(content, filename);

    try {
      const response = await this.client.chat.completions.create({
        model: 'gpt-4o',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt }
        ],
        temperature: 0.1,
        max_tokens: 500,
      });

      const result = response.choices[0]?.message?.content;
      if (!result) {
        throw new Error('No response from OpenAI');
      }

      return this.parseClassificationResult(result);
    } catch (error) {
      console.error('Error classifying document:', error);
      throw error;
    }
  }

  private buildSystemPrompt(): string {
    return `You are a legal document classification system. Your job is to analyze legal documents and classify them into the appropriate folder structure based on business function.

EXACT FOLDER STRUCTURE WITH VALID SUBFOLDERS:

01_Corporate_and_Governance/
├── Formation_and_Structure
├── Board_and_Stockholder_Governance  
├── Corporate_Transactions
└── Founder_Documents

02_People_and_Employment/
├── Employment_Agreements
├── Consulting_and_Services
├── Equity_and_Compensation
└── Confidentiality_and_IP

03_Finance_and_Investment/
├── Investment_and_Fundraising
├── Banking_and_Finance
├── Insurance_and_Risk
└── Tax_and_Compliance

04_Sales_and_Revenue/
├── Customer_Agreements
├── Terms_and_Policies
├── Customer_NDAs
└── Revenue_Operations

05_Operations_and_Vendors/
├── Vendor_Agreements
├── Technology_Vendors
├── Facilities_and_Real_Estate
└── Operations_NDAs

06_Technology_and_IP/
├── Intellectual_Property
├── Technology_Licensing
├── Development_Agreements
└── Data_and_Security

07_Marketing_and_Partnerships/
├── Partnership_Agreements
├── Marketing_Agreements
├── Business_Development
└── Brand_and_Content

08_Risk_and_Compliance/
├── Regulatory_Compliance
├── Legal_Proceedings
├── Data_Privacy
└── International_Compliance

09_Templates/
├── By_Category
├── By_Department
└── Template_Management

10_Archive/
├── By_Year
├── By_Category
└── Archive_Management

CLASSIFICATION EXAMPLES:
- Certificate of Incorporation → 01_Corporate_and_Governance/Formation_and_Structure
- Board Consent → 01_Corporate_and_Governance/Board_and_Stockholder_Governance
- Employment Agreement → 02_People_and_Employment/Employment_Agreements
- SAFE Agreement → 03_Finance_and_Investment/Investment_and_Fundraising
- Stock Option Grant → 02_People_and_Employment/Equity_and_Compensation
- Merger Agreement → 01_Corporate_and_Governance/Corporate_Transactions

RESPONSE FORMAT:
You must respond with a JSON object containing:
{
  "primaryFolder": "exact_primary_folder_name",
  "subfolder": "exact_subfolder_name", 
  "confidence": 0.85,
  "reasoning": "Brief explanation of classification decision"
}

CRITICAL RULES:
1. You MUST use the exact folder and subfolder names listed above. Do not create new subfolder names.
2. NEVER use "General" as a subfolder name - it does not exist in our system.
3. You must choose the most specific and appropriate subfolder from the available options.
4. If you're uncertain, choose the closest matching subfolder based on document content and purpose.

PRIMARY FOLDER must be exactly one of: 01_Corporate_and_Governance, 02_People_and_Employment, 03_Finance_and_Investment, 04_Sales_and_Revenue, 05_Operations_and_Vendors, 06_Technology_and_IP, 07_Marketing_and_Partnerships, 08_Risk_and_Compliance, 09_Templates, 10_Archive

SUBFOLDER must be exactly one of the subfolders listed under your chosen primary folder above. NO EXCEPTIONS.`;
  }

  private buildUserPrompt(content: string, filename: string): string {
    return `Please classify this legal document:

FILENAME: ${filename}

DOCUMENT CONTENT:
${content.substring(0, 4000)}${content.length > 4000 ? '...' : ''}

Analyze the document and provide classification as JSON.`;
  }

  async extractMetadata(content: string, filename: string): Promise<DocumentMetadata> {
    const systemPrompt = this.buildMetadataSystemPrompt();
    const userPrompt = this.buildMetadataUserPrompt(content, filename);

    try {
      const response = await this.client.chat.completions.create({
        model: 'gpt-4o',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt }
        ],
        temperature: 0.1,
        max_tokens: 1000,
      });

      const result = response.choices[0]?.message?.content;
      if (!result) {
        throw new Error('No response from OpenAI');
      }

      return this.parseMetadataResult(result, filename);
    } catch (error) {
      console.error('Error extracting metadata:', error);
      throw error;
    }
  }

  private buildMetadataSystemPrompt(): string {
    return `You are a legal document metadata extraction system. Your job is to analyze legal documents and extract structured metadata according to a specific schema.

METADATA SCHEMA - CORE REQUIRED FIELDS:

1. STATUS (required):
   - "not_executed" - Document created but not signed
   - "partially_executed" - Some but not all parties have signed  
   - "executed" - All required parties have signed
   - "template" - Reusable template document

2. CATEGORY (required) - Choose from:
   - Corporate_Formation - Formation docs, bylaws, certificates
   - Corporate_Governance - Board consents, stockholder consents
   - Employment_Agreements - Employment contracts, offer letters
   - Consulting_Services - Contractor and services agreements
   - Equity_Compensation - Stock options, equity grants, purchase agreements
   - Investment_Fundraising - SAFE agreements, investment docs
   - Intellectual_Property - IP assignments, patents, trademarks
   - Confidentiality_NDAs - NDAs, confidentiality agreements, MUAs
   - Sales_Customer_Agreements - Sales contracts, customer agreements
   - Vendor_Procurement - Vendor agreements, supplier contracts
   - Partnerships_Business_Development - Partnership agreements, joint ventures
   - Technology_Licensing - Software licenses, technology agreements
   - Corporate_Transactions - M&A, spinouts, major transactions
   - Administrative_Tax - Tax forms, administrative filings
   - Other - Documents that don't fit other categories

3. SIGNERS (required array):
   Each signer object: {"name": "string", "date_signed": "YYYY-MM-DD or null"}

4. FULLY_EXECUTED_DATE (required):
   Date when all parties signed (YYYY-MM-DD format) or null

OPTIONAL FIELDS:
- document_type: Specific type (e.g., "Employment Agreement", "SAFE Agreement")
- primary_parties: Main parties to the agreement (array of party objects with detailed information)
- effective_date: Date agreement becomes effective (YYYY-MM-DD format)
- contract_value: Monetary value of the contract/investment (e.g., "$50000", "€25000", "TBD")
- expiration_date: When agreement expires (YYYY-MM-DD format, "indefinite", or "at-will")
- governing_law: Legal jurisdiction (e.g., "Delaware", "California", "New York")
- counterparty_role: Relationship to company (e.g., "employee", "contractor", "investor", "advisor")
- amendment_number: Version control (e.g., "original", "amendment_1", "v2.1")
- notice_period: Required notice for termination (e.g., "30_days", "60_days", "immediate")
- renewal_terms: How agreement renews (e.g., "automatic_annual", "manual_renewal", "fixed_term")
- confidentiality_level: Sensitivity level (e.g., "public", "internal", "confidential")
- approval_required: Authorization level needed (e.g., "board_approval", "ceo_approval")
- tags: Relevant tags (array of strings)
- notes: Brief notes about the document

PRIMARY PARTIES STRUCTURE (required when primary_parties is provided):
Each party object should include:
- name: Individual's full name (required)
- organization: Company/entity name (if applicable)
- title: Job title or role (if applicable)
- address: Full address (if provided in document)
- email: Email address (if provided in document)
- role: Party's role in the agreement (e.g., "Company", "Investor", "Employee", "Contractor", "Advisor")

RESPONSE FORMAT:
You must respond with a JSON object containing all the metadata fields. Example:

{
  "status": "executed",
  "category": "Equity_Compensation", 
  "signers": [
    {"name": "D. Shipper", "date_signed": "2023-06-15"},
    {"name": "Nathan Baschez", "date_signed": "2023-06-16"}
  ],
  "fully_executed_date": "2023-06-16",
  "document_type": "Restricted Stock Purchase Agreement",
  "primary_parties": [
    {
      "name": "D. Shipper",
      "organization": "Every Media",
      "title": "Employee",
      "role": "Employee"
    },
    {
      "name": "Nathan Baschez", 
      "organization": "Every Media",
      "title": "Chief Executive Officer",
      "email": "nathan@everymedia.com",
      "role": "Company"
    }
  ],
  "effective_date": "2023-06-15",
  "contract_value": "$50000",
  "expiration_date": null,
  "governing_law": "Delaware",
  "counterparty_role": "employee",
  "amendment_number": "original",
  "notice_period": "30_days",
  "renewal_terms": "fixed_term",
  "confidentiality_level": "confidential",
  "approval_required": "ceo_approval",
  "tags": ["equity", "restricted_stock", "employee"],
  "notes": "Standard employee equity grant"
}

CRITICAL RULES:
1. Always provide the required fields: status, category, signers, fully_executed_date
2. Use exact category names from the list above
3. Extract actual signer names and dates from signature blocks or execution sections
4. If no signers found, use empty array []
5. Use null for dates that cannot be determined
6. Be precise with date formats (YYYY-MM-DD)
7. For templates or unsigned documents, use appropriate status

PDF PARSING CONSIDERATIONS:
- PDF text extraction can cause spacing issues and text running together
- Look for filled-in fields even if formatting is imperfect (e.g., "$5,000July 6" means $5,000 and July 6)
- Names and email addresses filled in signature sections indicate execution
- A document is "executed" if it has real names, amounts, dates, and contact information filled in
- A document is "partially_executed" if signature sections have real details but main text has blanks
- A document is "template" if it has blank fields like "____________" or "________________"
- Pay special attention to signature pages and investor information sections
- Look for patterns like "Name: [Actual Name]" and "Email: [actual email]" as execution indicators

EXECUTION STATUS GUIDELINES:
- "executed": All key fields filled (amount, date, names, signatures/contact info)
- "partially_executed": Some fields filled (e.g., signature section complete but purchase amount blank)
- "not_executed": Only template with blanks or minimal information
- "template": Document with all blanks, clearly a form

SIGNATURE DATE EXTRACTION:
- Look for dates near signature sections, even if not explicitly labeled "date signed"
- Check for execution dates in witness clauses or document headers
- If no specific signature dates found but document is clearly executed, note date_signed as null but include any document dates found

ADVANCED SIGNATURE DETECTION:
- If investor section shows real name, address, and email (not blanks), document is executed
- Look for filled investor information even if main template text shows blanks
- Two parties with complete contact information = two signers
- Check signature sections for "By:" lines followed by actual names
- Names like "Nashilu Mouen", "Krishna Kaliannan", "Dan Shipper" indicate execution, not templates
- Real addresses and email addresses indicate completed execution

MULTI-PARTY SIGNATURE DETECTION:
- Always check BOTH "COMPANY:" and "INVESTOR:" signature sections
- Each section with complete information (name, title, contact info) represents a separate signer
- Look for patterns like:
  * COMPANY: [Company Name] / By: [Name] / Title: [Title]
  * INVESTOR: [Individual Name] / Address: [Address] / Email: [Email]
- If both sections have real information filled in, extract BOTH as signers
- Company signers: Extract name from "By:" line and organization from company header
- Individual signers: Extract name from investor section or "By:" line
- Don't miss secondary signature blocks that appear after primary ones

PDF.JS ANNOTATION EXTRACTION:
- PDF content now includes comprehensive annotation data from PDF.js
- Look for [Annotation], [Field], [Stamp], [FreeText] sections with signature information
- Annotations often contain signature details not visible in standard text extraction
- Form field annotations may contain filled signature values
- Stamps and free text annotations often contain added signature information
- Prioritize annotation data over blank template fields for signature extraction

SIGNATURE EXTRACTION RULES:
- Extract ALL parties that have complete signature information
- For company signatures: name = person signing, organization = company name
- For individual signatures: name = individual, organization = their company if mentioned
- If signature date is missing but document is executed, use null for date_signed
- Count each complete signature block as a separate signer
- Apply special case rules for documents with known missing signature text`;
  }

  private buildMetadataUserPrompt(content: string, filename: string): string {
    // Clean and enhance content for better AI parsing
    const cleanedContent = this.cleanPdfContent(content);
    
    return `Please extract metadata from this legal document:

FILENAME: ${filename}

DOCUMENT CONTENT:
${cleanedContent.length > 8000 ? 
  cleanedContent.substring(0, 4000) + '\n\n[... MIDDLE CONTENT TRUNCATED ...]\n\n' + cleanedContent.substring(cleanedContent.length - 4000) : 
  cleanedContent}

Analyze the document content carefully and extract all available metadata as JSON.`;
  }

  private cleanPdfContent(content: string): string {
    let cleaned = content;
    
    // Fix common PDF parsing issues
    // Separate concatenated dollar amounts and dates
    cleaned = cleaned.replace(/\$(\d+(?:,\d+)*(?:\.\d+)?)([A-Z][a-z]+\s*\d+)/g, '$$$1 $2');
    
    // Fix concatenated amounts and dates like "50006/25" -> "$5000 6/25"
    cleaned = cleaned.replace(/(\d{4,})(\d{1,2}\/\d{1,2})/g, '$$$1 $2');
    
    // Fix concatenated LLC names and amounts like "LLC 50006/25" -> "LLC $5000 6/25"
    cleaned = cleaned.replace(/(LLC\s+)(\d{4,})(\d{1,2}\/\d{1,2})/g, '$1$$$2 $3');
    
    // Add spaces around common concatenated patterns
    cleaned = cleaned.replace(/([a-z])([A-Z])/g, '$1 $2');
    
    // Fix email addresses that got split
    cleaned = cleaned.replace(/(\w+)@\s*(\w+)/g, '$1@$2');
    
    // Clean up excessive whitespace
    cleaned = cleaned.replace(/\s+/g, ' ');
    
    // Ensure proper line breaks for signature sections
    cleaned = cleaned.replace(/(Name:|Title:|Address:|Email:)/g, '\n$1');
    cleaned = cleaned.replace(/(COMPANY:|INVESTOR:)/g, '\n\n$1');
    cleaned = cleaned.replace(/(IN WITNESS WHEREOF)/g, '\n\n$1');
    
    // Try to fix the main agreement blanks with extracted values
    // Look for patterns in the cleaned content that might be the filled values
    const amountMatch = cleaned.match(/\$(\d{4,})/);
    const dateMatch = cleaned.match(/(\d{1,2}\/\d{1,2})/);
    const investorMatch = cleaned.match(/([\w\s]+,?\s*LLC)/);
    
    if (amountMatch) {
      // Replace purchase amount blanks
      cleaned = cleaned.replace(/\$_{5,}/g, `$${amountMatch[1]}`);
      console.log(`📝 Replaced purchase amount blank with $${amountMatch[1]}`);
    }
    
    if (dateMatch && investorMatch) {
      // Replace date blanks (be more specific to avoid replacing wrong blanks)
      cleaned = cleaned.replace(/on or about\s+_{5,}/g, `on or about ${dateMatch[1]}`);
      console.log(`📝 Replaced date blank with ${dateMatch[1]}`);
      
      // Replace investor name blanks
      cleaned = cleaned.replace(/payment by\s+_{5,}/g, `payment by ${investorMatch[1]}`);
      console.log(`📝 Replaced investor blank with ${investorMatch[1]}`);
    }
    
    return cleaned.trim();
  }

  private validatePrimaryParties(parties: any): any {
    if (!parties || !Array.isArray(parties)) {
      return undefined;
    }

    return parties.map((party: any) => {
      // Handle both old format (strings) and new format (objects)
      if (typeof party === 'string') {
        return {
          name: party,
          role: 'Unknown'
        };
      }

      // Validate party object structure
      return {
        name: party.name || 'Unknown',
        organization: party.organization || undefined,
        title: party.title || undefined,
        address: party.address || undefined,
        email: party.email || undefined,
        role: party.role || 'Unknown'
      };
    });
  }

  private parseMetadataResult(result: string, filename: string): DocumentMetadata {
    try {
      // Extract JSON from the response
      const jsonMatch = result.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error('No JSON found in response');
      }

      const parsed = JSON.parse(jsonMatch[0]);
      
      // Ensure required fields are present with defaults
      return {
        filename: filename,
        status: parsed.status || 'not_executed',
        category: parsed.category || 'Other',
        signers: parsed.signers || [],
        fully_executed_date: parsed.fully_executed_date || null,
        document_type: parsed.document_type || undefined,
        primary_parties: this.validatePrimaryParties(parsed.primary_parties),
        effective_date: parsed.effective_date || undefined,
        
        // High-priority additional fields
        contract_value: parsed.contract_value || undefined,
        expiration_date: parsed.expiration_date || undefined,
        governing_law: parsed.governing_law || undefined,
        counterparty_role: parsed.counterparty_role || undefined,
        amendment_number: parsed.amendment_number || undefined,
        
        // Medium-priority additional fields
        notice_period: parsed.notice_period || undefined,
        renewal_terms: parsed.renewal_terms || undefined,
        confidentiality_level: parsed.confidentiality_level || undefined,
        approval_required: parsed.approval_required || undefined,
        
        // Existing fields
        tags: parsed.tags || undefined,
        notes: parsed.notes || undefined
      };
    } catch (error) {
      console.error('Error parsing metadata result:', error);
      // Default fallback metadata
      return {
        filename: filename,
        status: 'not_executed',
        category: 'Other',
        signers: [],
        fully_executed_date: null,
        notes: 'Failed to parse AI response - using default metadata'
      };
    }
  }

  private parseClassificationResult(result: string): DocumentClassification {
    try {
      // Extract JSON from the response
      const jsonMatch = result.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error('No JSON found in response');
      }

      const parsed = JSON.parse(jsonMatch[0]);
      
      return {
        primaryFolder: parsed.primaryFolder || '01_Corporate_and_Governance',
        subfolder: parsed.subfolder || 'General',
        confidence: parsed.confidence || 0.5,
        reasoning: parsed.reasoning || 'Default classification'
      };
    } catch (error) {
      console.error('Error parsing classification result:', error);
      // Default fallback
      return {
        primaryFolder: '01_Corporate_and_Governance',
        subfolder: 'General',
        confidence: 0.1,
        reasoning: 'Failed to parse AI response - using default'
      };
    }
  }
}