import * as dotenv from 'dotenv';
import { ClaudeCodeSearchAgent } from './src/services/claudeCodeSearchAgent';

// Load environment variables
dotenv.config();

async function testClaudeSearch() {
  console.log('🧪 Testing Claude Code Search Agent');
  console.log('===================================\n');

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

  // Test questions
  const testQuestions = [
    "How much money has Austin Rief invested?",
    "What are the payment terms in our customer agreements?",
    "What templates do we have available?",
    "What is our company's EIN number?",
    "Who are all our investors and how much did each invest?"
  ];

  // Test each question
  for (const question of testQuestions) {
    console.log(`\n${'='.repeat(80)}`);
    console.log(`📌 Question: "${question}"`);
    console.log(`${'='.repeat(80)}\n`);

    try {
      const startTime = Date.now();
      const answer = await searchAgent.answerQuestion(question);
      const duration = ((Date.now() - startTime) / 1000).toFixed(2);
      
      console.log(`\n✅ Answer received in ${duration}s:`);
      console.log(`${'─'.repeat(80)}`);
      console.log(answer);
      console.log(`${'─'.repeat(80)}\n`);
      
    } catch (error) {
      console.error(`\n❌ Error answering question:`, error);
    }

    // Wait a bit between questions to avoid rate limits
    if (testQuestions.indexOf(question) < testQuestions.length - 1) {
      console.log('\n⏳ Waiting 2 seconds before next question...');
      await new Promise(resolve => setTimeout(resolve, 2000));
    }
  }

  console.log('\n✅ Test completed!');
}

// Run the test
testClaudeSearch().catch(console.error);