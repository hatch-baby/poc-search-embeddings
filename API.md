# Embedding Search API

REST API for semantic search using VoyageAI embeddings and cosine similarity.

## Quick Start

### Prerequisites

1. **Environment variables** (create `.env` file):
   ```bash
   DATABASE_URL=postgresql://user:password@localhost:5432/embeddings_poc
   VOYAGEAI_API_KEY=your_voyage_api_key_here
   PORT=3000  # optional, defaults to 3000
   HOST=localhost  # optional, defaults to localhost
   NODE_ENV=development  # optional, enables CORS and debug info
   ```

2. **Populate database** with embeddings:
   ```bash
   bun run sync
   ```

### Start Server

Development mode (with hot reload):
```bash
bun run dev
```

Production mode:
```bash
bun run start
```

The server will start at `http://localhost:3000` (or your configured PORT).

## API Endpoints

### Health Check

**GET** `/health`

Check if the server is running.

**Response:**
```json
{
  "status": "ok",
  "timestamp": "2024-01-15T10:30:00.000Z",
  "version": "1.0.0"
}
```

### Search

**POST** `/search`

Perform semantic search across all indexed content.

**Request Body:**
```json
{
  "query": "ocean sounds",
  "limit": 10,           // optional, default 10, max 100
  "contentType": "sound" // optional, filter by 'sound' or 'channel'
}
```

**Response (200 OK):**
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
        "tags": ["ocean", "waves", "nature"],
        "description": "Calming ocean wave sounds..."
      }
    },
    {
      "contentfulId": "CHANNEL_rec456def",
      "title": "Beach Meditation Series",
      "contentType": "channel",
      "score": 0.82,
      "metadata": {
        "category": "Meditation",
        "tags": ["beach", "meditation"]
      }
    }
  ],
  "query": "ocean sounds",
  "latency_ms": 145,
  "count": 2,
  "debug": {
    "embedding_time_ms": 85,
    "fetch_time_ms": 12,
    "similarity_time_ms": 48,
    "total_embeddings": 500
  }
}
```

**Error Responses:**

- **400 Bad Request** - Invalid request parameters
  ```json
  {
    "error": "Invalid request",
    "message": "Query parameter is required and must be a non-empty string"
  }
  ```

- **500 Internal Server Error** - Server error
  ```json
  {
    "error": "Internal server error",
    "message": "Database connection failed"
  }
  ```

- **502 Bad Gateway** - VoyageAI API error
  ```json
  {
    "error": "Embedding generation failed",
    "message": "VoyageAI API error (429): Rate limit exceeded"
  }
  ```

## Testing

### Using curl

```bash
# Health check
curl http://localhost:3000/health

# Search with basic query
curl -X POST http://localhost:3000/search \
  -H "Content-Type: application/json" \
  -d '{"query":"ocean sounds","limit":5}'

# Search with content type filter
curl -X POST http://localhost:3000/search \
  -H "Content-Type: application/json" \
  -d '{"query":"meditation","limit":10,"contentType":"channel"}'
```

### Using the test script

```bash
./test-api.sh
```

This will run a suite of tests including:
- Health check
- Valid search requests
- Invalid requests (error handling)
- 404 handling

## Architecture

### Request Flow

1. **Receive query** - Validate query parameter
2. **Generate embedding** - Call VoyageAI API with `input_type: 'query'`
3. **Fetch embeddings** - Load all content embeddings from PostgreSQL
4. **Calculate similarity** - Compute cosine similarity in-memory
5. **Sort & limit** - Return top N results by similarity score
6. **Add metrics** - Include timing information for monitoring

### Performance

- **Embedding generation**: ~80-100ms (VoyageAI API call)
- **Database fetch**: ~10-20ms (depends on dataset size)
- **Similarity calculation**: ~30-50ms for 500 items
- **Total latency**: ~120-170ms for typical request

For larger datasets (>10,000 items), consider:
- Implementing vector database (pgvector, Pinecone, etc.)
- Adding caching for frequently searched queries
- Using batch processing for similarity calculations

### Technology Stack

- **Runtime**: Bun (native HTTP server with `Bun.serve()`)
- **Embedding Model**: VoyageAI voyage-3 (1024 dimensions)
- **Database**: PostgreSQL (via `Bun.sql`)
- **Similarity**: Cosine similarity (in-memory)

## Development

### CORS

CORS is enabled in development mode (`NODE_ENV !== 'production'`):
- All origins allowed (`Access-Control-Allow-Origin: *`)
- Methods: GET, POST, OPTIONS
- Headers: Content-Type, Authorization

In production, CORS is disabled by default.

### Debug Information

When `NODE_ENV !== 'production'`, the search response includes additional debug timing metrics:
```json
{
  "debug": {
    "embedding_time_ms": 85,
    "fetch_time_ms": 12,
    "similarity_time_ms": 48,
    "total_embeddings": 500
  }
}
```

### Hot Reload

Use `bun run dev` to enable hot module reloading. The server will automatically restart when you modify source files.

## Error Handling

The API handles various error scenarios:

1. **Missing environment variables** - Server fails to start with clear error message
2. **Invalid JSON** - Returns 400 with "Invalid JSON" error
3. **Missing query parameter** - Returns 400 with validation error
4. **VoyageAI API errors** - Returns 502 with API error details
5. **Database errors** - Returns 500 with database error details
6. **Unknown routes** - Returns 404 with list of available endpoints

## Limitations

This is a proof-of-concept implementation with the following limitations:

1. **In-memory similarity search** - Not scalable beyond ~10,000 items
2. **No authentication** - Public API (add auth for production)
3. **No rate limiting** - Can be abused (add rate limiting for production)
4. **No caching** - Each search generates fresh embedding
5. **Single-node** - No horizontal scaling (stateless design allows clustering)

For production use, consider:
- Vector database integration (pgvector, Pinecone, Weaviate)
- Authentication and authorization
- Rate limiting and request throttling
- Response caching
- Load balancing and clustering
- Monitoring and alerting
