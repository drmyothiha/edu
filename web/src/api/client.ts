import {
  AuthResponse,
  ClassDTO,
  CreateClassRequest,
  FacultyMemberDTO,
  CreateTeacherRequest,
  UpdateTeacherRequest,
  SchoolStudentDTO,
  CreateSchoolStudentRequest,
  StudentDetailDTO,
  StudentDTO,
  BatchAttendanceRequest,
  BatchAttendanceResponse,
  AttendanceRosterResponse,
  AssignmentDTO,
  CreateAssignmentRequest,
  StudentOverviewResponse,
  LessonPlanRequest,
  LessonPlanResponse,
  SchoolDTO,
  PaginatedSchoolsResponse,
  ListSchoolsQuery,
  CreateSchoolRequest,
  PCodeDTO,
  User,
  ApiError,
  StudentBlockchainIDResponse,
  VerificationResult,
  BatchAnchorResponse,
  ChildDTO,
  WholeChildProfileDTO,
  WholeChildSyncResponse,
  ConversationDTO,
  CreateConversationRequest,
  MessageDTO,
  SendMessageRequest,
  AnnouncementDTO,
  CreateAnnouncementRequest,
  NotificationDTO,
  NotificationListResponse,
  BatchExamMarksRequest,
  BatchExamMarksResponse,
  ExamRosterResponse,
  ExamSummaryInfo,
  ShiftConfigDTO,
  ClassTimetableDTO,
  UpdateClassTimetableRequest,
  GateRosterResponse,
  SyncAttendanceBatchRequest,
  SyncAttendanceBatchResponse,
  GatePairInitResponse,
  GatePairStatusResponse,
  ConfirmGatePairRequest,
  UpdateProfileRequest,
  ChangePasswordRequest,
} from '../types';

export class ApiClientError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.name = 'ApiClientError';
    this.status = status;
  }
}

// Automatically detect /edu prefix when served behind reverse proxy
const getApiBase = (): string => {
  if (import.meta.env.VITE_API_BASE_URL) {
    return import.meta.env.VITE_API_BASE_URL;
  }
  if (typeof window !== 'undefined' && window.location.pathname.startsWith('/edu')) {
    return '/edu/api/v1';
  }
  return '/api/v1';
};

class ApiClient {
  private get token(): string | null {
    if (typeof window === 'undefined') return null;
    return localStorage.getItem('edu_auth_token');
  }

