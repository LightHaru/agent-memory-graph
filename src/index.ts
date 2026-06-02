/**
 * Main plugin implementation
 * Production-grade knowledge graph with conversation context injection
 */

import path from 'path';
import { GraphDatabase } from './database';
import { EmbeddingService } from './embedding';
import { EntityExtractor } from './extractor';
import {
  Entity,
  Relationship,
  ConversationMessage,
  SearchResult,
  ContextInjection,
  PluginConfig,
  PluginAPI
} from './types';

export class MemoryGraphPlugin implements PluginAPI {
  private db: GraphDatabase;
  private embedding: EmbeddingService;
  private extractor: EntityExtractor;
  private config: PluginConfig;

  constructor(config: Partial<PluginConfig> = {}) {
    this.config = {
      dbPath: config.dbPath || path.join(process.env.HOME || '', '.openclaw', 'memory-graph.db'),
      embeddingModel: config.embeddingModel || 'Xenova/multilingual-e5-large',
      conversationWindowSize: config.conversationWindowSize || 10,
      maxContextTokens: config.maxContextTokens || 2000,
      enableAutoExtraction: config.enableAutoExtraction !== false,
      contextPriority: config.contextPriority || ['conversation', 'semantic', 'graph', 'working']
    };

    this.db = new GraphDatabase(this.config.dbPath);
    this.embedding = new EmbeddingService();
    this.extractor = new EntityExtractor();
  }

  async initialize(): Promise<void> {
    await this.embedding.initialize();
    console.log('[memory-graph] Plugin initialized');
  }

  // Entity operations
  async addEntity(entity: Omit<Entity, 'id' | 'createdAt' | 'updatedAt' | 'lastAccessedAt'>): Promise<string> {
    const id = this.db.addEntity(entity);
    
    // Auto-generate embedding if enabled
    if (this.config.enableAutoExtraction && !entity.embedding) {
      const embedding = await this.embedding.embed(entity.name);
      this.db.updateEntityEmbedding(id, embedding);
    }

    return id;
  }

  async addRelationship(rel: Omit<Relationship, 'id' | 'createdAt'>): Promise<string> {
    return this.db.addRelationship(rel);
  }

  // Search operations
  async searchKeyword(query: string, limit = 10): Promise<SearchResult[]> {
    const entities = this.db.searchEntitiesByKeyword(query, limit);
    
    return entities.map(entity => ({
      entity,
      score: this.calculateKeywordScore(query, entity),
      source: 'keyword' as const
    }));
  }

  async searchSemantic(query: string, limit = 10): Promise<SearchResult[]> {
    const queryEmbedding = await this.embedding.embed(query);
    const entities = this.db.getAllEntitiesWithEmbeddings();

    const results: SearchResult[] = entities
      .map(entity => ({
        entity,
        score: entity.embedding 
          ? this.embedding.cosineSimilarity(queryEmbedding, entity.embedding)
          : 0,
        source: 'semantic' as const
      }))
      .filter(r => r.score > 0.5)
      .sort((a, b) => b.score - a.score)
      .slice(0, limit);

    // Touch accessed entities
    results.forEach(r => this.db.touchEntity(r.entity.id));

    return results;
  }

  async searchHybrid(query: string, limit = 10): Promise<SearchResult[]> {
    const [keywordResults, semanticResults] = await Promise.all([
      this.searchKeyword(query, limit),
      this.searchSemantic(query, limit)
    ]);

    // Merge and deduplicate
    const merged = new Map<string, SearchResult>();

    keywordResults.forEach(r => {
      merged.set(r.entity.id, {
        ...r,
        score: r.score * 0.4 // 40% weight for keyword
      });
    });

    semanticResults.forEach(r => {
      const existing = merged.get(r.entity.id);
      if (existing) {
        existing.score += r.score * 0.6; // 60% weight for semantic
      } else {
        merged.set(r.entity.id, {
          ...r,
          score: r.score * 0.6
        });
      }
    });

    return Array.from(merged.values())
      .sort((a, b) => b.score - a.score)
      .slice(0, limit);
  }

  // Conversation context
  async addConversationMessage(msg: ConversationMessage): Promise<void> {
    // Auto-extract entities if enabled
    if (this.config.enableAutoExtraction) {
      const extracted = this.extractor.extract(msg.content);
      
      const entityIds: string[] = [];
      for (const ext of extracted) {
        const id = await this.addEntity({
          name: ext.value,
          type: ext.type,
          attributes: { context: ext.context },
          confidence: ext.confidence
        });
        entityIds.push(id);
      }

      msg.entities = entityIds;
    }

    this.db.addConversation(msg);
  }

