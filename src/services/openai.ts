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
    // Check for template indicators in filename FIRST
    const cleanFilename = filename.replace(/^\d+_/, ''); // Remove timestamp prefix
    const templateIndicators = ['[BLANK]', '[FORM]', '(Form)', 'Form', 'FORM', 'Template', 'TEMPLATE', '_Form.', '_FORM.'];
    const isTemplate = templateIndicators.some(indicator => cleanFilename.includes(indicator));
    
    if (isTemplate) {
      console.log(`📋 Detected template based on filename: ${cleanFilename}`);
      return {
        primaryFolder: '09_Templates',
        subfolder: 'By_Category',
        confidence: 0.95,
        reasoning: `Filename contains template indicator: ${cleanFilename}`
      };
    }

    // Otherwise, proceed with content-based classification
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

TEMPLATE CLASSIFICATION RULE:
If the filename contains [BLANK], [FORM], (Form), Form, FORM, Template, TEMPLATE, or similar indicators, classify to:
→ 09_Templates/By_Category (for specific business categories)
→ 09_Templates/By_Department (for department-specific templates)
→ 09_Templates/Template_Management (for template documentation)

CLASSIFICATION EXAMPLES:
- Certificate of Incorporation → 01_Corporate_and_Governance/Formation_and_Structure
- Board Consent → 01_Corporate_and_Governance/Board_and_Stockholder_Governance
- Employment Agreement → 02_People_and_Employment/Employment_Agreements
- Employment Agreement [BLANK] → 09_Templates/By_Category
- SAFE Agreement → 03_Finance_and_Investment/Investment_and_Fundraising
- SAFE Agreement (Form) → 09_Templates/By_Category
- Stock Option Grant → 02_People_and_Employment/Equity_and_Compensation
- Merger Agreement → 01_Corporate_and_Governance/Corporate_Transactions
- Individual Contractor Agreement [BLANK] → 09_Templates/By_Category
- Training Services Agreement (we provide to customer) → 04_Sales_and_Revenue/Customer_Agreements
- Consulting Agreement (we hire consultant) → 02_People_and_Employment/Consulting_and_Services
- Proposal/Agreement where customer pays us → 04_Sales_and_Revenue/Customer_Agreements

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
5. CUSTOMER VS VENDOR RULE: If the document shows another party paying US for services/products, it's a Customer Agreement (04_Sales_and_Revenue). If we're paying THEM, it's either Consulting_Services (02_People_and_Employment) or Vendor_Procurement (05_Operations_and_Vendors).

PRIMARY FOLDER must be exactly one of: 01_Corporate_and_Governance, 02_People_and_Employment, 03_Finance_and_Investment, 04_Sales_and_Revenue, 05_Operations_and_Vendors, 06_Technology_and_IP, 07_Marketing_and_Partnerships, 08_Risk_and_Compliance, 09_Templates, 10_Archive

SUBFOLDER must be exactly one of the subfolders listed under your chosen primary folder above. NO EXCEPTIONS.`;
  }

  private buildUserPrompt(content: string, filename: string): string {
    // Remove timestamp prefix if present (e.g., "1753216040008_MNDA_Form.pdf" -> "MNDA_Form.pdf")
    const cleanFilename = filename.replace(/^\d+_/, '');
    
    return `Please classify this legal document:

FILENAME: ${cleanFilename}
ORIGINAL FILENAME (if different): ${filename !== cleanFilename ? filename : 'N/A'}

DOCUMENT CONTENT:
${content.substring(0, 4000)}${content.length > 4000 ? '...' : ''}

