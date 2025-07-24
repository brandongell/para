import * as dotenv from 'dotenv';
import { GeminiPdfService } from './src/services/geminiPdfService';
import * as path from 'path';

// Load environment variables
dotenv.config();

async function testEINPdf() {
  console.log('🧪 Testing EIN PDF Extraction with Gemini');
  console.log('========================================\n');

  const geminiApiKey = process.env.GEMINI_API_KEY;
  const pdfPath = path.join(
    process.env.ORGANIZE_FOLDER_PATH || './test-files-latest',
    '03_Finance_and_Investment/Tax_and_Compliance/LEGAL 46339648v1 Every Media - EIN Confirmation Letter (1).PDF'
  );

  if (!geminiApiKey) {
    console.error('❌ GEMINI_API_KEY not found in environment variables');
    process.exit(1);
  }

  const geminiService = new GeminiPdfService(geminiApiKey);

  try {
    console.log(`📄 Extracting from: ${pdfPath}`);
    const result = await geminiService.extractPdfContent(pdfPath);
    
    console.log('\n📊 Extraction Result:');
    console.log('Raw content length:', result.content.length);
    console.log('\n📝 Extracted Content:');
    console.log(result.content);
    
    console.log('\n👥 Signers:', result.signers);
    console.log('\n📋 Metadata:', JSON.stringify(result.metadata, null, 2));
    
  } catch (error) {
    console.error('❌ Error:', error);
  }
}

// Run the test
testEINPdf().catch(console.error);