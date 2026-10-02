import React, { useState, useEffect, useMemo } from 'react';
import { StudentDTO, ClassDTO, SchoolDTO } from '../types';
import {
  Heart,
  Smile,
  MessageSquare,
  Calculator,
  Palette,
  Compass,
  CheckCircle2,
  AlertCircle,
  Save,
  Printer,
  Search,
  Filter,
  Sparkles,
  Award,
  ChevronDown,
  Info,
  Calendar,
  Layers,
  Check,
  CheckCheck,
  AlertTriangle,
  Eye,
  Clock,
  RefreshCw,
  User,
  Activity,
  FileSpreadsheet,
  Download,
  BookOpen,
  Smartphone,
  Send,
} from 'lucide-react';
import { MOE_DOMAINS, MOEGuideModal } from './MOEGuideModal';
import {
  KGReportToParentsModal,
  KGStudentReceipt,
  KGReceiptStatus,
  getParentNameForStudent,
} from './KGReportToParentsModal';

export type KGProficiencyLevel = 'mastered' | 'developing' | 'emerging';

export interface KGStudentAssessment {
  studentId: string;
  ratings: Record<string, KGProficiencyLevel>; // domainId -> level
  teacherNote?: string;
  heightCm?: number;
  weightKg?: number;
  nutritionStatus?: 'nourished' | 'normal' | 'support_needed';
}

interface KGDevelopmentTrackerProps {
  classInfo: ClassDTO | null;
  schoolInfo: SchoolDTO | null;
  students: StudentDTO[];
  classSlug: string;
  onOpenMOEGuide?: () => void;
}

const PROFICIENCY_CONFIG: Record<
  KGProficiencyLevel,
  { labelMy: string; labelEn: string; stars: string; badgeClass: string; iconClass: string }
> = {
  mastered: {
    labelMy: 'ကျွမ်းကျင်ပိုင်နိုင်',
    labelEn: 'Mastered',
    stars: '★★★',
    badgeClass: 'bg-emerald-100 text-emerald-800 border-emerald-300',
    iconClass: 'text-emerald-600',
  },
  developing: {
    labelMy: 'အဆင့်မီတိုးတက်နေ',
    labelEn: 'Developing',
    stars: '★★☆',
    badgeClass: 'bg-blue-100 text-blue-800 border-blue-300',
    iconClass: 'text-blue-600',
  },
  emerging: {
    labelMy: 'စတင်သင်ယူဆဲ',
    labelEn: 'Emerging',
    stars: '★☆☆',
    badgeClass: 'bg-amber-100 text-amber-800 border-amber-300',
    iconClass: 'text-amber-600',
  },
};

