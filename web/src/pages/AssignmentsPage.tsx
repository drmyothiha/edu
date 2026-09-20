import React, { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { api } from '../api/client';
import { AssignmentDTO, ClassDTO, CreateAssignmentRequest } from '../types';
import {
  ClipboardList,
  ArrowLeft,
  Plus,
  Calendar,
  Award,
  Clock,
  X,
  CheckCircle2,
  AlertCircle,
  FileText,
} from 'lucide-react';

export const AssignmentsPage: React.FC = () => {
  const { id: classId } = useParams<{ id: string }>();

  const [classInfo, setClassInfo] = useState<ClassDTO | null>(null);
  const [assignments, setAssignments] = useState<AssignmentDTO[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // New assignment form state
  const [newTitle, setNewTitle] = useState('');
  const [newDesc, setNewDesc] = useState('');
  const [newDueDate, setNewDueDate] = useState('');
  const [newMaxScore, setNewMaxScore] = useState(100);
  const [creating, setCreating] = useState(false);

  const fetchAssignments = async () => {
    if (!classId) return;
    setLoading(true);
    setError(null);
    try {
      const [cls, list] = await Promise.all([
        api.classes.get(classId),
        api.classes.getAssignments(classId),
      ]);
      setClassInfo(cls);
      setAssignments(list);
    } catch (err: any) {
      setError(err.message || 'Failed to fetch assignments');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAssignments();
  }, [classId]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!classId) return;
    setCreating(true);
    setError(null);
    setSuccessMsg(null);

    try {
      const payload: CreateAssignmentRequest = {
        title: newTitle.trim(),
        description: newDesc.trim(),
        due_date: new Date(newDueDate).toISOString(),
        max_score: Number(newMaxScore) || 100,
      };

      const created = await api.classes.createAssignment(classId, payload);
      setAssignments((prev) => [created, ...prev]);
      setSuccessMsg(`Assignment "${created.title}" published successfully!`);
      setModalOpen(false);

      // Reset form
      setNewTitle('');
      setNewDesc('');
      setNewDueDate('');
      setNewMaxScore(100);
    } catch (err: any) {
      setError(err.message || 'Failed to create assignment');
    } finally {
      setCreating(false);
    }
  };

  return (
    <div className="p-6 md:p-8 max-w-7xl mx-auto w-full space-y-6">
      {/* Navigation and Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <Link
            to="/teacher"
            className="inline-flex items-center gap-1 text-xs font-semibold text-indigo-600 hover:text-indigo-800 mb-2"
          >
            <ArrowLeft className="h-3.5 w-3.5" /> Back to My Classes
          </Link>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
            <ClipboardList className="h-6 w-6 text-indigo-600" />
            Class Assignment Manager
          </h1>
          {classInfo && (
            <p className="text-xs text-slate-500 mt-0.5">
              {classInfo.name} • {classInfo.grade_level} ({classInfo.academic_year})
            </p>
          )}
        </div>

        <button
          onClick={() => setModalOpen(true)}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold shadow transition"
        >
          <Plus className="h-4 w-4" /> Create Assignment
        </button>
      </div>

      {/* Feedback alerts */}
      {error && (
        <div className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-xs font-medium text-rose-800 flex items-center gap-2">
          <AlertCircle className="h-4 w-4 text-rose-600 flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {successMsg && (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-xs font-medium text-emerald-800 flex items-center gap-2">
          <CheckCircle2 className="h-4 w-4 text-emerald-600 flex-shrink-0" />
          <span>{successMsg}</span>
        </div>
      )}

      {/* Assignments Table */}
      <div className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
        {loading ? (
          <div className="p-8 text-center space-y-3">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-indigo-600 border-t-transparent mx-auto" />
            <p className="text-xs text-slate-500 font-medium">Loading assignments...</p>
          </div>
        ) : assignments.length === 0 ? (
          <div className="p-12 text-center">
            <FileText className="h-10 w-10 text-slate-300 mx-auto mb-3" />
            <p className="text-base font-bold text-slate-800">No assignments created yet</p>
            <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
              Click "Create Assignment" to schedule homework, quizzes, or lab reports for your students.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-sm">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 text-[11px] font-bold uppercase tracking-wider text-slate-500">
                  <th className="py-3.5 px-4">Title & Description</th>
                  <th className="py-3.5 px-4">Due Date</th>
                  <th className="py-3.5 px-4">Max Score</th>
                  <th className="py-3.5 px-4">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {assignments.map((a) => {
                  const dueDate = new Date(a.due_date);
                  const isPast = dueDate < new Date();

                  return (
                    <tr key={a.id} className="hover:bg-slate-50/80 transition">
                      <td className="py-4 px-4 max-w-md">
                        <div className="font-bold text-slate-900">{a.title}</div>
                        {a.description && (
                          <p className="text-xs text-slate-500 mt-1 line-clamp-2">{a.description}</p>
                        )}
                      </td>
                      <td className="py-4 px-4 whitespace-nowrap text-xs text-slate-600">
                        <div className="flex items-center gap-1.5 font-medium">
                          <Calendar className="h-3.5 w-3.5 text-indigo-500" />
                          <span>{dueDate.toLocaleDateString()}</span>
                        </div>
                        <div className="text-[10px] text-slate-400 pl-5">
                          {dueDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </div>
                      </td>
                      <td className="py-4 px-4 whitespace-nowrap">
                        <span className="inline-flex items-center gap-1 text-xs font-bold text-slate-700 bg-slate-100 px-2 py-0.5 rounded">
                          <Award className="h-3 w-3 text-amber-500" /> {a.max_score} pts
                        </span>
                      </td>
                      <td className="py-4 px-4 whitespace-nowrap">
                        <span
                          className={`text-[11px] font-bold px-2.5 py-1 rounded-full ${
                            isPast
                              ? 'bg-slate-100 text-slate-600 border border-slate-200'
                              : 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                          }`}
                        >
                          {isPast ? 'Closed' : 'Active'}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Create Assignment Modal */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-sm">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-slate-200 relative animate-in fade-in zoom-in-95 duration-150">
            <button
              onClick={() => setModalOpen(false)}
              className="absolute top-4 right-4 p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition"
            >
              <X className="h-5 w-5" />
            </button>

            <div className="flex items-center gap-2 mb-4">
              <div className="p-2 rounded-lg bg-indigo-50 text-indigo-600">
                <Plus className="h-5 w-5" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-slate-900">Create New Assignment</h3>
                <p className="text-xs text-slate-500">Post an assignment to {classInfo?.name}</p>
              </div>
            </div>

            <form onSubmit={handleCreate} className="space-y-4">
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-700">
                  Assignment Title
                </label>
                <input
                  type="text"
                  required
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  placeholder="e.g. Chapter 4 Practice Exercises"
                  className="mt-1 block w-full rounded-lg border border-slate-300 px-3.5 py-2 text-sm text-slate-900 shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-700">
                  Instructions / Description
                </label>
                <textarea
                  rows={3}
                  value={newDesc}
                  onChange={(e) => setNewDesc(e.target.value)}
                  placeholder="Provide instructions, required sections, or reading pages..."
                  className="mt-1 block w-full rounded-lg border border-slate-300 px-3.5 py-2 text-sm text-slate-900 shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-700">
                    Due Date & Time
                  </label>
                  <input
                    type="datetime-local"
                    required
                    value={newDueDate}
                    onChange={(e) => setNewDueDate(e.target.value)}
                    className="mt-1 block w-full rounded-lg border border-slate-300 px-3 py-2 text-xs text-slate-900 shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-700">
                    Max Score (Points)
                  </label>
                  <input
                    type="number"
                    min="1"
                    max="1000"
                    required
                    value={newMaxScore}
                    onChange={(e) => setNewMaxScore(parseInt(e.target.value) || 100)}
                    className="mt-1 block w-full rounded-lg border border-slate-300 px-3 py-2 text-xs text-slate-900 shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  />
                </div>
              </div>

              <div className="mt-6 flex justify-end gap-3 pt-4 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  className="px-4 py-2 rounded-lg border border-slate-300 text-xs font-bold text-slate-700 hover:bg-slate-50 transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={creating}
                  className="px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-xs font-bold text-white shadow transition disabled:opacity-50 flex items-center gap-1.5"
                >
                  {creating && <div className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-white border-t-transparent" />}
                  Publish Assignment
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
