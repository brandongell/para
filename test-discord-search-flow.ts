import * as dotenv from 'dotenv';
import { EnhancedSmartSearchService } from './src/services/enhancedSmartSearchService';
import { NaturalLanguageProcessor } from './src/services/naturalLanguageProcessor';
import { BotIntent } from './src/types';

dotenv.config();

async function testDiscordSearchFlow() {
    const organizeFolderPath = '/Users/brandongell/Library/CloudStorage/GoogleDrive-brgell@gmail.com/My Drive/Manual Library/Work/legal_claude_test/para2/legal-document-organizer/test-files-latest';
    const openaiApiKey = process.env.OPENAI_API_KEY;
    const geminiApiKey = process.env.GEMINI_API_KEY;

    if (!openaiApiKey) {
        console.error('Please set OPENAI_API_KEY in .env file');
        process.exit(1);
    }

    const searchService = new EnhancedSmartSearchService(organizeFolderPath, openaiApiKey, geminiApiKey);
    const nlp = new NaturalLanguageProcessor(openaiApiKey);

    console.log('🔍 Testing Discord search flow for: "How much did Bo Ren invest?"');
    console.log('===================================\n');

    // Step 1: Process message to get intent
    const intent = await nlp.processMessage('How much did Bo Ren invest?', false, undefined);
    console.log('Intent detected:', intent);

    // Step 2: Perform search (simulating what Discord bot does)
    const searchResult = await searchService.search(intent.parameters.query || 'How much did Bo Ren invest?', {
        expandSynonyms: true,
        fuzzyMatchThreshold: 0.6,
        maxResults: 10,
        useCache: true
    });

    console.log('\nSearch Path:', searchResult.searchPath);
    console.log('Has AI Answer:', !!searchResult.answer);
    
    if (searchResult.answer) {
        console.log('\n🤖 AI Answer found:');
        console.log('Text:', searchResult.answer.text);
        console.log('Confidence:', searchResult.answer.confidence);
    }

    // Step 3: Format results like Discord bot does
    const formattedResults = formatSearchResultsForResponse(searchResult);
    console.log('\nFormatted Results:', formattedResults.length);

    // Step 4: Generate NLP response
    console.log('\n📝 Generating NLP Response...');
    const response = await nlp.generateResponse(intent, { 
        results: formattedResults,
        searchPath: searchResult.searchPath
    }, undefined);

    console.log('\nNLP Response:');
    console.log(response.content);
    console.log('\nFollow-up suggestions:', response.followUpSuggestions);

    // Check if AI answer would be included
    if (searchResult.answer) {
        console.log('\n✅ AI Answer should be prepended to response');
        const aiAnswerText = formatAIAnswerForDiscord(searchResult.answer);
        console.log('\nFormatted AI Answer:');
        console.log(aiAnswerText);
        
        const fullResponse = aiAnswerText + '\n\n' + response.content;
        console.log('\n📄 Full Discord Response would be:');
        console.log('=====================================');
        console.log(fullResponse);
    }
}

function formatSearchResultsForResponse(searchResult: any): any[] {
    const formattedResults: any[] = [];
    
    // Add documents as results
    for (const doc of searchResult.documents) {
        formattedResults.push({
            filename: doc.filename,
            path: doc.path,
            relevance: doc.relevance,
            matchType: doc.matchType,
            matchReason: doc.matchDetails.reason,
            metadata: doc.metadata,
            source: searchResult.searchPath === 'ai' ? 'AI Search' : 'Document Search'
        });
    }
    
    // Add memory results if available
    if (searchResult.memoryResults) {
        for (const memResult of searchResult.memoryResults) {
            formattedResults.push({
                type: 'memory',
                source: memResult.source,
                section: memResult.section,
                content: memResult.content,
                relevance: memResult.relevance
            });
        }
    }
    
    return formattedResults;
}

function formatAIAnswerForDiscord(answer: any): string {
    if (!answer) return '';
    
    let formatted = `**Answer:** ${answer.text}\n\n`;
    
    if (answer.sources && answer.sources.length > 0) {
        formatted += '**Sources:**\n';
        for (const source of answer.sources) {
            formatted += `📄 \`${source.memoryFile}\` → ${source.section}\n`;
            if (source.originalDocument !== 'not specified') {
                formatted += `   • Source: ${source.originalDocument}\n`;
            }
            if (source.excerpt) {
                formatted += `   • "${source.excerpt.substring(0, 100)}..."\n`;
            }
        }
        formatted += '\n';
    }
    
    formatted += `*Confidence: ${Math.round(answer.confidence * 100)}%*`;
    
    return formatted;
}

testDiscordSearchFlow().catch(console.error);