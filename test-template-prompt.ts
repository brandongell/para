import * as dotenv from 'dotenv';
import { TemplatePromptService } from './src/services/templatePromptService';
import { DocumentMetadata } from './src/types';

// Load environment variables
dotenv.config();

async function testTemplatePrompt() {
  console.log('🧪 Testing Template Prompt Service\n');

  // Check if Documenso is configured
  const documensoConfig = {
    apiUrl: process.env.DOCUMENSO_API_URL || '',
    apiToken: process.env.DOCUMENSO_API_TOKEN || '',
    appUrl: process.env.DOCUMENSO_APP_URL
  };

  if (\!documensoConfig.apiUrl || \!documensoConfig.apiToken) {
    console.log('❌ Documenso not configured. Please set DOCUMENSO_API_URL and DOCUMENSO_API_TOKEN in .env file');
    console.log('\nTo test without Documenso, the prompt will be skipped.');
  }

  // Create service
  const templatePromptService = new TemplatePromptService(
    documensoConfig.apiUrl && documensoConfig.apiToken ? documensoConfig : undefined
  );

  // Mock metadata for a template document
  const mockMetadata: DocumentMetadata = {
    status: 'template',
    category: 'People_and_Employment',
    document_type: 'Employment Agreement',
    primary_parties: [],
    signers: [],
    fully_executed_date: null,
    template_analysis: {
      is_template: true,
      confidence: 'HIGH',
      indicators: ['[FORM] in filename', 'No specific party names'],
      template_type: 'Employment Agreement',
      field_placeholders: ['Employee Name', 'Start Date', 'Salary', 'Title'],
      typical_use_case: 'Standard employment agreement for new hires'
    }
  };

  // Mock file path
  const mockFilePath = '/path/to/Employment Agreement [FORM].pdf';

  console.log('📋 Mock Template Document:');
  console.log(`   File: ${mockFilePath}`);
  console.log(`   Type: ${mockMetadata.document_type}`);
  console.log(`   Category: ${mockMetadata.category}`);
  console.log(`   Template Confidence: ${mockMetadata.template_analysis?.confidence}`);
  console.log('\n');

  if (templatePromptService.isEnabled()) {
    console.log('✅ Documenso integration is enabled');
    console.log('⚠️  Note: This will prompt for user input and attempt to upload to Documenso if confirmed.\n');
    
    try {
      const result = await templatePromptService.promptForTemplateUpload(mockFilePath, mockMetadata);
      
      if (result) {
        console.log('\n✅ Template upload completed successfully\!');
        console.log('📋 Result:', JSON.stringify(result, null, 2));
      } else {
        console.log('\n✅ User declined upload or upload failed.');
      }
    } catch (error) {
      console.error('\n❌ Error during template prompt:', error);
    }
  } else {
    console.log('⚠️  Documenso integration is disabled. Template prompt will be skipped.');
  }

  // Clean up
  templatePromptService.close();
  console.log('\n✅ Test completed');
}

// Run the test
testTemplatePrompt().catch(console.error);
EOF < /dev/null