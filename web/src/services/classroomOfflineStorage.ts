import { ClassDTO, StudentDTO, SchoolDTO, ClassTimetableDTO, ShiftConfigDTO, ExamRosterResponse, AttendanceRosterResponse } from '../types';
import { api } from '../api/client';

/**
 * IndexedDB Classroom Offline Storage Service
 * 
 * Provides Offline-First / Stale-While-Revalidate (SWR) caching for:
 * - Classroom specifications, grade level, and school info
 * - Seating plan layout configuration & seat assignments
 * - Enrolled student roster
 * - Weekly curriculum timetable
 * - Exam marks & Whole-Child profiles
 * - Attendance rosters
 * 
 * UX Flow:
 * 1. Immediate 0ms render: Read from IndexedDB first, allowing instant page load without waiting for network.
 * 2. Delayed background check: After rendering the cached UI (with a configurable delay, e.g. 1000ms),
 *    asynchronously verify and fetch fresh data from the Go API backend.
 * 3. Silent update: If server has changes, update IndexedDB and notify active components.
 * 4. Offline resilience: Works completely offline when network fails or on slow 2G/3G connections.
 */

const DB_NAME = 'EduClassroomOfflineDB';
const DB_VERSION = 1;

// Object store names
const STORE_CLASSROOMS = 'classrooms';
const STORE_ROSTERS = 'rosters';
const STORE_TIMETABLES = 'timetables';
const STORE_EXAM_MARKS = 'exam_marks';
const STORE_ATTENDANCE = 'attendance';
const STORE_META = 'cache_meta';

export interface ClassroomCacheRecord {
  id: string; // Class UUID
  slug: string; // e.g. 'KGA'
  classInfo: ClassDTO;
  schoolInfo?: SchoolDTO | null;
  allClasses?: ClassDTO[];
  layout?: any;
  seatAssignments?: (string | null)[];
  updatedAt: string;
}

export interface TimetableCacheRecord {
  classId: string;
  timetable: ClassTimetableDTO | null;
  shiftConfigs: ShiftConfigDTO[];
  updatedAt: string;
}

export interface CachedExamMarksResult {
  roster: ExamRosterResponse;
  wcProfiles?: any[];
}

export interface ExamMarksCacheRecord {
  compositeKey: string; // `${classId}_${examName}`
  classId: string;
  examName: string;
  data: ExamRosterResponse;
  wcProfiles?: any[];
  updatedAt: string;
}

export interface AttendanceCacheRecord {
  compositeKey: string; // `${classId}_${date}`
  classId: string;
  date: string;
  data: AttendanceRosterResponse;
  updatedAt: string;
}

export interface CacheMetaRecord {
  key: string;
  lastSyncedAt: string;
  isOffline: boolean;
}

export type SyncStatus = 'offline_ready' | 'syncing' | 'synced' | 'offline_mode';

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

      // 1. Classrooms store
      if (!db.objectStoreNames.contains(STORE_CLASSROOMS)) {
        const classStore = db.createObjectStore(STORE_CLASSROOMS, { keyPath: 'id' });
        classStore.createIndex('slug', 'slug', { unique: false });
      }

      // 2. Student Rosters store
      if (!db.objectStoreNames.contains(STORE_ROSTERS)) {
        db.createObjectStore(STORE_ROSTERS, { keyPath: 'classId' });
      }

      // 3. Timetables store
      if (!db.objectStoreNames.contains(STORE_TIMETABLES)) {
        db.createObjectStore(STORE_TIMETABLES, { keyPath: 'classId' });
      }

      // 4. Exam Marks store
      if (!db.objectStoreNames.contains(STORE_EXAM_MARKS)) {
        db.createObjectStore(STORE_EXAM_MARKS, { keyPath: 'compositeKey' });
      }

      // 5. Attendance store
      if (!db.objectStoreNames.contains(STORE_ATTENDANCE)) {
        db.createObjectStore(STORE_ATTENDANCE, { keyPath: 'compositeKey' });
      }

      // 6. Metadata store
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

// -------------------------------------------------------------
// 1. Classroom & Seating Plan Cache
// -------------------------------------------------------------

