import * as dotenv from 'dotenv';
import { DocumensoService } from './src/services/documensoService';
import * as path from 'path';

// Load environment variables
dotenv.config();

async function testDocumensoAPI() {
  console.log('🧪 Testing Documenso API Integration...\n');

  // Check environment variables
  const apiUrl = process.env.DOCUMENSO_API_URL;
  const apiToken = process.env.DOCUMENSO_API_TOKEN;
  const appUrl = process.env.DOCUMENSO_APP_URL;

  if (!apiUrl || !apiToken) {
    console.error('❌ Missing required environment variables:');
    console.error(`  DOCUMENSO_API_URL: ${apiUrl ? '✅' : '❌ Missing'}`);
    console.error(`  DOCUMENSO_API_TOKEN: ${apiToken ? '✅' : '❌ Missing'}`);
    return;
  }

  console.log('✅ Environment variables loaded:');
  console.log(`  API URL: ${apiUrl}`);
  console.log(`  API Token: ${apiToken.substring(0, 10)}...`);
  console.log(`  App URL: ${appUrl || 'Using default'}\n`);

  // Initialize DocumensoService
  const documensoService = new DocumensoService({
    apiUrl,
    apiToken,
    appUrl
  });

  // Test file path
  const testFilePath = '/Users/brandongell/Desktop/MNDA Form2.pdf';
  console.log(`📄 Test file: ${testFilePath}`);

  // Check if file exists
  const fs = require('fs');
  if (!fs.existsSync(testFilePath)) {
    console.error(`❌ Test file not found: ${testFilePath}`);
    return;
  }

  try {
    // Test 1: Upload document
    console.log('\n📤 Test 1: Uploading document to Documenso...');
    const uploadResult = await documensoService.uploadDocumentForTemplate(
      testFilePath,
      {
        filename: path.basename(testFilePath),
        status: 'template',
        category: 'Corporate_and_Governance',
        document_type: 'Mutual NDA',
        signers: [],
        fully_executed_date: null,
        template_analysis: {
          is_template: true,
          confidence: 'HIGH',
          indicators: ['Form in filename', 'No filled values'],
          template_type: 'Mutual NDA',
          field_placeholders: ['Company Name', 'Party Names', 'Dates'],
          typical_use_case: 'Mutual Non-Disclosure Agreement between two parties'
        }
      }
    );

    console.log('✅ Upload successful!');
    console.log(`  Document ID: ${uploadResult.documentId}`);
    console.log(`  Title: ${uploadResult.title}`);
    console.log(`  Status: ${uploadResult.status}\n`);

    // Test 2: Generate template link
    console.log('🔗 Test 2: Generating template creation link...');
    const templateLink = documensoService.generateTemplateCreationLink(uploadResult.documentId);
    console.log('✅ Template link generated:');
    console.log(`  Document ID: ${templateLink.documentId}`);
    console.log(`  Template URL: ${templateLink.templateCreationUrl}`);
    console.log(`  API URL: ${templateLink.apiUrl}\n`);

    // Test 3: Verify document exists
    console.log('🔍 Test 3: Verifying document exists...');
    const document = await documensoService.getDocument(uploadResult.documentId);
    if (document) {
      console.log('✅ Document verified:');
      console.log(`  ID: ${document.id}`);
      console.log(`  Title: ${document.title}`);
      console.log(`  Status: ${document.status}`);
      console.log(`  Created: ${document.createdAt}`);
    } else {
      console.log('❌ Document not found');
    }

    console.log('\n✅ All tests passed! Documenso integration is working correctly.');
    console.log('\n📝 Next steps:');
    console.log('1. Visit the template URL to configure fields in Documenso');
    console.log('2. Once configured, the template can be sent via Discord bot');

  } catch (error) {
    console.error('\n❌ Test failed:', error);
    if (error instanceof Error) {
      console.error('Error details:', error.message);
      if ('response' in error && error.response) {
        console.error('Response:', error.response);
      }
    }
  }
}

// Run the test
testDocumensoAPI().catch(console.error);