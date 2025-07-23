import * as dotenv from 'dotenv';
import * as path from 'path';
import * as fs from 'fs';
import * as readline from 'readline';
import { DocumentMetadata } from './src/types';

// Load environment variables
dotenv.config();

// Mock Documenso response
interface MockDocumensoResponse {
  documentId: number;
  templateCreationUrl: string;
}

async function mockDocumensoUpload(filePath: string): Promise<MockDocumensoResponse> {
  console.log('📤 [MOCK] Simulating upload to Documenso...');
  
  // Simulate network delay
  await new Promise(resolve => setTimeout(resolve, 1500));
  
  // Generate mock response
  const mockId = Math.floor(Math.random() * 90000) + 10000;
  return {
    documentId: mockId,
    templateCreationUrl: `https://app.documenso.com/documents/${mockId}/convert-to-template`
  };
}

async function testMNDATemplateMock() {
  console.log('🧪 Testing Documenso Template Upload with MNDA Form (MOCK MODE)\n');

  // File path
  const templatePath = '/Users/brandongell/Library/CloudStorage/GoogleDrive-brgell@gmail.com/My Drive/Manual Library/Work/legal_claude_test/para2/legal-document-organizer/test-files/09_Templates/By_Category/1753220128130_MNDA_Form.pdf';
  const metadataPath = `${templatePath}.metadata.json`;

  // Check if file exists
  if (!fs.existsSync(templatePath)) {
    console.error('❌ Template file not found:', templatePath);
    process.exit(1);
  }

  console.log('📄 Template file found:', path.basename(templatePath));

  // Read or create metadata
  let metadata: DocumentMetadata;
  
  if (fs.existsSync(metadataPath)) {
    console.log('📋 Reading existing metadata...');
    const metadataContent = fs.readFileSync(metadataPath, 'utf-8');
    metadata = JSON.parse(metadataContent);
  } else {
    console.log('📋 No metadata found. Creating mock metadata for template...');
    metadata = {
      filename: path.basename(templatePath),
      status: 'template',
      category: 'Risk_and_Compliance',
      document_type: 'Mutual Non-Disclosure Agreement',
      primary_parties: [],
      signers: [],
      fully_executed_date: null,
      template_analysis: {
        is_template: true,
        confidence: 'HIGH',
        indicators: ['Form in filename', 'No specific party names'],
        template_type: 'Mutual NDA',
        field_placeholders: ['Party A Name', 'Party B Name', 'Effective Date', 'Signature Fields'],
        typical_use_case: 'Standard mutual NDA for business discussions and negotiations'
      }
    };
  }

  console.log('\n📊 Document Metadata:');
  console.log(`   Status: ${metadata.status}`);
  console.log(`   Type: ${metadata.document_type}`);
  console.log(`   Category: ${metadata.category}`);
  if (metadata.template_analysis) {
    console.log(`   Template Confidence: ${metadata.template_analysis.confidence}`);
  }

  // Check if already uploaded to Documenso
  if (metadata.documenso) {
    console.log('\n⚠️  This template is already in Documenso:');
    console.log(`   Document ID: ${metadata.documenso.document_id}`);
    console.log(`   Status: ${metadata.documenso.status}`);
    if (metadata.documenso.template_link) {
      console.log(`   Template URL: ${metadata.documenso.template_link}`);
    }
    console.log('\n');
  }

  // Show what would happen with real integration
  console.log('\n🎯 Template Document Detected!');
  console.log(`📄 File: ${path.basename(templatePath)}`);
  console.log(`📋 Type: ${metadata.document_type || 'Unknown'}`);
  console.log(`🏷️  Category: ${metadata.category || 'Not categorized'}`);
  console.log(`🔍 Confidence: ${metadata.template_analysis?.confidence || 'N/A'}`);
  if (metadata.template_analysis?.template_type) {
    console.log(`📝 Template Type: ${metadata.template_analysis.template_type}`);
  }

  // Create readline interface for user prompt
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });

  const question = '\n🤔 Would you like to upload this template to Documenso for configuration? (yes/no): ';
  
  rl.question(question, async (answer) => {
    const normalizedAnswer = answer.toLowerCase().trim();
    
    if (normalizedAnswer === 'yes' || normalizedAnswer === 'y') {
      try {
        // Mock the upload
        const result = await mockDocumensoUpload(templatePath);
        
        console.log('\n✅ [MOCK] Template uploaded successfully!');
        console.log('🔗 Configure your template here:');
        console.log(`   ${result.templateCreationUrl}`);
        console.log('\n📌 Document ID:', result.documentId);
        console.log('💡 Tip: Add signature fields, text fields, and other elements in the Documenso interface.');
        
        // Update metadata
        metadata.documenso = {
          document_id: result.documentId,
          status: 'uploaded',
          template_link: result.templateCreationUrl,
          uploaded_at: new Date().toISOString()
        };
        
        // Save updated metadata
        fs.writeFileSync(metadataPath, JSON.stringify(metadata, null, 2));
        console.log('\n📋 Metadata file updated with Documenso information');
        
        console.log('\n📝 What happens next in real integration:');
        console.log('   1. The PDF is uploaded to Documenso via API');
        console.log('   2. You click the link to open Documenso\'s template editor');
        console.log('   3. You add signature fields, text fields, dates, etc.');
        console.log('   4. You save the template in Documenso');
        console.log('   5. You can then use the template to create documents for signing');
        
      } catch (error) {
        console.error('\n❌ [MOCK] Error during template upload:', error);
      }
    } else {
      console.log('✅ Skipping Documenso upload. Template will be organized locally.');
    }
    
    rl.close();
    console.log('\n✅ Test completed');
  });
}

// Run the test
testMNDATemplateMock().catch(console.error);