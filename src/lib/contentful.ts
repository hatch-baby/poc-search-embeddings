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
const CONTENTFUL_CACHE_FILE = '.contentful-cache.json';

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
 * Taxonomy concepts cache
 * Maps concept ID (e.g., "acoustic") to label (e.g., "Acoustic")
 */
let taxonomyCache: Map<string, string> | null = null;

/**
 * Contentful data cache
 */
interface ContentfulCache {
  sounds: ContentItem[];
  channels: ContentItem[];
  tracks: ContentItem[];
  total: number;
  cachedAt: string;
  deviceId: string;
}

/**
 * Load Contentful cache from file
 */
async function loadContentfulCache(deviceId: string): Promise<ContentfulCache | null> {
  try {
    const file = Bun.file(CONTENTFUL_CACHE_FILE);
    if (await file.exists()) {
      const cache = await file.json() as ContentfulCache;
      // Verify cache is for the same device
      if (cache.deviceId === deviceId) {
        const cachedDate = new Date(cache.cachedAt);
        const timeAgo = Math.round((Date.now() - cachedDate.getTime()) / 1000 / 60); // minutes ago
        console.log(`   ✓ Using cached data (saved ${timeAgo} minutes ago)`);
        console.log(`   ✓ Found ${cache.total} items`);
        console.log('');
        return cache;
      } else {
        console.log(`   ⚠ Cache device mismatch - fetching fresh data`);
      }
    }
  } catch (error) {
    console.warn('   ⚠ Failed to load cache:', error);
  }
  return null;
}

/**
 * Save Contentful cache to file
 */
async function saveContentfulCache(
  sounds: ContentItem[],
  channels: ContentItem[],
  tracks: ContentItem[],
  deviceId: string
): Promise<void> {
  try {
    const cache: ContentfulCache = {
      sounds,
      channels,
      tracks,
      total: sounds.length + channels.length + tracks.length,
      cachedAt: new Date().toISOString(),
      deviceId
    };
    await Bun.write(CONTENTFUL_CACHE_FILE, JSON.stringify(cache, null, 2));
    console.log(`   ✓ Saved to cache for faster future runs`);
    console.log('');
  } catch (error) {
    console.warn('   ⚠ Failed to save cache:', error);
  }
}

/**
 * Fetch taxonomy concepts and build ID-to-label mapping
 * Results are cached after first fetch
 */