/**
 * Retrieve cached classroom details, layout, and sibling classes from IndexedDB.
 * Supports querying by class UUID or slug (e.g. 'KGA').
 */
export async function getCachedClassroom(idOrSlug: string): Promise<ClassroomCacheRecord | null> {
  try {
    const db = await getDB();
    const cleanSlug = idOrSlug.toUpperCase().replace(/[^A-Z0-9]/g, '');

    return new Promise((resolve) => {
      const tx = db.transaction(STORE_CLASSROOMS, 'readonly');
      const store = tx.objectStore(STORE_CLASSROOMS);

      // First try direct key match (UUID)
      const directReq = store.get(idOrSlug);

      directReq.onsuccess = () => {
        if (directReq.result) {
          resolve(directReq.result);
          return;
        }

        // Otherwise scan by slug or code
        const allReq = store.getAll();
        allReq.onsuccess = () => {
          const list: ClassroomCacheRecord[] = allReq.result || [];
          const match = list.find((item) => {
            const itemSlug = (item.slug || item.classInfo?.code || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
            return itemSlug === cleanSlug || item.id === idOrSlug;
          });
          resolve(match || null);
        };
        allReq.onerror = () => resolve(null);
      };

      directReq.onerror = () => resolve(null);
    });
  } catch (err) {
    console.warn('[ClassroomOfflineStorage] IndexedDB read error:', err);
    return null;
  }
}

/**
 * Persist classroom record into IndexedDB.
 */
export async function saveClassroomToCache(record: Partial<ClassroomCacheRecord> & { id: string }): Promise<void> {
  try {
    const db = await getDB();
    const existing = await getCachedClassroom(record.id);

    const fullRecord: ClassroomCacheRecord = {
      id: record.id,
      slug: record.slug || existing?.slug || record.classInfo?.code || 'KGA',
      classInfo: record.classInfo || existing?.classInfo!,
      schoolInfo: record.schoolInfo !== undefined ? record.schoolInfo : existing?.schoolInfo,
      allClasses: record.allClasses || existing?.allClasses || [],
      layout: record.layout || existing?.layout,
      seatAssignments: record.seatAssignments || existing?.seatAssignments,
      updatedAt: new Date().toISOString(),
    };

    return new Promise((resolve, reject) => {
      const tx = db.transaction([STORE_CLASSROOMS, STORE_META], 'readwrite');
      const classStore = tx.objectStore(STORE_CLASSROOMS);
      const metaStore = tx.objectStore(STORE_META);

      classStore.put(fullRecord);

      metaStore.put({
        key: `class_${record.id}`,
        lastSyncedAt: fullRecord.updatedAt,
        isOffline: false,
      });

      tx.oncomplete = () => {
        if (typeof window !== 'undefined') {
          window.dispatchEvent(
            new CustomEvent('edu_classroom_cache_updated', {
              detail: { classId: fullRecord.id, slug: fullRecord.slug },
            })
          );
        }
        resolve();
      };
      tx.onerror = () => reject(tx.error);
    });
  } catch (err) {
    console.warn('[ClassroomOfflineStorage] Failed to save classroom cache:', err);
  }
}

// -------------------------------------------------------------
// 2. Student Roster Cache
// -------------------------------------------------------------

export async function getCachedRoster(classId: string): Promise<StudentDTO[] | null> {
  try {
    const db = await getDB();
    return new Promise((resolve) => {
      const tx = db.transaction(STORE_ROSTERS, 'readonly');
      const store = tx.objectStore(STORE_ROSTERS);
      const req = store.get(classId);
      req.onsuccess = () => resolve(req.result ? req.result.students : null);
      req.onerror = () => resolve(null);
    });
  } catch {
    return null;
  }
}

export async function saveRosterToCache(classId: string, students: StudentDTO[]): Promise<void> {
  try {
    const db = await getDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_ROSTERS, 'readwrite');
      const store = tx.objectStore(STORE_ROSTERS);
      store.put({
        classId,
        students,
        count: students.length,
        updatedAt: new Date().toISOString(),
      });
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } catch (err) {
    console.warn('[ClassroomOfflineStorage] Failed to save roster cache:', err);
  }
}

