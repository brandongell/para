import { config } from 'dotenv';
import { MemoryService } from './src/services/memoryService';
import { SmartSearchService } from './src/services/smartSearchService';
import * as path from 'path';

// Load environment variables
config();

async function testMemorySearch() {
  console.log('🧪 Testing Memory Search System');
  console.log('================================\n');
  
  const organizeFolderPath = process.env.ORGANIZE_FOLDER_PATH || './test-files';
  const absolutePath = path.resolve(organizeFolderPath);
  
  // Create services
  const memoryService = new MemoryService(absolutePath);
  const searchService = new SmartSearchService(absolutePath);
  
  // Test queries
  const testQueries = [
    'EIN number',
    'company address',
    'total revenue',
    'investors',
    'Dan Shipper',
    'SAFE agreements',
    'how much did Backend Capital invest'
  ];
  
  console.log('📋 Testing direct memory queries:\n');
  
  for (const query of testQueries) {
    console.log(`\n🔍 Query: "${query}"`);
    const result = await memoryService.queryMemory(query);
    
    if (result) {
      console.log(`✅ Found in memory!`);
      console.log(`📄 Answer: ${result.answer.substring(0, 200)}${result.answer.length > 200 ? '...' : ''}`);
      console.log(`📚 Sources: ${result.sources.join(', ')}`);
    } else {
      console.log(`❌ Not found in memory`);
    }
  }
  
  // Test search service integration
  console.log('\n\n📋 Testing search service with memory integration:\n');
  
  const searchIntent = {
    type: 'SEARCH_DOCUMENTS' as const,
    confidence: 0.9,
    parameters: {
      query: 'EIN number'
    }
  };
  
  const searchResults = await searchService.searchByNaturalLanguage(searchIntent);
  
  if (searchResults.length > 0) {
    console.log(`✅ Search returned ${searchResults.length} results`);
    const memoryResult = searchResults.find(r => r.metadata?.category === 'Memory');
    if (memoryResult) {
      console.log(`🧠 Memory result found with answer: ${memoryResult.metadata?.notes?.substring(0, 100)}...`);
    }
  } else {
    console.log(`❌ No search results found`);
  }
  
  // Test quick answer feature
  console.log('\n\n📋 Testing quick answer feature:\n');
  
  const quickAnswer = await searchService.getQuickAnswer('who invested the most money');
  if (quickAnswer) {
    console.log(`✅ Quick answer found!`);
    console.log(`📄 Answer: ${quickAnswer.answer}`);
  } else {
    console.log(`❌ No quick answer found`);
  }
}

// Run the test
testMemorySearch().catch(error => {
  console.error('❌ Test failed:', error);
  process.exit(1);
});