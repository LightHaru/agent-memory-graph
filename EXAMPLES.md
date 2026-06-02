# Memory Graph Plugin Examples

## Example 1: Pearl OTC Conversation

```typescript
import { MemoryGraphPlugin } from '@openclaw/plugin-memory-graph';

const plugin = new MemoryGraphPlugin();
await plugin.initialize();

// User asks about Pearl OTC
await plugin.addConversationMessage({
  role: 'user',
  content: 'What is Pearl OTC and where can I find it?',
  timestamp: Date.now()
});

// Assistant responds
await plugin.addConversationMessage({
  role: 'assistant',
  content: 'Pearl OTC is at https://pearl.exchange/otc - it offers competitive rates for large trades.',
  timestamp: Date.now()
});

// User asks follow-up
await plugin.addConversationMessage({
  role: 'user',
  content: 'What are the rates for 0.5 ETH?',
  timestamp: Date.now()
});

// Inject context for response
const context = await plugin.injectContext('Pearl OTC rates');

console.log('Conversation window:', context.conversationWindow.length); // 3
console.log('Priority:', context.priority); // 'conversation'
console.log('Extracted entities:', context.relevantEntities.length); // URLs, prices

// Use context in your response generation
const prompt = `
Based on this conversation:
${context.conversationWindow.map(m => `${m.role}: ${m.content}`).join('\n')}

Answer the user's question about Pearl OTC rates.
`;
```

## Example 2: Building a Knowledge Base

```typescript
// Add entities
const ethereumId = await plugin.addEntity({
  name: 'Ethereum',
  type: 'Cryptocurrency',
  attributes: {
    symbol: 'ETH',
    website: 'https://ethereum.org'
  },
  confidence: 1.0
});

const vitalikId = await plugin.addEntity({
  name: 'Vitalik Buterin',
  type: 'Person',
  attributes: {
    role: 'Co-founder'
  },
  confidence: 1.0
});

// Add relationship
await plugin.addRelationship({
  from: vitalikId,
  to: ethereumId,
  type: 'FOUNDED',
  attributes: { year: 2015 },
  confidence: 1.0,
  validFrom: Date.now()
});

// Generate embeddings
await plugin.generateEmbeddings();

// Search
const results = await plugin.searchHybrid('Ethereum founder', 5);
console.log(results[0].entity.name); // 'Vitalik Buterin'
```

## Example 3: Tracking Job Changes

```typescript
// Alice works at Meta
const aliceId = await plugin.addEntity({
  name: 'Alice',
  type: 'Person',
  attributes: {},
  confidence: 1.0
});

const metaId = await plugin.addEntity({
  name: 'Meta',
  type: 'Company',
  attributes: {},
  confidence: 1.0
});

const googleId = await plugin.addEntity({
  name: 'Google',
  type: 'Company',
  attributes: {},
  confidence: 1.0
});

// Initial job
await plugin.addRelationship({
  from: aliceId,
  to: metaId,
  type: 'WORKS_AT',
  attributes: {},
  confidence: 1.0,
  validFrom: Date.now() - 365 * 24 * 60 * 60 * 1000 // 1 year ago
});

const changeTime = Date.now();

// Job change
await plugin.supersede(aliceId, 'WORKS_AT', metaId, googleId);

// Query past
const pastRels = await plugin.queryTemporal(aliceId, changeTime - 1000);
console.log(pastRels[0].to); // metaId

// Query present
const currentRels = await plugin.getRelationships(aliceId);
console.log(currentRels[0].to); // googleId
```

## Example 4: Auto-Extraction from Text

```typescript
// Enable auto-extraction
const plugin = new MemoryGraphPlugin({
  enableAutoExtraction: true
});
await plugin.initialize();

// Add message with rich content
await plugin.addConversationMessage({
  role: 'user',
  content: `
    We decided to buy 0.5 ETH at https://pearl.exchange/otc on 2024-12-25.
    Contact @alice for details. Price was $1,500 USD. #crypto #trading
  `,
  timestamp: Date.now()
});

// Check extracted entities
const stats = await plugin.stats();
console.log('Entities extracted:', stats.entities);

// Search for extracted entities
const urlResults = await plugin.searchKeyword('pearl.exchange');
const priceResults = await plugin.searchKeyword('1,500');
const dateResults = await plugin.searchKeyword('2024-12-25');

console.log('Found URL:', urlResults.length > 0);
console.log('Found price:', priceResults.length > 0);
console.log('Found date:', dateResults.length > 0);
```

