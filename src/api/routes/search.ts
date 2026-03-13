/**
 * Search route handler
 *
 * Implements POST /search endpoint for semantic search using embeddings.
 * Generates query embedding via VoyageAI and computes cosine similarity
 * against all stored embeddings.
 */

import { generateEmbedding } from '../../lib/voyageai.js';
import { fetchAllEmbeddings } from '../../lib/database.js';
import { batchCosineSimilarity } from '../../lib/similarity.js';
import type { SearchQuery, SearchResponse, SearchResult } from '../../types/index.js';

/**
 * Handle POST /search requests
 *
 * @param req - Request object from Bun.serve
 * @returns Response with search results
 */
export async function handleSearch(req: Request): Promise<Response> {
  const startTime = Date.now();

  try {
    // Parse request body
    const body = await req.json() as SearchQuery;

    // Validate query parameter
    if (!body.query || typeof body.query !== 'string' || body.query.trim().length === 0) {
      return new Response(
        JSON.stringify({
          error: 'Invalid request',
          message: 'Query parameter is required and must be a non-empty string'
        }),
        {
          status: 400,
          headers: { 'Content-Type': 'application/json' }
        }
      );
    }

    // Validate limit parameter (optional, default 10)
    const limit = body.limit && typeof body.limit === 'number' ? body.limit : 10;
    if (limit < 1 || limit > 100) {
      return new Response(
        JSON.stringify({
          error: 'Invalid request',
          message: 'Limit must be between 1 and 100'
        }),
        {
          status: 400,
          headers: { 'Content-Type': 'application/json' }
        }
      );
    }

    const query = body.query.trim();

    // Step 1: Generate query embedding
    const embeddingStartTime = Date.now();
    const queryEmbedding = await generateEmbedding(query, 'query');
    const embeddingTime = Date.now() - embeddingStartTime;

    // Step 2: Fetch all embeddings from database
    const fetchStartTime = Date.now();
    const allEmbeddings = await fetchAllEmbeddings(body.contentType);
    const fetchTime = Date.now() - fetchStartTime;

    if (allEmbeddings.length === 0) {
      return new Response(
        JSON.stringify({
          results: [],
          query,
          latency_ms: Date.now() - startTime,
          count: 0,
          message: 'No embeddings found in database. Run sync first.'
        }),
        {
          status: 200,
          headers: { 'Content-Type': 'application/json' }
        }
      );
    }

    // Step 3: Calculate cosine similarity for all embeddings
    const similarityStartTime = Date.now();
    const resultsWithScores = batchCosineSimilarity(queryEmbedding, allEmbeddings);
    const similarityTime = Date.now() - similarityStartTime;

    // Step 4: Take top N results
    const topResults = resultsWithScores.slice(0, limit);

    // Step 5: Format results
    const results: SearchResult[] = topResults.map(item => ({
      contentfulId: item.contentfulId,
      title: item.title,
      contentType: item.contentType,
      score: Math.round(item.score * 100) / 100, // Round to 2 decimal places
      metadata: item.metadata
    }));

    const totalLatency = Date.now() - startTime;

    // Build response with timing metrics
    const response: SearchResponse = {
      results,
      query,
      latency_ms: totalLatency,
      count: results.length
    };

    // Add debug timing information in development
    const debugInfo = process.env.NODE_ENV !== 'production' ? {
      debug: {
        embedding_time_ms: embeddingTime,
        fetch_time_ms: fetchTime,
        similarity_time_ms: similarityTime,
        total_embeddings: allEmbeddings.length
      }
    } : {};

    return new Response(
      JSON.stringify({ ...response, ...debugInfo }),
      {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      }
    );

  } catch (error) {
    console.error('Search error:', error);

    // Handle specific error types
    if (error instanceof SyntaxError) {
      return new Response(
        JSON.stringify({
          error: 'Invalid JSON',
          message: 'Request body must be valid JSON'
        }),
        {
          status: 400,
          headers: { 'Content-Type': 'application/json' }
        }
      );
    }

    // Handle VoyageAI API errors
    if (error instanceof Error && error.message.includes('VoyageAI')) {
      return new Response(
        JSON.stringify({
          error: 'Embedding generation failed',
          message: error.message
        }),
        {
          status: 502,
          headers: { 'Content-Type': 'application/json' }
        }
      );
    }

    // Handle database errors
    if (error instanceof Error && error.message.includes('DATABASE_URL')) {
      return new Response(
        JSON.stringify({
          error: 'Database configuration error',
          message: error.message
        }),
        {
          status: 500,
          headers: { 'Content-Type': 'application/json' }
        }
      );
    }

    // Generic error response
    return new Response(
      JSON.stringify({
        error: 'Internal server error',
        message: error instanceof Error ? error.message : 'Unknown error occurred'
      }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      }
    );
  }
}
