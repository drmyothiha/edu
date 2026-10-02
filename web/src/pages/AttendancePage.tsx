import React, { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { api } from '../api/client';
import { AttendanceStatus, AttendanceRosterItem, ClassDTO, WholeChildProfileDTO } from '../types';
import { WholeChildMatrix } from '../components/WholeChildMatrix';
import {
  getCachedAttendance,
  saveAttendanceToCache,
  getCachedClassroom,
} from '../services/classroomOfflineStorage';
import {
  CalendarCheck,
  ArrowLeft,
  Save,
  CheckCircle2,
  XCircle,
  Clock,
  HelpCircle,
  CheckCheck,
  AlertCircle,
  RefreshCw,
  Sparkles,
} from 'lucide-react';

export const AttendancePage: React.FC = () => {
  const { id: classId } = useParams<{ id: string }>();

  const [classInfo, setClassInfo] = useState<ClassDTO | null>(null);
  const [selectedDate, setSelectedDate] = useState<string>(() => {
    return new Date().toISOString().split('T')[0];
  });

  const [activeTab, setActiveTab] = useState<'daily' | 'whole_child'>('daily');
  const [roster, setRoster] = useState<AttendanceRosterItem[]>([]);
  const [attendanceMap, setAttendanceMap] = useState<Record<string, { status: AttendanceStatus; notes: string }>>({});
  const [wholeChildProfiles, setWholeChildProfiles] = useState<WholeChildProfileDTO[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const fetchRoster = async () => {
    if (!classId) return;
    setError(null);
    setSuccessMsg(null);

    let hadCache = false;

    // Step 1: Immediate 0ms load from IndexedDB
    try {
      const [cachedAtt, cachedCls] = await Promise.all([
        getCachedAttendance(classId, selectedDate),
        getCachedClassroom(classId),
      ]);

      if (cachedCls?.classInfo) {
        setClassInfo(cachedCls.classInfo);
      }

      if (cachedAtt && cachedAtt.roster && cachedAtt.roster.length > 0) {
        hadCache = true;
        setRoster(cachedAtt.roster);
        const map: Record<string, { status: AttendanceStatus; notes: string }> = {};
        cachedAtt.roster.forEach((r) => {
          map[r.student_id] = {
            status: r.status === 'unrecorded' ? 'present' : r.status,
            notes: r.notes || '',
          };
        });
        setAttendanceMap(map);
        setLoading(false); // Instant render without waiting
      }
    } catch (e) {
      console.warn('[Attendance] IndexedDB cache read fallback:', e);
    }

    if (!hadCache) {
      setLoading(true);
    }

    // Step 2: Delayed server check (1.2s delay if cached, immediate if no cache)
    const runServerCheck = async () => {
      try {
        const cls = await api.classes.get(classId);
        setClassInfo(cls);

        const res = await api.classes.getAttendanceRoster(classId, selectedDate);
        setRoster(res.roster);

        const map: Record<string, { status: AttendanceStatus; notes: string }> = {};
        res.roster.forEach((r) => {
          map[r.student_id] = {
            status: r.status === 'unrecorded' ? 'present' : r.status,
            notes: r.notes || '',
          };
        });
        setAttendanceMap(map);

        // Save fresh roster to IndexedDB
        await saveAttendanceToCache(classId, selectedDate, res);
      } catch (err: any) {
        if (!hadCache) {
          setError(err.message || 'Failed to load attendance roster');
        }
      } finally {
        setLoading(false);
      }
    };

    if (hadCache) {
      setTimeout(runServerCheck, 1200);
    } else {
      runServerCheck();
    }
  };

  const fetchWholeChildProfiles = async () => {
    if (!classId) return;
    try {
      const profiles = await api.classes.getWholeChildProfiles(classId, '2026-10');
      setWholeChildProfiles(profiles);
    } catch (err: any) {
      console.warn('Failed to load Whole-Child profiles:', err);
    }
  };

  useEffect(() => {
    fetchRoster();
    fetchWholeChildProfiles();
  }, [classId, selectedDate]);

  const handleStatusChange = (studentId: string, status: AttendanceStatus) => {
    setAttendanceMap((prev) => ({
      ...prev,
      [studentId]: {
        ...prev[studentId],
        status,
      },
    }));
  };

  const handleNotesChange = (studentId: string, notes: string) => {
    setAttendanceMap((prev) => ({
      ...prev,
      [studentId]: {
        ...prev[studentId],
        notes,
      },
    }));
  };

  const handleMarkAll = (status: AttendanceStatus) => {
    setAttendanceMap((prev) => {
      const next = { ...prev };
      roster.forEach((student) => {
        next[student.student_id] = {
          ...next[student.student_id],
          status,
        };
      });
      return next;
    });
  };

  const handleSave = async () => {
    if (!classId) return;
    setSaving(true);
    setError(null);
    setSuccessMsg(null);

    try {
      const records = roster.map((s) => ({
        student_id: s.student_id,
        status: attendanceMap[s.student_id]?.status || 'present',
        notes: attendanceMap[s.student_id]?.notes || '',
      }));

      const res = await api.classes.batchAttendance(classId, {
        date: selectedDate,
        records,
      });

      setSuccessMsg(`Attendance saved successfully! (${res.recorded_count} students recorded)`);
      // Refresh to update saved records
      fetchRoster();
    } catch (err: any) {
      setError(err.message || 'Failed to save attendance records');
    } finally {
      setSaving(false);
    }
  };

  // Status metrics
  const stats = roster.reduce(
    (acc, student) => {
      const st = attendanceMap[student.student_id]?.status || 'present';
      acc[st] = (acc[st] || 0) + 1;
      return acc;
    },
    { present: 0, absent: 0, late: 0, excused: 0 } as Record<string, number>
  );

  return (
    <div className="p-4 md:p-6 max-w-7xl mx-auto w-full space-y-5">
      {/* Attendance Action Bar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-4 rounded-xl border border-slate-200 shadow-2xs">
        <div>
          <h1 className="text-base sm:text-lg font-bold text-slate-900 tracking-tight flex items-center gap-2">
            <CalendarCheck className="h-5 w-5 text-emerald-600" />
            <span>နေ့စဉ် ကျောင်းခေါ်ချိန် မှတ်တမ်း (Class Attendance Roster)</span>
          </h1>
          {classInfo && (
            <p className="text-xs text-slate-500 mt-0.5">
              {classInfo.name} • {classInfo.grade_level} ({classInfo.academic_year}) • နေ့စဉ် ကျောင်းတက်/ပျက်/ခွင့် စာရင်းနှင့် Whole-Child ၅ ရပ်
            </p>
          )}
        </div>

        {/* Date Selector & Save Button */}
        {activeTab === 'daily' && (
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 bg-white px-3 py-1.5 rounded-lg border border-slate-300 shadow-sm">
              <span className="text-xs font-bold text-slate-600">Date:</span>
              <input
                type="date"
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
                className="text-xs text-slate-900 font-semibold focus:outline-none bg-transparent cursor-pointer"
              />
            </div>

            <button
              onClick={handleSave}
              disabled={saving || loading || roster.length === 0}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow transition disabled:opacity-50"
            >
              {saving ? (
                <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
              ) : (
                <Save className="h-4 w-4" />
              )}
              Save Attendance
            </button>
          </div>
        )}
      </div>

      {/* View Mode Tabs: Daily Roster vs Whole-Child Development Hub */}
      <div className="flex flex-wrap items-center gap-2 border-b border-slate-200 pb-3">
        <button
          type="button"
          onClick={() => setActiveTab('daily')}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition flex items-center gap-2 ${
            activeTab === 'daily'
              ? 'bg-emerald-600 text-white shadow-sm'
              : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'
          }`}
        >
          <CalendarCheck className="h-4 w-4" />
          Daily Attendance Roster (နေ့စဥ် တက်ရောက်မှု)
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('whole_child')}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition flex items-center gap-2 ${
            activeTab === 'whole_child'
              ? 'bg-indigo-600 text-white shadow-sm'
              : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'
          }`}
        >
          <Sparkles className="h-4 w-4 text-amber-300" />
          Whole-Child Development & Offline Sync (ဘက်စုံဖွံ့ဖြိုးမှု စံနှုန်းများ)
          {wholeChildProfiles.length > 0 && (
            <span className="px-1.5 py-0.5 rounded-full text-[10px] bg-white/20 text-white font-mono">
              {wholeChildProfiles.length}
            </span>
          )}
        </button>
      </div>

      {activeTab === 'whole_child' ? (
        <WholeChildMatrix
          profiles={wholeChildProfiles}
          classId={classId}
          className={classInfo?.name}
          onRefresh={fetchWholeChildProfiles}
        />
      ) : (
        <>
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

      {/* Summary Metrics & Quick Action bar */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="rounded-xl bg-white border border-slate-200 p-4 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">Present</span>
            <CheckCircle2 className="h-4 w-4 text-emerald-600" />
          </div>
          <p className="text-2xl font-black text-slate-900 mt-1">{stats.present}</p>
        </div>

        <div className="rounded-xl bg-white border border-slate-200 p-4 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">Absent</span>
            <XCircle className="h-4 w-4 text-rose-600" />
          </div>
          <p className="text-2xl font-black text-slate-900 mt-1">{stats.absent}</p>
        </div>

        <div className="rounded-xl bg-white border border-slate-200 p-4 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">Late</span>
            <Clock className="h-4 w-4 text-amber-600" />
          </div>
          <p className="text-2xl font-black text-slate-900 mt-1">{stats.late}</p>
        </div>

        <div className="rounded-xl bg-white border border-slate-200 p-4 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">Excused</span>
            <HelpCircle className="h-4 w-4 text-sky-600" />
          </div>
          <p className="text-2xl font-black text-slate-900 mt-1">{stats.excused}</p>
        </div>
      </div>

      {/* Quick Action Buttons */}
      <div className="flex items-center justify-between bg-slate-100/80 p-3 rounded-xl border border-slate-200 text-xs">
        <span className="font-semibold text-slate-700">Quick Roster Actions:</span>
        <div className="flex items-center gap-2">
          <button
            onClick={() => handleMarkAll('present')}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white border border-slate-300 text-emerald-700 hover:bg-emerald-50 font-semibold transition"
          >
            <CheckCheck className="h-3.5 w-3.5" /> Mark All Present
          </button>
          <button
            onClick={() => handleMarkAll('absent')}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white border border-slate-300 text-rose-700 hover:bg-rose-50 font-semibold transition"
          >
            <XCircle className="h-3.5 w-3.5" /> Mark All Absent
          </button>
        </div>
      </div>

      {/* Roster Table */}
      <div className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
        {loading ? (
          <div className="p-8 text-center space-y-3">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-indigo-600 border-t-transparent mx-auto" />
            <p className="text-xs text-slate-500 font-medium">Loading student roster...</p>
          </div>
        ) : roster.length === 0 ? (
          <div className="p-12 text-center">
            <p className="text-sm font-bold text-slate-800">No students enrolled in this class yet</p>
            <p className="text-xs text-slate-500 mt-1">Enroll students to start tracking attendance.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-sm">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 text-[11px] font-bold uppercase tracking-wider text-slate-500">
                  <th className="py-3 px-4">#</th>
                  <th className="py-3 px-4">Student Name & Email</th>
                  <th className="py-3 px-4">Attendance Status</th>
                  <th className="py-3 px-4">Notes / Remarks</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {roster.map((student, idx) => {
                  const currentStatus = attendanceMap[student.student_id]?.status || 'present';
                  const currentNotes = attendanceMap[student.student_id]?.notes || '';

                  return (
                    <tr key={student.student_id} className="hover:bg-slate-50/80 transition">
                      <td className="py-3.5 px-4 text-xs font-mono text-slate-400">
                        {idx + 1}
                      </td>
                      <td className="py-3.5 px-4">
                        <div className="font-semibold text-slate-900">{student.student_name}</div>
                        <div className="text-xs text-slate-400 font-mono">{student.student_email}</div>
                      </td>
                      <td className="py-3.5 px-4">
                        <div className="flex items-center gap-1.5">
                          {(['present', 'absent', 'late', 'excused'] as AttendanceStatus[]).map((status) => {
                            const isSelected = currentStatus === status;
                            return (
                              <button
                                key={status}
                                type="button"
                                onClick={() => handleStatusChange(student.student_id, status)}
                                className={`px-2.5 py-1 rounded-md text-xs font-bold capitalize transition border ${
                                  isSelected
                                    ? status === 'present'
                                      ? 'bg-emerald-600 text-white border-emerald-600 shadow-sm'
                                      : status === 'absent'
                                      ? 'bg-rose-600 text-white border-rose-600 shadow-sm'
                                      : status === 'late'
                                      ? 'bg-amber-500 text-white border-amber-500 shadow-sm'
                                      : 'bg-sky-600 text-white border-sky-600 shadow-sm'
                                    : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-100'
                                }`}
                              >
                                {status}
                              </button>
                            );
                          })}
                        </div>
                      </td>
                      <td className="py-3.5 px-4">
                        <input
                          type="text"
                          value={currentNotes}
                          onChange={(e) => handleNotesChange(student.student_id, e.target.value)}
                          placeholder="Optional notes (e.g. sick pass)"
                          className="w-full max-w-xs rounded-lg border border-slate-200 px-2.5 py-1 text-xs text-slate-800 placeholder-slate-400 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                        />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </>
  )}
</div>
  );
};

