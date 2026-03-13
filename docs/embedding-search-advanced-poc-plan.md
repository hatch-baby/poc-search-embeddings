# Embedding Search Advanced POC - New Repo Plan

**Created:** 2026-03-12
**Purpose:** Validate full end-to-end semantic search with real VoyageAI embeddings
**Stack:** Node/Bun + PostgreSQL + VoyageAI
**Scope:** Essentials only - sync script, simple API, search endpoint

---

## Goal

Build a **separate repo** that validates semantic search with real embeddings and provides working code to reference when building the production backend.

**Success Criteria:**
1. ✅ Sync script populates PostgreSQL with real VoyageAI embeddings
2. ✅ API server returns search results with Contentful IDs + titles
3. ✅ End-to-end latency < 200ms
4. ✅ Embedding quality noticeably better than mock POC
5. ✅ Clear path to production implementation

---

## Repo Structure

```
embedding-search-poc/
├── src/
│   ├── sync/
│   │   └── generate-embeddings.ts       # Fetch Contentful → VoyageAI → PostgreSQL
│   ├── api/
│   │   ├── server.ts                    # Simple Express/Hono API server
│   │   └── routes/
│   │       └── search.ts                # POST /search endpoint
│   ├── lib/
│   │   ├── contentful.ts                # Contentful API client
│   │   ├── voyageai.ts                  # VoyageAI embedding service
│   │   ├── database.ts                  # PostgreSQL client (pg or Postgres.js)
│   │   └── similarity.ts                # Cosine similarity calculation
│   └── types/
│       └── index.ts                     # TypeScript types
├── scripts/
│   ├── setup-db.sql                     # PostgreSQL schema DDL
│   └── test-search.ts                   # CLI tool to test searches interactively
├── .env.example                         # Required env vars template
├── package.json
├── tsconfig.json
└── README.md                            # Setup and usage instructions
```

---

## Core Components

### 1. Database Schema (`scripts/setup-db.sql`)

```sql
CREATE TABLE content_embeddings (
  id SERIAL PRIMARY KEY,
  contentful_id VARCHAR(255) UNIQUE NOT NULL,
  content_type VARCHAR(50) NOT NULL,  -- 'sound' or 'channel'
  title TEXT NOT NULL,
  embedding JSONB NOT NULL,           -- Store as JSON array [0.123, -0.456, ...]
  metadata JSONB,                     -- Category, tags, description, etc.
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_contentful_id ON content_embeddings(contentful_id);
CREATE INDEX idx_content_type ON content_embeddings(content_type);
```

**Design Notes:**
- Use JSONB for embeddings (no pgvector needed for 200-2000 items)
- Store metadata separately for easy debugging
- Simple indexes for lookups

---

### 2. Sync Script (`src/sync/generate-embeddings.ts`)

**Process:**
1. Fetch all sounds + channels from Contentful (with `include: 2` to resolve linked fields)
2. **Verify Contentful schema** - determine which fields are taxonomy vs free-form tags
3. Extract rich metadata: title, description, category, tags, filters, audioType
4. Build embedding text by concatenating all relevant fields
5. Call VoyageAI API to generate embeddings
6. Store in PostgreSQL with metadata
7. Show progress and cost estimates

**Embedding Text Construction:**
```typescript
// IMPORTANT: Verify which fields are actual taxonomy in Contentful first!
// Currently assuming: filters = taxonomy, tags = may or may not be taxonomy

const embeddingText = [
  item.title,                    // e.g., "Pacific Ocean Waves"
  item.description || "",        // Full description text
  item.category || "",           // e.g., "Nature Sounds"
  ...(item.tags || []),          // TBD: verify if taxonomy
  ...(item.filterNames || []),   // Taxonomy concepts from linked filters
  item.audioType || ""           // e.g., "White Noise", "Music"
].filter(Boolean).join(" | ");

const embedding = await voyageai.embed(embeddingText);
```

**Run Mode:** Manual (execute when content changes)

---

### 3. VoyageAI Configuration (`src/lib/voyageai.ts`)

**Recommended Settings:**
- **Model:** `voyage-3` (latest, best quality)
- **Dimensions:** 1024 (good balance of quality/size)
- **Input Type:** `document` (for storing content)
- **Cost:** ~$0.00012 per 1k tokens

