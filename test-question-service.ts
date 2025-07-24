import * as dotenv from 'dotenv';
import { DocumentQuestionService } from './src/services/documentQuestionService';

dotenv.config();

async function testQuestionService() {
    const organizeFolderPath = '/Users/brandongell/Library/CloudStorage/GoogleDrive-brgell@gmail.com/My Drive/Manual Library/Work/legal_claude_test/para2/legal-document-organizer/test-files-latest';
    const openaiApiKey = process.env.OPENAI_API_KEY;
    const geminiApiKey = process.env.GEMINI_API_KEY;

    if (!openaiApiKey) {
        console.error('Please set OPENAI_API_KEY in .env file');
        process.exit(1);
    }

    const questionService = new DocumentQuestionService(openaiApiKey, organizeFolderPath, geminiApiKey);

    console.log('🧪 Testing DocumentQuestionService\n');
    console.log('===================================\n');

    const questions = [
        "How much did Bo Ren invest?",
        "How much money did Bo Ren invest?",
        "What is the total amount Bo Ren invested?"
    ];

    for (const question of questions) {
        console.log(`\n❓ Question: "${question}"`);
        console.log('-----------------------------------');
        
        try {
            const answer = await questionService.answerQuestion(question);
            console.log(`\n✅ Answer: ${answer}`);
        } catch (error) {
            console.error(`\n❌ Error: ${error}`);
        }
        
        console.log('\n===================================');
    }
}

testQuestionService().catch(console.error);