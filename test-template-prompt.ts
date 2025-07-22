import * as dotenv from 'dotenv';
import { OpenAIService } from './src/services/openai';

// Load environment variables
dotenv.config();

async function testTemplatePrompt() {
  console.log('🧪 Testing Template Identification Prompt');
  console.log('=========================================\n');
  
  const openaiApiKey = process.env.OPENAI_API_KEY;
  
  if (!openaiApiKey) {
    console.error('❌ Missing OPENAI_API_KEY in .env file');
    return;
  }
  
  // Initialize OpenAI service
  const openaiService = new OpenAIService(openaiApiKey);
  
  // Test cases with different filenames and content snippets
  const testCases = [
    {
      filename: 'Employment Agreement [BLANK].docx',
      content: 'This Employment Agreement is entered into as of [DATE] between [COMPANY NAME] and [EMPLOYEE NAME]...',
      expected: 'Should be identified as template with HIGH confidence'
    },
    {
      filename: 'SAFE Agreement (Form).pdf',
      content: 'THIS INSTRUMENT AND ANY SECURITIES ISSUABLE... Purchase Amount: $__________ Date: __________',
      expected: 'Should be identified as template with HIGH confidence'
    },
    {
      filename: 'Board Consent EXECUTED.pdf',
      content: 'RESOLVED, that Dan Shipper is hereby authorized... Dated: June 15, 2023',
      expected: 'Should NOT be identified as template'
    },
    {
      filename: 'Individual Contractor Agreement.docx',
      content: 'This Agreement is between Every Media Inc. and Victor Rodriguez dated March 1, 2024...',
      expected: 'Should NOT be identified as template (has specific names and dates)'
    }
  ];
  
  console.log('Testing template identification with various document types...\n');
  
  for (const testCase of testCases) {
    console.log(`\n📄 Testing: ${testCase.filename}`);
    console.log('─'.repeat(60));
    console.log(`Expected: ${testCase.expected}`);
    
    try {
      // Test metadata extraction
      const metadata = await openaiService.extractMetadata(testCase.content, testCase.filename);
      
      console.log(`\nResult:`);
      console.log(`  Status: ${metadata.status}`);
      
      if (metadata.template_analysis) {
        console.log(`  Template Analysis:`);
        console.log(`    - Is Template: ${metadata.template_analysis.is_template}`);
        console.log(`    - Confidence: ${metadata.template_analysis.confidence}`);
        console.log(`    - Indicators: ${metadata.template_analysis.indicators.join(', ')}`);
        
        if (metadata.template_analysis.template_type) {
          console.log(`    - Template Type: ${metadata.template_analysis.template_type}`);
        }
        
        if (metadata.template_analysis.field_placeholders && metadata.template_analysis.field_placeholders.length > 0) {
          console.log(`    - Placeholders Found: ${metadata.template_analysis.field_placeholders.join(', ')}`);
        }
      } else {
        console.log(`  Template Analysis: Not performed or not a template`);
      }
      
      // Verify status is set correctly
      const statusCorrect = (metadata.template_analysis?.is_template === true && metadata.status === 'template') ||
                           (metadata.template_analysis?.is_template === false && metadata.status !== 'template');
      
      console.log(`  ✅ Status correctly set: ${statusCorrect ? 'Yes' : 'No'}`);
      
    } catch (error) {
      console.log(`❌ Error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
  
  console.log('\n\n✅ Template prompt testing complete!');
}

// Run the test
testTemplatePrompt().catch(console.error);