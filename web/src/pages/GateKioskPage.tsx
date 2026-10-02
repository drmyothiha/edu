import React, { useEffect, useState, useRef, useMemo } from 'react';
import { Link } from 'react-router-dom';
import {
  ShieldCheck,
  Wifi,
  WifiOff,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  RefreshCw,
  Download,
  Upload,
  Volume2,
  VolumeX,
  Maximize,
  Minimize,
  Clock,
  Users,
  Search,
  ArrowLeft,
  Sparkles,
  QrCode,
  CreditCard,
  Building,
  Check,
  UserCheck,
  User,
  X,
  ChevronRight,
  Filter,
  Smartphone,
  Key,
  Settings,
  RotateCcw,
} from 'lucide-react';
import { QRCodeImage } from '../components/QRCodeImage';
import { KioskProvisioningConfig, GatePairInitResponse } from '../types';
import {
  offlineGateStorage,
  CachedStudent,
  AttendanceEvent,
  DEFAULT_OFFLINE_STUDENTS,
} from '../services/offlineGateStorage';
import { playSuccessChime, playDuplicateAlert, playErrorBuzzer } from '../utils/audioFeedback';
import { api } from '../api/client';
import { showAlertDialog } from '../context/ConfirmDialogContext';

// Burmese Day Names
const BURMESE_DAYS = ['တနင်္ဂနွေ', 'တနင်္လာ', 'အင်္ဂါ', 'ဗုဒ္ဓဟူး', 'ကြာသပတေး', 'သောကြာ', 'စနေ'];
// Burmese Month Names
const BURMESE_MONTHS = [
  'ဇန်နဝါရီ', 'ဖေဖော်ဝါရီ', 'မတ်', 'ဧပြီ', 'မေ', 'ဇွန်',
  'ဇူလိုင်', 'သြဂုတ်', 'စက်တင်ဘာ', 'အောက်တိုဘာ', 'နိုဝင်ဘာ', 'ဒီဇင်ဘာ'
];

function formatBurmeseDate(d: Date): string {
  const dayName = BURMESE_DAYS[d.getDay()];
  const day = d.getDate();
  const monthName = BURMESE_MONTHS[d.getMonth()];
  const year = d.getFullYear();
  return `${dayName}၊ ${day} ${monthName} ${year}`;
}

const KIOSK_CONFIG_KEY = 'edu_kiosk_provisioning';

