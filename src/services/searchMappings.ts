/**
 * Search Mappings
 * Provides synonym mappings and abbreviation handling for legal documents
 */

export class SearchMappings {
  /**
   * Synonym mappings for common legal terms
   * Maps a term to its synonyms/related terms
   */
  static readonly SYNONYMS: { [key: string]: string[] } = {
    // Investment documents
    'investment': ['SAFE', 'convertible note', 'investment agreement', 'funding', 'capital', 'equity'],
    'safe': ['SAFE agreement', 'simple agreement for future equity', 'investment'],
    'convertible': ['convertible note', 'convertible debt', 'conversion agreement'],
    'funding': ['investment', 'capital raise', 'financing', 'round'],
    
    // Employment documents
    'employment': ['offer letter', 'employment agreement', 'contractor agreement', 'work agreement', 'job offer'],
    'contractor': ['independent contractor', 'consultant', 'freelancer', '1099', 'consulting agreement'],
    'offer': ['offer letter', 'employment offer', 'job offer'],
    
    // Legal entities
    'company': ['corporation', 'entity', 'business', 'organization', 'firm'],
    'founder': ['co-founder', 'founding member', 'entrepreneur'],
    'investor': ['shareholder', 'stockholder', 'equity holder', 'partner'],
    
    // IP documents
    'ip': ['intellectual property', 'patent', 'trademark', 'copyright', 'invention'],
    'nda': ['non-disclosure agreement', 'confidentiality agreement', 'NDA', 'confidential'],
    'assignment': ['invention assignment', 'IP assignment', 'transfer agreement'],
    
    // Corporate documents
    'bylaws': ['by-laws', 'corporate bylaws', 'company bylaws'],
    'incorporation': ['articles of incorporation', 'certificate of incorporation', 'charter'],
    'board': ['board resolution', 'board consent', 'director resolution'],
    
    // Financial terms
    'revenue': ['sales', 'income', 'earnings', 'receipts'],
    'expense': ['cost', 'spending', 'expenditure', 'outlay'],
    'equity': ['stock', 'shares', 'ownership', 'stake'],
    'debt': ['loan', 'liability', 'obligation', 'borrowing'],
    
    // Status terms
    'signed': ['executed', 'completed', 'finalized'],
    'unsigned': ['draft', 'pending', 'not executed', 'incomplete'],
    'template': ['blank', 'form', 'sample', 'model'],
    
    // Time-related
    'recent': ['latest', 'newest', 'current', 'last'],
    'expired': ['lapsed', 'terminated', 'ended', 'invalid'],
    'active': ['current', 'valid', 'in effect', 'ongoing']
  };

  /**
   * Abbreviation mappings
   * Maps abbreviations to their full forms
   */
  static readonly ABBREVIATIONS: Map<string, string[]> = new Map([
    // Legal abbreviations
    ['nda', ['non-disclosure agreement', 'nondisclosure agreement']],
    ['ip', ['intellectual property']],
    ['tos', ['terms of service']],
    ['sla', ['service level agreement']],
    ['msa', ['master service agreement']],
    ['sow', ['statement of work']],
    ['loi', ['letter of intent']],
    ['mou', ['memorandum of understanding']],
    
    // Corporate abbreviations
    ['llc', ['limited liability company']],
    ['inc', ['incorporated', 'incorporation']],
    ['corp', ['corporation']],
    ['dba', ['doing business as']],
    ['ein', ['employer identification number']],
    ['ceo', ['chief executive officer']],
    ['cfo', ['chief financial officer']],
    ['cto', ['chief technology officer']],
    
    // Financial abbreviations
    ['safe', ['simple agreement for future equity']],
    ['arr', ['annual recurring revenue']],
    ['mrr', ['monthly recurring revenue']],
    ['cap', ['capitalization', 'cap table']],
    ['vc', ['venture capital', 'venture capitalist']],
    ['pe', ['private equity']],
    ['ipo', ['initial public offering']],
    
    // Employment abbreviations
    ['pto', ['paid time off']],
    ['hr', ['human resources']],
    ['w2', ['employee', 'w-2 employee']],
    ['1099', ['contractor', 'independent contractor']]
  ]);

  /**
   * Document type mappings
   * Maps general terms to specific document types
   */
  static readonly DOCUMENT_TYPES: { [key: string]: string[] } = {
    'agreement': [
      'employment agreement',
      'contractor agreement', 
      'service agreement',
      'purchase agreement',
      'license agreement',
      'partnership agreement'
    ],
    'contract': [
      'employment contract',
      'service contract',
      'sales contract',
      'vendor contract'
    ],
    'letter': [
      'offer letter',
      'termination letter',
      'resignation letter',
      'letter of intent'
    ],
    'form': [
      'tax form',
      'application form',
      'consent form',
      'disclosure form'
    ]
  };

  /**
   * Expand a query using synonyms
   */
  static expandQuery(query: string): string[] {
    const words = query.toLowerCase().split(/\s+/);
    const expansions = new Set<string>([query]);
    
    for (const word of words) {
      // Check direct synonyms
      const synonyms = this.SYNONYMS[word];
      if (synonyms) {
        for (const synonym of synonyms) {
          const expanded = query.toLowerCase().replace(word, synonym);
          expansions.add(expanded);
        }
      }
      
      // Check if word is an abbreviation
      const fullForms = this.ABBREVIATIONS.get(word);
      if (fullForms) {
        for (const fullForm of fullForms) {
          const expanded = query.toLowerCase().replace(word, fullForm);
          expansions.add(expanded);
        }
      }
    }
    
    return Array.from(expansions);
  }

