/**
 * Enhanced Fuzzy Matcher
 * Provides flexible string matching with typo tolerance and scoring
 */

export interface MatchResult {
  score: number;
  type: 'exact' | 'contains' | 'fuzzy' | 'abbreviation' | 'partial' | 'none';
  matchedPortion?: string;
}

export class FuzzyMatcher {
  /**
   * Calculate Levenshtein distance between two strings
   */
  private static levenshteinDistance(str1: string, str2: string): number {
    const m = str1.length;
    const n = str2.length;
    
    if (m === 0) return n;
    if (n === 0) return m;
    
    const matrix: number[][] = [];
    
    // Initialize first column
    for (let i = 0; i <= m; i++) {
      matrix[i] = [i];
    }
    
    // Initialize first row
    for (let j = 0; j <= n; j++) {
      matrix[0][j] = j;
    }
    
    // Fill matrix
    for (let i = 1; i <= m; i++) {
      for (let j = 1; j <= n; j++) {
        const cost = str1[i - 1] === str2[j - 1] ? 0 : 1;
        matrix[i][j] = Math.min(
          matrix[i - 1][j] + 1,      // deletion
          matrix[i][j - 1] + 1,      // insertion
          matrix[i - 1][j - 1] + cost // substitution
        );
      }
    }
    
    return matrix[m][n];
  }

  /**
   * Main matching function
   */
  static match(query: string, field: string, options?: {
    caseSensitive?: boolean;
    maxDistance?: number;
    minScore?: number;
  }): MatchResult {
    const opts = {
      caseSensitive: false,
      maxDistance: 2,
      minScore: 0.3,
      ...options
    };

    // Normalize strings
    const normalizedQuery = opts.caseSensitive ? query : query.toLowerCase();
    const normalizedField = opts.caseSensitive ? field : field.toLowerCase();
    
    // 1. Check exact match
    if (normalizedField === normalizedQuery) {
      return { score: 1.0, type: 'exact' };
    }
    
    // 2. Check contains match
    if (normalizedField.includes(normalizedQuery)) {
      // Score based on how much of the field is matched
      const score = 0.8 + (0.2 * (normalizedQuery.length / normalizedField.length));
      return { 
        score: Math.min(score, 0.95), 
        type: 'contains',
        matchedPortion: field.substring(
          normalizedField.indexOf(normalizedQuery),
          normalizedField.indexOf(normalizedQuery) + normalizedQuery.length
        )
      };
    }
    
    // 3. Check if query contains field (reverse contains)
    if (normalizedQuery.includes(normalizedField) && normalizedField.length > 3) {
      return { score: 0.7, type: 'partial' };
    }
    
    // 4. Check word-level partial matches
    const wordMatch = this.wordLevelMatch(normalizedQuery, normalizedField);
    if (wordMatch.score > 0) {
      return wordMatch;
    }
    
    // 5. Check fuzzy match with Levenshtein distance
    const distance = this.levenshteinDistance(normalizedQuery, normalizedField);
    if (distance <= opts.maxDistance) {
      // Calculate score based on distance and length
      const maxLen = Math.max(normalizedQuery.length, normalizedField.length);
      const score = 1 - (distance / maxLen);
      
      if (score >= opts.minScore) {
        return { 
          score: Math.max(0.4, score * 0.8), // Cap fuzzy matches at 0.8
          type: 'fuzzy'
        };
      }
    }
    
    // 6. Check substring fuzzy match
    const substringMatch = this.fuzzySubstringMatch(
      normalizedQuery, 
      normalizedField, 
      opts.maxDistance
    );
    if (substringMatch.score > opts.minScore) {
      return substringMatch;
    }
    
    return { score: 0, type: 'none' };
  }

