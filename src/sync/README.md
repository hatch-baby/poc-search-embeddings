# Embedding Generation Sync

This directory contains scripts for syncing content from Contentful and generating embeddings.

## generate-embeddings.ts

Main sync script that fetches all sounds and channels from Contentful, generates embeddings via VoyageAI, and stores them in PostgreSQL.

### Usage

```bash
# Full sync (generates and stores embeddings)
bun src/sync/generate-embeddings.ts
# or
bun run sync

# Dry-run mode (preview without storing)
bun src/sync/generate-embeddings.ts --dry-run
# or
bun run sync:dry-run
```

### Features

- Fetches all sounds and channels from Contentful (with include:2 for linked fields)
- Builds rich embedding text from title, description, category, tags, filters, and audio type
- Generates embeddings using VoyageAI's voyage-3 model (1024 dimensions)
- Stores embeddings in PostgreSQL with metadata
- Rate limiting (50ms delay between requests)
- Progress bar with live updates
- Cost estimation and tracking
- Error handling (continues on failure, reports at end)
- Dry-run mode for previewing without API calls or database writes

### Output Example

```
========================================
  Embedding Generation Sync
========================================

Fetching content from Contentful...
Found 200 items (150 sounds, 50 channels)

Generating embeddings...
Estimated total cost: $0.0800

Progress: [==============================>] 200/200 (100%) | Cost: $0.0798 | Errors: 0

========================================
  Sync Complete
========================================

Duration: 45.23s
Processed: 200 items
  - Sounds: 150
  - Channels: 50

Embeddings: 200 generated
Total Cost: $0.0798
Errors: 0
```

### Error Handling

If errors occur during processing, the script will:
1. Continue processing remaining items
2. Track error count in progress bar
3. Display detailed error report at end
4. Exit with code 1 if any errors occurred

### Prerequisites

Environment variables (see `.env.example`):
- `CONTENTFUL_SPACE_ID` - Contentful space ID
- `CONTENTFUL_ACCESS_TOKEN` - Contentful Content Delivery API token
- `CONTENTFUL_ENVIRONMENT` - Contentful environment (default: master)
- `VOYAGEAI_API_KEY` - VoyageAI API key
- `DATABASE_URL` - PostgreSQL connection string

### Cost Estimation

VoyageAI voyage-3 pricing: ~$0.12 per 1M tokens
- Rough estimate: 1 token ≈ 4 characters
- Average content item: ~200 characters = ~50 tokens
- Cost per item: ~$0.000006
- 1000 items: ~$0.06

Actual costs may vary based on content length and complexity.
