<github_issue>
# feat: Implement hybrid AI-powered search combining fast matching with GPT-4o analysis

## Overview

Create a hybrid search system that uses fast algorithmic matching for simple queries and GPT-4o analysis of memory files for complex questions.

## Problem Statement

Current search limitations:
- Can't answer analytical questions ("What's our burn rate?")
- Requires exact string matches
- Can't synthesize information across documents
- No understanding of context or intent

## Key Insight

Memory files are only ~57KB (~15k tokens) - perfect for sending to GPT-4o in a single request. This enables intelligent search without infrastructure changes.

## Proposed Solution

### Hybrid Architecture
```
Simple queries → Fast Match (fuzzy, synonyms) → <100ms
Complex queries → AI Search (GPT-4o + memory) → 1-2s
Failed fast match → Fallback to AI → Best results
```

### 1. Fast Match Path
For queries like "find SAFE agreement":
- Fuzzy matching (typo tolerance)
- Synonym expansion 
- Abbreviation handling
- Partial name matching

### 2. AI Search Path  
For queries like "What's our total investment?":
- Send all 15 memory files to GPT-4o
- Include relevant metadata
- Get direct answers with **detailed source attribution**
- Every fact traces back to: memory file → section → original document
- Natural language understanding

## Implementation Plan

### Week 1: Foundation
- [ ] Query complexity analyzer
- [ ] Enhanced fuzzy matcher
- [ ] Memory file indexer
- [ ] Basic routing logic

### Week 2: AI Integration
- [ ] GPT-4o search service
- [ ] Optimized prompts by query type
- [ ] Result parser for AI responses
- [ ] Error handling & fallbacks

### Week 3: Optimization
- [ ] Unified result format
- [ ] Response caching
- [ ] Performance tuning
- [ ] Query analytics

### Week 4: Polish
- [ ] Query suggestions
- [ ] Context awareness
- [ ] Testing & refinement
- [ ] Documentation

## Example Queries with Source Attribution

### Complex Query: "What's our burn rate?"
```
Answer: Your burn rate is approximately $125,000/month

Sources:
📄 financial_summary.md → "Total Raised" section
   • $1.5M raised (Source: SAFE_Agreement_Seed_2023.pdf)
📄 revenue_and_sales.md → "Monthly Revenue" 
   • $25k MRR (Source: Customer_Agreement_Enterprise.pdf)

View Documents: [SAFE Agreement] [Customer Agreement]
```

### Simple Query: "Find employment agreements"
```
Found 3 employment agreements:
• Employment_Agreement_Dan_Shipper.pdf
• Employment_Agreement_Jane_Doe.pdf  
• Contractor_Agreement_John_Smith.pdf
```

## Benefits

- **No new infrastructure** - Uses existing GPT-4o integration
- **Intelligent answers** - Not just document matching
- **Full source attribution** - Every fact traces to original documents
- **Verification enabled** - Users can double-check AI answers
- **Fast + Smart** - Simple queries stay fast
- **Cost effective** - ~$0.09 per complex query

## Success Metrics

- Query success rate: >85%
- Complex query support: Yes
- Response time: <100ms simple, <2s complex
- Natural language: Full support

## Technical Details

```typescript
// Route based on complexity
if (isSimpleQuery(query)) {
  return fastMatch(query);  // <100ms
} else {
  return aiSearch(query);   // 1-2s
}

// AI search includes all memory
const context = await loadMemoryFiles(); // ~15k tokens
const answer = await gpt4o.analyze(query, context);
```

This hybrid approach delivers both speed and intelligence without complex infrastructure changes.

🤖 Generated with [Claude Code](https://claude.ai/code)

Co-Authored-By: Claude <noreply@anthropic.com>
</github_issue>

---

## GitHub CLI Command

```bash
gh issue create \
  --title "feat: Implement hybrid AI-powered search combining fast matching with GPT-4o analysis" \
  --body "$(cat plans/2025-07-23-discord-search-improvement-issue-hybrid.md)" \
  --label "enhancement,discord-bot,search,ai" \
  --milestone "Q1 2025"
```