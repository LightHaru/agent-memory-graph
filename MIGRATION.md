# Migration Guide: v0.20.0 → v0.21.0

## Overview

Version 0.21.0 is a **production-grade upgrade** with conversation context injection, hybrid search, and multilingual embeddings. All v0.20.0 APIs are preserved for backward compatibility.

## What's New

### 1. Conversation Context Injection

**Before (v0.20.0):**
```typescript
// No conversation tracking
// Manual context management
```

**After (v0.21.0):**
```typescript
// Automatic conversation tracking
await plugin.addConversationMessage({
  role: 'user',
  content: 'What is Pearl OTC?',
  timestamp: Date.now()
});

// Inject context before response
const context = await plugin.injectContext('Pearl rates');
// Returns: {conversationWindow, relevantEntities, graphContext, priority}
```

### 2. Hybrid Search

**Before (v0.20.0):**
```typescript
// Only keyword search
const results = await plugin.searchKeyword('query');
```

**After (v0.21.0):**
```typescript
// Hybrid: keyword (40%) + semantic (60%)
const results = await plugin.searchHybrid('query', 10);
// Better relevance, multilingual support
```

### 3. Smart Entity Extraction

**Before (v0.20.0):**
```typescript
// Manual entity creation
await plugin.addEntity({name: 'URL', type: 'url', ...});
```

**After (v0.21.0):**
```typescript
// Auto-extraction from conversations
await plugin.addConversationMessage({
  role: 'user',
  content: 'Check https://pearl.exchange/otc for $1,500 USD',
  timestamp: Date.now()
});
// Automatically extracts: URL, price entities
```

### 4. Multilingual Embeddings

**Before (v0.20.0):**
- Model: `Xenova/bge-small-en-v1.5`
- Dimensions: 384
- Languages: English only

**After (v0.21.0):**
- Model: `Xenova/multilingual-e5-large`
- Dimensions: 1024
- Languages: 100+ (English, Vietnamese, Chinese, etc.)

## Migration Steps

### Step 1: Update Dependencies

```bash
cd ~/.openclaw/plugins/memory-graph
npm install
```

### Step 2: Rebuild

```bash
npm run build
```

### Step 3: Run Tests

```bash
npm test
```

### Step 4: Regenerate Embeddings (Optional)

Old 384d embeddings will continue to work, but for best results:

```typescript
// Regenerate with new 1024d model
await plugin.generateEmbeddings();
```

### Step 5: Update Code (Optional)

Add conversation tracking to your OpenClaw agent:

```typescript
// In your agent's message handler
async function handleMessage(role, content) {
  // Track conversation
  await memoryGraph.addConversationMessage({
    role,
    content,
    timestamp: Date.now()
  });

  // Inject context before generating response
  const context = await memoryGraph.injectContext(content);
  
  // Use context in your prompt
  const prompt = `
    Conversation history:
    ${context.conversationWindow.map(m => `${m.role}: ${m.content}`).join('\n')}
    
    Relevant entities:
    ${context.relevantEntities.map(r => r.entity.name).join(', ')}
    
    User query: ${content}
  `;
  
  // Generate response...
}
```

## Breaking Changes

**None.** All v0.20.0 APIs are preserved.

## New APIs

### Conversation APIs

```typescript
// Add conversation message
await plugin.addConversationMessage({
  role: 'user' | 'assistant',
  content: string,
  timestamp: number,
  entities?: string[] // optional, auto-extracted if enabled
});

// Get conversation window
const messages = await plugin.getConversationWindow(size?: number);

// Inject context
const context = await plugin.injectContext(query: string);
```

### Search APIs

```typescript
// Hybrid search (new, recommended)
const results = await plugin.searchHybrid(query: string, limit?: number);

// Existing APIs still work
const results = await plugin.searchKeyword(query, limit);
const results = await plugin.searchSemantic(query, limit);
```

### Extraction APIs

```typescript
// Extract entities from text
const entities = await plugin.extractEntities(text: string);
// Returns: [{type, value, confidence, context?}, ...]
```

## Configuration Changes

### New Config Options

```typescript
const config = {
  // New options
  conversationWindowSize: 10,        // default: 10
  maxContextTokens: 2000,            // default: 2000
  enableAutoExtraction: true,        // default: true
  contextPriority: [                 // default order
    'conversation',
    'semantic',
    'graph',
    'working'
  ],
  
  // Existing options (unchanged)
  dbPath: '~/.openclaw/memory-graph.db',
  embeddingModel: 'Xenova/multilingual-e5-large'
};
```

## Performance Impact

### Token Cost

- **Conversation window (10 messages)**: +500-1000 tokens per response
- **Semantic search (5 entities)**: +200-500 tokens per response
- **Total overhead**: ~800-1700 tokens per response

### Latency

- **Context injection**: +10-50ms per response
- **Embedding generation**: ~100ms per entity (one-time)
- **Semantic search**: ~50ms for 1000 entities

### Memory

- **Embedding model**: ~500MB RAM (loaded once)
- **Database**: ~1MB per 1000 entities
- **Conversation buffer**: ~10KB per 10 messages

## Rollback Plan

If you need to rollback to v0.20.0:

```bash
cd ~/.openclaw/plugins/memory-graph
git checkout v0.20.0
npm install
npm run build
```

Your database will continue to work (backward compatible).

## Testing Your Migration

### 1. Run Unit Tests

```bash
npm test
```

### 2. Test Pearl OTC Scenario

```typescript
// Add conversation
await plugin.addConversationMessage({
  role: 'user',
  content: 'What is Pearl OTC? https://pearl.exchange/otc',
  timestamp: Date.now()
});

await plugin.addConversationMessage({
  role: 'assistant',
  content: 'Pearl OTC offers competitive rates. Current: $1,500 for 0.5 ETH.',
  timestamp: Date.now()
});

// Inject context
const context = await plugin.injectContext('Pearl rates');

// Verify
console.assert(context.conversationWindow.length === 2);
console.assert(context.priority === 'conversation');
console.assert(context.relevantEntities.length > 0);
```

### 3. Test Hybrid Search

```typescript
await plugin.addEntity({
  name: 'Ethereum',
  type: 'Cryptocurrency',
  attributes: { symbol: 'ETH' },
  confidence: 1.0
});

await plugin.generateEmbeddings();

const results = await plugin.searchHybrid('crypto', 10);
console.assert(results.length > 0);
console.assert(results[0].entity.name === 'Ethereum');
```

## Common Issues

### Issue: Embeddings not generating

**Solution:**
```bash
# Check model download
ls ~/.cache/huggingface/

# Regenerate manually
await plugin.generateEmbeddings(10); // smaller batch
```

### Issue: Database locked

**Solution:**
```typescript
// Close existing connections
plugin.close();

// Reinitialize
plugin = new MemoryGraphPlugin(config);
await plugin.initialize();
```

### Issue: Out of memory

**Solution:**
```typescript
// Reduce batch size
await plugin.generateEmbeddings(5); // default: 20

// Or disable auto-extraction
const config = { enableAutoExtraction: false };
```

## Support

- GitHub Issues: https://github.com/openclaw/plugins/issues
- Discord: https://discord.gg/openclaw
- Docs: https://docs.openclaw.dev/plugins/memory-graph

## Next Steps

1. ✅ Update dependencies
2. ✅ Rebuild plugin
3. ✅ Run tests
4. ✅ Update agent code (optional)
5. ✅ Regenerate embeddings (optional)
6. 🚀 Deploy to production

Enjoy the new features! 🎉
