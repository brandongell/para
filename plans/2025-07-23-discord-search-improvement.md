# Hybrid AI-Powered Search Plan for Discord Bot

## Overview

Combine fast algorithmic matching with AI-powered search to create a hybrid system that handles both simple and complex queries effectively.

## Key Insight

The memory files are only ~57KB total (~15k tokens), making it feasible to send ALL memory data to GPT-4o for intelligent search. Combined with improved matching algorithms, we get the best of both worlds.

## Hybrid Search Architecture

```
User Query → Query Analyzer → Route Decision
                                 ↓
                    ┌────────────┴────────────┐
                    ↓                         ↓
            Fast Match Path             AI Search Path
            (Simple queries)            (Complex queries)
                    ↓                         ↓
            Enhanced Matcher           GPT-4o Analysis
            - Fuzzy matching           - All memory files
            - Synonyms                 - Relevant metadata
            - Abbreviations            - Natural language
                    ↓                         ↓
                    └─────────────┬───────────┘
                                 ↓
                          Unified Results
                          - Documents
                          - Direct answers
                          - Explanations
```

## Implementation Strategy

### 1. Query Routing Logic

```typescript
interface QueryComplexity {
  isComplex: boolean;
  reason: string;
  confidence: number;
}

// Route to AI if query is:
// - Asking "why", "how", "explain"
// - Contains multiple conditions
// - Requires aggregation ("total", "sum", "highest")
// - Natural language questions
// - When fast match returns < 3 results
```

### 2. Fast Match Path (Week 1)

For simple queries like:
- "find SAFE agreement"
- "Dan Shipper documents"
- "templates"

**Improvements:**
- Fuzzy matching (typo tolerance)
- Synonym expansion
- Partial name matching
- Abbreviation handling

### 3. AI Search Path (Week 2)

For complex queries like:
- "What's our total investment raised?"
- "Which contracts expire next month?"
- "Explain our equity structure"
- "Who are our top 5 vendors by contract value?"

**Implementation:**
```typescript
class AISearchService {
  async searchWithAI(query: string): Promise<AISearchResult> {
    // 1. Load all memory files (only ~15k tokens)
    const memoryContext = await this.loadAllMemoryFiles();
    
    // 2. Get relevant metadata files based on initial filtering
    const relevantMetadata = await this.getRelevantMetadata(query);
    
    // 3. Create focused prompt
    const prompt = `
      You are a legal document search assistant. Using the provided memory 
      files and metadata, answer this query: "${query}"
      
      Memory Files:
      ${memoryContext}
      
      Relevant Document Metadata:
      ${JSON.stringify(relevantMetadata, null, 2)}
      
      IMPORTANT: You must provide:
      1. Direct answer to the question
      2. EXACT source citations including:
         - Memory file name (e.g., "financial_summary.md")
         - Section or line reference
         - Original document paths from "Source:" citations
      3. Supporting documents with full file paths
      4. Relevant excerpts with clear attribution
      5. Confidence level in your answer
      
      Always cite your sources so answers can be verified.
    `;
    
    // 4. Get AI response
    return await this.openai.complete(prompt);
  }
}
```

### 4. Memory File Optimization (Week 1)

**Current State:**
- 15 memory files, ~57KB total
- Well-structured markdown
- Pre-aggregated from documents

**Enhancements:**
- Index memory files on startup
- Create searchable sections
- Build fact database for quick lookup
- Cache parsed memory structure

### 5. Intelligent Result Merging (Week 3)

Combine results from both paths:
```typescript
interface UnifiedResult {
  // Direct answer from AI or memory
  answer?: {
    text: string;
    confidence: number;
    sources: SourceAttribution[];  // Detailed source tracking
  };
  
  // Matching documents
  documents: {
    path: string;
    relevance: number;
    excerpt?: string;
    matchReason: string;
    sourceFile?: string;  // Which memory file referenced this
  }[];
  
  // Related information
  related: {
    facts: string[];
    suggestions: string[];
  };
}

interface SourceAttribution {
  memoryFile: string;      // e.g., "financial_summary.md"
  section: string;         // e.g., "Investment Rounds"
  originalDocument: string; // e.g., "03_Finance/SAFE_Agreement_2023.pdf"
  excerpt: string;         // The specific text used
  confidence: number;      // How confident in this source
}
```

## Example Query Flows

### Simple Query: "Find employment agreement"
1. Query analyzer → Routes to Fast Match
2. Fuzzy match finds "Employment_Agreement_Dan_Shipper.pdf"
3. Returns document with metadata

### Complex Query: "What's our burn rate?"
1. Query analyzer → Routes to AI Search
2. AI analyzes financial_summary.md + revenue_and_sales.md
3. Calculates from investment and revenue data
4. Returns answer with detailed source attribution:
   ```
   Answer: "Based on the financial data, your burn rate is approximately $125,000/month"
   
   Sources:
   - financial_summary.md > "Total Raised" section
     Original: 03_Finance/SAFE_Agreement_Seed_2023.pdf
     "Total capital raised: $1,500,000"
   
   - revenue_and_sales.md > "Monthly Revenue" section  
     Original: 04_Sales/Customer_Agreement_Enterprise.pdf
     "Monthly recurring revenue: $25,000"
   ```

