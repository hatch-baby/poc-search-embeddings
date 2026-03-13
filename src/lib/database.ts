/**
 * Database client with PostgreSQL and in-memory storage modes
 *
 * Manages connections and CRUD operations for the content_embeddings table.
 *
 * Storage modes:
 * - PostgreSQL: Use Bun.SQL with DATABASE_URL (production-ready)
 * - In-memory: Use Map with JSON file persistence (no database setup required)
 *
 * Set STORAGE_MODE=memory in .env to use in-memory storage
 */

import { SQL } from 'bun';
import type {
  ContentEmbedding,
  DatabaseRow,
  ContentType
} from '../types/index.js';

// Check storage mode from environment
const STORAGE_MODE = process.env.STORAGE_MODE || 'postgres';
const isMemoryMode = STORAGE_MODE === 'memory';

// PostgreSQL connection
let db: SQL | null = null;

// In-memory storage with file persistence
const CACHE_FILE = '.embeddings-cache.json';
let memoryStore: Map<string, ContentEmbedding> = new Map();
let nextId = 1;
let cacheLoaded = false;

/**
 * Load embeddings from cache file (memory mode only)
 */
async function loadCache(): Promise<void> {
  if (!isMemoryMode || cacheLoaded) {
    return;
  }

  try {
    const file = Bun.file(CACHE_FILE);
    if (await file.exists()) {
      const data = await file.json() as {
        embeddings: ContentEmbedding[];
        nextId: number;
      };

      memoryStore.clear();
      data.embeddings.forEach(embedding => {
        memoryStore.set(embedding.contentfulId, embedding);
      });
      nextId = data.nextId;

      console.log(`Loaded ${memoryStore.size} embeddings from cache file`);
    }
  } catch (error) {
    console.warn('Failed to load cache file:', error instanceof Error ? error.message : String(error));
  }

  cacheLoaded = true;
}

/**
 * Save embeddings to cache file (memory mode only)
 */
async function saveCache(): Promise<void> {
  if (!isMemoryMode) {
    return;
  }

  try {
    const data = {
      embeddings: Array.from(memoryStore.values()),
      nextId
    };

    await Bun.write(CACHE_FILE, JSON.stringify(data, null, 2));
  } catch (error) {
    console.error('Failed to save cache file:', error instanceof Error ? error.message : String(error));
  }
}

/**
 * Get or create database connection (PostgreSQL mode only)
 */
function getConnection(): SQL {
  if (isMemoryMode) {
    throw new Error('Cannot use PostgreSQL connection in memory mode');
  }

  if (db) {
    return db;
  }

  const connectionString = process.env.DATABASE_URL;

  if (!connectionString) {
    throw new Error(
      'DATABASE_URL environment variable is not set. ' +
      'Please add it to your .env file or use STORAGE_MODE=memory for testing.\n' +
      'Example: DATABASE_URL=postgresql://user:password@localhost:5432/embeddings_poc'
    );
  }

  try {
    db = new SQL(connectionString);
    return db;
  } catch (error) {
    throw new Error(
      `Failed to connect to database: ${error instanceof Error ? error.message : String(error)}`
    );
  }
}

/**
 * Transform database row to ContentEmbedding (PostgreSQL mode)
 */