export const GateKioskPage: React.FC = () => {
  const [isOnline, setIsOnline] = useState(typeof navigator !== 'undefined' ? navigator.onLine : true);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [currentTime, setCurrentTime] = useState(new Date());

  // Multi-Tenant Kiosk Provisioning State (Option A)
  const [provisioningConfig, setProvisioningConfig] = useState<KioskProvisioningConfig | null>(() => {
    const saved = localStorage.getItem(KIOSK_CONFIG_KEY);
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (_) {}
    }
    return null;
  });

  const isProvisioned = Boolean(provisioningConfig && provisioningConfig.paired);
  const [pairingSession, setPairingSession] = useState<GatePairInitResponse | null>(null);
  const [isInitializingPairing, setIsInitializingPairing] = useState(false);
  const [isSimulatingPairing, setIsSimulatingPairing] = useState(false);
  const [showResetConfirmModal, setShowResetConfirmModal] = useState(false);

  // Kiosk Scan Feedback State
  const [scanState, setScanState] = useState<'idle' | 'success' | 'duplicate' | 'error'>('idle');
  const [scannedStudent, setScannedStudent] = useState<CachedStudent | null>(null);
  const [lastSwipeTime, setLastSwipeTime] = useState<string>('');
  const [feedbackMessage, setFeedbackMessage] = useState<string>('');
  const [lastScanMethod, setLastScanMethod] = useState<'nfc_tap' | 'qr_scan' | 'manual'>('nfc_tap');

  // Local Storage Stats & History
  const [todayTotal, setTodayTotal] = useState(0);
  const [pendingCount, setPendingCount] = useState(0);
  const [recentEvents, setRecentEvents] = useState<AttendanceEvent[]>([]);
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncStatusMsg, setSyncStatusMsg] = useState<string | null>(null);

  // Cached Students & Today Attendance Map
  const [allStudents, setAllStudents] = useState<CachedStudent[]>([]);
  const [todayAttendanceMap, setTodayAttendanceMap] = useState<Map<string, AttendanceEvent>>(new Map());

  // Manual Roll Call & Autocomplete State
  const [showManualModal, setShowManualModal] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedGradeFilter, setSelectedGradeFilter] = useState('ALL');
  const [selectedStudentForManual, setSelectedStudentForManual] = useState<CachedStudent | null>(null);

  // Keyboard Wedge Hardware Scanner Buffer
  const bufferRef = useRef<string>('');
  const lastKeyTimeRef = useRef<number>(Date.now());
  const resetTimerRef = useRef<any>(null);

  // 0. Auto-initialize Gate Pairing session if unprovisioned
  useEffect(() => {
    if (isProvisioned) return;

    let pollTimer: any = null;
    let isCancelled = false;

    const startPairingSession = async () => {
      setIsInitializingPairing(true);
      try {
        const session = await api.gate.initPairing();
        if (isCancelled) return;
        setPairingSession(session);

        // Poll every 2 seconds for admin mobile scan confirmation
        pollTimer = setInterval(async () => {
          try {
            const status = await api.gate.getPairingStatus(session.pairing_id);
            if (status && status.status === 'paired') {
              clearInterval(pollTimer);
              const newConfig: KioskProvisioningConfig = {
                paired: true,
                school_id: status.school_id || '',
                school_code: status.school_code || 'MMR013035-BEHS01',
                school_name: status.school_name || 'BEHS Intaing',
                school_name_my: status.school_name_my || 'အထက အင်းတိုင်',
                gate_name: status.gate_name || 'ဂိတ်-၀၁ (အဝင်) • GATE-01',
                device_api_key: status.device_api_key || '',
                paired_at: new Date().toISOString(),
              };
              localStorage.setItem(KIOSK_CONFIG_KEY, JSON.stringify(newConfig));
              setProvisioningConfig(newConfig);
              if (soundEnabled) playSuccessChime();

              // Download student roster for newly paired school
              await fetchServerRoster(newConfig.school_id);
            }
          } catch (e) {
            console.warn('Pairing status poll err:', e);
          }
        }, 2000);
      } catch (err) {
        console.warn('Failed to initialize gate pairing session:', err);
      } finally {
        setIsInitializingPairing(false);
      }
    };

    startPairingSession();

    return () => {
      isCancelled = true;
      if (pollTimer) clearInterval(pollTimer);
    };
  }, [isProvisioned]);

  // Fast Simulator pairing (for desktop testing without mobile device)
  const handleSimulateAdminPairing = async () => {
    if (!pairingSession) return;
    setIsSimulatingPairing(true);
    try {
      const res = await api.gate.confirmPairing({
        pairing_id: pairingSession.pairing_id,
        gate_name: 'ဂိတ်-၀၁ (အဓိက အဝင်ဝ) • Gate-01',
      });
      if (res && res.status === 'paired') {
        const newConfig: KioskProvisioningConfig = {
          paired: true,
          school_id: res.school_id || '0ac3f6b3-ce6d-4d15-bb4c-9b868f41aeb4',
          school_code: res.school_code || 'MMR013035-BEHS01',
          school_name: res.school_name || 'BEHS Intaing',
          school_name_my: res.school_name_my || 'အထက အင်းတိုင်',
          gate_name: res.gate_name || 'ဂိတ်-၀၁ (အဝင်) • GATE-01',
          device_api_key: res.device_api_key || 'kiosk_key_demo',
          paired_at: new Date().toISOString(),
        };
        localStorage.setItem(KIOSK_CONFIG_KEY, JSON.stringify(newConfig));
        setProvisioningConfig(newConfig);
        if (soundEnabled) playSuccessChime();
        await fetchServerRoster(newConfig.school_id);
      }
    } catch (err) {
      console.error('Simulate pairing failed:', err);
    } finally {
      setIsSimulatingPairing(false);
    }
  };

  const handleResetKioskPairing = () => {
    localStorage.removeItem(KIOSK_CONFIG_KEY);
    setProvisioningConfig(null);
    setShowResetConfirmModal(false);
  };

  // 1. Clock timer
  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  // 2. Online/Offline detection
  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      triggerAutoSync();
    };
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // Helper to reload stats and attendance map
  const refreshStorageStats = async () => {
    try {
      const stats = await offlineGateStorage.getTodayStats();
      setTodayTotal(stats.todayTotal);
      setPendingCount(stats.pendingCount);
      setRecentEvents(stats.recentEvents);

      const map = await offlineGateStorage.getTodayAttendanceMap();
      setTodayAttendanceMap(map);

      const students = await offlineGateStorage.getAllStudents();
      setAllStudents(students);
    } catch (err) {
      console.warn('Failed to refresh gate stats:', err);
    }
  };

  // 3. Initialize IndexedDB and load stats
  useEffect(() => {
    const initStorage = async () => {
      try {
        await offlineGateStorage.init();
        await refreshStorageStats();

        // Try syncing roster from server if online
        if (navigator.onLine) {
          fetchServerRoster();
        }
      } catch (err) {
        console.warn('Failed to init gate storage:', err);
      }
    };

    initStorage();
  }, []);

  // 4. Hardware Scanner Listener (Honeywell, Zebra, Newland & USB NFC in Keyboard Wedge mode)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ignore if user is actively typing in the manual input modal
      if ((e.target as HTMLElement).tagName === 'INPUT' && (e.target as HTMLElement).id === 'manual-entry-input') {
        return;
      }

      const now = Date.now();
      // Scanners transmit characters with < 40ms inter-character delay
      if (now - lastKeyTimeRef.current > 120) {
        bufferRef.current = '';
      }
      lastKeyTimeRef.current = now;

      if (e.key === 'Enter') {
        const rawCode = bufferRef.current.trim();
        bufferRef.current = '';
        if (rawCode.length >= 4) {
          processScannedPayload(rawCode, 'qr_scan');
        }
      } else if (e.key.length === 1) {
        bufferRef.current += e.key;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [soundEnabled]);

  // 5. Native Web NFC API Listener (if supported by Chrome/Android/Desktop NFC)
  useEffect(() => {
    let ndef: any = null;
    let abortController: AbortController | null = null;

    if (typeof window !== 'undefined' && 'NDEFReader' in window) {
      try {
        abortController = new AbortController();
        const NDEFReaderClass = (window as any).NDEFReader;
        ndef = new NDEFReaderClass();
        ndef.scan({ signal: abortController.signal }).then(() => {
          ndef.onreading = (event: any) => {
            const serialNumber = event.serialNumber;
            let messageStr = serialNumber || '';
            if (event.message && event.message.records) {
              for (const record of event.message.records) {
                if (record.recordType === 'text' || record.recordType === 'url') {
                  const decoder = new TextDecoder(record.encoding || 'utf-8');
                  messageStr = decoder.decode(record.data);
                  break;
                }
              }
            }
            if (messageStr) {
              processScannedPayload(messageStr, 'nfc_tap');
            }
          };
        }).catch((err: any) => {
          console.log('Web NFC not started or permission denied:', err);
        });
      } catch (err) {
        console.log('Web NFC initialization skipped:', err);
      }
    }

    return () => {
      if (abortController) abortController.abort();
    };
  }, []);

  // Process Scanned Payload (< 15ms local resolution)
  const processScannedPayload = async (
    rawPayload: string,
    scanMethod: 'nfc_tap' | 'qr_scan' | 'manual' = 'nfc_tap'
  ) => {
    if (resetTimerRef.current) {
      clearTimeout(resetTimerRef.current);
    }

    const cleanInput = rawPayload.trim();
    if (!cleanInput) return;

    setLastScanMethod(scanMethod);

    // Instant local lookup in IndexedDB
    const student = await offlineGateStorage.findStudentByDID(cleanInput);

    if (student) {
      // Anti-Passback Check: Has the student already swiped today?
      const antiPassback = await offlineGateStorage.checkRecentSwipe(student.id, 20);

      if (antiPassback.isDuplicate) {
        // DUPLICATE DETECTED
        if (soundEnabled) playDuplicateAlert();
        setScanState('duplicate');
        setScannedStudent(student);
        setLastSwipeTime(antiPassback.lastSwipeTime || 'ယနေ့စောစောက');
        setFeedbackMessage('အထပ်ထပ် စာရင်းသွင်းမှု စစ်ဆေးတွေ့ရှိသည် (Already Checked In Today)');
      } else {
        // SUCCESS: RECORD ATTENDANCE SWIPE
        if (soundEnabled) playSuccessChime();
        await offlineGateStorage.recordSwipe(student, scanMethod);

        setScanState('success');
        setScannedStudent(student);
        setLastSwipeTime(new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }));
        setFeedbackMessage(
          scanMethod === 'manual'
            ? 'လူကိုယ်တိုင် စစ်ဆေးအတည်ပြုပြီး • ကျောင်းတက်ရောက်မှု မှတ်တမ်းတင်ပြီး'
            : 'မင်္ဂလာပါ • ကျောင်းတက်ရောက်မှု မှတ်တမ်းတင်ပြီး'
        );

        // Auto sync in background if online
        if (navigator.onLine) {
          triggerAutoSync();
        }
      }
    } else {
      // UNRECOGNIZED CARD
      if (soundEnabled) playErrorBuzzer();
      setScanState('error');
      setScannedStudent(null);
      setLastSwipeTime('');
      setFeedbackMessage(`အသိအမှတ်မပြုသော ကတ်ဖြစ်ပါသည် (DID: ${cleanInput.slice(0, 24)}...)`);
    }

    // Refresh live counts & attendance map
    await refreshStorageStats();

    // Auto-reset back to idle screen after 4.5 seconds
    resetTimerRef.current = setTimeout(() => {
      setScanState('idle');
      setScannedStudent(null);
      setFeedbackMessage('');
    }, 4500);
  };

  // Sync roster from central server
  const fetchServerRoster = async (customSchoolId?: string) => {
    try {
      const targetSchoolId = customSchoolId || provisioningConfig?.school_id;
      const resp = await api.gate.getRoster(targetSchoolId);
      if (resp && resp.students && resp.students.length > 0) {
        const cachedList: CachedStudent[] = resp.students.map((s) => ({
          id: s.id,
          did: s.did,
          full_name: s.full_name,
          full_name_my: s.full_name_my || s.full_name,
          roll_no: s.roll_no,
          class_id: s.class_id,
          class_name: s.class_name,
          grade_level: s.grade_level,
          school_name: s.school_name,
          school_name_my: s.school_name_my,
          school_code: s.school_code,
          photo_url: s.photo_url,
          national_id: s.national_id,
          updated_at: s.updated_at || new Date().toISOString(),
        }));

        await offlineGateStorage.saveStudents(cachedList);
        await refreshStorageStats();
        return cachedList.length;
      }
    } catch (err) {
      console.warn('Server roster fetch skipped (offline or not reachable):', err);
    }
    return 0;
  };

  // Push pending attendance events to backend server
  const triggerAutoSync = async () => {
    if (isSyncing || !navigator.onLine) return;
    setIsSyncing(true);
    setSyncStatusMsg('ဆာဗာသို့ ပေးပို့နေသည်...');

    try {
      const pending = await offlineGateStorage.getPendingEvents(200);
      if (pending.length === 0) {
        const count = await fetchServerRoster();
        setIsSyncing(false);
        setSyncStatusMsg(count > 0 ? `ကျောင်းသား ${count} ဦး အချက်အလက် ဆာဗာမှ ရယူပြီးပါပြီ` : 'ပေးပို့ရန် မှတ်တမ်းအသစ် မရှိပါ');
        setTimeout(() => setSyncStatusMsg(null), 3000);
        return;
      }

      const syncPayload = {
        school_code: provisioningConfig?.school_code || 'MMR013035-BEHS01',
        device_id: provisioningConfig?.gate_name || 'GATE-01-DESK',
        events: pending.map((ev) => ({
          event_id: ev.event_id,
          student_id: ev.student_id,
          did: ev.did,
          student_name: ev.student_name,
          roll_no: ev.roll_no,
          class_name: ev.class_name,
          school_code: ev.school_code,
          scanned_at: ev.scanned_at,
          event_date: ev.event_date,
          time_display: ev.time_display,
          scan_method: ev.scan_method,
          status: ev.status,
          device_id: ev.device_id,
        })),
      };

      const res = await api.gate.syncBatch(syncPayload);

      if (res && res.synced_ids && res.synced_ids.length > 0) {
        await offlineGateStorage.markEventsAsSynced(res.synced_ids);
      }

      await refreshStorageStats();
      setSyncStatusMsg(`မှတ်တမ်း ${res.synced_count} ခု အောင်မြင်စွာ ပေးပို့ပြီးပါပြီ`);
      setTimeout(() => setSyncStatusMsg(null), 3500);
    } catch (err: any) {
      setSyncStatusMsg(`Sync အဆင်မပြေပါ: ${err.message || 'Server error'}`);
    } finally {
      setIsSyncing(false);
    }
  };

  // Export encrypted/compressed backup bundle for USB transfer
  const handleExportBackup = async () => {
    try {
      const json = await offlineGateStorage.exportBackupBundle();
      const blob = new Blob([json], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      const dateStr = new Date().toISOString().split('T')[0];
      a.href = url;
      a.download = `edugate_sync_MMR013035_${dateStr}.edupack`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err: any) {
      showAlertDialog({
        title: 'အရန်ဖိုင် ထုတ်ယူခြင်း မအောင်မြင်ပါ',
        message: 'Backup export failed: ' + (err?.message || err),
        variant: 'danger',
      });
    }
  };

  // Import backup bundle from USB file
  const handleImportBackup = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const text = event.target?.result as string;
        const result = await offlineGateStorage.importBackupBundle(text);
        showAlertDialog({
          title: 'ထည့်သွင်းခြင်း အောင်မြင်ပါသည်',
          message: `အောင်မြင်စွာ ထည့်သွင်းပြီးပါပြီ!\nကျောင်းသား: ${result.importedStudents} ဦး\nမှတ်တမ်း: ${result.importedEvents} ခု`,
          variant: 'success',
        });
        await refreshStorageStats();
      } catch (err: any) {
        showAlertDialog({
          title: 'ထည့်သွင်းခြင်း မအောင်မြင်ပါ',
          message: 'Import failed: ' + err.message,
          variant: 'danger',
        });
      }
    };
    reader.readAsText(file);
  };

  // Fullscreen toggle
  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().then(() => setIsFullscreen(true)).catch(() => {});
    } else {
      document.exitFullscreen().then(() => setIsFullscreen(false)).catch(() => {});
    }
  };

  // Open manual entry modal with fresh attendance map
  const handleOpenManualModal = async () => {
    setSearchQuery('');
    setSelectedGradeFilter('ALL');
    setSelectedStudentForManual(null);
    await refreshStorageStats();
    setShowManualModal(true);
  };

  // Distinct Grade levels for quick filter chips in manual modal
  const distinctGradeLevels = useMemo(() => {
    const standardOrder = ['KG', 'Grade 1', 'Grade 2', 'Grade 3', 'Grade 4', 'Grade 5', 'Grade 6', 'Grade 7', 'Grade 8', 'Grade 9', 'Grade 10', 'Grade 11', 'Grade 12'];
    return standardOrder.filter((g) => allStudents.some((s) => (s.grade_level || '').includes(g) || (s.class_name || '').includes(g)));
  }, [allStudents]);

  // Autocomplete matching students in manual modal
  const filteredManualStudents = useMemo(() => {
    let list = allStudents;

    // 1. Grade level filter
    if (selectedGradeFilter !== 'ALL') {
      list = list.filter((s) => {
        const g = (s.grade_level || '').toLowerCase();
        const c = (s.class_name || '').toLowerCase();
        const target = selectedGradeFilter.toLowerCase();
        return g.includes(target) || c.includes(target);
      });
    }

    // 2. Search query (Burmese name, English name, Roll number, DID, Class)
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      list = list.filter((s) => {
        const name = (s.full_name || '').toLowerCase();
        const nameMy = (s.full_name_my || '').toLowerCase();
        const roll = (s.roll_no || '').toLowerCase();
        const cls = (s.class_name || '').toLowerCase();
        const grade = (s.grade_level || '').toLowerCase();
        const did = (s.did || '').toLowerCase();
        return (
          name.includes(q) ||
          nameMy.includes(q) ||
          roll.includes(q) ||
          cls.includes(q) ||
          grade.includes(q) ||
          did.includes(q)
        );
      });
    }

    return list;
  }, [allStudents, searchQuery, selectedGradeFilter]);

  // Select student for verification
  const handleSelectStudentForManual = (student: CachedStudent) => {
    setSelectedStudentForManual(student);
  };

  // Confirm manual roll call and check in
  const handleConfirmManualAttendance = async () => {
    if (!selectedStudentForManual) return;
    const student = selectedStudentForManual;
    setShowManualModal(false);
    setSelectedStudentForManual(null);
    setSearchQuery('');
    await processScannedPayload(student.did, 'manual');
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col justify-between font-sans select-none overflow-x-hidden">
      {/* ---------------- 1. KIOSK HEADER BAR ---------------- */}
      <header className="bg-slate-900/90 backdrop-blur border-b border-slate-800 px-6 py-4 flex flex-wrap items-center justify-between gap-4">
        {/* School Crest & Gate Title */}
        <div className="flex items-center gap-3.5">
          <Link
            to="/parent/student/demo"
            className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 transition"
            title="ပင်မစာမျက်နှာသို့ ပြန်သွားရန်"
          >
            <ArrowLeft className="h-5 w-5" />
          </Link>
          <div className="p-2.5 rounded-xl bg-indigo-600/20 text-indigo-400 border border-indigo-500/30">
            <Building className="h-6 w-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-base sm:text-lg font-black text-white tracking-tight font-sans">
                {isProvisioned
                  ? `${provisioningConfig?.school_name_my || provisioningConfig?.school_name || 'အထက အင်းတိုင်'} • ကျောင်းဝင်ပေါက် စမတ်ကတ် စစ်ဆေးရေးဂိတ်`
                  : 'ကျောင်းဝင်ပေါက် စမတ်ကတ် စစ်ဆေးရေးဂိတ် • ကနဦး စက်ချိတ်ဆက်ခြင်း'}
              </h1>
              <span className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded-full border ${
                isProvisioned
                  ? 'bg-indigo-950 text-indigo-300 border-indigo-700/60'
                  : 'bg-amber-950 text-amber-300 border-amber-600/60'
              }`}>
                {isProvisioned ? (provisioningConfig?.gate_name || 'ဂိတ်-၀၁ (အဝင်)') : 'စက်မချိတ်ဆက်ရသေးပါ (Unprovisioned)'}
              </span>
            </div>
            <p className="text-xs text-slate-400 font-sans">
              {isProvisioned
                ? `${provisioningConfig?.school_code || 'MMR013035-BEHS01'} • အော့ဖ်လိုင်း စမတ်ကတ်ဖြင့် ကျောင်းတက်ရောက်မှု မှတ်တမ်းတင်စနစ်`
                : 'Option A: ကျောင်းစီမံခန့်ခွဲသူ၏ မိုဘိုင်းဖုန်းဖြင့် ဤဂိတ်စက်အား ချိတ်ဆက်ပါ'}
            </p>
          </div>
        </div>

        {/* Real-time Clock in Burmese */}
        <div className="hidden md:flex flex-col items-center px-4 py-1.5 rounded-xl bg-slate-950 border border-slate-800 font-mono">
          <div className="text-lg font-black text-amber-300 tracking-wider">
            {currentTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
          </div>
          <div className="text-[10px] text-slate-400 tracking-tight font-sans">
            {formatBurmeseDate(currentTime)}
          </div>
        </div>

        {/* Status Badges & Controls */}
        <div className="flex items-center gap-2.5">
          {/* Online / Offline status badge */}
          <div
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold border transition ${
              isOnline
                ? 'bg-emerald-950/60 text-emerald-400 border-emerald-500/30'
                : 'bg-amber-950/60 text-amber-400 border-amber-500/30'
            }`}
          >
            {isOnline ? <Wifi className="h-4 w-4" /> : <WifiOff className="h-4 w-4" />}
            <span>{isOnline ? '🟢 အွန်လိုင်း (Online)' : '🟠 အော့ဖ်လိုင်း (Offline)'}</span>
          </div>

          {/* Audio Chime Mute/Unmute */}
          <button
            type="button"
            onClick={() => setSoundEnabled(!soundEnabled)}
            className="p-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 transition"
            title={soundEnabled ? 'အသံ ပိတ်ရန်' : 'အသံ ဖွင့်ရန်'}
          >
            {soundEnabled ? <Volume2 className="h-4 w-4 text-emerald-400" /> : <VolumeX className="h-4 w-4 text-slate-400" />}
          </button>

          {/* Fullscreen Toggle */}
          <button
            type="button"
            onClick={toggleFullscreen}
            className="p-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 transition"
            title={isFullscreen ? 'မျက်နှာပြင် မူလအတိုင်းထားရန်' : 'မျက်နှာပြင် အပြည့်ကြည့်ရန်'}
          >
            {isFullscreen ? <Minimize className="h-4 w-4" /> : <Maximize className="h-4 w-4" />}
          </button>
        </div>
      </header>

      {/* ---------------- 2. MAIN ACTIVE SCAN VIEWPORT / PAIRING SCREEN ---------------- */}
      <main className="flex-1 flex flex-col items-center justify-center p-6 max-w-4xl mx-auto w-full">
        {!isProvisioned ? (
          <div className="w-full max-w-2xl mx-auto my-auto animate-in fade-in zoom-in-95 duration-300">
            <div className="w-full bg-slate-900/90 backdrop-blur-xl border border-indigo-500/30 rounded-3xl p-8 sm:p-10 shadow-2xl shadow-indigo-950/50 flex flex-col items-center text-center">
              {/* Top Badge */}
              <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-indigo-500/10 border border-indigo-500/30 text-indigo-400 text-xs font-mono font-bold mb-6">
                <Key className="h-3.5 w-3.5" />
                <span>OPTION A • MULTI-TENANT DEVICE PAIRING</span>
              </div>

              {/* Title & Subtitle */}
              <h2 className="text-xl sm:text-2xl font-black text-white tracking-tight mb-2 font-sans">
                ကျောင်းစီမံခန့်ခွဲသူ၏ ဖုန်းဖြင့် ဤဂိတ်စက်ကို ချိတ်ဆက်ပါ
              </h2>
              <p className="text-xs sm:text-sm text-slate-300 max-w-md mx-auto mb-8 font-sans leading-relaxed">
                ကျောင်းအုပ်ကြီး သို့မဟုတ် ကျောင်းတာဝန်ခံ၏ Android ဖုန်း (Edu Mobile App) ဖြင့် အောက်ပါ Setup QR ကုဒ်ကို စကင်ဖတ်၍ ဤကွန်ပျူတာအား အော့ဖ်လိုင်းဂိတ်စက်အဖြစ် အပြီးအပိုင် ချိတ်ဆက်ပေးပါ။
              </p>

              {/* QR Code Frame */}
              <div className="relative p-5 rounded-2xl bg-white shadow-2xl shadow-indigo-500/20 mb-6 border-4 border-indigo-500/30 flex flex-col items-center">
                {pairingSession?.qr_payload ? (
                  <QRCodeImage
                    value={pairingSession.qr_payload}
                    size={190}
                    className="rounded-lg"
                    alt="Kiosk Setup QR Code"
                  />
                ) : (
                  <div className="w-48 h-48 flex flex-col items-center justify-center text-slate-500 font-mono text-xs">
                    <RefreshCw className="h-8 w-8 animate-spin text-indigo-600 mb-2" />
                    <span>Setup QR ထုတ်ယူနေသည်...</span>
                  </div>
                )}

                {/* Pairing ID Pill */}
                <div className="mt-3 px-3 py-1 bg-slate-100 rounded-lg text-slate-700 font-mono text-[11px] font-bold select-all">
                  {pairingSession?.pairing_id || 'Generating Session...'}
                </div>
              </div>

              {/* Live Polling Status */}
              <div className="inline-flex items-center gap-2.5 px-4 py-2 rounded-xl bg-slate-950 border border-slate-800 text-xs font-mono mb-8">
                <span className="relative flex h-2.5 w-2.5">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-indigo-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-indigo-500"></span>
                </span>
                <span className="text-slate-300 font-sans">
                  {isInitializingPairing
                    ? 'ချိတ်ဆက်မှု လိပ်စာ ဖန်တီးနေပါသည်...'
                    : '📱 မိုဘိုင်းဖုန်းမှ စကင်ဖတ်ရန် စောင့်ဆိုင်းနေပါသည် (Waiting for Admin Scan)...'}
                </span>
              </div>

              {/* 3 Steps Guide in Burmese */}
              <div className="w-full grid grid-cols-1 sm:grid-cols-3 gap-3 text-left mb-8">
                <div className="p-3.5 rounded-2xl bg-slate-950/60 border border-slate-800/80">
                  <div className="flex items-center gap-2 mb-1.5">
                    <div className="w-5 h-5 rounded-full bg-indigo-500/20 text-indigo-400 flex items-center justify-center text-xs font-bold font-mono">
                      ၁
                    </div>
                    <span className="text-xs font-bold text-white font-sans">Admin Sign-In</span>
                  </div>
                  <p className="text-[11px] text-slate-400 font-sans leading-relaxed">
                    မိုဘိုင်းဖုန်းတွင် ကျောင်းအုပ်/Admin အကောင့်ဖြင့် Login ဝင်ပါ
                  </p>
                </div>

                <div className="p-3.5 rounded-2xl bg-slate-950/60 border border-slate-800/80">
                  <div className="flex items-center gap-2 mb-1.5">
                    <div className="w-5 h-5 rounded-full bg-indigo-500/20 text-indigo-400 flex items-center justify-center text-xs font-bold font-mono">
                      ၂
                    </div>
                    <span className="text-xs font-bold text-white font-sans">QR စကင်ဖတ်ပါ</span>
                  </div>
                  <p className="text-[11px] text-slate-400 font-sans leading-relaxed">
                    "ဂိတ်စက် ချိတ်ဆက်ရန်" ကို နှိပ်ပြီး ဤ QR ကုဒ်ကို ဖတ်ပါ
                  </p>
                </div>

                <div className="p-3.5 rounded-2xl bg-slate-950/60 border border-slate-800/80">
                  <div className="flex items-center gap-2 mb-1.5">
                    <div className="w-5 h-5 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center text-xs font-bold font-mono">
                      ၃
                    </div>
                    <span className="text-xs font-bold text-white font-sans">အော့ဖ်လိုင်း အသင့်သုံး</span>
                  </div>
                  <p className="text-[11px] text-slate-400 font-sans leading-relaxed">
                    ကျောင်းသားစာရင်း ဒေါင်းလုဒ်ပြီးသည်နှင့် အော့ဖ်လိုင်း စသုံးနိုင်ပါပြီ
                  </p>
                </div>
              </div>

              {/* Fast Developer / Simulator Action */}
              <div className="w-full pt-6 border-t border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-3">
                <span className="text-xs text-slate-400 font-sans">
                  စမ်းသပ်မှုအတွက် မိုဘိုင်းဖုန်းမပါဘဲ ချိတ်ဆက်လိုပါသလား?
                </span>
                <button
                  type="button"
                  disabled={isSimulatingPairing || !pairingSession}
                  onClick={handleSimulateAdminPairing}
                  className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white text-xs font-bold font-sans shadow-lg shadow-indigo-600/30 transition"
                >
                  {isSimulatingPairing ? (
                    <RefreshCw className="h-4 w-4 animate-spin" />
                  ) : (
                    <Sparkles className="h-4 w-4 text-amber-300" />
                  )}
                  <span>နမူနာ စမ်းသပ်မှု: အထက အင်းတိုင် အဖြစ် ချိတ်ဆက်မည်</span>
                </button>
              </div>
            </div>
          </div>
        ) : (
          <>
            {/* IDLE STATE */}
            {scanState === 'idle' && (
          <div className="w-full text-center space-y-6 animate-in fade-in duration-300">
            {/* Visual Tap Target Prompt */}
            <div className="relative mx-auto w-44 h-44 rounded-3xl border-2 border-dashed border-indigo-500/40 bg-gradient-to-br from-indigo-950/40 to-slate-900/60 flex flex-col items-center justify-center p-6 shadow-2xl">
              <div className="w-20 h-20 rounded-2xl bg-indigo-600/20 border border-indigo-400/40 flex items-center justify-center text-indigo-300 shadow-inner mb-3">
                <CreditCard className="h-10 w-10 animate-pulse" />
              </div>
              <div className="flex items-center gap-1.5 text-emerald-400 text-xs font-mono font-bold">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
                <span>READY TO SCAN</span>
              </div>
            </div>

            {/* Instruction in Burmese */}
            <div className="space-y-2">
              <h2 className="text-2xl sm:text-3xl font-black text-white tracking-tight">
                ကျောင်းသား စမတ်ကတ် (NFC) သို့မဟုတ် QR ကုဒ်ကို ပြပါ
              </h2>
              <p className="text-sm text-slate-400 max-w-lg mx-auto">
                ကျောင်းသား စမတ်ကတ်ကို စကင်နာပေါ်သို့ ထိကပ်ပါ သို့မဟုတ် QR ကုဒ်ကို စကင်နာရှေ့တွင် ပြသပါ
              </p>
            </div>

            {/* Supported Devices Indicator */}
            <div className="inline-flex flex-wrap justify-center items-center gap-3 px-4 py-2 rounded-2xl bg-slate-900/80 border border-slate-800 text-xs text-slate-400 font-mono">
              <span className="flex items-center gap-1 text-slate-300 font-sans">
                <Wifi className="h-3.5 w-3.5 text-indigo-400 rotate-90" /> NFC ထိကပ်စစ်ဆေးမှု (13.56MHz)
              </span>
              <span>•</span>
              <span className="flex items-center gap-1 text-slate-300 font-sans">
                <QrCode className="h-3.5 w-3.5 text-indigo-400" /> 2D Optical QR စကင်နာ
              </span>
              <span>•</span>
              <span className="text-emerald-400 font-bold font-sans">⚡ &lt; 15ms လျင်မြန်စွာ စစ်ဆေးအတည်ပြုခြင်း</span>
            </div>

            {/* Quick Helper for forgotten cards */}
            <div className="pt-2">
              <button
                type="button"
                onClick={handleOpenManualModal}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-slate-900/90 hover:bg-slate-800 border border-slate-700/80 text-xs text-indigo-300 hover:text-white transition shadow-sm"
              >
                <Search className="h-3.5 w-3.5 text-indigo-400" />
                <span>💡 ကျောင်းသား ကတ်မပါလာပါက ဤနေရာကို နှိပ်၍ အမည်ဖြင့် ရှာဖွေနိုင်ပါသည်</span>
              </button>
            </div>
          </div>
        )}

        {/* SUCCESS STATE (< 15ms MATCH) */}
        {scanState === 'success' && scannedStudent && (
          <div className="w-full max-w-2xl bg-gradient-to-br from-emerald-950/80 via-slate-900 to-slate-950 border-2 border-emerald-500 rounded-3xl p-8 shadow-2xl shadow-emerald-500/20 animate-in zoom-in-95 duration-200">
            <div className="flex flex-col sm:flex-row items-center sm:items-start gap-6">
              {/* Student Passport Photo */}
              <div className="relative w-28 h-36 rounded-2xl overflow-hidden border-2 border-emerald-400 shadow-xl bg-slate-800 flex-shrink-0 flex items-center justify-center">
                {scannedStudent.photo_url ? (
                  <img src={scannedStudent.photo_url} alt={scannedStudent.full_name} className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full bg-gradient-to-b from-indigo-900 to-slate-950 flex flex-col items-center justify-center p-2 text-center">
                    <div className="w-12 h-12 rounded-full bg-amber-400/90 border border-amber-200 mb-2 shadow" />
                    <div className="w-16 h-8 rounded-t-lg bg-emerald-600 border border-emerald-300/80" />
                  </div>
                )}
                <div className="absolute top-2 right-2 p-1 rounded-full bg-emerald-500 text-slate-950">
                  <CheckCircle2 className="h-5 w-5" />
                </div>
              </div>

              {/* Verified Details */}
              <div className="flex-1 space-y-2 text-center sm:text-left">
                <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-400/30 text-xs font-bold font-sans">
                  <Check className="h-3.5 w-3.5 stroke-[3]" /> {feedbackMessage}
                </div>

                <h3 className="text-2xl sm:text-3xl font-black text-white tracking-tight uppercase">
                  {scannedStudent.full_name}
                </h3>
                {scannedStudent.full_name_my && (
                  <div className="text-base font-bold text-emerald-400 font-sans">
                    {scannedStudent.full_name_my}
                  </div>
                )}

                <div className="grid grid-cols-2 gap-2 pt-2 text-xs">
                  <div className="p-2.5 rounded-xl bg-slate-900 border border-slate-800">
                    <span className="text-slate-400 block text-[10px] uppercase font-bold font-sans">အတန်းနှင့် အဆင့်</span>
                    <span className="font-bold text-white text-sm">{scannedStudent.class_name}</span>
                  </div>
                  <div className="p-2.5 rounded-xl bg-slate-900 border border-slate-800">
                    <span className="text-slate-400 block text-[10px] uppercase font-bold font-sans">ခုံအမှတ်</span>
                    <span className="font-bold text-amber-300 text-sm font-mono">{scannedStudent.roll_no}</span>
                  </div>
                </div>

                <div className="pt-2 text-[11px] font-sans text-slate-400 flex flex-wrap items-center justify-between gap-2">
                  <span>
                    ဝင်ရောက်ချိန်: <strong className="text-white font-mono">{lastSwipeTime}</strong> •{' '}
                    <span className="text-indigo-300">
                      {lastScanMethod === 'manual'
                        ? '📝 လူကိုယ်တိုင် စာရင်းသွင်းမှု'
                        : lastScanMethod === 'nfc_tap'
                        ? '📶 စမတ်ကတ် ထိကပ်မှု'
                        : '📷 QR စကင်ဖတ်မှု'}
                    </span>
                  </span>
                  <span className="text-emerald-400 font-bold">● အော့ဖ်လိုင်း မှတ်တမ်း သိမ်းဆည်းပြီး</span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* DUPLICATE ANTI-PASSBACK STATE */}
        {scanState === 'duplicate' && scannedStudent && (
          <div className="w-full max-w-2xl bg-gradient-to-br from-amber-950/80 via-slate-900 to-slate-950 border-2 border-amber-500 rounded-3xl p-8 shadow-2xl shadow-amber-500/20 animate-in zoom-in-95 duration-200">
            <div className="flex flex-col sm:flex-row items-center sm:items-start gap-6">
              <div className="p-4 rounded-2xl bg-amber-500/20 text-amber-400 border border-amber-500/40 flex-shrink-0">
                <AlertTriangle className="h-16 w-16" />
              </div>
              <div className="flex-1 space-y-2 text-center sm:text-left">
                <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-500/20 text-amber-300 border border-amber-400/30 text-xs font-bold font-sans">
                  {feedbackMessage}
                </div>
                <h3 className="text-2xl font-black text-white tracking-tight uppercase">
                  {scannedStudent.full_name}
                </h3>
                {scannedStudent.full_name_my && (
                  <div className="text-base font-bold text-amber-400 font-sans">
                    {scannedStudent.full_name_my}
                  </div>
                )}
                <p className="text-sm text-slate-300 font-sans">
                  {scannedStudent.class_name} • ခုံအမှတ်: {scannedStudent.roll_no}
                </p>
                <div className="p-3 rounded-xl bg-slate-900 border border-slate-800 text-xs text-amber-200 font-sans">
                  ဤကျောင်းသားသည် ယနေ့ နံနက် <strong className="text-white font-mono">{lastSwipeTime}</strong> တွင် ကျောင်းတက်ရောက်မှု မှတ်တမ်းတင်ပြီးဖြစ်ပါသည် (အထပ်ထပ် စာရင်းသွင်းမှု တားဆီးထားပါသည်)။
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ERROR / UNRECOGNIZED STATE */}
        {scanState === 'error' && (
          <div className="w-full max-w-2xl bg-gradient-to-br from-rose-950/80 via-slate-900 to-slate-950 border-2 border-rose-500 rounded-3xl p-8 shadow-2xl shadow-rose-500/20 animate-in zoom-in-95 duration-200 text-center space-y-4">
            <div className="inline-flex p-4 rounded-2xl bg-rose-500/20 text-rose-400 border border-rose-500/40">
              <XCircle className="h-14 w-14" />
            </div>
            <h3 className="text-2xl font-black text-rose-300 tracking-tight font-sans">
              အသိအမှတ်မပြုသော ကတ် သို့မဟုတ် QR ဖြစ်ပါသည်
            </h3>
            <p className="text-sm text-slate-300 max-w-md mx-auto font-sans">
              စကင်ဖတ်ထားသော ကတ်သည် ဤကျောင်းရှိ မှတ်ပုံတင်ထားသော ကျောင်းသား DID နှင့် ကိုက်ညီမှု မရှိပါ။
            </p>
            <div className="pt-2">
              <button
                type="button"
                onClick={handleOpenManualModal}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-bold text-white transition border border-slate-700"
              >
                <Search className="h-3.5 w-3.5 text-indigo-400" />
                <span>ကျောင်းသား စာရင်းထဲမှ အမည်ဖြင့် ရှာဖွေစစ်ဆေးမည်</span>
              </button>
            </div>
          </div>
        )}
          </>
        )}
      </main>

      {/* ---------------- 3. FOOTER STATS & SYNC CONTROLS ---------------- */}
      {isProvisioned && (
        <footer className="bg-slate-900 border-t border-slate-800 p-4 sm:p-6 space-y-4">
          {/* Sync message alert if any */}
          {syncStatusMsg && (
            <div className="max-w-4xl mx-auto p-2.5 rounded-xl bg-indigo-950/80 border border-indigo-500/40 text-xs text-indigo-200 text-center font-bold">
              {syncStatusMsg}
            </div>
          )}

          <div className="max-w-4xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
            {/* Counters */}
            <div className="flex items-center gap-6">
              <div>
                <span className="text-[10px] uppercase font-bold text-slate-400 block font-sans">ယနေ့ ဝင်ရောက်မှု စုစုပေါင်း</span>
                <span className="text-2xl font-black text-emerald-400 font-mono">{todayTotal}</span>
              </div>
              <div className="h-8 w-px bg-slate-800" />
              <div>
                <span className="text-[10px] uppercase font-bold text-slate-400 block font-sans">ဆာဗာသို့ ပေးပို့ရန် ကျန်ရှိ</span>
                <span className={`text-2xl font-black font-mono ${pendingCount > 0 ? 'text-amber-400' : 'text-slate-400'}`}>
                  {pendingCount}
                </span>
              </div>
              <div className="h-8 w-px bg-slate-800" />
              <div>
                <span className="text-[10px] uppercase font-bold text-slate-400 block font-sans">ဒေသတွင်း သိမ်းဆည်းထားသော ကျောင်းသား</span>
                <span className="text-2xl font-black text-indigo-400 font-mono">{allStudents.length}</span>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex flex-wrap items-center gap-2">
              {/* Manual Roll Entry Modal Trigger */}
              <button
                type="button"
                onClick={handleOpenManualModal}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-indigo-600/90 hover:bg-indigo-600 text-xs font-bold text-white border border-indigo-500 shadow-md shadow-indigo-600/20 transition"
                title="ကတ်မပါလာသော ကျောင်းသားများအား အမည် သို့မဟုတ် ခုံအမှတ်ဖြင့် ရှာဖွေစစ်ဆေးရန်"
              >
                <Search className="h-3.5 w-3.5 text-amber-300" />
                <span>ကတ်မပါ/လူကိုယ်တိုင် စစ်ဆေးရန်</span>
              </button>

              {/* Sync Now Button */}
              <button
                type="button"
                onClick={triggerAutoSync}
                disabled={isSyncing || !isOnline}
                className={`inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold shadow transition ${
                  isOnline
                    ? 'bg-slate-800 hover:bg-slate-700 text-white border border-slate-700'
                    : 'bg-slate-800 text-slate-500 cursor-not-allowed border border-slate-700'
                }`}
              >
                <RefreshCw className={`h-3.5 w-3.5 ${isSyncing ? 'animate-spin' : ''}`} />
                <span>{isSyncing ? 'ပေးပို့နေသည်...' : 'ဆာဗာသို့ ပေးပို့ရန်'}</span>
              </button>

              {/* Export Offline USB Backup (.edupack) */}
              <button
                type="button"
                onClick={handleExportBackup}
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-bold text-slate-300 border border-slate-700 transition"
                title="အင်တာနက်မရှိချိန် USB ဖြင့် စာရင်းသိမ်းဆည်း ထုတ်ယူရန်"
              >
                <Download className="h-3.5 w-3.5 text-amber-400" />
                <span>USB ထုတ်ယူရန်</span>
              </button>

              {/* Import Offline USB Backup */}
              <label className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-bold text-slate-300 border border-slate-700 cursor-pointer transition">
                <Upload className="h-3.5 w-3.5 text-indigo-400" />
                <span>USB ထည့်သွင်းရန်</span>
                <input type="file" accept=".edupack,.json" onChange={handleImportBackup} className="hidden" />
              </label>

              {/* Reset / Unpair Button */}
              <button
                type="button"
                onClick={() => setShowResetConfirmModal(true)}
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-amber-400 text-xs font-bold border border-slate-700 transition"
                title="စက်ချိတ်ဆက်မှုကို ဖြုတ်၍ Setup QR အသစ်ဖြင့် ပြန်လည်ချိတ်ဆက်ရန်"
              >
                <Settings className="h-3.5 w-3.5" />
                <span>စက်ချိတ်ဆက်မှု ပြင်ရန်</span>
              </button>
            </div>
          </div>

          {/* Quick Demo Simulator Ticker */}
          <div className="max-w-4xl mx-auto pt-2 border-t border-slate-800/80 flex flex-wrap items-center justify-between gap-2 text-[11px] text-slate-500 font-mono">
            <span className="font-sans">ဟာ့ဒ်ဝဲ စကင်နာ ချိတ်ဆက်ထားသည် • Honeywell / Zebra / Newland Plug & Play</span>
            <div className="flex items-center gap-2">
              <span className="font-sans">နမူနာ စမ်းသပ်မှု:</span>
              {DEFAULT_OFFLINE_STUDENTS.slice(0, 3).map((s) => (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => processScannedPayload(s.did, 'nfc_tap')}
                  className="px-2.5 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 transition font-sans text-[11px]"
                >
                  {s.full_name_my || s.full_name.split(' ')[0]}
                </button>
              ))}
            </div>
          </div>
        </footer>
      )}

      {/* ---------------- RESET / UNPAIR CONFIRMATION MODAL ---------------- */}
      {showResetConfirmModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-3xl max-w-md w-full p-6 shadow-2xl space-y-5 animate-in fade-in zoom-in-95 duration-200">
            <div className="flex items-center gap-3">
              <div className="p-3 rounded-2xl bg-rose-500/20 border border-rose-500/30 text-rose-400">
                <AlertTriangle className="h-6 w-6" />
              </div>
              <div>
                <h3 className="text-base font-bold text-white font-sans">
                  စက်ချိတ်ဆက်မှု ပြန်လည်သတ်မှတ်ရန် (Reset Pairing)
                </h3>
                <p className="text-xs text-slate-400 font-sans">
                  လက်ရှိ ကျောင်းချိတ်ဆက်မှုကို ဖြုတ်သိမ်းပါမည်
                </p>
              </div>
            </div>

            <p className="text-xs text-slate-300 font-sans leading-relaxed bg-slate-950 p-4 rounded-xl border border-slate-800">
              ဤကွန်ပျူတာ၏ ကျောင်းချိတ်ဆက်မှု (<span className="text-amber-300 font-bold">{provisioningConfig?.school_name_my || provisioningConfig?.school_name}</span>) ကို ဖြုတ်သိမ်းပြီး Setup QR အသစ်ဖြင့် ပြန်လည်စတင်လိုပါသလား?
              <br /><br />
              <span className="text-rose-400 font-semibold">သတိပေးချက်:</span> ဆာဗာသို့ မပေးပို့ရသေးသော ဒေသတွင်း တက်ရောက်မှုမှတ်တမ်းများ ရှိပါက ဆာဗာသို့ အရင်ဆုံး ပေးပို့ထားရန် အကြံပြုပါသည်။
            </p>

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setShowResetConfirmModal(false)}
                className="px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold font-sans transition"
              >
                မလုပ်ဆောင်ပါ
              </button>
              <button
                type="button"
                onClick={handleResetKioskPairing}
                className="px-4 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold font-sans shadow-lg shadow-rose-600/30 transition flex items-center gap-1.5"
              >
                <RotateCcw className="h-4 w-4" />
                <span>ပြန်လည်သတ်မှတ်မည်</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ---------------- 4. INTERACTIVE MANUAL ROLL CALL MODAL WITH AUTOCOMPLETE ---------------- */}
      {showManualModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/85 backdrop-blur-md flex items-center justify-center p-3 sm:p-6 animate-in fade-in duration-200">
          <div className="bg-slate-900 border border-slate-700/80 rounded-3xl max-w-2xl w-full p-5 sm:p-6 space-y-4 shadow-2xl flex flex-col max-h-[90vh] overflow-hidden">
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-2xl bg-indigo-600/20 text-indigo-400 border border-indigo-500/30">
                  <UserCheck className="h-6 w-6" />
                </div>
                <div>
                  <h3 className="text-base sm:text-lg font-bold text-white tracking-tight font-sans">
                    ကတ်မပါသော ကျောင်းသားအား ရှာဖွေစစ်ဆေးခြင်း (Manual Roll Call)
                  </h3>
                  <p className="text-xs text-slate-400 font-sans">
                    ကျောင်းသား ကတ်မပါလာပါက အမည် သို့မဟုတ် ခုံအမှတ်ဖြင့် စစ်ဆေးအတည်ပြုပြီး အဝင်ခွင့်ပြုပါ
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  setShowManualModal(false);
                  setSelectedStudentForManual(null);
                }}
                className="p-1.5 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {selectedStudentForManual ? (
              /* Selected Student Verification Confirmation Card */
              <div className="space-y-4 py-1">
                <div className="p-4 rounded-2xl bg-gradient-to-br from-indigo-950/60 to-slate-900 border-2 border-indigo-500/50 flex flex-col sm:flex-row items-center sm:items-start gap-4">
                  {/* Student Photo */}
                  <div className="w-20 h-24 rounded-xl bg-slate-800 border border-slate-700 flex items-center justify-center flex-shrink-0 overflow-hidden shadow-lg">
                    {selectedStudentForManual.photo_url ? (
                      <img
                        src={selectedStudentForManual.photo_url}
                        alt={selectedStudentForManual.full_name}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full bg-gradient-to-b from-indigo-900 to-slate-950 flex flex-col items-center justify-center p-1 text-center">
                        <div className="w-7 h-7 rounded-full bg-amber-400/90 border border-amber-200 mb-1" />
                        <div className="w-10 h-5 rounded-t-lg bg-emerald-600" />
                      </div>
                    )}
                  </div>

                  {/* Student Details */}
                  <div className="flex-1 space-y-1 text-center sm:text-left">
                    <div className="text-base font-black text-white font-sans">
                      {selectedStudentForManual.full_name_my || selectedStudentForManual.full_name}
                    </div>
                    <div className="text-xs text-indigo-300 font-bold uppercase tracking-wider font-mono">
                      {selectedStudentForManual.full_name}
                    </div>

                    <div className="grid grid-cols-2 gap-2 pt-2 text-xs font-sans">
                      <div className="p-2 rounded-xl bg-slate-950 border border-slate-800">
                        <span className="text-[10px] text-slate-400 block font-bold">အတန်းနှင့် အဆင့်</span>
                        <span className="font-bold text-white text-xs">{selectedStudentForManual.class_name}</span>
                      </div>
                      <div className="p-2 rounded-xl bg-slate-950 border border-slate-800">
                        <span className="text-[10px] text-slate-400 block font-bold">ခုံအမှတ်</span>
                        <span className="font-bold text-amber-300 text-xs font-mono">{selectedStudentForManual.roll_no}</span>
                      </div>
                    </div>

                    <div className="text-[10px] text-slate-400 font-mono truncate pt-1">
                      DID: {selectedStudentForManual.did}
                    </div>
                  </div>
                </div>

                {/* Status Notice */}
                {todayAttendanceMap.get(selectedStudentForManual.id) ? (
                  <div className="p-3 rounded-xl bg-amber-500/20 border border-amber-500/40 text-amber-200 text-xs flex items-center gap-2 font-sans font-medium">
                    <AlertTriangle className="h-4 w-4 text-amber-400 flex-shrink-0" />
                    <span>
                      သတိပေးချက်: ဤကျောင်းသားသည် ယနေ့ နံနက် (
                      <strong className="text-white font-mono">
                        {todayAttendanceMap.get(selectedStudentForManual.id)?.time_display}
                      </strong>
                      ) တွင် ကျောင်းတက်ရောက်မှု မှတ်တမ်းတင်ပြီး ဖြစ်ပါသည် (Duplicate Check)။
                    </span>
                  </div>
                ) : (
                  <div className="p-3 rounded-xl bg-emerald-500/20 border border-emerald-500/40 text-emerald-200 text-xs flex items-center gap-2 font-sans font-medium">
                    <CheckCircle2 className="h-4 w-4 text-emerald-400 flex-shrink-0" />
                    <span>
                      ဤကျောင်းသားအား စစ်ဆေးအတည်ပြုပြီး ကျောင်းဝင်ပေါက် ဖြတ်သန်းခွင့် ပြုပါမည်။
                    </span>
                  </div>
                )}

                {/* Modal Actions */}
                <div className="flex items-center justify-between pt-2">
                  <button
                    type="button"
                    onClick={() => setSelectedStudentForManual(null)}
                    className="px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold transition flex items-center gap-1.5 font-sans"
                  >
                    <ArrowLeft className="h-3.5 w-3.5" />
                    <span>အခြားကျောင်းသား ရှာရန်</span>
                  </button>

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        setShowManualModal(false);
                        setSelectedStudentForManual(null);
                      }}
                      className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold transition font-sans"
                    >
                      မလုပ်ဆောင်ပါ
                    </button>

                    <button
                      type="button"
                      onClick={handleConfirmManualAttendance}
                      className="px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-black shadow-lg shadow-emerald-600/30 transition flex items-center gap-1.5 font-sans"
                    >
                      <Check className="h-4 w-4 stroke-[3]" />
                      <span>ကျောင်းအဝင် ခွင့်ပြုပြီး စာရင်းသွင်းမည်</span>
                    </button>
                  </div>
                </div>
              </div>
            ) : (
              /* Autocomplete Search Input & Results List */
              <div className="flex-1 flex flex-col min-h-0 space-y-3">
                {/* Search Input */}
                <div className="relative">
                  <Search className="h-4 w-4 text-slate-400 absolute left-3.5 top-3" />
                  <input
                    id="manual-entry-input"
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="ကျောင်းသား အမည် သို့မဟုတ် ခုံအမှတ် ရိုက်ထည့်ပါ (ဥပမာ - မောင်အောင်ကျော်၊ ၅-က-၁၂)..."
                    className="w-full pl-10 pr-10 py-2.5 rounded-xl bg-slate-950 border border-slate-700 text-white placeholder-slate-500 text-xs focus:ring-2 focus:ring-indigo-500 focus:outline-none font-sans"
                    autoFocus
                  />
                  {searchQuery && (
                    <button
                      type="button"
                      onClick={() => setSearchQuery('')}
                      className="absolute right-3 top-2.5 text-slate-400 hover:text-white"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  )}
                </div>

                {/* Grade Level Filter Quick Chips */}
                <div className="flex items-center gap-1.5 overflow-x-auto py-1 scrollbar-none text-xs">
                  <button
                    type="button"
                    onClick={() => setSelectedGradeFilter('ALL')}
                    className={`px-2.5 py-1 rounded-lg font-bold text-[11px] font-sans transition ${
                      selectedGradeFilter === 'ALL'
                        ? 'bg-indigo-600 text-white'
                        : 'bg-slate-800 text-slate-400 hover:bg-slate-700 hover:text-white'
                    }`}
                  >
                    အတန်းအားလုံး ({allStudents.length})
                  </button>
                  {distinctGradeLevels.map((grade) => {
                    const count = allStudents.filter(
                      (s) => (s.grade_level || '').includes(grade) || (s.class_name || '').includes(grade)
                    ).length;
                    return (
                      <button
                        key={grade}
                        type="button"
                        onClick={() => setSelectedGradeFilter(grade)}
                        className={`px-2.5 py-1 rounded-lg font-bold text-[11px] font-sans whitespace-nowrap transition ${
                          selectedGradeFilter === grade
                            ? 'bg-indigo-600 text-white'
                            : 'bg-slate-800 text-slate-400 hover:bg-slate-700 hover:text-white'
                        }`}
                      >
                        {grade} ({count})
                      </button>
                    );
                  })}
                </div>

                {/* Counter & Instruction */}
                <div className="flex items-center justify-between text-[11px] text-slate-400 px-1 font-sans">
                  <span>တွေ့ရှိသော ကျောင်းသား ({filteredManualStudents.length} ဦး)</span>
                  <span>အမည် သို့မဟုတ် ခုံအမှတ်ကို နှိပ်၍ အတည်ပြုပါ</span>
                </div>

                {/* Autocomplete Student Results List */}
                <div className="flex-1 overflow-y-auto space-y-2 pr-1 scrollbar-thin max-h-72">
                  {filteredManualStudents.length === 0 ? (
                    <div className="py-8 text-center text-slate-500 space-y-1 font-sans">
                      <Users className="h-8 w-8 mx-auto text-slate-600" />
                      <p className="text-xs">ရှာဖွေမှုနှင့် ကိုက်ညီသော ကျောင်းသား မတွေ့ရှိပါ</p>
                    </div>
                  ) : (
                    filteredManualStudents.map((st) => {
                      const attended = todayAttendanceMap.get(st.id);
                      return (
                        <div
                          key={st.id}
                          onClick={() => handleSelectStudentForManual(st)}
                          className="p-3 rounded-2xl bg-slate-950/70 border border-slate-800 hover:border-indigo-500 hover:bg-indigo-950/30 cursor-pointer transition flex items-center justify-between gap-3 group"
                        >
                          <div className="flex items-center gap-3 min-w-0">
                            {/* Avatar */}
                            <div className="w-10 h-10 rounded-xl bg-slate-800 border border-slate-700 flex items-center justify-center flex-shrink-0 text-amber-400 font-bold text-xs group-hover:border-indigo-400 transition">
                              {st.photo_url ? (
                                <img
                                  src={st.photo_url}
                                  alt={st.full_name}
                                  className="w-full h-full object-cover rounded-xl"
                                />
                              ) : (
                                st.full_name.charAt(0)
                              )}
                            </div>
                            <div className="min-w-0">
                              <div className="flex items-center gap-2">
                                <span className="font-bold text-white text-xs truncate group-hover:text-indigo-300 transition font-sans">
                                  {st.full_name_my || st.full_name}
                                </span>
                                {st.full_name_my && st.full_name && (
                                  <span className="text-[10px] text-slate-400 font-mono truncate hidden sm:inline">
                                    ({st.full_name})
                                  </span>
                                )}
                              </div>
                              <div className="flex items-center gap-2 text-[11px] text-slate-400 mt-0.5 font-sans">
                                <span className="text-indigo-400 font-semibold">{st.class_name}</span>
                                <span>•</span>
                                <span className="text-amber-300 font-mono">ခုံအမှတ်: {st.roll_no}</span>
                              </div>
                            </div>
                          </div>

                          {/* Today's Attendance Status Pill */}
                          <div className="flex items-center gap-2 flex-shrink-0">
                            {attended ? (
                              <span className="text-[10px] font-bold px-2.5 py-1 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/30 font-sans flex items-center gap-1">
                                <Check className="h-3 w-3 stroke-[3]" />
                                <span>ယနေ့ {attended.time_display} တွင် ဝင်ပြီး</span>
                              </span>
                            ) : (
                              <span className="text-[10px] font-bold px-2.5 py-1 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 font-sans flex items-center gap-1">
                                <span>● မရောက်သေးပါ</span>
                              </span>
                            )}
                            <ChevronRight className="h-4 w-4 text-slate-600 group-hover:text-indigo-400 group-hover:translate-x-0.5 transition" />
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>

                {/* Footer Cancel Button */}
                <div className="flex justify-end pt-2 border-t border-slate-800">
                  <button
                    type="button"
                    onClick={() => {
                      setShowManualModal(false);
                      setSelectedStudentForManual(null);
                    }}
                    className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold font-sans transition"
                  >
                    ပိတ်မည်
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
