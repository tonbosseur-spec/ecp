export const CACHE_PREFIX = 'exceller_offline_';

export function saveToCache(key: string, data: any) {
  try {
    localStorage.setItem(CACHE_PREFIX + key, JSON.stringify(data));
  } catch (e) {
    console.error('Error saving to cache:', e);
  }
}

export function loadFromCache(key: string): any | null {
  try {
    const cached = localStorage.getItem(CACHE_PREFIX + key);
    if (cached) {
      return JSON.parse(cached);
    }
  } catch (e) {
    console.error('Error loading from cache:', e);
  }
  return null;
}
