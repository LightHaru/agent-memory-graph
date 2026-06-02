/**
 * SQLite database layer for knowledge graph
 * Handles entities, relationships, conversations, and embeddings
 */

import Database from 'better-sqlite3';
import { Entity, Relationship, ConversationMessage } from './types';

export class GraphDatabase {
  private db: Database.Database;

  constructor(dbPath: string) {
    this.db = new Database(dbPath);
    this.db.pragma('journal_mode = WAL');
    this.db.pragma('foreign_keys = ON');
    this.initSchema();
  }

  private initSchema(): void {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS entities (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        type TEXT NOT NULL,
        attributes TEXT,
        embedding BLOB,
        confidence REAL DEFAULT 1.0,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL,
        last_accessed_at INTEGER NOT NULL
      );

      CREATE INDEX IF NOT EXISTS idx_entities_name ON entities(name);
      CREATE INDEX IF NOT EXISTS idx_entities_type ON entities(type);
      CREATE INDEX IF NOT EXISTS idx_entities_confidence ON entities(confidence);

      CREATE TABLE IF NOT EXISTS relationships (
        id TEXT PRIMARY KEY,
        from_id TEXT NOT NULL,
        to_id TEXT NOT NULL,
        type TEXT NOT NULL,
        attributes TEXT,
        confidence REAL DEFAULT 1.0,
        valid_from INTEGER NOT NULL,
        valid_until INTEGER,
        superseded_by TEXT,
        created_at INTEGER NOT NULL,
        FOREIGN KEY (from_id) REFERENCES entities(id) ON DELETE CASCADE,
        FOREIGN KEY (to_id) REFERENCES entities(id) ON DELETE CASCADE,
        FOREIGN KEY (superseded_by) REFERENCES relationships(id)
      );

      CREATE INDEX IF NOT EXISTS idx_relationships_from ON relationships(from_id);
      CREATE INDEX IF NOT EXISTS idx_relationships_to ON relationships(to_id);
      CREATE INDEX IF NOT EXISTS idx_relationships_type ON relationships(type);
      CREATE INDEX IF NOT EXISTS idx_relationships_valid ON relationships(valid_from, valid_until);

      CREATE TABLE IF NOT EXISTS conversations (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        role TEXT NOT NULL,
        content TEXT NOT NULL,
        timestamp INTEGER NOT NULL,
        entities TEXT
      );

      CREATE INDEX IF NOT EXISTS idx_conversations_timestamp ON conversations(timestamp DESC);

      CREATE TABLE IF NOT EXISTS metadata (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL
      );
    `);

    // Store schema version
    this.setMetadata('schema_version', '0.21.0');
  }

  // Entity operations
  addEntity(entity: Omit<Entity, 'id' | 'createdAt' | 'updatedAt' | 'lastAccessedAt'>): string {
    const id = this.generateId();
    const now = Date.now();

    this.db.prepare(`
      INSERT INTO entities (id, name, type, attributes, embedding, confidence, created_at, updated_at, last_accessed_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      id,
      entity.name,
      entity.type,
      JSON.stringify(entity.attributes),
      entity.embedding ? this.serializeEmbedding(entity.embedding) : null,
      entity.confidence,
      now,
      now,
      now
    );

    return id;
  }

  getEntity(id: string): Entity | null {
    const row = this.db.prepare(`
      SELECT * FROM entities WHERE id = ?
    `).get(id) as any;

    if (!row) return null;

    return this.rowToEntity(row);
  }

  searchEntitiesByKeyword(query: string, limit = 10): Entity[] {
    const rows = this.db.prepare(`
      SELECT * FROM entities 
      WHERE name LIKE ? OR type LIKE ?
      ORDER BY confidence DESC, last_accessed_at DESC
      LIMIT ?
    `).all(`%${query}%`, `%${query}%`, limit) as any[];

    return rows.map(row => this.rowToEntity(row));
  }

  getAllEntitiesWithEmbeddings(): Entity[] {
    const rows = this.db.prepare(`
      SELECT * FROM entities
    `).all() as any[];

    return rows.map(row => this.rowToEntity(row));
  }

  getEntitiesWithoutEmbeddings(): Entity[] {
    const rows = this.db.prepare(`
      SELECT * FROM entities WHERE embedding IS NULL
    `).all() as any[];

    return rows.map(row => this.rowToEntity(row));
  }

  updateEntityEmbedding(id: string, embedding: number[]): void {
    this.db.prepare(`
      UPDATE entities SET embedding = ?, updated_at = ? WHERE id = ?
    `).run(this.serializeEmbedding(embedding), Date.now(), id);
  }

  touchEntity(id: string): void {
    this.db.prepare(`
      UPDATE entities SET last_accessed_at = ? WHERE id = ?
    `).run(Date.now(), id);
  }

