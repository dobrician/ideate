/**
 * Tag-based cache invalidation.
 * Associates cache keys with tags for bulk invalidation by category.
 */

import { cacheDelete } from "@/lib/cache";
import { logger } from "@/lib/logger";

/** In-memory mapping from tags to the set of cache keys associated with that tag. */
const tagIndex = new Map<string, Set<string>>();

/** Reverse mapping from cache key to its tags (for cleanup). */
const keyTags = new Map<string, Set<string>>();

const MAX_TAG_ENTRIES = 5000;

/**
 * Associate a cache key with one or more tags.
 * When any of the tags are invalidated, this key will be deleted.
 */
export function tagCacheKey(key: string, tags: string[]): void {
  if (tags.length === 0) return;

  // Enforce size limit
  if (keyTags.size >= MAX_TAG_ENTRIES) {
    const firstKey = keyTags.keys().next().value;
    if (firstKey !== undefined) untagKey(firstKey);
  }

  const tagSet = keyTags.get(key) ?? new Set();
  for (const tag of tags) {
    tagSet.add(tag);
    const keySet = tagIndex.get(tag) ?? new Set();
    keySet.add(key);
    tagIndex.set(tag, keySet);
  }
  keyTags.set(key, tagSet);
}

/**
 * Invalidate all cache keys associated with the given tag.
 * Returns the number of keys invalidated.
 */
export function invalidateTag(tag: string): number {
  const keys = tagIndex.get(tag);
  if (!keys || keys.size === 0) {
    return 0;
  }

  let count = 0;
  for (const key of keys) {
    cacheDelete(key);
    // Remove this tag from the key's tag set
    const tags = keyTags.get(key);
    if (tags) {
      tags.delete(tag);
      if (tags.size === 0) keyTags.delete(key);
    }
    count++;
  }
  tagIndex.delete(tag);
  logger.info({ tag, count }, "Tag-based cache invalidation");
  return count;
}

/**
 * Invalidate all cache keys matching multiple tags.
 * Returns total number of keys invalidated.
 */
export function invalidateTags(tags: string[]): number {
  let total = 0;
  for (const tag of tags) {
    total += invalidateTag(tag);
  }
  return total;
}

/** Remove a key from all tag indexes. */
function untagKey(key: string): void {
  const tags = keyTags.get(key);
  if (tags) {
    for (const tag of tags) {
      const keySet = tagIndex.get(tag);
      if (keySet) {
        keySet.delete(key);
        if (keySet.size === 0) tagIndex.delete(tag);
      }
    }
    keyTags.delete(key);
  }
}

/** Remove a specific key from the tag index (call when key is deleted from cache). */
export function removeKeyFromTags(key: string): void {
  untagKey(key);
}

/** Get all tags for diagnostic/monitoring purposes. */
export function getTagStats(): { totalTags: number; totalTrackedKeys: number } {
  return {
    totalTags: tagIndex.size,
    totalTrackedKeys: keyTags.size,
  };
}

/** Clear all tag associations. */
export function clearTags(): void {
  tagIndex.clear();
  keyTags.clear();
}
