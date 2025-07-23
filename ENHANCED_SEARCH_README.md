# Enhanced Search System Documentation

## Overview

The Enhanced Search System provides a hybrid approach combining fast algorithmic matching with AI-powered search capabilities. It automatically routes queries to the most appropriate search method and provides detailed source attribution for all results.

## Key Features

### 1. **Hybrid Search Architecture**
- **Fast Path**: <100ms for simple queries using fuzzy matching and synonyms
- **AI Path**: 1-2s for complex queries using GPT-4o analysis of memory files
- **Automatic Routing**: Intelligent query analysis determines the best search path

### 2. **Advanced Matching Capabilities**
- **Fuzzy Matching**: Handles typos with Levenshtein distance (2-character threshold)
- **Synonym Expansion**: "investment docs" finds SAFE agreements, convertible notes, etc.
- **Abbreviation Support**: "NDA" matches "Non-Disclosure Agreement"
- **Partial Matching**: "Dan" finds "Dan Shipper"

### 3. **Natural Language Understanding**
- **Complex Queries**: "What's our burn rate?" gets calculated answers
- **Value Comparisons**: "contracts over $50k" properly filters results
- **Relative Dates**: "last month", "next 30 days" are understood
- **Boolean Logic**: "Dan's documents but not employment" works correctly

### 4. **Full Source Attribution**
Every AI answer includes:
- Memory file source (e.g., `financial_summary.md`)
- Section within the file
- Original document reference
- Confidence score
- Relevant excerpt

## Usage in Discord Bot

### Simple Searches
```
@bot find employment agreement
@bot show me all SAFEs
@bot list templates
```

### Complex Queries
```
@bot what's our total investment raised?
@bot which contracts expire next month?
@bot explain our equity structure
@bot who are our top 5 vendors by contract value?
```

### Natural Language
```
@bot investment docs from last year
@bot Dan's agreements except employment
@bot contracts worth more than $100k
```

## Architecture

### Core Components

1. **QueryAnalyzer** - Determines query complexity and routing
2. **FuzzyMatcher** - Provides flexible string matching with scoring
3. **SearchMappings** - Handles synonyms, abbreviations, and parsing
4. **AISearchService** - Manages GPT-4o integration with source tracking
5. **EnhancedSmartSearchService** - Orchestrates the hybrid search

### Search Flow

```
User Query → Query Analysis → Route Decision
                                    ↓
                      ┌─────────────┴─────────────┐
                      ↓                           ↓
                Fast Match                   AI Search
              (Simple queries)            (Complex queries)
                      ↓                           ↓
                Fuzzy Matching              GPT-4o Analysis
                Synonyms                    Memory Files
                Abbreviations               Metadata
                      ↓                           ↓
                      └─────────────┬─────────────┘
                                   ↓
                            Unified Results
                            With Sources
```

## Response Format

### AI Search Response
```
**Answer:** Your burn rate is approximately $125,000/month

**Sources:**
📄 `financial_summary.md` → Total Raised section
   • Source: SAFE_Agreement_Seed_2023.pdf
   • "$1.5M total capital raised"
📄 `revenue_and_sales.md` → Monthly Revenue
   • Source: Customer_Agreement_Enterprise.pdf
   • "Monthly recurring revenue: $25,000"

**Documents:**
• SAFE_Agreement_Seed_2023.pdf
• Customer_Agreement_Enterprise.pdf
```

### Fast Search Response
```
Found 3 employment agreements:
• Employment_Agreement_Dan_Shipper.pdf (95% match)
• Employment_Agreement_Jane_Doe.pdf (92% match)
• Contractor_Agreement_John_Smith.pdf (78% match)
```

## Configuration

### Search Options
```typescript
{
  // Routing
  forceSearchPath?: 'fast' | 'ai' | 'hybrid',
  
  // Fast search
  fuzzyMatchThreshold?: number,     // Default: 0.6
  expandSynonyms?: boolean,         // Default: true
  
  // Results
  maxResults?: number,              // Default: 10
  useCache?: boolean,               // Default: true
}
```

### Performance

- **Fast Search**: <100ms for typical queries
- **AI Search**: 1-2s depending on complexity
- **Memory Usage**: ~15k tokens for all memory files
- **Cost**: ~$0.09 per complex AI query

## Testing

Run the test suite:
```bash
npx ts-node test-enhanced-search.ts
```

Tests include:
- Query complexity analysis
- Fuzzy matching accuracy
- Synonym expansion
- Date/value parsing
- End-to-end search queries

## Limitations

1. **AI Search requires OpenAI API key**
2. **Memory files must be pre-aggregated** (handled by MemoryService)
3. **Document content search** requires metadata to be generated
4. **Cache invalidation** is manual (call `clearCache()`)

## Future Enhancements

1. **Semantic embeddings** for even better matching
2. **Query history** and learning from user selections
3. **Multi-language support**
4. **Advanced boolean query syntax**
5. **Real-time index updates**