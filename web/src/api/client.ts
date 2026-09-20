import {
  AuthResponse,
  ClassDTO,
  CreateClassRequest,
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
  CreateSchoolRequest,
  PCodeDTO,
  User,
  ApiError,
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
  };

  // Multi-Tenant School Facilities (Sysadmin & School Admin)
  schools = {
    list: (): Promise<SchoolDTO[]> => this.request<SchoolDTO[]>('/schools'),

    get: (id: string): Promise<SchoolDTO> => this.request<SchoolDTO>(`/schools/${id}`),

    create: (data: CreateSchoolRequest): Promise<SchoolDTO> =>
      this.request<SchoolDTO>('/schools', {
        method: 'POST',
        body: JSON.stringify(data),
      }),
  };

  // MIMU Place Codes (State/Region, Township, Ward/Village Tract)
  pcodes = {
    states: (): Promise<PCodeDTO[]> => this.request<PCodeDTO[]>('/pcodes/states'),

    townships: (srPcode: string): Promise<PCodeDTO[]> =>
      this.request<PCodeDTO[]>(`/pcodes/townships?sr=${encodeURIComponent(srPcode)}`),

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
  };

  // Student Overview
  students = {
    getOverview: (studentId: string): Promise<StudentOverviewResponse> =>
      this.request<StudentOverviewResponse>(`/students/${studentId}/overview`),
  };

  // Teacher Copilot
  copilot = {
    generateLessonPlan: (data: LessonPlanRequest): Promise<LessonPlanResponse> =>
      this.request<LessonPlanResponse>('/copilot/lesson-plan', {
        method: 'POST',
        body: JSON.stringify(data),
      }),

    listLessonPlans: (): Promise<LessonPlanResponse[]> =>
      this.request<LessonPlanResponse[]>('/copilot/lesson-plans'),
  };
}

export const api = new ApiClient();
