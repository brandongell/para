import * as dotenv from 'dotenv';
import { EnhancedSmartSearchService } from './src/services/enhancedSmartSearchService';

dotenv.config();

async function testSearch() {
    const organizeFolderPath = '/Users/brandongell/Library/CloudStorage/GoogleDrive-brgell@gmail.com/My Drive/Manual Library/Work/legal_claude_test/para2/legal-document-organizer/test-files-latest';
    const openaiApiKey = process.env.OPENAI_API_KEY;
    const geminiApiKey = process.env.GEMINI_API_KEY;

    if (!openaiApiKey) {
        console.error('Please set OPENAI_API_KEY in .env file');
        process.exit(1);
    }

    const searchService = new EnhancedSmartSearchService(organizeFolderPath, openaiApiKey, geminiApiKey);

    console.log('🔍 Testing search for: "How much did Bo Ren invest?"');
    console.log('===================================\n');

    const result = await searchService.search('How much did Bo Ren invest?', {
        expandSynonyms: true,
        fuzzyMatchThreshold: 0.6,
        maxResults: 10,
        useCache: true
    });

    console.log('Search Path:', result.searchPath);
    console.log('\nDocuments Found:', result.documents.length);
    
    if (result.documents.length > 0) {
        console.log('\nDocument Results:');
        result.documents.forEach((doc, i) => {
            console.log(`\n${i + 1}. ${doc.filename}`);
            console.log(`   Path: ${doc.path}`);
            console.log(`   Relevance: ${Math.round(doc.relevance * 100)}%`);
            console.log(`   Match Type: ${doc.matchType}`);
            console.log(`   Reason: ${doc.matchDetails.reason}`);
            if (doc.metadata) {
                console.log(`   Contract Value: ${doc.metadata.contract_value || 'N/A'}`);
                console.log(`   Signers: ${doc.metadata.signers?.map((s: any) => s.name).join(', ') || 'N/A'}`);
            }
        });
    }

    if (result.answer) {
        console.log('\n\n🤖 AI Answer:');
        console.log('Text:', result.answer.text);
        console.log('Confidence:', Math.round(result.answer.confidence * 100) + '%');
        
        if (result.answer.sources && result.answer.sources.length > 0) {
            console.log('\nSources:');
            result.answer.sources.forEach(source => {
                console.log(`- ${source.memoryFile} > ${source.section}`);
                if (source.excerpt) {
                    console.log(`  "${source.excerpt.substring(0, 100)}..."`);
                }
            });
        }
    }

    if (result.memoryResults && result.memoryResults.length > 0) {
        console.log('\n\n📚 Memory Results:');
        result.memoryResults.forEach(mem => {
            console.log(`\nSource: ${mem.source}`);
            console.log(`Section: ${mem.section}`);
            console.log(`Content: ${mem.content.substring(0, 200)}...`);
            console.log(`Relevance: ${Math.round(mem.relevance * 100)}%`);
        });
    }

    console.log('\n\nPerformance:', result.performance);
}

testSearch().catch(console.error);