# Embedding Search POC

A proof-of-concept semantic search system using VoyageAI embeddings and PostgreSQL, with an interactive test CLI and REST API.

> 👋 **New to command line tools?** Check out [GETTING_STARTED.md](GETTING_STARTED.md) for a step-by-step beginner's guide!

## 🤖 Need Help Setting This Up?

If you have Claude Code, copy and paste this prompt to get assistance:

```
I need help setting up this embedding search project. Please:

1. Check if I have Bun installed (if not, tell me how to install it)
2. Help me create a .env file with the right format
3. Walk me through installing dependencies with "bun install"
4. Explain what "bun run setup:preview" does and run it for me
5. When I'm ready, help me run "bun run setup" to generate embeddings
6. Start the server with "bun run server"
7. Show me how to test it with "bun run search"

Go step by step, explain what each command does in simple terms, and check for errors along the way. Don't assume I know anything about terminal commands - explain everything clearly!
```

## Overview

This project validates semantic search capabilities by:
- Fetching content from Contentful CMS (sounds and channels)
- Generating embeddings using VoyageAI's voyage-3 model (1024 dimensions)
- Storing embeddings in PostgreSQL with rich metadata
- Providing a REST API for semantic search
- Including an interactive CLI for testing search quality

**Why this POC?** To validate embedding quality, search performance, and cost before building production features.

## Quick Start

### 🚀 Try It Right Now (No Setup Required!)

This repo includes pre-generated embeddings, so you can try semantic search **immediately** without any API keys:

```bash
# 1. Install dependencies
bun install

# 2. Start the server (uses included cache)
bun run server

# 3. Try searching (in a new terminal)
bun run search
```

That's it! No Contentful or VoyageAI API keys needed to demo the search.

### Option A: In-Memory Mode (Fastest - No Database Setup!)

Perfect for regenerating embeddings or working with your own Contentful data. Just 4 simple commands:

```bash
# 1. Install dependencies
bun install

# 2. Create .env file with your API keys
cp .env.example .env
# Edit .env and add CONTENTFUL_ACCESS_TOKEN and VOYAGEAI_API_KEY

# 3. Preview what will happen (optional but recommended!)
bun run setup:preview

# 4. Set up the embeddings
bun run setup

# 5. Start the server
bun run server

# 6. Try searching (in a new terminal)
bun run search
```

**Note:** This repo includes pre-cached data from Contentful (313 items: sounds, channels, and tracks for Hatch Sleep Clock) with voyage-3 embeddings already generated. This means you can demo the semantic search immediately without any API keys!

The cache files (`.embeddings-cache.json` and `.contentful-cache.json`) are included in the repo for demo purposes. If you want to regenerate with your own Contentful data, see Option A below.

### Demo Search Terms

Try these to showcase semantic search (finds related content, not just exact keyword matches):

**Nature:** `thunderstorm` - finds rain, weather, ambient nature sounds
**Activities:** `focus and concentrate` - finds productivity, study, work sounds
**Moods:** `cozy and warm` - finds comfort, relaxation, peaceful content
**Places:** `beach` - finds ocean, waves, coastal sounds
**Creative:** `camping under stars` - finds outdoor, night, nature sounds

Compare similar concepts to see semantic understanding:
- `ocean` vs `beach` vs `seaside`
- `sleep` vs `bedtime` vs `nighttime`
- `relax` vs `chill` vs `unwind`

### Option B: PostgreSQL Mode (Persistent Storage)

For production-like setup with persistent storage:

#### 1. Prerequisites

