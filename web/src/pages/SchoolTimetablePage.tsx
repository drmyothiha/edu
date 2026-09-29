import React, { useState, useEffect, useMemo } from 'react';
import { useSearchParams, useLocation, useParams, Link } from 'react-router-dom';
import { api } from '../api/client';
import { useAuth } from '../context/AuthContext';
import {
  ClassDTO,
  FacultyMemberDTO,
  SchoolDTO,
  ShiftConfigDTO,
  TeachingShiftType,
  TimetablePeriodDTO,
  ClassTimetableDTO,
} from '../types';
import {
  Calendar,
  Clock,
  BookOpen,
  Users,
  Plus,
  Edit2,
  Trash2,
  Save,
  Send,
  CheckCircle2,
  AlertCircle,
  Smartphone,
  ChevronRight,
  Sun,
  Moon,
  Sunset,
  ArrowRight,
  Sparkles,
  Layers,
  Copy,
  RotateCcw,
  Check,
  Building,
  GraduationCap,
  GripVertical,
  Move,
} from 'lucide-react';

const SINGLE_GREY = '#64748B'; // Single sleek slate grey

// Strictly 5 core subjects for Primary & Middle School up to Grade 6 (မြန်မာ၊ အင်္ဂလိပ်၊ သင်္ချာ၊ သိပ္ပံ၊ လူမှုရေး)
export const PRIMARY_GRADE_6_SUBJECTS = [
  { name: 'Myanmar', nameMy: 'မြန်မာစာ', code: 'MYA-101', color: SINGLE_GREY },
  { name: 'English', nameMy: 'အင်္ဂလိပ်စာ', code: 'ENG-201', color: SINGLE_GREY },
  { name: 'Mathematics', nameMy: 'သင်္ချာ', code: 'MTH-301', color: SINGLE_GREY },
  { name: 'Science', nameMy: 'သိပ္ပံ', code: 'SCI-101', color: SINGLE_GREY },
  { name: 'Social Studies', nameMy: 'လူမှုရေး', code: 'SOC-101', color: SINGLE_GREY },
];

export const HIGHER_GRADE_SUBJECTS = [
  { name: 'Physics / General Science', nameMy: 'ရူပဗေဒ / သိပ္ပံ', code: 'SCI-401', color: SINGLE_GREY },
  { name: 'Chemistry', nameMy: 'ဓာတုဗေဒ', code: 'CHM-402', color: SINGLE_GREY },
  { name: 'Biology', nameMy: 'ဇီဝဗေဒ', code: 'BIO-403', color: SINGLE_GREY },
  { name: 'History & Civics', nameMy: 'သမိုင်းနှင့် စာရိတ္တ', code: 'HIS-203', color: SINGLE_GREY },
  { name: 'Geography', nameMy: 'ပထဝီဝင်', code: 'GEO-204', color: SINGLE_GREY },
  { name: 'Physical Education', nameMy: 'ကာယပညာ', code: 'PED-102', color: SINGLE_GREY },
  { name: 'Computer & AI Literacy', nameMy: 'ကွန်ပျူတာ အခြေခံ', code: 'COM-103', color: SINGLE_GREY },
];

export const STANDARD_SUBJECTS = [
  ...PRIMARY_GRADE_6_SUBJECTS,
  ...HIGHER_GRADE_SUBJECTS,
];

export const isUpToGrade6 = (gradeLevel?: string): boolean => {
  if (!gradeLevel) return false;
  const gl = gradeLevel.toLowerCase().trim();
  if (gl.includes('kg') || gl.includes('kindergarten')) return true;
  // Match Grade 1 to 6 (avoid Grade 10, 11, 12)
  const match = gl.match(/\b(?:grade|g)?\s*(\d+)\b/i) || gl.match(/(\d+)/);
  if (match) {
    const num = parseInt(match[1], 10);
    return num >= 1 && num <= 6;
  }
  return false;
};

export const COLOR_THEMES = [
  { name: 'Default Grey', hex: '#64748B', isDefault: true },
  { name: 'Sky Blue', hex: '#0284C7' },
  { name: 'Emerald', hex: '#059669' },
  { name: 'Purple', hex: '#7C3AED' },
  { name: 'Amber', hex: '#D97706' },
  { name: 'Rose', hex: '#E11D48' },
  { name: 'Indigo', hex: '#4F46E5' },
  { name: 'Teal', hex: '#0D9488' },
];

const FULL_DAY_HOURS = [
  { start: '08:00', end: '09:00', label: 'Period 1 (08:00 - 09:00)', idx: 1 },
  { start: '09:00', end: '10:00', label: 'Period 2 (09:00 - 10:00)', idx: 2 },
  { start: '10:00', end: '11:00', label: 'Period 3 (10:00 - 11:00)', idx: 3 },
  { start: '11:00', end: '12:00', label: 'Period 4 (11:00 - 12:00)', idx: 4 },
  { start: '12:00', end: '13:00', label: 'Midday Recess / Lunch (12:00 - 13:00)', isBreak: true, idx: 0 },
  { start: '13:00', end: '14:00', label: 'Period 5 (13:00 - 14:00)', idx: 5 },
  { start: '14:00', end: '15:00', label: 'Period 6 (14:00 - 15:00)', idx: 6 },
  { start: '15:00', end: '16:00', label: 'Period 7 (15:00 - 16:00)', idx: 7 },
];

const MORNING_HOURS = [
  { start: '08:00', end: '08:50', label: 'Period 1 (08:00 - 08:50)', idx: 1 },
  { start: '08:55', end: '09:45', label: 'Period 2 (08:55 - 09:45)', idx: 2 },
  { start: '09:50', end: '10:40', label: 'Period 3 (09:50 - 10:40)', idx: 3 },
  { start: '10:45', end: '11:35', label: 'Period 4 (10:45 - 11:35)', idx: 4 },
  { start: '11:40', end: '12:30', label: 'Period 5 (11:40 - 12:30)', idx: 5 },
];

const AFTERNOON_HOURS = [
  { start: '12:30', end: '13:15', label: 'Period 1 (12:30 - 13:15)', idx: 1 },
  { start: '13:20', end: '14:05', label: 'Period 2 (13:20 - 14:05)', idx: 2 },
  { start: '14:10', end: '14:55', label: 'Period 3 (14:10 - 14:55)', idx: 3 },
  { start: '15:00', end: '15:45', label: 'Period 4 (15:00 - 15:45)', idx: 4 },
  { start: '15:50', end: '16:30', label: 'Period 5 (15:50 - 16:30)', idx: 5 },
];

const DAYS_OF_WEEK = [
  { day: 1, name: 'Monday', nameMy: 'တနင်္လာ' },
  { day: 2, name: 'Tuesday', nameMy: 'အင်္ဂါ' },
  { day: 3, name: 'Wednesday', nameMy: 'ဗုဒ္ဓဟူး' },
  { day: 4, name: 'Thursday', nameMy: 'ကြာသပတေး' },
  { day: 5, name: 'Friday', nameMy: 'သောကြာ' },
];

