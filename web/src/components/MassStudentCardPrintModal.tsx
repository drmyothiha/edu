import React, { useState, useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import {
  Printer,
  X,
  CheckSquare,
  Square,
  FileText,
  CreditCard,
  Sparkles,
  Scissors,
  Layers,
  Search,
  Check,
  ChevronDown,
  Info,
  Palette,
  Sun,
  Moon,
  ExternalLink,
} from 'lucide-react';
import { SchoolDTO, ClassDTO, SchoolStudentDTO, GateStudentDTO } from '../types';
import { api } from '../api/client';
import { QRCodeImage } from './QRCodeImage';
import { getSchoolBurmese, getTownshipBurmese } from '../utils/mimuTranslations';

export type PrintMode = 'pvc_single' | 'a4_8_cards' | 'a4_10_cards';
export type CardTheme = 'dark_holographic' | 'eco_ink_saver';

interface MassStudentCardPrintModalProps {
  isOpen: boolean;
  onClose: () => void;
  students: SchoolStudentDTO[];
  classes: ClassDTO[];
  school: SchoolDTO | null;
  initialClassId?: string;
  initialGrade?: string;
}

export const MassStudentCardPrintModal: React.FC<MassStudentCardPrintModalProps> = ({
  isOpen,
  onClose,
  students,
  classes,
  school,
  initialClassId,
  initialGrade,
}) => {
  // 1. Controls State
  const [selectedClassId, setSelectedClassId] = useState<string>(initialClassId || 'ALL');
  const [selectedGrade, setSelectedGrade] = useState<string>(initialGrade || 'ALL');
  const [selectedStudentIds, setSelectedStudentIds] = useState<Set<string>>(new Set());
  const [printMode, setPrintMode] = useState<PrintMode>('a4_8_cards');
  const [cardTheme, setCardTheme] = useState<CardTheme>('dark_holographic');
  const [searchQuery, setSearchQuery] = useState('');

  // 2. Gate Roster State (for pre-computed canonical DIDs)
  const [gateStudentsMap, setGateStudentsMap] = useState<Map<string, GateStudentDTO>>(new Map());
  const [loadingRoster, setLoadingRoster] = useState(false);

  // Fetch gate roster to get canonical DIDs
  useEffect(() => {
    if (!isOpen) return;

    let isMounted = true;
    setLoadingRoster(true);
    api.gate
      .getRoster(school?.id)
      .then((res) => {
        if (!isMounted) return;
        const map = new Map<string, GateStudentDTO>();
        if (res && res.students) {
          for (const s of res.students) {
            map.set(s.id, s);
          }
        }
        setGateStudentsMap(map);
      })
      .catch((err) => {
        console.warn('Failed to load pre-computed DIDs from gate roster:', err);
      })
      .finally(() => {
        if (isMounted) setLoadingRoster(false);
      });

    return () => {
      isMounted = false;
    };
  }, [isOpen, school?.id]);

  // Sync initial class / grade selection
  useEffect(() => {
    if (initialClassId) {
      setSelectedClassId(initialClassId);
      setSelectedGrade('ALL');
    } else if (initialGrade) {
      setSelectedGrade(initialGrade);
      setSelectedClassId('ALL');
    } else {
      setSelectedClassId('ALL');
      setSelectedGrade('ALL');
    }
  }, [initialClassId, initialGrade, isOpen]);

  // Distinct grades from students roster
  const distinctGrades = useMemo(() => {
    const list: string[] = [];
    const set = new Set<string>();
    const standardOrder = ['KG', 'Grade 1', 'Grade 2', 'Grade 3', 'Grade 4', 'Grade 5', 'Grade 6', 'Grade 7', 'Grade 8', 'Grade 9', 'Grade 10', 'Grade 11', 'Grade 12'];
    for (const g of standardOrder) {
      if (students.some((s) => s.grade_level === g)) {
        list.push(g);
        set.add(g);
      }
    }
    for (const s of students) {
      if (s.grade_level && !set.has(s.grade_level)) {
        list.push(s.grade_level);
        set.add(s.grade_level);
      }
    }
    return list;
  }, [students]);

  // 3. Filter Students according to Class / Grade / Search
  const eligibleStudents = useMemo(() => {
    return students.filter((st) => {
      // Class filter
      if (selectedClassId !== 'ALL' && st.class_id !== selectedClassId) {
        return false;
      }
      // Grade filter (if selected and class is ALL)
      if (selectedClassId === 'ALL' && selectedGrade !== 'ALL' && st.grade_level !== selectedGrade) {
        return false;
      }
      // Search query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchesName = st.full_name.toLowerCase().includes(q);
        const matchesEmail = st.email.toLowerCase().includes(q);
        const matchesClass = (st.class_name || '').toLowerCase().includes(q);
        return matchesName || matchesEmail || matchesClass;
      }
      return true;
    });
  }, [students, selectedClassId, selectedGrade, searchQuery]);

  // Initialize all eligible students as selected on filter or student changes
  useEffect(() => {
    if (isOpen && eligibleStudents.length > 0) {
      setSelectedStudentIds(new Set(eligibleStudents.map((s) => s.id)));
    } else if (eligibleStudents.length === 0) {
      setSelectedStudentIds(new Set());
    }
  }, [isOpen, selectedClassId, selectedGrade, students]);

  // Toggle single student
  const toggleStudent = (id: string) => {
    setSelectedStudentIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  // Select all / Deselect all
  const toggleSelectAll = () => {
    if (selectedStudentIds.size === eligibleStudents.length) {
      setSelectedStudentIds(new Set());
    } else {
      setSelectedStudentIds(new Set(eligibleStudents.map((s) => s.id)));
    }
  };

  // Filtered array of students ready to print
  const studentsToPrint = useMemo(() => {
    return eligibleStudents.filter((s) => selectedStudentIds.has(s.id));
  }, [eligibleStudents, selectedStudentIds]);

  // Page calculations for A4
  const cardsPerPage = printMode === 'a4_10_cards' ? 10 : printMode === 'a4_8_cards' ? 8 : 1;
  const totalSheets = Math.ceil(studentsToPrint.length / cardsPerPage) || 1;

  // Chunk students into pages for A4 layout
  const pagesChunks = useMemo(() => {
    if (printMode === 'pvc_single') {
      return studentsToPrint.map((s) => [s]);
    }
    const chunks: SchoolStudentDTO[][] = [];
    for (let i = 0; i < studentsToPrint.length; i += cardsPerPage) {
      chunks.push(studentsToPrint.slice(i, i + cardsPerPage));
    }
    return chunks;
  }, [studentsToPrint, printMode, cardsPerPage]);

  // Print Action via Native Dialog
  const handlePrint = () => {
    setTimeout(() => {
      window.print();
    }, 50);
  };

  // Fallback: Open Standalone Clean Print Tab
  const handleOpenPrintWindow = () => {
    const portal = document.getElementById('mass-print-portal-root');
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
  <title>Student Cards Mass Print - ${displaySchool}</title>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Noto+Sans+Myanmar:wght@400;500;600;700&display=swap" rel="stylesheet">
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
    #mass-print-portal-root {
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
      .a4-print-sheet {
        background: white;
        box-shadow: 0 10px 15px -3px rgb(0 0 0 / 0.1);
        margin: 0 auto 30px auto;
        border-radius: 12px;
        padding: 16px;
      }
      .pvc-card-item {
        background: white;
        box-shadow: 0 4px 6px -1px rgb(0 0 0 / 0.1);
        margin: 0 auto 20px auto;
        border-radius: 12px;
        display: inline-block;
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
      📄 ${displaySchool} — ကျောင်းသား စမတ်ကတ် (${studentsToPrint.length} ဦး)
    </div>
    <button class="print-btn" onclick="window.print()">
      🖨️ ပရင့်ထုတ်မည် (Print Now)
    </button>
  </div>
  <div id="mass-print-portal-root">
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

  // School Burmese Information
  const schoolBurmese = getSchoolBurmese(school?.name, school?.name_my);
  const displaySchool = schoolBurmese.includes('အင်းတိုင်') ? 'အထက အင်းတိုင်' : schoolBurmese || 'အခြေခံပညာကျောင်း';
  const townshipBurmese = getTownshipBurmese(school?.township_name) || 'လှည်းကူးမြို့နယ်';

  return (
    <>
      {/* ========================================================================= */}
      {/* MODAL DIALOG CONTAINER (HIDDEN DURING PRINT)                              */}
      {/* ========================================================================= */}
      <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-950/80 backdrop-blur-sm flex flex-col items-center justify-start p-3 sm:p-6 print:hidden">
        <div className="bg-white rounded-3xl border border-slate-200 shadow-2xl max-w-6xl w-full h-[94vh] flex flex-col overflow-hidden animate-in zoom-in-95 duration-200 print:hidden">
        {/* Modal Header */}
        <div className="px-6 py-3.5 bg-slate-900 text-white flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-indigo-600/30 border border-indigo-400/40 text-amber-400">
              <Printer className="h-5 w-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-black tracking-tight">
                  ကျောင်းသား စမတ်ကတ် အစုလိုက် ထုတ်ယူခြင်း
                </h2>
                <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded bg-indigo-500/30 text-indigo-300 border border-indigo-400/30 font-mono">
                  Mass Card Printing
                </span>
              </div>
              <p className="text-[11px] text-slate-400">
                {displaySchool} • {school?.code || 'BEHS'} • Print directly to PVC Smart Cards or A4 Photo Paper
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition"
            title="Close modal"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Toolbar: Filters & Print Mode Selection */}
        <div className="p-4 bg-slate-50 border-b border-slate-200 space-y-3 shrink-0">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {/* 1. Class / Section Selector */}
            <div>
              <label className="block text-[11px] font-bold text-slate-700 mb-1">
                ၁။ အတန်း ရွေးချယ်ရန် (Select Class / Grade)
              </label>
              <select
                value={
                  selectedClassId !== 'ALL'
                    ? `class:${selectedClassId}`
                    : selectedGrade !== 'ALL'
                    ? `grade:${selectedGrade}`
                    : 'ALL'
                }
                onChange={(e) => {
                  const val = e.target.value;
                  if (val === 'ALL') {
                    setSelectedClassId('ALL');
                    setSelectedGrade('ALL');
                  } else if (val.startsWith('grade:')) {
                    setSelectedGrade(val.replace('grade:', ''));
                    setSelectedClassId('ALL');
                  } else if (val.startsWith('class:')) {
                    setSelectedClassId(val.replace('class:', ''));
                    setSelectedGrade('ALL');
                  }
                }}
                className="w-full text-xs font-semibold px-3 py-1.5 rounded-xl bg-white border border-slate-300 text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500 shadow-xs"
              >
                <option value="ALL">အတန်းအားလုံး (All Students - {students.length} ဦး)</option>
                {distinctGrades.length > 0 && (
                  <optgroup label="─── အတန်းအဆင့်အလိုက် (By Grade Level) ───">
                    {distinctGrades.map((g) => {
                      const count = students.filter((s) => s.grade_level === g).length;
                      return (
                        <option key={g} value={`grade:${g}`}>
                          {g} အဆင့်အားလုံး ({count} ဦး)
                        </option>
                      );
                    })}
                  </optgroup>
                )}
                {classes.length > 0 && (
                  <optgroup label="─── အတန်းခွဲအလိုက် (By Class / Section) ───">
                    {classes.map((cls) => {
                      const count = students.filter((s) => s.class_id === cls.id).length;
                      return (
                        <option key={cls.id} value={`class:${cls.id}`}>
                          {cls.name} ({cls.grade_level}) - {count} ဦး
                        </option>
                      );
                    })}
                  </optgroup>
                )}
              </select>
            </div>

            {/* 2. Printing Output Mode */}
            <div>
              <label className="block text-[11px] font-bold text-slate-700 mb-1">
                ၂။ ပရင့်အမျိုးအစား (Paper / Hardware Mode)
              </label>
              <select
                value={printMode}
                onChange={(e) => setPrintMode(e.target.value as PrintMode)}
                className="w-full text-xs font-semibold px-3 py-1.5 rounded-xl bg-white border border-slate-300 text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500 shadow-xs font-sans"
              >
                <option value="a4_8_cards">
                  📄 A4 Photo Paper (တစ်မျက်နှာ ၈ ကတ် • Standard 2x4 with Cut Guides)
                </option>
                <option value="a4_10_cards">
                  📄 A4 Photo Paper (တစ်မျက်နှာ ၁၀ ကတ် • High Density 2x5 Economy)
                </option>
                <option value="pvc_single">
                  🖨️ PVC Card Printer (CR80 တစ်ကတ်ချင်း • Evolis/Zebra 1-Card/Page)
                </option>
              </select>
            </div>

            {/* 3. Card Visual Style / Theme */}
            <div>
              <label className="block text-[11px] font-bold text-slate-700 mb-1">
                ၃။ ကတ်ဒီဇိုင်းပုံစံ (Card Visual Style)
              </label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setCardTheme('dark_holographic')}
                  className={`px-2.5 py-1.5 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 border transition ${
                    cardTheme === 'dark_holographic'
                      ? 'bg-slate-900 text-white border-slate-900 shadow-sm'
                      : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-100'
                  }`}
                >
                  <Moon className="h-3.5 w-3.5 text-indigo-400" />
                  <span>Dark Hologram</span>
                </button>
                <button
                  type="button"
                  onClick={() => setCardTheme('eco_ink_saver')}
                  className={`px-2.5 py-1.5 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 border transition ${
                    cardTheme === 'eco_ink_saver'
                      ? 'bg-emerald-700 text-white border-emerald-700 shadow-sm'
                      : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-100'
                  }`}
                  title="White background to save ink on desktop printers"
                >
                  <Sun className="h-3.5 w-3.5 text-amber-400" />
                  <span>Eco Ink-Saver</span>
                </button>
              </div>
            </div>
          </div>

          {/* Quick Selection & Summary Banner */}
          <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-slate-200/80">
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={toggleSelectAll}
                className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg bg-white border border-slate-300 hover:bg-slate-100 text-xs font-bold text-slate-700 shadow-2xs transition"
              >
                {selectedStudentIds.size === eligibleStudents.length ? (
                  <>
                    <CheckSquare className="h-3.5 w-3.5 text-indigo-600" />
                    <span>Deselect All</span>
                  </>
                ) : (
                  <>
                    <Square className="h-3.5 w-3.5 text-slate-400" />
                    <span>Select All</span>
                  </>
                )}
              </button>

              <span className="text-xs font-semibold text-slate-600">
                ရွေးချယ်ထားသော ကျောင်းသား:{' '}
                <strong className="text-indigo-600 font-bold">{studentsToPrint.length}</strong> / {eligibleStudents.length} ဦး
              </span>

              {printMode !== 'pvc_single' && (
                <span className="text-xs px-2.5 py-0.5 rounded-full bg-amber-50 text-amber-800 border border-amber-200 font-bold">
                  A4 စာရွက်ခန့်မှန်း: {totalSheets} ရွက် ({cardsPerPage} ကတ်/ရွက်)
                </span>
              )}
            </div>

            {/* Search Input within Selection */}
            <div className="relative w-52">
              <Search className="h-3.5 w-3.5 text-slate-400 absolute left-2.5 top-2" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="ကျောင်းသားအမည် ရှာရန်..."
                className="w-full pl-8 pr-3 py-1 text-xs bg-white border border-slate-300 rounded-lg text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
          </div>
        </div>

        {/* Student Checklist Selector (Compact Grid) */}
        <div className="max-h-24 overflow-y-auto p-2.5 bg-slate-100/70 border-b border-slate-200 scrollbar-thin shrink-0">
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-1.5">
            {eligibleStudents.map((st) => {
              const isChecked = selectedStudentIds.has(st.id);
              return (
                <button
                  key={st.id}
                  type="button"
                  onClick={() => toggleStudent(st.id)}
                  className={`px-2 py-1 rounded-lg border text-left flex items-center gap-1.5 transition ${
                    isChecked
                      ? 'bg-indigo-50/90 border-indigo-300 text-indigo-900 font-bold shadow-2xs'
                      : 'bg-white border-slate-200 text-slate-500 hover:border-slate-300'
                  }`}
                >
                  <div
                    className={`w-3.5 h-3.5 rounded flex items-center justify-center flex-shrink-0 text-white ${
                      isChecked ? 'bg-indigo-600' : 'border border-slate-300 bg-white'
                    }`}
                  >
                    {isChecked && <Check className="h-3 w-3 stroke-[3]" />}
                  </div>
                  <div className="truncate text-[11px]">
                    <span className="truncate block font-semibold">{st.full_name}</span>
                    <span className="text-[9px] text-slate-400 font-normal block truncate">
                      {st.class_name || st.grade_level || 'Student'}
                    </span>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Scrollable Live Sheet Preview Area */}
        <div className="flex-1 overflow-y-auto p-6 bg-slate-900/10 space-y-8">
          <div className="text-center">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider font-mono">
              Live Sheet Print Preview ({totalSheets} Page{totalSheets > 1 ? 's' : ''})
            </span>
          </div>

          {pagesChunks.map((sheetStudents, pageIndex) => (
            <div key={`screen-sheet-${pageIndex}`} className="flex flex-col items-center">
              <div className="w-full max-w-[210mm] flex items-center justify-between text-xs font-bold text-slate-500 mb-2 px-2">
                <span className="flex items-center gap-1.5 text-slate-700">
                  <FileText className="h-3.5 w-3.5 text-indigo-600" />
                  <span>
                    စာရွက် {pageIndex + 1} / {pagesChunks.length} (Sheet {pageIndex + 1} of {pagesChunks.length})
                  </span>
                </span>
                <span className="font-mono text-[11px] text-slate-500">
                  {sheetStudents.length} Cards on this sheet
                </span>
              </div>

              <div
                className={
                  printMode === 'pvc_single'
                    ? 'flex flex-col items-center'
                    : 'bg-white rounded-2xl shadow-xl p-6 border border-slate-300 grid grid-cols-1 sm:grid-cols-2 gap-4'
                }
              >
                {sheetStudents.map((st) => {
                  const gateInfo = gateStudentsMap.get(st.id);
                  const seqVal = parseInt(st.id.replace(/-/g, '').slice(-4), 16) || 1;
                  const did =
                    gateInfo?.did ||
                    `did:edu:mm:013:${school?.code || 'MMR013035-BEHS01'}-2026-STU${String(seqVal).padStart(4, '0')}`;

                  return (
                    <div key={st.id} className="relative">
                      <SinglePrintCardItem
                        student={st}
                        gateInfo={gateInfo}
                        schoolName={displaySchool}
                        townshipName={townshipBurmese}
                        did={did}
                        theme={cardTheme}
                        showCutGuides={printMode !== 'pvc_single'}
                      />
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>

        {/* Fixed Footer with Print Now */}
        <div className="p-4 bg-white flex flex-col sm:flex-row items-center justify-between gap-3 border-t border-slate-200 shrink-0">
          <div className="flex items-center gap-2 text-xs text-slate-500">
            <Info className="h-4 w-4 text-indigo-500 flex-shrink-0" />
            <span>
              {printMode === 'pvc_single'
                ? 'CR80 standard direct card printer format (85.6mm x 53.98mm per card).'
                : `A4 Photo Paper sheet format with scissor cut guides (85.6mm x 53.98mm per card, ${cardsPerPage} cards per page).`}
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
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold border border-slate-300 transition disabled:opacity-50"
              title="သီးသန့် စာမျက်နှာတွင် ဖွင့်၍ ပရင့်ထုတ်ရန် (Open Standalone Print Tab)"
            >
              <ExternalLink className="h-3.5 w-3.5 text-slate-500" />
              <span>သီးသန့် ဖွင့်ရန်</span>
            </button>
            <button
              type="button"
              onClick={handlePrint}
              disabled={studentsToPrint.length === 0}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-black shadow-lg shadow-indigo-600/30 transition disabled:opacity-50"
            >
              <Printer className="h-4 w-4 text-amber-300" />
              <span>
                {studentsToPrint.length} ကတ် ပရင့်ထုတ်မည် (Print Now)
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
          <div id="mass-print-portal-root">
            <style>{`
              @media screen {
                #mass-print-portal-root {
                  display: none !important;
                }
              }

              @media print {
                /* Hide the entire web application root so screen elements never interfere */
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

                #mass-print-portal-root {
                  display: block !important;
                  position: static !important;
                  width: 100% !important;
                  margin: 0 !important;
                  padding: 0 !important;
                  background: #ffffff !important;
                  visibility: visible !important;
                }

                #mass-print-portal-root * {
                  visibility: visible !important;
                  -webkit-print-color-adjust: exact !important;
                  print-color-adjust: exact !important;
                }

                /* Mode 1: PVC Direct Card Printer (CR80) */
                ${
                  printMode === 'pvc_single'
                    ? `
                  @page {
                    size: 85.6mm 53.98mm;
                    margin: 0mm;
                  }
                  .pvc-card-item {
                    width: 85.6mm !important;
                    height: 53.98mm !important;
                    margin: 0 auto !important;
                    page-break-after: always !important;
                    break-after: page !important;
                    page-break-inside: avoid !important;
                    break-inside: avoid !important;
                    -webkit-print-color-adjust: exact !important;
                    print-color-adjust: exact !important;
                  }
                `
                    : ''
                }

                /* Mode 2: A4 Photo Paper (8 Cards / Sheet - 2x4) */
                ${
                  printMode === 'a4_8_cards'
                    ? `
                  @page {
                    size: A4 portrait;
                    margin: 8mm 6mm;
                  }
                  .a4-print-sheet {
                    width: 198mm !important;
                    height: 278mm !important;
                    margin: 0 auto !important;
                    padding-top: 4mm !important;
                    page-break-after: always !important;
                    break-after: page !important;
                    page-break-inside: avoid !important;
                    break-inside: avoid !important;
                    display: grid !important;
                    grid-template-columns: repeat(2, 85.6mm) !important;
                    grid-auto-rows: 53.98mm !important;
                    gap: 5mm !important;
                    justify-content: center !important;
                    align-content: start !important;
                    -webkit-print-color-adjust: exact !important;
                    print-color-adjust: exact !important;
                  }
                  .sheet-card-item {
                    width: 85.6mm !important;
                    height: 53.98mm !important;
                    box-sizing: border-box !important;
                    page-break-inside: avoid !important;
                    break-inside: avoid !important;
                    -webkit-print-color-adjust: exact !important;
                    print-color-adjust: exact !important;
                  }
                `
                    : ''
                }

                /* Mode 3: A4 High-Density (10 Cards / Sheet - 2x5) */
                ${
                  printMode === 'a4_10_cards'
                    ? `
                  @page {
                    size: A4 portrait;
                    margin: 6mm 4mm;
                  }
                  .a4-print-sheet {
                    width: 200mm !important;
                    height: 284mm !important;
                    margin: 0 auto !important;
                    padding-top: 2mm !important;
                    page-break-after: always !important;
                    break-after: page !important;
                    page-break-inside: avoid !important;
                    break-inside: avoid !important;
                    display: grid !important;
                    grid-template-columns: repeat(2, 85.6mm) !important;
                    grid-auto-rows: 53.98mm !important;
                    gap: 2.5mm !important;
                    justify-content: center !important;
                    align-content: start !important;
                    -webkit-print-color-adjust: exact !important;
                    print-color-adjust: exact !important;
                  }
                  .sheet-card-item {
                    width: 85.6mm !important;
                    height: 53.98mm !important;
                    box-sizing: border-box !important;
                    page-break-inside: avoid !important;
                    break-inside: avoid !important;
                    -webkit-print-color-adjust: exact !important;
                    print-color-adjust: exact !important;
                  }
                `
                    : ''
                }
              }
            `}</style>

            {pagesChunks.map((sheetStudents, pageIndex) => (
              <div
                key={`portal-sheet-${pageIndex}`}
                className={printMode === 'pvc_single' ? '' : 'a4-print-sheet'}
              >
                {sheetStudents.map((st) => {
                  const gateInfo = gateStudentsMap.get(st.id);
                  const seqVal = parseInt(st.id.replace(/-/g, '').slice(-4), 16) || 1;
                  const did =
                    gateInfo?.did ||
                    `did:edu:mm:013:${school?.code || 'MMR013035-BEHS01'}-2026-STU${String(seqVal).padStart(4, '0')}`;

                  return (
                    <div
                      key={`portal-card-${st.id}`}
                      className={printMode === 'pvc_single' ? 'pvc-card-item' : 'sheet-card-item relative'}
                    >
                      <SinglePrintCardItem
                        student={st}
                        gateInfo={gateInfo}
                        schoolName={displaySchool}
                        townshipName={townshipBurmese}
                        did={did}
                        theme={cardTheme}
                        showCutGuides={printMode !== 'pvc_single'}
                      />
                    </div>
                  );
                })}
              </div>
            ))}
          </div>,
          document.body
        )}
    </>
  );
};

// =========================================================================
// SINGLE PRINT CARD ITEM COMPONENT (Exact CR80: 85.6mm x 53.98mm Proportions)
// =========================================================================

interface SinglePrintCardItemProps {
  student: SchoolStudentDTO;
  gateInfo?: GateStudentDTO;
  schoolName: string;
  townshipName: string;
  did: string;
  theme: CardTheme;
  showCutGuides: boolean;
}

const SinglePrintCardItem: React.FC<SinglePrintCardItemProps> = ({
  student,
  gateInfo,
  schoolName,
  townshipName,
  did,
  theme,
  showCutGuides,
}) => {
  // Extract trailing DID token: e.g. STU0042
  const parts = did.split('-');
  const lastPart = parts.length > 1 ? parts[parts.length - 1] : did.slice(-7);
  const qrSubLabel = `did:edu:mm:...-${lastPart}`;

  // Verification URL
  const verifyUrl =
    typeof window !== 'undefined'
      ? `${window.location.origin}/edu/verify?did=${encodeURIComponent(did)}`
      : `/edu/verify?did=${encodeURIComponent(did)}`;

  // Grade formatting
  const classNameStr = student.class_name || student.grade_level || 'Grade 5-A';
  let category = 'မူလတန်း';
  const lower = classNameStr.toLowerCase();
  if (lower.includes('kg') || lower.includes('kindergarten')) {
    category = 'သူငယ်တန်း';
  } else if (
    lower.includes('grade 6') ||
    lower.includes('grade 7') ||
    lower.includes('grade 8') ||
    lower.includes('grade 9') ||
    lower.includes('middle')
  ) {
    category = 'အလယ်တန်း';
  } else if (
    lower.includes('grade 10') ||
    lower.includes('grade 11') ||
    lower.includes('grade 12') ||
    lower.includes('high')
  ) {
    category = 'အထက်တန်း';
  }
  const gradeDisplay = `${classNameStr} (${category}) • 2026-2027 ပညာသင်နှစ်`;

  const isDark = theme === 'dark_holographic';

  return (
    <div className="relative group select-none">
      {/* Scissor Cut Line Guides (A4 Sheet Mode) */}
      {showCutGuides && (
        <div className="absolute -top-1.5 -left-1.5 -right-1.5 -bottom-1.5 pointer-events-none border border-dashed border-slate-300 print:border-slate-400 rounded-lg">
          <div className="absolute -top-2 left-2 text-[8px] text-slate-400 flex items-center gap-0.5 print:text-slate-500 font-mono">
            <Scissors className="h-2.5 w-2.5" />
            <span>CUT</span>
          </div>
        </div>
      )}

      {/* Actual CR80 Card Box: 85.6mm x 53.98mm */}
      <div
        style={{
          width: '85.6mm',
          height: '53.98mm',
          boxSizing: 'border-box',
          WebkitPrintColorAdjust: 'exact',
          printColorAdjust: 'exact',
        }}
        className={`p-3.5 rounded-2xl flex flex-col justify-between relative overflow-hidden shadow-md print:shadow-none ${
          isDark
            ? 'bg-gradient-to-br from-slate-950 via-indigo-950 to-slate-900 text-white border border-indigo-400/30'
            : 'bg-white text-slate-900 border-2 border-slate-800'
        }`}
      >
        {/* Hologram Accent for Dark Theme */}
        {isDark && (
          <>
            <div className="absolute -top-10 -right-10 w-28 h-28 bg-indigo-500/15 rounded-full blur-xl pointer-events-none" />
            <div className="absolute -bottom-10 -left-10 w-28 h-28 bg-indigo-600/10 rounded-full blur-xl pointer-events-none" />
          </>
        )}

        {/* ---------------- CARD HEADER ---------------- */}
        <div className="relative z-10 flex items-start justify-between gap-1.5">
          <div className="flex items-center gap-2">
            {/* Student Photo / Avatar */}
            <div
              className={`relative w-8 h-10 rounded overflow-hidden flex-shrink-0 flex items-center justify-center border ${
                isDark ? 'border-indigo-300/40 bg-slate-800' : 'border-slate-400 bg-slate-100'
              }`}
            >
              {gateInfo?.photo_url ? (
                <img src={gateInfo.photo_url} alt={student.full_name} className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full bg-gradient-to-b from-indigo-800 to-slate-900 flex flex-col items-center justify-center p-0.5 text-center">
                  <div className="w-3.5 h-3.5 rounded-full bg-amber-400/90 border border-amber-300/50 mb-0.5" />
                  <div className="w-5 h-2.5 rounded-t bg-emerald-600 border border-emerald-400/60" />
                </div>
              )}
              <div className="absolute bottom-0 inset-x-0 bg-slate-950/80 text-[5px] font-bold text-center text-slate-300 uppercase leading-none py-0.2">
                STU
              </div>
            </div>

            {/* School & Township */}
            <div>
              <div className={`text-xs font-black tracking-tight ${isDark ? 'text-white' : 'text-slate-900'}`}>
                {schoolName}
              </div>
              <div className={`text-[9px] font-sans tracking-tight mt-0.2 ${isDark ? 'text-indigo-200' : 'text-slate-600'}`}>
                {townshipName}
              </div>
            </div>
          </div>

          {/* Right: [((o)) NFC] Wave Indicator */}
          <div
            className={`flex items-center gap-1 flex-shrink-0 px-1.5 py-0.5 rounded border ${
              isDark
                ? 'bg-indigo-950/70 border-indigo-400/30 text-emerald-300'
                : 'bg-slate-100 border-slate-300 text-slate-800'
            }`}
          >
            <span className="text-[8px] font-black tracking-wider font-mono">
              ((o)) NFC
            </span>
            <div className="w-3.5 h-2.5 rounded-xs bg-gradient-to-br from-amber-200 via-amber-400 to-amber-600 border border-amber-400/80 flex items-center justify-center p-0.2">
              <div className="w-full h-full border border-amber-800/40 rounded-2xs" />
            </div>
          </div>
        </div>

        {/* ---------------- CARD BODY ---------------- */}
        <div className="relative z-10 grid grid-cols-3 gap-1.5 items-center my-auto">
          <div className="col-span-2 space-y-0.5">
            <span className={`text-[9px] font-bold font-sans ${isDark ? 'text-amber-300' : 'text-amber-700'}`}>
              ကျောင်းသားကဒ်
            </span>
            <h3
              className={`text-sm font-black tracking-tight leading-tight uppercase truncate ${
                isDark ? 'text-white' : 'text-slate-900'
              }`}
              title={student.full_name}
            >
              {student.full_name}
            </h3>
            <div className={`text-[9px] font-bold font-sans ${isDark ? 'text-emerald-400' : 'text-emerald-700'}`}>
              {gradeDisplay}
            </div>
            <div className="flex items-center gap-1 pt-0.5">
              <span className={`text-[7px] font-bold uppercase font-mono ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                DID:
              </span>
              <div
                className={`px-1 py-0.2 rounded text-[7px] font-mono truncate max-w-[130px] ${
                  isDark ? 'bg-slate-950/80 border border-indigo-500/20 text-indigo-200' : 'bg-slate-100 border border-slate-300 text-slate-800'
                }`}
                title={did}
              >
                {did}
              </div>
            </div>
          </div>

          {/* QR Code */}
          <div
            className={`flex flex-col items-center justify-center p-1 rounded-lg shadow-xs ml-auto ${
              isDark ? 'bg-white text-slate-900' : 'bg-slate-50 border border-slate-200 text-slate-900'
            }`}
          >
            <QRCodeImage value={verifyUrl} size={50} className="rounded" alt="Student DID QR" />
            <span className="text-[5.5px] text-slate-800 font-mono font-bold tracking-tighter uppercase mt-0.5 truncate max-w-[55px]">
              {qrSubLabel}
            </span>
          </div>
        </div>

        {/* ---------------- CARD FOOTER ---------------- */}
        <div
          className={`relative z-10 pt-1 border-t flex items-center justify-between text-[6.5px] font-black uppercase tracking-wider ${
            isDark ? 'border-indigo-500/20' : 'border-slate-300'
          }`}
        >
          <div className="flex items-center gap-1">
            <span
              className={`px-1.5 py-0.2 rounded border ${
                isDark ? 'text-indigo-300 bg-indigo-950/90 border-indigo-800' : 'text-indigo-800 bg-indigo-50 border-indigo-200'
              }`}
            >
              W3C Verifiable Identity
            </span>
            <span
              className={`px-1.5 py-0.2 rounded border flex items-center gap-0.5 ${
                isDark ? 'text-emerald-300 bg-emerald-950/90 border-emerald-800' : 'text-emerald-800 bg-emerald-50 border-emerald-200'
              }`}
            >
              <span className="w-1 h-1 rounded-full bg-emerald-500" />
              Polygon L2
            </span>
          </div>

          <span className={`font-mono text-[6px] ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
            OFFLINE EDGE SYNC
          </span>
        </div>
      </div>
    </div>
  );
};
