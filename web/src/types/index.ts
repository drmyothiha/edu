export type UserRole = 'sysadmin' | 'school_admin' | 'admin' | 'teacher' | 'parent' | 'student';

export interface User {
  id: string;
  email: string;
  full_name: string;
  role: UserRole;
  school_id?: string | null;
  created_at: string;
  avatar_url?: string | null;
  phone?: string | null;
  bio?: string | null;
  school_name?: string | null;
  school_code?: string | null;
  region?: string | null;
  township?: string | null;
  did?: string | null;
}

export interface UpdateProfileRequest {
  full_name?: string;
  email?: string;
  phone?: string;
  bio?: string;
  avatar_url?: string | null;
}

export interface ChangePasswordRequest {
  current_password?: string;
  new_password: string;
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
  name_en?: string;
  name_my?: string;
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

export interface PaginationMeta {
  total: number;
  page: number;
  limit: number;
  total_pages: number;
}

export interface PaginatedSchoolsResponse {
  data: SchoolDTO[];
  pagination: PaginationMeta;
}

export interface ListSchoolsQuery {
  page?: number;
  limit?: number;
  search?: string;
  region?: string;
  pcode_sr?: string;
  pcode_ts?: string;
  category?: string;
  all?: boolean;
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

export interface FacultyMemberDTO {
  id: string;
  email: string;
  full_name: string;
  role: string;
  school_id?: string;
  school_name?: string;
  assigned_classes?: string[];
}

export interface CreateTeacherRequest {
  full_name: string;
  email: string;
  password?: string;
  role?: string;
  school_id?: string;
}

export interface UpdateTeacherRequest {
  full_name?: string;
  email?: string;
  school_id?: string;
}

export interface SchoolStudentDTO {
  id: string;
  email: string;
  full_name: string;
  role: string;
  school_id: string;
  school_name?: string;
  class_id?: string;
  class_name?: string;
  grade_level?: string;
  created_at: string;
}

export interface CreateSchoolStudentRequest {
  full_name: string;
  email?: string;
  class_id?: string;
}

export interface StudentDetailDTO {
  id: string;
  email: string;
  full_name: string;
  role: string;
  school_id?: string;
  school_name?: string;
  school_code?: string;
  class_id?: string;
  class_name?: string;
  grade_level?: string;
  academic_year?: string;
  parent_id?: string;
  parent_name?: string;
  parent_email?: string;
  created_at: string;
  overview?: StudentOverviewResponse;
  blockchain_id?: StudentBlockchainIDResponse;
  whole_child?: WholeChildProfileDTO;
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

export interface ExamMarkItem {
  student_id: string;
  student_name?: string;
  myanmar?: number | null;
  english?: number | null;
  maths?: number | null;
  phy?: number | null;
  chem?: number | null;
  bio?: number | null;
  geo?: number | null;
  his?: number | null;
  eco?: number | null;
  social?: number | null;
  remarks?: string;
}

export interface BatchExamMarksRequest {
  exam_name: string;
  academic_year?: string;
  records: ExamMarkItem[];
}

export interface BatchExamMarksResponse {
  class_id: string;
  exam_name: string;
  recorded_count: number;
  records: ExamMarkItem[];
}

export interface ExamRosterItem {
  student_id: string;
  student_name: string;
  student_email: string;
  exam_mark_id?: string;
  exam_name: string;
  academic_year: string;
  myanmar?: number | null;
  english?: number | null;
  maths?: number | null;
  phy?: number | null;
  chem?: number | null;
  bio?: number | null;
  geo?: number | null;
  his?: number | null;
  eco?: number | null;
  social?: number | null;
  remarks?: string;
  updated_at?: string;
}

export interface ExamSummaryInfo {
  exam_name: string;
  academic_year: string;
  student_count: number;
  last_updated?: string;
}

export interface ExamRosterResponse {
  class_id: string;
  class_name: string;
  grade_level: string;
  academic_year: string;
  exam_name: string;
  available_exams: ExamSummaryInfo[];
  total_students: number;
  roster: ExamRosterItem[];
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
  pedagogical_framework?: string; // 'moe' | 'ib_pyp_myp' | 'cambridge' | 'model_5e' | 'udl'
  blooms_level?: string;
}

export interface CurriculumChunkDTO {
  id: string;
  standard_code: string;
  framework: string;
  subject: string;
  grade_level: string;
  unit_title: string;
  topic: string;
  competency: string;
  learning_outcomes: string;
  pedagogical_activities: string;
  blooms_level: string;
  content_burmese: string;
  keywords: string[];
  similarity_score: number;
}

export interface PriorLessonPlanSummaryDTO {
  id: string;
  topic: string;
  subject: string;
  grade_level: string;
  duration_minutes: number;
  key_learnings: string;
  similarity_score: number;
  created_at: string;
}

export interface StudentPerformanceSummaryDTO {
  competency: string;
  benchmark_score: number;
  mastery_status: string;
  class_average: number;
  at_risk_count: number;
  pedagogical_need: string;
  relevance_score: number;
}

export interface ValidationCheckDTO {
  name: string;
  status: string;
  score: number;
  details: string;
}

export interface ValidationReportDTO {
  curriculum_alignment: ValidationCheckDTO;
  readability_score: ValidationCheckDTO;
  language_safety_filter: ValidationCheckDTO;
  overall_status: string;
  overall_score: number;
  timestamp: string;
}

export interface RAGMetadataDTO {
  query_embedding_dimension: number;
  encoder_model: string;
  retrieved_curriculum_chunks: CurriculumChunkDTO[];
  retrieved_prior_plans: PriorLessonPlanSummaryDTO[];
  retrieved_student_performance: StudentPerformanceSummaryDTO[];
  validation_report: ValidationReportDTO;
  system_prompt_tokens_estimate: number;
  context_tokens_estimate: number;
  grounding_confidence_score: number;
  bloom_taxonomy_target: string;
  event_published: boolean;
  event_id?: string;
}

export interface RAGPipelineStepEventDTO {
  step: number;
  step_name: string;
  status: string;
  message: string;
  data?: any;
  timestamp: string;
}

export interface LessonPlanResponse {
  id: string;
  teacher_id: string;
  subject: string;
  grade_level: string;
  topic: string;
  duration_minutes: number;
  generated_markdown: string;
  generated_markdown_burmese?: string;
  created_at: string;
  rag_metadata?: RAGMetadataDTO;
}

export interface ApiError {
  error: string;
  status: number;
}

export interface StudentBlockchainIDResponse {
  student_id: string;
  student_name: string;
  student_email: string;
  did: string;
  blockchain_address: string;
  public_key: string;
  credential_hash: string;
  merkle_root?: string | null;
  merkle_proof?: any;
  polygon_tx_hash?: string | null;
  anchor_status: 'unanchored' | 'pending' | 'anchored' | 'revoked';
  issuer_school: string;
  issuer_school_en?: string;
  issuer_school_my?: string;
  school_code: string;
  region: string;
  township: string;
  raw_credential_json: any;
  digital_signature: string;
  issued_at: string;
  is_revoked: boolean;
}

export interface VerificationResult {
  is_valid: boolean;
  is_revoked: boolean;
  signature_valid: boolean;
  merkle_proof_valid: boolean;
  did: string;
  student_name: string;
  school_name: string;
  school_code: string;
  credential_hash: string;
  merkle_root?: string;
  polygon_tx_hash?: string;
  network: string;
  verification_time: string;
  message: string;
}

export interface BatchAnchorResponse {
  merkle_root: string;
  batch_size: number;
  network: string;
  contract_address: string;
  tx_hash: string;
  status: string;
  anchored_at: string;
}

export interface ChildDTO {
  id: string;
  full_name: string;
  email: string;
  role: string;
  school_id: string;
  school_name: string;
  school_name_en?: string;
  school_name_my?: string;
  school_code: string;
  school_region: string;
  school_township: string;
  class_id?: string;
  class_name: string;
  grade_level: string;
  did: string;
  blockchain_address: string;
  credential_hash: string;
  merkle_root?: string | null;
  anchor_status: string;
}

export interface WholeChildProfileDTO {
  id: string;
  student_id: string;
  student_name: string;
  student_email: string;
  student_did?: string;
  school_id: string;
  class_id: string;
  academic_year: string;
  period: string;
  attendance_rate_pct: number;
  academic_profile: {
    attendance?: {
      total_possible_sessions?: number;
      sessions_present?: number;
      sessions_absent?: number;
      attendance_rate_pct?: number;
      swipe_device_integrity?: string;
    };
    assignment_completion?: {
      assigned_count?: number;
      submitted_count?: number;
      completion_rate_pct?: number;
    };
    assessments?: {
      monthly_exam?: Record<string, number>;
      term_grade_point?: string;
      class_rank_percentile?: number;
    };
    competency_mastery?: Array<{ code: string; domain: string; status: string }>;
    interventions?: Array<{ category: string; subject: string; notes: string; outcome?: string }>;
    portfolio_highlights?: string[];
  };
  physical_growth_profile: {
    screening_date?: string;
    measurements?: {
      height_cm?: number;
      weight_kg?: number;
      calculated_bmi?: number;
      growth_percentile_category?: string;
    };
    milestones_and_development?: Record<string, string>;
    school_nutrition_and_vitality?: Record<string, any>;
    physical_fitness_activity?: {
      pe_class_participation?: string;
      cardio_endurance_rating?: string;
      preferred_sports?: string[];
    };
  };
  health_visibility_profile: {
    confidentiality_level?: string;
    routine_screenings?: {
      vision_check?: string;
      hearing_check?: string;
      oral_dental_health?: string;
    };
    recurring_conditions_and_alerts?: {
      has_chronic_condition?: boolean;
      known_allergies?: string[];
      emergency_medication_on_campus?: boolean;
    };
    school_health_incidents?: Array<{ date: string; incident: string; action_taken: string }>;
    national_campaign_markers?: {
      annual_deworming_completed?: boolean;
      deworming_date?: string;
      vitamin_a_distributed?: boolean;
    };
    clinic_referrals?: {
      has_active_referral?: boolean;
      referred_facility?: string | null;
      follow_up_due?: string | null;
    };
  };
  wellbeing_profile: {
    monthly_checkin_summary?: {
      dominant_emotional_state?: string;
      classroom_engagement_index?: number;
      peer_relational_harmony?: string;
    };
    teacher_observations?: {
      focus_attention_span?: string;
      emotional_resilience?: string;
      expresses_needs_clearly?: boolean;
      notes?: string;
    };
    counselor_support_workflow?: {
      case_opened?: boolean;
      support_level?: string;
      notes?: string;
    };
  };
  social_citizenship_profile: {
    governance_model?: string;
    leadership_and_roles?: Array<{ role: string; tenure: string; demonstrated_quality?: string }>;
    clubs_and_extracurriculars?: Array<{ club_name: string; standing: string }>;
    community_and_service?: {
      volunteering_events_count?: number;
      recent_service_activity?: string;
    };
    teamwork_and_peer_conduct?: {
      collaboration_rating?: number;
      conflict_resolution_demonstrated?: boolean;
      citizenship_badges_awarded?: string[];
    };
    appeal_status?: {
      has_pending_appeals?: boolean;
    };
  };
  sync_source: string;
  sync_record_hash?: string;
  created_at: string;
  updated_at: string;
}

export interface WholeChildSyncResponse {
  batch_id: string;
  checksum: string;
  status: string;
  processed_students: number;
  synced_at: string;
  message: string;
}

export interface ConversationDTO {
  id: string;
  school_id?: string;
  teacher_id: string;
  parent_id: string;
  student_id?: string;
  teacher_name: string;
  teacher_email: string;
  parent_name: string;
  parent_email: string;
  student_name: string;
  latest_message_content?: string;
  latest_message_at: string;
  unread_count: number;
  created_at: string;
}

export interface CreateConversationRequest {
  teacher_id?: string;
  parent_id?: string;
  student_id?: string;
}

export interface MessageDTO {
  id: string;
  conversation_id: string;
  sender_id: string;
  sender_name: string;
  sender_role: string;
  content: string;
  is_read: boolean;
  created_at: string;
}

export interface SendMessageRequest {
  content: string;
}

export interface AnnouncementDTO {
  id: string;
  class_id: string;
  teacher_id: string;
  teacher_name: string;
  class_name: string;
  student_name?: string;
  title: string;
  content: string;
  priority: 'normal' | 'important' | 'urgent';
  created_at: string;
}

export interface CreateAnnouncementRequest {
  title: string;
  content: string;
  priority?: 'normal' | 'important' | 'urgent';
}

export interface NotificationDTO {
  id: string;
  user_id: string;
  type: 'absence_alert' | 'announcement' | 'message' | 'assignment' | 'lesson_created' | 'general';
  title: string;
  body: string;
  data: Record<string, any>;
  is_read: boolean;
  created_at: string;
}

export interface NotificationListResponse {
  notifications: NotificationDTO[];
  unread_count: number;
}

export type TeachingShiftType = 'full_day' | 'morning' | 'afternoon';

export interface ShiftConfigDTO {
  id?: string;
  school_id: string;
  shift_type: TeachingShiftType;
  name: string;
  name_my: string;
  start_time: string; // e.g. "08:00"
  end_time: string;   // e.g. "16:00"
  total_periods: number;
  description?: string;
  active: boolean;
}

export interface TimetablePeriodDTO {
  id: string;
  class_id?: string;
  grade_level?: string;
  section?: string;
  day_of_week: number; // 1 = Monday ... 7 = Sunday
  start_time: string;  // "08:00"
  end_time: string;    // "09:00"
  period_index: number;
  subject_name: string;
  subject_name_my: string;
  subject_code: string;
  teacher_id?: string;
  teacher_name?: string;
  room_number: string;
  color_hex?: string;
  topic?: string;
  shift_type: TeachingShiftType;
}

export interface ClassTimetableDTO {
  class_id: string;
  class_name: string;
  grade_level: string;
  shift_type: TeachingShiftType;
  academic_year: string;
  periods: TimetablePeriodDTO[];
  updated_at?: string;
}

export interface UpdateClassTimetableRequest {
  class_id: string;
  shift_type: TeachingShiftType;
  periods: TimetablePeriodDTO[];
}

export interface GateStudentDTO {
  id: string;
  did: string;
  full_name: string;
  full_name_my?: string;
  roll_no: string;
  class_id?: string;
  class_name: string;
  grade_level: string;
  school_name: string;
  school_name_my: string;
  school_code: string;
  photo_url?: string;
  national_id?: string;
  updated_at: string;
}

export interface GateRosterResponse {
  school_id: string;
  school_code: string;
  school_name: string;
  total_count: number;
  students: GateStudentDTO[];
  generated_at: string;
}

export interface SyncAttendanceEventDTO {
  event_id: string;
  student_id?: string;
  did: string;
  student_name?: string;
  roll_no?: string;
  class_id?: string;
  class_name?: string;
  school_code?: string;
  scanned_at: string;
  event_date: string;
  time_display?: string;
  scan_method: 'nfc_tap' | 'qr_scan' | 'manual';
  status: 'present' | 'late';
  device_id: string;
}

export interface SyncAttendanceBatchRequest {
  school_code?: string;
  device_id?: string;
  events: SyncAttendanceEventDTO[];
}

export interface SyncAttendanceBatchResponse {
  synced_count: number;
  failed_count: number;
  synced_ids: string[];
  errors?: string[];
}

export interface GatePairInitResponse {
  pairing_id: string;
  qr_payload: string;
  created_at: string;
  expires_at: string;
  status: 'pending' | 'paired';
}

export interface GatePairStatusResponse {
  pairing_id: string;
  qr_payload: string;
  created_at: string;
  expires_at: string;
  status: 'pending' | 'paired';
  school_id?: string;
  school_code?: string;
  school_name?: string;
  school_name_my?: string;
  gate_name?: string;
  device_api_key?: string;
}

export interface ConfirmGatePairRequest {
  pairing_id: string;
  gate_name?: string;
  school_id?: string;
}

export interface KioskProvisioningConfig {
  paired: boolean;
  school_id: string;
  school_code: string;
  school_name: string;
  school_name_my: string;
  gate_name: string;
  device_api_key: string;
  paired_at: string;
}