### Hybrid Query: "Show me unsigned NDAs"
1. Fast Match finds all NDAs
2. Filters by status != "executed"
3. If results are unclear, AI provides context
4. Returns filtered list with explanations

## Implementation Phases

### Phase 1: Foundation (Week 1)
- [ ] Implement query complexity analyzer
- [ ] Build enhanced matcher with fuzzy/synonym support
- [ ] Create memory file indexer
- [ ] Set up basic routing logic

### Phase 2: AI Integration (Week 2)
- [ ] Implement AI search service
- [ ] Create optimized prompts for different query types
- [ ] Build result parser for AI responses
- [ ] Add fallback handling

### Phase 3: Optimization (Week 3)
- [ ] Implement result merging logic
- [ ] Add response caching
- [ ] Create feedback loop for failed queries
- [ ] Performance optimization

### Phase 4: Polish (Week 4)
- [ ] Add query suggestion system
- [ ] Implement conversation context
- [ ] Create analytics dashboard
- [ ] User acceptance testing

## Source Attribution & Verification

### Every Answer Must Include:

1. **Primary Source**
   - Memory file name and section
   - Original document path
   - Specific excerpt used

2. **Attribution Chain**
   ```
   User Query: "What's our total investment?"
   ↓
   AI Answer: "$1.5M total raised"
   ↓
   Memory Source: financial_summary.md > "Investment Rounds"
   ↓
   Original Doc: 03_Finance/SAFE_Agreement_Seed_2023.pdf
   ↓
   Verification: User can click to open original PDF
   ```

3. **Discord Display Format**
   ```markdown
   **Answer:** Your total investment raised is $1.5M across 2 rounds.
   
   **Sources:**
   📄 `financial_summary.md` → Investment Rounds
      • Seed: $500k (Source: SAFE_Agreement_Seed_2023.pdf)
      • Series A: $1M (Source: Series_A_Stock_Purchase_2024.pdf)
   
   **View Documents:**
   • [SAFE Agreement](/path/to/SAFE_Agreement_Seed_2023.pdf)
   • [Series A Agreement](/path/to/Series_A_Stock_Purchase_2024.pdf)
   ```

### Implementation Details:

```typescript
interface AIResponse {
  answer: string;
  sources: {
    fact: string;
    memoryFile: string;
    memorySection: string;
    originalDocPath: string;
    confidence: number;
    excerpt: string;
  }[];
  relatedDocs: string[];
}
```

## Benefits of Hybrid Approach

### Speed + Intelligence
- Simple queries: <100ms with fast matching
- Complex queries: 1-2s with AI analysis
- Fallback: AI helps when fast match fails

### Cost Efficiency
- Most queries use cheap fast matching
- AI only for complex questions
- Memory files small enough for single API call

### User Experience
- Natural language for everything
- Direct answers for complex questions
- Document links for simple searches
- Explanations when helpful

## Token Usage Estimation

```
Memory files: ~15,000 tokens
Query + System prompt: ~500 tokens
Relevant metadata (10 files): ~2,000 tokens
Response: ~1,000 tokens
────────────────────────────────
Total per complex query: ~18,500 tokens

Cost: ~$0.09 per complex query (GPT-4o)
```

## Success Metrics

### Quantitative
- Query success rate: >85% (from ~60%)
- Complex query support: 100% (from 0%)
- Response time: <100ms simple, <2s complex
- Zero results: <5% (from ~40%)

### Qualitative
- Natural language understanding
- Direct answers to questions
- Explanations and context
- Source attribution

## Example Queries Enabled

### Currently Impossible → Now Possible
- "What's our total raised capital?" → AI calculates from financial_summary.md
- "Which contracts need renewal soon?" → AI analyzes dates
- "Who has the most equity?" → AI reads cap table
- "Summarize our vendor relationships" → AI synthesizes data

### Currently Difficult → Now Easy
- "investment docs" → Expands to SAFE, notes, etc.
- "Dan's papers" → Fuzzy matches "Dan Shipper"
- "NDA tempate" → Handles typo + abbreviation

## Risk Mitigation

### AI Hallucination & Verification
- **Mandatory source citations** for every fact
- **Traceable path** from answer → memory file → original document
- **Confidence scores** on each source attribution
- **"I don't know"** response when sources are unclear
- **Verification UI** showing clickable source links

### Performance
- Cache AI responses
- Fast path for repeat queries
- Timeout handling

### Cost
- Monitor token usage
- Set daily limits if needed
- Optimize prompts for efficiency

## Conclusion

This hybrid approach leverages the best of both worlds:
- **Fast matching** for simple, direct queries
- **AI intelligence** for complex, analytical queries
- **Memory files** as a perfect-sized knowledge base
- **Existing infrastructure** with minimal changes

By sending all memory files (only ~15k tokens) to GPT-4o, we can answer virtually any question about the legal documents while maintaining fast response times for simple searches.