**For Query Embeddings:**
- **Input Type:** `query` (optimized for search queries)

**API Wrapper:**
```typescript
export async function generateEmbedding(
  text: string,
  inputType: 'document' | 'query' = 'document'
): Promise<number[]> {
  const response = await fetch('https://api.voyageai.com/v1/embeddings', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${process.env.VOYAGEAI_API_KEY}`
    },
    body: JSON.stringify({
      model: 'voyage-3',
      input: [text],
      input_type: inputType
    })
  });

  const data = await response.json();
  return data.data[0].embedding;
}
```

---

### 4. API Server (`src/api/server.ts`)

**Simple Express or Hono server:**
```typescript
import express from 'express';
import { searchRoute } from './routes/search';

const app = express();
app.use(express.json());

app.post('/search', searchRoute);

app.listen(3000, () => {
  console.log('API server running on http://localhost:3000');
});
```

---

### 5. Search Endpoint (`src/api/routes/search.ts`)

**Request:**
```typescript
POST /search
Content-Type: application/json

{
  "query": "ocean sounds",
  "limit": 20  // optional, default 10
}
```

**Response:**
```typescript
{
  "results": [
    {
      "contentfulId": "SOUND_rec123abc",
      "title": "Pacific Ocean Waves",
      "contentType": "sound",
      "score": 0.89
    },
    {
      "contentfulId": "CHANNEL_rec456def",
      "title": "Beach Meditation Series",
      "contentType": "channel",
      "score": 0.82
    }
  ],
  "query": "ocean sounds",
  "latency_ms": 145,
  "count": 2
}
```

**Implementation Flow:**
1. Receive query text
2. Generate query embedding via VoyageAI (input_type: 'query')
3. Fetch all embeddings from PostgreSQL
4. Compute cosine similarity in-memory for each item
5. Sort by similarity (descending)
6. Return top N results with metadata
7. Include timing metrics

---

### 6. Similarity Calculation (`src/lib/similarity.ts`)

```typescript
export function cosineSimilarity(a: number[], b: number[]): number {
  let dotProduct = 0;
  let normA = 0;
  let normB = 0;

  for (let i = 0; i < a.length; i++) {
    dotProduct += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }

  return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
}
```

**Performance:** ~5-20ms for 200 items, ~50-100ms for 2000 items

---

### 7. Test CLI (`scripts/test-search.ts`)

**Interactive search tool (like current POC):**
- Type any text query
- Calls `POST /search` API endpoint
- Displays results with titles, scores, and timing
- Shows latency breakdown (embedding generation vs similarity calculation)

**Example Session:**
```
$ bun run test-search

Search (or 'quit'): ocean

🔍 Searching for: "ocean"

Results:
1. 🔊 Pacific Ocean Waves (sound) - 0.89
2. 🎵 Beach Meditation Series (channel) - 0.82
3. 🔊 Coastal Sunrise (sound) - 0.78

⏱️  Total: 145ms (embedding: 95ms, search: 50ms)

Search (or 'quit'):
```

---

## Environment Variables

**Required in `.env`:**
```bash
# Contentful
CONTENTFUL_SPACE_ID=hlsdh3zwyrtx
CONTENTFUL_ACCESS_TOKEN=your_token_here
CONTENTFUL_ENVIRONMENT=master

# VoyageAI
VOYAGEAI_API_KEY=your_voyage_key_here

