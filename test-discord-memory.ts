import { config } from 'dotenv';
import { NaturalLanguageProcessor } from './src/services/naturalLanguageProcessor';
import { SmartSearchService } from './src/services/smartSearchService';
import * as path from 'path';

// Load environment variables
config();

async function testDiscordMemory() {
  console.log('🤖 Testing Discord Bot Memory Integration');
  console.log('=========================================\n');
  
  const openaiApiKey = process.env.OPENAI_API_KEY;
  if (!openaiApiKey) {
    console.error('❌ Missing OPENAI_API_KEY');
    process.exit(1);
  }
  
  const organizeFolderPath = process.env.ORGANIZE_FOLDER_PATH || './test-files';
  const absolutePath = path.resolve(organizeFolderPath);
  
  // Create services
  const nlp = new NaturalLanguageProcessor(openaiApiKey);
  const searchService = new SmartSearchService(absolutePath);
  
  // Test queries that should trigger memory search
  const testMessages = [
    "What is our EIN number?",
    "How much revenue do we have?",
    "Who are our investors?",
    "What's the company address?",
    "How much did Backend Capital invest?",
    "Show me all SAFE agreements"
  ];
  
  console.log('📋 Testing NLP intent detection and memory search:\n');
  
  for (const message of testMessages) {
    console.log(`\n💬 User: "${message}"`);
    
    // Process message to get intent
    const intent = await nlp.processMessage(message, false);
    console.log(`🎯 Intent: ${intent.type} (confidence: ${intent.confidence})`);
    console.log(`📌 Parameters:`, intent.parameters);
    
    // If it's a search, try to find answer
    if (intent.type === 'SEARCH_DOCUMENTS' && intent.parameters.query) {
      const results = await searchService.searchByNaturalLanguage(intent);
      
      if (results.length > 0) {
        console.log(`✅ Found ${results.length} results`);
        
        // Check if we got a memory result
        const memoryResult = results.find(r => r.metadata?.category === 'Memory');
        if (memoryResult && memoryResult.metadata?.notes) {
          console.log(`🧠 Memory answer: ${memoryResult.metadata.notes.substring(0, 200)}...`);
        } else {
          console.log(`📄 First result: ${results[0].filename}`);
        }
        
        // Generate response
        const response = await nlp.generateResponse(intent, { results }, undefined);
        console.log(`\n🤖 Bot response preview:`);
        console.log(response.content.substring(0, 300) + '...');
      } else {
        console.log(`❌ No results found`);
      }
    }
  }
  
  console.log('\n\n✅ Test complete!');
}

// Run the test
testDiscordMemory().catch(error => {
  console.error('❌ Test failed:', error);
  process.exit(1);
});