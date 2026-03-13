/**
 * TypeScript types for the Embedding Search POC
 */

/**
 * Content types supported by the system
 */
export type ContentType = 'sound' | 'channel' | 'track';

/**
 * Input type for VoyageAI embeddings
 * - document: For storing content embeddings
 * - query: For search query embeddings
 */
export type EmbeddingInputType = 'document' | 'query';

/**
 * Raw content item from Contentful
 */
export interface ContentfulItem {
  sys: {
    id: string;
    contentType: {
      sys: {
        id: string;
      };
    };
  };
  fields: {
    title?: string;
    description?: string;
    category?: string;
    tags?: string[];
    filters?: Array<{
      fields: {
        name?: string;
      };
    }>;
    audioType?: string;
    [key: string]: any;
  };
}

/**
 * Processed content item ready for embedding
 */
export interface ContentItem {
  contentfulId: string;
  contentType: ContentType;
  title: string;
  description?: string;
  category?: string;
  tags?: string[];
  filterNames?: string[];
  audioType?: string;
  metadata: Record<string, any>;
}

/**
 * Content embedding stored in the database
 */
export interface ContentEmbedding {
  id: number;
  contentfulId: string;
  contentType: ContentType;
  title: string;
  embedding: number[];
  metadata: Record<string, any>;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Search result with similarity score
 */
export interface SearchResult {
  contentfulId: string;
  title: string;
  contentType: ContentType;
  score: number;
  metadata?: Record<string, any>;
}

/**
 * Database row as returned from PostgreSQL
 */
export interface DatabaseRow {
  id: number;
  contentful_id: string;
  content_type: string;
  title: string;
  embedding: any; // JSONB from database
  metadata: any; // JSONB from database
  created_at: Date;
  updated_at: Date;
}

/**
 * VoyageAI API response
 */
export interface VoyageAIResponse {
  data: Array<{
    embedding: number[];
    index: number;
  }>;
  model: string;
  usage: {
    total_tokens: number;
  };
}

/**
 * VoyageAI API error response
 */
export interface VoyageAIError {
  error: {
    message: string;
    type: string;
    code?: string;
  };
}

/**
 * Contentful API response
 */
export interface ContentfulResponse {
  items: ContentfulItem[];
  total: number;
  skip: number;
  limit: number;
}

/**
 * Database connection configuration
 */
export interface DatabaseConfig {
  connectionString: string;
  maxConnections?: number;
}

/**
 * Search query parameters
 */
export interface SearchQuery {
  query: string;
  limit?: number;
  contentType?: ContentType;
}

/**
 * Search response
 */
export interface SearchResponse {
  results: SearchResult[];
  query: string;
  latency_ms: number;
  count: number;
}
