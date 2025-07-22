import { Client, GatewayIntentBits, Message, Attachment, EmbedBuilder, TextBasedChannel } from 'discord.js';
import * as fs from 'fs';
import * as path from 'path';
import fetch from 'node-fetch';
import { DocumentClassifierService } from './documentClassifier';
import { FileOrganizerService } from './fileOrganizer';
import { MetadataService } from './metadataService';
import { NaturalLanguageProcessor } from './naturalLanguageProcessor';
import { ConversationManager } from './conversationManager';
import { SmartSearchService } from './smartSearchService';
import { BotIntent, BotResponse, SearchResult } from '../types';

export class DiscordBotService {
  private client: Client;
  private classifier: DocumentClassifierService;
  private organizer: FileOrganizerService;
  private metadataService: MetadataService;
  private nlp: NaturalLanguageProcessor;
  private conversationManager: ConversationManager;
  private searchService: SmartSearchService;
  private organizeFolderPath: string;
  private tempDir: string;

  constructor(
    token: string,
    openaiApiKey: string,
    organizeFolderPath: string,
    geminiApiKey?: string
  ) {
    this.client = new Client({
      intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.DirectMessages
      ]
    });

    this.organizeFolderPath = organizeFolderPath;
    this.tempDir = path.join(process.cwd(), 'temp');
    
    // Ensure temp directory exists
    if (!fs.existsSync(this.tempDir)) {
      fs.mkdirSync(this.tempDir, { recursive: true });
    }

    // Initialize services
    this.classifier = new DocumentClassifierService(openaiApiKey, geminiApiKey);
    this.organizer = new FileOrganizerService();
    this.metadataService = new MetadataService(openaiApiKey, geminiApiKey);
    this.nlp = new NaturalLanguageProcessor(openaiApiKey);
    this.conversationManager = new ConversationManager();
    this.searchService = new SmartSearchService(organizeFolderPath);

    // Set metadata service in organizer
    this.organizer.setMetadataService(this.metadataService);

