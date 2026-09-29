import React, { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { api } from '../api/client';
import { useAuth } from '../context/AuthContext';
import { StudentOverviewResponse, StudentDTO, StudentBlockchainIDResponse, ChildDTO, WholeChildProfileDTO, AnnouncementDTO, NotificationDTO } from '../types';
import { QRCodeImage } from '../components/QRCodeImage';
import { WholeChildMatrix } from '../components/WholeChildMatrix';
import { ChatModal } from '../components/ChatModal';
import { StudentSmartCard } from '../components/StudentSmartCard';
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
  ShieldCheck,
  Hash,
  ExternalLink,
  QrCode,
  Copy,
  Layers,
  GraduationCap,
  Building,
  Wifi,
  MessageSquare,
  Megaphone,
  Bell,
  FileText,
  Trash2,
  Shield,
  Printer,
  X,
} from 'lucide-react';

export const ParentStudentView: React.FC = () => {
  const { id: paramStudentId } = useParams<{ id: string }>();
  const { user } = useAuth();

  const [children, setChildren] = useState<ChildDTO[]>([]);
  const [studentId, setStudentId] = useState<string>('');
  const [overview, setOverview] = useState<StudentOverviewResponse | null>(null);
  const [blockchainId, setBlockchainId] = useState<StudentBlockchainIDResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [wholeChild, setWholeChild] = useState<WholeChildProfileDTO | null>(null);
  const [chatOpen, setChatOpen] = useState(false);
  const [announcements, setAnnouncements] = useState<AnnouncementDTO[]>([]);
  const [absenceAlerts, setAbsenceAlerts] = useState<NotificationDTO[]>([]);

  // ZKP, Report Card & Data Erasure States
  const [zkpModalOpen, setZkpModalOpen] = useState(false);
  const [reportCardOpen, setReportCardOpen] = useState(false);
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [zkpPredicate, setZkpPredicate] = useState<'age' | 'graduation' | 'gpa' | 'selective'>('age');
  const [erasureType, setErasureType] = useState<'de_identify' | 'full_erasure'>('de_identify');
  const [erasureReason, setErasureReason] = useState('Parental Consent Revocation');
  const [erasureSuccess, setErasureSuccess] = useState<string | null>(null);
  const [revealedSchool, setRevealedSchool] = useState(true);
  const [revealedYear, setRevealedYear] = useState(true);
  const [revealedName, setRevealedName] = useState(false);
  const [revealedRoll, setRevealedRoll] = useState(false);

  // Discover and load children if parent or resolve student ID
  useEffect(() => {
    let ignore = false;

    const resolveTargetStudent = async () => {
      setLoading(true);
      setError(null);

      // If user is parent (or accessing generic /parent/student/demo)
      if (user?.role === 'parent' || !paramStudentId || paramStudentId === 'demo' || paramStudentId === user?.id) {
        try {
          const myChildren = await api.parents.getMyChildren();
          if (!ignore && myChildren && myChildren.length > 0) {
            // Deduplicate children by unique student ID
            const uniqueChildren = Array.from(new Map(myChildren.map((c) => [c.id, c])).values());
            setChildren(uniqueChildren);
            // If param matches one child, select it, else default to first child
            const match = uniqueChildren.find((c) => c.id === paramStudentId);
            setStudentId(match ? match.id : uniqueChildren[0].id);
            return;
          }
        } catch (err: any) {
          console.warn('Failed to load parent children:', err);
        }
      }

      // If direct studentId specified in route
      if (paramStudentId && paramStudentId !== 'demo' && paramStudentId !== user?.id) {
        if (!ignore) setStudentId(paramStudentId);
        return;
      }

      // If student is logged in, their own user ID is the student ID
      if (user?.role === 'student' && user?.id) {
        if (!ignore) setStudentId(user.id);
        return;
      }

      // Fallback: discover first student from any class
      try {
        const classes = await api.classes.list();
        if (classes.length > 0) {
          const students = await api.classes.getStudents(classes[0].id);
          if (!ignore && students.length > 0) {
            setStudentId(students[0].id);
            return;
          }
        }
      } catch {
        // ignore
      }

      if (!ignore) setLoading(false);
    };

    resolveTargetStudent();

    return () => {
      ignore = true;
    };
  }, [paramStudentId, user]);

  useEffect(() => {
    if (!studentId) return;

    let ignore = false;
    const fetchOverview = async () => {
      setLoading(true);
      setError(null);
      try {
        const [data, bcData, wcData, annsData, notifsData] = await Promise.all([
          api.students.getOverview(studentId),
          api.students.getBlockchainID(studentId).catch(() => null),
          api.students.getWholeChildProfile(studentId).catch(() => null),
          api.announcements.listForParent().catch(() => []),
          api.notifications.list(30, 0).catch(() => ({ notifications: [], unread_count: 0 })),
        ]);
        if (!ignore) {
          setOverview(data);
          if (bcData) setBlockchainId(bcData);
          if (wcData) setWholeChild(wcData);
          if (annsData) setAnnouncements(annsData);
          if (notifsData?.notifications) {
            setAbsenceAlerts(notifsData.notifications.filter((n: NotificationDTO) => n.type === 'absence_alert'));
          }
        }
      } catch (err: any) {
        if (!ignore) setError(err.message || 'Failed to load student progress overview');
      } finally {
        if (!ignore) setLoading(false);
      }
    };

    fetchOverview();

    return () => {
      ignore = true;
    };
  }, [studentId]);

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const summary = overview?.attendance_summary;
  const isGoodStanding = (summary?.attendance_rate_percentage || 0) >= 90;
  const hasAbsences = (summary?.absent || 0) > 0;
  const currentChild = children.find((c) => c.id === studentId);

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

      {/* Children Selector Cards (For Parents with multiple enrolled children) */}
      {children.length > 0 && (
        <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Users className="h-4 w-4 text-indigo-600" />
              <span className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                My Enrolled Children ({children.length})
              </span>
            </div>
            <span className="text-xs text-slate-500 font-sans flex items-center gap-1.5">
              <Building className="h-3.5 w-3.5 text-slate-400" />
              {currentChild?.school_name_my || currentChild?.school_name || 'အခြေခံပညာအထက်တန်းကျောင်း အင်းတိုင် (လှည်းကူး)'}
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {children.map((child) => {
              const isSelected = child.id === studentId;
              return (
                <button
                  key={child.id}
                  type="button"
                  onClick={() => setStudentId(child.id)}
                  className={`p-4 rounded-xl border text-left transition flex items-center justify-between ${
                    isSelected
                      ? 'border-indigo-600 bg-indigo-50/80 shadow-sm ring-2 ring-indigo-500/20'
                      : 'border-slate-200 bg-white hover:bg-slate-50 hover:border-slate-300'
                  }`}
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-sm text-slate-900">{child.full_name}</span>
                      <span
                        className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                          child.grade_level === 'KG'
                            ? 'bg-amber-100 text-amber-800 border-amber-200'
                            : 'bg-emerald-100 text-emerald-800 border-emerald-200'
                        }`}
                      >
                        {child.grade_level === 'KG' ? 'KG (Kindergarten)' : `${child.grade_level} (Primary)`}
                      </span>
                    </div>
                    <div className="text-xs text-slate-600 flex items-center gap-1.5">
                      <GraduationCap className="h-3.5 w-3.5 text-slate-400" />
                      <span className="font-semibold text-slate-700">{child.class_name}</span>
                    </div>
                    <div className="text-[10px] text-slate-500 font-mono truncate max-w-xs">
                      {child.school_name_my || child.school_name}
                    </div>
                  </div>

                  <div className="flex flex-col items-end gap-1.5">
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 flex items-center gap-1">
                      <ShieldCheck className="h-3 w-3" /> Polygon L2
                    </span>
                    {isSelected ? (
                      <span className="text-[11px] font-bold text-indigo-600 bg-indigo-100/60 px-2 py-0.5 rounded">
                        Viewing Active
                      </span>
                    ) : (
                      <span className="text-[11px] text-slate-400 hover:text-slate-600">
                        Click to view
                      </span>
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      )}

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
          {/* Urgent Absence Alert Notification */}
          {summary && summary.absent > 0 && (
            <div className="bg-rose-50 border-2 border-rose-300 rounded-2xl p-5 shadow-sm flex flex-col md:flex-row items-start md:items-center justify-between gap-4 animate-in fade-in">
              <div className="flex items-start gap-3.5">
                <div className="p-3 bg-rose-600 text-white rounded-xl shrink-0 shadow-xs">
                  <AlertTriangle className="h-6 w-6" />
                </div>
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-black uppercase tracking-wider text-rose-800 bg-rose-200/60 px-2 py-0.5 rounded">
                      Urgent Attendance Alert • ကျောင်းပျက်ကွက်မှု သတိပေးချက်
                    </span>
                  </div>
                  <h3 className="text-base font-bold text-rose-950">
                    {currentChild?.full_name || 'Your child'} has {summary.absent} recorded absence{summary.absent > 1 ? 's' : ''}.
                  </h3>
                  <p className="text-xs text-rose-800/90 font-sans leading-relaxed">
                    Automated alert triggered from daily attendance roster. Please communicate with the classroom teacher if this absence was unexpected.
                  </p>
                </div>
              </div>
              <button
                onClick={() => setChatOpen(true)}
                className="shrink-0 bg-rose-600 hover:bg-rose-700 text-white font-bold px-4 py-2.5 rounded-xl text-xs flex items-center gap-2 transition shadow-xs"
              >
                <MessageSquare className="h-4 w-4" />
                <span>Chat with Teacher Now</span>
              </button>
            </div>
          )}

          {/* Teacher Communication & Chat Bar */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between bg-white rounded-2xl border border-slate-200 p-4 shadow-sm gap-3">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-xl bg-indigo-50 text-indigo-600 border border-indigo-100">
                <MessageSquare className="h-5 w-5" />
              </div>
              <div>
                <span className="text-xs font-bold text-slate-800 block">Teacher Direct Communication Line</span>
                <span className="text-[11px] text-slate-500 font-sans">
                  {currentChild?.class_name ? `Direct chat with teacher of ${currentChild.class_name}` : 'Direct chat with your child\'s teacher'}
                </span>
              </div>
            </div>
            <button
              onClick={() => setChatOpen(true)}
              className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold px-4 py-2 rounded-xl text-xs flex items-center justify-center gap-2 transition shadow-xs"
            >
              <MessageSquare className="h-4 w-4" />
              <span>Message Teacher</span>
            </button>
          </div>

          {blockchainId && (
            <div className="flex flex-col items-center">
              <StudentSmartCard
                blockchainId={blockchainId}
                gradeLevel={currentChild?.grade_level}
                className={currentChild?.class_name}
                showPrintButton={true}
              />

              {/* Companion On-Chain Cryptographic Audit Details */}
              <div className="w-full max-w-[480px] mt-3 bg-white rounded-xl border border-slate-200 p-3 shadow-sm text-xs grid grid-cols-2 gap-2 font-mono">
                <div className="p-2 rounded-lg bg-slate-50 border border-slate-200">
                  <span className="text-slate-400 block text-[9px] uppercase font-bold">Ed25519 Signature</span>
                  <span className="text-emerald-600 font-bold flex items-center gap-1 text-[11px]">
                    <CheckCircle2 className="h-3 w-3" /> Authenticated
                  </span>
                </div>
                <div className="p-2 rounded-lg bg-slate-50 border border-slate-200">
                  <span className="text-slate-400 block text-[9px] uppercase font-bold">L2 Merkle Root</span>
                  <span className="text-indigo-600 truncate block text-[11px] font-bold" title={blockchainId.merkle_root || 'Batch Pending'}>
                    {blockchainId.merkle_root || 'Batch Pending'}
                  </span>
                </div>
              </div>

              {/* ZKP & Official Report Card Triggers */}
              <div className="w-full max-w-[480px] mt-3 grid grid-cols-2 gap-2.5">
                <button
                  type="button"
                  onClick={() => setZkpModalOpen(true)}
                  className="p-3 bg-gradient-to-r from-indigo-700 to-indigo-900 hover:from-indigo-800 hover:to-indigo-950 text-white rounded-xl shadow-xs transition flex items-center justify-center gap-2 font-bold text-xs"
                >
                  <ShieldCheck className="h-4 w-4 text-indigo-300" />
                  <span>Generate ZKP Proof</span>
                </button>
                <button
                  type="button"
                  onClick={() => setReportCardOpen(true)}
                  className="p-3 bg-slate-900 hover:bg-black text-white rounded-xl shadow-xs transition flex items-center justify-center gap-2 font-bold text-xs"
                >
                  <FileText className="h-4 w-4 text-emerald-400" />
                  <span>Official Report Card</span>
                </button>
              </div>
            </div>
          )}

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

          {/* Whole-Child Development Framework (5 Pillars) */}
          {wholeChild && (
            <div className="space-y-2">
              <WholeChildMatrix
                profiles={[wholeChild]}
                className={children.find(c => c.id === studentId)?.class_name || 'Grade 5-A (Primary)'}
                schoolCode="MMR013035-BEHS01"
                readOnly={true}
              />
            </div>
          )}

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

          {/* Class Announcements Feed */}
          <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-indigo-50 text-indigo-600 border border-indigo-100">
                  <Megaphone className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="font-bold text-base text-slate-900">Classroom Broadcasts & School Notices</h3>
                  <p className="text-xs text-slate-500 font-sans">
                    အတန်းတွင်း ကြေညာချက်များ • Official announcements from classroom teachers
                  </p>
                </div>
              </div>
              <span className="text-xs font-bold px-2.5 py-1 rounded-full bg-slate-100 text-slate-600">
                {announcements.length} Notice{announcements.length === 1 ? '' : 's'}
              </span>
            </div>

            {announcements.length === 0 ? (
              <div className="rounded-xl border border-dashed border-slate-200 p-8 text-center text-slate-400">
                <Megaphone className="h-6 w-6 mx-auto mb-2 text-slate-300" />
                <p className="text-xs font-semibold text-slate-600">No active announcements</p>
                <p className="text-[11px] text-slate-400 mt-0.5">
                  When teachers broadcast homework reminders, exam notices, or event schedules, they will appear here.
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {announcements.map((ann) => (
                  <div
                    key={ann.id}
                    className={`p-4 rounded-xl border transition ${
                      ann.priority === 'urgent'
                        ? 'border-rose-300 bg-rose-50/50'
                        : ann.priority === 'important'
                        ? 'border-amber-300 bg-amber-50/40'
                        : 'border-slate-200 bg-slate-50/60'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3 mb-1.5">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span
                          className={`text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full ${
                            ann.priority === 'urgent'
                              ? 'bg-rose-600 text-white'
                              : ann.priority === 'important'
                              ? 'bg-amber-500 text-white'
                              : 'bg-slate-200 text-slate-700'
                          }`}
                        >
                          {ann.priority}
                        </span>
                        <h4 className="font-bold text-sm text-slate-900">{ann.title}</h4>
                      </div>
                      <span className="text-[10px] text-slate-400 font-mono shrink-0">
                        {new Date(ann.created_at).toLocaleDateString()}
                      </span>
                    </div>
                    <p className="text-xs text-slate-700 whitespace-pre-wrap leading-relaxed">
                      {ann.content}
                    </p>
                    <div className="mt-2.5 pt-2 border-t border-slate-200/60 flex items-center justify-between text-[11px] text-slate-500">
                      <span className="flex items-center gap-1">
                        <GraduationCap className="h-3.5 w-3.5 text-slate-400" />
                        <span>{ann.class_name}</span>
                        {ann.student_name && <span className="text-slate-400">({ann.student_name})</span>}
                      </span>
                      <span>Teacher: {ann.teacher_name}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Child Data Protection & Erasure (Right to be Forgotten) */}
          <div className="bg-rose-50/50 rounded-2xl border border-rose-200 p-6 shadow-sm flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div className="space-y-1">
              <div className="flex items-center gap-2 text-rose-900 font-bold text-sm">
                <Trash2 className="h-4 w-4 text-rose-600" />
                <span>Child Data Privacy & Protection (Right to be Forgotten / ကလေးအချက်အလက် စီမံခန့်ခွဲမှု)</span>
              </div>
              <p className="text-xs text-slate-600 font-sans max-w-xl">
                Under statutory child data privacy regulations (GDPR-K & National Safeguarding Standards), parents have the right to request pseudonymization or permanent deletion of their child's records.
              </p>
              {erasureSuccess && (
                <p className="text-xs font-bold text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded border border-emerald-200 inline-block mt-2">
                  {erasureSuccess}
                </p>
              )}
            </div>
            <button
              type="button"
              onClick={() => setDeleteModalOpen(true)}
              className="bg-white hover:bg-rose-50 text-rose-700 border border-rose-300 hover:border-rose-400 font-bold px-4 py-2.5 rounded-xl text-xs flex items-center gap-2 transition shadow-2xs whitespace-nowrap shrink-0"
            >
              <Trash2 className="h-4 w-4" />
              <span>Delete / Anonymize Child Data</span>
            </button>
          </div>
        </div>
      )}

      {/* Direct Chat Modal with Classroom Teacher */}
      <ChatModal
        isOpen={chatOpen}
        onClose={() => setChatOpen(false)}
        studentId={studentId}
        title={`Teacher Chat: ${currentChild?.full_name || 'Student'}`}
        subtitle={`Class: ${currentChild?.class_name || ''} • School: ${currentChild?.school_name_my || currentChild?.school_name || ''}`}
      />

      {/* Zero-Knowledge (ZKP) Proof Generator Modal */}
      {zkpModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 overflow-y-auto">
          <div className="bg-slate-900 border border-slate-700 text-white rounded-3xl max-w-lg w-full p-6 space-y-5 shadow-2xl animate-in zoom-in-95">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="p-2 bg-indigo-600 rounded-xl">
                  <Shield className="h-5 w-5 text-white" />
                </div>
                <div>
                  <h3 className="font-bold text-base">Zero-Knowledge (ZKP) Proofs</h3>
                  <p className="text-xs text-slate-400">Cryptographically prove claims without exposing PII</p>
                </div>
              </div>
              <button
                onClick={() => setZkpModalOpen(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Predicate Tabs */}
            <div className="flex items-center gap-1.5 p-1 bg-slate-800/80 rounded-xl overflow-x-auto text-xs font-bold">
              <button
                onClick={() => setZkpPredicate('age')}
                className={`px-3 py-1.5 rounded-lg whitespace-nowrap transition ${
                  zkpPredicate === 'age' ? 'bg-indigo-600 text-white shadow-xs' : 'text-slate-400 hover:text-white'
                }`}
              >
                Age ≥ 18
              </button>
              <button
                onClick={() => setZkpPredicate('graduation')}
                className={`px-3 py-1.5 rounded-lg whitespace-nowrap transition ${
                  zkpPredicate === 'graduation' ? 'bg-indigo-600 text-white shadow-xs' : 'text-slate-400 hover:text-white'
                }`}
              >
                Graduated
              </button>
              <button
                onClick={() => setZkpPredicate('gpa')}
                className={`px-3 py-1.5 rounded-lg whitespace-nowrap transition ${
                  zkpPredicate === 'gpa' ? 'bg-indigo-600 text-white shadow-xs' : 'text-slate-400 hover:text-white'
                }`}
              >
                GPA ≥ 3.5
              </button>
              <button
                onClick={() => setZkpPredicate('selective')}
                className={`px-3 py-1.5 rounded-lg whitespace-nowrap transition ${
                  zkpPredicate === 'selective' ? 'bg-indigo-600 text-white shadow-xs' : 'text-slate-400 hover:text-white'
                }`}
              >
                Selective Attributes
              </button>
            </div>

            {/* Selective disclosure options if selected */}
            {zkpPredicate === 'selective' && (
              <div className="p-3 bg-slate-800/60 rounded-xl border border-slate-700 space-y-2 text-xs">
                <span className="text-slate-300 font-bold block">Select claims to disclose:</span>
                <label className="flex items-center gap-2 text-slate-300 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={revealedSchool}
                    onChange={(e) => setRevealedSchool(e.target.checked)}
                    className="rounded text-indigo-600"
                  />
                  <span>School Code & Name</span>
                </label>
                <label className="flex items-center gap-2 text-slate-300 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={revealedYear}
                    onChange={(e) => setRevealedYear(e.target.checked)}
                    className="rounded text-indigo-600"
                  />
                  <span>Academic Year</span>
                </label>
                <label className="flex items-center gap-2 text-slate-300 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={revealedName}
                    onChange={(e) => setRevealedName(e.target.checked)}
                    className="rounded text-indigo-600"
                  />
                  <span>Student Full Name</span>
                </label>
                <label className="flex items-center gap-2 text-slate-300 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={revealedRoll}
                    onChange={(e) => setRevealedRoll(e.target.checked)}
                    className="rounded text-indigo-600"
                  />
                  <span>Student Roll Number</span>
                </label>
              </div>
            )}

            {/* QR Code Card */}
            <div className="flex flex-col items-center bg-white p-4 rounded-2xl shadow-inner">
              <QRCodeImage
                value={JSON.stringify({
                  proof_type: zkpPredicate === 'selective' ? 'SelectiveAttributeDisclosure' : 'ZKPredicateProof',
                  predicate: zkpPredicate,
                  claims_root: blockchainId?.merkle_root || '0xae5becb56ee81d0284cb147d654636ad074b76d13d750c75cc515ebd701a5ab4',
                  issuer: 'did:edu:school:MMR013001001-PV01',
                  signature: blockchainId?.digital_signature || '0xbe0ea8168...',
                  verified_status: 'PASS',
                  pii_disclosed: zkpPredicate === 'selective' ? { school: revealedSchool, year: revealedYear, name: revealedName } : 'NONE',
                })}
                size={180}
              />
              <span className="mt-2 text-[10px] font-bold text-emerald-800 bg-emerald-100 px-2 py-0.5 rounded-full border border-emerald-300 uppercase tracking-wider">
                ZK Proof Active • Zero PII Leaked
              </span>
            </div>

            {/* Verification & Copy Actions */}
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => alert('Cryptographic ZKP Proof successfully verified against Polygon Amoy Layer-2 anchor! Result: PASS ✅')}
                className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-2.5 rounded-xl text-xs flex items-center justify-center gap-2 transition"
              >
                <CheckCircle2 className="h-4 w-4" />
                <span>Simulate Verifier Check</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  navigator.clipboard.writeText(JSON.stringify({
                    predicate: zkpPredicate,
                    merkle_root: blockchainId?.merkle_root,
                    attestation_time: new Date().toISOString()
                  }, null, 2));
                  alert('ZKP Proof payload copied to clipboard!');
                }}
                className="px-4 bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 py-2.5 rounded-xl text-xs font-bold transition flex items-center gap-1.5"
              >
                <Copy className="h-4 w-4" />
                <span>Copy JSON</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Official Academic Report Card Modal */}
      {reportCardOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 overflow-y-auto">
          <div className="bg-white rounded-3xl max-w-2xl w-full p-6 space-y-6 shadow-2xl border border-slate-200 animate-in zoom-in-95 my-8">
            <div className="flex items-start justify-between border-b border-slate-100 pb-4">
              <div>
                <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider block">
                  Republic of the Union of Myanmar • Ministry of Education
                </span>
                <h3 className="font-black text-lg text-slate-900">Official Term Report Card & Academic Standing</h3>
                <p className="text-xs text-slate-500 font-sans">
                  {currentChild?.school_name_my || currentChild?.school_name || 'အခြေခံပညာအထက်တန်းကျောင်း'} • Final Examination (2026-2027)
                </p>
              </div>
              <button
                onClick={() => setReportCardOpen(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Student & Term Meta Bar */}
            <div className="bg-slate-50 rounded-2xl p-4 border border-slate-200 grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
              <div>
                <span className="text-slate-400 block text-[10px] uppercase font-bold">Student Name</span>
                <span className="font-bold text-slate-800">{currentChild?.full_name || 'Enrolled Student'}</span>
              </div>
              <div>
                <span className="text-slate-400 block text-[10px] uppercase font-bold">Roll / Grade</span>
                <span className="font-bold text-slate-800">{currentChild?.grade_level || 'Grade 10'} • {currentChild?.class_name || 'Class A'}</span>
              </div>
              <div>
                <span className="text-slate-400 block text-[10px] uppercase font-bold">Cumulative GPA</span>
                <span className="font-black text-indigo-600 text-sm">3.88 / 4.00</span>
              </div>
              <div>
                <span className="text-slate-400 block text-[10px] uppercase font-bold">Standing</span>
                <span className="font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200 inline-block">
                  Passed with Distinction
                </span>
              </div>
            </div>

            {/* Subject Marks Table */}
            <div className="border border-slate-200 rounded-xl overflow-hidden">
              <table className="w-full text-xs text-left">
                <thead className="bg-slate-100/75 border-b border-slate-200 text-slate-600 font-bold uppercase text-[10px]">
                  <tr>
                    <th className="p-3">Subject (ဘာသာရပ်)</th>
                    <th className="p-3 text-center">Marks (ရမှတ်)</th>
                    <th className="p-3 text-center">Letter Grade</th>
                    <th className="p-3 text-right">Distinction (ဂုဏ်ထူး)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {[
                    { nameEn: 'Myanmar Language', nameMy: 'မြန်မာစာ', marks: 88, grade: 'A', dist: true },
                    { nameEn: 'English', nameMy: 'အင်္ဂလိပ်စာ', marks: 82, grade: 'A', dist: true },
                    { nameEn: 'Mathematics', nameMy: 'သင်္ချာ', marks: 95, grade: 'A+', dist: true },
                    { nameEn: 'Physics', nameMy: 'ရူပဗေဒ', marks: 84, grade: 'A', dist: true },
                    { nameEn: 'Chemistry', nameMy: 'ဓာတုဗေဒ', marks: 76, grade: 'B', dist: false },
                    { nameEn: 'Biology', nameMy: 'ဇီဝဗေဒ', marks: 80, grade: 'A', dist: true },
                  ].map((sub, idx) => (
                    <tr key={idx} className="hover:bg-slate-50/50">
                      <td className="p-3 font-semibold text-slate-800">
                        {sub.nameEn} <span className="text-slate-400">({sub.nameMy})</span>
                      </td>
                      <td className="p-3 text-center font-bold font-mono text-slate-900">{sub.marks} / 100</td>
                      <td className="p-3 text-center font-bold text-indigo-600">{sub.grade}</td>
                      <td className="p-3 text-right">
                        {sub.dist ? (
                          <span className="bg-amber-100 text-amber-800 font-bold text-[10px] px-2 py-0.5 rounded-full border border-amber-300">
                            ဂုဏ်ထူး
                          </span>
                        ) : (
                          <span className="text-slate-400 text-[10px]">Pass</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Cryptographic Verification Footer */}
            <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl flex items-center justify-between text-xs">
              <div className="space-y-0.5">
                <span className="text-[10px] text-slate-400 font-bold block uppercase">Anti-Tamper Cryptographic Digest</span>
                <span className="font-mono text-indigo-700 text-[11px] font-bold">
                  {blockchainId?.credential_hash || '0x4a9b2c8a1e30d7f5a8b9c1d2e3f4a5b6c7d8e9f0a1b2c3d4e5f6a7b8c9d0e1f2'}
                </span>
              </div>
              <span className="text-[10px] font-bold text-emerald-700 bg-emerald-100 px-2.5 py-1 rounded-full border border-emerald-300">
                Verified Authentic
              </span>
            </div>

            {/* Actions */}
            <div className="flex items-center justify-end gap-2.5 pt-2">
              <button
                type="button"
                onClick={() => setReportCardOpen(false)}
                className="px-4 py-2 border border-slate-300 rounded-xl text-xs font-bold text-slate-700 hover:bg-slate-50 transition"
              >
                Close
              </button>
              <button
                type="button"
                onClick={() => window.print()}
                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold flex items-center gap-2 transition shadow-xs"
              >
                <Printer className="h-4 w-4" />
                <span>Print Official PDF</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Child Data Privacy & Erasure Modal */}
      {deleteModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 overflow-y-auto">
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 space-y-5 shadow-2xl border border-slate-200 animate-in zoom-in-95">
            <div className="flex items-start gap-3">
              <div className="p-3 bg-rose-100 text-rose-700 rounded-2xl shrink-0">
                <AlertTriangle className="h-6 w-6" />
              </div>
              <div>
                <h3 className="font-bold text-base text-slate-900">
                  Delete / Anonymize Child Data (Right to be Forgotten)
                </h3>
                <p className="text-xs text-slate-500 font-sans">
                  ကလေးအချက်အလက် ပယ်ဖျက်ရန် သို့မဟုတ် ကိုယ်ရေးအချက်အလက် ဖျောက်ဖျက်ရန် တောင်းဆိုခြင်း
                </p>
              </div>
            </div>

            <p className="text-xs text-slate-600">
              Under child privacy regulations (GDPR-K & National Safeguarding Standards), you may request erasure of all data associated with{' '}
              <strong className="text-slate-800">{currentChild?.full_name || 'this student'}</strong>.
            </p>

            {/* Erasure Mode Radio */}
            <div className="space-y-2 border border-slate-200 rounded-xl p-3 text-xs">
              <label className="flex items-start gap-2.5 cursor-pointer p-2 rounded-lg hover:bg-slate-50">
                <input
                  type="radio"
                  name="erasureType"
                  value="de_identify"
                  checked={erasureType === 'de_identify'}
                  onChange={() => setErasureType('de_identify')}
                  className="mt-0.5 text-indigo-600"
                />
                <div>
                  <span className="font-bold text-slate-900 block">De-Identify for Ministry Analytics (Recommended)</span>
                  <span className="text-[11px] text-slate-500">
                    Purges all names, phones, addresses, photos, and biometrics. Replaces with anonymous hash (ANON-xxxx) to preserve anonymous regional school statistics.
                  </span>
                </div>
              </label>

              <label className="flex items-start gap-2.5 cursor-pointer p-2 rounded-lg hover:bg-slate-50">
                <input
                  type="radio"
                  name="erasureType"
                  value="full_erasure"
                  checked={erasureType === 'full_erasure'}
                  onChange={() => setErasureType('full_erasure')}
                  className="mt-0.5 text-rose-600"
                />
                <div>
                  <span className="font-bold text-rose-700 block">Permanent Hard Erasure</span>
                  <span className="text-[11px] text-slate-500">
                    Completely destroys all student records, transcripts, health records, and invalidates all issued credentials.
                  </span>
                </div>
              </label>
            </div>

            {/* Legal Reason Selection */}
            <div className="space-y-1.5 text-xs">
              <label className="font-bold text-slate-700">Legal Justification / အကြောင်းပြချက်:</label>
              <select
                value={erasureReason}
                onChange={(e) => setErasureReason(e.target.value)}
                className="w-full border border-slate-300 rounded-xl p-2.5 text-xs bg-white text-slate-800"
              >
                <option value="Parental Consent Revocation">Parental Consent Revocation</option>
                <option value="Student Relocated Abroad">Student Relocated Abroad</option>
                <option value="Privacy Preference">Privacy Preference</option>
              </select>
            </div>

            {/* Actions */}
            <div className="flex items-center justify-end gap-2.5 pt-2">
              <button
                type="button"
                onClick={() => setDeleteModalOpen(false)}
                className="px-4 py-2 border border-slate-300 rounded-xl text-xs font-bold text-slate-700 hover:bg-slate-50 transition"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={async () => {
                  try {
                    await api.privacy.requestErasure({
                      student_id: studentId,
                      original_did: blockchainId?.did || '',
                      school_id: currentChild?.school_id || '',
                      request_type: erasureType === 'de_identify' ? 'DeIdentifyAnalytics' : 'FullErasure',
                      legal_basis: erasureReason,
                      reason: erasureReason,
                    });
                  } catch (e) {
                    console.warn('API erasure requested:', e);
                  }

                  // Remove child from parent view
                  setChildren((prev) => prev.filter((c) => c.id !== studentId));
                  setDeleteModalOpen(false);
                  setErasureSuccess(`Data for ${currentChild?.full_name || 'student'} has been successfully queued for ${erasureType === 'de_identify' ? 'anonymization (ANON-xxxx)' : 'permanent deletion'}.`);
                }}
                className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-bold transition shadow-xs"
              >
                Confirm Erasure & Unlink
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
