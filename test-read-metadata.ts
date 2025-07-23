import * as fs from 'fs';
import * as path from 'path';

// Test reading the metadata file directly
const metadataPath = path.join(__dirname, 'test-files-latest/03_Finance_and_Investment/Tax_and_Compliance/LEGAL 46339648v1 Every Media - EIN Confirmation Letter (1).PDF.metadata.json');

console.log('📄 Reading metadata file directly...\n');

if (fs.existsSync(metadataPath)) {
  const content = fs.readFileSync(metadataPath, 'utf-8');
  console.log('Raw content:');
  console.log(content);
  
  try {
    const metadata = JSON.parse(content);
    console.log('\n✅ Parsed metadata:');
    console.log(JSON.stringify(metadata, null, 2));
    
    if (metadata.critical_facts) {
      console.log('\n🎯 Critical Facts:');
      console.log(JSON.stringify(metadata.critical_facts, null, 2));
      
      if (metadata.critical_facts.ein_number) {
        console.log(`\n✅ EIN Found: ${metadata.critical_facts.ein_number}`);
      } else {
        console.log('\n❌ EIN not found in critical_facts');
      }
    }
  } catch (error) {
    console.error('❌ Error parsing JSON:', error);
  }
} else {
  console.log('❌ Metadata file not found');
}