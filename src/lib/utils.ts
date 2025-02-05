import { debounce } from 'lodash';

export function applyMask(imageData: Uint8Array, mask: Uint8Array): Uint8Array {
  const result = new Uint8Array(imageData.length);
  for (let i = 0; i < imageData.length; i += 4) {
    const maskIndex = i / 4;
    result[i] = imageData[i];
    result[i + 1] = imageData[i + 1];
    result[i + 2] = imageData[i + 2];
    result[i + 3] = mask[maskIndex];
  }
  return result;
}

// Cache for segmented images
const CACHE_SIZE = 100;
const segmentationCache = new Map<string, {
  masks: Uint8Array[];
  scores: number[];
}>();

export async function segmentImageWithCache(
  imageData: Uint8Array,
  id: string
): Promise<{masks: Uint8Array[]; scores: number[]}> {
  const cached = segmentationCache.get(id);
  if (cached) return cached;
  
  const result = await segmentImage(imageData);
  
  if (segmentationCache.size >= CACHE_SIZE) {
    const firstKey = segmentationCache.keys().next().value;
    segmentationCache.delete(firstKey);
  }
  
  segmentationCache.set(id, result);
  return result;
}

export const debouncedSearch = debounce(async (
  query: string,
  db: any,
  setResults: (results: any[]) => void,
  setIsSearching: (isSearching: boolean) => void
) => {
  if (query.length < 3) {
    setResults([]);
    return;
  }
  
  setIsSearching(true);
  try {
    const results = await semanticSearch(db, query);
    setResults(results);
  } catch (error) {
    console.error('Search failed:', error);
    setResults([]);
  } finally {
    setIsSearching(false);
  }
}, 300);