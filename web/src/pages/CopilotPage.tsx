import React, { useState, useEffect } from 'react';
import { api } from '../api/client';
import { LessonPlanRequest, LessonPlanResponse } from '../types';
import {
  Sparkles,
  Copy,
  Check,
  Bookmark,
  Clock,
  BookOpen,
  FileText,
  RefreshCw,
  AlertCircle,
  ChevronRight,
} from 'lucide-react';

// Lightweight crisp Markdown renderer for lesson plan preview
const MarkdownRenderer: React.FC<{ content: string }> = ({ content }) => {
  const lines = content.split('\n');

  return (
    <div className="space-y-3 font-sans text-slate-800 leading-relaxed text-sm">
      {lines.map((line, idx) => {
        const trimmed = line.trim();

        if (trimmed.startsWith('# ')) {
          return (
            <h1 key={idx} className="text-xl md:text-2xl font-bold text-slate-900 pt-2 pb-1 border-b border-slate-200">
              {trimmed.slice(2)}
            </h1>
          );
        }
        if (trimmed.startsWith('## ')) {
          return (
            <h2 key={idx} className="text-lg font-bold text-indigo-900 pt-3 pb-1 border-b border-indigo-100 flex items-center gap-2">
              {trimmed.slice(3)}
            </h2>
          );
        }
        if (trimmed.startsWith('### ')) {
          return (
            <h3 key={idx} className="text-base font-semibold text-slate-800 pt-2">
              {trimmed.slice(4)}
            </h3>
          );
        }
        if (trimmed.startsWith('- ') || trimmed.startsWith('* ')) {
          // Parse bold within list item
          const itemText = trimmed.slice(2);
          const formatted = parseBold(itemText);
          return (
            <div key={idx} className="flex items-start gap-2 pl-2">
              <span className="text-indigo-600 font-bold mt-0.5">•</span>
              <span className="flex-1">{formatted}</span>
            </div>
          );
        }
        if (trimmed === '') {
          return <div key={idx} className="h-2" />;
        }

        return <p key={idx}>{parseBold(trimmed)}</p>;
      })}
    </div>
  );
};

function parseBold(text: string): React.ReactNode {
  const parts = text.split(/(\*\*.*?\*\*)/g);
  return parts.map((part, i) => {
    if (part.startsWith('**') && part.endsWith('**')) {
      return <strong key={i} className="font-semibold text-slate-900">{part.slice(2, -2)}</strong>;
    }
    return part;
  });
}

