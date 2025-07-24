#!/usr/bin/env ts-node

/**
 * Test script to verify Discord bot memory updates
 * This simulates the Discord bot organizing a file and checks if memory is updated
 */

import * as fs from 'fs';
import * as path from 'path';
import { DiscordBotService } from './src/services/discordBotService';
import { DocumentClassifierService } from './src/services/documentClassifier';
import { FileOrganizerService } from './src/services/fileOrganizer';
import { MetadataService } from './src/services/metadataService';
import { MemoryService } from './src/services/memoryService';

async function testDiscordMemoryUpdate() {
  console.log('🧪 Testing Discord Bot Memory Update Functionality\n');

  // Setup paths
  const testOrganizePath = '/tmp/discord-memory-test';
  const memoryPath = path.join(testOrganizePath, 'memory');
  
  // Create test directories
  console.log('📁 Setting up test directories...');
  fs.mkdirSync(testOrganizePath, { recursive: true });
  fs.mkdirSync(memoryPath, { recursive: true });
  
  // Copy a test file
  const sourceFile = '/Users/brandongell/Library/CloudStorage/GoogleDrive-brgell@gmail.com/My Drive/Manual Library/Work/legal_claude_test/para2/legal-document-organizer/test-files-latest/03_Finance_and_Investment/Investment_and_Fundraising/Quinten_Farmer.pdf';
  const testFile = path.join(testOrganizePath, 'Quinten_Farmer.pdf');
  
  if (!fs.existsSync(sourceFile)) {
    console.error('❌ Source test file not found:', sourceFile);
    return;
  }
  
  console.log('📄 Copying test file...');
  fs.copyFileSync(sourceFile, testFile);
  
  // Initialize memory files
  console.log('📝 Initializing memory files...');
  const memoryFiles = [
    'people_directory.md',
    'investors_and_cap_table.md',
    'equity_and_options.md',
    'document_index.md'
  ];
  
  for (const file of memoryFiles) {
    const filePath = path.join(memoryPath, file);
    if (!fs.existsSync(filePath)) {
      fs.writeFileSync(filePath, `# ${file.replace(/_/g, ' ').replace('.md', '').toUpperCase()}\n\n`);
    }
  }
  
  // Get API keys from environment
  const openaiApiKey = process.env.OPENAI_API_KEY;
  const geminiApiKey = process.env.GEMINI_API_KEY;
  
  if (!openaiApiKey || !geminiApiKey) {
    console.error('❌ Missing required API keys in environment');
    return;
  }
  
  console.log('\n🚀 Starting file organization through Discord bot flow...\n');
  
  try {
    // Initialize services as Discord bot would
    const classifier = new DocumentClassifierService(openaiApiKey, geminiApiKey);
    const organizer = new FileOrganizerService();
    const metadataService = new MetadataService(openaiApiKey, geminiApiKey);
    const memoryService = new MemoryService(testOrganizePath);
    
    // Set metadata service in organizer
    organizer.setMetadataService(metadataService);
    
    // Classify the document
    console.log('🤔 Classifying document...');
    const classification = await classifier.classifyFile(testFile);
    console.log(`📊 Classification: ${classification.primaryFolder}/${classification.subfolder}`);
    
    // Organize the file
    console.log('\n📦 Organizing file...');
    const organizationResult = await organizer.organizeFile(
      testFile,
      classification,
      testOrganizePath,
      true // Generate metadata
    );
    
    if (!organizationResult.success) {
      console.error('❌ File organization failed:', organizationResult.error);
      return;
    }
    
    console.log('✅ File organized successfully');
    console.log(`📍 New location: ${organizationResult.newPath}`);
    console.log(`📋 Metadata: ${organizationResult.metadataPath}`);
    
    // Check if metadata was created
    if (!organizationResult.metadataPath || !fs.existsSync(organizationResult.metadataPath)) {
      console.error('❌ Metadata file was not created');
      return;
    }
    
    // Read the metadata
    const metadataContent = fs.readFileSync(organizationResult.metadataPath, 'utf-8');
    const metadata = JSON.parse(metadataContent);
    
    console.log('\n📋 Metadata extracted:');
    console.log(`   Status: ${metadata.status}`);
    console.log(`   Category: ${metadata.category}`);
    console.log(`   Signers: ${metadata.signers?.map((s: any) => s.name).join(', ')}`);
    console.log(`   Contract Value: ${metadata.contract_value}`);
    
    // Now update memory as Discord bot would
    console.log('\n🧠 Updating memory with new document...');
    await memoryService.updateMemoryForDocument(organizationResult.newPath!, metadata);
    console.log('✅ Memory update completed');
    
    // Verify memory was updated
    console.log('\n🔍 Verifying memory updates...\n');
    
    // Check people directory
    const peopleContent = fs.readFileSync(path.join(memoryPath, 'people_directory.md'), 'utf-8');
    const hasQuintenInPeople = peopleContent.includes('Quinten Farmer');
    console.log(`✅ People Directory: ${hasQuintenInPeople ? 'Contains Quinten Farmer' : '❌ Missing Quinten Farmer'}`);
    
    // Check investors and cap table
    const investorsContent = fs.readFileSync(path.join(memoryPath, 'investors_and_cap_table.md'), 'utf-8');
    const hasQuintenInInvestors = investorsContent.includes('Quinten Farmer');
    const has5000Investment = investorsContent.includes('$5,000');
    console.log(`✅ Investors & Cap Table: ${hasQuintenInInvestors ? 'Contains Quinten Farmer' : '❌ Missing Quinten Farmer'}`);
    console.log(`✅ Investment Amount: ${has5000Investment ? 'Shows $5,000' : '❌ Missing $5,000'}`);
    
    // Check document index
    const indexContent = fs.readFileSync(path.join(memoryPath, 'document_index.md'), 'utf-8');
    const hasDocInIndex = indexContent.includes('Quinten_Farmer.pdf');
    console.log(`✅ Document Index: ${hasDocInIndex ? 'Contains Quinten_Farmer.pdf' : '❌ Missing document'}`);
    
    // Test search functionality
    console.log('\n🔍 Testing search for "Quinten Farmer investment amount"...');
    const searchService = new (require('./src/services/enhancedSmartSearchService').EnhancedSmartSearchService)(
      testOrganizePath,
      openaiApiKey,
      geminiApiKey
    );
    
    const searchResult = await searchService.search('Quinten Farmer investment amount', {
      expandSynonyms: true,
      fuzzyMatchThreshold: 0.6,
      maxResults: 5
    });
    
    console.log(`\n📊 Search Results: Found ${searchResult.documents.length} documents`);
    if (searchResult.documents.length > 0) {
      const topResult = searchResult.documents[0];
      console.log(`   Top result: ${topResult.filename}`);
      console.log(`   Relevance: ${Math.round(topResult.relevance * 100)}%`);
      console.log(`   Match type: ${topResult.matchType}`);
      
      // Check if it found the correct document
      if (topResult.filename.includes('Quinten_Farmer')) {
        console.log('   ✅ Correct document found!');
      } else {
        console.log('   ❌ Wrong document returned');
      }
    }
    
    console.log('\n✨ Test completed successfully!');
    
  } catch (error) {
    console.error('\n❌ Test failed with error:', error);
  } finally {
    // Cleanup
    console.log('\n🧹 Cleaning up test directory...');
    fs.rmSync(testOrganizePath, { recursive: true, force: true });
  }
}

// Run the test
testDiscordMemoryUpdate().catch(console.error);