import { ConversationContext, BotIntent } from '../types';

export class ConversationManager {
  private contexts: Map<string, ConversationContext> = new Map();
  private readonly CONTEXT_TIMEOUT = 30 * 60 * 1000; // 30 minutes

  constructor() {
    // Clean up old contexts every 10 minutes
    setInterval(() => {
      this.cleanupOldContexts();
    }, 10 * 60 * 1000);
  }

  async getContext(userId: string): Promise<ConversationContext | undefined> {
    const context = this.contexts.get(userId);
    
    if (context) {
      // Check if context is still valid
      const now = new Date();
      const timeDiff = now.getTime() - context.updated.getTime();
      
      if (timeDiff > this.CONTEXT_TIMEOUT) {
        // Context is too old, remove it
        this.contexts.delete(userId);
        return undefined;
      }
      
      return context;
    }
    
    return undefined;
  }

  async updateContext(
    userId: string, 
    intent: BotIntent, 
    query?: string, 
    results?: any[]
  ): Promise<ConversationContext> {
    const now = new Date();
    const existingContext = await this.getContext(userId);
    
    const context: ConversationContext = {
      userId: userId,
      lastIntent: intent,
      lastQuery: query,
      lastResults: results,
      awaitingFollowUp: this.shouldAwaitFollowUp(intent, results),
      created: existingContext?.created || now,
      updated: now
    };
    
    this.contexts.set(userId, context);
    return context;
  }

  async clearContext(userId: string): Promise<void> {
    this.contexts.delete(userId);
  }

  async isAwaitingFollowUp(userId: string): Promise<boolean> {
    const context = await this.getContext(userId);
    return context?.awaitingFollowUp || false;
  }

  async getLastResults(userId: string): Promise<any[] | undefined> {
    const context = await this.getContext(userId);
    return context?.lastResults;
  }

  async getLastQuery(userId: string): Promise<string | undefined> {
    const context = await this.getContext(userId);
    return context?.lastQuery;
  }

  async resolveContextualReferences(
    userId: string, 
    message: string
  ): Promise<{ resolvedMessage: string; referencedItem?: any }> {
    const context = await this.getContext(userId);
    
    if (!context || !context.lastResults || context.lastResults.length === 0) {
      return { resolvedMessage: message };
    }
    
    // Check for ordinal references (first, second, etc.)
    const ordinalMatch = message.match(/\b(first|second|third|fourth|fifth|1st|2nd|3rd|4th|5th)\b/i);
    if (ordinalMatch) {
      const ordinal = ordinalMatch[1].toLowerCase();
      let index = -1;
      
      switch (ordinal) {
        case 'first': case '1st': index = 0; break;
        case 'second': case '2nd': index = 1; break;
        case 'third': case '3rd': index = 2; break;
        case 'fourth': case '4th': index = 3; break;
        case 'fifth': case '5th': index = 4; break;
      }
      
      if (index >= 0 && index < context.lastResults.length) {
        const referencedItem = context.lastResults[index];
        const itemName = referencedItem.filename || referencedItem.name || `item ${index + 1}`;
        const resolvedMessage = message.replace(
          /\b(the\s+)?(first|second|third|fourth|fifth|1st|2nd|3rd|4th|5th)(\s+one)?\b/i,
          itemName
        );
        
        return { resolvedMessage, referencedItem };
      }
    }
    
    // Check for demonstrative references (that, this, it)
    const demonstrativeMatch = message.match(/\b(that|this|it)\b/i);
    if (demonstrativeMatch && context.lastResults.length === 1) {
      // If there's only one result, "that" likely refers to it
      const referencedItem = context.lastResults[0];
      const itemName = referencedItem.filename || referencedItem.name || 'that document';
      const resolvedMessage = message.replace(/\b(that|this|it)\b/i, itemName);
      
      return { resolvedMessage, referencedItem };
    }
    
    // Check for "the [type]" references when context has specific types
    const typeMatch = message.match(/\bthe\s+(\w+(?:\s+\w+)?)\b/i);
    if (typeMatch) {
      const type = typeMatch[1].toLowerCase();
      const matchingResult = context.lastResults.find(result => {
        const filename = (result.filename || '').toLowerCase();
        const docType = (result.metadata?.document_type || '').toLowerCase();
        return filename.includes(type) || docType.includes(type);
      });
      
      if (matchingResult) {
        const itemName = matchingResult.filename || matchingResult.name;
        const resolvedMessage = message.replace(/\bthe\s+\w+(?:\s+\w+)?\b/i, itemName);
        
        return { resolvedMessage, referencedItem: matchingResult };
      }
    }
    
    return { resolvedMessage: message };
  }

  private shouldAwaitFollowUp(intent: BotIntent, results?: any[]): boolean {
    // We should await follow-up for search results or list results
    // that might warrant additional questions
    if (intent.type === 'SEARCH_DOCUMENTS' && results && results.length > 0) {
      return true;
    }
    
    if (intent.type === 'LIST_DOCUMENTS' && results && results.length > 0) {
      return true;
    }
    
    if (intent.type === 'GET_STATISTICS') {
      return true;
    }
    
    return false;
  }

  private cleanupOldContexts(): void {
    const now = new Date();
    const expiredUserIds: string[] = [];
    
    for (const [userId, context] of this.contexts.entries()) {
      const timeDiff = now.getTime() - context.updated.getTime();
      if (timeDiff > this.CONTEXT_TIMEOUT) {
        expiredUserIds.push(userId);
      }
    }
    
    for (const userId of expiredUserIds) {
      this.contexts.delete(userId);
    }
    
    if (expiredUserIds.length > 0) {
      console.log(`🧹 Cleaned up ${expiredUserIds.length} expired conversation contexts`);
    }
  }

  // Utility method to get conversation statistics
  getActiveContextCount(): number {
    return this.contexts.size;
  }

  // Method to get all active user IDs (for admin purposes)
  getActiveUsers(): string[] {
    return Array.from(this.contexts.keys());
  }
}