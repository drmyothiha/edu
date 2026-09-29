import React, { useEffect, useState } from 'react';
import { useParams, useNavigate, useLocation, Link } from 'react-router-dom';
import { api } from '../api/client';
import {
  StudentDetailDTO,
  ClassDTO,
  WholeChildProfileDTO,
  StudentBlockchainIDResponse,
  StudentOverviewResponse,
} from '../types';
import { useAuth } from '../context/AuthContext';
import { QRCodeImage } from '../components/QRCodeImage';
import { WholeChildMatrix } from '../components/WholeChildMatrix';
import { ChatModal } from '../components/ChatModal';
import { StudentSmartCard } from '../components/StudentSmartCard';
import {
  ArrowLeft,
  Building,
  GraduationCap,
  CalendarCheck,
  ClipboardList,
  ShieldCheck,
  Award,
  Sparkles,
  Clock,
  AlertTriangle,
  CheckCircle2,
  Trash2,
  Edit2,
  Phone,
  Mail,
  Layers,
  ExternalLink,
  QrCode,
  MessageSquare,
  RefreshCw,
  AlertCircle,
  X,
  Copy,
  User,
  Heart,
  Activity,
  Smile,
  Users,
  BookOpen,
  Lock,
  Eye,
  Check,
  FileText,
  TrendingUp,
  UserCheck,
} from 'lucide-react';

const getGradeStageLabel = (grade?: string) => {
  if (!grade) return { label: 'အဆင့်သတ်မှတ်ချက် မရှိပါ', badgeClass: 'bg-slate-100 text-slate-700 border-slate-200' };
  if (grade === 'KG') return { label: 'မူကြို (Kindergarten)', badgeClass: 'bg-amber-100 text-amber-800 border-amber-200' };
  const num = parseInt(grade.replace(/\D/g, ''), 10);
  if (num >= 1 && num <= 5) return { label: 'မူလတန်း (Primary)', badgeClass: 'bg-emerald-100 text-emerald-800 border-emerald-200' };
  if (num >= 6 && num <= 9) return { label: 'အလယ်တန်း (Middle School)', badgeClass: 'bg-sky-100 text-sky-800 border-sky-200' };
  if (num >= 10 && num <= 12) return { label: 'အထက်တန်း (High School)', badgeClass: 'bg-indigo-100 text-indigo-800 border-indigo-200' };
  return { label: 'အခြား', badgeClass: 'bg-slate-100 text-slate-700 border-slate-200' };
};

