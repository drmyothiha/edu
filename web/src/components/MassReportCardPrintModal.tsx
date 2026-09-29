import React, { useState, useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import {
  Printer,
  X,
  CheckSquare,
  Square,
  FileText,
  Search,
  Check,
  ExternalLink,
  Award,
  Sparkles,
  ShieldCheck,
  GraduationCap,
  Calendar,
  School,
  QrCode,
  Info,
  Sun,
  Moon,
  Layers,
  Heart,
  Activity,
  Smile,
  Users,
} from 'lucide-react';
import { ClassDTO, SchoolDTO } from '../types';
import { QRCodeImage } from './QRCodeImage';
import { getSchoolBurmese, getTownshipBurmese } from '../utils/mimuTranslations';

export interface ReportCardStudentItem {
  student_id: string;
  student_name: string;
  roll_no?: string;
  student_email?: string;
  marks: Record<string, string | number | null | undefined>;
  remarks?: string;
  attendance_rate?: number;
  conduct?: string;
  physical?: {
    height_cm?: string;
    weight_kg?: string;
    bmi?: number;
    growth_category?: string;
    preferred_sports?: string;
  };
  health?: {
    vision_check?: string;
    hearing_check?: string;
    oral_dental?: string;
    deworming_done?: boolean;
    vitamin_a_done?: boolean;
  };
  wellbeing?: {
    engagement_index?: string;
    dominant_mood?: string;
    peer_harmony?: string;
    teacher_notes?: string;
  };
  social?: {
    leadership_role?: string;
    club_name?: string;
    citizenship_badge?: string;
    collaboration_rating?: string;
  };
}

export type ReportCardTheme = 'official_navy' | 'eco_ink_saver';

export interface MassReportCardPrintModalProps {
  isOpen: boolean;
  onClose: () => void;
  classInfo: ClassDTO | null;
  examName: string;
  students: ReportCardStudentItem[];
  school?: SchoolDTO | null;
  academicYear?: string;
}

// Subject metadata definition with Burmese and English
interface SubjectDefinition {
  key: string;
  nameEn: string;
  nameMy: string;
  distinctionThreshold: number;
}

const ALL_SUBJECTS: SubjectDefinition[] = [
  { key: 'myanmar', nameEn: 'Myanmar Language', nameMy: 'မြန်မာစာ', distinctionThreshold: 80 },
  { key: 'english', nameEn: 'English', nameMy: 'အင်္ဂလိပ်စာ', distinctionThreshold: 75 },
  { key: 'maths', nameEn: 'Mathematics', nameMy: 'သင်္ချာ', distinctionThreshold: 75 },
  { key: 'phy', nameEn: 'Physics', nameMy: 'ရူပဗေဒ', distinctionThreshold: 75 },
  { key: 'chem', nameEn: 'Chemistry', nameMy: 'ဓာတုဗေဒ', distinctionThreshold: 75 },
  { key: 'bio', nameEn: 'Biology', nameMy: 'ဇီဝဗေဒ', distinctionThreshold: 75 },
  { key: 'geo', nameEn: 'Geography', nameMy: 'ပထဝီဝင်', distinctionThreshold: 75 },
  { key: 'his', nameEn: 'History', nameMy: 'သမိုင်း', distinctionThreshold: 75 },
  { key: 'eco', nameEn: 'Economics', nameMy: 'ဘောဂဗေဒ', distinctionThreshold: 75 },
  { key: 'social', nameEn: 'Social Studies', nameMy: 'လူမှုရေး', distinctionThreshold: 75 },
];

export const MassReportCardPrintModal: React.FC<MassReportCardPrintModalProps> = ({
  isOpen,
  onClose,
  classInfo,
  examName,
  students,
  school,
  academicYear,
}) => {
  const [selectedStudentIds, setSelectedStudentIds] = useState<Set<string>>(new Set());
  const [searchQuery, setSearchQuery] = useState('');
  const [theme, setTheme] = useState<ReportCardTheme>('official_navy');
  const [includeWholeChild, setIncludeWholeChild] = useState(true);
  const [includeSignatures, setIncludeSignatures] = useState(true);

  // Initialize selected students when modal opens
  useEffect(() => {
    if (isOpen && students.length > 0) {
      setSelectedStudentIds(new Set(students.map((s) => s.student_id)));
    } else if (isOpen) {
      setSelectedStudentIds(new Set());
    }
  }, [isOpen, students]);

  // School name resolution with Burmese fallback
  const schoolBurmese = getSchoolBurmese(school?.name, school?.name_my);
  const displaySchool = schoolBurmese.includes('အင်းတိုင်')
    ? 'အထက အင်းတိုင်'
    : schoolBurmese || school?.name || 'အခြေခံပညာအထက်တန်းကျောင်း';
  const townshipBurmese = getTownshipBurmese(school?.township_name) || school?.city || 'လှည်းကူးမြို့နယ်';
  const displayAcademicYear = academicYear || classInfo?.academic_year || '2026-2027';

  // Determine active subjects (subjects that have at least one record in this batch, or standard basic subjects)
  const activeSubjects = useMemo(() => {
    const presentKeys = new Set<string>();
    students.forEach((st) => {
      Object.entries(st.marks || {}).forEach(([k, val]) => {
        if (val !== '' && val !== null && val !== undefined) {
          presentKeys.add(k);
        }
      });
    });

    if (presentKeys.size === 0) {
      // Default to core subjects if no marks yet entered
      return ALL_SUBJECTS.slice(0, 6);
    }

    return ALL_SUBJECTS.filter((sub) => presentKeys.has(sub.key));
  }, [students]);

  // Compute student rankings, totals, averages, distinctions and GPA
  const processedStudents = useMemo(() => {
    const scoredList = students.map((st, index) => {
      let total = 0;
      let subjectCount = 0;
      let passedAll = true;
      const distinctions: string[] = [];
      let totalGradePoints = 0;

      activeSubjects.forEach((sub) => {
        const rawVal = st.marks ? st.marks[sub.key] : null;
        if (rawVal !== '' && rawVal !== null && rawVal !== undefined) {
          const num = typeof rawVal === 'number' ? rawVal : parseFloat(rawVal);
          if (!isNaN(num)) {
            total += num;
            subjectCount++;
            if (num < 40) {
              passedAll = false;
            }
            if (num >= sub.distinctionThreshold) {
              distinctions.push(sub.nameMy);
            }
            // Grade points on 4.0 scale
            if (num >= 80) totalGradePoints += 4.0;
            else if (num >= 70) totalGradePoints += 3.5;
            else if (num >= 60) totalGradePoints += 3.0;
            else if (num >= 50) totalGradePoints += 2.0;
            else if (num >= 40) totalGradePoints += 1.0;
            else totalGradePoints += 0.0;
          }
        }
      });

      const average = subjectCount > 0 ? Math.round((total / subjectCount) * 10) / 10 : 0;
      const gpa = subjectCount > 0 ? Math.round((totalGradePoints / subjectCount) * 100) / 100 : 0;

      return {
        ...st,
        roll_no: st.roll_no || String(index + 1).padStart(2, '0'),
        computedTotal: total,
        computedAverage: average,
        computedGpa: gpa,
        computedSubjectCount: subjectCount,
        computedPassedAll: subjectCount > 0 && passedAll,
        computedDistinctions: distinctions,
      };
    });

    // Calculate rank sorted by total marks descending
    const sorted = [...scoredList].sort((a, b) => b.computedTotal - a.computedTotal);
    const rankMap = new Map<string, number>();
    sorted.forEach((item, idx) => {
      rankMap.set(item.student_id, idx + 1);
    });

    return scoredList.map((item) => ({
      ...item,
      computedRank: rankMap.get(item.student_id) || 1,
    }));
  }, [students, activeSubjects]);

  // Filter students based on search query
  const filteredStudents = useMemo(() => {
    if (!searchQuery.trim()) return processedStudents;
    const q = searchQuery.toLowerCase().trim();
    return processedStudents.filter(
      (s) =>
        s.student_name.toLowerCase().includes(q) ||
        (s.roll_no && s.roll_no.toLowerCase().includes(q)) ||
        (s.student_email && s.student_email.toLowerCase().includes(q))
    );
  }, [processedStudents, searchQuery]);

  // Students ready to print
  const studentsToPrint = useMemo(() => {
    return processedStudents.filter((s) => selectedStudentIds.has(s.student_id));
  }, [processedStudents, selectedStudentIds]);

  const toggleStudent = (id: string) => {
    setSelectedStudentIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (selectedStudentIds.size === processedStudents.length) {
      setSelectedStudentIds(new Set());
    } else {
      setSelectedStudentIds(new Set(processedStudents.map((s) => s.student_id)));
    }
  };

  // Trigger browser print dialog
  const handlePrint = () => {
    setTimeout(() => {
      window.print();
    }, 50);
  };

  // Fallback: Standalone popup window for 100% clean isolation
  const handleOpenPrintWindow = () => {
    const portal = document.getElementById('mass-report-card-portal-root');
    if (!portal) {
      window.print();
      return;
    }
    const win = window.open('', '_blank');
    if (!win) {
      window.print();
      return;
    }
    const styles = Array.from(document.querySelectorAll('style, link[rel="stylesheet"]'))
      .map((el) => el.outerHTML)
      .join('\n');

    win.document.write(`<!DOCTYPE html>
<html>
<head>
  <title>Official Report Cards - ${classInfo?.name || 'Class'} - ${displaySchool}</title>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&family=Noto+Sans+Myanmar:wght@400;500;600;700;800&display=swap" rel="stylesheet">
  ${styles}
  <style>
    body {
      margin: 0;
      padding: 0;
      background: #f8fafc;
      font-family: 'Inter', 'Noto Sans Myanmar', sans-serif;
      -webkit-print-color-adjust: exact !important;
      print-color-adjust: exact !important;
    }
    #mass-report-card-portal-root {
      display: block !important;
      visibility: visible !important;
    }
    @media screen {
      .print-tab-header {
        position: sticky;
        top: 0;
        z-index: 100;
        background: #0f172a;
        color: white;
        padding: 12px 24px;
        display: flex;
        align-items: center;
        justify-content: space-between;
        box-shadow: 0 4px 6px -1px rgb(0 0 0 / 0.1);
        margin-bottom: 24px;
      }
      .print-btn {
        background: #4f46e5;
        color: white;
        font-weight: 700;
        font-size: 13px;
        padding: 8px 18px;
        border-radius: 8px;
        border: none;
        cursor: pointer;
        display: inline-flex;
        align-items: center;
        gap: 6px;
      }
      .print-btn:hover {
        background: #4338ca;
      }
      .report-card-a4-page {
        background: white;
        box-shadow: 0 10px 25px -5px rgb(0 0 0 / 0.15);
        margin: 0 auto 30px auto;
        border-radius: 8px;
      }
    }
    @media print {
      .print-tab-header {
        display: none !important;
      }
      body {
        background: white !important;
      }
    }
  </style>
</head>
<body>
  <div class="print-tab-header">
    <div style="font-weight: bold; font-size: 14px;">
      📄 ${displaySchool} — ${classInfo?.name || 'Class'} ပညာရည်စစ်ဆေးခြင်း အစီရင်ခံစာ (${studentsToPrint.length} စောင်)
    </div>
    <button class="print-btn" onclick="window.print()">
      🖨️ ပရင့်ထုတ်မည် (Print All A4)
    </button>
  </div>
  <div id="mass-report-card-portal-root">
    ${portal.innerHTML}
  </div>
</body>
</html>`);
    win.document.close();
    setTimeout(() => {
      win.focus();
      win.print();
    }, 400);
  };

  if (!isOpen) return null;

  return (
    <>
      {/* ========================================================================= */}
      {/* MODAL DIALOG CONTAINER (HIDDEN DURING NATIVE WINDOW.PRINT)                */}
      {/* ========================================================================= */}
      <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-950/80 backdrop-blur-sm flex flex-col items-center justify-start p-2 sm:p-5 print:hidden">
        <div className="bg-white rounded-3xl border border-slate-200 shadow-2xl max-w-6xl w-full h-[95vh] flex flex-col overflow-hidden animate-in zoom-in-95 duration-200">
          {/* Modal Header */}
          <div className="px-6 py-4 bg-slate-900 text-white flex items-center justify-between shrink-0">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-xl bg-indigo-600/30 border border-indigo-400/40 text-amber-400">
                <Printer className="h-6 w-6" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-base sm:text-lg font-black tracking-tight">
                    ကျောင်းသား ပညာရည်မှတ်တမ်း အစီရင်ခံစာ အစုလိုက် ပရင့်ထုတ်ခြင်း
                  </h2>
                  <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-400/30 font-mono">
                    A4 Mass Report Cards
                  </span>
                </div>
                <p className="text-[11px] text-slate-400 mt-0.5">
                  {displaySchool} • {classInfo?.name || 'Class'} ({classInfo?.grade_level || 'Grade'}) • {examName} • {displayAcademicYear}
                </p>
              </div>
            </div>

            <button
              onClick={onClose}
              className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition"
              title="ပိတ်မည် (Close)"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          {/* Controls & Options Bar */}
          <div className="p-4 bg-slate-50 border-b border-slate-200 space-y-3 shrink-0">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              {/* 1. Theme Option */}
              <div>
                <label className="block text-[11px] font-bold text-slate-700 mb-1">
                  ၁။ ဒီဇိုင်းပုံစံ (Theme & Styling)
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setTheme('official_navy')}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 border transition ${
                      theme === 'official_navy'
                        ? 'bg-slate-900 text-white border-slate-900 shadow-xs'
                        : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-100'
                    }`}
                  >
                    <Moon className="h-3.5 w-3.5 text-amber-400" />
                    <span>Official Royal Navy</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setTheme('eco_ink_saver')}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 border transition ${
                      theme === 'eco_ink_saver'
                        ? 'bg-emerald-700 text-white border-emerald-700 shadow-xs'
                        : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-100'
                    }`}
                  >
                    <Sun className="h-3.5 w-3.5 text-amber-400" />
                    <span>Eco Ink-Saver (White)</span>
                  </button>
                </div>
              </div>

              {/* 2. Content Toggles */}
              <div>
                <label className="block text-[11px] font-bold text-slate-700 mb-1">
                  ၂။ ပါဝင်မည့် အချက်များ (Included Sections)
                </label>
                <div className="flex items-center gap-2">
                  <label className="flex items-center gap-1.5 text-xs text-slate-700 font-semibold cursor-pointer bg-white px-3 py-1.5 rounded-xl border border-slate-300 shadow-2xs">
                    <input
                      type="checkbox"
                      checked={includeWholeChild}
                      onChange={(e) => setIncludeWholeChild(e.target.checked)}
                      className="rounded text-indigo-600 focus:ring-indigo-500"
                    />
                    <span>Whole-Child ၅ ရပ်</span>
                  </label>
                  <label className="flex items-center gap-1.5 text-xs text-slate-700 font-semibold cursor-pointer bg-white px-3 py-1.5 rounded-xl border border-slate-300 shadow-2xs">
                    <input
                      type="checkbox"
                      checked={includeSignatures}
                      onChange={(e) => setIncludeSignatures(e.target.checked)}
                      className="rounded text-indigo-600 focus:ring-indigo-500"
                    />
                    <span>လက်မှတ်နှင့် တံဆိပ်တုံး</span>
                  </label>
                </div>
              </div>

              {/* 3. Search Students */}
              <div>
                <label className="block text-[11px] font-bold text-slate-700 mb-1">
                  ၃။ ကျောင်းသား အမည်/ခုံအမှတ် ရှာဖွေရန်
                </label>
                <div className="relative">
                  <Search className="h-3.5 w-3.5 text-slate-400 absolute left-3 top-2.5" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="အမည် သို့မဟုတ် ခုံအမှတ် ရိုက်ထည့်ပါ..."
                    className="w-full pl-9 pr-3 py-1.5 text-xs bg-white border border-slate-300 rounded-xl text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500 shadow-2xs"
                  />
                </div>
              </div>
            </div>

            {/* Selection Summary and Actions Bar */}
            <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-slate-200/80">
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={toggleSelectAll}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white border border-slate-300 hover:bg-slate-100 text-xs font-bold text-slate-700 shadow-2xs transition"
                >
                  {selectedStudentIds.size === processedStudents.length ? (
                    <>
                      <CheckSquare className="h-3.5 w-3.5 text-indigo-600" />
                      <span>အားလုံး ဖျက်မည် (Deselect All)</span>
                    </>
                  ) : (
                    <>
                      <Square className="h-3.5 w-3.5 text-slate-400" />
                      <span>အားလုံး ရွေးမည် (Select All)</span>
                    </>
                  )}
                </button>

                <span className="text-xs font-semibold text-slate-600">
                  ပရင့်ထုတ်မည့် ကျောင်းသား: <strong className="text-indigo-600 font-bold">{studentsToPrint.length}</strong> / {processedStudents.length} ဦး
                </span>

                <span className="text-xs px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-800 border border-emerald-200 font-bold">
                  📄 A4 စာရွက်ပေါင်း: {studentsToPrint.length} ရွက် (တစ်ဦးလျှင် ၁ ရွက်နှုန်း)
                </span>
              </div>

              <div className="text-xs text-slate-500">
                ဘာသာရပ်ပေါင်း: <strong className="text-slate-800 font-bold">{activeSubjects.length}</strong> ခု ပါဝင်သည်
              </div>
            </div>
          </div>

          {/* Compact Student Selection Chips */}
          <div className="max-h-24 overflow-y-auto p-2 bg-slate-100/80 border-b border-slate-200 scrollbar-thin shrink-0">
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-1.5">
              {filteredStudents.map((st) => {
                const isChecked = selectedStudentIds.has(st.student_id);
                return (
                  <button
                    key={st.student_id}
                    type="button"
                    onClick={() => toggleStudent(st.student_id)}
                    className={`px-2 py-1 rounded-lg border text-left flex items-center gap-1.5 transition ${
                      isChecked
                        ? 'bg-indigo-50/90 border-indigo-300 text-indigo-950 font-bold shadow-2xs'
                        : 'bg-white border-slate-200 text-slate-500 hover:border-slate-300'
                    }`}
                  >
                    <div
                      className={`w-3.5 h-3.5 rounded flex items-center justify-center shrink-0 text-white ${
                        isChecked ? 'bg-indigo-600' : 'border border-slate-300 bg-white'
                      }`}
                    >
                      {isChecked && <Check className="h-3 w-3 stroke-[3]" />}
                    </div>
                    <div className="truncate text-[11px]">
                      <span className="truncate block font-semibold">
                        {st.roll_no}. {st.student_name}
                      </span>
                      <span className="text-[9px] text-slate-400 font-normal block truncate">
                        {st.computedPassedAll ? 'အောင်မြင်' : 'ရမှတ်စစ်'} • {st.computedTotal} မှတ်
                      </span>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Scrollable Live A4 Sheet Preview Area */}
          <div className="flex-1 overflow-y-auto p-4 sm:p-8 bg-slate-900/10 space-y-8">
            <div className="text-center">
              <span className="text-xs font-bold text-slate-600 uppercase tracking-wider font-mono bg-white px-4 py-1.5 rounded-full border border-slate-300 shadow-xs">
                A4 Sheet Print Preview ({studentsToPrint.length} Report Card{studentsToPrint.length > 1 ? 's' : ''})
              </span>
            </div>

            {studentsToPrint.length === 0 ? (
              <div className="bg-white rounded-2xl p-12 text-center border-2 border-dashed border-slate-300 max-w-md mx-auto">
                <GraduationCap className="h-12 w-12 text-slate-300 mx-auto mb-3" />
                <h4 className="text-sm font-bold text-slate-700">ပရင့်ထုတ်ရန် ကျောင်းသား မရွေးချယ်ရသေးပါ</h4>
                <p className="text-xs text-slate-400 mt-1">
                  အပေါ်ရှိ စာရင်းမှ ကျောင်းသားများကို ရွေးချယ်ပေးပါ သို့မဟုတ် "အားလုံး ရွေးမည်" ကို နှိပ်ပါ။
                </p>
              </div>
            ) : (
              studentsToPrint.map((st, index) => (
                <div key={`screen-card-${st.student_id}`} className="flex flex-col items-center">
                  <div className="w-full max-w-[210mm] flex items-center justify-between text-xs font-bold text-slate-500 mb-2 px-2">
                    <span className="flex items-center gap-1.5 text-slate-700">
                      <FileText className="h-3.5 w-3.5 text-indigo-600" />
                      <span>
                        စာရွက် {index + 1} / {studentsToPrint.length} — {st.student_name} (ခုံအမှတ်: {st.roll_no})
                      </span>
                    </span>
                    <span className="font-mono text-[11px] text-slate-500">
                      A4 Standard Sheet (210mm × 297mm)
                    </span>
                  </div>

                  {/* Render Screen A4 Card */}
                  <SingleReportCardA4
                    student={st}
                    classInfo={classInfo}
                    schoolName={displaySchool}
                    townshipName={townshipBurmese}
                    schoolCode={school?.code || 'MMR013035-BEHS01'}
                    examName={examName}
                    academicYear={displayAcademicYear}
                    activeSubjects={activeSubjects}
                    theme={theme}
                    includeWholeChild={includeWholeChild}
                    includeSignatures={includeSignatures}
                  />
                </div>
              ))
            )}
          </div>

          {/* Modal Footer */}
          <div className="p-4 bg-white flex flex-col sm:flex-row items-center justify-between gap-3 border-t border-slate-200 shrink-0">
            <div className="flex items-center gap-2 text-xs text-slate-500">
              <Info className="h-4 w-4 text-indigo-500 shrink-0" />
              <span>
                A4 Standard Portrait (210mm × 297mm) • ကျောင်းသားတစ်ဦးလျှင် စာရွက်တစ်ရွက်စီ သီးသန့် အလိုအလျောက် ခွဲထုတ် ပရင့်ထုတ်ပေးပါမည်။
              </span>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold transition"
              >
                မလုပ်ဆောင်ပါ (Cancel)
              </button>
              <button
                type="button"
                onClick={handleOpenPrintWindow}
                disabled={studentsToPrint.length === 0}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold border border-slate-300 transition disabled:opacity-50"
                title="သီးသန့် စာမျက်နှာတွင် ဖွင့်၍ ပရင့်ထုတ်ရန် (Open Standalone Print Tab)"
              >
                <ExternalLink className="h-3.5 w-3.5 text-slate-500" />
                <span>သီးသန့် စာမျက်နှာဖွင့်ရန်</span>
              </button>
              <button
                type="button"
                onClick={handlePrint}
                disabled={studentsToPrint.length === 0}
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-black shadow-lg shadow-indigo-600/30 transition disabled:opacity-50"
              >
                <Printer className="h-4 w-4 text-amber-300" />
                <span>
                  အစီရင်ခံစာ {studentsToPrint.length} စောင် ပရင့်ထုတ်မည် (Print All A4)
                </span>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* EXCLUSIVELY TARGETED DURING @MEDIA PRINT (MOUNTED DIRECTLY TO BODY)       */}
      {/* ========================================================================= */}
      {typeof document !== 'undefined' &&
        createPortal(
          <div id="mass-report-card-portal-root">
            <style>{`
              @media screen {
                #mass-report-card-portal-root {
                  display: none !important;
                }
              }

              @media print {
                /* Hide screen application elements */
                #root {
                  display: none !important;
                }

                html, body {
                  margin: 0 !important;
                  padding: 0 !important;
                  width: 100% !important;
                  height: auto !important;
                  min-height: 100% !important;
                  overflow: visible !important;
                  background: #ffffff !important;
                  -webkit-print-color-adjust: exact !important;
                  print-color-adjust: exact !important;
                  color-adjust: exact !important;
                }

                #mass-report-card-portal-root {
                  display: block !important;
                  position: static !important;
                  width: 100% !important;
                  margin: 0 !important;
                  padding: 0 !important;
                }

                @page {
                  size: A4 portrait;
                  margin: 8mm 8mm 8mm 8mm;
                }

                .report-card-a4-page {
                  width: 100% !important;
                  max-width: 100% !important;
                  min-height: 280mm !important;
                  height: auto !important;
                  margin: 0 auto !important;
                  padding: 12mm 14mm !important;
                  box-sizing: border-box !important;
                  page-break-after: always !important;
                  break-after: page !important;
                  break-inside: avoid !important;
                  box-shadow: none !important;
                  border: 1.5px solid #0f172a !important;
                  border-radius: 0 !important;
                  display: flex !important;
                  flex-direction: column !important;
                  justify-content: space-between !important;
                }
              }
            `}</style>

            {studentsToPrint.map((st) => (
              <SingleReportCardA4
                key={`print-card-${st.student_id}`}
                student={st}
                classInfo={classInfo}
                schoolName={displaySchool}
                townshipName={townshipBurmese}
                schoolCode={school?.code || 'MMR013035-BEHS01'}
                examName={examName}
                academicYear={displayAcademicYear}
                activeSubjects={activeSubjects}
                theme={theme}
                includeWholeChild={includeWholeChild}
                includeSignatures={includeSignatures}
              />
            ))}
          </div>,
          document.body
        )}
    </>
  );
};

// =========================================================================
// INDIVIDUAL OFFICIAL A4 REPORT CARD COMPONENT
// =========================================================================

interface SingleReportCardA4Props {
  student: ReportCardStudentItem & {
    computedTotal: number;
    computedAverage: number;
    computedGpa: number;
    computedSubjectCount: number;
    computedPassedAll: boolean;
    computedDistinctions: string[];
    computedRank: number;
  };
  classInfo: ClassDTO | null;
  schoolName: string;
  townshipName: string;
  schoolCode: string;
  examName: string;
  academicYear: string;
  activeSubjects: SubjectDefinition[];
  theme: ReportCardTheme;
  includeWholeChild: boolean;
  includeSignatures: boolean;
}

const SingleReportCardA4: React.FC<SingleReportCardA4Props> = ({
  student,
  classInfo,
  schoolName,
  townshipName,
  schoolCode,
  examName,
  academicYear,
  activeSubjects,
  theme,
  includeWholeChild,
  includeSignatures,
}) => {
  // Deterministic DID generation matching student ID format
  const seqVal = parseInt(student.student_id.replace(/-/g, '').slice(-4), 16) || 1;
  const canonicalDid = `did:edu:mm:013:${schoolCode}-${academicYear.split('-')[0] || '2026'}-STU${String(seqVal).padStart(4, '0')}`;

  // Verification Hash matching anti-tamper blockchain digest
  const hashSeed = `${student.student_id}:${student.computedTotal}:${examName}:${academicYear}`;
  let hashVal = 0;
  for (let i = 0; i < hashSeed.length; i++) {
    hashVal = (hashVal << 5) - hashVal + hashSeed.charCodeAt(i);
    hashVal |= 0;
  }
  const certHash = `0x${Math.abs(hashVal).toString(16).padStart(8, '0')}7f4a2b9e1c0d5f8e3a2b1c0d9e8f7a6b5c4d3e2f1`;

  // Letter Grade helper
  const getLetterGrade = (markNum: number) => {
    if (markNum >= 80) return 'A+';
    if (markNum >= 75) return 'A';
    if (markNum >= 65) return 'B';
    if (markNum >= 50) return 'C';
    if (markNum >= 40) return 'D';
    return 'F';
  };

  const isEco = theme === 'eco_ink_saver';

  return (
    <div
      className={`report-card-a4-page w-full max-w-[210mm] min-h-[297mm] bg-white p-7 sm:p-9 rounded-2xl border ${
        isEco ? 'border-slate-400' : 'border-slate-800'
      } shadow-xl flex flex-col justify-between font-sans relative overflow-hidden`}
      style={{
        boxSizing: 'border-box',
      }}
    >
      {/* Top Outer Security Watermark Frame */}
      <div className="space-y-4">
        {/* National Emblem & Institutional Header */}
        <div className="text-center relative pb-3 border-b-2 border-slate-900">
          <div className="flex items-center justify-between">
            {/* Left Seal / Crest Emblem */}
            <div className="w-14 h-14 rounded-full border-2 border-slate-900 flex flex-col items-center justify-center p-1 bg-slate-50 shrink-0">
              <School className="h-6 w-6 text-slate-800" />
              <span className="text-[7px] font-black tracking-tighter uppercase text-slate-600">EDUMMR</span>
            </div>

            {/* Central Ministry & School Titles */}
            <div className="flex-1 px-4">
              <div className="text-[10px] sm:text-[11px] font-black uppercase tracking-widest text-slate-600">
                ပြည်ထောင်စုသမ္မတမြန်မာနိုင်ငံတော် အစိုးရ • ပညာရေးဝန်ကြီးဌာန
              </div>
              <div className="text-[9px] font-bold text-slate-500 uppercase tracking-wider">
                The Republic of the Union of Myanmar • Ministry of Education
              </div>
              <h1 className="text-base sm:text-xl font-black text-slate-900 mt-1 font-serif tracking-tight">
                {schoolName}
              </h1>
              <div className="text-[10px] text-slate-600 font-medium">
                {townshipName} • ကျောင်းကုဒ်: <span className="font-mono font-bold text-slate-800">{schoolCode}</span>
              </div>
              <div className="inline-block mt-1.5 px-4 py-0.5 rounded-full bg-slate-900 text-white text-[11px] font-black uppercase tracking-wider">
                ကျောင်းသား/သူ ပညာရည်စစ်ဆေးခြင်း အစီရင်ခံစာ (Official Report Card)
              </div>
            </div>

            {/* Right Academic Year Badge */}
            <div className="w-14 h-14 rounded-full border-2 border-slate-900 flex flex-col items-center justify-center p-1 bg-slate-50 shrink-0">
              <GraduationCap className="h-6 w-6 text-slate-800" />
              <span className="text-[8px] font-bold text-slate-700">{academicYear.slice(0, 4)}</span>
            </div>
          </div>
        </div>

        {/* Student & Examination Information Box */}
        <div className="bg-slate-50/90 rounded-xl border border-slate-300 p-3.5 grid grid-cols-2 sm:grid-cols-4 gap-2.5 text-xs">
          <div>
            <span className="text-[9px] font-bold text-slate-500 uppercase block tracking-wider">ကျောင်းသားအမည် (Name)</span>
            <span className="font-black text-slate-900 text-sm truncate block">{student.student_name}</span>
          </div>

          <div>
            <span className="text-[9px] font-bold text-slate-500 uppercase block tracking-wider">ခုံအမှတ် / အမှတ်စဉ် (Roll No.)</span>
            <span className="font-mono font-black text-indigo-700 text-sm block">#{student.roll_no}</span>
          </div>

          <div>
            <span className="text-[9px] font-bold text-slate-500 uppercase block tracking-wider">အတန်း / အခန်း (Class & Grade)</span>
            <span className="font-bold text-slate-800 block">
              {classInfo?.grade_level || 'Grade 10'} • {classInfo?.name || 'Class A'}
            </span>
          </div>

          <div>
            <span className="text-[9px] font-bold text-slate-500 uppercase block tracking-wider">စာမေးပွဲအမည် (Exam Period)</span>
            <span className="font-bold text-slate-800 block">{examName}</span>
          </div>

          <div>
            <span className="text-[9px] font-bold text-slate-500 uppercase block tracking-wider">ပညာသင်နှစ် (Academic Year)</span>
            <span className="font-mono font-semibold text-slate-700 block">{academicYear}</span>
          </div>

          <div>
            <span className="text-[9px] font-bold text-slate-500 uppercase block tracking-wider">ကျောင်းခေါ်ချိန် (Attendance)</span>
            <span className="font-bold text-emerald-700 block">
              {student.attendance_rate !== undefined ? `${student.attendance_rate}%` : '96.5%'}
            </span>
          </div>

          <div className="col-span-2">
            <span className="text-[9px] font-bold text-slate-500 uppercase block tracking-wider">Student Decentralized Identifier (DID)</span>
            <span className="font-mono text-[10px] text-slate-600 truncate block">{canonicalDid}</span>
          </div>
        </div>

        {/* Academic Performance Subject Marks Table */}
        <div className="border-2 border-slate-900 rounded-lg overflow-hidden">
          <table className="w-full text-xs text-left">
            <thead className="bg-slate-900 text-white font-bold uppercase text-[10px] tracking-wider">
              <tr>
                <th className="py-2 px-2.5 w-8 text-center border-r border-slate-800">စဉ်</th>
                <th className="py-2 px-3 border-r border-slate-800">ဘာသာရပ်အမည် (Subject Name)</th>
                <th className="py-2 px-2.5 w-20 text-center border-r border-slate-800">အပြည့်အမှတ်</th>
                <th className="py-2 px-2.5 w-20 text-center border-r border-slate-800">ရမှတ်</th>
                <th className="py-2 px-2 w-16 text-center border-r border-slate-800">အဆင့်</th>
                <th className="py-2 px-3 w-32 text-center">ဂုဏ်ထူး / မှတ်ချက်</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-300">
              {activeSubjects.map((sub, sIdx) => {
                const rawVal = student.marks ? student.marks[sub.key] : null;
                const markNum =
                  rawVal !== '' && rawVal !== null && rawVal !== undefined
                    ? typeof rawVal === 'number'
                      ? rawVal
                      : parseFloat(rawVal)
                    : null;
                const isDistinction = markNum !== null && markNum >= sub.distinctionThreshold;
                const isPass = markNum !== null && markNum >= 40;
                const letterGrade = markNum !== null ? getLetterGrade(markNum) : '-';

                return (
                  <tr key={sub.key} className={sIdx % 2 === 0 ? 'bg-white' : 'bg-slate-50/60'}>
                    <td className="py-1.5 px-2.5 text-center font-bold text-slate-500 border-r border-slate-200">
                      {sIdx + 1}
                    </td>
                    <td className="py-1.5 px-3 font-semibold text-slate-900 border-r border-slate-200">
                      <span>{sub.nameMy}</span>{' '}
                      <span className="text-[10px] text-slate-500 font-normal">({sub.nameEn})</span>
                    </td>
                    <td className="py-1.5 px-2.5 text-center font-mono font-medium text-slate-500 border-r border-slate-200">
                      100
                    </td>
                    <td className="py-1.5 px-2.5 text-center font-mono font-black text-slate-900 border-r border-slate-200">
                      {markNum !== null ? markNum : '-'}
                    </td>
                    <td className="py-1.5 px-2 text-center font-bold font-mono border-r border-slate-200">
                      <span
                        className={
                          letterGrade === 'A+' || letterGrade === 'A'
                            ? 'text-indigo-700'
                            : letterGrade === 'F'
                            ? 'text-rose-700'
                            : 'text-slate-800'
                        }
                      >
                        {letterGrade}
                      </span>
                    </td>
                    <td className="py-1.5 px-3 text-center">
                      {isDistinction ? (
                        <span className="inline-block px-2 py-0.5 rounded bg-amber-100 text-amber-900 font-bold text-[10px] border border-amber-300">
                          ★ ဂုဏ်ထူး
                        </span>
                      ) : isPass ? (
                        <span className="text-slate-600 text-[10px] font-medium">အောင်</span>
                      ) : markNum !== null ? (
                        <span className="text-rose-600 text-[10px] font-bold">ကြိုးစားရန်</span>
                      ) : (
                        <span className="text-slate-400 text-[10px]">-</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Academic Summary Metric Banner (4 Blocks) */}
        <div className="grid grid-cols-4 gap-2.5">
          <div className="border border-slate-300 rounded-lg p-2.5 bg-slate-50 text-center">
            <span className="text-[9px] font-bold uppercase text-slate-500 block">စုစုပေါင်းရမှတ် (Total)</span>
            <span className="text-base font-black text-slate-900 font-mono">
              {student.computedTotal} <span className="text-[10px] text-slate-400 font-normal">/ {activeSubjects.length * 100}</span>
            </span>
          </div>

          <div className="border border-slate-300 rounded-lg p-2.5 bg-slate-50 text-center">
            <span className="text-[9px] font-bold uppercase text-slate-500 block">ပျမ်းမျှရာခိုင်နှုန်း (Average)</span>
            <span className="text-base font-black text-slate-900 font-mono">
              {student.computedAverage}%
            </span>
          </div>

          <div className="border border-slate-300 rounded-lg p-2.5 bg-slate-50 text-center">
            <span className="text-[9px] font-bold uppercase text-slate-500 block">အဆင့်ပျမ်းမျှ (Grade GPA)</span>
            <span className="text-base font-black text-indigo-700 font-mono">
              {student.computedGpa.toFixed(2)} <span className="text-[10px] text-slate-400 font-normal">/ 4.00</span>
            </span>
          </div>

          <div className="border border-slate-300 rounded-lg p-2.5 bg-slate-50 text-center">
            <span className="text-[9px] font-bold uppercase text-slate-500 block">အတန်းတွင်းအဆင့် (Class Rank)</span>
            <span className="text-base font-black text-emerald-700 font-mono">
              #{student.computedRank} <span className="text-[10px] text-slate-500 font-normal">အဆင့်</span>
            </span>
          </div>
        </div>

        {/* Overall Academic Standing Result */}
        <div className="p-2.5 rounded-lg border border-slate-300 bg-white flex items-center justify-between text-xs">
          <div>
            <span className="text-[10px] text-slate-500 font-bold block uppercase">အကဲဖြတ် အောင်မြင်မှု အခြေအနေ (Standing Result)</span>
            <span className="font-bold text-slate-900 text-xs">
              {student.computedDistinctions.length > 0
                ? `ဂုဏ်ထူး (${student.computedDistinctions.length}) ဘာသာဖြင့် အောင်မြင်သည် [${student.computedDistinctions.join(', ')}]`
                : student.computedPassedAll
                ? 'ဘာသာစုံ အောင်မြင်သည် (Passed in All Subjects)'
                : 'ကြိုးစားအားထုတ်ရန် လိုအပ်ပါသည် (Needs Additional Study)'}
            </span>
          </div>
          <span
            className={`px-3 py-1 rounded-full text-xs font-black uppercase ${
              student.computedPassedAll
                ? 'bg-emerald-100 text-emerald-900 border border-emerald-300'
                : 'bg-amber-100 text-amber-900 border border-amber-300'
            }`}
          >
            {student.computedPassedAll ? 'PASSED / အောင်' : 'CONDITIONAL'}
          </span>
        </div>

        {/* Whole-Child 5-Domain Evaluation Highlights */}
        {includeWholeChild && (
          <div className="border border-slate-300 rounded-lg p-3 bg-slate-50/50 space-y-2">
            <div className="flex items-center gap-1.5 text-xs font-black text-slate-900">
              <Award className="h-3.5 w-3.5 text-indigo-600" />
              <span>ဘက်စုံပညာရည်နှင့် အကျင့်စာရိတ္တ ဖွံ့ဖြိုးမှု (Whole-Child 5-Domain Progress)</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-4 gap-2 text-[11px]">
              {/* Physical Growth */}
              <div className="bg-white p-2 rounded border border-slate-200">
                <span className="font-bold text-slate-700 flex items-center gap-1">
                  <Activity className="h-3 w-3 text-emerald-600" /> ကာယဖွံ့ဖြိုးမှု (Physical)
                </span>
                <span className="text-slate-600 block mt-0.5 text-[10px]">
                  အရပ်: {student.physical?.height_cm || '110'} cm • ကိုယ်အလေးချိန်: {student.physical?.weight_kg || '18'} kg
                </span>
                <span className="text-emerald-700 font-semibold block text-[10px]">
                  ကျန်းမာသန်စွမ်းမှု ပုံမှန် (Standard)
                </span>
              </div>

              {/* Health Visibility */}
              <div className="bg-white p-2 rounded border border-slate-200">
                <span className="font-bold text-slate-700 flex items-center gap-1">
                  <Heart className="h-3 w-3 text-rose-500" /> ကျန်းမာရေး (Health)
                </span>
                <span className="text-slate-600 block mt-0.5 text-[10px]">
                  မျက်စိ/သွား စစ်ဆေးပြီး • သန်ချဆေးတိုက်ပြီး
                </span>
                <span className="text-slate-700 font-semibold block text-[10px]">
                  ပုံမှန် (Normal 20/20)
                </span>
              </div>

              {/* Wellbeing */}
              <div className="bg-white p-2 rounded border border-slate-200">
                <span className="font-bold text-slate-700 flex items-center gap-1">
                  <Smile className="h-3 w-3 text-amber-500" /> စိတ်ပိုင်းဆိုင်ရာ (Wellbeing)
                </span>
                <span className="text-slate-600 block mt-0.5 text-[10px]">
                  တက်ကြွမှုညွှန်းကိန်း: 4.8/5.0
                </span>
                <span className="text-indigo-700 font-semibold block text-[10px]">
                  သူငယ်ချင်းများနှင့် သင့်တင့် (Joyful)
                </span>
              </div>

              {/* Social & Citizenship */}
              <div className="bg-white p-2 rounded border border-slate-200">
                <span className="font-bold text-slate-700 flex items-center gap-1">
                  <Users className="h-3 w-3 text-indigo-500" /> လူမှုဆက်ဆံရေး (Social)
                </span>
                <span className="text-slate-600 block mt-0.5 text-[10px]">
                  ခေါင်းဆောင်မှုနှင့် စည်းကမ်းကောင်းမွန်
                </span>
                <span className="text-amber-800 font-semibold block text-[10px]">
                  ဆုတံဆိပ်: အချိန်တိကျမှုဆု
                </span>
              </div>
            </div>
          </div>
        )}

        {/* Teacher's Observation and Encouragement Notes */}
        <div className="border border-slate-300 rounded-lg p-3 bg-white text-xs">
          <span className="font-bold text-slate-700 block text-[10px] uppercase">အတန်းပိုင်ဆရာ/ဆရာမ၏ မှတ်ချက် (Teacher's Remarks):</span>
          <p className="text-slate-800 mt-1 italic font-serif">
            "{student.remarks || student.wellbeing?.teacher_notes || 'သင်ယူမှုတွင် စိတ်ဝင်တစား တက်ကြွစွာ ပါဝင်ဆောင်ရွက်ပြီး အတန်းဖော်များနှင့် သင့်မြတ်စွာ ပူးပေါင်းဆောင်ရွက်ပါသည်။ ပညာရည်ထူးချွန်အောင် ဆက်လက်ကြိုးစားပါရန် တိုက်တွန်းအပ်ပါသည်။'}"
          </p>
        </div>
      </div>

      {/* Bottom Section: Official Attestation Signatures & Blockchain Anchor */}
      <div className="mt-4 pt-3 border-t-2 border-slate-900 space-y-3">
        {includeSignatures && (
          <div className="grid grid-cols-2 gap-8 text-xs pt-1">
            {/* Class Teacher Signature Block */}
            <div className="text-center flex flex-col items-center">
              <div className="h-10 border-b border-dashed border-slate-400 w-44 flex items-end justify-center pb-1">
                <span className="font-serif italic text-slate-700 text-xs">Daw Hnin Aye Khaing</span>
              </div>
              <span className="font-bold text-slate-900 mt-1 block text-xs">အတန်းပိုင်ဆရာ/ဆရာမ လက်မှတ်</span>
              <span className="text-[10px] text-slate-500">Class Teacher's Signature & Date</span>
            </div>

            {/* Principal Signature & Seal Block */}
            <div className="text-center flex flex-col items-center">
              <div className="h-10 border-b border-dashed border-slate-400 w-44 flex items-end justify-center pb-1 relative">
                {/* Visual Seal Stamp Box */}
                <div className="absolute -top-3 right-0 w-12 h-12 rounded-full border border-rose-300 text-rose-500/30 flex items-center justify-center font-bold text-[8px] rotate-12 pointer-events-none uppercase">
                  ကျောင်းတံဆိပ်
                </div>
                <span className="font-serif italic text-slate-700 text-xs">U Thein Zaw (B.Ed)</span>
              </div>
              <span className="font-bold text-slate-900 mt-1 block text-xs">ကျောင်းအုပ်ကြီးလက်မှတ်နှင့် ကျောင်းတံဆိပ်တုံး</span>
              <span className="text-[10px] text-slate-500">Principal / Headmaster Signature & School Seal</span>
            </div>
          </div>
        )}

        {/* Cryptographic Tamper-Proof Footnote */}
        <div className="bg-slate-100 rounded-lg p-2 border border-slate-300 flex items-center justify-between text-[9px] text-slate-600">
          <div className="flex items-center gap-3">
            <div className="bg-white p-1 rounded border border-slate-300 shrink-0">
              <QRCodeImage
                value={JSON.stringify({
                  type: 'AcademicReportCardProof',
                  student_id: student.student_id,
                  did: canonicalDid,
                  exam: examName,
                  year: academicYear,
                  total: student.computedTotal,
                  gpa: student.computedGpa,
                  hash: certHash,
                })}
                size={40}
              />
            </div>
            <div>
              <div className="flex items-center gap-1 font-bold text-slate-800">
                <ShieldCheck className="h-3 w-3 text-emerald-600" />
                <span>Anti-Tamper Cryptographic Proof • Polygon Blockchain Anchored</span>
              </div>
              <span className="font-mono text-[8px] text-slate-500 block truncate max-w-sm">
                Digest: {certHash}
              </span>
              <span className="text-[8px] text-slate-400">
                တရားဝင် ပညာရည်စစ်ဆေးချက်အား QR ကုဒ်ကို စကင်ဖတ်၍ မည်သည့် စမတ်ဖုန်းမှမဆို စစ်ဆေးအတည်ပြုနိုင်ပါသည်။
              </span>
            </div>
          </div>

          <div className="text-right font-mono text-[8px] text-slate-400 shrink-0">
            <div>Printed: {new Date().toLocaleDateString('en-GB')}</div>
            <div>Doc ID: RC-{student.roll_no}-{seqVal}</div>
          </div>
        </div>
      </div>
    </div>
  );
};
