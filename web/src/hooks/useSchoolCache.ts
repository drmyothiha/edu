import { useEffect, useState, useCallback, useRef } from 'react';
import { SchoolDTO } from '../types';
import {
  getCachedSchools,
  getSchoolCacheMeta,
  silentlyRefreshSchoolsCache,
  SchoolCacheMeta,
} from '../services/schoolCacheStorage';

export interface UseSchoolCacheResult {
  schools: SchoolDTO[];
  loading: boolean;
  isRevalidating: boolean;
  error: string | null;
  meta: SchoolCacheMeta | null;
  refresh: () => Promise<void>;
  filterSchools: (query: string) => SchoolDTO[];
}

export function useSchoolCache(options?: { autoFetch?: boolean }): UseSchoolCacheResult {
  const autoFetch = options?.autoFetch ?? true;
  const [schools, setSchools] = useState<SchoolDTO[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [isRevalidating, setIsRevalidating] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [meta, setMeta] = useState<SchoolCacheMeta | null>(null);

  const isMounted = useRef<boolean>(true);

  // Background fetch helper
  const performBackgroundRefresh = useCallback(async () => {
    setIsRevalidating(true);
    try {
      const fresh = await silentlyRefreshSchoolsCache();
      if (isMounted.current && fresh.length > 0) {
        setSchools(fresh);
        const updatedMeta = await getSchoolCacheMeta();
        setMeta(updatedMeta);
        setError(null);
      }
    } catch (err: any) {
      if (isMounted.current) {
        // If we already have cached data, don't break the UI with error
        console.warn('[useSchoolCache] Background revalidation failed:', err);
      }
    } finally {
      if (isMounted.current) {
        setIsRevalidating(false);
        setLoading(false);
      }
    }
  }, []);

  useEffect(() => {
    isMounted.current = true;

    if (!autoFetch) {
      setLoading(false);
      return;
    }

    // 1. Immediately read from IndexedDB
    let hasCache = false;
    getCachedSchools().then(async (cached) => {
      if (!isMounted.current) return;

      if (cached && cached.length > 0) {
        hasCache = true;
        setSchools(cached);
        setLoading(false); // Instant UI render from cache!
        const initialMeta = await getSchoolCacheMeta();
        if (isMounted.current) setMeta(initialMeta);
      }

      // 2. Perform background call to API to silently update
      performBackgroundRefresh().catch(() => {
        if (!hasCache && isMounted.current) {
          setError('Failed to fetch school directory');
          setLoading(false);
        }
      });
    });

    // 3. Listen for cache updates dispatched by other components or tabs
    const handleCacheUpdate = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      if (detail && detail.count) {
        getCachedSchools().then((updated) => {
          if (isMounted.current && updated.length > 0) {
            setSchools(updated);
            setMeta({
              key: 'schools_all_meta',
              last_cached_at: detail.last_cached_at,
              count: detail.count,
            });
          }
        });
      }
    };

    window.addEventListener('edu_schools_cache_updated', handleCacheUpdate);

    return () => {
      isMounted.current = false;
      window.removeEventListener('edu_schools_cache_updated', handleCacheUpdate);
    };
  }, [autoFetch, performBackgroundRefresh]);

  // Fast in-memory search over cached schools
  const filterSchools = useCallback(
    (query: string) => {
      if (!query || !query.trim()) return schools;
      const q = query.trim().toLowerCase();
      return schools.filter((s) => {
        const nameMatch = s.name?.toLowerCase().includes(q) || (s.name_my && s.name_my.includes(q));
        const codeMatch = s.code?.toLowerCase().includes(q);
        const cityMatch = s.city?.toLowerCase().includes(q);
        const regionMatch = s.region?.toLowerCase().includes(q);
        const tspMatch = s.township_name?.toLowerCase().includes(q);
        const catMatch = s.school_category?.toLowerCase().includes(q);
        return nameMatch || codeMatch || cityMatch || regionMatch || tspMatch || catMatch;
      });
    },
    [schools]
  );

  return {
    schools,
    loading,
    isRevalidating,
    error,
    meta,
    refresh: performBackgroundRefresh,
    filterSchools,
  };
}