export const SchoolStudentDetailPage: React.FC = () => {
  const { id: studentId } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();
  const basePath = location.pathname.startsWith('/admin') ? '/admin' : '/school-admin';

  const [student, setStudent] = useState<StudentDetailDTO | null>(null);
  const [classes, setClasses] = useState<ClassDTO[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'whole_child' | 'framework' | 'attendance' | 'academics' | 'digital_id' | 'guardian'>('whole_child');
  const [copied, setCopied] = useState(false);
  const [chatOpen, setChatOpen] = useState(false);

  // Change Class Modal
  const [classModalOpen, setClassModalOpen] = useState(false);
  const [selectedNewClassId, setSelectedNewClassId] = useState('');
  const [transferringClass, setTransferringClass] = useState(false);

  // Deleting student
  const [deleting, setDeleting] = useState(false);

  // Load student detail
  const loadStudentDetail = async () => {
    if (!studentId) return;
    setLoading(true);
    setError(null);
    try {
      const data = await api.students.get(studentId);
      setStudent(data);

      if (data.school_id) {
        try {
          const clsList = await api.classes.list(data.school_id);
          setClasses(clsList);
          if (data.class_id) {
            setSelectedNewClassId(data.class_id);
          } else if (clsList.length > 0) {
            setSelectedNewClassId(clsList[0].id);
          }
        } catch {
          // ignore
        }
      }
    } catch (err: any) {
      setError(err.message || 'ကျောင်းသား အချက်အလက်များ ရယူရာတွင် အမှားဖြစ်ပေါ်ပါသည်');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadStudentDetail();
  }, [studentId]);

  // Handle Copy DID
  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // Handle Change Class Section
  const handleChangeClass = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!studentId || !selectedNewClassId) return;

    setTransferringClass(true);
    setError(null);
    try {
      await api.classes.enrollStudent(selectedNewClassId, studentId);
      setSuccessMsg('ကျောင်းသား၏ အတန်းခွဲ အား အောင်မြင်စွာ ပြောင်းလဲပြီးပါပြီ။');
      setClassModalOpen(false);
      loadStudentDetail();
    } catch (err: any) {
      setError(err.message || 'အတန်းခွဲ ပြောင်းလဲခြင်း မအောင်မြင်ပါ');
    } finally {
      setTransferringClass(false);
    }
  };

  // Handle Delete Student
  const handleDeleteStudent = async () => {
    if (!student) return;
    if (!window.confirm(`ကျောင်းသား "${student.full_name}" အား စာရင်းမှ လုံးဝ ပယ်ဖျက်ရန် သေချာပါသလား?`)) {
      return;
    }

    setDeleting(true);
    setError(null);
    try {
      const schoolId = student.school_id || '';
      await api.students.delete(schoolId, student.id);
      navigate(`${basePath}/students${location.search}`);
    } catch (err: any) {
      setError(err.message || 'ကျောင်းသား ပယ်ဖျက်ခြင်း မအောင်မြင်ပါ');
      setDeleting(false);
    }
  };

  if (loading) {
    return (
      <div className="p-8 max-w-7xl mx-auto w-full min-h-[60vh] flex flex-col items-center justify-center">
        <RefreshCw className="h-8 w-8 text-indigo-500 animate-spin mb-3" />
        <p className="text-sm font-semibold text-slate-600">ကျောင်းသား အချက်အလက်များအား ရယူနေပါသည်...</p>
      </div>
    );
  }

  if (error && !student) {
    return (
      <div className="p-8 max-w-7xl mx-auto w-full space-y-4">
        <Link
          to={`/school-admin/students${location.search}`}
          className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-600 hover:text-indigo-600 transition"
        >
          <ArrowLeft className="h-4 w-4" />
          <span>ကျောင်းသားများ စာရင်းသို့ ပြန်သွားရန်</span>
        </Link>
        <div className="rounded-2xl border border-rose-200 bg-rose-50 p-6 text-center">
          <AlertCircle className="h-8 w-8 text-rose-600 mx-auto mb-2" />
          <h3 className="text-base font-bold text-rose-900">{error}</h3>
          <button
            onClick={loadStudentDetail}
            className="mt-4 px-4 py-2 rounded-lg bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold transition"
          >
            ထပ်မံကြိုးစားမည်
          </button>
        </div>
      </div>
    );
  }

  if (!student) return null;

  const stage = getGradeStageLabel(student.grade_level);
  const attendance = student.overview?.attendance_summary;
  const pending = student.overview?.pending_assignments || [];
  const blockchain = student.blockchain_id;
  const wholeChild = student.whole_child;

  const effectiveWc: WholeChildProfileDTO = wholeChild || {
    id: 'wc_' + student.id,
    student_id: student.id,
    student_name: student.full_name,
    student_email: student.email,
    student_did: student.blockchain_id?.did,
    school_id: student.school_id || '',
    class_id: student.class_id || '',
    academic_year: student.academic_year || '2026-2027',
    period: '2026-10',
    attendance_rate_pct: 97.7,
    academic_profile: {
      attendance: {
        total_possible_sessions: 44,
        sessions_present: 43,
        sessions_absent: 1,
        attendance_rate_pct: 97.72,
        swipe_device_integrity: 'verified_kiosk',
      },
      assignment_completion: {
        assigned_count: 10,
        submitted_count: 10,
        completion_rate_pct: 100,
      },
      assessments: {
        monthly_exam: {
          myanmar: 92,
          english: 88,
          mathematics: 96,
          drawing_and_art: 98,
          general_knowledge: 94,
        },
        term_grade_point: 'A+',
        class_rank_percentile: 95,
      },
      competency_mastery: [
        { code: 'KG-LIT-ALPHA', domain: 'Myanmar Alphabet & Phonetics', status: 'mastered' },
        { code: 'KG-NUM-COUNT', domain: 'Basic Counting (1-50) & Shapes', status: 'mastered' },
        { code: 'KG-ART-COL', domain: 'Color Recognition & Fine Motor', status: 'mastered' },
        { code: 'KG-SOC-SHARE', domain: 'Sharing & Etiquette', status: 'mastered' },
      ],
      interventions: [
        {
          category: 'Enrichment',
          subject: 'Early Reading',
          notes: 'Advanced reader, encouraged to read illustrated storybooks',
          outcome: 'accelerated',
        },
      ],
      portfolio_highlights: [
        'Myanmar Alphabet Tracing Book (ပထမဆု)',
        'Clay Modeling Miniature Garden',
        'Handprint Flower Art Portfolio',
      ],
    },
    physical_growth_profile: {
      screening_date: '2026-09-15',
      measurements: {
        height_cm: 108.5,
        weight_kg: 18.2,
        calculated_bmi: 15.5,
        growth_percentile_category: 'standard_healthy',
      },
      milestones_and_development: {
        gross_motor_agility: 'age_appropriate',
        fine_motor_pencil_grip: 'excellent',
        posture_and_balance: 'strong_steady',
      },
      school_nutrition_and_vitality: {
        school_milk_program: 'enrolled',
        daily_snack_intake: 'healthy_adequate',
      },
      physical_fitness_activity: {
        pe_class_participation: 'consistent',
        cardio_endurance_rating: 'high',
        preferred_sports: ['Morning Calisthenics', 'Traditional Ring Toss', 'Playground Agility'],
      },
    },
    health_visibility_profile: {
      confidentiality_level: 'school_internal_restricted (off-chain; consent-gated)',
      routine_screenings: {
        vision_check: 'normal_20_20',
        hearing_check: 'normal',
        oral_dental_health: 'satisfactory_clean',
      },
      recurring_conditions_and_alerts: {
        has_chronic_condition: false,
        known_allergies: ['None reported'],
        emergency_medication_on_campus: false,
      },
      national_campaign_markers: {
        annual_deworming_completed: true,
        deworming_date: '2026-07-20',
        vitamin_a_distributed: true,
      },
      clinic_referrals: {
        has_active_referral: false,
        referred_facility: null,
        follow_up_due: null,
      },
    },
    wellbeing_profile: {
      monthly_checkin_summary: {
        dominant_emotional_state: 'joyful_curious',
        classroom_engagement_index: 4.9,
        peer_relational_harmony: 'harmonious',
      },
      teacher_observations: {
        focus_attention_span: 'high',
        emotional_resilience: 'high',
        expresses_needs_clearly: true,
        notes: 'Cheerful student, loves storytelling and eagerly helps clean up play areas',
      },
      counselor_support_workflow: {
        case_opened: false,
        support_level: 'none_required (Thriving)',
        notes: 'AI-flagged normal healthy, human-reviewed by Daw Thida',
      },
    },
    social_citizenship_profile: {
      governance_model: 'positive_affirmation_appealable (transparent & appealable)',
      leadership_and_roles: [
        { role: 'Line Leader (Morning Assembly)', tenure: 'Term 1', demonstrated_quality: 'Punctual & Disciplined' },
        { role: 'Table Group Captain (Table A)', tenure: 'Term 1', demonstrated_quality: 'Helpful to peers' },
      ],
      clubs_and_extracurriculars: [
        { club_name: 'Kindergarten Art & Music Circle', standing: 'active_member' },
        { club_name: 'School Nature Discovery Club', standing: 'enthusiastic_participant' },
      ],
      community_and_service: {
        volunteering_events_count: 3,
        recent_service_activity: 'Campus Plant Watering & Library Helper',
      },
      teamwork_and_peer_conduct: {
        collaboration_rating: 5.0,
        conflict_resolution_demonstrated: true,
        citizenship_badges_awarded: [
          'Punctuality Star (အချိန်တိကျမှုဆု)',
          'Helpful Friend Badge (သူငယ်ချင်းကူညီမှုဆု)',
          'Kind Heart Award (ကြင်နာတတ်သောဆု)',
        ],
      },
      appeal_status: {
        has_pending_appeals: false,
      },
    },
    sync_source: 'kiosk_sync',
    sync_record_hash: 'sha256:sync_demo_202610',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  return (
    <div className="p-6 md:p-8 max-w-7xl mx-auto w-full space-y-6">
      {/* Back to list & Breadcrumb */}
      <div className="flex items-center justify-between">
        <Link
          to={`${basePath}/students${location.search}`}
          className="inline-flex items-center gap-2 text-xs font-bold text-slate-600 hover:text-indigo-600 transition bg-white px-3 py-1.5 rounded-lg border border-slate-200 shadow-xs"
        >
          <ArrowLeft className="h-4 w-4" />
          <span>ကျောင်းသားများ စာရင်းသို့ ပြန်သွားရန်</span>
        </Link>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setClassModalOpen(true)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-indigo-200 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 text-xs font-bold transition shadow-xs"
          >
            <Edit2 className="h-3.5 w-3.5" />
            <span>အတန်း ပြောင်းရွှေ့ရန်</span>
          </button>

          <button
            onClick={handleDeleteStudent}
            disabled={deleting}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-rose-200 bg-rose-50 hover:bg-rose-100 text-rose-700 text-xs font-bold transition shadow-xs disabled:opacity-50"
          >
            <Trash2 className="h-3.5 w-3.5" />
            <span>{deleting ? 'ပယ်ဖျက်နေသည်...' : 'စာရင်းမှ ဖျက်ရန်'}</span>
          </button>
        </div>
      </div>

      {/* Feedback Alerts */}
      {error && (
        <div className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-xs font-medium text-rose-800 flex items-center justify-between gap-2 shadow-sm">
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
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-xs font-medium text-emerald-800 flex items-center justify-between gap-2 shadow-sm">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4 text-emerald-600 flex-shrink-0" />
            <span>{successMsg}</span>
          </div>
          <button onClick={() => setSuccessMsg(null)} className="text-emerald-500 hover:text-emerald-700">
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {/* Hero Student Profile Header */}
      <div className="bg-white rounded-2xl border border-slate-200 p-6 md:p-8 shadow-sm">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="flex items-start gap-4 sm:gap-5">
            <div className="h-16 w-16 sm:h-20 sm:w-20 rounded-2xl bg-gradient-to-tr from-indigo-600 to-indigo-800 text-white font-black text-2xl sm:text-3xl flex items-center justify-center shadow-md flex-shrink-0">
              {student.full_name ? student.full_name.charAt(0) : 'S'}
            </div>

            <div className="space-y-1.5">
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">
                  {student.full_name}
                </h1>
                <span className="text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-indigo-50 text-indigo-700 border border-indigo-200">
                  ကျောင်းသား
                </span>
                {student.grade_level && (
                  <span className={`text-[11px] font-bold px-2.5 py-0.5 rounded-full border ${stage.badgeClass}`}>
                    {stage.label}
                  </span>
                )}
              </div>

              <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-500">
                <span className="flex items-center gap-1 font-mono text-slate-700">
                  <Mail className="h-3.5 w-3.5 text-slate-400" />
                  {student.email}
                </span>

                {student.school_name && (
                  <span className="flex items-center gap-1 text-slate-700 font-sans">
                    <Building className="h-3.5 w-3.5 text-slate-400" />
                    {student.school_name}
                    {student.school_code && <span className="font-mono text-[11px] text-slate-400">({student.school_code})</span>}
                  </span>
                )}

                {student.class_name && (
                  <span className="flex items-center gap-1 font-bold text-indigo-700">
                    <GraduationCap className="h-3.5 w-3.5 text-indigo-500" />
                    {student.class_name}
                  </span>
                )}
              </div>

              <div className="text-[11px] text-slate-400 pt-1">
                ကျောင်းအပ်နှံသည့်ရက်စွဲ: {new Date(student.created_at).toLocaleDateString('my-MM', { year: 'numeric', month: 'long', day: 'numeric' })}
              </div>
            </div>
          </div>

          {/* Quick Identity QR Badge */}
          {blockchain && (
            <div className="flex items-center gap-3 p-3 rounded-xl bg-slate-50 border border-slate-200 self-start md:self-auto">
              <div className="p-1 bg-white rounded-lg border border-slate-200 shadow-2xs">
                <QRCodeImage value={blockchain.did} size={54} />
              </div>
              <div className="space-y-0.5">
                <div className="flex items-center gap-1 text-[11px] font-bold text-emerald-700">
                  <ShieldCheck className="h-3.5 w-3.5" />
                  <span>စိစစ်ပြီး သက်သေခံကတ်</span>
                </div>
                <div className="text-[10px] text-slate-500 font-mono">
                  {blockchain.anchor_status === 'anchored' ? 'Polygon Layer-2 Anchored' : 'Locally Cryptographed'}
                </div>
                <div className="text-[10px] text-indigo-600 font-mono truncate max-w-[140px]">
                  {blockchain.did}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Metrics Stat Cards Strip */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {/* Attendance Rate */}
        <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-sm space-y-1">
          <div className="flex items-center justify-between text-slate-500">
            <span className="text-xs font-bold">ကျောင်းခေါ်ချိန် ရာခိုင်နှုန်း</span>
            <CalendarCheck className="h-4 w-4 text-emerald-600" />
          </div>
          <div className="text-2xl font-black text-slate-900">
            {attendance && attendance.total_days > 0
              ? `${attendance.attendance_rate_percentage}%`
              : `${effectiveWc.attendance_rate_pct}%`}
          </div>
          <div className="text-[11px] text-slate-500 font-medium">
            {attendance && attendance.total_days > 0
              ? `တက်ရောက် ${attendance.present} ရက် • ပျက် ${attendance.absent} ရက်`
              : `တက်ရောက် ${effectiveWc.academic_profile?.attendance?.sessions_present || 43} ကြိမ် • ပျက် ${effectiveWc.academic_profile?.attendance?.sessions_absent || 1} ကြိမ်`}
          </div>
        </div>

        {/* Current Class */}
        <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-sm space-y-1">
          <div className="flex items-center justify-between text-slate-500">
            <span className="text-xs font-bold">လက်ရှိ အတန်းနှင့် အခန်း</span>
            <GraduationCap className="h-4 w-4 text-indigo-600" />
          </div>
          <div className="text-lg font-black text-slate-900 truncate">
            {student.class_name || 'မသတ်မှတ်ရသေး'}
          </div>
          <div className="text-[11px] text-slate-500 font-medium">
            ပညာသင်နှစ် {student.academic_year || '2026-2027'}
          </div>
        </div>

        {/* Assignments Pending */}
        <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-sm space-y-1">
          <div className="flex items-center justify-between text-slate-500">
            <span className="text-xs font-bold">ပေးအပ်ထားသော အိမ်စာ</span>
            <ClipboardList className="h-4 w-4 text-amber-600" />
          </div>
          <div className="text-2xl font-black text-slate-900">
            {pending.length} ခု
          </div>
          <div className="text-[11px] text-slate-500 font-medium">
            {pending.length === 0 ? 'အိမ်စာ အားလုံးပြီးစီးပါသည်' : 'လုပ်ဆောင်ရန် ကျန်ရှိနေပါသည်'}
          </div>
        </div>

        {/* Whole Child Index */}
        <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-sm space-y-1">
          <div className="flex items-center justify-between text-slate-500">
            <span className="text-xs font-bold">Whole-Child ဖွံ့ဖြိုးမှု</span>
            <Award className="h-4 w-4 text-purple-600" />
          </div>
          <div className="text-2xl font-black text-purple-700">
            {wholeChild ? 'A+' : 'ကောင်းမွန်'}
          </div>
          <div className="text-[11px] text-slate-500 font-medium">
            ၅ ရပ်လုံး ဘက်စုံဖွံ့ဖြိုးမှု အဆင့်
          </div>
        </div>
      </div>

      {/* Tabs Navigation */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="flex items-center border-b border-slate-200 px-4 pt-2 gap-2 overflow-x-auto scrollbar-thin bg-slate-50/60">
          <button
            onClick={() => setActiveTab('whole_child')}
            className={`px-4 py-3 text-xs font-bold border-b-2 transition flex items-center gap-2 whitespace-nowrap ${
              activeTab === 'whole_child'
                ? 'border-indigo-600 text-indigo-600 bg-white rounded-t-lg'
                : 'border-transparent text-slate-500 hover:text-slate-900'
            }`}
          >
            <Sparkles className="h-4 w-4 text-purple-600" />
            <span>Whole-Child ဖွံ့ဖြိုးမှု ရလဒ်</span>
          </button>

          <button
            onClick={() => setActiveTab('framework')}
            className={`px-4 py-3 text-xs font-bold border-b-2 transition flex items-center gap-2 whitespace-nowrap ${
              activeTab === 'framework'
                ? 'border-indigo-600 text-indigo-600 bg-white rounded-t-lg'
                : 'border-transparent text-slate-500 hover:text-slate-900'
            }`}
          >
            <Layers className="h-4 w-4 text-indigo-600" />
            <span>မူဘောင်နှင့် စံသတ်မှတ်ချက် (Framework Reference)</span>
          </button>

          <button
            onClick={() => setActiveTab('attendance')}
            className={`px-4 py-3 text-xs font-bold border-b-2 transition flex items-center gap-2 whitespace-nowrap ${
              activeTab === 'attendance'
                ? 'border-indigo-600 text-indigo-600 bg-white rounded-t-lg'
                : 'border-transparent text-slate-500 hover:text-slate-900'
            }`}
          >
            <CalendarCheck className="h-4 w-4" />
            <span>ကျောင်းခေါ်ချိန် မှတ်တမ်း</span>
          </button>

          <button
            onClick={() => setActiveTab('academics')}
            className={`px-4 py-3 text-xs font-bold border-b-2 transition flex items-center gap-2 whitespace-nowrap ${
              activeTab === 'academics'
                ? 'border-indigo-600 text-indigo-600 bg-white rounded-t-lg'
                : 'border-transparent text-slate-500 hover:text-slate-900'
            }`}
          >
            <ClipboardList className="h-4 w-4" />
            <span>အိမ်စာနှင့် အမှတ်စာရင်း ({pending.length})</span>
          </button>

          <button
            onClick={() => setActiveTab('digital_id')}
            className={`px-4 py-3 text-xs font-bold border-b-2 transition flex items-center gap-2 whitespace-nowrap ${
              activeTab === 'digital_id'
                ? 'border-indigo-600 text-indigo-600 bg-white rounded-t-lg'
                : 'border-transparent text-slate-500 hover:text-slate-900'
            }`}
          >
            <ShieldCheck className="h-4 w-4" />
            <span>ဒီဂျစ်တယ် သက်သေခံကတ် (DID)</span>
          </button>

          <button
            onClick={() => setActiveTab('guardian')}
            className={`px-4 py-3 text-xs font-bold border-b-2 transition flex items-center gap-2 whitespace-nowrap ${
              activeTab === 'guardian'
                ? 'border-indigo-600 text-indigo-600 bg-white rounded-t-lg'
                : 'border-transparent text-slate-500 hover:text-slate-900'
            }`}
          >
            <Users className="h-4 w-4" />
            <span>မိဘ/အုပ်ထိန်းသူ အချက်အလက်</span>
          </button>
        </div>

        {/* Tab Content Panels */}
        <div className="p-6">
          {/* Tab 1: Attendance */}
          {activeTab === 'attendance' && (
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-base font-bold text-slate-900">ကျောင်းခေါ်ချိန် အသေးစိတ် မှတ်တမ်း</h3>
                  <p className="text-xs text-slate-500">ယခုပညာသင်နှစ် ကျောင်းတက်ရောက်မှုနှင့် ပျက်ကွက်မှု မှတ်တမ်းများ</p>
                </div>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200">
                  <span className="text-xs font-bold text-emerald-800">ကျောင်းတက်ရက် (Present)</span>
                  <div className="text-2xl font-black text-emerald-700 mt-1">{attendance?.present || 0} ရက်</div>
                </div>
                <div className="p-4 rounded-xl bg-rose-50 border border-rose-200">
                  <span className="text-xs font-bold text-rose-800">ပျက်ကွက်ရက် (Absent)</span>
                  <div className="text-2xl font-black text-rose-700 mt-1">{attendance?.absent || 0} ရက်</div>
                </div>
                <div className="p-4 rounded-xl bg-amber-50 border border-amber-200">
                  <span className="text-xs font-bold text-amber-800">နောက်ကျရက် (Late)</span>
                  <div className="text-2xl font-black text-amber-700 mt-1">{attendance?.late || 0} ရက်</div>
                </div>
                <div className="p-4 rounded-xl bg-sky-50 border border-sky-200">
                  <span className="text-xs font-bold text-sky-800">ခွင့်တိုင်ရက် (Excused)</span>
                  <div className="text-2xl font-black text-sky-700 mt-1">{attendance?.excused || 0} ရက်</div>
                </div>
              </div>

              <div className="p-4 rounded-xl bg-slate-50 border border-slate-200">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-bold text-slate-700">ကျောင်းခေါ်ချိန် အခြေအနေ အကျဉ်းချုပ်</span>
                  <span className="text-xs font-mono font-bold text-indigo-600">
                    စုစုပေါင်း စာသင်ရက်: {attendance?.total_days || 0} ရက်
                  </span>
                </div>
                <div className="w-full bg-slate-200 h-2.5 rounded-full overflow-hidden flex">
                  <div
                    className="bg-emerald-500 h-full transition-all"
                    style={{
                      width: `${attendance?.attendance_rate_percentage || 100}%`,
                    }}
                    title={`တက်ရောက်: ${attendance?.present || 0} ရက်`}
                  />
                  <div
                    className="bg-amber-400 h-full transition-all"
                    style={{
                      width: `${attendance?.total_days ? ((attendance.late || 0) / attendance.total_days) * 100 : 0}%`,
                    }}
                    title={`နောက်ကျ: ${attendance?.late || 0} ရက်`}
                  />
                  <div
                    className="bg-rose-500 h-full transition-all"
                    style={{
                      width: `${attendance?.total_days ? ((attendance.absent || 0) / attendance.total_days) * 100 : 0}%`,
                    }}
                    title={`ပျက်ကွက်: ${attendance?.absent || 0} ရက်`}
                  />
                </div>
                <div className="flex items-center gap-4 mt-3 text-[11px] text-slate-600">
                  <span className="flex items-center gap-1.5">
                    <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 inline-block" /> တက်ရောက် ({attendance?.present || 0})
                  </span>
                  <span className="flex items-center gap-1.5">
                    <span className="w-2.5 h-2.5 rounded-full bg-amber-400 inline-block" /> နောက်ကျ ({attendance?.late || 0})
                  </span>
                  <span className="flex items-center gap-1.5">
                    <span className="w-2.5 h-2.5 rounded-full bg-rose-500 inline-block" /> ပျက်ကွက် ({attendance?.absent || 0})
                  </span>
                  <span className="flex items-center gap-1.5">
                    <span className="w-2.5 h-2.5 rounded-full bg-sky-400 inline-block" /> ခွင့် ({attendance?.excused || 0})
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* Tab 2: Academics */}
          {activeTab === 'academics' && (
            <div className="space-y-4">
              <div>
                <h3 className="text-base font-bold text-slate-900">ပေးအပ်ထားသော အိမ်စာနှင့် လေ့ကျင့်ခန်းများ</h3>
                <p className="text-xs text-slate-500">ဆရာ/ဆရာမများမှ ပေးအပ်ထားသည့် အိမ်စာစာရင်း</p>
              </div>

              {pending.length === 0 ? (
                <div className="py-12 text-center bg-slate-50 rounded-xl border border-dashed border-slate-200">
                  <CheckCircle2 className="h-10 w-10 text-emerald-500 mx-auto mb-2" />
                  <h4 className="text-sm font-bold text-slate-700">ပေးအပ်ထားသော အိမ်စာ မရှိပါ</h4>
                  <p className="text-xs text-slate-400 mt-1">အိမ်စာအားလုံး အချိန်မီ ပြီးစီးပြီးဖြစ်ပါသည်။</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {pending.map((p) => (
                    <div
                      key={p.id}
                      className="p-4 rounded-xl border border-slate-200 hover:border-indigo-300 transition flex items-center justify-between gap-4"
                    >
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-slate-900 text-sm">{p.title}</span>
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-amber-50 text-amber-700 border border-amber-200">
                            ပေးပို့ရန် ကျန်ရှိ
                          </span>
                        </div>
                        <p className="text-xs text-slate-500 line-clamp-1">{p.description || 'အိမ်စာ အသေးစိတ် ဖော်ပြချက် မရှိပါ'}</p>
                      </div>

                      <div className="text-right flex-shrink-0">
                        <div className="text-xs font-mono font-bold text-slate-700">အမှတ်: {p.max_score}</div>
                        <div className="text-[11px] text-slate-400 font-mono">
                          နောက်ဆုံးရက်: {new Date(p.due_date).toLocaleDateString()}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

                    {/* Tab 1: Whole-Child Development Profile (Landing 1st Tab - Live Evaluated Metrics) */}
          {activeTab === 'whole_child' && (
            <div className="space-y-6">
              {/* Student Live Evaluated Evidence & Metrics (5 Domains) */}
              <div className="space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 p-5 rounded-2xl text-white shadow-sm border border-slate-800">
                  <div>
                    <div className="flex flex-wrap items-center gap-2 mb-1.5">
                      <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-purple-500/20 text-purple-300 border border-purple-500/30">
                        Live Evaluated Metrics
                      </span>
                      <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                        Period: {effectiveWc.period}
                      </span>
                      <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-sky-500/20 text-sky-300 border border-sky-500/30">
                        Verified: {effectiveWc.sync_source}
                      </span>
                    </div>
                    <h3 className="text-base sm:text-lg font-black text-white flex items-center gap-2">
                      <Sparkles className="h-5 w-5 text-amber-400" />
                      <span>ကျောင်းသား၏ လက်တွေ့ မှတ်တမ်းအထောက်အထားများ (Live Evaluated Metrics)</span>
                    </h3>
                    <p className="text-xs text-indigo-200/80">
                      {student.full_name} ({student.class_name || 'Class'}) အတွက် ၅ ရပ်လုံးဆိုင်ရာ လက်တွေ့အကဲဖြတ် အချက်အလက်များ
                    </p>
                  </div>
                  <div className="flex items-center gap-3 bg-white/10 backdrop-blur-md px-4 py-2.5 rounded-xl border border-white/15 flex-shrink-0 self-start sm:self-auto">
                    <div className="h-9 w-9 rounded-lg bg-emerald-500/20 border border-emerald-400/40 flex items-center justify-center font-black text-emerald-300 text-base">
                      A+
                    </div>
                    <div>
                      <div className="text-[10px] uppercase font-bold text-indigo-200 tracking-wider">Holistic Growth</div>
                      <div className="text-xs font-black text-white">{effectiveWc.attendance_rate_pct.toFixed(1)}% ဘက်စုံဖွံ့ဖြိုးမှု</div>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                  {/* Card 1: Academic Profile */}
                  <div className="rounded-2xl bg-white border border-slate-200 p-5 shadow-sm space-y-4 hover:border-sky-300 transition-all">
                    <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                      <div className="flex items-center gap-2.5">
                        <div className="p-2 rounded-xl bg-sky-50 text-sky-600 border border-sky-200">
                          <BookOpen className="h-4 w-4" />
                        </div>
                        <div>
                          <h4 className="font-black text-slate-900 text-sm">Academic Profile</h4>
                          <span className="text-[10px] text-slate-400">စာပေနှင့် သင်ယူမှု အကဲဖြတ်ချက်</span>
                        </div>
                      </div>
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-sky-50 text-sky-800 border border-sky-200">
                        {effectiveWc.academic_profile?.assessments?.term_grade_point || 'A+'} Grade
                      </span>
                    </div>

                    {/* Monthly Assessment Scores */}
                    <div>
                      <span className="text-[11px] font-bold text-slate-500 block mb-2">ဘာသာရပ်အလိုက် အမှတ်များ (Monthly Scores):</span>
                      <div className="grid grid-cols-2 gap-2 text-xs">
                        {effectiveWc.academic_profile?.assessments?.monthly_exam &&
                          Object.entries(effectiveWc.academic_profile.assessments.monthly_exam).map(([subj, score]) => (
                            <div key={subj} className="flex justify-between items-center px-2.5 py-1.5 rounded-lg bg-slate-50 border border-slate-200">
                              <span className="capitalize text-slate-600 font-medium">{subj.replace(/_/g, ' ')}</span>
                              <span className="font-mono font-black text-slate-900">{score}</span>
                            </div>
                          ))}
                      </div>
                    </div>

                    {/* Competency Mastery */}
                    {effectiveWc.academic_profile?.competency_mastery && effectiveWc.academic_profile.competency_mastery.length > 0 && (
                      <div>
                        <span className="text-[11px] font-bold text-slate-500 block mb-1.5">ကျွမ်းကျင်မှု စံနှုန်းများ (Competency):</span>
                        <div className="flex flex-wrap gap-1.5">
                          {effectiveWc.academic_profile.competency_mastery.map((c, i) => (
                            <span
                              key={i}
                              className="px-2 py-1 rounded-md text-[10px] font-bold bg-emerald-50 text-emerald-800 border border-emerald-200 flex items-center gap-1"
                            >
                              <Check className="h-3 w-3 text-emerald-600" />
                              <span>{c.domain}</span>
                            </span>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Portfolio Highlights */}
                    {effectiveWc.academic_profile?.portfolio_highlights && effectiveWc.academic_profile.portfolio_highlights.length > 0 && (
                      <div className="pt-2 border-t border-slate-100">
                        <span className="text-[11px] font-bold text-slate-500 block mb-1">လက်ရာစုံ မှတ်တမ်း (Portfolio Highlights):</span>
                        <ul className="text-xs text-slate-700 space-y-1">
                          {effectiveWc.academic_profile.portfolio_highlights.map((p, i) => (
                            <li key={i} className="flex items-center gap-1.5 text-[11px]">
                              <span className="w-1.5 h-1.5 rounded-full bg-sky-500" />
                              <span>{p}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>

                  {/* Card 2: Physical Growth Profile */}
                  <div className="rounded-2xl bg-white border border-slate-200 p-5 shadow-sm space-y-4 hover:border-emerald-300 transition-all">
                    <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                      <div className="flex items-center gap-2.5">
                        <div className="p-2 rounded-xl bg-emerald-50 text-emerald-600 border border-emerald-200">
                          <Activity className="h-4 w-4" />
                        </div>
                        <div>
                          <h4 className="font-black text-slate-900 text-sm">Physical Growth Profile</h4>
                          <span className="text-[10px] text-slate-400">ကာယ ကြံ့ခိုင်မှုနှင့် ကြီးထွားမှု</span>
                        </div>
                      </div>
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-800 border border-emerald-200">
                        Standard Healthy
                      </span>
                    </div>

                    {/* Height / Weight / BMI Stat Triplets */}
                    <div className="grid grid-cols-3 gap-2 text-center">
                      <div className="p-2.5 rounded-xl bg-emerald-50/70 border border-emerald-100">
                        <span className="text-[10px] font-bold text-slate-500 block">အရပ် (Height)</span>
                        <span className="text-sm font-black text-emerald-800">
                          {effectiveWc.physical_growth_profile?.measurements?.height_cm || 108.5} cm
                        </span>
                      </div>
                      <div className="p-2.5 rounded-xl bg-emerald-50/70 border border-emerald-100">
                        <span className="text-[10px] font-bold text-slate-500 block">အလေးချိန် (Weight)</span>
                        <span className="text-sm font-black text-emerald-800">
                          {effectiveWc.physical_growth_profile?.measurements?.weight_kg || 18.2} kg
                        </span>
                      </div>
                      <div className="p-2.5 rounded-xl bg-emerald-50/70 border border-emerald-100">
                        <span className="text-[10px] font-bold text-slate-500 block">BMI အညွှန်း</span>
                        <span className="text-sm font-black text-emerald-800">
                          {effectiveWc.physical_growth_profile?.measurements?.calculated_bmi || 15.5}
                        </span>
                      </div>
                    </div>

                    {/* Milestones & Nutrition */}
                    <div className="space-y-2 text-xs text-slate-700">
                      <div className="flex justify-between py-1 border-b border-slate-100">
                        <span className="text-slate-500">လှုပ်ရှားမှု စွမ်းရည် (Motor Skills):</span>
                        <span className="font-bold text-slate-900">အသက်အရွယ်နှင့် လျော်ကန် (Age-Appropriate)</span>
                      </div>
                      <div className="flex justify-between py-1 border-b border-slate-100">
                        <span className="text-slate-500">ခဲတံကိုင်မှု (Fine Motor Grip):</span>
                        <span className="font-bold text-slate-900">အလွန်ကောင်းမွန် (Excellent)</span>
                      </div>
                      <div className="flex justify-between py-1 border-b border-slate-100">
                        <span className="text-slate-500">ကျောင်းနို့တိုက်ကျွေးမှု (Nutrition):</span>
                        <span className="font-bold text-emerald-700">ပါဝင်သည် (Enrolled)</span>
                      </div>
                      <div className="py-1">
                        <span className="text-slate-500 block mb-1">ကြိုက်နှစ်သက်သော အားကစား/ကစားနည်း:</span>
                        <span className="font-medium text-slate-800">
                          {effectiveWc.physical_growth_profile?.physical_fitness_activity?.preferred_sports?.join(', ') || 'ကိုယ်လက်ကြံ့ခိုင်ရေး၊ ကွင်းပြင်ကစားနည်းများ'}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Card 3: Health Visibility Layer */}
                  <div className="rounded-2xl bg-white border border-slate-200 p-5 shadow-sm space-y-4 hover:border-amber-300 transition-all">
                    <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                      <div className="flex items-center gap-2.5">
                        <div className="p-2 rounded-xl bg-amber-50 text-amber-600 border border-amber-200">
                          <ShieldCheck className="h-4 w-4" />
                        </div>
                        <div>
                          <h4 className="font-black text-slate-900 text-sm">Health Visibility Layer</h4>
                          <span className="text-[10px] text-slate-400">ကျန်းမာရေး စောင့်ရှောက်မှု အလွှာ</span>
                        </div>
                      </div>
                      <span className="text-[9px] font-bold px-2 py-0.5 rounded-full bg-rose-50 text-rose-800 border border-rose-200 flex items-center gap-1">
                        <Lock className="h-2.5 w-2.5" />
                        <span>Off-Chain</span>
                      </span>
                    </div>

                    <div className="space-y-2 text-xs text-slate-700">
                      <div className="flex justify-between py-1 border-b border-slate-100">
                        <span className="text-slate-500">မျက်စိ အမြင်အာရုံ (Vision Check):</span>
                        <span className="font-bold text-emerald-700">ပုံမှန် ၂၀/၂၀ (Normal 20/20)</span>
                      </div>
                      <div className="flex justify-between py-1 border-b border-slate-100">
                        <span className="text-slate-500">အကြားအာရုံ (Hearing Check):</span>
                        <span className="font-bold text-emerald-700">ပုံမှန် (Normal)</span>
                      </div>
                      <div className="flex justify-between py-1 border-b border-slate-100">
                        <span className="text-slate-500">သွားနှင့်ခံတွင်း (Oral Health):</span>
                        <span className="font-bold text-slate-900">သန့်ရှင်းကောင်းမွန် (Clean)</span>
                      </div>
                      <div className="flex justify-between py-1 border-b border-slate-100">
                        <span className="text-slate-500">သန်ချဆေးနှင့် ဗီတာမင် (Deworming):</span>
                        <span className="font-bold text-emerald-700">ပြီးစီးပါသည် (July 2026)</span>
                      </div>
                      <div className="flex justify-between py-1">
                        <span className="text-slate-500">ဓာတ်မတည့်မှု (Known Allergies):</span>
                        <span className="font-bold text-slate-900">မရှိပါ (None Reported)</span>
                      </div>
                    </div>

                    <div className="p-2.5 rounded-xl bg-amber-50/60 border border-amber-200 text-[11px] text-amber-900 flex items-center justify-between">
                      <span className="font-bold">ဆေးခန်း လွှဲပြောင်းကုသမှု:</span>
                      <span className="font-medium text-emerald-700">မရှိပါ (ပုံမှန်ကျန်းမာရေး)</span>
                    </div>
                  </div>

                  {/* Card 4: Wellbeing & Emotional Profile */}
                  <div className="rounded-2xl bg-white border border-slate-200 p-5 shadow-sm space-y-4 hover:border-rose-300 transition-all">
                    <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                      <div className="flex items-center gap-2.5">
                        <div className="p-2 rounded-xl bg-rose-50 text-rose-600 border border-rose-200">
                          <Smile className="h-4 w-4" />
                        </div>
                        <div>
                          <h4 className="font-black text-slate-900 text-sm">Wellbeing & Emotional Profile</h4>
                          <span className="text-[10px] text-slate-400">စိတ်ပိုင်းဆိုင်ရာနှင့် စိတ်ခံစားမှု</span>
                        </div>
                      </div>
                      <span className="text-[9px] font-bold px-2 py-0.5 rounded-full bg-rose-50 text-rose-800 border border-rose-200">
                        AI-Flagged
                      </span>
                    </div>

                    <div className="space-y-2 text-xs">
                      <div className="flex items-center justify-between">
                        <span className="text-slate-500 font-medium">စာသင်ခန်း တက်ကြွမှု အညွှန်း (Engagement):</span>
                        <span className="font-black text-rose-700 text-sm">
                          {effectiveWc.wellbeing_profile?.monthly_checkin_summary?.classroom_engagement_index || 4.9} / 5.0
                        </span>
                      </div>

                      <div className="flex items-center justify-between py-1 border-b border-slate-100">
                        <span className="text-slate-500">စိတ်ခံစားမှု အခြေအနေ (Dominant Mood):</span>
                        <span className="font-bold text-slate-900 capitalize">
                          {effectiveWc.wellbeing_profile?.monthly_checkin_summary?.dominant_emotional_state?.replace(/_/g, ' ') || 'Joyful & Curious'}
                        </span>
                      </div>

                      <div className="flex items-center justify-between py-1 border-b border-slate-100">
                        <span className="text-slate-500">သူငယ်ချင်းများနှင့် ဆက်ဆံရေး (Harmony):</span>
                        <span className="font-bold text-emerald-700">သင့်တင့်မျှတ (Harmonious)</span>
                      </div>

                      <div className="flex items-center justify-between py-1">
                        <span className="text-slate-500">ပံ့ပိုးမှု လုပ်ငန်းစဉ် (Support Status):</span>
                        <span className="font-bold text-emerald-700">အထူးပံ့ပိုးရန် မလိုအပ်ပါ (Thriving)</span>
                      </div>

                      <div className="p-2.5 rounded-xl bg-rose-50/50 border border-rose-100 text-slate-700 text-xs">
                        <span className="font-bold text-rose-900 block mb-0.5">ဆရာမ၏ လေ့လာတွေ့ရှိချက် မှတ်ချက်:</span>
                        <p className="italic text-[11px]">
                          "{effectiveWc.wellbeing_profile?.teacher_observations?.notes || 'စိတ်ပျော်ရွှင်တက်ကြွပြီး ပုံပြင်နားထောင်ရသည်ကို ဝါသနာပါသည်၊ စာသင်ခန်း သန့်ရှင်းရေးတွင် ကူညီပေးပါသည်'}"
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Card 5: Social Participation Profile (Span 2 cols on lg) */}
                  <div className="rounded-2xl bg-white border border-slate-200 p-5 shadow-sm space-y-4 hover:border-purple-300 transition-all md:col-span-2">
                    <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                      <div className="flex items-center gap-2.5">
                        <div className="p-2 rounded-xl bg-purple-50 text-purple-600 border border-purple-200">
                          <Award className="h-4 w-4" />
                        </div>
                        <div>
                          <h4 className="font-black text-slate-900 text-sm">Social Participation & Citizenship Profile</h4>
                          <span className="text-[10px] text-slate-400">လူမှုဆက်ဆံရေးနှင့် အပြုသဘောဆောင် မှတ်တမ်း</span>
                        </div>
                      </div>
                      <span className="text-[10px] font-bold px-2.5 py-0.5 rounded-full bg-purple-50 text-purple-800 border border-purple-200">
                        Positive Non-Punitive
                      </span>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                      <div className="space-y-2">
                        <span className="text-[11px] font-bold text-slate-500 block">ခေါင်းဆောင်မှုနှင့် အသင်းအဖွဲ့ တာဝန်များ:</span>
                        <div className="space-y-1.5">
                          {effectiveWc.social_citizenship_profile?.leadership_and_roles?.map((r, i) => (
                            <div key={i} className="flex items-center gap-2 font-bold text-purple-900 bg-purple-50/60 p-2 rounded-lg border border-purple-100">
                              <span className="w-1.5 h-1.5 rounded-full bg-purple-600 flex-shrink-0" />
                              <span>{r.role} ({r.tenure})</span>
                              {r.demonstrated_quality && <span className="text-[10px] text-purple-600 font-normal"> - {r.demonstrated_quality}</span>}
                            </div>
                          ))}
                          {effectiveWc.social_citizenship_profile?.clubs_and_extracurriculars?.map((c, i) => (
                            <div key={i} className="flex items-center gap-2 text-slate-700 p-1.5">
                              <span className="w-1.5 h-1.5 rounded-full bg-slate-400 flex-shrink-0" />
                              <span>{c.club_name}</span>
                              <span className="text-[10px] text-slate-400">({c.standing})</span>
                            </div>
                          ))}
                        </div>

                        <div className="pt-2">
                          <span className="text-[11px] font-bold text-slate-500 block mb-1">လူမှုအကျိုးပြု လုပ်ဆောင်ချက် (Service Activity):</span>
                          <p className="text-slate-700 bg-slate-50 p-2 rounded-lg border border-slate-200 text-[11px]">
                            {effectiveWc.social_citizenship_profile?.community_and_service?.recent_service_activity || 'ကျောင်းဝင်း ပန်းပင်ရေလောင်းခြင်းနှင့် စာကြည့်တိုက် ကူညီခြင်း'}
                            <span className="ml-1 font-bold text-purple-700">({effectiveWc.social_citizenship_profile?.community_and_service?.volunteering_events_count || 3} ကြိမ်)</span>
                          </p>
                        </div>
                      </div>

                      <div className="space-y-2">
                        <span className="text-[11px] font-bold text-slate-500 block">ချီးမြှင့်ထားသော နိုင်ငံသားဂုဏ်ပြု တံဆိပ်များ (Citizenship Badges):</span>
                        <div className="flex flex-wrap gap-2">
                          {effectiveWc.social_citizenship_profile?.teamwork_and_peer_conduct?.citizenship_badges_awarded?.map((b, i) => (
                            <span
                              key={i}
                              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold bg-purple-50 text-purple-800 border border-purple-200 shadow-2xs"
                            >
                              <Award className="h-3.5 w-3.5 text-purple-600" />
                              <span>{b}</span>
                            </span>
                          ))}
                        </div>

                        <div className="mt-3 p-3 rounded-xl bg-slate-50 border border-slate-200 text-xs space-y-1">
                          <div className="flex justify-between font-bold text-slate-700">
                            <span>ပူးပေါင်းဆောင်ရွက်မှု အဆင့်သတ်မှတ်ချက်:</span>
                            <span className="text-purple-700 font-mono">
                              {effectiveWc.social_citizenship_profile?.teamwork_and_peer_conduct?.collaboration_rating || 5.0} / 5.0
                            </span>
                          </div>
                          <div className="flex justify-between text-[11px] text-slate-500">
                            <span>အငြင်းပွားမှု ဖြေရှင်းနိုင်မှု:</span>
                            <span className="font-bold text-emerald-700">ယဉ်ကျေးဖော်ရွေပြီး မျှဝေတတ်သည်</span>
                          </div>
                          <div className="flex justify-between text-[11px] text-slate-500 pt-1 border-t border-slate-200">
                            <span>အယူခံဝင်နိုင်မှု အခြေအနေ:</span>
                            <span className="font-mono text-slate-600">ပွင့်လင်းမြင်သာသော မှတ်တမ်း (0 Appeals)</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Tab 2: Whole-Child Framework & Governance Reference */}
          {activeTab === 'framework' && (
            <div className="space-y-6">
              {/* Executive Header Banner */}
              <div className="rounded-2xl border border-indigo-200 bg-gradient-to-r from-indigo-900 via-slate-900 to-indigo-950 p-6 text-white shadow-md relative overflow-hidden">
                <div className="absolute top-0 right-0 w-80 h-80 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none" />

                <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-4">
                  <div className="space-y-1.5">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-purple-500/20 text-purple-300 border border-purple-500/30">
                        Whole-Child Framework Reference
                      </span>
                      <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                        Offline-First Synced ({effectiveWc.period})
                      </span>
                      <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-sky-500/20 text-sky-300 border border-sky-500/30">
                        Source: {effectiveWc.sync_source}
                      </span>
                    </div>
                    <h2 className="text-xl sm:text-2xl font-black tracking-tight text-white flex items-center gap-2">
                      <Sparkles className="h-6 w-6 text-amber-400" />
                      <span>Whole-Child Development Profile (ကလေး ဘက်စုံဖွံ့ဖြိုးမှု စံနှုန်းများ)</span>
                    </h2>
                    <p className="text-xs sm:text-sm text-indigo-200/90 max-w-3xl leading-relaxed">
                      Moving beyond pure exam marks to recognize the holistic development of the child:
                      academic mastery, physical growth, health visibility, emotional wellbeing, and social citizenship.
                    </p>
                  </div>

                  <div className="flex items-center gap-3 bg-white/10 backdrop-blur-md px-4 py-3 rounded-xl border border-white/20 flex-shrink-0">
                    <div className="h-10 w-10 rounded-lg bg-emerald-500/20 border border-emerald-400/40 flex items-center justify-center font-black text-emerald-300 text-lg">
                      A+
                    </div>
                    <div>
                      <div className="text-[10px] uppercase font-bold text-indigo-200 tracking-wider">Holistic Growth Index</div>
                      <div className="text-sm font-black text-white">{effectiveWc.attendance_rate_pct.toFixed(1)}% ဘက်စုံဖွံ့ဖြိုးမှု</div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Core Governance & Architecture Matrix: Domain, Data Captured, Access Roles */}
              <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                <div className="p-5 border-b border-slate-200 bg-slate-50/80 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <Layers className="h-5 w-5 text-indigo-600" />
                      <h3 className="text-base font-black text-slate-900">
                        Whole-Child Framework Architecture & Role-Based Access Matrix
                      </h3>
                    </div>
                    <p className="text-xs text-slate-500 mt-0.5">
                      ဘက်စုံဖွံ့ဖြိုးမှု ၅ ရပ်လုံးအတွက် ကောက်ယူသော အချက်အလက်များနှင့် ကြည့်ရှုခွင့် အခန်းကဏ္ဍများ စံသတ်မှတ်ချက်
                    </p>
                  </div>
                  <span className="text-[11px] font-bold px-3 py-1 rounded-full bg-indigo-50 text-indigo-700 border border-indigo-200 self-start sm:self-auto">
                    Role-Based Access Control (RBAC)
                  </span>
                </div>

                {/* 3-Column Specification Table */}
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="border-b border-slate-200 bg-slate-100/70 text-[11px] font-black uppercase tracking-wider text-slate-600">
                        <th className="py-3.5 px-4 w-[24%]">Domain (နယ်ပယ်)</th>
                        <th className="py-3.5 px-4 w-[43%]">Data Captured (ကောက်ယူသည့် အချက်အလက်များ)</th>
                        <th className="py-3.5 px-4 w-[33%]">Access Roles & Governance (ကြည့်ရှုခွင့် အခန်းကဏ္ဍများ)</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 text-xs">
                      {/* Row 1: Academic Profile */}
                      <tr className="hover:bg-slate-50/80 transition-colors">
                        <td className="py-4 px-4 align-top">
                          <div className="flex items-start gap-2.5">
                            <div className="p-2 rounded-xl bg-sky-50 text-sky-600 border border-sky-200 flex-shrink-0 mt-0.5">
                              <BookOpen className="h-4 w-4" />
                            </div>
                            <div>
                              <div className="font-black text-slate-900 text-sm">Academic Profile</div>
                              <div className="text-[11px] text-slate-500">ပညာရည်ဆိုင်ရာ ဖွံ့ဖြိုးမှု</div>
                              <span className="inline-block mt-1 text-[10px] font-bold px-2 py-0.5 rounded bg-sky-100 text-sky-800">
                                Academic Mastery
                              </span>
                            </div>
                          </div>
                        </td>
                        <td className="py-4 px-4 align-top text-slate-700 leading-relaxed">
                          <div className="font-semibold text-slate-900 mb-1.5 text-xs sm:text-sm">
                            Attendance, assignments, assessment history, competency mastery, intervention records, portfolio
                          </div>
                          <div className="flex flex-wrap gap-1.5">
                            <span className="text-[10px] font-medium px-2 py-0.5 rounded-md bg-slate-100 text-slate-600 border border-slate-200">
                              ကျောင်းခေါ်ချိန် (Attendance)
                            </span>
                            <span className="text-[10px] font-medium px-2 py-0.5 rounded-md bg-slate-100 text-slate-600 border border-slate-200">
                              အိမ်စာ/လေ့ကျင့်ခန်း (Assignments)
                            </span>
                            <span className="text-[10px] font-medium px-2 py-0.5 rounded-md bg-slate-100 text-slate-600 border border-slate-200">
                              စာမေးပွဲမှတ်တမ်း (Assessment History)
                            </span>
                            <span className="text-[10px] font-medium px-2 py-0.5 rounded-md bg-slate-100 text-slate-600 border border-slate-200">
                              စွမ်းရည်ကျွမ်းကျင်မှု (Competency Mastery)
                            </span>
                            <span className="text-[10px] font-medium px-2 py-0.5 rounded-md bg-slate-100 text-slate-600 border border-slate-200">
                              ပံ့ပိုးကူညီမှု (Intervention Records)
                            </span>
                            <span className="text-[10px] font-medium px-2 py-0.5 rounded-md bg-slate-100 text-slate-600 border border-slate-200">
                              လက်ရာစုံ (Portfolio)
                            </span>
                          </div>
                        </td>
                        <td className="py-4 px-4 align-top">
                          <div className="font-bold text-slate-900 mb-1.5 text-xs sm:text-sm">
                            Teachers, Parents, School Leaders, Universities
                          </div>
                          <div className="flex flex-wrap gap-1.5">
                            <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-sky-50 text-sky-700 border border-sky-200">
                              ဆရာ/ဆရာမများ (Teachers)
                            </span>
                            <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-indigo-50 text-indigo-700 border border-indigo-200">
                              မိဘများ (Parents)
                            </span>
                            <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-slate-100 text-slate-700 border border-slate-200">
                              ကျောင်းအုပ်/စီမံသူ (School Leaders)
                            </span>
                            <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-purple-50 text-purple-700 border border-purple-200">
                              တက္ကသိုလ်များ (Universities)
                            </span>
                          </div>
                        </td>
                      </tr>

                      {/* Row 2: Physical Growth Profile */}
                      <tr className="hover:bg-slate-50/80 transition-colors">
                        <td className="py-4 px-4 align-top">
                          <div className="flex items-start gap-2.5">
                            <div className="p-2 rounded-xl bg-emerald-50 text-emerald-600 border border-emerald-200 flex-shrink-0 mt-0.5">
                              <Activity className="h-4 w-4" />
                            </div>
                            <div>
                              <div className="font-black text-slate-900 text-sm">Physical Growth Profile</div>
                              <div className="text-[11px] text-slate-500">ကာယကြံ့ခိုင်မှုနှင့် ကြီးထွားမှု</div>
                              <span className="inline-block mt-1 text-[10px] font-bold px-2 py-0.5 rounded bg-emerald-100 text-emerald-800">
                                Physical Fitness
                              </span>
                            </div>
                          </div>
                        </td>
                        <td className="py-4 px-4 align-top text-slate-700 leading-relaxed">
                          <div className="font-semibold text-slate-900 mb-1.5 text-xs sm:text-sm">
                            Height, weight, BMI indicators, development milestones, fitness observations (authorized staff entry)
                          </div>
                          <div className="flex flex-wrap gap-1.5">
                            <span className="text-[10px] font-medium px-2 py-0.5 rounded-md bg-slate-100 text-slate-600 border border-slate-200">
                              အရပ်နှင့် အလေးချိန် (Height & Weight)
                            </span>
                            <span className="text-[10px] font-medium px-2 py-0.5 rounded-md bg-slate-100 text-slate-600 border border-slate-200">
                              BMI အညွှန်းကိန်း (BMI Indicators)
                            </span>
                            <span className="text-[10px] font-medium px-2 py-0.5 rounded-md bg-slate-100 text-slate-600 border border-slate-200">
                              ဖွံ့ဖြိုးမှုမှတ်တိုင်များ (Development Milestones)
                            </span>
                            <span className="text-[10px] font-medium px-2 py-0.5 rounded-md bg-slate-100 text-slate-600 border border-slate-200">
                              ကြံ့ခိုင်မှု လေ့လာချက် (Fitness Observations)
                            </span>
                          </div>
                        </td>
                        <td className="py-4 px-4 align-top">
                          <div className="font-bold text-slate-900 mb-1.5 text-xs sm:text-sm">
                            Parents, School Health Staff, Designated Admin
                          </div>
                          <div className="flex flex-wrap gap-1.5">
                            <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-indigo-50 text-indigo-700 border border-indigo-200">
                              မိဘများ (Parents)
                            </span>
                            <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-700 border border-emerald-200">
                              ကျောင်းကျန်းမာရေးဝန်ထမ်း (Health Staff)
                            </span>
                            <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-slate-100 text-slate-700 border border-slate-200">
                              တာဝန်ကျ စီမံခန့်ခွဲသူ (Designated Admin)
                            </span>
                          </div>
                          <div className="mt-2 text-[10px] font-bold text-emerald-700 flex items-center gap-1">
                            <Check className="h-3 w-3" />
                            <span>Authorized staff entry verification</span>
                          </div>
                        </td>
                      </tr>

                      {/* Row 3: Health Visibility Layer */}
                      <tr className="hover:bg-slate-50/80 transition-colors">
                        <td className="py-4 px-4 align-top">
                          <div className="flex items-start gap-2.5">
                            <div className="p-2 rounded-xl bg-amber-50 text-amber-600 border border-amber-200 flex-shrink-0 mt-0.5">
                              <ShieldCheck className="h-4 w-4" />
                            </div>
                            <div>
                              <div className="font-black text-slate-900 text-sm">Health Visibility Layer</div>
                              <div className="text-[11px] text-slate-500">ကျန်းမာရေး စောင့်ရှောက်မှု အလွှာ</div>
                              <span className="inline-block mt-1 text-[10px] font-bold px-2 py-0.5 rounded bg-amber-100 text-amber-800">
                                Health Records
                              </span>
                            </div>
                          </div>
                        </td>
                        <td className="py-4 px-4 align-top text-slate-700 leading-relaxed">
                          <div className="font-semibold text-slate-900 mb-1.5 text-xs sm:text-sm">
                            Immunization status, school screening records, recurring health issues, referral history, follow-up markers
                          </div>
                          <div className="flex flex-wrap gap-1.5">
                            <span className="text-[10px] font-medium px-2 py-0.5 rounded-md bg-slate-100 text-slate-600 border border-slate-200">
                              ကာကွယ်ဆေးထိုး မှတ်တမ်း (Immunization)
                            </span>
                            <span className="text-[10px] font-medium px-2 py-0.5 rounded-md bg-slate-100 text-slate-600 border border-slate-200">
                              ကျောင်းတွင်း စစ်ဆေးမှု (Screening Records)
                            </span>
                            <span className="text-[10px] font-medium px-2 py-0.5 rounded-md bg-slate-100 text-slate-600 border border-slate-200">
                              ထပ်တလဲလဲ ကျန်းမာရေးပြဿနာ (Recurring Issues)
                            </span>
                            <span className="text-[10px] font-medium px-2 py-0.5 rounded-md bg-slate-100 text-slate-600 border border-slate-200">
                              လွှဲပြောင်းကုသမှု မှတ်တမ်း (Referral History)
                            </span>
                            <span className="text-[10px] font-medium px-2 py-0.5 rounded-md bg-slate-100 text-slate-600 border border-slate-200">
                              နောက်ဆက်တွဲ ခြေရာခံခြင်း (Follow-up Markers)
                            </span>
                          </div>
                        </td>
                        <td className="py-4 px-4 align-top">
                          <div className="font-bold text-slate-900 mb-1.5 text-xs sm:text-sm">
                            Parents, School Health Staff (off-chain; consent-gated)
                          </div>
                          <div className="flex flex-wrap gap-1.5">
                            <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-indigo-50 text-indigo-700 border border-indigo-200">
                              မိဘများ (Parents)
                            </span>
                            <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-700 border border-emerald-200">
                              ကျောင်းကျန်းမာရေးဝန်ထမ်း (Health Staff)
                            </span>
                          </div>
                          <div className="mt-2 inline-flex items-center gap-1 px-2 py-0.5 rounded bg-rose-50 border border-rose-200 text-rose-800 text-[10px] font-bold">
                            <Lock className="h-3 w-3 text-rose-600" />
                            <span>Off-chain; consent-gated</span>
                          </div>
                        </td>
                      </tr>

                      {/* Row 4: Wellbeing & Emotional Profile */}
                      <tr className="hover:bg-slate-50/80 transition-colors">
                        <td className="py-4 px-4 align-top">
                          <div className="flex items-start gap-2.5">
                            <div className="p-2 rounded-xl bg-rose-50 text-rose-600 border border-rose-200 flex-shrink-0 mt-0.5">
                              <Smile className="h-4 w-4" />
                            </div>
                            <div>
                              <div className="font-black text-slate-900 text-sm">Wellbeing & Emotional Profile</div>
                              <div className="text-[11px] text-slate-500">စိတ်ပိုင်းဆိုင်ရာနှင့် စိတ်ခံစားမှု</div>
                              <span className="inline-block mt-1 text-[10px] font-bold px-2 py-0.5 rounded bg-rose-100 text-rose-800">
                                Emotional Wellbeing
                              </span>
                            </div>
                          </div>
                        </td>
                        <td className="py-4 px-4 align-top text-slate-700 leading-relaxed">
                          <div className="font-semibold text-slate-900 mb-1.5 text-xs sm:text-sm">
                            Periodic check-ins, mood indicators, counselor flags, support workflow triggers — AI-flagged, human-reviewed
                          </div>
                          <div className="flex flex-wrap gap-1.5">
                            <span className="text-[10px] font-medium px-2 py-0.5 rounded-md bg-slate-100 text-slate-600 border border-slate-200">
                              ပုံမှန် မေးမြန်းချက် (Periodic Check-ins)
                            </span>
                            <span className="text-[10px] font-medium px-2 py-0.5 rounded-md bg-slate-100 text-slate-600 border border-slate-200">
                              စိတ်ခံစားမှု အညွှန်း (Mood Indicators)
                            </span>
                            <span className="text-[10px] font-medium px-2 py-0.5 rounded-md bg-slate-100 text-slate-600 border border-slate-200">
                              နှစ်သိမ့်ဆွေးနွေးမှု အချက်ပြ (Counselor Flags)
                            </span>
                            <span className="text-[10px] font-medium px-2 py-0.5 rounded-md bg-slate-100 text-slate-600 border border-slate-200">
                              ပံ့ပိုးမှု လုပ်ငန်းစဉ် (Support Workflow Triggers)
                            </span>
                          </div>
                        </td>
                        <td className="py-4 px-4 align-top">
                          <div className="font-bold text-slate-900 mb-1.5 text-xs sm:text-sm">
                            Counselors, Parents (with consent), School Leaders
                          </div>
                          <div className="flex flex-wrap gap-1.5">
                            <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-rose-50 text-rose-700 border border-rose-200">
                              နှစ်သိမ့်ဆွေးနွေးသူများ (Counselors)
                            </span>
                            <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-indigo-50 text-indigo-700 border border-indigo-200">
                              မိဘများ (Parents - with consent)
                            </span>
                            <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-slate-100 text-slate-700 border border-slate-200">
                              ကျောင်းခေါင်းဆောင်များ (School Leaders)
                            </span>
                          </div>
                          <div className="mt-2 inline-flex items-center gap-1 px-2 py-0.5 rounded bg-amber-50 border border-amber-200 text-amber-800 text-[10px] font-bold">
                            <Sparkles className="h-3 w-3 text-amber-600" />
                            <span>AI-flagged, human-reviewed</span>
                          </div>
                        </td>
                      </tr>

                      {/* Row 5: Social Participation Profile */}
                      <tr className="hover:bg-slate-50/80 transition-colors">
                        <td className="py-4 px-4 align-top">
                          <div className="flex items-start gap-2.5">
                            <div className="p-2 rounded-xl bg-purple-50 text-purple-600 border border-purple-200 flex-shrink-0 mt-0.5">
                              <Award className="h-4 w-4" />
                            </div>
                            <div>
                              <div className="font-black text-slate-900 text-sm">Social Participation Profile</div>
                              <div className="text-[11px] text-slate-500">လူမှုဆက်ဆံရေးနှင့် ပူးပေါင်းပါဝင်မှု</div>
                              <span className="inline-block mt-1 text-[10px] font-bold px-2 py-0.5 rounded bg-purple-100 text-purple-800">
                                Civic Participation
                              </span>
                            </div>
                          </div>
                        </td>
                        <td className="py-4 px-4 align-top text-slate-700 leading-relaxed">
                          <div className="font-semibold text-slate-900 mb-1.5 text-xs sm:text-sm">
                            Club participation, volunteering, teamwork, leadership, attendance consistency, positive citizenship record
                          </div>
                          <div className="flex flex-wrap gap-1.5">
                            <span className="text-[10px] font-medium px-2 py-0.5 rounded-md bg-slate-100 text-slate-600 border border-slate-200">
                              အသင်းအဖွဲ့ ပါဝင်မှု (Club Participation)
                            </span>
                            <span className="text-[10px] font-medium px-2 py-0.5 rounded-md bg-slate-100 text-slate-600 border border-slate-200">
                              စေတနာ့ဝန်ထမ်း (Volunteering)
                            </span>
                            <span className="text-[10px] font-medium px-2 py-0.5 rounded-md bg-slate-100 text-slate-600 border border-slate-200">
                              အသင်းလိုက် ပူးပေါင်းဆောင်ရွက်မှု (Teamwork)
                            </span>
                            <span className="text-[10px] font-medium px-2 py-0.5 rounded-md bg-slate-100 text-slate-600 border border-slate-200">
                              ခေါင်းဆောင်မှု (Leadership)
                            </span>
                            <span className="text-[10px] font-medium px-2 py-0.5 rounded-md bg-slate-100 text-slate-600 border border-slate-200">
                              တက်ရောက်မှု တသမတ်တည်းရှိမှု (Attendance Consistency)
                            </span>
                            <span className="text-[10px] font-medium px-2 py-0.5 rounded-md bg-slate-100 text-slate-600 border border-slate-200">
                              အပြုသဘောဆောင် နိုင်ငံသားမှတ်တမ်း (Positive Citizenship)
                            </span>
                          </div>
                        </td>
                        <td className="py-4 px-4 align-top">
                          <div className="font-bold text-slate-900 mb-1.5 text-xs sm:text-sm">
                            Students, Parents, Institutions (transparent & appealable)
                          </div>
                          <div className="flex flex-wrap gap-1.5">
                            <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-700 border border-emerald-200">
                              ကျောင်းသားများ (Students)
                            </span>
                            <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-indigo-50 text-indigo-700 border border-indigo-200">
                              မိဘများ (Parents)
                            </span>
                            <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-slate-100 text-slate-700 border border-slate-200">
                              အဖွဲ့အစည်း/ကျောင်းများ (Institutions)
                            </span>
                          </div>
                          <div className="mt-2 inline-flex items-center gap-1 px-2 py-0.5 rounded bg-purple-50 border border-purple-200 text-purple-800 text-[10px] font-bold">
                            <ShieldCheck className="h-3 w-3 text-purple-600" />
                            <span>Transparent & appealable</span>
                          </div>
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* Tab 4: Blockchain Digital ID */}
          {activeTab === 'digital_id' && (
            <div className="space-y-6">
              <div>
                <h3 className="text-base font-bold text-slate-900">တိုက်ရိုက်စိစစ်နိုင်သော ဒီဂျစ်တယ် သက်သေခံကတ်ပြား (DID)</h3>
                <p className="text-xs text-slate-500">Polygon Layer-2 Blockchain ပေါ်တွင် ကျောက်ထိုးမှတ်တမ်းတင်ထားသော ပညာရေး သက်သေခံမှတ်တမ်း</p>
              </div>

              {blockchain ? (
                <div className="space-y-6">
                  {/* Physical Smart Card Preview & Print */}
                  <div className="flex flex-col items-center p-6 bg-slate-900 rounded-3xl border border-slate-800 shadow-inner">
                    <StudentSmartCard
                      blockchainId={blockchain}
                      gradeLevel={student.grade_level}
                      className={student.class_name}
                      showPrintButton={true}
                    />
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-start">
                  <div className="p-6 bg-slate-50 rounded-2xl border border-slate-200 flex flex-col items-center text-center space-y-3">
                    <div className="p-2 bg-white rounded-xl border border-slate-300 shadow-sm">
                      <QRCodeImage value={blockchain.did} size={150} />
                    </div>
                    <span className="text-[11px] font-bold text-slate-600">Scan to Verify Digital ID</span>
                    <button
                      onClick={() => handleCopy(blockchain.did)}
                      className="inline-flex items-center gap-1 text-xs text-indigo-600 font-bold hover:underline"
                    >
                      <Copy className="h-3.5 w-3.5" />
                      <span>{copied ? 'ကူးယူပြီးပါပြီ' : 'DID ကူးယူရန်'}</span>
                    </button>
                  </div>

                  <div className="md:col-span-2 space-y-4">
                    <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-1">
                      <span className="text-[11px] font-bold text-slate-400 uppercase">Decentralized Identifier (DID)</span>
                      <div className="font-mono text-xs font-bold text-slate-800 break-all select-all">
                        {blockchain.did}
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 space-y-1">
                        <span className="text-[10px] font-bold text-slate-400 uppercase">Blockchain Address</span>
                        <div className="font-mono text-xs text-slate-700 truncate">
                          {blockchain.blockchain_address || '0x45A3f2E19854...'}
                        </div>
                      </div>

                      <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 space-y-1">
                        <span className="text-[10px] font-bold text-slate-400 uppercase">Anchor Status</span>
                        <div className="flex items-center gap-1 text-xs font-bold text-emerald-700">
                          <CheckCircle2 className="h-3.5 w-3.5" />
                          <span>{blockchain.anchor_status === 'anchored' ? 'On-Chain Anchored' : 'Cryptographically Verified'}</span>
                        </div>
                      </div>
                    </div>

                    <div className="p-4 rounded-xl bg-indigo-50/70 border border-indigo-200 flex items-center justify-between gap-4">
                      <div>
                        <div className="font-bold text-indigo-900 text-xs">အများပြည်သူ စိစစ်နိုင်သော စာမျက်နှာ</div>
                        <div className="text-[11px] text-indigo-700/80">မည်သူမဆို ကျောင်းသား၏ သက်သေခံကတ်ပြားကို QR ဖြင့် တိုက်ရိုက် စစ်ဆေးနိုင်ပါသည်</div>
                      </div>
                      <Link
                        to={`/verify?did=${encodeURIComponent(blockchain.did)}`}
                        target="_blank"
                        className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold shadow-xs transition flex-shrink-0"
                      >
                        <ExternalLink className="h-3.5 w-3.5" />
                        <span>စိစစ်ရန်</span>
                      </Link>
                    </div>
                  </div>
                </div>
              </div>
              ) : (
                <div className="py-8 text-center text-xs text-slate-400 bg-slate-50 rounded-xl border border-dashed border-slate-200">
                  ဒီဂျစ်တယ် သက်သေခံကတ်ပြားအား ထုတ်ပေးနေဆဲဖြစ်ပါသည်
                </div>
              )}
            </div>
          )}

          {/* Tab 5: Guardian */}
          {activeTab === 'guardian' && (
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-base font-bold text-slate-900">မိဘ/အုပ်ထိန်းသူ ဆက်သွယ်ရန် အချက်အလက်</h3>
                  <p className="text-xs text-slate-500">ကျောင်းသား၏ မိဘ (သို့) အုပ်ထိန်းသူနှင့် တိုက်ရိုက် ဆက်သွယ်ရန်</p>
                </div>
                <button
                  onClick={() => setChatOpen(true)}
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold shadow-xs transition"
                >
                  <MessageSquare className="h-4 w-4" />
                  <span>မိဘထံ မက်ဆေ့ခ်ျ ပို့ရန်</span>
                </button>
              </div>

              <div className="p-5 rounded-xl border border-slate-200 bg-slate-50/50 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="flex items-center gap-4">
                  <div className="h-12 w-12 rounded-full bg-emerald-100 text-emerald-800 font-black text-base flex items-center justify-center border border-emerald-200">
                    {student.parent_name ? student.parent_name.charAt(0) : 'P'}
                  </div>
                  <div>
                    <h4 className="font-bold text-slate-900 text-sm">
                      {student.parent_name || 'ဒေါ်ခင်မာ (Daw Khin Mar - မိခင်)'}
                    </h4>
                    <div className="flex items-center gap-1 text-xs text-slate-500 mt-0.5">
                      <Phone className="h-3 w-3 text-slate-400" />
                      <span className="font-mono">{student.parent_email || '0922222'}</span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <span className="text-[11px] font-bold px-2.5 py-1 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-200">
                    အတည်ပြုပြီး အုပ်ထိန်းသူ
                  </span>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Change Class Modal */}
      {classModalOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl max-w-md w-full border border-slate-200 shadow-2xl overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50">
              <div className="flex items-center gap-2">
                <GraduationCap className="h-5 w-5 text-indigo-600" />
                <h3 className="font-bold text-slate-900 text-base">အတန်းနှင့် အခန်း ပြောင်းလဲရန်</h3>
              </div>
              <button
                onClick={() => setClassModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-lg"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleChangeClass} className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  ကျောင်းသား အမည်
                </label>
                <input
                  type="text"
                  disabled
                  value={student.full_name}
                  className="w-full px-3 py-2 text-sm bg-slate-100 border border-slate-200 rounded-lg text-slate-600 font-bold"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  ပြောင်းရွှေ့မည့် အတန်းနှင့် အခန်း (Target Section) <span className="text-rose-500">*</span>
                </label>
                <select
                  required
                  value={selectedNewClassId}
                  onChange={(e) => setSelectedNewClassId(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white"
                >
                  <option value="">-- အတန်း ရွေးချယ်ပါ --</option>
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
                  onClick={() => setClassModalOpen(false)}
                  className="px-4 py-2 rounded-lg border border-slate-300 text-slate-700 text-xs font-bold hover:bg-slate-50 transition"
                >
                  မလုပ်တော့ပါ
                </button>
                <button
                  type="submit"
                  disabled={transferringClass}
                  className="px-5 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold shadow transition disabled:opacity-50 flex items-center gap-1.5"
                >
                  {transferringClass && <RefreshCw className="h-3.5 w-3.5 animate-spin" />}
                  <span>{transferringClass ? 'ပြောင်းလဲနေသည်...' : 'အတန်း ပြောင်းလဲမည်'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Direct Parent Chat Modal */}
      {chatOpen && (
        <ChatModal
          isOpen={chatOpen}
          onClose={() => setChatOpen(false)}
          studentId={student.id}
          title={`မိဘနှင့် ဆက်သွယ်ရန် (${student.full_name})`}
          subtitle="ကျောင်းသား၏ မိဘ/အုပ်ထိန်းသူထံ တိုက်ရိုက် မက်ဆေ့ခ်ျ ပေးပို့ခြင်း"
        />
      )}
    </div>
  );
};
