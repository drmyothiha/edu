# EduPlatform Backend Service

A clean, idiomatic, production-ready backend API service for an education platform built with Go, PostgreSQL, Chi router, and sqlc.

---

## 🏛 Architecture Overview

```
├── cmd/
│   ├── api/
│   │   └── main.go                 # Entry point, connection pool, graceful shutdown
│   └── seed/
│       └── main.go                 # Database seed script for development
├── db/
│   ├── migrations/
│   │   ├── 000001_init_schema.up.sql    # Pure PostgreSQL DDL schema
│   │   └── 000001_init_schema.down.sql  # Schema rollback
│   └── queries/
│       ├── users.sql               # sqlc queries for users
│       ├── classes.sql             # sqlc queries for classes
│       ├── enrollments.sql         # sqlc queries for enrollments
│       ├── attendance.sql          # sqlc queries for attendance
│       ├── assignments.sql         # sqlc queries for assignments
│       ├── submissions.sql         # sqlc queries for submissions
│       └── lesson_plans.sql        # sqlc queries for teacher copilot
├── internal/
│   ├── auth/                       # JWT auth, bcrypt hashing, RBAC middleware
│   │   ├── jwt.go
│   │   ├── password.go
│   │   ├── middleware.go
│   │   ├── service.go
│   │   └── handler.go
│   ├── copilot/                    # Teacher copilot service & pluggable LLM client
│   │   ├── llm.go                  # LLMClient interface (Mock, OpenAI, Anthropic)
│   │   ├── service.go
│   │   └── handler.go
│   ├── database/                   # sqlc generated code & connection pool
│   │   ├── db.go
│   │   ├── models.go
│   │   ├── querier.go
│   │   ├── pool.go
│   │   ├── migrate.go
│   │   └── *.sql.go
│   ├── school/                     # Classes, attendance, assignments, overview
│   │   ├── models.go
│   │   ├── service.go
│   │   └── handler.go
│   ├── server/                     # Chi router, middlewares, CORS, route groups
│   │   └── router.go
│   ├── response/                   # Standardized JSON and error envelopes
│   │   └── response.go
│   └── config/                     # Environment configuration loader
│       └── config.go
├── Makefile                        # Build, migrate, test, and code-gen commands
├── sqlc.yaml                       # sqlc code generation configuration
└── .env.example                    # Environment configuration template
```

---

---

## 📊 Database Schema (PostgreSQL Multi-Tenant)

- **`schools`**: `id` (UUID PK), `name` (VARCHAR), `code` (VARCHAR unique), `address`, `city`, `region`, `phone`, `status` ('active', 'inactive'), `created_at`.
- **`users`**: `id` (UUID PK), `email` (unique), `password_hash`, `full_name`, `role` ('sysadmin', 'school_admin', 'admin', 'teacher', 'parent', 'student'), `school_id` (FK to schools, NULL for sysadmin), `created_at`.
- **`classes`**: `id` (UUID PK), `name`, `grade_level`, `teacher_id` (FK to users), `academic_year`, `school_id` (FK to schools), `created_at`.
- **`class_enrollments`**: `id` (UUID PK), `class_id` (FK), `student_id` (FK), `enrolled_at`.
- **`attendance_records`**: `id` (UUID PK), `class_id` (FK), `student_id` (FK), `date` (DATE), `status` ('present', 'absent', 'late', 'excused'), `notes`, `created_at`.
- **`assignments`**: `id` (UUID PK), `class_id` (FK), `title`, `description`, `due_date` (TIMESTAMPTZ), `max_score`, `created_at`.
- **`submissions`**: `id` (UUID PK), `assignment_id` (FK), `student_id` (FK), `status` ('submitted', 'graded', 'late'), `grade` (NUMERIC), `feedback`, `submitted_at`.
- **`lesson_plans`**: `id` (UUID PK), `teacher_id` (FK), `subject`, `grade_level`, `topic`, `duration_minutes`, `generated_markdown`, `created_at`.

