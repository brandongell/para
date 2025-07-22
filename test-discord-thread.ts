import { config } from 'dotenv';
import { DiscordBotService } from './src/services/discordBotService';

// Load environment variables
config();

async function testDiscordBot() {
  const token = process.env.DISCORD_BOT_TOKEN;
  const openaiApiKey = process.env.OPENAI_API_KEY;
  const organizeFolderPath = process.env.ORGANIZE_FOLDER_PATH || './test-files';
  const geminiApiKey = process.env.GEMINI_API_KEY;

  if (!token || !openaiApiKey) {
    console.error('❌ Missing required environment variables: DISCORD_BOT_TOKEN or OPENAI_API_KEY');
    process.exit(1);
  }

  console.log('🚀 Starting Discord bot with thread-based communication...');
  console.log('📋 Thread behavior:');
  console.log('   - Bot only responds when @mentioned');
  console.log('   - Creates thread on first mention');
  console.log('   - Continues conversation in thread without @ mentions');
  console.log('   - Threads auto-archive after 24 hours of inactivity');
  console.log('');

  const bot = new DiscordBotService(
    token,
    openaiApiKey,
    organizeFolderPath,
    geminiApiKey
  );

  // Handle shutdown gracefully
  process.on('SIGINT', async () => {
    console.log('\n📛 Received SIGINT, shutting down gracefully...');
    await bot.shutdown();
    process.exit(0);
  });

  process.on('SIGTERM', async () => {
    console.log('\n📛 Received SIGTERM, shutting down gracefully...');
    await bot.shutdown();
    process.exit(0);
  });
}

testDiscordBot().catch((error) => {
  console.error('❌ Fatal error:', error);
  process.exit(1);
});