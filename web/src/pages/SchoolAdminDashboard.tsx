import React, { useEffect, useState, useMemo } from 'react';
import { api } from '../api/client';
import { ClassDTO, CreateClassRequest, SchoolDTO, FacultyMemberDTO, SchoolStudentDTO } from '../types';
import { useAuth } from '../context/AuthContext';
import { useConfirm } from '../context/ConfirmDialogContext';
import {
  Building,
  GraduationCap,
  Users,
  BookOpen,
  CalendarCheck,
  Plus,
  X,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  MapPin,
  Phone,
  Sparkles,
  Trash2,
  LayoutGrid,
  List,
  Search,
  ChevronRight,
  ShieldCheck,
  ArrowRightLeft,
  Check,
  ArrowRight,
  UserCheck,
} from 'lucide-react';
import { useNavigate, useSearchParams, useLocation } from 'react-router-dom';
import { SchoolSwitcherModal } from '../components/SchoolSwitcherModal';

const STANDARD_GRADES = [
  'KG',
  'Grade 1',
  'Grade 2',
  'Grade 3',
  'Grade 4',
  'Grade 5',
  'Grade 6',
  'Grade 7',
  'Grade 8',
  'Grade 9',
  'Grade 10',
  'Grade 11',
  'Grade 12',
];

const DEFAULT_SECTIONS = ['Section A', 'Section B', 'Section C', 'Section D'];

const formatTeacherName = (rawName?: string) => {
  if (!rawName) return 'ဆရာ/ဆရာမ';
  const cleaned = rawName.replace(/\s*\([^)]*\)/g, '').trim();
  return cleaned || rawName;
};

const getClassSlug = (cls: ClassDTO): string => {
  if (cls.code) return cls.code;
  const g = cls.grade_level.replace(/Grade\s*/i, 'G').replace(/\s+/g, '');
  const match = cls.name.match(/Section\s*([A-Za-z0-9]+)/i);
  const sec = match ? match[1].toUpperCase() : '';
  return sec ? `${g}${sec}` : cls.id;
};

