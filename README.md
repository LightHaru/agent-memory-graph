# Memory Graph Plugin v0.21.0

Production-grade knowledge graph with conversation context injection for OpenClaw.

## Features

### 🎯 Core Capabilities

- **Conversation Window Buffer** - Inject last 10 messages into context before response
- **Hybrid Search** - Combine keyword (40%) + semantic (60%) search with multilingual-e5-large
- **Smart Entity Extraction** - Auto-detect URLs, prices, decisions, dates, mentions, hashtags
- **Context Priority System** - conversation > semantic > graph > working memory
- **Temporal Relationships** - Track fact changes over time (Graphiti-inspired)
- **Graph Traversal** - Find shortest paths between entities (BFS, max 3 hops)

### 🚀 What's New in v0.21.0

- **Multilingual E5-Large** - Upgraded from bge-small-en (384d) to multilingual-e5-large (1024d)
- **Conversation Context Injection** - Automatic context injection before each response
- **Smart Entity Extraction** - Auto-extract entities from conversations
- **Production-Ready** - Full test suite, TypeScript, proper error handling
- **Backward Compatible** - Migrates from v0.20.0 seamlessly

## Installation

```bash
cd ~/.openclaw/plugins/memory-graph
npm install
npm run build
npm test
```

## Quick Start

```typescript
import { MemoryGraphPlugin } from '@openclaw/plugin-memory-graph';

// Initialize plugin
const plugin = new MemoryGraphPlugin({
  dbPath: '~/.openclaw/memory-graph.db',
  conversationWindowSize: 10,
  enableAutoExtraction: true
});

await plugin.initialize();

// Add conversation messages (auto-extracts entities)
await plugin.addConversationMessage({
  role: 'user',
  content: 'What is Pearl OTC? https://pearl.exchange/otc',
  timestamp: Date.now()
});

// Inject context for next response
const context = await plugin.injectContext('Pearl OTC rates');
console.log(context.conversationWindow); // Last 10 messages
console.log(context.relevantEntities);   // Semantic search results
console.log(context.priority);           // 'conversation'
```

## Usage Examples

### Pearl OTC Scenario

```typescript
// User asks about Pearl OTC
await plugin.addConversationMessage({
  role: 'user',
  content: 'What is Pearl OTC and where can I find it?',
  timestamp: Date.now()
});

// Assistant responds with URL
await plugin.addConversationMessage({
  role: 'assistant',
  content: 'Pearl OTC is at https://pearl.exchange/otc - competitive rates for large trades.',
  timestamp: Date.now()
});

// Later: inject context for follow-up
const context = await plugin.injectContext('Pearl rates');
// context.conversationWindow contains both messages
// context.relevantEntities contains extracted URL entity
// context.priority = 'conversation' (highest priority)
```

### Hybrid Search

```typescript
// Add entities
await plugin.addEntity({
  name: 'Ethereum',
  type: 'Cryptocurrency',
  attributes: { symbol: 'ETH' },
  confidence: 1.0
});

// Generate embeddings
await plugin.generateEmbeddings();

// Hybrid search (keyword + semantic)
const results = await plugin.searchHybrid('crypto', 10);
// Returns: [{entity, score, source: 'keyword'|'semantic'}, ...]
```

### Temporal Relationships

```typescript
// Alice works at Meta
await plugin.addRelationship({
  from: aliceId,
  to: metaId,
  type: 'WORKS_AT',
  attributes: {},
  confidence: 1.0,
  validFrom: Date.now()
});

// Alice moves to Google
await plugin.supersede(aliceId, 'WORKS_AT', metaId, googleId);

// Query past
const pastRels = await plugin.queryTemporal(aliceId, pastTimestamp);
// Returns: Alice -> Meta

// Query present
const currentRels = await plugin.getRelationships(aliceId);
// Returns: Alice -> Google
```

### Graph Traversal

```typescript
// Find path: Alice -> Bob -> Charlie
const path = await plugin.findPath(aliceId, charlieId, 3);
// Returns: [aliceId, bobId, charlieId]
```

## API Reference

### Core Operations

```typescript
// Add entity (auto-generates embedding)
const id = await plugin.addEntity({
  name: 'Entity Name',
  type: 'EntityType',
  attributes: { key: 'value' },
  confidence: 1.0
});

// Add relationship
await plugin.addRelationship({
  from: entityId1,
  to: entityId2,
  type: 'RELATION_TYPE',
  attributes: {},
  confidence: 1.0,
  validFrom: Date.now()
});
```

### Search Operations

