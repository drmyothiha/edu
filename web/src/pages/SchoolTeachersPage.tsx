import React, { useEffect, useState, useMemo } from 'react';
import { api } from '../api/client';
import { SchoolDTO, FacultyMemberDTO, CreateTeacherRequest, UpdateTeacherRequest } from '../types';
import { useAuth } from '../context/AuthContext';
import {
  Building,
  Users,
  Plus,
  X,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  MapPin,
  Phone,
  Trash2,
  Search,
  ShieldCheck,
  Edit2,
  ArrowRightLeft,
  GraduationCap,
  Mail,
  UserCheck,
} from 'lucide-react';
import { useSearchParams, Link } from 'react-router-dom';
import { useSchoolCache } from '../hooks/useSchoolCache';
import { SchoolSwitcherModal } from '../components/SchoolSwitcherModal';

export const SchoolTeachersPage: React.FC = () => {
  const { user } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const urlSchoolId = searchParams.get('school_id');

  const [editModalOpen, setEditModalOpen] = useState(false);
  const { schools: allSchools } = useSchoolCache({ autoFetch: editModalOpen });
  const [school, setSchool] = useState<SchoolDTO | null>(null);
  const [teachers, setTeachers] = useState<FacultyMemberDTO[]>([]);
  const [loading, setLoading] = useState(true);
  const [switcherOpen, setSwitcherOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Search & Filter
  const [searchTerm, setSearchTerm] = useState('');
  const [roleFilter, setRoleFilter] = useState<'ALL' | 'teacher' | 'school_admin'>('ALL');

  // Add Teacher Modal
  const [addModalOpen, setAddModalOpen] = useState(false);
  const [newFullName, setNewFullName] = useState('');
  const [newEmail, setNewEmail] = useState('');
  const [newPassword, setNewPassword] = useState('Teacher123!');
  const [newRole, setNewRole] = useState<'teacher' | 'school_admin'>('teacher');
  const [creating, setCreating] = useState(false);

  // Edit / Transfer Modal
  const [editingTeacher, setEditingTeacher] = useState<FacultyMemberDTO | null>(null);
  const [editFullName, setEditFullName] = useState('');
  const [editEmail, setEditEmail] = useState('');
  const [transferSchoolId, setTransferSchoolId] = useState('');
  const [updating, setUpdating] = useState(false);

  // Delete Action
  const [deletingId, setDeletingId] = useState<string | null>(null);

  // Determine effective school ID
  const effectiveSchoolId = useMemo(() => {
    if (urlSchoolId) return urlSchoolId;
    if (user?.school_id) return user.school_id;
    return 'a0000000-0000-0000-0000-000000000001';
  }, [urlSchoolId, user?.school_id]);

  // Fetch school data & teachers list
  const fetchTeachersData = async () => {
    setLoading(true);
    setError(null);
    try {
      if (effectiveSchoolId) {
        try {
          const s = await api.schools.get(effectiveSchoolId);
          setSchool(s);
        } catch {
          // fallback
        }

        const facultyList = await api.schools.getFaculty(effectiveSchoolId);
        setTeachers(facultyList);
      }
    } catch (err: any) {
      setError(err.message || 'ဆရာ/ဆရာမများ စာရင်း ရယူရာတွင် အမှားဖြစ်ပေါ်ပါသည်');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTeachersData();
  }, [effectiveSchoolId, user]);

  // Handle Add Teacher
  const handleCreateTeacher = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newFullName.trim()) {
      setError('ဆရာ/ဆရာမ အမည် ထည့်သွင်းပေးပါ');
      return;
    }
    setCreating(true);
    setError(null);
    try {
      const payload: CreateTeacherRequest = {
        full_name: newFullName.trim(),
        email: newEmail.trim() || undefined as any,
        password: newPassword.trim() || 'Teacher123!',
        role: newRole,
        school_id: effectiveSchoolId,
      };

      const created = await api.schools.createTeacher(effectiveSchoolId, payload);
      setTeachers((prev) => [...prev, created]);
      setSuccessMsg(`ဆရာ/ဆရာမ "${created.full_name}" အား အောင်မြင်စွာ ထည့်သွင်းပြီးပါပြီ။`);
      setAddModalOpen(false);
      setNewFullName('');
      setNewEmail('');
      setNewPassword('Teacher123!');
      setNewRole('teacher');
    } catch (err: any) {
      setError(err.message || 'ဆရာ/ဆရာမ အသစ် ထည့်သွင်းခြင်း မအောင်မြင်ပါ');
    } finally {
      setCreating(false);
    }
  };

  // Open Edit / Transfer Modal
  const openEditModal = (t: FacultyMemberDTO) => {
    setEditingTeacher(t);
    setEditFullName(t.full_name);
    setEditEmail(t.email);
    setTransferSchoolId(t.school_id || effectiveSchoolId);
    setEditModalOpen(true);
  };

  // Handle Update / Transfer
  const handleUpdateTeacher = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingTeacher) return;
    if (!editFullName.trim()) {
      setError('ဆရာ/ဆရာမ အမည် ထည့်သွင်းပေးပါ');
      return;
    }

    setUpdating(true);
    setError(null);
    try {
      const isTransfer = transferSchoolId && transferSchoolId !== effectiveSchoolId;
      const payload: UpdateTeacherRequest = {
        full_name: editFullName.trim(),
        email: editEmail.trim(),
        school_id: transferSchoolId || effectiveSchoolId,
      };

      const updated = await api.schools.updateTeacher(effectiveSchoolId, editingTeacher.id, payload);

      if (isTransfer) {
        // Remove from current school list as transferred
        setTeachers((prev) => prev.filter((t) => t.id !== editingTeacher.id));
        setSuccessMsg(`ဆရာ/ဆရာမ "${updated.full_name}" အား အခြားကျောင်းသို့ အောင်မြင်စွာ ပြောင်းရွှေ့ပြီးပါပြီ။`);
      } else {
        // Update in place
        setTeachers((prev) => prev.map((t) => (t.id === updated.id ? updated : t)));
        setSuccessMsg(`ဆရာ/ဆရာမ "${updated.full_name}" အချက်အလက်များ အောင်မြင်စွာ ပြင်ဆင်ပြီးပါပြီ။`);
      }
      setEditModalOpen(false);
      setEditingTeacher(null);
    } catch (err: any) {
      setError(err.message || 'ဆရာ/ဆရာမ အချက်အလက် ပြင်ဆင်ခြင်း မအောင်မြင်ပါ');
    } finally {
      setUpdating(false);
    }
  };

  // Handle Delete Teacher
  const handleDeleteTeacher = async (teacher: FacultyMemberDTO) => {
    if (!window.confirm(`ဆရာ/ဆရာမ "${teacher.full_name}" အား စာရင်းမှ ပယ်ဖျက်ရန် သေချာပါသလား?`)) {
      return;
    }

    setDeletingId(teacher.id);
    setError(null);
    try {
      await api.schools.deleteTeacher(effectiveSchoolId, teacher.id);
      setTeachers((prev) => prev.filter((t) => t.id !== teacher.id));
      setSuccessMsg(`ဆရာ/ဆရာမ "${teacher.full_name}" အား ပယ်ဖျက်ပြီးပါပြီ။`);
    } catch (err: any) {
      setError(err.message || 'ဆရာ/ဆရာမ ပယ်ဖျက်ခြင်း မအောင်မြင်ပါ');
    } finally {
      setDeletingId(null);
    }
  };

  // Filter teachers
  const filteredTeachers = useMemo(() => {
    return teachers.filter((t) => {
      if (roleFilter !== 'ALL' && t.role !== roleFilter) {
        return false;
      }
      if (searchTerm) {
        const term = searchTerm.toLowerCase();
        const matchesName = t.full_name.toLowerCase().includes(term);
        const matchesEmail = t.email.toLowerCase().includes(term);
        const matchesClasses = t.assigned_classes?.some((c) => c.toLowerCase().includes(term));
        return matchesName || matchesEmail || matchesClasses;
      }
      return true;
    });
  }, [teachers, roleFilter, searchTerm]);

  return (
    <div className="p-6 md:p-8 max-w-7xl mx-auto w-full space-y-6">
      {/* Top Facility Header & School Switcher */}
      <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="p-3.5 rounded-2xl bg-gradient-to-br from-indigo-600 to-indigo-800 text-white shadow-md">
            <Building className="h-7 w-7" />
          </div>
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-2xl font-black text-slate-900 tracking-tight">
                {school ? (school.name_my || school.name) : 'School Facility Center'}
              </h1>
              {school && (
                <span className="font-mono text-xs px-2.5 py-0.5 rounded-full bg-indigo-50 text-indigo-700 font-bold border border-indigo-200">
                  {school.code}
                </span>
              )}
              <span className="inline-flex items-center gap-1 font-mono text-[11px] px-2 py-0.5 rounded bg-emerald-50 text-emerald-700 font-semibold border border-emerald-200">
                <ShieldCheck className="h-3 w-3 text-emerald-600" /> Facility Isolated
              </span>
            </div>

            <div className="flex flex-wrap items-center gap-3 mt-1.5 text-xs text-slate-500">
              <span className="font-sans font-medium text-slate-700">ကျောင်းတွင်း ဆရာ/ဆရာမများ စီမံခန့်ခွဲမှု • Faculty & Teachers Portal</span>
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

        {/* Facility Actions & Multi-School Switcher */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Fast IndexedDB School Switcher for sysadmin or admin */}
          {(user?.role === 'sysadmin' || user?.role === 'admin') && (
            <>
              <button
                type="button"
                onClick={() => setSwitcherOpen(true)}
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-indigo-200 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 text-xs font-semibold shadow-sm transition"
                title="Switch School Facility via IndexedDB Directory"
              >
                <Building className="h-3.5 w-3.5 text-indigo-600" /> ကျောင်းပြောင်းရန် (Switch School)
              </button>
              <Link
                to="/sysadmin"
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs font-semibold shadow-sm transition"
                title="Return to Sysadmin Schools Directory"
              >
                ကျောင်းများ စာရင်း (Schools)
              </Link>
            </>
          )}

          <button
            onClick={fetchTeachersData}
            className="p-2 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-600 text-xs font-semibold flex items-center gap-1.5 shadow-sm transition"
            title="Refresh faculty list"
          >
            <RefreshCw className="h-3.5 w-3.5" /> ပြန်လည်ရယူရန်
          </button>

          <button
            onClick={() => setAddModalOpen(true)}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold shadow transition"
          >
            <Plus className="h-4 w-4" /> ဆရာ/ဆရာမ အသစ်ထည့်ရန်
          </button>
        </div>
      </div>

      {/* Feedback Alerts */}
      {error && (
        <div className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-xs font-medium text-rose-800 flex items-center justify-between gap-2 shadow-sm animate-in fade-in duration-200">
          <div className="flex items-center gap-2">
            <AlertCircle className="h-4 w-4 text-rose-600 flex-shrink-0" />
            <span>{error}</span>
          </div>
          <button onClick={() => setError(null)} className="text-rose-500 hover:text-rose-700">
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {successMsg && (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-xs font-medium text-emerald-800 flex items-center justify-between gap-2 shadow-sm animate-in fade-in duration-200">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4 text-emerald-600 flex-shrink-0" />
            <span>{successMsg}</span>
          </div>
          <button onClick={() => setSuccessMsg(null)} className="text-emerald-500 hover:text-emerald-700">
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {/* Teachers List Section */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        {/* Filter bar */}
        <div className="p-4 sm:p-5 border-b border-slate-100 flex flex-col sm:flex-row items-center justify-between gap-4 bg-slate-50/50">
          <div className="flex items-center gap-2 w-full sm:w-auto">
            <div className="p-2 rounded-lg bg-indigo-100 text-indigo-700">
              <Users className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900">
                ဆရာ/ဆရာမများ စာရင်း ({filteredTeachers.length})
              </h2>
              <p className="text-xs text-slate-500">
                ဤကျောင်းတွင် တာဝန်ကျနေသော ဆရာ/ဆရာမများနှင့် စီမံခန့်ခွဲသူများ
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2.5 w-full sm:w-auto justify-end">
            {/* Search Box */}
            <div className="relative w-full sm:w-64">
              <Search className="h-4 w-4 text-slate-400 absolute left-3 top-2.5" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="အမည်၊ အီးမေးလ်၊ အတန်း ဖြင့်ရှာရန်..."
                className="w-full pl-9 pr-3 py-1.5 text-xs bg-white border border-slate-300 rounded-lg text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
              {searchTerm && (
                <button
                  onClick={() => setSearchTerm('')}
                  className="absolute right-2.5 top-2 text-slate-400 hover:text-slate-600"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
            </div>

            {/* Role Filter Pills */}
            <div className="flex items-center gap-1 bg-slate-200/70 p-0.5 rounded-lg text-xs">
              <button
                onClick={() => setRoleFilter('ALL')}
                className={`px-3 py-1 rounded-md font-semibold transition ${
                  roleFilter === 'ALL' ? 'bg-white text-indigo-700 shadow-sm' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                အားလုံး
              </button>
              <button
                onClick={() => setRoleFilter('teacher')}
                className={`px-3 py-1 rounded-md font-semibold transition ${
                  roleFilter === 'teacher' ? 'bg-white text-indigo-700 shadow-sm' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                ဆရာ/ဆရာမ
              </button>
              <button
                onClick={() => setRoleFilter('school_admin')}
                className={`px-3 py-1 rounded-md font-semibold transition ${
                  roleFilter === 'school_admin' ? 'bg-white text-indigo-700 shadow-sm' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                ကျောင်းအုပ် / စီမံ
              </button>
            </div>
          </div>
        </div>

        {/* Content list */}
        {loading ? (
          <div className="py-20 text-center">
            <RefreshCw className="h-8 w-8 text-indigo-500 animate-spin mx-auto mb-2" />
            <p className="text-sm text-slate-500">ဆရာ/ဆရာမများ စာရင်းအား ရယူနေပါသည်...</p>
          </div>
        ) : filteredTeachers.length === 0 ? (
          <div className="py-16 text-center px-4">
            <Users className="h-12 w-12 text-slate-300 mx-auto mb-3" />
            <h3 className="text-sm font-bold text-slate-700">ဆရာ/ဆရာမ စာရင်း မတွေ့ရှိပါ</h3>
            <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
              {searchTerm ? 'ရှာဖွေမှုနှင့် ကိုက်ညီသော ဆရာ/ဆရာမ မရှိပါ။' : 'ဤကျောင်းတွင် ဆရာ/ဆရာမ စာရင်း မရှိသေးပါ။ အသစ် ထည့်သွင်းနိုင်ပါသည်။'}
            </p>
            <button
              onClick={() => setAddModalOpen(true)}
              className="mt-4 inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold shadow transition"
            >
              <Plus className="h-4 w-4" /> ဆရာ/ဆရာမ အသစ်ထည့်ရန်
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 p-5">
            {filteredTeachers.map((teacher) => (
              <div
                key={teacher.id}
                className="bg-white rounded-xl border border-slate-200 hover:border-indigo-300 hover:shadow-md transition p-4 flex flex-col justify-between gap-3 group"
              >
                <div className="space-y-3">
                  {/* Top line with Avatar, Name, Role badge */}
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-3">
                      <div className="h-11 w-11 rounded-full bg-gradient-to-tr from-indigo-600 to-indigo-400 text-white font-black text-base flex items-center justify-center shadow-sm">
                        {teacher.full_name ? teacher.full_name.charAt(0) : 'T'}
                      </div>
                      <div>
                        <h3 className="font-bold text-slate-900 text-sm leading-tight group-hover:text-indigo-600 transition">
                          {teacher.full_name}
                        </h3>
                        <div className="flex items-center gap-1 text-[11px] text-slate-500 mt-0.5">
                          <Mail className="h-3 w-3 text-slate-400" />
                          <span className="truncate max-w-[150px]">{teacher.email}</span>
                        </div>
                      </div>
                    </div>

                    <span
                      className={`text-[10px] font-bold px-2 py-0.5 rounded-full capitalize whitespace-nowrap ${
                        teacher.role === 'school_admin' || teacher.role === 'admin'
                          ? 'bg-purple-100 text-purple-700 border border-purple-200'
                          : 'bg-emerald-100 text-emerald-700 border border-emerald-200'
                      }`}
                    >
                      {teacher.role === 'school_admin' || teacher.role === 'admin' ? 'ကျောင်းအုပ်' : 'ဆရာ/ဆရာမ'}
                    </span>
                  </div>

                  {/* Assigned Classes */}
                  <div className="pt-2 border-t border-slate-100">
                    <div className="text-[11px] font-semibold text-slate-400 mb-1 flex items-center gap-1">
                      <GraduationCap className="h-3.5 w-3.5 text-slate-400" />
                      <span>တာဝန်ကျ အတန်းများ:</span>
                    </div>
                    {teacher.assigned_classes && teacher.assigned_classes.length > 0 ? (
                      <div className="flex flex-wrap gap-1">
                        {teacher.assigned_classes.map((cls, idx) => (
                          <span
                            key={idx}
                            className="text-[10px] font-semibold px-2 py-0.5 rounded bg-indigo-50 text-indigo-700 border border-indigo-200"
                          >
                            {cls}
                          </span>
                        ))}
                      </div>
                    ) : (
                      <span className="text-[11px] text-slate-400 italic">တာဝန်ကျ အတန်း မရှိသေးပါ</span>
                    )}
                  </div>
                </div>

                {/* Card Actions */}
                <div className="pt-2 border-t border-slate-100 flex items-center justify-between gap-2 mt-1">
                  <button
                    onClick={() => openEditModal(teacher)}
                    className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-slate-200 hover:bg-slate-50 text-slate-700 text-xs font-semibold transition"
                    title="Edit info or transfer to another school"
                  >
                    <Edit2 className="h-3 w-3 text-indigo-600" />
                    <span>ပြင်ဆင် / ပြောင်းရန်</span>
                  </button>

                  <button
                    onClick={() => handleDeleteTeacher(teacher)}
                    disabled={deletingId === teacher.id}
                    className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-rose-200 hover:bg-rose-50 text-rose-600 text-xs font-semibold transition disabled:opacity-50"
                    title="Delete teacher"
                  >
                    <Trash2 className="h-3 w-3" />
                    <span>{deletingId === teacher.id ? 'ပယ်ဖျက်နေသည်...' : 'ပယ်ဖျက်'}</span>
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Add Teacher Modal */}
      {addModalOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl max-w-md w-full border border-slate-200 shadow-2xl overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50">
              <div className="flex items-center gap-2">
                <Users className="h-5 w-5 text-indigo-600" />
                <h3 className="font-bold text-slate-900 text-base">ဆရာ/ဆရာမ အသစ် ထည့်သွင်းရန်</h3>
              </div>
              <button
                onClick={() => setAddModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-lg"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleCreateTeacher} className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  ဆရာ/ဆရာမ အမည် <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={newFullName}
                  onChange={(e) => setNewFullName(e.target.value)}
                  placeholder="ဥပမာ - ဒေါ်နှင်းဆီ (Daw Hnin Si)"
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  အီးမေးလ် သို့မဟုတ် အကောင့်ဖုန်းနံပါတ်
                </label>
                <input
                  type="text"
                  value={newEmail}
                  onChange={(e) => setNewEmail(e.target.value)}
                  placeholder="မထည့်ပါက အလိုအလျောက် သတ်မှတ်ပေးပါမည်"
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  စကားဝှက် (Password)
                </label>
                <input
                  type="text"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="Teacher123!"
                  className="w-full px-3 py-2 text-sm font-mono border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
                <p className="text-[11px] text-slate-400 mt-1">မူလစကားဝှက်: Teacher123!</p>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  ရာထူး တာဝန် (Role)
                </label>
                <select
                  value={newRole}
                  onChange={(e) => setNewRole(e.target.value as any)}
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white"
                >
                  <option value="teacher">ဆရာ / ဆရာမ (Teacher)</option>
                  <option value="school_admin">ကျောင်းအုပ် / စီမံခန့်ခွဲသူ (School Admin)</option>
                </select>
              </div>

              <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setAddModalOpen(false)}
                  className="px-4 py-2 rounded-lg border border-slate-300 text-slate-700 text-xs font-bold hover:bg-slate-50 transition"
                >
                  မလုပ်တော့ပါ
                </button>
                <button
                  type="submit"
                  disabled={creating}
                  className="px-5 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold shadow transition disabled:opacity-50 flex items-center gap-1.5"
                >
                  {creating && <RefreshCw className="h-3.5 w-3.5 animate-spin" />}
                  <span>{creating ? 'ထည့်သွင်းနေသည်...' : 'ထည့်သွင်းမည်'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit / Transfer Teacher Modal */}
      {editModalOpen && editingTeacher && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl max-w-lg w-full border border-slate-200 shadow-2xl overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50">
              <div className="flex items-center gap-2">
                <ArrowRightLeft className="h-5 w-5 text-indigo-600" />
                <h3 className="font-bold text-slate-900 text-base">
                  ဆရာ/ဆရာမ ပြင်ဆင်ခြင်းနှင့် ကျောင်းပြောင်းရွှေ့ခြင်း
                </h3>
              </div>
              <button
                onClick={() => setEditModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-lg"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleUpdateTeacher} className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  ဆရာ/ဆရာမ အမည် <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={editFullName}
                  onChange={(e) => setEditFullName(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  အီးမေးလ် / ဖုန်းနံပါတ်
                </label>
                <input
                  type="text"
                  value={editEmail}
                  onChange={(e) => setEditEmail(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              {/* School Transfer Dropdown */}
              <div className="p-3.5 bg-indigo-50/70 border border-indigo-200 rounded-xl space-y-2">
                <div className="flex items-center gap-2">
                  <ArrowRightLeft className="h-4 w-4 text-indigo-600" />
                  <label className="block text-xs font-bold text-indigo-900">
                    တာဝန်ကျကျောင်း ပြောင်းရွှေ့ရန် (Transfer School Facility)
                  </label>
                </div>
                <select
                  value={transferSchoolId}
                  onChange={(e) => setTransferSchoolId(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-indigo-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white text-slate-800"
                >
                  {allSchools.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name_my || s.name} ({s.code}) - {s.city}
                    </option>
                  ))}
                </select>
                <p className="text-[11px] text-indigo-700/80 leading-normal">
                  အခြားကျောင်းသို့ ရွေးချယ်သိမ်းဆည်းပါက ဤဆရာ/ဆရာမသည် ရွေးချယ်လိုက်သော ကျောင်းသို့ အလိုအလျောက် တာဝန်ပြောင်းရွှေ့သွားပါမည်။
                </p>
              </div>

              <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setEditModalOpen(false)}
                  className="px-4 py-2 rounded-lg border border-slate-300 text-slate-700 text-xs font-bold hover:bg-slate-50 transition"
                >
                  မလုပ်တော့ပါ
                </button>
                <button
                  type="submit"
                  disabled={updating}
                  className="px-5 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold shadow transition disabled:opacity-50 flex items-center gap-1.5"
                >
                  {updating && <RefreshCw className="h-3.5 w-3.5 animate-spin" />}
                  <span>{updating ? 'သိမ်းဆည်းနေသည်...' : 'ပြောင်းလဲမှု သိမ်းဆည်းမည်'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Searchable School Switcher Modal with IndexedDB SWR */}
      <SchoolSwitcherModal
        isOpen={switcherOpen}
        onClose={() => setSwitcherOpen(false)}
        currentSchoolId={effectiveSchoolId}
        onSelect={(selected) => {
          setSearchParams({ school_id: selected.id });
        }}
      />
    </div>
  );
};
