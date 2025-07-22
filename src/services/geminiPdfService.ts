import { GoogleGenerativeAI } from '@google/generative-ai';
import * as fs from 'fs';
import { DocumentMetadata } from '../types';

export class GeminiPdfService {
  private genAI: GoogleGenerativeAI;
  private model: any;

  constructor(apiKey: string) {
    this.genAI = new GoogleGenerativeAI(apiKey);
    this.model = this.genAI.getGenerativeModel({ model: 'gemini-1.5-pro' });
  }

  async extractMetadataFromPdf(pdfPath: string): Promise<DocumentMetadata> {
    try {
      console.log('🔮 Using Gemini multimodal analysis for PDF extraction...');
      
      // Read PDF as buffer
      const pdfBuffer = fs.readFileSync(pdfPath);
      
      // Convert to base64 for Gemini
      const base64Pdf = pdfBuffer.toString('base64');
      
      // Create multimodal prompt for comprehensive analysis
      const prompt = this.buildGeminiPrompt();
      
      // Send to Gemini with PDF data
      const result = await this.model.generateContent([
        {
          inlineData: {
            data: base64Pdf,
            mimeType: 'application/pdf'
          }
        },
        prompt
      ]);
      
      const response = await result.response;
      const text = response.text();
      
      console.log('✅ Gemini analysis complete');
      console.log('📄 Gemini raw response length:', text.length);
      
      // Parse the JSON response
      return this.parseGeminiResponse(text, pdfPath);
      
    } catch (error) {
      console.error('❌ Gemini PDF extraction failed:', error);
      throw new Error(`Gemini extraction failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  private buildGeminiPrompt(): string {
    return `You are an expert legal document analysis AI. Analyze this PDF document comprehensively and extract all metadata in JSON format.

CRITICAL: You can see the ENTIRE document including visual elements, signatures, stamps, annotations, and filled form fields that other text-extraction methods miss.

EXTRACT THE FOLLOWING METADATA:

1. **STATUS** (required):
   - "executed" - All required parties have signed (look for actual signatures, filled fields)
   - "partially_executed" - Some but not all parties have signed
   - "not_executed" - Document created but not signed
   - "template" - Reusable template document

2. **DOCUMENT_TYPE**: Specific type (e.g., "SAFE Agreement", "Employment Agreement")

3. **SIGNERS** (required array): Extract ALL visible signers
   - Look for signature blocks, filled name fields, electronic signatures
   - Include: {"name": "Full Name", "date_signed": "YYYY-MM-DD or null"}
   - Check BOTH company and investor/individual signature sections

4. **PRIMARY_PARTIES**: Main parties with complete information
   - Extract from signature blocks, headers, filled form fields
   - Include: name, organization, title, address, email, role
   - Look for visually filled information even if template shows blanks

5. **DATES**:
   - effective_date: When agreement becomes effective
   - fully_executed_date: When all parties signed

6. **FINANCIAL INFO**:
   - contract_value: Investment amount, salary, contract value
   - expiration_date: When agreement expires

7. **LEGAL DETAILS**:
   - governing_law: Legal jurisdiction
   - counterparty_role: Relationship to company (employee, investor, etc.)

8. **ADMINISTRATIVE**:
   - category: Choose from Investment_Fundraising, Employment_Agreements, Equity_Compensation, etc.
   - amendment_number: Version control
   - tags: Relevant tags array

SIGNATURE DETECTION INSTRUCTIONS:
- Look for filled signature sections, even if main document text shows blanks
- Check for electronic signatures, stamps, or typed names in signature areas
- Identify ALL parties that have signed, not just the first one
- For investment documents: Look for both Company and Investor signatures
- Extract actual names from filled signature blocks

RETURN ONLY VALID JSON in this exact format:
{
  "filename": "filename.pdf",
  "status": "executed",
  "category": "Investment_Fundraising",
  "document_type": "SAFE Agreement",
  "signers": [
    {"name": "Dan Shipper", "date_signed": "2023-06-15"},
    {"name": "Nashilu Mouen", "date_signed": "2023-06-15"}
  ],
  "primary_parties": [
    {
      "name": "Dan Shipper",
      "organization": "Every Media Inc.",
      "title": "Chief Executive Officer",
      "address": "221 Canal Street, Floor 5 New York, NY 10013",
      "email": "dshipper@gmail.com",
      "role": "Company"
    },
    {
      "name": "Nashilu Mouen",
      "organization": "Individual",
      "address": "123 Main St, City, State 12345",
      "email": "nashilu@example.com",
      "role": "Investor"
    }
  ],
  "effective_date": "2023-06-15",
  "fully_executed_date": "2023-06-15",
  "contract_value": "$50000",
  "governing_law": "Delaware",
  "counterparty_role": "investor",
  "amendment_number": "original",
  "tags": ["SAFE", "investment", "equity"]
}

CRITICAL: Extract information from the ACTUAL filled document, including visual signatures and filled form fields. Do not just parse template text.`;
  }

  private parseGeminiResponse(response: string, pdfPath: string): DocumentMetadata {
    try {
      // Extract JSON from response
      const jsonMatch = response.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error('No JSON found in Gemini response');
      }

      const parsed = JSON.parse(jsonMatch[0]);
      
      // Ensure required fields with defaults
      const metadata: DocumentMetadata = {
        filename: parsed.filename || require('path').basename(pdfPath),
        status: parsed.status || 'not_executed',
        category: parsed.category || 'Other',
        signers: parsed.signers || [],
        fully_executed_date: parsed.fully_executed_date || null,
        document_type: parsed.document_type || undefined,
        primary_parties: parsed.primary_parties || undefined,
        effective_date: parsed.effective_date || undefined,
        contract_value: parsed.contract_value || undefined,
        expiration_date: parsed.expiration_date || undefined,
        governing_law: parsed.governing_law || undefined,
        counterparty_role: parsed.counterparty_role || undefined,
        amendment_number: parsed.amendment_number || undefined,
        notice_period: parsed.notice_period || undefined,
        renewal_terms: parsed.renewal_terms || undefined,
        confidentiality_level: parsed.confidentiality_level || undefined,
        approval_required: parsed.approval_required || undefined,
        tags: parsed.tags || undefined,
        notes: parsed.notes || 'Extracted using Gemini multimodal analysis'
      };

      console.log(`🔮 Gemini extracted ${metadata.signers.length} signers`);
      metadata.signers.forEach((signer, i) => {
        console.log(`  ${i + 1}. ${signer.name} (${signer.date_signed || 'no date'})`);
      });

      return metadata;
      
    } catch (error) {
      console.error('Failed to parse Gemini response:', error);
      console.log('Raw response:', response);
      
      // Fallback metadata
      return {
        filename: require('path').basename(pdfPath),
        status: 'not_executed',
        category: 'Other',
        signers: [],
        fully_executed_date: null,
        notes: 'Failed to parse Gemini response - using fallback metadata'
      };
    }
  }
}