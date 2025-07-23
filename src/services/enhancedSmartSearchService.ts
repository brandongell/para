/**
 * Enhanced Smart Search Service
 * Integrates fast matching and AI search into a unified hybrid system
 */

import * as fs from 'fs';
import * as path from 'path';
import { 
  UnifiedSearchResult, 
  SearchOptions, 
  ParsedSearchQuery,
  SearchDocument,
  MemorySearchResult
} from '../types/searchTypes';
import { DocumentMetadata } from '../types';
import { QueryAnalyzer, QueryComplexity } from './queryAnalyzer';
import { FuzzyMatcher, MatchResult } from './fuzzyMatcher';
import { SearchMappings } from './searchMappings';
import { AISearchService, AISearchResult } from './aiSearchService';
import { MemoryService } from './memoryService';

export class EnhancedSmartSearchService {
  private aiSearchService: AISearchService | null = null;
  private memoryService: MemoryService;
  private organizedFolderPath: string;
  private documentCache: Map<string, DocumentMetadata> = new Map();
  private resultCache: Map<string, UnifiedSearchResult> = new Map();

  constructor(
    organizedFolderPath: string,
    openAIApiKey?: string,
    geminiApiKey?: string
  ) {
    this.organizedFolderPath = organizedFolderPath;
    this.memoryService = new MemoryService(organizedFolderPath);
    
    // Initialize AI search if API key provided
    if (openAIApiKey) {
      const memoryDir = path.join(organizedFolderPath, '_memory');
      this.aiSearchService = new AISearchService(openAIApiKey, memoryDir);
    }
  }

  /**
   * Main search entry point
   */
  async search(
    query: string,
    options: SearchOptions = {}
  ): Promise<UnifiedSearchResult> {
    const startTime = Date.now();
    
    // Check cache first
    const cacheKey = `${query}:${JSON.stringify(options)}`;
    if (options.useCache && this.resultCache.has(cacheKey)) {
      const cached = this.resultCache.get(cacheKey)!;
      cached.performance.totalTime = Date.now() - startTime;
      return cached;
    }

    try {
      // 1. Parse and analyze query
      const parsedQuery = this.parseQuery(query);
      
      // 2. Determine search path
      const searchPath = options.forceSearchPath || parsedQuery.complexity.suggestedPath;
      
      // 3. Execute search based on path
      let result: UnifiedSearchResult;
      
      switch (searchPath) {
        case 'ai':
          result = await this.performAISearch(parsedQuery, options);
          break;
          
        case 'hybrid':
          result = await this.performHybridSearch(parsedQuery, options);
          break;
          
        case 'fast':
        default:
          result = await this.performFastSearch(parsedQuery, options);
          
          // Fallback to AI if fast search fails
          if (result.documents.length === 0 && this.aiSearchService) {
            console.log('Fast search returned no results, falling back to AI search');
            result = await this.performAISearch(parsedQuery, options);
          }
      }
      
      // 4. Add performance metrics
      result.performance.totalTime = Date.now() - startTime;
      
      // 5. Cache result
      if (options.useCache) {
        this.resultCache.set(cacheKey, result);
      }
      
      return result;
    } catch (error) {
      console.error('Search error:', error);
      
      // Return error result
      return {
        query,
        searchPath: 'fast',
        documents: [],
        performance: {
          totalTime: Date.now() - startTime,
          searchTime: 0,
          itemsScanned: 0
        },
        related: {
          facts: [],
          suggestions: ['Try rephrasing your query', 'Check for typos']
        }
      };
    }
  }

