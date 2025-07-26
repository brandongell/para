import * as dotenv from 'dotenv';
import { TemplateWorkflowService } from './src/services/templateWorkflowService';
import { TemplateRegistryService } from './src/services/templateRegistryService';
import { DocumensoService } from './src/services/documensoService';
import { ConversationManager } from './src/services/conversationManager';
import { BotIntent } from './src/types';

// Load environment variables
dotenv.config();

async function testTemplateSendWorkflow() {
  console.log('🧪 Testing Template Send Workflow...\n');

  // Initialize services
  const organizeFolderPath = process.env.ORGANIZE_FOLDER_PATH || './test-files-latest';
  const documensoConfig = {
    apiUrl: process.env.DOCUMENSO_API_URL!,
    apiToken: process.env.DOCUMENSO_API_TOKEN!,
    appUrl: process.env.DOCUMENSO_APP_URL
  };

  const templateRegistry = new TemplateRegistryService(organizeFolderPath);
  const documensoService = new DocumensoService(documensoConfig);
  const conversationManager = new ConversationManager();
  const templateWorkflow = new TemplateWorkflowService(
    templateRegistry,
    documensoService,
    conversationManager
  );

  // Refresh template registry
  console.log('🔄 Refreshing template registry...');
  await templateRegistry.refreshRegistry();
  const templates = await templateRegistry.getAllTemplates();
  console.log(`✅ Found ${templates.length} templates\n`);

  // List available templates
  console.log('📋 Available templates:');
  templates.forEach((template, index) => {
    console.log(`${index + 1}. ${template.metadata.document_type || template.metadata.filename}`);
    console.log(`   - File: ${template.metadata.filename}`);
    console.log(`   - Documenso ID: ${template.documensoTemplateId || 'Not uploaded'}`);
    console.log(`   - Template Type: ${template.metadata.template_analysis?.template_type || 'Unknown'}`);
  });

  // Test workflow start
  console.log('\n🚀 Test 1: Starting template send workflow...');
  const testUserId = 'test-user-123';
  const intent: BotIntent = {
    type: 'SEND_TEMPLATE',
    confidence: 0.9,
    parameters: {
      template_name: 'MNDA',
      recipient_email: 'test@example.com',
      recipient_name: 'Test User'
    }
  };

  try {
    const response = await templateWorkflow.startWorkflow(testUserId, intent);
    console.log('\n📄 Workflow Response:');
    console.log(`Message: ${response.message}`);
    console.log(`Completed: ${response.completed}`);
    if (response.embed) {
      console.log(`Embed: ${JSON.stringify(response.embed, null, 2)}`);
    }

    // Check if workflow is active
    const hasWorkflow = templateWorkflow.hasActiveWorkflow(testUserId);
    console.log(`\nActive workflow: ${hasWorkflow}`);

    // If not completed and template needs upload
    if (!response.completed && response.message.includes("hasn't been uploaded")) {
      console.log('\n⚠️ Template needs to be uploaded to Documenso first');
      console.log('Please upload the template through Discord with: "upload this template to Documenso"');
    }

    // If workflow is active, test continuing it
    if (hasWorkflow && !response.completed) {
      console.log('\n🚀 Test 2: Continuing workflow with field value...');
      const continueResponse = await templateWorkflow.continueWorkflow(
        testUserId,
        'Test Company Inc.'
      );
      console.log(`Continue Response: ${continueResponse.message}`);
    }

  } catch (error) {
    console.error('❌ Workflow test failed:', error);
  }

  // Test direct Documenso template operations
  console.log('\n🚀 Test 3: Testing Documenso template operations...');
  
  // Find a template with Documenso ID
  const templatesWithDocumenso = templates.filter(t => t.documensoTemplateId);
  if (templatesWithDocumenso.length > 0) {
    const template = templatesWithDocumenso[0];
    console.log(`\n📄 Testing with template: ${template.metadata.document_type}`);
    console.log(`Documenso ID: ${template.documensoTemplateId}`);

    try {
      // Get template fields
      const fields = await documensoService.getTemplateFields(template.documensoTemplateId!);
      console.log(`\nTemplate fields: ${fields.length}`);
      fields.forEach(field => {
        console.log(`  - ${field.name} (${field.type}): ${field.required ? 'Required' : 'Optional'}`);
      });
    } catch (error) {
      console.error('Failed to get template fields:', error);
    }
  } else {
    console.log('⚠️ No templates with Documenso IDs found. Upload templates first.');
  }

  console.log('\n✅ Template send workflow test complete!');
}

// Run the test
testTemplateSendWorkflow().catch(console.error);