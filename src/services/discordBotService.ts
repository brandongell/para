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
// import { TemplateManagementService } from './templateManagementService';
import { BotIntent, BotResponse, SearchResult } from '../types';

export class DiscordBotService {
  private client: Client;
  private classifier: DocumentClassifierService;
  private organizer: FileOrganizerService;
  private metadataService: MetadataService;
  private nlp: NaturalLanguageProcessor;
  private conversationManager: ConversationManager;
  private searchService: SmartSearchService;
  // private templateService: TemplateManagementService | null = null;
  private organizeFolderPath: string;
  private tempDir: string;

  constructor(
    token: string,
    openaiApiKey: string,
    organizeFolderPath: string,
    geminiApiKey?: string,
    documensoApiUrl?: string,
    documensoApiToken?: string,
    documensoAppUrl?: string
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

    // Initialize template service if Documenso credentials provided
    // if (documensoApiUrl && documensoApiToken) {
    //   this.templateService = new TemplateManagementService(
    //     organizeFolderPath,
    //     this.metadataService,
    //     this.searchService,
    //     documensoApiUrl,
    //     documensoApiToken,
    //     documensoAppUrl
    //   );
    //   console.log('📄 Documenso template integration enabled');
    // } else {
    //   console.log('⚠️  Documenso credentials not provided - template upload features disabled');
    // }

    this.setupEventHandlers(token);
  }

  private setupEventHandlers(token: string): void {
    this.client.once('ready', () => {
      console.log(`🤖 Discord bot is ready! Logged in as ${this.client.user?.tag}`);
      console.log(`📁 Organizing documents to: ${this.organizeFolderPath}`);
      console.log(`🏠 Connected to ${this.client.guilds.cache.size} servers`);
      this.client.guilds.cache.forEach(guild => {
        console.log(`  📍 Server: ${guild.name} (${guild.memberCount} members)`);
      });
    });

    this.client.on('messageCreate', async (message) => {
      console.log(`📥 Raw message event triggered`);
      await this.handleMessage(message);
    });

    this.client.on('error', (error) => {
      console.error('🚨 Discord client error:', error);
    });

    this.client.on('warn', (warning) => {
      console.warn('⚠️ Discord client warning:', warning);
    });

    console.log('🔐 Logging into Discord...');
    this.client.login(token);
  }