  /**
   * Parse and analyze query
   */
  private parseQuery(query: string): ParsedSearchQuery {
    // Analyze complexity
    const complexity = QueryAnalyzer.analyzeQuery(query);
    
    // Expand query with synonyms
    const expandedQueries = SearchMappings.expandQuery(query);
    
    // Parse filters
    const filters: ParsedSearchQuery['filters'] = {};
    
    // Parse status filter (e.g., status:template, status:executed)
    const statusMatch = query.match(/status:(\w+)/i);
    if (statusMatch) {
      filters.status = [statusMatch[1].toLowerCase()];
      // Remove the filter from expanded queries
      expandedQueries.forEach((q, i) => {
        expandedQueries[i] = q.replace(/status:\w+/i, '').trim();
      });
    }
    
    // Parse value comparisons
    const valueComparison = SearchMappings.parseValueComparison(query);
    if (valueComparison) {
      filters.valueRange = valueComparison;
    }
    
    // Parse dates
    const relativeDate = SearchMappings.parseRelativeDate(query);
    if (relativeDate) {
      filters.dateRange = { start: relativeDate };
    }
    
    // Detect intent
    const intent = this.detectIntent(query);
    
    return {
      originalQuery: query,
      normalizedQuery: query.toLowerCase().trim(),
      expandedQueries,
      filters,
      intent,
      complexity
    };
  }

  /**
   * Perform fast algorithmic search
   */
  private async performFastSearch(
    parsedQuery: ParsedSearchQuery,
    options: SearchOptions
  ): Promise<UnifiedSearchResult> {
    const searchStartTime = Date.now();
    const documents: SearchDocument[] = [];
    
    // Load all documents
    const allDocuments = await this.scanDocuments();
    
    // Search through documents
    for (const [docPath, metadata] of allDocuments) {
      // Try all expanded queries
      let bestMatch: { score: number; field: string; type: MatchResult['type'] } = { score: 0, field: '', type: 'none' };
      
      for (const expandedQuery of parsedQuery.expandedQueries) {
        // Match against filename
        const filenameMatch = FuzzyMatcher.match(expandedQuery, metadata.filename);
        if (filenameMatch.score > bestMatch.score) {
          bestMatch = { ...filenameMatch, field: 'filename' };
        }
        
        // Match against metadata fields
        const fieldMatch = FuzzyMatcher.matchMultipleFields(expandedQuery, {
          documentType: metadata.document_type || '',
          category: metadata.category || '',
          signers: (metadata.signers || []).map(s => s.name).join(' '),
          parties: (metadata.primary_parties || []).map(p => p.name).join(' ')
        });
        
        if (fieldMatch.bestScore > bestMatch.score) {
          bestMatch = {
            score: fieldMatch.bestScore,
            field: fieldMatch.bestField || '',
            type: fieldMatch.allScores[fieldMatch.bestField!]?.type || 'none'
          };
        }
      }
      
      // Apply filters
      if (!this.passesFilters(metadata, parsedQuery.filters)) {
        continue;
      }
      
      // Add to results if score is high enough
      if (bestMatch.score >= (options.fuzzyMatchThreshold || 0.5)) {
        documents.push({
          path: docPath,
          filename: metadata.filename,
          relevance: bestMatch.score,
          matchType: bestMatch.type === 'exact' ? 'exact' : 'fuzzy',
          matchDetails: {
            field: bestMatch.field,
            reason: `Matched in ${bestMatch.field} with ${bestMatch.type} match`
          },
          metadata
        });
      }
    }
    
    // Sort by relevance
    documents.sort((a, b) => b.relevance - a.relevance);
    
    // Limit results
    const limitedDocs = documents.slice(0, options.maxResults || 10);
    
    // Search memory for additional context
    const memoryResults = await this.searchMemory(parsedQuery.originalQuery);
    
    return {
      query: parsedQuery.originalQuery,
      searchPath: 'fast',
      documents: limitedDocs,
      memoryResults,
      performance: {
        totalTime: 0, // Set by caller
        searchTime: Date.now() - searchStartTime,
        itemsScanned: allDocuments.size
      }
    };
  }

  /**
   * Perform AI-powered search
   */
  private async performAISearch(
    parsedQuery: ParsedSearchQuery,
    options: SearchOptions
  ): Promise<UnifiedSearchResult> {
    if (!this.aiSearchService) {
      throw new Error('AI search not available - OpenAI API key required');
    }
    
    const searchStartTime = Date.now();
    
    // Perform AI search
    const aiResult = await this.aiSearchService.searchWithAI(
      parsedQuery.originalQuery,
      options
    );
    
    // Convert AI result to unified format
    const documents: SearchDocument[] = aiResult.relatedDocuments.map(doc => ({
      path: doc.path,
      filename: path.basename(doc.path),
      relevance: doc.relevance,
      matchType: 'semantic' as const,
      matchDetails: {
        reason: doc.reason
      }
    }));
    
    return {
      query: parsedQuery.originalQuery,
      searchPath: 'ai',
      answer: {
        text: aiResult.answer,
        confidence: aiResult.confidence,
        sources: aiResult.sources
      },
      documents,
      performance: {
        totalTime: 0, // Set by caller
        searchTime: Date.now() - searchStartTime,
        itemsScanned: 0 // AI doesn't scan items in traditional sense
      }
    };
  }

