/**
 * Unified Search Types
 * Common types for the hybrid search system
 */

export interface UnifiedSearchResult {
  // Query information
  query: string;
  searchPath: 'fast' | 'ai' | 'hybrid';
  
  // Direct answer (from AI or memory)
  answer?: {
    text: string;
    confidence: number;
    sources: SourceAttribution[];
  };
  
  // Matching documents
  documents: SearchDocument[];
  
  // Memory results
  memoryResults?: MemorySearchResult[];
  
  // Related information
  related?: {
    facts: string[];
    suggestions: string[];
    alternativeQueries?: string[];
  };
  
  // Performance metrics
  performance: {
    totalTime: number;
    searchTime: number;
    itemsScanned: number;
  };
}

export interface SourceAttribution {
  memoryFile: string;
  section: string;
  originalDocument: string;
  excerpt: string;
  confidence: number;
}

export interface SearchDocument {
  path: string;
  filename: string;
  relevance: number;
  matchType: 'exact' | 'fuzzy' | 'semantic' | 'metadata';
  matchDetails: {
    field?: string;
    matchedText?: string;
    reason: string;
  };
  metadata?: any;
  excerpt?: string;
}

export interface MemorySearchResult {
  source: string;
  section: string;
  content: string;
  relevance: number;
  relatedDocuments: string[];
}

export interface SearchOptions {
  // Routing options
  forceSearchPath?: 'fast' | 'ai' | 'hybrid';
  
  // Fast search options
  fuzzyMatchThreshold?: number;
  expandSynonyms?: boolean;
  includeTemplates?: boolean;
  
  // AI search options
  includeMetadata?: boolean;
  maxMetadataFiles?: number;
  
  // Result options
  maxResults?: number;
  includeExcerpts?: boolean;
  groupByCategory?: boolean;
  
  // Performance options
  useCache?: boolean;
  timeout?: number;
}

export interface ParsedSearchQuery {
  originalQuery: string;
  normalizedQuery: string;
  expandedQueries: string[];
  
  filters: {
    documentType?: string[];
    status?: string[];
    signers?: string[];
    dateRange?: {
      start?: Date;
      end?: Date;
    };
    valueRange?: {
      min?: number;
      max?: number;
      field?: string;
    };
    category?: string[];
    excludeTerms?: string[];
    mustInclude?: string[];
  };
  
  intent: {
    type: 'search' | 'question' | 'analysis' | 'command';
    confidence: number;
  };
  
  complexity: {
    isComplex: boolean;
    reason: string;
    suggestedPath: 'fast' | 'ai' | 'hybrid';
  };
}