Analyze the document and provide classification as JSON.`;
  }

  async extractMetadata(content: string, filename: string): Promise<DocumentMetadata> {
    // Check for template indicators in filename FIRST
    const cleanFilename = filename.replace(/^\d+_/, ''); // Remove timestamp prefix
    const templateIndicators = ['[BLANK]', '[FORM]', '(Form)', 'Form', 'FORM', 'Template', 'TEMPLATE', '_Form.', '_FORM.'];
    const isTemplate = templateIndicators.some(indicator => cleanFilename.includes(indicator));
    
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

      const metadata = this.parseMetadataResult(result, filename);
      
      // Override status if filename indicates template
      if (isTemplate) {
        console.log(`📋 Overriding metadata status to 'template' based on filename: ${cleanFilename}`);
        metadata.status = 'template';
        metadata.category = 'Templates';
        if (!metadata.template_analysis) {
          metadata.template_analysis = {
            is_template: true,
            confidence: 'HIGH',
            indicators: [`Filename contains template indicator: ${cleanFilename}`],
            template_type: this.extractTemplateType(cleanFilename)
          };
        }
      }
      
      return metadata;
    } catch (error) {
      console.error('Error extracting metadata:', error);
      throw error;
    }
  }
  
  private extractTemplateType(filename: string): string {
    // Extract document type from filename
    if (filename.includes('NDA') || filename.includes('MNDA')) return 'Non-Disclosure Agreement';
    if (filename.includes('Employment')) return 'Employment Agreement';
    if (filename.includes('SAFE')) return 'SAFE Agreement';
    if (filename.includes('Stock') || filename.includes('Option')) return 'Stock Option Agreement';
    if (filename.includes('Service')) return 'Services Agreement';
    return 'Legal Document Template';
  }

  private buildMetadataSystemPrompt(): string {
    return `You are a legal document metadata extraction system. Your job is to analyze legal documents and extract structured metadata according to a specific schema.

STEP 1: TEMPLATE IDENTIFICATION (ANALYZE THIS FIRST)

You must first determine if this document is a reusable template. Use the following criteria:

PRIMARY INDICATORS (Strong Template Evidence):
- Explicit template labels: "Form", "FORM", "Template", "BLANK" in filename
- Bracketed indicators: [FORM], [BLANK], [TEMPLATE]
- Parenthetical indicators: (Form), (Template), (Blank)

SECONDARY INDICATORS (Moderate Template Evidence):
- Generic document names without specific party names
- Files with placeholder language like "Pro Forma" or "Draft"
- Documents with blank fields marked as "____________" or "[________]"
- Placeholder text like "[COMPANY NAME]", "[EMPLOYEE NAME]", "[DATE]"

EXCLUSION CRITERIA (NOT Templates):
- Specific party names in filename (e.g., "Agreement (John Smith)")
- "EXECUTED" or "SIGNED" indicators
- Specific dates or transaction details in filename
- Legal file numbers or case references
- "Filed" or "Recorded" indicators
- Documents with filled-in names, dates, and amounts

TEMPLATE CONFIDENCE LEVELS:
- HIGH: Explicit template labels in filename or clear placeholder fields
- MEDIUM: Generic naming without specific parties, some blank fields
- LOW: Ambiguous cases requiring deeper content analysis

STEP 2: METADATA EXTRACTION

Based on template identification, extract metadata accordingly:

If identified as template (is_template: true):
- Set status to "template"
- Skip detailed signer extraction (use empty array for signers)
- Focus on identifying template type and typical use case
- Extract placeholder fields found in the document
- Category should typically be "Templates" unless strong reason otherwise

If NOT a template:
- Continue with normal metadata extraction as specified below

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
   - Consulting_Services - Agreements where WE HIRE consultants/contractors to provide services TO US
   - Equity_Compensation - Stock options, equity grants, purchase agreements
   - Investment_Fundraising - SAFE agreements, investment docs
   - Intellectual_Property - IP assignments, patents, trademarks
   - Confidentiality_NDAs - NDAs, confidentiality agreements, MUAs
   - Sales_Customer_Agreements - Agreements where WE PROVIDE services/products TO CUSTOMERS who pay us (revenue-generating)
   - Vendor_Procurement - Vendor agreements, supplier contracts where we purchase from others
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

ENHANCED INFORMATION CAPTURE FIELDS (ALL REQUIRED):

1. business_context (string): A detailed 3-5 sentence narrative explaining the business importance and implications

2. key_terms (array of strings): 5-15 most important terms, conditions, or provisions

3. obligations (array of strings): All specific deliverables, milestones, or requirements

4. financial_terms (object): Comprehensive financial information including:
   - payment_schedule
   - payment_terms
   - pricing_model
   - revenue_share
   - minimum_commitment
   - discounts
   - penalties
   - Any other financial provisions

5. critical_facts (object): Any other important information as key-value pairs

RESPONSE FORMAT:
You must respond with a JSON object containing all the metadata fields. 

