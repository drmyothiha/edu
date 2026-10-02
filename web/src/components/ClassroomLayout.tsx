import React, { useState, useEffect, useMemo } from 'react';
import { useParams, useLocation, Link, Outlet } from 'react-router-dom';
import { ClassDTO, SchoolDTO } from '../types';
import {
  LayoutGrid,
  FileSpreadsheet,
  Calendar,
  BookOpen,
  Clock,
  Sparkles,
  ChevronRight,
  ArrowLeft,
  ShieldCheck,
  Heart,
  Info,
  Award,
  Smartphone,
} from 'lucide-react';
import {
  loadClassroomWithDelayedSWR,
} from '../services/classroomOfflineStorage';
import { MOEGuideModal } from './MOEGuideModal';

export interface ClassroomContextType {
  classInfo: ClassDTO | null;
  classSlug: string;
  schoolInfo: SchoolDTO | null;
  studentsCount: number;
  reloadClass: () => Promise<void>;
  isKG: boolean;
  onOpenMOEGuide: () => void;
}

export const ClassroomLayout: React.FC = () => {
  const { id: classParam } = useParams<{ id: string }>();
  const location = useLocation();

  const [classInfo, setClassInfo] = useState<ClassDTO | null>(null);
  const [schoolInfo, setSchoolInfo] = useState<SchoolDTO | null>(null);
  const [studentsCount, setStudentsCount] = useState<number>(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [moeGuideOpen, setMoeGuideOpen] = useState(false);

  // Base path for navigation tabs (school-admin vs admin vs teacher)
  const basePath = useMemo(() => {
    if (location.pathname.startsWith('/school-admin')) return '/school-admin';
    if (location.pathname.startsWith('/admin')) return '/admin';
    return '/teacher';
  }, [location.pathname]);

  const classSlug = classParam || classInfo?.code || 'KGA';

  // Detect whether this is a KG (Kindergarten) class based on grade_level, code, or param
  const isKG = useMemo(() => {
    const code = (classInfo?.code || classParam || '').toUpperCase();
    const name = (classInfo?.name || '').toUpperCase();
    const grade = (classInfo?.grade_level || '').toUpperCase();
    return Boolean(
      grade === 'KG' ||
      code.startsWith('KG') ||
      name.startsWith('KG') ||
      code === 'KGA' ||
      code === 'KGB' ||
      (classParam && classParam.toUpperCase().startsWith('KG'))
    );
  }, [classInfo, classParam]);

  // Load class data, school info, and sibling classes offline-first with delayed server API check
  const loadClassroomData = async () => {
    if (!classParam) return;
    setError(null);

    await loadClassroomWithDelayedSWR(classParam, {
      delayMs: 1200, // Instant 0ms load from IndexedDB first; delay server check by 1.2s
      onCacheHit: (cached) => {
        setClassInfo(cached.classInfo);
        if (cached.schoolInfo) setSchoolInfo(cached.schoolInfo);
        setStudentsCount(cached.classInfo.student_count || 29);
        setLoading(false);
      },
      onFreshData: (fresh) => {
        setClassInfo(fresh.classInfo);
        if (fresh.schoolInfo) setSchoolInfo(fresh.schoolInfo);
        setStudentsCount(fresh.classInfo.student_count || 29);
        setLoading(false);
      },
      onError: (err) => {
        console.warn('Network unavailable, continuing seamlessly offline:', err);
      },
    });
  };

  useEffect(() => {
    loadClassroomData();
  }, [classParam]);

  // Navigation tabs adapting specifically for Kindergarten vs Upper Grades
  const navTabs = useMemo(() => {
    if (isKG) {
      return [
        {
          id: 'seating',
          label: 'သင်ယူမှုထောင့်များနှင့် စားပွဲဝိုင်း (Activity Corners)',
          icon: LayoutGrid,
          to: `${basePath}/classes/${classSlug}`,
          activeMatch: (path: string) => {
            const clean = path.replace(/\/$/, '');
            return clean.endsWith(`/classes/${classSlug}`) || clean.endsWith(`/classes/${classParam}`);
          },
          badge: 'ထောင့်များ',
          color: 'teal',
        },
        {
          id: 'exam-marks',
          label: 'ဖွံ့ဖြိုးမှုနယ်ပယ် (၆) ရပ် မှတ်တမ်း (6 Domains)',
          icon: Sparkles,
          to: `${basePath}/classes/${classSlug}/exam-marks`,
          activeMatch: (path: string) => path.includes('/exam-marks'),
          badge: 'နယ်ပယ် ၆ ခု',
          color: 'emerald',
        },
        {
          id: 'attendance',
          label: 'ကျောင်းခေါ်ချိန်နှင့် အာဟာရ (Attendance & Nutrition)',
          icon: Calendar,
          to: `${basePath}/classes/${classSlug}/attendance`,
          activeMatch: (path: string) => path.includes('/attendance'),
          badge: 'အာဟာရ',
          color: 'rose',
        },
        {
          id: 'lessons',
          label: 'ကလေးဗဟိုပြု သင်ယူမှုလုပ်ငန်းများ (Activities Copilot)',
          icon: BookOpen,
          to: `${basePath}/classes/${classSlug}/lessons`,
          activeMatch: (path: string) => path.includes('/lessons'),
          badge: 'လုပ်ငန်းများ',
          color: 'indigo',
        },
        {
          id: 'timetable',
          label: 'သူငယ်တန်း နေ့စဉ်အချိန်ဇယား (KG Routine)',
          icon: Clock,
          to: `${basePath}/classes/${classSlug}/timetable`,
          activeMatch: (path: string) => path.includes('/timetable'),
          badge: 'အချိန်ဇယား',
          color: 'purple',
        },
      ];
    }

    return [
      {
        id: 'seating',
        label: 'ထိုင်ခုံနေရာချထားမှု (Seating Plan)',
        icon: LayoutGrid,
        to: `${basePath}/classes/${classSlug}`,
        activeMatch: (path: string) => {
          const clean = path.replace(/\/$/, '');
          return clean.endsWith(`/classes/${classSlug}`) || clean.endsWith(`/classes/${classParam}`);
        },
        badge: 'ခုံနေရာ',
        color: 'teal',
      },
      {
        id: 'exam-marks',
        label: 'စာမေးပွဲ အမှတ်စာရင်း (Marksheet)',
        icon: FileSpreadsheet,
        to: `${basePath}/classes/${classSlug}/exam-marks`,
        activeMatch: (path: string) => path.includes('/exam-marks'),
        badge: 'အမှတ်စာရင်း',
        color: 'amber',
      },
      {
        id: 'attendance',
        label: 'ကျောင်းခေါ်ချိန် (Attendance)',
        icon: Calendar,
        to: `${basePath}/classes/${classSlug}/attendance`,
        activeMatch: (path: string) => path.includes('/attendance'),
        badge: 'ကျောင်းခေါ်ချိန်',
        color: 'emerald',
      },
      {
        id: 'lessons',
        label: 'သင်ခန်းစာ Copilot (Lessons)',
        icon: BookOpen,
        to: `${basePath}/classes/${classSlug}/lessons`,
        activeMatch: (path: string) => path.includes('/lessons'),
        badge: 'AI Copilot',
        color: 'indigo',
      },
      {
        id: 'timetable',
        label: 'အချိန်ဇယား (Timetable)',
        icon: Clock,
        to: `${basePath}/classes/${classSlug}/timetable`,
        activeMatch: (path: string) => path.includes('/timetable'),
        badge: 'အချိန်ဇယား',
        color: 'purple',
      },
    ];
  }, [isKG, basePath, classSlug, classParam]);

  return (
    <div className="min-h-full bg-slate-50 text-slate-900 pb-16 font-sans">
      {/* Top Breadcrumb Navigation */}
      <div className="bg-white border-b border-slate-200 py-2.5 px-4 sm:px-6 lg:px-8 print:hidden">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-2 text-xs">
            <Link
              to={`${basePath}/classes`}
              className="font-medium text-slate-500 hover:text-emerald-700 transition flex items-center gap-1"
            >
              <ArrowLeft className="h-3.5 w-3.5" />
              <span>အတန်းများ (Classes)</span>
            </Link>
            <ChevronRight className="h-3.5 w-3.5 text-slate-300" />
            <span className="font-bold text-slate-900 flex items-center gap-1.5">
              {isKG ? (
                <>
                  <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-300">
                    KG
                  </span>
                  <span>သူငယ်တန်း ({classInfo?.name || 'KG - Section A'})</span>
                </>
              ) : (
                <span>{classInfo?.name || classSlug}</span>
              )}
            </span>
          </div>

          {isKG && (
            <button
              onClick={() => setMoeGuideOpen(true)}
              className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 text-xs font-bold text-emerald-900 transition shadow-2xs"
            >
              <BookOpen className="h-3.5 w-3.5 text-emerald-700" />
              <span>ဆရာများအတွက် အမှာစာ (MOE Guide)</span>
            </button>
          )}
        </div>
      </div>

      {/* Official MOE Kindergarten Curriculum Banner (Visible for KG) */}
      {isKG && (
        <div className="bg-gradient-to-r from-emerald-900 via-teal-900 to-slate-900 text-white border-b border-emerald-800/50 print:hidden shadow-xs">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3.5 flex flex-col md:flex-row md:items-center justify-between gap-3">
            <div className="space-y-1">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-600 text-white uppercase tracking-wider">
                  ပညာရေးဝန်ကြီးဌာန (MOE) သင်ရိုးသစ် မူဘောင်
                </span>
                <span className="text-[11px] text-emerald-200 font-medium">
                  အမျိုးသားပညာရေးဥပဒေပုဒ်မ ၁၆(က) နှင့် ၂(က)
                </span>
                <span className="text-[11px] text-emerald-300/80">•</span>
                <span className="text-[11px] text-emerald-300 font-medium">
                  အသက် (၅) နှစ် ဘက်စုံဖွံ့ဖြိုးမှု
                </span>
              </div>
              <p className="text-xs sm:text-sm text-emerald-100 font-sans leading-snug">
                <strong className="text-white">“ဘာသာရပ်များဖြင့် သင်ကြားမည်မဟုတ်သောကြောင့် ကျောင်းသုံးစာအုပ်မရှိပါ။”</strong> — 
                သင်ယူဖွံ့ဖြိုးမှုနယ်ပယ် (၆) ရပ် အခြေပြု ကလေးဗဟိုပြု သင်ယူမှုစနစ်
              </p>
            </div>

            <div className="flex items-center gap-2 flex-wrap flex-shrink-0">
              <Link
                to={`${basePath}/classes/${classSlug}/exam-marks`}
                className="px-3.5 py-1.5 rounded-xl bg-amber-400 hover:bg-amber-300 text-slate-950 text-xs font-bold transition flex items-center gap-1.5 shadow-xs border border-amber-300"
              >
                <Smartphone className="h-3.5 w-3.5 text-slate-950" />
                <span>မိဘများထံ အစီရင်ခံစာ (Report Card)</span>
              </Link>

              <button
                onClick={() => setMoeGuideOpen(true)}
                className="px-3.5 py-1.5 rounded-xl bg-emerald-600/90 hover:bg-emerald-600 text-white text-xs font-bold transition flex items-center gap-1.5 border border-emerald-400/40 shadow-xs"
              >
                <Sparkles className="h-3.5 w-3.5 text-amber-300" />
                <span>အမှာစာ မူရင်း (၆) ချက်</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Persistent Classroom Navigation Tabs */}
      <div className="bg-white border-b border-slate-200 shadow-2xs sticky top-0 z-30 print:hidden">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          {/* Sub-Navigation: Persistent Tabs */}
          <nav
            className="flex space-x-1 sm:space-x-3 overflow-x-auto pt-1 pb-0.5 scrollbar-none"
            aria-label="Classroom Navigation Tabs"
          >
            {navTabs.map((tab) => {
              const active = tab.activeMatch(location.pathname);
              const Icon = tab.icon;

              return (
                <Link
                  key={tab.id}
                  to={tab.to}
                  className={`group inline-flex items-center gap-2 px-3.5 py-2.5 border-b-2 text-xs sm:text-sm font-semibold whitespace-nowrap transition-all duration-150 ${
                    active
                      ? isKG
                        ? 'border-emerald-600 text-emerald-950 bg-emerald-50/60 font-bold shadow-2xs'
                        : 'border-teal-600 text-teal-900 bg-teal-50/50 font-bold shadow-2xs'
                      : 'border-transparent text-slate-600 hover:text-slate-900 hover:border-slate-300 hover:bg-slate-50/80 font-medium'
                  }`}
                >
                  <Icon
                    className={`h-4 w-4 transition-colors ${
                      active
                        ? isKG
                          ? 'text-emerald-700'
                          : 'text-teal-700'
                        : tab.color === 'emerald'
                        ? 'text-emerald-600'
                        : tab.color === 'teal'
                        ? 'text-teal-600'
                        : tab.color === 'amber'
                        ? 'text-amber-600'
                        : tab.color === 'rose'
                        ? 'text-rose-600'
                        : tab.color === 'indigo'
                        ? 'text-indigo-600'
                        : 'text-purple-600'
                    }`}
                  />
                  <span>{tab.label}</span>
                </Link>
              );
            })}
          </nav>
        </div>
      </div>

      {/* Main Tab View Outlet */}
      <div className="w-full">
        {error && (
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mt-4">
            <div className="p-3 bg-rose-50 border border-rose-200 text-rose-800 text-xs rounded-xl flex items-center justify-between">
              <span>{error}</span>
            </div>
          </div>
        )}

        <Outlet
          context={
            {
              classInfo,
              classSlug,
              schoolInfo,
              studentsCount,
              reloadClass: loadClassroomData,
              isKG,
              onOpenMOEGuide: () => setMoeGuideOpen(true),
            } satisfies ClassroomContextType
          }
        />
      </div>

      {/* Official MOE Curriculum Guide Modal */}
      <MOEGuideModal isOpen={moeGuideOpen} onClose={() => setMoeGuideOpen(false)} />
    </div>
  );
};
