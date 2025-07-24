import * as fs from 'fs';
import * as path from 'path';
import { OpenAIService } from './src/services/openai';
import { MetadataService } from './src/services/metadataService';
import { MemoryService } from './src/services/memoryService';
import { DocumentMetadata } from './src/types';
import * as dotenv from 'dotenv';

// Load environment variables
dotenv.config();

async function testEnhancedInformationCapture() {
  console.log('🧪 Testing Enhanced Information Capture System');
  console.log('============================================\n');

  const openaiApiKey = process.env.OPENAI_API_KEY;
  const geminiApiKey = process.env.GEMINI_API_KEY;

  if (!openaiApiKey) {
    console.error('❌ OPENAI_API_KEY not found in environment variables');
    process.exit(1);
  }

  // Initialize services
  const metadataService = new MetadataService(openaiApiKey, geminiApiKey);
  const memoryService = new MemoryService(process.env.ORGANIZE_FOLDER_PATH || './test-output');

  // Test document path - you can change this to test with a specific document
  const testDocumentPath = process.argv[2];
  
  if (!testDocumentPath) {
    console.error('❌ Please provide a document path as an argument');
    console.log('Usage: npx ts-node test-enhanced-information-capture.ts <path-to-document>');
    process.exit(1);
  }

  if (!fs.existsSync(testDocumentPath)) {
    console.error(`❌ Document not found: ${testDocumentPath}`);
    process.exit(1);
  }

  console.log(`📄 Testing with document: ${path.basename(testDocumentPath)}`);
  console.log('');

  try {
    // Step 1: Extract metadata with enhanced fields
    console.log('1️⃣ Extracting enhanced metadata...');
    const metadataResult = await metadataService.generateMetadataFile(testDocumentPath);
    
    if (!metadataResult.success || !metadataResult.metadata) {
      console.error('❌ Failed to extract metadata:', metadataResult.error);
      process.exit(1);
    }

    const metadata = metadataResult.metadata;
    console.log('✅ Metadata extracted successfully\n');

    // Display enhanced metadata fields
    console.log('📊 Enhanced Metadata Fields:');
    console.log('============================');
    
    // Basic fields
    console.log(`\n📋 Basic Information:`);
    console.log(`  - Status: ${metadata.status}`);
    console.log(`  - Category: ${metadata.category}`);
    console.log(`  - Document Type: ${metadata.document_type || 'N/A'}`);
    console.log(`  - Contract Value: ${metadata.contract_value || 'N/A'}`);
    
    // Business context
    if (metadata.business_context) {
      console.log(`\n💼 Business Context:`);
      console.log(`  ${metadata.business_context}`);
    }
    
    // Key terms
    if (metadata.key_terms && metadata.key_terms.length > 0) {
      console.log(`\n📌 Key Terms (${metadata.key_terms.length} found):`);
      metadata.key_terms.forEach((term, idx) => {
        console.log(`  ${idx + 1}. ${term}`);
      });
    }
    
    // Obligations
    if (metadata.obligations && metadata.obligations.length > 0) {
      console.log(`\n📝 Obligations (${metadata.obligations.length} found):`);
      metadata.obligations.forEach((obligation, idx) => {
        console.log(`  ${idx + 1}. ${obligation}`);
      });
    }
    
    // Financial terms
    if (metadata.financial_terms && Object.keys(metadata.financial_terms).length > 0) {
      console.log(`\n💰 Financial Terms:`);
      Object.entries(metadata.financial_terms).forEach(([key, value]) => {
        if (value) {
          console.log(`  - ${key.replace(/_/g, ' ')}: ${value}`);
        }
      });
    }
    
    // Critical facts
    if (metadata.critical_facts && Object.keys(metadata.critical_facts).length > 0) {
      console.log(`\n🔍 Critical Facts:`);
      Object.entries(metadata.critical_facts).forEach(([key, value]) => {
        console.log(`  - ${key.replace(/_/g, ' ')}: ${value}`);
      });
    }

    // Step 2: Update memory with enhanced information
    console.log('\n\n2️⃣ Updating memory files with enhanced information...');
    await memoryService.updateMemoryForDocument(testDocumentPath, metadata);
    console.log('✅ Memory files updated\n');

    // Step 3: Check what memory files were affected
    const memoryDir = path.join(process.env.ORGANIZE_FOLDER_PATH || './test-output', 'memory');
    if (fs.existsSync(memoryDir)) {
      const memoryFiles = fs.readdirSync(memoryDir).filter(f => f.endsWith('.md'));
      
      console.log('📚 Memory Files Updated:');
      console.log('=======================');
      
      // Check which memory files contain information from this document
      const filename = path.basename(testDocumentPath);
      for (const memoryFile of memoryFiles) {
        const memoryPath = path.join(memoryDir, memoryFile);
        const content = fs.readFileSync(memoryPath, 'utf-8');
        
        if (content.includes(filename)) {
          console.log(`\n✅ ${memoryFile}:`);
          
          // Extract relevant sections that mention this document
          const lines = content.split('\n');
          let inRelevantSection = false;
          let sectionName = '';
          
          for (const line of lines) {
            if (line.startsWith('## ')) {
              sectionName = line.substring(3);
              inRelevantSection = false;
            }
            
            if (line.includes(filename)) {
              if (!inRelevantSection) {
                console.log(`   📂 Section: ${sectionName}`);
                inRelevantSection = true;
              }
              console.log(`      ${line.trim()}`);
            }
          }
        }
      }
    }

    // Step 4: Summary
    console.log('\n\n📊 Summary:');
    console.log('===========');
    console.log(`✅ Enhanced metadata extraction completed`);
    console.log(`✅ Captured ${metadata.key_terms?.length || 0} key terms`);
    console.log(`✅ Captured ${metadata.obligations?.length || 0} obligations`);
    console.log(`✅ Captured ${Object.keys(metadata.financial_terms || {}).length} financial terms`);
    console.log(`✅ Captured ${Object.keys(metadata.critical_facts || {}).length} critical facts`);
    console.log(`✅ Business context: ${metadata.business_context ? 'Yes' : 'No'}`);
    console.log(`✅ Memory files updated with comprehensive information`);

    console.log('\n🎉 Enhanced information capture test completed successfully!');

  } catch (error) {
    console.error('❌ Error during test:', error);
    process.exit(1);
  }
}

// Run the test
testEnhancedInformationCapture().catch(console.error);