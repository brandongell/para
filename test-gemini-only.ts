import * as dotenv from 'dotenv';
import * as path from 'path';
import { GeminiPdfService } from './src/services/geminiPdfService';
import * as fs from 'fs';

// Load environment variables
dotenv.config();

async function testGeminiOnly() {
  console.log('🧪 Testing Gemini PDF Extraction Only\n');

  const geminiKey = process.env.GEMINI_API_KEY;
  if (!geminiKey) {
    console.error('❌ Missing GEMINI_API_KEY environment variable');
    return;
  }

  const geminiService = new GeminiPdfService(geminiKey);
  const pdfPath = path.join(__dirname, 'test-files-latest/03_Finance_and_Investment/Tax_and_Compliance/LEGAL 46339648v1 Every Media - EIN Confirmation Letter (1).PDF');
  
  console.log(`📄 Testing with: ${path.basename(pdfPath)}\n`);
  
  try {
    const metadata = await geminiService.extractMetadataFromPdf(pdfPath);
    
    console.log('\n✅ Metadata extracted successfully:');
    console.log(JSON.stringify(metadata, null, 2));
    
    if (metadata.critical_facts) {
      console.log('\n🎯 Critical Facts:');
      console.log(JSON.stringify(metadata.critical_facts, null, 2));
      
      if (metadata.critical_facts.ein_number) {
        console.log(`\n✅ SUCCESS! EIN Found: ${metadata.critical_facts.ein_number}`);
      }
    }
    
    // Don't save to file, just show the results
    
  } catch (error) {
    console.error('❌ Error:', error);
  }
}

testGeminiOnly().catch(console.error);