  async getConversationWindow(size?: number): Promise<ConversationMessage[]> {
    return this.db.getConversationWindow(size || this.config.conversationWindowSize);
  }

  async injectContext(query: string): Promise<ContextInjection> {
    // 1. Get conversation window (highest priority)
    const conversationWindow = await this.getConversationWindow();

    // 2. Search relevant entities (semantic + keyword)
    const relevantEntities = await this.searchHybrid(query, 5);

    // 3. Get graph context (relationships of relevant entities)
    const graphContext: string[] = [];
    for (const result of relevantEntities.slice(0, 3)) {
      const relationships = this.db.getRelationships(result.entity.id);
      relationships.forEach(rel => {
        graphContext.push(`${rel.from} --[${rel.type}]--> ${rel.to}`);
      });
    }

    // Determine priority based on context availability
    let priority: 'conversation' | 'semantic' | 'graph' | 'working' = 'working';
    if (conversationWindow.length > 0) {
      priority = 'conversation';
    } else if (relevantEntities.length > 0) {
      priority = 'semantic';
    } else if (graphContext.length > 0) {
      priority = 'graph';
    }

    return {
      conversationWindow,
      relevantEntities,
      graphContext,
      priority
    };
  }

  // Entity extraction
  async extractEntities(text: string): Promise<Array<{type: string; value: string; confidence: number}>> {
    return this.extractor.extract(text);
  }

  // Graph operations
  async getEntity(id: string): Promise<Entity | null> {
    return this.db.getEntity(id);
  }

  async getRelationships(entityId: string): Promise<Relationship[]> {
    return this.db.getRelationships(entityId);
  }

  async findPath(fromId: string, toId: string, maxHops = 3): Promise<string[]> {
    // BFS to find shortest path
    const queue: Array<{id: string; path: string[]}> = [{id: fromId, path: [fromId]}];
    const visited = new Set<string>([fromId]);

    while (queue.length > 0) {
      const current = queue.shift()!;
      
      if (current.path.length > maxHops + 1) continue;
      if (current.id === toId) return current.path;

      const relationships = this.db.getRelationships(current.id);
      
      for (const rel of relationships) {
        const nextId = rel.from === current.id ? rel.to : rel.from;
        
        if (!visited.has(nextId)) {
          visited.add(nextId);
          queue.push({
            id: nextId,
            path: [...current.path, nextId]
          });
        }
      }
    }

    return []; // No path found
  }

  // Temporal operations
  async supersede(entityId: string, relation: string, oldTarget: string, newTarget: string): Promise<void> {
    this.db.supersede(entityId, relation, oldTarget, newTarget);
  }

  async queryTemporal(entityId: string, timestamp?: number): Promise<Relationship[]> {
    return this.db.getRelationships(entityId, timestamp);
  }

  // Maintenance
  async generateEmbeddings(batchSize = 20): Promise<number> {
    const needEmbedding = this.db.getEntitiesWithoutEmbeddings();

    let generated = 0;
    for (let i = 0; i < needEmbedding.length; i += batchSize) {
      const batch = needEmbedding.slice(i, i + batchSize);
      const texts = batch.map(e => e.name);
      const embeddings = await this.embedding.embedBatch(texts);

      batch.forEach((entity, idx) => {
        this.db.updateEntityEmbedding(entity.id, embeddings[idx]);
        generated++;
      });
    }

    return generated;
  }

  async decay(rate = 0.01): Promise<void> {
    this.db.decay(rate);
  }

  async stats(): Promise<{entities: number; relationships: number; conversations: number}> {
    return this.db.stats();
  }

  close(): void {
    this.db.close();
  }

  // Helper methods
  private calculateKeywordScore(query: string, entity: Entity): number {
    const queryLower = query.toLowerCase();
    const nameLower = entity.name.toLowerCase();
    const typeLower = entity.type.toLowerCase();

    let score = 0;

    // Exact match
    if (nameLower === queryLower) score += 1.0;
    else if (nameLower.includes(queryLower)) score += 0.7;
    else if (queryLower.includes(nameLower)) score += 0.5;

    // Type match
    if (typeLower.includes(queryLower)) score += 0.3;

    // Confidence boost
    score *= entity.confidence;

    return Math.min(score, 1.0);
  }
}

// OpenClaw plugin exports
export default MemoryGraphPlugin;
export * from './types';