## Example 5: Graph Traversal

```typescript
// Build a social network
const alice = await plugin.addEntity({ name: 'Alice', type: 'Person', attributes: {}, confidence: 1.0 });
const bob = await plugin.addEntity({ name: 'Bob', type: 'Person', attributes: {}, confidence: 1.0 });
const charlie = await plugin.addEntity({ name: 'Charlie', type: 'Person', attributes: {}, confidence: 1.0 });
const dave = await plugin.addEntity({ name: 'Dave', type: 'Person', attributes: {}, confidence: 1.0 });

// Alice -> Bob -> Charlie -> Dave
await plugin.addRelationship({
  from: alice, to: bob, type: 'KNOWS',
  attributes: {}, confidence: 1.0, validFrom: Date.now()
});

await plugin.addRelationship({
  from: bob, to: charlie, type: 'KNOWS',
  attributes: {}, confidence: 1.0, validFrom: Date.now()
});

await plugin.addRelationship({
  from: charlie, to: dave, type: 'KNOWS',
  attributes: {}, confidence: 1.0, validFrom: Date.now()
});

// Find path
const path = await plugin.findPath(alice, dave, 3);
console.log('Path:', path); // [alice, bob, charlie, dave]

// Get all relationships for Bob
const bobRels = await plugin.getRelationships(bob);
console.log('Bob knows:', bobRels.length, 'people');
```

## Example 6: Multilingual Search

```typescript
// Add entities in different languages
await plugin.addEntity({
  name: 'Blockchain Technology',
  type: 'Technology',
  attributes: { lang: 'en' },
  confidence: 1.0
});

await plugin.addEntity({
  name: 'Công nghệ Blockchain',
  type: 'Technology',
  attributes: { lang: 'vi' },
  confidence: 1.0
});

await plugin.addEntity({
  name: '区块链技术',
  type: 'Technology',
  attributes: { lang: 'zh' },
  confidence: 1.0
});

// Generate embeddings
await plugin.generateEmbeddings();

// Search in English
const enResults = await plugin.searchSemantic('blockchain', 5);
console.log('English search:', enResults.length);

// Search in Vietnamese
const viResults = await plugin.searchSemantic('công nghệ blockchain', 5);
console.log('Vietnamese search:', viResults.length);

// Search in Chinese
const zhResults = await plugin.searchSemantic('区块链', 5);
console.log('Chinese search:', zhResults.length);

// All should find similar entities due to multilingual embeddings
```

## Example 7: Context Priority System

```typescript
// Scenario 1: Conversation takes priority
await plugin.addConversationMessage({
  role: 'user',
  content: 'Tell me about Pearl OTC',
  timestamp: Date.now()
});

const context1 = await plugin.injectContext('Pearl');
console.log(context1.priority); // 'conversation'

// Scenario 2: Semantic search when no conversation
const plugin2 = new MemoryGraphPlugin({ dbPath: '/tmp/test2.db' });
await plugin2.initialize();

await plugin2.addEntity({
  name: 'Pearl Exchange',
  type: 'Platform',
  attributes: {},
  confidence: 1.0
});
await plugin2.generateEmbeddings();

const context2 = await plugin2.injectContext('Pearl');
console.log(context2.priority); // 'semantic'

// Scenario 3: Graph context when entities exist but no embeddings
const plugin3 = new MemoryGraphPlugin({ dbPath: '/tmp/test3.db' });
await plugin3.initialize();

const pearlId = await plugin3.addEntity({
  name: 'Pearl',
  type: 'Platform',
  attributes: {},
  confidence: 1.0
});

await plugin3.addRelationship({
  from: pearlId,
  to: pearlId,
  type: 'OFFERS',
  attributes: { service: 'OTC' },
  confidence: 1.0,
  validFrom: Date.now()
});

const context3 = await plugin3.injectContext('Pearl');
console.log(context3.priority); // 'graph'
```

