/**
 * Embedding service using multilingual-e5-large
 * Supports multilingual semantic search with 1024-dim vectors
 */

import { pipeline, env } from '@xenova/transformers';

// Disable local model cache in production
env.allowLocalModels = false;
env.useBrowserCache = false;

export class EmbeddingService {
  private model: any = null;
  private modelName = 'Xenova/multilingual-e5-large';
  private dimensions = 1024;

  async initialize(): Promise<void> {
    if (this.model) return;
    
    console.log(`[embedding] Loading ${this.modelName}...`);
    this.model = await pipeline('feature-extraction', this.modelName);
    console.log(`[embedding] Model loaded (${this.dimensions}d)`);
  }

  async embed(text: string): Promise<number[]> {
    if (!this.model) {
      await this.initialize();
    }

    // E5 models require "query: " prefix for queries
    const prefixed = text.startsWith('query: ') ? text : `query: ${text}`;
    
    const output = await this.model(prefixed, {
      pooling: 'mean',
      normalize: true
    });

    // Convert to regular array
    const embedding = Array.from(output.data) as number[];
    
    if (embedding.length !== this.dimensions) {
      throw new Error(`Expected ${this.dimensions}d embedding, got ${embedding.length}d`);
    }

    return embedding;
  }

  async embedBatch(texts: string[]): Promise<number[][]> {
    if (!this.model) {
      await this.initialize();
    }

    const prefixed = texts.map(t => 
      t.startsWith('query: ') ? t : `query: ${t}`
    );

    const outputs = await this.model(prefixed, {
      pooling: 'mean',
      normalize: true
    });

    // Handle batch output
    const embeddings: number[][] = [];
    for (let i = 0; i < texts.length; i++) {
      const start = i * this.dimensions;
      const end = start + this.dimensions;
      embeddings.push(Array.from(outputs.data.slice(start, end)) as number[]);
    }

    return embeddings;
  }

  cosineSimilarity(a: number[], b: number[]): number {
    if (a.length !== b.length) {
      throw new Error('Vector dimensions must match');
    }

    let dotProduct = 0;
    let normA = 0;
    let normB = 0;

    for (let i = 0; i < a.length; i++) {
      dotProduct += a[i] * b[i];
      normA += a[i] * a[i];
      normB += b[i] * b[i];
    }

    return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
  }

  getDimensions(): number {
    return this.dimensions;
  }
}