  // Relationship operations
  addRelationship(rel: Omit<Relationship, 'id' | 'createdAt'>): string {
    const id = this.generateId();
    const now = Date.now();

    this.db.prepare(`
      INSERT INTO relationships (id, from_id, to_id, type, attributes, confidence, valid_from, valid_until, superseded_by, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      id,
      rel.from,
      rel.to,
      rel.type,
      JSON.stringify(rel.attributes),
      rel.confidence,
      rel.validFrom,
      rel.validUntil || null,
      rel.supersededBy || null,
      now
    );

    return id;
  }

  getRelationships(entityId: string, timestamp?: number): Relationship[] {
    let query = `
      SELECT * FROM relationships 
      WHERE (from_id = ? OR to_id = ?)
    `;

    const params: any[] = [entityId, entityId];

    if (timestamp !== undefined) {
      query += ` AND valid_from <= ? AND (valid_until IS NULL OR valid_until > ?)`;
      params.push(timestamp, timestamp);
    } else {
      query += ` AND (valid_until IS NULL OR valid_until > ?)`;
      params.push(Date.now());
    }

    query += ` ORDER BY created_at DESC`;

    const rows = this.db.prepare(query).all(...params) as any[];
    return rows.map(row => this.rowToRelationship(row));
  }

  supersede(fromId: string, type: string, oldToId: string, newToId: string): void {
    const now = Date.now();

    // Find old relationship
    const oldRel = this.db.prepare(`
      SELECT id FROM relationships 
      WHERE from_id = ? AND to_id = ? AND type = ? AND valid_until IS NULL
    `).get(fromId, oldToId, type) as any;

    if (!oldRel) {
      throw new Error('Old relationship not found');
    }

    // Create new relationship
    const newRelId = this.generateId();
    this.db.prepare(`
      INSERT INTO relationships (id, from_id, to_id, type, attributes, confidence, valid_from, created_at)
      SELECT ?, from_id, ?, type, attributes, confidence, ?, ?
      FROM relationships WHERE id = ?
    `).run(newRelId, newToId, now, now, oldRel.id);

    // Mark old as superseded
    this.db.prepare(`
      UPDATE relationships 
      SET valid_until = ?, superseded_by = ?
      WHERE id = ?
    `).run(now, newRelId, oldRel.id);
  }

  // Conversation operations
  addConversation(msg: ConversationMessage): void {
    this.db.prepare(`
      INSERT INTO conversations (role, content, timestamp, entities)
      VALUES (?, ?, ?, ?)
    `).run(
      msg.role,
      msg.content,
      msg.timestamp,
      msg.entities ? JSON.stringify(msg.entities) : null
    );
  }

  getConversationWindow(size: number): ConversationMessage[] {
    const rows = this.db.prepare(`
      SELECT * FROM conversations 
      ORDER BY timestamp DESC 
      LIMIT ?
    `).all(size) as any[];

    return rows.reverse().map(row => ({
      role: row.role,
      content: row.content,
      timestamp: row.timestamp,
      entities: row.entities ? JSON.parse(row.entities) : undefined
    }));
  }

  // Maintenance
  decay(rate: number): void {
    const now = Date.now();
    const thirtyDays = 30 * 24 * 60 * 60 * 1000;

    this.db.prepare(`
      UPDATE entities 
      SET confidence = MAX(0.1, confidence - ?)
      WHERE last_accessed_at < ?
    `).run(rate, now - thirtyDays);

    this.db.prepare(`
      UPDATE relationships 
      SET confidence = MAX(0.1, confidence - ?)
      WHERE created_at < ?
    `).run(rate, now - thirtyDays);
  }

  stats(): { entities: number; relationships: number; conversations: number } {
    const entities = (this.db.prepare('SELECT COUNT(*) as count FROM entities').get() as any).count;
    const relationships = (this.db.prepare('SELECT COUNT(*) as count FROM relationships').get() as any).count;
    const conversations = (this.db.prepare('SELECT COUNT(*) as count FROM conversations').get() as any).count;

    return { entities, relationships, conversations };
  }

  // Metadata
  setMetadata(key: string, value: string): void {
    this.db.prepare(`
      INSERT OR REPLACE INTO metadata (key, value) VALUES (?, ?)
    `).run(key, value);
  }

  getMetadata(key: string): string | null {
    const row = this.db.prepare(`
      SELECT value FROM metadata WHERE key = ?
    `).get(key) as any;

    return row ? row.value : null;
  }

  close(): void {
    this.db.close();
  }

  // Helper methods
  private generateId(): string {
    return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  private serializeEmbedding(embedding: number[]): Buffer {
    const buffer = Buffer.allocUnsafe(embedding.length * 4);
    for (let i = 0; i < embedding.length; i++) {
      buffer.writeFloatLE(embedding[i], i * 4);
    }
    return buffer;
  }

  private deserializeEmbedding(buffer: Buffer): number[] {
    const embedding: number[] = [];
    for (let i = 0; i < buffer.length; i += 4) {
      embedding.push(buffer.readFloatLE(i));
    }
    return embedding;
  }

  private rowToEntity(row: any): Entity {
    return {
      id: row.id,
      name: row.name,
      type: row.type,
      attributes: JSON.parse(row.attributes),
      embedding: row.embedding ? this.deserializeEmbedding(row.embedding) : undefined,
      confidence: row.confidence,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      lastAccessedAt: row.last_accessed_at
    };
  }

  private rowToRelationship(row: any): Relationship {
    return {
      id: row.id,
      from: row.from_id,
      to: row.to_id,
      type: row.type,
      attributes: JSON.parse(row.attributes),
      confidence: row.confidence,
      validFrom: row.valid_from,
      validUntil: row.valid_until,
      supersededBy: row.superseded_by,
      createdAt: row.created_at
    };
  }
}
