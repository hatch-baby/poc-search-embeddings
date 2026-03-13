/**
 * Contentful CMS API client
 *
 * Fetches sounds and channels from Contentful with full metadata.
 * Uses include:2 to resolve linked fields (filters, categories, etc.)
 *
 * Space ID: hlsdh3zwyrtx
 */

import type {
  ContentfulResponse,
  ContentfulItem,
  ContentItem,
  ContentType
} from '../types/index.js';

const CONTENTFUL_API_URL = 'https://cdn.contentful.com';

/**
 * Contentful client configuration
 */
interface ContentfulConfig {
  spaceId: string;
  accessToken: string;
  environment: string;
}

/**
 * Get Contentful configuration from environment variables
 */
function getConfig(): ContentfulConfig {
  const spaceId = process.env.CONTENTFUL_SPACE_ID;
  const accessToken = process.env.CONTENTFUL_ACCESS_TOKEN;
  const environment = process.env.CONTENTFUL_ENVIRONMENT || 'master';

  if (!spaceId) {
    throw new Error(
      'CONTENTFUL_SPACE_ID environment variable is not set. ' +
      'Please add it to your .env file.'
    );
  }

  if (!accessToken) {
    throw new Error(
      'CONTENTFUL_ACCESS_TOKEN environment variable is not set. ' +
      'Please add it to your .env file.'
    );
  }

  return { spaceId, accessToken, environment };
}

/**
 * Fetch entries from Contentful
 *
 * @param contentType - Type of content to fetch ('sound', 'channel', or 'track')
 * @param limit - Maximum number of entries to fetch (default: 1000, max: 1000)
 * @param skip - Number of entries to skip for pagination (default: 0)
 * @param deviceId - Device entry ID to filter by (e.g., '2wqv63kTT78cCVfAsyCtat' for Hatch Sleep Clock)
 * @returns Raw Contentful response
 */
