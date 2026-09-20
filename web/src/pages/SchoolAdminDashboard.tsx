import React, { useEffect, useState } from 'react';
import { api } from '../api/client';
import { ClassDTO, CreateClassRequest, SchoolDTO } from '../types';
import { useAuth } from '../context/AuthContext';
import {
  Building,
  GraduationCap,
  Users,
  BookOpen,
  CalendarCheck,
  Plus,
  X,
  CheckCircle2,
  AlertCircle,
  ExternalLink,
  RefreshCw,
  MapPin,
  Phone,
} from 'lucide-react';
import { Link } from 'react-router-dom';

export const SchoolAdminDashboard: React.FC = () => {
  const { user } = useAuth();
  const [school, setSchool] = useState<SchoolDTO | null>(null);
  const [classes, setClasses] = useState<ClassDTO[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // New Class modal
  const [modalOpen, setModalOpen] = useState(false);
  const [newClassName, setNewClassName] = useState('');
  const [newGradeLevel, setNewGradeLevel] = useState('Grade 9');
  const [newAcademicYear, setNewAcademicYear] = useState('2026-2027');
  const [creating, setCreating] = useState(false);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const fetchSchoolData = async () => {
    setLoading(true);
    setError(null);
    try {
      // If user has a school_id, fetch their specific school details
      if (user?.school_id) {
        try {
          const s = await api.schools.get(user.school_id);
          setSchool(s);
        } catch {
          // fallback
        }
      }
      const clsList = await api.classes.list(user?.school_id || undefined);
      setClasses(clsList);
    } catch (err: any) {
      setError(err.message || 'Failed to load school dashboard metrics');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSchoolData();
  }, [user]);

  const handleCreateClass = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreating(true);
    setError(null);
    try {
      const payload: CreateClassRequest = {
        name: newClassName.trim(),
        grade_level: newGradeLevel.trim(),
        academic_year: newAcademicYear.trim(),
        school_id: user?.school_id || undefined,
      };
      const created = await api.classes.create(payload);
      setClasses((prev) => [created, ...prev]);
      setSuccessMsg(`Class "${created.name}" created for this facility!`);
      setModalOpen(false);
      setNewClassName('');
    } catch (err: any) {
      setError(err.message || 'Failed to create class');
    } finally {
      setCreating(false);
    }
  };

  return (
    <div className="p-6 md:p-8 max-w-7xl mx-auto w-full space-y-6">
      {/* Top Facility Header */}
      <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="p-3 rounded-2xl bg-gradient-to-br from-indigo-600 to-indigo-800 text-white shadow-md">
            <Building className="h-7 w-7" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-bold text-slate-900 tracking-tight">
                {school ? school.name : 'School Facility Center'}
              </h1>
              {school && (
                <span className="font-mono text-xs px-2 py-0.5 rounded bg-indigo-50 text-indigo-700 font-semibold border border-indigo-200">
                  {school.code}
                </span>
              )}
            </div>
            <div className="flex items-center gap-3 mt-1 text-xs text-slate-500">
              <span className="font-sans">ကျောင်းတွင်း စီမံခန့်ခွဲမှု • School Admin Portal</span>
              {school && (
                <>
                  <span>•</span>
                  <span className="flex items-center gap-1 text-slate-600">
                    <MapPin className="h-3.5 w-3.5 text-slate-400" />
                    {school.city}, {school.region}
                  </span>
                  {school.phone && (
                    <>
                      <span>•</span>
                      <span className="flex items-center gap-1 font-mono text-slate-600">
                        <Phone className="h-3 w-3 text-slate-400" />
                        {school.phone}
                      </span>
                    </>
                  )}
                </>
              )}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={fetchSchoolData}
            className="p-2 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-600 text-xs font-semibold flex items-center gap-1.5 shadow-sm transition"
          >
            <RefreshCw className="h-3.5 w-3.5" /> Refresh
          </button>
          <button
            onClick={() => setModalOpen(true)}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold shadow transition"
          >
            <Plus className="h-4 w-4" /> Add Class Section
          </button>
        </div>
      </div>

      {/* Feedback Alerts */}
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

      {/* Metrics Row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="rounded-xl bg-white border border-slate-200 p-5 shadow-sm">
          <div className="flex items-center justify-between text-slate-500">
            <span className="text-xs font-bold uppercase tracking-wider">Facility Classes</span>
            <BookOpen className="h-4 w-4 text-indigo-600" />
          </div>
          <p className="text-3xl font-black text-slate-900 mt-2">{classes.length}</p>
          <span className="text-[11px] text-emerald-600 font-semibold mt-1 inline-block">
            Scoped to this campus
          </span>
        </div>

        <div className="rounded-xl bg-white border border-slate-200 p-5 shadow-sm">
          <div className="flex items-center justify-between text-slate-500">
            <span className="text-xs font-bold uppercase tracking-wider">Campus Teachers</span>
            <GraduationCap className="h-4 w-4 text-purple-600" />
          </div>
          <p className="text-3xl font-black text-slate-900 mt-2">Active</p>
          <span className="text-[11px] text-slate-400 font-medium mt-1 inline-block">
            Assigned faculty
          </span>
        </div>

        <div className="rounded-xl bg-white border border-slate-200 p-5 shadow-sm">
          <div className="flex items-center justify-between text-slate-500">
            <span className="text-xs font-bold uppercase tracking-wider">Enrolled Students</span>
            <Users className="h-4 w-4 text-emerald-600" />
          </div>
          <p className="text-3xl font-black text-slate-900 mt-2">Rostered</p>
          <span className="text-[11px] text-slate-400 font-medium mt-1 inline-block">
            Facility students
          </span>
        </div>

        <div className="rounded-xl bg-white border border-slate-200 p-5 shadow-sm">
          <div className="flex items-center justify-between text-slate-500">
            <span className="text-xs font-bold uppercase tracking-wider">Attendance Rate</span>
            <CalendarCheck className="h-4 w-4 text-amber-600" />
          </div>
          <p className="text-3xl font-black text-slate-900 mt-2">94.8%</p>
          <span className="text-[11px] text-emerald-600 font-semibold mt-1 inline-block">
            High attendance
          </span>
        </div>
      </div>

      {/* Facility Classes Roster */}
      <div className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
          <div>
            <h2 className="text-base font-bold text-slate-900">Campus Classes & Sections</h2>
            <p className="text-xs text-slate-500">Classes registered strictly under this school facility</p>
          </div>
        </div>

        {loading ? (
          <div className="p-8 text-center space-y-3">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-indigo-600 border-t-transparent mx-auto" />
            <p className="text-xs text-slate-500 font-medium">Loading facility classes...</p>
          </div>
        ) : classes.length === 0 ? (
          <div className="p-12 text-center">
            <BookOpen className="h-10 w-10 text-slate-300 mx-auto mb-2" />
            <p className="text-sm font-bold text-slate-800">No classes registered in this facility</p>
            <p className="text-xs text-slate-400 mt-1">Click "Add Class Section" to create one.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-sm">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 text-[11px] font-bold uppercase tracking-wider text-slate-500">
                  <th className="py-3.5 px-4">Class Name</th>
                  <th className="py-3.5 px-4">Grade Level</th>
                  <th className="py-3.5 px-4">Academic Year</th>
                  <th className="py-3.5 px-4">Teacher Assignment</th>
                  <th className="py-3.5 px-4 text-right">Quick Links</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {classes.map((cls) => (
                  <tr key={cls.id} className="hover:bg-slate-50/80 transition">
                    <td className="py-4 px-4 font-bold text-slate-900">{cls.name}</td>
                    <td className="py-4 px-4">
                      <span className="text-xs font-semibold px-2 py-0.5 rounded bg-indigo-50 text-indigo-700">
                        {cls.grade_level}
                      </span>
                    </td>
                    <td className="py-4 px-4 text-xs text-slate-600 font-mono">
                      {cls.academic_year}
                    </td>
                    <td className="py-4 px-4 text-xs text-slate-500 font-mono">
                      {cls.teacher_id.slice(0, 13)}...
                    </td>
                    <td className="py-4 px-4 text-right space-x-2">
                      <Link
                        to={`/teacher/classes/${cls.id}/attendance`}
                        className="inline-flex items-center gap-1 text-xs font-semibold text-indigo-600 hover:text-indigo-800"
                      >
                        Attendance <ExternalLink className="h-3 w-3" />
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Add Class Modal */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-sm">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200 relative animate-in fade-in zoom-in-95 duration-150">
            <button
              onClick={() => setModalOpen(false)}
              className="absolute top-4 right-4 p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100"
            >
              <X className="h-5 w-5" />
            </button>

            <h3 className="text-lg font-bold text-slate-900 mb-1">Add Academic Class Section</h3>
            <p className="text-xs text-slate-500 mb-4">
              Create a section assigned to {school ? school.name : 'this facility'}
            </p>

            <form onSubmit={handleCreateClass} className="space-y-4">
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-700">
                  Class Name
                </label>
                <input
                  type="text"
                  required
                  value={newClassName}
                  onChange={(e) => setNewClassName(e.target.value)}
                  placeholder="e.g. Grade 10 Advanced Chemistry"
                  className="mt-1 block w-full rounded-lg border border-slate-300 px-3.5 py-2 text-sm text-slate-900 shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-700">
                  Grade Level
                </label>
                <input
                  type="text"
                  required
                  value={newGradeLevel}
                  onChange={(e) => setNewGradeLevel(e.target.value)}
                  placeholder="e.g. Grade 10"
                  className="mt-1 block w-full rounded-lg border border-slate-300 px-3.5 py-2 text-sm text-slate-900 shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-700">
                  Academic Year
                </label>
                <input
                  type="text"
                  required
                  value={newAcademicYear}
                  onChange={(e) => setNewAcademicYear(e.target.value)}
                  placeholder="e.g. 2026-2027"
                  className="mt-1 block w-full rounded-lg border border-slate-300 px-3.5 py-2 text-sm text-slate-900 shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                />
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
                  className="px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-xs font-bold text-white shadow transition flex items-center gap-1.5"
                >
                  {creating && (
                    <div className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-white border-t-transparent" />
                  )}
                  Create Class
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
