# Getting Started

Welcome! This guide will help you set up the embedding search system step by step.

## Prerequisites

You need:
- [Bun](https://bun.sh) installed on your computer
- A Contentful account with API access
- A VoyageAI API key

## Step 1: Get Your API Keys

### Contentful API Key
1. Log in to Contentful
2. Go to Settings → API keys
3. Copy your Space ID and Content Delivery API access token

### VoyageAI API Key
1. Sign up at [VoyageAI](https://www.voyageai.com)
2. Get your API key from the dashboard

## Step 2: Setup Environment

1. Create a `.env` file in the project root
2. Add your keys:

```bash
CONTENTFUL_SPACE_ID=your_space_id_here
CONTENTFUL_ACCESS_TOKEN=your_token_here
VOYAGEAI_API_KEY=your_voyage_key_here
STORAGE_MODE=memory
```

## Step 3: Install Dependencies

```bash
bun install
```

## Step 4: Preview the Setup

Want to see what will happen first? Run a preview:

```bash
bun run setup:preview
```

This shows what will be processed without making any changes.

## Step 5: Run the Setup

Ready to go? This will:
- Load content from Contentful
- Generate AI embeddings
- Save them for searching

```bash
bun run setup
```

⏱️ This takes about 1-2 minutes for ~300 items.

## Step 6: Start the Server

```bash
bun run server
```

The server will start at http://localhost:3000

## Step 7: Try a Search

Open a new terminal (keep the server running) and try:

```bash
bun run search
```

Type a search query like "ocean sounds" or "bedtime stories" and see the results!

## Common Commands

| Command | What it does |
|---------|-------------|
| `bun run setup` | Set up embeddings (do this first) |
| `bun run setup:preview` | Preview what will be processed |
| `bun run setup:refresh` | Re-fetch data from Contentful |
| `bun run server` | Start the search server |
| `bun run search` | Try searching (server must be running) |

## Troubleshooting

### "Missing required environment variables"
- Check your `.env` file exists
- Make sure all keys are filled in
- No quotes around the values needed

### "Failed to fetch from Contentful"
- Check your Contentful API keys
- Make sure your Space ID is correct
- Verify your access token has read permissions

### "VoyageAI error"
- Check your VoyageAI API key
- Make sure you have credits available

### Search returns no results
- Make sure you ran `bun run setup` first
- Check that the setup completed without errors
- Try running `bun run setup:refresh` to get fresh data

## Need Help?

If you're stuck, you can use Claude Code to help! See README.md for a prompt you can use.
