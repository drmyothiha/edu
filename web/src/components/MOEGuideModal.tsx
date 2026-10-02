import React, { useState } from 'react';
import {
  X,
  BookOpen,
  Award,
  Heart,
  Smile,
  MessageSquare,
  Calculator,
  Palette,
  Compass,
  CheckCircle2,
  Users,
  Printer,
  Sparkles,
  FileText,
  ShieldCheck,
  Info,
} from 'lucide-react';

interface MOEGuideModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const MOE_DOMAINS = [
  {
    id: 'physical_health',
    number: '၁',
    titleMy: 'ကိုယ်စိတ်နှစ်ဖြာကျန်းမာချမ်းသာခြင်း',
    titleEn: 'Physical & Emotional Well-being',
    icon: Heart,
    color: 'rose',
    bg: 'bg-rose-50',
    border: 'border-rose-200',
    text: 'text-rose-700',
    desc: 'ကာယစွမ်းရည် (အကြောလျှော့၊ ပြေးလွှား၊ ဟန်ချက်ထိန်း)၊ လက်ချောင်းကြွက်သားငယ်များ လှုပ်ရှားနိုင်မှု၊ သန့်ရှင်းရေးနှင့် ကိုယ်လက်ကျန်းမာပျော်ရွှင်မှု',
    activities: [
      'လက်ဆေးခြင်းနှင့် ကိုယ်လက်သန့်ရှင်းရေး အလေ့အကျင့်',
      'ခုန်ပေါက်ပြေးလွှား ကစားနည်းများနှင့် ဟန်ချက်ထိန်းလှုပ်ရှားမှု',
      'လက်ချောင်းကြွက်သားငယ် ဖွံ့ဖြိုးရေး (စက္ကူညှပ်၊ မြေစေးနယ်)',
    ],
  },
  {
    id: 'moral_social',
    number: '၂',
    titleMy: 'စာရိတ္တ၊ မိတ္တနှင့် စိတ်လှုပ်ရှားမှုဆိုင်ရာဖွံ့ဖြိုးတိုးတက်ခြင်း',
    titleEn: 'Moral, Social & Emotional Development',
    icon: Smile,
    color: 'amber',
    bg: 'bg-amber-50',
    border: 'border-amber-200',
    text: 'text-amber-700',
    desc: 'သူငယ်ချင်းများနှင့် သဟဇာတဖြစ်စွာ ပူးပေါင်းကစားခြင်း၊ စာနာနားလည်ခြင်း၊ အလှည့်ကျစောင့်ဆိုင်းခြင်းနှင့် မိမိစိတ်ခံစားမှုကို ထိန်းကျောင်းနိုင်ခြင်း',
    activities: [
      'ကစားစရာများ မျှဝေသုံးစွဲခြင်းနှင့် အလှည့်ကျစောင့်ခြင်း',
      'ကျေးဇူးတင်ခြင်း၊ တောင်းပန်ခြင်း ယဉ်ကျေးသော အမူအရာများ',
      'စိတ်ခံစားမှုဖော်ပြခြင်းနှင့် သူတစ်ပါးကို စာနာကူညီခြင်း',
    ],
  },
  {
    id: 'communication',
    number: '၃',
    titleMy: 'အပြန်အလှန်ပြောဆိုဆက်သွယ်ခြင်း',
    titleEn: 'Communication, Language & Literacy',
    icon: MessageSquare,
    color: 'blue',
    bg: 'bg-blue-50',
    border: 'border-blue-200',
    text: 'text-blue-700',
    desc: 'ဂရုတစိုက်နားထောင်ခြင်း၊ မေးခွန်းများမေးခြင်းနှင့် ရှင်းလင်းစွာဖြေဆိုခြင်း၊ ပုံပြင်ပြောပြခြင်း၊ ကဗျာရွတ်ဆိုခြင်းနှင့် စာဖတ်/စာရေးအကြို စွမ်းရည်များ',
    activities: [
      'ရုပ်ပြပုံပြင် နားထောင်ခြင်းနှင့် အပြန်အလှန်ဆွေးနွေးခြင်း',
      'ကဗျာ၊ တေးသီချင်းများ သံပြိုင်ရွတ်ဆိုခြင်း',
      'အသံထွက်နှင့် အက္ခရာပုံသဏ္ဌာန် ရင်းနှီးကျွမ်းဝင်စေခြင်း',
    ],
  },
  {
    id: 'mathematics',
    number: '၄',
    titleMy: 'သင်္ချာအခြေခံများကိုစူးစမ်းလေ့လာခြင်း',
    titleEn: 'Exploring Basic Mathematics & Numeracy',
    icon: Calculator,
    color: 'emerald',
    bg: 'bg-emerald-50',
    border: 'border-emerald-200',
    text: 'text-emerald-700',
    desc: 'အရာဝတ္ထုများကို ရေတွက်ခြင်း၊ အရွယ်အစား/ပုံသဏ္ဌာန်/အရောင် ခွဲခြားခြင်း၊ အစီအစဉ်လိုက် စီစဉ်ခြင်းနှင့် နေရာအနေအထား (အပေါ်/အောက်/ရှေ့/နောက်) နားလည်ခြင်း',
    activities: [
      'အရာဝတ္ထုများ၊ အစေ့အဆံများဖြင့် လက်တွေ့ရေတွက်ခြင်း (၁-၂၀)',
      'ဂျီဩမေတြီ အခြေခံပုံသဏ္ဌာန်များ (စက်ဝိုင်း၊ လေးထောင့်၊ တြိဂံ) ခွဲခြားခြင်း',
      'အတိုင်းအတာ၊ အလေးချိန်၊ အလျား အကြီး/အသေး နှိုင်းယှဉ်ကစားခြင်း',
    ],
  },
  {
    id: 'arts_creativity',
    number: '၅',
    titleMy: 'အနုပညာရသခံစားခြင်းနှင့် ဖန်တီးခြင်း',
    titleEn: 'Aesthetic Appreciation & Creative Arts',
    icon: Palette,
    color: 'purple',
    bg: 'bg-purple-50',
    border: 'border-purple-200',
    text: 'text-purple-700',
    desc: 'ဆေးရောင်ခြယ်ခြင်း၊ ပန်းချီဆွဲခြင်း၊ စက္ကူခေါက်ခြင်း၊ တေးဂီတနှင့် ကခုန်လှုပ်ရှားခြင်းမှတစ်ဆင့် ကလေး၏ စိတ်ကူးဉာဏ်နှင့် ဖန်တီးမှုစွမ်းရည် မြှင့်တင်ပေးခြင်း',
    activities: [
      'ဆေးရောင်စုံ ပုံကြမ်းခြယ်ခြင်းနှင့် လက်ရာဖန်တီးခြင်း',
      'စက္ကူခေါက်၊ စက္ကူကပ် သရုပ်ဖော် အနုပညာလက်ရာများ',
      'ရိုးရာတေးသံနှင့် စည်းချက်အလိုက် ကခုန်ဖန်တီးလှုပ်ရှားခြင်း',
    ],
  },
  {
    id: 'environment',
    number: '၆',
    titleMy: 'ပတ်ဝန်းကျင်လောကကို သိရှိနားလည်ခြင်း',
    titleEn: 'Understanding the Surrounding World',
    icon: Compass,
    color: 'teal',
    bg: 'bg-teal-50',
    border: 'border-teal-200',
    text: 'text-teal-700',
    desc: 'သဘာဝပတ်ဝန်းကျင် (ရာသီဥတု၊ သစ်ပင်၊ ပန်းမန်၊ တိရစ္ဆာန်များ)၊ မိမိမိသားစုနှင့် ရပ်ရွာလူထုကို စူးစမ်းလေ့လာသိရှိပြီး ချစ်မြတ်နိုးတန်ဖိုးထားတတ်စေခြင်း',
    activities: [
      'သဘာဝသစ်ရွက်၊ အပွင့်၊ အစေ့များ ကောက်ယူလေ့လာခြင်း',
      'ရာသီဥတုပြက္ခဒိန် (နေသာ၊ မိုးရွာ၊ လေတိုက်) နေ့စဉ်မှတ်သားခြင်း',
      'တိရစ္ဆာန်ငယ်များနှင့် ပတ်ဝန်းကျင်သန့်ရှင်းရေး ချစ်မြတ်နိုးစိတ် မွေးမြူခြင်း',
    ],
  },
];