## Example 8: Maintenance Tasks

```typescript
// Generate embeddings for all entities
const generated = await plugin.generateEmbeddings(20);
console.log(`Generated ${generated} embeddings`);

// Decay old entities (reduce confidence)
await plugin.decay(0.01);
console.log('Decayed old entities');

// Get stats
const stats = await plugin.stats();
console.log('Stats:', stats);
// { entities: 150, relationships: 300, conversations: 50 }

// Close plugin
plugin.close();
```

## Example 9: OpenClaw Integration

```typescript
// In your OpenClaw agent
import { MemoryGraphPlugin } from '@openclaw/plugin-memory-graph';

class MyAgent {
  private memoryGraph: MemoryGraphPlugin;

  async initialize() {
    this.memoryGraph = new MemoryGraphPlugin({
      dbPath: '~/.openclaw/my-agent-memory.db',
      conversationWindowSize: 10,
      enableAutoExtraction: true
    });
    await this.memoryGraph.initialize();
  }

  async handleMessage(role: 'user' | 'assistant', content: string) {
    // Track conversation
    await this.memoryGraph.addConversationMessage({
      role,
      content,
      timestamp: Date.now()
    });

    if (role === 'user') {
      // Inject context before generating response
      const context = await this.memoryGraph.injectContext(content);

      // Build prompt with context
      const prompt = this.buildPromptWithContext(content, context);

      // Generate response...
      const response = await this.generateResponse(prompt);

      // Track assistant response
      await this.memoryGraph.addConversationMessage({
        role: 'assistant',
        content: response,
        timestamp: Date.now()
      });

      return response;
    }
  }

  private buildPromptWithContext(query: string, context: any): string {
    return `
      # Conversation History
      ${context.conversationWindow.map(m => `${m.role}: ${m.content}`).join('\n')}

      # Relevant Knowledge
      ${context.relevantEntities.map(r => `- ${r.entity.name} (${r.entity.type})`).join('\n')}

      # Graph Context
      ${context.graphContext.join('\n')}

      # Current Query
      ${query}

      # Instructions
      Answer the query using the conversation history and relevant knowledge above.
    `;
  }
}
```

## Example 10: Testing

```typescript
// Run the Pearl OTC integration test
import { MemoryGraphPlugin } from '@openclaw/plugin-memory-graph';

async function testPearlOTC() {
  const plugin = new MemoryGraphPlugin({ dbPath: '/tmp/test-pearl.db' });
  await plugin.initialize();

  // Simulate conversation
  await plugin.addConversationMessage({
    role: 'user',
    content: 'What is Pearl OTC?',
    timestamp: Date.now()
  });

  await plugin.addConversationMessage({
    role: 'assistant',
    content: 'Pearl OTC is at https://pearl.exchange/otc',
    timestamp: Date.now()
  });

  await plugin.addConversationMessage({
    role: 'user',
    content: 'What are the rates?',
    timestamp: Date.now()
  });

  await plugin.addConversationMessage({
    role: 'assistant',
    content: 'Current rate is $1,500 for 0.5 ETH',
    timestamp: Date.now()
  });

  // Inject context
  const context = await plugin.injectContext('Pearl OTC rates');

  // Verify
  console.assert(context.conversationWindow.length === 4, 'Should have 4 messages');
  console.assert(context.priority === 'conversation', 'Should prioritize conversation');
  console.assert(context.relevantEntities.length > 0, 'Should extract entities');

  const stats = await plugin.stats();
  console.assert(stats.conversations === 4, 'Should track 4 conversations');
  console.assert(stats.entities > 0, 'Should extract entities');

  console.log('✅ Pearl OTC test passed');

  plugin.close();
}

testPearlOTC().catch(console.error);
```
