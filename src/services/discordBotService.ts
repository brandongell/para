import { Client, GatewayIntentBits, Message, Attachment, EmbedBuilder, TextBasedChannel, ThreadChannel, ChannelType, ThreadAutoArchiveDuration } from 'discord.js';
import * as fs from 'fs';
import * as path from 'path';
import fetch from 'node-fetch';
import { DocumentClassifierService } from './documentClassifier';
import { FileOrganizerService } from './fileOrganizer';
import { MetadataService } from './metadataService';
import { MemoryService } from './memoryService';
import { NaturalLanguageProcessor } from './naturalLanguageProcessor';
import { ConversationManager } from './conversationManager';
import { EnhancedSmartSearchService } from './enhancedSmartSearchService';
import { UnifiedSearchResult } from '../types/searchTypes';
// import { TemplateManagementService } from './templateManagementService';
import { BotIntent, BotResponse, SearchResult } from '../types';

export class DiscordBotService {
  private client: Client;
  private classifier: DocumentClassifierService;
  private organizer: FileOrganizerService;
  private metadataService: MetadataService;
  private memoryService: MemoryService;
  private nlp: NaturalLanguageProcessor;
  private conversationManager: ConversationManager;
  private searchService: EnhancedSmartSearchService;
  // private templateService: TemplateManagementService | null = null;
  private organizeFolderPath: string;
  private tempDir: string;
  private activeThreads: Set<string> = new Set();

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
    this.memoryService = new MemoryService(organizeFolderPath);
    this.nlp = new NaturalLanguageProcessor(openaiApiKey);
    this.conversationManager = new ConversationManager();
    this.searchService = new EnhancedSmartSearchService(organizeFolderPath, openaiApiKey, geminiApiKey);

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

    // Check if message is in a thread
    const isInThread = message.channel.isThread();
    const isActiveThread = isInThread && this.activeThreads.has(message.channel.id);
    
    // Check if bot should respond to this message
    const isDM = message.channel.type === ChannelType.DM;
    const isMentioned = message.mentions.has(this.client.user!);
    const hasAttachments = message.attachments.size > 0;

    console.log(`🧵 Thread status - In thread: ${isInThread}, Active thread: ${isActiveThread}`);

    // Only respond if:
    // 1. It's a DM, OR
    // 2. Bot is mentioned (will create thread), OR  
    // 3. Message is in an active thread
    if (!isDM && !isMentioned && !isActiveThread) {
      console.log(`⏭️ Ignoring message - not mentioned, not DM, not in active thread`);
      return;
    }

    // Ignore empty messages without attachments
    if (!message.content.trim() && message.attachments.size === 0) {
      console.log(`⏭️ Ignoring empty message without attachments`);
      return;
    }

    console.log(`✅ Processing message - DM: ${isDM}, Mentioned: ${isMentioned}, Active thread: ${isActiveThread}, Attachments: ${hasAttachments}`);

    // Use thread ID for context if in thread, otherwise use user ID
    const contextId = isInThread ? message.channel.id : message.author.id;
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
      const context = await this.conversationManager.getContext(contextId);

      // Resolve contextual references if we have context
      let resolvedMessage = messageContent;
      let referencedItem = undefined;
      
