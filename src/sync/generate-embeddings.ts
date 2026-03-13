/**
 * Generate Embeddings Sync Script
 *
 * Fetches content from Contentful, generates embeddings via VoyageAI,
 * and stores them in PostgreSQL for semantic search.
 *
 * Usage:
 *   bun src/sync/generate-embeddings.ts                  # Full sync
 *   bun src/sync/generate-embeddings.ts --dry-run        # Preview only
 *   bun src/sync/generate-embeddings.ts --limit 50       # Process only first 50 items
 *   bun src/sync/generate-embeddings.ts --limit 50 --dry-run  # Test with 50 items (no API calls)
 */

import { fetchAllContent, buildEmbeddingText } from '../lib/contentful.js';
import { generateEmbedding, generateEmbeddings, estimateCost } from '../lib/voyageai.js';
import { upsertEmbedding } from '../lib/database.js';
import type { ContentItem } from '../types/index.js';

/**
 * Sync configuration
 */
interface SyncConfig {
  dryRun: boolean;
  progressInterval: number; // Show progress every N items
  limit?: number; // Limit total items to process (for testing)
}

/**
 * Sync statistics
 */
interface SyncStats {
  totalItems: number;
  soundsCount: number;
  channelsCount: number;
  tracksCount: number;
  embeddingsGenerated: number;
  errors: number;
  totalCost: number;
  startTime: number;
  endTime?: number;
}

/**
 * Parse command-line arguments
 */
function parseArgs(): SyncConfig {
  const args = process.argv.slice(2);
  const dryRun = args.includes('--dry-run');

  // Parse --limit flag
  let limit: number | undefined;
  const limitIndex = args.findIndex(arg => arg === '--limit');
  if (limitIndex !== -1 && args[limitIndex + 1]) {
    limit = parseInt(args[limitIndex + 1]!, 10);
    if (isNaN(limit) || limit <= 0) {
      console.error('Error: --limit must be a positive number');
      process.exit(1);
    }
  }

  return {
    dryRun,
    progressInterval: 10, // Update progress every 10 items
    limit
  };
}

/**
 * Display progress bar
 */
function displayProgress(current: number, total: number, stats: SyncStats): void {
  const percentage = Math.round((current / total) * 100);
  const barWidth = 30;
  const filledWidth = Math.round((current / total) * barWidth);
  const emptyWidth = barWidth - filledWidth;

  const bar = '='.repeat(filledWidth) + '>'.repeat(Math.min(1, emptyWidth)) + ' '.repeat(Math.max(0, emptyWidth - 1));

  // Calculate estimated cost so far
  const estimatedCost = stats.totalCost.toFixed(4);

  process.stdout.write(`\rProgress: [${bar}] ${current}/${total} (${percentage}%) | Cost: $${estimatedCost} | Errors: ${stats.errors}`);
}

/**
 * Process a single content item
 */
async function processItem(
  item: ContentItem,
  config: SyncConfig
): Promise<{ success: boolean; cost: number; error?: string }> {
  try {
    // Build embedding text
    const embeddingText = buildEmbeddingText(item);

    if (!embeddingText || embeddingText.trim().length === 0) {
      return {
        success: false,
        cost: 0,
        error: 'Empty embedding text'
      };
    }

    // Calculate cost estimate for this item
    const itemCost = estimateCost([embeddingText]);

    // If dry-run, skip actual embedding generation
    if (config.dryRun) {
      return { success: true, cost: itemCost };
    }

    // Generate embedding
    const embedding = await generateEmbedding(embeddingText, 'document');

    // Store in database
    await upsertEmbedding({
      contentfulId: item.contentfulId,
      contentType: item.contentType,
      title: item.title,
      embedding,
      metadata: item.metadata
    });

    return { success: true, cost: itemCost };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    return {
      success: false,
      cost: 0,
      error: errorMessage
    };
  }
}

/**
 * Sleep for rate limiting
 */
function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Main sync function
 */