- **Bun** (native JavaScript runtime) - [Install](https://bun.sh)
- **PostgreSQL** 12+ - [Install](https://www.postgresql.org/download/)
- **API Keys:**
  - Contentful Content Delivery API token
  - VoyageAI API key

#### 2. Set Up Environment

```bash
# Copy the example environment file
cp .env.example .env

# Edit .env with your actual credentials
# STORAGE_MODE=postgres (change from "memory" to "postgres")
# CONTENTFUL_SPACE_ID and CONTENTFUL_ACCESS_TOKEN are required for syncing
# VOYAGEAI_API_KEY is required for embedding generation
# DATABASE_URL must point to your local PostgreSQL instance
```

See [API.md](API.md) for detailed environment variable documentation.

#### 3. Set Up Database

```bash
# Create PostgreSQL database
createdb embeddings_poc

# Set up schema
psql -d embeddings_poc -f scripts/setup-db.sql

# Verify setup
psql -d embeddings_poc -c "\dt content_embeddings"
```

See [docs/DATABASE.md](docs/DATABASE.md) for detailed database setup instructions.

#### 4. Generate Embeddings

```bash
# Dry-run mode (preview without making API calls or storing data)
bun run sync:dry-run

# Full sync (fetch from Contentful, generate embeddings, store in PostgreSQL)
bun run sync
```

The sync script will:
- Fetch all sounds and channels from Contentful
- Generate embeddings via VoyageAI (~50-100ms per item)
- Store in PostgreSQL with metadata
- Show progress and cost estimates

See [src/sync/README.md](src/sync/README.md) for detailed sync documentation.

#### 5. Start the API Server

```bash
# Development mode (with hot reload)
bun run dev

# Production mode
bun run start
```

The server will start at `http://localhost:3000`.

#### 6. Test Search

```bash
# Interactive search CLI
bun run test-search

# Or use curl
curl -X POST http://localhost:3000/search \
  -H "Content-Type: application/json" \
  -d '{"query":"ocean sounds","limit":5}'
```

## Architecture

### Tech Stack

| Component | Technology | Purpose |
|-----------|-----------|---------|
| **Runtime** | Bun | Native TypeScript support, built-in HTTP server |
| **Database** | PostgreSQL + Bun.sql | Embedding storage and retrieval |
| **Embeddings** | VoyageAI voyage-3 | 1024-dimension semantic vectors |
| **Similarity** | Cosine similarity (in-memory) | Vector comparison and ranking |
| **API** | Bun.serve() | REST API for search endpoint |

### Data Flow

```
Contentful (sounds + channels)
    ↓
Sync Script
    ├─ Fetch content with metadata
    ├─ Build embedding text
    ├─ Call VoyageAI API
    └─ Store in PostgreSQL
    ↓
PostgreSQL Database (embeddings + metadata)
    ↓
API Server
    ├─ Receive search query
    ├─ Generate query embedding
    ├─ Fetch all stored embeddings
    ├─ Calculate cosine similarity
    └─ Return top N results (< 200ms)
```

### Performance Characteristics

| Operation | Time | Notes |
|-----------|------|-------|
| Embedding generation | 50-100ms | VoyageAI API call |
| Database fetch | 10-20ms | All 200-2000 embeddings |
| Similarity calculation | 30-50ms | In-memory cosine similarity |
| **Total API response** | **< 200ms** | End-to-end latency |

## Project Structure

```
embedding-search-poc/
├── src/
│   ├── api/
│   │   ├── server.ts              # Main API server (Bun.serve)
│   │   └── routes/
│   │       └── search.ts          # POST /search endpoint
│   ├── sync/
│   │   ├── generate-embeddings.ts # Sync script (Contentful → VoyageAI → PostgreSQL)
│   │   └── README.md
│   ├── lib/
│   │   ├── contentful.ts          # Contentful CMS client
│   │   ├── voyageai.ts            # VoyageAI embedding service
│   │   ├── database.ts            # PostgreSQL client (Bun.sql)
│   │   ├── similarity.ts          # Cosine similarity calculation
│   │   ├── index.ts               # Convenience exports
│   │   └── README.md
│   └── types/
│       └── index.ts               # TypeScript type definitions
├── scripts/
│   ├── setup-db.sql               # PostgreSQL schema DDL
│   └── test-search.ts             # Interactive search CLI
├── docs/
│   ├── DATABASE.md                # Database setup guide
│   └── embedding-search-advanced-poc-plan.md  # Full implementation plan
├── API.md                         # API documentation
├── .env.example                   # Environment variables template
└── package.json
```

## API Documentation

### Health Check

```bash
GET /health
```

**Response:**
```json
{
  "status": "ok",
  "timestamp": "2024-01-15T10:30:00.000Z",
  "version": "1.0.0"
}
```

### Search

```bash
POST /search
Content-Type: application/json

{
  "query": "ocean sounds",
  "limit": 10,
  "contentType": "sound"  // optional: filter by 'sound' or 'channel'
}
```

**Response:**
```json
{
  "results": [
    {
      "contentfulId": "SOUND_rec123abc",
      "title": "Pacific Ocean Waves",
      "contentType": "sound",
      "score": 0.89,
      "metadata": {
        "category": "Nature",
        "tags": ["ocean", "waves", "nature"]
      }
    }
  ],
  "query": "ocean sounds",
  "latency_ms": 145,
  "count": 1
}
```

See [API.md](API.md) for complete endpoint documentation.

## Core Library Modules

All core functionality is modular and well-tested:

- **`contentful.ts`** - Fetch sounds and channels with metadata resolution
- **`voyageai.ts`** - Generate embeddings with VoyageAI API
- **`database.ts`** - Store and retrieve embeddings from PostgreSQL
- **`similarity.ts`** - Calculate cosine similarity between vectors

See [src/lib/README.md](src/lib/README.md) for detailed module documentation.

## Success Metrics

**Quality:**
- "ocean" finds beach/water/coastal content
- "meditation" finds mindfulness/zen/calm content
- Results feel semantically relevant (not just keyword matching)

**Performance:**
- ✅ Total latency < 200ms (end-to-end)
- ✅ Embedding generation < 100ms per item
- ✅ Similarity search < 50ms for 200+ items

**Cost:**
- ✅ Initial sync: < $0.10 for 200 items
- ✅ Per search: ~$0.0001 (very low)

## Troubleshooting

### "database embeddings_poc does not exist"

Create the database:
```bash
createdb embeddings_poc
psql -d embeddings_poc -f scripts/setup-db.sql
```

### "VOYAGEAI_API_KEY not set"

Add to `.env`:
```bash
VOYAGEAI_API_KEY=your_actual_api_key_here
```

### Connection refused on port 3000

Either:
1. Change `PORT` in `.env` to an available port
2. Kill the process using port 3000: `lsof -i :3000 | grep LISTEN | awk '{print $2}' | xargs kill -9`

### Slow embedding generation

This is normal. VoyageAI API calls typically take 50-100ms. For 200 items, expect 10-20 seconds total with rate limiting.

## Simple Commands Reference

These are the commands you'll use most often:

| Command | What it does | When to use it |
|---------|-------------|----------------|
| `bun run setup:preview` | Show what will happen without making changes | Before your first setup |
| `bun run setup` | Generate all the AI embeddings | First time, or when content changes |
| `bun run setup:refresh` | Re-fetch from Contentful and regenerate | When Contentful content is updated |
| `bun run server` | Start the search API | Every time you want to search |
| `bun run search` | Try searching from the terminal | To test if everything works |

## What's Included

✅ **Task 1:** PostgreSQL database and schema
✅ **Task 2:** Core library modules (Contentful, VoyageAI, Database, Similarity)
✅ **Task 3:** Sync script for generating embeddings
✅ **Task 4:** REST API with /search endpoint
✅ **Task 5:** Interactive test CLI
✅ **Task 6:** Documentation and environment template

## Next Steps

1. **For development:** See [docs/embedding-search-advanced-poc-plan.md](docs/embedding-search-advanced-poc-plan.md) for full implementation plan
2. **For API details:** See [API.md](API.md)
3. **For database questions:** See [docs/DATABASE.md](docs/DATABASE.md)
4. **For library details:** See [src/lib/README.md](src/lib/README.md)
5. **For sync details:** See [src/sync/README.md](src/sync/README.md)

## Limitations (Intentional for POC)

- **In-memory similarity search** - Not scalable beyond ~10,000 items
- **No caching** - Each search generates a fresh embedding
- **No authentication** - Public API (add for production)
- **No rate limiting** - Can be abused (add for production)

For production use, consider pgvector extension, response caching, and vector database alternatives.

## License

Internal POC - Nightlight/Calm Media
