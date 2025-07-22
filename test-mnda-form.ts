import * as dotenv from 'dotenv';
import { MetadataService } from './src/services/metadataService';
import { DocumentClassifierService } from './src/services/documentClassifier';
import * as path from 'path';
import * as fs from 'fs';

// Load environment variables
dotenv.config();

async function testMNDAForm() {
  console.log('🧪 Testing MNDA Form.pdf Template Identification');
  console.log('================================================\n');
  
  const openaiApiKey = process.env.OPENAI_API_KEY;
  const geminiApiKey = process.env.GEMINI_API_KEY;
  
  if (!openaiApiKey) {
    console.error('❌ Missing OPENAI_API_KEY in .env file');
    return;
  }
  
  // Initialize services
  const metadataService = new MetadataService(openaiApiKey, geminiApiKey);
  const classifierService = new DocumentClassifierService(openaiApiKey, geminiApiKey);
  
  // Path to MNDA Form.pdf
  const filePath = path.join(__dirname, 'test-files', 'MNDA Form.pdf');
  const metadataPath = filePath + '.metadata.json';
  
  console.log(`📄 File: ${path.basename(filePath)}`);
  console.log(`📁 Location: ${path.dirname(filePath)}`);
  
  // Check if file exists
  if (!fs.existsSync(filePath)) {
    console.error('❌ File not found:', filePath);
    return;
  }
  
  // Delete existing metadata if present
  if (fs.existsSync(metadataPath)) {
    console.log('\n🗑️  Deleting existing metadata file...');
    fs.unlinkSync(metadataPath);
  }
  
  try {
    // Test metadata extraction with template identification
    console.log('\n🔍 Extracting metadata with template identification...');
    const metadataResult = await metadataService.generateMetadataFile(filePath);
    
    if (metadataResult.success && metadataResult.metadata) {
      const metadata = metadataResult.metadata;
      
      console.log('\n📊 Metadata Extraction Results:');
      console.log('─'.repeat(50));
      
      console.log(`\nStatus: ${metadata.status}`);
      console.log(`Category: ${metadata.category}`);
      console.log(`Document Type: ${metadata.document_type || 'Not specified'}`);
      
      console.log(`\n🔍 Template Analysis:`);
      if (metadata.template_analysis) {
        console.log(`   Is Template: ${metadata.template_analysis.is_template}`);
        console.log(`   Confidence: ${metadata.template_analysis.confidence}`);
        console.log(`   Indicators: ${metadata.template_analysis.indicators.join(', ') || 'None'}`);
        
        if (metadata.template_analysis.template_type) {
          console.log(`   Template Type: ${metadata.template_analysis.template_type}`);
        }
        
        if (metadata.template_analysis.field_placeholders && metadata.template_analysis.field_placeholders.length > 0) {
          console.log(`   Placeholders: ${metadata.template_analysis.field_placeholders.join(', ')}`);
        }
        
        if (metadata.template_analysis.typical_use_case) {
          console.log(`   Use Case: ${metadata.template_analysis.typical_use_case}`);
        }
      } else {
        console.log('   ⚠️  No template analysis found in metadata!');
      }
      
      // Test classification
      console.log(`\n🗂️  Testing document classification...`);
      const classification = await classifierService.classifyFile(filePath);
      console.log(`   Primary Folder: ${classification.primaryFolder}`);
      console.log(`   Subfolder: ${classification.subfolder}`);
      console.log(`   Confidence: ${classification.confidence}`);
      console.log(`   Reasoning: ${classification.reasoning}`);
      
      // Check if it should have been classified as a template
      const shouldBeTemplate = classification.primaryFolder === '09_Templates';
      console.log(`\n✅ Classified to Templates folder: ${shouldBeTemplate ? 'Yes' : 'No'}`);
      
      // Save the full metadata for inspection
      console.log('\n📝 Full metadata saved to:', metadataPath);
      console.log('\nFull metadata object:');
      console.log(JSON.stringify(metadata, null, 2));
      
    } else {
      console.log(`\n❌ Failed to extract metadata: ${metadataResult.error}`);
    }
    
  } catch (error) {
    console.log(`\n❌ Error processing file: ${error instanceof Error ? error.message : 'Unknown error'}`);
    console.error(error);
  }
  
  console.log('\n✅ Test complete!');
  console.log('\nExpected behavior:');
  console.log('- "Form" in filename should trigger template identification');
  console.log('- Status should be "template"');
  console.log('- Should classify to 09_Templates folder');
}

// Run the test
testMNDAForm().catch(console.error);