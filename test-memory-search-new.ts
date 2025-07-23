/**
 * Test Memory Search Functionality
 * Tests the enhanced memory service integration with search
 */

import { EnhancedSmartSearchService } from './src/services/enhancedSmartSearchService';
import { MemoryService } from './src/services/memoryService';
import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config();

async function testMemorySearch() {
  console.log('🧪 Testing Memory Search Functionality\n');
  
  const organizedFolderPath = process.env.ORGANIZE_FOLDER_PATH || path.join(__dirname, 'fresh-test-documents');
  const openAIApiKey = process.env.OPENAI_API_KEY;
  
  if (!openAIApiKey) {
    console.error('❌ OPENAI_API_KEY not found in environment');
    return;
  }
  
  // Initialize services
  const memoryService = new MemoryService(organizedFolderPath);
  const searchService = new EnhancedSmartSearchService(
    organizedFolderPath,
    openAIApiKey,
    process.env.GEMINI_API_KEY
  );
  
  // Test queries
  const testQueries = [
    "What is the company's EIN?",
    "What is our address?",
    "How much revenue do we have?",
    "Who invested in the company?",
    "How much did Backend Capital invest?",
    "Who is Dan Shipper?",
    "Show me all SAFE agreements",
    "What templates are available?"
  ];
  
  console.log('📊 Testing Direct Memory Queries:\n');
  
  // Test direct memory queries
  for (const query of testQueries) {
    console.log(`\n🔍 Query: "${query}"`);
    
    // Test direct memory service query
    const memoryResult = await memoryService.queryMemory(query);
    if (memoryResult) {
      console.log('✅ Memory Result Found:');
      console.log(`   Answer: ${memoryResult.answer.substring(0, 200)}${memoryResult.answer.length > 200 ? '...' : ''}`);
      console.log(`   Sources: ${memoryResult.sources.join(', ')}`);
    } else {
      console.log('❌ No direct memory result');
    }
    
    // Test through search service
    console.log('\n🔎 Testing through Enhanced Search Service:');
    try {
      const searchResult = await searchService.search(query, { maxResults: 3 });
      
      console.log(`   Search Path: ${searchResult.searchPath}`);
      console.log(`   Total Time: ${searchResult.performance.totalTime}ms`);
      
      if (searchResult.answer) {
        console.log(`   Answer: ${searchResult.answer.text.substring(0, 200)}${searchResult.answer.text.length > 200 ? '...' : ''}`);
        console.log(`   Confidence: ${searchResult.answer.confidence}`);
      }
      
      if (searchResult.documents.length > 0) {
        console.log(`   Documents Found: ${searchResult.documents.length}`);
        searchResult.documents.forEach(doc => {
          console.log(`     - ${doc.filename} (${doc.matchType}, relevance: ${doc.relevance.toFixed(2)})`);
        });
      }
      
      if (searchResult.memoryResults && searchResult.memoryResults.length > 0) {
        console.log(`   Memory Results: ${searchResult.memoryResults.length}`);
      }
    } catch (error) {
      console.error(`   ❌ Search Error: ${error instanceof Error ? error.message : String(error)}`);
    }
    
    console.log('---');
  }
  
  console.log('\n✅ Memory Search Test Complete!');
}

// Run the test
testMemorySearch().catch(console.error);