async function getTaxonomyConcepts(): Promise<Map<string, string>> {
  if (taxonomyCache) {
    return taxonomyCache;
  }

  const config = getConfig();
  const url = `${CONTENTFUL_API_URL}/spaces/${config.spaceId}/environments/${config.environment}/taxonomy/concepts`;

  try {
    const response = await fetch(url, {
      headers: {
        'Authorization': `Bearer ${config.accessToken}`,
        'Content-Type': 'application/json'
      }
    });

    if (!response.ok) {
      console.warn(`Failed to fetch taxonomy concepts: ${response.status}`);
      taxonomyCache = new Map();
      return taxonomyCache;
    }

    const data = await response.json();
    taxonomyCache = new Map();

    if (data.items && Array.isArray(data.items)) {
      data.items.forEach((concept: any) => {
        const id = concept.sys?.id;
        const label = concept.prefLabel?.['en-US'];
        if (id && label) {
          taxonomyCache!.set(id, label);
        }
      });
    }

    return taxonomyCache;
  } catch (error) {
    console.warn('Error fetching taxonomy concepts:', error);
    taxonomyCache = new Map();
    return taxonomyCache;
  }
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
  url.searchParams.set('include', '1'); // Resolve one level of linked fields (for filters)

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
 * @param includes - Included linked entries from Contentful response
 * @param taxonomyMap - Optional taxonomy concepts mapping (if already loaded)
 * @returns Processed ContentItem
 */
async function transformItem(
  item: ContentfulItem,
  includes?: ContentfulResponse['includes'],
  taxonomyMap?: Map<string, string>
): Promise<ContentItem> {
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

  // Load taxonomy concepts if not already provided
  if (!taxonomyMap) {
    taxonomyMap = await getTaxonomyConcepts();
  }

  // Extract taxonomy concepts from metadata.concepts
  const taxonomyConcepts: string[] = [];
  if (item.metadata?.concepts && Array.isArray(item.metadata.concepts)) {
    item.metadata.concepts.forEach(conceptRef => {
      const conceptId = conceptRef.sys?.id;
      if (conceptId) {
        const label = taxonomyMap!.get(conceptId);
        if (label) {
          taxonomyConcepts.push(label);
        }
      }
    });
  }

  // Extract filter titles from linked filters (resolved with include:1)
  // These are custom filter entries (e.g., "Nature Sounds", "Sound Baths")
  const filterNames: string[] = [];
  if (fields.filters && Array.isArray(fields.filters)) {
    fields.filters.forEach(filter => {
      // Check if filter is a link reference (sys.id)
      if (filter && typeof filter === 'object' && 'sys' in filter && (filter as any).sys?.id) {
        const filterId = (filter as any).sys.id;
        // Look up the filter in includes
        const includedFilter = includes?.Entry?.find(entry =>
          entry.sys.id === filterId && entry.sys.contentType.sys.id === 'filter'
        );
        if (includedFilter?.fields?.title) {
          filterNames.push(includedFilter.fields.title);
        }
      }
      // Also check if filter is a fully resolved object (backwards compatibility)
      else if (filter && typeof filter === 'object' && 'fields' in filter && (filter as any).fields?.title) {
        filterNames.push((filter as any).fields.title);
      }
    });
  }

  // Extract additional metadata fields
  const narrator = fields.narrator || undefined;
  const tagline = fields.tagline || undefined;
  const about = fields.about || undefined;

  // Build metadata object
  const metadata: Record<string, any> = {
    description: fields.description || '',
    category: fields.category || '',
    tags: fields.tags || [],
    filterNames: filterNames,
    taxonomyConcepts: taxonomyConcepts,
    audioType: fields.audioType || '',
    narrator: narrator || '',
    tagline: tagline || '',
    about: about || ''
  };

  // Add any additional fields to metadata
  Object.keys(fields).forEach(key => {
    if (!['title', 'description', 'category', 'tags', 'filters', 'audioType', 'narrator', 'tagline', 'about'].includes(key)) {
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
    taxonomyConcepts,
    audioType: fields.audioType,
    narrator,
    tagline,
    about,
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
  const taxonomyMap = await getTaxonomyConcepts();
  return Promise.all(response.items.map(item => transformItem(item, response.includes, taxonomyMap)));
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
  const taxonomyMap = await getTaxonomyConcepts();
  return Promise.all(response.items.map(item => transformItem(item, response.includes, taxonomyMap)));
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
  const taxonomyMap = await getTaxonomyConcepts();
  return Promise.all(response.items.map(item => transformItem(item, response.includes, taxonomyMap)));
}

/**
 * Fetch all content (sounds, channels, and standalone tracks) from Contentful
 *
 * Filters for Hatch Sleep Clock device by default.
 * Automatically excludes tracks that belong to channels.
 * Uses cached data if available unless forceRefresh is true.
 *
 * @param soundLimit - Maximum number of sounds to fetch (default: 1000)
 * @param channelLimit - Maximum number of channels to fetch (default: 1000)
 * @param trackLimit - Maximum number of tracks to fetch (default: 1000)
 * @param deviceId - Device entry ID to filter by (defaults to Hatch Sleep Clock)
 * @param includeChannelTracks - If true, includes tracks that belong to channels (default: false)
 * @param forceRefresh - If true, bypasses cache and fetches fresh data (default: false)
 * @returns Object containing arrays of sounds, channels, and standalone tracks
 *
 * @example
 * ```typescript
 * // Use cached data if available
 * const { sounds, channels, tracks, total } = await fetchAllContent();
 *
 * // Force refresh from Contentful
 * const freshData = await fetchAllContent(1000, 1000, 1000, undefined, false, true);
 * ```
 */
export async function fetchAllContent(
  soundLimit: number = 1000,
  channelLimit: number = 1000,
  trackLimit: number = 1000,
  deviceId: string = HATCH_SLEEP_CLOCK_ID,
  includeChannelTracks: boolean = false,
  forceRefresh: boolean = false
): Promise<{ sounds: ContentItem[]; channels: ContentItem[]; tracks: ContentItem[]; total: number }> {
  // Check cache first unless forceRefresh is true
  if (!forceRefresh) {
    const cached = await loadContentfulCache(deviceId);
    if (cached) {
      return {
        sounds: cached.sounds,
        channels: cached.channels,
        tracks: cached.tracks,
        total: cached.total
      };
    }
  }

  console.log('   Fetching fresh data from Contentful API...');
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

  console.log(`   ✓ Loaded content for: Hatch Sleep Clock`);
  console.log(`   ✓ Sounds: ${sounds.length}`);
  console.log(`   ✓ Channels: ${channelsResponse.length}`);
  console.log(`   ✓ Tracks: ${tracks.length} standalone${excludedCount > 0 ? ` (${excludedCount} in channels excluded)` : ''}`);

  // Save to cache for future use
  await saveContentfulCache(sounds, channelsResponse, tracks, deviceId);

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
 * // "Pacific Ocean Waves | Calming ocean sounds | Nature Sounds | acoustic, alarm, cozy | Music | ocean, waves | Narrator Name | Tagline | About text"
 * ```
 */
export function buildEmbeddingText(item: ContentItem): string {
  const parts = [
    item.title,
    item.description || '',
    item.category || '',
    ...(item.tags || []),
    ...(item.filterNames || []),
    ...(item.taxonomyConcepts || []),
    item.audioType || '',
    item.narrator || '',
    item.tagline || '',
    item.about || ''
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
  const url = new URL(`${CONTENTFUL_API_URL}/spaces/${config.spaceId}/environments/${config.environment}/entries/${entryId}`);
  url.searchParams.set('include', '1'); // Include linked entries

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
    const taxonomyMap = await getTaxonomyConcepts();
    // Single entry response doesn't have items array, but may have includes
    return transformItem(data as ContentfulItem, data.includes, taxonomyMap);
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