  private async request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
    const base = getApiBase();
    const url = `${base}${endpoint.startsWith('/') ? endpoint : `/${endpoint}`}`;

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      Accept: 'application/json',
      ...((options.headers as Record<string, string>) || {}),
    };

    if (this.token) {
      headers['Authorization'] = `Bearer ${this.token}`;
    }

    const response = await fetch(url, {
      ...options,
      headers,
    });

    if (!response.ok) {
      let errorMessage = `HTTP Error ${response.status}: ${response.statusText}`;
      try {
        const errorData = (await response.json()) as ApiError;
        if (errorData && errorData.error) {
          errorMessage = errorData.error;
        }
      } catch {
        // use default fallback
      }
      throw new ApiClientError(errorMessage, response.status);
    }

    if (response.status === 204) {
      return {} as T;
    }

    return response.json() as Promise<T>;
  }

  // Authentication
  auth = {
    login: (email: string, password: string): Promise<AuthResponse> =>
      this.request<AuthResponse>('/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email, password }),
      }),

    register: (data: { email: string; password: string; full_name: string; role: string; school_id?: string }): Promise<AuthResponse> =>
      this.request<AuthResponse>('/auth/register', {
        method: 'POST',
        body: JSON.stringify(data),
      }),

    me: (): Promise<User> => this.request<User>('/auth/me'),

    updateProfile: (data: UpdateProfileRequest): Promise<User> =>
      this.request<User>('/auth/profile', {
        method: 'PUT',
        body: JSON.stringify(data),
      }),

    changePassword: (data: ChangePasswordRequest): Promise<{ message: string }> =>
      this.request<{ message: string }>('/auth/password', {
        method: 'PUT',
        body: JSON.stringify(data),
      }),

    uploadAvatar: (avatarUrl: string): Promise<{ avatar_url: string; user?: User }> =>
      this.request<{ avatar_url: string; user?: User }>('/auth/avatar', {
        method: 'POST',
        body: JSON.stringify({ avatar_url: avatarUrl }),
      }),
  };

  private statesCache: Promise<PCodeDTO[]> | null = null;
  private townshipsCache = new Map<string, Promise<PCodeDTO[]>>();

  // Multi-Tenant School Facilities (Sysadmin & School Admin)
  schools = {
    list: (query?: ListSchoolsQuery): Promise<PaginatedSchoolsResponse> => {
      const params = new URLSearchParams();
      if (query?.page) params.append('page', query.page.toString());
      if (query?.limit) params.append('limit', query.limit.toString());
      if (query?.search) params.append('search', query.search);
      if (query?.region && query.region !== 'all') params.append('region', query.region);
      if (query?.pcode_sr) params.append('pcode_sr', query.pcode_sr);
      if (query?.pcode_ts) params.append('pcode_ts', query.pcode_ts);
      if (query?.category && query.category !== 'all') params.append('category', query.category);
      if (query?.all) params.append('all', 'true');
      const qs = params.toString() ? `?${params.toString()}` : '';
      return this.request<PaginatedSchoolsResponse>(`/schools${qs}`);
    },

    listAll: (): Promise<SchoolDTO[]> => this.request<SchoolDTO[]>('/schools?all=true'),

    get: (id: string): Promise<SchoolDTO> => this.request<SchoolDTO>(`/schools/${id}`),

    create: (data: CreateSchoolRequest): Promise<SchoolDTO> =>
      this.request<SchoolDTO>('/schools', {
        method: 'POST',
        body: JSON.stringify(data),
      }),

    getFaculty: (schoolId: string): Promise<FacultyMemberDTO[]> =>
      this.request<FacultyMemberDTO[]>(`/schools/${schoolId}/faculty`),

    createTeacher: (schoolId: string, data: CreateTeacherRequest): Promise<FacultyMemberDTO> =>
      this.request<FacultyMemberDTO>(`/schools/${schoolId}/teachers`, {
        method: 'POST',
        body: JSON.stringify(data),
      }),

    updateTeacher: (schoolId: string, teacherId: string, data: UpdateTeacherRequest): Promise<FacultyMemberDTO> =>
      this.request<FacultyMemberDTO>(`/schools/${schoolId}/teachers/${teacherId}`, {
        method: 'PUT',
        body: JSON.stringify(data),
      }),

    deleteTeacher: (schoolId: string, teacherId: string): Promise<{ message: string }> =>
      this.request<{ message: string }>(`/schools/${schoolId}/teachers/${teacherId}`, {
        method: 'DELETE',
      }),

    getStudents: (schoolId: string): Promise<SchoolStudentDTO[]> =>
      this.request<SchoolStudentDTO[]>(`/schools/${schoolId}/students`),

    createStudent: (schoolId: string, data: CreateSchoolStudentRequest): Promise<SchoolStudentDTO> =>
      this.request<SchoolStudentDTO>(`/schools/${schoolId}/students`, {
        method: 'POST',
        body: JSON.stringify(data),
      }),

    seedSampleStudents: (schoolId: string): Promise<SchoolStudentDTO[]> =>
      this.request<SchoolStudentDTO[]>(`/schools/${schoolId}/seed-sample-students`, {
        method: 'POST',
      }),

    deleteStudent: (schoolId: string, studentId: string): Promise<{ message: string }> =>
      this.request<{ message: string }>(`/schools/${schoolId}/students/${studentId}`, {
        method: 'DELETE',
      }),

    seedDefaultClasses: (schoolId: string): Promise<ClassDTO[]> =>
      this.request<ClassDTO[]>(`/schools/${schoolId}/seed-default-classes`, {
        method: 'POST',
      }),
  };

  teachers = {
    list: (schoolId: string) => this.schools.getFaculty(schoolId),
    create: (schoolId: string, data: CreateTeacherRequest) => this.schools.createTeacher(schoolId, data),
    update: (schoolId: string, teacherId: string, data: UpdateTeacherRequest) => this.schools.updateTeacher(schoolId, teacherId, data),
    delete: (schoolId: string, teacherId: string) => this.schools.deleteTeacher(schoolId, teacherId),
  };

  // MIMU Place Codes (State/Region, Township, Ward/Village Tract) with In-Memory Caching
  pcodes = {
    states: (): Promise<PCodeDTO[]> => {
      if (!this.statesCache) {
        this.statesCache = this.request<PCodeDTO[]>('/pcodes/states').catch((err) => {
          this.statesCache = null;
          throw err;
        });
      }
      return this.statesCache;
    },

    townships: (srPcode: string): Promise<PCodeDTO[]> => {
      if (!this.townshipsCache.has(srPcode)) {
        const promise = this.request<PCodeDTO[]>(`/pcodes/townships?sr=${encodeURIComponent(srPcode)}`).catch((err) => {
          this.townshipsCache.delete(srPcode);
          throw err;
        });
        this.townshipsCache.set(srPcode, promise);
      }
      return this.townshipsCache.get(srPcode)!;
    },

    wards: (tsPcode: string): Promise<PCodeDTO[]> =>
      this.request<PCodeDTO[]>(`/pcodes/wards?ts=${encodeURIComponent(tsPcode)}`),

    search: (query: string): Promise<PCodeDTO[]> =>
      this.request<PCodeDTO[]>(`/pcodes/search?q=${encodeURIComponent(query)}`),
  };

  // Classes & Academic Offerings
  classes = {
    list: (schoolId?: string, teacherId?: string): Promise<ClassDTO[]> => {
      const params = new URLSearchParams();
      if (schoolId) params.append('school_id', schoolId);
      if (teacherId) params.append('teacher_id', teacherId);
      const query = params.toString() ? `?${params.toString()}` : '';
      return this.request<ClassDTO[]>(`/classes${query}`);
    },

    get: (id: string): Promise<ClassDTO> => this.request<ClassDTO>(`/classes/${id}`),

    create: (data: CreateClassRequest): Promise<ClassDTO> =>
      this.request<ClassDTO>('/classes', {
        method: 'POST',
        body: JSON.stringify(data),
      }),

    seedDefault: (schoolId?: string): Promise<ClassDTO[]> =>
      this.request<ClassDTO[]>('/classes/seed-default', {
        method: 'POST',
        body: JSON.stringify({ school_id: schoolId }),
      }),

    delete: (classId: string): Promise<{ message: string }> =>
      this.request<{ message: string }>(`/classes/${classId}`, {
        method: 'DELETE',
      }),

    getStudents: (classId: string): Promise<StudentDTO[]> =>
      this.request<StudentDTO[]>(`/classes/${classId}/students`),

    enrollStudent: (classId: string, studentId: string): Promise<{ message: string }> =>
      this.request<{ message: string }>(`/classes/${classId}/enroll`, {
        method: 'POST',
        body: JSON.stringify({ student_id: studentId }),
      }),

    // Attendance
    getAttendanceRoster: (classId: string, date: string): Promise<AttendanceRosterResponse> =>
      this.request<AttendanceRosterResponse>(`/classes/${classId}/attendance?date=${encodeURIComponent(date)}`),

    batchRecordAttendance: (classId: string, data: BatchAttendanceRequest): Promise<BatchAttendanceResponse> =>
      this.request<BatchAttendanceResponse>(`/classes/${classId}/attendance`, {
        method: 'POST',
        body: JSON.stringify(data),
      }),

    batchAttendance: (classId: string, data: BatchAttendanceRequest): Promise<BatchAttendanceResponse> =>
      this.request<BatchAttendanceResponse>(`/classes/${classId}/attendance`, {
        method: 'POST',
        body: JSON.stringify(data),
      }),

    // Assignments
    getAssignments: (classId: string): Promise<AssignmentDTO[]> =>
      this.request<AssignmentDTO[]>(`/classes/${classId}/assignments`),

    createAssignment: (classId: string, data: CreateAssignmentRequest): Promise<AssignmentDTO> =>
      this.request<AssignmentDTO>(`/classes/${classId}/assignments`, {
        method: 'POST',
        body: JSON.stringify(data),
      }),

    // Whole-Child Development Profiles
    getWholeChildProfiles: (classId: string, period?: string): Promise<WholeChildProfileDTO[]> => {
      const q = period ? `?period=${encodeURIComponent(period)}` : '';
      return this.request<WholeChildProfileDTO[]>(`/classes/${classId}/whole-child-profiles${q}`);
    },

    saveWholeChildProfiles: (
      classId: string,
      data: {
        period: string;
        academic_year?: string;
        profiles: Array<{
          student_id: string;
          physical_growth_profile?: any;
          health_visibility_profile?: any;
          wellbeing_profile?: any;
          social_citizenship_profile?: any;
          academic_profile?: any;
          attendance_rate_pct?: number;
        }>;
      }
    ): Promise<{ updated_count: number; period: string; message: string }> =>
      this.request<{ updated_count: number; period: string; message: string }>(`/classes/${classId}/whole-child-profiles`, {
        method: 'POST',
        body: JSON.stringify(data),
      }),

    // Exam Marks & Gradebook
    getExamMarks: (classId: string, examName?: string): Promise<ExamRosterResponse> => {
      const q = examName ? `?exam_name=${encodeURIComponent(examName)}` : '';
      return this.request<ExamRosterResponse>(`/classes/${classId}/exam-marks${q}`);
    },

    saveExamMarks: (classId: string, data: BatchExamMarksRequest): Promise<BatchExamMarksResponse> =>
      this.request<BatchExamMarksResponse>(`/classes/${classId}/exam-marks`, {
        method: 'POST',
        body: JSON.stringify(data),
      }),

    listExams: (classId: string): Promise<ExamSummaryInfo[]> =>
      this.request<ExamSummaryInfo[]>(`/classes/${classId}/exams`),
  };

  // Student Overview, Whole-Child & Blockchain ID
  students = {
    listBySchool: (schoolId: string) => this.schools.getStudents(schoolId),
    create: (schoolId: string, data: CreateSchoolStudentRequest) => this.schools.createStudent(schoolId, data),
    seedSample: (schoolId: string) => this.schools.seedSampleStudents(schoolId),
    delete: (schoolId: string, studentId: string) => this.schools.deleteStudent(schoolId, studentId),
    get: (studentId: string): Promise<StudentDetailDTO> =>
      this.request<StudentDetailDTO>(`/students/${studentId}`),

    getOverview: (studentId: string): Promise<StudentOverviewResponse> =>
      this.request<StudentOverviewResponse>(`/students/${studentId}/overview`),

    getBlockchainID: (studentId: string): Promise<StudentBlockchainIDResponse> =>
      this.request<StudentBlockchainIDResponse>(`/students/${studentId}/blockchain-id`),

    getWholeChildProfile: (studentId: string, period?: string): Promise<WholeChildProfileDTO> => {
      const q = period ? `?period=${encodeURIComponent(period)}` : '';
      return this.request<WholeChildProfileDTO>(`/students/${studentId}/whole-child-profile${q}`);
    },
  };

  // Offline Sync Management (Batch Ingestion from Mobile / USB)
  sync = {
    uploadBatch: (payload: any, method = 'direct_http'): Promise<WholeChildSyncResponse> =>
      this.request<WholeChildSyncResponse>(`/sync/whole-child-batch?method=${encodeURIComponent(method)}`, {
        method: 'POST',
        body: JSON.stringify(payload),
      }),

    listBatches: (): Promise<any[]> =>
      this.request<any[]>('/sync/batches'),
  };

  // Parents & Linked Children
  parents = {
    getChildren: (parentId = 'my-children'): Promise<ChildDTO[]> =>
      this.request<ChildDTO[]>(`/parents/${parentId}/children`),
    getMyChildren: (): Promise<ChildDTO[]> =>
      this.request<ChildDTO[]>('/parents/my-children'),
  };

  // Blockchain Decentralized Identity & Layer-2 Verification
  blockchain = {
    verify: (identifier: string): Promise<VerificationResult> =>
      this.request<VerificationResult>(`/blockchain/verify?identifier=${encodeURIComponent(identifier)}`),

    anchorBatch: (): Promise<BatchAnchorResponse> =>
      this.request<BatchAnchorResponse>('/blockchain/anchor-batch', {
        method: 'POST',
      }),
  };

  // Teacher Copilot
  copilot = {
    generateLessonPlan: (data: LessonPlanRequest): Promise<LessonPlanResponse> =>
      this.request<LessonPlanResponse>('/copilot/lesson-plan', {
        method: 'POST',
        body: JSON.stringify(data),
      }),

    streamLessonPlan: async (
      data: LessonPlanRequest,
      onEvent: (eventType: string, data: any) => void,
      signal?: AbortSignal
    ): Promise<LessonPlanResponse> => {
      const token = localStorage.getItem('edu_auth_token');
      const base = getApiBase();
      const response = await fetch(`${base}/copilot/lesson-plan/stream`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'text/event-stream',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify(data),
        signal,
      });

      if (!response.ok) {
        throw new ApiClientError(`Streaming failed with status ${response.status}`, response.status);
      }

      const reader = response.body?.getReader();
      const decoder = new TextDecoder('utf-8');
      let completedPlan: LessonPlanResponse | null = null;
      let buffer = '';

      if (reader) {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });
          const parts = buffer.split('\n\n');
          buffer = parts.pop() || '';

          for (const part of parts) {
            const lines = part.split('\n');
            let eventType = 'message';
            let eventDataStr = '';

            for (const line of lines) {
              if (line.startsWith('event: ')) {
                eventType = line.slice(7).trim();
              } else if (line.startsWith('data: ')) {
                eventDataStr += line.slice(6);
              }
            }

            if (eventDataStr) {
              try {
                const parsedData = JSON.parse(eventDataStr);
                onEvent(eventType, parsedData);
                if (eventType === 'complete') {
                  completedPlan = parsedData as LessonPlanResponse;
                }
              } catch {
                // ignore invalid json chunks
              }
            }
          }
        }
      }

      if (!completedPlan) {
        throw new Error('Streaming ended without complete lesson plan payload');
      }

      return completedPlan;
    },

    getLessonPlan: (id: string): Promise<LessonPlanResponse> =>
      this.request<LessonPlanResponse>(`/copilot/lesson-plans/${id}`),

    listLessonPlans: (): Promise<LessonPlanResponse[]> =>
      this.request<LessonPlanResponse[]>('/copilot/lesson-plans'),

    updateLessonPlan: (id: string, data: { topic?: string; duration_minutes?: number; generated_markdown?: string; generated_markdown_burmese?: string }): Promise<LessonPlanResponse> =>
      this.request<LessonPlanResponse>(`/copilot/lesson-plans/${id}`, {
        method: 'PUT',
        body: JSON.stringify(data),
      }),

    deleteLessonPlan: (id: string): Promise<{ message: string; id: string }> =>
      this.request<{ message: string; id: string }>(`/copilot/lesson-plans/${id}`, {
        method: 'DELETE',
      }),

    translateLessonPlan: (id: string): Promise<LessonPlanResponse> =>
      this.request<LessonPlanResponse>(`/copilot/lesson-plan/${id}/translate`, {
        method: 'POST',
      }),
  };

  // Direct Teacher-Parent Messaging & Chat
  conversations = {
    list: (): Promise<ConversationDTO[]> =>
      this.request<ConversationDTO[]>('/conversations'),

    get: (id: string): Promise<ConversationDTO> =>
      this.request<ConversationDTO>(`/conversations/${id}`),

    create: (data: CreateConversationRequest): Promise<ConversationDTO> =>
      this.request<ConversationDTO>('/conversations', {
        method: 'POST',
        body: JSON.stringify(data),
      }),

    getMessages: (id: string): Promise<MessageDTO[]> =>
      this.request<MessageDTO[]>(`/conversations/${id}/messages`),

    sendMessage: (id: string, content: string): Promise<MessageDTO> =>
      this.request<MessageDTO>(`/conversations/${id}/messages`, {
        method: 'POST',
        body: JSON.stringify({ content }),
      }),
  };

  // Classroom Broadcast Announcements
  announcements = {
    listForClass: (classId: string): Promise<AnnouncementDTO[]> =>
      this.request<AnnouncementDTO[]>(`/classes/${classId}/announcements`),

    createForClass: (classId: string, data: CreateAnnouncementRequest): Promise<AnnouncementDTO> =>
      this.request<AnnouncementDTO>(`/classes/${classId}/announcements`, {
        method: 'POST',
        body: JSON.stringify(data),
      }),

    listForParent: (): Promise<AnnouncementDTO[]> =>
      this.request<AnnouncementDTO[]>('/parents/announcements'),
  };

  // User Notifications Hub (Absence alerts, system events)
  notifications = {
    list: (limit = 30, offset = 0): Promise<NotificationListResponse> =>
      this.request<NotificationListResponse>(`/notifications?limit=${limit}&offset=${offset}`),

    markRead: (id: string): Promise<{ status: string }> =>
      this.request<{ status: string }>(`/notifications/${id}/read`, {
        method: 'POST',
      }),

    markAllRead: (): Promise<{ status: string }> =>
      this.request<{ status: string }>('/notifications/read-all', {
        method: 'POST',
      }),

    getStreamUrl: (): string => {
      const base = getApiBase();
      const token = typeof window !== 'undefined' ? localStorage.getItem('edu_auth_token') : null;
      return `${base}/notifications/stream${token ? `?token=${encodeURIComponent(token)}` : ''}`;
    },
  };

  // Device Tokens for FCM Push Notifications
  devices = {
    registerToken: (fcmToken: string, platform: 'web' | 'android' | 'ios' = 'web'): Promise<{ status: string }> =>
      this.request<{ status: string }>('/devices/token', {
        method: 'POST',
        body: JSON.stringify({ fcm_token: fcmToken, platform }),
      }),

    unregisterToken: (fcmToken: string): Promise<{ status: string }> =>
      this.request<{ status: string }>('/devices/token', {
        method: 'DELETE',
        body: JSON.stringify({ fcm_token: fcmToken }),
      }),
  };

  // School Teaching Shifts & Class Timetable Management (Principal Portal)
  timetable = {
    getSchoolShiftConfig: (schoolId: string): Promise<ShiftConfigDTO[]> =>
      this.request<ShiftConfigDTO[]>(`/schools/${schoolId}/shift-config`),

    saveSchoolShiftConfig: (schoolId: string, configs: ShiftConfigDTO[]): Promise<ShiftConfigDTO[]> =>
      this.request<ShiftConfigDTO[]>(`/schools/${schoolId}/shift-config`, {
        method: 'PUT',
        body: JSON.stringify(configs),
      }),

    getClassTimetable: (classId: string): Promise<ClassTimetableDTO> =>
      this.request<ClassTimetableDTO>(`/classes/${classId}/timetable`),

    updateClassTimetable: (classId: string, data: UpdateClassTimetableRequest): Promise<ClassTimetableDTO> =>
      this.request<ClassTimetableDTO>(`/classes/${classId}/timetable`, {
        method: 'PUT',
        body: JSON.stringify(data),
      }),

    publishTimetableToMobile: (classId: string): Promise<{ success: boolean; synced_at: string; message: string }> =>
      this.request<{ success: boolean; synced_at: string; message: string }>(`/classes/${classId}/timetable/publish`, {
        method: 'POST',
      }),
  };

  // Gate Entrance Kiosk & Offline Attendance Sync
  gate = {
    getRoster: (schoolId?: string): Promise<GateRosterResponse> =>
      this.request<GateRosterResponse>(`/gate/roster${schoolId ? `?school_id=${encodeURIComponent(schoolId)}` : ''}`),

    syncBatch: (payload: SyncAttendanceBatchRequest): Promise<SyncAttendanceBatchResponse> =>
      this.request<SyncAttendanceBatchResponse>('/gate/sync-batch', {
        method: 'POST',
        body: JSON.stringify(payload),
      }),

    initPairing: (): Promise<GatePairInitResponse> =>
      this.request<GatePairInitResponse>('/gate/pair/init', {
        method: 'POST',
      }),

    getPairingStatus: (pairingId: string): Promise<GatePairStatusResponse> =>
      this.request<GatePairStatusResponse>(`/gate/pair/status?pairing_id=${encodeURIComponent(pairingId)}`),

    confirmPairing: (payload: ConfirmGatePairRequest): Promise<GatePairStatusResponse> =>
      this.request<GatePairStatusResponse>('/gate/pair/confirm', {
        method: 'POST',
        body: JSON.stringify(payload),
      }),
  };

  // Transcripts & Report Cards
  transcripts = {
    verify: (hash: string): Promise<any> =>
      this.request<any>(`/transcripts/verify?hash=${encodeURIComponent(hash)}`),

    getReportCard: (id: string): Promise<any> =>
      this.request<any>(`/transcripts/report-cards/${id}`),

    compileSample: (data: any): Promise<any> =>
      this.request<any>('/transcripts/manage/compile-sample', {
        method: 'POST',
        body: JSON.stringify(data),
      }),
  };

  // Data Privacy & Right to be Forgotten (GDPR-K)
  privacy = {
    requestErasure: (data: {
      student_id: string;
      original_did?: string;
      school_id?: string;
      request_type: string;
      legal_basis: string;
      reason: string;
    }): Promise<any> =>
      this.request<any>('/privacy/manage/erasure-requests', {
        method: 'POST',
        body: JSON.stringify(data),
      }),

    getErasureRequest: (id: string): Promise<any> =>
      this.request<any>(`/privacy/manage/erasure-requests/${id}`),

    getPolicies: (): Promise<any> =>
      this.request<any>('/privacy/policies'),

    getAuditLogs: (): Promise<any> =>
      this.request<any>('/privacy/manage/audit-logs'),
  };

  // Zero-Knowledge Proofs (ZKP)
  zkp = {
    verifyDisclosure: (proof: any, issuerPublicKey: string): Promise<any> =>
      this.request<any>('/zkp/verify-disclosure', {
        method: 'POST',
        body: JSON.stringify({ proof, issuer_public_key: issuerPublicKey }),
      }),

    verifyPredicate: (proof: any, issuerPublicKey: string): Promise<any> =>
      this.request<any>('/zkp/verify-predicate', {
        method: 'POST',
        body: JSON.stringify({ proof, issuer_public_key: issuerPublicKey }),
      }),
  };
}

export const api = new ApiClient();

