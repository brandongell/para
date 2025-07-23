import * as dotenv from 'dotenv';
import { FileMonitorService } from './services/fileMonitor';

// Load environment variables
dotenv.config();

async function startMonitor() {
  console.log('🚀 Starting File Monitor Service...');
  
  // Get API keys
  const openaiApiKey = process.env.OPENAI_API_KEY;
  const geminiApiKey = process.env.GEMINI_API_KEY;
  const organizeFolderPath = process.env.ORGANIZE_FOLDER_PATH;
  
  // Get Documenso config
  const documensoConfig = {
    apiUrl: process.env.DOCUMENSO_API_URL || '',
    apiToken: process.env.DOCUMENSO_API_TOKEN || '',
    appUrl: process.env.DOCUMENSO_APP_URL
  };
  
  // Validate required config
  if (!openaiApiKey) {
    console.error('❌ Missing OPENAI_API_KEY in environment variables');
    process.exit(1);
  }
  
  if (!organizeFolderPath) {
    console.error('❌ Missing ORGANIZE_FOLDER_PATH in environment variables');
    process.exit(1);
  }
  
  // Show configuration
  console.log(`📁 Monitoring folder: ${organizeFolderPath}`);
  if (geminiApiKey) {
    console.log('🔮 Gemini API enabled for PDF extraction');
  }
  if (documensoConfig.apiToken) {
    console.log('📄 Documenso integration enabled for template uploads');
  }
  
  try {
    // Create and start monitor
    const monitor = new FileMonitorService(
      openaiApiKey, 
      geminiApiKey,
      documensoConfig.apiToken ? documensoConfig : undefined
    );
    
    await monitor.startMonitoring(organizeFolderPath);
    
    // Keep process alive
    process.on('SIGINT', () => {
      console.log('\n🛑 Stopping file monitor...');
      monitor.stopMonitoring();
      process.exit(0);
    });
    
  } catch (error) {
    console.error('❌ Failed to start file monitor:', error);
    process.exit(1);
  }
}

// Start the monitor
startMonitor().catch(console.error);