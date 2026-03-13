# Embedding Search POC

A proof-of-concept semantic search system using VoyageAI embeddings and Contentful CMS, with JSON file storage and an interactive CLI.

> 👋 **New to command line tools?** Check out [GETTING_STARTED.md](GETTING_STARTED.md) for a step-by-step beginner's guide!

## 🤖 Need Help Setting This Up?

If you have Claude Code, copy and paste this prompt to get assistance:

```
I need help setting up this embedding search project. Please:

1. Check if I have Bun installed (if not, tell me how to install it)
2. Walk me through installing dependencies with "bun install"
3. Start the server with "bun run server"
4. Show me how to test it with "bun run search"

Go step by step, explain what each command does in simple terms, and check for errors along the way. Don't assume I know anything about terminal commands - explain everything clearly!
```

## Overview

This project demonstrates semantic search by:
- Fetching content from Contentful CMS (sounds, channels, and tracks)
- Generating embeddings using VoyageAI's voyage-3 model (1024 dimensions)
- Storing embeddings in JSON files (no database setup required!)
- Providing a REST API for semantic search
- Including an interactive CLI for testing search quality

**Why this POC?** To validate embedding quality, search performance, and cost before building production features.

## 🚀 Quick Start (Try It Right Now!)

This repo includes pre-generated embeddings, so you can try semantic search **immediately** without any API keys:

```bash
# 1. Clone the repo
git clone https://github.com/hatch-baby/poc-search-embeddings.git
cd poc-search-embeddings

# 2. Install dependencies
bun install

# 3. Start the server (uses included cache)
bun run server

# 4. Try searching (in a new terminal)
bun run search
```

That's it! The demo includes:
- ✅ 313 items from Contentful (sounds, channels, tracks)
- ✅ Pre-generated voyage-3 embeddings
- ✅ Taxonomy concepts and rich metadata
- ✅ No API keys needed to try it!

## Demo Search Terms

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

## Regenerate Embeddings (Optional)

Want to use your own Contentful data? Here's how to regenerate embeddings:

```bash
# 1. Create .env file with your API keys
cp .env.example .env
# Edit .env and add CONTENTFUL_ACCESS_TOKEN and VOYAGEAI_API_KEY

# 2. Preview what will happen (optional but recommended!)
bun run setup:preview

# 3. Generate embeddings
bun run setup

# 4. Start the server
bun run server

# 5. Try searching
bun run search
```

The cache files (`.embeddings-cache.json` and `.contentful-cache.json`) are included in the repo for demo purposes.

## Architecture

### Tech Stack

| Component | Technology | Purpose |
|-----------|-----------|---------|
| **Runtime** | Bun | Native TypeScript support, built-in HTTP server |
| **Storage** | JSON files | Simple, portable, no database required |
| **Embeddings** | VoyageAI voyage-3 | 1024-dimension semantic vectors |
| **Similarity** | Cosine similarity (in-memory) | Vector comparison and ranking |
| **API** | Bun.serve() | REST API for search endpoint |

### Data Flow

```
Contentful (sounds + channels + tracks)
    ↓
Sync Script
    ├─ Fetch content with metadata
    ├─ Extract taxonomy concepts
    ├─ Build embedding text
    ├─ Call VoyageAI API
    └─ Store in JSON file
    ↓
JSON Cache (.embeddings-cache.json)
    ↓
API Server
    ├─ Receive search query
    ├─ Generate query embedding
    ├─ Load cached embeddings
    ├─ Calculate cosine similarity
    └─ Return top N results (< 200ms)
```

### Performance Characteristics

| Operation | Time | Notes |
|-----------|------|-------|
| Embedding generation | 50-100ms | VoyageAI API call |
| Cache load | 100-200ms | Load 313 items from JSON |
| Similarity calculation | 30-50ms | In-memory cosine similarity |
| **Total API response** | **< 500ms** | End-to-end latency |

## Project Structure

```
poc-search-embeddings/
├── src/
│   ├── api/
│   │   ├── server.ts              # Main API server (Bun.serve)
│   │   └── routes/
│   │       └── search.ts          # POST /search endpoint
│   ├── sync/
│   │   └── generate-embeddings.ts # Sync script (Contentful → VoyageAI → JSON)
│   ├── lib/
│   │   ├── contentful.ts          # Contentful CMS client
│   │   ├── voyageai.ts            # VoyageAI embedding service
│   │   ├── database.ts            # JSON file storage
│   │   └── similarity.ts          # Cosine similarity calculation
│   └── types/
│       └── index.ts               # TypeScript type definitions
├── scripts/
│   └── test-search.ts             # Interactive search CLI
├── .embeddings-cache.json         # Pre-generated embeddings (7.5MB)
├── .contentful-cache.json         # Contentful data cache (964KB)
├── GETTING_STARTED.md             # Beginner's guide
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
  "contentType": "sound"  // optional: filter by 'sound', 'channel', or 'track'
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
        "description": "Calming ocean waves",
        "filterNames": ["Nature Sounds"],
        "taxonomyConcepts": ["Nature", "Water", "Soothing"]
      }
    }
  ],
  "query": "ocean sounds",
  "latency_ms": 145,
  "count": 1
}
```

## Simple Commands Reference

| Command | What it does | When to use it |
|---------|-------------|----------------|
| `bun run setup:preview` | Show what will happen without making changes | Before your first setup |
| `bun run setup` | Generate all the AI embeddings | First time, or when content changes |
| `bun run setup:refresh` | Re-fetch from Contentful and regenerate | When Contentful content is updated |
| `bun run server` | Start the search API | Every time you want to search |
| `bun run search` | Try searching from the terminal | To test if everything works |

## Success Metrics

**Quality:**
- "ocean" finds beach/water/coastal content ✓
- "meditation" finds mindfulness/zen/calm content ✓
- Results feel semantically relevant (not just keyword matching) ✓

**Performance:**
- ✅ Total latency < 500ms (end-to-end)
- ✅ Embedding generation < 100ms per item
- ✅ Similarity search < 50ms for 313 items

**Cost:**
- ✅ Initial sync: ~$0.0012 for 313 items
- ✅ Per search: ~$0.0001 (very low)

## What's Included

✅ **Pre-cached demo data** - Try it immediately with no setup
✅ **Contentful integration** - Fetches sounds, channels, and tracks
✅ **Taxonomy concepts** - Rich metadata from Contentful taxonomy
✅ **VoyageAI embeddings** - voyage-3 model (1024 dimensions)
✅ **REST API** - Simple /search endpoint
✅ **Interactive CLI** - Test search quality easily
✅ **Beginner-friendly** - Step-by-step guides and helpful output

## Limitations (Intentional for POC)

- **JSON file storage** - Not scalable beyond ~10,000 items (fine for POC!)
- **In-memory similarity search** - Loads all embeddings on each search
- **No caching** - Each search generates a fresh query embedding
- **No authentication** - Public API (add for production)
- **No rate limiting** - Can be abused (add for production)

For production use, consider:
- Vector database (Pinecone, Weaviate, pgvector)
- Query embedding cache
- Authentication & rate limiting
- Batch search endpoints

## Troubleshooting

### "VOYAGEAI_API_KEY not set"

The demo includes pre-cached embeddings, so you can skip this and just run:
```bash
bun run server
bun run search
```

If you want to regenerate embeddings, add your API key to `.env`:
```bash
VOYAGEAI_API_KEY=your_actual_api_key_here
```

### Connection refused on port 3000

Change the port in your `.env`:
```bash
PORT=3001
```

## License

Internal POC - Hatch Baby (Nightlight/Calm Media)
