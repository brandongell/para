import { MemoryService } from './src/services/memoryService';
import * as fs from 'fs';

const testPath = '/Users/brandongell/Library/CloudStorage/GoogleDrive-brgell@gmail.com/My Drive/Manual Library/Work/legal_claude_test/para2/legal-document-organizer/test-files-latest';
const templatePath = `${testPath}/09_Templates/By_Category/Test_Template_[FORM].txt`;

async function testMemoryUpdate() {
  console.log('🧪 Testing memory update for single document...\n');
  
  // Initialize memory service
  const memoryService = new MemoryService(testPath);
  
  // Read template metadata
  const metadataPath = `${templatePath}.metadata.json`;
  if (!fs.existsSync(metadataPath)) {
    console.error(`❌ Metadata file not found: ${metadataPath}`);
    return;
  }
  
  const metadata = JSON.parse(fs.readFileSync(metadataPath, 'utf-8'));
  console.log('📄 Document:', templatePath);
  console.log('📋 Status:', metadata.status);
  console.log('📂 Category:', metadata.category);
  
  // Test memory update
  console.log('\n🧠 Calling updateMemoryForDocument...');
  try {
    await memoryService.updateMemoryForDocument(templatePath, metadata);
    console.log('✅ Memory update completed');
    
    // Check if templates inventory was updated
    const templatesPath = `${testPath}/_memory/templates_inventory.md`;
    const content = fs.readFileSync(templatesPath, 'utf-8');
    console.log('\n📄 Templates inventory content:');
    console.log('Last updated:', content.match(/Last Updated: (.+)/)?.[1]);
    console.log('Total templates:', content.match(/Total templates available: (\d+)/)?.[1]);
  } catch (error) {
    console.error('❌ Error:', error);
  }
}

testMemoryUpdate();