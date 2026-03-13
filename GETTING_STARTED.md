# Getting Started

Welcome! This guide will help you try the embedding search demo in just a few minutes.

## No Setup Required!

This repo includes pre-cached embeddings, so you can try it **immediately** without any API keys or database setup.

## Step 1: Install Bun

Bun is a fast JavaScript runtime. If you don't have it:

**macOS/Linux:**
```bash
curl -fsSL https://bun.sh/install | bash
```

**Windows:**
```bash
powershell -c "irm bun.sh/install.ps1 | iex"
```

Check it worked:
```bash
bun --version
```

## Step 2: Get the Code

```bash
git clone https://github.com/hatch-baby/poc-search-embeddings.git
cd poc-search-embeddings
```

## Step 3: Install Dependencies

```bash
bun install
```

This takes about 10 seconds.

## Step 4: Start the Server

```bash
bun run server
```

You should see:
```
╔════════════════════════════════════════╗
║   Embedding Search API Server          ║
╚════════════════════════════════════════╝

✅ Server is running!

🌐 URL: http://localhost:3000
```

## Step 5: Try Searching

Open a **new terminal** (keep the server running) and run:

```bash
bun run search
```

Try searching for:
- `ocean sounds`
- `bedtime stories`
- `relaxing music`
- `focus and concentration`

The search uses AI to understand meaning, not just keywords!

## That's It!

You just tried semantic search with AI embeddings. No API keys, no database setup required.

## Want to Regenerate Embeddings?

If you want to generate fresh embeddings with your own Contentful data:

### 1. Get API Keys

**Contentful:**
1. Log in to Contentful
2. Go to Settings → API keys
3. Copy your Space ID and Content Delivery API access token

**VoyageAI:**
1. Sign up at [VoyageAI](https://www.voyageai.com)
2. Get your API key from the dashboard

### 2. Create .env File

```bash
cp .env.example .env
```

Edit `.env` and add your keys:
```bash
CONTENTFUL_SPACE_ID=your_space_id
CONTENTFUL_ACCESS_TOKEN=your_token
VOYAGEAI_API_KEY=your_voyage_key
```

### 3. Preview First

```bash
bun run setup:preview
```

This shows what will happen without making changes.

### 4. Generate Embeddings

```bash
bun run setup
```

This takes about 1-2 minutes for ~300 items and costs less than $0.01.

### 5. Done!

The new embeddings are saved to `.embeddings-cache.json` and you can search right away:

```bash
bun run server    # In one terminal
bun run search    # In another terminal
```

## Common Commands

| Command | What it does |
|---------|-------------|
| `bun run server` | Start the search API |
| `bun run search` | Try searching interactively |
| `bun run setup:preview` | Preview what will be generated |
| `bun run setup` | Generate new embeddings |
| `bun run setup:refresh` | Re-fetch from Contentful |

## Troubleshooting

### Port 3000 already in use

Change the port by creating a `.env` file:
```bash
PORT=3001
```

### "Command not found: bun"

Install Bun first (see Step 1 above).

### Search returns no results

Make sure the server is running in another terminal window.

## Need Help?

Use the Claude Code prompt in the README to get AI assistance with setup!
