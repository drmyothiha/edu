import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useParams, Link, useLocation } from 'react-router-dom';
import { api } from '../api/client';
import { ClassDTO, StudentDTO, AttendanceStatus, SchoolDTO } from '../types';
import { useAuth } from '../context/AuthContext';
import {
  getCachedClassroom,
  saveClassroomToCache,
  getCachedRoster,
  saveRosterToCache,
} from '../services/classroomOfflineStorage';
import {
  ArrowLeft,
  Users,
  CheckCircle2,
  XCircle,
  Clock,
  Printer,
  RefreshCw,
  Search,
  Calendar,
  FileSpreadsheet,
  BookOpen,
  X,
  RotateCcw,
  Check,
  User,
  LayoutGrid,
  Palette,
  ArrowRightLeft,
  Sliders,
  Settings,
  SlidersHorizontal,
  ChevronRight,
  Layers,
  Sparkles,
  Plus,
  Minus,
} from 'lucide-react';
import { KGCornersFloorPlan } from '../components/KGCornersFloorPlan';
import { MOEGuideModal } from '../components/MOEGuideModal';

export type FurnitureType = 'individual' | 'long_bench';

export interface ClassroomLayoutConfig {
  furnitureType: FurnitureType; // 'individual' (တစ်ယောက်ထိုင်) | 'long_bench' (မြန်မာ့ရိုးရာ တန်းလျားခုံရှည်)
  rows: number; // 2 to 12 rows
  columnGroups: number; // 1 (Single file), 2 (Double file), 3 (Triple file), 4 (Quad file)
  seatsPerGroup: number; // Individual: 1-4 desks per group; Long Bench: 3-5 students per bench
}

// Default layout matching the user's uploaded floor plan blueprint (6 rows x 2 wings x 3 cols = 36 seats)
const DEFAULT_LAYOUT: ClassroomLayoutConfig = {
  furnitureType: 'individual',
  rows: 6,
  columnGroups: 2,
  seatsPerGroup: 3,
};

// Preset templates for quick 1-click configuration
interface LayoutPreset {
  id: string;
  name: string;
  nameEn: string;
  description: string;
  badge: string;
  config: ClassroomLayoutConfig;
}

const LAYOUT_PRESETS: LayoutPreset[] = [
  {
    id: 'kg_child_centered',
    name: 'သူငယ်တန်း ကလေးဗဟိုပြု စားပွဲဝိုင်းပုံစံ (KG Activity Tables)',
    nameEn: 'KG Child-Centered Activity Tables (5 Groups × 6 Children)',
    description: 'အဖွဲ့လိုက် စားပွဲဝိုင်း (၅) ဝိုင်း × ၆ ယောက်ထိုင် = ၃၀ ခုံ (MOE Kindergarten Standard)',
    badge: '30 Seats • 5 Tables',
    config: {
      furnitureType: 'individual',
      rows: 5,
      columnGroups: 2,
      seatsPerGroup: 3,
    },
  },
  {
    id: 'blueprint_default',
    name: 'မူရင်း Blueprint ပုံစံ (တစ်ယောက်ထိုင် ၂ တန်း)',
    nameEn: 'Floor Plan Blueprint (6x6 Individual Desks)',
    description: '၆ တန်း × ၂ အုပ်စု × ၃ ခုံ = ၃၆ ခုံ (User Blueprint)',
    badge: '36 Seats • 6×6',
    config: {
      furnitureType: 'individual',
      rows: 6,
      columnGroups: 2,
      seatsPerGroup: 3,
    },
  },
  {
    id: 'myanmar_bench_2file_4seat',
    name: 'မြန်မာ့ရိုးရာ တန်းလျားခုံရှည် (၂ တန်း - ၄ ယောက်ထိုင်)',
    nameEn: 'Myanmar Standard 4-Seat Long Benches (Double File)',
    description: '၆ တန်း × ၂ အုပ်စု × ၄ ယောက်ထိုင် = ၄၈ ခုံ (BEHS Standard)',
    badge: '48 Seats • 2 Files',
    config: {
      furnitureType: 'long_bench',
      rows: 6,
      columnGroups: 2,
      seatsPerGroup: 4,
    },
  },
  {
    id: 'myanmar_bench_2file_5seat',
    name: 'မြန်မာ့ရိုးရာ တန်းလျားခုံရှည် (၂ တန်း - ၅ ယောက်ထိုင်)',
    nameEn: 'Myanmar 5-Seat Long Benches (High Density)',
    description: '၆ တန်း × ၂ အုပ်စု × ၅ ယောက်ထိုင် = ၆၀ ခုံ (High Density)',
    badge: '60 Seats • 2 Files',
    config: {
      furnitureType: 'long_bench',
      rows: 6,
      columnGroups: 2,
      seatsPerGroup: 5,
    },
  },
  {
    id: 'myanmar_bench_3file_4seat',
    name: 'မြန်မာ့ရိုးရာ စာသင်ခုံရှည် (၃ တန်းလျား - ဘယ်/လယ်/ညာ)',
    nameEn: 'Triple File Long Benches (Left, Center, Right)',
    description: '၅ တန်း × ၃ အုပ်စု × ၄ ယောက်ထိုင် = ၆၀ ခုံ (2 Aisles)',
    badge: '60 Seats • 3 Files',
    config: {
      furnitureType: 'long_bench',
      rows: 5,
      columnGroups: 3,
      seatsPerGroup: 4,
    },
  },
  {
    id: 'myanmar_bench_single_file',
    name: 'တန်းလျားခုံရှည် ၁ တန်းတည်း (Single File Bench)',
    nameEn: 'Single Bank Long Benches (Small Classroom)',
    description: '၆ တန်း × ၁ အုပ်စု × ၅ ယောက်ထိုင် = ၃၀ ခုံ',
    badge: '30 Seats • 1 File',
    config: {
      furnitureType: 'long_bench',
      rows: 6,
      columnGroups: 1,
      seatsPerGroup: 5,
    },
  },
  {
    id: 'single_file_exam',
    name: 'စာမေးပွဲ ၁ ယောက်ထိုင် ခုံခွဲ (Single File Exam)',
    nameEn: 'Isolated Single Desks (Exam Hall)',
    description: '၇ တန်း × ၄ အုပ်စု × ၁ ခုံ = ၂၈ ခုံ (Exam Hall)',
    badge: '28 Seats • 4 Files',
    config: {
      furnitureType: 'individual',
      rows: 7,
      columnGroups: 4,
      seatsPerGroup: 1,
    },
  },
];

// Exact blueprint teal desk indices for the 6x6 individual desk layout
const BLUEPRINT_TEAL_INDICES = new Set([
  1, 3, 5,
  8, 9, 11,
  13, 14, 16,
  19, 22, 23,
  24, 25, 27, 28,
  30, 31, 33, 34, 35,
]);

type ColorMode = 'blueprint' | 'attendance' | 'gender';

interface SeatedStudent {
  seatIndex: number;
  rowIdx: number;
  groupIdx: number;
  seatInGroupIdx: number;
  student: StudentDTO | null;
  attendanceStatus: AttendanceStatus;
  gender: 'boy' | 'girl';
}

