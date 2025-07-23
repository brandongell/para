/**
 * Query Complexity Analyzer
 * Determines whether a query should use fast matching or AI search
 */

export interface QueryComplexity {
  isComplex: boolean;
  reason: string;
  confidence: number;
  suggestedPath: 'fast' | 'ai' | 'hybrid';
}

export class QueryAnalyzer {
  // Keywords that indicate complex analytical queries
  private static readonly ANALYTICAL_KEYWORDS = [
    'total', 'sum', 'calculate', 'how much', 'how many',
    'average', 'mean', 'median', 'highest', 'lowest',
    'top', 'bottom', 'rank', 'compare', 'difference',
    'trend', 'growth', 'decline', 'change', 'rate'
  ];

  // Keywords that indicate explanatory queries
  private static readonly EXPLANATORY_KEYWORDS = [
    'why', 'how', 'explain', 'what is', 'what are',
    'describe', 'tell me about', 'summarize', 'overview',
    'understand', 'meaning', 'definition', 'purpose'
  ];

  // Keywords that indicate temporal analysis
  private static readonly TEMPORAL_KEYWORDS = [
    'when', 'timeline', 'history', 'progression',
    'next month', 'last year', 'recent', 'upcoming',
    'expire', 'due', 'deadline', 'schedule'
  ];

  // Keywords that indicate relationship queries
  private static readonly RELATIONSHIP_KEYWORDS = [
    'who', 'which', 'whose', 'related', 'connected',
    'between', 'among', 'with', 'involving', 'party',
    'relationship', 'structure', 'hierarchy'
  ];

  // Simple document request patterns
  private static readonly SIMPLE_PATTERNS = [
    /^(find|show|get|list)\s+(all\s+)?([\w\s]+)$/i,
    /^([\w\s]+)\s+(document|agreement|contract|template)s?$/i,
    /^templates?$/i,
    /^([\w\s]+)'s\s+(document|file|agreement)s?$/i
  ];

  /**
   * Analyze query complexity and determine routing
   */
  static analyzeQuery(query: string): QueryComplexity {
    const lowerQuery = query.toLowerCase().trim();
    
    // Check for simple patterns first
    if (this.isSimpleQuery(lowerQuery)) {
      return {
        isComplex: false,
        reason: 'Simple document request pattern detected',
        confidence: 0.9,
        suggestedPath: 'fast'
      };
    }

    // Check for analytical queries
    if (this.containsAny(lowerQuery, this.ANALYTICAL_KEYWORDS)) {
      return {
        isComplex: true,
        reason: 'Query requires calculation or analysis',
        confidence: 0.95,
        suggestedPath: 'ai'
      };
    }

    // Check for explanatory queries
    if (this.containsAny(lowerQuery, this.EXPLANATORY_KEYWORDS)) {
      return {
        isComplex: true,
        reason: 'Query requires explanation or summary',
        confidence: 0.9,
        suggestedPath: 'ai'
      };
    }

    // Check for temporal analysis
    if (this.containsAny(lowerQuery, this.TEMPORAL_KEYWORDS) && 
        !this.isSimpleDateFilter(lowerQuery)) {
      return {
        isComplex: true,
        reason: 'Query requires temporal analysis',
        confidence: 0.85,
        suggestedPath: 'ai'
      };
    }

    // Check for relationship queries
    if (this.containsAny(lowerQuery, this.RELATIONSHIP_KEYWORDS) &&
        this.isComplexRelationship(lowerQuery)) {
      return {
        isComplex: true,
        reason: 'Query involves complex relationships',
        confidence: 0.8,
        suggestedPath: 'ai'
      };
    }

    // Check for multiple conditions
    if (this.hasMultipleConditions(lowerQuery)) {
      return {
        isComplex: true,
        reason: 'Query has multiple conditions',
        confidence: 0.75,
        suggestedPath: 'hybrid'
      };
    }

    // Check query length and structure
    if (lowerQuery.split(' ').length > 10) {
      return {
        isComplex: true,
        reason: 'Long natural language query',
        confidence: 0.7,
        suggestedPath: 'ai'
      };
    }

    // Default to fast search for unclear cases
    return {
      isComplex: false,
      reason: 'No complex patterns detected',
      confidence: 0.6,
      suggestedPath: 'fast'
    };
  }

  /**
   * Check if query matches simple patterns
   */
  private static isSimpleQuery(query: string): boolean {
    return this.SIMPLE_PATTERNS.some(pattern => pattern.test(query));
  }

  /**
   * Check if query contains any keywords from list
   */
  private static containsAny(query: string, keywords: string[]): boolean {
    return keywords.some(keyword => {
      // Use word boundaries for more accurate matching
      const regex = new RegExp(`\\b${keyword}\\b`, 'i');
      return regex.test(query);
    });
  }

  /**
   * Check if it's a simple date filter vs complex temporal analysis
   */
  private static isSimpleDateFilter(query: string): boolean {
    // Simple date filters like "documents from 2023" or "signed in January"
    const simpleDatePatterns = [
      /from\s+\d{4}/i,
      /in\s+(january|february|march|april|may|june|july|august|september|october|november|december)/i,
      /signed\s+(on|in)\s+/i,
      /dated\s+/i
    ];
    
    return simpleDatePatterns.some(pattern => pattern.test(query));
  }

  /**
   * Check if relationship query is complex
   */
  private static isComplexRelationship(query: string): boolean {
    // Simple queries like "who signed X" are not complex
    const simpleRelationshipPatterns = [
      /^who\s+(signed|created|wrote)\s+/i,
      /^whose\s+\w+\s+is\s+/i,
      /^which\s+\w+\s+(has|contains)\s+/i
    ];
    
    return !simpleRelationshipPatterns.some(pattern => pattern.test(query));
  }

  /**
   * Check for multiple conditions in query
   */
  private static hasMultipleConditions(query: string): boolean {
    // Look for conjunctions and multiple criteria
    const multiConditionIndicators = [
      ' and ',
      ' or ',
      ' but ',
      ' except ',
      ' excluding ',
      ' with ',
      ' without ',
      ' also ',
      ' plus '
    ];
    
    const conditionCount = multiConditionIndicators.filter(
      indicator => query.includes(indicator)
    ).length;
    
    return conditionCount >= 2;
  }

  /**
   * Get recommended fallback strategy
   */
  static getFallbackStrategy(
    fastSearchResultCount: number,
    queryComplexity: QueryComplexity
  ): 'none' | 'ai' | 'refine' {
    // If fast search returns no results and query might be misspelled
    if (fastSearchResultCount === 0 && queryComplexity.confidence < 0.8) {
      return 'ai';
    }
    
    // If fast search returns too few results for a general query
    if (fastSearchResultCount < 3 && !queryComplexity.isComplex) {
      return 'ai';
    }
    
    // If fast search returns too many results
    if (fastSearchResultCount > 20) {
      return 'refine';
    }
    
    return 'none';
  }
}