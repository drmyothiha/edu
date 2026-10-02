import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useParams } from 'react-router-dom';
import { api } from '../api/client';
import { useConfirm } from '../context/ConfirmDialogContext';
import {
  LessonPlanRequest,
  LessonPlanResponse,
  CurriculumChunkDTO,
  PriorLessonPlanSummaryDTO,
  StudentPerformanceSummaryDTO,
  ValidationReportDTO,
  RAGPipelineStepEventDTO,
} from '../types';
import {
  Sparkles,
  Copy,
  Check,
  FileText,
  AlertCircle,
  ChevronRight,
  Languages,
  Loader2,
  Database,
  ShieldCheck,
  Layers,
  CheckCircle2,
  AlertTriangle,
  Activity,
  BarChart3,
  Scale,
  Eye,
  BookOpen,
  Maximize2,
  Minimize2,
  ZoomIn,
  ZoomOut,
  Printer,
  Radio,
  Trash2,
  Save,
  Edit3,
  Heading1,
  Heading2,
  Bold,
  Italic,
  List,
  Quote,
  Table as TableIcon,
  Building2,
  Users,
} from 'lucide-react';

// Lightweight crisp Markdown renderer for lesson plan preview
const MarkdownRenderer: React.FC<{ content: string; isBurmese?: boolean; textScale?: number }> = ({ content, isBurmese, textScale = 100 }) => {
  const lines = content.split('\n');

  return (
    <div
      style={{ fontSize: textScale !== 100 ? `${textScale}%` : undefined }}
      className={`space-y-3 text-slate-800 text-sm ${
        isBurmese ? 'font-sans leading-relaxed tracking-normal' : 'font-sans leading-relaxed'
      }`}
    >
      {lines.map((line, idx) => {
        let trimmed = line.trim();

        // 1. Skip table divider lines like |---|---| or |:---|:---|
        if (/^\|?[-:\s|]+\|?$/.test(trimmed) && trimmed.includes('-')) {
          return null;
        }

        // 2. Horizontal divider rules (---, ***, ___)
        if (/^[-*_]{3,}$/.test(trimmed)) {
          return <hr key={idx} className="border-slate-200 my-2" />;
        }

        // 3. Blockquotes: remove '>' completely and render as styled note
        if (trimmed.startsWith('>')) {
          const quoteText = trimmed.replace(/^[>\s]+/, '').replace(/^\|\s*/, '').replace(/\s*\|$/, '');
          if (!quoteText) return null;
          return (
            <div
              key={idx}
              className="border-l-3 border-indigo-400 pl-3 py-1.5 bg-indigo-50/40 rounded-r text-slate-700 italic"
            >
              {parseBold(quoteText)}
            </div>
          );
        }

        // 4. Tables: parse cells and display as clean, modern badges/pills with NO raw '|'
        if (trimmed.startsWith('|') || (trimmed.includes('|') && trimmed.endsWith('|'))) {
          const cells = trimmed
            .split('|')
            .map((c) => c.trim())
            .filter((c) => c.length > 0 && !/^[-:]+$/.test(c));

          if (cells.length === 0) return null;

          return (
            <div
              key={idx}
              className="flex flex-wrap items-center gap-2 py-1.5 px-3 bg-slate-50 border border-slate-200/80 rounded-lg text-xs text-slate-800"
            >
              {cells.map((cell, cIdx) => (
                <span key={cIdx} className="inline-flex items-center">
                  {cIdx > 0 && <span className="mx-2 text-indigo-400 font-bold">•</span>}
                  <span>{parseBold(cell)}</span>
                </span>
              ))}
            </div>
          );
        }

        // 5. Headings
        if (trimmed.startsWith('# ')) {
          return (
            <h1
              key={idx}
              className="text-xl md:text-2xl font-bold text-slate-900 pt-2 pb-1.5 border-b border-slate-200"
            >
              {trimmed.slice(2)}
            </h1>
          );
        }
        if (trimmed.startsWith('## ')) {
          return (
            <h2
              key={idx}
              className="text-lg font-bold text-indigo-900 pt-3 pb-1 border-b border-indigo-100 flex items-center gap-2"
            >
              {trimmed.slice(3)}
            </h2>
          );
        }
        if (trimmed.startsWith('### ')) {
          return (
            <h3 key={idx} className="text-base font-semibold text-slate-800 pt-1.5">
              {trimmed.slice(4)}
            </h3>
          );
        }

        // 6. List items (- or *)
        if (trimmed.startsWith('- ') || trimmed.startsWith('* ')) {
          const itemText = trimmed.slice(2);
          const formatted = parseBold(itemText);
          return (
            <div key={idx} className="flex items-start gap-2 pl-2">
              <span className="text-indigo-600 font-bold mt-0.5">•</span>
              <span className="flex-1">{formatted}</span>
            </div>
          );
        }

        // 7. Blank lines
        if (trimmed === '') {
          return <div key={idx} className="h-1.5" />;
        }

        // 8. Normal paragraph
        return <p key={idx}>{parseBold(trimmed)}</p>;
      })}
    </div>
  );
};

function parseBold(text: string): React.ReactNode {
  const cleaned = text.replace(/^[>\s]+/, '').replace(/^\|\s*/, '').replace(/\s*\|$/, '');
  const parts = cleaned.split(/(\*\*.*?\*\*)/g);
  return parts.map((part, i) => {
    if (part.startsWith('**') && part.endsWith('**')) {
      return (
        <strong key={i} className="font-semibold text-slate-900">
          {part.slice(2, -2)}
        </strong>
      );
    }
    return part;
  });
}

// Initial 7-step pipeline state definition
const INITIAL_PIPELINE_STEPS: Array<{
  step: number;
  name: string;
  status: 'idle' | 'in_progress' | 'completed' | 'failed';
  detail: string;
}> = [
  { step: 1, name: 'Teacher Intent', status: 'idle', detail: 'Parse target grade, subject, duration & cognitive depth' },
  { step: 2, name: 'Query Encoder', status: 'idle', detail: 'Generate 1536-dim dense semantic embedding (BGE-M3)' },
  { step: 3, name: 'Vector Store Retrieval', status: 'idle', detail: 'Retrieve Top-5 MoE chunks, Top-3 prior plans & Top-3 competency gaps' },
  { step: 4, name: 'Prompt Assembly', status: 'idle', detail: 'Synthesize MoE curriculum constraints & Bloom\'s taxonomy' },
  { step: 5, name: 'LLM Generation', status: 'idle', detail: 'Stream real-time bilingual pedagogical markdown via SSE' },
  { step: 6, name: 'Output Validation', status: 'idle', detail: 'Check MoE alignment regex, readability index & child safety' },
  { step: 7, name: 'Library & Event Bus', status: 'idle', detail: 'Save to lesson library & publish LessonCreatedEvent' },
];

