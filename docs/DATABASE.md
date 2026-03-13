# PostgreSQL Database Setup Guide

## Overview

This document explains how to set up the local PostgreSQL database for the Embedding Search POC. The database stores content embeddings and metadata for semantic search.

## Prerequisites

- PostgreSQL 12+ installed locally
- `psql` command-line tool available
- Basic PostgreSQL command knowledge

### Installation

**macOS (via Homebrew):**
```bash
brew install postgresql@16
brew services start postgresql@16
```

**Linux (Ubuntu/Debian):**
```bash
sudo apt-get install postgresql postgresql-contrib
sudo systemctl start postgresql
```

**Windows:**
Download and install from https://www.postgresql.org/download/windows/

## Quick Start

### 1. Create the Database

```bash
createdb embeddings_poc
```

If you need to use a specific PostgreSQL user:
```bash
createdb -U postgres embeddings_poc
```

### 2. Run the Schema Script

```bash
psql -U postgres -d embeddings_poc -f scripts/setup-db.sql
```

Or, if you have a different default user:
```bash
psql -d embeddings_poc -f scripts/setup-db.sql
```

### 3. Verify the Setup

Check that the table was created:
```bash
psql -d embeddings_poc -c "\dt content_embeddings"
```

You should see output like:
```
          List of relations
 Schema |       Name        | Type  | Owner
--------+-------------------+-------+-------
 public | content_embeddings | table | postgres
```

Check the table structure:
```bash
psql -d embeddings_poc -c "\d content_embeddings"
```

### 4. Update .env Configuration

Create or update your `.env` file with the database connection string:

```bash
DATABASE_URL=postgresql://postgres:password@localhost:5432/embeddings_poc
```

Replace `password` with your PostgreSQL password if set. If no password, use:
```bash
DATABASE_URL=postgresql://postgres@localhost:5432/embeddings_poc
```

## Schema Overview

### Table: `content_embeddings`

Stores embeddings and metadata for semantic search.

| Column | Type | Description |
|--------|------|-------------|
| `id` | SERIAL PRIMARY KEY | Auto-incrementing row ID |
| `contentful_id` | VARCHAR(255) UNIQUE NOT NULL | Unique Contentful identifier (e.g., "rec123abc") |
| `content_type` | VARCHAR(50) NOT NULL | Type: "sound" or "channel" |
| `title` | TEXT NOT NULL | Content title for display |
| `embedding` | JSONB NOT NULL | Embedding vector as JSON array [0.123, -0.456, ...] |
| `metadata` | JSONB | Rich metadata (category, tags, description, etc.) |
| `created_at` | TIMESTAMP | When embedding was created (defaults to NOW()) |
| `updated_at` | TIMESTAMP | When embedding was last updated (defaults to NOW()) |

### Indexes

| Index Name | Columns | Purpose |
|------------|---------|---------|
| `idx_contentful_id` | contentful_id | Fast lookup by Contentful ID during syncs |
| `idx_content_type` | content_type | Filter results by type (sound vs channel) |
| `idx_content_type_created` | (content_type, created_at DESC) | List recent items by type |

## Design Decisions

### Why JSONB for Embeddings?

- **No external dependencies**: Avoids pgvector extension installation/approval
- **Good performance**: Handles 200-2000 items with <100ms queries
- **Flexible**: Can extend with additional fields without schema changes
- **Easy upgrade path**: Can migrate to pgvector later if performance needs increase
- **Simple**: Works with standard PostgreSQL without special setup

### Why Separate Metadata Column?

- **Flexibility**: Rich structured data without schema constraints
- **Debugging**: Easy to inspect what was stored during sync
- **Future features**: Can add new metadata fields (duration, audioType, etc.) without migrations
- **Query simplicity**: Separate from embedding vector for cleaner queries

### Why These Indexes?

1. **contentful_id**: Used during sync to check if item exists or needs update
2. **content_type**: Common filter for "sounds only" vs "channels only" searches
3. **content_type + created_at**: Used for pagination/listing features

## Common Operations

### Check Record Count

```bash
psql -d embeddings_poc -c "SELECT COUNT(*) FROM content_embeddings;"
```

### List All Items by Type

```bash
psql -d embeddings_poc -c "
  SELECT content_type, COUNT(*) as count
  FROM content_embeddings
  GROUP BY content_type;
"
```

### View a Sample Embedding

```bash
psql -d embeddings_poc -c "
  SELECT contentful_id, title, embedding
  FROM content_embeddings
  LIMIT 1;
"
```

### Check Index Sizes

```bash
psql -d embeddings_poc -c "
  SELECT indexname, pg_size_pretty(pg_relation_size(indexrelid)) as size
  FROM pg_indexes
  WHERE tablename = 'content_embeddings';
"
```

### View Column Comments

```bash
psql -d embeddings_poc -c "
  SELECT column_name, col_description(table_name::text::regclass, ordinal_position) as comment
  FROM information_schema.columns
  WHERE table_name = 'content_embeddings'
  ORDER BY ordinal_position;
"
```

## Backup and Restore

### Backup the Database

```bash
pg_dump embeddings_poc > backup.sql
```

### Restore from Backup

```bash
createdb embeddings_poc_restored
psql -d embeddings_poc_restored -f backup.sql
```

## Troubleshooting

### "database embeddings_poc does not exist"

Create it first:
```bash
createdb embeddings_poc
```

### "role postgres does not exist"

List available roles:
```bash
psql -c "\du"
```

Use your actual username instead of `postgres`, or create the postgres role.

### Permission Denied

If you get permission errors, try with sudo:
```bash
sudo -u postgres createdb embeddings_poc
sudo -u postgres psql -d embeddings_poc -f scripts/setup-db.sql
```

### Table Already Exists

The schema script uses `IF NOT EXISTS`, so it's safe to run multiple times. To reset:

```bash
psql -d embeddings_poc -c "DROP TABLE IF EXISTS content_embeddings CASCADE;"
psql -d embeddings_poc -f scripts/setup-db.sql
```

## Performance Notes

For this POC dataset (200-2000 items):

- **Embedding storage**: ~1.2 MB per 1000 items (1024 dimensions × 8 bytes × 1000)
- **Query time**: <10ms for similarity search on 200 items (in-memory)
- **Index overhead**: Minimal (<1MB for 1000 items)

## Connection Pooling (for Production)

This POC uses direct connections. For production, use a connection pool:

- **Bun.sql**: Built-in connection pooling
- **Node.js pg**: Use `pg-pool` for connection pooling
- **Spring**: Use HikariCP for Java backend

## Next Steps

1. Run `scripts/setup-db.sql` to create schema
2. Update `.env` with `DATABASE_URL`
3. Proceed with sync script (`src/sync/generate-embeddings.ts`)

## Related Files

- **Schema**: `/scripts/setup-db.sql`
- **Environment**: `.env` (create from `.env.example`)
- **Sync Script**: `src/sync/generate-embeddings.ts` (Phase 2)
- **Database Client**: `src/lib/database.ts` (Phase 2)
