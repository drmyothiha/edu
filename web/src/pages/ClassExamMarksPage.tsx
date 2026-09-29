import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useParams, Link, useLocation } from 'react-router-dom';
import { api } from '../api/client';
import {
  ClassDTO,
  ExamRosterItem,
  ExamSummaryInfo,
  BatchExamMarksRequest,
  WholeChildProfileDTO,
  SchoolDTO,
} from '../types';
import {
  ArrowLeft,
  Save,
  Download,
  Search,
  Plus,
  RefreshCw,
  CheckCircle2,
  AlertCircle,
  Award,
  Users,
  GraduationCap,
  Sparkles,
  ChevronDown,
  X,
  FileSpreadsheet,
  BookOpen,
  Activity,
  ShieldCheck,
  Smile,
  Heart,
  Calendar,
  Layers,
  Check,
  Clock,
  Lock,
  Printer,
} from 'lucide-react';
import { MassReportCardPrintModal, ReportCardStudentItem } from '../components/MassReportCardPrintModal';

// Domain tabs in Google Sheets style
export type WholeChildDomainTab = 'academic' | 'physical' | 'health' | 'wellbeing' | 'social';

// Subject keys in order for Academic sheet
const SUBJECT_KEYS = [
  'myanmar',
  'english',
  'maths',
  'phy',
  'chem',
  'bio',
  'geo',
  'his',
  'eco',
  'social',
] as const;

type SubjectKey = (typeof SUBJECT_KEYS)[number];

interface SubjectMeta {
  key: SubjectKey;
  labelEn: string;
  labelMy: string;
  shortLabel: string;
}

const SUBJECTS_CONFIG: SubjectMeta[] = [
  { key: 'myanmar', labelEn: 'Myanmar', labelMy: 'မြန်မာစာ', shortLabel: 'မြန်မာ' },
  { key: 'english', labelEn: 'English', labelMy: 'အင်္ဂလိပ်စာ', shortLabel: 'အင်္ဂလိပ်' },
  { key: 'maths', labelEn: 'Maths', labelMy: 'သင်္ချာ', shortLabel: 'သင်္ချာ' },
  { key: 'phy', labelEn: 'Physics', labelMy: 'ရူပဗေဒ', shortLabel: 'ရူပ' },
  { key: 'chem', labelEn: 'Chemistry', labelMy: 'ဓာတုဗေဒ', shortLabel: 'ဓာတု' },
  { key: 'bio', labelEn: 'Biology', labelMy: 'ဇီဝဗေဒ', shortLabel: 'ဇီဝ' },
  { key: 'geo', labelEn: 'Geography', labelMy: 'ပထဝီ', shortLabel: 'ပထဝီ' },
  { key: 'his', labelEn: 'History', labelMy: 'သမိုင်း', shortLabel: 'သမိုင်း' },
  { key: 'eco', labelEn: 'Economics', labelMy: 'ဘောဂဗေဒ', shortLabel: 'ဘောဂ' },
  { key: 'social', labelEn: 'Social Studies', labelMy: 'လူမှုရေး', shortLabel: 'လူမှုရေး' },
];

const EXAM_PRESETS = [
  'ပထမနှစ်ဝက် စာမေးပွဲ',
  'ဒုတိယနှစ်ဝက် စာမေးပွဲ',
  'နှစ်ဆုံး စာမေးပွဲ',
  'လစဉ်စစ်ဆေးခြင်း - ဇူလိုင်',
  'လစဉ်စစ်ဆေးခြင်း - သြဂုတ်',
  'လစဉ်စစ်ဆေးခြင်း - စက်တင်ဘာ',
  'လစဉ်စစ်ဆေးခြင်း - အောက်တိုဘာ',
  'လစဉ်စစ်ဆေးခြင်း - ဒီဇင်ဘာ',
];

const PERIOD_PRESETS = [
  { value: '2026-10', label: '2026-10 အောက်တိုဘာ' },
  { value: '2026-09', label: '2026-09 စက်တင်ဘာ' },
  { value: '2026-08', label: '2026-08 သြဂုတ်' },
  { value: '2026-07', label: '2026-07 ဇူလိုင်' },
  { value: '2026-11', label: '2026-11 နိုဝင်ဘာ' },
  { value: '2026-12', label: '2026-12 ဒီဇင်ဘာ' },
  { value: '2027-01', label: '2027-01 ဇန်နဝါရီ' },
];

interface StudentRowState {
  student_id: string;
  student_name: string;
  student_email: string;
  marks: Record<SubjectKey, string>;
  remarks: string;
}

interface PhysicalRowState {
  height_cm: string;
  weight_kg: string;
  growth_category: string;
  motor_skills: string;
  fine_motor_grip: string;
  milk_program: boolean;
  preferred_sports: string;
}

interface HealthRowState {
  vision_check: string;
  hearing_check: string;
  oral_dental: string;
  deworming_done: boolean;
  vitamin_a_done: boolean;
  known_allergies: string;
  clinic_referral: string;
}

interface WellbeingRowState {
  engagement_index: string;
  dominant_mood: string;
  peer_harmony: string;
  support_workflow: string;
  teacher_notes: string;
}

interface SocialRowState {
  leadership_role: string;
  club_name: string;
  volunteering_count: string;
  citizenship_badge: string;
  collaboration_rating: string;
}

// Calculate BMI helper
const calculateBMI = (hStr?: string, wStr?: string): number => {
  const h = parseFloat(hStr || '');
  const w = parseFloat(wStr || '');
  if (!h || !w || h <= 0) return 0;
  const hM = h / 100;
  const bmi = w / (hM * hM);
  return Math.round(bmi * 10) / 10;
};

