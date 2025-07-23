import { config } from 'dotenv';
import { MemoryService } from './src/services/memoryService';
import * as path from 'path';

// Load environment variables
config();

async function refreshMemory() {
  console.log('🧠 Memory Refresh Tool');
  console.log('====================\n');
  
  // Get organized folder path from environment or use default
  const organizeFolderPath = process.env.ORGANIZE_FOLDER_PATH || './test-files';
  const absolutePath = path.resolve(organizeFolderPath);
  
  console.log(`📁 Organized documents folder: ${absolutePath}`);
  console.log(`🔍 Scanning for documents and metadata...\n`);
  
  try {
    // Create memory service
    const memoryService = new MemoryService(absolutePath);
    
    // Refresh all memory files
    await memoryService.refreshAllMemory();
    
    console.log('\n✅ Memory refresh complete!');
    console.log(`📍 Memory files created in: ${path.join(path.dirname(absolutePath), 'memory')}`);
    
    // Test a query
    console.log('\n🧪 Testing memory query...');
    const testResult = await memoryService.queryMemory('company');
    if (testResult) {
      console.log('✅ Memory query successful!');
      console.log(`Found: ${testResult.answer.substring(0, 100)}...`);
    } else {
      console.log('⚠️  No results found for test query');
    }
    
  } catch (error) {
    console.error('❌ Error refreshing memory:', error);
    process.exit(1);
  }
}

// Run the refresh
refreshMemory().catch(error => {
  console.error('❌ Fatal error:', error);
  process.exit(1);
});