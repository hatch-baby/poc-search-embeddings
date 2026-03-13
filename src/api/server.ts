/**
 * Embedding Search API Server
 *
 * Bun-native HTTP server with semantic search endpoint.
 * Uses Bun.serve() with routes for optimal performance.
 */

import { handleSearch } from './routes/search.js';

const PORT = parseInt(process.env.PORT || '3000', 10);
const HOST = process.env.HOST || 'localhost';
const isDevelopment = process.env.NODE_ENV !== 'production';

/**
 * CORS headers for development
 */
function corsHeaders(): Record<string, string> {
  if (!isDevelopment) {
    return {};
  }

  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Max-Age': '86400'
  };
}

/**
 * Health check endpoint
 */
function handleHealth(): Response {
  return new Response(
    JSON.stringify({
      status: 'ok',
      timestamp: new Date().toISOString(),
      version: '1.0.0'
    }),
    {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        ...corsHeaders()
      }
    }
  );
}

/**
 * 404 Not Found handler
 */
function handleNotFound(): Response {
  return new Response(
    JSON.stringify({
      error: 'Not Found',
      message: 'The requested endpoint does not exist',
      available_endpoints: [
        'GET /health - Health check',
        'POST /search - Semantic search'
      ]
    }),
    {
      status: 404,
      headers: {
        'Content-Type': 'application/json',
        ...corsHeaders()
      }
    }
  );
}

/**
 * OPTIONS handler for CORS preflight
 */
function handleOptions(): Response {
  return new Response(null, {
    status: 204,
    headers: corsHeaders()
  });
}

console.log('');
console.log('╔════════════════════════════════════════╗');
console.log('║   Embedding Search API Server          ║');
console.log('╚════════════════════════════════════════╝');
console.log('');
console.log(`Environment: ${isDevelopment ? 'development' : 'production'}`);
console.log(`Storage: JSON file (.embeddings-cache.json)`);

// Validate required environment variables
const requiredEnvVars = ['VOYAGEAI_API_KEY'];

const missingEnvVars = requiredEnvVars.filter(key => !process.env[key]);

if (missingEnvVars.length > 0) {
  console.error('\n❌ Missing required environment variables:');
  missingEnvVars.forEach(key => console.error(`   - ${key}`));
  console.error('\nPlease create a .env file with the required variables.\n');
  console.error('Note: The demo includes pre-cached embeddings, so you can');
  console.error('skip this if you just want to try the search with existing data!\n');
  process.exit(1);
}

/**
 * Main server using Bun.serve() with routes
 */
const server = Bun.serve({
  port: PORT,
  hostname: HOST,

  async fetch(req) {
    const url = new URL(req.url);
    const path = url.pathname;
    const method = req.method;

    // Handle OPTIONS for CORS preflight
    if (method === 'OPTIONS') {
      return handleOptions();
    }

    // Route handling
    if (path === '/health' && method === 'GET') {
      return handleHealth();
    }

    if (path === '/search' && method === 'POST') {
      const response = await handleSearch(req);
      // Add CORS headers to response
      if (isDevelopment) {
        const headers = new Headers(response.headers);
        Object.entries(corsHeaders()).forEach(([key, value]) => {
          headers.set(key, value as string);
        });
        return new Response(response.body, {
          status: response.status,
          statusText: response.statusText,
          headers
        });
      }
      return response;
    }

    // 404 for unknown routes
    return handleNotFound();
  },

  development: isDevelopment
    ? {
        hmr: true,
        console: true
      }
    : undefined,

  error(error) {
    console.error('Server error:', error);
    return new Response(
      JSON.stringify({
        error: 'Internal Server Error',
        message: isDevelopment ? error.message : 'An unexpected error occurred'
      }),
      {
        status: 500,
        headers: {
          'Content-Type': 'application/json',
          ...corsHeaders()
        }
      }
    );
  }
});

console.log('');
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.log(`✅ Server is running!`);
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.log('');
console.log(`🌐 URL: http://${server.hostname}:${server.port}`);
console.log('');
console.log('📍 Available endpoints:');
console.log(`   GET  /health - Check server status`);
console.log(`   POST /search - Search for content`);
console.log('');
console.log('💡 Try it out:');
console.log('   Open a new terminal and run: bun run search');
console.log('');
console.log('⏹️  Press Ctrl+C to stop the server');
console.log('');

// Graceful shutdown
process.on('SIGINT', () => {
  console.log('\n\nShutting down gracefully...');
  server.stop();
  process.exit(0);
});

process.on('SIGTERM', () => {
  console.log('\n\nShutting down gracefully...');
  server.stop();
  process.exit(0);
});
