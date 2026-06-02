/**
 * Memory Graph Plugin v0.21.0
 * Production-grade knowledge graph with conversation context injection
 */

export interface Entity {
  id: string;
  name: string;
  type: string;
  attributes: Record<string, any>;
  embedding?: number[];
  confidence: number;
  createdAt: number;
  updatedAt: number;
  lastAccessedAt: number;
}

export interface Relationship {
  id: string;
  from: string;
  to: string;
  type: string;
  attributes: Record<string, any>;
  confidence: number;
  validFrom: number;
  validUntil?: number;
  supersededBy?: string;
  createdAt: number;
}

export interface ConversationMessage {
  role: 'user' | 'assistant';
  content: string;
  timestamp: number;
  entities?: string[];
}

export interface SearchResult {
  entity: Entity;
  score: number;
  source: 'keyword' | 'semantic' | 'graph' | 'conversation';
}

export interface ContextInjection {
  conversationWindow: ConversationMessage[];
  relevantEntities: SearchResult[];
  graphContext: string[];
  priority: 'conversation' | 'semantic' | 'graph' | 'working';
}

export interface PluginConfig {
  dbPath: string;
  embeddingModel: string;
  conversationWindowSize: number;
  maxContextTokens: number;
  enableAutoExtraction: boolean;
  contextPriority: string[];
}

export interface PluginAPI {
  // Core operations
  addEntity(entity: Omit<Entity, 'id' | 'createdAt' | 'updatedAt' | 'lastAccessedAt'>): Promise<string>;
  addRelationship(rel: Omit<Relationship, 'id' | 'createdAt'>): Promise<string>;
  
  // Search operations
  searchKeyword(query: string, limit?: number): Promise<SearchResult[]>;
  searchSemantic(query: string, limit?: number): Promise<SearchResult[]>;
  searchHybrid(query: string, limit?: number): Promise<SearchResult[]>;
  
  // Conversation context
  addConversationMessage(msg: ConversationMessage): Promise<void>;
  getConversationWindow(size?: number): Promise<ConversationMessage[]>;
  injectContext(query: string): Promise<ContextInjection>;
  
  // Entity extraction
  extractEntities(text: string): Promise<Array<{type: string; value: string; confidence: number}>>;
  
  // Graph operations
  getEntity(id: string): Promise<Entity | null>;
  getRelationships(entityId: string): Promise<Relationship[]>;
  findPath(fromId: string, toId: string, maxHops?: number): Promise<string[]>;
  
  // Temporal operations
  supersede(entityId: string, relation: string, oldTarget: string, newTarget: string): Promise<void>;
  queryTemporal(entityId: string, timestamp?: number): Promise<Relationship[]>;
  
  // Maintenance
  generateEmbeddings(batchSize?: number): Promise<number>;
  decay(rate?: number): Promise<void>;
  stats(): Promise<{entities: number; relationships: number; conversations: number}>;
}
