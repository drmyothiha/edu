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

  private classSlugMap: Map<string, string> = new Map([
    // KG
    ['KGA', '9eb51d70-4085-4611-9024-d87e62ab3e16'],
    ['KG-A', '9eb51d70-4085-4611-9024-d87e62ab3e16'],
    ['KGB', 'ae0d13ac-e767-4521-8638-84ad80b29eb4'],
    ['KG-B', 'ae0d13ac-e767-4521-8638-84ad80b29eb4'],
    // Grade 1
    ['G1A', '31995e1d-1ee2-4e44-93cc-bd213740c78e'],
    ['G1-A', '31995e1d-1ee2-4e44-93cc-bd213740c78e'],
    ['GRADE1A', '31995e1d-1ee2-4e44-93cc-bd213740c78e'],
    ['GRADE1SECTIONA', '31995e1d-1ee2-4e44-93cc-bd213740c78e'],
    ['G1B', '1ff7f9a9-c9b0-4f05-afe2-df72a2fe7951'],
    ['G1-B', '1ff7f9a9-c9b0-4f05-afe2-df72a2fe7951'],
    ['GRADE1B', '1ff7f9a9-c9b0-4f05-afe2-df72a2fe7951'],
    ['GRADE1SECTIONB', '1ff7f9a9-c9b0-4f05-afe2-df72a2fe7951'],
    // Grade 2
    ['G2A', 'bf88e280-dccd-4bb2-9f57-0f37d16fc074'],
    ['G2-A', 'bf88e280-dccd-4bb2-9f57-0f37d16fc074'],
    ['GRADE2A', 'bf88e280-dccd-4bb2-9f57-0f37d16fc074'],
    ['GRADE2SECTIONA', 'bf88e280-dccd-4bb2-9f57-0f37d16fc074'],
    ['G2B', '00d62865-d7d8-4af9-8cb6-845fb0be35bf'],
    ['G2-B', '00d62865-d7d8-4af9-8cb6-845fb0be35bf'],
    ['GRADE2B', '00d62865-d7d8-4af9-8cb6-845fb0be35bf'],
    ['GRADE2SECTIONB', '00d62865-d7d8-4af9-8cb6-845fb0be35bf'],
    // Grade 3
    ['G3A', 'bd1b506e-e107-4340-967f-1fc284e13d4d'],
    ['G3-A', 'bd1b506e-e107-4340-967f-1fc284e13d4d'],
    ['G3B', '9d380f8e-9879-42f8-a5e6-0175fc75e206'],
    ['G3-B', '9d380f8e-9879-42f8-a5e6-0175fc75e206'],
    // Grade 4
    ['G4A', '3e89ac00-0f13-4f46-9713-d361ee853c59'],
    ['G4-A', '3e89ac00-0f13-4f46-9713-d361ee853c59'],
    ['G4B', 'a7f16d8f-e7d0-43b5-9385-64cfc9424e95'],
    ['G4-B', 'a7f16d8f-e7d0-43b5-9385-64cfc9424e95'],
    // Grade 5
    ['G5A', 'bb4d003e-3725-407a-b526-f885162eda1a'],
    ['G5-A', 'bb4d003e-3725-407a-b526-f885162eda1a'],
    ['G5B', '06e39cea-f702-4f81-94c1-5953797125a3'],
    ['G5-B', '06e39cea-f702-4f81-94c1-5953797125a3'],
    // Grade 6
    ['G6A', '3d0a2151-eea7-4725-94c0-dd48c123306b'],
    ['G6-A', '3d0a2151-eea7-4725-94c0-dd48c123306b'],
    ['G6B', 'f05c3ce8-c115-49d1-ae9b-59facaba4b56'],
    ['G6-B', 'f05c3ce8-c115-49d1-ae9b-59facaba4b56'],
    // Grade 7
    ['G7A', 'fb4e636c-54df-4c97-974d-9be6730d2648'],
    ['G7-A', 'fb4e636c-54df-4c97-974d-9be6730d2648'],
    ['G7B', '51a03469-04f2-469f-9318-ac42d95c3945'],
    ['G7-B', '51a03469-04f2-469f-9318-ac42d95c3945'],
    // Grade 8
    ['G8A', '43c33c58-729f-4cd3-b7e7-3036a5102443'],
    ['G8-A', '43c33c58-729f-4cd3-b7e7-3036a5102443'],
    ['G8B', 'bbf71e9d-e93f-4c63-aeb9-a47dc76706c0'],
    ['G8-B', 'bbf71e9d-e93f-4c63-aeb9-a47dc76706c0'],
    // Grade 9
    ['G9A', 'd05014df-91ef-44b7-b072-306d0a2d4595'],
    ['G9-A', 'd05014df-91ef-44b7-b072-306d0a2d4595'],
    ['G9B', '092b46ee-a09f-42fe-bc2d-74b8a74aeb5f'],
    ['G9-B', '092b46ee-a09f-42fe-bc2d-74b8a74aeb5f'],
    // Grade 10
    ['G10A', '5e16fa5e-e143-460d-904d-97552c03ec5b'],
    ['G10-A', '5e16fa5e-e143-460d-904d-97552c03ec5b'],
    ['G10B', '23422a72-d9a4-47a9-8807-7266b41769e9'],
    ['G10-B', '23422a72-d9a4-47a9-8807-7266b41769e9'],
    // Grade 11
    ['G11A', 'ea05e6ad-35d2-4538-a9f6-fc3aed608df2'],
    ['G11-A', 'ea05e6ad-35d2-4538-a9f6-fc3aed608df2'],
    ['G11B', '127476bd-5ed0-44f9-bd4f-e11c6e597d19'],
    ['G11-B', '127476bd-5ed0-44f9-bd4f-e11c6e597d19'],
    // Grade 12
    ['G12A', 'ab35a575-b398-418d-a309-1280aad87f6e'],
    ['G12-A', 'ab35a575-b398-418d-a309-1280aad87f6e'],
    ['G12B', 'fae3531c-89e1-465e-a39e-f99a31ab55f3'],
    ['G12-B', 'fae3531c-89e1-465e-a39e-f99a31ab55f3'],
  ]);

  public registerClassSlugs(classes: ClassDTO[]): void {
    const register = (slug: string, id: string) => {
      if (!slug) return;
      const clean = slug.toUpperCase().replace(/[^A-Z0-9]/g, '');
      if (clean) this.classSlugMap.set(clean, id);
    };

    for (const c of classes) {
      if (!c || !c.id) continue;
      register(c.id, c.id);
      if (c.code) register(c.code, c.id);
      if (c.name) register(c.name, c.id);

      const name = c.name || '';
      const grade = c.grade_level || '';

      let section = c.section || '';
      if (!section) {
        const secMatch = name.match(/Section\s*([A-Za-z0-9]+)/i) || name.match(/[\(\-_\s]([A-Da-d])[\)\s]?$/i);
        if (secMatch) section = secMatch[1].toUpperCase();
      }

      const gShort = grade.replace(/Grade\s*/i, 'G').replace(/\s+/g, '').toUpperCase();
      const gNum = grade.replace(/[^0-9]/g, '');
      const gFull = grade.replace(/\s+/g, '').toUpperCase();

      if (section) {
        register(`${gShort}${section}`, c.id);
        register(`${gShort}-${section}`, c.id);
        register(`${gFull}${section}`, c.id);
        register(`${gFull}-${section}`, c.id);
        register(`${gShort}Section${section}`, c.id);
        register(`${gFull}Section${section}`, c.id);
        if (gNum) {
          register(`${gNum}${section}`, c.id);
          register(`${gNum}-${section}`, c.id);
        }
      }
      register(gShort, c.id);
      register(gFull, c.id);
    }
  }

  public async resolveClassId(identifier: string): Promise<string> {
    if (!identifier) return identifier;
    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(identifier);
    if (isUuid) return identifier;

    const clean = identifier.toUpperCase().replace(/[^A-Z0-9]/g, '');
    if (this.classSlugMap.has(clean)) {
      return this.classSlugMap.get(clean)!;
    }

    try {
      const list = await this.classes.list();
      this.registerClassSlugs(list);
      if (this.classSlugMap.has(clean)) {
        return this.classSlugMap.get(clean)!;
      }

      // Fuzzy match: check if clean matches grade and section
      const match = clean.match(/^(?:G|GRADE)?([0-9]+|KG)([A-Z])?$/);
      if (match) {
        const targetGradeNum = match[1];
        const targetGrade = targetGradeNum === 'KG' ? 'KG' : `Grade ${targetGradeNum}`;
        const targetSec = match[2];
        const found = list.find((c) => {
          const gUpper = (c.grade_level || '').toUpperCase();
          const nameUpper = (c.name || '').toUpperCase();
          const gMatch = gUpper.includes(targetGrade.toUpperCase()) || nameUpper.includes(targetGrade.toUpperCase());
          if (!gMatch) return false;
          if (targetSec) {
            return (
              nameUpper.includes(`SECTION ${targetSec}`) ||
              nameUpper.includes(`(${targetSec})`) ||
              (c.code && c.code.toUpperCase().endsWith(targetSec))
            );
          }
          return true;
        });
        if (found) {
          this.classSlugMap.set(clean, found.id);
          return found.id;
        }
      }
    } catch (e) {
      console.warn('Failed to dynamically resolve class slug:', identifier, e);
    }

    return identifier;
  }

  // Classes & Academic Offerings
  classes = {
    list: async (schoolId?: string, teacherId?: string): Promise<ClassDTO[]> => {
      const params = new URLSearchParams();
      if (schoolId) params.append('school_id', schoolId);
      if (teacherId) params.append('teacher_id', teacherId);
      const query = params.toString() ? `?${params.toString()}` : '';
      const list = await this.request<ClassDTO[]>(`/classes${query}`);
      this.registerClassSlugs(list);
      return list;
    },

    get: async (id: string): Promise<ClassDTO> => {
      const realId = await this.resolveClassId(id);
      return this.request<ClassDTO>(`/classes/${realId}`);
    },

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

    delete: async (classId: string): Promise<{ message: string }> => {
      const realId = await this.resolveClassId(classId);
      return this.request<{ message: string }>(`/classes/${realId}`, {
        method: 'DELETE',
      });
    },

    getStudents: async (classId: string): Promise<StudentDTO[]> => {
      const realId = await this.resolveClassId(classId);
      return this.request<StudentDTO[]>(`/classes/${realId}/students`);
    },

    enrollStudent: async (classId: string, studentId: string): Promise<{ message: string }> => {
      const realId = await this.resolveClassId(classId);
      return this.request<{ message: string }>(`/classes/${realId}/enroll`, {
        method: 'POST',
        body: JSON.stringify({ student_id: studentId }),
      });
    },

    // Attendance
    getAttendanceRoster: async (classId: string, date: string): Promise<AttendanceRosterResponse> => {
      const realId = await this.resolveClassId(classId);
      return this.request<AttendanceRosterResponse>(`/classes/${realId}/attendance?date=${encodeURIComponent(date)}`);
    },

    batchRecordAttendance: async (classId: string, data: BatchAttendanceRequest): Promise<BatchAttendanceResponse> => {
      const realId = await this.resolveClassId(classId);
      return this.request<BatchAttendanceResponse>(`/classes/${realId}/attendance`, {
        method: 'POST',
        body: JSON.stringify(data),
      });
    },

    batchAttendance: async (classId: string, data: BatchAttendanceRequest): Promise<BatchAttendanceResponse> => {
      const realId = await this.resolveClassId(classId);
      return this.request<BatchAttendanceResponse>(`/classes/${realId}/attendance`, {
        method: 'POST',
        body: JSON.stringify(data),
      });
    },

    // Assignments
    getAssignments: async (classId: string): Promise<AssignmentDTO[]> => {
      const realId = await this.resolveClassId(classId);
      return this.request<AssignmentDTO[]>(`/classes/${realId}/assignments`);
    },

    createAssignment: async (classId: string, data: CreateAssignmentRequest): Promise<AssignmentDTO> => {
      const realId = await this.resolveClassId(classId);
      return this.request<AssignmentDTO>(`/classes/${realId}/assignments`, {
        method: 'POST',
        body: JSON.stringify(data),
      });
    },

    // Whole-Child Development Profiles
    getWholeChildProfiles: async (classId: string, period?: string): Promise<WholeChildProfileDTO[]> => {
      const realId = await this.resolveClassId(classId);
      const q = period ? `?period=${encodeURIComponent(period)}` : '';
      return this.request<WholeChildProfileDTO[]>(`/classes/${realId}/whole-child-profiles${q}`);
    },

    saveWholeChildProfiles: async (
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
    ): Promise<{ updated_count: number; period: string; message: string }> => {
      const realId = await this.resolveClassId(classId);
      return this.request<{ updated_count: number; period: string; message: string }>(`/classes/${realId}/whole-child-profiles`, {
        method: 'POST',
        body: JSON.stringify(data),
      });
    },

    // Exam Marks & Gradebook
    getExamMarks: async (classId: string, examName?: string): Promise<ExamRosterResponse> => {
      const realId = await this.resolveClassId(classId);
      const q = examName ? `?exam_name=${encodeURIComponent(examName)}` : '';
      return this.request<ExamRosterResponse>(`/classes/${realId}/exam-marks${q}`);
    },

    saveExamMarks: async (classId: string, data: BatchExamMarksRequest): Promise<BatchExamMarksResponse> => {
      const realId = await this.resolveClassId(classId);
      return this.request<BatchExamMarksResponse>(`/classes/${realId}/exam-marks`, {
        method: 'POST',
        body: JSON.stringify(data),
      });
    },

    listExams: async (classId: string): Promise<ExamSummaryInfo[]> => {
      const realId = await this.resolveClassId(classId);
      return this.request<ExamSummaryInfo[]>(`/classes/${realId}/exams`);
    },
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
    listForClass: async (classId: string): Promise<AnnouncementDTO[]> => {
      const realId = await this.resolveClassId(classId);
      return this.request<AnnouncementDTO[]>(`/classes/${realId}/announcements`);
    },

    createForClass: async (classId: string, data: CreateAnnouncementRequest): Promise<AnnouncementDTO> => {
      const realId = await this.resolveClassId(classId);
      return this.request<AnnouncementDTO>(`/classes/${realId}/announcements`, {
        method: 'POST',
        body: JSON.stringify(data),
      });
    },

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

    getClassTimetable: async (classId: string): Promise<ClassTimetableDTO> => {
      const realId = await this.resolveClassId(classId);
      return this.request<ClassTimetableDTO>(`/classes/${realId}/timetable`);
    },

    updateClassTimetable: async (classId: string, data: UpdateClassTimetableRequest): Promise<ClassTimetableDTO> => {
      const realId = await this.resolveClassId(classId);
      return this.request<ClassTimetableDTO>(`/classes/${realId}/timetable`, {
        method: 'PUT',
        body: JSON.stringify(data),
      });
    },

    publishTimetableToMobile: async (classId: string): Promise<{ success: boolean; synced_at: string; message: string }> => {
      const realId = await this.resolveClassId(classId);
      return this.request<{ success: boolean; synced_at: string; message: string }>(`/classes/${realId}/timetable/publish`, {
        method: 'POST',
      });
    },
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