export const STANDARD_GRADE_LEVELS = [
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

export const STANDARD_SUBJECT_OPTIONS = [
  { name: 'Mathematics', nameMy: 'သင်္ချာ', icon: '📐' },
  { name: 'Myanmar Literature', nameMy: 'မြန်မာစာ', icon: '🇲🇲' },
  { name: 'English Literature', nameMy: 'အင်္ဂလိပ်စာ', icon: '📖' },
  { name: 'General Science', nameMy: 'အထွေထွေသိပ္ပံ', icon: '🔬' },
  { name: 'Social Studies', nameMy: 'လူမှုရေး', icon: '🌏' },
  { name: 'Physics', nameMy: 'ရူပဗေဒ', icon: '⚡' },
  { name: 'Chemistry', nameMy: 'ဓာတုဗေဒ', icon: '🧪' },
  { name: 'Biology', nameMy: 'ဇီဝဗေဒ', icon: '🧬' },
  { name: 'History & Civics', nameMy: 'သမိုင်းနှင့် စာရိတ္တ', icon: '🏛️' },
  { name: 'Geography', nameMy: 'ပထဝီဝင်', icon: '🗺️' },
  { name: 'Computer & AI Literacy', nameMy: 'ကွန်ပျူတာ အခြေခံ', icon: '💻' },
  { name: 'Physical Education', nameMy: 'ကာယပညာ', icon: '⚽' },
];

const isMatchSubject = (lessonSubj: string, targetSubj: string): boolean => {
  if (!lessonSubj || !targetSubj) return false;
  const s1 = lessonSubj.toLowerCase().trim();
  const s2 = targetSubj.toLowerCase().trim();
  if (s1 === s2) return true;
  if (
    (s1.includes('math') && s2.includes('math')) ||
    (s1.includes('sci') && s2.includes('sci')) ||
    (s1.includes('myan') && s2.includes('myan')) ||
    (s1.includes('eng') && s2.includes('eng')) ||
    (s1.includes('phys') && s2.includes('phys')) ||
    (s1.includes('chem') && s2.includes('chem')) ||
    (s1.includes('bio') && s2.includes('bio')) ||
    (s1.includes('soc') && s2.includes('soc')) ||
    (s1.includes('geo') && s2.includes('geo')) ||
    (s1.includes('hist') && s2.includes('hist'))
  ) {
    return true;
  }
  return false;
};

const isMatchGrade = (lessonGrade: string, targetGrade: string): boolean => {
  if (!lessonGrade || !targetGrade) return false;
  const g1 = lessonGrade.toLowerCase().replace(/[^a-z0-9]/g, '');
  const g2 = targetGrade.toLowerCase().replace(/[^a-z0-9]/g, '');
  if (g1 === g2) return true;
  const num1 = lessonGrade.match(/\d+/)?.[0];
  const num2 = targetGrade.match(/\d+/)?.[0];
  if (num1 && num2 && num1 === num2) return true;
  if (g1.includes('kg') && g2.includes('kg')) return true;
  return false;
};

export const CopilotPage: React.FC = () => {
  const { id: classParam } = useParams<{ id?: string }>();
  const { confirm } = useConfirm();

  const [formData, setFormData] = useState<LessonPlanRequest>({
    subject: 'Mathematics',
    grade_level: 'Grade 8',
    topic: 'Pythagorean Theorem and Real-World Distance Calculations',
    duration_minutes: 45,
  });

  // Automatically adapt grade and topic to current classroom if route has :id
  useEffect(() => {
    if (classParam) {
      api.classes
        .get(classParam)
        .then((cls) => {
          if (cls) {
            const g = cls.grade_level || 'KG';
            const isKg = g.toLowerCase().includes('kg');
            setFormData((prev) => ({
              ...prev,
              grade_level: isKg ? 'KG' : g,
              subject: isKg ? 'Myanmar Literature' : prev.subject,
              topic: isKg ? 'က ကလေးငယ် ချစ်စဖွယ် - ကခဂဃင ဗျည်း (၃၃) လုံး မိတ်ဆက်ခြင်း' : prev.topic,
            }));
          }
        })
        .catch(() => {});
    }
  }, [classParam]);

  const [generating, setGenerating] = useState(false);
  const [translating, setTranslating] = useState(false);
  const [currentPlan, setCurrentPlan] = useState<LessonPlanResponse | null>(null);
  const [history, setHistory] = useState<LessonPlanResponse[]>([]);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Editable MS Word Style Studio state
  const [isEditing, setIsEditing] = useState<boolean>(false);
  const [editedTopic, setEditedTopic] = useState<string>('');
  const [editedContent, setEditedContent] = useState<string>('');
  const [editedContentBurmese, setEditedContentBurmese] = useState<string>('');
  const [saving, setSaving] = useState<boolean>(false);
  const [saveSuccess, setSaveSuccess] = useState<boolean>(false);

  // Active view tab: 'studio' | 'grounding' | 'validation'
  const [activeTab, setActiveTab] = useState<'studio' | 'grounding' | 'validation'>('studio');

  // Pipeline stepper state
  const [pipelineSteps, setPipelineSteps] = useState(INITIAL_PIPELINE_STEPS);
  const [currentStreamingText, setCurrentStreamingText] = useState<string>('');

  // RAG Inspection Data
  const [retrievedChunks, setRetrievedChunks] = useState<CurriculumChunkDTO[]>([]);
  const [retrievedPriorPlans, setRetrievedPriorPlans] = useState<PriorLessonPlanSummaryDTO[]>([]);
  const [retrievedStudentPerformance, setRetrievedStudentPerformance] = useState<StudentPerformanceSummaryDTO[]>([]);
  const [validationReport, setValidationReport] = useState<ValidationReportDTO | null>(null);

  // Language toggle state defaults to Burmese ('my')
  const [language, setLanguage] = useState<'en' | 'my'>('my');

  // Filter scope for Saved Lesson Library: 'scoped' (by current Grade & Subject) vs 'all'
  const [filterScope, setFilterScope] = useState<'scoped' | 'all'>('scoped');
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [isCustomSubject, setIsCustomSubject] = useState<boolean>(false);

  // Full Screen / Focus Mode for teacher reading & classroom projection
  const [isFullScreen, setIsFullScreen] = useState<boolean>(false);
  const [textScale, setTextScale] = useState<number>(100);

  useEffect(() => {
    if (currentPlan) {
      setEditedTopic(currentPlan.topic || '');
      setEditedContent(currentPlan.generated_markdown || '');
      setEditedContentBurmese(currentPlan.generated_markdown_burmese || '');
    }
  }, [currentPlan]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setIsFullScreen(false);
      }
    };
    if (isFullScreen) {
      document.body.style.overflow = 'hidden';
      window.addEventListener('keydown', handleKeyDown);
    } else {
      document.body.style.overflow = 'unset';
    }
    return () => {
      document.body.style.overflow = 'unset';
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isFullScreen]);

  const streamAbortRef = useRef<AbortController | null>(null);

  // Select a plan and ensure Burmese is translated if in Burmese mode
  const selectPlan = async (plan: LessonPlanResponse) => {
    let activePlan = plan;
    if (!plan.rag_metadata) {
      try {
        activePlan = await api.copilot.getLessonPlan(plan.id);
      } catch {
        activePlan = plan;
      }
    }

    setCurrentPlan(activePlan);
    setEditedTopic(activePlan.topic || '');
    setEditedContent(activePlan.generated_markdown || '');
    setEditedContentBurmese(activePlan.generated_markdown_burmese || '');

    if (activePlan.rag_metadata) {
      setRetrievedChunks(activePlan.rag_metadata.retrieved_curriculum_chunks || []);
      setRetrievedPriorPlans(activePlan.rag_metadata.retrieved_prior_plans || []);
      setRetrievedStudentPerformance(activePlan.rag_metadata.retrieved_student_performance || []);
      setValidationReport(activePlan.rag_metadata.validation_report || null);
    }

    if (language === 'my' && (!plan.generated_markdown_burmese || plan.generated_markdown_burmese.trim() === '')) {
      setTranslating(true);
      try {
        const updated = await api.copilot.translateLessonPlan(plan.id);
        setCurrentPlan(updated);
        setEditedContentBurmese(updated.generated_markdown_burmese || '');
        setHistory((prev) => prev.map((p) => (p.id === updated.id ? updated : p)));
      } catch (err: any) {
        console.error('Failed to translate plan:', err);
      } finally {
        setTranslating(false);
      }
    }
  };

  // Load history on mount
  const loadHistory = async () => {
    try {
      const list = await api.copilot.listLessonPlans();
      setHistory(list);
      if (list.length > 0 && !currentPlan) {
        await selectPlan(list[0]);
      }
    } catch {
      // ignore
    }
  };

  useEffect(() => {
    loadHistory();
  }, []);

  // Save edited lesson plan to school facility context
  const handleSavePlan = async () => {
    if (!currentPlan) return;
    setSaving(true);
    setSaveSuccess(false);
    setError(null);

    try {
      const updated = await api.copilot.updateLessonPlan(currentPlan.id, {
        topic: editedTopic || currentPlan.topic,
        duration_minutes: currentPlan.duration_minutes,
        generated_markdown: editedContent,
        generated_markdown_burmese: editedContentBurmese,
      });

      setCurrentPlan(updated);
      setHistory((prev) => prev.map((p) => (p.id === updated.id ? updated : p)));
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch (err: any) {
      setError(err.message || 'Failed to save lesson plan to school context');
    } finally {
      setSaving(false);
    }
  };

  // Insert MS Word style Markdown formatting into editor
  const insertFormatting = (prefix: string, suffix: string = '') => {
    const textarea = document.getElementById('lesson-editor-textarea') as HTMLTextAreaElement;
    if (!textarea) return;

    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const activeText = language === 'my' ? editedContentBurmese : editedContent;
    const selectedText = activeText.substring(start, end) || 'text';
    const replacement = `${prefix}${selectedText}${suffix}`;

    const newText = activeText.substring(0, start) + replacement + activeText.substring(end);

    if (language === 'my') {
      setEditedContentBurmese(newText);
    } else {
      setEditedContent(newText);
    }

    setTimeout(() => {
      textarea.focus();
      textarea.setSelectionRange(start + prefix.length, start + prefix.length + selectedText.length);
    }, 50);
  };

  // Delete a saved lesson plan with user confirmation
  const handleDeletePlan = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const isConfirmed = await confirm({
      title: 'သင်ခန်းစာ အစီအစဉ် ပယ်ဖျက်ရန် (Delete Lesson Plan)',
      message: 'Are you sure you want to delete this saved lesson plan?',
      confirmText: 'ပယ်ဖျက်မည် (Delete)',
      cancelText: 'မလုပ်တော့ပါ (Cancel)',
      variant: 'danger',
      cautionText: 'ဤလုပ်ဆောင်ချက်ကို ပြန်လည်ပြင်ဆင်၍ မရနိုင်ပါ (This action cannot be undone)',
    });
    if (!isConfirmed) {
      return;
    }
    setDeletingId(id);
    try {
      await api.copilot.deleteLessonPlan(id);
      setHistory((prev) => prev.filter((p) => p.id !== id));
      if (currentPlan?.id === id) {
        const remaining = history.filter((p) => p.id !== id);
        if (remaining.length > 0) {
          selectPlan(remaining[0]);
        } else {
          setCurrentPlan(null);
        }
      }
    } catch (err: any) {
      setError(err.message || 'Failed to delete lesson plan');
    } finally {
      setDeletingId(null);
    }
  };

  const handleGenerate = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setGenerating(true);
    setCopied(false);
    setCurrentStreamingText('');

    // Reset pipeline steps
    setPipelineSteps(
      INITIAL_PIPELINE_STEPS.map((s, idx) => ({
        ...s,
        status: idx === 0 ? 'in_progress' : 'idle',
      }))
    );

    const abortCtrl = new AbortController();
    streamAbortRef.current = abortCtrl;

    try {
      const plan = await api.copilot.streamLessonPlan(
        formData,
        (eventType, data) => {
          if (eventType === 'pipeline_step') {
            const stepEv = data as RAGPipelineStepEventDTO;
            setPipelineSteps((prev) =>
              prev.map((s) => {
                if (s.step === stepEv.step) {
                  return {
                    ...s,
                    status: stepEv.status === 'completed' ? 'completed' : 'in_progress',
                    detail: stepEv.message || s.detail,
                  };
                }
                if (s.step < stepEv.step) {
                  return { ...s, status: 'completed' };
                }
                return s;
              })
            );
          } else if (eventType === 'retrieval_data') {
            if (data.curriculum_chunks) setRetrievedChunks(data.curriculum_chunks);
            if (data.prior_plans) setRetrievedPriorPlans(data.prior_plans);
            if (data.student_performance) setRetrievedStudentPerformance(data.student_performance);
          } else if (eventType === 'text_chunk') {
            setCurrentStreamingText((prev) => prev + (data.chunk || ''));
          } else if (eventType === 'validation_data') {
            setValidationReport(data);
          } else if (eventType === 'complete') {
            setPipelineSteps((prev) => prev.map((s) => ({ ...s, status: 'completed' })));
          }
        },
        abortCtrl.signal
      );

      setCurrentPlan(plan);
      setEditedTopic(plan.topic || '');
      setEditedContent(plan.generated_markdown || '');
      setEditedContentBurmese(plan.generated_markdown_burmese || '');

      if (plan.rag_metadata) {
        setRetrievedChunks(plan.rag_metadata.retrieved_curriculum_chunks || []);
        setRetrievedPriorPlans(plan.rag_metadata.retrieved_prior_plans || []);
        setRetrievedStudentPerformance(plan.rag_metadata.retrieved_student_performance || []);
        setValidationReport(plan.rag_metadata.validation_report || null);
      }
      setHistory((prev) => [plan, ...prev.filter((p) => p.id !== plan.id)]);
      setLanguage('my');
    } catch (err: any) {
      if (err.name !== 'AbortError') {
        setError(err.message || 'Failed to execute RAG pipeline');
      }
    } finally {
      setGenerating(false);
      streamAbortRef.current = null;
    }
  };

  // Toggle between Burmese ('my') and English ('en')
  const toggleLanguage = async () => {
    setError(null);
    const targetLang = language === 'my' ? 'en' : 'my';

    if (
      targetLang === 'my' &&
      currentPlan &&
      (!currentPlan.generated_markdown_burmese || currentPlan.generated_markdown_burmese.trim() === '')
    ) {
      setTranslating(true);
      try {
        const updated = await api.copilot.translateLessonPlan(currentPlan.id);
        setCurrentPlan(updated);
        setEditedContentBurmese(updated.generated_markdown_burmese || '');
        setHistory((prev) => prev.map((p) => (p.id === updated.id ? updated : p)));
        setLanguage('my');
      } catch (err: any) {
        setError(err.message || 'Failed to translate lesson plan to Burmese');
      } finally {
        setTranslating(false);
      }
      return;
    }

    setLanguage(targetLang);
  };

  const handleCopy = () => {
    const activeText = isEditing
      ? language === 'my' ? editedContentBurmese : editedContent
      : language === 'my' && currentPlan?.generated_markdown_burmese
      ? currentPlan.generated_markdown_burmese
      : currentPlan?.generated_markdown || displayContent;

    if (activeText) {
      navigator.clipboard.writeText(activeText);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    }
  };

  // Filtered history matching the currently selected Grade and Subject (e.g. Grade 8, Mathematics)
  const filteredHistory = history.filter(
    (h) => isMatchSubject(h.subject, formData.subject) && isMatchGrade(h.grade_level, formData.grade_level)
  );
  const displayedHistory = filterScope === 'scoped' ? filteredHistory : history;

  // Display content determination (streaming vs completed plan vs live edited content)
  const displayContent = generating && currentStreamingText
    ? currentStreamingText
    : isEditing
    ? language === 'my' ? editedContentBurmese : editedContent
    : currentPlan
    ? language === 'my' && currentPlan.generated_markdown_burmese
      ? currentPlan.generated_markdown_burmese
      : currentPlan.generated_markdown
    : '';

  return (
    <div className="p-6 md:p-8 max-w-7xl mx-auto w-full space-y-6">
      {/* Main Two-Pane Studio Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left Pane: Form Controls (5 Cols) */}
        <div className="lg:col-span-5 space-y-4">
          <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-xs">
            <h2 className="text-sm font-bold text-slate-900 mb-3 flex items-center gap-1.5">
              <BookOpen className="h-4 w-4 text-indigo-600" /> သင်ခန်းစာ အချက်အလက်များ (Lesson Plan Details)
            </h2>

            <form onSubmit={handleGenerate} className="space-y-3.5">
              <div>
                <div className="flex items-center justify-between">
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-700">
                    Subject / ဘာသာရပ်
                  </label>
                  <button
                    type="button"
                    onClick={() => setIsCustomSubject(!isCustomSubject)}
                    className="text-[11px] text-indigo-600 hover:text-indigo-800 font-medium hover:underline"
                  >
                    {isCustomSubject ? '← ပုံမှန်ဘာသာရပ်များ (Standard)' : '+ အခြားဘာသာရပ် (Custom)'}
                  </button>
                </div>
                {!isCustomSubject ? (
                  <select
                    value={
                      STANDARD_SUBJECT_OPTIONS.some((s) => s.name.toLowerCase() === formData.subject.toLowerCase())
                        ? formData.subject
                        : 'Mathematics'
                    }
                    onChange={(e) => setFormData({ ...formData, subject: e.target.value })}
                    className="mt-1 block w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 bg-white"
                  >
                    {STANDARD_SUBJECT_OPTIONS.map((subj) => (
                      <option key={subj.name} value={subj.name}>
                        {subj.icon} {subj.name} • {subj.nameMy}
                      </option>
                    ))}
                  </select>
                ) : (
                  <input
                    type="text"
                    required
                    value={formData.subject}
                    onChange={(e) => setFormData({ ...formData, subject: e.target.value })}
                    placeholder="ဥပမာ - သင်္ချာ"
                    className="mt-1 block w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  />
                )}
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-700">
                    Grade Level / အတန်း
                  </label>
                  <select
                    value={formData.grade_level}
                    onChange={(e) => setFormData({ ...formData, grade_level: e.target.value })}
                    className="mt-1 block w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 bg-white"
                  >
                    {STANDARD_GRADE_LEVELS.map((grade) => (
                      <option key={grade} value={grade}>
                        {grade}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-700">
                    Duration / သင်ကြားချိန် (မိနစ်)
                  </label>
                  <input
                    type="number"
                    min="15"
                    max="180"
                    required
                    value={formData.duration_minutes}
                    onChange={(e) => setFormData({ ...formData, duration_minutes: parseInt(e.target.value) || 45 })}
                    className="mt-1 block w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-700">
                  Topic / သင်ခန်းစာ ခေါင်းစဉ်
                </label>
                <textarea
                  rows={3}
                  required
                  value={formData.topic}
                  onChange={(e) => setFormData({ ...formData, topic: e.target.value })}
                  placeholder="ဥပမာ - Grade 8 သင်္ချာ၊ ပိုက်သာဂိုးရပ်သီအိုရမ်၊ ၄၅ မိနစ် သင်ခန်းစာ"
                  className="mt-1 block w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                />
              </div>

              {error && (
                <div className="rounded-lg bg-rose-50 border border-rose-200 p-3 text-xs text-rose-800 flex items-center gap-2">
                  <AlertCircle className="h-4 w-4 text-rose-600 flex-shrink-0" />
                  <span>{error}</span>
                </div>
              )}

              <button
                type="submit"
                disabled={generating}
                className="w-full flex items-center justify-center gap-2 rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-bold text-white shadow hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 disabled:opacity-60 transition cursor-pointer"
              >
                {generating ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    သင်ခန်းစာ ရေးဆွဲနေပါသည်... (Generating...)
                  </>
                ) : (
                  <>
                    <Sparkles className="h-4 w-4 text-amber-300" /> သင်ခန်းစာ အစီအစဉ် ရေးဆွဲမည် (Generate Plan)
                  </>
                )}
              </button>
            </form>
          </div>

          {/* Previous Lesson Plans Library */}
          {history.length > 0 && (
            <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-xs">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-1.5">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700 flex items-center gap-1">
                    <Building2 className="h-3.5 w-3.5 text-indigo-600" />
                    သိမ်းဆည်းထားသော သင်ခန်းစာများ (Saved Lessons)
                  </h3>
                  <span className="text-[11px] font-bold px-1.5 py-0.2 rounded-full bg-indigo-100 text-indigo-700">
                    {filterScope === 'scoped' ? filteredHistory.length : history.length}
                  </span>
                </div>
                <div className="flex items-center gap-1 bg-slate-100 p-0.5 rounded-lg border border-slate-200 text-[10px]">
                  <button
                    type="button"
                    onClick={() => setFilterScope('scoped')}
                    className={`px-2 py-0.5 rounded font-semibold transition ${
                      filterScope === 'scoped'
                        ? 'bg-white text-indigo-700 shadow-xs'
                        : 'text-slate-500 hover:text-slate-800'
                    }`}
                    title={`Filter strictly for ${formData.grade_level} • ${formData.subject}`}
                  >
                    🎯 {formData.grade_level.replace('Grade ', 'G ')} • {formData.subject.slice(0, 5)}
                  </button>
                  <button
                    type="button"
                    onClick={() => setFilterScope('all')}
                    className={`px-2 py-0.5 rounded font-semibold transition ${
                      filterScope === 'all'
                        ? 'bg-white text-indigo-700 shadow-xs'
                        : 'text-slate-500 hover:text-slate-800'
                    }`}
                  >
                    📚 အားလုံး ({history.length})
                  </button>
                </div>
              </div>

              <div className="mb-2.5 px-2.5 py-1.5 bg-indigo-50/80 border border-indigo-100 rounded-lg text-[11px] text-indigo-900 flex items-center justify-between">
                <span className="flex items-center gap-1.5">
                  <Users className="h-3.5 w-3.5 text-indigo-600 flex-shrink-0" />
                  <span>
                    ကျောင်းအဆင့် မျှဝေမှု • <strong>{formData.grade_level}</strong> သင်ကြားသော ဆရာ/ဆရာမများအားလုံး ကြည့်ရှုနိုင်ပါသည်
                  </span>
                </span>
              </div>

              {filterScope === 'scoped' && (
                <div className="mb-2 px-2 py-1 bg-slate-100 border border-slate-200 rounded-md text-[11px] text-slate-700 flex items-center justify-between">
                  <span className="truncate">
                    သီးသန့်ကြည့်ရှုမှု: <strong>{formData.grade_level}</strong> • <strong>{formData.subject}</strong>
                  </span>
                  {filteredHistory.length === 0 && (
                    <button
                      type="button"
                      onClick={() => setFilterScope('all')}
                      className="text-indigo-600 underline font-semibold ml-2 flex-shrink-0"
                    >
                      အားလုံးပြပါ (Show All)
                    </button>
                  )}
                </div>
              )}

              {displayedHistory.length === 0 ? (
                <div className="p-4 text-center border border-dashed border-slate-200 rounded-lg bg-slate-50">
                  <p className="text-xs text-slate-500 font-medium">
                    <strong>{formData.grade_level} • {formData.subject}</strong> အတွက် သိမ်းဆည်းထားသော သင်ခန်းစာ မရှိသေးပါ။
                  </p>
                  <button
                    type="button"
                    onClick={() => setFilterScope('all')}
                    className="mt-1.5 text-xs text-indigo-600 hover:underline font-semibold"
                  >
                    အတန်းအားလုံးမှ သိမ်းဆည်းထားသော သင်ခန်းစာ {history.length} ခုလုံးကို ကြည့်ရန် →
                  </button>
                </div>
              ) : (
                <div className="space-y-1.5 max-h-56 overflow-y-auto">
                  {displayedHistory.map((h) => (
                    <div
                      key={h.id}
                      onClick={() => selectPlan(h)}
                      className={`group w-full text-left p-2 rounded-lg text-xs transition flex items-center justify-between border cursor-pointer ${
                        currentPlan?.id === h.id
                          ? 'bg-indigo-50 border-indigo-200 text-indigo-900 font-semibold'
                          : 'hover:bg-slate-50 border-transparent text-slate-700'
                      }`}
                    >
                      <div className="truncate pr-2 flex-1">
                        <p className="truncate font-medium">{h.topic}</p>
                        <div className="flex items-center gap-1.5 text-[10px] text-slate-400 mt-0.5">
                          <span className="font-semibold text-slate-600">{h.subject}</span>
                          <span>•</span>
                          <span className="bg-slate-100 text-slate-700 px-1 py-0.2 rounded font-mono font-medium">
                            {h.grade_level}
                          </span>
                          <span>•</span>
                          <span>{h.duration_minutes} မိနစ်</span>
                          <span className="ml-1 bg-emerald-50 text-emerald-700 border border-emerald-200 px-1 py-0.2 rounded text-[9px] font-semibold">
                            🏫 ကျောင်းအဆင့်
                          </span>
                        </div>
                      </div>
                      <div className="flex items-center gap-1 flex-shrink-0">
                        <button
                          type="button"
                          disabled={deletingId === h.id}
                          onClick={(e) => handleDeletePlan(h.id, e)}
                          className="opacity-40 group-hover:opacity-100 p-1.5 rounded-md hover:bg-rose-100 text-slate-400 hover:text-rose-600 transition"
                          title="ဤသင်ခန်းစာကို ပယ်ဖျက်မည် (Delete)"
                        >
                          {deletingId === h.id ? (
                            <Loader2 className="h-3.5 w-3.5 animate-spin text-rose-500" />
                          ) : (
                            <Trash2 className="h-3.5 w-3.5" />
                          )}
                        </button>
                        <ChevronRight className="h-3.5 w-3.5 text-slate-400" />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Right Pane: Multi-Tab Studio & RAG Grounding Inspector (7 Cols) */}
        <div className="lg:col-span-7">
          <div className="rounded-xl border border-slate-200 bg-white shadow-xs flex flex-col min-h-[620px]">
            {/* Studio Navigation Tabs */}
            <div className="px-4 py-2.5 border-b border-slate-200 flex flex-wrap items-center justify-between gap-2 bg-slate-50/70 rounded-t-xl">
              <div className="flex items-center gap-1.5">
                <button
                  onClick={() => setActiveTab('studio')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 ${
                    activeTab === 'studio'
                      ? 'bg-white text-indigo-700 shadow-xs border border-slate-200'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  <FileText className="h-3.5 w-3.5" /> သင်ခန်းစာ စတူဒီယို (Studio)
                </button>
                <button
                  onClick={() => setActiveTab('grounding')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 ${
                    activeTab === 'grounding'
                      ? 'bg-white text-indigo-700 shadow-xs border border-slate-200'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  <Database className="h-3.5 w-3.5 text-emerald-600" />
                  MoE သင်ရိုးစံနှုန်း (Grounding)
                  {retrievedChunks.length > 0 && (
                    <span className="bg-emerald-100 text-emerald-800 text-[10px] px-1.5 py-0.2 rounded-full font-bold">
                      {retrievedChunks.length} MoE
                    </span>
                  )}
                </button>
                <button
                  onClick={() => setActiveTab('validation')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 ${
                    activeTab === 'validation'
                      ? 'bg-white text-indigo-700 shadow-xs border border-slate-200'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  <ShieldCheck className="h-3.5 w-3.5 text-indigo-600" />
                  စိစစ်ချက် အစီရင်ခံစာ (Validation)
                  {validationReport && (
                    <span
                      className={`text-[10px] px-1.5 py-0.2 rounded-full font-bold ${
                        validationReport.overall_status === 'PASSED'
                          ? 'bg-emerald-100 text-emerald-800'
                          : 'bg-amber-100 text-amber-800'
                      }`}
                    >
                      {validationReport.overall_score}%
                    </span>
                  )}
                </button>
              </div>

              {/* Action Buttons: Edit mode, Save, Language toggle & Copy */}
              <div className="flex items-center gap-1.5 flex-wrap">
                {activeTab === 'studio' && currentPlan && (
                  <>
                    <button
                      type="button"
                      onClick={() => setIsEditing(!isEditing)}
                      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-bold transition border cursor-pointer ${
                        isEditing
                          ? 'bg-amber-500 text-white border-amber-600 shadow-xs'
                          : 'bg-white hover:bg-slate-50 border-slate-200 text-slate-700'
                      }`}
                      title="စာသားတည်းဖြတ်မှု စနစ်ဖွင့်ရန်"
                    >
                      <Edit3 className="h-3.5 w-3.5" />
                      <span>{isEditing ? 'နမူနာကြည့်မည် (Preview)' : 'ပြင်ဆင်မည် (Edit)'}</span>
                    </button>

                    <button
                      type="button"
                      onClick={handleSavePlan}
                      disabled={saving}
                      className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-bold transition shadow-xs cursor-pointer ${
                        saveSuccess
                          ? 'bg-emerald-600 text-white'
                          : 'bg-emerald-600 hover:bg-emerald-700 text-white disabled:opacity-50'
                      }`}
                      title="ကျောင်းအတွက် သင်ခန်းစာ အစီအစဉ် သိမ်းဆည်းမည်"
                    >
                      {saving ? (
                        <>
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          <span>သိမ်းဆည်းနေပါသည်...</span>
                        </>
                      ) : saveSuccess ? (
                        <>
                          <Check className="h-3.5 w-3.5 text-white" />
                          <span>သိမ်းဆည်းပြီး!</span>
                        </>
                      ) : (
                        <>
                          <Save className="h-3.5 w-3.5" />
                          <span>သိမ်းဆည်းမည် (Save)</span>
                        </>
                      )}
                    </button>
                  </>
                )}

                <button
                  onClick={toggleLanguage}
                  disabled={translating || !currentPlan}
                  className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-xs font-medium text-slate-700 transition shadow-xs disabled:opacity-50"
                  title="မြန်မာ / English ပြောင်းလဲရန်"
                >
                  <Languages className="h-3.5 w-3.5 text-indigo-600" />
                  <span>{language === 'my' ? '🇲🇲 မြန်မာမူ' : '🇬🇧 English'}</span>
                </button>

                <button
                  onClick={handleCopy}
                  disabled={!currentPlan && !displayContent}
                  className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-xs font-medium text-slate-700 transition shadow-xs disabled:opacity-50"
                  title="သင်ခန်းစာ အကြောင်းအရာ ကူးယူမည်"
                >
                  {copied ? (
                    <>
                      <Check className="h-3.5 w-3.5 text-emerald-600" />
                      <span className="text-emerald-700 font-semibold">ကူးယူပြီး</span>
                    </>
                  ) : (
                    <>
                      <Copy className="h-3.5 w-3.5" />
                      <span>ကူးယူမည် (Copy)</span>
                    </>
                  )}
                </button>

                <button
                  onClick={() => setIsFullScreen(true)}
                  disabled={!currentPlan && !displayContent}
                  className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg border border-indigo-200 bg-indigo-50/70 hover:bg-indigo-100 text-xs font-semibold text-indigo-700 transition shadow-xs disabled:opacity-50 cursor-pointer"
                  title="မျက်နှာပြင် အပြည့်ကြည့်ရန်"
                >
                  <Maximize2 className="h-3.5 w-3.5" />
                  <span className="hidden sm:inline">မျက်နှာပြင်ပြည့် (Focus)</span>
                </button>
              </div>
            </div>

            {/* TAB 1: STUDIO MARKDOWN PREVIEW / MS WORD EDITOR */}
            {activeTab === 'studio' && (
              <div className="p-6 flex-1 flex flex-col justify-between space-y-4">
                {/* School Context Scoping Information Banner */}
                {currentPlan && (
                  <div className="flex items-center justify-between p-2.5 rounded-lg bg-indigo-50/80 border border-indigo-200 text-xs text-indigo-900">
                    <div className="flex items-center gap-2">
                      <Building2 className="h-4 w-4 text-indigo-700 flex-shrink-0" />
                      <span>
                        <strong>ကျောင်းအဆင့် မျှဝေမှု:</strong> ဤကျောင်းတွင် <strong>{currentPlan.grade_level}</strong> သင်ကြားသော ဆရာ/ဆရာမများအားလုံး ကြည့်ရှုနိုင်ပါသည်။
                      </span>
                    </div>
                    <div className="flex items-center gap-1 text-[11px] font-semibold text-indigo-700 bg-white/80 px-2 py-0.5 rounded border border-indigo-200">
                      <Users className="h-3 w-3" /> {currentPlan.grade_level} ဘုံအသုံးပြုမှု
                    </div>
                  </div>
                )}

                {generating && !currentStreamingText ? (
                  <div className="flex-1 flex flex-col items-center justify-center text-center p-8 space-y-3">
                    <Loader2 className="h-8 w-8 text-indigo-600 animate-spin" />
                    <p className="text-sm font-semibold text-slate-800">
                      မြန်မာ့ပညာရေး စံနှုန်းများဖြင့် သင်ခန်းစာ ရေးဆွဲနေပါသည်...
                    </p>
                    <p className="text-xs text-slate-500 max-w-md">
                      ပညာရေးဝန်ကြီးဌာန (MoE) သင်ရိုးစံနှုန်းများနှင့် စွမ်းရည်ရည်မှန်းချက်များကို ထည့်သွင်းစဉ်းစားကာ သင်ခန်းစာ အစီအစဉ် ပြုစုနေပါသည်။
                    </p>
                  </div>
                ) : isEditing ? (
                  /* MS WORD STYLE EDITABLE STUDIO */
                  <div className="space-y-3 flex-1 flex flex-col">
                    {/* Topic editor bar */}
                    <div className="flex items-center gap-2">
                      <label className="text-xs font-bold text-slate-700 uppercase tracking-wider flex-shrink-0">
                        ခေါင်းစဉ် (Topic):
                      </label>
                      <input
                        type="text"
                        value={editedTopic}
                        onChange={(e) => setEditedTopic(e.target.value)}
                        className="flex-1 rounded-lg border border-slate-300 px-3 py-1.5 text-sm font-semibold text-slate-900 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                        placeholder="သင်ခန်းစာ ခေါင်းစဉ် ရိုက်ထည့်ပါ"
                      />
                    </div>

                    {/* Rich MS Word Style Formatting Toolbar */}
                    <div className="flex flex-wrap items-center gap-1.5 p-2 bg-slate-100 border border-slate-200 rounded-t-xl text-xs">
                      <span className="text-[10px] uppercase font-bold text-slate-500 mr-1 flex items-center gap-1">
                        <Edit3 className="h-3 w-3 text-indigo-600" /> စာသားပုံစံ ပြင်ဆင်ရန်:
                      </span>
                      <button
                        type="button"
                        onClick={() => insertFormatting('**', '**')}
                        className="p-1.5 bg-white hover:bg-indigo-50 border border-slate-200 rounded font-bold text-slate-700 hover:text-indigo-700 transition"
                        title="စာလုံးမည်း (Bold)"
                      >
                        <Bold className="h-3.5 w-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => insertFormatting('*', '*')}
                        className="p-1.5 bg-white hover:bg-indigo-50 border border-slate-200 rounded italic text-slate-700 hover:text-indigo-700 transition"
                        title="စာလုံးစောင်း (Italic)"
                      >
                        <Italic className="h-3.5 w-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => insertFormatting('# ')}
                        className="p-1.5 bg-white hover:bg-indigo-50 border border-slate-200 rounded font-bold text-slate-700 hover:text-indigo-700 transition"
                        title="ခေါင်းစဉ်ကြီး (Heading 1)"
                      >
                        <Heading1 className="h-3.5 w-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => insertFormatting('## ')}
                        className="p-1.5 bg-white hover:bg-indigo-50 border border-slate-200 rounded font-bold text-slate-700 hover:text-indigo-700 transition"
                        title="ခေါင်းစဉ်ငယ် (Heading 2)"
                      >
                        <Heading2 className="h-3.5 w-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => insertFormatting('- ')}
                        className="p-1.5 bg-white hover:bg-indigo-50 border border-slate-200 rounded text-slate-700 hover:text-indigo-700 transition"
                        title="အမှတ်စဉ် (Bullet List)"
                      >
                        <List className="h-3.5 w-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => insertFormatting('> ')}
                        className="p-1.5 bg-white hover:bg-indigo-50 border border-slate-200 rounded text-slate-700 hover:text-indigo-700 transition"
                        title="အရေးကြီးမှတ်ချက် (Callout Note)"
                      >
                        <Quote className="h-3.5 w-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => insertFormatting('| ကော်လံ ၁ | ကော်လံ ၂ |\n| --- | --- |\n| အချက် ၁ | အချက် ၂ |\n')}
                        className="p-1.5 bg-white hover:bg-indigo-50 border border-slate-200 rounded text-slate-700 hover:text-indigo-700 transition"
                        title="ဇယားထည့်သွင်းရန် (Table)"
                      >
                        <TableIcon className="h-3.5 w-3.5" />
                      </button>
                      <div className="ml-auto text-[10px] text-slate-500 font-medium">
                        {language === 'my' ? '🇲🇲 မြန်မာမူဗားရှင်း ပြင်ဆင်နေသည်' : '🇬🇧 English Version ပြင်ဆင်နေသည်'}
                      </div>
                    </div>

                    {/* Word Page Container */}
                    <textarea
                      id="lesson-editor-textarea"
                      rows={18}
                      value={language === 'my' ? editedContentBurmese : editedContent}
                      onChange={(e) => {
                        if (language === 'my') {
                          setEditedContentBurmese(e.target.value);
                        } else {
                          setEditedContent(e.target.value);
                        }
                      }}
                      className="w-full font-mono text-xs leading-relaxed p-4 bg-white border border-slate-300 rounded-b-xl shadow-inner focus:outline-none focus:ring-2 focus:ring-indigo-500 text-slate-900 min-h-[400px]"
                      placeholder="သင်ခန်းစာ အစီအစဉ် အကြောင်းအရာများကို ဤနေရာတွင် ရိုက်ထည့်ပါ သို့မဟုတ် ပြင်ဆင်ပါ..."
                    />

                    {/* Editor Action Footer */}
                    <div className="flex items-center justify-between pt-1">
                      <button
                        type="button"
                        onClick={() => setIsEditing(false)}
                        className="text-xs text-slate-600 hover:text-slate-900 font-semibold cursor-pointer"
                      >
                        ← နမူနာကြည့်မုဒ်သို့ ပြန်သွားရန် (Preview)
                      </button>
                      <button
                        type="button"
                        onClick={handleSavePlan}
                        disabled={saving}
                        className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs px-4 py-2 rounded-lg shadow transition flex items-center gap-1.5 cursor-pointer"
                      >
                        <Save className="h-4 w-4" />
                        <span>{saving ? 'ကျောင်းအတွက် သိမ်းဆည်းနေပါသည်...' : 'ကျောင်းအတွက် သင်ခန်းစာ သိမ်းဆည်းမည်'}</span>
                      </button>
                    </div>
                  </div>
                ) : displayContent ? (
                  <div className="space-y-4">
                    {/* MoE Grounding Pill */}
                    {retrievedChunks.length > 0 && (
                      <div className="flex items-center justify-between p-2.5 rounded-lg bg-emerald-50/70 border border-emerald-200 text-xs">
                        <div className="flex items-center gap-2">
                          <ShieldCheck className="h-4 w-4 text-emerald-700 flex-shrink-0" />
                          <span className="text-emerald-950 font-semibold">
                            MoE သင်ရိုးစံနှုန်း: [{retrievedChunks[0].standard_code}] {retrievedChunks[0].unit_title}
                          </span>
                        </div>
                        <span className="font-mono text-[10px] bg-emerald-200 text-emerald-900 px-2 py-0.5 rounded font-bold">
                          ကိုက်ညီမှု: {Math.round((retrievedChunks[0].similarity_score || 0.95) * 100)}%
                        </span>
                      </div>
                    )}

                    <MarkdownRenderer content={displayContent} isBurmese={language === 'my'} />
                  </div>
                ) : (
                  <div className="flex-1 flex flex-col items-center justify-center text-center p-8 space-y-2 text-slate-400">
                    <BookOpen className="h-10 w-10 text-slate-300" />
                    <p className="text-sm font-medium text-slate-600">သင်ခန်းစာ အစီအစဉ် မရှိသေးပါ (No lesson plan generated yet)</p>
                    <p className="text-xs max-w-sm">
                      ဘယ်ဘက်တွင် အကြောင်းအရာနှင့် အချက်အလက်များ ဖြည့်သွင်းပြီး သင်ခန်းစာ ရေးဆွဲနိုင်ပါသည်။
                    </p>
                  </div>
                )}
              </div>
            )}

            {/* TAB 2: RAG GROUNDING INSPECTOR */}
            {activeTab === 'grounding' && (
              <div className="p-6 space-y-5 overflow-y-auto max-h-[640px]">
                <div>
                  <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                    <Database className="h-4 w-4 text-indigo-600" />
                    MoE သင်ရိုးစံနှုန်း ရလဒ်များ (Curriculum Grounding Results)
                  </h3>
                  <p className="text-xs text-slate-500">
                    ပညာရေးဝန်ကြီးဌာန (MoE) သင်ရိုးစံနှုန်းများမှ ကိုက်ညီသည့် သင်ခန်းစာ အချက်အလက်များ
                  </p>
                </div>

                {/* 1. Top-5 MoE Curriculum Chunks */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold uppercase tracking-wider text-slate-700">
                      ၁။ မြန်မာ့ပညာရေး သင်ရိုးညွှန်းတမ်း စံနှုန်းများ (MoE Curriculum)
                    </span>
                    <span className="text-[11px] text-emerald-700 font-bold">
                      အမျိုးသားအဆင့် KG+12 သင်ရိုး
                    </span>
                  </div>
                  {retrievedChunks.length === 0 ? (
                    <p className="text-xs text-slate-400 italic">သင်ရိုးအချက်အလက် မရှိသေးပါ။</p>
                  ) : (
                    retrievedChunks.map((chunk, idx) => (
                      <div
                        key={chunk.id || idx}
                        className="p-3 rounded-lg border border-slate-200 bg-slate-50/70 hover:bg-white transition text-xs space-y-1.5"
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-1.5 font-bold text-indigo-950">
                            <span className="font-mono bg-indigo-100 text-indigo-800 px-1.5 py-0.5 rounded text-[10px]">
                              [{chunk.standard_code}]
                            </span>
                            <span>{chunk.unit_title}</span>
                          </div>
                          <span className="font-mono font-bold text-emerald-700 bg-emerald-100 px-1.5 py-0.5 rounded text-[10px]">
                            {Math.round((chunk.similarity_score || 0.9) * 100)}% ကိုက်ညီမှု
                          </span>
                        </div>
                        <p className="text-slate-700 font-medium">{chunk.topic}</p>
                        <p className="text-slate-600 text-[11px] leading-relaxed">
                          <strong className="text-slate-800">စွမ်းရည်ရည်မှန်းချက် (Competency):</strong> {chunk.competency}
                        </p>
                        {chunk.content_burmese && (
                          <p className="text-slate-600 text-[11px] leading-relaxed font-sans bg-amber-50/60 p-1.5 rounded border border-amber-200/50">
                            <strong className="text-amber-900">မြန်မာမူ စံနှုန်း:</strong> {chunk.content_burmese}
                          </p>
                        )}
                      </div>
                    ))
                  )}
                </div>

                {/* 2. Top-3 Prior Lesson Plans */}
                <div className="space-y-2 pt-2 border-t border-slate-100">
                  <span className="text-xs font-bold uppercase tracking-wider text-slate-700 block">
                    ၂။ ယခင်ရေးဆွဲခဲ့သော သင်ခန်းစာ အစီအစဉ်များ (Prior Plans)
                  </span>
                  {retrievedPriorPlans.length === 0 ? (
                    <p className="text-xs text-slate-400 italic">ယခင် ရေးဆွဲထားသော သင်ခန်းစာ မရှိသေးပါ။</p>
                  ) : (
                    retrievedPriorPlans.map((plan, idx) => (
                      <div
                        key={plan.id || idx}
                        className="p-2.5 rounded-lg border border-slate-200 bg-white text-xs space-y-1"
                      >
                        <div className="flex items-center justify-between">
                          <span className="font-bold text-slate-900">{plan.topic}</span>
                          <span className="font-mono text-[10px] text-slate-500">
                            {Math.round(plan.similarity_score * 100)}% sim
                          </span>
                        </div>
                        <p className="text-[11px] text-slate-500">
                          {plan.subject} • {plan.grade_level} • {plan.duration_minutes} မိနစ်
                        </p>
                        <p className="text-[11px] text-slate-700 italic bg-slate-50 p-1.5 rounded">
                          "{plan.key_learnings}"
                        </p>
                      </div>
                    ))
                  )}
                </div>

                {/* 3. Top-3 Student Performance Summaries */}
                <div className="space-y-2 pt-2 border-t border-slate-100">
                  <span className="text-xs font-bold uppercase tracking-wider text-slate-700 block">
                    ၃။ ကျောင်းသားများ၏ သင်ယူမှုစွမ်းရည်နှင့် လိုအပ်ချက်များ (Performance & Gaps)
                  </span>
                  {retrievedStudentPerformance.length === 0 ? (
                    <p className="text-xs text-slate-400 italic">စွမ်းရည်ရလဒ် မရှိသေးပါ။</p>
                  ) : (
                    retrievedStudentPerformance.map((perf, idx) => (
                      <div
                        key={idx}
                        className="p-2.5 rounded-lg border border-slate-200 bg-white text-xs space-y-1.5"
                      >
                        <div className="flex items-center justify-between">
                          <span className="font-bold text-slate-900">{perf.competency}</span>
                          <span
                            className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                              perf.mastery_status.includes('Needs')
                                ? 'bg-amber-100 text-amber-900'
                                : 'bg-emerald-100 text-emerald-900'
                            }`}
                          >
                            {perf.mastery_status}
                          </span>
                        </div>
                        <div className="flex items-center gap-3 text-[11px] text-slate-600">
                          <span>စံနှုန်းရမှတ်: <strong>{perf.benchmark_score.toFixed(1)}%</strong></span>
                          <span>အထူးအကူအညီလိုအပ်သူ: <strong>{perf.at_risk_count}</strong></span>
                        </div>
                        <p className="text-[11px] text-indigo-900 bg-indigo-50/70 p-1.5 rounded">
                          <strong>သင်ကြားရေး လိုအပ်ချက်:</strong> {perf.pedagogical_need}
                        </p>
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}

            {/* TAB 3: OUTPUT VALIDATION REPORT */}
            {activeTab === 'validation' && (
              <div className="p-6 space-y-5">
                <div>
                  <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                    <ShieldCheck className="h-4 w-4 text-emerald-600" />
                    အရည်အသွေးနှင့် စံနှုန်းစစ်ဆေးချက် အစီရင်ခံစာ (Validation Report)
                  </h3>
                  <p className="text-xs text-slate-500">
                    ဆရာ/ဆရာမထံ မပြသမီ စံနှုန်းကိုက်ညီမှုနှင့် သင့်လျော်မှုကို စိစစ်ထားသော အစီရင်ခံစာ
                  </p>
                </div>

                {validationReport ? (
                  <div className="space-y-4">
                    {/* Overall Score Badge */}
                    <div className="flex items-center justify-between p-4 rounded-xl bg-slate-50 border border-slate-200">
                      <div>
                        <div className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                          စုစုပေါင်း စိစစ်ချက်ရမှတ် (Overall Score)
                        </div>
                        <div className="text-2xl font-black text-slate-900 mt-0.5">
                          {validationReport.overall_score}%
                        </div>
                      </div>
                      <span
                        className={`px-3 py-1 rounded-full text-xs font-extrabold uppercase tracking-wider ${
                          validationReport.overall_status === 'PASSED'
                            ? 'bg-emerald-100 text-emerald-900 border border-emerald-300'
                            : 'bg-amber-100 text-amber-900 border border-amber-300'
                        }`}
                      >
                        {validationReport.overall_status}
                      </span>
                    </div>

                    {/* 1. Curriculum Alignment Check */}
                    <div className="p-3.5 rounded-lg border border-slate-200 bg-white space-y-1 text-xs">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2 font-bold text-slate-900">
                          <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                          <span>၁။ သင်ရိုးညွှန်းတမ်း ကိုက်ညီမှု စစ်ဆေးချက် (Curriculum Alignment)</span>
                        </div>
                        <span className="font-mono font-bold text-slate-800">
                          {validationReport.curriculum_alignment.score}%
                        </span>
                      </div>
                      <p className="text-slate-600 text-[11px] pl-6">
                        {validationReport.curriculum_alignment.details}
                      </p>
                    </div>

                    {/* 2. Readability Score Check */}
                    <div className="p-3.5 rounded-lg border border-slate-200 bg-white space-y-1 text-xs">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2 font-bold text-slate-900">
                          <Scale className="h-4 w-4 text-indigo-600" />
                          <span>၂။ အတန်းအလိုက် ဖတ်ရှုနားလည်နိုင်မှု စစ်ဆေးချက် (Readability & Calibration)</span>
                        </div>
                        <span className="font-mono font-bold text-slate-800">
                          {validationReport.readability_score.score}%
                        </span>
                      </div>
                      <p className="text-slate-600 text-[11px] pl-6">
                        {validationReport.readability_score.details}
                      </p>
                    </div>

                    {/* 3. Language & Safety Filter */}
                    <div className="p-3.5 rounded-lg border border-slate-200 bg-white space-y-1 text-xs">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2 font-bold text-slate-900">
                          <ShieldCheck className="h-4 w-4 text-emerald-600" />
                          <span>၃။ ဘာသာစကားနှင့် ကလေးသူငယ် လုံခြုံမှု စစ်ဆေးချက် (Language & Child Safety)</span>
                        </div>
                        <span className="font-mono font-bold text-emerald-700 bg-emerald-100 px-1.5 py-0.5 rounded text-[10px]">
                          {validationReport.language_safety_filter.status}
                        </span>
                      </div>
                      <p className="text-slate-600 text-[11px] pl-6">
                        {validationReport.language_safety_filter.details}
                      </p>
                    </div>

                    {/* Telemetry Footer */}
                    <div className="pt-2 text-[10px] text-slate-400 font-mono flex items-center justify-between">
                      <span>စိစစ်ချိန်: {new Date(validationReport.timestamp).toLocaleTimeString()}</span>
                      <span>စနစ်ချိတ်ဆက်မှု: အဆင်သင့် (ACTIVE)</span>
                    </div>
                  </div>
                ) : (
                  <div className="text-center py-12 text-slate-400 text-xs">
                    သင်ခန်းစာ အစီအစဉ် ရေးဆွဲပြီးပါက စိစစ်ချက် အစီရင်ခံစာ ပေါ်လာပါမည်။
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* FULL SCREEN / FOCUS MODE OVERLAY */}
      {isFullScreen && displayContent && createPortal(
        <div className="fixed inset-0 z-50 !m-0 bg-slate-900/95 backdrop-blur-md flex flex-col text-slate-900 animate-in fade-in duration-200">
          {/* Focus Mode Sticky Toolbar */}
          <div className="bg-slate-900 text-white px-4 sm:px-8 py-3 flex items-center justify-between border-b border-slate-800 shadow-md">
            {/* Title & Metadata */}
            <div className="flex items-center gap-3 overflow-hidden mr-4">
              <div className="h-8 w-8 rounded-lg bg-indigo-600 flex items-center justify-center flex-shrink-0">
                <BookOpen className="h-4 w-4 text-white" />
              </div>
              <div className="truncate">
                <div className="flex items-center gap-2">
                  <h2 className="text-sm font-bold text-white truncate">
                    {currentPlan?.topic || formData.topic || 'သင်ခန်းစာ အပြည့်ကြည့်ရှုမှု (Focus View)'}
                  </h2>
                  {retrievedChunks.length > 0 && (
                    <span className="font-mono text-[10px] bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 px-2 py-0.5 rounded-full font-bold flex-shrink-0">
                      MoE [{retrievedChunks[0].standard_code}]
                    </span>
                  )}
                </div>
                <p className="text-xs text-slate-400">
                  {currentPlan?.grade_level || formData.grade_level} • {currentPlan?.subject || formData.subject} • {currentPlan?.duration_minutes || formData.duration_minutes} မိနစ်
                </p>
              </div>
            </div>

            {/* Controls */}
            <div className="flex items-center gap-2 sm:gap-3 flex-shrink-0">
              {/* Zoom Controls */}
              <div className="flex items-center bg-slate-800 rounded-lg p-1 border border-slate-700">
                <button
                  onClick={() => setTextScale((prev) => Math.max(80, prev - 10))}
                  className="p-1 rounded hover:bg-slate-700 text-slate-300 hover:text-white transition disabled:opacity-40"
                  disabled={textScale <= 80}
                  title="ချုံ့ရန် (Zoom Out)"
                >
                  <ZoomOut className="h-4 w-4" />
                </button>
                <button
                  onClick={() => setTextScale(100)}
                  className="px-2 text-xs font-mono font-medium text-slate-300 hover:text-white transition"
                  title="မူလအတိုင်း ၁၀၀% ထားရန်"
                >
                  {textScale}%
                </button>
                <button
                  onClick={() => setTextScale((prev) => Math.min(160, prev + 10))}
                  className="p-1 rounded hover:bg-slate-700 text-slate-300 hover:text-white transition disabled:opacity-40"
                  disabled={textScale >= 160}
                  title="ချဲ့ရန် (Zoom In)"
                >
                  <ZoomIn className="h-4 w-4" />
                </button>
              </div>

              {/* Language toggle */}
              <button
                onClick={toggleLanguage}
                disabled={translating || !currentPlan}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-700 bg-slate-800 hover:bg-slate-700 text-xs font-medium text-white transition disabled:opacity-50"
                title="မြန်မာ / English ပြောင်းလဲရန်"
              >
                <Languages className="h-3.5 w-3.5 text-indigo-400" />
                <span>{language === 'my' ? '🇲🇲 မြန်မာမူ' : '🇬🇧 English'}</span>
              </button>

              {/* Copy */}
              <button
                onClick={handleCopy}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-700 bg-slate-800 hover:bg-slate-700 text-xs font-medium text-white transition"
                title="သင်ခန်းစာ အကြောင်းအရာ ကူးယူမည်"
              >
                {copied ? (
                  <>
                    <Check className="h-3.5 w-3.5 text-emerald-400" />
                    <span className="text-emerald-400 font-semibold">ကူးယူပြီး</span>
                  </>
                ) : (
                  <>
                    <Copy className="h-3.5 w-3.5 text-slate-300" />
                    <span>ကူးယူမည် (Copy)</span>
                  </>
                )}
              </button>

              {/* Print */}
              <button
                onClick={() => window.print()}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-700 bg-slate-800 hover:bg-slate-700 text-xs font-medium text-white transition"
                title="ပုံနှိပ်ရန် သို့မဟုတ် PDF အဖြစ်သိမ်းရန်"
              >
                <Printer className="h-3.5 w-3.5 text-slate-300" />
                <span className="hidden sm:inline">ပုံနှိပ်မည် (Print)</span>
              </button>

              {/* Exit Full Screen */}
              <button
                onClick={() => setIsFullScreen(false)}
                className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-xs font-bold text-white transition shadow-sm cursor-pointer"
                title="မျက်နှာပြင်ပြည့်မုဒ်မှ ထွက်ရန် (Esc)"
              >
                <Minimize2 className="h-3.5 w-3.5" />
                <span>ထွက်မည် <span className="text-[10px] opacity-75 font-normal ml-0.5">(Esc)</span></span>
              </button>
            </div>
          </div>

          {/* Reading / Classroom Presentation Scroll Area */}
          <div className="flex-1 overflow-y-auto px-4 py-8 sm:px-8 md:px-12 bg-slate-950/60">
            <div className="max-w-4xl mx-auto bg-white rounded-2xl shadow-2xl p-6 sm:p-12 md:p-16 border border-slate-200">
              {/* Header inside paper */}
              <div className="border-b border-slate-200 pb-6 mb-6">
                {retrievedChunks.length > 0 && (
                  <div className="flex items-center gap-2 mb-3">
                    <ShieldCheck className="h-4 w-4 text-emerald-600 flex-shrink-0" />
                    <span className="text-xs font-semibold text-emerald-800 bg-emerald-50 px-2.5 py-1 rounded-md border border-emerald-200">
                      MoE သင်ရိုးစံနှုန်း: [{retrievedChunks[0].standard_code}] {retrievedChunks[0].unit_title}
                    </span>
                  </div>
                )}
                <div className="flex flex-wrap items-center gap-3 text-xs text-slate-500 font-medium">
                  <span className="bg-slate-100 text-slate-800 px-2.5 py-1 rounded-md font-semibold">
                    {currentPlan?.grade_level || formData.grade_level}
                  </span>
                  <span className="bg-indigo-50 text-indigo-700 px-2.5 py-1 rounded-md font-semibold">
                    {currentPlan?.subject || formData.subject}
                  </span>
                  <span className="bg-slate-100 text-slate-700 px-2.5 py-1 rounded-md">
                    ⏱️ {currentPlan?.duration_minutes || formData.duration_minutes} မိနစ်
                  </span>
                  {currentPlan?.rag_metadata?.bloom_taxonomy_target && (
                    <span className="bg-amber-50 text-amber-800 px-2.5 py-1 rounded-md border border-amber-200">
                      Bloom's Level: {currentPlan.rag_metadata.bloom_taxonomy_target}
                    </span>
                  )}
                </div>
              </div>

              {/* Render Full Scaled Content */}
              <MarkdownRenderer
                content={displayContent}
                isBurmese={language === 'my'}
                textScale={textScale}
              />

              {/* Classroom Document Footer */}
              <div className="mt-12 pt-6 border-t border-slate-200 flex flex-wrap items-center justify-between text-xs text-slate-400 gap-4">
                <span>မြန်မာ့ပညာရေး စံနှုန်းအခြေပြု AI သင်ခန်းစာ အစီအစဉ်</span>
                <button
                  onClick={() => setIsFullScreen(false)}
                  className="text-indigo-600 hover:text-indigo-800 font-semibold cursor-pointer"
                >
                  စတူဒီယိုသို့ ပြန်သွားရန် →
                </button>
              </div>
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
};

export default CopilotPage;