function transformRow(row: DatabaseRow): ContentEmbedding {
  return {
    id: row.id,
    contentfulId: row.contentful_id,
    contentType: row.content_type as ContentType,
    title: row.title,
    embedding: Array.isArray(row.embedding) ? row.embedding : JSON.parse(row.embedding),
    metadata: typeof row.metadata === 'object' ? row.metadata : JSON.parse(row.metadata || '{}'),
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

/**
 * Insert a new content embedding
 *
 * @param data - Content embedding data (without id, createdAt, updatedAt)
 * @returns Inserted ContentEmbedding with generated ID and timestamps
 */
export async function insertEmbedding(data: {
  contentfulId: string;
  contentType: ContentType;
  title: string;
  embedding: number[];
  metadata: Record<string, any>;
}): Promise<ContentEmbedding> {
  if (isMemoryMode) {
    // In-memory mode - load cache first
    await loadCache();

    if (memoryStore.has(data.contentfulId)) {
      throw new Error(
        `Content with Contentful ID "${data.contentfulId}" already exists in database`
      );
    }

    const now = new Date();
    const embedding: ContentEmbedding = {
      id: nextId++,
      contentfulId: data.contentfulId,
      contentType: data.contentType,
      title: data.title,
      embedding: data.embedding,
      metadata: data.metadata,
      createdAt: now,
      updatedAt: now
    };

    memoryStore.set(data.contentfulId, embedding);
    await saveCache();
    return embedding;
  }

  // PostgreSQL mode
  const conn = getConnection();

  try {
    const result = await conn`
      INSERT INTO content_embeddings (
        contentful_id,
        content_type,
        title,
        embedding,
        metadata
      ) VALUES (
        ${data.contentfulId},
        ${data.contentType},
        ${data.title},
        ${JSON.stringify(data.embedding)}::jsonb,
        ${JSON.stringify(data.metadata)}::jsonb
      )
      RETURNING *
    `;

    if (!result || result.length === 0) {
      throw new Error('Insert failed: no rows returned');
    }

    return transformRow(result[0] as DatabaseRow);
  } catch (error) {
    if (error instanceof Error) {
      if (error.message.includes('duplicate key') || error.message.includes('unique constraint')) {
        throw new Error(
          `Content with Contentful ID "${data.contentfulId}" already exists in database`
        );
      }
      throw error;
    }
    throw new Error(`Failed to insert embedding: ${String(error)}`);
  }
}

/**
 * Update an existing content embedding
 */
export async function updateEmbedding(
  contentfulId: string,
  data: {
    title?: string;
    embedding?: number[];
    metadata?: Record<string, any>;
  }
): Promise<ContentEmbedding> {
  if (!data.title && !data.embedding && !data.metadata) {
    throw new Error('No fields to update');
  }

  if (isMemoryMode) {
    // In-memory mode - load cache first
    await loadCache();

    const existing = memoryStore.get(contentfulId);
    if (!existing) {
      throw new Error(`Content with Contentful ID "${contentfulId}" not found`);
    }

    const updated: ContentEmbedding = {
      ...existing,
      title: data.title ?? existing.title,
      embedding: data.embedding ?? existing.embedding,
      metadata: data.metadata ?? existing.metadata,
      updatedAt: new Date()
    };

    memoryStore.set(contentfulId, updated);
    await saveCache();
    return updated;
  }

  // PostgreSQL mode
  const conn = getConnection();

  try {
    let result;

    if (data.title && data.embedding && data.metadata) {
      result = await conn`
        UPDATE content_embeddings
        SET
          title = ${data.title},
          embedding = ${JSON.stringify(data.embedding)}::jsonb,
          metadata = ${JSON.stringify(data.metadata)}::jsonb,
          updated_at = NOW()
        WHERE contentful_id = ${contentfulId}
        RETURNING *
      `;
    } else if (data.title && data.embedding) {
      result = await conn`
        UPDATE content_embeddings
        SET
          title = ${data.title},
          embedding = ${JSON.stringify(data.embedding)}::jsonb,
          updated_at = NOW()
        WHERE contentful_id = ${contentfulId}
        RETURNING *
      `;
    } else if (data.title && data.metadata) {
      result = await conn`
        UPDATE content_embeddings
        SET
          title = ${data.title},
          metadata = ${JSON.stringify(data.metadata)}::jsonb,
          updated_at = NOW()
        WHERE contentful_id = ${contentfulId}
        RETURNING *
      `;
    } else if (data.embedding && data.metadata) {
      result = await conn`
        UPDATE content_embeddings
        SET
          embedding = ${JSON.stringify(data.embedding)}::jsonb,
          metadata = ${JSON.stringify(data.metadata)}::jsonb,
          updated_at = NOW()
        WHERE contentful_id = ${contentfulId}
        RETURNING *
      `;
    } else if (data.title) {
      result = await conn`
        UPDATE content_embeddings
        SET
          title = ${data.title},
          updated_at = NOW()
        WHERE contentful_id = ${contentfulId}
        RETURNING *
      `;
    } else if (data.embedding) {
      result = await conn`
        UPDATE content_embeddings
        SET
          embedding = ${JSON.stringify(data.embedding)}::jsonb,
          updated_at = NOW()
        WHERE contentful_id = ${contentfulId}
        RETURNING *
      `;
    } else {
      result = await conn`
        UPDATE content_embeddings
        SET
          metadata = ${JSON.stringify(data.metadata)}::jsonb,
          updated_at = NOW()
        WHERE contentful_id = ${contentfulId}
        RETURNING *
      `;
    }

    if (!result || result.length === 0) {
      throw new Error(`Content with Contentful ID "${contentfulId}" not found`);
    }

    return transformRow(result[0] as DatabaseRow);
  } catch (error) {
    if (error instanceof Error) {
      throw error;
    }
    throw new Error(`Failed to update embedding: ${String(error)}`);
  }
}

/**
 * Fetch all content embeddings
 */
export async function fetchAllEmbeddings(
  contentType?: ContentType
): Promise<ContentEmbedding[]> {
  if (isMemoryMode) {
    // In-memory mode - load cache first
    await loadCache();

    const all = Array.from(memoryStore.values());

    if (contentType) {
      return all.filter(e => e.contentType === contentType);
    }

    return all;
  }

  // PostgreSQL mode
  const conn = getConnection();

  try {
    const result = contentType
      ? await conn`
          SELECT * FROM content_embeddings
          WHERE content_type = ${contentType}
          ORDER BY created_at DESC
        `
      : await conn`
          SELECT * FROM content_embeddings
          ORDER BY created_at DESC
        `;

    return result.map((row: any) => transformRow(row as DatabaseRow));
  } catch (error) {
    throw new Error(
      `Failed to fetch embeddings: ${error instanceof Error ? error.message : String(error)}`
    );
  }
}

/**
 * Fetch a single embedding by Contentful ID
 */
export async function fetchEmbeddingById(
  contentfulId: string
): Promise<ContentEmbedding | null> {
  if (isMemoryMode) {
    // In-memory mode - load cache first
    await loadCache();
    return memoryStore.get(contentfulId) || null;
  }

  // PostgreSQL mode
  const conn = getConnection();

  try {
    const result = await conn`
      SELECT * FROM content_embeddings
      WHERE contentful_id = ${contentfulId}
      LIMIT 1
    `;

    if (!result || result.length === 0) {
      return null;
    }

    return transformRow(result[0] as DatabaseRow);
  } catch (error) {
    throw new Error(
      `Failed to fetch embedding by ID: ${error instanceof Error ? error.message : String(error)}`
    );
  }
}

/**
 * Delete an embedding by Contentful ID
 */
export async function deleteEmbedding(contentfulId: string): Promise<boolean> {
  if (isMemoryMode) {
    // In-memory mode - load cache first
    await loadCache();
    const deleted = memoryStore.delete(contentfulId);
    if (deleted) {
      await saveCache();
    }
    return deleted;
  }

  // PostgreSQL mode
  const conn = getConnection();

  try {
    const result = await conn`
      DELETE FROM content_embeddings
      WHERE contentful_id = ${contentfulId}
      RETURNING id
    `;

    return result && result.length > 0;
  } catch (error) {
    throw new Error(
      `Failed to delete embedding: ${error instanceof Error ? error.message : String(error)}`
    );
  }
}

/**
 * Delete all embeddings (use with caution!)
 */
export async function deleteAllEmbeddings(): Promise<number> {
  if (isMemoryMode) {
    // In-memory mode - load cache first
    await loadCache();
    const count = memoryStore.size;
    memoryStore.clear();
    nextId = 1;
    await saveCache();
    return count;
  }

  // PostgreSQL mode
  const conn = getConnection();

  try {
    const result = await conn`
      DELETE FROM content_embeddings
      RETURNING id
    `;

    return result.length;
  } catch (error) {
    throw new Error(
      `Failed to delete all embeddings: ${error instanceof Error ? error.message : String(error)}`
    );
  }
}

/**
 * Count total embeddings
 */
export async function countEmbeddings(contentType?: ContentType): Promise<number> {
  if (isMemoryMode) {
    // In-memory mode - load cache first
    await loadCache();
    if (contentType) {
      return Array.from(memoryStore.values()).filter(e => e.contentType === contentType).length;
    }
    return memoryStore.size;
  }

  // PostgreSQL mode
  const conn = getConnection();

  try {
    const result = contentType
      ? await conn`
          SELECT COUNT(*) as count
          FROM content_embeddings
          WHERE content_type = ${contentType}
        `
      : await conn`
          SELECT COUNT(*) as count
          FROM content_embeddings
        `;

    return parseInt(result[0].count, 10);
  } catch (error) {
    throw new Error(
      `Failed to count embeddings: ${error instanceof Error ? error.message : String(error)}`
    );
  }
}

/**
 * Check if an embedding exists by Contentful ID
 */
export async function embeddingExists(contentfulId: string): Promise<boolean> {
  if (isMemoryMode) {
    // In-memory mode - load cache first
    await loadCache();
    return memoryStore.has(contentfulId);
  }

  // PostgreSQL mode
  const conn = getConnection();

  try {
    const result = await conn`
      SELECT 1 FROM content_embeddings
      WHERE contentful_id = ${contentfulId}
      LIMIT 1
    `;

    return result && result.length > 0;
  } catch (error) {
    throw new Error(
      `Failed to check if embedding exists: ${error instanceof Error ? error.message : String(error)}`
    );
  }
}

/**
 * Upsert (insert or update) an embedding
 */
export async function upsertEmbedding(data: {
  contentfulId: string;
  contentType: ContentType;
  title: string;
  embedding: number[];
  metadata: Record<string, any>;
}): Promise<ContentEmbedding> {
  if (isMemoryMode) {
    // In-memory mode - load cache first
    await loadCache();

    const existing = memoryStore.get(data.contentfulId);
    const now = new Date();

    if (existing) {
      // Update
      const updated: ContentEmbedding = {
        ...existing,
        title: data.title,
        embedding: data.embedding,
        metadata: data.metadata,
        updatedAt: now
      };
      memoryStore.set(data.contentfulId, updated);
      await saveCache();
      return updated;
    } else {
      // Insert
      const embedding: ContentEmbedding = {
        id: nextId++,
        contentfulId: data.contentfulId,
        contentType: data.contentType,
        title: data.title,
        embedding: data.embedding,
        metadata: data.metadata,
        createdAt: now,
        updatedAt: now
      };
      memoryStore.set(data.contentfulId, embedding);
      await saveCache();
      return embedding;
    }
  }

  // PostgreSQL mode
  const conn = getConnection();

  try {
    const result = await conn`
      INSERT INTO content_embeddings (
        contentful_id,
        content_type,
        title,
        embedding,
        metadata
      ) VALUES (
        ${data.contentfulId},
        ${data.contentType},
        ${data.title},
        ${JSON.stringify(data.embedding)}::jsonb,
        ${JSON.stringify(data.metadata)}::jsonb
      )
      ON CONFLICT (contentful_id)
      DO UPDATE SET
        title = EXCLUDED.title,
        embedding = EXCLUDED.embedding,
        metadata = EXCLUDED.metadata,
        updated_at = NOW()
      RETURNING *
    `;

    if (!result || result.length === 0) {
      throw new Error('Upsert failed: no rows returned');
    }

    return transformRow(result[0] as DatabaseRow);
  } catch (error) {
    if (error instanceof Error) {
      throw error;
    }
    throw new Error(`Failed to upsert embedding: ${String(error)}`);
  }
}

/**
 * Close database connection (PostgreSQL mode only)
 */
export async function closeConnection(): Promise<void> {
  if (db) {
    db = null;
  }
}

/**
 * Test database connection
 */
export async function testConnection(): Promise<boolean> {
  if (isMemoryMode) {
    // In-memory mode is always "connected"
    return true;
  }

  // PostgreSQL mode
  const conn = getConnection();

  try {
    const result = await conn`SELECT 1 as test`;
    return result && result.length > 0 && result[0].test === 1;
  } catch (error) {
    throw new Error(
      `Database connection test failed: ${error instanceof Error ? error.message : String(error)}`
    );
  }
}

/**
 * Get current storage mode and stats
 */
export function getStorageInfo(): { mode: string; count: number } {
  return {
    mode: STORAGE_MODE,
    count: isMemoryMode ? memoryStore.size : 0
  };
}