    this.setupEventHandlers(token);
  }

  private setupEventHandlers(token: string): void {
    this.client.once('ready', () => {
      console.log(`🤖 Discord bot is ready! Logged in as ${this.client.user?.tag}`);
      console.log(`📁 Organizing documents to: ${this.organizeFolderPath}`);
    });

    this.client.on('messageCreate', async (message) => {
      await this.handleMessage(message);
    });

    this.client.login(token);
  }

  private async handleMessage(message: Message): Promise<void> {
    // Ignore bot messages
    if (message.author.bot) return;

    // Ignore empty messages without attachments
    if (!message.content.trim() && message.attachments.size === 0) return;

    const userId = message.author.id;
    const messageContent = message.content.trim();
    const hasAttachments = message.attachments.size > 0;

    try {
      // Show typing indicator
      if ('sendTyping' in message.channel) {
        await message.channel.sendTyping();
      }

      // Get conversation context
      const context = await this.conversationManager.getContext(userId);

      // Resolve contextual references if we have context
      let resolvedMessage = messageContent;
      let referencedItem = undefined;
      
      if (context && messageContent) {
        const resolution = await this.conversationManager.resolveContextualReferences(userId, messageContent);
        resolvedMessage = resolution.resolvedMessage;
        referencedItem = resolution.referencedItem;
      }

      // Process the message to determine intent
      const intent = await this.nlp.processMessage(resolvedMessage || messageContent, hasAttachments, context);
      
      console.log(`📨 Message from ${message.author.username}: "${messageContent}"`);
      console.log(`🎯 Detected intent: ${intent.type} (confidence: ${intent.confidence})`);

      let response: BotResponse;
      let results: any[] = [];

      // Handle different intents
      switch (intent.type) {
        case 'ORGANIZE_FILES':
          if (hasAttachments) {
            const organizationResults = await this.handleFileUploads(message.attachments, message);
            results = organizationResults;
            response = await this.nlp.generateResponse(intent, { results: organizationResults }, context);
          } else {
            response = {
              content: "I'd be happy to organize files for you! Please attach the documents you'd like me to organize.",
              followUpSuggestions: ["Upload a PDF contract", "Share multiple documents"]
            };
          }
          break;

        case 'SEARCH_DOCUMENTS':
          const searchResults = await this.searchService.searchByNaturalLanguage(intent);
          results = searchResults.slice(0, 10); // Limit to top 10 results
          response = await this.nlp.generateResponse(intent, { results: searchResults }, context);
          break;

        case 'GET_DOCUMENT_INFO':
          if (referencedItem) {
            // User is asking about a specific item from previous results
            response = await this.nlp.generateResponse(intent, { document: referencedItem }, context);
          } else if (intent.parameters.filename) {
            const document = await this.searchService.getDocumentByFilename(intent.parameters.filename);
            response = await this.nlp.generateResponse(intent, { document }, context);
          } else {
            response = {
              content: "I'd be happy to provide document information! Which document would you like to know about?",
              followUpSuggestions: ["Search for documents first", "Specify a document name"]
            };
          }
          break;

        case 'LIST_DOCUMENTS':
          const listResults = await this.searchService.searchByNaturalLanguage(intent);
          results = listResults;
          response = await this.nlp.generateResponse(intent, { results: listResults }, context);
          break;

        case 'GET_STATISTICS':
          const stats = await this.searchService.getDocumentStatistics();
          response = await this.nlp.generateResponse(intent, { stats }, context);
          break;

        case 'HELP':
          response = {
            content: `👋 Hi! I'm your legal document assistant. Here's what I can help you with:

📄 **File Organization**: Upload documents and I'll organize them automatically
🔍 **Document Search**: Ask me to find documents by type, signer, date, or content
📊 **Document Info**: Get detailed information about specific documents
📈 **Statistics**: View organization stats and summaries

**Example commands:**
• Upload a file and say "Can you organize this contract?"
• "Find all SAFE agreements that are executed"
• "Show me employment documents from 2023"
• "Tell me about the Bedrock SAFE agreement"
• "What are our document statistics?"

Just talk to me naturally - no special commands needed!`,
            followUpSuggestions: ["Upload a document", "Search for documents", "Get statistics"]
          };
          break;

        default:
          response = {
            content: "I'm not sure what you'd like me to do. Try uploading a document to organize, or ask me to search for specific documents!",
            followUpSuggestions: ["Upload a document", "Search for SAFE agreements", "Get help"]
          };
      }

      // Update conversation context
      await this.conversationManager.updateContext(userId, intent, resolvedMessage || messageContent, results);

      // Send response
      await this.sendResponse(message, response);

    } catch (error) {
      console.error('❌ Error handling message:', error);
      await message.reply('I encountered an error processing your request. Please try again!');
    }
  }

  private async handleFileUploads(attachments: Message['attachments'], message: Message): Promise<any[]> {
    const results: any[] = [];
    
    for (const [, attachment] of attachments) {
      try {
        console.log(`📄 Processing attachment: ${attachment.name}`);
        
        // Download the file
        const tempFilePath = await this.downloadAttachment(attachment);
        
        // Classify the document
        const classification = await this.classifier.classifyFile(tempFilePath);
        
        // Organize the file
        const organizationResult = await this.organizer.organizeFile(
          tempFilePath,
          classification,
          this.organizeFolderPath,
          true // Generate metadata
        );
        
        results.push({
          filename: attachment.name,
          classification,
          organizationResult,
          success: organizationResult.success
        });
        
        // Send intermediate progress update for multiple files
        if (attachments.size > 1) {
          const embed = new EmbedBuilder()
            .setColor(organizationResult.success ? 0x00ff00 : 0xff0000)
            .setTitle(organizationResult.success ? '✅ File Organized' : '❌ Organization Failed')
            .setDescription(`**${attachment.name}**`)
            .addFields(
              { name: 'Location', value: organizationResult.success ? 
                `${classification.primaryFolder}/${classification.subfolder}` : 'Failed to organize', inline: true },
              { name: 'Confidence', value: `${Math.round(classification.confidence * 100)}%`, inline: true }
            );
            
          if ('send' in message.channel) {
            await message.channel.send({ embeds: [embed] });
          }
        }
        
        // Clean up temp file
        fs.unlinkSync(tempFilePath);
        
      } catch (error) {
        console.error(`❌ Error processing ${attachment.name}:`, error);
        results.push({
          filename: attachment.name,
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    }
    
    return results;
  }

  private async downloadAttachment(attachment: Attachment): Promise<string> {
    const response = await fetch(attachment.url);
    if (!response.ok) {
      throw new Error(`Failed to download ${attachment.name}: ${response.statusText}`);
    }
    
    const buffer = await response.buffer();
    const tempFilePath = path.join(this.tempDir, `${Date.now()}_${attachment.name}`);
    
    fs.writeFileSync(tempFilePath, buffer);
    return tempFilePath;
  }

  private async sendResponse(message: Message, response: BotResponse): Promise<void> {
    // Split long messages if needed
    const maxLength = 2000;
    
    if (response.content.length <= maxLength) {
      await message.reply(response.content);
    } else {
      // Split the message
      const chunks = this.splitMessage(response.content, maxLength);
      for (let i = 0; i < chunks.length; i++) {
        if (i === 0) {
          await message.reply(chunks[i]);
        } else {
          if ('send' in message.channel) {
            await message.channel.send(chunks[i]);
          }
        }
      }
    }
    
    // Send follow-up suggestions if any
    if (response.followUpSuggestions && response.followUpSuggestions.length > 0) {
      const suggestionsText = "💡 **Suggestions:**\n" + 
        response.followUpSuggestions.map(s => `• ${s}`).join('\n');
      
      if (suggestionsText.length <= maxLength && 'send' in message.channel) {
        await message.channel.send(suggestionsText);
      }
    }
  }

  private splitMessage(content: string, maxLength: number): string[] {
    const chunks: string[] = [];
    let currentChunk = '';
    
    const lines = content.split('\n');
    
    for (const line of lines) {
      if (currentChunk.length + line.length + 1 <= maxLength) {
        currentChunk += (currentChunk ? '\n' : '') + line;
      } else {
        if (currentChunk) {
          chunks.push(currentChunk);
          currentChunk = line;
        } else {
          // Line is too long, split it
          chunks.push(line.substring(0, maxLength));
          currentChunk = line.substring(maxLength);
        }
      }
    }
    
    if (currentChunk) {
      chunks.push(currentChunk);
    }
    
    return chunks;
  }

  async shutdown(): Promise<void> {
    console.log('🛑 Shutting down Discord bot...');
    await this.client.destroy();
    
    // Clean up temp directory
    if (fs.existsSync(this.tempDir)) {
      const files = fs.readdirSync(this.tempDir);
      for (const file of files) {
        fs.unlinkSync(path.join(this.tempDir, file));
      }
    }
  }

  // Utility methods for monitoring
  getActiveConversations(): number {
    return this.conversationManager.getActiveContextCount();
  }

  getActiveUsers(): string[] {
    return this.conversationManager.getActiveUsers();
  }
}