```typescript
// Keyword search
const results = await plugin.searchKeyword('query', 10);

// Semantic search (requires embeddings)
const results = await plugin.searchSemantic('query', 10);

// Hybrid search (recommended)
const results = await plugin.searchHybrid('query', 10);
```

### Conversation Context

```typescript
// Add message (auto-extracts entities)
await plugin.addConversationMessage({
  role: 'user' | 'assistant',
  content: 'message text',
  timestamp: Date.now()
});

// Get conversation window
const messages = await plugin.getConversationWindow(10);

// Inject context (use before generating response)
const context = await plugin.injectContext('query');
// Returns: {conversationWindow, relevantEntities, graphContext, priority}
```

### Maintenance

```typescript
// Generate embeddings for entities without them
const count = await plugin.generateEmbeddings(20); // batch size

// Decay old entities (reduce confidence)
await plugin.decay(0.01); // decay rate

// Get stats
const stats = await plugin.stats();
// Returns: {entities, relationships, conversations}
```

## Configuration

```typescript
const config = {
  dbPath: '~/.openclaw/memory-graph.db',
  embeddingModel: 'Xenova/multilingual-e5-large',
  conversationWindowSize: 10,
  maxContextTokens: 2000,
  enableAutoExtraction: true,
  contextPriority: ['conversation', 'semantic', 'graph', 'working']
};
```

## Testing

```bash
# Run all tests
npm test

# Run with coverage
npm test -- --coverage

# Watch mode
npm run test:watch
```

### Test Coverage

- ✅ Embedding service (multilingual-e5-large)
- ✅ Database operations (entities, relationships, conversations)
- ✅ Entity extraction (URLs, prices, decisions, dates)
- ✅ Hybrid search (keyword + semantic)
- ✅ Conversation context injection
- ✅ Temporal relationships
- ✅ Graph traversal
- ✅ Pearl OTC scenario (integration test)

## Migration from v0.20.0

The plugin is backward compatible. Existing databases will work without changes.

### Breaking Changes

None. All v0.20.0 APIs are preserved.

### New Features

- `addConversationMessage()` - Add conversation messages
- `getConversationWindow()` - Get last N messages
- `injectContext()` - Inject context before response
- `extractEntities()` - Extract entities from text
- `searchHybrid()` - Hybrid keyword + semantic search

### Embedding Model Upgrade

Old: `Xenova/bge-small-en-v1.5` (384d, English only)
New: `Xenova/multilingual-e5-large` (1024d, multilingual)

Existing embeddings will be regenerated automatically on first use.

## Performance

- **Embedding generation**: ~100ms per entity (batch of 20)
- **Semantic search**: ~50ms for 1000 entities
- **Conversation injection**: ~10ms for 10 messages
- **Database operations**: <5ms per query

## Token Cost

- **Conversation window (10 messages)**: ~500-1000 tokens
- **Semantic search results (5 entities)**: ~200-500 tokens
- **Graph context (3 relationships)**: ~100-200 tokens
- **Total context injection**: ~800-1700 tokens per response

## Architecture

```
┌─────────────────────────────────────────┐
│         MemoryGraphPlugin               │
├─────────────────────────────────────────┤
│  - Conversation Window Buffer           │
│  - Context Injection                    │
│  - Entity Extraction                    │
│  - Hybrid Search                        │
└─────────────────────────────────────────┘
         │              │              │
         ▼              ▼              ▼
┌──────────────┐ ┌──────────────┐ ┌──────────────┐
│  Database    │ │  Embedding   │ │  Extractor   │
│  (SQLite)    │ │  (E5-Large)  │ │  (Regex)     │
└──────────────┘ └──────────────┘ └──────────────┘
```

## Troubleshooting

### Embeddings not working

```bash
# Regenerate embeddings
await plugin.generateEmbeddings();
```

### Database locked

```bash
# Close existing connections
plugin.close();
```

### Out of memory

```bash
# Reduce batch size
await plugin.generateEmbeddings(10); // default: 20
```

## Contributing

1. Fork the repo
2. Create feature branch
3. Add tests
4. Run `npm test`
5. Submit PR

## License

MIT

## Credits

- Inspired by [Graphiti](https://github.com/getzep/graphiti) temporal knowledge graphs
- Uses [Xenova/transformers.js](https://github.com/xenova/transformers.js) for embeddings
- Built for [OpenClaw](https://github.com/openclaw/openclaw)

## Support

- GitHub Issues: https://github.com/openclaw/plugins/issues
- Discord: https://discord.gg/openclaw
- Docs: https://docs.openclaw.dev/plugins/memory-graph