  /**
   * Perform hybrid search (fast + AI)
   */
  private async performHybridSearch(
    parsedQuery: ParsedSearchQuery,
    options: SearchOptions
  ): Promise<UnifiedSearchResult> {
    const searchStartTime = Date.now();
    
    // Run both searches in parallel
    const [fastResult, aiResult] = await Promise.all([
      this.performFastSearch(parsedQuery, options),
      this.aiSearchService ? 
        this.performAISearch(parsedQuery, options) : 
        Promise.resolve(null)
    ]);
    
    // Merge results
    const mergedDocuments = this.mergeDocumentResults(
      fastResult.documents,
      aiResult?.documents || []
    );
    
    return {
      query: parsedQuery.originalQuery,
      searchPath: 'hybrid',
      answer: aiResult?.answer,
      documents: mergedDocuments,
      memoryResults: fastResult.memoryResults,
      performance: {
        totalTime: 0, // Set by caller
        searchTime: Date.now() - searchStartTime,
        itemsScanned: fastResult.performance.itemsScanned
      }
    };
  }

  /**
   * Scan all documents and load metadata
   */
  private async scanDocuments(): Promise<Map<string, DocumentMetadata>> {
    if (this.documentCache.size > 0) {
      return this.documentCache;
    }
    
    const scanDir = async (dir: string): Promise<void> => {
      const items = fs.readdirSync(dir);
      
      for (const item of items) {
        const fullPath = path.join(dir, item);
        const stat = fs.statSync(fullPath);
        
        if (stat.isDirectory() && !item.startsWith('.') && item !== 'memory') {
          await scanDir(fullPath);
        } else if (item.endsWith('.metadata.json')) {
          try {
            const metadata = JSON.parse(fs.readFileSync(fullPath, 'utf-8'));
            const docPath = fullPath.replace('.metadata.json', '');
            this.documentCache.set(docPath, metadata);
          } catch (error) {
            console.error(`Error loading metadata from ${fullPath}:`, error);
          }
        }
      }
    };
    
    await scanDir(this.organizedFolderPath);
    return this.documentCache;
  }

  /**
   * Search memory files
   */
  private async searchMemory(query: string): Promise<MemorySearchResult[]> {
    const result = await this.memoryService.queryMemory(query);
    
    if (!result) {
      return [];
    }
    
    // Convert the single answer/sources result to MemorySearchResult format
    return [{
      source: 'memory',
      section: 'answer',
      content: result.answer,
      relevance: 0.8, // Memory results are generally relevant
      relatedDocuments: result.sources
    }];
  }

  /**
   * Check if document passes filters
   */
  private passesFilters(
    metadata: DocumentMetadata,
    filters: ParsedSearchQuery['filters']
  ): boolean {
    // Status filter
    if (filters.status && filters.status.length > 0) {
      if (!filters.status.includes(metadata.status)) {
        return false;
      }
    }
    
    // Category filter
    if (filters.category && filters.category.length > 0) {
      if (!filters.category.includes(metadata.category)) {
        return false;
      }
    }
    
    // Date range filter
    if (filters.dateRange) {
      const docDate = metadata.fully_executed_date || metadata.effective_date;
      if (docDate) {
        const date = new Date(docDate);
        if (filters.dateRange.start && date < filters.dateRange.start) {
          return false;
        }
        if (filters.dateRange.end && date > filters.dateRange.end) {
          return false;
        }
      }
    }
    
    // Value range filter
    if (filters.valueRange && metadata.contract_value) {
      const value = parseFloat(metadata.contract_value.replace(/[$,]/g, ''));
      if (filters.valueRange.min && value < filters.valueRange.min) {
        return false;
      }
      if (filters.valueRange.max && value > filters.valueRange.max) {
        return false;
      }
    }
    
    return true;
  }

