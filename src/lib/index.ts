/**
 * Core library modules for Embedding Search POC
 *
 * This file re-exports all library modules for convenient importing:
 *
 * @example
 * ```typescript
 * import { fetchAllContent, generateEmbedding, cosineSimilarity } from './lib/index.js';
 * ```
 */

// Contentful
export {
  fetchSounds,
  fetchChannels,
  fetchAllContent,
  fetchEntry,
  buildEmbeddingText,
  getSpaceInfo
} from './contentful.js';

// VoyageAI
export {
  generateEmbedding,
  generateEmbeddings,
  estimateCost,
  getModelInfo
} from './voyageai.js';

// Database
export {
  insertEmbedding,
  updateEmbedding,
  fetchAllEmbeddings,
  fetchEmbeddingById,
  deleteEmbedding,
  deleteAllEmbeddings,
  countEmbeddings,
  embeddingExists,
  upsertEmbedding,
  closeConnection,
  testConnection
} from './database.js';

// Similarity
export {
  cosineSimilarity,
  batchCosineSimilarity
} from './similarity.js';