  /**
   * Get all related terms for a word
   */
  static getRelatedTerms(term: string): string[] {
    const related = new Set<string>();
    const lowerTerm = term.toLowerCase();
    
    // Direct synonyms
    if (this.SYNONYMS[lowerTerm]) {
      this.SYNONYMS[lowerTerm].forEach(s => related.add(s));
    }
    
    // Reverse synonyms (term appears in other synonym lists)
    for (const [key, synonyms] of Object.entries(this.SYNONYMS)) {
      if (synonyms.includes(lowerTerm)) {
        related.add(key);
        synonyms.forEach(s => related.add(s));
      }
    }
    
    // Abbreviation expansions
    const fullForms = this.ABBREVIATIONS.get(lowerTerm);
    if (fullForms) {
      fullForms.forEach(f => related.add(f));
    }
    
    // Reverse abbreviations
    for (const [abbr, fullForms] of this.ABBREVIATIONS) {
      if (fullForms.includes(lowerTerm)) {
        related.add(abbr);
        fullForms.forEach(f => related.add(f));
      }
    }
    
    // Remove the original term
    related.delete(lowerTerm);
    
    return Array.from(related);
  }

  /**
   * Parse value comparisons from query
   */
  static parseValueComparison(query: string): {
    operator?: '>' | '<' | '>=' | '<=' | '=';
    value?: number;
    field?: string;
  } | null {
    // Patterns for value comparisons
    const patterns = [
      /(?:more|greater)\s+than\s+\$?([\d,]+k?)/i,
      /(?:less|fewer)\s+than\s+\$?([\d,]+k?)/i,
      /(?:over|above)\s+\$?([\d,]+k?)/i,
      /(?:under|below)\s+\$?([\d,]+k?)/i,
      /(?:worth|value|amount)\s*[><=]+\s*\$?([\d,]+k?)/i,
      /\$?([\d,]+k?)\s+(?:or\s+)?(?:more|greater|higher)/i,
      /\$?([\d,]+k?)\s+(?:or\s+)?(?:less|fewer|lower)/i
    ];
    
    for (const pattern of patterns) {
      const match = query.match(pattern);
      if (match) {
        let value = match[1].replace(/,/g, '');
        
        // Handle 'k' suffix for thousands
        if (value.endsWith('k')) {
          value = value.slice(0, -1) + '000';
        }
        
        const numValue = parseFloat(value);
        
        // Determine operator
        let operator: '>' | '<' | '>=' | '<=' | '=' = '>';
        if (/(?:less|fewer|under|below)/i.test(query)) {
          operator = '<';
        } else if (/(?:or\s+more|or\s+greater)/i.test(query)) {
          operator = '>=';
        } else if (/(?:or\s+less|or\s+fewer)/i.test(query)) {
          operator = '<=';
        }
        
        // Try to determine field
        let field = 'contract_value'; // default
        if (/investment|funding|capital/i.test(query)) {
          field = 'investment_amount';
        } else if (/revenue|sales|income/i.test(query)) {
          field = 'revenue';
        } else if (/expense|cost|spending/i.test(query)) {
          field = 'expense';
        }
        
        return { operator, value: numValue, field };
      }
    }
    
    return null;
  }

  /**
   * Parse relative dates from query
   */
  static parseRelativeDate(query: string): Date | null {
    const now = new Date();
    const patterns: { pattern: RegExp; handler: (match: RegExpMatchArray) => Date }[] = [
      {
        pattern: /last\s+(\d+)\s+(day|week|month|year)s?/i,
        handler: (match) => {
          const amount = parseInt(match[1]);
          const unit = match[2].toLowerCase();
          const date = new Date();
          
          switch (unit) {
            case 'day':
              date.setDate(date.getDate() - amount);
              break;
            case 'week':
              date.setDate(date.getDate() - (amount * 7));
              break;
            case 'month':
              date.setMonth(date.getMonth() - amount);
              break;
            case 'year':
              date.setFullYear(date.getFullYear() - amount);
              break;
          }
          
          return date;
        }
      },
      {
        pattern: /next\s+(\d+)\s+(day|week|month|year)s?/i,
        handler: (match) => {
          const amount = parseInt(match[1]);
          const unit = match[2].toLowerCase();
          const date = new Date();
          
          switch (unit) {
            case 'day':
              date.setDate(date.getDate() + amount);
              break;
            case 'week':
              date.setDate(date.getDate() + (amount * 7));
              break;
            case 'month':
              date.setMonth(date.getMonth() + amount);
              break;
            case 'year':
              date.setFullYear(date.getFullYear() + amount);
              break;
          }
          
          return date;
        }
      },
      {
        pattern: /(yesterday|today|tomorrow)/i,
        handler: (match) => {
          const date = new Date();
          const term = match[1].toLowerCase();
          
          switch (term) {
            case 'yesterday':
              date.setDate(date.getDate() - 1);
              break;
            case 'tomorrow':
              date.setDate(date.getDate() + 1);
              break;
            // 'today' returns current date
          }
          
          return date;
        }
      },
      {
        pattern: /this\s+(week|month|year)/i,
        handler: (match) => {
          const unit = match[1].toLowerCase();
          const date = new Date();
          
          switch (unit) {
            case 'week':
              date.setDate(date.getDate() - date.getDay());
              break;
            case 'month':
              date.setDate(1);
              break;
            case 'year':
              date.setMonth(0, 1);
              break;
          }
          
          return date;
        }
      }
    ];
    
    for (const { pattern, handler } of patterns) {
      const match = query.match(pattern);
      if (match) {
        return handler(match);
      }
    }
    
    return null;
  }
}