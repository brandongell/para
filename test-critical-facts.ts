import * as dotenv from 'dotenv';
import * as path from 'path';
import { MetadataService } from './src/services/metadataService';
import { MemoryService } from './src/services/memoryService';
import * as fs from 'fs';

// Load environment variables
dotenv.config();

async function testCriticalFactsExtraction() {
  console.log('🧪 Testing Critical Facts Extraction\n');

  // Check for API keys
  const openaiKey = process.env.OPENAI_API_KEY;
  const geminiKey = process.env.GEMINI_API_KEY;

  if (!openaiKey) {
    console.error('❌ Missing OPENAI_API_KEY environment variable');
    return;
  }

  console.log('✅ API keys loaded');

  // Initialize services
  const metadataService = new MetadataService(openaiKey, geminiKey);
  
  // Test with EIN document
  const einDocPath = path.join(__dirname, 'test-files-latest/03_Finance_and_Investment/Tax_and_Compliance/LEGAL 46339648v1 Every Media - EIN Confirmation Letter (1).PDF');
  
  if (!fs.existsSync(einDocPath)) {
    console.error(`❌ Test file not found: ${einDocPath}`);
    console.log('Please ensure the test file is in the correct location.');
    return;
  }

  console.log(`\n📄 Testing with EIN document: ${path.basename(einDocPath)}`);
  
  try {
    // Extract metadata
    console.log('\n🔍 Extracting metadata...');
    const result = await metadataService.generateMetadataFile(einDocPath);
    
    if (!result.success || !result.metadata) {
      console.error('❌ Failed to extract metadata:', result.error);
      return;
    }

    const metadata = result.metadata;
    console.log('\n✅ Metadata extracted successfully');
    
    // Check for critical facts
    console.log('\n📊 Critical Facts:');
    if (metadata.critical_facts) {
      Object.entries(metadata.critical_facts).forEach(([key, value]) => {
        console.log(`  - ${key}: ${value}`);
      });
      
      // Specifically check for EIN
      if (metadata.critical_facts.ein_number) {
        console.log(`\n🎯 EIN Successfully Extracted: ${metadata.critical_facts.ein_number}`);
      } else {
        console.log('\n⚠️  EIN not found in critical_facts');
      }
    } else {
      console.log('  No critical facts extracted');
    }

    // Test memory generation
    console.log('\n🧠 Testing Memory Generation...');
    const testMemoryDir = path.join(__dirname, 'test-memory-output');
    if (!fs.existsSync(testMemoryDir)) {
      fs.mkdirSync(testMemoryDir, { recursive: true });
    }
    
    const memoryService = new MemoryService(testMemoryDir);
    
    // Create test document array
    const testDocs = [{
      path: einDocPath,
      metadata: metadata
    }];
    
    // Generate company info memory
    await (memoryService as any).generateCompanyInfo(testDocs);
    
    // Read the generated memory file
    const companyInfoPath = path.join(testMemoryDir, '_memory', 'company_info.md');
    if (fs.existsSync(companyInfoPath)) {
      const companyInfo = fs.readFileSync(companyInfoPath, 'utf-8');
      console.log('\n📝 Generated Company Info Memory:');
      console.log('---');
      console.log(companyInfo);
      console.log('---');
      
      // Check if EIN is in the memory
      if (companyInfo.includes('EIN:') && !companyInfo.includes('[To be extracted')) {
        console.log('\n✅ EIN successfully added to memory!');
      } else {
        console.log('\n❌ EIN not found in memory or still shows placeholder');
      }
    }

    // Show other metadata fields for context
    console.log('\n📋 Other Metadata Fields:');
    console.log(`  - Document Type: ${metadata.document_type || 'Not specified'}`);
    console.log(`  - Category: ${metadata.category}`);
    console.log(`  - Status: ${metadata.status}`);
    if (metadata.primary_parties) {
      console.log('  - Primary Parties:');
      metadata.primary_parties.forEach(party => {
        console.log(`    - ${party.name} (${party.role})`);
      });
    }

  } catch (error) {
    console.error('❌ Error during test:', error);
  }

  console.log('\n✅ Test completed');
}

// Run the test
testCriticalFactsExtraction().catch(console.error);