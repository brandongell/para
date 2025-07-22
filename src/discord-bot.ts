import * as dotenv from 'dotenv';
import * as path from 'path';
import * as fs from 'fs';
import { DiscordBotService } from './services/discordBotService';

// Load environment variables
dotenv.config();

class DiscordBotRunner {
  private botService: DiscordBotService | null = null;

  async run(): Promise<void> {
    try {
      console.log('🚀 Starting Legal Document Discord Bot...');

      // Validate environment variables
      const token = this.getEnvVar('DISCORD_BOT_TOKEN');
      const openaiApiKey = this.getEnvVar('OPENAI_API_KEY');
      let organizeFolderPath = this.getEnvVar('ORGANIZE_FOLDER_PATH');
      const geminiApiKey = process.env.GEMINI_API_KEY; // Optional
      const documensoApiUrl = process.env.DOCUMENSO_API_URL; // Optional
      const documensoApiToken = process.env.DOCUMENSO_API_TOKEN; // Optional
      const documensoAppUrl = process.env.DOCUMENSO_APP_URL; // Optional

      // Ensure organize folder path is absolute
      if (!path.isAbsolute(organizeFolderPath)) {
        organizeFolderPath = path.resolve(organizeFolderPath);
        console.log(`📁 Resolved relative path to absolute: ${organizeFolderPath}`);
      }

      // Verify the folder exists
      if (!fs.existsSync(organizeFolderPath)) {
        console.error(`❌ Organization folder does not exist: ${organizeFolderPath}`);
        console.log(`🔨 Creating organization folder...`);
        fs.mkdirSync(organizeFolderPath, { recursive: true });
      }

      console.log(`📁 Organization folder: ${organizeFolderPath}`);
      if (geminiApiKey) {
        console.log('🔮 Gemini API key found - PDF extraction enabled');
      } else {
        console.log('⚠️  Gemini API key not found - PDF extraction will not work');
      }
      if (documensoApiUrl && documensoApiToken) {
        console.log('📄 Documenso API configured - template upload enabled');
        console.log(`   URL: ${documensoApiUrl}`);
      } else {
        console.log('⚠️  Documenso credentials not found - template upload features disabled');
      }

      // Initialize and start the bot
      this.botService = new DiscordBotService(
        token, 
        openaiApiKey, 
        organizeFolderPath, 
        geminiApiKey,
        documensoApiUrl,
        documensoApiToken,
        documensoAppUrl
      );

      // Set up graceful shutdown
      this.setupGracefulShutdown();

      console.log('✅ Discord bot initialized successfully!');
      console.log('🤖 Bot is now ready to receive messages and organize documents.');

    } catch (error) {
      console.error('💥 Failed to start Discord bot:', error);
      process.exit(1);
    }
  }

  private getEnvVar(name: string): string {
    const value = process.env[name];
    if (!value) {
      throw new Error(`Missing required environment variable: ${name}`);
    }
    return value;
  }

  private setupGracefulShutdown(): void {
    const shutdown = async () => {
      console.log('\n🛑 Received shutdown signal...');
      
      if (this.botService) {
        await this.botService.shutdown();
      }
      
      console.log('✅ Bot shutdown complete');
      process.exit(0);
    };

    process.on('SIGINT', shutdown);
    process.on('SIGTERM', shutdown);
    process.on('SIGQUIT', shutdown);

    // Handle uncaught errors
    process.on('uncaughtException', (error) => {
      console.error('💥 Uncaught Exception:', error);
      shutdown();
    });

    process.on('unhandledRejection', (reason, promise) => {
      console.error('💥 Unhandled Rejection at:', promise, 'reason:', reason);
      shutdown();
    });
  }
}

// Run the Discord bot
if (require.main === module) {
  const runner = new DiscordBotRunner();
  runner.run().catch((error) => {
    console.error('💥 Bot startup failed:', error);
    process.exit(1);
  });
}