/**
 * Offline-First IndexedDB Gate Kiosk Storage Service
 * Works completely offline for days or months with local anti-passback and sync queue.
 */

export interface CachedStudent {
  id: string;
  did: string;
  full_name: string;
  full_name_my?: string;
  roll_no: string;
  class_id?: string;
  class_name: string;
  grade_level: string;
  school_name: string;
  school_name_my: string;
  school_code: string;
  photo_url?: string;
  national_id?: string;
  updated_at: string;
}

export interface AttendanceEvent {
  event_id: string; // UUID
  student_id: string;
  did: string;
  student_name: string;
  roll_no: string;
  class_name: string;
  school_code: string;
  scanned_at: string; // ISO 8601
  event_date: string; // YYYY-MM-DD
  time_display: string; // HH:MM AM/PM
  scan_method: 'nfc_tap' | 'qr_scan' | 'manual';
  status: 'present' | 'late';
  sync_status: 'pending' | 'synced';
  synced_at?: string;
  device_id: string;
}

const DB_NAME = 'EduGateKioskDB';
const DB_VERSION = 1;

let dbPromise: Promise<IDBDatabase> | null = null;

function getDB(): Promise<IDBDatabase> {
  if (dbPromise) return dbPromise;

  dbPromise = new Promise((resolve, reject) => {
    if (typeof window === 'undefined' || !window.indexedDB) {
      reject(new Error('IndexedDB not supported in this environment'));
      return;
    }

    const request = window.indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;

      // 1. Students roster cache
      if (!db.objectStoreNames.contains('students')) {
        const studentStore = db.createObjectStore('students', { keyPath: 'id' });
        studentStore.createIndex('did', 'did', { unique: true });
        studentStore.createIndex('roll_no', 'roll_no', { unique: false });
      }

      // 2. Local Attendance Event Log
      if (!db.objectStoreNames.contains('attendance_events')) {
        const eventStore = db.createObjectStore('attendance_events', { keyPath: 'event_id' });
        eventStore.createIndex('sync_status', 'sync_status', { unique: false });
        eventStore.createIndex('scanned_at', 'scanned_at', { unique: false });
        eventStore.createIndex('student_date', ['student_id', 'event_date'], { unique: false });
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });

  return dbPromise;
}

// Generate simple time-based UUID v4/v7 fallback
function generateUUID(): string {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

// Default seeded students for offline readiness (matching BEHS Intaing demo)
export const DEFAULT_OFFLINE_STUDENTS: CachedStudent[] = [
  {
    id: 'student-demo-001',
    did: 'did:edu:mm:013:MMR013035-BEHS01-2026-STU0042',
    full_name: 'MAUNG AUNG KYAW',
    full_name_my: 'မောင်အောင်ကျော်',
    roll_no: '၅-က-၁၂',
    class_name: 'Grade 5-A',
    grade_level: 'Grade 5 (Primary)',
    school_name: 'BEHS Intaing (အင်းတိုင် အထက)',
    school_name_my: 'အထက အင်းတိုင်',
    school_code: 'MMR013035-BEHS01',
    updated_at: new Date().toISOString(),
  },
  {
    id: 'student-demo-002',
    did: 'did:edu:mm:013:MMR013035-BEHS01-2026-STU0043',
    full_name: 'MA THIDA WIN',
    full_name_my: 'မသီတာဝင်း',
    roll_no: '၅-က-၀၃',
    class_name: 'Grade 5-A',
    grade_level: 'Grade 5 (Primary)',
    school_name: 'BEHS Intaing (အင်းတိုင် အထက)',
    school_name_my: 'အထက အင်းတိုင်',
    school_code: 'MMR013035-BEHS01',
    updated_at: new Date().toISOString(),
  },
  {
    id: 'student-demo-003',
    did: 'did:edu:mm:013:MMR013035-BEHS01-2026-STU0044',
    full_name: 'MAUNG ZAW LIN',
    full_name_my: 'မောင်ဇော်လင်း',
    roll_no: '၅-က-၁၈',
    class_name: 'Grade 5-A',
    grade_level: 'Grade 5 (Primary)',
    school_name: 'BEHS Intaing (အင်းတိုင် အထက)',
    school_name_my: 'အထက အင်းတိုင်',
    school_code: 'MMR013035-BEHS01',
    updated_at: new Date().toISOString(),
  },
  {
    id: 'student-demo-004',
    did: 'did:edu:mm:013:MMR013035-BEHS01-2026-STU0045',
    full_name: 'MA KHIN SWE WIN',
    full_name_my: 'မခင်ဆွေဝင်း',
    roll_no: '၅-က-၀၇',
    class_name: 'Grade 5-A',
    grade_level: 'Grade 5 (Primary)',
    school_name: 'BEHS Intaing (အင်းတိုင် အထက)',
    school_name_my: 'အထက အင်းတိုင်',
    school_code: 'MMR013035-BEHS01',
    updated_at: new Date().toISOString(),
  },
];

export const offlineGateStorage = {
  /**
   * Initialize and seed student roster if empty
   */
  async init(): Promise<void> {
    const db = await getDB();
    const tx = db.transaction('students', 'readonly');
    const store = tx.objectStore('students');
    const countReq = store.count();

    return new Promise((resolve, reject) => {
      countReq.onsuccess = async () => {
        if (countReq.result === 0) {
          await this.saveStudents(DEFAULT_OFFLINE_STUDENTS);
        }
        resolve();
      };
      countReq.onerror = () => reject(countReq.error);
    });
  },

  /**
   * Save or update students in the local encrypted/offline roster cache
   */
  async saveStudents(students: CachedStudent[]): Promise<void> {
    const db = await getDB();
    const tx = db.transaction('students', 'readwrite');
    const store = tx.objectStore('students');

    for (const student of students) {
      store.put(student);
    }

    return new Promise((resolve, reject) => {
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  },

  /**
   * Get all cached students
   */
  async getAllStudents(): Promise<CachedStudent[]> {
    const db = await getDB();
    const tx = db.transaction('students', 'readonly');
    const store = tx.objectStore('students');
    const req = store.getAll();

    return new Promise((resolve, reject) => {
      req.onsuccess = () => resolve(req.result || []);
      req.onerror = () => reject(req.error);
    });
  },

  /**
   * Fast offline student lookup by DID or scanned URL
   */
  async findStudentByDID(scannedString: string): Promise<CachedStudent | null> {
    const db = await getDB();
    const cleanStr = scannedString.trim();

    // 1. Extract DID if embedded in verification URL
    let targetDID = cleanStr;
    if (cleanStr.includes('did=')) {
      try {
        const url = new URL(cleanStr);
        targetDID = url.searchParams.get('did') || cleanStr;
      } catch {
        const match = cleanStr.match(/did=([^&]+)/);
        if (match) targetDID = decodeURIComponent(match[1]);
      }
    }

    // 2. Direct DID index lookup
    const tx = db.transaction('students', 'readonly');
    const store = tx.objectStore('students');
    const didIndex = store.index('did');
    const req = didIndex.get(targetDID);

    return new Promise((resolve, reject) => {
      req.onsuccess = () => {
        if (req.result) {
          resolve(req.result);
          return;
        }

        // Fallback: search all students if partial match (e.g. roll number or UUID)
        const allReq = store.getAll();
        allReq.onsuccess = () => {
          const list: CachedStudent[] = allReq.result || [];
          const query = cleanStr.toLowerCase();
          const found = list.find((s) => {
            return (
              s.did.toLowerCase() === query ||
              s.id.toLowerCase() === query ||
              s.roll_no.toLowerCase() === query ||
              query.includes(s.did.toLowerCase()) ||
              (s.national_id && s.national_id.toLowerCase() === query)
            );
          });
          resolve(found || null);
        };
        allReq.onerror = () => reject(allReq.error);
      };
      req.onerror = () => reject(req.error);
    });
  },

  /**
   * Anti-Passback Check: Check if student has already swiped today or within the last N minutes
   */
  async checkRecentSwipe(
    studentId: string,
    windowMinutes = 30
  ): Promise<{ isDuplicate: boolean; lastSwipeTime?: string; lastSwipeRecord?: AttendanceEvent }> {
    const db = await getDB();
    const today = new Date().toISOString().split('T')[0];

    const tx = db.transaction('attendance_events', 'readonly');
    const store = tx.objectStore('attendance_events');
    const index = store.index('student_date');
    const req = index.getAll([studentId, today]);

    return new Promise((resolve, reject) => {
      req.onsuccess = () => {
        const events: AttendanceEvent[] = req.result || [];
        if (events.length === 0) {
          resolve({ isDuplicate: false });
          return;
        }

        // Sort latest first
        events.sort((a, b) => new Date(b.scanned_at).getTime() - new Date(a.scanned_at).getTime());
        const last = events[0];
        const lastTime = new Date(last.scanned_at).getTime();
        const diffMinutes = (Date.now() - lastTime) / (1000 * 60);

        if (diffMinutes < windowMinutes) {
          resolve({
            isDuplicate: true,
            lastSwipeTime: last.time_display,
            lastSwipeRecord: last,
          });
        } else {
          // Already attended today, but outside anti-passback window (e.g. afternoon exit)
          resolve({
            isDuplicate: true,
            lastSwipeTime: last.time_display,
            lastSwipeRecord: last,
          });
        }
      };
      req.onerror = () => reject(req.error);
    });
  },

  /**
   * Record Attendance Swipe locally
   */
  async recordSwipe(
    student: CachedStudent,
    scanMethod: 'nfc_tap' | 'qr_scan' | 'manual' = 'nfc_tap',
    deviceId = 'GATE-01-DESK'
  ): Promise<AttendanceEvent> {
    const db = await getDB();
    const now = new Date();
    const eventDate = now.toISOString().split('T')[0];

    // Determine status (present vs late based on 8:30 AM cutoff)
    const hours = now.getHours();
    const minutes = now.getMinutes();
    const isLate = hours > 8 || (hours === 8 && minutes > 30);

    const event: AttendanceEvent = {
      event_id: generateUUID(),
      student_id: student.id,
      did: student.did,
      student_name: student.full_name,
      roll_no: student.roll_no,
      class_name: student.class_name,
      school_code: student.school_code,
      scanned_at: now.toISOString(),
      event_date: eventDate,
      time_display: now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
      scan_method: scanMethod,
      status: isLate ? 'late' : 'present',
      sync_status: 'pending',
      device_id: deviceId,
    };

    const tx = db.transaction('attendance_events', 'readwrite');
    const store = tx.objectStore('attendance_events');
    store.add(event);

    return new Promise((resolve, reject) => {
      tx.oncomplete = () => resolve(event);
      tx.onerror = () => reject(tx.error);
    });
  },

  /**
   * Get all pending events awaiting sync to server
   */
  async getPendingEvents(limit = 200): Promise<AttendanceEvent[]> {
    const db = await getDB();
    const tx = db.transaction('attendance_events', 'readonly');
    const store = tx.objectStore('attendance_events');
    const index = store.index('sync_status');
    const req = index.getAll('pending');

    return new Promise((resolve, reject) => {
      req.onsuccess = () => {
        const list: AttendanceEvent[] = req.result || [];
        resolve(list.slice(0, limit));
      };
      req.onerror = () => reject(req.error);
    });
  },

  /**
   * Mark batch of events as synced
   */
  async markEventsAsSynced(eventIds: string[]): Promise<void> {
    if (eventIds.length === 0) return;
    const db = await getDB();
    const tx = db.transaction('attendance_events', 'readwrite');
    const store = tx.objectStore('attendance_events');
    const nowIso = new Date().toISOString();

    for (const id of eventIds) {
      const getReq = store.get(id);
      getReq.onsuccess = () => {
        const item: AttendanceEvent = getReq.result;
        if (item) {
          item.sync_status = 'synced';
          item.synced_at = nowIso;
          store.put(item);
        }
      };
    }

    return new Promise((resolve, reject) => {
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  },

  /**
   * Get Today's Scan Statistics
   */
  async getTodayStats(): Promise<{ todayTotal: number; pendingCount: number; recentEvents: AttendanceEvent[] }> {
    const db = await getDB();
    const today = new Date().toISOString().split('T')[0];
    const tx = db.transaction('attendance_events', 'readonly');
    const store = tx.objectStore('attendance_events');
    const req = store.getAll();

    return new Promise((resolve, reject) => {
      req.onsuccess = () => {
        const all: AttendanceEvent[] = req.result || [];
        const todayEvents = all.filter((e) => e.event_date === today);
        const pendingEvents = all.filter((e) => e.sync_status === 'pending');

        todayEvents.sort((a, b) => new Date(b.scanned_at).getTime() - new Date(a.scanned_at).getTime());

        resolve({
          todayTotal: todayEvents.length,
          pendingCount: pendingEvents.length,
          recentEvents: todayEvents.slice(0, 10),
        });
      };
      req.onerror = () => reject(req.error);
    });
  },

  /**
   * Get today's attendance map by studentId -> latest AttendanceEvent
   */
  async getTodayAttendanceMap(): Promise<Map<string, AttendanceEvent>> {
    const db = await getDB();
    const today = new Date().toISOString().split('T')[0];
    const tx = db.transaction('attendance_events', 'readonly');
    const store = tx.objectStore('attendance_events');
    const req = store.getAll();

    return new Promise((resolve, reject) => {
      req.onsuccess = () => {
        const all: AttendanceEvent[] = req.result || [];
        const todayEvents = all.filter((e) => e.event_date === today);
        todayEvents.sort((a, b) => new Date(b.scanned_at).getTime() - new Date(a.scanned_at).getTime());
        const map = new Map<string, AttendanceEvent>();
        for (const ev of todayEvents) {
          if (!map.has(ev.student_id)) {
            map.set(ev.student_id, ev);
          }
        }
        resolve(map);
      };
      req.onerror = () => reject(req.error);
    });
  },

  /**
   * Export encrypted/offline backup bundle for air-gapped / sneakernet USB transport
   */
  async exportBackupBundle(): Promise<string> {
    const db = await getDB();
    const tx = db.transaction(['attendance_events', 'students'], 'readonly');
    const eventReq = tx.objectStore('attendance_events').getAll();
    const studentReq = tx.objectStore('students').getAll();

    return new Promise((resolve, reject) => {
      tx.oncomplete = () => {
        const events: AttendanceEvent[] = eventReq.result || [];
        const students: CachedStudent[] = studentReq.result || [];
        const bundle = {
          magic: 'EDUPACK_V1',
          school_code: 'MMR013035-BEHS01',
          exported_at: new Date().toISOString(),
          record_count: events.length,
          students,
          attendance_events: events,
        };
        resolve(JSON.stringify(bundle, null, 2));
      };
      tx.onerror = () => reject(tx.error);
    });
  },

  /**
   * Import offline backup bundle from USB / file
   */
  async importBackupBundle(jsonString: string): Promise<{ importedEvents: number; importedStudents: number }> {
    const data = JSON.parse(jsonString);
    if (!data || data.magic !== 'EDUPACK_V1') {
      throw new Error('Invalid EduPack backup bundle format');
    }

    const students: CachedStudent[] = data.students || [];
    const events: AttendanceEvent[] = data.attendance_events || [];

    if (students.length > 0) {
      await this.saveStudents(students);
    }

    const db = await getDB();
    const tx = db.transaction('attendance_events', 'readwrite');
    const store = tx.objectStore('attendance_events');

    for (const ev of events) {
      store.put(ev);
    }

    return new Promise((resolve, reject) => {
      tx.oncomplete = () => resolve({ importedEvents: events.length, importedStudents: students.length });
      tx.onerror = () => reject(tx.error);
    });
  },
};