### Multi-Tenant Role Hierarchy
1. **`sysadmin`** (Platform Owner): Global administrative access across all nationwide facilities. Can provision, configure, and monitor schools across all states and regions.
2. **`school_admin`** (School Principal / Facility Administrator): Scoped strictly to their designated school facility (`school_id`). Manages faculty teachers, classes, and students for their specific campus.
3. **`teacher`**: Scoped to their school facility. Creates classes, records daily attendance rosters, assigns homework, and uses the AI Lesson Copilot.
4. **`parent` / `student`**: Scoped to their school facility. Accesses student attendance history and pending assignments.

---

## 🚀 Getting Started

### 1. Prerequisites
- **Go**: 1.24+ (tested with Go 1.26)
- **PostgreSQL**: 13+
- **sqlc**: v1.28.0+ (downloaded automatically via `make sqlc-generate`)

### 2. Environment Variables
Copy `.env.example` to `.env`:
```bash
cp .env.example .env
```
Configuration options:
```env
PORT=8080
DATABASE_URL=postgres://postgres:postgres@localhost:5432/edu_db?sslmode=disable
JWT_SECRET=your-32-byte-secret-key-goes-here!
JWT_EXPIRATION_HOURS=24
LLM_PROVIDER=mock          # 'mock', 'openai', or 'anthropic'
LLM_API_KEY=               # API key if using live OpenAI or Anthropic
LLM_BASE_URL=https://api.openai.com/v1
LLM_MODEL=gpt-4o-mini
```

### 3. Make Commands
```bash
# Compile binary
make build

# Run the API server
make run

# Run all unit and integration tests
make test

# Apply database migrations
make migrate-up

# Roll back database migrations
make migrate-down

# Re-generate sqlc Go code
make sqlc-generate

# Seed sample data (users, classes, enrollments, attendance, assignments)
make seed
```

---

## 🔒 Authentication & Role-Based Access Control (RBAC)

### Login Endpoint
`POST /api/v1/auth/login`
```json
{
  "email": "teacher.smith@edu.local",
  "password": "Teacher123!"
}
```

Response (`200 OK`):
```json
{
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "expires_at": "2026-09-21T07:30:00Z",
  "user": {
    "id": "6b669ee9-5771-4bd3-9a54-f9e02ae205ab",
    "email": "teacher.smith@edu.local",
    "full_name": "Sarah Smith",
    "role": "teacher",
    "created_at": "2026-09-20T07:30:00Z"
  }
}
```

### RBAC Middleware
Use the Bearer token in the `Authorization` header:
`Authorization: Bearer <token>`

- `RequireAuth`: Validates JWT signature and expiry, injecting `UserContext` into `r.Context()`.
- `RequireRoles(roles ...string)`: Restricts endpoints to specific roles (e.g. `RequireRoles("teacher", "admin")`).
- Unauthorized requests return:
  ```json
  {"error": "authentication required", "status": 401}
  ```
- Forbidden requests return:
  ```json
  {"error": "insufficient permissions for this resource", "status": 403}
  ```

---

## 🤖 Teacher Copilot Endpoint

Generates structured, pedagogical, curriculum-aligned lesson plans in Markdown.

`POST /api/v1/copilot/lesson-plan`  
*Protected: Teacher, Admin*

### Request:
```json
{
  "subject": "Mathematics",
  "grade_level": "Grade 8",
  "topic": "Pythagorean Theorem",
  "duration_minutes": 45
}
```

### Response (`201 Created`):
```json
{
  "id": "8c1ac054-cf86-4eec-a5de-3f159f75e947",
  "teacher_id": "6b669ee9-5771-4bd3-9a54-f9e02ae205ab",
  "subject": "Mathematics",
  "grade_level": "Grade 8",
  "topic": "Pythagorean Theorem",
  "duration_minutes": 45,
  "generated_markdown": "# Curriculum-Aligned Lesson Plan: Pythagorean Theorem\n\n**Subject:** Mathematics...",
  "created_at": "2026-09-20T07:39:00Z"
}
```

