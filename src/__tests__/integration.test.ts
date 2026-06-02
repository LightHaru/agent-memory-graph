/**
 * Integration tests for MemoryGraphPlugin
 */

import fs from 'fs';
import path from 'path';
import { MemoryGraphPlugin } from '../index';

describe('MemoryGraphPlugin Integration', () => {
  let plugin: MemoryGraphPlugin;
  let dbPath: string;

  beforeEach(async () => {
    dbPath = path.join('/tmp', `test-integration-${Date.now()}.db`);
    plugin = new MemoryGraphPlugin({ dbPath });
    await plugin.initialize();
  });

  afterEach(() => {
    plugin.close();
    if (fs.existsSync(dbPath)) fs.unlinkSync(dbPath);
    if (fs.existsSync(`${dbPath}-shm`)) fs.unlinkSync(`${dbPath}-shm`);
    if (fs.existsSync(`${dbPath}-wal`)) fs.unlinkSync(`${dbPath}-wal`);
  });

  describe('Pearl OTC scenario', () => {
    it('should handle complete conversation flow', async () => {
      // User asks about Pearl OTC
      await plugin.addConversationMessage({
        role: 'user',
        content: 'What is Pearl OTC and where can I find it?',
        timestamp: Date.now()
      });

      // Assistant responds with URL
      await plugin.addConversationMessage({
        role: 'assistant',
        content: 'Pearl OTC is at https://pearl.exchange/otc - it offers competitive rates for large trades.',
        timestamp: Date.now()
      });

      // User asks about pricing
      await plugin.addConversationMessage({
        role: 'user',
        content: 'What are the rates for buying 0.5 ETH?',
        timestamp: Date.now()
      });

      // Assistant provides price
      await plugin.addConversationMessage({
        role: 'assistant',
        content: 'Current rate is approximately $1,500 USD for 0.5 ETH on Pearl OTC.',
        timestamp: Date.now()
      });

      // Verify conversation window
      const window = await plugin.getConversationWindow();
      expect(window).toHaveLength(4);

      // Verify entity extraction
      const stats = await plugin.stats();
      expect(stats.entities).toBeGreaterThan(0);
      expect(stats.conversations).toBe(4);

      // Search for Pearl
      const results = await plugin.searchKeyword('Pearl');
      expect(results.length).toBeGreaterThan(0);

      // Inject context for follow-up query
      const context = await plugin.injectContext('Pearl OTC rates');
      expect(context.conversationWindow).toHaveLength(4);
      expect(context.priority).toBe('conversation');
    });
  });

  describe('Hybrid search', () => {
    it('should combine keyword and semantic search', async () => {
      // Create plugin with auto-extraction disabled to control embeddings
      const plugin2 = new MemoryGraphPlugin({ 
        dbPath: '/tmp/test-hybrid-search.db',
        enableAutoExtraction: false 
      });
      await plugin2.initialize();

      // Manually add entities without embeddings
      const db = plugin2['db'];
      db.addEntity({
        name: 'Ethereum',
        type: 'Cryptocurrency',
        attributes: { symbol: 'ETH' },
        confidence: 1.0
      });

      db.addEntity({
        name: 'Bitcoin',
        type: 'Cryptocurrency',
        attributes: { symbol: 'BTC' },
        confidence: 1.0
      });

      db.addEntity({
        name: 'Blockchain',
        type: 'Technology',
        attributes: {},
        confidence: 1.0
      });

      // Generate embeddings
      const generated = await plugin2.generateEmbeddings();
      expect(generated).toBeGreaterThan(0);

      // Hybrid search
      const results = await plugin2.searchHybrid('crypto', 5);
      expect(results.length).toBeGreaterThan(0);

      // Should find cryptocurrency entities
      const cryptoResults = results.filter(r => 
        r.entity.type === 'Cryptocurrency'
      );
      expect(cryptoResults.length).toBeGreaterThan(0);
      
      plugin2.close();
    });
  });

  describe('Temporal relationships', () => {
    it('should track job changes over time', async () => {
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

      const pastTime = Date.now() - 10000;
      
      // Alice works at Meta
      await plugin.addRelationship({
        from: aliceId,
        to: metaId,
        type: 'WORKS_AT',
        attributes: {},
        confidence: 1.0,
        validFrom: pastTime
      });

      const changeTime = Date.now();

      // Alice moves to Google
      await plugin.supersede(aliceId, 'WORKS_AT', metaId, googleId);

      // Query past (before change)
      const pastRels = await plugin.queryTemporal(aliceId, changeTime - 1000);
      expect(pastRels.some(r => r.to === metaId)).toBe(true);

      // Query present
      const currentRels = await plugin.getRelationships(aliceId);
      const activeRels = currentRels.filter(r => !r.validUntil);
      expect(activeRels.some(r => r.to === googleId)).toBe(true);
    });
  });

  describe('Context injection', () => {
    it('should prioritize conversation over semantic search', async () => {
      // Add conversation
      await plugin.addConversationMessage({
        role: 'user',
        content: 'Tell me about Pearl OTC',
        timestamp: Date.now()
      });

      // Add unrelated entity
      await plugin.addEntity({
        name: 'Random Entity',
        type: 'Test',
        attributes: {},
        confidence: 1.0
      });

      // Inject context
      const context = await plugin.injectContext('Pearl');
      
      expect(context.priority).toBe('conversation');
      expect(context.conversationWindow.length).toBeGreaterThan(0);
    });

    it('should fall back to semantic when no conversation', async () => {
      // Add entity with embedding
      await plugin.addEntity({
        name: 'Blockchain Technology',
        type: 'Technology',
        attributes: {},
        confidence: 1.0
      });

      await plugin.generateEmbeddings();

      // Inject context without conversation
      const context = await plugin.injectContext('blockchain');
      
      expect(context.priority).toBe('semantic');
      expect(context.relevantEntities.length).toBeGreaterThan(0);
    });
  });

  describe('Graph traversal', () => {
    it('should find shortest path between entities', async () => {
      const aliceId = await plugin.addEntity({
        name: 'Alice',
        type: 'Person',
        attributes: {},
        confidence: 1.0
      });

      const bobId = await plugin.addEntity({
        name: 'Bob',
        type: 'Person',
        attributes: {},
        confidence: 1.0
      });

      const charlieId = await plugin.addEntity({
        name: 'Charlie',
        type: 'Person',
        attributes: {},
        confidence: 1.0
      });

      // Alice -> Bob -> Charlie
      await plugin.addRelationship({
        from: aliceId,
        to: bobId,
        type: 'KNOWS',
        attributes: {},
        confidence: 1.0,
        validFrom: Date.now()
      });

      await plugin.addRelationship({
        from: bobId,
        to: charlieId,
        type: 'KNOWS',
        attributes: {},
        confidence: 1.0,
        validFrom: Date.now()
      });

      const path = await plugin.findPath(aliceId, charlieId);
      expect(path).toEqual([aliceId, bobId, charlieId]);
    });
  });

  describe('Maintenance', () => {
    it('should decay old entities', async () => {
      const id = await plugin.addEntity({
        name: 'Old Entity',
        type: 'Test',
        attributes: {},
        confidence: 1.0
      });

      await plugin.decay(0.5);

      const entity = await plugin.getEntity(id);
      expect(entity!.confidence).toBeLessThanOrEqual(1.0);
    });

    it('should generate embeddings for entities without them', async () => {
      // Create plugin with auto-extraction disabled
      const plugin2 = new MemoryGraphPlugin({ 
        dbPath: '/tmp/test-no-auto-embed.db',
        enableAutoExtraction: false 
      });
      await plugin2.initialize();

      // Manually add entities without embeddings
      const db = plugin2['db'];
      db.addEntity({
        name: 'Test 1',
        type: 'Test',
        attributes: {},
        confidence: 1.0
      });

      db.addEntity({
        name: 'Test 2',
        type: 'Test',
        attributes: {},
        confidence: 1.0
      });

      const generated = await plugin2.generateEmbeddings();
      expect(generated).toBeGreaterThanOrEqual(2);
      
      plugin2.close();
    });
  });
});