async function fetchEntries(
  contentType: string,
  limit: number = 1000,
  skip: number = 0,
  deviceId?: string
): Promise<ContentfulResponse> {
  const config = getConfig();
  const url = new URL(
    `${CONTENTFUL_API_URL}/spaces/${config.spaceId}/environments/${config.environment}/entries`
  );

  // Set query parameters
  url.searchParams.set('content_type', contentType);
  url.searchParams.set('limit', Math.min(limit, 1000).toString());
  url.searchParams.set('skip', skip.toString());
  url.searchParams.set('include', '0'); // Don't resolve linked fields (avoid "too many links" error)

  // Device filter: only fetch content for specific device
  // Uses sys.id matching for linked entries
  if (deviceId) {
    url.searchParams.set('fields.devices.sys.id[in]', deviceId);
  }

  try {
    const response = await fetch(url.toString(), {
      headers: {
        'Authorization': `Bearer ${config.accessToken}`,
        'Content-Type': 'application/json'
      }
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(
        `Contentful API error (${response.status}): ${errorText}`
      );
    }

    const data = await response.json();
    return data as ContentfulResponse;
  } catch (error) {
    if (error instanceof Error) {
      throw error;
    }
    throw new Error(`Failed to fetch Contentful entries: ${String(error)}`);
  }
}

/**
 * Transform raw Contentful item to ContentItem
 *
 * @param item - Raw Contentful item
 * @returns Processed ContentItem
 */
function transformItem(item: ContentfulItem): ContentItem {
  const contentfulId = item.sys.id;
  const contentTypeId = item.sys.contentType.sys.id;

  // Map Contentful content type to our ContentType enum
  let contentType: ContentType;
  if (contentTypeId === 'sound' || contentTypeId === 'soundItem') {
    contentType = 'sound';
  } else if (contentTypeId === 'channel' || contentTypeId === 'channelItem') {
    contentType = 'channel';
  } else if (contentTypeId === 'track' || contentTypeId === 'trackItem') {
    contentType = 'track';
  } else {
    // Default to 'sound' if unknown
    contentType = 'sound';
    console.warn(
      `Unknown content type "${contentTypeId}" for item ${contentfulId}, defaulting to "sound"`
    );
  }

  const fields = item.fields;

  // Extract filter names from linked filters (if resolved)
  // Note: With include:0, filters will be references, not full objects
  const filterNames: string[] = [];
  if (fields.filters && Array.isArray(fields.filters)) {
    fields.filters.forEach(filter => {
      // Check if filter is a resolved object with fields
      if (filter && typeof filter === 'object' && 'fields' in filter && filter.fields?.name) {
        filterNames.push(filter.fields.name);
      }
    });
  }

  // Build metadata object
  const metadata: Record<string, any> = {
    description: fields.description || '',
    category: fields.category || '',
    tags: fields.tags || [],
    filterNames: filterNames,
    audioType: fields.audioType || ''
  };

  // Add any additional fields to metadata
  Object.keys(fields).forEach(key => {
    if (!['title', 'description', 'category', 'tags', 'filters', 'audioType'].includes(key)) {
      metadata[key] = fields[key];
    }
  });

  return {
    contentfulId,
    contentType,
    title: fields.title || 'Untitled',
    description: fields.description,
    category: fields.category,
    tags: fields.tags,
    filterNames,
    audioType: fields.audioType,
    metadata
  };
}

// Hatch Sleep Clock device ID from Contentful
const HATCH_SLEEP_CLOCK_ID = '2wqv63kTT78cCVfAsyCtat';

/**
 * Fetch all sounds from Contentful
 *
 * @param limit - Maximum number of sounds to fetch (default: 1000)
 * @param deviceId - Device entry ID to filter by (defaults to Hatch Sleep Clock)
 * @returns Array of processed ContentItems
 *
 * @example
 * ```typescript
 * const sounds = await fetchSounds(100);
 * console.log(`Fetched ${sounds.length} sounds for Hatch Sleep Clock`);
 * ```
 */
export async function fetchSounds(limit: number = 1000, deviceId: string = HATCH_SLEEP_CLOCK_ID): Promise<ContentItem[]> {
  const response = await fetchEntries('sound', limit, 0, deviceId);
  return response.items.map(transformItem);
}

/**
 * Fetch all channels from Contentful
 *
 * @param limit - Maximum number of channels to fetch (default: 1000)
 * @param deviceId - Device entry ID to filter by (defaults to Hatch Sleep Clock)
 * @returns Array of processed ContentItems
 *
 * @example
 * ```typescript
 * const channels = await fetchChannels(50);
 * console.log(`Fetched ${channels.length} channels for Hatch Sleep Clock`);
 * ```
 */
export async function fetchChannels(limit: number = 1000, deviceId: string = HATCH_SLEEP_CLOCK_ID): Promise<ContentItem[]> {
  const response = await fetchEntries('channel', limit, 0, deviceId);
  return response.items.map(transformItem);
}

/**
 * Fetch all tracks from Contentful
 *
 * Note: Tracks don't have a back-reference to channels, so we fetch all tracks for the device.
 * Some tracks may belong to channels, others may be standalone.
 *
 * @param limit - Maximum number of tracks to fetch (default: 1000)
 * @param deviceId - Device entry ID to filter by (defaults to Hatch Sleep Clock)
 * @returns Array of processed ContentItems
 *
 * @example
 * ```typescript
 * const tracks = await fetchTracks(100);
 * console.log(`Fetched ${tracks.length} tracks for Hatch Sleep Clock`);
 * ```
 */
export async function fetchTracks(limit: number = 1000, deviceId: string = HATCH_SLEEP_CLOCK_ID): Promise<ContentItem[]> {
  const response = await fetchEntries('track', limit, 0, deviceId);
  return response.items.map(transformItem);
}

/**
 * Fetch all content (sounds, channels, and standalone tracks) from Contentful
 *
 * Filters for Hatch Sleep Clock device by default.
 * Automatically excludes tracks that belong to channels.
 *
 * @param soundLimit - Maximum number of sounds to fetch (default: 1000)
 * @param channelLimit - Maximum number of channels to fetch (default: 1000)
 * @param trackLimit - Maximum number of tracks to fetch (default: 1000)
 * @param deviceId - Device entry ID to filter by (defaults to Hatch Sleep Clock)
 * @param includeChannelTracks - If true, includes tracks that belong to channels (default: false)
 * @returns Object containing arrays of sounds, channels, and standalone tracks
 *
 * @example
 * ```typescript
 * const { sounds, channels, tracks, total } = await fetchAllContent();
 * console.log(`Fetched ${total} items for Hatch Sleep Clock`);
 * console.log(`  - Sounds: ${sounds.length}`);
 * console.log(`  - Channels: ${channels.length}`);
 * console.log(`  - Standalone tracks: ${tracks.length}`);
 * ```
 */
export async function fetchAllContent(
  soundLimit: number = 1000,
  channelLimit: number = 1000,
  trackLimit: number = 1000,
  deviceId: string = HATCH_SLEEP_CLOCK_ID,
  includeChannelTracks: boolean = false
): Promise<{ sounds: ContentItem[]; channels: ContentItem[]; tracks: ContentItem[]; total: number }> {
  // Fetch all three types in parallel for efficiency
  const [sounds, channelsResponse, allTracks] = await Promise.all([
    fetchSounds(soundLimit, deviceId),
    fetchChannels(channelLimit, deviceId),
    fetchTracks(trackLimit, deviceId)
  ]);

  let tracks = allTracks;
  let excludedCount = 0;

  // Filter out tracks that belong to channels (unless includeChannelTracks is true)
  if (!includeChannelTracks) {
    // First, we need to fetch the raw channel data to get track IDs
    // Re-fetch channels with include level to get track references
    const channelResponse = await fetchEntries('channel', channelLimit, 0, deviceId);

    // Build a Set of track IDs that are referenced by channels
    const channelTrackIds = new Set<string>();
    channelResponse.items.forEach(channel => {
      const channelTracks = channel.fields.tracks;
      if (Array.isArray(channelTracks)) {
        channelTracks.forEach(trackRef => {
          // Track references are objects with sys.id
          if (trackRef && typeof trackRef === 'object' && 'sys' in trackRef) {
            channelTrackIds.add((trackRef as any).sys.id);
          }
        });
      }
    });

    // Filter out tracks that are in channels
    const beforeCount = tracks.length;
    tracks = tracks.filter(track => !channelTrackIds.has(track.contentfulId));
    excludedCount = beforeCount - tracks.length;
  }

  console.log(`Device filter: Hatch Sleep Clock (${deviceId})`);
  console.log(`  - Sounds: ${sounds.length}`);
  console.log(`  - Channels: ${channelsResponse.length}`);
  console.log(`  - Tracks: ${tracks.length} standalone${excludedCount > 0 ? ` (${excludedCount} channel tracks excluded)` : ''}`);

  return {
    sounds,
    channels: channelsResponse,
    tracks,
    total: sounds.length + channelsResponse.length + tracks.length
  };
}

/**
 * Build embedding text from content item
 * Concatenates all relevant fields for semantic search
 *
 * @param item - Content item to build embedding text for
 * @returns Text string ready for embedding generation
 *
 * @example
 * ```typescript
 * const item = await fetchSounds(1).then(items => items[0]);
 * const embeddingText = buildEmbeddingText(item);
 * console.log(embeddingText);
 * // "Pacific Ocean Waves | Calming ocean sounds for relaxation | Nature Sounds | ocean, waves, relaxation | White Noise"
 * ```
 */
export function buildEmbeddingText(item: ContentItem): string {
  const parts = [
    item.title,
    item.description || '',
    item.category || '',
    ...(item.tags || []),
    ...(item.filterNames || []),
    item.audioType || ''
  ].filter(Boolean); // Remove empty/null/undefined values

  return parts.join(' | ');
}

/**
 * Fetch a single content item by ID
 *
 * @param entryId - Contentful entry ID
 * @returns Processed ContentItem
 *
 * @example
 * ```typescript
 * const item = await fetchEntry('abc123xyz');
 * console.log(item.title);
 * ```
 */
export async function fetchEntry(entryId: string): Promise<ContentItem> {
  const config = getConfig();
  const url = `${CONTENTFUL_API_URL}/spaces/${config.spaceId}/environments/${config.environment}/entries/${entryId}`;

  try {
    const response = await fetch(url, {
      headers: {
        'Authorization': `Bearer ${config.accessToken}`,
        'Content-Type': 'application/json'
      }
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(
        `Contentful API error (${response.status}): ${errorText}`
      );
    }

    const data = await response.json() as ContentfulItem;
    return transformItem(data);
  } catch (error) {
    if (error instanceof Error) {
      throw error;
    }
    throw new Error(`Failed to fetch Contentful entry: ${String(error)}`);
  }
}

/**
 * Get Contentful space information
 */
export function getSpaceInfo() {
  const config = getConfig();
  return {
    spaceId: config.spaceId,
    environment: config.environment
  };
}