// -------------------------------------------------------------
// 3. Timetable Cache
// -------------------------------------------------------------

export async function getCachedTimetable(classId: string): Promise<TimetableCacheRecord | null> {
  try {
    const db = await getDB();
    return new Promise((resolve) => {
      const tx = db.transaction(STORE_TIMETABLES, 'readonly');
      const store = tx.objectStore(STORE_TIMETABLES);
      const req = store.get(classId);
      req.onsuccess = () => resolve(req.result || null);
      req.onerror = () => resolve(null);
    });
  } catch {
    return null;
  }
}

export async function saveTimetableToCache(
  classId: string,
  timetable: ClassTimetableDTO | null,
  shiftConfigs: ShiftConfigDTO[] = []
): Promise<void> {
  try {
    const db = await getDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_TIMETABLES, 'readwrite');
      const store = tx.objectStore(STORE_TIMETABLES);
      store.put({
        classId,
        timetable,
        shiftConfigs,
        updatedAt: new Date().toISOString(),
      });
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } catch (err) {
    console.warn('[ClassroomOfflineStorage] Failed to save timetable cache:', err);
  }
}

// -------------------------------------------------------------
// 4. Exam Marks Cache
// -------------------------------------------------------------

export async function getCachedExamMarks(classId: string, examName: string): Promise<CachedExamMarksResult | null> {
  try {
    const db = await getDB();
    const compositeKey = `${classId}_${examName}`;
    return new Promise((resolve) => {
      const tx = db.transaction(STORE_EXAM_MARKS, 'readonly');
      const store = tx.objectStore(STORE_EXAM_MARKS);
      const req = store.get(compositeKey);
      req.onsuccess = () => {
        if (!req.result) return resolve(null);
        resolve({
          roster: req.result.data,
          wcProfiles: req.result.wcProfiles || [],
        });
      };
      req.onerror = () => resolve(null);
    });
  } catch {
    return null;
  }
}

export async function saveExamMarksToCache(
  classId: string,
  examName: string,
  data: ExamRosterResponse,
  wcProfiles?: any[]
): Promise<void> {
  try {
    const db = await getDB();
    const compositeKey = `${classId}_${examName}`;
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_EXAM_MARKS, 'readwrite');
      const store = tx.objectStore(STORE_EXAM_MARKS);
      store.put({
        compositeKey,
        classId,
        examName,
        data,
        wcProfiles: wcProfiles || [],
        updatedAt: new Date().toISOString(),
      });
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } catch (err) {
    console.warn('[ClassroomOfflineStorage] Failed to save exam marks cache:', err);
  }
}

// -------------------------------------------------------------
// 5. Attendance Cache
// -------------------------------------------------------------

export async function getCachedAttendance(classId: string, date: string): Promise<AttendanceRosterResponse | null> {
  try {
    const db = await getDB();
    const compositeKey = `${classId}_${date}`;
    return new Promise((resolve) => {
      const tx = db.transaction(STORE_ATTENDANCE, 'readonly');
      const store = tx.objectStore(STORE_ATTENDANCE);
      const req = store.get(compositeKey);
      req.onsuccess = () => resolve(req.result ? req.result.data : null);
      req.onerror = () => resolve(null);
    });
  } catch {
    return null;
  }
}

export async function saveAttendanceToCache(
  classId: string,
  date: string,
  data: AttendanceRosterResponse
): Promise<void> {
  try {
    const db = await getDB();
    const compositeKey = `${classId}_${date}`;
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_ATTENDANCE, 'readwrite');
      const store = tx.objectStore(STORE_ATTENDANCE);
      store.put({
        compositeKey,
        classId,
        date,
        data,
        updatedAt: new Date().toISOString(),
      });
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } catch (err) {
    console.warn('[ClassroomOfflineStorage] Failed to save attendance cache:', err);
  }
}

// -------------------------------------------------------------
// 6. Stale-While-Revalidate Engine with Delayed Server Check
// -------------------------------------------------------------

