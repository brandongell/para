import * as dotenv from 'dotenv';
import { ClaudeCodeSearchAgent } from './src/services/claudeCodeSearchAgent';

// Load environment variables
dotenv.config();

async function testEINSearch() {
  console.log('🧪 Testing Claude Code Search for EIN');
  console.log('=====================================\n');

  const anthropicApiKey = process.env.ANTHROPIC_API_KEY;
  const geminiApiKey = process.env.GEMINI_API_KEY;
  const organizeFolderPath = process.env.ORGANIZE_FOLDER_PATH || './test-files-latest';

  if (!anthropicApiKey) {
    console.error('❌ ANTHROPIC_API_KEY not found in environment variables');
    console.log('Please add ANTHROPIC_API_KEY to your .env file');
    process.exit(1);
  }

  // Initialize the search agent
  const searchAgent = new ClaudeCodeSearchAgent(
    organizeFolderPath,
    anthropicApiKey,
    geminiApiKey
  );

  // Test the EIN question
  const question = "what is every's EIN?";
  
  console.log(`📌 Question: "${question}"`);
  console.log(`${'='.repeat(60)}\n`);

  try {
    const startTime = Date.now();
    const answer = await searchAgent.answerQuestion(question);
    const duration = ((Date.now() - startTime) / 1000).toFixed(2);
    
    console.log(`\n✅ Answer received in ${duration}s:`);
    console.log(`${'─'.repeat(60)}`);
    console.log(answer);
    console.log(`${'─'.repeat(60)}\n`);
    
  } catch (error) {
    console.error(`\n❌ Error answering question:`, error);
  }
}

// Run the test
testEINSearch().catch(console.error);