export const ClassRoomDetailPage: React.FC = () => {
  const { id: classParam } = useParams<{ id: string }>();
  const location = useLocation();
  const { user } = useAuth();

  const [classInfo, setClassInfo] = useState<ClassDTO | null>(null);
  const [schoolInfo, setSchoolInfo] = useState<SchoolDTO | null>(null);
  const [students, setStudents] = useState<StudentDTO[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Layout configuration state
  const [layout, setLayout] = useState<ClassroomLayoutConfig>(DEFAULT_LAYOUT);
  const [layoutModalOpen, setLayoutModalOpen] = useState(false);
  const [tempLayout, setTempLayout] = useState<ClassroomLayoutConfig>(DEFAULT_LAYOUT);

  // Selected date for attendance
  const [selectedDate, setSelectedDate] = useState<string>(() => {
    return new Date().toISOString().split('T')[0];
  });

  // Color mode: blueprint, attendance, or gender
  const [colorMode, setColorMode] = useState<ColorMode>('blueprint');

  // Search filter
  const [searchQuery, setSearchQuery] = useState('');

  // Selected seat for detail modal
  const [selectedSeatIndex, setSelectedSeatIndex] = useState<number | null>(null);

  // Seat swap mode state
  const [swapSourceIndex, setSwapSourceIndex] = useState<number | null>(null);

  // Seating assignments: array of student IDs or null
  const [seatAssignments, setSeatAssignments] = useState<(string | null)[]>([]);

  // Attendance status map: student_id -> status
  const [attendanceMap, setAttendanceMap] = useState<Record<string, AttendanceStatus>>({});
  const [savingAttendance, setSavingAttendance] = useState(false);

  // Base path for navigation tabs (school-admin vs admin vs teacher)
  const basePath = useMemo(() => {
    if (location.pathname.startsWith('/school-admin')) return '/school-admin';
    if (location.pathname.startsWith('/admin')) return '/admin';
    return '/teacher';
  }, [location.pathname]);

  const classSlug = classInfo?.code || classParam || 'KGA';

  // Calculate total capacity
  const totalCapacity = useMemo(() => {
    return layout.rows * layout.columnGroups * layout.seatsPerGroup;
  }, [layout]);

  // Detect Kindergarten class
  const isKG = useMemo(() => {
    const code = (classInfo?.code || classParam || '').toUpperCase();
    const name = (classInfo?.name || '').toUpperCase();
    const grade = (classInfo?.grade_level || '').toUpperCase();
    return (
      grade === 'KG' ||
      code.startsWith('KG') ||
      name.startsWith('KG') ||
      code === 'KGA' ||
      code === 'KGB' ||
      classParam?.toUpperCase().startsWith('KG')
    );
  }, [classInfo, classSlug, classParam]);

  const [kgViewMode, setKgViewMode] = useState<'corners' | 'seating'>('corners');
  const [moeGuideOpen, setMoeGuideOpen] = useState(false);

  // Helper to determine gender from Myanmar name
  const getStudentGender = (name: string): 'boy' | 'girl' => {
    const trimmed = name.trim();
    if (
      trimmed.startsWith('မောင်') ||
      trimmed.startsWith('Mg') ||
      trimmed.startsWith('Maung') ||
      trimmed.startsWith('U ') ||
      trimmed.startsWith('Ko ')
    ) {
      return 'boy';
    }
    return 'girl';
  };

  // Load classroom data, saved layout, and students offline-first with delayed server check
  const loadClassroomData = async () => {
    if (!classParam) return;
    setError(null);

    let hadCache = false;

    // Step 1: Immediate 0ms load from IndexedDB
    try {
      const cached = await getCachedClassroom(classParam);
      if (cached) {
        hadCache = true;
        if (cached.classInfo) setClassInfo(cached.classInfo);
        if (cached.schoolInfo) setSchoolInfo(cached.schoolInfo);
        if (cached.layout) {
          setLayout(cached.layout);
          setTempLayout(cached.layout);
        }
        if (cached.seatAssignments && cached.seatAssignments.length > 0) {
          setSeatAssignments(cached.seatAssignments);
        }
        const cachedRoster = await getCachedRoster(cached.id);
        if (cachedRoster && cachedRoster.length > 0) {
          setStudents(cachedRoster);
        }
        setLoading(false); // Instant render without waiting for network
      }
    } catch (e) {
      console.warn('[SeatingPlan] IndexedDB offline read fallback:', e);
    }

    if (!hadCache) {
      setLoading(true);
    }

    // Step 2: Delayed server check (1.2s delay if cached, immediate if no cache)
    const runServerCheck = async () => {
      try {
        // 1. Resolve & fetch Class info
        const cls = await api.classes.get(classParam);
        setClassInfo(cls);

        // 2. Fetch School info if available
        let school: SchoolDTO | null = null;
        if (cls.school_id) {
          try {
            school = await api.schools.get(cls.school_id);
            setSchoolInfo(school);
          } catch (_) {}
        }

        // 3. Load saved layout configuration if exists
        const layoutStorageKey = `edu_classroom_layout_${cls.id}`;
        const savedLayout = localStorage.getItem(layoutStorageKey);
        let currentLayout = DEFAULT_LAYOUT;
        if (savedLayout) {
          try {
            const parsed = JSON.parse(savedLayout);
            if (parsed && parsed.rows && parsed.columnGroups && parsed.seatsPerGroup) {
              currentLayout = parsed;
            }
          } catch {
            // ignore corrupted layout
          }
        }
        setLayout(currentLayout);
        setTempLayout(currentLayout);

        const capacity = currentLayout.rows * currentLayout.columnGroups * currentLayout.seatsPerGroup;

        // 4. Fetch Enrolled Students
        const studentList = await api.classes.getStudents(cls.id);
        setStudents(studentList);
        await saveRosterToCache(cls.id, studentList);

        // 5. Fetch Attendance Roster for selected date
        try {
          const attRoster = await api.classes.getAttendanceRoster(cls.id, selectedDate);
          const map: Record<string, AttendanceStatus> = {};
          attRoster.roster.forEach((item) => {
            map[item.student_id] = item.status === 'unrecorded' ? 'present' : item.status;
          });
          setAttendanceMap(map);
        } catch (attErr) {
          console.warn('Attendance roster load warning:', attErr);
        }

        // 6. Initialize or restore seating assignments from localStorage
        const seatingStorageKey = `edu_seating_plan_${cls.id}`;
        const savedPlan = localStorage.getItem(seatingStorageKey);
        let initialAssignments: (string | null)[] = Array(capacity).fill(null);

        if (savedPlan) {
          try {
            const parsed = JSON.parse(savedPlan);
            if (Array.isArray(parsed)) {
              const validIds = new Set(studentList.map((s) => s.id));
              for (let i = 0; i < capacity; i++) {
                if (parsed[i] && validIds.has(parsed[i])) {
                  initialAssignments[i] = parsed[i];
                }
              }
            }
          } catch {
            // ignore corrupted plan
          }
        }

        // Fill in any students who aren't seated yet
        const assignedIds = new Set(initialAssignments.filter(Boolean));
        const unassignedStudents = studentList.filter((s) => !assignedIds.has(s.id));

        let unassignedIdx = 0;
        for (let i = 0; i < capacity; i++) {
          if (!initialAssignments[i] && unassignedIdx < unassignedStudents.length) {
            initialAssignments[i] = unassignedStudents[unassignedIdx].id;
            unassignedIdx++;
          }
        }

        setSeatAssignments(initialAssignments);

        // Persist fresh data to IndexedDB
        await saveClassroomToCache({
          id: cls.id,
          slug: cls.code || classParam,
          classInfo: cls,
          schoolInfo: school,
          layout: currentLayout,
          seatAssignments: initialAssignments,
        });
      } catch (err: any) {
        if (!hadCache) {
          setError(err.message || 'Failed to load classroom seating plan');
        }
      } finally {
        setLoading(false);
      }
    };

    if (hadCache) {
      setTimeout(runServerCheck, 1200);
    } else {
      runServerCheck();
    }
  };

  useEffect(() => {
    loadClassroomData();
  }, [classParam, selectedDate]);

  // Persist seat assignments to localStorage and IndexedDB
  const saveSeatAssignments = (newAssignments: (string | null)[]) => {
    setSeatAssignments(newAssignments);
    if (classInfo?.id) {
      localStorage.setItem(`edu_seating_plan_${classInfo.id}`, JSON.stringify(newAssignments));
      saveClassroomToCache({
        id: classInfo.id,
        classInfo,
        layout,
        seatAssignments: newAssignments,
      });
    }
  };

  // Student map for fast lookup
  const studentMap = useMemo(() => {
    const map = new Map<string, StudentDTO>();
    students.forEach((s) => map.set(s.id, s));
    return map;
  }, [students]);

  // Construct structured seated students list based on current layout
  const seats: SeatedStudent[] = useMemo(() => {
    const list: SeatedStudent[] = [];
    const { rows, columnGroups, seatsPerGroup } = layout;

    for (let r = 0; r < rows; r++) {
      for (let g = 0; g < columnGroups; g++) {
        for (let s = 0; s < seatsPerGroup; s++) {
          const seatIdx = r * (columnGroups * seatsPerGroup) + g * seatsPerGroup + s;
          const studentId = seatAssignments[seatIdx];
          const st = studentId ? studentMap.get(studentId) || null : null;

          list.push({
            seatIndex: seatIdx,
            rowIdx: r,
            groupIdx: g,
            seatInGroupIdx: s,
            student: st,
            attendanceStatus: st ? attendanceMap[st.id] || 'present' : 'unrecorded',
            gender: st ? getStudentGender(st.full_name) : 'boy',
          });
        }
      }
    }
    return list;
  }, [layout, seatAssignments, studentMap, attendanceMap]);

  // Attendance stats
  const stats = useMemo(() => {
    const occupied = seats.filter((s) => s.student !== null);
    const present = occupied.filter((s) => s.attendanceStatus === 'present').length;
    const absent = occupied.filter((s) => s.attendanceStatus === 'absent').length;
    const late = occupied.filter((s) => s.attendanceStatus === 'late').length;
    const excused = occupied.filter((s) => s.attendanceStatus === 'excused').length;
    return {
      totalCapacity,
      occupiedCount: occupied.length,
      vacantCount: totalCapacity - occupied.length,
      occupancyPct: totalCapacity > 0 ? Math.round((occupied.length / totalCapacity) * 100) : 0,
      present,
      absent,
      late,
      excused,
    };
  }, [seats, totalCapacity]);

  // Apply new layout from customizer modal
  const handleApplyLayout = (newLayout: ClassroomLayoutConfig) => {
    setLayout(newLayout);
    const newCap = newLayout.rows * newLayout.columnGroups * newLayout.seatsPerGroup;

    // Adjust seatAssignments array to new capacity while preserving enrolled students
    const newAssignments: (string | null)[] = Array(newCap).fill(null);
    const validAssigned = seatAssignments.filter(Boolean);

    // Re-place existing assignments
    validAssigned.forEach((id, idx) => {
      if (idx < newCap) {
        newAssignments[idx] = id;
      }
    });

    // Fill in any students still unassigned
    const placedSet = new Set(newAssignments.filter(Boolean));
    const remaining = students.filter((s) => !placedSet.has(s.id));
    let rIdx = 0;
    for (let i = 0; i < newCap; i++) {
      if (!newAssignments[i] && rIdx < remaining.length) {
        newAssignments[i] = remaining[rIdx].id;
        rIdx++;
      }
    }

    setSeatAssignments(newAssignments);

    if (classInfo?.id) {
      localStorage.setItem(`edu_classroom_layout_${classInfo.id}`, JSON.stringify(newLayout));
      localStorage.setItem(`edu_seating_plan_${classInfo.id}`, JSON.stringify(newAssignments));
      saveClassroomToCache({
        id: classInfo.id,
        classInfo,
        layout: newLayout,
        seatAssignments: newAssignments,
      });
    }

    setLayoutModalOpen(false);
    setSuccessMsg(
      `စာသင်ခန်း ပုံစံကို ${newLayout.rows} တန်း × ${newLayout.columnGroups} အုပ်စု (${
        newLayout.furnitureType === 'long_bench' ? 'တန်းလျားခုံရှည်' : 'တစ်ယောက်ထိုင်'
      }) သို့ အောင်မြင်စွာ ပြောင်းလဲပြီးပါပြီ။`
    );
    setTimeout(() => setSuccessMsg(null), 3500);
  };

  // Seat click: open details or execute swap
  const handleSeatClick = (seatIndex: number) => {
    if (swapSourceIndex !== null) {
      if (swapSourceIndex === seatIndex) {
        setSwapSourceIndex(null);
        return;
      }
      const newAssignments = [...seatAssignments];
      const temp = newAssignments[swapSourceIndex];
      newAssignments[swapSourceIndex] = newAssignments[seatIndex];
      newAssignments[seatIndex] = temp;
      saveSeatAssignments(newAssignments);
      setSwapSourceIndex(null);
      setSuccessMsg('ကျောင်းသား ထိုင်ခုံနေရာ အောင်မြင်စွာ ပြောင်းရွှေ့လဲလှယ်ပြီးပါပြီ။');
      setTimeout(() => setSuccessMsg(null), 3000);
      return;
    }
    setSelectedSeatIndex(seatIndex);
  };

  // Update attendance status
  const handleStatusChange = async (studentId: string, newStatus: AttendanceStatus) => {
    setAttendanceMap((prev) => ({ ...prev, [studentId]: newStatus }));
    if (!classInfo?.id) return;
    try {
      await api.classes.batchRecordAttendance(classInfo.id, {
        date: selectedDate,
        records: [{ student_id: studentId, status: newStatus }],
      });
    } catch (err: any) {
      console.error('Failed to update attendance:', err);
    }
  };

  // Mark all enrolled students Present
  const handleMarkAllPresent = async () => {
    if (!classInfo?.id || students.length === 0) return;
    setSavingAttendance(true);
    try {
      const records = students.map((s) => ({
        student_id: s.id,
        status: 'present' as AttendanceStatus,
      }));
      await api.classes.batchRecordAttendance(classInfo.id, {
        date: selectedDate,
        records,
      });
      const newMap: Record<string, AttendanceStatus> = {};
      students.forEach((s) => (newMap[s.id] = 'present'));
      setAttendanceMap(newMap);
      setSuccessMsg('ကျောင်းသားအားလုံးကို ကျောင်းတက် (Present) အဖြစ် သတ်မှတ်ပြီးပါပြီ။');
      setTimeout(() => setSuccessMsg(null), 3000);
    } catch (err: any) {
      setError(err.message || 'Failed to record batch attendance');
    } finally {
      setSavingAttendance(false);
    }
  };

  // Reset seating arrangement to alphabetical
  const handleResetAlphabetical = () => {
    const sorted = [...students].sort((a, b) => a.full_name.localeCompare(b.full_name, 'my'));
    const newAssignments: (string | null)[] = Array(totalCapacity).fill(null);
    sorted.forEach((s, idx) => {
      if (idx < totalCapacity) newAssignments[idx] = s.id;
    });
    saveSeatAssignments(newAssignments);
    setSuccessMsg('ထိုင်ခုံများကို အက္ခရာစဉ်အတိုင်း ပြန်လည်နေရာချထားပြီးပါပြီ။');
    setTimeout(() => setSuccessMsg(null), 3000);
  };

  const handlePrint = () => {
    window.print();
  };

  const selectedSeat = selectedSeatIndex !== null ? seats[selectedSeatIndex] : null;

  return (
    <div className="min-h-full bg-slate-50 text-slate-900 pb-16 print:bg-white print:pb-0">
      {/* Print Only Header */}
      <div className="hidden print:block text-center py-4 border-b border-slate-300 mb-6">
        <h1 className="text-xl font-bold text-slate-900">
          {schoolInfo?.name || 'အခြေခံပညာအထက်တန်းကျောင်း အင်းတိုင်'} ({schoolInfo?.code || 'MMR013035-BEHS01'})
        </h1>
        <h2 className="text-base font-semibold text-slate-700 mt-1">
          {classInfo?.name || 'KG - Section A'} ({classSlug}) • Classroom Seating Chart (စာသင်ခန်း ထိုင်ခုံနေရာပြ ပုံစံ)
        </h2>
        <p className="text-xs text-slate-500 mt-0.5 font-mono">
          ပုံစံ: {layout.rows} တန်း × {layout.columnGroups} အုပ်စု (
          {layout.furnitureType === 'long_bench' ? 'တန်းလျားခုံရှည်' : 'တစ်ယောက်ထိုင်'} - {layout.seatsPerGroup}{' '}
          ယောက်ထိုင်) | ရက်စွဲ: {selectedDate} | ကျောင်းသားဦးရေ: {stats.occupiedCount} / {stats.totalCapacity}
        </p>
      </div>

      {/* Main Container */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-6 space-y-6 print:p-0 print:max-w-none">
        {/* Kindergarten Mode Switcher */}
        {isKG && (
          <div className="bg-white p-2.5 rounded-2xl border border-slate-200 shadow-xs flex items-center justify-between gap-3 flex-wrap print:hidden">
            <div className="flex items-center gap-2">
              <button
                onClick={() => setKgViewMode('corners')}
                className={`px-4 py-2 rounded-xl text-xs font-bold transition flex items-center gap-2 ${
                  kgViewMode === 'corners'
                    ? 'bg-emerald-700 text-white shadow-xs'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                }`}
              >
                <Sparkles className="h-4 w-4" />
                <span>သင်ယူဖွံ့ဖြိုးမှုနယ်ပယ် ထောင့် (၆) ခု ဖွဲ့စည်းပုံ (6 Learning Corners)</span>
              </button>

              <button
                onClick={() => setKgViewMode('seating')}
                className={`px-4 py-2 rounded-xl text-xs font-bold transition flex items-center gap-2 ${
                  kgViewMode === 'seating'
                    ? 'bg-emerald-700 text-white shadow-xs'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                }`}
              >
                <LayoutGrid className="h-4 w-4" />
                <span>စားပွဲဝိုင်း / ထိုင်ခုံနေရာချထားမှု (Activity Tables & Seating)</span>
              </button>
            </div>

            <div className="flex items-center gap-2 pr-2">
              <span className="text-[11px] font-semibold text-emerald-800 bg-emerald-50 border border-emerald-200 px-2.5 py-1 rounded-full">
                MOE ကလေးဗဟိုပြု စာသင်ခန်း
              </span>
            </div>
          </div>
        )}

        {isKG && kgViewMode === 'corners' ? (
          <KGCornersFloorPlan
            classInfo={classInfo}
            schoolInfo={schoolInfo}
            students={students}
            classSlug={classSlug}
            onOpenMOEGuide={() => setMoeGuideOpen(true)}
          />
        ) : (
          <>
            {/* Seating Plan Action Bar */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 bg-white p-3.5 rounded-xl border border-slate-200 shadow-2xs print:hidden">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-bold text-slate-800 text-sm flex items-center gap-1.5">
                  <LayoutGrid className="h-4 w-4 text-teal-600" />
                  <span>စာသင်ခန်း ထိုင်ခုံဇယား (Seating Layout)</span>
                </span>
            <span className="text-slate-300">•</span>
            <span className="text-xs font-medium text-slate-600">
              {layout.rows} တန်း × {layout.columnGroups} အုပ်စု (
              {layout.furnitureType === 'long_bench' ? 'တန်းလျားခုံရှည်' : 'တစ်ယောက်ထိုင်'} - {layout.seatsPerGroup}{' '}
              ယောက်ထိုင်)
            </span>
            <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-teal-50 text-teal-700 border border-teal-200">
              {stats.occupiedCount} / {stats.totalCapacity} ခုံပြည့်
            </span>
          </div>

          {/* Quick Actions */}
          <div className="flex items-center gap-2 flex-wrap">
            {/* Customize Layout Button */}
            <button
              onClick={() => {
                setTempLayout(layout);
                setLayoutModalOpen(true);
              }}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-indigo-200 bg-indigo-50 hover:bg-indigo-100 text-xs font-bold text-indigo-900 shadow-2xs transition"
              title="စာသင်ခန်း ထိုင်ခုံပုံစံ (Rows, Columns, ခုံရှည်) ပြင်ဆင်ရန်"
            >
              <SlidersHorizontal className="h-3.5 w-3.5 text-indigo-700" />
              <span>ခုံနေရာ ဖွဲ့စည်းပုံ (Customize Layout)</span>
            </button>

            <button
              onClick={handlePrint}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-xs font-semibold text-slate-700 shadow-2xs transition"
              title="A4 Seating Chart ထုတ်ယူရန်"
            >
              <Printer className="h-3.5 w-3.5 text-slate-500" /> Print Chart (A4)
            </button>

            <button
              onClick={loadClassroomData}
              disabled={loading}
              className="p-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-600 shadow-2xs transition"
              title="Refresh"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>

        {/* Alerts */}
        {error && (
          <div className="p-3 bg-rose-50 border border-rose-200 text-rose-800 text-xs rounded-lg flex items-center justify-between print:hidden">
            <span>{error}</span>
            <button onClick={() => setError(null)}><X className="h-4 w-4" /></button>
          </div>
        )}
        {successMsg && (
          <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs rounded-lg flex items-center justify-between print:hidden">
            <span className="flex items-center gap-2"><Check className="h-4 w-4" /> {successMsg}</span>
            <button onClick={() => setSuccessMsg(null)}><X className="h-4 w-4" /></button>
          </div>
        )}

        {/* Toolbar & Filter Controls */}
        <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-xs space-y-4 print:hidden">
          <div className="flex flex-wrap items-center justify-between gap-4">
            {/* View Mode Switcher */}
            <div className="flex items-center gap-1.5 p-1 bg-slate-100 rounded-lg border border-slate-200">
              <button
                onClick={() => setColorMode('blueprint')}
                className={`px-3 py-1.5 rounded-md text-xs font-semibold flex items-center gap-1.5 transition ${
                  colorMode === 'blueprint'
                    ? 'bg-teal-700 text-white shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <Palette className="h-3.5 w-3.5" /> Blueprint Mode
              </button>
              <button
                onClick={() => setColorMode('attendance')}
                className={`px-3 py-1.5 rounded-md text-xs font-semibold flex items-center gap-1.5 transition ${
                  colorMode === 'attendance'
                    ? 'bg-emerald-600 text-white shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <CheckCircle2 className="h-3.5 w-3.5" /> Attendance Mode
              </button>
              <button
                onClick={() => setColorMode('gender')}
                className={`px-3 py-1.5 rounded-md text-xs font-semibold flex items-center gap-1.5 transition ${
                  colorMode === 'gender'
                    ? 'bg-indigo-600 text-white shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <Users className="h-3.5 w-3.5" /> Gender Layout
              </button>
            </div>

            {/* Attendance Date & Mark All Present */}
            <div className="flex items-center gap-2">
              <label className="text-xs text-slate-500 font-medium">ရက်စွဲ:</label>
              <input
                type="date"
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
                className="px-2.5 py-1 text-xs border border-slate-300 rounded-lg focus:ring-1 focus:ring-teal-500 bg-white"
              />
              <button
                onClick={handleMarkAllPresent}
                disabled={savingAttendance}
                className="px-3 py-1.5 rounded-lg border border-emerald-200 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 text-xs font-semibold inline-flex items-center gap-1.5 transition"
              >
                <Check className="h-3.5 w-3.5 text-emerald-600" />
                <span>Mark All Present</span>
              </button>
            </div>

            {/* Student Search & Auto-Sort */}
            <div className="flex items-center gap-2">
              <div className="relative">
                <Search className="h-3.5 w-3.5 absolute left-2.5 top-2.5 text-slate-400" />
                <input
                  type="text"
                  placeholder="ကျောင်းသား ရှာရန်..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-8 pr-3 py-1.5 text-xs border border-slate-300 rounded-lg focus:ring-1 focus:ring-teal-500 w-44 bg-white"
                />
                {searchQuery && (
                  <button
                    onClick={() => setSearchQuery('')}
                    className="absolute right-2 top-2 text-slate-400 hover:text-slate-600"
                  >
                    <X className="h-3 w-3" />
                  </button>
                )}
              </div>

              <button
                onClick={handleResetAlphabetical}
                className="p-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-600 text-xs font-medium inline-flex items-center gap-1 shadow-2xs"
                title="အက္ခရာစဉ်အတိုင်း အလိုအလျောက် နေရာချရန်"
              >
                <RotateCcw className="h-3.5 w-3.5" /> Auto-Sort
              </button>
            </div>
          </div>

          {/* Current Layout Specs & KPI Badge Bar */}
          <div className="pt-3 border-t border-slate-100 flex flex-wrap items-center justify-between gap-3 text-xs">
            <div className="flex items-center gap-2">
              <span className="text-slate-500">လက်ရှိ စာသင်ခန်း ဖွဲ့စည်းပုံ:</span>
              <span className="px-2.5 py-1 rounded-md bg-indigo-50 border border-indigo-200 text-indigo-900 font-semibold font-mono text-[11px] inline-flex items-center gap-1.5">
                <Layers className="h-3 w-3 text-indigo-600" />
                {layout.rows} တန်း × {layout.columnGroups} အုပ်စု (
                {layout.furnitureType === 'long_bench'
                  ? `တန်းလျားခုံရှည် ${layout.seatsPerGroup} ယောက်ထိုင်`
                  : `တစ်ယောက်ထိုင် ${layout.seatsPerGroup} ခုံတွဲ`}
                )
              </span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 sm:gap-4 text-xs">
              <div className="bg-slate-50 px-2.5 py-1.5 rounded-lg border border-slate-100 text-center">
                <span className="text-slate-500 block text-[10px]">စုစုပေါင်း ခုံဆံ့ဦးရေ</span>
                <strong className="text-xs font-bold text-slate-800">{stats.totalCapacity} ခုံ</strong>
              </div>
              <div className="bg-teal-50 px-2.5 py-1.5 rounded-lg border border-teal-100 text-center">
                <span className="text-teal-700 block text-[10px]">ကျောင်းသား ဦးရေ</span>
                <strong className="text-xs font-bold text-teal-900">{stats.occupiedCount} ဦး ({stats.occupancyPct}%)</strong>
              </div>
              <div className="bg-emerald-50 px-2.5 py-1.5 rounded-lg border border-emerald-100 text-center">
                <span className="text-emerald-700 block text-[10px]">တက် (Present)</span>
                <strong className="text-xs font-bold text-emerald-800">{stats.present} ဦး</strong>
              </div>
              <div className="bg-rose-50 px-2.5 py-1.5 rounded-lg border border-rose-100 text-center">
                <span className="text-rose-700 block text-[10px]">ပျက် (Absent)</span>
                <strong className="text-xs font-bold text-rose-800">{stats.absent} ဦး</strong>
              </div>
              <div className="bg-slate-50 px-2.5 py-1.5 rounded-lg border border-slate-100 text-center">
                <span className="text-slate-500 block text-[10px]">ခုံလွတ် (Vacant)</span>
                <strong className="text-xs font-bold text-slate-600">{stats.vacantCount} ခုံ</strong>
              </div>
            </div>
          </div>
        </div>

        {/* Swap Mode Notification Banner */}
        {swapSourceIndex !== null && (
          <div className="bg-amber-500 text-white px-4 py-2.5 rounded-xl shadow-md flex items-center justify-between text-xs animate-pulse">
            <span className="font-semibold flex items-center gap-2">
              <ArrowRightLeft className="h-4 w-4" />
              ခုံနေရာ လဲလှယ်မုဒ် (Swap Mode) ဖွင့်ထားပါသည်: ခုံအမှတ် #{swapSourceIndex + 1} (
              {seats[swapSourceIndex]?.student?.full_name || 'ခုံလွတ်'}) နှင့် လဲလှယ်လိုသော အခြားခုံကို နှိပ်ပါ။
            </span>
            <button
              onClick={() => setSwapSourceIndex(null)}
              className="bg-white/20 hover:bg-white/30 text-white px-2.5 py-1 rounded text-xs font-bold"
            >
              ပယ်ဖျက်မည်
            </button>
          </div>
        )}

        {/* ARCHITECTURAL CLASSROOM FLOOR PLAN CONTAINER */}
        <div className="overflow-x-auto pb-6">
          <div
            className={`mx-auto bg-white p-6 sm:p-8 rounded-2xl border-4 border-slate-700 shadow-xl relative print:border-2 print:border-black print:p-4 print:shadow-none ${
              layout.columnGroups >= 3 ? 'min-w-[1050px]' : 'min-w-[880px]'
            }`}
          >
            {/* Top Room Header */}
            <div className="absolute top-2 left-6 text-[10px] font-mono text-slate-400 uppercase tracking-widest print:text-black">
              CLASSROOM ARCHITECTURAL BLUEPRINT • {classInfo?.name || 'KG - Section A'} (CAPACITY: {stats.totalCapacity}) •{' '}
              {layout.furnitureType === 'long_bench' ? 'MYANMAR LONG BENCH' : 'INDIVIDUAL DESK'} (
              {layout.rows}R × {layout.columnGroups}G × {layout.seatsPerGroup}S)
            </div>

            {/* FRONT WALL: Centered Whiteboard & Top-Left Teacher Desk */}
            <div className="relative pt-6 pb-10 border-b-2 border-dashed border-slate-200 mb-8">
              {/* Top-Left Teacher Desk */}
              <div className="absolute left-2 sm:left-4 top-2 flex flex-col items-center">
                <div className="w-14 h-4 rounded-t-md bg-slate-300 border border-slate-500 mb-0.5 print:bg-slate-200"></div>
                <div className="w-34 sm:w-36 h-16 rounded border-2 border-slate-800 bg-amber-50/70 p-1.5 shadow-sm text-center flex flex-col justify-center items-center print:border-black">
                  <div className="text-[10px] font-bold text-slate-800 uppercase tracking-wider">Teacher Desk</div>
                  <div className="text-[10px] text-teal-800 font-semibold truncate max-w-[125px]">
                    ဒေါ်သီတာ (Daw Thida)
                  </div>
                  <div className="text-[9px] text-slate-500">အတန်းပိုင် ဆရာမ</div>
                </div>
              </div>

              {/* Centered Large Board (Whiteboard) */}
              <div className="mx-auto w-96 sm:w-130 h-10 border-2 border-slate-700 bg-slate-100 rounded-sm shadow-xs flex items-center justify-center font-bold text-sm tracking-widest text-slate-800 uppercase print:border-black print:bg-white">
                <span className="border-b border-slate-400 px-6 py-0.5">Board / သင်ပုန်းကြီး</span>
              </div>

              {/* Natural Sunlight / Windows on Left Wall */}
              <div className="absolute -left-7 top-14 -rotate-90 text-[9px] font-mono text-slate-400 tracking-wider hidden sm:block">
                ⚏ WINDOWS ⚏
              </div>

              {/* FRONT ENTRANCE DOOR (Top Right Wall) */}
              <div className="absolute -right-7 top-1 flex items-center">
                <div className="relative w-12 h-16">
                  <div className="w-10 h-1 bg-slate-800 absolute right-0 top-0 origin-right -rotate-45"></div>
                  <svg
                    className="w-12 h-12 text-slate-400 absolute right-0 top-0 overflow-visible pointer-events-none"
                    viewBox="0 0 48 48"
                  >
                    <path
                      d="M 48,0 A 48,48 0 0,0 0,48"
                      fill="none"
                      stroke="currentColor"
                      strokeDasharray="3 3"
                      strokeWidth="1.5"
                    />
                  </svg>
                  <span className="absolute -bottom-4 right-0 text-[9px] font-bold text-slate-600 whitespace-nowrap">
                    အရှေ့တံခါး (Front Door)
                  </span>
                </div>
              </div>
            </div>

            {/* SEATING ROWS CONTAINER */}
            <div className="space-y-6">
              {Array.from({ length: layout.rows }).map((_, rowIdx) => {
                return (
                  <div key={rowIdx} className="flex items-center justify-center gap-4 sm:gap-8">
                    {/* Render each column group/file */}
                    {Array.from({ length: layout.columnGroups }).map((_, groupIdx) => {
                      const groupSeats = seats.filter(
                        (s) => s.rowIdx === rowIdx && s.groupIdx === groupIdx
                      );

                      return (
                        <React.Fragment key={groupIdx}>
                          {/* Furniture Unit: Either Myanmar Long Bench or Individual Desks */}
                          {layout.furnitureType === 'long_bench' ? (
                            <MyanmarLongBenchUnit
                              seats={groupSeats}
                              rowIdx={rowIdx}
                              groupIdx={groupIdx}
                              colorMode={colorMode}
                              selectedSeatIndex={selectedSeatIndex}
                              swapSourceIndex={swapSourceIndex}
                              searchQuery={searchQuery}
                              onSeatClick={handleSeatClick}
                            />
                          ) : (
                            <IndividualGroupUnit
                              seats={groupSeats}
                              colorMode={colorMode}
                              selectedSeatIndex={selectedSeatIndex}
                              swapSourceIndex={swapSourceIndex}
                              searchQuery={searchQuery}
                              onSeatClick={handleSeatClick}
                            />
                          )}

                          {/* Walking Aisle between groups (only if not the last group) */}
                          {groupIdx < layout.columnGroups - 1 && (
                            <div className="w-6 sm:w-10 flex flex-col items-center justify-center text-slate-300 select-none">
                              <div className="h-full border-r border-dashed border-slate-300 w-0.5"></div>
                              <span className="text-[8px] font-mono text-slate-400 uppercase tracking-widest my-1 rotate-90 whitespace-nowrap">
                                {layout.columnGroups > 2 ? `AISLE ${groupIdx + 1}` : 'AISLE'}
                              </span>
                              <div className="h-full border-r border-dashed border-slate-300 w-0.5"></div>
                            </div>
                          )}
                        </React.Fragment>
                      );
                    })}
                  </div>
                );
              })}
            </div>

            {/* REAR EXIT DOOR (Bottom Right Wall) */}
            <div className="relative mt-8 pt-6 border-t-2 border-dashed border-slate-200 flex justify-between items-center text-xs text-slate-400">
              <span className="font-mono text-[10px]">
                REAR OF CLASSROOM • အတန်းနောက်ဖက် (Rows: {layout.rows}, Files: {layout.columnGroups})
              </span>

              {/* Rear Door Swing */}
              <div className="absolute -right-7 bottom-2 flex items-center">
                <div className="relative w-12 h-16">
                  <div className="w-10 h-1 bg-slate-800 absolute right-0 bottom-0 origin-right rotate-45"></div>
                  <svg
                    className="w-12 h-12 text-slate-400 absolute right-0 bottom-0 overflow-visible pointer-events-none"
                    viewBox="0 0 48 48"
                  >
                    <path
                      d="M 48,48 A 48,48 0 0,1 0,0"
                      fill="none"
                      stroke="currentColor"
                      strokeDasharray="3 3"
                      strokeWidth="1.5"
                    />
                  </svg>
                  <span className="absolute -top-4 right-0 text-[9px] font-bold text-slate-600 whitespace-nowrap">
                    အနောက်တံခါး (Rear Exit)
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Student Desk Detail Drawer / Modal */}
        {selectedSeat && (
          <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4 print:hidden">
            <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200 relative animate-in fade-in zoom-in-95 duration-150">
              <button
                onClick={() => setSelectedSeatIndex(null)}
                className="absolute right-4 top-4 p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100"
              >
                <X className="h-5 w-5" />
              </button>

              <div className="flex items-start gap-4">
                <div className="w-14 h-14 rounded-full bg-teal-100 border-2 border-teal-500 flex items-center justify-center font-bold text-teal-800 text-lg shadow-sm">
                  {selectedSeat.student ? selectedSeat.student.full_name.charAt(0) : '#'}
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="px-2 py-0.5 rounded text-[11px] font-mono font-bold bg-slate-100 text-slate-700 border border-slate-200">
                      ခုံအမှတ် #{selectedSeat.seatIndex + 1}
                    </span>
                    <span className="text-xs text-slate-500">
                      (တန်း {selectedSeat.rowIdx + 1}၊ အုပ်စု {selectedSeat.groupIdx + 1}၊ ခုံနေရာ{' '}
                      {selectedSeat.seatInGroupIdx + 1})
                    </span>
                  </div>
                  <h3 className="text-lg font-bold text-slate-900 mt-1">
                    {selectedSeat.student ? selectedSeat.student.full_name : 'လွတ်နေသော ခုံ (Vacant Seat)'}
                  </h3>
                  {selectedSeat.student && (
                    <p className="text-xs text-slate-500 font-mono mt-0.5">{selectedSeat.student.email}</p>
                  )}
                </div>
              </div>

              {selectedSeat.student ? (
                <div className="mt-6 space-y-4">
                  {/* Attendance Selector */}
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                      ကျောင်းခေါ်ချိန် အခြေအနေ ({selectedDate}):
                    </label>
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        onClick={() => handleStatusChange(selectedSeat.student!.id, 'present')}
                        className={`py-2 px-3 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 border transition ${
                          selectedSeat.attendanceStatus === 'present'
                            ? 'bg-emerald-600 text-white border-emerald-700 shadow-sm'
                            : 'bg-emerald-50 text-emerald-800 border-emerald-200 hover:bg-emerald-100'
                        }`}
                      >
                        <CheckCircle2 className="h-4 w-4" /> တက် (Present)
                      </button>

                      <button
                        type="button"
                        onClick={() => handleStatusChange(selectedSeat.student!.id, 'absent')}
                        className={`py-2 px-3 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 border transition ${
                          selectedSeat.attendanceStatus === 'absent'
                            ? 'bg-rose-600 text-white border-rose-700 shadow-sm'
                            : 'bg-rose-50 text-rose-800 border-rose-200 hover:bg-rose-100'
                        }`}
                      >
                        <XCircle className="h-4 w-4" /> ပျက် (Absent)
                      </button>

                      <button
                        type="button"
                        onClick={() => handleStatusChange(selectedSeat.student!.id, 'late')}
                        className={`py-2 px-3 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 border transition ${
                          selectedSeat.attendanceStatus === 'late'
                            ? 'bg-amber-500 text-white border-amber-600 shadow-sm'
                            : 'bg-amber-50 text-amber-800 border-amber-200 hover:bg-amber-100'
                        }`}
                      >
                        <Clock className="h-4 w-4" /> နောက်ကျ (Late)
                      </button>

                      <button
                        type="button"
                        onClick={() => handleStatusChange(selectedSeat.student!.id, 'excused')}
                        className={`py-2 px-3 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 border transition ${
                          selectedSeat.attendanceStatus === 'excused'
                            ? 'bg-sky-600 text-white border-sky-700 shadow-sm'
                            : 'bg-sky-50 text-sky-800 border-sky-200 hover:bg-sky-100'
                        }`}
                      >
                        ခွင့် (Excused)
                      </button>
                    </div>
                  </div>

                  {/* Actions & Links */}
                  <div className="pt-4 border-t border-slate-100 flex flex-col gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        setSwapSourceIndex(selectedSeat.seatIndex);
                        setSelectedSeatIndex(null);
                      }}
                      className="w-full py-2 px-3 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs font-semibold flex items-center justify-center gap-2 shadow-2xs transition"
                    >
                      <ArrowRightLeft className="h-3.5 w-3.5 text-amber-600" />
                      <span>နေရာ ပြောင်းရွှေ့လဲလှယ်မည် (Swap Seat)</span>
                    </button>

                    <Link
                      to={`${basePath}/classes/${classSlug}/exam-marks`}
                      className="w-full py-2 px-3 rounded-lg border border-amber-200 bg-amber-50 hover:bg-amber-100 text-amber-900 text-xs font-semibold flex items-center justify-center gap-2 transition"
                    >
                      <FileSpreadsheet className="h-3.5 w-3.5 text-amber-700" />
                      <span>စာမေးပွဲ အမှတ်စာရင်း ကြည့်ရန် (Marksheet)</span>
                    </Link>

                    <Link
                      to={`${basePath}/students/${selectedSeat.student.id}`}
                      className="w-full py-2 px-3 rounded-lg border border-slate-200 bg-slate-50 hover:bg-slate-100 text-slate-700 text-xs font-semibold flex items-center justify-center gap-2 transition"
                    >
                      <User className="h-3.5 w-3.5 text-slate-500" />
                      <span>ကျောင်းသား အပြည့်အစုံ ပရိုဖိုင် (Full Profile)</span>
                    </Link>
                  </div>
                </div>
              ) : (
                <div className="mt-6 space-y-4">
                  <p className="text-xs text-slate-500">
                    ဤခုံတွင် ကျောင်းသား နေရာချထားခြင်း မရှိသေးပါ။ နေရာလွတ် ဖြစ်ပါသည်။
                  </p>
                  <button
                    type="button"
                    onClick={() => {
                      setSwapSourceIndex(selectedSeat.seatIndex);
                      setSelectedSeatIndex(null);
                    }}
                    className="w-full py-2 px-3 rounded-lg border border-teal-200 bg-teal-50 hover:bg-teal-100 text-teal-800 text-xs font-semibold flex items-center justify-center gap-2 transition"
                  >
                    <ArrowRightLeft className="h-3.5 w-3.5 text-teal-600" />
                    <span>အခြားကျောင်းသားကို ဤခုံသို့ ရွှေ့မည်</span>
                  </button>
                </div>
              )}
            </div>
          </div>
        )}

        {/* CLASSROOM LAYOUT CUSTOMIZATION MODAL */}
        {layoutModalOpen && (
          <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl max-w-2xl w-full p-6 shadow-2xl border border-slate-200 relative animate-in fade-in zoom-in-95 duration-150 space-y-6">
              {/* Header */}
              <div className="flex items-center justify-between pb-3 border-b border-slate-200">
                <div className="flex items-center gap-2.5">
                  <div className="p-2 rounded-xl bg-indigo-100 text-indigo-700">
                    <SlidersHorizontal className="h-5 w-5" />
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-slate-900">
                      စာသင်ခန်း ထိုင်ခုံဖွဲ့စည်းပုံ ပြင်ဆင်ရန် (Customize Seating Layout)
                    </h3>
                    <p className="text-xs text-slate-500">
                      တစ်ယောက်ထိုင် ခုံ (သို့) မြန်မာ့ရိုးရာ တန်းလျားခုံရှည်၊ အတန်းအရေအတွက်နှင့် အုပ်စုများကို စိတ်ကြိုက် သတ်မှတ်ပါ
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setLayoutModalOpen(false)}
                  className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              {/* 1. Quick Presets Grid */}
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
                  အသင့်သုံး စာသင်ခန်း ပုံစံများ (Quick Presets):
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  {LAYOUT_PRESETS.map((p) => {
                    const isSelected =
                      tempLayout.furnitureType === p.config.furnitureType &&
                      tempLayout.rows === p.config.rows &&
                      tempLayout.columnGroups === p.config.columnGroups &&
                      tempLayout.seatsPerGroup === p.config.seatsPerGroup;

                    return (
                      <button
                        key={p.id}
                        type="button"
                        onClick={() => setTempLayout({ ...p.config })}
                        className={`text-left p-3 rounded-xl border transition ${
                          isSelected
                            ? 'border-indigo-600 bg-indigo-50/70 ring-1 ring-indigo-500'
                            : 'border-slate-200 hover:border-slate-300 hover:bg-slate-50/70'
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <span className="font-bold text-xs text-slate-900">{p.name}</span>
                          <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-white text-indigo-700 border border-indigo-200">
                            {p.badge}
                          </span>
                        </div>
                        <p className="text-[11px] text-slate-500 mt-1 leading-snug">{p.description}</p>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* 2. Interactive Controls for Custom Parameters */}
              <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-4">
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider">
                  စိတ်ကြိုက် အသေးစိတ် သတ်မှတ်ချက်များ (Custom Specs):
                </label>

                {/* Furniture Type Selector */}
                <div>
                  <span className="block text-xs font-semibold text-slate-700 mb-1.5">
                    စာသင်ခုံ အမျိုးအစား (Furniture Type):
                  </span>
                  <div className="grid grid-cols-2 gap-3">
                    <button
                      type="button"
                      onClick={() => setTempLayout({ ...tempLayout, furnitureType: 'individual' })}
                      className={`p-3 rounded-xl border text-left transition flex items-center gap-3 ${
                        tempLayout.furnitureType === 'individual'
                          ? 'border-teal-600 bg-white ring-2 ring-teal-500 text-slate-900 font-bold'
                          : 'border-slate-200 bg-white/70 text-slate-600 hover:bg-white'
                      }`}
                    >
                      <LayoutGrid className="h-5 w-5 text-teal-600 shrink-0" />
                      <div>
                        <div className="text-xs">တစ်ယောက်ထိုင် စားပွဲခုံ</div>
                        <div className="text-[10px] text-slate-400 font-normal">Individual Desks & Chairs</div>
                      </div>
                    </button>

                    <button
                      type="button"
                      onClick={() => setTempLayout({ ...tempLayout, furnitureType: 'long_bench' })}
                      className={`p-3 rounded-xl border text-left transition flex items-center gap-3 ${
                        tempLayout.furnitureType === 'long_bench'
                          ? 'border-amber-700 bg-white ring-2 ring-amber-600 text-slate-900 font-bold'
                          : 'border-slate-200 bg-white/70 text-slate-600 hover:bg-white'
                      }`}
                    >
                      <Layers className="h-5 w-5 text-amber-700 shrink-0" />
                      <div>
                        <div className="text-xs">မြန်မာ့ရိုးရာ တန်းလျားခုံရှည်</div>
                        <div className="text-[10px] text-slate-400 font-normal">Myanmar Long Bench (4–5 Seats)</div>
                      </div>
                    </button>
                  </div>
                </div>

                {/* Controls Grid */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-2">
                  {/* Rows Stepper */}
                  <div className="bg-white p-3 rounded-lg border border-slate-200">
                    <span className="block text-xs font-semibold text-slate-700 mb-2">
                      အတန်း အရေအတွက် (Rows):
                    </span>
                    <div className="flex items-center justify-between">
                      <button
                        type="button"
                        onClick={() => setTempLayout({ ...tempLayout, rows: Math.max(2, tempLayout.rows - 1) })}
                        className="w-8 h-8 rounded-lg border border-slate-300 flex items-center justify-center text-slate-700 hover:bg-slate-100"
                      >
                        <Minus className="h-4 w-4" />
                      </button>
                      <span className="font-mono text-base font-bold text-slate-900">{tempLayout.rows} တန်း</span>
                      <button
                        type="button"
                        onClick={() => setTempLayout({ ...tempLayout, rows: Math.min(12, tempLayout.rows + 1) })}
                        className="w-8 h-8 rounded-lg border border-slate-300 flex items-center justify-center text-slate-700 hover:bg-slate-100"
                      >
                        <Plus className="h-4 w-4" />
                      </button>
                    </div>
                  </div>

                  {/* Column Groups / Files Stepper */}
                  <div className="bg-white p-3 rounded-lg border border-slate-200">
                    <span className="block text-xs font-semibold text-slate-700 mb-2">
                      တန်းအုပ်စု (Files / Groups):
                    </span>
                    <div className="flex items-center justify-between">
                      <button
                        type="button"
                        onClick={() =>
                          setTempLayout({ ...tempLayout, columnGroups: Math.max(1, tempLayout.columnGroups - 1) })
                        }
                        className="w-8 h-8 rounded-lg border border-slate-300 flex items-center justify-center text-slate-700 hover:bg-slate-100"
                      >
                        <Minus className="h-4 w-4" />
                      </button>
                      <span className="font-mono text-base font-bold text-slate-900">
                        {tempLayout.columnGroups} အုပ်စု
                      </span>
                      <button
                        type="button"
                        onClick={() =>
                          setTempLayout({ ...tempLayout, columnGroups: Math.min(4, tempLayout.columnGroups + 1) })
                        }
                        className="w-8 h-8 rounded-lg border border-slate-300 flex items-center justify-center text-slate-700 hover:bg-slate-100"
                      >
                        <Plus className="h-4 w-4" />
                      </button>
                    </div>
                  </div>

                  {/* Seats per Group / Bench Stepper */}
                  <div className="bg-white p-3 rounded-lg border border-slate-200">
                    <span className="block text-xs font-semibold text-slate-700 mb-2">
                      {tempLayout.furnitureType === 'long_bench'
                        ? '၁ ခုံရှည်ဆံ့ဦးရေ (Bench Seats):'
                        : '၁ အုပ်စု ခုံအရေအတွက် (Desks):'}
                    </span>
                    <div className="flex items-center justify-between">
                      <button
                        type="button"
                        onClick={() =>
                          setTempLayout({ ...tempLayout, seatsPerGroup: Math.max(1, tempLayout.seatsPerGroup - 1) })
                        }
                        className="w-8 h-8 rounded-lg border border-slate-300 flex items-center justify-center text-slate-700 hover:bg-slate-100"
                      >
                        <Minus className="h-4 w-4" />
                      </button>
                      <span className="font-mono text-base font-bold text-slate-900">
                        {tempLayout.seatsPerGroup} ယောက်
                      </span>
                      <button
                        type="button"
                        onClick={() =>
                          setTempLayout({ ...tempLayout, seatsPerGroup: Math.min(6, tempLayout.seatsPerGroup + 1) })
                        }
                        className="w-8 h-8 rounded-lg border border-slate-300 flex items-center justify-center text-slate-700 hover:bg-slate-100"
                      >
                        <Plus className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                </div>

                {/* Calculation Summary Card */}
                <div className="p-3 bg-teal-50 border border-teal-200 rounded-lg flex items-center justify-between text-xs text-teal-950">
                  <div className="flex items-center gap-2">
                    <Sparkles className="h-4 w-4 text-teal-700 shrink-0" />
                    <span>
                      စုစုပေါင်း ထိုင်ခုံနေရာ: <strong>{tempLayout.rows} တန်း</strong> ×{' '}
                      <strong>{tempLayout.columnGroups} အုပ်စု</strong> ×{' '}
                      <strong>{tempLayout.seatsPerGroup} ယောက်ထိုင်</strong> ={' '}
                      <strong className="text-sm font-bold text-teal-900 font-mono">
                        {tempLayout.rows * tempLayout.columnGroups * tempLayout.seatsPerGroup} ခုံ
                      </strong>
                    </span>
                  </div>
                  <span className="text-[11px] text-teal-800 font-medium">
                    (လက်ရှိ KG ကျောင်းသား ၂၉ ဦး ဆံ့ငင်မှု အပြည့်အဝ ရှိပါသည်)
                  </span>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center justify-between pt-2">
                <button
                  type="button"
                  onClick={() => setTempLayout(DEFAULT_LAYOUT)}
                  className="px-3 py-2 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 text-xs font-semibold inline-flex items-center gap-1.5"
                >
                  <RotateCcw className="h-3.5 w-3.5" /> မူရင်း Blueprint အတိုင်း ထားမည်
                </button>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setLayoutModalOpen(false)}
                    className="px-4 py-2 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs font-semibold"
                  >
                    ပယ်ဖျက်မည်
                  </button>
                  <button
                    type="button"
                    onClick={() => handleApplyLayout(tempLayout)}
                    className="px-5 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold shadow-sm inline-flex items-center gap-1.5"
                  >
                    <Check className="h-4 w-4" />
                    <span>သိမ်းဆည်းပြီး အသုံးပြုမည် (Apply Layout)</span>
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Close Seating Layout Fragment if not corners mode */}
        {!(isKG && kgViewMode === 'corners') && null}
          </>
        )}

        {/* Official MOE Curriculum Guide Modal */}
        <MOEGuideModal isOpen={moeGuideOpen} onClose={() => setMoeGuideOpen(false)} />
      </div>
    </div>
  );
};

// ============================================================================
// MYANMAR LONG BENCH COMPONENT (တန်းလျား စားပွဲခုံရှည် ၄ မှ ၅ ယောက်ထိုင်)
// ============================================================================
interface MyanmarLongBenchUnitProps {
  seats: SeatedStudent[];
  rowIdx: number;
  groupIdx: number;
  colorMode: ColorMode;
  selectedSeatIndex: number | null;
  swapSourceIndex: number | null;
  searchQuery: string;
  onSeatClick: (seatIndex: number) => void;
}

const MyanmarLongBenchUnit: React.FC<MyanmarLongBenchUnitProps> = ({
  seats,
  rowIdx,
  groupIdx,
  colorMode,
  selectedSeatIndex,
  swapSourceIndex,
  searchQuery,
  onSeatClick,
}) => {
  return (
    <div className="flex flex-col items-center select-none group">
      {/* Bench Header Label */}
      <div className="text-[9px] font-mono text-amber-900 font-semibold mb-0.5 tracking-wider uppercase opacity-75">
        တန်း {rowIdx + 1} - အုပ်စု {groupIdx + 1} (ခုံရှည်)
      </div>

      {/* Main Long Wooden Table (Encloses all student slots in this bench) */}
      <div className="flex items-stretch rounded-md border-2 border-amber-900/80 bg-amber-50 shadow-md divide-x-2 divide-amber-900/40 overflow-hidden">
        {seats.map((seat) => (
          <BenchSlotItem
            key={seat.seatIndex}
            seat={seat}
            colorMode={colorMode}
            isSelected={selectedSeatIndex === seat.seatIndex}
            isSwapSource={swapSourceIndex === seat.seatIndex}
            isSearchMatched={
              searchQuery.trim().length > 0 &&
              Boolean(
                seat.student?.full_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                  seat.student?.email.toLowerCase().includes(searchQuery.toLowerCase())
              )
            }
            onClick={() => onSeatClick(seat.seatIndex)}
          />
        ))}
      </div>

      {/* Attached Continuous Long Wooden Bench Chair underneath */}
      <div className="w-full h-4 rounded-b-md bg-amber-800/40 border-2 border-t-0 border-amber-900/70 shadow-2xs mt-0.5 flex items-center justify-around px-2">
        {seats.map((s) => (
          <div key={s.seatIndex} className="w-3 h-1 bg-amber-900/30 rounded-xs"></div>
        ))}
      </div>
    </div>
  );
};

// Single seat slot inside a Myanmar Long Bench
interface BenchSlotItemProps {
  seat: SeatedStudent;
  colorMode: ColorMode;
  isSelected: boolean;
  isSwapSource: boolean;
  isSearchMatched: boolean;
  onClick: () => void;
}

const BenchSlotItem: React.FC<BenchSlotItemProps> = ({
  seat,
  colorMode,
  isSelected,
  isSwapSource,
  isSearchMatched,
  onClick,
}) => {
  const getSlotStyle = () => {
    if (!seat.student) {
      return 'bg-amber-50/50 text-slate-400 hover:bg-amber-100/50';
    }

    if (colorMode === 'blueprint') {
      const isTeal = BLUEPRINT_TEAL_INDICES.has(seat.seatIndex);
      return isTeal
        ? 'bg-teal-600 text-white font-semibold shadow-xs'
        : 'bg-white text-slate-900 font-semibold shadow-xs';
    }

    if (colorMode === 'attendance') {
      switch (seat.attendanceStatus) {
        case 'present':
          return 'bg-emerald-600 text-white font-semibold';
        case 'absent':
          return 'bg-rose-600 text-white font-semibold';
        case 'late':
          return 'bg-amber-400 text-slate-900 font-semibold';
        case 'excused':
          return 'bg-sky-600 text-white font-semibold';
        default:
          return 'bg-white text-slate-800';
      }
    }

    if (colorMode === 'gender') {
      return seat.gender === 'boy'
        ? 'bg-teal-600 text-white font-semibold'
        : 'bg-rose-400 text-white font-semibold';
    }

    return 'bg-white text-slate-900';
  };

  const styleClass = getSlotStyle();

  return (
    <div
      data-desk-index={seat.seatIndex}
      onClick={(e) => {
        e.stopPropagation();
        onClick();
      }}
      className={`desk-cell relative w-20 sm:w-24 h-13 sm:h-14 p-1 flex flex-col justify-between cursor-pointer transition-all ${styleClass} ${
        isSelected ? 'ring-2 ring-indigo-500 z-10' : 'hover:brightness-95'
      }`}
    >
      {/* Search Pulse */}
      {isSearchMatched && (
        <span className="absolute -inset-1 rounded-sm bg-amber-400/50 animate-ping pointer-events-none"></span>
      )}
      {/* Swap Source Highlight */}
      {isSwapSource && (
        <span className="absolute -inset-1 rounded-sm border-2 border-dashed border-amber-500 animate-spin pointer-events-none"></span>
      )}

      {/* Top Mini Header: Seat # & Status Indicator */}
      <div className="flex items-center justify-between text-[8px] leading-none opacity-80">
        <span className="font-mono">#{seat.seatIndex + 1}</span>
        {seat.student && (
          <span
            className={`w-1.5 h-1.5 rounded-full ${
              seat.attendanceStatus === 'present'
                ? 'bg-emerald-300'
                : seat.attendanceStatus === 'absent'
                ? 'bg-rose-300'
                : seat.attendanceStatus === 'late'
                ? 'bg-amber-200'
                : 'bg-slate-300'
            }`}
          ></span>
        )}
      </div>

      {/* Student Name */}
      <div className="text-center font-bold text-[10px] sm:text-[11px] truncate tracking-tight py-0.5">
        {seat.student ? seat.student.full_name : 'လွတ်'}
      </div>

      {/* Bottom Gender Label */}
      <div className="text-[8px] text-center opacity-70 leading-none truncate font-mono">
        {seat.student ? (seat.gender === 'boy' ? 'မောင်' : 'မ') : 'Vacant'}
      </div>
    </div>
  );
};

// ============================================================================
// INDIVIDUAL DESK GROUP COMPONENT (တစ်ယောက်ထိုင် ခုံတွဲများ)
// ============================================================================
interface IndividualGroupUnitProps {
  seats: SeatedStudent[];
  colorMode: ColorMode;
  selectedSeatIndex: number | null;
  swapSourceIndex: number | null;
  searchQuery: string;
  onSeatClick: (seatIndex: number) => void;
}

const IndividualGroupUnit: React.FC<IndividualGroupUnitProps> = ({
  seats,
  colorMode,
  selectedSeatIndex,
  swapSourceIndex,
  searchQuery,
  onSeatClick,
}) => {
  return (
    <div
      className="grid gap-3 sm:gap-4"
      style={{ gridTemplateColumns: `repeat(${seats.length}, minmax(0, 1fr))` }}
    >
      {seats.map((seat) => (
        <IndividualDeskItem
          key={seat.seatIndex}
          seat={seat}
          colorMode={colorMode}
          isSelected={selectedSeatIndex === seat.seatIndex}
          isSwapSource={swapSourceIndex === seat.seatIndex}
          isSearchMatched={
            searchQuery.trim().length > 0 &&
            Boolean(
              seat.student?.full_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                seat.student?.email.toLowerCase().includes(searchQuery.toLowerCase())
            )
          }
          onClick={() => onSeatClick(seat.seatIndex)}
        />
      ))}
    </div>
  );
};

// Individual Desk Item with attached chair
interface IndividualDeskItemProps {
  seat: SeatedStudent;
  colorMode: ColorMode;
  isSelected: boolean;
  isSwapSource: boolean;
  isSearchMatched: boolean;
  onClick: () => void;
}

const IndividualDeskItem: React.FC<IndividualDeskItemProps> = ({
  seat,
  colorMode,
  isSelected,
  isSwapSource,
  isSearchMatched,
  onClick,
}) => {
  const isTealBlueprint = BLUEPRINT_TEAL_INDICES.has(seat.seatIndex);

  const getDeskStyles = () => {
    if (!seat.student) {
      return {
        bg: 'bg-slate-50/70 border-dashed border-slate-300 text-slate-400',
        chair: 'bg-slate-200 border-slate-300',
      };
    }

    if (colorMode === 'blueprint') {
      if (isTealBlueprint) {
        return {
          bg: 'bg-teal-600 border-teal-700 text-white font-semibold shadow-xs',
          chair: 'bg-teal-700/80 border-teal-800',
        };
      } else {
        return {
          bg: 'bg-white border-slate-600 text-slate-900 font-semibold shadow-xs',
          chair: 'bg-slate-300 border-slate-400',
        };
      }
    }

    if (colorMode === 'attendance') {
      switch (seat.attendanceStatus) {
        case 'present':
          return {
            bg: 'bg-emerald-600 border-emerald-700 text-white font-semibold shadow-xs',
            chair: 'bg-emerald-700 border-emerald-800',
          };
        case 'absent':
          return {
            bg: 'bg-rose-600 border-rose-700 text-white font-semibold shadow-xs',
            chair: 'bg-rose-700 border-rose-800',
          };
        case 'late':
          return {
            bg: 'bg-amber-400 border-amber-500 text-slate-900 font-semibold shadow-xs',
            chair: 'bg-amber-500 border-amber-600',
          };
        case 'excused':
          return {
            bg: 'bg-sky-600 border-sky-700 text-white font-semibold shadow-xs',
            chair: 'bg-sky-700 border-sky-800',
          };
        default:
          return {
            bg: 'bg-white border-slate-400 text-slate-800 font-medium',
            chair: 'bg-slate-300 border-slate-400',
          };
      }
    }

    if (colorMode === 'gender') {
      if (seat.gender === 'boy') {
        return {
          bg: 'bg-teal-600 border-teal-700 text-white font-semibold shadow-xs',
          chair: 'bg-teal-700 border-teal-800',
        };
      } else {
        return {
          bg: 'bg-rose-400 border-rose-500 text-white font-semibold shadow-xs',
          chair: 'bg-rose-500 border-rose-600',
        };
      }
    }

    return {
      bg: 'bg-white border-slate-600 text-slate-900',
      chair: 'bg-slate-300 border-slate-400',
    };
  };

  const style = getDeskStyles();

  return (
    <div
      data-desk-index={seat.seatIndex}
      onClick={(e) => {
        e.stopPropagation();
        onClick();
      }}
      className={`desk-cell group relative flex flex-col items-center cursor-pointer transition-transform duration-100 select-none ${
        isSelected ? 'scale-105 z-20' : 'hover:scale-102'
      }`}
    >
      {/* Search Pulse */}
      {isSearchMatched && (
        <span className="absolute -inset-1 rounded-lg bg-amber-400/50 animate-ping pointer-events-none"></span>
      )}

      {/* Swap Source Highlight */}
      {isSwapSource && (
        <span className="absolute -inset-1.5 rounded-lg border-2 border-dashed border-amber-500 animate-spin pointer-events-none"></span>
      )}

      {/* Main Desk Box */}
      <div
        className={`w-24 sm:w-28 h-12 sm:h-13 rounded-sm border-2 px-1.5 py-1 flex flex-col justify-between transition-colors ${
          style.bg
        } ${isSelected ? 'ring-2 ring-teal-500 ring-offset-2' : ''} ${
          isSearchMatched ? 'ring-2 ring-amber-500' : ''
        }`}
      >
        <div className="flex items-center justify-between text-[9px] leading-none opacity-80">
          <span className="font-mono">#{seat.seatIndex + 1}</span>
          {seat.student && (
            <span
              className={`w-1.5 h-1.5 rounded-full ${
                seat.attendanceStatus === 'present'
                  ? 'bg-emerald-400'
                  : seat.attendanceStatus === 'absent'
                  ? 'bg-rose-400'
                  : seat.attendanceStatus === 'late'
                  ? 'bg-amber-300'
                  : 'bg-slate-300'
              }`}
            ></span>
          )}
        </div>

        <div className="text-center font-bold text-[11px] sm:text-xs truncate tracking-tight py-0.5">
          {seat.student ? seat.student.full_name : 'လွတ်'}
        </div>

        <div className="text-[8px] text-center opacity-70 leading-none truncate font-mono">
          {seat.student ? (seat.gender === 'boy' ? 'မောင်' : 'မ') : 'Vacant'}
        </div>
      </div>

      {/* Attached Chair */}
      <div
        className={`w-10 sm:w-12 h-3.5 rounded-b-md border border-t-0 shadow-2xs transition-colors ${style.chair}`}
      ></div>
    </div>
  );
};

export default ClassRoomDetailPage;
