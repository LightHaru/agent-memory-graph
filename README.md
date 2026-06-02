# 🧠 Agent Memory Graph

> **Turn your AI agent's conversations into a living knowledge graph**

[![Version](https://img.shields.io/badge/version-0.21.0-blue.svg)](https://github.com/LightHaru/agent-memory-graph)
[![License](https://img.shields.io/badge/license-MIT-green.svg)](LICENSE)
[![OpenClaw](https://img.shields.io/badge/OpenClaw-%E2%89%A52026.3.24-orange.svg)](https://openclaw.ai)

## ✨ What is this?

**Agent Memory Graph** is an OpenClaw plugin that automatically builds a **searchable knowledge graph** from your AI conversations. No manual tagging, no complex setup — just install and watch your agent remember **everything**.

Every message your agent sees is analyzed for:
- 👤 **Entities** (people, projects, tools, locations, events...)
- 🔗 **Relationships** (who works on what, what connects to what...)
- 📊 **Properties** (versions, dates, statuses, descriptions...)

All stored in a **local SQLite database** with **semantic search** and **graph traversal** — giving your agent true long-term memory.

---

## 🎯 Why you need this

**Before Agent Memory Graph:**
- ❌ Your agent forgets everything after the conversation ends
- ❌ You have to repeat context every time
- ❌ No way to query "Who worked on what?" or "What's related to X?"
- ❌ Knowledge scattered across chat logs

**After Agent Memory Graph:**
- ✅ **Auto-extracts entities** from every conversation (URLs, people, projects, prices...)
- ✅ **Builds relationships** between entities automatically
- ✅ **Hybrid search** (keyword 40% + semantic 60%) finds what you need
- ✅ **Conversation context** (10 messages buffer) for accurate extraction
- ✅ **Natural language queries** like "What did Aira upgrade today?"
- ✅ **Graph traversal** to find how things connect

---

## 🚀 Quick Start

### Installation

```bash
# Install from npm
npm install agent-memory-graph

# Or install from GitHub
npm install https://github.com/LightHaru/agent-memory-graph
```

### OpenClaw Configuration

Add to your `openclaw.json`:

```json
{
  "plugins": {
    "allow": ["memory-graph"],
    "entries": {
      "memory-graph": {
        "enabled": true,
        "hooks": {
          "allowConversationAccess": true
        },
        "config": {
          "dbPath": "~/.openclaw/data/memory-graph.db",
          "autoIngest": true,
          "sessionSummary": true,
          "minConfidence": 0.7,
          "maxHops": 3
        }
      }
    }
  }
}
```

### Usage

Once installed, the plugin works **automatically** — no code changes needed!

**Manual extraction:**
```typescript
// Extract entities from text
memory_graph_ingest({
  text: "Aira upgraded memory-graph to v0.21.0 using multilingual-e5-large model",
  source: "manual-entry"
})
```

**Search entities:**
```typescript
// Keyword + semantic hybrid search
memory_graph_search({
  query: "memory graph plugin",
  limit: 10
})
```

**Natural language queries:**
```typescript
// Ask questions in plain English
memory_graph_query({
  question: "What projects is Aira working on?"
})
```

**Find connections:**
```typescript
// Shortest path between two entities
memory_graph_path({
  from: "Aira",
  to: "OpenClaw",
  maxHops: 3
})
```

---

## 🎨 Features

### 🔄 Conversation Context Buffer
Sees **10 previous messages** when extracting entities — understands pronouns, references, and context like a human.

**Before (v0.19):**
```
User: "Fix that bug"
Plugin: ❌ No idea what "that" refers to
```

**After (v0.21):**
```
User: "The memory plugin has a bug"
User: "Fix that bug"
Plugin: ✅ Extracts: memory plugin -[HAS_ISSUE]-> bug
```

### 🔍 Hybrid Search
Combines **keyword matching** (40%) and **semantic similarity** (60%) — finds what you mean, not just what you say.

```typescript
Query: "AI coding assistant"
Results:
  ✅ Claude Code (keyword match)
  ✅ Codex (semantic: similar concept)
  ✅ Cursor (semantic: IDE integration)
```

### 🌍 Multilingual Embedding
Upgraded from `bge-small-en-v1.5` (384d) → **`multilingual-e5-large` (1024d)**

- ✅ Better English understanding
- ✅ **Vietnamese support** (Tiếng Việt)
- ✅ Higher quality semantic vectors
- ✅ More accurate entity relationships

### 🤖 Auto-Extraction
Automatically detects and extracts:
- 🔗 URLs and links
- 💰 Prices and financial data
- 📧 @mentions and handles
- 📅 Dates and timestamps
- 🏷️ Hashtags and tags

### 📊 Rich Entity Properties
Every entity can have custom properties:

```json
{
  "entity": "memory-graph",
  "type": "Tool",
  "properties": {
    "version": "0.21.0",
    "status": "ready",
    "embedding_model": "multilingual-e5-large",
    "release_date": "2026-06-02"
  }
}
```

---

## 📖 Use Cases

### 🧑‍💻 Developer Agent Memory
Track what you've worked on, what bugs you fixed, what libraries you used:

```typescript
memory_graph_query({
  question: "What bugs did I fix in the last week?"
})

// Returns:
// - Fixed ENOENT bug in skill-creator
// - Resolved memory leak in agent-brain
// - Patched authentication issue in gateway
```

### 🤝 Team Collaboration
Remember who worked on what project:

```typescript
memory_graph_query({
  question: "Who contributed to the AiraCM dashboard?"
})

// Returns:
// - Aira: built content writer, SEO optimizer
// - Sếp: designed architecture, deployed infrastructure
```

### 📚 Research & Learning
Build a knowledge base from reading material:

```typescript
memory_graph_ingest({
  text: "Transformers are neural networks with attention mechanisms...",
  source: "research-paper"
})

memory_graph_query({
  question: "What are transformers used for?"
})
```

### 💼 Project Management
Track dependencies and relationships:

```typescript
memory_graph_path({
  from: "TinGameFi",
  to: "OpenClaw"
})

// Returns:
// TinGameFi -[USES]-> AiraCM -[RUNS_ON]-> OpenClaw
```

---

## 🛠️ Configuration

### Full Configuration Schema

```json
{
  "dbPath": "~/.openclaw/data/memory-graph.db",
  "autoIngest": true,
  "sessionSummary": true,
  "minConfidence": 0.7,
  "extractionModel": "",
  "maxHops": 3,
  "domains": []
}
```

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `dbPath` | `string` | `~/.openclaw/data/memory-graph.db` | SQLite database location |
| `autoIngest` | `boolean` | `true` | Auto-extract from every inbound message |
| `sessionSummary` | `boolean` | `true` | Summarize and ingest at session end |
| `minConfidence` | `number` | `0.7` | Min confidence threshold (0.0-1.0) |
| `extractionModel` | `string` | `""` | Model for extraction (empty = use default) |
| `maxHops` | `number` | `3` | Max graph traversal hops for path queries |
| `domains` | `array` | `[]` | Domain hints for better extraction |

### Domain Hints (Optional)

Improve extraction accuracy for specific domains:

```json
{
  "domains": [
    {
      "name": "software-development",
      "entityHints": ["repository", "commit", "pull request", "issue"],
      "relationHints": ["FIXES", "IMPLEMENTS", "DEPENDS_ON"]
    }
  ]
}
```

---

## 📊 Tools Reference

### `memory_graph_ingest`
Manually extract entities from text.

```typescript
memory_graph_ingest({
  text: string,
  source?: string
})
```

### `memory_graph_search`
Hybrid keyword + semantic search.

```typescript
memory_graph_search({
  query: string,
  limit?: number,
  type?: string
})
```

### `memory_graph_query`
Natural language queries.

```typescript
memory_graph_query({
  question: string
})
```

### `memory_graph_path`
Find shortest path between entities.

```typescript
memory_graph_path({
  from: string,
  to: string,
  maxHops?: number
})
```

### `memory_graph_stats`
Get database statistics.

```typescript
memory_graph_stats()
```

---

## 🧪 Testing

```bash
# Run all tests
npm test

# Run with coverage
npm test -- --coverage

# Watch mode
npm run test:watch
```

**Test Coverage: 100%** ✅
- Database operations
- Embedding generation
- Entity extraction
- Integration tests

---

## 🔧 Development

### Build

```bash
npm run build
```

### Lint

```bash
npm run lint
```

### Project Structure

```
agent-memory-graph/
├── src/
│   ├── database.ts          # SQLite operations
│   ├── embedding.ts         # Semantic embeddings
│   ├── extractor.ts         # Entity extraction
│   ├── index.ts             # Main plugin entry
│   ├── types.ts             # TypeScript types
│   └── __tests__/           # Test suite
├── dist/                    # Compiled output
├── openclaw.plugin.json     # Plugin metadata
├── package.json
└── README.md
```

---

## 📈 Performance

- **Database:** SQLite with FTS5 full-text search
- **Embedding:** Lazy-loaded Transformers.js (no startup penalty)
- **Memory:** ~50MB for 1000 entities with embeddings
- **Speed:** <100ms for most queries, <500ms for complex graph traversal

---

## 🤝 Contributing

Contributions welcome! Please:

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing`)
5. Open a Pull Request

---

## 📝 Changelog

### v0.21.0 (2026-06-02)
- ✨ **NEW:** Conversation context buffer (10 messages)
- ✨ **NEW:** Hybrid search (keyword 40% + semantic 60%)
- ⬆️ **UPGRADE:** Embedding model → multilingual-e5-large (1024d)
- ✨ **NEW:** Auto-extraction for URLs, prices, mentions
- 🐛 **FIX:** Entry path correction (dist/index.js)
- ✅ **TEST:** 100% test coverage

### v0.19.x
- Initial release
- Basic entity extraction
- Semantic search
- SQLite storage

---

## 📜 License

MIT License - see [LICENSE](LICENSE) for details.

---

## 💬 Support

- 📖 **Documentation:** [GitHub Wiki](https://github.com/LightHaru/agent-memory-graph/wiki)
- 🐛 **Bug Reports:** [GitHub Issues](https://github.com/LightHaru/agent-memory-graph/issues)
- 💡 **Feature Requests:** [GitHub Discussions](https://github.com/LightHaru/agent-memory-graph/discussions)

---

## 🌟 Acknowledgments

Built with:
- [OpenClaw](https://openclaw.ai) - AI agent framework
- [Transformers.js](https://huggingface.co/docs/transformers.js) - In-browser ML models
- [better-sqlite3](https://github.com/WiseLibs/better-sqlite3) - Fast SQLite driver

---

<p align="center">
  <strong>Made with ❤️ by <a href="https://github.com/LightHaru">LightHaru</a></strong>
  <br>
  <sub>Powering intelligent agents since 2026</sub>
</p>