For templates, include the template_analysis object:
{
  "template_analysis": {
    "is_template": true,
    "confidence": "HIGH",
    "indicators": ["[BLANK] in filename", "placeholder fields throughout"],
    "template_type": "Employment Agreement",
    "field_placeholders": ["[EMPLOYEE NAME]", "[START DATE]", "[SALARY]", "[TITLE]"],
    "typical_use_case": "Standard employment agreement for new hires"
  },
  "status": "template",
  "category": "Employment_Agreements",
  "signers": [],
  "fully_executed_date": null,
  "document_type": "Employment Agreement Template",
  "tags": ["template", "employment", "form"],
  "notes": "Reusable employment agreement template with standard terms"
}

For executed documents, omit template_analysis or set is_template to false:
{
  "template_analysis": {
    "is_template": false,
    "confidence": "HIGH",
    "indicators": ["specific party names", "filled amounts", "execution date"]
  },
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
- Apply special case rules for documents with known missing signature text

CRITICAL FACTS EXTRACTION:
You MUST extract critical facts based on the document type. These are key pieces of information that users will search for later.

1. First identify the document type and purpose
2. Based on the document type, extract the appropriate critical facts into the critical_facts object
3. Use snake_case for all keys (e.g., ein_number, not "EIN Number")
4. Extract numeric values without currency symbols when appropriate
5. Format dates as YYYY-MM-DD

EXAMPLES BY DOCUMENT TYPE:

TAX DOCUMENTS:
- EIN Confirmation Letter → ein_number (look for "Employer Identification Number:" followed by XX-XXXXXXX), entity_name, responsible_party, issue_date (look for "Date of this notice:")
- State Tax Registration → state_tax_id, registration_state, tax_types, filing_frequency
- Tax Returns → tax_year, taxable_income, taxes_paid, filing_status

EMPLOYMENT AGREEMENTS:
- Employment Agreement → employee_name, title, salary, start_date, reporting_to, equity_grant
- Offer Letter → position, base_salary, signing_bonus, benefits_summary, probation_period
- Contractor Agreement → contractor_name, hourly_rate, project_scope, deliverables, term_end_date

INVESTMENT DOCUMENTS:
- SAFE Agreement → investor_name, investment_amount, valuation_cap, discount_rate, mfn_provision
- Series A Agreement → lead_investor, round_size, pre_money_valuation, board_seats, liquidation_preference
- Convertible Note → principal_amount, interest_rate, maturity_date, conversion_discount

CORPORATE FORMATION:
- Certificate of Incorporation → entity_name, state_of_incorporation, incorporation_date, authorized_shares, entity_number
- Operating Agreement → membership_units, voting_thresholds, management_structure
- Bylaws → officer_positions, quorum_requirements, fiscal_year_end

VENDOR/CUSTOMER AGREEMENTS:
- Customer Agreement → customer_name, contract_value, payment_terms, renewal_date, services_provided
- Vendor Agreement → vendor_name, monthly_cost, service_level, termination_notice
- SaaS Agreement → subscription_fee, user_licenses, data_retention_period

REAL ESTATE:
- Office Lease → landlord, monthly_rent, lease_term, square_footage, address, security_deposit
- Sublease → sublessor, sublease_rent, term_end_date, permitted_use

INTELLECTUAL PROPERTY:
- Patent Assignment → patent_numbers, assignor, assignment_date, consideration
- Trademark Application → mark_name, class_codes, filing_date, serial_number
- IP License → licensee, royalty_rate, territory, field_of_use

INSURANCE:
- Insurance Policy → policy_number, coverage_amount, deductible, policy_period, carrier, premium

COMPLIANCE/LEGAL:
- Settlement Agreement → settlement_amount, release_scope, confidentiality_terms
- Regulatory Filing → agency, filing_type, submission_date, compliance_period

IMPORTANT: Extract ALL relevant critical facts for the document type. The examples above are not exhaustive - use your judgment to identify what information would be most valuable to preserve and search for later.

SPECIAL PATTERNS TO LOOK FOR:
- EIN numbers: Look for "Employer Identification Number:" or "EIN" followed by a pattern like XX-XXXXXXX (e.g., 85-0989775)
- Tax IDs: Look for patterns matching federal or state tax identification numbers
- Policy numbers: Often appear after "Policy Number:" or "Policy #"
- Entity numbers: Look for state entity/registration numbers

DO NOT INCLUDE:
- Bank account numbers or routing numbers
- Social security numbers
- Credit card information
- Other sensitive financial account details`;
  }

  private buildMetadataUserPrompt(content: string, filename: string): string {
    // Clean and enhance content for better AI parsing
    const cleanedContent = this.cleanPdfContent(content);
    
    // Remove timestamp prefix if present (e.g., "1753216040008_MNDA_Form.pdf" -> "MNDA_Form.pdf")
    const cleanFilename = filename.replace(/^\d+_/, '');
    
    return `Please extract metadata from this legal document:

FILENAME: ${cleanFilename}
ORIGINAL FILENAME (if different): ${filename !== cleanFilename ? filename : 'N/A'}

DOCUMENT CONTENT:
${cleanedContent.length > 10000 ? 
  cleanedContent.substring(0, 5000) + '\n\n[... MIDDLE CONTENT TRUNCATED ...]\n\n' + cleanedContent.substring(cleanedContent.length - 5000) : 
  cleanedContent}

CRITICAL INSTRUCTIONS FOR COMPREHENSIVE INFORMATION EXTRACTION:

YOU MUST BE EXTREMELY THOROUGH. Extract EVERYTHING important from this document:

1. BUSINESS CONTEXT (Required): Write a detailed 3-5 sentence narrative explaining:
   - What this document accomplishes for the business
   - Strategic importance and business implications
   - Key risks, opportunities, or notable provisions
   - Why this document matters to the company

2. KEY TERMS (Required): Extract 5-15 of the MOST IMPORTANT terms, conditions, or provisions as an array of strings. Include:
   - Major contractual obligations
   - Important rights and restrictions
   - Significant conditions or requirements
   - Notable exclusions or limitations

3. OBLIGATIONS (Required): List ALL specific deliverables, milestones, requirements, or commitments

4. FINANCIAL TERMS (Required): Extract EVERYTHING money-related:
   - All payment amounts and schedules
   - Pricing models, rates, and structures
   - Revenue shares, commissions, or fees
   - Discounts, penalties, credits, or adjustments
   - Minimum commitments, caps, or thresholds
   - Budget allocations or cost breakdowns

5. CRITICAL FACTS (Required): ANY other important information, such as:
   - Product names, SKUs, or service descriptions
   - Important dates, deadlines, or time periods
   - Performance metrics, SLAs, or KPIs
   - Geographic territories or restrictions
   - Exclusivity or non-compete provisions
   - Intellectual property assignments or licenses
   - Unique provisions or unusual terms
   - Contact information or key personnel
   - Any industry-specific details

Extract ALL standard metadata fields PLUS these enhanced fields. Be EXHAUSTIVE - we want to capture EVERY important detail for future reference and search.`;
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
      
      // Parse template analysis if present
      let templateAnalysis = undefined;
      if (parsed.template_analysis) {
        templateAnalysis = {
          is_template: parsed.template_analysis.is_template || false,
          confidence: parsed.template_analysis.confidence || 'LOW',
          indicators: parsed.template_analysis.indicators || [],
          template_type: parsed.template_analysis.template_type || undefined,
          field_placeholders: parsed.template_analysis.field_placeholders || undefined,
          typical_use_case: parsed.template_analysis.typical_use_case || undefined
        };
      }
      
      // If template analysis indicates it's a template, ensure status is set correctly
      const status = (templateAnalysis?.is_template === true) ? 'template' : (parsed.status || 'not_executed');
      
      // Ensure required fields are present with defaults
      return {
        filename: filename,
        status: status,
        category: parsed.category || 'Other',
        signers: parsed.signers || [],
        fully_executed_date: parsed.fully_executed_date || null,
        document_type: parsed.document_type || undefined,
        primary_parties: this.validatePrimaryParties(parsed.primary_parties),
        effective_date: parsed.effective_date || undefined,
        
        // Template analysis
        template_analysis: templateAnalysis,
        
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
        
        // Critical facts
        critical_facts: parsed.critical_facts || undefined,
        
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

  async generateText(prompt: string): Promise<string> {
    try {
      const response = await this.client.chat.completions.create({
        model: 'gpt-4o',
        messages: [
          { role: 'user', content: prompt }
        ],
        temperature: 0.1,
        max_tokens: 2000,
      });

      const result = response.choices[0]?.message?.content;
      if (!result) {
        throw new Error('No response from OpenAI');
      }

      return result;
    } catch (error) {
      console.error('Error generating text:', error);
      throw error;
    }
  }
}