export const CopilotPage: React.FC = () => {
  const [formData, setFormData] = useState<LessonPlanRequest>({
    subject: 'Mathematics',
    grade_level: 'Grade 8',
    topic: 'Pythagorean Theorem & Real-World Applications',
    duration_minutes: 45,
  });

  const [generating, setGenerating] = useState(false);
  const [currentPlan, setCurrentPlan] = useState<LessonPlanResponse | null>(null);
  const [history, setHistory] = useState<LessonPlanResponse[]>([]);
  const [copied, setCopied] = useState(false);
  const [savedSuccess, setSavedSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Load history on mount
  const loadHistory = async () => {
    try {
      const list = await api.copilot.listLessonPlans();
      setHistory(list);
      if (list.length > 0 && !currentPlan) {
        setCurrentPlan(list[0]);
      }
    } catch {
      // ignore
    }
  };

  useEffect(() => {
    loadHistory();
  }, []);

  const handleGenerate = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setGenerating(true);
    setCopied(false);
    setSavedSuccess(false);

    try {
      const plan = await api.copilot.generateLessonPlan(formData);
      setCurrentPlan(plan);
      setHistory((prev) => [plan, ...prev.filter((p) => p.id !== plan.id)]);
      setSavedSuccess(true);
    } catch (err: any) {
      setError(err.message || 'Failed to generate lesson plan');
    } finally {
      setGenerating(false);
    }
  };

  const handleCopy = () => {
    if (currentPlan) {
      navigator.clipboard.writeText(currentPlan.generated_markdown);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    }
  };

  const setPreset = (subject: string, grade: string, topic: string, duration: number) => {
    setFormData({
      subject,
      grade_level: grade,
      topic,
      duration_minutes: duration,
    });
  };

  return (
    <div className="p-6 md:p-8 max-w-7xl mx-auto w-full space-y-6">
      {/* Page Title */}
      <div>
        <div className="flex items-center gap-2">
          <div className="p-2 rounded-lg bg-indigo-600 text-white shadow-sm">
            <Sparkles className="h-5 w-5 text-amber-300" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-slate-900 tracking-tight">AI Teacher Copilot</h1>
            <p className="text-xs text-slate-500 font-sans">
              သင်ရိုးညွှန်းတမ်းနှင့် ကိုက်ညီသော သင်ခန်းစာ အစီအစဉ် ရေးဆွဲစနစ် • Curriculum-Aligned Lesson Generator
            </p>
          </div>
        </div>
      </div>

      {/* Two Pane Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left Pane: Form (5 Cols) */}
        <div className="lg:col-span-5 space-y-4">
          <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
            <h2 className="text-base font-bold text-slate-900 mb-1">Lesson Parameters</h2>
            <p className="text-xs text-slate-500 mb-4">
              Enter target details to generate structured pedagogical plans.
            </p>

            {/* Quick Presets */}
            <div className="mb-4">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 block mb-2">
                Quick Subject Presets
              </span>
              <div className="flex flex-wrap gap-1.5">
                <button
                  type="button"
                  onClick={() => setPreset('Mathematics', 'Grade 8', 'Pythagorean Theorem', 45)}
                  className="text-xs px-2.5 py-1 rounded-md bg-slate-100 hover:bg-indigo-50 hover:text-indigo-700 text-slate-700 transition font-medium border border-slate-200"
                >
                  📐 Math (Grade 8)
                </button>
                <button
                  type="button"
                  onClick={() => setPreset('General Science', 'Grade 9', 'Photosynthesis & Cellular Respiration', 50)}
                  className="text-xs px-2.5 py-1 rounded-md bg-slate-100 hover:bg-indigo-50 hover:text-indigo-700 text-slate-700 transition font-medium border border-slate-200"
                >
                  🔬 Science (Grade 9)
                </button>
                <button
                  type="button"
                  onClick={() => setPreset('English Literature', 'Grade 7', 'Writing Persuasive Essays', 40)}
                  className="text-xs px-2.5 py-1 rounded-md bg-slate-100 hover:bg-indigo-50 hover:text-indigo-700 text-slate-700 transition font-medium border border-slate-200"
                >
                  📖 English (Grade 7)
                </button>
              </div>
            </div>

            <form onSubmit={handleGenerate} className="space-y-4">
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-700">
                  Subject Name
                </label>
                <input
                  type="text"
                  required
                  value={formData.subject}
                  onChange={(e) => setFormData({ ...formData, subject: e.target.value })}
                  placeholder="e.g. Mathematics"
                  className="mt-1 block w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-700">
                    Grade Level
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.grade_level}
                    onChange={(e) => setFormData({ ...formData, grade_level: e.target.value })}
                    placeholder="e.g. Grade 8"
                    className="mt-1 block w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-700">
                    Duration (Minutes)
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
                  Core Topic / Standard
                </label>
                <textarea
                  rows={3}
                  required
                  value={formData.topic}
                  onChange={(e) => setFormData({ ...formData, topic: e.target.value })}
                  placeholder="e.g. Solve right triangles using Pythagorean formula"
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
                className="w-full flex items-center justify-center gap-2 rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-bold text-white shadow hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 disabled:opacity-60 transition"
              >
                {generating ? (
                  <>
                    <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                    Generating Curriculum Plan...
                  </>
                ) : (
                  <>
                    <Sparkles className="h-4 w-4 text-amber-300" /> Generate Lesson Plan
                  </>
                )}
              </button>
            </form>
          </div>

          {/* Previous Lesson Plans List */}
          {history.length > 0 && (
            <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-2">
                Saved Lesson Plans ({history.length})
              </h3>
              <div className="space-y-1.5 max-h-56 overflow-y-auto">
                {history.map((h) => (
                  <button
                    key={h.id}
                    onClick={() => setCurrentPlan(h)}
                    className={`w-full text-left p-2 rounded-lg text-xs transition flex items-center justify-between border ${
                      currentPlan?.id === h.id
                        ? 'bg-indigo-50 border-indigo-200 text-indigo-900 font-semibold'
                        : 'hover:bg-slate-50 border-transparent text-slate-700'
                    }`}
                  >
                    <div className="truncate pr-2">
                      <p className="truncate font-medium">{h.topic}</p>
                      <p className="text-[10px] text-slate-400">{h.subject} • {h.grade_level}</p>
                    </div>
                    <ChevronRight className="h-3.5 w-3.5 text-slate-400 flex-shrink-0" />
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Right Pane: Markdown Preview (7 Cols) */}
        <div className="lg:col-span-7">
          <div className="rounded-xl border border-slate-200 bg-white shadow-sm flex flex-col min-h-[580px]">
            {/* Header / Actions Bar */}
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/70 rounded-t-xl">
              <div>
                <h2 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                  <FileText className="h-4 w-4 text-indigo-600" /> Lesson Plan Preview
                </h2>
                {currentPlan && (
                  <p className="text-[11px] text-slate-500">
                    {currentPlan.subject} • {currentPlan.grade_level} • {currentPlan.duration_minutes} mins
                  </p>
                )}
              </div>

              {currentPlan && (
                <div className="flex items-center gap-2">
                  <button
                    onClick={handleCopy}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 text-xs font-semibold shadow-sm transition"
                  >
                    {copied ? (
                      <>
                        <Check className="h-3.5 w-3.5 text-emerald-600" /> Copied!
                      </>
                    ) : (
                      <>
                        <Copy className="h-3.5 w-3.5" /> Copy Markdown
                      </>
                    )}
                  </button>

                  <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-emerald-50 text-emerald-800 border border-emerald-200 text-xs font-medium">
                    <Bookmark className="h-3.5 w-3.5 text-emerald-600" /> Saved
                  </span>
                </div>
              )}
            </div>

            {/* Content Area */}
            <div className="p-6 flex-1 overflow-y-auto max-h-[750px]">
              {/* Skeleton loading state */}
              {generating && (
                <div className="space-y-4 animate-pulse">
                  <div className="h-7 bg-indigo-100 rounded w-3/4" />
                  <div className="space-y-2 pt-4">
                    <div className="h-4 bg-slate-200 rounded w-1/4" />
                    <div className="h-4 bg-slate-100 rounded w-full" />
                    <div className="h-4 bg-slate-100 rounded w-5/6" />
                  </div>
                  <div className="space-y-2 pt-4">
                    <div className="h-4 bg-slate-200 rounded w-1/3" />
                    <div className="h-16 bg-slate-100 rounded w-full" />
                  </div>
                  <div className="space-y-2 pt-4">
                    <div className="h-4 bg-slate-200 rounded w-1/2" />
                    <div className="h-24 bg-slate-100 rounded w-full" />
                  </div>
                </div>
              )}

              {/* Rendered plan */}
              {!generating && currentPlan && (
                <MarkdownRenderer content={currentPlan.generated_markdown} />
              )}

              {/* Empty placeholder */}
              {!generating && !currentPlan && (
                <div className="flex flex-col items-center justify-center h-full min-h-[400px] text-center p-8">
                  <div className="h-12 w-12 rounded-full bg-indigo-50 flex items-center justify-center text-indigo-600 mb-3">
                    <Sparkles className="h-6 w-6" />
                  </div>
                  <h3 className="text-base font-bold text-slate-800">No lesson plan generated yet</h3>
                  <p className="mt-1 text-xs text-slate-500 max-w-sm">
                    Fill in the form on the left or select a quick preset, then click "Generate Lesson Plan" to create a standard Common Core aligned breakdown.
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
