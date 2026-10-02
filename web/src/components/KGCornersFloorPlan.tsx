import React, { useState } from 'react';
import { StudentDTO, ClassDTO, SchoolDTO } from '../types';
import {
  Heart,
  Smile,
  MessageSquare,
  Calculator,
  Palette,
  Compass,
  Users,
  Sparkles,
  Info,
  CheckCircle2,
  Printer,
  ChevronRight,
  BookOpen,
  Award,
  Circle,
} from 'lucide-react';
import { MOE_DOMAINS } from './MOEGuideModal';

interface KGCornersFloorPlanProps {
  classInfo: ClassDTO | null;
  schoolInfo: SchoolDTO | null;
  students: StudentDTO[];
  classSlug: string;
  onOpenMOEGuide?: () => void;
}

export const KGCornersFloorPlan: React.FC<KGCornersFloorPlanProps> = ({
  classInfo,
  schoolInfo,
  students,
  classSlug,
  onOpenMOEGuide,
}) => {
  const [selectedCornerId, setSelectedCornerId] = useState<string>('communication');

  // Distribute enrolled students evenly across the 6 corners
  const cornerAssignments = React.useMemo(() => {
    const map: Record<string, StudentDTO[]> = {
      physical_health: [],
      moral_social: [],
      communication: [],
      mathematics: [],
      arts_creativity: [],
      environment: [],
    };

    const domainKeys = Object.keys(map);
    students.forEach((st, idx) => {
      const targetDomain = domainKeys[idx % domainKeys.length];
      map[targetDomain].push(st);
    });

    return map;
  }, [students]);

  const activeDomain = MOE_DOMAINS.find((d) => d.id === selectedCornerId) || MOE_DOMAINS[0];
  const assignedStudents = cornerAssignments[activeDomain.id] || [];

  return (
    <div className="space-y-6">
      {/* Top Banner explaining child-centered corners */}
      <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4 print:hidden">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-300 uppercase tracking-wide">
              MOE သင်ယူဖွံ့ဖြိုးမှုနယ်ပယ် ထောင့်များ
            </span>
            <span className="text-xs text-slate-500 font-medium">
              ကလေးဗဟိုပြု (Child-Centered Activity Centers)
            </span>
          </div>
          <h2 className="text-base sm:text-lg font-bold text-slate-900">
            သူငယ်တန်း စာသင်ခန်း ဖွဲ့စည်းပုံနှင့် သင်ယူမှုထောင့် (၆) ခု
          </h2>
          <p className="text-xs text-slate-600 leading-relaxed max-w-2xl">
            အမျိုးသားပညာရေး မူဘောင်အရ သူငယ်တန်းတွင် စာမေးပွဲခုံတန်းများအစား ဖွံ့ဖြိုးမှုနယ်ပယ်အလိုက်
            သင်ယူမှုထောင့်များနှင့် စက်ဝိုင်းပုံ စုဝေးနေရာဖြင့် ကလေးများ လွတ်လပ်စွာ စူးစမ်းကစားရင်း သင်ယူပါသည် -
          </p>
        </div>

        <div className="flex items-center gap-2 flex-shrink-0">
          {onOpenMOEGuide && (
            <button
              onClick={onOpenMOEGuide}
              className="px-3 py-1.5 rounded-xl bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 text-emerald-800 text-xs font-bold transition flex items-center gap-1.5 shadow-2xs"
            >
              <BookOpen className="h-3.5 w-3.5 text-emerald-700" />
              <span>အမှာစာ လမ်းညွှန်ချက်</span>
            </button>
          )}

          <button
            onClick={() => window.print()}
            className="px-3 py-1.5 rounded-xl bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 text-xs font-bold transition flex items-center gap-1.5 shadow-2xs"
          >
            <Printer className="h-3.5 w-3.5 text-slate-500" />
            <span>Print Layout (A4)</span>
          </button>
        </div>
      </div>

      {/* Main Floor Plan Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left 2 Cols: Architectural Classroom Diagram */}
        <div className="lg:col-span-2 bg-white p-6 sm:p-8 rounded-2xl border-4 border-slate-700 shadow-md relative min-h-[560px] flex flex-col justify-between overflow-hidden">
          {/* Header Blueprint label */}
          <div className="flex items-center justify-between pb-3 border-b-2 border-dashed border-slate-200 text-[10px] font-mono text-slate-400 uppercase tracking-widest">
            <span>KG CLASSROOM ARCHITECTURAL FLOOR PLAN • {classInfo?.name || 'KG - Section A'}</span>
            <span>CAPACITY: {students.length} CHILDREN • 6 ACTIVITY CORNERS</span>
          </div>

          {/* FRONT WALL: Teacher Greeting Station & Board */}
          <div className="flex items-center justify-between pt-2 pb-4">
            <div className="p-2 rounded-lg border-2 border-slate-700 bg-amber-50 text-[10px] font-bold text-slate-800">
              ဆရာမနေရာ (Teacher Station)
            </div>

            <div className="px-8 py-1.5 rounded border-2 border-slate-700 bg-slate-100 text-xs font-bold text-slate-800 tracking-wider uppercase">
              ပုံပြင်နှင့် ကဗျာပြသင်ပုန်း (Display Board)
            </div>

            <div className="text-[10px] font-mono text-slate-500">
              🚪 အရှေ့တံခါး (Entrance)
            </div>
          </div>

          {/* TOP ROW CORNERS (Corner 1 & Corner 2) */}
          <div className="grid grid-cols-2 gap-4 my-2">
            {/* Corner 3: Communication */}
            <div
              onClick={() => setSelectedCornerId('communication')}
              className={`p-4 rounded-2xl border-2 transition cursor-pointer select-none relative ${
                selectedCornerId === 'communication'
                  ? 'border-blue-500 bg-blue-50/70 shadow-md ring-2 ring-blue-300'
                  : 'border-slate-300 bg-blue-50/20 hover:border-blue-300'
              }`}
            >
              <div className="flex items-center justify-between mb-2">
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-blue-100 text-blue-800">
                  ထောင့် (၃) • စာဖတ်/ပုံပြင်ထောင့်
                </span>
                <MessageSquare className="h-4 w-4 text-blue-600" />
              </div>
              <h4 className="font-bold text-xs sm:text-sm text-slate-900">
                အပြန်အလှန်ပြောဆို ဆက်သွယ်ခြင်းထောင့်
              </h4>
              <p className="text-[11px] text-slate-500 mt-1 line-clamp-2">
                ရုပ်ပြပုံပြင်စာအုပ်များ၊ ရုပ်သေးရုပ်များ၊ ကဗျာကတ်ပြားများနှင့် စာဖတ်ဧရိယာ
              </p>
              <div className="mt-3 flex items-center justify-between text-[11px] font-semibold text-blue-700">
                <span>ပါဝင်သူ: {cornerAssignments.communication.length} ဦး</span>
                <ChevronRight className="h-3 w-3" />
              </div>
            </div>

            {/* Corner 4: Mathematics */}
            <div
              onClick={() => setSelectedCornerId('mathematics')}
              className={`p-4 rounded-2xl border-2 transition cursor-pointer select-none relative ${
                selectedCornerId === 'mathematics'
                  ? 'border-emerald-500 bg-emerald-50/70 shadow-md ring-2 ring-emerald-300'
                  : 'border-slate-300 bg-emerald-50/20 hover:border-emerald-300'
              }`}
            >
              <div className="flex items-center justify-between mb-2">
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800">
                  ထောင့် (၄) • သင်္ချာ/တုံးကစားထောင့်
                </span>
                <Calculator className="h-4 w-4 text-emerald-600" />
              </div>
              <h4 className="font-bold text-xs sm:text-sm text-slate-900">
                သင်္ချာအခြေခံ စူးစမ်းလေ့လာရေးထောင့်
              </h4>
              <p className="text-[11px] text-slate-500 mt-1 line-clamp-2">
                သစ်သားပုံသဏ္ဌာန်တုံးများ၊ ရေတွက်စရာအစေ့အဆံများ၊ ချိန်ခွင်ငယ်များ
              </p>
              <div className="mt-3 flex items-center justify-between text-[11px] font-semibold text-emerald-700">
                <span>ပါဝင်သူ: {cornerAssignments.mathematics.length} ဦး</span>
                <ChevronRight className="h-3 w-3" />
              </div>
            </div>
          </div>

          {/* CENTER: MORNING CIRCLE CARPET & GROUP ACTIVITY TABLES */}
          <div className="my-4 p-5 rounded-2xl border-2 border-dashed border-teal-400 bg-teal-50/40 relative flex flex-col items-center justify-center text-center space-y-2">
            <div className="w-16 h-16 rounded-full bg-teal-100 border-2 border-teal-500 flex items-center justify-center text-teal-800 shadow-xs animate-pulse">
              <Sparkles className="h-8 w-8 text-teal-600" />
            </div>
            <div>
              <span className="text-[10px] font-bold uppercase tracking-wider text-teal-800 bg-teal-100 px-2 py-0.5 rounded-full">
                Center Meeting Area
              </span>
              <h3 className="font-bold text-slate-900 text-sm sm:text-base mt-1">
                မနက်ခင်း စက်ဝိုင်းပုံ စုဝေး ဖျာခင်းနေရာ (Morning Circle Carpet)
              </h3>
              <p className="text-xs text-slate-600 max-w-md mx-auto mt-0.5">
                မနက်ခင်း နှုတ်ဆက်ခြင်း၊ နေ့စွဲ/ရာသီဥတု ပြက္ခဒိန်ကြည့်ခြင်း၊ သံပြိုင်တေးဆိုခြင်းနှင့် ပုံပြင်နားထောင်ရာ ဗဟိုနေရာ
              </p>
            </div>
            <div className="flex items-center gap-3 pt-1 text-[11px] text-slate-500">
              <span className="flex items-center gap-1 font-medium">
                <Users className="h-3 w-3 text-teal-600" /> အတန်းတစ်ခုလုံး စုဝေးနိုင် (All {students.length} Children)
              </span>
              <span>•</span>
              <span className="font-medium text-teal-800">ဖျာခင်း/ကူရှင်ခုံ အဝိုင်းပုံ</span>
            </div>
          </div>

          {/* MIDDLE ROW CORNERS (Corner 5 & Corner 6) */}
          <div className="grid grid-cols-2 gap-4 my-2">
            {/* Corner 5: Arts */}
            <div
              onClick={() => setSelectedCornerId('arts_creativity')}
              className={`p-4 rounded-2xl border-2 transition cursor-pointer select-none relative ${
                selectedCornerId === 'arts_creativity'
                  ? 'border-purple-500 bg-purple-50/70 shadow-md ring-2 ring-purple-300'
                  : 'border-slate-300 bg-purple-50/20 hover:border-purple-300'
              }`}
            >
              <div className="flex items-center justify-between mb-2">
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-purple-100 text-purple-800">
                  ထောင့် (၅) • အနုပညာ/ဖန်တီးမှုထောင့်
                </span>
                <Palette className="h-4 w-4 text-purple-600" />
              </div>
              <h4 className="font-bold text-xs sm:text-sm text-slate-900">
                အနုပညာရသခံစားခြင်းနှင့် ဖန်တီးခြင်း
              </h4>
              <p className="text-[11px] text-slate-500 mt-1 line-clamp-2">
                ဆေးရောင်စုံ၊ စက္ကူခေါက်/ညှပ်၊ မြေစေးနယ်နှင့် ကလေးလက်ရာပြသရာနေရာ
              </p>
              <div className="mt-3 flex items-center justify-between text-[11px] font-semibold text-purple-700">
                <span>ပါဝင်သူ: {cornerAssignments.arts_creativity.length} ဦး</span>
                <ChevronRight className="h-3 w-3" />
              </div>
            </div>

            {/* Corner 6: Environment */}
            <div
              onClick={() => setSelectedCornerId('environment')}
              className={`p-4 rounded-2xl border-2 transition cursor-pointer select-none relative ${
                selectedCornerId === 'environment'
                  ? 'border-teal-500 bg-teal-50/70 shadow-md ring-2 ring-teal-300'
                  : 'border-slate-300 bg-teal-50/20 hover:border-teal-300'
              }`}
            >
              <div className="flex items-center justify-between mb-2">
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-teal-100 text-teal-800">
                  ထောင့် (၆) • သဘာဝ/ပတ်ဝန်းကျင်ထောင့်
                </span>
                <Compass className="h-4 w-4 text-teal-600" />
              </div>
              <h4 className="font-bold text-xs sm:text-sm text-slate-900">
                ပတ်ဝန်းကျင်လောကကို သိရှိနားလည်ခြင်း
              </h4>
              <p className="text-[11px] text-slate-500 mt-1 line-clamp-2">
                သစ်ရွက်/အပွင့် နမူနာများ၊ မှန်ဘီလူး၊ အာရုံခံစားမှု သဲ/ရေဗန်းနှင့် သဘာဝပစ္စည်းများ
              </p>
              <div className="mt-3 flex items-center justify-between text-[11px] font-semibold text-teal-700">
                <span>ပါဝင်သူ: {cornerAssignments.environment.length} ဦး</span>
                <ChevronRight className="h-3 w-3" />
              </div>
            </div>
          </div>

          {/* BOTTOM ROW CORNERS (Corner 1 & Corner 2) */}
          <div className="grid grid-cols-2 gap-4 mt-2 pt-3 border-t-2 border-dashed border-slate-200">
            {/* Corner 1: Physical & Health */}
            <div
              onClick={() => setSelectedCornerId('physical_health')}
              className={`p-4 rounded-2xl border-2 transition cursor-pointer select-none relative ${
                selectedCornerId === 'physical_health'
                  ? 'border-rose-500 bg-rose-50/70 shadow-md ring-2 ring-rose-300'
                  : 'border-slate-300 bg-rose-50/20 hover:border-rose-300'
              }`}
            >
              <div className="flex items-center justify-between mb-2">
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-rose-100 text-rose-800">
                  ထောင့် (၁) • ကာယ/ကျန်းမာရေးထောင့်
                </span>
                <Heart className="h-4 w-4 text-rose-600" />
              </div>
              <h4 className="font-bold text-xs sm:text-sm text-slate-900">
                ကိုယ်စိတ်နှစ်ဖြာ ကျန်းမာချမ်းသာခြင်း
              </h4>
              <p className="text-[11px] text-slate-500 mt-1 line-clamp-2">
                ဟန်ချက်ထိန်းတုံးများ၊ ဘောလုံးငယ်များ၊ လက်သည်း/သွား သန့်ရှင်းရေးစစ်ဆေးချက်
              </p>
              <div className="mt-3 flex items-center justify-between text-[11px] font-semibold text-rose-700">
                <span>ပါဝင်သူ: {cornerAssignments.physical_health.length} ဦး</span>
                <ChevronRight className="h-3 w-3" />
              </div>
            </div>

            {/* Corner 2: Moral & Social */}
            <div
              onClick={() => setSelectedCornerId('moral_social')}
              className={`p-4 rounded-2xl border-2 transition cursor-pointer select-none relative ${
                selectedCornerId === 'moral_social'
                  ? 'border-amber-500 bg-amber-50/70 shadow-md ring-2 ring-amber-300'
                  : 'border-slate-300 bg-amber-50/20 hover:border-amber-300'
              }`}
            >
              <div className="flex items-center justify-between mb-2">
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-100 text-amber-800">
                  ထောင့် (၂) • စာရိတ္တ/မိတ္တထောင့်
                </span>
                <Smile className="h-4 w-4 text-amber-600" />
              </div>
              <h4 className="font-bold text-xs sm:text-sm text-slate-900">
                စာရိတ္တ၊ မိတ္တနှင့် စိတ်လှုပ်ရှားမှုထောင့်
              </h4>
              <p className="text-[11px] text-slate-500 mt-1 line-clamp-2">
                ဟန်ဆောင်ကစားစရာများ (ဈေးရောင်း၊ ဆရာဝန်)၊ စိတ်ခံစားမှုပြဘုတ်၊ မျှဝေကစားစရာများ
              </p>
              <div className="mt-3 flex items-center justify-between text-[11px] font-semibold text-amber-700">
                <span>ပါဝင်သူ: {cornerAssignments.moral_social.length} ဦး</span>
                <ChevronRight className="h-3 w-3" />
              </div>
            </div>
          </div>

          {/* Bottom Exit Door */}
          <div className="flex justify-between items-center text-[10px] font-mono text-slate-400 pt-3">
            <span>REAR PLAYGROUND & ACTIVITY EXIT</span>
            <span>🚪 အနောက်တံခါး (Garden / Play Area)</span>
          </div>
        </div>

        {/* Right Col: Selected Corner Details & Enrolled Children */}
        <div className="space-y-4">
          <div className={`p-5 rounded-2xl border ${activeDomain.border} ${activeDomain.bg} shadow-xs space-y-4`}>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-white shadow-xs flex items-center justify-center text-slate-900">
                {React.createElement(activeDomain.icon, {
                  className: `h-5 w-5 ${activeDomain.text}`,
                })}
              </div>
              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                  နယ်ပယ် ({activeDomain.number})
                </span>
                <h3 className="font-bold text-slate-900 text-sm sm:text-base leading-tight">
                  {activeDomain.titleMy}
                </h3>
              </div>
            </div>

            <p className="text-xs text-slate-700 leading-relaxed font-sans">
              {activeDomain.desc}
            </p>

            {/* Learning Outcomes from MOE Guide */}
            <div className="bg-white/80 rounded-xl p-3.5 border border-slate-200/60 space-y-2">
              <span className="text-[11px] font-bold text-slate-800 uppercase tracking-wide block">
                ရရှိရမည် သင်ယူမှုရလဒ်များ (Learning Outcomes):
              </span>
              <ul className="text-xs text-slate-600 space-y-1.5">
                {activeDomain.activities.map((act, idx) => (
                  <li key={idx} className="flex items-start gap-2">
                    <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600 flex-shrink-0 mt-0.5" />
                    <span>{act}</span>
                  </li>
                ))}
              </ul>
            </div>

            {/* Stationed Children List */}
            <div className="space-y-2 pt-2 border-t border-slate-200/50">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
                  <Users className="h-3.5 w-3.5 text-slate-600" />
                  <span>လက်ရှိ ပါဝင်လှုပ်ရှားနေသော ကလေးများ</span>
                </span>
                <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-white text-slate-800 border border-slate-200">
                  {assignedStudents.length} ဦး
                </span>
              </div>

              <div className="max-h-60 overflow-y-auto space-y-1.5 pr-1">
                {assignedStudents.map((st, idx) => (
                  <div
                    key={st.id}
                    className="flex items-center justify-between p-2 rounded-xl bg-white border border-slate-200 text-xs shadow-2xs"
                  >
                    <div className="flex items-center gap-2">
                      <div className="w-6 h-6 rounded-full bg-slate-100 font-bold text-slate-700 flex items-center justify-center text-[10px]">
                        {st.full_name?.charAt(0) || 'က'}
                      </div>
                      <span className="font-semibold text-slate-900">{st.full_name}</span>
                    </div>

                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-800 border border-emerald-200">
                      တက်ကြွစွာ ပါဝင်နေ
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