export const KGDevelopmentTracker: React.FC<KGDevelopmentTrackerProps> = ({
  classInfo,
  schoolInfo,
  students,
  classSlug,
  onOpenMOEGuide,
}) => {
  const [selectedPeriod, setSelectedPeriod] = useState<string>('2026-10');
  const [activeDomainFilter, setActiveDomainFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedStudentId, setSelectedStudentId] = useState<string | null>(null);
  const [assessments, setAssessments] = useState<Record<string, KGStudentAssessment>>({});
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [guideModalOpen, setGuideModalOpen] = useState(false);
  const [printModalOpen, setPrintModalOpen] = useState(false);
  const [reportModalOpen, setReportModalOpen] = useState(false);
  const [reportStudentId, setReportStudentId] = useState<string | null>(null);
  const [lastDispatchedInfo, setLastDispatchedInfo] = useState<{
    dispatchedAt: string;
    title: string;
    period: string;
    scope: string;
    recipientCount: number;
  } | null>(null);
  const [receipts, setReceipts] = useState<Record<string, KGStudentReceipt>>({});
  const [receiptFilter, setReceiptFilter] = useState<'all' | 'read' | 'delivered' | 'pending'>('all');

  // Storage keys for caching KG assessments & reports
  const classIdentifier = classInfo?.id || classSlug;
  const storageKey = `edu_kg_assessment_${classIdentifier}_${selectedPeriod}`;
  const dispatchedKey = `edu_kg_report_dispatched_${classIdentifier}_${selectedPeriod}`;
  const receiptsKey = `edu_kg_report_receipts_${classIdentifier}_${selectedPeriod}`;

  // Check last dispatch info and load receipts for selectedPeriod
  useEffect(() => {
    try {
      const rec = localStorage.getItem(dispatchedKey);
      if (rec) {
        setLastDispatchedInfo(JSON.parse(rec));
      } else {
        setLastDispatchedInfo(null);
      }
    } catch (_) {
      setLastDispatchedInfo(null);
    }

    try {
      const savedReceipts = localStorage.getItem(receiptsKey);
      if (savedReceipts) {
        setReceipts(JSON.parse(savedReceipts));
        return;
      }
    } catch (_) {}

    // If already dispatched in this period but receipts not cached, generate default mock receipts
    try {
      const rec = localStorage.getItem(dispatchedKey);
      if (rec) {
        const parsed = JSON.parse(rec);
        const initialReceipts: Record<string, KGStudentReceipt> = {};
        students.forEach((s, idx) => {
          const parentName = getParentNameForStudent(s.full_name, idx);
          const isRead = idx % 5 !== 1 && idx % 5 !== 3; // ~60% read
          initialReceipts[s.id] = {
            studentId: s.id,
            studentName: s.full_name,
            parentName,
            status: isRead ? 'read' : 'delivered',
            deliveredAt: parsed.dispatchedAt || new Date().toISOString(),
            readAt: isRead
              ? new Date(Date.now() - (idx * 3 + 5) * 60 * 1000).toISOString()
              : undefined,
          };
        });
        setReceipts(initialReceipts);
        localStorage.setItem(receiptsKey, JSON.stringify(initialReceipts));
        return;
      }
    } catch (_) {}

    // Not dispatched yet -> all students have status 'pending'
    const initialPending: Record<string, KGStudentReceipt> = {};
    students.forEach((s, idx) => {
      initialPending[s.id] = {
        studentId: s.id,
        studentName: s.full_name,
        parentName: getParentNameForStudent(s.full_name, idx),
        status: 'pending',
      };
    });
    setReceipts(initialPending);
  }, [dispatchedKey, receiptsKey, students]);

  // Load initial assessment data
  useEffect(() => {
    try {
      const saved = localStorage.getItem(storageKey);
      if (saved) {
        setAssessments(JSON.parse(saved));
        return;
      }
    } catch (_) {}

    // Generate sensible default assessment milestones
    const initialMap: Record<string, KGStudentAssessment> = {};
    students.forEach((s, idx) => {
      const defaultRatings: Record<string, KGProficiencyLevel> = {};
      MOE_DOMAINS.forEach((d, dIdx) => {
        // Vary slightly based on student index for authentic demo
        const mod = (idx + dIdx) % 3;
        defaultRatings[d.id] = mod === 0 ? 'mastered' : mod === 1 ? 'developing' : 'emerging';
      });

      initialMap[s.id] = {
        studentId: s.id,
        ratings: defaultRatings,
        teacherNote: 'အဖွဲ့လိုက် ကစားချိန်များတွင် တက်ကြွစွာ ပါဝင်ပြီး ဆရာမ၏ ညွှန်ကြားချက်များကို လိုက်နာပါသည်။',
        heightCm: 104 + (idx % 8),
        weightKg: 16.5 + (idx % 5) * 0.8,
        nutritionStatus: idx % 6 === 0 ? 'nourished' : 'normal',
      };
    });
    setAssessments(initialMap);
  }, [students, storageKey]);

  // Handle single cell rating change
  const handleRatingChange = (
    studentId: string,
    domainId: string,
    newLevel: KGProficiencyLevel
  ) => {
    setAssessments((prev) => {
      const current = prev[studentId] || {
        studentId,
        ratings: {},
      };
      return {
        ...prev,
        [studentId]: {
          ...current,
          ratings: {
            ...current.ratings,
            [domainId]: newLevel,
          },
        },
      };
    });
  };

  // Cycle rating on cell click (mastered -> developing -> emerging -> mastered)
  const handleCycleRating = (studentId: string, domainId: string) => {
    const current = assessments[studentId]?.ratings?.[domainId] || 'developing';
    const next: KGProficiencyLevel =
      current === 'emerging' ? 'developing' : current === 'developing' ? 'mastered' : 'emerging';
    handleRatingChange(studentId, domainId, next);
  };

  const handleSave = () => {
    setSaving(true);
    try {
      localStorage.setItem(storageKey, JSON.stringify(assessments));
      setSuccessMsg('သူငယ်တန်း သင်ယူဖွံ့ဖြိုးမှုနယ်ပယ် မှတ်တမ်းများကို အောင်မြင်စွာ သိမ်းဆည်းပြီးပါပြီ။');
      setTimeout(() => setSuccessMsg(null), 3500);
    } catch (e) {
      console.error(e);
    } finally {
      setSaving(false);
    }
  };

  // Compute receipt statistics (Delivered / Read receipts)
  const receiptStats = useMemo(() => {
    let readCount = 0;
    let deliveredCount = 0;
    let pendingCount = 0;

    students.forEach((s) => {
      const r = receipts[s.id];
      const st = r?.status || 'pending';
      if (st === 'read') readCount++;
      else if (st === 'delivered') deliveredCount++;
      else pendingCount++;
    });

    const total = students.length;
    return {
      total,
      readCount,
      deliveredCount,
      pendingCount,
      readPct: total ? Math.round((readCount / total) * 100) : 0,
      deliveredPct: total ? Math.round(((readCount + deliveredCount) / total) * 100) : 0,
    };
  }, [students, receipts]);

  const filteredStudents = useMemo(() => {
    return students.filter((s) => {
      if (receiptFilter !== 'all') {
        const r = receipts[s.id];
        const status = r?.status || 'pending';
        if (receiptFilter !== status) return false;
      }
      if (!searchQuery) return true;
      const q = searchQuery.toLowerCase();
      return (
        s.full_name.toLowerCase().includes(q) ||
        (s.email && s.email.toLowerCase().includes(q))
      );
    });
  }, [students, searchQuery, receiptFilter, receipts]);

  // Selected student for detailed report
  const activeStudent = useMemo(() => {
    if (!selectedStudentId) return null;
    return students.find((s) => s.id === selectedStudentId) || null;
  }, [selectedStudentId, students]);

  const activeAssessment = selectedStudentId ? assessments[selectedStudentId] : null;

  // Domain summary statistics
  const stats = useMemo(() => {
    let totalRatings = 0;
    let masteredCount = 0;
    let developingCount = 0;
    let emergingCount = 0;

    Object.values(assessments).forEach((a) => {
      Object.values(a.ratings || {}).forEach((lvl) => {
        totalRatings++;
        if (lvl === 'mastered') masteredCount++;
        else if (lvl === 'developing') developingCount++;
        else if (lvl === 'emerging') emergingCount++;
      });
    });

    return {
      masteredPct: totalRatings ? Math.round((masteredCount / totalRatings) * 100) : 0,
      developingPct: totalRatings ? Math.round((developingCount / totalRatings) * 100) : 0,
      emergingPct: totalRatings ? Math.round((emergingCount / totalRatings) * 100) : 0,
      studentCount: students.length,
    };
  }, [assessments, students]);

  return (
    <div className="space-y-6">
      {/* MOE Framework Header Banner */}
      <div className="bg-gradient-to-r from-emerald-800 via-teal-800 to-cyan-900 rounded-2xl p-5 sm:p-6 text-white shadow-md relative overflow-hidden">
        <div className="absolute right-0 top-0 w-80 h-full bg-white/5 pointer-events-none transform -skew-x-12" />

        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-1.5 max-w-2xl">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-emerald-700/80 border border-emerald-400/40 text-emerald-200 uppercase tracking-wider">
                ပညာရေးဝန်ကြီးဌာန (MOE) မူဘောင်
              </span>
              <span className="text-[11px] font-medium text-emerald-100">
                အမျိုးသားပညာရေးဥပဒေပုဒ်မ ၁၆(က) နှင့် ၂(က) အဓိပ္ပာယ်ဖွင့်ဆိုချက်
              </span>
            </div>

            <h2 className="text-xl sm:text-2xl font-bold font-sans">
              သူငယ်တန်း သင်ယူဖွံ့ဖြိုးမှုနယ်ပယ် (၆) ရပ် စောင့်ကြည့်အကဲဖြတ်မှု မှတ်တမ်း
            </h2>

            <p className="text-xs sm:text-sm text-emerald-100/90 leading-relaxed font-sans">
              <strong className="text-white">“ဘာသာရပ်များ ဖြင့် သင်ကြားမည်မဟုတ်သောကြောင့် ကျောင်းသုံးစာအုပ်မရှိပါ။”</strong> — 
              အသက် (၅) နှစ်အရွယ် ကလေးများအား စာမေးပွဲရမှတ်များဖြင့် မဟုတ်ဘဲ ဘက်စုံဖွံ့ဖြိုးမှုရလဒ် (၆) ခုဖြင့်
              ကလေးဗဟိုပြု စဉ်ဆက်မပြတ် စောင့်ကြည့်လေ့လာ အကဲဖြတ်ခြင်းဖြစ်ပါသည်။
            </p>
          </div>

          <div className="flex items-center gap-2 flex-wrap flex-shrink-0">
            {lastDispatchedInfo && (
              <div className="flex items-center gap-2 bg-emerald-950/70 border border-emerald-400/50 px-3 py-1.5 rounded-xl text-xs text-emerald-200 shadow-xs">
                <CheckCheck className="h-4 w-4 text-emerald-400 flex-shrink-0" />
                <div className="leading-tight">
                  <div className="font-bold text-white flex items-center gap-1.5">
                    <span>ပေးပို့ပြီး (Delivered)</span>
                    <span className="text-[10px] bg-emerald-700 text-white px-1.5 py-0.2 rounded font-mono font-bold">
                      {receiptStats.readPct}% Read
                    </span>
                  </div>
                  <div className="text-[11px] text-emerald-300">
                    ဖတ်ရှုပြီး: <strong>{receiptStats.readCount}/{receiptStats.total}</strong> ဦး
                  </div>
                </div>
              </div>
            )}

            <button
              onClick={() => {
                setReportStudentId(null);
                setReportModalOpen(true);
              }}
              className="px-4 py-2 rounded-xl bg-amber-400 hover:bg-amber-300 text-slate-950 text-xs font-bold transition flex items-center gap-2 shadow-md hover:shadow-lg active:scale-95 border border-amber-300"
            >
              <Smartphone className="h-4 w-4 text-slate-950" />
              <span>
                {lastDispatchedInfo
                  ? 'မိဘထံ ပေးပို့မှုစစ်ဆေး / Resend'
                  : 'မိဘများထံ အစီရင်ခံစာ ပေးပို့မည် (Report to Parents)'}
              </span>
              <span className="px-1.5 py-0.5 rounded-full bg-slate-950 text-amber-300 text-[10px] font-bold">
                App
              </span>
            </button>

            <button
              onClick={() => setGuideModalOpen(true)}
              className="px-3.5 py-2 rounded-xl bg-white/15 hover:bg-white/25 border border-white/20 text-white text-xs font-bold transition flex items-center gap-2 shadow-xs"
            >
              <BookOpen className="h-4 w-4 text-emerald-300" />
              <span>ဆရာများအတွက် အမှာစာ</span>
            </button>

            <button
              onClick={() => window.print()}
              className="px-3.5 py-2 rounded-xl bg-white text-emerald-900 hover:bg-emerald-50 text-xs font-bold transition flex items-center gap-1.5 shadow-sm"
            >
              <Printer className="h-4 w-4 text-emerald-700" />
              <span>ထုတ်ယူရန် (Print A4)</span>
            </button>
          </div>
        </div>

        {/* 6 Domains Quick Cards */}
        <div className="mt-5 pt-4 border-t border-white/15 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2">
          {MOE_DOMAINS.map((domain) => {
            const Icon = domain.icon;
            const isSelected = activeDomainFilter === domain.id;
            return (
              <button
                key={domain.id}
                onClick={() =>
                  setActiveDomainFilter((prev) => (prev === domain.id ? 'all' : domain.id))
                }
                className={`p-2.5 rounded-xl text-left transition flex items-center gap-2 border ${
                  isSelected
                    ? 'bg-white text-slate-900 border-white shadow-xs font-bold'
                    : 'bg-white/10 hover:bg-white/20 text-white border-white/10'
                }`}
              >
                <div
                  className={`w-6 h-6 rounded-lg flex items-center justify-center flex-shrink-0 ${
                    isSelected ? 'bg-emerald-100 text-emerald-800' : 'bg-white/20 text-white'
                  }`}
                >
                  <Icon className="h-3.5 w-3.5" />
                </div>
                <div className="min-w-0 flex-1">
                  <span className="text-[10px] block opacity-75">နယ်ပယ် ({domain.number})</span>
                  <p className="text-xs truncate font-medium">{domain.titleMy}</p>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Control Bar: Search, Month, Save */}
      <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div className="flex items-center gap-2 flex-wrap">
          <div className="relative">
            <Search className="h-4 w-4 absolute left-3 top-2.5 text-slate-400" />
            <input
              type="text"
              placeholder="ကလေးအမည်ဖြင့် ရှာရန်..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 pr-3 py-1.5 text-xs border border-slate-300 rounded-lg focus:ring-1 focus:ring-emerald-500 w-52 bg-white"
            />
          </div>

          <div className="flex items-center gap-1.5">
            <span className="text-xs text-slate-500 font-medium">ကာလ:</span>
            <select
              value={selectedPeriod}
              onChange={(e) => setSelectedPeriod(e.target.value)}
              className="text-xs border border-slate-300 rounded-lg px-2.5 py-1.5 bg-white font-medium text-slate-700"
            >
              <option value="2026-06">ဇွန်လ (ပညာသင်နှစ်စ)</option>
              <option value="2026-08">သြဂုတ်လ စစ်ဆေးချက်</option>
              <option value="2026-10">အောက်တိုဘာလ (ပထမနှစ်ဝက်)</option>
              <option value="2026-12">ဒီဇင်ဘာလ စစ်ဆေးချက်</option>
              <option value="2027-02">ဖေဖော်ဝါရီလ (ဒုတိယနှစ်ဝက်)</option>
              <option value="2027-03">မတ်လ (နှစ်ဆုံး ဘက်စုံရလဒ်)</option>
            </select>
          </div>

          {activeDomainFilter !== 'all' && (
            <button
              onClick={() => setActiveDomainFilter('all')}
              className="px-2.5 py-1 rounded-lg bg-emerald-50 text-emerald-800 border border-emerald-200 text-xs font-semibold flex items-center gap-1"
            >
              <span>နယ်ပယ်အားလုံး ကြည့်ရန်</span>
              <span>×</span>
            </button>
          )}

          {/* Receipt Status Filter Tabs */}
          <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl border border-slate-200 text-xs">
            <button
              type="button"
              onClick={() => setReceiptFilter('all')}
              className={`px-2.5 py-1 rounded-lg font-medium transition ${
                receiptFilter === 'all'
                  ? 'bg-white text-slate-900 shadow-2xs font-bold'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              အားလုံး ({students.length})
            </button>
            <button
              type="button"
              onClick={() => setReceiptFilter('read')}
              className={`px-2.5 py-1 rounded-lg font-medium transition flex items-center gap-1 ${
                receiptFilter === 'read'
                  ? 'bg-emerald-600 text-white shadow-2xs font-bold'
                  : 'text-emerald-700 hover:bg-emerald-50'
              }`}
            >
              <CheckCheck className="h-3 w-3" />
              <span>ဖတ်ရှုပြီး ({receiptStats.readCount})</span>
            </button>
            <button
              type="button"
              onClick={() => setReceiptFilter('delivered')}
              className={`px-2.5 py-1 rounded-lg font-medium transition flex items-center gap-1 ${
                receiptFilter === 'delivered'
                  ? 'bg-blue-600 text-white shadow-2xs font-bold'
                  : 'text-blue-700 hover:bg-blue-50'
              }`}
            >
              <Check className="h-3 w-3" />
              <span>ပေးပို့ပြီး ({receiptStats.deliveredCount})</span>
            </button>
            <button
              type="button"
              onClick={() => setReceiptFilter('pending')}
              className={`px-2.5 py-1 rounded-lg font-medium transition flex items-center gap-1 ${
                receiptFilter === 'pending'
                  ? 'bg-slate-700 text-white shadow-2xs font-bold'
                  : 'text-slate-600 hover:bg-slate-200/50'
              }`}
            >
              <Clock className="h-3 w-3" />
              <span>မပေးပို့ရသေး ({receiptStats.pendingCount})</span>
            </button>
          </div>
        </div>

        {/* Legend & Save Button */}
        <div className="flex items-center gap-3 flex-wrap">
          <div className="hidden lg:flex items-center gap-2 text-[11px] font-medium text-slate-600 bg-slate-50 px-3 py-1.5 rounded-lg border border-slate-200">
            <span className="text-slate-400">အဆင့်သတ်မှတ်ချက်:</span>
            <span className="flex items-center gap-1 text-emerald-700">
              <span className="w-2 h-2 rounded-full bg-emerald-500"></span> ကျွမ်းကျင် (★★★)
            </span>
            <span className="flex items-center gap-1 text-blue-700">
              <span className="w-2 h-2 rounded-full bg-blue-500"></span> အဆင့်မီ (★★☆)
            </span>
            <span className="flex items-center gap-1 text-amber-700">
              <span className="w-2 h-2 rounded-full bg-amber-500"></span> စတင်ဆဲ (★☆☆)
            </span>
          </div>

          <button
            onClick={() => {
              setReportStudentId(null);
              setReportModalOpen(true);
            }}
            className="px-3.5 py-1.5 rounded-xl bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-300 text-xs font-bold transition flex items-center gap-1.5 shadow-2xs"
          >
            <Smartphone className="h-3.5 w-3.5 text-amber-700" />
            <span>{lastDispatchedInfo ? 'မိဘထံ ပေးပို့မှုစစ်ဆေး / Resend' : 'မိဘများထံ အစီရင်ခံစာ ပေးပို့မည်'}</span>
            {lastDispatchedInfo && (
              <span className="flex items-center gap-1 px-1.5 py-0.2 rounded-full bg-emerald-100 text-emerald-800 text-[10px] font-bold border border-emerald-300">
                <CheckCheck className="h-3 w-3 text-emerald-600" />
                <span>{receiptStats.readPct}% Read</span>
              </span>
            )}
          </button>

          <button
            onClick={handleSave}
            disabled={saving}
            className="px-4 py-1.5 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-bold transition flex items-center gap-1.5 shadow-xs"
          >
            <Save className="h-3.5 w-3.5" />
            <span>{saving ? 'သိမ်းဆည်းနေသည်...' : 'မှတ်တမ်း သိမ်းဆည်းရန်'}</span>
          </button>
        </div>
      </div>

      {successMsg && (
        <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs rounded-xl flex items-center justify-between animate-fade-in">
          <span className="flex items-center gap-2">
            <Check className="h-4 w-4 text-emerald-600" />
            <span>{successMsg}</span>
          </span>
          <button onClick={() => setSuccessMsg(null)}>×</button>
        </div>
      )}

      {/* Main Interactive Matrix Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-left text-xs">
            <thead>
              <tr className="bg-slate-50/80 border-b border-slate-200 text-slate-700 font-bold">
                <th className="py-3 px-4 w-12 text-center">စဉ်</th>
                <th className="py-3 px-4 min-w-[160px]">ကလေးအမည်</th>
                <th className="py-3 px-3 w-28 text-center">အာဟာရ/ကျန်းမာရေး</th>
                <th className="py-3 px-3 w-36 text-center border-l border-slate-200">
                  <div className="flex items-center justify-center gap-1.5">
                    <Smartphone className="h-3.5 w-3.5 text-emerald-700" />
                    <span>မိဘထံ ပေးပို့/ဖတ်ရှုမှု</span>
                  </div>
                </th>
                {MOE_DOMAINS.map((domain) => {
                  if (activeDomainFilter !== 'all' && activeDomainFilter !== domain.id) return null;
                  const Icon = domain.icon;
                  return (
                    <th key={domain.id} className="py-3 px-3 min-w-[170px] border-l border-slate-200">
                      <div className="flex items-center gap-2">
                        <div className={`w-5 h-5 rounded ${domain.bg} ${domain.text} flex items-center justify-center flex-shrink-0`}>
                          <Icon className="h-3 w-3" />
                        </div>
                        <div>
                          <span className="text-[10px] text-slate-400 block font-normal">
                            နယ်ပယ် ({domain.number})
                          </span>
                          <span className="text-xs font-bold text-slate-900 leading-tight">
                            {domain.titleMy}
                          </span>
                        </div>
                      </div>
                    </th>
                  );
                })}
                <th className="py-3 px-4 w-28 text-center border-l border-slate-200">တစ်ဦးချင်း အသေးစိတ်</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredStudents.length === 0 ? (
                <tr>
                  <td colSpan={11} className="py-8 text-center text-slate-400">
                    ရှာဖွေမှုနှင့် ကိုက်ညီသော ကျောင်းသား မရှိပါ။
                  </td>
                </tr>
              ) : (
                filteredStudents.map((student, idx) => {
                  const studentAssessment = assessments[student.id] || {
                    studentId: student.id,
                    ratings: {},
                  };

                  return (
                    <tr key={student.id} className="hover:bg-slate-50/60 transition group">
                      <td className="py-3 px-4 text-center font-mono text-slate-400">{idx + 1}</td>
                      <td className="py-3 px-4 font-medium text-slate-900">
                        <div className="flex items-center gap-2.5">
                          <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-emerald-500 to-teal-600 text-white font-bold flex items-center justify-center text-xs shadow-2xs">
                            {student.full_name?.charAt(0) || 'က'}
                          </div>
                          <div>
                            <div className="font-bold text-slate-900 text-xs">{student.full_name}</div>
                            <div className="text-[11px] text-slate-400 font-mono">
                              အသက်: ၅ နှစ် • {student.email ? student.email.split('@')[0] : `KG-${idx + 1}`}
                            </div>
                          </div>
                        </div>
                      </td>

                      {/* Nutrition / Growth Metric (Aim 2) */}
                      <td className="py-3 px-3 text-center">
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-800 border border-emerald-200">
                          <CheckCircle2 className="h-3 w-3 text-emerald-600" />
                          <span>အာဟာရပြည့်ဝ</span>
                        </span>
                      </td>

                      {/* Parent Delivery & Read Feedback Column */}
                      <td className="py-2.5 px-3 border-l border-slate-100 text-center">
                        {(() => {
                          const rec = receipts[student.id];
                          const status = rec?.status || 'pending';
                          const parentName = rec?.parentName || getParentNameForStudent(student.full_name, idx);

                          if (status === 'read') {
                            const timeStr = rec?.readAt
                              ? new Date(rec.readAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                              : '10:35 AM';
                            return (
                              <div
                                className="inline-flex flex-col items-center gap-0.5 cursor-help"
                                title={`${parentName} မှ ${timeStr} တွင် ဖတ်ရှုပြီးပါပြီ`}
                              >
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-800 border border-emerald-300">
                                  <CheckCheck className="h-3 w-3 text-emerald-600" />
                                  <span>ဖတ်ရှုပြီး (Read)</span>
                                </span>
                                <span className="text-[9px] text-slate-400 font-mono flex items-center gap-0.5">
                                  <Eye className="h-2.5 w-2.5 text-emerald-600" />
                                  <span>{timeStr}</span>
                                </span>
                              </div>
                            );
                          }

                          if (status === 'delivered') {
                            const timeStr = rec?.deliveredAt
                              ? new Date(rec.deliveredAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                              : '10:20 AM';
                            return (
                              <div
                                className="inline-flex flex-col items-center gap-0.5 cursor-help"
                                title={`${parentName} ၏ ဖုန်းထံသို့ ${timeStr} တွင် ရောက်ရှိပြီး (မဖတ်ရသေးပါ)`}
                              >
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-50 text-blue-800 border border-blue-300">
                                  <Check className="h-3 w-3 text-blue-600" />
                                  <span>ပေးပို့ပြီး (Delivered)</span>
                                </span>
                                <span className="text-[9px] text-slate-400 font-mono">
                                  {timeStr}
                                </span>
                              </div>
                            );
                          }

                          return (
                            <div className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-slate-100 text-slate-600 border border-slate-200">
                              <Clock className="h-2.5 w-2.5 text-slate-400" />
                              <span>မပေးပို့ရသေး</span>
                            </div>
                          );
                        })()}
                      </td>

                      {/* 6 Domains Cells */}
                      {MOE_DOMAINS.map((domain) => {
                        if (activeDomainFilter !== 'all' && activeDomainFilter !== domain.id) return null;
                        const rating = studentAssessment.ratings[domain.id] || 'developing';
                        const meta = PROFICIENCY_CONFIG[rating];

                        return (
                          <td
                            key={domain.id}
                            className="py-2.5 px-3 border-l border-slate-100 cursor-pointer select-none"
                            onClick={() => handleCycleRating(student.id, domain.id)}
                            title="ကလစ်နှိပ်၍ အဆင့်ပြောင်းလဲပါ (Mastered -> Developing -> Emerging)"
                          >
                            <div
                              className={`p-1.5 rounded-lg border text-center transition flex items-center justify-center gap-1.5 ${meta.badgeClass} hover:opacity-90 active:scale-95`}
                            >
                              <span className="font-mono text-xs font-bold">{meta.stars}</span>
                              <span className="text-[11px] font-semibold">{meta.labelMy}</span>
                            </div>
                          </td>
                        );
                      })}

                      {/* Individual Report Drawer Button */}
                      <td className="py-3 px-4 text-center border-l border-slate-100">
                        <button
                          onClick={() => setSelectedStudentId(student.id)}
                          className="px-2.5 py-1 rounded-lg border border-slate-200 bg-white hover:bg-emerald-50 hover:border-emerald-300 text-emerald-800 text-xs font-semibold transition shadow-2xs"
                        >
                          အစီရင်ခံစာ
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Matrix Footer */}
        <div className="bg-slate-50 border-t border-slate-200 p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs text-slate-600">
          <div className="flex items-center gap-4">
            <span>စုစုပေါင်း သူငယ်တန်း ကလေး: <strong>{students.length} ဦး</strong></span>
            <span>•</span>
            <span className="text-emerald-700">ကျွမ်းကျင်ပိုင်နိုင်: <strong>{stats.masteredPct}%</strong></span>
            <span className="text-blue-700">အဆင့်မီတိုးတက်နေ: <strong>{stats.developingPct}%</strong></span>
            <span className="text-amber-700">စတင်သင်ယူဆဲ: <strong>{stats.emergingPct}%</strong></span>
          </div>

          <div className="text-[11px] text-slate-400">
            * ဇယားကွက်ပေါ် ကလစ်နှိပ်၍ အဆင့်သတ်မှတ်ချက်ကို ချက်ချင်း ပြောင်းလဲနိုင်ပါသည်။
          </div>
        </div>
      </div>

      {/* Individual Child Profile & Assessment Modal */}
      {activeStudent && activeAssessment && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-6 animate-fade-in print:bg-white print:p-0">
          <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full border border-slate-200 overflow-hidden flex flex-col max-h-[90vh] print:max-h-none print:shadow-none print:border-none">
            {/* Modal Header */}
            <div className="bg-gradient-to-r from-emerald-800 to-teal-800 px-6 py-4 text-white flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-white/20 text-white font-bold flex items-center justify-center text-sm border border-white/30">
                  {activeStudent.full_name?.charAt(0) || 'က'}
                </div>
                <div>
                  <h3 className="text-lg font-bold font-sans">{activeStudent.full_name}</h3>
                  <p className="text-xs text-emerald-200 font-sans">
                    သူငယ်တန်း (KG - Section A) • အသက်: ၅ နှစ် • ကာလ: {selectedPeriod}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => window.print()}
                  className="p-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-white text-xs font-semibold flex items-center gap-1"
                >
                  <Printer className="h-4 w-4" />
                  <span className="hidden sm:inline">Print Card</span>
                </button>
                <button
                  onClick={() => setSelectedStudentId(null)}
                  className="p-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-white"
                >
                  ×
                </button>
              </div>
            </div>

            {/* Modal Body */}
            <div className="p-6 overflow-y-auto space-y-6">
              {/* Nutrition & Health Status (Aim 2) */}
              <div className="bg-emerald-50/60 rounded-xl p-4 border border-emerald-200 flex items-center justify-between gap-4">
                <div className="space-y-0.5">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-800">
                    အာဟာရနှင့် ကျန်းမာဖွံ့ဖြိုးမှု (ရည်ရွယ်ချက် ၂)
                  </span>
                  <div className="text-sm font-semibold text-slate-800">
                    အရပ်: {activeAssessment.heightCm || 106} cm • ကိုယ်အလေးချိန်: {activeAssessment.weightKg || 17.5} kg
                  </div>
                </div>
                <span className="px-3 py-1 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800 border border-emerald-300">
                  အာဟာရပြည့်ဝ / ကျန်းမာပျော်ရွှင်
                </span>
              </div>

              {/* Parent Delivery & Read Receipt Feedback Card */}
              {(() => {
                const rec = receipts[activeStudent.id];
                const parentName = rec?.parentName || getParentNameForStudent(activeStudent.full_name, 0);
                const status = rec?.status || 'pending';
                const isAlreadyDelivered = status === 'read' || status === 'delivered';

                return (
                  <div className="bg-slate-50 rounded-xl p-4 border border-slate-200 space-y-3">
                    <div className="flex items-center justify-between flex-wrap gap-2">
                      <div className="flex items-center gap-2">
                        <Smartphone className="h-4 w-4 text-emerald-700" />
                        <span className="text-xs font-bold uppercase tracking-wider text-slate-700">
                          မိဘထံ အစီရင်ခံစာ ပေးပို့/ဖတ်ရှုမှု အခြေအနေ (Parent App Status)
                        </span>
                      </div>
                      {isAlreadyDelivered && (
                        <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-900 border border-amber-300 flex items-center gap-1">
                          <AlertTriangle className="h-3 w-3 text-amber-700" />
                          <span>Double-Sending Protection Active</span>
                        </span>
                      )}
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                      <div className="bg-white p-3 rounded-lg border border-slate-200 shadow-2xs">
                        <span className="text-[10px] text-slate-400 block font-medium">အုပ်ထိန်းသူ / မိဘအမည်</span>
                        <p className="text-xs font-bold text-slate-800 mt-0.5">{parentName}</p>
                        <span className="text-[10px] text-slate-400 font-mono">App: Guardian Portal</span>
                      </div>

                      <div className="bg-white p-3 rounded-lg border border-slate-200 shadow-2xs">
                        <span className="text-[10px] text-slate-400 block font-medium">ဖုန်းထံ ရောက်ရှိမှု (Delivery)</span>
                        {rec?.deliveredAt ? (
                          <div className="flex items-center gap-1.5 text-xs font-bold text-blue-700 mt-0.5">
                            <Check className="h-3.5 w-3.5 text-blue-600" />
                            <span>{new Date(rec.deliveredAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                          </div>
                        ) : (
                          <span className="text-xs text-slate-400 font-medium block mt-0.5">မရောက်ရှိသေးပါ</span>
                        )}
                        <span className="text-[10px] text-slate-400 font-mono">Push Notification</span>
                      </div>

                      <div className="bg-white p-3 rounded-lg border border-slate-200 shadow-2xs">
                        <span className="text-[10px] text-slate-400 block font-medium">မိဘ ဖတ်ရှုပြီးစီးမှု (Read Status)</span>
                        {status === 'read' ? (
                          <div className="flex items-center gap-1.5 text-xs font-bold text-emerald-700 mt-0.5">
                            <CheckCheck className="h-3.5 w-3.5 text-emerald-600" />
                            <span>{rec?.readAt ? new Date(rec.readAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'ဖတ်ရှုပြီး'}</span>
                          </div>
                        ) : isAlreadyDelivered ? (
                          <div className="flex items-center gap-1 text-xs text-blue-600 font-medium mt-0.5">
                            <Eye className="h-3 w-3 text-blue-500" />
                            <span>ဖုန်းသို့ ရောက်ရှိ (မဖတ်ရသေး)</span>
                          </div>
                        ) : (
                          <span className="text-xs text-slate-400 font-medium block mt-0.5">မပေးပို့ရသေးပါ</span>
                        )}
                        <span className="text-[10px] text-slate-400 font-mono">Read Receipt Tracking</span>
                      </div>
                    </div>

                    {isAlreadyDelivered && (
                      <div className="p-2.5 bg-amber-50/80 border border-amber-200 rounded-lg text-[11px] text-amber-900 flex items-start gap-2">
                        <AlertTriangle className="h-4 w-4 text-amber-600 flex-shrink-0 mt-0.5" />
                        <div className="leading-relaxed">
                          <strong>သတိပြုရန် (Double Sending Guard):</strong> ဤကလေးငယ်၏ မိဘထံသို့ ဤလအတွက် အစီရင်ခံစာ ပေးပို့ထားပြီး ဖြစ်ပါသည်။ မိဘထံ အကြောင်းကြားချက် ထပ်ခါတလဲလဲ မရောက်ရှိစေရန် စနစ်မှ Double-Sending Protection ဖွင့်လှစ်ထားပြီး၊ ပြန်လည်ပေးပို့လိုပါက Safeguard Confirmation အမှန်ခြစ် ဖြည့်သွင်းရပါမည်။
                        </div>
                      </div>
                    )}
                  </div>
                );
              })()}

              {/* 6 Domains Performance Card */}
              <div className="space-y-3">
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500">
                  သင်ယူဖွံ့ဖြိုးမှုနယ်ပယ် (၆) ရပ် အကဲဖြတ်ရလဒ်
                </h4>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {MOE_DOMAINS.map((domain) => {
                    const rating = activeAssessment.ratings[domain.id] || 'developing';
                    const meta = PROFICIENCY_CONFIG[rating];
                    const Icon = domain.icon;

                    return (
                      <div
                        key={domain.id}
                        className={`p-3.5 rounded-xl border ${domain.border} ${domain.bg} space-y-2`}
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <Icon className={`h-4 w-4 ${domain.text}`} />
                            <span className="text-xs font-bold text-slate-900">{domain.titleMy}</span>
                          </div>
                        </div>

                        <div className="flex items-center justify-between pt-1 border-t border-slate-200/50">
                          <span className="text-[11px] text-slate-500 font-mono">{meta.stars}</span>
                          <span className={`px-2 py-0.5 rounded text-[11px] font-bold border ${meta.badgeClass}`}>
                            {meta.labelMy}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Teacher Observation Note */}
              <div className="space-y-2">
                <label className="text-xs font-bold uppercase tracking-wider text-slate-600 block">
                  ဆရာမ၏ လေ့လာတွေ့ရှိချက် မှတ်ချက် (Teacher Observation)
                </label>
                <textarea
                  rows={3}
                  value={activeAssessment.teacherNote || ''}
                  onChange={(e) => {
                    const note = e.target.value;
                    setAssessments((prev) => ({
                      ...prev,
                      [activeStudent.id]: {
                        ...prev[activeStudent.id],
                        teacherNote: note,
                      },
                    }));
                  }}
                  className="w-full p-3 text-xs border border-slate-300 rounded-xl focus:ring-1 focus:ring-emerald-500 bg-white leading-relaxed"
                  placeholder="ကလေး၏ လှုပ်ရှားမှု၊ ပူးပေါင်းဆောင်ရွက်မှုနှင့် အားပေးမြှင့်တင်ရန် အချက်များ..."
                />
              </div>
            </div>

            {/* Modal Footer */}
            <div className="bg-slate-50 border-t border-slate-200 px-6 py-3 flex items-center justify-between">
              <span className="text-xs text-slate-500">
                MOE Kindergarten Holistic Assessment Report
              </span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setReportStudentId(activeStudent.id);
                    setReportModalOpen(true);
                  }}
                  className={`px-3.5 py-2 rounded-xl text-xs font-bold transition flex items-center gap-1.5 shadow-xs border ${
                    receipts[activeStudent.id]?.status === 'read' || receipts[activeStudent.id]?.status === 'delivered'
                      ? 'bg-amber-100 hover:bg-amber-200 text-amber-950 border-amber-300'
                      : 'bg-amber-400 hover:bg-amber-300 text-slate-950 border-amber-300'
                  }`}
                >
                  <Smartphone className="h-4 w-4 text-slate-950" />
                  <span>
                    {receipts[activeStudent.id]?.status === 'read' || receipts[activeStudent.id]?.status === 'delivered'
                      ? 'မိဘထံ ပြန်လည်ပေးပို့ရန် (Resend with Guard)'
                      : 'မိဘထံ အစီရင်ခံစာ ပေးပို့မည်'}
                  </span>
                </button>

                <button
                  onClick={() => {
                    handleSave();
                    setSelectedStudentId(null);
                  }}
                  className="px-4 py-2 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-bold shadow-xs"
                >
                  အတည်ပြု သိမ်းဆည်းရန်
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Official MOE Guide Modal */}
      <MOEGuideModal isOpen={guideModalOpen} onClose={() => setGuideModalOpen(false)} />

      {/* Report to Parents Modal (Android Parent App) */}
      <KGReportToParentsModal
        isOpen={reportModalOpen}
        onClose={() => {
          setReportModalOpen(false);
          setReportStudentId(null);
        }}
        classInfo={classInfo}
        schoolInfo={schoolInfo}
        students={students}
        assessments={assessments}
        selectedPeriod={selectedPeriod}
        initialStudentId={reportStudentId}
        receipts={receipts}
        lastDispatchedInfo={lastDispatchedInfo}
        onDispatched={(updatedReceipts) => {
          try {
            const rec = localStorage.getItem(dispatchedKey);
            if (rec) setLastDispatchedInfo(JSON.parse(rec));
          } catch (_) {}
          setReceipts(updatedReceipts);
          setSuccessMsg('Android Parent App (Guardian Portal) သို့ သူငယ်တန်း အစီရင်ခံစာ အောင်မြင်စွာ ပေးပို့ပြီးပါပြီ။');
          setTimeout(() => setSuccessMsg(null), 4000);
        }}
      />
    </div>
  );
};