      if (context && messageContent) {
        const resolution = await this.conversationManager.resolveContextualReferences(contextId, messageContent);
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
          const searchResult = await this.searchService.search(intent.parameters.query || messageContent, {
            expandSynonyms: true,
            fuzzyMatchThreshold: 0.6,
            maxResults: 10,
            useCache: true
          });
          
          // Convert enhanced results to format expected by NLP
          const formattedResults = this.formatSearchResultsForResponse(searchResult);
          results = formattedResults;
          
          // If AI provided an answer, include it in the response
          if (searchResult.answer) {
            // Format AI answer with sources
            const aiAnswerText = this.formatAIAnswerForDiscord(searchResult.answer);
            
            // Get regular search response
            const searchResponse = await this.nlp.generateResponse(intent, { 
              results: formattedResults,
              searchPath: searchResult.searchPath
            }, context);
            
            // Combine AI answer with search results
            response = {
              content: aiAnswerText + '\n\n' + searchResponse.content,
              followUpSuggestions: searchResponse.followUpSuggestions
            };
          } else {
            response = await this.nlp.generateResponse(intent, { results: formattedResults }, context);
          }
          break;

        case 'REQUEST_TEMPLATE':
          // For template requests, search with status:template filter
          const templateQuery = `status:template ${intent.parameters.query || ''}`.trim();
          const templateResult = await this.searchService.search(templateQuery, {
            expandSynonyms: true,
            fuzzyMatchThreshold: 0.7,
            maxResults: 10,
            forceSearchPath: 'fast' // Templates are usually simple searches
          });
          
          const formattedTemplateResults = this.formatSearchResultsForResponse(templateResult);
          results = formattedTemplateResults;
          response = await this.nlp.generateResponse(intent, { results: formattedTemplateResults }, context);
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
          const listQuery = intent.parameters.query || 'list all documents';
          const listResult = await this.searchService.search(listQuery, {
            expandSynonyms: true,
            maxResults: 20,
            forceSearchPath: 'fast', // Listing is usually a fast operation
            useCache: true
          });
          
          const formattedListResults = this.formatSearchResultsForResponse(listResult);
          results = formattedListResults;
          response = await this.nlp.generateResponse(intent, { results: formattedListResults }, context);
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
      await this.conversationManager.updateContext(contextId, intent, resolvedMessage || messageContent, results);

      // Handle thread creation and response
      if (isMentioned && !isDM && !isInThread) {
        // Create a thread when mentioned in a channel
        await this.createThreadAndRespond(message, response, intent);
      } else {
        // Send response normally (in DM, existing thread, or if already in thread)
        await this.sendResponse(message, response);
      }

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
          
          // Update memory with the new document
          if (metadataExists && organizationResult.metadataPath) {
            console.log(`\n🧠 Updating memory with new document...`);
            try {
              // Read the metadata file
              const metadataContent = fs.readFileSync(organizationResult.metadataPath, 'utf-8');
              const metadata = JSON.parse(metadataContent);
              
              // Update memory
              await this.memoryService.updateMemoryForDocument(organizationResult.newPath, metadata);
              console.log(`✅ Memory updated successfully`);
            } catch (memoryError) {
              console.error(`❌ Failed to update memory:`, memoryError);
              console.error(`   Document: ${organizationResult.newPath}`);
              console.error(`   Metadata path: ${organizationResult.metadataPath}`);
            }
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
            
          // Send to thread if in thread, otherwise to channel
          const targetChannel = message.channel.isThread() ? message.channel : message.channel;
          if ('send' in targetChannel) {
            await targetChannel.send({ embeds: [embed] });
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
    // Use original filename to preserve template indicators like [BLANK]
    // Add timestamp as subdirectory to avoid conflicts
    const tempSubDir = path.join(this.tempDir, `discord_${Date.now()}`);
    fs.mkdirSync(tempSubDir, { recursive: true });
    const tempFilePath = path.join(tempSubDir, attachment.name);
    
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

  private async createThreadAndRespond(message: Message, response: BotResponse, intent: BotIntent): Promise<void> {
    try {
      // Generate thread name based on intent
      let threadName = `${message.author.username} - `;
      switch (intent.type) {
        case 'ORGANIZE_FILES':
          threadName += 'File Organization';
          break;
        case 'SEARCH_DOCUMENTS':
          threadName += 'Document Search';
          break;
        case 'REQUEST_TEMPLATE':
          threadName += 'Template Request';
          break;
        case 'GET_DOCUMENT_INFO':
          threadName += 'Document Info';
          break;
        case 'LIST_DOCUMENTS':
          threadName += 'Document List';
          break;
        case 'GET_STATISTICS':
          threadName += 'Statistics';
          break;
        case 'UPLOAD_TO_DOCUMENSO':
          threadName += 'Documenso Upload';
          break;
        case 'HELP':
          threadName += 'Help';
          break;
        default:
          threadName += 'Discussion';
      }

      // Limit thread name length (100 character max)
      if (threadName.length > 100) {
        threadName = threadName.substring(0, 97) + '...';
      }

      console.log(`🧵 Creating thread: ${threadName}`);

      // Create thread from the user's message
      const thread = await message.startThread({
        name: threadName,
        autoArchiveDuration: ThreadAutoArchiveDuration.OneDay,
        reason: 'Bot was mentioned - starting conversation thread'
      });

      // Add thread to active threads
      this.activeThreads.add(thread.id);
      console.log(`✅ Thread created: ${thread.name} (ID: ${thread.id})`);

      // Send response in the thread
      await this.sendResponseToThread(thread, response);

      // Update conversation context to use thread ID
      await this.conversationManager.updateContext(thread.id, intent, message.content, []);

    } catch (error) {
      console.error('❌ Error creating thread:', error);
      // Fallback to regular reply if thread creation fails
      await this.sendResponse(message, response);
    }
  }

  private async sendResponseToThread(thread: ThreadChannel, response: BotResponse): Promise<void> {
    // Show typing indicator in thread
    await thread.sendTyping();

    // Split long messages if needed
    const maxLength = 2000;
    
    if (response.content.length <= maxLength) {
      await thread.send(response.content);
    } else {
      // Split the message
      const chunks = this.splitMessage(response.content, maxLength);
      for (const chunk of chunks) {
        await thread.send(chunk);
      }
    }
    
    // Send follow-up suggestions if any
    if (response.followUpSuggestions && response.followUpSuggestions.length > 0) {
      const suggestionsText = "💡 **Suggestions:**\n" + 
        response.followUpSuggestions.map(s => `• ${s}`).join('\n');
      
      if (suggestionsText.length <= maxLength) {
        await thread.send(suggestionsText);
      }
    }
  }

  /**
   * Format enhanced search results for Discord response
   */
  private formatSearchResultsForResponse(searchResult: UnifiedSearchResult): any[] {
    const formattedResults: any[] = [];
    
    // Add documents as results
    for (const doc of searchResult.documents) {
      formattedResults.push({
        filename: doc.filename,
        path: doc.path,
        relevance: doc.relevance,
        matchType: doc.matchType,
        matchReason: doc.matchDetails.reason,
        metadata: doc.metadata,
        // Include source attribution if available
        source: searchResult.searchPath === 'ai' ? 'AI Search' : 'Document Search'
      });
    }
    
    // Add memory results if available
    if (searchResult.memoryResults) {
      for (const memResult of searchResult.memoryResults) {
        formattedResults.push({
          type: 'memory',
          source: memResult.source,
          section: memResult.section,
          content: memResult.content,
          relevance: memResult.relevance
        });
      }
    }
    
    return formattedResults;
  }

  /**
   * Format AI answer with source attribution for Discord
   */
  private formatAIAnswerForDiscord(answer: UnifiedSearchResult['answer']): string {
    if (!answer) return '';
    
    let formatted = `**Answer:** ${answer.text}\n\n`;
    
    if (answer.sources && answer.sources.length > 0) {
      formatted += '**Sources:**\n';
      for (const source of answer.sources) {
        formatted += `📄 \`${source.memoryFile}\` → ${source.section}\n`;
        if (source.originalDocument !== 'not specified') {
          formatted += `   • Source: ${path.basename(source.originalDocument)}\n`;
        }
        if (source.excerpt) {
          formatted += `   • "${source.excerpt.substring(0, 100)}..."\n`;
        }
      }
      formatted += '\n';
    }
    
    formatted += `*Confidence: ${Math.round(answer.confidence * 100)}%*`;
    
    return formatted;
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