### Pluggable LLM Integration
The copilot implements the `LLMClient` interface:
```go
type LLMClient interface {
    GenerateLessonPlan(ctx context.Context, req LessonPlanPromptRequest) (string, error)
}
```
Available providers:
- `MockLLMClient`: Generates deterministic, full-length lesson plans offline without external API keys.
- `OpenAIClient`: OpenAI Chat Completions API format (works with OpenAI, Ollama, vLLM, and compatible endpoints).
- `AnthropicClient`: Claude Messages API format (`/v1/messages`).

---

## 📚 Attendance & Assignments Endpoints

### 1. Batch Record Attendance
`POST /api/v1/classes/{id}/attendance`  
*Protected: Teacher, Admin*

```json
{
  "date": "2026-09-20",
  "records": [
    {
      "student_id": "a9ea994f-b4b6-4fb3-9e1b-7d55480a5586",
      "status": "present",
      "notes": "Participated actively"
    },
    {
      "student_id": "242b38f2-bcb8-4b15-b7b0-5f589e19c855",
      "status": "absent",
      "notes": "Excused sick note provided"
    }
  ]
}
```

### 2. Fetch Attendance Roster
`GET /api/v1/classes/{id}/attendance?date=2026-09-20`  
*Protected: Teacher, Admin*

Response:
```json
{
  "class_id": "fb7923b2-a1d8-4098-95ab-c0d768d40262",
  "date": "2026-09-20",
  "total_students": 2,
  "roster": [
    {
      "student_id": "a9ea994f-b4b6-4fb3-9e1b-7d55480a5586",
      "student_name": "Alice Walker",
      "student_email": "student.alice@edu.local",
      "attendance_id": "3d508ebf-21f4-4a41-bbf4-c6c7b949c264",
      "status": "present",
      "notes": "Participated actively",
      "date": "2026-09-20"
    }
  ]
}
```

### 3. Create Assignment
`POST /api/v1/classes/{id}/assignments`  
*Protected: Teacher, Admin*

```json
{
  "title": "Geometry Project 1",
  "description": "Construct scale models of 3D geometric polyhedra.",
  "due_date": "2026-09-28T23:59:59Z",
  "max_score": 100
}
```

### 4. Student Overview
`GET /api/v1/students/{id}/overview`  
*Protected: Student (self only), Parent, Teacher, Admin*

Response:
```json
{
  "student_id": "a9ea994f-b4b6-4fb3-9e1b-7d55480a5586",
  "attendance_summary": {
    "total_days": 20,
    "present": 18,
    "absent": 1,
    "late": 1,
    "excused": 0,
    "attendance_rate_percentage": 95.0
  },
  "pending_assignments": [
    {
      "id": "c3a938c0-be35-4072-8591-f1cd165621c4",
      "class_id": "fb7923b2-a1d8-4098-95ab-c0d768d40262",
      "class_name": "Grade 8 Mathematics",
      "title": "Geometry Project 1",
      "description": "Construct scale models of 3D geometric polyhedra.",
      "due_date": "2026-09-28T23:59:59Z",
      "max_score": 100,
      "created_at": "2026-09-20T07:39:00Z"
    }
  ]
}
```

---

## 🎯 Error Standard Format

All errors return JSON adhering strictly to:
```json
{
  "error": "human-readable message",
  "status": 400
}
```
Implemented via [`internal/response`](internal/response/response.go).

---

## 💻 Web Client (React + TypeScript + Vite + Tailwind)

A modern, responsive web application is located in `web/` and served behind Nginx under path `/edu/`.

### Tech Stack
- **React 18** with **TypeScript** and **Vite**
- **Tailwind CSS** with Unicode typography (Inter, Pyidaungsu, Noto Sans Myanmar)
- **Lucide React** icons
- **React Router v6** with role-based route guards and `basename="/edu"`

