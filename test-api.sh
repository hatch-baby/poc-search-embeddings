#!/bin/bash

# Test script for the Embedding Search API
# Prerequisites:
#   1. .env file with DATABASE_URL and VOYAGEAI_API_KEY
#   2. Database populated with embeddings (run: bun run sync)
#   3. Server running (in another terminal: bun run dev)

API_URL="http://localhost:3000"

echo "========================================="
echo "Testing Embedding Search API"
echo "========================================="
echo ""

# Test 1: Health check
echo "1. Testing GET /health"
echo "---"
curl -s "${API_URL}/health" | bun run -e "console.log(JSON.stringify(JSON.parse(await Bun.stdin.text()), null, 2))"
echo ""
echo ""

# Test 2: Search with basic query
echo "2. Testing POST /search (basic query)"
echo "---"
curl -s -X POST "${API_URL}/search" \
  -H "Content-Type: application/json" \
  -d '{
    "query": "ocean sounds",
    "limit": 5
  }' | bun run -e "console.log(JSON.stringify(JSON.parse(await Bun.stdin.text()), null, 2))"
echo ""
echo ""

# Test 3: Search with larger limit
echo "3. Testing POST /search (limit=20)"
echo "---"
curl -s -X POST "${API_URL}/search" \
  -H "Content-Type: application/json" \
  -d '{
    "query": "relaxing meditation",
    "limit": 20
  }' | bun run -e "console.log(JSON.stringify(JSON.parse(await Bun.stdin.text()), null, 2))"
echo ""
echo ""

# Test 4: Invalid request (missing query)
echo "4. Testing POST /search (invalid - missing query)"
echo "---"
curl -s -X POST "${API_URL}/search" \
  -H "Content-Type: application/json" \
  -d '{
    "limit": 10
  }' | bun run -e "console.log(JSON.stringify(JSON.parse(await Bun.stdin.text()), null, 2))"
echo ""
echo ""

# Test 5: Invalid request (invalid limit)
echo "5. Testing POST /search (invalid - limit out of range)"
echo "---"
curl -s -X POST "${API_URL}/search" \
  -H "Content-Type: application/json" \
  -d '{
    "query": "test",
    "limit": 500
  }' | bun run -e "console.log(JSON.stringify(JSON.parse(await Bun.stdin.text()), null, 2))"
echo ""
echo ""

# Test 6: 404 Not Found
echo "6. Testing GET /unknown (404)"
echo "---"
curl -s "${API_URL}/unknown" | bun run -e "console.log(JSON.stringify(JSON.parse(await Bun.stdin.text()), null, 2))"
echo ""
echo ""

echo "========================================="
echo "Tests Complete"
echo "========================================="
