# Core Library Modules

This directory contains the core library modules for the Embedding Search POC.

## Modules

### 1. `contentful.ts` - Contentful CMS Client

Fetches sounds and channels from Contentful with full metadata resolution.

**Key Functions:**
- `fetchSounds(limit?)` - Fetch all sounds (default 1000)
- `fetchChannels(limit?)` - Fetch all channels (default 1000)
- `fetchAllContent(soundLimit?, channelLimit?)` - Fetch both sounds and channels
- `fetchEntry(entryId)` - Fetch a single entry by ID
- `buildEmbeddingText(item)` - Build text for embedding generation
- `getSpaceInfo()` - Get space configuration

**Example:**
```typescript
import { fetchAllContent, buildEmbeddingText } from './lib/contentful.js';

const { sounds, channels, total } = await fetchAllContent();
console.log(`Fetched ${total} items`);

const embeddingText = buildEmbeddingText(sounds[0]);
console.log(embeddingText);
// "Pacific Ocean Waves | Calming ocean sounds | Nature Sounds | ocean, waves | White Noise"
```

### 2. `voyageai.ts` - VoyageAI Embedding Service

Generates embeddings using VoyageAI's voyage-3 model (1024 dimensions).

**Key Functions:**
- `generateEmbedding(text, inputType)` - Generate single embedding
  - `inputType: 'document'` for storing content
  - `inputType: 'query'` for search queries
- `generateEmbeddings(texts, inputType)` - Batch generate embeddings
- `estimateCost(texts)` - Estimate API cost
- `getModelInfo()` - Get model configuration

**Example:**
```typescript
import { generateEmbedding } from './lib/voyageai.js';

// Generate document embedding for storage
const docEmbedding = await generateEmbedding(
  'Pacific Ocean Waves - Calming nature sounds',
  'document'
);

// Generate query embedding for search
const queryEmbedding = await generateEmbedding(
  'ocean sounds',
  'query'
);

console.log(`Embedding dimensions: ${docEmbedding.length}`); // 1024
```

### 3. `database.ts` - PostgreSQL Client

Manages database connections and CRUD operations using Bun.SQL.

**Key Functions:**
- `insertEmbedding(data)` - Insert new embedding
- `updateEmbedding(contentfulId, data)` - Update existing embedding
- `upsertEmbedding(data)` - Insert or update
- `fetchAllEmbeddings(contentType?)` - Fetch all embeddings
- `fetchEmbeddingById(contentfulId)` - Fetch single embedding
- `deleteEmbedding(contentfulId)` - Delete embedding
- `countEmbeddings(contentType?)` - Count embeddings
- `embeddingExists(contentfulId)` - Check if exists
- `testConnection()` - Test database connection

**Example:**
```typescript
import { insertEmbedding, fetchAllEmbeddings } from './lib/database.js';

// Insert an embedding
await insertEmbedding({
  contentfulId: 'abc123',
  contentType: 'sound',
  title: 'Ocean Waves',
  embedding: [0.1, 0.2, 0.3, ...], // 1024 dimensions
  metadata: { category: 'Nature', tags: ['ocean'] }
});

// Fetch all embeddings
const embeddings = await fetchAllEmbeddings();
console.log(`Total embeddings: ${embeddings.length}`);

// Fetch only sounds
const sounds = await fetchAllEmbeddings('sound');
```

### 4. `similarity.ts` - Cosine Similarity

Calculates cosine similarity between embedding vectors.

**Key Functions:**
- `cosineSimilarity(a, b)` - Calculate similarity between two vectors
- `batchCosineSimilarity(query, documents)` - Calculate and sort multiple similarities

**Example:**
```typescript
import { cosineSimilarity, batchCosineSimilarity } from './lib/similarity.js';

// Single similarity
const similarity = cosineSimilarity(queryEmbedding, docEmbedding);
console.log(`Similarity: ${similarity.toFixed(4)}`); // 0.8945

// Batch similarity with sorting
const results = batchCosineSimilarity(queryEmbedding, [
  { id: '1', embedding: [0.1, 0.2, ...], title: 'Ocean Waves' },
  { id: '2', embedding: [0.05, 0.1, ...], title: 'Forest Sounds' }
]);

results.forEach(result => {
  console.log(`${result.title}: ${result.score.toFixed(4)}`);
});
```

### 5. `index.ts` - Convenience Exports

Re-exports all library functions for easy importing.

**Example:**
```typescript
// Instead of importing from individual files:
import { fetchAllContent } from './lib/contentful.js';
import { generateEmbedding } from './lib/voyageai.js';
import { insertEmbedding } from './lib/database.js';

// You can import from index:
import {
  fetchAllContent,
  generateEmbedding,
  insertEmbedding
} from './lib/index.js';
```

## Types

All TypeScript types are defined in `../types/index.ts`:

- `ContentType` - 'sound' | 'channel'
- `EmbeddingInputType` - 'document' | 'query'
- `ContentItem` - Processed content from Contentful
- `ContentEmbedding` - Database embedding record
- `SearchResult` - Search result with score
- `DatabaseRow` - Raw database row
- And more...

## Environment Variables

Required environment variables (see `.env.example`):

```bash
# Contentful
CONTENTFUL_SPACE_ID=hlsdh3zwyrtx
CONTENTFUL_ACCESS_TOKEN=your_token_here
CONTENTFUL_ENVIRONMENT=master

# VoyageAI
VOYAGEAI_API_KEY=your_key_here

# PostgreSQL
DATABASE_URL=postgresql://user:password@localhost:5432/embeddings_poc
```

## Testing

Run the import test to verify all modules work:

```bash
bun src/lib/test-imports.ts
```

## Error Handling

All functions throw descriptive errors:

```typescript
try {
  const content = await fetchAllContent();
} catch (error) {
  console.error('Failed to fetch content:', error.message);
}
```

Common errors:
- Missing environment variables
- API authentication failures
- Database connection issues
- Invalid input data

## Performance Notes

- **Contentful**: Fetches up to 1000 items per request (API limit)
- **VoyageAI**: ~50-100ms per embedding, ~$0.12 per 1M tokens
- **Database**: Connection pooling via Bun.SQL
- **Similarity**: ~5-20ms for 200 items, ~50-100ms for 2000 items

## Next Steps

With these core modules complete, you can now:

1. **Task 3**: Build sync script (`src/sync/generate-embeddings.ts`)
2. **Task 4**: Build API server (`src/api/server.ts`)
3. **Task 5**: Build test CLI (`scripts/test-search.ts`)
