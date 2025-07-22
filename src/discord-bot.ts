import * as dotenv from 'dotenv';
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
      const organizeFolderPath = this.getEnvVar('ORGANIZE_FOLDER_PATH');

      console.log(`📁 Organization folder: ${organizeFolderPath}`);

      // Initialize and start the bot
      this.botService = new DiscordBotService(token, openaiApiKey, organizeFolderPath);

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