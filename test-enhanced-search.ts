/**
 * Test Suite for Enhanced Search System
 * Run with: npx ts-node test-enhanced-search.ts
 */

import * as dotenv from 'dotenv';
import * as path from 'path';
import { EnhancedSmartSearchService } from './src/services/enhancedSmartSearchService';
import { QueryAnalyzer } from './src/services/queryAnalyzer';
import { FuzzyMatcher } from './src/services/fuzzyMatcher';
import { SearchMappings } from './src/services/searchMappings';

// Load environment variables
dotenv.config();

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const ORGANIZE_FOLDER_PATH = process.env.ORGANIZE_FOLDER_PATH || './organized';

// Test utilities
function printTestHeader(testName: string) {
  console.log('\n' + '='.repeat(60));
  console.log(`TEST: ${testName}`);
  console.log('='.repeat(60));
}

function printResult(label: string, result: any) {
  console.log(`\n${label}:`);
  console.log(JSON.stringify(result, null, 2));
}

async function runTests() {
  console.log('🧪 Enhanced Search System Test Suite');
  console.log('====================================\n');

  // Test 1: Query Analyzer
  printTestHeader('Query Analyzer');
  
  const testQueries = [
    'find employment agreement',
    'what is our burn rate?',
    'show me all contracts worth more than $50k',
    'documents signed last month',
    'explain our equity structure',
    'templates',
    'Dan Shipper documents but not employment'
  ];

  for (const query of testQueries) {
    const complexity = QueryAnalyzer.analyzeQuery(query);
    console.log(`\nQuery: "${query}"`);
    console.log(`Complex: ${complexity.isComplex} | Path: ${complexity.suggestedPath} | Reason: ${complexity.reason}`);
  }

  // Test 2: Fuzzy Matcher
  printTestHeader('Fuzzy Matcher');

  const matchTests = [
    { query: 'Dan', field: 'Dan Shipper', expected: 'partial' },
    { query: 'employmnt', field: 'employment', expected: 'fuzzy' },
    { query: 'safe', field: 'SAFE Agreement', expected: 'contains' },
    { query: 'nda', field: 'Non-Disclosure Agreement', expected: 'abbreviation' }
  ];

  for (const test of matchTests) {
    const result = FuzzyMatcher.match(test.query, test.field);
    console.log(`\nMatch "${test.query}" against "${test.field}"`);
    console.log(`Score: ${result.score.toFixed(2)} | Type: ${result.type} | Expected: ${test.expected}`);
  }

  // Test 3: Search Mappings
  printTestHeader('Search Mappings - Synonyms & Parsing');

  console.log('\n📝 Synonym Expansion:');
  const expansions = SearchMappings.expandQuery('investment docs');
  console.log(`"investment docs" expands to:`, expansions);

  console.log('\n💰 Value Parsing:');
  const valueTests = ['contracts over $50k', 'worth more than 100000', 'less than $25,000'];
  for (const test of valueTests) {
    const parsed = SearchMappings.parseValueComparison(test);
    console.log(`"${test}" → ${parsed ? `${parsed.operator} ${parsed.value}` : 'not parsed'}`);
  }

  console.log('\n📅 Date Parsing:');
  const dateTests = ['last month', 'next 30 days', 'this year', 'yesterday'];
  for (const test of dateTests) {
    const parsed = SearchMappings.parseRelativeDate(test);
    console.log(`"${test}" → ${parsed ? parsed.toLocaleDateString() : 'not parsed'}`);
  }

  // Test 4: Enhanced Search Service (if API key available)
  if (OPENAI_API_KEY) {
    printTestHeader('Enhanced Search Service');

    const searchService = new EnhancedSmartSearchService(
      ORGANIZE_FOLDER_PATH,
      OPENAI_API_KEY,
      GEMINI_API_KEY
    );

    console.log('\n🔍 Testing search queries...\n');

    // Test fast search
    console.log('1. Fast Search: "employment agreement"');
    try {
      const fastResult = await searchService.search('employment agreement', {
        forceSearchPath: 'fast',
        maxResults: 3
      });
      
      console.log(`   Path: ${fastResult.searchPath}`);
      console.log(`   Documents found: ${fastResult.documents.length}`);
      console.log(`   Search time: ${fastResult.performance.searchTime}ms`);
      
      if (fastResult.documents.length > 0) {
        console.log('   Top result:', fastResult.documents[0].filename);
      }
    } catch (error) {
      console.error('   Error:', error instanceof Error ? error.message : 'Unknown error');
    }

    // Test AI search
    console.log('\n2. AI Search: "What is our total investment?"');
    try {
      const aiResult = await searchService.search('What is our total investment?', {
        forceSearchPath: 'ai',
        maxResults: 3
      });
      
      console.log(`   Path: ${aiResult.searchPath}`);
      if (aiResult.answer) {
        console.log(`   Answer: ${aiResult.answer.text}`);
        console.log(`   Sources: ${aiResult.answer.sources.length}`);
        console.log(`   Confidence: ${Math.round(aiResult.answer.confidence * 100)}%`);
      }
    } catch (error) {
      console.error('   Error:', error instanceof Error ? error.message : 'Unknown error');
    }

    // Test hybrid search
    console.log('\n3. Hybrid Search: "investment documents from 2023"');
    try {
      const hybridResult = await searchService.search('investment documents from 2023', {
        maxResults: 5
      });
      
      console.log(`   Path: ${hybridResult.searchPath}`);
      console.log(`   Documents found: ${hybridResult.documents.length}`);
      console.log(`   Has AI answer: ${!!hybridResult.answer}`);
    } catch (error) {
      console.error('   Error:', error instanceof Error ? error.message : 'Unknown error');
    }

    // Test document stats
    console.log('\n4. Document Statistics');
    try {
      const stats = await searchService.getDocumentStatistics();
      console.log(`   Total documents: ${stats.totalDocuments}`);
      console.log(`   Templates: ${stats.templateCount}`);
      console.log(`   Categories: ${Object.keys(stats.byCategory).length}`);
    } catch (error) {
      console.error('   Error:', error instanceof Error ? error.message : 'Unknown error');
    }

  } else {
    console.log('\n⚠️  Skipping Enhanced Search Service tests - OPENAI_API_KEY not found');
  }

  console.log('\n\n✅ Test suite completed!');
}

// Run the tests
runTests().catch(error => {
  console.error('❌ Test suite failed:', error);
  process.exit(1);
});