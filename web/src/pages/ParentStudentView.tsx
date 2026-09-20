import React, { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { api } from '../api/client';
import { StudentOverviewResponse, StudentDTO } from '../types';
import {
  Users,
  CalendarCheck,
  ClipboardList,
  AlertCircle,
  CheckCircle2,
  Clock,
  AlertTriangle,
  Award,
  Calendar,
  Sparkles,
  ArrowRight,
} from 'lucide-react';

export const ParentStudentView: React.FC = () => {
  const { id: paramStudentId } = useParams<{ id: string }>();

  // If "demo" or missing, let's find the seeded student Alice Walker's ID or allow selecting
  const [studentId, setStudentId] = useState<string>(() => {
    if (paramStudentId && paramStudentId !== 'demo') return paramStudentId;
    return '';
  });

  const [overview, setOverview] = useState<StudentOverviewResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // If no direct studentId, let's look up classes to find a student
  useEffect(() => {
    const resolveStudent = async () => {
      if (paramStudentId && paramStudentId !== 'demo') {
        setStudentId(paramStudentId);
        return;
      }

      // Discover students from first class
      try {
        const classes = await api.classes.list();
        if (classes.length > 0) {
          const students = await api.classes.getStudents(classes[0].id);
          if (students.length > 0) {
            setStudentId(students[0].id);
            return;
          }
        }
      } catch {
        // ignore
      }
      setLoading(false);
    };

    resolveStudent();
  }, [paramStudentId]);

  useEffect(() => {
    if (!studentId) return;

    const fetchOverview = async () => {
      setLoading(true);
      setError(null);
      try {
        const data = await api.students.getOverview(studentId);
        setOverview(data);
      } catch (err: any) {
        setError(err.message || 'Failed to load student progress overview');
      } finally {
        setLoading(false);
      }
    };

    fetchOverview();
  }, [studentId]);

  const summary = overview?.attendance_summary;
  const isGoodStanding = (summary?.attendance_rate_percentage || 0) >= 90;
  const hasAbsences = (summary?.absent || 0) > 0;

  return (
    <div className="p-6 md:p-8 max-w-5xl mx-auto w-full space-y-6">
      {/* Header Banner */}
      <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-3 rounded-xl bg-emerald-50 text-emerald-600 border border-emerald-100">
            <Users className="h-6 w-6" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Parent & Student Progress Portal</h1>
            <p className="text-xs text-slate-500 font-sans">
              ကျောင်းသားတက်ရောက်မှုနှင့် အိမ်စာအခြေအနေ • Attendance & Academic Progress
            </p>
          </div>
        </div>

        {summary && (
          <div
            className={`inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full text-xs font-bold border ${
              isGoodStanding
                ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                : 'bg-amber-50 text-amber-800 border-amber-200'
            }`}
          >
            {isGoodStanding ? (
              <>
                <CheckCircle2 className="h-4 w-4 text-emerald-600" /> Good Academic Standing
              </>
            ) : (
              <>
                <AlertTriangle className="h-4 w-4 text-amber-600" /> Attendance Follow-Up Recommended
              </>
            )}
          </div>
        )}
      </div>

      {/* Error Feedback */}
      {error && (
        <div className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-xs font-medium text-rose-800 flex items-center gap-2">
          <AlertCircle className="h-4 w-4 text-rose-600 flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Loading state */}
      {loading && (
        <div className="space-y-4 animate-pulse">
          <div className="h-32 bg-slate-200 rounded-xl" />
          <div className="h-48 bg-slate-100 rounded-xl" />
        </div>
      )}

      {!loading && overview && (
        <div className="space-y-6">
          {/* Attendance Overview Card */}
          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm space-y-6">
            <div className="flex items-center justify-between border-b border-slate-100 pb-4">
              <div>
                <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
                  <CalendarCheck className="h-5 w-5 text-indigo-600" />
                  Attendance Summary & Rate
                </h2>
                <p className="text-xs text-slate-500">Cumulative attendance records across enrolled terms</p>
              </div>

              <div className="text-right">
                <span className="text-2xl md:text-3xl font-black text-indigo-600">
                  {summary?.attendance_rate_percentage || 0}%
                </span>
                <p className="text-[11px] text-slate-400 font-semibold uppercase tracking-wider">Attendance Rate</p>
              </div>
            </div>

            {/* Attendance Stat Boxes */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              <div className="rounded-xl bg-slate-50 border border-slate-200 p-4">
                <span className="text-xs font-bold uppercase tracking-wider text-slate-500">Days Present</span>
                <p className="text-2xl font-black text-emerald-600 mt-1">{summary?.present || 0}</p>
                <span className="text-[10px] text-slate-400">On-time classroom attendance</span>
              </div>

              <div className="rounded-xl bg-slate-50 border border-slate-200 p-4">
                <span className="text-xs font-bold uppercase tracking-wider text-slate-500">Absences</span>
                <p className="text-2xl font-black text-rose-600 mt-1">{summary?.absent || 0}</p>
                <span className="text-[10px] text-slate-400">
                  {hasAbsences ? 'Noted by faculty' : 'Zero unexcused absences'}
                </span>
              </div>

              <div className="rounded-xl bg-slate-50 border border-slate-200 p-4">
                <span className="text-xs font-bold uppercase tracking-wider text-slate-500">Late Arrivals</span>
                <p className="text-2xl font-black text-amber-600 mt-1">{summary?.late || 0}</p>
                <span className="text-[10px] text-slate-400">Arrived after roll call</span>
              </div>

              <div className="rounded-xl bg-slate-50 border border-slate-200 p-4">
                <span className="text-xs font-bold uppercase tracking-wider text-slate-500">Excused</span>
                <p className="text-2xl font-black text-sky-600 mt-1">{summary?.excused || 0}</p>
                <span className="text-[10px] text-slate-400">Medical / family leave</span>
              </div>
            </div>
          </div>

          {/* Pending & Upcoming Homework Card */}
          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-4">
              <div>
                <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
                  <ClipboardList className="h-5 w-5 text-indigo-600" />
                  Pending & Upcoming Homework ({overview.pending_assignments.length})
                </h2>
                <p className="text-xs text-slate-500">Assignments requiring student submission</p>
              </div>
            </div>

            {overview.pending_assignments.length === 0 ? (
              <div className="py-8 text-center bg-emerald-50/50 rounded-xl border border-emerald-100 p-6">
                <CheckCircle2 className="h-8 w-8 text-emerald-600 mx-auto mb-2" />
                <p className="text-sm font-bold text-emerald-900">All caught up! No pending homework.</p>
                <p className="text-xs text-emerald-700 mt-1">Every active assignment has been submitted.</p>
              </div>
            ) : (
              <div className="divide-y divide-slate-100">
                {overview.pending_assignments.map((item) => {
                  const dueDate = new Date(item.due_date);
                  const isUrgent = dueDate.getTime() - Date.now() < 24 * 3600 * 1000;

                  return (
                    <div key={item.id} className="py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-bold px-2 py-0.5 rounded bg-indigo-50 text-indigo-700">
                            {item.class_name}
                          </span>
                          <span className="text-xs text-slate-400">• Max {item.max_score} pts</span>
                        </div>
                        <h3 className="font-bold text-slate-900 mt-1">{item.title}</h3>
                        {item.description && (
                          <p className="text-xs text-slate-500 mt-0.5">{item.description}</p>
                        )}
                      </div>

                      <div className="flex items-center gap-3 self-end sm:self-center">
                        <div className="text-right">
                          <div
                            className={`flex items-center gap-1 text-xs font-semibold ${
                              isUrgent ? 'text-rose-600' : 'text-slate-600'
                            }`}
                          >
                            <Calendar className="h-3.5 w-3.5" /> Due {dueDate.toLocaleDateString()}
                          </div>
                          <span className="text-[10px] text-slate-400">
                            {dueDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </span>
                        </div>

                        <span className="px-2.5 py-1 rounded-full text-[11px] font-bold bg-amber-50 text-amber-700 border border-amber-200 whitespace-nowrap">
                          To Do
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
