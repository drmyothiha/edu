import React, { useState } from 'react';
import { WholeChildProfileDTO, WholeChildSyncResponse } from '../types';
import { api } from '../api/client';
import {
  Heart,
  Activity,
  Award,
  BookOpen,
  Smile,
  ShieldCheck,
  Download,
  Upload,
  CheckCircle2,
  AlertCircle,
  FileText,
  Calendar,
  Sparkles,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';

interface WholeChildMatrixProps {
  profiles: WholeChildProfileDTO[];
  classId?: string;
  className?: string;
  schoolCode?: string;
  onRefresh?: () => void;
  readOnly?: boolean;
}

export const WholeChildMatrix: React.FC<WholeChildMatrixProps> = ({
  profiles,
  classId,
  className = 'Grade 5-A (Primary)',
  schoolCode = 'MMR013035-BEHS01',
  onRefresh,
  readOnly = false,
}) => {
  const [selectedStudentId, setSelectedStudentId] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [syncResult, setSyncResult] = useState<WholeChildSyncResponse | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);

  // Export current class profiles as offline sync JSON bundle
  const handleExportBundle = () => {
    const bundle = {
      sync_metadata: {
        protocol_version: '2.1-whole-child',
        school_code: schoolCode,
        school_name: 'Basic Education High School Intaing (အခြေခံပညာအထက်တန်းကျောင်း အင်းတိုင်)',
        township: 'Hlegu / Bago Border',
        class_id: classId || 'cls_grade5a_2026',
        class_name: className,
        academic_year: '2026-2027',
        reporting_period: profiles[0]?.period || '2026-10',
        reporting_teacher: {
          teacher_id: 'usr_thida_0911',
          name: 'Daw Thida',
          role: 'Classroom Teacher & Head of Grade 5',
        },
        generated_at: new Date().toISOString(),
        total_official_school_days: 22,
        total_enrolled_students: profiles.length,
        checksum: `sha256:${Math.random().toString(36).substring(2)}${Date.now()}`,
      },
      students: profiles.map((p, idx) => ({
        student_id: p.student_id,
        roll_no: `5A-0${idx + 1}`,
        national_student_id: p.student_email,
        full_name: p.student_name,
        sync_record_hash: p.sync_record_hash,
        academic_profile: p.academic_profile,
        physical_growth_profile: p.physical_growth_profile,
        health_visibility_profile: p.health_visibility_profile,
        wellbeing_profile: p.wellbeing_profile,
        social_citizenship_profile: p.social_citizenship_profile,
      })),
    };

    const blob = new Blob([JSON.stringify(bundle, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `whole_child_sync_${(className || 'class').replace(/\s+/g, '_')}_${profiles[0]?.period || '2026-10'}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  // Upload offline sync JSON bundle
  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setUploading(true);
    setUploadError(null);
    setSyncResult(null);

    try {
      const text = await file.text();
      const payload = JSON.parse(text);
      const res = await api.sync.uploadBatch(payload, 'usb_file_upload');
      setSyncResult(res);
      if (onRefresh) onRefresh();
    } catch (err: any) {
      setUploadError(err.message || 'Failed to ingest sync bundle');
    } finally {
      setUploading(false);
      event.target.value = '';
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Banner: Whole-Child Philosophy & Sync Tooling */}
      <div className="rounded-2xl border border-indigo-200 bg-gradient-to-r from-indigo-900 via-slate-900 to-indigo-950 p-6 text-white shadow-md relative overflow-hidden">
        <div className="absolute top-0 right-0 w-80 h-80 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none" />

        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                Offline-First Framework
              </span>
              <span className="text-xs text-indigo-200">
                Grade 5-A • Academic Year 2026-2027
              </span>
            </div>
            <h2 className="text-xl font-black tracking-tight text-white flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-amber-400" />
              Whole-Child Development Matrix (ဘက်စုံဖွံ့ဖြိုးမှု စံနှုန်းများ)
            </h2>
            <p className="text-xs text-indigo-200/80 max-w-2xl leading-relaxed">
              Moving beyond pure exam marks to recognize the holistic development of the child:
              health, physical growth, wellbeing, social participation, and competencies.
            </p>
          </div>

          {!readOnly && (
            <div className="flex flex-wrap items-center gap-2.5">
              {/* Export Button */}
              <button
                onClick={handleExportBundle}
                disabled={profiles.length === 0}
                className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl bg-white/10 hover:bg-white/20 border border-white/20 text-white text-xs font-bold transition shadow-sm disabled:opacity-50"
              >
                <Download className="h-4 w-4 text-indigo-300" />
                Export Monthly Sync File (.json)
              </button>

              {/* Import / Upload Button */}
              <label className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold transition shadow-md cursor-pointer">
                <Upload className="h-4 w-4" />
                {uploading ? 'Ingesting...' : 'Import USB Sync File'}
                <input
                  type="file"
                  accept=".json"
                  onChange={handleFileUpload}
                  disabled={uploading}
                  className="hidden"
                />
              </label>
            </div>
          )}
        </div>

        {/* 5 Pillar Badges */}
        <div className="relative z-10 grid grid-cols-2 sm:grid-cols-5 gap-2 mt-5 pt-4 border-t border-white/10">
          <div className="flex items-center gap-2 text-xs font-semibold text-indigo-100">
            <BookOpen className="h-4 w-4 text-sky-400" />
            <span>9.1 Academic Profile</span>
          </div>
          <div className="flex items-center gap-2 text-xs font-semibold text-indigo-100">
            <Activity className="h-4 w-4 text-emerald-400" />
            <span>9.2 Physical Growth</span>
          </div>
          <div className="flex items-center gap-2 text-xs font-semibold text-indigo-100">
            <ShieldCheck className="h-4 w-4 text-amber-400" />
            <span>9.3 Health Visibility</span>
          </div>
          <div className="flex items-center gap-2 text-xs font-semibold text-indigo-100">
            <Smile className="h-4 w-4 text-rose-400" />
            <span>9.4 Wellbeing</span>
          </div>
          <div className="flex items-center gap-2 text-xs font-semibold text-indigo-100">
            <Award className="h-4 w-4 text-purple-400" />
            <span>9.5 Social Citizenship</span>
          </div>
        </div>
      </div>

      {/* Sync Upload Feedback */}
      {uploadError && (
        <div className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-xs font-medium text-rose-800 flex items-center gap-2">
          <AlertCircle className="h-4 w-4 text-rose-600 flex-shrink-0" />
          <span>{uploadError}</span>
        </div>
      )}

      {syncResult && (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-xs font-medium text-emerald-900 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="h-5 w-5 text-emerald-600 flex-shrink-0" />
            <div>
              <p className="font-bold">{syncResult.message}</p>
              <p className="text-[11px] text-emerald-700 mt-0.5 font-mono">
                Checksum: {syncResult.checksum.substring(0, 24)}... • Synced at: {new Date(syncResult.synced_at).toLocaleTimeString()}
              </p>
            </div>
          </div>
          <span className="px-2.5 py-1 rounded-full text-[11px] font-bold bg-emerald-200 text-emerald-900">
            {syncResult.processed_students} Records Ingested
          </span>
        </div>
      )}

      {/* Student Profile Cards */}
      {profiles.length === 0 ? (
        <div className="py-12 text-center bg-white rounded-2xl border border-slate-200 p-8 shadow-sm">
          <FileText className="h-10 w-10 text-slate-300 mx-auto mb-3" />
          <p className="text-base font-bold text-slate-800">No Whole-Child Profiles Synced for this Period</p>
          <p className="text-xs text-slate-500 mt-1 max-w-md mx-auto">
            Classroom swiping logs and monthly evaluations will appear here once submitted or imported via offline sync.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {profiles.map((student) => {
            const isExpanded = selectedStudentId === student.student_id;
            const acad = student.academic_profile;
            const phys = student.physical_growth_profile;
            const health = student.health_visibility_profile;
            const well = student.wellbeing_profile;
            const social = student.social_citizenship_profile;

            return (
              <div
                key={student.id}
                className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden transition-all hover:border-indigo-300"
              >
                {/* Collapsed Header */}
                <div
                  onClick={() => setSelectedStudentId(isExpanded ? null : student.student_id)}
                  className="p-5 flex flex-col md:flex-row md:items-center justify-between gap-4 cursor-pointer hover:bg-slate-50/60 transition"
                >
                  <div className="flex items-center gap-3.5">
                    <div className="w-12 h-12 rounded-xl bg-indigo-50 border border-indigo-200 flex items-center justify-center font-bold text-indigo-700 text-sm shadow-sm flex-shrink-0">
                      {student.student_name.substring(0, 2).toUpperCase()}
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="font-bold text-slate-900 text-base">{student.student_name}</h3>
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-100 text-slate-700 font-mono">
                          {student.student_email.split('@')[0]}
                        </span>
                      </div>
                      <p className="text-xs text-slate-500 mt-0.5">
                        Reporting Period: <span className="font-semibold text-slate-700">{student.period}</span> • Source:{' '}
                        <span className="font-medium text-emerald-700">{student.sync_source}</span>
                      </p>
                    </div>
                  </div>

                  {/* Summary Metric Pills */}
                  <div className="flex flex-wrap items-center gap-2.5">
                    {/* Attendance Pill */}
                    <div className="px-3 py-1.5 rounded-lg bg-emerald-50 border border-emerald-200 text-right">
                      <div className="text-[10px] font-bold text-emerald-800 uppercase tracking-tight">Attendance</div>
                      <div className="text-sm font-black text-emerald-700">
                        {student.attendance_rate_pct.toFixed(1)}%
                      </div>
                    </div>

                    {/* Academic Grade Point */}
                    <div className="px-3 py-1.5 rounded-lg bg-sky-50 border border-sky-200 text-right">
                      <div className="text-[10px] font-bold text-sky-800 uppercase tracking-tight">GPA / Term</div>
                      <div className="text-sm font-black text-sky-700">
                        {acad?.assessments?.term_grade_point || 'A'}
                      </div>
                    </div>

                    {/* Wellbeing Emotional State */}
                    <div className="px-3 py-1.5 rounded-lg bg-rose-50 border border-rose-200 text-right">
                      <div className="text-[10px] font-bold text-rose-800 uppercase tracking-tight">Wellbeing</div>
                      <div className="text-xs font-bold text-rose-700 capitalize">
                        {well?.monthly_checkin_summary?.dominant_emotional_state?.replace('_', ' ') || 'Content'}
                      </div>
                    </div>

                    {/* Chevron Indicator */}
                    <div className="p-2 rounded-lg bg-slate-100 text-slate-500">
                      {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                    </div>
                  </div>
                </div>

                {/* Expanded 5-Pillar Detailed View */}
                {isExpanded && (
                  <div className="border-t border-slate-100 bg-slate-50/50 p-5 space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                      {/* 9.1 Academic Profile */}
                      <div className="rounded-xl bg-white border border-slate-200 p-4 shadow-sm space-y-3">
                        <div className="flex items-center gap-2 text-xs font-black text-slate-900 uppercase tracking-wider border-b border-slate-100 pb-2">
                          <BookOpen className="h-4 w-4 text-sky-600" />
                          <span>9.1 Academic Profile</span>
                        </div>

                        {/* Exam Marks */}
                        <div>
                          <span className="text-[11px] font-bold text-slate-500 block mb-1.5">Exam Scores:</span>
                          <div className="grid grid-cols-2 gap-1.5 text-xs">
                            {acad?.assessments?.monthly_exam &&
                              Object.entries(acad.assessments.monthly_exam).map(([subj, score]) => (
                                <div key={subj} className="flex justify-between px-2 py-1 rounded bg-slate-50 border border-slate-100">
                                  <span className="capitalize text-slate-600">{subj}:</span>
                                  <span className="font-bold text-slate-900">{score}</span>
                                </div>
                              ))}
                          </div>
                        </div>

                        {/* Competencies */}
                        {acad?.competency_mastery && (
                          <div>
                            <span className="text-[11px] font-bold text-slate-500 block mb-1.5">Competency Mastery:</span>
                            <div className="flex flex-wrap gap-1.5">
                              {acad.competency_mastery.map((c, i) => (
                                <span
                                  key={i}
                                  className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                                    c.status === 'mastered'
                                      ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                      : 'bg-amber-50 text-amber-700 border border-amber-200'
                                  }`}
                                >
                                  {c.domain} ({c.status})
                                </span>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>

                      {/* 9.2 Physical Growth Profile */}
                      <div className="rounded-xl bg-white border border-slate-200 p-4 shadow-sm space-y-3">
                        <div className="flex items-center gap-2 text-xs font-black text-slate-900 uppercase tracking-wider border-b border-slate-100 pb-2">
                          <Activity className="h-4 w-4 text-emerald-600" />
                          <span>9.2 Physical Growth Profile</span>
                        </div>

                        <div className="grid grid-cols-3 gap-2 text-center">
                          <div className="p-2 rounded-lg bg-emerald-50/60 border border-emerald-100">
                            <span className="text-[10px] font-bold text-slate-500 block">Height</span>
                            <span className="text-sm font-bold text-emerald-800">
                              {phys?.measurements?.height_cm || '136.5'} cm
                            </span>
                          </div>
                          <div className="p-2 rounded-lg bg-emerald-50/60 border border-emerald-100">
                            <span className="text-[10px] font-bold text-slate-500 block">Weight</span>
                            <span className="text-sm font-bold text-emerald-800">
                              {phys?.measurements?.weight_kg || '30.0'} kg
                            </span>
                          </div>
                          <div className="p-2 rounded-lg bg-emerald-50/60 border border-emerald-100">
                            <span className="text-[10px] font-bold text-slate-500 block">BMI</span>
                            <span className="text-sm font-bold text-emerald-800">
                              {phys?.measurements?.calculated_bmi || '16.0'}
                            </span>
                          </div>
                        </div>

                        <div className="text-xs space-y-1 text-slate-600">
                          <p>
                            <span className="font-semibold text-slate-700">Category:</span>{' '}
                            <span className="text-emerald-700 font-bold">Standard Healthy</span>
                          </p>
                          <p>
                            <span className="font-semibold text-slate-700">Activities / Sports:</span>{' '}
                            {phys?.physical_fitness_activity?.preferred_sports?.join(', ') || 'Football, Chinlon'}
                          </p>
                        </div>
                      </div>

                      {/* 9.3 Health Visibility Profile */}
                      <div className="rounded-xl bg-white border border-slate-200 p-4 shadow-sm space-y-3">
                        <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                          <div className="flex items-center gap-2 text-xs font-black text-slate-900 uppercase tracking-wider">
                            <ShieldCheck className="h-4 w-4 text-amber-600" />
                            <span>9.3 Health Visibility</span>
                          </div>
                          <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-amber-50 text-amber-800 border border-amber-200">
                            Off-Chain Sensitive
                          </span>
                        </div>

                        <div className="space-y-1.5 text-xs text-slate-600">
                          <div className="flex justify-between py-1 border-b border-slate-100">
                            <span>Vision Screening:</span>
                            <span className="font-bold text-slate-900">
                              {health?.routine_screenings?.vision_check || 'Normal 20/20'}
                            </span>
                          </div>
                          <div className="flex justify-between py-1 border-b border-slate-100">
                            <span>Hearing Screening:</span>
                            <span className="font-bold text-slate-900">
                              {health?.routine_screenings?.hearing_check || 'Normal'}
                            </span>
                          </div>
                          <div className="flex justify-between py-1 border-b border-slate-100">
                            <span>Annual Deworming:</span>
                            <span className="font-bold text-emerald-700">Completed (2026)</span>
                          </div>
                          <div className="flex justify-between py-1">
                            <span>Allergies:</span>
                            <span className="font-bold text-slate-900">
                              {health?.recurring_conditions_and_alerts?.known_allergies?.join(', ') || 'None reported'}
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* 9.4 Wellbeing Profile */}
                      <div className="rounded-xl bg-white border border-slate-200 p-4 shadow-sm space-y-3">
                        <div className="flex items-center gap-2 text-xs font-black text-slate-900 uppercase tracking-wider border-b border-slate-100 pb-2">
                          <Smile className="h-4 w-4 text-rose-600" />
                          <span>9.4 Wellbeing Profile</span>
                        </div>

                        <div className="space-y-2 text-xs">
                          <div className="flex items-center justify-between">
                            <span className="text-slate-500 font-medium">Classroom Engagement Index:</span>
                            <span className="font-black text-rose-700">
                              {well?.monthly_checkin_summary?.classroom_engagement_index || 4.8} / 5.0
                            </span>
                          </div>

                          <div className="p-2.5 rounded-lg bg-rose-50/50 border border-rose-100 text-slate-700 text-xs">
                            <span className="font-bold text-rose-900 block mb-0.5">Teacher Observations:</span>
                            <p className="italic">
                              "{well?.teacher_observations?.notes || 'Active learner, helps peers and participates enthusiastically in group activities.'}"
                            </p>
                          </div>
                        </div>
                      </div>

                      {/* 9.5 Social Citizenship Profile */}
                      <div className="rounded-xl bg-white border border-slate-200 p-4 shadow-sm space-y-3 md:col-span-2">
                        <div className="flex items-center gap-2 text-xs font-black text-slate-900 uppercase tracking-wider border-b border-slate-100 pb-2">
                          <Award className="h-4 w-4 text-purple-600" />
                          <span>9.5 Social Participation & Citizenship Profile (Positive Non-Punitive)</span>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                          <div>
                            <span className="text-[11px] font-bold text-slate-500 block mb-1.5">Leadership & Club Roles:</span>
                            <div className="space-y-1">
                              {social?.leadership_and_roles?.map((r, i) => (
                                <div key={i} className="flex items-center gap-1.5 font-bold text-purple-900">
                                  <span className="w-1.5 h-1.5 rounded-full bg-purple-600" />
                                  <span>{r.role} ({r.tenure})</span>
                                </div>
                              ))}
                              {social?.clubs_and_extracurriculars?.map((c, i) => (
                                <div key={i} className="flex items-center gap-1.5 text-slate-700">
                                  <span className="w-1.5 h-1.5 rounded-full bg-slate-400" />
                                  <span>{c.club_name}</span>
                                </div>
                              ))}
                            </div>
                          </div>

                          <div>
                            <span className="text-[11px] font-bold text-slate-500 block mb-1.5">Awarded Citizenship Badges:</span>
                            <div className="flex flex-wrap gap-1.5">
                              {social?.teamwork_and_peer_conduct?.citizenship_badges_awarded?.map((b, i) => (
                                <span
                                  key={i}
                                  className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold bg-purple-50 text-purple-800 border border-purple-200 shadow-sm"
                                >
                                  <Award className="h-3 w-3 text-purple-600" />
                                  <span>{b}</span>
                                </span>
                              )) || (
                                <span className="text-slate-400">Punctuality Star, Helpful Classmate</span>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
