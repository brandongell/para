/**
 * AI Search Service
 * Handles complex queries using GPT-4o with full source attribution
 */

import { OpenAIService } from './openai';
import { DocumentMetadata } from '../types';
import * as fs from 'fs';
import * as path from 'path';

export interface SourceAttribution {
  memoryFile: string;
  section: string;
  originalDocument: string;
  excerpt: string;
  confidence: number;
}

export interface AISearchResult {
  answer: string;
  sources: SourceAttribution[];
  relatedDocuments: {
    path: string;
    relevance: number;
    reason: string;
  }[];
  confidence: number;
  searchType: 'ai';
}

export interface AISearchOptions {
  includeMetadata?: boolean;
  maxMetadataFiles?: number;
  contextWindow?: number;
}

export class AISearchService {
  private openAIService: OpenAIService;
  private memoryCache: Map<string, string> = new Map();
  private memoryDir: string;

  constructor(openAIApiKey: string, memoryDir: string) {
    this.openAIService = new OpenAIService(openAIApiKey);
    this.memoryDir = memoryDir;
  }

  /**
   * Perform AI-powered search with source attribution
   */
  async searchWithAI(
    query: string,
    options: AISearchOptions = {}
  ): Promise<AISearchResult> {
    const opts = {
      includeMetadata: true,
      maxMetadataFiles: 10,
      contextWindow: 100000, // Leave room for response
      ...options
    };

    try {
      // 1. Load all memory files
      const memoryContext = await this.loadAllMemoryFiles();
      
      // 2. Get relevant metadata if requested
      let metadataContext = '';
      if (opts.includeMetadata) {
        const metadata = await this.getRelevantMetadata(query, opts.maxMetadataFiles);
        metadataContext = this.formatMetadataForPrompt(metadata);
      }

      // 3. Create the prompt with strict source attribution requirements
      const prompt = this.createSearchPrompt(query, memoryContext, metadataContext);

      // 4. Get AI response
      const response = await this.openAIService.generateText(prompt);

      // 5. Parse the response to extract structured data
      const parsedResult = this.parseAIResponse(response);

      return parsedResult;
    } catch (error) {
      console.error('AI search error:', error);
      throw new Error(`AI search failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Load all memory files from the memory directory
   */
  private async loadAllMemoryFiles(): Promise<string> {
    let combinedMemory = '';
    
    try {
      const files = fs.readdirSync(this.memoryDir);
      const memoryFiles = files.filter(f => f.endsWith('.md'));

      for (const file of memoryFiles) {
        const filePath = path.join(this.memoryDir, file);
        
        // Check cache first
        if (this.memoryCache.has(file)) {
          combinedMemory += `\n\n=== ${file} ===\n${this.memoryCache.get(file)}`;
          continue;
        }

        // Read and cache file
        const content = fs.readFileSync(filePath, 'utf-8');
        this.memoryCache.set(file, content);
        combinedMemory += `\n\n=== ${file} ===\n${content}`;
      }

      return combinedMemory;
    } catch (error) {
      console.error('Error loading memory files:', error);
      return '';
    }
  }

  /**
   * Get relevant metadata files based on initial query analysis
   */
  private async getRelevantMetadata(
    query: string,
    maxFiles: number
  ): Promise<DocumentMetadata[]> {
    // This is a simplified version - in production, you'd want to:
    // 1. Use the fast matcher to find potentially relevant documents
    // 2. Load their metadata files
    // 3. Return the most relevant ones
    
    // For now, return empty array
    return [];
  }

  /**
   * Format metadata for inclusion in prompt
   */
  private formatMetadataForPrompt(metadata: DocumentMetadata[]): string {
    if (metadata.length === 0) return '';

    return '\n\nRelevant Document Metadata:\n' + 
      metadata.map(m => JSON.stringify(m, null, 2)).join('\n---\n');
  }

  /**
   * Create the search prompt with strict instructions
   */
  private createSearchPrompt(
    query: string,
    memoryContext: string,
    metadataContext: string
  ): string {
    return `You are a legal document search assistant with access to comprehensive memory files containing aggregated information from legal documents.

USER QUERY: "${query}"

MEMORY FILES:
${memoryContext}

${metadataContext}

INSTRUCTIONS:
1. Answer the user's query using ONLY information from the provided memory files and metadata.
2. For EVERY fact or piece of information you provide, you MUST include:
   - The exact memory file name (e.g., "financial_summary.md")
   - The section or heading where you found it
   - The original document reference if provided in the memory file (look for "Source:" lines)
   - A brief excerpt showing the exact text you're referencing

3. If you cannot find information to answer the query, respond with "I cannot find information about [topic] in the available documents."

4. Structure your response as JSON with this format:
{
  "answer": "Your natural language answer here",
  "sources": [
    {
      "fact": "The specific fact or claim",
      "memoryFile": "filename.md",
      "section": "Section Name",
      "originalDocument": "path/to/original.pdf",
      "excerpt": "The exact text from the memory file",
      "confidence": 0.95
    }
  ],
  "relatedDocuments": [
    {
      "path": "path/to/document.pdf",
      "relevance": 0.8,
      "reason": "Why this document is related"
    }
  ],
  "confidence": 0.9
}

5. Set confidence scores based on:
   - 1.0: Exact match with clear source
   - 0.8-0.9: Strong match with clear context
   - 0.6-0.7: Partial match or inferred
   - Below 0.6: Uncertain

Remember: EVERY fact must have a source. No unsourced claims.`;
  }

  /**
   * Parse AI response to extract structured data
   */
  private parseAIResponse(response: string): AISearchResult {
    try {
      // Try to parse as JSON first
      const jsonMatch = response.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        
        // Validate and clean sources
        const sources: SourceAttribution[] = (parsed.sources || []).map((s: any) => ({
          memoryFile: s.memoryFile || 'unknown',
          section: s.section || 'unknown',
          originalDocument: s.originalDocument || 'not specified',
          excerpt: s.excerpt || s.fact || '',
          confidence: s.confidence || 0.5
        }));

        // Validate related documents
        const relatedDocuments = (parsed.relatedDocuments || []).map((d: any) => ({
          path: d.path || '',
          relevance: d.relevance || 0.5,
          reason: d.reason || 'Related to query'
        }));

        return {
          answer: parsed.answer || 'No answer provided',
          sources,
          relatedDocuments,
          confidence: parsed.confidence || 0.5,
          searchType: 'ai'
        };
      }
    } catch (error) {
      console.error('Failed to parse AI response as JSON:', error);
    }

    // Fallback: Extract what we can from plain text
    return {
      answer: response,
      sources: [],
      relatedDocuments: [],
      confidence: 0.3,
      searchType: 'ai'
    };
  }

  /**
   * Clear memory cache (useful for updates)
   */
  clearCache(): void {
    this.memoryCache.clear();
  }

  /**
   * Format AI result for Discord display
   */
  static formatForDiscord(result: AISearchResult): string {
    let formatted = `**Answer:** ${result.answer}\n\n`;

    if (result.sources.length > 0) {
      formatted += '**Sources:**\n';
      for (const source of result.sources) {
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

    if (result.relatedDocuments.length > 0) {
      formatted += '**Related Documents:**\n';
      for (const doc of result.relatedDocuments) {
        formatted += `• ${path.basename(doc.path)} - ${doc.reason}\n`;
      }
    }

    formatted += `\n*Confidence: ${Math.round(result.confidence * 100)}%*`;

    return formatted;
  }
}