  private async handleMessage(message: Message): Promise<void> {
    console.log(`🔔 Message received from ${message.author.username} (bot: ${message.author.bot})`);
    console.log(`📝 Message content: "${message.content}"`);
    console.log(`📎 Attachments: ${message.attachments.size}`);
    console.log(`📍 Channel type: ${message.channel.type}`);
    
    // Ignore bot messages
    if (message.author.bot) {
      console.log(`🤖 Ignoring bot message from ${message.author.username}`);
      return;
    }

    // Check if bot should respond to this message
    const isDM = message.channel.type === 1; // DM channel
    const isMentioned = message.mentions.has(this.client.user!);
    const hasAttachments = message.attachments.size > 0;

    // Only respond if:
    // 1. It's a DM, OR
    // 2. Bot is mentioned, OR  
    // 3. Message has attachments (for file organization)
    if (!isDM && !isMentioned && !hasAttachments) {
      console.log(`⏭️ Ignoring message - not mentioned, not DM, no attachments`);
      return;
    }

    // Ignore empty messages without attachments
    if (!message.content.trim() && message.attachments.size === 0) {
      console.log(`⏭️ Ignoring empty message without attachments`);
      return;
    }

    console.log(`✅ Processing message - DM: ${isDM}, Mentioned: ${isMentioned}, Attachments: ${hasAttachments}`);

    const userId = message.author.id;
    let messageContent = message.content.trim();
    
    // Remove mention from message content for better NLP processing
    if (isMentioned) {
      messageContent = messageContent.replace(/<@!?\d+>/g, '').trim();
    }

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

        case 'REQUEST_TEMPLATE':
          // For template requests, search specifically for templates
          const templateIntent = {
            ...intent,
            type: 'SEARCH_DOCUMENTS' as const,
            parameters: {
              ...intent.parameters,
              status: 'template'
            }
          };
          const templateResults = await this.searchService.searchByNaturalLanguage(templateIntent);
          results = templateResults.slice(0, 10);
          response = await this.nlp.generateResponse(intent, { results: templateResults }, context);
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

        case 'UPLOAD_TO_DOCUMENSO':
          // if (!this.templateService) {
            response = {
              content: "⚠️ Documenso integration is temporarily disabled for debugging.",
              followUpSuggestions: ["Search for templates", "Get help"]
            };
          // }
          break;

        case 'HELP':
          response = {
            content: `👋 Hi! I'm your legal document assistant. Here's what I can help you with:

📄 **File Organization**: Upload documents and I'll organize them automatically
🔍 **Document Search**: Ask me to find documents by type, signer, date, or content
📝 **Template Requests**: Get blank templates for various document types
📊 **Document Info**: Get detailed information about specific documents
📈 **Statistics**: View organization stats and summaries
🔗 **Documenso Integration**: Upload templates to Documenso for e-signatures

**Example commands:**
• Upload a file and say "Can you organize this contract?"
• "Find all SAFE agreements that are executed"
• "I need an employment agreement template"
• "Show me all available templates"
• "Get me a blank NDA"
• "Show me employment documents from 2023"
• "Tell me about the Bedrock SAFE agreement"
• "What are our document statistics?"
• "Upload this template to Documenso"
• "Show templates not in Documenso"
• "Upload employment agreement template to Documenso"

Just talk to me naturally - no special commands needed!`,
            followUpSuggestions: ["Upload a document", "Search for templates", "Get statistics"]
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
    
    console.log(`\n${'='.repeat(60)}`);
    console.log(`📎 Processing ${attachments.size} attachment(s)`);
    console.log(`📁 Target organize folder: ${this.organizeFolderPath}`);
    console.log(`${'='.repeat(60)}\n`);
    
    for (const [, attachment] of attachments) {
      let tempFilePath: string | undefined;
      
      try {
        console.log(`\n--- Processing: ${attachment.name} ---`);
        console.log(`📄 Original filename: ${attachment.name}`);
        console.log(`📏 Size: ${attachment.size} bytes`);
        
        // Download the file
        tempFilePath = await this.downloadAttachment(attachment);
        console.log(`💾 Downloaded to temp: ${tempFilePath}`);
        console.log(`📝 Temp filename: ${path.basename(tempFilePath)}`);
        
        // Verify temp file exists
        if (!fs.existsSync(tempFilePath)) {
          throw new Error(`Temp file does not exist after download: ${tempFilePath}`);
        }
        console.log(`✅ Temp file verified to exist`);
        
        // Classify the document
        console.log(`\n🤔 Starting classification...`);
        const classification = await this.classifier.classifyFile(tempFilePath);
        console.log(`📊 Classification result:`);
        console.log(`   - Primary: ${classification.primaryFolder}`);
        console.log(`   - Subfolder: ${classification.subfolder}`);
        console.log(`   - Confidence: ${classification.confidence}`);
        console.log(`   - Reasoning: ${classification.reasoning}`);
        
        // Organize the file
        console.log(`\n📦 Starting organization...`);
        const organizationResult = await this.organizer.organizeFile(
          tempFilePath,
          classification,
          this.organizeFolderPath,
          true // Generate metadata
        );
        
        console.log(`📋 Organization result:`);
        console.log(`   - Success: ${organizationResult.success}`);
        console.log(`   - Original: ${organizationResult.originalPath}`);
        console.log(`   - New path: ${organizationResult.newPath}`);
        console.log(`   - Metadata: ${organizationResult.metadataPath}`);
        
        // Verify files were actually moved
        if (organizationResult.success && organizationResult.newPath) {
          const fileExists = fs.existsSync(organizationResult.newPath);
          const metadataExists = organizationResult.metadataPath ? fs.existsSync(organizationResult.metadataPath) : false;
          
          console.log(`\n🔍 Verification:`);
          console.log(`   - File exists at new location: ${fileExists ? '✅' : '❌'}`);
          console.log(`   - Metadata exists: ${metadataExists ? '✅' : '❌'}`);
          
          if (!fileExists) {
            console.error(`❌ ERROR: File not found at expected location: ${organizationResult.newPath}`);
          }
        }
        
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
        try {
          if (fs.existsSync(tempFilePath)) {
            fs.unlinkSync(tempFilePath);
            console.log(`🗑️  Cleaned up temp file`);
          }
        } catch (cleanupError) {
          console.warn(`⚠️  Failed to clean up temp file:`, cleanupError);
        }
        
        console.log(`\n✅ Completed processing: ${attachment.name}`);
        console.log(`${'─'.repeat(40)}\n`);
        
      } catch (error) {
        console.error(`\n❌ Error processing ${attachment.name}:`, error);
        
        // Clean error message for user
        let errorMessage = error instanceof Error ? error.message : 'Unknown error';
        
        // Don't show confusing ENOENT errors about temp files
        if (errorMessage.includes('ENOENT') && errorMessage.includes('temp/')) {
          errorMessage = 'File processing error occurred';
        }
        
        results.push({
          filename: attachment.name,
          success: false,
          error: errorMessage
        });
        
        // Try to clean up temp file on error
        try {
          if (tempFilePath && fs.existsSync(tempFilePath)) {
            fs.unlinkSync(tempFilePath);
          }
        } catch (cleanupError) {
          console.warn(`⚠️  Failed to clean up temp file after error:`, cleanupError);
        }
        
        console.log(`${'─'.repeat(40)}\n`);
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