  /**
   * Merge document results from different search paths
   */
  private mergeDocumentResults(
    fastResults: SearchDocument[],
    aiResults: SearchDocument[]
  ): SearchDocument[] {
    const merged = new Map<string, SearchDocument>();
    
    // Add fast results
    for (const doc of fastResults) {
      merged.set(doc.path, doc);
    }
    
    // Merge AI results
    for (const doc of aiResults) {
      const existing = merged.get(doc.path);
      if (existing) {
        // Take higher relevance score
        if (doc.relevance > existing.relevance) {
          merged.set(doc.path, doc);
        }
      } else {
        merged.set(doc.path, doc);
      }
    }
    
    // Sort by relevance
    return Array.from(merged.values()).sort((a, b) => b.relevance - a.relevance);
  }

  /**
   * Detect query intent
   */
  private detectIntent(query: string): ParsedSearchQuery['intent'] {
    const lowerQuery = query.toLowerCase();
    
    if (lowerQuery.includes('?') || 
        /^(what|who|when|where|why|how)\s/i.test(lowerQuery)) {
      return { type: 'question', confidence: 0.9 };
    }
    
    if (/calculate|total|sum|average|analyze/i.test(lowerQuery)) {
      return { type: 'analysis', confidence: 0.85 };
    }
    
    if (/^(show|list|find|get)\s/i.test(lowerQuery)) {
      return { type: 'search', confidence: 0.9 };
    }
    
    return { type: 'search', confidence: 0.6 };
  }

  /**
   * Get document by filename
   */
  async getDocumentByFilename(filename: string): Promise<any> {
    // First try exact match
    const exactResult = await this.search(filename, {
      forceSearchPath: 'fast',
      fuzzyMatchThreshold: 0.9,
      maxResults: 1
    });
    
    if (exactResult.documents.length > 0) {
      return {
        ...exactResult.documents[0],
        exists: true
      };
    }
    
    // If no exact match, try fuzzy search
    const fuzzyResult = await this.search(filename, {
      forceSearchPath: 'fast',
      fuzzyMatchThreshold: 0.6,
      maxResults: 1
    });
    
    if (fuzzyResult.documents.length > 0) {
      return {
        ...fuzzyResult.documents[0],
        exists: true,
        fuzzyMatch: true
      };
    }
    
    return {
      exists: false,
      filename: filename
    };
  }

  /**
   * Get document statistics
   */
  async getDocumentStatistics(): Promise<any> {
    const documents = await this.scanDocuments();
    
    const stats = {
      totalDocuments: documents.size,
      byStatus: {} as Record<string, number>,
      byCategory: {} as Record<string, number>,
      recentDocuments: [] as any[],
      templateCount: 0
    };
    
    // Calculate statistics
    for (const [path, metadata] of documents) {
      // By status
      const status = metadata.status || 'unknown';
      stats.byStatus[status] = (stats.byStatus[status] || 0) + 1;
      
      // By category
      const category = metadata.category || 'uncategorized';
      stats.byCategory[category] = (stats.byCategory[category] || 0) + 1;
      
      // Count templates
      if (status === 'template') {
        stats.templateCount++;
      }
    }
    
    // Get recent documents
    const sortedDocs = Array.from(documents.entries())
      .sort((a, b) => {
        const dateA = new Date(a[1].fully_executed_date || a[1].effective_date || 0);
        const dateB = new Date(b[1].fully_executed_date || b[1].effective_date || 0);
        return dateB.getTime() - dateA.getTime();
      })
      .slice(0, 5);
      
    stats.recentDocuments = sortedDocs.map(([path, metadata]) => ({
      filename: metadata.filename,
      path,
      date: metadata.fully_executed_date || metadata.effective_date,
      status: metadata.status
    }));
    
    return stats;
  }

  /**
   * Clear all caches
   */
  clearCache(): void {
    this.documentCache.clear();
    this.resultCache.clear();
    this.aiSearchService?.clearCache();
  }
}