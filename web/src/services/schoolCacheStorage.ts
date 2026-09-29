import { SchoolDTO } from '../types';
import { api } from '../api/client';

/**
 * IndexedDB School Cache Storage Service
 * Implements Stale-While-Revalidate (SWR) caching for nationwide school lists (>1k schools).
 * 
 * Flow:
 * 1. On reopen / mount: Immediately read and return cached schools from IndexedDB (0ms latency, zero jank).
 * 2. In background: Asynchronously fetch fresh data from /api/v1/schools?all=true.
 * 3. Silently update: Overwrite IndexedDB cache and notify subscribers with fresh data without blocking UI.
 */

const DB_NAME = 'EduSchoolDirectoryDB';
const DB_VERSION = 1;
const STORE_SCHOOLS = 'schools';
const STORE_META = 'cache_meta';
const META_KEY = 'schools_all_meta';

export interface SchoolCacheMeta {
  key: string;
  last_cached_at: string;
  count: number;
}

let dbPromise: Promise<IDBDatabase> | null = null;

function getDB(): Promise<IDBDatabase> {
  if (dbPromise) return dbPromise;

  dbPromise = new Promise((resolve, reject) => {
    if (typeof window === 'undefined' || !window.indexedDB) {
      reject(new Error('IndexedDB is not supported in this environment'));
      return;
    }

    const request = window.indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;

      // 1. Schools Store (Indexed by id, name, code, region, township)
      if (!db.objectStoreNames.contains(STORE_SCHOOLS)) {
        const schoolStore = db.createObjectStore(STORE_SCHOOLS, { keyPath: 'id' });
        schoolStore.createIndex('name', 'name', { unique: false });
        schoolStore.createIndex('code', 'code', { unique: false });
        schoolStore.createIndex('city', 'city', { unique: false });
        schoolStore.createIndex('region', 'region', { unique: false });
        schoolStore.createIndex('pcode_sr', 'pcode_sr', { unique: false });
        schoolStore.createIndex('pcode_ts', 'pcode_ts', { unique: false });
        schoolStore.createIndex('school_category', 'school_category', { unique: false });
      }

      // 2. Metadata Store (Timestamps, counts)
      if (!db.objectStoreNames.contains(STORE_META)) {
        db.createObjectStore(STORE_META, { keyPath: 'key' });
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => {
      dbPromise = null;
      reject(request.error);
    };
  });

  return dbPromise;
}

/**
 * Retrieve cached schools list immediately from IndexedDB.
 */
export async function getCachedSchools(): Promise<SchoolDTO[]> {
  try {
    const db = await getDB();
    return new Promise((resolve) => {
      const tx = db.transaction(STORE_SCHOOLS, 'readonly');
      const store = tx.objectStore(STORE_SCHOOLS);
      const req = store.getAll();

      req.onsuccess = () => {
        resolve(req.result || []);
      };

      req.onerror = () => {
        console.warn('[SchoolCache] Failed to read cached schools:', req.error);
        resolve([]);
      };
    });
  } catch (err) {
    console.warn('[SchoolCache] IndexedDB unavailable:', err);
    return [];
  }
}

/**
 * Retrieve cache metadata (last updated timestamp and school count).
 */
export async function getSchoolCacheMeta(): Promise<SchoolCacheMeta | null> {
  try {
    const db = await getDB();
    return new Promise((resolve) => {
      const tx = db.transaction(STORE_META, 'readonly');
      const store = tx.objectStore(STORE_META);
      const req = store.get(META_KEY);

      req.onsuccess = () => resolve(req.result || null);
      req.onerror = () => resolve(null);
    });
  } catch {
    return null;
  }
}

/**
 * Persist fresh schools list into IndexedDB.
 */
export async function saveSchoolsToCache(schools: SchoolDTO[]): Promise<void> {
  if (!schools || schools.length === 0) return;

  try {
    const db = await getDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction([STORE_SCHOOLS, STORE_META], 'readwrite');
      const schoolStore = tx.objectStore(STORE_SCHOOLS);
      const metaStore = tx.objectStore(STORE_META);

      // Clear existing records to remove deleted or renamed entries
      schoolStore.clear();

      for (const s of schools) {
        schoolStore.put(s);
      }

      const meta: SchoolCacheMeta = {
        key: META_KEY,
        last_cached_at: new Date().toISOString(),
        count: schools.length,
      };
      metaStore.put(meta);

      tx.oncomplete = () => {
        // Dispatch custom browser event for reactive components across tabs/pages
        if (typeof window !== 'undefined') {
          window.dispatchEvent(
            new CustomEvent('edu_schools_cache_updated', {
              detail: { count: schools.length, last_cached_at: meta.last_cached_at },
            })
          );
        }
        resolve();
      };

      tx.onerror = () => reject(tx.error);
    });
  } catch (err) {
    console.warn('[SchoolCache] Failed to save schools to IndexedDB:', err);
  }
}

/**
 * Background silent update: fetches fresh schools from server and updates cache.
 * Returns the fresh schools list.
 */
export async function silentlyRefreshSchoolsCache(): Promise<SchoolDTO[]> {
  try {
    const freshSchools = await api.schools.listAll();
    if (Array.isArray(freshSchools) && freshSchools.length > 0) {
      await saveSchoolsToCache(freshSchools);
      return freshSchools;
    }
    return [];
  } catch (err) {
    console.warn('[SchoolCache] Background refresh skipped (offline or server error):', err);
    throw err;
  }
}

export interface SWRCallbackOptions {
  onCacheHit?: (cached: SchoolDTO[], meta: SchoolCacheMeta | null) => void;
  onFreshData?: (fresh: SchoolDTO[]) => void;
  onError?: (err: any) => void;
}

/**
 * Stale-While-Revalidate loader:
 * 1. Executes onCacheHit immediately if cache exists in IndexedDB.
 * 2. Simultaneously initiates background network request to API.
 * 3. On success, updates IndexedDB and executes onFreshData silently.
 */
export async function loadSchoolsWithSWR(options: SWRCallbackOptions): Promise<{
  cached: SchoolDTO[];
  fetchPromise: Promise<SchoolDTO[]>;
}> {
  // Step 1: Immediate cache read
  const cached = await getCachedSchools();
  const meta = await getSchoolCacheMeta();

  if (cached.length > 0 && options.onCacheHit) {
    options.onCacheHit(cached, meta);
  }

  // Step 2: Asynchronous background fetch
  const fetchPromise = silentlyRefreshSchoolsCache()
    .then((fresh) => {
      if (options.onFreshData && fresh.length > 0) {
        options.onFreshData(fresh);
      }
      return fresh;
    })
    .catch((err) => {
      if (options.onError) {
        options.onError(err);
      }
      return cached; // Fallback to cached on network failure
    });

  return { cached, fetchPromise };
}
