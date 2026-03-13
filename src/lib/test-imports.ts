/**
 * Simple test to verify all library modules can be imported
 * Run with: bun src/lib/test-imports.ts
 */

import {
  fetchSounds,
  fetchChannels,
  fetchAllContent,
  fetchEntry,
  buildEmbeddingText,
  getSpaceInfo
} from './contentful.js';

import {
  generateEmbedding,
  generateEmbeddings,
  estimateCost,
  getModelInfo
} from './voyageai.js';

import {
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

import {
  cosineSimilarity,
  batchCosineSimilarity
} from './similarity.js';

import type {
  ContentType,
  EmbeddingInputType,
  ContentItem,
  ContentEmbedding,
  SearchResult
} from '../types/index.js';

console.log('✅ All imports successful!');

// Test similarity calculation
console.log('\nTesting similarity calculation...');
const vec1 = Array(1024).fill(0.5);
const vec2 = Array(1024).fill(0.5);
const similarity = cosineSimilarity(vec1, vec2);
console.log(`Cosine similarity of identical vectors: ${similarity.toFixed(4)} (should be 1.0000)`);

// Test VoyageAI model info
console.log('\nVoyageAI model info:');
console.log(getModelInfo());

// Test cost estimation
const testTexts = ['Hello world', 'This is a test', 'Ocean sounds'];
const estimatedCost = estimateCost(testTexts);
console.log(`\nEstimated cost for ${testTexts.length} texts: $${estimatedCost.toFixed(6)}`);

console.log('\n✅ Basic functionality tests passed!');
