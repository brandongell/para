import * as dotenv from 'dotenv';
import { MetadataService } from './src/services/metadataService';
import { DocumentClassifierService } from './src/services/documentClassifier';
import * as path from 'path';

// Load environment variables
dotenv.config();

async function testTemplateIdentification() {
  console.log('🧪 Testing Template Identification System');
  console.log('=========================================\n');
  
  const openaiApiKey = process.env.OPENAI_API_KEY;
  const geminiApiKey = process.env.GEMINI_API_KEY;
  
  if (!openaiApiKey) {
    console.error('❌ Missing OPENAI_API_KEY in .env file');
    return;
  }
  
  // Initialize services
  const metadataService = new MetadataService(openaiApiKey, geminiApiKey);
  const classifierService = new DocumentClassifierService(openaiApiKey, geminiApiKey);
  
  // Test files - some should be templates, some should not
  const testFiles = [
    'Individual Contractor Agreement [BLANK].docx.pdf',
    'Every Media - Incentive Stock Option Grant Agreement (Form).docx',
    'Every Media - Board Consent (Equity Compensation) EXECUTED.pdf',
    'Every Nathan PIIA.pdf'
  ];
  
  console.log('Testing template identification on sample files...\n');
  
  for (const filename of testFiles) {
    console.log(`\n📄 Testing: ${filename}`);
    console.log('─'.repeat(50));
    
    // Find the file in test-files
    const filePath = path.join(__dirname, 'test-files', filename);
    
    try {
      // Test metadata extraction with template identification
      console.log('🔍 Extracting metadata...');
      const metadataResult = await metadataService.generateMetadataFile(filePath);
      
      if (metadataResult.success && metadataResult.metadata) {
        const metadata = metadataResult.metadata;
        
        console.log(`\n✅ Template Analysis:`);
        if (metadata.template_analysis) {
          console.log(`   Is Template: ${metadata.template_analysis.is_template}`);
          console.log(`   Confidence: ${metadata.template_analysis.confidence}`);
          console.log(`   Indicators: ${metadata.template_analysis.indicators.join(', ')}`);
          if (metadata.template_analysis.template_type) {
            console.log(`   Template Type: ${metadata.template_analysis.template_type}`);
          }
          if (metadata.template_analysis.field_placeholders) {
            console.log(`   Placeholders: ${metadata.template_analysis.field_placeholders.join(', ')}`);
          }
        } else {
          console.log('   No template analysis performed');
        }
        
        console.log(`\n📊 Document Status: ${metadata.status}`);
        console.log(`📁 Category: ${metadata.category}`);
        
        // Test classification
        console.log(`\n🗂️  Testing classification...`);
        const classification = await classifierService.classifyFile(filePath);
        console.log(`   Primary Folder: ${classification.primaryFolder}`);
        console.log(`   Subfolder: ${classification.subfolder}`);
        console.log(`   Confidence: ${classification.confidence}`);
        
      } else {
        console.log(`❌ Failed to extract metadata: ${metadataResult.error}`);
      }
      
    } catch (error) {
      console.log(`❌ Error processing file: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
  
  console.log('\n\n✅ Template identification testing complete!');
  console.log('\nExpected results:');
  console.log('- Files with [BLANK] or (Form) should be identified as templates with HIGH confidence');
  console.log('- EXECUTED files should NOT be identified as templates');
  console.log('- Templates should be classified to 09_Templates folder');
}

// Run the test
testTemplateIdentification().catch(console.error);