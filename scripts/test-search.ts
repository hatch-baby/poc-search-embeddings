/**
 * Interactive Search Test CLI
 *
 * Provides interactive command-line interface for testing the search API.
 * Displays results with emojis, similarity scores, and performance metrics.
 */

import type { SearchResponse, SearchResult } from '../src/types/index.js';

// Configuration
const API_URL = process.env.API_URL || 'http://localhost:3000';
const SEARCH_ENDPOINT = `${API_URL}/search`;

// Emojis for content types
const EMOJI_MAP = {
  sound: '🔊',
  channel: '🎵',
  track: '🎼'
} as const;

/**
 * Display welcome banner
 */
function displayBanner(): void {
  console.log('========================================');
  console.log('  Embedding Search - Interactive Test');
  console.log('========================================');
  console.log('');
}

/**
 * Format and display search results
 */
function displayResults(response: SearchResponse & { debug?: any }): void {
  const { results, query, latency_ms, debug } = response;

  console.log(`\n🔍 Searching for: "${query}"\n`);

  if (results.length === 0) {
    console.log('No results found.\n');
    return;
  }

  console.log('Results:');
  results.forEach((result: SearchResult, index: number) => {
    const emoji = EMOJI_MAP[result.contentType] || '📄';
    console.log(`${index + 1}. ${emoji} ${result.title} (${result.contentType}) - ${result.score}`);
  });

  // Display timing information
  if (debug) {
    const embeddingTime = debug.embedding_time_ms || 0;
    const searchTime = (debug.fetch_time_ms || 0) + (debug.similarity_time_ms || 0);
    console.log(`\n⏱️  Total: ${latency_ms}ms (embedding: ${embeddingTime}ms, search: ${searchTime}ms)`);
  } else {
    console.log(`\n⏱️  Total: ${latency_ms}ms`);
  }
}

/**
 * Display error message
 */
function displayError(message: string): void {
  console.log(`\n❌ Error: ${message}\n`);
}

/**
 * Perform search API call
 */
async function performSearch(query: string): Promise<void> {
  try {
    const response = await fetch(SEARCH_ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ query })
    });

    if (!response.ok) {
      // Handle HTTP errors
      if (response.status === 404) {
        displayError('Search endpoint not found. Is the API server running?');
        return;
      }

      try {
        const errorData = await response.json() as any;
        displayError(errorData.message || errorData.error || `HTTP ${response.status}`);
      } catch {
        displayError(`HTTP ${response.status}: ${response.statusText}`);
      }
      return;
    }

    const data = await response.json() as SearchResponse & { debug?: any };
    displayResults(data);

  } catch (error) {
    if (error instanceof TypeError && error.message.includes('fetch')) {
      displayError(
        `Cannot connect to API server at ${API_URL}\n` +
        '   Make sure the server is running with: bun run dev'
      );
    } else {
      displayError(error instanceof Error ? error.message : 'Unknown error occurred');
    }
  }
}

// Global stdin reader and buffer for reading lines
const stdinReader = Bun.stdin.stream().getReader();
const decoder = new TextDecoder();
let buffer = '';

/**
 * Read line from stdin using buffered reading
 * Maintains a buffer across calls to handle partial reads
 */
async function readLine(prompt: string): Promise<string> {
  // Write prompt to stdout
  process.stdout.write(prompt);

  while (true) {
    // Check if we already have a complete line in the buffer
    const newlineIndex = buffer.indexOf('\n');
    if (newlineIndex !== -1) {
      const line = buffer.substring(0, newlineIndex).trim();
      buffer = buffer.substring(newlineIndex + 1);
      return line;
    }

    // Read more data from stdin
    const { value, done } = await stdinReader.read();

    if (done) {
      // EOF reached, return remaining buffer
      const line = buffer.trim();
      buffer = '';
      return line;
    }

    // Add to buffer
    buffer += decoder.decode(value, { stream: true });
  }
}

/**
 * Main interactive loop
 */
async function main(): Promise<void> {
  displayBanner();

  try {
    // Main loop
    while (true) {
      const input = await readLine('Search (or \'quit\'): ');

      if (!input) {
        continue;
      }

      if (input.toLowerCase() === 'quit' || input.toLowerCase() === 'exit') {
        console.log('\n👋 Goodbye!\n');
        process.exit(0);
      }

      await performSearch(input);
      console.log('');
    }
  } catch (error) {
    // Handle EOF or other stdin errors
    console.log('\n\n👋 Goodbye!\n');
    process.exit(0);
  }
}

// Handle Ctrl+C gracefully
process.on('SIGINT', () => {
  console.log('\n\n👋 Goodbye!\n');
  process.exit(0);
});

// Run main function
main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