### Pages & Routes
- **`/edu/login`**: High-contrast login page with one-click multi-tenant demo role presets.
- **`/edu/sysadmin`**: National Multi-Tenant Registry for platform administrators; provision and monitor facilities nationwide.
- **`/edu/school-admin`**: Facility Administration Center for school principals; manage campus classes, faculty, and student rosters.
- **`/edu/teacher`**: Teacher dashboard with class summaries and direct attendance links.
- **`/edu/teacher/copilot`**: Two-pane AI Lesson Copilot with subject presets, markdown renderer, and copy/history features.
- **`/edu/teacher/classes/:id/attendance`**: Interactive date-based student attendance roster with toggles and single-click batch save.
- **`/edu/teacher/classes/:id/assignments`**: Assignment manager with creation modal and submissions table.
- **`/edu/parent/student/:id`**: Parent overview card with attendance percentage, standing badge, and pending homework list.

---

## 🌐 Nginx Deployment (`/edu` Reverse Proxy)

The frontend and API are served concurrently via Nginx on port 80:

```nginx
upstream edu_backend {
    server 127.0.0.1:8080;
    keepalive 32;
}

server {
    listen 80;

    # Redirect /edu to /edu/
    location = /edu {
        return 301 /edu/;
    }

    # API Proxy -> Go backend (port 8080)
    location /edu/api/ {
        proxy_pass http://edu_backend/api/;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_set_header X-Forwarded-Prefix /edu;
    }

    # Frontend Single Page Application -> /var/www/edu/
    location /edu/ {
        root /var/www;
        index index.html;
        try_files $uri $uri/ /edu/index.html;
    }
}
```

---

## 🇲🇲 Myanmar MIMU Place Codes (P-Codes) & School Facility Standards

The platform organizes educational facilities nationwide using the **Myanmar Information Management Unit (MIMU)** administrative Place Code hierarchy (v9.7) and adheres to the **Option A Facility Coding Standard**:

$$\text{School Code} = \text{[MIMU Ward or Village Tract P-Code]} - \text{[Category][Sequence]}$$

### 1. MIMU Administrative Hierarchy
- **Level 1 (State / Region)**: 15 Divisions (`MMR001` - `MMR018`, e.g. `MMR013` for Yangon Region, `MMR009` for Mandalay Region, `MMR018` for Nay Pyi Taw).
- **Level 3 (Township)**: 330 Townships nationwide (e.g. `MMR013001` for Dagon Township).
- **Level 4 (Ward / Village Tract)**: Urban Wards and rural Village Tracts (e.g. `MMR013001001` for Ward No. 1, Dagon).

### 2. Category Standard
- **`HS`**: Basic Education High School (`အ.ထ.က` - BEHS)
- **`MS`**: Basic Education Middle School (`အ.လ.က` - BEMS)
- **`PS`**: Basic Education Primary School (`အ.မ.က` - BEPS)
- **`PV`**: Private School (`ကိုယ်ပိုင်ကျောင်း`)
- **`ME`**: Monastic Education School (`ဘုန်းတော်ကြီးသင် ပညာရေးကျောင်း` - ဘ.က)

### 3. Example Option A Codes
- `MMR013001001-HS01`: Basic Education High School No. 1 Dagon
- `MMR013001001-PV01`: Yangon Academy High School (Ward 1, Dagon)
- `MMR013003002-HS02`: Basic Education High School No. 2 Kamayut
- `MMR009002004-HS16`: Basic Education High School No. 16 Mandalay
- `MMR018001001-HS01`: Basic Education High School No. 1 Zabuthiri (Nay Pyi Taw)

### 4. Nationwide Seed & On-Demand Provisioning Model
- **Pre-Seeded Data**: All 15 States and Regions, 40+ key Townships, sample Wards/Village Tracts, and flagship regional hub facilities in Yangon, Mandalay, Shan State, and Nay Pyi Taw.
- **On-Demand Facility Creation**: Additional schools across any state or township can be provisioned instantaneously via the Sysadmin Dashboard (`/edu/sysadmin`) with automatic Option A code formatting and Burmese Unicode place resolution.