  /**
   * Word-level matching for multi-word strings
   */
  private static wordLevelMatch(query: string, field: string): MatchResult {
    const queryWords = query.split(/\s+/).filter(w => w.length > 0);
    const fieldWords = field.split(/\s+/).filter(w => w.length > 0);
    
    if (queryWords.length === 0 || fieldWords.length === 0) {
      return { score: 0, type: 'none' };
    }
    
    let matchedWords = 0;
    let totalScore = 0;
    
    // Check each query word against field words
    for (const qWord of queryWords) {
      let bestWordScore = 0;
      
      for (const fWord of fieldWords) {
        if (fWord === qWord) {
          bestWordScore = 1.0;
          break;
        } else if (fWord.includes(qWord) || qWord.includes(fWord)) {
          bestWordScore = Math.max(bestWordScore, 0.7);
        } else {
          // Fuzzy match individual words
          const distance = this.levenshteinDistance(qWord, fWord);
          if (distance <= 1) {
            bestWordScore = Math.max(bestWordScore, 0.5);
          }
        }
      }
      
      if (bestWordScore > 0) {
        matchedWords++;
        totalScore += bestWordScore;
      }
    }
    
    if (matchedWords > 0) {
      const score = (totalScore / queryWords.length) * 0.9; // Scale down word matches
      return { score, type: 'partial' };
    }
    
    return { score: 0, type: 'none' };
  }

  /**
   * Fuzzy substring matching
   */
  private static fuzzySubstringMatch(
    query: string, 
    field: string, 
    maxDistance: number
  ): MatchResult {
    if (query.length > field.length) {
      return { score: 0, type: 'none' };
    }
    
    let bestScore = 0;
    let bestMatch = '';
    
    // Slide window across field
    for (let i = 0; i <= field.length - query.length; i++) {
      const substring = field.substring(i, i + query.length);
      const distance = this.levenshteinDistance(query, substring);
      
      if (distance <= maxDistance) {
        const score = 1 - (distance / query.length);
        if (score > bestScore) {
          bestScore = score;
          bestMatch = substring;
        }
      }
    }
    
    if (bestScore > 0) {
      return { 
        score: bestScore * 0.7, // Scale down substring matches
        type: 'fuzzy',
        matchedPortion: bestMatch
      };
    }
    
    return { score: 0, type: 'none' };
  }

  /**
   * Match with abbreviation support
   */
  static matchWithAbbreviation(
    query: string, 
    field: string, 
    abbreviations: Map<string, string[]>
  ): MatchResult {
    // First try regular match
    let result = this.match(query, field);
    if (result.score >= 0.8) return result;
    
    // Check if query is an abbreviation
    const queryLower = query.toLowerCase();
    const expansions = abbreviations.get(queryLower) || [];
    
    for (const expansion of expansions) {
      const expansionResult = this.match(expansion, field);
      if (expansionResult.score > result.score) {
        result = { ...expansionResult, type: 'abbreviation' };
      }
    }
    
    // Check if field contains an abbreviation that matches query
    const fieldLower = field.toLowerCase();
    for (const [abbr, expansions] of abbreviations) {
      if (fieldLower.includes(abbr)) {
        for (const expansion of expansions) {
          const expansionResult = this.match(query, expansion);
          if (expansionResult.score > result.score) {
            result = { ...expansionResult, type: 'abbreviation' };
          }
        }
      }
    }
    
    return result;
  }

  /**
   * Score multiple fields and return best match
   */
  static matchMultipleFields(
    query: string,
    fields: { [key: string]: string },
    weights?: { [key: string]: number }
  ): {
    bestField: string | null;
    bestScore: number;
    allScores: { [key: string]: MatchResult };
  } {
    const allScores: { [key: string]: MatchResult } = {};
    let bestField: string | null = null;
    let bestScore = 0;
    
    for (const [fieldName, fieldValue] of Object.entries(fields)) {
      if (!fieldValue) continue;
      
      const result = this.match(query, fieldValue);
      const weight = weights?.[fieldName] || 1.0;
      const weightedScore = result.score * weight;
      
      allScores[fieldName] = result;
      
      if (weightedScore > bestScore) {
        bestScore = weightedScore;
        bestField = fieldName;
      }
    }
    
    return { bestField, bestScore, allScores };
  }
}