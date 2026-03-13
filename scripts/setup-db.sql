-- ============================================================================
-- Embedding Search POC - PostgreSQL Database Schema
-- ============================================================================
-- This script creates the database schema for storing content embeddings.
--
-- Design Decisions:
-- - Use JSONB for embeddings (array of floats) instead of pgvector extension
--   to avoid external dependencies for this POC
-- - Simple but effective for 200-2000 items; can upgrade to pgvector later
-- - Metadata stored in separate JSONB column for rich, flexible data
-- - Timestamps for audit trail and potential future updates
-- - Strategic indexes on contentful_id and content_type for common queries
--
-- Setup Instructions:
-- 1. Create local PostgreSQL database:
--    createdb embeddings_poc
--
-- 2. Run this script:
--    psql -U postgres -d embeddings_poc -f scripts/setup-db.sql
--
-- 3. Verify table created:
--    psql -U postgres -d embeddings_poc -c "\dt content_embeddings"
--
-- 4. Update .env with connection string:
--    DATABASE_URL=postgresql://user:password@localhost:5432/embeddings_poc
--
-- ============================================================================

-- Create the main embeddings table
CREATE TABLE IF NOT EXISTS content_embeddings (
  -- Primary identifier
  id SERIAL PRIMARY KEY,

  -- Content reference (from Contentful)
  contentful_id VARCHAR(255) UNIQUE NOT NULL COMMENT 'Unique ID from Contentful (e.g., "rec123abc")',
  content_type VARCHAR(50) NOT NULL,  -- Enum: 'sound', 'channel'

  -- Searchable content
  title TEXT NOT NULL,

  -- Embedding vector as JSON array
  -- Example: [0.123, -0.456, 0.789, ...]
  -- Stored as JSONB for flexibility and JSONB indexing if needed later
  embedding JSONB NOT NULL,

  -- Rich metadata for debugging and future features
  -- Example: {"category": "Nature Sounds", "tags": ["ocean", "waves"], "description": "..."}
  metadata JSONB,

  -- Audit timestamps
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- ============================================================================
-- Indexes for Common Query Patterns
-- ============================================================================

-- Lookup by Contentful ID (used when syncing updates)
CREATE INDEX idx_contentful_id ON content_embeddings(contentful_id);

-- Filter by content type (sound vs channel)
CREATE INDEX idx_content_type ON content_embeddings(content_type);

-- Combined index for listing by type and creation date
CREATE INDEX idx_content_type_created ON content_embeddings(content_type, created_at DESC);

-- ============================================================================
-- Comments for Documentation
-- ============================================================================

COMMENT ON TABLE content_embeddings IS
'Stores embeddings and metadata for semantic search across sounds and channels.
Each row represents one item (sound or channel) with its embedding vector and metadata.';

COMMENT ON COLUMN content_embeddings.contentful_id IS
'Unique identifier from Contentful CMS. Used to link back to original content.';

COMMENT ON COLUMN content_embeddings.content_type IS
'Type of content: "sound" or "channel". Used for filtering search results.';

COMMENT ON COLUMN content_embeddings.embedding IS
'Embedding vector as JSON array of floats (1024 dimensions for voyage-3).
Example: [0.123, -0.456, 0.789, ...]
Stored as JSONB for potential future optimizations (indexing, pgvector migration).';

COMMENT ON COLUMN content_embeddings.metadata IS
'Rich metadata stored as JSONB for flexibility. Typical fields:
- category: string
- tags: array of strings
- description: string
- audioType: string
- duration: number (seconds)
Can be extended without schema changes.';

COMMENT ON COLUMN content_embeddings.created_at IS
'When the embedding was first created/synced from Contentful.';

COMMENT ON COLUMN content_embeddings.updated_at IS
'When the embedding was last updated. Updated whenever content is re-synced.';

-- ============================================================================
-- Verification Queries
-- ============================================================================
-- Uncomment to verify schema after creation:
--
-- Show table structure:
-- \d content_embeddings
--
-- Count rows:
-- SELECT COUNT(*) FROM content_embeddings;
--
-- Show indexes:
-- \d content_embeddings_*
--
-- List by content type:
-- SELECT content_type, COUNT(*) FROM content_embeddings GROUP BY content_type;
--
-- ============================================================================