export const MOE_AIMS = [
  {
    num: '၁',
    text: 'မိမိကိုယ်မိမိ ယုံကြည်အားကိုးတတ်သူများ ဖြစ်လာရန်',
    en: 'To develop self-confidence and independence',
  },
  {
    num: '၂',
    text: 'အာဟာရပြည့်ဝ၍ ကျန်းမာပျော်ရွှင်သူများ ဖြစ်လာရန်',
    en: 'To be well-nourished, physically fit, and happy',
  },
  {
    num: '၃',
    text: 'စာရေး၊ စာဖတ်ခြင်းနှင့် သင်္ချာအပါအဝင် အခြေခံပညာများကို စိတ်အားထက်သန်စွာ လေ့လာသင်ယူလိုသူများ ဖြစ်လာရန်',
    en: 'To become enthusiastic lifelong learners of basic literacy and numeracy',
  },
  {
    num: '၄',
    text: 'မိမိပတ်ဝန်းကျင်အကျိုးကို ဆောင်ရွက်တတ်သူများ ဖြစ်လာရန်',
    en: 'To contribute positively to their community and environment',
  },
];

export const MOEGuideModal: React.FC<MOEGuideModalProps> = ({ isOpen, onClose }) => {
  const [activeTab, setActiveTab] = useState<'official' | 'domains' | 'aims'>('official');

  if (!isOpen) return null;

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-6 animate-fade-in print:p-0 print:bg-white">
      <div className="bg-white rounded-2xl shadow-2xl max-w-4xl w-full border border-slate-200 overflow-hidden flex flex-col max-h-[92vh] print:max-h-none print:shadow-none print:border-none">
        {/* Modal Header */}
        <div className="bg-gradient-to-r from-emerald-800 via-teal-800 to-cyan-900 px-6 py-4 text-white flex items-center justify-between flex-shrink-0 print:bg-none print:text-slate-900 print:border-b">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-white/10 backdrop-blur-md flex items-center justify-center border border-white/20 print:hidden">
              <BookOpen className="h-5 w-5 text-emerald-300" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold uppercase tracking-wider text-emerald-300">
                  ပညာရေးဝန်ကြီးဌာန (MOE)
                </span>
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-700/60 border border-emerald-400/40 text-emerald-100 font-medium">
                  သူငယ်တန်း သင်ရိုးသစ် မူဘောင်
                </span>
              </div>
              <h2 className="text-lg sm:text-xl font-bold font-sans">
                ဆရာများအတွက် အမှာစာ (MOE Kindergarten Curriculum Guide)
              </h2>
            </div>
          </div>

          <div className="flex items-center gap-2 print:hidden">
            <button
              onClick={handlePrint}
              className="p-2 rounded-lg bg-white/10 hover:bg-white/20 text-white transition flex items-center gap-1.5 text-xs font-semibold"
              title="A4 Print Out ထုတ်ယူရန်"
            >
              <Printer className="h-4 w-4" />
              <span className="hidden sm:inline">Print Guide</span>
            </button>
            <button
              onClick={onClose}
              className="p-2 rounded-lg bg-white/10 hover:bg-white/20 text-white transition"
              title="ပိတ်ရန်"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        {/* View Switcher Tabs (Hidden in Print) */}
        <div className="bg-slate-100 border-b border-slate-200 px-6 py-2 flex items-center justify-between flex-shrink-0 print:hidden">
          <div className="flex items-center gap-2">
            <button
              onClick={() => setActiveTab('official')}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 ${
                activeTab === 'official'
                  ? 'bg-white text-emerald-800 shadow-xs border border-slate-200'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <FileText className="h-3.5 w-3.5 text-emerald-600" />
              <span>မူရင်းအမှာစာ အပြည့်အစုံ (Official Notice)</span>
            </button>

            <button
              onClick={() => setActiveTab('domains')}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 ${
                activeTab === 'domains'
                  ? 'bg-white text-emerald-800 shadow-xs border border-slate-200'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Sparkles className="h-3.5 w-3.5 text-teal-600" />
              <span>သင်ယူဖွံ့ဖြိုးမှုနယ်ပယ် (၆) ရပ် (6 Domains)</span>
            </button>

            <button
              onClick={() => setActiveTab('aims')}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 ${
                activeTab === 'aims'
                  ? 'bg-white text-emerald-800 shadow-xs border border-slate-200'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Award className="h-3.5 w-3.5 text-amber-600" />
              <span>ရည်ရွယ်ချက် (၄) ရပ် (4 Core Aims)</span>
            </button>
          </div>

          <div className="text-[11px] text-slate-500 font-medium hidden md:block">
            အခြေခံပညာသင်ရိုးညွှန်းတမ်းနှင့် ကျောင်းသုံးစာအုပ်ကော်မတီ
          </div>
        </div>

        {/* Modal Scrollable Body */}
        <div className="overflow-y-auto p-6 sm:p-8 space-y-6 flex-1 text-slate-800">
          {activeTab === 'official' && (
            <div className="space-y-6 max-w-3xl mx-auto bg-amber-50/40 p-6 sm:p-8 rounded-2xl border border-amber-200/70 shadow-xs print:bg-white print:border-none print:p-0">
              {/* Document Header */}
              <div className="text-center pb-6 border-b border-amber-300/80">
                <span className="text-xs uppercase tracking-widest text-emerald-800 font-bold block mb-1">
                  ပြည်ထောင်စုသမ္မတမြန်မာနိုင်ငံတော် အစိုးရ • ပညာရေးဝန်ကြီးဌာန
                </span>
                <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 font-serif mb-1">
                  ဆရာများအတွက်အမှာစာ
                </h1>
                <p className="text-sm font-semibold text-slate-700">
                  အခြေခံပညာသင်ရိုးညွှန်းတမ်းနှင့် ကျောင်းသုံးစာအုပ်ကော်မတီ
                </p>
              </div>

              {/* Point 1 */}
              <div className="flex gap-3.5 items-start">
                <span className="flex-shrink-0 w-8 h-8 rounded-lg bg-emerald-100 text-emerald-900 font-bold flex items-center justify-center text-sm border border-emerald-300">
                  ၁
                </span>
                <p className="text-sm sm:text-base leading-relaxed text-slate-800 pt-0.5">
                  အမျိုးသားပညာရေးဥပဒေပုဒ်မ ၁၆၊(က)အရ အခြေခံပညာရေးကို အဆင့်(၃)ဆင့် ခွဲခြားထားသည့်အနက်
                  အဆင့်တစ်ခုဆင့်ဖြစ်သော သူငယ်တန်းအတွက် သူငယ်တန်းပညာရေးကို သတ်မှတ်ပြဋ္ဌာန်းရန် လိုအပ်လာပါသည်။
                </p>
              </div>

              {/* Point 2 */}
              <div className="flex gap-3.5 items-start">
                <span className="flex-shrink-0 w-8 h-8 rounded-lg bg-emerald-100 text-emerald-900 font-bold flex items-center justify-center text-sm border border-emerald-300">
                  ၂
                </span>
                <p className="text-sm sm:text-base leading-relaxed text-slate-800 pt-0.5">
                  အမျိုးသားပညာရေးဥပဒေပုဒ်မ ၂၊(က)တွင် <strong className="text-emerald-900">သူငယ်တန်းပညာရေး</strong>
                  ဆိုသည်မှာ ပထမတန်းသို့ ကူးပြောင်းမှုလွယ်ကူစေရန် အသက်(၅)နှစ်ပြည့်ပြီး ကလေးများအတွက် ဘက်စုံဖွံ့ဖြိုးမှုနှင့်
                  သင့်လျော်သောနည်းလမ်းများကို အသုံးပြုပြီး ပြုစုပျိုးထောင်ပေးသည့်ပညာရေးကို ဆိုလိုသည်ဟု အဓိပ္ပာယ်ဖွင့်ဆိုခဲ့ပါသည်။
                </p>
              </div>

              {/* Point 3 (Key Highlight) */}
              <div className="flex gap-3.5 items-start bg-emerald-50 p-4 rounded-xl border border-emerald-300 shadow-2xs">
                <span className="flex-shrink-0 w-8 h-8 rounded-lg bg-emerald-600 text-white font-bold flex items-center justify-center text-sm">
                  ၃
                </span>
                <div className="text-sm sm:text-base leading-relaxed text-slate-800 space-y-2">
                  <p>
                    ထိုအဓိပ္ပာယ်ဖွင့်ဆိုချက်နှင့်အညီ သူငယ်တန်းသင်ရိုးသစ်ကို အသက်(၅)နှစ်အရွယ် ကလေးများ၏ အရွယ်၊
                    ဖွံ့ဖြိုးမှုအဆင့်နှင့် လိုက်လျောညီထွေရှိသည့် သင်ယူမှုနယ်ပယ်များ၊ သင်ယူမှု နယ်ပယ်အားလုံး လွှမ်းခြုံနိုင်သော
                    အကြောင်းအရာများ၊ <span className="font-bold text-emerald-900">ကလေးဗဟိုပြု ချဉ်းကပ်နည်းလမ်းများကို</span> အသုံးပြု၍
                    လုပ်ကိုင်ဆောင်ရွက်ပေးမည့် သင်ယူမှုပုံစံဖြင့် ရေးဆွဲထားပါသည်။
                  </p>
                  <p className="p-2.5 bg-emerald-100/70 rounded-lg border border-emerald-300 font-bold text-emerald-950 text-sm flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4 text-emerald-700 flex-shrink-0" />
                    <span>ဘာသာရပ်များ ဖြင့် သင်ကြားမည်မဟုတ်သောကြောင့် ကျောင်းသုံးစာအုပ်မရှိပါ။</span>
                  </p>
                </div>
              </div>

              {/* Point 4 */}
              <div className="flex gap-3.5 items-start">
                <span className="flex-shrink-0 w-8 h-8 rounded-lg bg-emerald-100 text-emerald-900 font-bold flex items-center justify-center text-sm border border-emerald-300">
                  ၄
                </span>
                <div className="text-sm sm:text-base leading-relaxed text-slate-800 space-y-3 w-full">
                  <p>
                    သူငယ်တန်း (Kindergarten - KG) သင်ရိုးသစ်တွင် အောက်ပါ <strong>သင်ယူဖွံ့ဖြိုးမှုနယ်ပယ် (၆) ခု</strong> ဖြင့် ဖွဲ့စည်းထားပါသည် -
                  </p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                    {MOE_DOMAINS.map((domain) => {
                      const Icon = domain.icon;
                      return (
                        <div
                          key={domain.id}
                          className="flex items-center gap-2.5 p-2.5 bg-white rounded-lg border border-slate-200 text-xs font-bold text-slate-800 shadow-2xs"
                        >
                          <div className={`w-6 h-6 rounded-md ${domain.bg} ${domain.text} flex items-center justify-center flex-shrink-0`}>
                            <Icon className="h-3.5 w-3.5" />
                          </div>
                          <span>- {domain.titleMy}</span>
                        </div>
                      );
                    })}
                  </div>
                  <p className="text-xs sm:text-sm text-slate-600 bg-white/70 p-3 rounded-lg border border-slate-200 leading-normal">
                    သင်ယူဖွံ့ဖြိုးမှုနယ်ပယ်တစ်ခုချင်းအလိုက် တစ်နှစ်တာအတွက် ကလေးများ ရရှိရမည်သင်ယူမှုရလဒ်များကိုလည်း ချမှတ်ထားပါသည်။
                    ထိုသင်ယူမှုရလဒ်များကို ရရှိစေမည့် သင်ယူမှုလုပ်ငန်းများကို ကလေးများကိုယ်တိုင် ပါဝင်လုပ်ဆောင်ရင်း သင်ယူသွားရမည်ဖြစ်ပါသည်။
                    သင်ယူဖွံ့ဖြိုးမှု နယ်ပယ်တစ်ခုစီ၏ ကဏ္ဍအလိုက် သင်ယူမှုလုပ်ငန်းများကိုလည်း နမူနာအဖြစ် ဖော်ပြထားပါသည်။
                  </p>
                </div>
              </div>

              {/* Point 5 */}
              <div className="flex gap-3.5 items-start">
                <span className="flex-shrink-0 w-8 h-8 rounded-lg bg-emerald-100 text-emerald-900 font-bold flex items-center justify-center text-sm border border-emerald-300">
                  ၅
                </span>
                <div className="text-sm sm:text-base leading-relaxed text-slate-800 space-y-2.5 w-full">
                  <p>
                    <strong>သူငယ်တန်း သင်ရိုးညွှန်းတမ်း၏ ရည်ရွယ်ချက်များမှာ -</strong>
                  </p>
                  <div className="space-y-2">
                    {MOE_AIMS.map((aim) => (
                      <div
                        key={aim.num}
                        className="flex items-start gap-2.5 p-2.5 bg-white rounded-lg border border-slate-200 text-xs sm:text-sm shadow-2xs"
                      >
                        <span className="text-emerald-700 font-bold text-sm">•</span>
                        <div>
                          <p className="font-semibold text-slate-900">{aim.text}</p>
                          <p className="text-[11px] text-slate-500">{aim.en}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Point 6 */}
              <div className="flex gap-3.5 items-start">
                <span className="flex-shrink-0 w-8 h-8 rounded-lg bg-emerald-100 text-emerald-900 font-bold flex items-center justify-center text-sm border border-emerald-300">
                  ၆
                </span>
                <p className="text-sm sm:text-base leading-relaxed text-slate-800 pt-0.5">
                  ထို့ကြောင့် ဆရာများအနေဖြင့် သူငယ်တန်းသင်ရိုးညွှန်းတမ်းကို အကောင်အထည်ဖော်ဆောင်ရန်အတွက်
                  ဤစာအုပ်ကို ကျေညက်စွာ လေ့လာထားရန် လိုပါသည်။ အကယ်၍ သင်ယူမှုလုပ်ငန်းများတွင် အခက်အခဲရှိပါက
                  ဆရာအချင်းချင်း ညှိနှိုင်းဆောင်ရွက်ရန် လေးနက်စွာ အကြံပြုလိုပါသည်။
                </p>
              </div>

              {/* Sign-off footer */}
              <div className="text-right pt-6 border-t border-amber-300/80">
                <p className="font-bold text-slate-900 text-sm">
                  အခြေခံပညာသင်ရိုးညွှန်းတမ်းနှင့် ကျောင်းသုံးစာအုပ်ကော်မတီ
                </p>
                <p className="text-xs text-slate-500">ပညာရေးဝန်ကြီးဌာန</p>
              </div>
            </div>
          )}

          {activeTab === 'domains' && (
            <div className="space-y-6">
              <div className="bg-teal-50 border border-teal-200 rounded-xl p-4 flex items-start gap-3">
                <Info className="h-5 w-5 text-teal-700 flex-shrink-0 mt-0.5" />
                <div className="text-xs sm:text-sm text-teal-900 leading-relaxed">
                  <strong>သူငယ်တန်း သင်ယူဖွံ့ဖြိုးမှုနယ်ပယ် (၆) ရပ် စနစ်:</strong> မြန်မာနိုင်ငံ ပညာရေးဝန်ကြီးဌာန သူငယ်တန်းသင်ရိုးတွင်
                  ရိုးရာဘာသာရပ်ခွဲများ (စာမေးပွဲ ရမှတ်များ) မရှိဘဲ ကလေးများ၏ အသက်(၅)နှစ်အရွယ် ဘက်စုံဖွံ့ဖြိုးမှုကို
                  အောက်ပါနယ်ပယ် ၆ ခုဖြင့် စောင့်ကြည့်လေ့လာ အကဲဖြတ်ပါသည် -
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {MOE_DOMAINS.map((domain) => {
                  const Icon = domain.icon;
                  return (
                    <div
                      key={domain.id}
                      className={`p-5 rounded-2xl border ${domain.border} ${domain.bg} space-y-3 shadow-xs hover:shadow-md transition`}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2.5">
                          <div className="w-8 h-8 rounded-xl bg-white shadow-xs flex items-center justify-center text-slate-900">
                            <Icon className={`h-4 w-4 ${domain.text}`} />
                          </div>
                          <div>
                            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                              နယ်ပယ် ({domain.number})
                            </span>
                            <h3 className="font-bold text-slate-900 text-sm sm:text-base leading-snug">
                              {domain.titleMy}
                            </h3>
                          </div>
                        </div>
                      </div>

                      <p className="text-xs text-slate-500 italic">{domain.titleEn}</p>
                      <p className="text-xs sm:text-sm text-slate-700 leading-relaxed">{domain.desc}</p>

                      <div className="bg-white/80 rounded-xl p-3 border border-slate-200/60 space-y-1.5">
                        <span className="text-[11px] font-bold text-slate-800 uppercase tracking-wide block">
                          နမူနာ သင်ယူမှုလုပ်ငန်းများ (Sample Activities):
                        </span>
                        <ul className="text-xs text-slate-600 space-y-1">
                          {domain.activities.map((act, idx) => (
                            <li key={idx} className="flex items-start gap-1.5">
                              <span className="text-emerald-600 font-bold">•</span>
                              <span>{act}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {activeTab === 'aims' && (
            <div className="space-y-6 max-w-3xl mx-auto">
              <div className="text-center space-y-1">
                <span className="text-xs font-bold text-emerald-700 uppercase tracking-wider">
                  သူငယ်တန်း သင်ရိုးသစ်၏ ဦးတည်ချက်
                </span>
                <h3 className="text-xl font-bold text-slate-900">
                  သင်ရိုးညွှန်းတမ်း ရည်ရွယ်ချက် (၄) ရပ်
                </h3>
                <p className="text-xs sm:text-sm text-slate-500">
                  အသက် (၅) နှစ်ပြည့်ပြီး ကလေးများအား ပထမတန်းသို့ ချောမွေ့စွာ ကူးပြောင်းနိုင်ရန် ပြုစုပျိုးထောင်ခြင်း
                </p>
              </div>

              <div className="grid grid-cols-1 gap-3.5">
                {MOE_AIMS.map((aim, idx) => (
                  <div
                    key={aim.num}
                    className="flex items-start gap-4 p-4 rounded-xl border border-slate-200 bg-white hover:border-emerald-300 hover:shadow-sm transition"
                  >
                    <div className="w-10 h-10 rounded-xl bg-emerald-600 text-white font-extrabold flex items-center justify-center text-base flex-shrink-0 shadow-xs">
                      {aim.num}
                    </div>
                    <div className="space-y-1 flex-1">
                      <h4 className="text-base font-bold text-slate-900 leading-snug">
                        {aim.text}
                      </h4>
                      <p className="text-xs text-slate-500">{aim.en}</p>
                    </div>
                  </div>
                ))}
              </div>

              {/* Implementation Note */}
              <div className="p-4 rounded-xl bg-amber-50 border border-amber-200 text-xs sm:text-sm text-amber-900 space-y-2">
                <span className="font-bold flex items-center gap-1.5">
                  <ShieldCheck className="h-4 w-4 text-amber-700" />
                  <span>ဆရာဆရာမများ လက်တွေ့အကောင်အထည်ဖော်ရာတွင် အဓိက သတိပြုရန်:</span>
                </span>
                <ul className="list-disc list-inside space-y-1 text-slate-700 text-xs">
                  <li>ကလေးများကို ဖိအားပေး အတင်းအကျပ် အလွတ်ကျက်မှတ်ခိုင်းခြင်း မပြုလုပ်ရပါ။</li>
                  <li>ကစားရင်းသင်ယူခြင်း (Play-based Learning) နည်းလမ်းကို အသုံးပြုရပါမည်။</li>
                  <li>ရမှတ်အဆင့် (Ranking / Marks) သတ်မှတ်ခြင်းမရှိဘဲ တစ်ဦးချင်း၏ တိုးတက်မှုကို အပြုသဘော အားပေးရပါမည်။</li>
                </ul>
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="bg-slate-50 border-t border-slate-200 px-6 py-3.5 flex items-center justify-between flex-shrink-0 print:hidden">
          <div className="flex items-center gap-2 text-xs text-slate-500">
            <ShieldCheck className="h-4 w-4 text-emerald-600" />
            <span>MOE Kindergarten National Curriculum Framework • Compliance Verified</span>
          </div>

          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-900 text-white text-xs font-bold transition shadow-xs"
          >
            နားလည်ပါပြီ (Close)
          </button>
        </div>
      </div>
    </div>
  );
};