async function sync(): Promise<void> {
  const config = parseArgs();
  const stats: SyncStats = {
    totalItems: 0,
    soundsCount: 0,
    channelsCount: 0,
    tracksCount: 0,
    embeddingsGenerated: 0,
    errors: 0,
    totalCost: 0,
    startTime: Date.now()
  };

  console.log('');
  console.log('========================================');
  console.log('  Embedding Generation Sync');
  console.log('========================================');
  console.log('');

  if (config.dryRun) {
    console.log('[DRY RUN MODE - No data will be stored]');
    console.log('');
  }

  // Step 1: Fetch content from Contentful
  console.log('Fetching content from Contentful (filtered for Hatch Sleep Clock)...');

  let sounds: ContentItem[];
  let channels: ContentItem[];
  let tracks: ContentItem[];

  try {
    const contentData = await fetchAllContent();
    sounds = contentData.sounds;
    channels = contentData.channels;
    tracks = contentData.tracks;
    stats.soundsCount = sounds.length;
    stats.channelsCount = channels.length;
    stats.tracksCount = tracks.length;
    stats.totalItems = contentData.total;

    console.log(`Found ${stats.totalItems} items (${stats.soundsCount} sounds, ${stats.channelsCount} channels, ${stats.tracksCount} tracks)`);
    console.log('');
  } catch (error) {
    console.error('Failed to fetch content from Contentful:');
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  }

  if (stats.totalItems === 0) {
    console.log('No items to process.');
    return;
  }

  // Combine all items
  let allItems = [...sounds, ...channels, ...tracks];

  // Apply limit if specified
  if (config.limit && config.limit < allItems.length) {
    console.log(`Limiting to first ${config.limit} items (for testing)`);
    allItems = allItems.slice(0, config.limit);
    stats.totalItems = allItems.length;
    console.log('');
  }

  // Step 2: Calculate cost estimate
  const allTexts = allItems.map(item => buildEmbeddingText(item));
  const estimatedTotalCost = estimateCost(allTexts);

  console.log('Generating embeddings...');
  console.log(`Estimated total cost: $${estimatedTotalCost.toFixed(4)}`);
  console.log('');

  // Step 3: Process items in batches
  const errors: Array<{ item: ContentItem; error: string }> = [];
  const BATCH_SIZE = 2000; // Process 2000 items per API request
  const DELAY_BETWEEN_BATCHES = 1000; // 1 second between batches

  for (let batchStart = 0; batchStart < allItems.length; batchStart += BATCH_SIZE) {
    const batchEnd = Math.min(batchStart + BATCH_SIZE, allItems.length);
    const batch = allItems.slice(batchStart, batchEnd);

    try {
      if (!config.dryRun) {
        // Build embedding texts for this batch
        const batchTexts = batch.map(item => buildEmbeddingText(item));

        // Generate embeddings for entire batch in one API call
        const batchEmbeddings = await generateEmbeddings(batchTexts, 'document');

        // Store each embedding
        for (let i = 0; i < batch.length; i++) {
          const item = batch[i]!;
          const embedding = batchEmbeddings[i]!;

          try {
            await upsertEmbedding({
              contentfulId: item.contentfulId,
              contentType: item.contentType,
              title: item.title,
              embedding: embedding,
              metadata: item.metadata
            });

            stats.embeddingsGenerated++;
            const itemCost = estimateCost([batchTexts[i]!]);
            stats.totalCost += itemCost;
          } catch (error) {
            stats.errors++;
            errors.push({
              item,
              error: error instanceof Error ? error.message : String(error)
            });
          }
        }
      } else {
        // Dry run - just count
        stats.embeddingsGenerated += batch.length;
        const batchTexts = batch.map(item => buildEmbeddingText(item));
        stats.totalCost += estimateCost(batchTexts);
      }
    } catch (error) {
      // Batch failed - mark all items in batch as errors
      stats.errors += batch.length;
      const errorMsg = error instanceof Error ? error.message : String(error);
      batch.forEach(item => {
        errors.push({
          item,
          error: errorMsg
        });
      });
    }

    // Show progress
    displayProgress(batchEnd, allItems.length, stats);

    // Rate limiting: wait between batches (except after the last batch)
    if (!config.dryRun && batchEnd < allItems.length) {
      await sleep(DELAY_BETWEEN_BATCHES);
    }
  }

  stats.endTime = Date.now();
  const durationSeconds = ((stats.endTime - stats.startTime) / 1000).toFixed(2);

  // Clear progress line
  process.stdout.write('\r' + ' '.repeat(100) + '\r');
  console.log('');
  console.log('');

  // Step 4: Display summary
  console.log('========================================');
  console.log('  Sync Complete');
  console.log('========================================');
  console.log('');
  console.log(`Duration: ${durationSeconds}s`);
  console.log(`Processed: ${stats.totalItems} items`);
  console.log(`  - Sounds: ${stats.soundsCount}`);
  console.log(`  - Channels: ${stats.channelsCount}`);
  console.log(`  - Tracks: ${stats.tracksCount}`);
  console.log('');
  console.log(`Embeddings: ${stats.embeddingsGenerated} ${config.dryRun ? 'estimated' : 'generated'}`);
  console.log(`Total Cost: $${stats.totalCost.toFixed(4)}`);
  console.log(`Errors: ${stats.errors}`);
  console.log('');

  // Display errors if any
  if (errors.length > 0) {
    console.log('========================================');
    console.log('  Errors');
    console.log('========================================');
    console.log('');

    const maxErrorsToShow = 10;
    const errorsToShow = errors.slice(0, maxErrorsToShow);

    for (const { item, error } of errorsToShow) {
      console.log(`[${item.contentType}] ${item.title} (${item.contentfulId})`);
      console.log(`  Error: ${error}`);
      console.log('');
    }

    if (errors.length > maxErrorsToShow) {
      console.log(`... and ${errors.length - maxErrorsToShow} more errors`);
      console.log('');
    }
  }

  // Exit with error code if there were errors
  if (stats.errors > 0) {
    process.exit(1);
  }
}

// Run the sync
sync().catch(error => {
  console.error('');
  console.error('Fatal error:');
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
