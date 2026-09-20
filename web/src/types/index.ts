export type UserRole = 'sysadmin' | 'school_admin' | 'admin' | 'teacher' | 'parent' | 'student';

export interface User {
  id: string;
  email: string;
  full_name: string;
  role: UserRole;
  school_id?: string | null;
  created_at: string;
}

export interface PCodeDTO {
  pcode: string;
  parent_pcode?: string;
  admin_level: number;
  name_en: string;
  name_my: string;
  sr_pcode?: string;
  ts_pcode?: string;
  pcode_type: string;
}

export interface SchoolDTO {
  id: string;
  name: string;
  code: string;
  address: string;
  city: string;
  region: string;
  phone: string;
  status: string;
  pcode_sr?: string;
  pcode_ts?: string;
  pcode_ward_vt?: string;
  pcode_level?: string;
  township_name?: string;
  ward_village_name?: string;
  school_category?: string;
  created_at: string;
}

export interface CreateSchoolRequest {
  name: string;
  code: string;
  address?: string;
  city?: string;
  region?: string;
  phone?: string;
  status?: string;
  pcode_sr?: string;
  pcode_ts?: string;
  pcode_ward_vt?: string;
  pcode_level?: string;
  township_name?: string;
  ward_village_name?: string;
  school_category?: string;
}

export interface AuthResponse {
  token: string;
  expires_at: string;
  user: User;
}

export interface ClassDTO {
  id: string;
  name: string;
  grade_level: string;
  teacher_id: string;
  academic_year: string;
  school_id?: string;
  created_at: string;
}

export interface CreateClassRequest {
  name: string;
  grade_level: string;
  academic_year: string;
  teacher_id?: string;
  school_id?: string;
}

export interface StudentDTO {
  id: string;
  email: string;
  full_name: string;
  role: string;
  enrolled_at: string;
}

export type AttendanceStatus = 'present' | 'absent' | 'late' | 'excused' | 'unrecorded';

export interface AttendanceItem {
  student_id: string;
  status: AttendanceStatus;
  notes?: string;
}

export interface BatchAttendanceRequest {
  date: string;
  records: AttendanceItem[];
}

export interface BatchAttendanceResponse {
  class_id: string;
  date: string;
  recorded_count: number;
  records: AttendanceItem[];
}

export interface AttendanceRosterItem {
  student_id: string;
  student_name: string;
  student_email: string;
  attendance_id?: string;
  status: AttendanceStatus;
  notes: string;
  date: string;
}

export interface AttendanceRosterResponse {
  class_id: string;
  date: string;
  total_students: number;
  roster: AttendanceRosterItem[];
}

export interface AssignmentDTO {
  id: string;
  class_id: string;
  title: string;
  description: string;
  due_date: string;
  max_score: number;
  created_at: string;
}

export interface CreateAssignmentRequest {
  title: string;
  description: string;
  due_date: string;
  max_score: number;
}

export interface AttendanceSummary {
  total_days: number;
  present: number;
  absent: number;
  late: number;
  excused: number;
  attendance_rate_percentage: number;
}

export interface PendingAssignmentDTO {
  id: string;
  class_id: string;
  class_name: string;
  title: string;
  description: string;
  due_date: string;
  max_score: number;
  created_at: string;
}

export interface StudentOverviewResponse {
  student_id: string;
  attendance_summary: AttendanceSummary;
  pending_assignments: PendingAssignmentDTO[];
}

export interface LessonPlanRequest {
  subject: string;
  grade_level: string;
  topic: string;
  duration_minutes: number;
}

export interface LessonPlanResponse {
  id: string;
  teacher_id: string;
  subject: string;
  grade_level: string;
  topic: string;
  duration_minutes: number;
  generated_markdown: string;
  created_at: string;
}

export interface ApiError {
  error: string;
  status: number;
}
