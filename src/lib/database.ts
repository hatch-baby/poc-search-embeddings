/**
 * Database client with JSON file storage
 *
 * Stores embeddings in a JSON file (.embeddings-cache.json) for easy persistence
 * without requiring any database setup.
 *
 * Perfect for POCs and demos!
 */

import type {
  ContentEmbedding,
  ContentType
} from '../types/index.js';

// In-memory storage with file persistence
const CACHE_FILE = '.embeddings-cache.json';
let memoryStore: Map<string, ContentEmbedding> = new Map();
let nextId = 1;
let cacheLoaded = false;

/**
 * Load embeddings from cache file
 */
async function loadCache(): Promise<void> {
  if (cacheLoaded) {
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

      console.log(`Loaded ${memoryStore.size} embeddings from cache`);
    }
  } catch (error) {
    console.warn('Failed to load cache file:', error instanceof Error ? error.message : String(error));
  }

  cacheLoaded = true;
}

/**
 * Save embeddings to cache file
 */
async function saveCache(): Promise<void> {
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
 * Upsert (insert or update) a content embedding
 *
 * @param params - Embedding data to store
 * @returns The stored embedding with ID
 */
export async function upsertEmbedding(params: {
  contentfulId: string;
  contentType: ContentType;
  title: string;
  embedding: number[];
  metadata?: Record<string, any>;
}): Promise<ContentEmbedding> {
  await loadCache();

  // Check if exists
  const existing = memoryStore.get(params.contentfulId);

  const now = new Date();
  const embedding: ContentEmbedding = {
    id: existing?.id || nextId++,
    contentfulId: params.contentfulId,
    contentType: params.contentType,
    title: params.title,
    embedding: params.embedding,
    metadata: params.metadata || {},
    createdAt: existing?.createdAt || now,
    updatedAt: now
  };

  memoryStore.set(params.contentfulId, embedding);
  await saveCache();

  return embedding;
}

/**
 * Get all embeddings, optionally filtered by content type
 *
 * @param contentType - Optional filter by content type
 * @returns Array of embeddings
 */
export async function getAllEmbeddings(contentType?: ContentType): Promise<ContentEmbedding[]> {
  await loadCache();

  const allEmbeddings = Array.from(memoryStore.values());

  if (contentType) {
    return allEmbeddings.filter(e => e.contentType === contentType);
  }

  return allEmbeddings;
}

/**
 * Get embedding by Contentful ID
 *
 * @param contentfulId - Contentful entry ID
 * @returns Embedding or null if not found
 */
export async function getEmbeddingByContentfulId(contentfulId: string): Promise<ContentEmbedding | null> {
  await loadCache();

  return memoryStore.get(contentfulId) || null;
}

/**
 * Delete embedding by Contentful ID
 *
 * @param contentfulId - Contentful entry ID
 * @returns True if deleted, false if not found
 */
export async function deleteEmbedding(contentfulId: string): Promise<boolean> {
  await loadCache();

  const deleted = memoryStore.delete(contentfulId);

  if (deleted) {
    await saveCache();
  }

  return deleted;
}

/**
 * Delete all embeddings
 */
export async function deleteAllEmbeddings(): Promise<void> {
  memoryStore.clear();
  nextId = 1;
  await saveCache();
}

/**
 * Get total count of embeddings
 *
 * @param contentType - Optional filter by content type
 * @returns Count of embeddings
 */
export async function getEmbeddingsCount(contentType?: ContentType): Promise<number> {
  await loadCache();

  if (contentType) {
    return Array.from(memoryStore.values()).filter(e => e.contentType === contentType).length;
  }

  return memoryStore.size;
}
