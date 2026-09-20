import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api/client';
import { ClassDTO } from '../types';
import { useAuth } from '../context/AuthContext';
import {
  BookOpen,
  CalendarCheck,
  ClipboardList,
  Sparkles,
  Plus,
  Users,
  GraduationCap,
  ArrowRight,
  RefreshCw,
} from 'lucide-react';

export const TeacherDashboard: React.FC = () => {
  const { user } = useAuth();
  const [classes, setClasses] = useState<ClassDTO[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchClasses = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await api.classes.list(user?.id);
      setClasses(data);
    } catch (err: any) {
      setError(err.message || 'Failed to load classes');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchClasses();
  }, [user?.id]);

  return (
    <div className="p-6 md:p-8 max-w-7xl mx-auto w-full space-y-6">
      {/* Top Banner / Welcome */}
      <div className="bg-gradient-to-r from-indigo-900 via-indigo-800 to-slate-900 rounded-2xl p-6 md:p-8 text-white shadow-sm flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
        <div>
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-indigo-500/30 text-indigo-200 border border-indigo-400/30 mb-3">
            <Sparkles className="h-3.5 w-3.5 text-amber-300" /> AI-Powered Education Suite
          </span>
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight">
            Welcome back, {user?.full_name}
          </h1>
          <p className="mt-1 text-slate-300 text-sm max-w-xl">
            Manage your daily class attendance rosters, distribute assignments, and generate curriculum-aligned lesson plans with AI.
          </p>
        </div>
        <Link
          to="/teacher/copilot"
          className="inline-flex items-center gap-2 rounded-xl bg-white text-indigo-900 px-5 py-3 text-sm font-bold shadow-md hover:bg-slate-100 transition whitespace-nowrap"
        >
          <Sparkles className="h-4 w-4 text-indigo-600" /> Open AI Lesson Copilot
        </Link>
      </div>

      {/* Classes Header & Actions */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-slate-900 flex items-center gap-2">
            <BookOpen className="h-5 w-5 text-indigo-600" /> My Assigned Classes
          </h2>
          <p className="text-xs text-slate-500 font-sans">
            သင်ကြားရမည့် အတန်းများ • Active teaching sections
          </p>
        </div>
        <button
          onClick={fetchClasses}
          className="p-2 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-600 text-xs font-medium flex items-center gap-1.5"
          title="Refresh"
        >
          <RefreshCw className="h-3.5 w-3.5" /> Refresh
        </button>
      </div>

      {/* Loading & Error States */}
      {loading && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {[1, 2, 3].map((n) => (
            <div key={n} className="rounded-xl border border-slate-200 bg-white p-5 animate-pulse space-y-4">
              <div className="h-5 bg-slate-200 rounded w-2/3" />
              <div className="h-4 bg-slate-100 rounded w-1/3" />
              <div className="h-10 bg-slate-100 rounded mt-4" />
            </div>
          ))}
        </div>
      )}

      {error && (
        <div className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-800 flex items-center justify-between">
          <span>{error}</span>
          <button onClick={fetchClasses} className="font-semibold underline">Retry</button>
        </div>
      )}

      {/* Empty State */}
      {!loading && !error && classes.length === 0 && (
        <div className="rounded-2xl border-2 border-dashed border-slate-300 bg-white p-12 text-center">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-indigo-50 text-indigo-600 mb-3">
            <GraduationCap className="h-6 w-6" />
          </div>
          <h3 className="text-base font-bold text-slate-900">No classes assigned yet</h3>
          <p className="mt-1 text-sm text-slate-500 max-w-sm mx-auto">
            Contact your school administrator or run the seed script to populate sample classes and students.
          </p>
        </div>
      )}

      {/* Class Cards Grid */}
      {!loading && classes.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {classes.map((cls) => (
            <div
              key={cls.id}
              className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm hover:shadow-md transition flex flex-col justify-between"
            >
              <div>
                <div className="flex items-start justify-between">
                  <span className="text-xs font-semibold px-2.5 py-1 rounded-md bg-indigo-50 text-indigo-700 border border-indigo-100">
                    {cls.grade_level}
                  </span>
                  <span className="text-xs text-slate-500 font-mono">
                    {cls.academic_year}
                  </span>
                </div>
                <h3 className="text-lg font-bold text-slate-900 mt-3">{cls.name}</h3>
                <p className="text-xs text-slate-500 mt-1">Class ID: {cls.id.slice(0, 8)}...</p>
              </div>

              <div className="mt-6 pt-4 border-t border-slate-100 flex flex-col gap-2">
                <div className="grid grid-cols-2 gap-2">
                  <Link
                    to={`/teacher/classes/${cls.id}/attendance`}
                    className="inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg bg-emerald-50 hover:bg-emerald-100 text-emerald-800 text-xs font-semibold transition border border-emerald-200"
                  >
                    <CalendarCheck className="h-3.5 w-3.5" /> Attendance
                  </Link>
                  <Link
                    to={`/teacher/classes/${cls.id}/assignments`}
                    className="inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg bg-indigo-50 hover:bg-indigo-100 text-indigo-800 text-xs font-semibold transition border border-indigo-200"
                  >
                    <ClipboardList className="h-3.5 w-3.5" /> Assignments
                  </Link>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