# PostgreSQL
DATABASE_URL=postgresql://user:password@localhost:5432/embeddings_poc
```

---

## Key Technical Decisions

### VoyageAI vs OpenAI
- **Cost:** VoyageAI ~40% cheaper (~$0.12/1M tokens vs OpenAI ~$0.20/1M tokens)
- **Quality:** Comparable or better for semantic search tasks
- **Dimensions:** 1024 (VoyageAI voyage-3) vs 1536 (OpenAI text-embedding-3-small)
- **Smaller file size:** 1024 dims = ~33% smaller than OpenAI

### Why JSON Column (Not pgvector)
- **Simplicity:** No extension installation/approval needed
- **Performance:** Good enough for 200-2000 items (< 100ms)
- **Portability:** Works on any PostgreSQL instance
- **Easy upgrade path:** Can add pgvector later without changing API

### Manual Sync (Not Scheduled)
- **Simplicity:** Just run `bun run sync` when needed
- **Cost control:** Only regenerate when content actually changes
- **Low maintenance:** No cron jobs or monitoring needed
- Content updates are infrequent (manual is fine)

---

## Implementation Steps

### Phase 1: Database Setup
1. Create local PostgreSQL database
2. Run `setup-db.sql` to create schema
3. Verify table structure

### Phase 2: Sync Script
1. **Verify Contentful schema** - identify which fields are taxonomy
2. Build Contentful client (reuse from current POC)
3. Build VoyageAI client
4. Extract metadata and build embedding text
5. Store embeddings in PostgreSQL
6. Test with 10-20 items first, then scale to 200

### Phase 3: API Server
1. Set up Express/Hono server
2. Implement `/search` endpoint
3. Test locally with curl/Postman

### Phase 4: Test CLI
1. Build interactive search tool
2. Test various queries
3. Validate latency and quality

---

## Success Metrics

**Quality:**
- ✅ "ocean" finds beach/water/coastal sounds
- ✅ "meditation" finds mindfulness/zen/calm content
- ✅ "sleep" finds relaxation/peaceful/bedtime content
- ✅ Results feel semantically relevant (not just keyword matching)

**Performance:**
- ✅ Total latency < 200ms (end-to-end)
- ✅ Embedding generation < 100ms
- ✅ Similarity search < 50ms (for 200 items)

**Cost:**
- ✅ Initial sync: < $0.10 for 200 items
- ✅ Per search: ~$0.0001 (acceptable)

---

## What's NOT in Scope

**Explicitly excluded to keep POC focused:**
- ❌ Pre-computed query cache (can add later)
- ❌ Text matching fallback for unknown queries (can add later)
- ❌ Production deployment (local testing only)
- ❌ Authentication/authorization
- ❌ Rate limiting
- ❌ Monitoring/alerting
- ❌ Automated testing suite
- ❌ pgvector extension (save for production if needed)
- ❌ Multi-device support (start with one device, scale later)

---

## Migration to Production

**After POC validation, this code provides:**
1. **Database schema** - can copy to production PostgreSQL
2. **Sync script logic** - port to Spring/Groovy or keep as Node script
3. **API contract** - request/response format for Spring endpoint
4. **Similarity calculation** - port to Java for Spring backend
5. **Cost estimates** - actual usage data to justify budget
6. **Quality benchmark** - real search results to demo to stakeholders

**Production differences:**
- Run sync script on schedule (nightly cron)
- Add pgvector if latency > 100ms or dataset > 5000 items
- Add pre-computed query cache for common searches
- Deploy to staging/production environment
- Add monitoring and error handling
- Integrate with existing Spring backend

---

## First Steps for New Agent

1. **Create new repo** - `mkdir embedding-search-poc && cd embedding-search-poc`
2. **Initialize project** - `bun init` or `npm init`
3. **Verify Contentful schema** - Check which fields are taxonomy vs free-form tags
4. **Set up PostgreSQL locally** - Docker or native install
5. **Start with sync script** - Get embeddings into database first
6. **Build API second** - Server + search endpoint
7. **Test CLI last** - Interactive validation

---

## Questions to Resolve

**Before starting implementation:**
- [ ] Which Contentful fields are actual taxonomy? (filters, tags, audioType?)
- [ ] Should we fetch all sounds/channels or just a subset initially?
- [ ] Any specific search queries to optimize for?
- [ ] Preference for Express vs Hono for API server?

---

## Reference Links

- **Current POC:** `/Users/phil/Code/proto/proto/scripts/` (mock embeddings)
- **VoyageAI Docs:** https://docs.voyageai.com/
- **VoyageAI Pricing:** ~$0.12 per 1M tokens
- **Contentful Space:** `hlsdh3zwyrtx`
- **Target Dataset:** 200 items initially (sounds + channels for one device)

---

## Notes

- This POC uses **real embeddings** (VoyageAI) vs current POC which uses **mock embeddings**
- Focus on **end-to-end validation**, not production-ready code
- Keep it **simple** - essentials only, no over-engineering
- **Manual operations** preferred over automation (simpler, lower risk)
- Code should be **easy to understand** and port to production backend (Spring/Groovy)
