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

## 📊 Database Schema (PostgreSQL)

- **`users`**: `id` (UUID PK), `email` (unique), `password_hash`, `full_name`, `role` ('admin', 'teacher', 'parent', 'student'), `created_at`.
- **`classes`**: `id` (UUID PK), `name`, `grade_level`, `teacher_id` (FK to users), `academic_year`, `created_at`.
- **`class_enrollments`**: `id` (UUID PK), `class_id` (FK), `student_id` (FK), `enrolled_at`.
- **`attendance_records`**: `id` (UUID PK), `class_id` (FK), `student_id` (FK), `date` (DATE), `status` ('present', 'absent', 'late', 'excused'), `notes`, `created_at`.
- **`assignments`**: `id` (UUID PK), `class_id` (FK), `title`, `description`, `due_date` (TIMESTAMPTZ), `max_score`, `created_at`.
- **`submissions`**: `id` (UUID PK), `assignment_id` (FK), `student_id` (FK), `status` ('submitted', 'graded', 'late'), `grade` (NUMERIC), `feedback`, `submitted_at`.
- **`lesson_plans`**: `id` (UUID PK), `teacher_id` (FK), `subject`, `grade_level`, `topic`, `duration_minutes`, `generated_markdown`, `created_at`.

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
