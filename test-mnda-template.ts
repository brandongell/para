import * as dotenv from 'dotenv';
import * as path from 'path';
import * as fs from 'fs';
import { TemplatePromptService } from './src/services/templatePromptService';
import { MetadataService } from './src/services/metadataService';
import { DocumentMetadata } from './src/types';

// Load environment variables
dotenv.config();

async function testMNDATemplate() {
  console.log('🧪 Testing Documenso Template Upload with MNDA Form\n');

  // File path
  const templatePath = '/Users/brandongell/Library/CloudStorage/GoogleDrive-brgell@gmail.com/My Drive/Manual Library/Work/legal_claude_test/para2/legal-document-organizer/test-files/09_Templates/By_Category/1753220128130_MNDA_Form.pdf';
  const metadataPath = `${templatePath}.metadata.json`;

  // Check if file exists
  if (!fs.existsSync(templatePath)) {
    console.error('❌ Template file not found:', templatePath);
    process.exit(1);
  }

  console.log('📄 Template file found:', path.basename(templatePath));

  // Check Documenso configuration
  const documensoConfig = {
    apiUrl: process.env.DOCUMENSO_API_URL || '',
    apiToken: process.env.DOCUMENSO_API_TOKEN || '',
    appUrl: process.env.DOCUMENSO_APP_URL
  };

  if (!documensoConfig.apiUrl || !documensoConfig.apiToken) {
    console.log('\n❌ Documenso not configured!');
    console.log('\n📝 To enable Documenso integration, add these to your .env file:');
    console.log('   DOCUMENSO_API_URL=https://api.documenso.com');
    console.log('   DOCUMENSO_API_TOKEN=your_api_token_here');
    console.log('   DOCUMENSO_APP_URL=https://app.documenso.com');
    console.log('\n💡 Get your API token from: https://app.documenso.com/settings → API');
    process.exit(1);
  }

  console.log('✅ Documenso configuration found');

  // Read or create metadata
  let metadata: DocumentMetadata;
  
  if (fs.existsSync(metadataPath)) {
    console.log('📋 Reading existing metadata...');
    const metadataContent = fs.readFileSync(metadataPath, 'utf-8');
    metadata = JSON.parse(metadataContent);
  } else {
    console.log('📋 No metadata found. Creating mock metadata for template...');
    // Create mock metadata for the template
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

  // Create template prompt service
  const templatePromptService = new TemplatePromptService(documensoConfig);

  console.log('\n🚀 Ready to upload template to Documenso');
  console.log('   This will prompt you to confirm the upload.\n');

  try {
    const result = await templatePromptService.promptForTemplateUpload(templatePath, metadata);
    
    if (result) {
      console.log('\n🎉 Success! Template uploaded to Documenso');
      
      // Update metadata file if it exists
      if (fs.existsSync(metadataPath)) {
        metadata.documenso = {
          document_id: result.documentId,
          status: 'uploaded',
          template_link: result.templateCreationUrl,
          uploaded_at: new Date().toISOString()
        };
        
        fs.writeFileSync(metadataPath, JSON.stringify(metadata, null, 2));
        console.log('📋 Metadata file updated with Documenso information');
      }
    } else {
      console.log('\n✅ Upload cancelled or failed');
    }
  } catch (error) {
    console.error('\n❌ Error:', error);
  } finally {
    templatePromptService.close();
  }

  console.log('\n✅ Test completed');
}

// Run the test
testMNDATemplate().catch(console.error);