/**
 * Unit tests for GraphDatabase
 */

import fs from 'fs';
import path from 'path';
import { GraphDatabase } from '../database';

describe('GraphDatabase', () => {
  let db: GraphDatabase;
  let dbPath: string;

  beforeEach(() => {
    dbPath = path.join('/tmp', `test-${Date.now()}.db`);
    db = new GraphDatabase(dbPath);
  });

  afterEach(() => {
    db.close();
    if (fs.existsSync(dbPath)) fs.unlinkSync(dbPath);
    if (fs.existsSync(`${dbPath}-shm`)) fs.unlinkSync(`${dbPath}-shm`);
    if (fs.existsSync(`${dbPath}-wal`)) fs.unlinkSync(`${dbPath}-wal`);
  });

  describe('Entity operations', () => {
    it('should add and retrieve entity', () => {
      const id = db.addEntity({
        name: 'Alice',
        type: 'Person',
        attributes: { role: 'Developer' },
        confidence: 1.0
      });

      const entity = db.getEntity(id);
      expect(entity).not.toBeNull();
      expect(entity!.name).toBe('Alice');
      expect(entity!.type).toBe('Person');
      expect(entity!.attributes.role).toBe('Developer');
    });

    it('should search entities by keyword', () => {
      db.addEntity({ name: 'Alice', type: 'Person', attributes: {}, confidence: 1.0 });
      db.addEntity({ name: 'Bob', type: 'Person', attributes: {}, confidence: 1.0 });
      db.addEntity({ name: 'Charlie', type: 'Person', attributes: {}, confidence: 1.0 });

      const results = db.searchEntitiesByKeyword('Alice');
      expect(results).toHaveLength(1);
      expect(results[0].name).toBe('Alice');
    });

    it('should update entity embedding', () => {
      const id = db.addEntity({
        name: 'Test',
        type: 'Entity',
        attributes: {},
        confidence: 1.0
      });

      const embedding = new Array(1024).fill(0).map(() => Math.random());
      db.updateEntityEmbedding(id, embedding);

      const entity = db.getEntity(id);
      expect(entity!.embedding).toHaveLength(1024);
    });

    it('should touch entity to update last accessed time', () => {
      const id = db.addEntity({
        name: 'Test',
        type: 'Entity',
        attributes: {},
        confidence: 1.0
      });

      const before = db.getEntity(id)!.lastAccessedAt;
      
      // Wait a bit
      const wait = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));
      return wait(10).then(() => {
        db.touchEntity(id);
        const after = db.getEntity(id)!.lastAccessedAt;
        expect(after).toBeGreaterThan(before);
      });
    });
  });

  describe('Relationship operations', () => {
    it('should add and retrieve relationships', () => {
      const aliceId = db.addEntity({ name: 'Alice', type: 'Person', attributes: {}, confidence: 1.0 });
      const bobId = db.addEntity({ name: 'Bob', type: 'Person', attributes: {}, confidence: 1.0 });

      const relId = db.addRelationship({
        from: aliceId,
        to: bobId,
        type: 'KNOWS',
        attributes: {},
        confidence: 1.0,
        validFrom: Date.now()
      });

      const rels = db.getRelationships(aliceId);
      expect(rels).toHaveLength(1);
      expect(rels[0].type).toBe('KNOWS');
    });

    it('should supersede relationships', () => {
      const aliceId = db.addEntity({ name: 'Alice', type: 'Person', attributes: {}, confidence: 1.0 });
      const metaId = db.addEntity({ name: 'Meta', type: 'Company', attributes: {}, confidence: 1.0 });
      const googleId = db.addEntity({ name: 'Google', type: 'Company', attributes: {}, confidence: 1.0 });

      db.addRelationship({
        from: aliceId,
        to: metaId,
        type: 'WORKS_AT',
        attributes: {},
        confidence: 1.0,
        validFrom: Date.now()
      });

      db.supersede(aliceId, 'WORKS_AT', metaId, googleId);

      const rels = db.getRelationships(aliceId);
      const current = rels.filter(r => !r.validUntil);
      
      expect(current).toHaveLength(1);
      expect(current[0].to).toBe(googleId);
    });

    it('should query temporal relationships', () => {
      const aliceId = db.addEntity({ name: 'Alice', type: 'Person', attributes: {}, confidence: 1.0 });
      const metaId = db.addEntity({ name: 'Meta', type: 'Company', attributes: {}, confidence: 1.0 });

      const pastTime = Date.now() - 1000;
      db.addRelationship({
        from: aliceId,
        to: metaId,
        type: 'WORKS_AT',
        attributes: {},
        confidence: 1.0,
        validFrom: pastTime,
        validUntil: Date.now()
      });

      const pastRels = db.getRelationships(aliceId, pastTime + 100);
      expect(pastRels).toHaveLength(1);

      const currentRels = db.getRelationships(aliceId);
      expect(currentRels).toHaveLength(0);
    });
  });

  describe('Conversation operations', () => {
    it('should add and retrieve conversation messages', () => {
      const baseTime = Date.now();
      
      db.addConversation({
        role: 'user',
        content: 'Hello',
        timestamp: baseTime
      });

      db.addConversation({
        role: 'assistant',
        content: 'Hi there',
        timestamp: baseTime + 1000
      });

      const window = db.getConversationWindow(10);
      expect(window).toHaveLength(2);
      expect(window[0].role).toBe('user');
      expect(window[1].role).toBe('assistant');
    });

    it('should limit conversation window size', () => {
      const baseTime = Date.now();
      for (let i = 0; i < 20; i++) {
        db.addConversation({
          role: i % 2 === 0 ? 'user' : 'assistant',
          content: `Message ${i}`,
          timestamp: baseTime + i * 1000
        });
      }

      const window = db.getConversationWindow(5);
      expect(window).toHaveLength(5);
      expect(window[4].content).toBe('Message 19');
    });
  });

  describe('Maintenance operations', () => {
    it('should decay old entities', () => {
      const id = db.addEntity({
        name: 'Old Entity',
        type: 'Test',
        attributes: {},
        confidence: 1.0
      });

      // Simulate old entity
      const thirtyOneDaysAgo = Date.now() - 31 * 24 * 60 * 60 * 1000;
      db['db'].prepare('UPDATE entities SET last_accessed_at = ? WHERE id = ?')
        .run(thirtyOneDaysAgo, id);

      db.decay(0.1);

      const entity = db.getEntity(id);
      expect(entity!.confidence).toBeLessThan(1.0);
    });

    it('should return stats', () => {
      db.addEntity({ name: 'E1', type: 'Test', attributes: {}, confidence: 1.0 });
      db.addEntity({ name: 'E2', type: 'Test', attributes: {}, confidence: 1.0 });
      db.addConversation({ role: 'user', content: 'Test', timestamp: Date.now() });

      const stats = db.stats();
      expect(stats.entities).toBe(2);
      expect(stats.conversations).toBe(1);
    });
  });

  describe('Metadata operations', () => {
    it('should set and get metadata', () => {
      db.setMetadata('version', '0.21.0');
      expect(db.getMetadata('version')).toBe('0.21.0');
    });

    it('should return null for missing metadata', () => {
      expect(db.getMetadata('nonexistent')).toBeNull();
    });
  });
});
