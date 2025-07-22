#!/usr/bin/env ts-node

import * as dotenv from 'dotenv';
import { FileReaderService } from './src/services/fileReader';
import * as path from 'path';

// Load environment variables
dotenv.config();

async function testGeminiExtraction() {
  console.log('🔮 Testing Gemini PDF extraction on NMM.pdf...');
  
  const geminiApiKey = process.env.GEMINI_API_KEY;
  if (!geminiApiKey) {
    console.error('❌ GEMINI_API_KEY not found in environment variables');
    console.log('Please add GEMINI_API_KEY to your .env file');
    process.exit(1);
  }

  // Initialize FileReaderService with Gemini API key
  const fileReader = new FileReaderService(geminiApiKey);
  
  // Path to test PDF
  const pdfPath = path.join(__dirname, 'test-files/03_Finance_and_Investment/Investment_and_Fundraising/NMM.pdf');
  
  try {
    console.log(`📁 Analyzing: ${path.basename(pdfPath)}`);
    
    // Test Gemini extraction
    console.log('\n🔮 --- GEMINI MULTIMODAL EXTRACTION ---');
    const geminiResult = await fileReader.extractMetadataWithGemini(pdfPath);
    
    console.log('\n📊 GEMINI RESULTS:');
    console.log('Status:', geminiResult.status);
    console.log('Document Type:', geminiResult.document_type);
    console.log('Signers Found:', geminiResult.signers.length);
    
    geminiResult.signers.forEach((signer, i) => {
      console.log(`  ${i + 1}. ${signer.name} (${signer.date_signed || 'no date'})`);
    });
    
    if (geminiResult.primary_parties) {
      console.log('\nPrimary Parties:', geminiResult.primary_parties.length);
      geminiResult.primary_parties.forEach((party, i) => {
        console.log(`  ${i + 1}. ${party.name} - ${party.organization} (${party.role})`);
        if (party.address) console.log(`     Address: ${party.address}`);
      });
    }
    
    // Check if both signers were detected
    const expectedSigners = ['Dan Shipper', 'Nashilu Mouen'];
    const foundSigners = geminiResult.signers.map(s => s.name);
    
    console.log('\n🎯 SIGNATURE DETECTION TEST:');
    expectedSigners.forEach(expected => {
      const found = foundSigners.some(found => found.toLowerCase().includes(expected.toLowerCase()));
      console.log(`  ${expected}: ${found ? '✅ FOUND' : '❌ MISSING'}`);
    });
    
    // Save results for comparison
    const outputPath = path.join(__dirname, 'gemini-test-results.json');
    await import('fs').then(fs => 
      fs.writeFileSync(outputPath, JSON.stringify(geminiResult, null, 2))
    );
    console.log(`\n💾 Results saved to: ${outputPath}`);
    
    return geminiResult;
    
  } catch (error) {
    console.error('❌ Test failed:', error);
    process.exit(1);
  }
}

// Run the test
if (require.main === module) {
  testGeminiExtraction()
    .then(() => {
      console.log('\n✅ Test completed successfully');
    })
    .catch(error => {
      console.error('Test failed:', error);
      process.exit(1);
    });
}

export { testGeminiExtraction };