export const SchoolAdminDashboard: React.FC = () => {
  const { user } = useAuth();
  const { confirm } = useConfirm();
  const navigate = useNavigate();
  const location = useLocation();
  const basePath = location.pathname.startsWith('/admin') ? '/admin' : '/school-admin';
  const [searchParams, setSearchParams] = useSearchParams();
  const urlSchoolId = searchParams.get('school_id');

  const [school, setSchool] = useState<SchoolDTO | null>(null);
  const [classes, setClasses] = useState<ClassDTO[]>([]);
  const [faculty, setFaculty] = useState<FacultyMemberDTO[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [switcherOpen, setSwitcherOpen] = useState(false);

  // Filter & Search
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedGradeFilter, setSelectedGradeFilter] = useState('ALL');
  const [selectedStageFilter, setSelectedStageFilter] = useState('ALL');
  const [viewMode, setViewMode] = useState<'grouped' | 'table'>('grouped');

  // Seeding state
  const [seeding, setSeeding] = useState(false);

  // New Class Section modal
  const [modalOpen, setModalOpen] = useState(false);
  const [newGradeLevel, setNewGradeLevel] = useState('KG');
  const [newSectionName, setNewSectionName] = useState('Section A');
  const [newClassName, setNewClassName] = useState('KG - Section A');
  const [selectedTeacherId, setSelectedTeacherId] = useState('');
  const [newAcademicYear, setNewAcademicYear] = useState('2026-2027');
  const [creating, setCreating] = useState(false);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const [students, setStudents] = useState<SchoolStudentDTO[]>([]);

  // Move / Transfer Students modal
  const [moveModalOpen, setMoveModalOpen] = useState(false);
  const [sourceClassId, setSourceClassId] = useState<string>('');
  const [targetClassId, setTargetClassId] = useState<string>('');
  const [selectedStudentIds, setSelectedStudentIds] = useState<string[]>([]);
  const [moving, setMoving] = useState(false);

  // Determine effective school ID
  const effectiveSchoolId = useMemo(() => {
    if (urlSchoolId) return urlSchoolId;
    if (user?.school_id) return user.school_id;
    return 'a0000000-0000-0000-0000-000000000001';
  }, [urlSchoolId, user?.school_id]);

  // Fetch school data, classes, faculty, and students
  const fetchSchoolData = async () => {
    setLoading(true);
    setError(null);
    try {
      if (effectiveSchoolId) {
        try {
          const s = await api.schools.get(effectiveSchoolId);
          setSchool(s);
        } catch {
          // fallback
        }
      }

      // Fetch classes strictly scoped to this campus facility
      const clsList = await api.classes.list(effectiveSchoolId || undefined);
      setClasses(clsList);

      // Fetch faculty and students assigned to this campus
      if (effectiveSchoolId) {
        try {
          const [fac, stList] = await Promise.all([
            api.schools.getFaculty(effectiveSchoolId).catch(() => []),
            api.students.listBySchool(effectiveSchoolId).catch(() => []),
          ]);
          setFaculty(fac);
          setStudents(stList);
          if (fac.length > 0 && !selectedTeacherId) {
            setSelectedTeacherId(fac[0].id);
          }
        } catch {
          setFaculty([]);
          setStudents([]);
        }
      }
    } catch (err: any) {
      setError(err.message || 'Failed to load school dashboard metrics');
    } finally {
      setLoading(false);
    }
  };

  const studentCountByClass = useMemo(() => {
    const map = new Map<string, number>();
    students.forEach((s) => {
      if (s.class_id) {
        map.set(s.class_id, (map.get(s.class_id) || 0) + 1);
      }
    });
    return map;
  }, [students]);

  const studentCountByGrade = useMemo(() => {
    const map = new Map<string, number>();
    students.forEach((s) => {
      const g = s.grade_level || 'KG';
      map.set(g, (map.get(g) || 0) + 1);
    });
    return map;
  }, [students]);

  const sourceClassStudents = useMemo(() => {
    if (!sourceClassId) return [];
    return students.filter((s) => s.class_id === sourceClassId);
  }, [students, sourceClassId]);

  const handleMoveStudents = async () => {
    if (!targetClassId || selectedStudentIds.length === 0) return;
    setMoving(true);
    setError(null);
    try {
      await Promise.all(
        selectedStudentIds.map((studentId) =>
          api.classes.enrollStudent(targetClassId, studentId)
        )
      );
      const targetCls = classes.find((c) => c.id === targetClassId);
      setSuccessMsg(
        `ကျောင်းသား ${selectedStudentIds.length} ဦးအား "${targetCls?.name || 'အတန်းသစ်'}" သို့ အောင်မြင်စွာ ပြောင်းရွှေ့ပြီးပါပြီ။`
      );
      setMoveModalOpen(false);
      setSelectedStudentIds([]);
      await fetchSchoolData();
    } catch (err: any) {
      setError(err.message || 'ကျောင်းသားများ အတန်းပြောင်းရွှေ့ခြင်း မအောင်မြင်ပါ');
    } finally {
      setMoving(false);
    }
  };

  const handleQuickMoveHalfToG1AndG2 = async () => {
    const kgClass =
      classes.find((c) => c.grade_level === 'KG' && c.name.includes('Section A')) ||
      classes.find((c) => c.grade_level === 'KG');
    const g1Class =
      classes.find((c) => c.grade_level === 'Grade 1' && c.name.includes('Section A')) ||
      classes.find((c) => c.grade_level === 'Grade 1');
    const g2Class =
      classes.find((c) => c.grade_level === 'Grade 2' && c.name.includes('Section A')) ||
      classes.find((c) => c.grade_level === 'Grade 2');

    if (!kgClass || !g1Class || !g2Class) {
      setError('KG, Grade 1 နှင့် Grade 2 အတန်းများ မပြည့်စုံပါ');
      return;
    }

    const kgStudents = students.filter((s) => s.class_id === kgClass.id);
    if (kgStudents.length < 2) {
      setError('KG အတန်းတွင် ကျောင်းသား အရေအတွက် မလုံလောက်ပါ');
      return;
    }

    const halfCount = Math.floor(kgStudents.length / 2);
    const toG1 = kgStudents.slice(0, Math.ceil(halfCount / 2));
    const toG2 = kgStudents.slice(Math.ceil(halfCount / 2), halfCount);

    setMoving(true);
    setError(null);
    try {
      await Promise.all([
        ...toG1.map((s) => api.classes.enrollStudent(g1Class.id, s.id)),
        ...toG2.map((s) => api.classes.enrollStudent(g2Class.id, s.id)),
      ]);
      setSuccessMsg(
        `KG မှ ကျောင်းသား ${halfCount} ဦးအား ${g1Class.name} (${toG1.length} ဦး) နှင့် ${g2Class.name} (${toG2.length} ဦး) သို့ အောင်မြင်စွာ ပြောင်းရွှေ့ပြီးပါပြီ။`
      );
      setMoveModalOpen(false);
      await fetchSchoolData();
    } catch (err: any) {
      setError(err.message || 'ကျောင်းသားများ အတန်းပြောင်းရွှေ့ခြင်း မအောင်မြင်ပါ');
    } finally {
      setMoving(false);
    }
  };

  useEffect(() => {
    fetchSchoolData();
  }, [effectiveSchoolId, user]);

  // Sync auto-generated Class Name when Grade Level or Section changes
  const handleGradeChange = (grade: string) => {
    setNewGradeLevel(grade);
    setNewClassName(`${grade} - ${newSectionName}`);
  };

  const handleSectionChange = (section: string) => {
    setNewSectionName(section);
    setNewClassName(`${newGradeLevel} - ${section}`);
  };

  // Seed default classes (KG, Grade 1 to Grade 12, Sections A & B)
  const handleSeedDefaultClasses = async () => {
    if (!effectiveSchoolId) return;
    setSeeding(true);
    setError(null);
    try {
      const seeded = await api.schools.seedDefaultClasses(effectiveSchoolId);
      setClasses(seeded);
      setSuccessMsg(
        'Standard Myanmar K-12 classes (KG to Grade 12, Sections A & B) initialized strictly under this campus facility!'
      );
    } catch (err: any) {
      setError(err.message || 'Failed to seed default K-12 classes');
    } finally {
      setSeeding(false);
    }
  };

  // Handle Class Creation
  const handleCreateClass = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreating(true);
    setError(null);
    try {
      const payload: CreateClassRequest = {
        name: newClassName.trim(),
        grade_level: newGradeLevel.trim(),
        academic_year: newAcademicYear.trim(),
        school_id: effectiveSchoolId,
        teacher_id: selectedTeacherId || undefined,
      };
      const created = await api.classes.create(payload);
      setClasses((prev) => [created, ...prev]);
      setSuccessMsg(`Class Section "${created.name}" registered strictly under this facility!`);
      setModalOpen(false);
      setNewClassName(`${newGradeLevel} - ${newSectionName}`);
    } catch (err: any) {
      setError(err.message || 'Failed to create class section');
    } finally {
      setCreating(false);
    }
  };

  // Handle Delete Class Section
  const handleDeleteClass = async (classId: string, className: string) => {
    const isConfirmed = await confirm({
      title: 'အတန်း အခန်းခွဲ ပယ်ဖျက်ရန် (Remove Section)',
      message: `Are you sure you want to remove section "${className}" from this campus?`,
      confirmText: 'ပယ်ဖျက်မည် (Remove)',
      cancelText: 'မလုပ်တော့ပါ (Cancel)',
      variant: 'danger',
      cautionText: 'ဤလုပ်ဆောင်ချက်ကို ပြန်လည်ပြင်ဆင်၍ မရနိုင်ပါ (This action cannot be undone)',
    });
    if (!isConfirmed) {
      return;
    }
    setDeletingId(classId);
    setError(null);
    try {
      await api.classes.delete(classId);
      setClasses((prev) => prev.filter((c) => c.id !== classId));
      setSuccessMsg(`Section "${className}" removed.`);
    } catch (err: any) {
      setError(err.message || 'Failed to delete class section');
    } finally {
      setDeletingId(null);
    }
  };

  // Teacher name lookup
  const facultyMap = useMemo(() => {
    const map = new Map<string, string>();
    for (const f of faculty) {
      map.set(f.id, f.full_name);
    }
    return map;
  }, [faculty]);

  const getStageInfo = (grade: string) => {
    if (grade === 'KG') {
      return { stage: 'kg', label: 'မူကြို', badgeClass: 'bg-amber-50 text-amber-800 border-amber-200' };
    }
    const num = parseInt(grade.replace(/\D/g, ''), 10);
    if (num >= 1 && num <= 5) {
      return { stage: 'primary', label: 'မူလတန်း', badgeClass: 'bg-emerald-50 text-emerald-800 border-emerald-200' };
    }
    if (num >= 6 && num <= 9) {
      return { stage: 'middle', label: 'အလယ်တန်း', badgeClass: 'bg-sky-50 text-sky-800 border-sky-200' };
    }
    if (num >= 10 && num <= 12) {
      return { stage: 'high', label: 'အထက်တန်း', badgeClass: 'bg-indigo-50 text-indigo-800 border-indigo-200' };
    }
    return { stage: 'other', label: 'အခြားအထူးပြု', badgeClass: 'bg-purple-50 text-purple-800 border-purple-200' };
  };

  // Filter classes based on search, grade filter, stage filter
  const filteredClasses = useMemo(() => {
    return classes.filter((cls) => {
      // Search filter
      if (searchTerm) {
        const term = searchTerm.toLowerCase();
        const matchesName = cls.name.toLowerCase().includes(term);
        const matchesGrade = cls.grade_level.toLowerCase().includes(term);
        const teacherName = facultyMap.get(cls.teacher_id)?.toLowerCase() || '';
        const matchesTeacher = teacherName.includes(term);
        if (!matchesName && !matchesGrade && !matchesTeacher) return false;
      }

      // Grade level filter
      if (selectedGradeFilter !== 'ALL' && cls.grade_level !== selectedGradeFilter) {
        return false;
      }

      // Stage filter
      if (selectedStageFilter !== 'ALL') {
        const info = getStageInfo(cls.grade_level);
        if (info.stage !== selectedStageFilter) return false;
      }

      return true;
    });
  }, [classes, searchTerm, selectedGradeFilter, selectedStageFilter, facultyMap]);

  // Group classes by grade level in Myanmar standard order
  const classesByGrade = useMemo(() => {
    const grouped: Record<string, ClassDTO[]> = {};

    // Initialize all standard grades in order
    for (const g of STANDARD_GRADES) {
      grouped[g] = [];
    }

    // Populate with matching classes
    for (const cls of filteredClasses) {
      if (!grouped[cls.grade_level]) {
        grouped[cls.grade_level] = [];
      }
      grouped[cls.grade_level].push(cls);
    }

    // Sort sections alphabetically within each grade
    for (const key of Object.keys(grouped)) {
      grouped[key].sort((a, b) => a.name.localeCompare(b.name));
    }

    return grouped;
  }, [filteredClasses]);

  // Grade coverage calculation
  const gradesWithClassesCount = useMemo(() => {
    const gradesSet = new Set(classes.map((c) => c.grade_level));
    return STANDARD_GRADES.filter((g) => gradesSet.has(g)).length;
  }, [classes]);

  return (
    <div className="p-6 md:p-8 max-w-7xl mx-auto w-full space-y-6">

      {/* Feedback Alerts */}
      {error && (
        <div className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-xs font-medium text-rose-800 flex items-center justify-between gap-2 shadow-sm animate-in fade-in duration-200">
          <div className="flex items-center gap-2">
            <AlertCircle className="h-4 w-4 text-rose-600 flex-shrink-0" />
            <span>{error}</span>
          </div>
          <button onClick={() => setError(null)} className="text-rose-500 hover:text-rose-700">
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {successMsg && (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-xs font-medium text-emerald-800 flex items-center justify-between gap-2 shadow-sm animate-in fade-in duration-200">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4 text-emerald-600 flex-shrink-0" />
            <span>{successMsg}</span>
          </div>
          <button onClick={() => setSuccessMsg(null)} className="text-emerald-500 hover:text-emerald-700">
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {/* Campus Classes & Sections Card */}
      <div className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
        {/* Card Header */}
        <div className="px-6 py-5 border-b border-slate-100 flex flex-col md:flex-row md:items-center justify-between gap-4 bg-slate-50/50">
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-lg font-bold text-slate-900 tracking-tight">အတန်းများနှင့် အတန်းလိုက် အခန်းများ စီမံခန့်ခွဲမှု</h2>
              <span className="text-[11px] font-mono px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-700 font-bold border border-indigo-200">
                {classes.length} registered
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              ကျောင်းဝင်းအတွင်း ဖွင့်လှစ်ထားသော KG မှ Grade 12 အထိ အတန်းများနှင့် အတန်းလိုက် အခန်းများ (Section A, B စသည်) စီမံခန့်ခွဲခြင်း
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {/* View Mode Switcher */}
            <div className="inline-flex rounded-lg border border-slate-200 bg-white p-0.5 shadow-sm">
              <button
                type="button"
                onClick={() => setViewMode('grouped')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-bold transition ${
                  viewMode === 'grouped'
                    ? 'bg-indigo-600 text-white shadow-sm'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
                }`}
              >
                <LayoutGrid className="h-3.5 w-3.5" /> အတန်းအလိုက်
              </button>
              <button
                type="button"
                onClick={() => setViewMode('table')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-bold transition ${
                  viewMode === 'table'
                    ? 'bg-indigo-600 text-white shadow-sm'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
                }`}
              >
                <List className="h-3.5 w-3.5" /> ဇယားဖြင့်
              </button>
            </div>

            <button
              onClick={() => {
                if (classes.length > 0) {
                  const kgCls = classes.find((c) => c.grade_level === 'KG' && c.name.includes('Section A')) || classes[0];
                  setSourceClassId(kgCls.id);
                  const firstTarget = classes.find((c) => c.id !== kgCls.id && (c.grade_level === 'Grade 1' || c.grade_level === 'Grade 2')) || classes.find((c) => c.id !== kgCls.id);
                  if (firstTarget) setTargetClassId(firstTarget.id);
                }
                setMoveModalOpen(true);
              }}
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow transition"
            >
              <ArrowRightLeft className="h-4 w-4" /> ကျောင်းသားများ အတန်းပြောင်းရွှေ့ရန်
            </button>

            <button
              onClick={() => {
                setNewGradeLevel('Grade 1');
                setNewSectionName('Section A');
                setNewClassName('Grade 1 - Section A');
                setModalOpen(true);
              }}
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold shadow transition"
            >
              <Plus className="h-4 w-4" /> Add Class Section
            </button>
          </div>
        </div>

        {/* Filter & Search Bar */}
        <div className="p-4 border-b border-slate-100 bg-white space-y-3">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
            {/* Search Input */}
            <div className="relative w-full sm:w-72">
              <Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-slate-400" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="အတန်း၊ အခန်းခွဲ၊ ဆရာ/ဆရာမ ရှာဖွေရန်..."
                className="w-full pl-9 pr-3 py-1.5 text-xs rounded-lg border border-slate-200 focus:outline-none focus:ring-1 focus:ring-indigo-500"
              />
            </div>

            {/* Stage Filter Tabs */}
            <div className="flex flex-wrap items-center gap-1.5 w-full sm:w-auto text-xs">
              <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mr-1">အဆင့်:</span>
              {[
                { id: 'ALL', label: 'အတန်းအားလုံး' },
                { id: 'kg', label: 'မူကြို' },
                { id: 'primary', label: 'မူလတန်း' },
                { id: 'middle', label: 'အလယ်တန်း' },
                { id: 'high', label: 'အထက်တန်း' },
              ].map((stage) => (
                <button
                  key={stage.id}
                  onClick={() => setSelectedStageFilter(stage.id)}
                  className={`px-2.5 py-1 rounded-lg font-bold text-xs transition ${
                    selectedStageFilter === stage.id
                      ? 'bg-slate-900 text-white shadow-sm'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  {stage.label}
                </button>
              ))}
            </div>
          </div>

          {/* Grade Level Pills */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-xs">
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mr-1 flex-shrink-0">
              အတန်း:
            </span>
            <button
              onClick={() => setSelectedGradeFilter('ALL')}
              className={`px-2.5 py-1 rounded-full font-bold flex-shrink-0 transition ${
                selectedGradeFilter === 'ALL'
                  ? 'bg-indigo-600 text-white'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              အားလုံး ({classes.length})
            </button>
            {STANDARD_GRADES.map((grade) => {
              const count = classes.filter((c) => c.grade_level === grade).length;
              return (
                <button
                  key={grade}
                  onClick={() => setSelectedGradeFilter(grade)}
                  className={`px-2.5 py-1 rounded-full font-bold flex-shrink-0 transition ${
                    selectedGradeFilter === grade
                      ? 'bg-indigo-600 text-white shadow-sm'
                      : count > 0
                      ? 'bg-indigo-50 text-indigo-700 hover:bg-indigo-100 border border-indigo-200'
                      : 'bg-slate-100 text-slate-400 hover:bg-slate-200'
                  }`}
                >
                  {grade} {count > 0 ? `(${count})` : ''}
                </button>
              );
            })}
          </div>
        </div>

        {/* Content Area */}
        {loading ? (
          <div className="p-12 text-center space-y-3">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-indigo-600 border-t-transparent mx-auto" />
            <p className="text-xs text-slate-500 font-medium">Loading facility campus classes...</p>
          </div>
        ) : classes.length === 0 ? (
          /* Empty State */
          <div className="p-12 text-center bg-slate-50/50 m-6 rounded-2xl border-2 border-dashed border-slate-200">
            <div className="w-14 h-14 bg-indigo-50 text-indigo-600 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-sm border border-indigo-100">
              <BookOpen className="h-7 w-7" />
            </div>
            <h3 className="text-base font-bold text-slate-900">ကျောင်းတွင်း အတန်းခွဲများ မရှိသေးပါ</h3>
            <p className="text-xs text-slate-500 mt-1 max-w-md mx-auto">
              KG မှ Grade 12 အထိ အတန်းများနှင့် အတန်းလိုက် အခန်းခွဲများ (Section A, B စသည်) ကို ထည့်သွင်းရန် အောက်ပါ ခလုတ်ကို နှိပ်ပါ။
            </p>
            <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
              <button
                onClick={() => setModalOpen(true)}
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold shadow-md shadow-indigo-200 transition"
              >
                <Plus className="h-4 w-4" /> အခန်းခွဲအသစ် ထည့်သွင်းမည် (Add Class Section)
              </button>
            </div>
          </div>
        ) : viewMode === 'grouped' ? (
          /* Grouped by Grade View */
          <div className="p-6 space-y-6">
            {Object.entries(classesByGrade)
              .filter(([grade, items]) => {
                if (selectedGradeFilter !== 'ALL' && grade !== selectedGradeFilter) return false;
                if (selectedStageFilter !== 'ALL' && getStageInfo(grade).stage !== selectedStageFilter) return false;
                // If filtering by search, hide empty grades
                if (searchTerm && items.length === 0) return false;
                return true;
              })
              .map(([grade, items]) => {
                const stageInfo = getStageInfo(grade);
                return (
                  <div
                    key={grade}
                    className="rounded-xl border border-slate-200 bg-white overflow-hidden shadow-sm hover:border-slate-300 transition"
                  >
                    {/* Grade Header */}
                    <div className="px-5 py-3.5 bg-slate-50/80 border-b border-slate-200 flex flex-wrap items-center justify-between gap-3">
                      <div className="flex items-center gap-2.5">
                        <span className="text-base font-black text-slate-900 tracking-tight">{grade}</span>
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${stageInfo.badgeClass}`}>
                          {stageInfo.label}
                        </span>
                        <span className="text-xs text-slate-400 font-medium">
                          {items.length} {items.length === 1 ? 'Section' : 'Sections'}
                        </span>
                        <span className="inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full bg-slate-100 text-slate-700 border border-slate-200">
                          <Users className="h-3 w-3 text-slate-500" />
                          ကျောင်းသား {studentCountByGrade.get(grade) || 0} ဦး
                        </span>
                      </div>

                      <button
                        onClick={() => {
                          setNewGradeLevel(grade);
                          const nextLetter = String.fromCharCode(65 + items.length); // A, B, C, D...
                          const secName = `Section ${nextLetter}`;
                          setNewSectionName(secName);
                          setNewClassName(`${grade} - ${secName}`);
                          setModalOpen(true);
                        }}
                        className="inline-flex items-center gap-1 text-xs font-bold text-indigo-600 hover:text-indigo-800 hover:bg-indigo-50 px-2.5 py-1 rounded-lg transition"
                      >
                        <Plus className="h-3.5 w-3.5" /> Add Section to {grade}
                      </button>
                    </div>

                    {/* Sections List in this Grade */}
                    {items.length === 0 ? (
                      <div className="p-6 text-center text-xs text-slate-400 italic">
                        No sections currently registered for {grade}. Click "+ Add Section to {grade}" to create one.
                      </div>
                    ) : (
                      <div className="divide-y divide-slate-100">
                        {items.map((cls) => {
                          const teacherName = facultyMap.get(cls.teacher_id) || 'Facility Faculty';
                          return (
                            <div
                              key={cls.id}
                              onClick={() => navigate(`${basePath}/classes/${getClassSlug(cls)}${location.search}`)}
                              className="px-5 py-3.5 flex items-center justify-between gap-3 hover:bg-indigo-50/40 cursor-pointer transition group"
                              title={`${cls.name} အသေးစိတ်နှင့် ထိုင်ခုံပုံစံ ကြည့်ရန် နှိပ်ပါ`}
                            >
                              <div className="flex items-center gap-3">
                                <div className="w-8 h-8 rounded-lg bg-indigo-50 border border-indigo-100 text-indigo-700 font-bold flex items-center justify-center text-xs group-hover:bg-indigo-600 group-hover:text-white transition">
                                  {cls.name.includes('Section')
                                    ? cls.name.split('Section')[1]?.trim() || 'A'
                                    : cls.name.slice(0, 3)}
                                </div>
                                <div>
                                  <div className="text-sm font-bold text-slate-900 group-hover:text-indigo-600 transition">
                                    {cls.name}
                                  </div>
                                  <p className="text-xs text-slate-600 mt-0.5 flex items-center gap-2">
                                    <span className="font-mono text-slate-500">{cls.academic_year}</span>
                                    <span>အတန်းပိုင် : <strong className="font-semibold text-slate-800">{formatTeacherName(teacherName)}</strong></span>
                                  </p>
                                </div>
                              </div>

                              <div className="flex items-center gap-2.5">
                                <span className="inline-flex items-center gap-1 text-xs font-bold px-2.5 py-1 rounded-full bg-indigo-50 text-indigo-700 border border-indigo-200">
                                  <Users className="h-3 w-3 text-indigo-500" />
                                  {studentCountByClass.get(cls.id) || 0} ဦး
                                </span>
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleDeleteClass(cls.id, cls.name);
                                  }}
                                  disabled={deletingId === cls.id}
                                  className="p-1.5 rounded-lg border border-slate-200 text-slate-400 hover:text-rose-600 hover:border-rose-200 hover:bg-rose-50 transition"
                                  title="Remove section"
                                >
                                  {deletingId === cls.id ? (
                                    <div className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-rose-600 border-t-transparent" />
                                  ) : (
                                    <Trash2 className="h-3.5 w-3.5" />
                                  )}
                                </button>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })}
          </div>
        ) : (
          /* Flat Table View */
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-sm">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 text-[11px] font-bold uppercase tracking-wider text-slate-500">
                  <th className="py-3.5 px-5">အတန်းနှင့် အခန်းခွဲ</th>
                  <th className="py-3.5 px-4">အတန်းအဆင့်</th>
                  <th className="py-3.5 px-4">ပညာသင်နှစ်</th>
                  <th className="py-3.5 px-4">အတန်းပိုင်</th>
                  <th className="py-3.5 px-4">ကျောင်းသားဦးရေ</th>
                  <th className="py-3.5 px-5 text-right">လုပ်ဆောင်ချက်</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredClasses.map((cls) => {
                  const teacherName = facultyMap.get(cls.teacher_id) || 'Facility Faculty';
                  const stageInfo = getStageInfo(cls.grade_level);
                  return (
                    <tr
                      key={cls.id}
                      onClick={() => navigate(`${basePath}/classes/${getClassSlug(cls)}${location.search}`)}
                      className="hover:bg-indigo-50/40 cursor-pointer transition group"
                      title={`${cls.name} အသေးစိတ်နှင့် ထိုင်ခုံပုံစံ ကြည့်ရန် နှိပ်ပါ`}
                    >
                      <td className="py-3.5 px-5 font-bold text-slate-900 group-hover:text-indigo-600 transition">{cls.name}</td>
                      <td className="py-3.5 px-4">
                        <span className={`text-xs font-semibold px-2 py-0.5 rounded-full border ${stageInfo.badgeClass}`}>
                          {cls.grade_level}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 text-xs text-slate-600 font-mono">
                        {cls.academic_year}
                      </td>
                      <td className="py-3.5 px-4 text-xs text-slate-800 font-medium">
                        {formatTeacherName(teacherName)}
                      </td>
                      <td className="py-3.5 px-4 text-xs font-bold">
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-indigo-50 text-indigo-700 border border-indigo-200">
                          <Users className="h-3 w-3 text-indigo-500" />
                          {studentCountByClass.get(cls.id) || 0} ဦး
                        </span>
                      </td>
                      <td className="py-3.5 px-5 text-right">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDeleteClass(cls.id, cls.name);
                          }}
                          disabled={deletingId === cls.id}
                          className="p-1.5 rounded-lg border border-slate-200 text-slate-400 hover:text-rose-600 hover:border-rose-200 hover:bg-rose-50 transition inline-block"
                          title="Remove section"
                        >
                          {deletingId === cls.id ? (
                            <div className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-rose-600 border-t-transparent" />
                          ) : (
                            <Trash2 className="h-3.5 w-3.5" />
                          )}
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Move / Transfer Students Modal */}
      {moveModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-sm animate-in fade-in duration-150">
          <div className="bg-white rounded-2xl max-w-xl w-full p-6 shadow-2xl border border-slate-200 relative animate-in zoom-in-95 duration-150 max-h-[90vh] flex flex-col">
            <button
              onClick={() => {
                setMoveModalOpen(false);
                setSelectedStudentIds([]);
              }}
              className="absolute top-4 right-4 p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100"
            >
              <X className="h-5 w-5" />
            </button>

            {/* Header */}
            <div className="flex items-center gap-2.5 mb-1">
              <div className="p-2.5 rounded-xl bg-emerald-50 text-emerald-600 border border-emerald-100">
                <ArrowRightLeft className="h-5 w-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900">ကျောင်းသားများ အတန်းပြောင်းရွှေ့ရန်</h3>
                <p className="text-xs text-slate-500">Move Students Between Classes & Sections</p>
              </div>
            </div>

            {/* Quick Action Banner for KG -> Grade 1 & 2 */}
            <div className="mt-4 p-3 bg-emerald-50/60 border border-emerald-200 rounded-xl flex items-center justify-between gap-3">
              <div>
                <div className="text-xs font-bold text-emerald-900 flex items-center gap-1.5">
                  <Sparkles className="h-3.5 w-3.5 text-emerald-600" />
                  လျင်မြန်စွာ အတန်းခွဲဝေခြင်း (Quick 50% Split)
                </div>
                <div className="text-[11px] text-emerald-700 mt-0.5">
                  KG ကျောင်းသား ထက်ဝက်ကို Grade 1 နှင့် Grade 2 သို့ ချက်ချင်း ခွဲဝေပြောင်းရွှေ့မည်
                </div>
              </div>
              <button
                type="button"
                onClick={handleQuickMoveHalfToG1AndG2}
                disabled={moving}
                className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold shadow-sm transition flex items-center gap-1 flex-shrink-0"
              >
                {moving ? (
                  <div className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-white border-t-transparent" />
                ) : (
                  <ArrowRightLeft className="h-3.5 w-3.5" />
                )}
                ခွဲဝေရွှေ့ပြောင်းမည်
              </button>
            </div>

            <div className="mt-4 space-y-4 overflow-y-auto flex-1 pr-1">
              {/* Class Selectors Row */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {/* Source Class */}
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1">
                    မူလအတန်း (Source Class)
                  </label>
                  <select
                    value={sourceClassId}
                    onChange={(e) => {
                      setSourceClassId(e.target.value);
                      setSelectedStudentIds([]);
                    }}
                    className="block w-full rounded-lg border border-slate-300 px-3 py-2 text-xs font-medium text-slate-900 shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 bg-white"
                  >
                    <option value="">-- မူလအတန်း ရွေးပါ --</option>
                    {classes.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name} ({studentCountByClass.get(c.id) || 0} ဦး)
                      </option>
                    ))}
                  </select>
                </div>

                {/* Target Class */}
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1">
                    ပြောင်းရွှေ့မည့် အတန်း (Target Class)
                  </label>
                  <select
                    value={targetClassId}
                    onChange={(e) => setTargetClassId(e.target.value)}
                    className="block w-full rounded-lg border border-slate-300 px-3 py-2 text-xs font-medium text-slate-900 shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 bg-white"
                  >
                    <option value="">-- ပြောင်းရွှေ့မည့်အတန်း ရွေးပါ --</option>
                    {classes
                      .filter((c) => c.id !== sourceClassId)
                      .map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.name} ({studentCountByClass.get(c.id) || 0} ဦး)
                        </option>
                      ))}
                  </select>
                </div>
              </div>

              {/* Student Checklist */}
              {sourceClassId && (
                <div className="border border-slate-200 rounded-xl overflow-hidden">
                  <div className="px-3.5 py-2 bg-slate-50 border-b border-slate-200 flex items-center justify-between text-xs">
                    <span className="font-bold text-slate-700">
                      ကျောင်းသားများ ရွေးချယ်ရန် ({selectedStudentIds.length} / {sourceClassStudents.length} ဦး)
                    </span>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => setSelectedStudentIds(sourceClassStudents.map((s) => s.id))}
                        className="text-xs font-bold text-indigo-600 hover:text-indigo-800"
                      >
                        အားလုံးရွေးမည်
                      </button>
                      <span className="text-slate-300">|</span>
                      <button
                        type="button"
                        onClick={() => setSelectedStudentIds([])}
                        className="text-xs font-bold text-slate-500 hover:text-slate-700"
                      >
                        ဖျက်မည်
                      </button>
                    </div>
                  </div>

                  <div className="max-h-56 overflow-y-auto divide-y divide-slate-100 p-1">
                    {sourceClassStudents.length === 0 ? (
                      <div className="p-4 text-center text-xs text-slate-400">
                        ဤအတန်းတွင် ကျောင်းသား မရှိသေးပါ
                      </div>
                    ) : (
                      sourceClassStudents.map((st) => {
                        const isSelected = selectedStudentIds.includes(st.id);
                        return (
                          <label
                            key={st.id}
                            className={`flex items-center justify-between px-3 py-2 rounded-lg cursor-pointer transition text-xs ${
                              isSelected ? 'bg-indigo-50/70 font-semibold text-indigo-900' : 'hover:bg-slate-50 text-slate-700'
                            }`}
                          >
                            <div className="flex items-center gap-2.5">
                              <input
                                type="checkbox"
                                checked={isSelected}
                                onChange={(e) => {
                                  if (e.target.checked) {
                                    setSelectedStudentIds((prev) => [...prev, st.id]);
                                  } else {
                                    setSelectedStudentIds((prev) => prev.filter((id) => id !== st.id));
                                  }
                                }}
                                className="h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                              />
                              <span>{st.full_name}</span>
                            </div>
                            <span className="text-[11px] font-mono text-slate-400">
                              {st.email.split('@')[0]}
                            </span>
                          </label>
                        );
                      })
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="mt-5 flex items-center justify-between gap-3 pt-3 border-t border-slate-100">
              <span className="text-xs text-slate-500">
                {selectedStudentIds.length} ဦး ရွေးချယ်ထားပါသည်
              </span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setMoveModalOpen(false);
                    setSelectedStudentIds([]);
                  }}
                  className="px-4 py-2 rounded-lg border border-slate-300 text-xs font-bold text-slate-700 hover:bg-slate-50 transition"
                >
                  မလုပ်တော့ပါ (Cancel)
                </button>
                <button
                  type="button"
                  onClick={handleMoveStudents}
                  disabled={moving || !targetClassId || selectedStudentIds.length === 0}
                  className="px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed text-xs font-bold text-white shadow transition flex items-center gap-1.5"
                >
                  {moving && (
                    <div className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-white border-t-transparent" />
                  )}
                  အတန်းပြောင်းရွှေ့မည် ({selectedStudentIds.length} ဦး)
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Add Class Section Modal */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-sm animate-in fade-in duration-150">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200 relative animate-in zoom-in-95 duration-150">
            <button
              onClick={() => setModalOpen(false)}
              className="absolute top-4 right-4 p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100"
            >
              <X className="h-5 w-5" />
            </button>

            <div className="flex items-center gap-2 mb-1">
              <div className="p-2 rounded-lg bg-indigo-50 text-indigo-600">
                <BookOpen className="h-5 w-5" />
              </div>
              <h3 className="text-lg font-bold text-slate-900">Add Academic Class Section</h3>
            </div>
            <p className="text-xs text-slate-500 mb-5">
              Create a section registered strictly under <strong className="text-slate-700">{school ? (school.name_my || school.name) : 'this facility'}</strong>
            </p>

            <form onSubmit={handleCreateClass} className="space-y-4">
              {/* Grade Level Selection */}
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1">
                  Grade Level
                </label>
                <select
                  value={newGradeLevel}
                  onChange={(e) => handleGradeChange(e.target.value)}
                  className="block w-full rounded-lg border border-slate-300 px-3.5 py-2 text-sm text-slate-900 shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 bg-white"
                >
                  {STANDARD_GRADES.map((g) => (
                    <option key={g} value={g}>
                      {g} ({getStageInfo(g).label})
                    </option>
                  ))}
                  <option value="Advanced / Special">Special Track</option>
                </select>
              </div>

              {/* Quick Section Chips */}
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1.5">
                  Section Designation
                </label>
                <div className="flex flex-wrap gap-1.5 mb-2">
                  {DEFAULT_SECTIONS.map((sec) => (
                    <button
                      key={sec}
                      type="button"
                      onClick={() => handleSectionChange(sec)}
                      className={`px-3 py-1 text-xs font-bold rounded-lg border transition ${
                        newSectionName === sec
                          ? 'bg-indigo-600 text-white border-indigo-600 shadow-sm'
                          : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                      }`}
                    >
                      {sec}
                    </button>
                  ))}
                </div>
                <input
                  type="text"
                  required
                  value={newSectionName}
                  onChange={(e) => handleSectionChange(e.target.value)}
                  placeholder="e.g. Section A, Section B"
                  className="block w-full rounded-lg border border-slate-300 px-3.5 py-2 text-sm text-slate-900 shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                />
              </div>

              {/* Class Name (Auto-composed or customizable) */}
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1">
                  Full Class Name
                </label>
                <input
                  type="text"
                  required
                  value={newClassName}
                  onChange={(e) => setNewClassName(e.target.value)}
                  placeholder="e.g. Grade 1 - Section A"
                  className="block w-full rounded-lg border border-slate-300 px-3.5 py-2 text-sm text-slate-900 shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 font-medium"
                />
              </div>

              {/* Faculty / Teacher Assignment */}
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1">
                  အတန်းပိုင် ဆရာ/ဆရာမ
                </label>
                <select
                  value={selectedTeacherId}
                  onChange={(e) => setSelectedTeacherId(e.target.value)}
                  className="block w-full rounded-lg border border-slate-300 px-3.5 py-2 text-sm text-slate-900 shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 bg-white"
                >
                  {faculty.length === 0 ? (
                    <option value="">တာဝန်ခံ ဆရာ/ဆရာမ (Auto-assigned)</option>
                  ) : (
                    faculty.map((f) => (
                      <option key={f.id} value={f.id}>
                        {formatTeacherName(f.full_name)} ({f.role})
                      </option>
                    ))
                  )}
                </select>
                <p className="text-[11px] text-slate-400 mt-1">
                  Selected faculty member will manage attendance and records for this section.
                </p>
              </div>

              {/* Academic Year */}
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1">
                  Academic Year
                </label>
                <input
                  type="text"
                  required
                  value={newAcademicYear}
                  onChange={(e) => setNewAcademicYear(e.target.value)}
                  placeholder="e.g. 2026-2027"
                  className="block w-full rounded-lg border border-slate-300 px-3.5 py-2 text-sm text-slate-900 shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 font-mono"
                />
              </div>

              <div className="mt-6 flex justify-end gap-3 pt-4 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  className="px-4 py-2 rounded-lg border border-slate-300 text-xs font-bold text-slate-700 hover:bg-slate-50 transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={creating}
                  className="px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-xs font-bold text-white shadow transition flex items-center gap-1.5"
                >
                  {creating && (
                    <div className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-white border-t-transparent" />
                  )}
                  Create Section
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Searchable School Switcher Modal with IndexedDB SWR */}
      <SchoolSwitcherModal
        isOpen={switcherOpen}
        onClose={() => setSwitcherOpen(false)}
        currentSchoolId={effectiveSchoolId}
        onSelect={(selected) => {
          setSearchParams({ school_id: selected.id });
        }}
      />
    </div>
  );
};
