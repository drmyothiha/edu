import React, { useEffect, useState, useMemo } from 'react';
import { api } from '../api/client';
import { SchoolDTO, ClassDTO, SchoolStudentDTO, CreateSchoolStudentRequest } from '../types';
import { useAuth } from '../context/AuthContext';
import { useConfirm } from '../context/ConfirmDialogContext';
import {
  Building,
  GraduationCap,
  Users,
  Plus,
  X,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  MapPin,
  Phone,
  Trash2,
  Search,
  ShieldCheck,
  Sparkles,
  BookOpen,
  Filter,
  ChevronRight,
  Printer,
} from 'lucide-react';
import { useSearchParams, useNavigate, useLocation, Link } from 'react-router-dom';
import { MassStudentCardPrintModal } from '../components/MassStudentCardPrintModal';
import { SchoolSwitcherModal } from '../components/SchoolSwitcherModal';

const ALL_GRADES = [
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

const getGradeStageLabel = (grade: string) => {
  if (grade === 'KG') return { label: 'မူကြို', badgeClass: 'bg-amber-100 text-amber-800 border-amber-200' };
  const num = parseInt(grade.replace(/\D/g, ''), 10);
  if (num >= 1 && num <= 5) return { label: 'မူလတန်း', badgeClass: 'bg-emerald-100 text-emerald-800 border-emerald-200' };
  if (num >= 6 && num <= 9) return { label: 'အလယ်တန်း', badgeClass: 'bg-sky-100 text-sky-800 border-sky-200' };
  if (num >= 10 && num <= 12) return { label: 'အထက်တန်း', badgeClass: 'bg-indigo-100 text-indigo-800 border-indigo-200' };
  return { label: 'အခြား', badgeClass: 'bg-slate-100 text-slate-800 border-slate-200' };
};

export const SchoolStudentsPage: React.FC = () => {
  const { user } = useAuth();
  const { confirm } = useConfirm();
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams, setSearchParams] = useSearchParams();
  const urlSchoolId = searchParams.get('school_id');

  const [school, setSchool] = useState<SchoolDTO | null>(null);
  const [students, setStudents] = useState<SchoolStudentDTO[]>([]);
  const [classes, setClasses] = useState<ClassDTO[]>([]);
  const [loading, setLoading] = useState(true);
  const [seeding, setSeeding] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [switcherOpen, setSwitcherOpen] = useState(false);

  // Filter & Search
  const [selectedGrade, setSelectedGrade] = useState<string>('ALL');
  const [searchTerm, setSearchTerm] = useState('');

  // Add Student Modal
  const [addModalOpen, setAddModalOpen] = useState(false);
  const [newStudentName, setNewStudentName] = useState('');
  const [newStudentEmail, setNewStudentEmail] = useState('');
  const [newClassId, setNewClassId] = useState('');
  const [creating, setCreating] = useState(false);

  // Deleting state
  const [deletingId, setDeletingId] = useState<string | null>(null);

  // Mass Print Modal
  const [massPrintModalOpen, setMassPrintModalOpen] = useState(false);
  const [massPrintClassId, setMassPrintClassId] = useState<string | undefined>(undefined);
  const [massPrintGrade, setMassPrintGrade] = useState<string | undefined>(undefined);

  // Determine effective school ID
  const basePath = location.pathname.startsWith('/admin') ? '/admin' : '/school-admin';
  const effectiveSchoolId = useMemo(() => {
    if (urlSchoolId) return urlSchoolId;
    if (user?.school_id) return user.school_id;
    return 'a0000000-0000-0000-0000-000000000001';
  }, [urlSchoolId, user?.school_id]);

  // Fetch school data, students, and classes
  const fetchStudentsData = async () => {
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

        const [stList, clsList] = await Promise.all([
          api.students.listBySchool(effectiveSchoolId),
          api.classes.list(effectiveSchoolId),
        ]);
        setStudents(stList);
        setClasses(clsList);
        if (clsList.length > 0 && !newClassId) {
          setNewClassId(clsList[0].id);
        }
      }
    } catch (err: any) {
      setError(err.message || 'ကျောင်းသားများ စာရင်း ရယူရာတွင် အမှားဖြစ်ပေါ်ပါသည်');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStudentsData();
  }, [effectiveSchoolId, user]);

  // Handle Create Student
  const handleCreateStudent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newStudentName.trim()) {
      setError('ကျောင်းသား အမည် ထည့်သွင်းပေးပါ');
      return;
    }

    setCreating(true);
    setError(null);
    try {
      const payload: CreateSchoolStudentRequest = {
        full_name: newStudentName.trim(),
        email: newStudentEmail.trim() || undefined,
        class_id: newClassId || undefined,
      };

      const created = await api.students.create(effectiveSchoolId, payload);
      setStudents((prev) => [...prev, created]);
      setSuccessMsg(`ကျောင်းသား "${created.full_name}" အား အောင်မြင်စွာ ထည့်သွင်းပြီးပါပြီ။`);
      setAddModalOpen(false);
      setNewStudentName('');
      setNewStudentEmail('');
    } catch (err: any) {
      setError(err.message || 'ကျောင်းသား အသစ် ထည့်သွင်းခြင်း မအောင်မြင်ပါ');
    } finally {
      setCreating(false);
    }
  };

  // Handle Seed Sample Students
  const handleSeedSampleStudents = async () => {
    const isConfirmed = await confirm({
      title: 'နမူနာ ကျောင်းသားများ ထည့်သွင်းရန် (Seed Sample Students)',
      message: 'KG မှ Grade 12 အထိ နမူနာ ကျောင်းသားများ အားလုံးအား အလိုအလျောက် ထည့်သွင်းပေးရန် သေချာပါသလား?',
      confirmText: 'ထည့်သွင်းမည် (Seed Students)',
      cancelText: 'မလုပ်တော့ပါ (Cancel)',
      variant: 'info',
    });
    if (!isConfirmed) {
      return;
    }

    setSeeding(true);
    setError(null);
    try {
      const seeded = await api.students.seedSample(effectiveSchoolId);
      setStudents(seeded);
      setSuccessMsg(`KG မှ Grade 12 အထိ နမူနာ ကျောင်းသား ${seeded.length} ဦးအား အောင်မြင်စွာ ထည့်သွင်းပြီးပါပြီ။`);
    } catch (err: any) {
      setError(err.message || 'နမူနာ ကျောင်းသားများ ထည့်သွင်းခြင်း မအောင်မြင်ပါ');
    } finally {
      setSeeding(false);
    }
  };

  // Handle Delete Student
  const handleDeleteStudent = async (student: SchoolStudentDTO) => {
    const isConfirmed = await confirm({
      title: 'ကျောင်းသား ပယ်ဖျက်ရန် (Delete Student)',
      message: `ကျောင်းသား "${student.full_name}" အား စာရင်းမှ ပယ်ဖျက်ရန် သေချာပါသလား?`,
      confirmText: 'ပယ်ဖျက်မည် (Delete)',
      cancelText: 'မလုပ်တော့ပါ (Cancel)',
      variant: 'danger',
      cautionText: 'ဤလုပ်ဆောင်ချက်ကို ပြန်လည်ပြင်ဆင်၍ မရနိုင်ပါ (This action cannot be undone)',
    });
    if (!isConfirmed) {
      return;
    }

    setDeletingId(student.id);
    setError(null);
    try {
      await api.students.delete(effectiveSchoolId, student.id);
      setStudents((prev) => prev.filter((s) => s.id !== student.id));
      setSuccessMsg(`ကျောင်းသား "${student.full_name}" အား ပယ်ဖျက်ပြီးပါပြီ။`);
    } catch (err: any) {
      setError(err.message || 'ကျောင်းသား ပယ်ဖျက်ခြင်း မအောင်မြင်ပါ');
    } finally {
      setDeletingId(null);
    }
  };

  // Count students by grade
  const gradeCountMap = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const g of ALL_GRADES) {
      counts[g] = 0;
    }
    for (const st of students) {
      const g = st.grade_level || 'Other';
      counts[g] = (counts[g] || 0) + 1;
    }
    return counts;
  }, [students]);

  // Filter students based on grade & search term
  const filteredStudents = useMemo(() => {
    return students.filter((st) => {
      // Grade filter
      if (selectedGrade !== 'ALL') {
        if (st.grade_level !== selectedGrade) {
          return false;
        }
      }
      // Search filter
      if (searchTerm) {
        const term = searchTerm.toLowerCase();
        const matchesName = st.full_name.toLowerCase().includes(term);
        const matchesEmail = st.email.toLowerCase().includes(term);
        const matchesClass = st.class_name?.toLowerCase().includes(term);
        const matchesGrade = st.grade_level?.toLowerCase().includes(term);
        return matchesName || matchesEmail || matchesClass || matchesGrade;
      }
      return true;
    });
  }, [students, selectedGrade, searchTerm]);

  // Group filtered students by grade
  const groupedStudents = useMemo(() => {
    const map = new Map<string, SchoolStudentDTO[]>();
    for (const g of ALL_GRADES) {
      map.set(g, []);
    }

    for (const st of filteredStudents) {
      const grade = st.grade_level || 'KG';
      if (!map.has(grade)) {
        map.set(grade, []);
      }
      map.get(grade)!.push(st);
    }
    return map;
  }, [filteredStudents]);

  return (
    <div className="p-6 md:p-8 max-w-7xl mx-auto w-full space-y-6">
      {/* Top Facility Header & School Switcher */}
      <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="p-3.5 rounded-2xl bg-gradient-to-br from-indigo-600 to-indigo-800 text-white shadow-md">
            <Building className="h-7 w-7" />
          </div>
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-2xl font-black text-slate-900 tracking-tight">
                {school ? (school.name_my || school.name) : 'School Facility Center'}
              </h1>
              {school && (
                <span className="font-mono text-xs px-2.5 py-0.5 rounded-full bg-indigo-50 text-indigo-700 font-bold border border-indigo-200">
                  {school.code}
                </span>
              )}
              <span className="inline-flex items-center gap-1 font-mono text-[11px] px-2 py-0.5 rounded bg-emerald-50 text-emerald-700 font-semibold border border-emerald-200">
                <ShieldCheck className="h-3 w-3 text-emerald-600" /> Facility Isolated
              </span>
            </div>

            <div className="flex flex-wrap items-center gap-3 mt-1.5 text-xs text-slate-500">
              <span className="font-sans font-medium text-slate-700">ကျောင်းတွင်း ကျောင်းသားများ စာရင်း • Student Enrollment Portal</span>
              {school && (
                <>
                  <span>•</span>
                  <span className="flex items-center gap-1 text-slate-600">
                    <MapPin className="h-3.5 w-3.5 text-slate-400" />
                    {school.city}, {school.region}
                  </span>
                  {school.phone && (
                    <>
                      <span>•</span>
                      <span className="flex items-center gap-1 font-mono text-slate-600">
                        <Phone className="h-3 w-3 text-slate-400" />
                        {school.phone}
                      </span>
                    </>
                  )}
                </>
              )}
            </div>
          </div>
        </div>

        {/* Facility Actions & Multi-School Switcher */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Fast IndexedDB School Switcher for sysadmin or admin */}
          {(user?.role === 'sysadmin' || user?.role === 'admin') && (
            <>
              <button
                type="button"
                onClick={() => setSwitcherOpen(true)}
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-indigo-200 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 text-xs font-semibold shadow-sm transition"
                title="Switch School Facility via IndexedDB Directory"
              >
                <Building className="h-3.5 w-3.5 text-indigo-600" /> ကျောင်းပြောင်းရန် (Switch School)
              </button>
              <Link
                to="/sysadmin"
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs font-semibold shadow-sm transition"
                title="Return to Sysadmin Schools Directory"
              >
                ကျောင်းများ စာရင်း (Schools)
              </Link>
            </>
          )}

          <button
            onClick={fetchStudentsData}
            className="p-2 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-600 text-xs font-semibold flex items-center gap-1.5 shadow-sm transition"
            title="Refresh student roster"
          >
            <RefreshCw className="h-3.5 w-3.5" /> ပြန်လည်ရယူရန်
          </button>

          {students.length === 0 && (
            <button
              onClick={handleSeedSampleStudents}
              disabled={seeding}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow transition disabled:opacity-50"
              title="KG မှ Grade 12 အထိ နမူနာ ကျောင်းသားများ ထည့်သွင်းရန်"
            >
              <Sparkles className="h-3.5 w-3.5" />
              <span>{seeding ? 'ထည့်သွင်းနေသည်...' : 'နမူနာ ကျောင်းသားများ ထည့်သွင်းရန်'}</span>
            </button>
          )}

          <button
            onClick={() => {
              setMassPrintClassId(undefined);
              setMassPrintGrade(selectedGrade !== 'ALL' ? selectedGrade : undefined);
              setMassPrintModalOpen(true);
            }}
            disabled={students.length === 0}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold shadow transition disabled:opacity-50"
            title="ကျောင်းသားကတ်များ အစုလိုက် ပရင့်ထုတ်ရန် (PVC / A4 Paper)"
          >
            <Printer className="h-4 w-4 text-amber-400" />
            <span>ကတ်များ အစုလိုက် ထုတ်ယူရန် (Mass Print)</span>
          </button>

          <button
            onClick={() => setAddModalOpen(true)}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold shadow transition"
          >
            <Plus className="h-4 w-4" /> ကျောင်းသား အသစ်ထည့်ရန်
          </button>
        </div>
      </div>

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

      {/* Grade Level Filter Pills (KG to Grade 12) */}
      <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-sm space-y-3">
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <GraduationCap className="h-5 w-5 text-indigo-600" />
            <span className="text-sm font-bold text-slate-800">အတန်းအလိုက် စစ်ထုတ်ရန် (KG, Grade 1 to 12):</span>
          </div>

          {/* Search bar */}
          <div className="relative w-full sm:w-72">
            <Search className="h-4 w-4 text-slate-400 absolute left-3 top-2.5" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="ကျောင်းသားအမည်၊ ခုံနံပါတ်၊ အခန်း..."
              className="w-full pl-9 pr-3 py-1.5 text-xs bg-slate-50 hover:bg-white border border-slate-300 rounded-lg text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
            {searchTerm && (
              <button
                onClick={() => setSearchTerm('')}
                className="absolute right-2.5 top-2 text-slate-400 hover:text-slate-600"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
        </div>

        {/* Top Pills */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-thin">
          <button
            onClick={() => setSelectedGrade('ALL')}
            className={`px-3 py-1.5 rounded-full text-xs font-bold transition flex items-center gap-1.5 whitespace-nowrap shadow-xs ${
              selectedGrade === 'ALL'
                ? 'bg-indigo-600 text-white shadow-sm'
                : 'bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200'
            }`}
          >
            <span>အတန်းအားလုံး</span>
            <span
              className={`text-[10px] px-1.5 py-0.2 rounded-full ${
                selectedGrade === 'ALL' ? 'bg-indigo-700 text-white' : 'bg-slate-200 text-slate-700'
              }`}
            >
              {students.length}
            </span>
          </button>

          {ALL_GRADES.map((grade) => {
            const count = gradeCountMap[grade] || 0;
            const isSelected = selectedGrade === grade;
            return (
              <button
                key={grade}
                onClick={() => setSelectedGrade(grade)}
                className={`px-3 py-1.5 rounded-full text-xs font-bold transition flex items-center gap-1.5 whitespace-nowrap shadow-xs ${
                  isSelected
                    ? 'bg-indigo-600 text-white shadow-sm'
                    : 'bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200'
                }`}
              >
                <span>{grade}</span>
                <span
                  className={`text-[10px] px-1.5 py-0.2 rounded-full ${
                    isSelected ? 'bg-indigo-700 text-white' : 'bg-slate-200 text-slate-700'
                  }`}
                >
                  {count}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Main Student Content */}
      {loading ? (
        <div className="py-20 text-center bg-white rounded-2xl border border-slate-200 shadow-sm">
          <RefreshCw className="h-8 w-8 text-indigo-500 animate-spin mx-auto mb-2" />
          <p className="text-sm text-slate-500">ကျောင်းသားများ စာရင်းအား ရယူနေပါသည်...</p>
        </div>
      ) : filteredStudents.length === 0 ? (
        <div className="py-16 text-center px-4 bg-white rounded-2xl border border-slate-200 shadow-sm">
          <GraduationCap className="h-12 w-12 text-slate-300 mx-auto mb-3" />
          <h3 className="text-sm font-bold text-slate-700">ကျောင်းသား စာရင်း မတွေ့ရှိပါ</h3>
          <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
            {searchTerm
              ? 'ရှာဖွေမှုနှင့် ကိုက်ညီသော ကျောင်းသား မရှိပါ။'
              : 'ဤကျောင်းတွင် ကျောင်းသား စာရင်း မရှိသေးပါ။ နမူနာ ကျောင်းသားများ ထည့်သွင်းနိုင်ပါသည် သို့မဟုတ် အသစ် ထည့်သွင်းနိုင်ပါသည်။'}
          </p>
          <div className="flex items-center justify-center gap-2 mt-4">
            <button
              onClick={handleSeedSampleStudents}
              disabled={seeding}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow transition"
            >
              <Sparkles className="h-4 w-4" />
              <span>{seeding ? 'ထည့်သွင်းနေသည်...' : 'နမူနာ ကျောင်းသားများ ထည့်သွင်းရန်'}</span>
            </button>
            <button
              onClick={() => setAddModalOpen(true)}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold shadow transition"
            >
              <Plus className="h-4 w-4" /> ကျောင်းသား အသစ်ထည့်ရန်
            </button>
          </div>
        </div>
      ) : selectedGrade === 'ALL' ? (
        /* Grouped by Grade Sections */
        <div className="space-y-6">
          {ALL_GRADES.map((grade) => {
            const list = groupedStudents.get(grade) || [];
            if (list.length === 0 && searchTerm) return null; // hide empty sections if searching
            const stage = getGradeStageLabel(grade);

            return (
              <div
                key={grade}
                className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden"
              >
                {/* Grade Section Header */}
                <div className="px-5 py-3.5 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <span className="font-extrabold text-slate-900 text-sm">{grade}</span>
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${stage.badgeClass}`}>
                      {stage.label}
                    </span>
                    <span className="text-xs text-slate-500 font-medium">({list.length} ဦး)</span>
                  </div>

                  <div className="flex items-center gap-2">
                    {list.length > 0 && (
                      <button
                        onClick={() => {
                          setMassPrintClassId(undefined);
                          setMassPrintGrade(grade);
                          setMassPrintModalOpen(true);
                        }}
                        className="inline-flex items-center gap-1 text-[11px] font-bold text-slate-700 hover:text-indigo-600 bg-white border border-slate-200 hover:border-indigo-300 px-2.5 py-1 rounded-lg transition shadow-2xs"
                        title="ဤအတန်း ကတ်များအားလုံး ပရင့်ထုတ်ရန်"
                      >
                        <Printer className="h-3 w-3 text-indigo-500" />
                        <span>ကတ်ထုတ်ရန်</span>
                      </button>
                    )}

                    <button
                      onClick={() => {
                        const matchedClass = classes.find((c) => c.grade_level === grade);
                        if (matchedClass) setNewClassId(matchedClass.id);
                        setAddModalOpen(true);
                      }}
                      className="inline-flex items-center gap-1 text-[11px] font-bold text-indigo-600 hover:text-indigo-800 transition"
                    >
                      <Plus className="h-3 w-3" />
                      <span>ကျောင်းသားထည့်ရန်</span>
                    </button>
                  </div>
                </div>

                {/* Grade Student Cards */}
                {list.length === 0 ? (
                  <div className="py-6 text-center text-xs text-slate-400 italic">
                    ဤအတန်းတွင် ကျောင်းသား စာရင်း မရှိသေးပါ
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 p-4">
                    {list.map((st) => (
                      <div
                        key={st.id}
                        onClick={() => navigate(`${basePath}/students/${st.id}${location.search}`)}
                        className="bg-white rounded-xl border border-slate-200 p-3.5 hover:border-indigo-400 hover:shadow-md cursor-pointer transition flex items-start justify-between gap-3 group"
                        title="ကျောင်းသား အသေးစိတ် အချက်အလက် ကြည့်ရှုရန် နှိပ်ပါ"
                      >
                        <div className="flex items-start gap-3">
                          <div className="h-9 w-9 rounded-full bg-indigo-50 text-indigo-700 font-bold text-xs flex items-center justify-center border border-indigo-200 flex-shrink-0 group-hover:bg-indigo-600 group-hover:text-white transition">
                            {st.full_name ? st.full_name.charAt(0) : 'S'}
                          </div>
                          <div>
                            <h4 className="font-bold text-slate-900 text-xs group-hover:text-indigo-600 transition">
                              {st.full_name}
                            </h4>
                            <div className="text-[10px] text-slate-400 font-mono mt-0.5 truncate max-w-[140px]">
                              {st.email}
                            </div>
                            <div className="mt-1.5 flex items-center gap-1">
                              <span className="text-[10px] font-semibold px-2 py-0.5 rounded bg-slate-100 text-slate-700 border border-slate-200">
                                {st.class_name || 'အတန်းမသတ်မှတ်ရသေး'}
                              </span>
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center gap-1">
                          <span className="text-[11px] font-bold text-indigo-600 opacity-0 group-hover:opacity-100 transition flex items-center gap-0.5 mr-1">
                            <span>အသေးစိတ်</span>
                            <ChevronRight className="h-3.5 w-3.5" />
                          </span>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDeleteStudent(st);
                            }}
                            disabled={deletingId === st.id}
                            className="text-slate-300 hover:text-rose-600 p-1 rounded transition"
                            title="Delete student"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      ) : (
        /* Single Grade Detailed View */
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="p-4 sm:p-5 border-b border-slate-200 flex items-center justify-between bg-slate-50">
            <div className="flex items-center gap-2">
              <h2 className="text-base font-bold text-slate-900">
                {selectedGrade} ကျောင်းသားများ စာရင်း ({filteredStudents.length} ဦး)
              </h2>
            </div>
            <div className="flex items-center gap-2">
              {filteredStudents.length > 0 && (
                <button
                  onClick={() => {
                    setMassPrintClassId(undefined);
                    setMassPrintGrade(selectedGrade);
                    setMassPrintModalOpen(true);
                  }}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold shadow-xs transition"
                  title="ဤအတန်း ကတ်များအားလုံး ပရင့်ထုတ်ရန်"
                >
                  <Printer className="h-3.5 w-3.5 text-amber-400" />
                  <span>{selectedGrade} ကတ်များ ထုတ်ယူရန်</span>
                </button>
              )}

              <button
                onClick={() => {
                  const matchedClass = classes.find((c) => c.grade_level === selectedGrade);
                  if (matchedClass) setNewClassId(matchedClass.id);
                  setAddModalOpen(true);
                }}
                className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold shadow transition"
              >
                <Plus className="h-3.5 w-3.5" />
                <span>ကျောင်းသားထည့်ရန်</span>
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 p-5">
            {filteredStudents.map((st) => (
              <div
                key={st.id}
                onClick={() => navigate(`${basePath}/students/${st.id}${location.search}`)}
                className="bg-white rounded-xl border border-slate-200 p-4 hover:border-indigo-400 hover:shadow-md cursor-pointer transition flex items-start justify-between gap-3 group"
                title="ကျောင်းသား အသေးစိတ် အချက်အလက် ကြည့်ရှုရန် နှိပ်ပါ"
              >
                <div className="flex items-start gap-3">
                  <div className="h-10 w-10 rounded-full bg-gradient-to-tr from-indigo-500 to-indigo-700 text-white font-black text-sm flex items-center justify-center shadow-xs flex-shrink-0 group-hover:scale-105 transition">
                    {st.full_name ? st.full_name.charAt(0) : 'S'}
                  </div>
                  <div>
                    <h4 className="font-bold text-slate-900 text-sm group-hover:text-indigo-600 transition">
                      {st.full_name}
                    </h4>
                    <div className="text-[11px] text-slate-400 font-mono mt-0.5">
                      {st.email}
                    </div>
                    <div className="mt-2 flex items-center gap-1.5">
                      <span className="text-[10px] font-semibold px-2 py-0.5 rounded bg-indigo-50 text-indigo-700 border border-indigo-200">
                        {st.class_name || 'အတန်းမသတ်မှတ်ရသေး'}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-1">
                  <span className="text-xs font-bold text-indigo-600 opacity-0 group-hover:opacity-100 transition flex items-center gap-0.5 mr-1">
                    <span>အသေးစိတ်</span>
                    <ChevronRight className="h-4 w-4" />
                  </span>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDeleteStudent(st);
                    }}
                    disabled={deletingId === st.id}
                    className="text-slate-400 hover:text-rose-600 p-1.5 rounded-lg hover:bg-rose-50 transition"
                    title="Delete student"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Add Student Modal */}
      {addModalOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl max-w-md w-full border border-slate-200 shadow-2xl overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50">
              <div className="flex items-center gap-2">
                <GraduationCap className="h-5 w-5 text-indigo-600" />
                <h3 className="font-bold text-slate-900 text-base">ကျောင်းသား အသစ် ထည့်သွင်းရန်</h3>
              </div>
              <button
                onClick={() => setAddModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-lg"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleCreateStudent} className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  ကျောင်းသား အမည် <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={newStudentName}
                  onChange={(e) => setNewStudentName(e.target.value)}
                  placeholder="ဥပမာ - မောင်ဇွဲမာန် (Mg Zwe Marn)"
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  ခုံနံပါတ် သို့မဟုတ် အီးမေးလ် (ရွေးချယ်ရန်)
                </label>
                <input
                  type="text"
                  value={newStudentEmail}
                  onChange={(e) => setNewStudentEmail(e.target.value)}
                  placeholder="မထည့်ပါက အလိုအလျောက် သတ်မှတ်ပေးပါမည်"
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  တက်ရောက်မည့် အတန်းနှင့် အခန်း (Class Section)
                </label>
                <select
                  value={newClassId}
                  onChange={(e) => setNewClassId(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white"
                >
                  <option value="">-- အတန်းမသတ်မှတ်ပါ --</option>
                  {classes.map((cls) => (
                    <option key={cls.id} value={cls.id}>
                      {cls.name} ({cls.grade_level})
                    </option>
                  ))}
                </select>
              </div>

              <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setAddModalOpen(false)}
                  className="px-4 py-2 rounded-lg border border-slate-300 text-slate-700 text-xs font-bold hover:bg-slate-50 transition"
                >
                  မလုပ်တော့ပါ
                </button>
                <button
                  type="submit"
                  disabled={creating}
                  className="px-5 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold shadow transition disabled:opacity-50 flex items-center gap-1.5"
                >
                  {creating && <RefreshCw className="h-3.5 w-3.5 animate-spin" />}
                  <span>{creating ? 'ထည့်သွင်းနေသည်...' : 'ထည့်သွင်းမည်'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Mass Smart Card Printing Modal (PVC & A4 Multi-Card Paper) */}
      <MassStudentCardPrintModal
        isOpen={massPrintModalOpen}
        onClose={() => setMassPrintModalOpen(false)}
        students={students}
        classes={classes}
        school={school}
        initialClassId={massPrintClassId}
        initialGrade={massPrintGrade}
      />

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