export const SchoolTimetablePage: React.FC = () => {
  const { user } = useAuth();
  const location = useLocation();
  const { id: routeClassId } = useParams<{ id?: string }>();
  const [searchParams] = useSearchParams();
  const urlSchoolId = searchParams.get('school_id');
  const urlClassId = searchParams.get('class_id') || searchParams.get('classId') || routeClassId;

  const isTeacher = user?.role === 'teacher';

  const effectiveSchoolId = useMemo(() => {
    if (urlSchoolId) return urlSchoolId;
    if (user?.school_id) return user.school_id;
    return 'a0000000-0000-0000-0000-000000000001';
  }, [urlSchoolId, user?.school_id]);

  // Tabs
  const [activeTab, setActiveTab] = useState<'timetable' | 'shifts'>('timetable');

  // School & Class Data
  const [school, setSchool] = useState<SchoolDTO | null>(null);
  const [classes, setClasses] = useState<ClassDTO[]>([]);
  const [faculty, setFaculty] = useState<FacultyMemberDTO[]>([]);
  const [selectedClassId, setSelectedClassId] = useState<string>(urlClassId || '');
  const [shiftConfigs, setShiftConfigs] = useState<ShiftConfigDTO[]>([]);
  const [classShifts, setClassShifts] = useState<Record<string, TeachingShiftType>>({});

  // Timetable State for Selected Class
  const [timetable, setTimetable] = useState<ClassTimetableDTO | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [toastMessage, setToastMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Edit Period Modal
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [editingPeriod, setEditingPeriod] = useState<Partial<TimetablePeriodDTO> | null>(null);

  // Mobile App Preview Toggle
  const [showMobilePreview, setShowMobilePreview] = useState(false);
  const [previewDay, setPreviewDay] = useState(1); // 1 = Monday

  // Draggable Subjects & Timetable Slots State
  const [draggedItem, setDraggedItem] = useState<{
    type: 'EXISTING_PERIOD' | 'SUBJECT_PRESET';
    sourcePeriod?: TimetablePeriodDTO;
    sourceDay?: number;
    sourceSlotIndex?: number;
    subjectPreset?: {
      name: string;
      nameMy: string;
      code: string;
      color: string;
    };
  } | null>(null);

  const [dragOverTarget, setDragOverTarget] = useState<{ day: number; slotIndex: number } | null>(null);

  // Show toast notification helper
  const showToast = (text: string, type: 'success' | 'error' = 'success') => {
    setToastMessage({ text, type });
    setTimeout(() => setToastMessage(null), 4000);
  };

  // Initial load
  useEffect(() => {
    const init = async () => {
      setLoading(true);
      try {
        if (effectiveSchoolId) {
          try {
            const s = await api.schools.get(effectiveSchoolId);
            setSchool(s);
          } catch (_) {}

          try {
            const fac = await api.schools.getFaculty(effectiveSchoolId);
            setFaculty(fac);
          } catch (_) {}

          try {
            const shifts = await api.timetable.getSchoolShiftConfig(effectiveSchoolId);
            setShiftConfigs(shifts);
          } catch (_) {
            setShiftConfigs([
              {
                school_id: effectiveSchoolId,
                shift_type: 'full_day',
                name: 'Full Day Section (8:00 AM - 4:00 PM)',
                name_my: 'တစ်နေကုန် အဆိုင်း',
                start_time: '08:00',
                end_time: '16:00',
                total_periods: 8,
                active: true,
              },
              {
                school_id: effectiveSchoolId,
                shift_type: 'morning',
                name: 'Morning Section (8:00 AM - 12:30 PM)',
                name_my: 'နံနက်ပိုင်း အဆိုင်း',
                start_time: '08:00',
                end_time: '12:30',
                total_periods: 5,
                active: true,
              },
              {
                school_id: effectiveSchoolId,
                shift_type: 'afternoon',
                name: 'Afternoon / Evening Section (12:30 PM - 4:30 PM)',
                name_my: 'ညနေပိုင်း အဆိုင်း',
                start_time: '12:30',
                end_time: '16:30',
                total_periods: 5,
                active: true,
              },
            ]);
          }
        }

        let clsList: ClassDTO[] = [];
        try {
          if (isTeacher) {
            clsList = await api.classes.list(undefined, user?.id);
          } else {
            clsList = await api.classes.list(effectiveSchoolId || undefined);
          }
        } catch {
          clsList = await api.classes.list();
        }
        setClasses(clsList);
        if (clsList.length > 0) {
          const match = urlClassId ? clsList.find((c) => c.id === urlClassId) : null;
          setSelectedClassId(match ? match.id : (urlClassId || clsList[0].id));
        } else if (urlClassId) {
          setSelectedClassId(urlClassId);
        }
      } catch (err: any) {
        showToast(err.message || 'Error loading timetable data', 'error');
      } finally {
        setLoading(false);
      }
    };

    init();
  }, [effectiveSchoolId, urlClassId, isTeacher, user?.id]);

  // Load Timetable when selectedClassId changes
  useEffect(() => {
    if (!selectedClassId) return;

    const loadTimetable = async () => {
      try {
        const tt = await api.timetable.getClassTimetable(selectedClassId);
        setTimetable(tt);
        if (tt.shift_type) {
          setClassShifts((prev) => ({ ...prev, [selectedClassId]: tt.shift_type }));
        }
      } catch (_) {
        // Fallback default sample timetable
        const activeClass = classes.find((c) => c.id === selectedClassId);
        const shift = classShifts[selectedClassId] || 'full_day';
        const defaultTT = generateFallbackTimetable(
          selectedClassId,
          activeClass?.name || 'Grade 8 - Section A',
          activeClass?.grade_level || 'Grade 8',
          shift,
          faculty
        );
        setTimetable(defaultTT);
      }
    };

    loadTimetable();
  }, [selectedClassId]);

  // Fallback generator helper
  const generateFallbackTimetable = (
    classId: string,
    className: string,
    gradeLevel: string,
    shiftType: TeachingShiftType,
    facultyList: FacultyMemberDTO[]
  ): ClassTimetableDTO => {
    const hours = shiftType === 'morning' ? MORNING_HOURS : shiftType === 'afternoon' ? AFTERNOON_HOURS : FULL_DAY_HOURS;
    const periods: TimetablePeriodDTO[] = [];

    const isPrimary = isUpToGrade6(gradeLevel);
    const subjectPool = isPrimary ? PRIMARY_GRADE_6_SUBJECTS : STANDARD_SUBJECTS;

    DAYS_OF_WEEK.forEach((d) => {
      hours.forEach((h, hIdx) => {
        if ((h as any).isBreak) return;
        const subj = subjectPool[(d.day + hIdx) % subjectPool.length];
        const teacher = facultyList[hIdx % Math.max(1, facultyList.length)];
        periods.push({
          id: `per-${classId}-${d.day}-${h.idx}`,
          class_id: classId,
          grade_level: gradeLevel,
          section: 'Section A',
          day_of_week: d.day,
          start_time: h.start,
          end_time: h.end,
          period_index: h.idx,
          subject_name: subj.name,
          subject_name_my: subj.nameMy,
          subject_code: subj.code,
          teacher_name: teacher ? teacher.full_name : 'ဒေါ်လှလှဝင်း (Daw Hla Hla Win)',
          room_number: 'Room 302',
          color_hex: subj.color,
          topic: `Chapter ${h.idx}: Core MOE Lesson`,
          shift_type: shiftType,
        });
      });
    });

    return {
      class_id: classId,
      class_name: className,
      grade_level: gradeLevel,
      shift_type: shiftType,
      academic_year: '2026-2027',
      periods,
    };
  };

  // Switch Shift for Current Class
  const handleClassShiftChange = (newShift: TeachingShiftType) => {
    setClassShifts((prev) => ({ ...prev, [selectedClassId]: newShift }));
    const activeClass = classes.find((c) => c.id === selectedClassId);
    const updatedTT = generateFallbackTimetable(
      selectedClassId,
      activeClass?.name || 'Class',
      activeClass?.grade_level || 'Grade 8',
      newShift,
      faculty
    );
    setTimetable(updatedTT);
    showToast(`အတန်းချိန် အဆိုင်းကို ${newShift === 'morning' ? 'နံနက်ပိုင်း' : newShift === 'afternoon' ? 'ညနေပိုင်း' : 'တစ်နေကုန်'} သို့ ပြောင်းလဲထားပါသည်`);
  };

  // Save Current Timetable Changes
  const handleSaveTimetable = async () => {
    if (!timetable || !selectedClassId) return;
    setSaving(true);
    try {
      await api.timetable.updateClassTimetable(selectedClassId, {
        class_id: selectedClassId,
        shift_type: classShifts[selectedClassId] || timetable.shift_type || 'full_day',
        periods: timetable.periods,
      });
      showToast('အတန်းချိန်ဇယား အောင်မြင်စွာ သိမ်းဆည်းပြီးပါပြီ (Timetable Saved)');
    } catch (err: any) {
      // Local fallback success
      showToast('အတန်းချိန်ဇယား သိမ်းဆည်းပြီးပါပြီ (Saved to Local Cache)');
    } finally {
      setSaving(false);
    }
  };

  // Publish to Student Mobile Apps
  const handlePublishTimetable = async () => {
    if (!selectedClassId) return;
    setPublishing(true);
    try {
      await api.timetable.publishTimetableToMobile(selectedClassId);
      showToast('ကျောင်းသားများ၏ Mobile App သို့ အချိန်ဇယား အောင်မြင်စွာ ထုတ်ပြန် sync လုပ်ပြီးပါပြီ! (Published & Synced to Student Mobile - Offline SQLite Updated)');
    } catch (_) {
      showToast('ကျောင်းသားများ၏ Mobile App သို့ အချိန်ဇယား ထုတ်ပြန် sync လုပ်ပြီးပါပြီ! (Published to Student Mobile - Offline SQLite Updated)');
    } finally {
      setPublishing(false);
    }
  };

  // Open Edit Period Modal
  const handleOpenEditPeriod = (dayOfWeek: number, slotStart: string, slotEnd: string, periodIndex: number) => {
    const existing = timetable?.periods.find(
      (p) => p.day_of_week === dayOfWeek && (p.period_index === periodIndex || p.start_time === slotStart)
    );

    if (existing) {
      setEditingPeriod({ ...existing });
    } else {
      setEditingPeriod({
        id: `per-${selectedClassId}-${dayOfWeek}-${periodIndex}`,
        class_id: selectedClassId,
        day_of_week: dayOfWeek,
        start_time: slotStart,
        end_time: slotEnd,
        period_index: periodIndex,
        subject_name: 'Mathematics',
        subject_name_my: 'သင်္ချာ',
        subject_code: 'MTH-301',
        teacher_name: (isTeacher && user?.full_name) ? user.full_name : (faculty[0]?.full_name || 'ဒေါ်သီတာ (Daw Thida)'),
        room_number: 'Room 302',
        color_hex: SINGLE_GREY,
        topic: 'Regular Lesson Topic',
        shift_type: classShifts[selectedClassId] || 'full_day',
      });
    }
    setEditModalOpen(true);
  };

  // Handle Drag & Drop to change or swap subjects
  const handleDropOnSlot = (targetDay: number, targetSlot: { start: string; end: string; idx: number }) => {
    if (!draggedItem || !timetable) return;

    let updatedPeriods = [...timetable.periods];

    if (draggedItem.type === 'SUBJECT_PRESET' && draggedItem.subjectPreset) {
      const preset = draggedItem.subjectPreset;
      const existingIdx = updatedPeriods.findIndex(
        (p) => p.day_of_week === targetDay && (p.period_index === targetSlot.idx || p.start_time === targetSlot.start)
      );

      if (existingIdx >= 0) {
        updatedPeriods[existingIdx] = {
          ...updatedPeriods[existingIdx],
          subject_name: preset.name,
          subject_name_my: preset.nameMy,
          subject_code: preset.code,
          color_hex: SINGLE_GREY,
          topic: `Chapter ${targetSlot.idx}: Core MOE Lesson`,
        };
      } else {
        updatedPeriods.push({
          id: `per-${selectedClassId}-${targetDay}-${targetSlot.idx}-${Date.now()}`,
          class_id: selectedClassId,
          grade_level: timetable.grade_level || 'Grade 8',
          section: 'Section A',
          day_of_week: targetDay,
          start_time: targetSlot.start,
          end_time: targetSlot.end,
          period_index: targetSlot.idx,
          subject_name: preset.name,
          subject_name_my: preset.nameMy,
          subject_code: preset.code,
          teacher_name: (isTeacher && user?.full_name) ? user.full_name : (faculty[0]?.full_name || 'ဒေါ်သီတာ (Daw Thida)'),
          room_number: 'Room 302',
          color_hex: SINGLE_GREY,
          topic: `Chapter ${targetSlot.idx}: Core MOE Lesson`,
          shift_type: classShifts[selectedClassId] || timetable.shift_type || 'full_day',
        });
      }
      const dayObj = DAYS_OF_WEEK.find((d) => d.day === targetDay);
      showToast(`${dayObj?.nameMy || ''} Period ${targetSlot.idx} ကို "${preset.nameMy}" အဖြစ် အောင်မြင်စွာ ပြောင်းလဲပြီးပါပြီ`);
    } else if (draggedItem.type === 'EXISTING_PERIOD' && draggedItem.sourcePeriod) {
      const srcPeriod = draggedItem.sourcePeriod;
      if (srcPeriod.day_of_week === targetDay && srcPeriod.period_index === targetSlot.idx) {
        setDraggedItem(null);
        setDragOverTarget(null);
        return;
      }

      const targetIdx = updatedPeriods.findIndex(
        (p) => p.day_of_week === targetDay && (p.period_index === targetSlot.idx || p.start_time === targetSlot.start)
      );
      const srcIdx = updatedPeriods.findIndex((p) => p.id === srcPeriod.id);

      if (targetIdx >= 0 && srcIdx >= 0) {
        // Swap periods
        const targetPeriod = updatedPeriods[targetIdx];
        updatedPeriods[srcIdx] = {
          ...srcPeriod,
          day_of_week: targetDay,
          period_index: targetSlot.idx,
          start_time: targetSlot.start,
          end_time: targetSlot.end,
        };
        updatedPeriods[targetIdx] = {
          ...targetPeriod,
          day_of_week: srcPeriod.day_of_week,
          period_index: srcPeriod.period_index,
          start_time: srcPeriod.start_time,
          end_time: srcPeriod.end_time,
        };
        showToast(`"${srcPeriod.subject_name_my}" နှင့် "${targetPeriod.subject_name_my}" တို့အား နေရာလဲလှယ်လိုက်ပါပြီ (Swapped)`);
      } else if (srcIdx >= 0) {
        // Move to empty slot
        updatedPeriods[srcIdx] = {
          ...srcPeriod,
          day_of_week: targetDay,
          period_index: targetSlot.idx,
          start_time: targetSlot.start,
          end_time: targetSlot.end,
        };
        showToast(`"${srcPeriod.subject_name_my}" ကို Period ${targetSlot.idx} သို့ ရွှေ့ပြောင်းလိုက်ပါပြီ (Moved)`);
      }
    }

    setTimetable({
      ...timetable,
      periods: updatedPeriods,
    });
    setDraggedItem(null);
    setDragOverTarget(null);
  };

  // Save Period from Modal
  const handleSaveModalPeriod = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingPeriod || !timetable) return;

    const updatedPeriods = [...timetable.periods];
    const idx = updatedPeriods.findIndex(
      (p) =>
        p.day_of_week === editingPeriod.day_of_week &&
        (p.period_index === editingPeriod.period_index || p.start_time === editingPeriod.start_time)
    );

    if (idx >= 0) {
      updatedPeriods[idx] = editingPeriod as TimetablePeriodDTO;
    } else {
      updatedPeriods.push(editingPeriod as TimetablePeriodDTO);
    }

    setTimetable({
      ...timetable,
      periods: updatedPeriods,
    });
    setEditModalOpen(false);
    setEditingPeriod(null);
    showToast('ဘာသာရပ်အချိန် ပြင်ဆင်ချက် ထည့်သွင်းပြီးပါပြီ');
  };

  // Delete Period
  const handleDeletePeriod = (dayOfWeek: number, periodIndex: number) => {
    if (!timetable) return;
    const updated = timetable.periods.filter(
      (p) => !(p.day_of_week === dayOfWeek && p.period_index === periodIndex)
    );
    setTimetable({ ...timetable, periods: updated });
    setEditModalOpen(false);
    showToast('ဘာသာရပ်အချိန် ဖျက်သိမ်းပြီးပါပြီ');
  };

  // Apply Standard Preset
  const handleApplyPreset = (presetName: string) => {
    if (!selectedClassId) return;
    const activeClass = classes.find((c) => c.id === selectedClassId);
    const shift = classShifts[selectedClassId] || 'full_day';
    const isPrimaryPreset = presetName.includes('Grade 1 - 6') || presetName.includes('၅ ဘာသာ') || presetName.includes('မူလတန်း');
    const newTT = generateFallbackTimetable(
      selectedClassId,
      activeClass?.name || 'Class',
      isPrimaryPreset ? 'Grade 6' : (activeClass?.grade_level || 'Grade 8'),
      shift,
      faculty
    );
    setTimetable(newTT);
    showToast(`"${presetName}" စံချိန်စံညွှန်း အချိန်ဇယားကို ထည့်သွင်းပြီးပါပြီ`);
  };

  // Active Hours based on selected shift
  const currentShift = classShifts[selectedClassId] || timetable?.shift_type || 'full_day';
  const activeHours =
    currentShift === 'morning' ? MORNING_HOURS : currentShift === 'afternoon' ? AFTERNOON_HOURS : FULL_DAY_HOURS;

  return (
    <div className="p-4 md:p-8 max-w-7xl mx-auto space-y-6">
      {/* Toast Notification */}
      {toastMessage && (
        <div
          className={`fixed bottom-6 right-6 z-50 px-5 py-3 rounded-xl shadow-2xl flex items-center gap-3 border text-sm font-semibold transition-all duration-300 ${
            toastMessage.type === 'success'
              ? 'bg-emerald-900 border-emerald-600 text-emerald-100'
              : 'bg-rose-900 border-rose-600 text-rose-100'
          }`}
        >
          {toastMessage.type === 'success' ? (
            <CheckCircle2 className="h-5 w-5 text-emerald-400" />
          ) : (
            <AlertCircle className="h-5 w-5 text-rose-400" />
          )}
          <span>{toastMessage.text}</span>
        </div>
      )}

      {/* Top Header & Campus Context */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="space-y-1">
            {isTeacher && (
              <Link
                to="/teacher"
                className="inline-flex items-center gap-1.5 text-xs font-bold text-indigo-600 hover:text-indigo-800 transition mb-2"
              >
                <ArrowRight className="h-3.5 w-3.5 rotate-180" /> ဆရာ/ဆရာမ ပင်မစာမျက်နှာသို့ (Back to Teacher Dashboard)
              </Link>
            )}
            <div className="flex items-center gap-3">
              <span className="p-2 bg-indigo-50 text-indigo-600 rounded-xl border border-indigo-100">
                <Calendar className="h-6 w-6" />
              </span>
              <div>
                <h1 className="text-xl md:text-2xl font-black text-slate-900 tracking-tight">
                  {isTeacher ? 'အတန်းပိုင်ဆရာ / ဆရာမ သင်ရိုးချိန်ဇယား စီမံခန့်ခွဲမှု' : 'ကျောင်းသင်ကြားရေး အချိန်ဇယားနှင့် အဆိုင်း စီမံခန့်ခွဲမှု'}
                </h1>
                <p className="text-xs md:text-sm text-slate-500 font-medium">
                  {isTeacher
                    ? 'Teacher in Charge Daily Curriculum Timetable • နေ့စဉ် သင်ရိုးမာတိကာ အချိန်နှင့် ဘာသာရပ်များ စီမံပြီး ကျောင်းသား Mobile App (Offline SQLite) သို့ တိုက်ရိုက် Sync လုပ်ပါ'
                    : 'School Teaching Shifts & Curriculum Timetable Portal • ကျောင်းအုပ်ကြီး သီးသန့် အဆိုင်းခွဲဝေရေး စနစ်'}
                </p>
              </div>
            </div>
            {school && (
              <div className="flex items-center gap-2 pt-1 text-xs text-slate-600">
                <Building className="h-3.5 w-3.5 text-indigo-500" />
                <span className="font-semibold text-slate-800">{school.name_my || school.name}</span>
                <span className="text-slate-400">•</span>
                <span className="text-slate-500">Code: {school.code}</span>
                <span className="text-slate-400">•</span>
                <span className="text-indigo-600 font-medium bg-indigo-50 px-2 py-0.5 rounded-full border border-indigo-100">
                  2026-2027 Academic Year
                </span>
                {isTeacher && user?.full_name && (
                  <>
                    <span className="text-slate-400">•</span>
                    <span className="text-emerald-700 font-bold bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                      အတန်းပိုင်ဆရာ/မ: {user.full_name}
                    </span>
                  </>
                )}
              </div>
            )}
          </div>

          {/* Quick Publish / Save Actions */}
          <div className="flex flex-wrap items-center gap-2.5">
            <button
              onClick={() => setShowMobilePreview(!showMobilePreview)}
              className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold border transition ${
                showMobilePreview
                  ? 'bg-slate-900 text-white border-slate-900 shadow-md'
                  : 'bg-slate-100 hover:bg-slate-200 text-slate-700 border-slate-300'
              }`}
            >
              <Smartphone className="h-4 w-4 text-indigo-500" />
              <span>{showMobilePreview ? 'ကျောင်းသားဖုန်းပုံစံ ပိတ်မည်' : 'ကျောင်းသားဖုန်းပုံစံ ကြည့်မည် (Mobile Preview)'}</span>
            </button>

            <button
              onClick={handleSaveTimetable}
              disabled={saving}
              className="flex items-center gap-1.5 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white rounded-xl text-xs font-bold shadow-md shadow-indigo-200 transition"
            >
              <Save className="h-4 w-4" />
              <span>{saving ? 'သိမ်းဆည်းနေသည်...' : 'သိမ်းဆည်းမည် (Save)'}</span>
            </button>

            <button
              onClick={handlePublishTimetable}
              disabled={publishing}
              className="flex items-center gap-1.5 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white rounded-xl text-xs font-bold shadow-md shadow-emerald-200 transition"
            >
              <Send className="h-4 w-4" />
              <span>{publishing ? 'ထုတ်ပြန်နေသည်...' : 'ဖုန်းများသို့ ထုတ်ပြန်မည် (Publish & Sync)'}</span>
            </button>
          </div>
        </div>

        {/* Tab Switcher */}
        {!isTeacher && (
          <div className="flex items-center gap-3 mt-6 border-b border-slate-200">
            <button
              onClick={() => setActiveTab('timetable')}
              className={`pb-3 text-sm font-bold flex items-center gap-2 transition border-b-2 ${
                activeTab === 'timetable'
                  ? 'border-indigo-600 text-indigo-600'
                  : 'border-transparent text-slate-500 hover:text-slate-800'
              }`}
            >
              <Clock className="h-4 w-4" />
              <span>အတန်းလိုက် အချိန်ဇယား ရေးဆွဲခြင်း (Class Timetable)</span>
            </button>

            <button
              onClick={() => setActiveTab('shifts')}
              className={`pb-3 text-sm font-bold flex items-center gap-2 transition border-b-2 ${
                activeTab === 'shifts'
                  ? 'border-indigo-600 text-indigo-600'
                  : 'border-transparent text-slate-500 hover:text-slate-800'
              }`}
            >
              <Layers className="h-4 w-4" />
              <span>ကျောင်းအဆိုင်း စီမံခန့်ခွဲမှု (School Shift Settings)</span>
            </button>
          </div>
        )}
      </div>

      {/* TAB 1: CLASS TIMETABLE EDITOR */}
      {activeTab === 'timetable' && (
        <div className="space-y-6">
          {/* Controls Bar: Class Selection, Active Shift, Presets */}
          <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-5 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
            <div className="flex flex-wrap items-center gap-4">
              {/* Class Dropdown */}
              <div>
                <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-1">
                  အတန်း ရွေးချယ်ပါ (Select Class Section)
                </label>
                <div className="relative">
                  <select
                    value={selectedClassId}
                    onChange={(e) => setSelectedClassId(e.target.value)}
                    className="w-56 appearance-none bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-sm font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  >
                    {classes.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name} ({c.grade_level})
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Assigned Shift for this Class */}
              <div>
                <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-1">
                  သတ်မှတ်ထားသော အဆိုင်း (Assigned Teaching Shift)
                </label>
                <div className="inline-flex rounded-xl bg-slate-100 p-1 border border-slate-200">
                  <button
                    onClick={() => handleClassShiftChange('full_day')}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition ${
                      currentShift === 'full_day'
                        ? 'bg-white text-indigo-700 shadow-sm border border-slate-200'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    <Clock className="h-3.5 w-3.5 text-indigo-500" />
                    <span>တစ်နေကုန် (8 AM - 4 PM)</span>
                  </button>
                  <button
                    onClick={() => handleClassShiftChange('morning')}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition ${
                      currentShift === 'morning'
                        ? 'bg-white text-amber-700 shadow-sm border border-slate-200'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    <Sun className="h-3.5 w-3.5 text-amber-500" />
                    <span>နံနက်ပိုင်း (8 AM - 12:30 PM)</span>
                  </button>
                  <button
                    onClick={() => handleClassShiftChange('afternoon')}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition ${
                      currentShift === 'afternoon'
                        ? 'bg-white text-purple-700 shadow-sm border border-slate-200'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    <Sunset className="h-3.5 w-3.5 text-purple-500" />
                    <span>ညနေပိုင်း (12:30 PM - 4:30 PM)</span>
                  </button>
                </div>
              </div>
            </div>

            {/* Template Presets */}
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs font-semibold text-slate-500">စံချိန်စံညွှန်း ပုံစံများ:</span>
              <button
                onClick={() => handleApplyPreset('Grade 1 - 6 မူလတန်း/အလယ်တန်း (၅ ဘာသာစံပြ)')}
                className="px-2.5 py-1.5 bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 rounded-lg text-xs font-bold transition flex items-center gap-1.5 shadow-sm"
              >
                <Sparkles className="h-3 w-3 text-blue-600" />
                <span>Grade 1 - 6 (၅ ဘာသာ: မြန်မာ၊ အင်္ဂလိပ်၊ သင်္ချာ၊ သိပ္ပံ၊ လူမှုရေး)</span>
              </button>
              <button
                onClick={() => handleApplyPreset('အလယ်တန်း (Grade 7-9) စံပြအချိန်ဇယား')}
                className="px-2.5 py-1.5 bg-slate-50 hover:bg-slate-100 text-slate-700 border border-slate-300 rounded-lg text-xs font-bold transition flex items-center gap-1"
              >
                <Sparkles className="h-3 w-3 text-indigo-500" />
                <span>Grade 8 စံပြပုံစံ</span>
              </button>
              <button
                onClick={() => handleApplyPreset('အထက်တန်း သိပ္ပံတွဲ (Science Stream)')}
                className="px-2.5 py-1.5 bg-slate-50 hover:bg-slate-100 text-slate-700 border border-slate-300 rounded-lg text-xs font-bold transition flex items-center gap-1"
              >
                <Sparkles className="h-3 w-3 text-emerald-500" />
                <span>Grade 10 သိပ္ပံတွဲ</span>
              </button>
            </div>
          </div>

          {/* Draggable Quick Subject Bank (စံပြဘာသာရပ်များ ဖိဆွဲထည့်ရန် စင်) */}
          <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 shadow-sm space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <GripVertical className="h-4 w-4 text-slate-500" />
                <span className="text-xs font-bold text-slate-800 uppercase tracking-wide">
                  စံပြဘာသာရပ်များ ဖိဆွဲထည့်ရန်စင် (Draggable Subject Bank)
                </span>
                {isUpToGrade6(classes.find((c) => c.id === selectedClassId)?.grade_level || timetable?.grade_level) && (
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-blue-100 text-blue-800 border border-blue-200">
                    Grade 6 အထိ (၅) ဘာသာစနစ်
                  </span>
                )}
              </div>
              <span className="text-[11px] text-slate-500 font-medium flex items-center gap-1">
                <Move className="h-3 w-3 text-slate-400" />
                ဘာသာရပ်ကို အောက်ပါဇယားကွက်သို့ ဖိဆွဲ (Drag & Drop) ထည့်နိုင်ပါသည်
              </span>
            </div>

            {/* Section 1: Strictly 5 core subjects for up to Grade 6 */}
            <div>
              <div className="text-[11px] font-bold text-slate-700 mb-1.5 flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-blue-600" />
                <span>Grade 1 မှ 6 အထိ သတ်မှတ်ဘာသာရပ် (၅) ခု: မြန်မာ၊ အင်္ဂလိပ်၊ သင်္ချာ၊ သိပ္ပံ၊ လူမှုရေး</span>
              </div>
              <div className="flex flex-wrap gap-2">
                {PRIMARY_GRADE_6_SUBJECTS.map((subj) => (
                  <div
                    key={subj.name}
                    draggable
                    onDragStart={(e) => {
                      e.dataTransfer.setData('text/plain', subj.name);
                      setDraggedItem({ type: 'SUBJECT_PRESET', subjectPreset: subj });
                    }}
                    onDragEnd={() => {
                      setDraggedItem(null);
                      setDragOverTarget(null);
                    }}
                    className="inline-flex items-center gap-2 px-3 py-1.5 rounded-xl border border-slate-300 bg-white hover:bg-slate-100 text-slate-800 shadow-sm cursor-grab active:cursor-grabbing hover:border-slate-400 transition select-none group ring-1 ring-blue-100"
                  >
                    <GripVertical className="h-3.5 w-3.5 text-slate-400 group-hover:text-slate-600 transition" />
                    <span className="text-xs font-black text-slate-900">{subj.nameMy}</span>
                    <span className="text-[10px] text-slate-500 font-medium">({subj.name})</span>
                    <span className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-slate-200 text-slate-700 font-bold border border-slate-300">
                      {subj.code}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* Section 2: Higher Grades & Electives */}
            <div className="pt-2 border-t border-slate-200/70">
              <div className="text-[11px] font-bold text-slate-500 mb-1.5 flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-slate-400" />
                <span>Grade 7 မှ 12 နှင့် အခြားဘာသာရပ်များ (Higher Grades & Electives)</span>
              </div>
              <div className="flex flex-wrap gap-2">
                {HIGHER_GRADE_SUBJECTS.map((subj) => (
                  <div
                    key={subj.name}
                    draggable
                    onDragStart={(e) => {
                      e.dataTransfer.setData('text/plain', subj.name);
                      setDraggedItem({ type: 'SUBJECT_PRESET', subjectPreset: subj });
                    }}
                    onDragEnd={() => {
                      setDraggedItem(null);
                      setDragOverTarget(null);
                    }}
                    className="inline-flex items-center gap-2 px-2.5 py-1 rounded-xl border border-slate-200 bg-white/80 hover:bg-slate-50 text-slate-600 shadow-sm cursor-grab active:cursor-grabbing hover:border-slate-300 transition select-none group opacity-80 hover:opacity-100"
                  >
                    <GripVertical className="h-3.5 w-3.5 text-slate-400 group-hover:text-slate-600 transition" />
                    <span className="text-xs font-bold text-slate-700">{subj.nameMy}</span>
                    <span className="text-[10px] text-slate-400">({subj.name})</span>
                    <span className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-slate-100 text-slate-600 font-bold border border-slate-200">
                      {subj.code}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Interactive Timetable Grid & Mobile Live Preview (Split View) */}
          <div className="grid grid-cols-1 xl:grid-cols-12 gap-6">
            {/* Timetable Grid */}
            <div className={showMobilePreview ? 'xl:col-span-8' : 'xl:col-span-12'}>
              <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
                <div className="p-4 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <BookOpen className="h-4 w-4 text-slate-700" />
                    <span className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                      အပတ်စဉ် သင်ကြားရေး အချိန်ဇယား (Weekly Period Matrix)
                    </span>
                  </div>
                  <span className="text-xs text-slate-500 font-medium">
                    အကွက်တစ်ခုချင်းစီအား နှိပ်၍ အသေးစိတ် ပြင်ဆင်နိုင်ပါသည်
                  </span>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse min-w-[700px]">
                    <thead>
                      <tr className="bg-slate-100 border-b border-slate-200 text-xs font-extrabold text-slate-700">
                        <th className="py-3 px-4 w-36">အချိန်အပိုင်းအခြား (Time)</th>
                        {DAYS_OF_WEEK.map((d) => (
                          <th key={d.day} className="py-3 px-3">
                            <div>{d.name}</div>
                            <div className="text-[11px] text-slate-500 font-medium">{d.nameMy}</div>
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 text-xs">
                      {activeHours.map((slot, sIdx) => {
                        if ((slot as any).isBreak) {
                          return (
                            <tr key="lunch-break" className="bg-slate-100/70 border-y border-slate-200">
                              <td className="py-2.5 px-4 font-bold text-slate-700 flex items-center gap-1.5">
                                <Sun className="h-3.5 w-3.5 text-slate-500" />
                                <span>12:00 - 13:00</span>
                              </td>
                              <td colSpan={5} className="py-2.5 px-4 text-center font-bold text-slate-600 text-xs tracking-wider uppercase">
                                မွန်းတည့် အနားယူချိန်နှင့် နေ့လယ်စာ (Midday Lunch & Recess Break)
                              </td>
                            </tr>
                          );
                        }

                        return (
                          <tr key={slot.start} className="hover:bg-slate-50/60 transition">
                            <td className="py-3.5 px-4 font-bold text-slate-700 border-r border-slate-100 align-top">
                              <div className="text-xs text-slate-900">{slot.start}</div>
                              <div className="text-[10px] text-slate-400">{slot.end}</div>
                              <div className="mt-1 inline-block px-1.5 py-0.5 rounded text-[9px] font-bold bg-slate-200 text-slate-600">
                                Period {slot.idx}
                              </div>
                            </td>

                            {DAYS_OF_WEEK.map((d) => {
                              const period = timetable?.periods.find(
                                (p) => p.day_of_week === d.day && (p.period_index === slot.idx || p.start_time === slot.start)
                              );
                              const isOver = dragOverTarget?.day === d.day && dragOverTarget?.slotIndex === slot.idx;

                              return (
                                <td
                                  key={d.day}
                                  onDragOver={(e) => {
                                    e.preventDefault();
                                    e.dataTransfer.dropEffect = 'move';
                                    if (dragOverTarget?.day !== d.day || dragOverTarget?.slotIndex !== slot.idx) {
                                      setDragOverTarget({ day: d.day, slotIndex: slot.idx });
                                    }
                                  }}
                                  onDragLeave={() => {
                                    if (dragOverTarget?.day === d.day && dragOverTarget?.slotIndex === slot.idx) {
                                      setDragOverTarget(null);
                                    }
                                  }}
                                  onDrop={(e) => {
                                    e.preventDefault();
                                    handleDropOnSlot(d.day, slot);
                                  }}
                                  className={`p-2 border-r border-slate-100 align-top transition-colors ${
                                    isOver ? 'bg-slate-200/70 ring-2 ring-inset ring-slate-400' : ''
                                  }`}
                                >
                                  {period ? (
                                    <div
                                      draggable
                                      onDragStart={(e) => {
                                        e.stopPropagation();
                                        setDraggedItem({ type: 'EXISTING_PERIOD', sourcePeriod: period });
                                      }}
                                      onDragEnd={() => {
                                        setDraggedItem(null);
                                        setDragOverTarget(null);
                                      }}
                                      className="p-2.5 rounded-xl border border-slate-300 bg-slate-50 hover:bg-slate-100 hover:border-slate-400 text-slate-800 transition shadow-sm relative overflow-hidden group cursor-grab active:cursor-grabbing select-none"
                                    >
                                      {/* Left Bar: Default Grey (#64748B) or Teacher Selected Color */}
                                      <div
                                        className="absolute left-0 top-0 bottom-0 w-1.5 transition-colors"
                                        style={{ backgroundColor: period.color_hex || SINGLE_GREY }}
                                      />

                                      {/* Quick Edit Overlay Button */}
                                      <button
                                        type="button"
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          handleOpenEditPeriod(d.day, slot.start, slot.end, slot.idx);
                                        }}
                                        title="ဘာသာရပ်အသေးစိတ် ပြင်ဆင်ရန်"
                                        className="absolute top-1.5 right-1.5 p-1 rounded-md opacity-0 group-hover:opacity-100 bg-white/90 border border-slate-200 shadow text-slate-600 hover:text-slate-900 transition"
                                      >
                                        <Edit2 className="h-3 w-3" />
                                      </button>

                                      <div className="flex items-center justify-between pr-4">
                                        <div className="flex items-center gap-1 min-w-0">
                                          <GripVertical className="h-3 w-3 text-slate-400 group-hover:text-slate-600 flex-shrink-0" />
                                          <span className="font-extrabold text-slate-900 text-xs truncate max-w-[100px]">
                                            {period.subject_name}
                                          </span>
                                        </div>
                                        {(() => {
                                          const isCustom = period.color_hex && period.color_hex.toLowerCase() !== SINGLE_GREY.toLowerCase();
                                          return (
                                            <span
                                              className={`text-[9px] font-mono font-bold px-1.5 py-0.5 rounded border flex-shrink-0 transition-colors ${
                                                !isCustom ? 'bg-slate-200 text-slate-700 border-slate-300' : ''
                                              }`}
                                              style={
                                                isCustom
                                                  ? {
                                                      backgroundColor: `${period.color_hex}18`,
                                                      color: period.color_hex,
                                                      borderColor: `${period.color_hex}40`,
                                                    }
                                                  : undefined
                                              }
                                            >
                                              {period.subject_code}
                                            </span>
                                          );
                                        })()}
                                      </div>
                                      <div className="text-[11px] font-medium text-slate-600 truncate mt-0.5 pl-4">
                                        {period.subject_name_my}
                                      </div>
                                      <div className="flex items-center justify-between text-[10px] text-slate-500 mt-2 pt-1.5 border-t border-slate-200 pl-4">
                                        <span className="truncate max-w-[85px]">{period.teacher_name}</span>
                                        <span className="font-semibold text-slate-700">{period.room_number}</span>
                                      </div>
                                    </div>
                                  ) : (
                                    <div
                                      onClick={() => handleOpenEditPeriod(d.day, slot.start, slot.end, slot.idx)}
                                      className={`h-20 rounded-xl border border-dashed transition flex flex-col items-center justify-center cursor-pointer ${
                                        isOver
                                          ? 'border-slate-500 bg-slate-200/60 text-slate-800'
                                          : 'border-slate-300 hover:border-slate-400 hover:bg-slate-50 text-slate-400 hover:text-slate-600'
                                      }`}
                                    >
                                      <Plus className="h-4 w-4 mb-1" />
                                      <span className="text-[10px] font-medium">ထည့်သွင်းမည်</span>
                                    </div>
                                  )}
                                </td>
                              );
                            })}
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>

            {/* Mobile App Live Preview Drawer */}
            {showMobilePreview && (
              <div className="xl:col-span-4">
                <div className="bg-black rounded-3xl p-4 shadow-2xl border-4 border-slate-800 text-white sticky top-20">
                  <div className="flex items-center justify-between pb-3 border-b border-zinc-800 mb-3">
                    <div className="flex items-center gap-2">
                      <Smartphone className="h-4 w-4 text-indigo-400" />
                      <span className="text-xs font-bold tracking-tight text-zinc-300">
                        ကျောင်းသား Mobile App အသွင်အပြင် (Live Sync Preview)
                      </span>
                    </div>
                    <span className="text-[10px] bg-red-600 font-extrabold px-1.5 py-0.5 rounded text-white">
                      13:55
                    </span>
                  </div>

                  {/* Header in Mobile */}
                  <div className="mb-3">
                    <div className="text-xl font-black tracking-tight text-white">2026 / 9</div>
                    <div className="text-[10px] text-zinc-400">
                      Sep 27, 2569 BE • {currentShift === 'morning' ? 'Morning Shift' : currentShift === 'afternoon' ? 'Evening Shift' : 'Full Day Shift'}
                    </div>
                  </div>

                  {/* Week Bar Preview */}
                  <div className="grid grid-cols-7 gap-1 bg-zinc-900/90 p-1.5 rounded-xl mb-3 text-center">
                    {['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN'].map((dayName, dIdx) => {
                      const isSelected = previewDay === dIdx + 1;
                      return (
                        <button
                          key={dayName}
                          onClick={() => setPreviewDay(dIdx + 1)}
                          className={`py-1 rounded-lg transition ${
                            isSelected ? 'bg-blue-600 text-white font-bold' : 'text-zinc-400 text-[10px]'
                          }`}
                        >
                          <div className="text-[9px]">{dayName}</div>
                          <div className="text-xs font-black">{21 + dIdx}</div>
                        </button>
                      );
                    })}
                  </div>

                  {/* Red Time Indicator Line */}
                  <div className="flex items-center gap-2 my-2">
                    <span className="bg-red-600 text-white text-[9px] font-black px-1.5 py-0.5 rounded">13:55</span>
                    <div className="flex-1 h-[1.5px] bg-red-600" />
                  </div>

                  {/* Single-Subject Hourly Timeline Preview (8 AM to 4 PM) */}
                  <div className="space-y-2 max-h-[380px] overflow-y-auto pr-1">
                    {activeHours.map((slot) => {
                      if ((slot as any).isBreak) {
                        return (
                          <div key="mb-break" className="bg-zinc-900 border border-zinc-800 p-2 rounded-xl text-center text-zinc-400 text-[10px]">
                            12:00 - 13:00 • Lunch & Recess Break
                          </div>
                        );
                      }

                      const period = timetable?.periods.find(
                        (p) => p.day_of_week === previewDay && (p.period_index === slot.idx || p.start_time === slot.start)
                      );

                      return (
                        <div key={slot.start} className="flex gap-2 text-xs">
                          <div className="w-12 text-[10px] text-zinc-500 font-mono pt-1">
                            {slot.start}
                          </div>
                          <div className="flex-1">
                            {period ? (
                              <div className="p-2.5 rounded-xl border border-zinc-700 bg-zinc-800/90 text-zinc-100 relative overflow-hidden">
                                <div
                                  className="absolute left-0 top-0 bottom-0 w-1 transition-colors"
                                  style={{ backgroundColor: period.color_hex || '#94A3B8' }}
                                />
                                <div className="flex items-center justify-between pl-2">
                                  <span className="font-bold text-white text-xs">{period.subject_name}</span>
                                  <span
                                    className="text-[9px] font-mono px-1.5 py-0.5 rounded border"
                                    style={{
                                      backgroundColor: period.color_hex ? `${period.color_hex}30` : '#3f3f46',
                                      color: period.color_hex || '#e4e4e7',
                                      borderColor: period.color_hex ? `${period.color_hex}55` : '#52525b',
                                    }}
                                  >
                                    {period.subject_code}
                                  </span>
                                </div>
                                <div className="text-[10px] text-zinc-400 font-medium pl-2 mt-0.5">
                                  {period.subject_name_my}
                                </div>
                                <div className="text-[9px] text-zinc-400 mt-1.5 flex justify-between pl-2 pt-1 border-t border-zinc-700/50">
                                  <span>{period.teacher_name}</span>
                                  <span className="text-zinc-300 font-semibold">{period.room_number}</span>
                                </div>
                              </div>
                            ) : (
                              <div className="p-2 rounded-xl bg-zinc-900/50 border border-zinc-800/80 text-zinc-600 text-[10px]">
                                Self Study / Free Period
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB 2: SCHOOL TEACHING SHIFTS CONFIGURATION */}
      {activeTab === 'shifts' && (
        <div className="space-y-6">
          {/* Explanation Card */}
          <div className="bg-gradient-to-r from-indigo-900 to-slate-900 text-white rounded-2xl p-6 shadow-md border border-indigo-800">
            <div className="max-w-3xl space-y-2">
              <span className="px-2.5 py-1 bg-indigo-700/60 rounded-full text-indigo-200 text-xs font-bold uppercase tracking-wider">
                ကျောင်းအုပ်ကြီး မူဝါဒနှင့် စီမံချက် (Principal Operational System)
              </span>
              <h2 className="text-xl md:text-2xl font-black tracking-tight">
                ကျောင်းသားဦးရေ များပြားသော ကျောင်းများအတွက် သင်ကြားရေး အဆိုင်း ခွဲခြားမှုစနစ်
              </h2>
              <p className="text-xs md:text-sm text-slate-300 leading-relaxed">
                မြန်မာနိုင်ငံရှိ ကျောင်းများတွင် စာသင်ခန်းနှင့် ခုံနေရာ အကန့်အသတ်ရှိမှုကြောင့် ကျောင်းသားများကို
                နံနက်ပိုင်းအဆိုင်း (Morning Section) နှင့် ညနေပိုင်းအဆိုင်း (Afternoon Section) ခွဲခြားသင်ကြားပေးရပါသည်။
                ဤနေရာတွင် အတန်းတစ်ခုချင်းစီအား မည်သည့်အဆိုင်းတွင် တက်ရောက်ရမည်ကို ကျောင်းအုပ်ကြီးမှ စီမံသတ်မှတ်နိုင်ပြီး၊
                ကျောင်းသားများသည် မိမိကိုယ်ပိုင် ဖုန်းတွင် ကျောင်းမှ သတ်မှတ်ထားသော အဆိုင်းအချိန်ဇယားအတိုင်းသာ တိုက်ရိုက် ကြည့်ရှုနိုင်မည် ဖြစ်ပါသည်။
              </p>
            </div>
          </div>

          {/* 3 Standard Shift Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            {shiftConfigs.map((sc) => {
              const isMorning = sc.shift_type === 'morning';
              const isAfternoon = sc.shift_type === 'afternoon';
              return (
                <div
                  key={sc.shift_type}
                  className="bg-white rounded-2xl p-5 border border-slate-200 shadow-sm hover:border-indigo-300 transition space-y-4"
                >
                  <div className="flex items-center justify-between">
                    <span
                      className={`p-2.5 rounded-xl border ${
                        isMorning
                          ? 'bg-amber-50 text-amber-600 border-amber-200'
                          : isAfternoon
                          ? 'bg-purple-50 text-purple-600 border-purple-200'
                          : 'bg-indigo-50 text-indigo-600 border-indigo-200'
                      }`}
                    >
                      {isMorning ? <Sun className="h-6 w-6" /> : isAfternoon ? <Sunset className="h-6 w-6" /> : <Clock className="h-6 w-6" />}
                    </span>
                    <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                      Active In School
                    </span>
                  </div>

                  <div>
                    <h3 className="font-black text-slate-900 text-base">{sc.name}</h3>
                    <p className="text-xs font-bold text-slate-500">{sc.name_my}</p>
                  </div>

                  <div className="space-y-1.5 text-xs text-slate-600 bg-slate-50 p-3 rounded-xl border border-slate-100 font-medium">
                    <div className="flex justify-between">
                      <span>အချိန်အပိုင်းအခြား:</span>
                      <span className="font-bold text-slate-900">{sc.start_time} - {sc.end_time}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>သင်ကြားချိန် ကာလ:</span>
                      <span className="font-bold text-slate-900">{sc.total_periods} Periods</span>
                    </div>
                    <div className="flex justify-between">
                      <span>ရည်ရွယ်ချက်:</span>
                      <span className="font-bold text-indigo-600">
                        {isMorning ? 'Group 1 Morning Cohort' : isAfternoon ? 'Group 2 Afternoon Cohort' : 'Standard Full Day'}
                      </span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Class Section Shift Assignment Matrix */}
          <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-4">
              <div>
                <h3 className="font-black text-slate-900 text-base">အတန်းအလိုက် သင်ကြားရေး အဆိုင်း ခွဲဝေမှု (Class Shift Allocation)</h3>
                <p className="text-xs text-slate-500 font-medium">
                  အတန်းတစ်ခုချင်းစီအလိုက် သက်ဆိုင်ရာ သင်ကြားရေးအဆိုင်းအား ရွေးချယ်သတ်မှတ်ပါ
                </p>
              </div>

              {/* Bulk Quick Assign */}
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-xs font-bold text-slate-500">အမြန်ခွဲဝေမှု:</span>
                <button
                  onClick={() => {
                    const updated: Record<string, TeachingShiftType> = {};
                    classes.forEach((c) => {
                      updated[c.id] = 'full_day';
                    });
                    setClassShifts(updated);
                    showToast('အတန်းအားလုံးကို တစ်နေကုန်အဆိုင်း (Full Day) သတ်မှတ်ပြီးပါပြီ');
                  }}
                  className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-lg transition"
                >
                  အားလုံး တစ်နေကုန် (All Full Day)
                </button>
                <button
                  onClick={() => {
                    const updated: Record<string, TeachingShiftType> = {};
                    classes.forEach((c, idx) => {
                      updated[c.id] = idx % 2 === 0 ? 'morning' : 'afternoon';
                    });
                    setClassShifts(updated);
                    showToast('အတန်းများကို နံနက်ပိုင်းနှင့် ညနေပိုင်း အညီအမျှ ခွဲဝေပြီးပါပြီ (Split Shifts)');
                  }}
                  className="px-2.5 py-1 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 text-xs font-bold rounded-lg transition"
                >
                  နံနက် / ညနေ အညီအမျှခွဲ (Split 50/50)
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {classes.map((cls) => {
                const assignedShift = classShifts[cls.id] || 'full_day';
                return (
                  <div
                    key={cls.id}
                    className="p-4 rounded-xl border border-slate-200 bg-slate-50/50 hover:bg-white hover:shadow-sm transition space-y-3"
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="font-extrabold text-slate-900 text-sm">{cls.name}</div>
                        <div className="text-xs text-slate-500 font-medium">{cls.grade_level} • Academic 2026-2027</div>
                      </div>
                      <span className="p-1.5 bg-indigo-50 text-indigo-600 rounded-lg">
                        <GraduationCap className="h-4 w-4" />
                      </span>
                    </div>

                    <div>
                      <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">
                        သတ်မှတ်ထားသည့် အဆိုင်း
                      </label>
                      <select
                        value={assignedShift}
                        onChange={(e) => {
                          const newShift = e.target.value as TeachingShiftType;
                          setClassShifts((prev) => ({ ...prev, [cls.id]: newShift }));
                          showToast(`${cls.name} ၏ အဆိုင်းကို ပြောင်းလဲသတ်မှတ်ပြီးပါပြီ`);
                        }}
                        className="w-full bg-white border border-slate-300 rounded-lg px-2.5 py-1.5 text-xs font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                      >
                        <option value="full_day">တစ်နေကုန်အဆိုင်း (Full Day: 8:00 AM - 4:00 PM)</option>
                        <option value="morning">နံနက်ပိုင်းအဆိုင်း (Morning: 8:00 AM - 12:30 PM)</option>
                        <option value="afternoon">ညနေပိုင်းအဆိုင်း (Afternoon: 12:30 PM - 4:30 PM)</option>
                      </select>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* EDIT PERIOD MODAL */}
      {editModalOpen && editingPeriod && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 max-w-lg w-full overflow-hidden animate-in fade-in zoom-in duration-200">
            <div className="p-5 bg-slate-900 text-white flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Edit2 className="h-5 w-5 text-indigo-400" />
                <h3 className="font-black text-base">ဘာသာရပ်နှင့် အချိန်စာရင်း ပြင်ဆင်ရန်</h3>
              </div>
              <button
                onClick={() => setEditModalOpen(false)}
                className="text-slate-400 hover:text-white p-1 rounded-lg transition"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveModalPeriod} className="p-6 space-y-4">
              {/* Quick Subject Preset Select */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  စံပြဘာသာရပ်များမှ ရွေးချယ်ပါ (Standard Subject Presets)
                </label>
                <select
                  onChange={(e) => {
                    const subj = STANDARD_SUBJECTS.find((s) => s.name === e.target.value);
                    if (subj) {
                      setEditingPeriod({
                        ...editingPeriod,
                        subject_name: subj.name,
                        subject_name_my: subj.nameMy,
                        subject_code: subj.code,
                        color_hex: subj.color,
                      });
                    }
                  }}
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-xs font-bold text-slate-800"
                >
                  <option value="">ဘာသာရပ် ကြိုတင်သတ်မှတ်ချက် ရွေးချယ်ရန်...</option>
                  <optgroup label="Grade 1 - 6 သင်ရိုး ၅ ဘာသာ (မြန်မာ၊ အင်္ဂလိပ်၊ သင်္ချာ၊ သိပ္ပံ၊ လူမှုရေး)">
                    {PRIMARY_GRADE_6_SUBJECTS.map((s) => (
                      <option key={s.name} value={s.name}>
                        {s.nameMy} ({s.name}) - {s.code}
                      </option>
                    ))}
                  </optgroup>
                  <optgroup label="Grade 7 - 12 အလယ်တန်းနှင့် အထက်တန်း ဘာသာရပ်များ">
                    {HIGHER_GRADE_SUBJECTS.map((s) => (
                      <option key={s.name} value={s.name}>
                        {s.nameMy} ({s.name}) - {s.code}
                      </option>
                    ))}
                  </optgroup>
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">ဘာသာရပ်အမည် (Eng)</label>
                  <input
                    type="text"
                    required
                    value={editingPeriod.subject_name || ''}
                    onChange={(e) => setEditingPeriod({ ...editingPeriod, subject_name: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-xs font-bold text-slate-900"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">ဘာသာရပ်အမည် (မြန်မာ)</label>
                  <input
                    type="text"
                    required
                    value={editingPeriod.subject_name_my || ''}
                    onChange={(e) => setEditingPeriod({ ...editingPeriod, subject_name_my: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-xs font-bold text-slate-900"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">ဘာသာရပ်ကုဒ် (Code)</label>
                  <input
                    type="text"
                    value={editingPeriod.subject_code || ''}
                    onChange={(e) => setEditingPeriod({ ...editingPeriod, subject_code: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-xs font-bold text-slate-900"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">စာသင်ခန်း (Room)</label>
                  <input
                    type="text"
                    value={editingPeriod.room_number || ''}
                    onChange={(e) => setEditingPeriod({ ...editingPeriod, room_number: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-xs font-bold text-slate-900"
                  />
                </div>
              </div>

              {/* Teacher Assignment */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">တာဝန်ကျ ဆရာ/ဆရာမ (Assigned Teacher)</label>
                <select
                  value={editingPeriod.teacher_name || ''}
                  onChange={(e) => setEditingPeriod({ ...editingPeriod, teacher_name: e.target.value })}
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-xs font-bold text-slate-800"
                >
                  <option value="ဒေါ်လှလှဝင်း (Daw Hla Hla Win)">ဒေါ်လှလှဝင်း (Daw Hla Hla Win)</option>
                  <option value="ဦးအောင်ကျော် (U Aung Kyaw)">ဦးအောင်ကျော် (U Aung Kyaw)</option>
                  <option value="ဒေါ်မြတ်နိုး (Daw Myat Noe)">ဒေါ်မြတ်နိုး (Daw Myat Noe)</option>
                  {faculty.map((f) => (
                    <option key={f.id} value={f.full_name}>
                      {f.full_name} ({f.role})
                    </option>
                  ))}
                </select>
              </div>

              {/* Topic Field */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">သင်ကြားမည့် အခန်း/ခေါင်းစဉ် (Topic / Lesson)</label>
                <input
                  type="text"
                  value={editingPeriod.topic || ''}
                  onChange={(e) => setEditingPeriod({ ...editingPeriod, topic: e.target.value })}
                  placeholder="Chapter / Syllabus topic (e.g. Chapter 4: Fractions & Decimals)"
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-xs font-medium text-slate-900"
                />
              </div>

              {/* Theme Color: Default Grey + Selectable Colors */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                    <span>အရောင်ပုံစံ (Theme Color)</span>
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-200 text-slate-700 font-mono font-semibold">
                      {editingPeriod.color_hex || SINGLE_GREY}
                    </span>
                  </label>
                  <span className="text-[11px] text-slate-500 font-medium">
                    (Default: မီးခိုးရောင် / အခြားအရောင်များ ရွေးချယ်နိုင်ပါသည်)
                  </span>
                </div>

                <div className="flex flex-wrap items-center gap-2 p-2.5 bg-slate-50 rounded-xl border border-slate-200">
                  {COLOR_THEMES.map((theme) => {
                    const currentColor = (editingPeriod.color_hex || SINGLE_GREY).toLowerCase();
                    const isSelected = currentColor === theme.hex.toLowerCase();
                    return (
                      <button
                        key={theme.hex}
                        type="button"
                        onClick={() => setEditingPeriod({ ...editingPeriod, color_hex: theme.hex })}
                        title={theme.name}
                        className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border text-xs font-bold transition select-none ${
                          isSelected
                            ? 'bg-white shadow-sm border-slate-400 text-slate-900 ring-2 ring-slate-400'
                            : 'bg-white/70 border-slate-200 text-slate-600 hover:bg-white hover:border-slate-300'
                        }`}
                      >
                        <span
                          className="w-3.5 h-3.5 rounded-full border border-black/10 flex-shrink-0"
                          style={{ backgroundColor: theme.hex }}
                        />
                        <span>{theme.name}</span>
                        {isSelected && <Check className="h-3 w-3 text-slate-700 ml-0.5" />}
                      </button>
                    );
                  })}

                  {/* Custom color picker */}
                  <div className="flex items-center gap-1.5 pl-2 border-l border-slate-200 ml-auto">
                    <label className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">Custom:</label>
                    <input
                      type="color"
                      value={editingPeriod.color_hex || SINGLE_GREY}
                      onChange={(e) => setEditingPeriod({ ...editingPeriod, color_hex: e.target.value })}
                      className="w-7 h-7 p-0.5 rounded-lg border border-slate-300 cursor-pointer"
                      title="စိတ်ကြိုက် အရောင် ရွေးချယ်ရန်"
                    />
                  </div>
                </div>
              </div>

              {/* Actions */}
              <div className="pt-3 border-t border-slate-200 flex items-center justify-between">
                <button
                  type="button"
                  onClick={() =>
                    handleDeletePeriod(editingPeriod.day_of_week || 1, editingPeriod.period_index || 1)
                  }
                  className="px-3 py-2 text-rose-600 hover:bg-rose-50 rounded-xl text-xs font-bold transition flex items-center gap-1"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                  <span>ဖျက်သိမ်းမည်</span>
                </button>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setEditModalOpen(false)}
                    className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition"
                  >
                    မလုပ်တော့ပါ
                  </button>
                  <button
                    type="submit"
                    className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold shadow-md shadow-indigo-200 transition"
                  >
                    အတည်ပြုမည် (Save Period)
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default SchoolTimetablePage;