export interface LoadClassroomSWROptions {
  delayMs?: number; // Delay before checking server API (default: 800ms)
  onCacheHit?: (cached: ClassroomCacheRecord) => void;
  onFreshData?: (fresh: ClassroomCacheRecord) => void;
  onSyncStatusChange?: (status: SyncStatus) => void;
  onError?: (err: any) => void;
}

/**
 * Load classroom structures offline-first with delayed server check.
 * 
 * 1. Immediately looks up IndexedDB for instant 0ms UI load.
 * 2. Invokes onCacheHit immediately if cached data is found.
 * 3. Waits for `delayMs` (default 800ms) without blocking user interactions.
 * 4. Asynchronously verifies fresh state against server API.
 * 5. Updates IndexedDB cache and calls onFreshData if changed.
 */
export async function loadClassroomWithDelayedSWR(
  idOrSlug: string,
  options: LoadClassroomSWROptions = {}
): Promise<ClassroomCacheRecord | null> {
  const { delayMs = 800, onCacheHit, onFreshData, onSyncStatusChange, onError } = options;

  // Step 1: Immediate cache read from IndexedDB
  const cached = await getCachedClassroom(idOrSlug);
  if (cached) {
    if (onCacheHit) onCacheHit(cached);
    if (onSyncStatusChange) onSyncStatusChange('offline_ready');
  } else {
    if (onSyncStatusChange) onSyncStatusChange('syncing');
  }

  // Step 2: Delayed background check for server API
  const runDelayedServerCheck = async (): Promise<ClassroomCacheRecord | null> => {
    try {
      if (delayMs > 0) {
        await new Promise((resolve) => setTimeout(resolve, delayMs));
      }

      if (onSyncStatusChange) onSyncStatusChange('syncing');

      // Fetch fresh class details
      const cls = await api.classes.get(idOrSlug);
      let schoolInfo: SchoolDTO | null = null;
      let allClasses: ClassDTO[] = [];
      let enrolledStudents: StudentDTO[] = [];

      // Fetch school info & sibling classes
      if (cls.school_id) {
        try {
          schoolInfo = await api.schools.get(cls.school_id);
        } catch (_) {}
        try {
          allClasses = await api.classes.list(cls.school_id);
        } catch (_) {}
      }

      // Fetch students roster
      try {
        enrolledStudents = await api.classes.getStudents(cls.id);
        await saveRosterToCache(cls.id, enrolledStudents);
      } catch (_) {}

      // Preserve local layout/seating plan if already saved in localStorage or IndexedDB
      const layoutKey = `edu_classroom_layout_${cls.id}`;
      const seatingKey = `edu_seating_plan_${cls.id}`;
      let layout = cached?.layout;
      let seatAssignments = cached?.seatAssignments;

      if (typeof window !== 'undefined') {
        const lsLayout = localStorage.getItem(layoutKey);
        if (lsLayout) {
          try {
            layout = JSON.parse(lsLayout);
          } catch (_) {}
        }
        const lsSeats = localStorage.getItem(seatingKey);
        if (lsSeats) {
          try {
            seatAssignments = JSON.parse(lsSeats);
          } catch (_) {}
        }
      }

      const freshRecord: ClassroomCacheRecord = {
        id: cls.id,
        slug: cls.code || idOrSlug,
        classInfo: cls,
        schoolInfo: schoolInfo || cached?.schoolInfo,
        allClasses: allClasses.length > 0 ? allClasses : cached?.allClasses || [],
        layout,
        seatAssignments,
        updatedAt: new Date().toISOString(),
      };

      // Persist to IndexedDB
      await saveClassroomToCache(freshRecord);

      if (onSyncStatusChange) onSyncStatusChange('synced');
      if (onFreshData) onFreshData(freshRecord);

      return freshRecord;
    } catch (err: any) {
      console.warn('[ClassroomOfflineStorage] Delayed server check error (falling back to offline cache):', err);
      if (onSyncStatusChange) onSyncStatusChange(cached ? 'offline_mode' : 'offline_ready');
      if (onError && !cached) onError(err);
      return cached;
    }
  };

  // Run in background without awaiting so caller gets instant offline data
  runDelayedServerCheck();

  return cached;
}