export const ClassExamMarksPage: React.FC = () => {
  const { id: classId } = useParams<{ id: string }>();
  const location = useLocation();

  // Determine back navigation path
  const backUrl = useMemo(() => {
    if (location.pathname.startsWith('/school-admin')) {
      return `/school-admin/classes${location.search}`;
    }
    if (location.pathname.startsWith('/admin')) {
      return `/admin/classes${location.search}`;
    }
    return '/teacher';
  }, [location]);

  // Active Sheet Domain Tab
  const [activeDomainTab, setActiveDomainTab] = useState<WholeChildDomainTab>('academic');

  // Evaluation Period
  const [selectedPeriod, setSelectedPeriod] = useState<string>('2026-10');

  const [classInfo, setClassInfo] = useState<ClassDTO | null>(null);
  const [selectedExam, setSelectedExam] = useState<string>('ပထမနှစ်ဝက် စာမေးပွဲ');
  const [availableExams, setAvailableExams] = useState<ExamSummaryInfo[]>([]);
  const [customExamInput, setCustomExamInput] = useState('');
  const [showExamDropdown, setShowExamDropdown] = useState(false);
  const [isAddingNewExam, setIsAddingNewExam] = useState(false);

  // Rows and Domain States
  const [rows, setRows] = useState<StudentRowState[]>([]);
  const [wcPhysical, setWcPhysical] = useState<Record<string, PhysicalRowState>>({});
  const [wcHealth, setWcHealth] = useState<Record<string, HealthRowState>>({});
  const [wcWellbeing, setWcWellbeing] = useState<Record<string, WellbeingRowState>>({});
  const [wcSocial, setWcSocial] = useState<Record<string, SocialRowState>>({});

  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [isDirty, setIsDirty] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Report Card Modal States
  const [reportCardModalOpen, setReportCardModalOpen] = useState(false);
  const [schoolInfo, setSchoolInfo] = useState<SchoolDTO | null>(null);

  // Auto-open modal if URL query indicates
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    if (params.get('action') === 'report-cards' || params.get('open') === 'report-cards') {
      setReportCardModalOpen(true);
    }
  }, [location.search]);

  // References to input elements for grid navigation [row][col]
  const cellRefs = useRef<Map<string, HTMLInputElement>>(new Map());

  const setCellRef = (rIdx: number, cIdx: number, el: HTMLInputElement | null) => {
    const key = `${rIdx}:${cIdx}`;
    if (el) {
      cellRefs.current.set(key, el);
    } else {
      cellRefs.current.delete(key);
    }
  };

  // Fetch Class details, Exam Roster & Whole-Child Profiles
  const fetchRosterData = async (examName: string, period = selectedPeriod) => {
    if (!classId) return;
    setLoading(true);
    setError(null);
    try {
      const [cls, rosterRes, wcProfiles] = await Promise.all([
        api.classes.get(classId),
        api.classes.getExamMarks(classId, examName),
        api.classes.getWholeChildProfiles(classId, period).catch(() => []),
      ]);

      setClassInfo(cls);
      setAvailableExams(rosterRes.available_exams || []);
      setSelectedExam(rosterRes.exam_name || examName);

      if (cls && cls.school_id) {
        api.schools.get(cls.school_id).then(setSchoolInfo).catch(() => {});
      }

      // Map roster items to state rows
      const initialRows: StudentRowState[] = (rosterRes.roster || []).map((st: ExamRosterItem) => {
        const marksObj: Record<SubjectKey, string> = {
          myanmar: st.myanmar !== null && st.myanmar !== undefined ? String(st.myanmar) : '',
          english: st.english !== null && st.english !== undefined ? String(st.english) : '',
          maths: st.maths !== null && st.maths !== undefined ? String(st.maths) : '',
          phy: st.phy !== null && st.phy !== undefined ? String(st.phy) : '',
          chem: st.chem !== null && st.chem !== undefined ? String(st.chem) : '',
          bio: st.bio !== null && st.bio !== undefined ? String(st.bio) : '',
          geo: st.geo !== null && st.geo !== undefined ? String(st.geo) : '',
          his: st.his !== null && st.his !== undefined ? String(st.his) : '',
          eco: st.eco !== null && st.eco !== undefined ? String(st.eco) : '',
          social: st.social !== null && st.social !== undefined ? String(st.social) : '',
        };

        return {
          student_id: st.student_id,
          student_name: st.student_name,
          student_email: st.student_email,
          marks: marksObj,
          remarks: st.remarks || '',
        };
      });

      // Populate whole-child maps
      const pMap = new Map<string, any>();
      (wcProfiles || []).forEach((p: any) => pMap.set(p.student_id, p));

      const newPhys: Record<string, PhysicalRowState> = {};
      const newHealth: Record<string, HealthRowState> = {};
      const newWell: Record<string, WellbeingRowState> = {};
      const newSocial: Record<string, SocialRowState> = {};

      initialRows.forEach((st) => {
        const p = pMap.get(st.student_id);
        const phys = p?.physical_growth_profile;
        const health = p?.health_visibility_profile;
        const well = p?.wellbeing_profile;
        const soc = p?.social_citizenship_profile;

        newPhys[st.student_id] = {
          height_cm: phys?.measurements?.height_cm != null ? String(phys.measurements.height_cm) : '108.5',
          weight_kg: phys?.measurements?.weight_kg != null ? String(phys.measurements.weight_kg) : '18.2',
          growth_category: phys?.measurements?.growth_percentile_category || 'standard_healthy',
          motor_skills: phys?.milestones_and_development?.gross_motor_agility || 'age_appropriate',
          fine_motor_grip: phys?.milestones_and_development?.fine_motor_pencil_grip || 'excellent',
          milk_program: phys?.school_nutrition_and_vitality?.school_milk_program === 'enrolled',
          preferred_sports: (phys?.physical_fitness_activity?.preferred_sports || ['Morning Calisthenics', 'Playground Agility']).join(', '),
        };

        newHealth[st.student_id] = {
          vision_check: health?.routine_screenings?.vision_check || 'normal_20_20',
          hearing_check: health?.routine_screenings?.hearing_check || 'normal',
          oral_dental: health?.routine_screenings?.oral_dental_health || 'satisfactory_clean',
          deworming_done: health?.national_campaign_markers?.annual_deworming_completed ?? true,
          vitamin_a_done: health?.national_campaign_markers?.vitamin_a_distributed ?? true,
          known_allergies: (health?.recurring_conditions_and_alerts?.known_allergies || ['None reported'])[0] || 'မရှိပါ',
          clinic_referral: health?.clinic_referrals?.has_active_referral ? 'active_referral' : 'none',
        };

        newWell[st.student_id] = {
          engagement_index: well?.monthly_checkin_summary?.classroom_engagement_index != null ? String(well.monthly_checkin_summary.classroom_engagement_index) : '4.8',
          dominant_mood: well?.monthly_checkin_summary?.dominant_emotional_state || 'joyful_curious',
          peer_harmony: well?.monthly_checkin_summary?.peer_relational_harmony || 'harmonious',
          support_workflow: well?.counselor_support_workflow?.support_level || 'none_required',
          teacher_notes: well?.teacher_observations?.notes || 'တက်ကြွပျော်ရွှင်ပြီး သူငယ်ချင်းများနှင့် သင့်တင့်ပါသည်',
        };

        newSocial[st.student_id] = {
          leadership_role: soc?.leadership_and_roles?.[0]?.role || 'Line Leader (Morning Assembly)',
          club_name: soc?.clubs_and_extracurriculars?.[0]?.club_name || 'Kindergarten Art & Music Circle',
          volunteering_count: String(soc?.community_and_service?.volunteering_events_count || 3),
          citizenship_badge: soc?.teamwork_and_peer_conduct?.citizenship_badges_awarded?.[0] || 'အချိန်တိကျမှုဆု',
          collaboration_rating: String(soc?.teamwork_and_peer_conduct?.collaboration_rating || 5.0),
        };
      });

      setRows(initialRows);
      setWcPhysical(newPhys);
      setWcHealth(newHealth);
      setWcWellbeing(newWell);
      setWcSocial(newSocial);
      setIsDirty(false);
    } catch (err: any) {
      setError(err.message || 'စာမေးပွဲ အမှတ်စာရင်း ရယူရာတွင် အမှားဖြစ်ပေါ်ပါသည်');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRosterData(selectedExam, selectedPeriod);
  }, [classId, selectedPeriod]);

  // Handle Exam selection change
  const handleSelectExam = (name: string) => {
    if (isDirty) {
      if (!window.confirm('သိမ်းဆည်းခြင်းမပြုရသေးသော အချက်အလက်များ ရှိနေပါသည်။ အခြားစာမေးပွဲသို့ ပြောင်းလဲရန် သေချာပါသလား?')) {
        return;
      }
    }
    setSelectedExam(name);
    setShowExamDropdown(false);
    fetchRosterData(name, selectedPeriod);
  };

  // Add custom exam
  const handleCreateCustomExam = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = customExamInput.trim();
    if (!trimmed) return;
    setIsAddingNewExam(false);
    setCustomExamInput('');
    handleSelectExam(trimmed);
  };

  // Handle Mark Cell Change (Academic)
  const handleCellChange = (rowIndex: number, subject: SubjectKey, value: string) => {
    if (value !== '' && !/^\d*\.?\d*$/.test(value)) {
      return;
    }
    const numVal = parseFloat(value);
    if (!isNaN(numVal) && (numVal < 0 || numVal > 100)) {
      return;
    }
    setRows((prev) => {
      const copy = [...prev];
      copy[rowIndex] = {
        ...copy[rowIndex],
        marks: {
          ...copy[rowIndex].marks,
          [subject]: value,
        },
      };
      return copy;
    });
    setIsDirty(true);
  };

  // Handle Remarks Change
  const handleRemarksChange = (rowIndex: number, value: string) => {
    setRows((prev) => {
      const copy = [...prev];
      copy[rowIndex] = {
        ...copy[rowIndex],
        remarks: value,
      };
      return copy;
    });
    setIsDirty(true);
  };

  // Handlers for Whole-Child Field Changes
  const handlePhysicalChange = (studentId: string, field: keyof PhysicalRowState, value: any) => {
    setWcPhysical(prev => ({
      ...prev,
      [studentId]: {
        ...prev[studentId],
        [field]: value,
      },
    }));
    setIsDirty(true);
  };

  const handleHealthChange = (studentId: string, field: keyof HealthRowState, value: any) => {
    setWcHealth(prev => ({
      ...prev,
      [studentId]: {
        ...prev[studentId],
        [field]: value,
      },
    }));
    setIsDirty(true);
  };

  const handleWellbeingChange = (studentId: string, field: keyof WellbeingRowState, value: any) => {
    setWcWellbeing(prev => ({
      ...prev,
      [studentId]: {
        ...prev[studentId],
        [field]: value,
      },
    }));
    setIsDirty(true);
  };

  const handleSocialChange = (studentId: string, field: keyof SocialRowState, value: any) => {
    setWcSocial(prev => ({
      ...prev,
      [studentId]: {
        ...prev[studentId],
        [field]: value,
      },
    }));
    setIsDirty(true);
  };

  // Excel Keyboard Navigation
  const handleCellKeyDown = (
    e: React.KeyboardEvent<HTMLInputElement>,
    rowIndex: number,
    colIndex: number
  ) => {
    if ((e.ctrlKey || e.metaKey) && e.key === 's') {
      e.preventDefault();
      handleSave();
      return;
    }

    const totalCols = SUBJECT_KEYS.length;
    const totalRows = filteredRows.length;

    if (e.key === 'ArrowDown' || e.key === 'Enter') {
      e.preventDefault();
      if (rowIndex < totalRows - 1) {
        const nextCell = cellRefs.current.get(`${rowIndex + 1}:${colIndex}`);
        nextCell?.focus();
        nextCell?.select();
      }
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      if (rowIndex > 0) {
        const prevCell = cellRefs.current.get(`${rowIndex - 1}:${colIndex}`);
        prevCell?.focus();
        prevCell?.select();
      }
    } else if (e.key === 'ArrowRight' && (e.currentTarget.selectionEnd === e.currentTarget.value.length || e.currentTarget.value === '')) {
      if (colIndex < totalCols - 1) {
        e.preventDefault();
        const nextCol = cellRefs.current.get(`${rowIndex}:${colIndex + 1}`);
        nextCol?.focus();
        nextCol?.select();
      }
    } else if (e.key === 'ArrowLeft' && (e.currentTarget.selectionStart === 0 || e.currentTarget.value === '')) {
      if (colIndex > 0) {
        e.preventDefault();
        const prevCol = cellRefs.current.get(`${rowIndex}:${colIndex - 1}`);
        prevCol?.focus();
        prevCol?.select();
      }
    }
  };

  // Unified Save: Handles Academic marks and Whole-Child domains
  const handleSave = async () => {
    if (!classId || saving) return;
    setSaving(true);
    setError(null);
    setSuccessMsg(null);

    try {
      // 1. Prepare Whole-Child Profiles Payload for all students in class
      const wcProfilesPayload = rows.map((row) => {
        const sid = row.student_id;
        const phys = wcPhysical[sid];
        const health = wcHealth[sid];
        const well = wcWellbeing[sid];
        const soc = wcSocial[sid];

        // Academic profile summary from marks
        const marksRecord: Record<string, number> = {};
        let totalMark = 0;
        let subjectsWithMark = 0;
        SUBJECT_KEYS.forEach(sub => {
          const val = row.marks[sub];
          if (val !== '' && !isNaN(parseFloat(val))) {
            const num = parseFloat(val);
            marksRecord[sub] = num;
            totalMark += num;
            subjectsWithMark++;
          }
        });

        const avgScore = subjectsWithMark > 0 ? Math.round(totalMark / subjectsWithMark) : 90;
        const gradePoint = avgScore >= 90 ? 'A+' : avgScore >= 75 ? 'A' : avgScore >= 60 ? 'B' : avgScore >= 40 ? 'C' : 'D';

        return {
          student_id: sid,
          academic_profile: {
            assessments: {
              monthly_exam: marksRecord,
              term_grade_point: gradePoint,
              class_rank_percentile: avgScore >= 90 ? 95 : avgScore >= 75 ? 80 : 65,
            },
            competency_mastery: [
              { code: 'KG-LIT', domain: 'Myanmar Alphabet & Reading', status: 'mastered' },
              { code: 'KG-NUM', domain: 'Counting & Mathematical Concepts', status: 'mastered' },
              { code: 'KG-SOC', domain: 'Social Etiquette & Sharing', status: 'mastered' },
            ],
            portfolio_highlights: ['Art & Drawing Assignment', 'Handprint Workbook'],
          },
          physical_growth_profile: {
            screening_date: `${selectedPeriod}-15`,
            measurements: {
              height_cm: parseFloat(phys?.height_cm || '108.5') || 108.5,
              weight_kg: parseFloat(phys?.weight_kg || '18.2') || 18.2,
              calculated_bmi: calculateBMI(phys?.height_cm, phys?.weight_kg),
              growth_percentile_category: phys?.growth_category || 'standard_healthy',
            },
            milestones_and_development: {
              gross_motor_agility: phys?.motor_skills || 'age_appropriate',
              fine_motor_pencil_grip: phys?.fine_motor_grip || 'excellent',
            },
            school_nutrition_and_vitality: {
              school_milk_program: phys?.milk_program ? 'enrolled' : 'not_enrolled',
            },
            physical_fitness_activity: {
              preferred_sports: (phys?.preferred_sports || 'ကာယလေ့ကျင့်ခန်း').split(',').map(s => s.trim()),
            },
          },
          health_visibility_profile: {
            routine_screenings: {
              vision_check: health?.vision_check || 'normal_20_20',
              hearing_check: health?.hearing_check || 'normal',
              oral_dental_health: health?.oral_dental || 'satisfactory_clean',
            },
            national_campaign_markers: {
              annual_deworming_completed: health?.deworming_done ?? true,
              vitamin_a_distributed: health?.vitamin_a_done ?? true,
            },
            recurring_conditions_and_alerts: {
              known_allergies: [health?.known_allergies || 'မရှိပါ'],
            },
            clinic_referrals: {
              has_active_referral: health?.clinic_referral === 'active_referral',
            },
          },
          wellbeing_profile: {
            monthly_checkin_summary: {
              classroom_engagement_index: parseFloat(well?.engagement_index || '4.8') || 4.8,
              dominant_emotional_state: well?.dominant_mood || 'joyful_curious',
              peer_relational_harmony: well?.peer_harmony || 'harmonious',
            },
            teacher_observations: {
              notes: well?.teacher_notes || 'တက်ကြွပျော်ရွှင်ပြီး သူငယ်ချင်းများနှင့် သင့်တင့်ပါသည်',
            },
            counselor_support_workflow: {
              support_level: well?.support_workflow || 'none_required (Thriving)',
            },
          },
          social_citizenship_profile: {
            leadership_and_roles: [
              { role: soc?.leadership_role || 'Line Leader (Morning Assembly)', tenure: 'Term 1' }
            ],
            clubs_and_extracurriculars: [
              { club_name: soc?.club_name || 'Kindergarten Art & Music Circle', standing: 'active_member' }
            ],
            community_and_service: {
              volunteering_events_count: parseInt(soc?.volunteering_count || '3', 10) || 3,
            },
            teamwork_and_peer_conduct: {
              citizenship_badges_awarded: [soc?.citizenship_badge || 'အချိန်တိကျမှုဆု'],
              collaboration_rating: parseFloat(soc?.collaboration_rating || '5.0') || 5.0,
            },
          },
        };
      });

      // Save Academic Exam Marks to exam_marks table if on academic tab or has marks
      const academicRecords = rows.map((row) => {
        const parseSubject = (sub: SubjectKey): number | null => {
          const val = row.marks[sub];
          if (val === '' || val === null || val === undefined) return null;
          const num = parseFloat(val);
          return isNaN(num) ? null : num;
        };

        return {
          student_id: row.student_id,
          myanmar: parseSubject('myanmar'),
          english: parseSubject('english'),
          maths: parseSubject('maths'),
          phy: parseSubject('phy'),
          chem: parseSubject('chem'),
          bio: parseSubject('bio'),
          geo: parseSubject('geo'),
          his: parseSubject('his'),
          eco: parseSubject('eco'),
          social: parseSubject('social'),
          remarks: row.remarks,
        };
      });

      const batchPromises: Promise<any>[] = [
        api.classes.saveWholeChildProfiles(classId, {
          period: selectedPeriod,
          academic_year: classInfo?.academic_year || '2026-2027',
          profiles: wcProfilesPayload,
        }),
      ];

      if (activeDomainTab === 'academic') {
        const examPayload: BatchExamMarksRequest = {
          exam_name: selectedExam,
          academic_year: classInfo?.academic_year || '2026-2027',
          records: academicRecords,
        };
        batchPromises.push(api.classes.saveExamMarks(classId, examPayload));
      }

      await Promise.all(batchPromises);

      setIsDirty(false);
      setSuccessMsg(
        activeDomainTab === 'academic'
          ? `"${selectedExam}" နှင့် Whole-Child Profile (${rows.length} ဦး) အား အောင်မြင်စွာ သိမ်းဆည်းပြီးပါပြီ။`
          : `Whole-Child (${selectedPeriod}) အချက်အလက်များအား ကျောင်းသား (${rows.length} ဦး) အတွက် အောင်မြင်စွာ သိမ်းဆည်းပြီးပါပြီ။`
      );
      setTimeout(() => setSuccessMsg(null), 4000);
    } catch (err: any) {
      setError(err.message || 'အချက်အလက်များ သိမ်းဆည်းရာတွင် အမှားဖြစ်ပေါ်ပါသည်');
    } finally {
      setSaving(false);
    }
  };

  // Filtered Rows for Search
  const filteredRows = useMemo(() => {
    if (!searchTerm.trim()) return rows;
    const term = searchTerm.toLowerCase();
    return rows.filter(
      (r) =>
        r.student_name.toLowerCase().includes(term) ||
        r.student_email.toLowerCase().includes(term)
    );
  }, [rows, searchTerm]);

  // Statistics Calculations per Domain
  const stats = useMemo(() => {
    if (rows.length === 0) return null;

    if (activeDomainTab === 'academic') {
      let studentsWithMarksCount = 0;
      let totalScoreSum = 0;
      let passedCount = 0;

      const subjectSums: Record<SubjectKey, number> = {
        myanmar: 0, english: 0, maths: 0, phy: 0, chem: 0,
        bio: 0, geo: 0, his: 0, eco: 0, social: 0,
      };

      const subjectCounts: Record<SubjectKey, number> = {
        myanmar: 0, english: 0, maths: 0, phy: 0, chem: 0,
        bio: 0, geo: 0, his: 0, eco: 0, social: 0,
      };

      rows.forEach((r) => {
        let studentHasAnyMark = false;
        let studentSubjectCount = 0;
        let studentSubjectTotal = 0;
        let studentPassedAll = true;

        SUBJECT_KEYS.forEach((k) => {
          const valStr = r.marks[k];
          if (valStr !== '' && valStr !== null && valStr !== undefined) {
            const num = parseFloat(valStr);
            if (!isNaN(num)) {
              studentHasAnyMark = true;
              studentSubjectCount++;
              studentSubjectTotal += num;
              subjectSums[k] += num;
              subjectCounts[k]++;
              if (num < 40) studentPassedAll = false;
            }
          }
        });

        if (studentHasAnyMark) {
          studentsWithMarksCount++;
          totalScoreSum += studentSubjectCount > 0 ? studentSubjectTotal / studentSubjectCount : 0;
          if (studentPassedAll && studentSubjectCount > 0) passedCount++;
        }
      });

      const classAverage = studentsWithMarksCount > 0 ? Math.round((totalScoreSum / studentsWithMarksCount) * 10) / 10 : 0;
      const passRate = studentsWithMarksCount > 0 ? Math.round((passedCount / studentsWithMarksCount) * 100) : 0;

      return {
        type: 'academic',
        totalStudents: rows.length,
        studentsWithMarksCount,
        classAverage,
        passedCount,
        passRate,
        subjectSums,
        subjectCounts,
      };
    }

    if (activeDomainTab === 'physical') {
      let totalHeight = 0;
      let totalWeight = 0;
      let healthyBMICount = 0;
      let milkEnrolledCount = 0;

      rows.forEach(r => {
        const p = wcPhysical[r.student_id];
        const h = parseFloat(p?.height_cm || '0');
        const w = parseFloat(p?.weight_kg || '0');
        if (h > 0) totalHeight += h;
        if (w > 0) totalWeight += w;
        const bmi = calculateBMI(p?.height_cm, p?.weight_kg);
        if (bmi >= 14 && bmi <= 18) healthyBMICount++;
        if (p?.milk_program) milkEnrolledCount++;
      });

      return {
        type: 'physical',
        totalStudents: rows.length,
        avgHeight: rows.length > 0 ? (totalHeight / rows.length).toFixed(1) : '0',
        avgWeight: rows.length > 0 ? (totalWeight / rows.length).toFixed(1) : '0',
        healthyBMIRate: rows.length > 0 ? Math.round((healthyBMICount / rows.length) * 100) : 0,
        milkEnrollRate: rows.length > 0 ? Math.round((milkEnrolledCount / rows.length) * 100) : 0,
      };
    }

    if (activeDomainTab === 'health') {
      let normalVision = 0;
      let dewormingDone = 0;
      let activeReferrals = 0;

      rows.forEach(r => {
        const h = wcHealth[r.student_id];
        if (h?.vision_check === 'normal_20_20') normalVision++;
        if (h?.deworming_done) dewormingDone++;
        if (h?.clinic_referral === 'active_referral') activeReferrals++;
      });

      return {
        type: 'health',
        totalStudents: rows.length,
        normalVisionRate: rows.length > 0 ? Math.round((normalVision / rows.length) * 100) : 0,
        dewormingRate: rows.length > 0 ? Math.round((dewormingDone / rows.length) * 100) : 0,
        activeReferrals,
      };
    }

    if (activeDomainTab === 'wellbeing') {
      let totalEngagement = 0;
      let harmoniousCount = 0;
      let supportCases = 0;

      rows.forEach(r => {
        const w = wcWellbeing[r.student_id];
        const eng = parseFloat(w?.engagement_index || '4.8');
        if (eng > 0) totalEngagement += eng;
        if (w?.peer_harmony === 'harmonious') harmoniousCount++;
        if (w?.support_workflow === 'counselor_case') supportCases++;
      });

      return {
        type: 'wellbeing',
        totalStudents: rows.length,
        avgEngagement: rows.length > 0 ? (totalEngagement / rows.length).toFixed(1) : '4.8',
        harmonyRate: rows.length > 0 ? Math.round((harmoniousCount / rows.length) * 100) : 0,
        supportCases,
      };
    }

    // Social
    let totalVolunteering = 0;
    let leadersCount = 0;
    let totalCollab = 0;

    rows.forEach(r => {
      const s = wcSocial[r.student_id];
      const vol = parseInt(s?.volunteering_count || '0', 10);
      if (vol > 0) totalVolunteering += vol;
      if (s?.leadership_role && s.leadership_role !== 'None') leadersCount++;
      const col = parseFloat(s?.collaboration_rating || '5.0');
      if (col > 0) totalCollab += col;
    });

    return {
      type: 'social',
      totalStudents: rows.length,
      totalVolunteering,
      leadersCount,
      avgCollaboration: rows.length > 0 ? (totalCollab / rows.length).toFixed(1) : '5.0',
    };
  }, [rows, activeDomainTab, wcPhysical, wcHealth, wcWellbeing, wcSocial]);

  // Export as CSV based on active domain sheet
  const handleExportCSV = () => {
    if (rows.length === 0) return;

    let headers: string[] = [];
    let csvRows: string[] = [];

    if (activeDomainTab === 'academic') {
      headers = [
        'Roll No', 'Student Name', 'Student Email',
        ...SUBJECTS_CONFIG.map((s) => `${s.labelEn} (${s.labelMy})`),
        'Total', 'Average', 'Status', 'Remarks',
      ];
      csvRows.push(headers.join(','));

      rows.forEach((r, idx) => {
        let sum = 0;
        let count = 0;
        let hasFail = false;
        const markVals = SUBJECTS_CONFIG.map((s) => {
          const v = r.marks[s.key];
          if (v !== '') {
            const n = parseFloat(v);
            if (!isNaN(n)) {
              sum += n;
              count++;
              if (n < 40) hasFail = true;
            }
          }
          return v;
        });

        const avg = count > 0 ? (sum / count).toFixed(1) : '';
        const status = count === 0 ? '' : (!hasFail && parseFloat(avg) >= 75) ? 'Distinction' : !hasFail ? 'Pass' : 'Fail';

        const rowData = [
          idx + 1, `"${r.student_name}"`, r.student_email,
          ...markVals, sum || '', avg, status, `"${r.remarks.replace(/"/g, '""')}"`,
        ];
        csvRows.push(rowData.join(','));
      });
    } else if (activeDomainTab === 'physical') {
      headers = [
        '#', 'Student Name', 'Student Email', 'Height (cm)', 'Weight (kg)',
        'BMI', 'Growth Category', 'Motor Skills', 'Fine Motor Grip', 'Milk Program', 'Preferred Sports'
      ];
      csvRows.push(headers.join(','));
      rows.forEach((r, idx) => {
        const p = wcPhysical[r.student_id];
        const bmi = calculateBMI(p?.height_cm, p?.weight_kg);
        csvRows.push([
          idx + 1, `"${r.student_name}"`, r.student_email,
          p?.height_cm || '', p?.weight_kg || '', bmi || '',
          p?.growth_category || '', p?.motor_skills || '', p?.fine_motor_grip || '',
          p?.milk_program ? 'Enrolled' : 'Not Enrolled', `"${(p?.preferred_sports || '').replace(/"/g, '""')}"`
        ].join(','));
      });
    } else if (activeDomainTab === 'health') {
      headers = [
        '#', 'Student Name', 'Student Email', 'Vision Check', 'Hearing Check',
        'Oral Dental', 'Deworming Completed', 'Vitamin A Distributed', 'Known Allergies', 'Clinic Referral'
      ];
      csvRows.push(headers.join(','));
      rows.forEach((r, idx) => {
        const h = wcHealth[r.student_id];
        csvRows.push([
          idx + 1, `"${r.student_name}"`, r.student_email,
          h?.vision_check || '', h?.hearing_check || '', h?.oral_dental || '',
          h?.deworming_done ? 'Yes' : 'No', h?.vitamin_a_done ? 'Yes' : 'No',
          `"${(h?.known_allergies || '').replace(/"/g, '""')}"`, h?.clinic_referral || ''
        ].join(','));
      });
    } else if (activeDomainTab === 'wellbeing') {
      headers = [
        '#', 'Student Name', 'Student Email', 'Engagement Index (1-5)', 'Dominant Mood',
        'Peer Harmony', 'Support Level', 'Teacher Observations Notes'
      ];
      csvRows.push(headers.join(','));
      rows.forEach((r, idx) => {
        const w = wcWellbeing[r.student_id];
        csvRows.push([
          idx + 1, `"${r.student_name}"`, r.student_email,
          w?.engagement_index || '', w?.dominant_mood || '', w?.peer_harmony || '',
          w?.support_workflow || '', `"${(w?.teacher_notes || '').replace(/"/g, '""')}"`
        ].join(','));
      });
    } else {
      headers = [
        '#', 'Student Name', 'Student Email', 'Leadership Role', 'Clubs',
        'Volunteering Events Count', 'Citizenship Badge', 'Collaboration Rating (1-5)'
      ];
      csvRows.push(headers.join(','));
      rows.forEach((r, idx) => {
        const s = wcSocial[r.student_id];
        csvRows.push([
          idx + 1, `"${r.student_name}"`, r.student_email,
          `"${(s?.leadership_role || '').replace(/"/g, '""')}"`, `"${(s?.club_name || '').replace(/"/g, '""')}"`,
          s?.volunteering_count || '', `"${(s?.citizenship_badge || '').replace(/"/g, '""')}"`, s?.collaboration_rating || ''
        ].join(','));
      });
    }

    const blob = new Blob(['\uFEFF' + csvRows.join('\n')], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${classInfo?.name || 'Class'}_WholeChild_${activeDomainTab}_${selectedPeriod}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  // Prepare Report Card students with marks and whole-child attributes
  const reportCardStudents: ReportCardStudentItem[] = useMemo(() => {
    return rows.map((r, idx) => {
      const phys = wcPhysical[r.student_id];
      const health = wcHealth[r.student_id];
      const well = wcWellbeing[r.student_id];
      const soc = wcSocial[r.student_id];

      return {
        student_id: r.student_id,
        student_name: r.student_name,
        roll_no: String(idx + 1).padStart(2, '0'),
        student_email: r.student_email,
        marks: r.marks,
        remarks: r.remarks,
        attendance_rate: 96.5,
        conduct: 'အထူးကောင်းမွန် (Excellent)',
        physical: {
          height_cm: phys?.height_cm,
          weight_kg: phys?.weight_kg,
          bmi: calculateBMI(phys?.height_cm, phys?.weight_kg),
          growth_category: phys?.growth_category,
          preferred_sports: phys?.preferred_sports,
        },
        health: {
          vision_check: health?.vision_check,
          hearing_check: health?.hearing_check,
          oral_dental: health?.oral_dental,
          deworming_done: health?.deworming_done,
          vitamin_a_done: health?.vitamin_a_done,
        },
        wellbeing: {
          engagement_index: well?.engagement_index,
          dominant_mood: well?.dominant_mood,
          peer_harmony: well?.peer_harmony,
          teacher_notes: well?.teacher_notes,
        },
        social: {
          leadership_role: soc?.leadership_role,
          club_name: soc?.club_name,
          citizenship_badge: soc?.citizenship_badge,
          collaboration_rating: soc?.collaboration_rating,
        },
      };
    });
  }, [rows, wcPhysical, wcHealth, wcWellbeing, wcSocial]);

  return (
    <div className="p-4 md:p-6 max-w-[1650px] mx-auto w-full space-y-4 font-sans">
      {/* Top Header Bar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
        <div className="flex items-center gap-3">
          <Link
            to={backUrl}
            className="p-2 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-600 transition shadow-xs flex-shrink-0"
            title="နောက်သို့ ပြန်သွားရန်"
          >
            <ArrowLeft className="h-5 w-5" />
          </Link>

          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-lg md:text-xl font-black text-slate-900 flex items-center gap-2">
                <FileSpreadsheet className="h-6 w-6 text-emerald-600" />
                <span>{classInfo?.name || 'အတန်း အကဲဖြတ်ဇယား'}</span>
              </h1>
              {classInfo?.grade_level && (
                <span className="text-xs font-bold px-2.5 py-0.5 rounded-full bg-indigo-50 text-indigo-700 border border-indigo-200">
                  {classInfo.grade_level}
                </span>
              )}
              {classInfo?.academic_year && (
                <span className="text-xs font-mono font-semibold text-slate-500 bg-slate-100 px-2 py-0.5 rounded-md">
                  {classInfo.academic_year}
                </span>
              )}
            </div>
            <p className="text-xs text-slate-500 mt-1">
              Google Sheet ကဲ့သို့ စာမေးပွဲအမှတ်များနှင့် Whole-Child ၅ ရပ်လုံးအား လွတ်လပ်စွာ ဖြည့်သွင်း စီမံခန့်ခွဲနိုင်သော Marksheet
            </p>
          </div>
        </div>

        {/* Global Save & Export Actions */}
        <div className="flex items-center gap-2 flex-wrap">
          {isDirty && (
            <span className="text-[11px] font-bold text-amber-600 bg-amber-50 px-3 py-1 rounded-full border border-amber-200 animate-pulse">
              ● သိမ်းဆည်းရန် ကျန်ရှိနေပါသည် (Ctrl+S)
            </span>
          )}

          <button
            onClick={() => setReportCardModalOpen(true)}
            disabled={rows.length === 0}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 text-indigo-800 text-xs font-bold shadow-xs transition disabled:opacity-50"
            title="ပညာရည်စစ်ဆေးခြင်း အစီရင်ခံစာများ A4 အစုလိုက် ထုတ်ယူရန်"
          >
            <Printer className="h-4 w-4 text-indigo-600" />
            <span>Report Cards (A4)</span>
          </button>

          <button
            onClick={handleExportCSV}
            disabled={rows.length === 0}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 text-xs font-bold shadow-xs transition disabled:opacity-50"
            title="Excel အဖြစ် ဒေါင်းလုဒ်ရယူရန်"
          >
            <Download className="h-4 w-4 text-emerald-600" />
            <span>Excel ရယူမည်</span>
          </button>

          <button
            onClick={() => fetchRosterData(selectedExam, selectedPeriod)}
            disabled={loading || saving}
            className="p-2 rounded-xl bg-white hover:bg-slate-50 border border-slate-200 text-slate-600 transition shadow-xs"
            title="ပြန်လည် ရယူမည်"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          </button>

          <button
            onClick={handleSave}
            disabled={saving || !isDirty}
            className={`inline-flex items-center gap-2 px-5 py-2 rounded-xl text-xs font-bold shadow-sm transition ${
              isDirty
                ? 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-emerald-200'
                : 'bg-slate-100 text-slate-400 cursor-not-allowed'
            }`}
          >
            <Save className={`h-4 w-4 ${saving ? 'animate-spin' : ''}`} />
            <span>{saving ? 'သိမ်းဆည်းနေသည်...' : 'သိမ်းဆည်းမည်'}</span>
          </button>
        </div>
      </div>

      {/* Alerts */}
      {error && (
        <div className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-xs font-medium text-rose-800 flex items-center justify-between gap-2 shadow-xs">
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
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-xs font-medium text-emerald-800 flex items-center justify-between gap-2 shadow-xs">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4 text-emerald-600 flex-shrink-0" />
            <span>{successMsg}</span>
          </div>
          <button onClick={() => setSuccessMsg(null)} className="text-emerald-500 hover:text-emerald-700">
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {/* Whole-Child 5-Domain Sheet Tabs Bar (Google Sheets Style) */}
      <div className="bg-white p-2 rounded-2xl border border-slate-200 shadow-xs flex items-center gap-2 overflow-x-auto scrollbar-thin">
        <button
          type="button"
          onClick={() => setActiveDomainTab('academic')}
          className={`px-4 py-2.5 rounded-xl text-xs font-bold transition flex items-center gap-2 whitespace-nowrap ${
            activeDomainTab === 'academic'
              ? 'bg-indigo-600 text-white shadow-sm shadow-indigo-200'
              : 'bg-slate-50 text-slate-600 hover:bg-slate-100 hover:text-slate-900 border border-slate-200/60'
          }`}
        >
          <BookOpen className="h-4 w-4" />
          <span>ပညာရေး</span>
          <span className="text-[10px] px-1.5 py-0.2 bg-white/20 rounded-full font-mono">၁၀ ဘာသာ</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveDomainTab('physical')}
          className={`px-4 py-2.5 rounded-xl text-xs font-bold transition flex items-center gap-2 whitespace-nowrap ${
            activeDomainTab === 'physical'
              ? 'bg-emerald-600 text-white shadow-sm shadow-emerald-200'
              : 'bg-slate-50 text-slate-600 hover:bg-slate-100 hover:text-slate-900 border border-slate-200/60'
          }`}
        >
          <Activity className="h-4 w-4" />
          <span>ကာယ</span>
          <span className="text-[10px] px-1.5 py-0.2 bg-white/20 rounded-full font-mono">အရပ်/ပေါင်</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveDomainTab('health')}
          className={`px-4 py-2.5 rounded-xl text-xs font-bold transition flex items-center gap-2 whitespace-nowrap ${
            activeDomainTab === 'health'
              ? 'bg-amber-600 text-white shadow-sm shadow-amber-200'
              : 'bg-slate-50 text-slate-600 hover:bg-slate-100 hover:text-slate-900 border border-slate-200/60'
          }`}
        >
          <ShieldCheck className="h-4 w-4" />
          <span>ကျန်းမာရေး</span>
          <span className="text-[10px] px-1.5 py-0.2 bg-white/20 rounded-full font-mono">စစ်ဆေးချက်</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveDomainTab('wellbeing')}
          className={`px-4 py-2.5 rounded-xl text-xs font-bold transition flex items-center gap-2 whitespace-nowrap ${
            activeDomainTab === 'wellbeing'
              ? 'bg-rose-600 text-white shadow-sm shadow-rose-200'
              : 'bg-slate-50 text-slate-600 hover:bg-slate-100 hover:text-slate-900 border border-slate-200/60'
          }`}
        >
          <Smile className="h-4 w-4" />
          <span>စိတ်ဓါတ်</span>
          <span className="text-[10px] px-1.5 py-0.2 bg-white/20 rounded-full font-mono">တက်ကြွမှု</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveDomainTab('social')}
          className={`px-4 py-2.5 rounded-xl text-xs font-bold transition flex items-center gap-2 whitespace-nowrap ${
            activeDomainTab === 'social'
              ? 'bg-purple-600 text-white shadow-sm shadow-purple-200'
              : 'bg-slate-50 text-slate-600 hover:bg-slate-100 hover:text-slate-900 border border-slate-200/60'
          }`}
        >
          <Award className="h-4 w-4" />
          <span>လူမှုရေး</span>
          <span className="text-[10px] px-1.5 py-0.2 bg-white/20 rounded-full font-mono">ပါဝင်မှု</span>
        </button>
      </div>

      {/* Evaluation Period & Exam Name Selector Toolbar */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-4 flex-wrap">
          {/* Period selector */}
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-slate-700 flex items-center gap-1.5 whitespace-nowrap">
              <Calendar className="h-3.5 w-3.5 text-indigo-600" />
              <span>အကဲဖြတ်ကာလ:</span>
            </span>
            <select
              value={selectedPeriod}
              onChange={(e) => {
                if (isDirty && !window.confirm('သိမ်းဆည်းခြင်းမပြုရသေးသော အချက်အလက်များ ရှိနေပါသည်။ ကာလပြောင်းလဲရန် သေချာပါသလား?')) return;
                setSelectedPeriod(e.target.value);
              }}
              className="px-3 py-1.5 rounded-xl border border-indigo-200 bg-indigo-50/70 text-indigo-900 text-xs font-bold focus:outline-hidden focus:ring-2 focus:ring-indigo-500 shadow-xs cursor-pointer"
            >
              {PERIOD_PRESETS.map((p) => (
                <option key={p.value} value={p.value}>{p.label}</option>
              ))}
            </select>
          </div>

          {/* Exam Name (shown prominently on academic tab) */}
          {activeDomainTab === 'academic' && (
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-xs font-bold text-slate-700 whitespace-nowrap">
                စာမေးပွဲ အမည်:
              </span>

              {!isAddingNewExam ? (
                <div className="relative">
                  <button
                    type="button"
                    onClick={() => setShowExamDropdown(!showExamDropdown)}
                    className="inline-flex items-center justify-between gap-2 px-3 py-1.5 rounded-xl border border-slate-300 bg-white hover:bg-slate-50 text-slate-800 text-xs font-bold min-w-[240px] shadow-xs transition"
                  >
                    <span className="truncate">{selectedExam}</span>
                    <ChevronDown className="h-3.5 w-3.5 text-slate-500 flex-shrink-0" />
                  </button>

                  {showExamDropdown && (
                    <div className="absolute top-full left-0 mt-1 w-80 bg-white rounded-xl border border-slate-200 shadow-xl z-30 py-2 max-h-80 overflow-y-auto">
                      <div className="px-3 py-1 text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                        မှတ်တမ်းရှိ စာမေးပွဲများ
                      </div>
                      {availableExams.length > 0 ? (
                        availableExams.map((ex) => (
                          <button
                            key={ex.exam_name}
                            onClick={() => handleSelectExam(ex.exam_name)}
                            className={`w-full text-left px-3 py-2 text-xs transition flex items-center justify-between ${
                              selectedExam === ex.exam_name
                                ? 'bg-indigo-50 text-indigo-700 font-bold'
                                : 'text-slate-700 hover:bg-slate-50'
                            }`}
                          >
                            <span className="truncate">{ex.exam_name}</span>
                            <span className="text-[10px] text-slate-400 font-mono ml-2">
                              {ex.student_count} ဦး
                            </span>
                          </button>
                        ))
                      ) : (
                        <div className="px-3 py-1 text-xs text-slate-400 italic">မှတ်တမ်းမရှိသေးပါ</div>
                      )}

                      <div className="border-t border-slate-100 my-1" />
                      <div className="px-3 py-1 text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                        ပုံမှန် စာမေးပွဲ ရွေးချယ်မှုများ (Presets)
                      </div>
                      {EXAM_PRESETS.map((preset) => (
                        <button
                          key={preset}
                          onClick={() => handleSelectExam(preset)}
                          className={`w-full text-left px-3 py-2 text-xs transition truncate ${
                            selectedExam === preset
                              ? 'bg-indigo-50 text-indigo-700 font-bold'
                              : 'text-slate-700 hover:bg-slate-50'
                          }`}
                        >
                          {preset}
                        </button>
                      ))}

                      <div className="border-t border-slate-100 my-1" />
                      <button
                        onClick={() => {
                          setShowExamDropdown(false);
                          setIsAddingNewExam(true);
                        }}
                        className="w-full text-left px-3 py-2 text-xs font-bold text-indigo-600 hover:bg-indigo-50 transition flex items-center gap-1.5"
                      >
                        <Plus className="h-3.5 w-3.5" />
                        <span>+ စာမေးပွဲ အမည်အသစ် ထည့်သွင်းမည်</span>
                      </button>
                    </div>
                  )}
                </div>
              ) : (
                <form onSubmit={handleCreateCustomExam} className="flex items-center gap-1.5">
                  <input
                    type="text"
                    required
                    autoFocus
                    placeholder="ဥပမာ- နိုဝင်ဘာလ စစ်ဆေးခြင်း..."
                    value={customExamInput}
                    onChange={(e) => setCustomExamInput(e.target.value)}
                    className="px-3 py-1.5 rounded-lg border border-indigo-300 focus:outline-hidden focus:ring-2 focus:ring-indigo-500 text-xs w-64 shadow-xs"
                  />
                  <button
                    type="submit"
                    className="px-3 py-1.5 rounded-lg bg-indigo-600 text-white text-xs font-bold shadow-xs hover:bg-indigo-700 transition"
                  >
                    အသုံးပြုမည်
                  </button>
                  <button
                    type="button"
                    onClick={() => setIsAddingNewExam(false)}
                    className="p-1.5 rounded-lg border border-slate-200 text-slate-400 hover:text-slate-600"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </form>
              )}
            </div>
          )}
        </div>

        {/* Search student in sheet */}
        <div className="flex items-center gap-2">
          <div className="relative">
            <Search className="h-3.5 w-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="ကျောင်းသား အမည်/အီးမေးလ် ရှာရန်..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-8 pr-3 py-1.5 rounded-xl border border-slate-200 bg-slate-50 text-xs focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-indigo-500 w-48 sm:w-64 transition"
            />
          </div>
          {searchTerm && (
            <button
              onClick={() => setSearchTerm('')}
              className="text-xs text-slate-400 hover:text-slate-600 font-bold"
            >
              ရှင်းလင်းရန်
            </button>
          )}
        </div>
      </div>

      {/* Summary KPI Cards Strip (Dynamic by Domain) */}
      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {stats.type === 'academic' && (
            <>
              <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-xs flex items-center justify-between">
                <div>
                  <span className="text-[11px] font-bold text-slate-400 uppercase">ကျောင်းသားဦးရေ</span>
                  <div className="text-xl font-black text-slate-900 mt-0.5">{stats.totalStudents} ဦး</div>
                </div>
                <Users className="h-7 w-7 text-indigo-500 bg-indigo-50 p-1.5 rounded-xl" />
              </div>

              <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-xs flex items-center justify-between">
                <div>
                  <span className="text-[11px] font-bold text-slate-400 uppercase">အမှတ်ဖြည့်သွင်းပြီး</span>
                  <div className="text-xl font-black text-slate-900 mt-0.5">
                    {stats.studentsWithMarksCount} / {stats.totalStudents} ဦး
                  </div>
                </div>
                <CheckCircle2 className="h-7 w-7 text-emerald-500 bg-emerald-50 p-1.5 rounded-xl" />
              </div>

              <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-xs flex items-center justify-between">
                <div>
                  <span className="text-[11px] font-bold text-slate-400 uppercase">အတန်း ပျမ်းမျှအမှတ်</span>
                  <div className="text-xl font-black text-slate-900 mt-0.5">{stats.classAverage} မှတ်</div>
                </div>
                <Sparkles className="h-7 w-7 text-amber-500 bg-amber-50 p-1.5 rounded-xl" />
              </div>

              <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-xs flex items-center justify-between">
                <div>
                  <span className="text-[11px] font-bold text-slate-400 uppercase">အောင်ချက် ရာခိုင်နှုန်း</span>
                  <div className="text-xl font-black text-emerald-700 mt-0.5">{stats.passRate}%</div>
                </div>
                <Award className="h-7 w-7 text-purple-500 bg-purple-50 p-1.5 rounded-xl" />
              </div>
            </>
          )}

          {stats.type === 'physical' && (
            <>
              <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-xs flex items-center justify-between">
                <div>
                  <span className="text-[11px] font-bold text-slate-400 uppercase">ပျမ်းမျှ အရပ်</span>
                  <div className="text-xl font-black text-slate-900 mt-0.5">{stats.avgHeight} cm</div>
                </div>
                <Activity className="h-7 w-7 text-emerald-500 bg-emerald-50 p-1.5 rounded-xl" />
              </div>

              <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-xs flex items-center justify-between">
                <div>
                  <span className="text-[11px] font-bold text-slate-400 uppercase">ပျမ်းမျှ အလေးချိန်</span>
                  <div className="text-xl font-black text-slate-900 mt-0.5">{stats.avgWeight} kg</div>
                </div>
                <Activity className="h-7 w-7 text-indigo-500 bg-indigo-50 p-1.5 rounded-xl" />
              </div>

              <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-xs flex items-center justify-between">
                <div>
                  <span className="text-[11px] font-bold text-slate-400 uppercase">စံမီ BMI ရာခိုင်နှုန်း</span>
                  <div className="text-xl font-black text-emerald-700 mt-0.5">{stats.healthyBMIRate}%</div>
                </div>
                <CheckCircle2 className="h-7 w-7 text-emerald-500 bg-emerald-50 p-1.5 rounded-xl" />
              </div>

              <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-xs flex items-center justify-between">
                <div>
                  <span className="text-[11px] font-bold text-slate-400 uppercase">ကျောင်းနို့ အစီအစဉ်</span>
                  <div className="text-xl font-black text-purple-700 mt-0.5">{stats.milkEnrollRate}% ပါဝင်</div>
                </div>
                <Award className="h-7 w-7 text-purple-500 bg-purple-50 p-1.5 rounded-xl" />
              </div>
            </>
          )}

          {stats.type === 'health' && (
            <>
              <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-xs flex items-center justify-between">
                <div>
                  <span className="text-[11px] font-bold text-slate-400 uppercase">ပုံမှန် အမြင်အာရုံ</span>
                  <div className="text-xl font-black text-emerald-700 mt-0.5">{stats.normalVisionRate}%</div>
                </div>
                <ShieldCheck className="h-7 w-7 text-emerald-500 bg-emerald-50 p-1.5 rounded-xl" />
              </div>

              <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-xs flex items-center justify-between">
                <div>
                  <span className="text-[11px] font-bold text-slate-400 uppercase">သန်ချဆေး တိုက်ကျွေးမှု</span>
                  <div className="text-xl font-black text-slate-900 mt-0.5">{stats.dewormingRate}% ပြီးစီး</div>
                </div>
                <CheckCircle2 className="h-7 w-7 text-indigo-500 bg-indigo-50 p-1.5 rounded-xl" />
              </div>

              <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-xs flex items-center justify-between">
                <div>
                  <span className="text-[11px] font-bold text-slate-400 uppercase">ဆေးခန်း လွှဲပြောင်းမှု</span>
                  <div className="text-xl font-black text-amber-700 mt-0.5">{stats.activeReferrals} မှု</div>
                </div>
                <AlertCircle className="h-7 w-7 text-amber-500 bg-amber-50 p-1.5 rounded-xl" />
              </div>

              <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-xs flex items-center justify-between">
                <div>
                  <span className="text-[11px] font-bold text-slate-400 uppercase">ကျန်းမာရေး စစ်ဆေးမှုအလွှာ</span>
                  <div className="text-sm font-bold text-indigo-700 mt-1">ခွင့်ပြုချက်ရယူပြီး</div>
                </div>
                <Lock className="h-7 w-7 text-indigo-500 bg-indigo-50 p-1.5 rounded-xl" />
              </div>
            </>
          )}

          {stats.type === 'wellbeing' && (
            <>
              <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-xs flex items-center justify-between">
                <div>
                  <span className="text-[11px] font-bold text-slate-400 uppercase">ပျမ်းမျှ တက်ကြွမှု အညွှန်း</span>
                  <div className="text-xl font-black text-rose-700 mt-0.5">{stats.avgEngagement} / 5.0</div>
                </div>
                <Smile className="h-7 w-7 text-rose-500 bg-rose-50 p-1.5 rounded-xl" />
              </div>

              <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-xs flex items-center justify-between">
                <div>
                  <span className="text-[11px] font-bold text-slate-400 uppercase">သူငယ်ချင်း ဆက်ဆံရေး သင့်တင့်မှု</span>
                  <div className="text-xl font-black text-emerald-700 mt-0.5">{stats.harmonyRate}%</div>
                </div>
                <CheckCircle2 className="h-7 w-7 text-emerald-500 bg-emerald-50 p-1.5 rounded-xl" />
              </div>

              <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-xs flex items-center justify-between">
                <div>
                  <span className="text-[11px] font-bold text-slate-400 uppercase">နှစ်သိမ့်ဆွေးနွေးမှု လိုအပ်မှု</span>
                  <div className="text-xl font-black text-slate-900 mt-0.5">{stats.supportCases} ဦး</div>
                </div>
                <Heart className="h-7 w-7 text-amber-500 bg-amber-50 p-1.5 rounded-xl" />
              </div>

              <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-xs flex items-center justify-between">
                <div>
                  <span className="text-[11px] font-bold text-slate-400 uppercase">စိစစ်ချက် မူဘောင်</span>
                  <div className="text-xs font-bold text-purple-700 mt-1">စနစ်ကူညီစိစစ်ချက်</div>
                </div>
                <Sparkles className="h-7 w-7 text-purple-500 bg-purple-50 p-1.5 rounded-xl" />
              </div>
            </>
          )}

          {stats.type === 'social' && (
            <>
              <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-xs flex items-center justify-between">
                <div>
                  <span className="text-[11px] font-bold text-slate-400 uppercase">ခေါင်းဆောင်မှု တာဝန်ရရှိသူ</span>
                  <div className="text-xl font-black text-purple-700 mt-0.5">{stats.leadersCount} ဦး</div>
                </div>
                <Award className="h-7 w-7 text-purple-500 bg-purple-50 p-1.5 rounded-xl" />
              </div>

              <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-xs flex items-center justify-between">
                <div>
                  <span className="text-[11px] font-bold text-slate-400 uppercase">စုစုပေါင်း လူမှုအကျိုးပြုအကြိမ်</span>
                  <div className="text-xl font-black text-slate-900 mt-0.5">{stats.totalVolunteering} ကြိမ်</div>
                </div>
                <Users className="h-7 w-7 text-indigo-500 bg-indigo-50 p-1.5 rounded-xl" />
              </div>

              <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-xs flex items-center justify-between">
                <div>
                  <span className="text-[11px] font-bold text-slate-400 uppercase">ပျမ်းမျှ ပူးပေါင်းဆောင်ရွက်မှု</span>
                  <div className="text-xl font-black text-emerald-700 mt-0.5">{stats.avgCollaboration} / 5.0</div>
                </div>
                <CheckCircle2 className="h-7 w-7 text-emerald-500 bg-emerald-50 p-1.5 rounded-xl" />
              </div>

              <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-xs flex items-center justify-between">
                <div>
                  <span className="text-[11px] font-bold text-slate-400 uppercase">မူဘောင် သတ်မှတ်ချက်</span>
                  <div className="text-xs font-bold text-indigo-700 mt-1">စိစစ် အယူခံဝင်နိုင်ခွင့်</div>
                </div>
                <ShieldCheck className="h-7 w-7 text-indigo-500 bg-indigo-50 p-1.5 rounded-xl" />
              </div>
            </>
          )}
        </div>
      )}

      {/* Main Google Sheets / Excel Spreadsheet Container */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden flex flex-col">
        {/* Spreadsheet Header Info & Shortcuts */}
        <div className="px-5 py-2.5 bg-slate-50/90 border-b border-slate-200 flex items-center justify-between text-xs text-slate-500 font-medium overflow-x-auto">
          <div className="flex items-center gap-3">
            <span className="font-bold text-slate-700 flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-emerald-500 inline-block" />
              <span>
                {activeDomainTab === 'academic' && 'ပညာရေး အမှတ်စာရင်း'}
                {activeDomainTab === 'physical' && 'ကာယကြံ့ခိုင်မှုနှင့် ကြီးထွားမှု မှတ်တမ်း'}
                {activeDomainTab === 'health' && 'ကျန်းမာရေး စောင့်ရှောက်မှု အလွှာ'}
                {activeDomainTab === 'wellbeing' && 'စိတ်ဓါတ်နှင့် စိတ်ခံစားမှု မှတ်တမ်း'}
                {activeDomainTab === 'social' && 'လူမှုဆက်ဆံရေးနှင့် ပူးပေါင်းဆောင်ရွက်မှု မှတ်တမ်း'}
              </span>
            </span>
            <span className="text-slate-300">|</span>
            <span className="hidden sm:inline">
              Enter/↓ ဖြင့် အောက်ဆင်း၊ Tab/→ ဖြင့် ဘေးရွေ့၊ Ctrl+S ဖြင့် သိမ်းဆည်းနိုင်ပါသည်။
            </span>
          </div>
          <div className="flex items-center gap-2 text-[11px]">
            <span className="text-slate-400 font-mono">ကာလ: {selectedPeriod}</span>
            <span className="text-slate-300">|</span>
            <span className="text-indigo-600 font-bold">ကျောင်းသား ပရိုဖိုင်သို့ တိုက်ရိုက်ချိတ်ဆက်မည်</span>
          </div>
        </div>

        {/* Loading / Empty States */}
        {loading ? (
          <div className="py-24 text-center">
            <RefreshCw className="h-8 w-8 text-indigo-500 animate-spin mx-auto mb-2" />
            <p className="text-xs font-bold text-slate-500">ကျောင်းသား အချက်အလက်များကို ရယူနေပါသည်...</p>
          </div>
        ) : filteredRows.length === 0 ? (
          <div className="py-20 text-center px-4">
            <GraduationCap className="h-10 w-10 text-slate-300 mx-auto mb-2" />
            <h3 className="text-sm font-bold text-slate-700">ကျောင်းသား မတွေ့ရှိပါ</h3>
            <p className="text-xs text-slate-400 mt-1 max-w-sm mx-auto">
              ဤအတန်းတွင် ကျောင်းသား စာရင်း မရှိသေးပါ သို့မဟုတ် ရှာဖွေမှုနှင့် မကိုက်ညီပါ။
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto max-h-[70vh] relative">
            {/* SHEET 1: ACADEMIC MARKS */}
            {activeDomainTab === 'academic' && (
              <table className="w-full text-left border-collapse border-spacing-0 text-xs">
                <thead className="sticky top-0 bg-slate-100/95 backdrop-blur-xs z-20 shadow-xs">
                  <tr className="border-b border-slate-300 text-slate-700 uppercase tracking-wider font-extrabold text-[11px]">
                    <th className="py-3 px-3 w-12 text-center border-r border-slate-300 bg-slate-200/80 sticky left-0 z-20">#</th>
                    <th className="py-3 px-4 min-w-[200px] border-r border-slate-300 bg-slate-100/95 sticky left-12 z-20">ကျောင်းသား အမည်</th>
                    {SUBJECTS_CONFIG.map((sub) => (
                      <th key={sub.key} className="py-2.5 px-2 min-w-[78px] text-center border-r border-slate-300 group hover:bg-slate-200/60 transition" title={sub.labelMy}>
                        <div className="font-black text-slate-800 text-[11px]">{sub.shortLabel}</div>
                      </th>
                    ))}
                    <th className="py-3 px-3 min-w-[80px] text-center border-r border-slate-300 bg-indigo-50/70 text-indigo-900 font-black">
                      <div>စုစုပေါင်း</div>
                    </th>
                    <th className="py-3 px-3 min-w-[80px] text-center border-r border-slate-300 bg-indigo-50/70 text-indigo-900 font-black">
                      <div>ပျမ်းမျှ</div>
                    </th>
                    <th className="py-3 px-3 min-w-[85px] text-center border-r border-slate-300 bg-slate-100">အဆင့် / ရလဒ်</th>
                    <th className="py-3 px-4 min-w-[140px]">မှတ်ချက်</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 font-mono">
                  {filteredRows.map((row, rIdx) => {
                    let sum = 0;
                    let count = 0;
                    let hasFail = false;
                    SUBJECT_KEYS.forEach((k) => {
                      const str = row.marks[k];
                      if (str !== '' && str !== null && str !== undefined) {
                        const n = parseFloat(str);
                        if (!isNaN(n)) {
                          sum += n;
                          count++;
                          if (n < 40) hasFail = true;
                        }
                      }
                    });
                    const avg = count > 0 ? (sum / count).toFixed(1) : '-';
                    const isDistinction = count > 0 && !hasFail && parseFloat(avg) >= 75;
                    const isPass = count > 0 && !hasFail;

                    return (
                      <tr key={row.student_id} className="hover:bg-indigo-50/30 transition group">
                        <td className="py-2 px-2 text-center text-slate-400 font-bold text-[11px] border-r border-slate-200 bg-slate-50 sticky left-0 z-10 group-hover:bg-slate-100 transition">{rIdx + 1}</td>
                        <td className="py-2 px-3 border-r border-slate-200 bg-white sticky left-12 z-10 font-sans group-hover:bg-indigo-50/40 transition">
                          <div className="font-bold text-slate-900 text-xs truncate max-w-[180px]">{row.student_name}</div>
                          <div className="text-[10px] text-slate-400 font-mono truncate max-w-[180px]">{row.student_email}</div>
                        </td>
                        {SUBJECTS_CONFIG.map((sub, cIdx) => {
                          const cellVal = row.marks[sub.key];
                          const numVal = parseFloat(cellVal);
                          const isDist = !isNaN(numVal) && numVal >= 75;
                          const isFail = !isNaN(numVal) && numVal < 40 && cellVal !== '';
                          return (
                            <td key={sub.key} className={`p-0 border-r border-slate-200 text-center transition ${isDist ? 'bg-emerald-50/60' : isFail ? 'bg-rose-50/70' : ''}`}>
                              <input
                                ref={(el) => setCellRef(rIdx, cIdx, el)}
                                type="text"
                                value={cellVal}
                                onChange={(e) => handleCellChange(rIdx, sub.key, e.target.value)}
                                onKeyDown={(e) => handleCellKeyDown(e, rIdx, cIdx)}
                                onFocus={(e) => e.target.select()}
                                placeholder="-"
                                className={`w-full py-2.5 px-2 text-center font-mono font-bold text-xs bg-transparent border-0 focus:outline-hidden focus:ring-2 focus:ring-indigo-500 focus:bg-white transition ${isDist ? 'text-emerald-700 font-black' : isFail ? 'text-rose-600 font-black' : 'text-slate-800'}`}
                              />
                            </td>
                          );
                        })}
                        <td className="py-2.5 px-2 text-center font-bold text-slate-800 border-r border-slate-200 bg-indigo-50/30">
                          {count > 0 ? <span className="font-black text-indigo-950">{sum}</span> : <span className="text-slate-300">-</span>}
                        </td>
                        <td className="py-2.5 px-2 text-center font-bold text-slate-800 border-r border-slate-200 bg-indigo-50/30">
                          {count > 0 ? (
                            <span className={`font-black ${isDistinction ? 'text-emerald-700' : hasFail ? 'text-rose-600' : 'text-slate-900'}`}>{avg}</span>
                          ) : (
                            <span className="text-slate-300">-</span>
                          )}
                        </td>
                        <td className="py-2 px-2 text-center border-r border-slate-200 font-sans">
                          {count === 0 ? <span className="text-slate-300 text-[10px]">-</span> : isDistinction ? (
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-emerald-100 text-emerald-800 border border-emerald-300">ဂုဏ်ထူး</span>
                          ) : isPass ? (
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-sky-100 text-sky-800 border border-sky-300">အောင်</span>
                          ) : (
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-100 text-rose-800 border border-rose-300">ကျရှုံး</span>
                          )}
                        </td>
                        <td className="p-1 font-sans">
                          <input
                            type="text"
                            value={row.remarks}
                            onChange={(e) => handleRemarksChange(rIdx, e.target.value)}
                            placeholder="မှတ်ချက်ရေးရန်..."
                            className="w-full py-1.5 px-2 text-xs bg-transparent border border-transparent hover:border-slate-200 focus:border-indigo-400 focus:bg-white rounded-md text-slate-700 transition"
                          />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}

            {/* SHEET 2: PHYSICAL GROWTH PROFILE */}
            {activeDomainTab === 'physical' && (
              <table className="w-full text-left border-collapse border-spacing-0 text-xs">
                <thead className="sticky top-0 bg-slate-100/95 backdrop-blur-xs z-20 shadow-xs">
                  <tr className="border-b border-slate-300 text-slate-700 uppercase tracking-wider font-extrabold text-[11px]">
                    <th className="py-3 px-3 w-12 text-center border-r border-slate-300 bg-slate-200/80 sticky left-0 z-20">#</th>
                    <th className="py-3 px-4 min-w-[200px] border-r border-slate-300 bg-slate-100/95 sticky left-12 z-20">ကျောင်းသား အမည်</th>
                    <th className="py-2.5 px-3 min-w-[100px] text-center border-r border-slate-300">
                      <div>အရပ်</div>
                      <div className="text-[10px] text-slate-500 font-semibold">(စင်တီမီတာ)</div>
                    </th>
                    <th className="py-2.5 px-3 min-w-[100px] text-center border-r border-slate-300">
                      <div>အလေးချိန်</div>
                      <div className="text-[10px] text-slate-500 font-semibold">(ကီလိုဂရမ်)</div>
                    </th>
                    <th className="py-2.5 px-3 min-w-[110px] text-center border-r border-slate-300 bg-emerald-50/70 text-emerald-900">
                      <div>BMI အညွှန်း</div>
                      <div className="text-[10px] text-emerald-700 font-semibold">အလိုအလျောက် တွက်ချက်</div>
                    </th>
                    <th className="py-2.5 px-3 min-w-[140px] text-center border-r border-slate-300">
                      <div>ကြီးထွားမှု အဆင့်</div>
                    </th>
                    <th className="py-2.5 px-3 min-w-[140px] text-center border-r border-slate-300">
                      <div>လှုပ်ရှားမှု စွမ်းရည်</div>
                    </th>
                    <th className="py-2.5 px-3 min-w-[140px] text-center border-r border-slate-300">
                      <div>ခဲတံကိုင်မှု စွမ်းရည်</div>
                    </th>
                    <th className="py-2.5 px-3 min-w-[120px] text-center border-r border-slate-300">
                      <div>ကျောင်းတွင်း အာဟာရ</div>
                    </th>
                    <th className="py-2.5 px-4 min-w-[180px]">
                      <div>နှစ်သက်သော အားကစား/ကစားနည်း</div>
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {filteredRows.map((row, rIdx) => {
                    const sid = row.student_id;
                    const phys = wcPhysical[sid] || {
                      height_cm: '108.5', weight_kg: '18.2', growth_category: 'standard_healthy',
                      motor_skills: 'age_appropriate', fine_motor_grip: 'excellent', milk_program: true, preferred_sports: 'Morning Calisthenics'
                    };
                    const bmi = calculateBMI(phys.height_cm, phys.weight_kg);
                    const isBmiHealthy = bmi >= 14 && bmi <= 18;

                    return (
                      <tr key={sid} className="hover:bg-emerald-50/20 transition group">
                        <td className="py-2 px-2 text-center text-slate-400 font-bold text-[11px] border-r border-slate-200 bg-slate-50 sticky left-0 z-10">{rIdx + 1}</td>
                        <td className="py-2 px-3 border-r border-slate-200 bg-white sticky left-12 z-10 font-sans">
                          <div className="font-bold text-slate-900 text-xs truncate max-w-[180px]">{row.student_name}</div>
                          <div className="text-[10px] text-slate-400 font-mono truncate max-w-[180px]">{row.student_email}</div>
                        </td>
                        <td className="p-0 border-r border-slate-200">
                          <input
                            type="text"
                            value={phys.height_cm}
                            onChange={(e) => handlePhysicalChange(sid, 'height_cm', e.target.value)}
                            placeholder="108.5"
                            className="w-full py-2 px-2 text-center font-mono font-bold text-xs bg-transparent border-0 focus:outline-hidden focus:ring-2 focus:ring-emerald-500 focus:bg-white"
                          />
                        </td>
                        <td className="p-0 border-r border-slate-200">
                          <input
                            type="text"
                            value={phys.weight_kg}
                            onChange={(e) => handlePhysicalChange(sid, 'weight_kg', e.target.value)}
                            placeholder="18.2"
                            className="w-full py-2 px-2 text-center font-mono font-bold text-xs bg-transparent border-0 focus:outline-hidden focus:ring-2 focus:ring-emerald-500 focus:bg-white"
                          />
                        </td>
                        <td className="py-2 px-2 text-center border-r border-slate-200 bg-emerald-50/30">
                          {bmi > 0 ? (
                            <span className={`px-2 py-0.5 rounded-full text-xs font-black font-mono border ${isBmiHealthy ? 'bg-emerald-100 text-emerald-800 border-emerald-300' : 'bg-amber-100 text-amber-800 border-amber-300'}`}>
                              {bmi} {isBmiHealthy ? '✓' : ''}
                            </span>
                          ) : (
                            <span className="text-slate-300">-</span>
                          )}
                        </td>
                        <td className="p-1 border-r border-slate-200">
                          <select
                            value={phys.growth_category}
                            onChange={(e) => handlePhysicalChange(sid, 'growth_category', e.target.value)}
                            className="w-full py-1.5 px-2 text-xs rounded-lg border border-transparent hover:border-slate-200 focus:border-emerald-500 bg-transparent focus:bg-white font-medium"
                          >
                            <option value="standard_healthy">စံသတ်မှတ်ချက်မီ</option>
                            <option value="underweight">ပေါင်မပြည့်</option>
                            <option value="overweight">ပေါင်ကျော်</option>
                            <option value="tall_stature">အရပ်ရှည်</option>
                          </select>
                        </td>
                        <td className="p-1 border-r border-slate-200">
                          <select
                            value={phys.motor_skills}
                            onChange={(e) => handlePhysicalChange(sid, 'motor_skills', e.target.value)}
                            className="w-full py-1.5 px-2 text-xs rounded-lg border border-transparent hover:border-slate-200 focus:border-emerald-500 bg-transparent focus:bg-white font-medium"
                          >
                            <option value="age_appropriate">အသက်နှင့်လျော်ကန်</option>
                            <option value="excellent">အလွန်ထူးချွန်</option>
                            <option value="needs_practice">လေ့ကျင့်ရန်လို</option>
                          </select>
                        </td>
                        <td className="p-1 border-r border-slate-200">
                          <select
                            value={phys.fine_motor_grip}
                            onChange={(e) => handlePhysicalChange(sid, 'fine_motor_grip', e.target.value)}
                            className="w-full py-1.5 px-2 text-xs rounded-lg border border-transparent hover:border-slate-200 focus:border-emerald-500 bg-transparent focus:bg-white font-medium"
                          >
                            <option value="excellent">အလွန်ကောင်းမွန်</option>
                            <option value="satisfactory">ပုံမှန်</option>
                            <option value="developing">ဖွံ့ဖြိုးဆဲ</option>
                          </select>
                        </td>
                        <td className="py-2 px-3 text-center border-r border-slate-200">
                          <button
                            type="button"
                            onClick={() => handlePhysicalChange(sid, 'milk_program', !phys.milk_program)}
                            className={`px-2.5 py-0.5 rounded-full text-xs font-bold transition border ${phys.milk_program ? 'bg-emerald-100 text-emerald-800 border-emerald-300' : 'bg-slate-100 text-slate-500 border-slate-200'}`}
                          >
                            {phys.milk_program ? '✓ ပါဝင်သည်' : 'မပါဝင်ပါ'}
                          </button>
                        </td>
                        <td className="p-1">
                          <input
                            type="text"
                            value={phys.preferred_sports}
                            onChange={(e) => handlePhysicalChange(sid, 'preferred_sports', e.target.value)}
                            placeholder="အားကစား/ကစားနည်း..."
                            className="w-full py-1.5 px-2 text-xs bg-transparent border border-transparent hover:border-slate-200 focus:border-emerald-500 focus:bg-white rounded-md text-slate-700"
                          />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}

            {/* SHEET 3: HEALTH VISIBILITY LAYER */}
            {activeDomainTab === 'health' && (
              <table className="w-full text-left border-collapse border-spacing-0 text-xs">
                <thead className="sticky top-0 bg-slate-100/95 backdrop-blur-xs z-20 shadow-xs">
                  <tr className="border-b border-slate-300 text-slate-700 uppercase tracking-wider font-extrabold text-[11px]">
                    <th className="py-3 px-3 w-12 text-center border-r border-slate-300 bg-slate-200/80 sticky left-0 z-20">#</th>
                    <th className="py-3 px-4 min-w-[200px] border-r border-slate-300 bg-slate-100/95 sticky left-12 z-20">ကျောင်းသား အမည်</th>
                    <th className="py-2.5 px-3 min-w-[140px] text-center border-r border-slate-300">
                      <div>မျက်စိ အမြင်အာရုံ</div>
                    </th>
                    <th className="py-2.5 px-3 min-w-[130px] text-center border-r border-slate-300">
                      <div>အကြားအာရုံ</div>
                    </th>
                    <th className="py-2.5 px-3 min-w-[140px] text-center border-r border-slate-300">
                      <div>သွားနှင့် ခံတွင်း</div>
                    </th>
                    <th className="py-2.5 px-3 min-w-[110px] text-center border-r border-slate-300">
                      <div>သန်ချဆေး</div>
                    </th>
                    <th className="py-2.5 px-3 min-w-[110px] text-center border-r border-slate-300">
                      <div>ဗီတာမင်အေ</div>
                    </th>
                    <th className="py-2.5 px-3 min-w-[150px] border-r border-slate-300">
                      <div>ဓာတ်မတည့်မှု အချက်ပြ</div>
                    </th>
                    <th className="py-2.5 px-3 min-w-[140px] text-center border-r border-slate-300">
                      <div>ဆေးခန်း လွှဲပြောင်းမှု</div>
                    </th>
                    <th className="py-2.5 px-3 min-w-[120px] text-center">
                      <div>လုံခြုံရေး အဆင့်</div>
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {filteredRows.map((row, rIdx) => {
                    const sid = row.student_id;
                    const health = wcHealth[sid] || {
                      vision_check: 'normal_20_20', hearing_check: 'normal', oral_dental: 'satisfactory_clean',
                      deworming_done: true, vitamin_a_done: true, known_allergies: 'မရှိပါ', clinic_referral: 'none'
                    };

                    return (
                      <tr key={sid} className="hover:bg-amber-50/20 transition group">
                        <td className="py-2 px-2 text-center text-slate-400 font-bold text-[11px] border-r border-slate-200 bg-slate-50 sticky left-0 z-10">{rIdx + 1}</td>
                        <td className="py-2 px-3 border-r border-slate-200 bg-white sticky left-12 z-10 font-sans">
                          <div className="font-bold text-slate-900 text-xs truncate max-w-[180px]">{row.student_name}</div>
                          <div className="text-[10px] text-slate-400 font-mono truncate max-w-[180px]">{row.student_email}</div>
                        </td>
                        <td className="p-1 border-r border-slate-200">
                          <select
                            value={health.vision_check}
                            onChange={(e) => handleHealthChange(sid, 'vision_check', e.target.value)}
                            className="w-full py-1.5 px-2 text-xs rounded-lg border border-transparent hover:border-slate-200 focus:border-amber-500 bg-transparent focus:bg-white font-medium"
                          >
                            <option value="normal_20_20">ပုံမှန် (၂၀/၂၀)</option>
                            <option value="mild_myopia">အဝေးမှုန် အနည်းငယ်</option>
                            <option value="needs_glasses">မျက်မှန်စစ်ရန်လို</option>
                          </select>
                        </td>
                        <td className="p-1 border-r border-slate-200">
                          <select
                            value={health.hearing_check}
                            onChange={(e) => handleHealthChange(sid, 'hearing_check', e.target.value)}
                            className="w-full py-1.5 px-2 text-xs rounded-lg border border-transparent hover:border-slate-200 focus:border-amber-500 bg-transparent focus:bg-white font-medium"
                          >
                            <option value="normal">ပုံမှန်</option>
                            <option value="check_needed">စစ်ဆေးရန်လိုအပ်</option>
                          </select>
                        </td>
                        <td className="p-1 border-r border-slate-200">
                          <select
                            value={health.oral_dental}
                            onChange={(e) => handleHealthChange(sid, 'oral_dental', e.target.value)}
                            className="w-full py-1.5 px-2 text-xs rounded-lg border border-transparent hover:border-slate-200 focus:border-amber-500 bg-transparent focus:bg-white font-medium"
                          >
                            <option value="satisfactory_clean">သန့်ရှင်းကောင်းမွန်</option>
                            <option value="dental_caries">သွားပိုးစားမှုရှိ</option>
                            <option value="treatment_needed">သွားဆရာဝန်ပြရန်</option>
                          </select>
                        </td>
                        <td className="py-2 px-3 text-center border-r border-slate-200">
                          <button
                            type="button"
                            onClick={() => handleHealthChange(sid, 'deworming_done', !health.deworming_done)}
                            className={`px-2 py-0.5 rounded-full text-xs font-bold transition border ${health.deworming_done ? 'bg-emerald-100 text-emerald-800 border-emerald-300' : 'bg-rose-100 text-rose-800 border-rose-200'}`}
                          >
                            {health.deworming_done ? '✓ ပြီးစီး' : 'မပြီးသေး'}
                          </button>
                        </td>
                        <td className="py-2 px-3 text-center border-r border-slate-200">
                          <button
                            type="button"
                            onClick={() => handleHealthChange(sid, 'vitamin_a_done', !health.vitamin_a_done)}
                            className={`px-2 py-0.5 rounded-full text-xs font-bold transition border ${health.vitamin_a_done ? 'bg-emerald-100 text-emerald-800 border-emerald-300' : 'bg-rose-100 text-rose-800 border-rose-200'}`}
                          >
                            {health.vitamin_a_done ? '✓ ပြီးစီး' : 'မပြီးသေး'}
                          </button>
                        </td>
                        <td className="p-1 border-r border-slate-200">
                          <input
                            type="text"
                            value={health.known_allergies}
                            onChange={(e) => handleHealthChange(sid, 'known_allergies', e.target.value)}
                            placeholder="မရှိပါ..."
                            className="w-full py-1.5 px-2 text-xs bg-transparent border border-transparent hover:border-slate-200 focus:border-amber-500 focus:bg-white rounded-md text-slate-700"
                          />
                        </td>
                        <td className="p-1 border-r border-slate-200">
                          <select
                            value={health.clinic_referral}
                            onChange={(e) => handleHealthChange(sid, 'clinic_referral', e.target.value)}
                            className="w-full py-1.5 px-2 text-xs rounded-lg border border-transparent hover:border-slate-200 focus:border-amber-500 bg-transparent focus:bg-white font-medium"
                          >
                            <option value="none">မရှိပါ</option>
                            <option value="active_referral">လွှဲပြောင်းထား</option>
                            <option value="monitoring">စောင့်ကြည့်</option>
                          </select>
                        </td>
                        <td className="py-2 px-2 text-center font-sans">
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-600 border border-slate-200">
                            လုံခြုံရေးထိန်းသိမ်းမှု
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}

            {/* SHEET 4: WELLBEING & EMOTIONAL PROFILE */}
            {activeDomainTab === 'wellbeing' && (
              <table className="w-full text-left border-collapse border-spacing-0 text-xs">
                <thead className="sticky top-0 bg-slate-100/95 backdrop-blur-xs z-20 shadow-xs">
                  <tr className="border-b border-slate-300 text-slate-700 uppercase tracking-wider font-extrabold text-[11px]">
                    <th className="py-3 px-3 w-12 text-center border-r border-slate-300 bg-slate-200/80 sticky left-0 z-20">#</th>
                    <th className="py-3 px-4 min-w-[200px] border-r border-slate-300 bg-slate-100/95 sticky left-12 z-20">ကျောင်းသား အမည်</th>
                    <th className="py-2.5 px-3 min-w-[120px] text-center border-r border-slate-300">
                      <div>တက်ကြွမှု အညွှန်း</div>
                      <div className="text-[10px] text-slate-500 font-semibold">(၁ မှ ၅ ထိ)</div>
                    </th>
                    <th className="py-2.5 px-3 min-w-[150px] text-center border-r border-slate-300">
                      <div>အဓိက စိတ်ခံစားမှု</div>
                    </th>
                    <th className="py-2.5 px-3 min-w-[150px] text-center border-r border-slate-300">
                      <div>သူငယ်ချင်း ဆက်ဆံရေး</div>
                    </th>
                    <th className="py-2.5 px-3 min-w-[160px] text-center border-r border-slate-300">
                      <div>နှစ်သိမ့်ပံ့ပိုးမှု အဆင့်</div>
                    </th>
                    <th className="py-2.5 px-4 min-w-[240px]">
                      <div>ဆရာမ၏ လေ့လာတွေ့ရှိချက် မှတ်ချက်</div>
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {filteredRows.map((row, rIdx) => {
                    const sid = row.student_id;
                    const well = wcWellbeing[sid] || {
                      engagement_index: '4.8', dominant_mood: 'joyful_curious', peer_harmony: 'harmonious',
                      support_workflow: 'none_required', teacher_notes: 'တက်ကြွပျော်ရွှင်ပြီး သူငယ်ချင်းများနှင့် သင့်တင့်ပါသည်'
                    };

                    return (
                      <tr key={sid} className="hover:bg-rose-50/20 transition group">
                        <td className="py-2 px-2 text-center text-slate-400 font-bold text-[11px] border-r border-slate-200 bg-slate-50 sticky left-0 z-10">{rIdx + 1}</td>
                        <td className="py-2 px-3 border-r border-slate-200 bg-white sticky left-12 z-10 font-sans">
                          <div className="font-bold text-slate-900 text-xs truncate max-w-[180px]">{row.student_name}</div>
                          <div className="text-[10px] text-slate-400 font-mono truncate max-w-[180px]">{row.student_email}</div>
                        </td>
                        <td className="p-0 border-r border-slate-200">
                          <input
                            type="text"
                            value={well.engagement_index}
                            onChange={(e) => handleWellbeingChange(sid, 'engagement_index', e.target.value)}
                            placeholder="4.8"
                            className="w-full py-2 px-2 text-center font-mono font-bold text-xs bg-transparent border-0 focus:outline-hidden focus:ring-2 focus:ring-rose-500 focus:bg-white text-rose-700"
                          />
                        </td>
                        <td className="p-1 border-r border-slate-200">
                          <select
                            value={well.dominant_mood}
                            onChange={(e) => handleWellbeingChange(sid, 'dominant_mood', e.target.value)}
                            className="w-full py-1.5 px-2 text-xs rounded-lg border border-transparent hover:border-slate-200 focus:border-rose-500 bg-transparent focus:bg-white font-medium"
                          >
                            <option value="joyful_curious">ရွှင်လန်းတက်ကြွ</option>
                            <option value="calm_content">အေးဆေးငြိမ်သက်</option>
                            <option value="anxious_shy">ရှက်ကြောက်/စိုးရိမ်</option>
                            <option value="distracted">အာရုံစူးစိုက်မှုနည်း</option>
                          </select>
                        </td>
                        <td className="p-1 border-r border-slate-200">
                          <select
                            value={well.peer_harmony}
                            onChange={(e) => handleWellbeingChange(sid, 'peer_harmony', e.target.value)}
                            className="w-full py-1.5 px-2 text-xs rounded-lg border border-transparent hover:border-slate-200 focus:border-rose-500 bg-transparent focus:bg-white font-medium"
                          >
                            <option value="harmonious">သင့်တင့်မျှတ</option>
                            <option value="occasional_conflict">ရံဖန်ရံခါ အငြင်းပွား</option>
                            <option value="withdrawn">သီးသန့်နေလို</option>
                          </select>
                        </td>
                        <td className="p-1 border-r border-slate-200">
                          <select
                            value={well.support_workflow}
                            onChange={(e) => handleWellbeingChange(sid, 'support_workflow', e.target.value)}
                            className="w-full py-1.5 px-2 text-xs rounded-lg border border-transparent hover:border-slate-200 focus:border-rose-500 bg-transparent focus:bg-white font-medium"
                          >
                            <option value="none_required">အထူးပံ့ပိုးရန်မလို</option>
                            <option value="monitoring">စောင့်ကြည့်အဆင့်</option>
                            <option value="counselor_case">နှစ်သိမ့်ဆွေးနွေးရန်</option>
                          </select>
                        </td>
                        <td className="p-1">
                          <input
                            type="text"
                            value={well.teacher_notes}
                            onChange={(e) => handleWellbeingChange(sid, 'teacher_notes', e.target.value)}
                            placeholder="ဆရာမ၏ မှတ်ချက်..."
                            className="w-full py-1.5 px-2 text-xs bg-transparent border border-transparent hover:border-slate-200 focus:border-rose-500 focus:bg-white rounded-md text-slate-700"
                          />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}

            {/* SHEET 5: SOCIAL PARTICIPATION & CITIZENSHIP */}
            {activeDomainTab === 'social' && (
              <table className="w-full text-left border-collapse border-spacing-0 text-xs">
                <thead className="sticky top-0 bg-slate-100/95 backdrop-blur-xs z-20 shadow-xs">
                  <tr className="border-b border-slate-300 text-slate-700 uppercase tracking-wider font-extrabold text-[11px]">
                    <th className="py-3 px-3 w-12 text-center border-r border-slate-300 bg-slate-200/80 sticky left-0 z-20">#</th>
                    <th className="py-3 px-4 min-w-[200px] border-r border-slate-300 bg-slate-100/95 sticky left-12 z-20">ကျောင်းသား အမည်</th>
                    <th className="py-2.5 px-3 min-w-[160px] text-center border-r border-slate-300">
                      <div>ခေါင်းဆောင်မှု တာဝန်</div>
                    </th>
                    <th className="py-2.5 px-3 min-w-[180px] text-center border-r border-slate-300">
                      <div>ကလပ်အသင်း ပါဝင်မှု</div>
                    </th>
                    <th className="py-2.5 px-3 min-w-[120px] text-center border-r border-slate-300">
                      <div>လူမှုအကျိုးပြု လုပ်ဆောင်ချက်</div>
                    </th>
                    <th className="py-2.5 px-3 min-w-[180px] text-center border-r border-slate-300">
                      <div>နိုင်ငံသားဂုဏ်ပြု တံဆိပ်</div>
                    </th>
                    <th className="py-2.5 px-3 min-w-[120px] text-center border-r border-slate-300">
                      <div>ပူးပေါင်းဆောင်ရွက်မှု အဆင့်</div>
                      <div className="text-[10px] text-slate-500 font-semibold">(၁ မှ ၅ ထိ)</div>
                    </th>
                    <th className="py-2.5 px-3 min-w-[120px] text-center">
                      <div>အုပ်ချုပ်မှု စံနှုန်း</div>
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {filteredRows.map((row, rIdx) => {
                    const sid = row.student_id;
                    const soc = wcSocial[sid] || {
                      leadership_role: 'Line Leader (Morning Assembly)',
                      club_name: 'Kindergarten Art & Music Circle',
                      volunteering_count: '3',
                      citizenship_badge: 'အချိန်တိကျမှုဆု',
                      collaboration_rating: '5.0',
                    };

                    return (
                      <tr key={sid} className="hover:bg-purple-50/20 transition group">
                        <td className="py-2 px-2 text-center text-slate-400 font-bold text-[11px] border-r border-slate-200 bg-slate-50 sticky left-0 z-10">{rIdx + 1}</td>
                        <td className="py-2 px-3 border-r border-slate-200 bg-white sticky left-12 z-10 font-sans">
                          <div className="font-bold text-slate-900 text-xs truncate max-w-[180px]">{row.student_name}</div>
                          <div className="text-[10px] text-slate-400 font-mono truncate max-w-[180px]">{row.student_email}</div>
                        </td>
                        <td className="p-1 border-r border-slate-200">
                          <select
                            value={soc.leadership_role}
                            onChange={(e) => handleSocialChange(sid, 'leadership_role', e.target.value)}
                            className="w-full py-1.5 px-2 text-xs rounded-lg border border-transparent hover:border-slate-200 focus:border-purple-500 bg-transparent focus:bg-white font-medium"
                          >
                            <option value="Line Leader (Morning Assembly)">တန်းစီခေါင်းဆောင်</option>
                            <option value="Table Group Captain (Table A)">အဖွဲ့ခေါင်းဆောင်</option>
                            <option value="Cleanliness Monitor">သန့်ရှင်းရေးတာဝန်ခံ</option>
                            <option value="None">မရှိသေးပါ</option>
                          </select>
                        </td>
                        <td className="p-1 border-r border-slate-200">
                          <select
                            value={soc.club_name}
                            onChange={(e) => handleSocialChange(sid, 'club_name', e.target.value)}
                            className="w-full py-1.5 px-2 text-xs rounded-lg border border-transparent hover:border-slate-200 focus:border-purple-500 bg-transparent focus:bg-white font-medium"
                          >
                            <option value="Kindergarten Art & Music Circle">ပန်းချီနှင့် ဂီတအသင်း</option>
                            <option value="School Nature Discovery Club">သဘာဝလေ့လာရေးအသင်း</option>
                            <option value="Sports & Agility Club">အားကစားအသင်း</option>
                            <option value="None">မပါဝင်သေးပါ</option>
                          </select>
                        </td>
                        <td className="p-0 border-r border-slate-200">
                          <input
                            type="text"
                            value={soc.volunteering_count}
                            onChange={(e) => handleSocialChange(sid, 'volunteering_count', e.target.value)}
                            placeholder="3"
                            className="w-full py-2 px-2 text-center font-mono font-bold text-xs bg-transparent border-0 focus:outline-hidden focus:ring-2 focus:ring-purple-500 focus:bg-white"
                          />
                        </td>
                        <td className="p-1 border-r border-slate-200">
                          <select
                            value={soc.citizenship_badge}
                            onChange={(e) => handleSocialChange(sid, 'citizenship_badge', e.target.value)}
                            className="w-full py-1.5 px-2 text-xs rounded-lg border border-transparent hover:border-slate-200 focus:border-purple-500 bg-transparent focus:bg-white font-medium"
                          >
                            <option value="အချိန်တိကျမှုဆု">အချိန်တိကျမှုဆု</option>
                            <option value="သူငယ်ချင်းကူညီမှုဆု">သူငယ်ချင်းကူညီမှုဆု</option>
                            <option value="ကြင်နာတတ်သောဆု">ကြင်နာတတ်သောဆု</option>
                          </select>
                        </td>
                        <td className="p-0 border-r border-slate-200">
                          <input
                            type="text"
                            value={soc.collaboration_rating}
                            onChange={(e) => handleSocialChange(sid, 'collaboration_rating', e.target.value)}
                            placeholder="5.0"
                            className="w-full py-2 px-2 text-center font-mono font-bold text-xs bg-transparent border-0 focus:outline-hidden focus:ring-2 focus:ring-purple-500 focus:bg-white text-purple-700"
                          />
                        </td>
                        <td className="py-2 px-2 text-center font-sans">
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-purple-100 text-purple-800 border border-purple-200">
                            ပွင့်လင်းမြင်သာမှုရှိ
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
        )}
      </div>

      {/* Mass A4 Report Card Print Modal */}
      <MassReportCardPrintModal
        isOpen={reportCardModalOpen}
        onClose={() => setReportCardModalOpen(false)}
        classInfo={classInfo}
        examName={selectedExam}
        students={reportCardStudents}
        school={schoolInfo}
        academicYear={classInfo?.academic_year}
      />
    </div>
  );
};
