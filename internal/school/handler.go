package school

import (
	"errors"
	"net/http"
	"strconv"
	"strings"
	"time"

	"edu-platform/internal/auth"
	"edu-platform/internal/response"

	"github.com/go-chi/chi/v5"
	"github.com/google/uuid"
)

// Handler handles HTTP requests for school domain
type Handler struct {
	service *Service
}

// NewHandler creates a new school Handler
func NewHandler(service *Service) *Handler {
	return &Handler{service: service}
}

// CreateClass handles POST /api/v1/classes
func (h *Handler) CreateClass(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	user, ok := auth.UserFromContext(ctx)
	if !ok || user == nil {
		response.Unauthorized(w, "authentication required")
		return
	}

	var req CreateClassRequest
	if err := response.DecodeJSON(r, &req); err != nil {
		response.BadRequest(w, "invalid request body: "+err.Error())
		return
	}

	if req.SchoolID == nil && user.SchoolID != nil {
		req.SchoolID = user.SchoolID
	}

	class, err := h.service.CreateClass(ctx, user.UserID, req)
	if err != nil {
		handleError(w, err)
		return
	}

	response.JSON(w, http.StatusCreated, class)
}

// GetClass handles GET /api/v1/classes/{id}
func (h *Handler) GetClass(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	classID, err := uuid.Parse(chi.URLParam(r, "id"))
	if err != nil {
		response.BadRequest(w, "invalid class ID format")
		return
	}

	class, err := h.service.GetClass(ctx, classID)
	if err != nil {
		handleError(w, err)
		return
	}

	response.JSON(w, http.StatusOK, class)
}

// ListClasses handles GET /api/v1/classes
func (h *Handler) ListClasses(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	user, _ := auth.UserFromContext(ctx)

	var teacherID *uuid.UUID
	teacherParam := r.URL.Query().Get("teacher_id")
	if teacherParam != "" {
		tid, err := uuid.Parse(teacherParam)
		if err != nil {
			response.BadRequest(w, "invalid teacher_id format")
			return
		}
		teacherID = &tid
	} else if user != nil && user.Role == "teacher" {
		teacherID = &user.UserID
	}

	var schoolID *uuid.UUID
	schoolParam := r.URL.Query().Get("school_id")
	if schoolParam != "" {
		sid, err := uuid.Parse(schoolParam)
		if err != nil {
			response.BadRequest(w, "invalid school_id format")
			return
		}
		schoolID = &sid
	} else if user != nil && user.SchoolID != nil {
		// Scoped automatically to caller's facility
		schoolID = user.SchoolID
	}

	classes, err := h.service.ListClasses(ctx, schoolID, teacherID)
	if err != nil {
		handleError(w, err)
		return
	}

	response.JSON(w, http.StatusOK, classes)
}

// DeleteClass handles DELETE /api/v1/classes/{id}
func (h *Handler) DeleteClass(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	classID, err := uuid.Parse(chi.URLParam(r, "id"))
	if err != nil {
		response.BadRequest(w, "invalid class ID format")
		return
	}

	if err := h.service.DeleteClass(ctx, classID); err != nil {
		handleError(w, err)
		return
	}

	response.JSON(w, http.StatusOK, map[string]string{"message": "class deleted successfully"})
}

// SeedDefaultClasses handles POST /api/v1/schools/{id}/seed-default-classes
// and POST /api/v1/classes/seed-default
func (h *Handler) SeedDefaultClasses(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	user, ok := auth.UserFromContext(ctx)
	if !ok || user == nil {
		response.Unauthorized(w, "authentication required")
		return
	}

	var schoolID uuid.UUID
	idParam := chi.URLParam(r, "id")
	if idParam != "" {
		parsed, err := uuid.Parse(idParam)
		if err != nil {
			response.BadRequest(w, "invalid school ID format")
			return
		}
		schoolID = parsed
	} else {
		var req SeedDefaultClassesRequest
		_ = response.DecodeJSON(r, &req)
		if req.SchoolID != nil && *req.SchoolID != uuid.Nil {
			schoolID = *req.SchoolID
		} else if user.SchoolID != nil {
			schoolID = *user.SchoolID
		}
	}

	if schoolID == uuid.Nil {
		response.BadRequest(w, "school_id is required to seed default classes")
		return
	}

	if user.Role == "school_admin" && user.SchoolID != nil && *user.SchoolID != schoolID {
		response.Forbidden(w, "cannot seed classes for other school facilities")
		return
	}

	classes, err := h.service.SeedDefaultClasses(ctx, schoolID, "2026-2027")
	if err != nil {
		handleError(w, err)
		return
	}

	response.JSON(w, http.StatusOK, classes)
}

// ListSchoolFaculty handles GET /api/v1/schools/{id}/faculty and /api/v1/schools/{id}/teachers
func (h *Handler) ListSchoolFaculty(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	schoolID, err := uuid.Parse(chi.URLParam(r, "id"))
	if err != nil {
		response.BadRequest(w, "invalid school ID format")
		return
	}

	faculty, err := h.service.ListSchoolFaculty(ctx, schoolID)
	if err != nil {
		handleError(w, err)
		return
	}

	response.JSON(w, http.StatusOK, faculty)
}

// CreateTeacher handles POST /api/v1/schools/{id}/teachers
func (h *Handler) CreateTeacher(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	schoolID, err := uuid.Parse(chi.URLParam(r, "id"))
	if err != nil {
		response.BadRequest(w, "invalid school ID format")
		return
	}

	var req CreateTeacherRequest
	if err := response.DecodeJSON(r, &req); err != nil {
		response.BadRequest(w, "invalid request body: "+err.Error())
		return
	}

	teacher, err := h.service.CreateTeacher(ctx, schoolID, req)
	if err != nil {
		handleError(w, err)
		return
	}

	response.JSON(w, http.StatusCreated, teacher)
}

// UpdateTeacher handles PUT /api/v1/schools/{id}/teachers/{teacherId} and PUT /api/v1/teachers/{id}
func (h *Handler) UpdateTeacher(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	teacherIDStr := chi.URLParam(r, "teacherId")
	if teacherIDStr == "" {
		teacherIDStr = chi.URLParam(r, "id")
	}
	teacherID, err := uuid.Parse(teacherIDStr)
	if err != nil {
		response.BadRequest(w, "invalid teacher ID format")
		return
	}

	var req UpdateTeacherRequest
	if err := response.DecodeJSON(r, &req); err != nil {
		response.BadRequest(w, "invalid request body: "+err.Error())
		return
	}

	teacher, err := h.service.UpdateTeacher(ctx, teacherID, req)
	if err != nil {
		handleError(w, err)
		return
	}

	response.JSON(w, http.StatusOK, teacher)
}

// DeleteTeacher handles DELETE /api/v1/schools/{id}/teachers/{teacherId} and DELETE /api/v1/teachers/{id}
func (h *Handler) DeleteTeacher(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	teacherIDStr := chi.URLParam(r, "teacherId")
	if teacherIDStr == "" {
		teacherIDStr = chi.URLParam(r, "id")
	}
	teacherID, err := uuid.Parse(teacherIDStr)
	if err != nil {
		response.BadRequest(w, "invalid teacher ID format")
		return
	}

	if err := h.service.DeleteTeacher(ctx, teacherID); err != nil {
		handleError(w, err)
		return
	}

	response.JSON(w, http.StatusOK, map[string]string{"message": "teacher successfully deleted"})
}

// ListSchoolStudents handles GET /api/v1/schools/{id}/students
func (h *Handler) ListSchoolStudents(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	schoolID, err := uuid.Parse(chi.URLParam(r, "id"))
	if err != nil {
		response.BadRequest(w, "invalid school ID format")
		return
	}

	students, err := h.service.ListSchoolStudents(ctx, schoolID)
	if err != nil {
		handleError(w, err)
		return
	}

	response.JSON(w, http.StatusOK, students)
}

// CreateSchoolStudent handles POST /api/v1/schools/{id}/students
func (h *Handler) CreateSchoolStudent(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	schoolID, err := uuid.Parse(chi.URLParam(r, "id"))
	if err != nil {
		response.BadRequest(w, "invalid school ID format")
		return
	}

	var req CreateSchoolStudentRequest
	if err := response.DecodeJSON(r, &req); err != nil {
		response.BadRequest(w, "invalid request body: "+err.Error())
		return
	}

	student, err := h.service.CreateSchoolStudent(ctx, schoolID, req)
	if err != nil {
		handleError(w, err)
		return
	}

	response.JSON(w, http.StatusCreated, student)
}

// SeedSampleStudents handles POST /api/v1/schools/{id}/seed-sample-students
func (h *Handler) SeedSampleStudents(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	schoolID, err := uuid.Parse(chi.URLParam(r, "id"))
	if err != nil {
		response.BadRequest(w, "invalid school ID format")
		return
	}

	students, err := h.service.SeedSampleStudents(ctx, schoolID)
	if err != nil {
		handleError(w, err)
		return
	}

	response.JSON(w, http.StatusOK, students)
}

// DeleteStudent handles DELETE /api/v1/schools/{id}/students/{studentId} and DELETE /api/v1/students/{id}
func (h *Handler) DeleteStudent(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	studentIDStr := chi.URLParam(r, "studentId")
	if studentIDStr == "" {
		studentIDStr = chi.URLParam(r, "id")
	}
	studentID, err := uuid.Parse(studentIDStr)
	if err != nil {
		response.BadRequest(w, "invalid student ID format")
		return
	}

	if err := h.service.DeleteStudent(ctx, studentID); err != nil {
		handleError(w, err)
		return
	}

	response.JSON(w, http.StatusOK, map[string]string{"message": "student successfully deleted"})
}


// CreateSchool handles POST /api/v1/schools (Sysadmin)
func (h *Handler) CreateSchool(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	var req CreateSchoolRequest
	if err := response.DecodeJSON(r, &req); err != nil {
		response.BadRequest(w, "invalid request body: "+err.Error())
		return
	}

	school, err := h.service.CreateSchool(ctx, req)
	if err != nil {
		handleError(w, err)
		return
	}

	response.JSON(w, http.StatusCreated, school)
}

// ListSchools handles GET /api/v1/schools (Sysadmin & School Admin)
func (h *Handler) ListSchools(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	q := r.URL.Query()

	// If client explicitly requests all without pagination (e.g. ?all=true)
	if q.Get("all") == "true" {
		schools, err := h.service.ListSchools(ctx)
		if err != nil {
			handleError(w, err)
			return
		}
		response.JSON(w, http.StatusOK, schools)
		return
	}

	page := 1
	if pStr := q.Get("page"); pStr != "" {
		if p, err := strconv.Atoi(pStr); err == nil && p > 0 {
			page = p
		}
	}

	limit := 24
	if lStr := q.Get("limit"); lStr != "" {
		if l, err := strconv.Atoi(lStr); err == nil && l > 0 {
			limit = l
		}
	}

	params := ListSchoolsParams{
		Page:     page,
		Limit:    limit,
		Search:   q.Get("search"),
		Region:   q.Get("region"),
		PCodeSR:  q.Get("pcode_sr"),
		PCodeTS:  q.Get("pcode_ts"),
		Category: q.Get("category"),
	}

	res, err := h.service.ListSchoolsPaginated(ctx, params)
	if err != nil {
		handleError(w, err)
		return
	}

	response.JSON(w, http.StatusOK, res)
}

// GetSchool handles GET /api/v1/schools/{id}
func (h *Handler) GetSchool(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	idStr := chi.URLParam(r, "id")
	id, err := uuid.Parse(idStr)
	if err != nil {
		response.BadRequest(w, "invalid school ID format")
		return
	}

	school, err := h.service.GetSchool(ctx, id)
	if err != nil {
		handleError(w, err)
		return
	}

	response.JSON(w, http.StatusOK, school)
}

// EnrollStudent handles POST /api/v1/classes/{id}/enroll
func (h *Handler) EnrollStudent(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	classID, err := uuid.Parse(chi.URLParam(r, "id"))
	if err != nil {
		response.BadRequest(w, "invalid class ID format")
		return
	}

	var req EnrollStudentRequest
	if err := response.DecodeJSON(r, &req); err != nil {
		response.BadRequest(w, "invalid request body: "+err.Error())
		return
	}

	if req.StudentID == uuid.Nil {
		response.BadRequest(w, "student_id is required")
		return
	}

	if err := h.service.EnrollStudent(ctx, classID, req.StudentID); err != nil {
		handleError(w, err)
		return
	}

	response.JSON(w, http.StatusOK, map[string]any{
		"message":    "student enrolled successfully",
		"class_id":   classID,
		"student_id": req.StudentID,
	})
}

// ListStudents handles GET /api/v1/classes/{id}/students
func (h *Handler) ListStudents(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	classID, err := uuid.Parse(chi.URLParam(r, "id"))
	if err != nil {
		response.BadRequest(w, "invalid class ID format")
		return
	}

	students, err := h.service.ListClassStudents(ctx, classID)
	if err != nil {
		handleError(w, err)
		return
	}

	response.JSON(w, http.StatusOK, students)
}

// BatchRecordAttendance handles POST /api/v1/classes/{id}/attendance
func (h *Handler) BatchRecordAttendance(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	classID, err := uuid.Parse(chi.URLParam(r, "id"))
	if err != nil {
		response.BadRequest(w, "invalid class ID format")
		return
	}

	var req BatchAttendanceRequest
	if err := response.DecodeJSON(r, &req); err != nil {
		response.BadRequest(w, "invalid request body: "+err.Error())
		return
	}

	res, err := h.service.BatchRecordAttendance(ctx, classID, req)
	if err != nil {
		handleError(w, err)
		return
	}

	response.JSON(w, http.StatusOK, res)
}

// GetAttendanceRoster handles GET /api/v1/classes/{id}/attendance?date=YYYY-MM-DD
func (h *Handler) GetAttendanceRoster(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	classID, err := uuid.Parse(chi.URLParam(r, "id"))
	if err != nil {
		response.BadRequest(w, "invalid class ID format")
		return
	}

	dateStr := strings.TrimSpace(r.URL.Query().Get("date"))
	if dateStr == "" {
		response.BadRequest(w, "missing required query parameter: date (format: YYYY-MM-DD)")
		return
	}

	roster, err := h.service.GetAttendanceRoster(ctx, classID, dateStr)
	if err != nil {
		handleError(w, err)
		return
	}

	response.JSON(w, http.StatusOK, roster)
}

// CreateAssignment handles POST /api/v1/classes/{id}/assignments
func (h *Handler) CreateAssignment(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	classID, err := uuid.Parse(chi.URLParam(r, "id"))
	if err != nil {
		response.BadRequest(w, "invalid class ID format")
		return
	}

	var req CreateAssignmentRequest
	if err := response.DecodeJSON(r, &req); err != nil {
		response.BadRequest(w, "invalid request body: "+err.Error())
		return
	}

	assignment, err := h.service.CreateAssignment(ctx, classID, req)
	if err != nil {
		handleError(w, err)
		return
	}

	response.JSON(w, http.StatusCreated, assignment)
}

// ListAssignments handles GET /api/v1/classes/{id}/assignments
func (h *Handler) ListAssignments(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	classID, err := uuid.Parse(chi.URLParam(r, "id"))
	if err != nil {
		response.BadRequest(w, "invalid class ID format")
		return
	}

	assignments, err := h.service.ListAssignments(ctx, classID)
	if err != nil {
		handleError(w, err)
		return
	}

	response.JSON(w, http.StatusOK, assignments)
}

// SubmitAssignment handles POST /api/v1/assignments/{id}/submissions
func (h *Handler) SubmitAssignment(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	user, ok := auth.UserFromContext(ctx)
	if !ok || user == nil {
		response.Unauthorized(w, "authentication required")
		return
	}

	assignmentID, err := uuid.Parse(chi.URLParam(r, "id"))
	if err != nil {
		response.BadRequest(w, "invalid assignment ID format")
		return
	}

	var req SubmitAssignmentRequest
	_ = response.DecodeJSON(r, &req)

	if err := h.service.SubmitAssignment(ctx, assignmentID, user.UserID); err != nil {
		handleError(w, err)
		return
	}

	response.JSON(w, http.StatusOK, map[string]any{
		"message":       "assignment submitted successfully",
		"assignment_id": assignmentID,
		"student_id":    user.UserID,
	})
}

// GradeSubmission handles POST /api/v1/submissions/{id}/grade
func (h *Handler) GradeSubmission(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	submissionID, err := uuid.Parse(chi.URLParam(r, "id"))
	if err != nil {
		response.BadRequest(w, "invalid submission ID format")
		return
	}

	var req GradeSubmissionRequest
	if err := response.DecodeJSON(r, &req); err != nil {
		response.BadRequest(w, "invalid request body: "+err.Error())
		return
	}

	if err := h.service.GradeSubmission(ctx, submissionID, req.Grade, req.Feedback); err != nil {
		handleError(w, err)
		return
	}

	response.JSON(w, http.StatusOK, map[string]any{
		"message":       "submission graded successfully",
		"submission_id": submissionID,
		"grade":         req.Grade,
		"feedback":      req.Feedback,
	})
}

// GetStudentDetail handles GET /api/v1/students/{id}
func (h *Handler) GetStudentDetail(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	studentID, err := uuid.Parse(chi.URLParam(r, "id"))
	if err != nil {
		response.BadRequest(w, "invalid student ID format")
		return
	}

	detail, err := h.service.GetStudentDetail(ctx, studentID)
	if err != nil {
		handleError(w, err)
		return
	}

	response.JSON(w, http.StatusOK, detail)
}

// GetStudentOverview handles GET /api/v1/students/{id}/overview
func (h *Handler) GetStudentOverview(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	user, ok := auth.UserFromContext(ctx)
	if !ok || user == nil {
		response.Unauthorized(w, "authentication required")
		return
	}

	studentID, err := uuid.Parse(chi.URLParam(r, "id"))
	if err != nil {
		response.BadRequest(w, "invalid student ID format")
		return
	}

	// RBAC rule: A student may only access their own overview
	if user.Role == "student" && user.UserID != studentID {
		response.Forbidden(w, "students may only view their own overview")
		return
	}

	overview, err := h.service.GetStudentOverview(ctx, studentID)
	if err != nil {
		handleError(w, err)
		return
	}

	response.JSON(w, http.StatusOK, overview)
}

// ListStateRegions handles GET /api/v1/pcodes/states
func (h *Handler) ListStateRegions(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	states, err := h.service.ListStateRegions(ctx)
	if err != nil {
		handleError(w, err)
		return
	}
	response.JSON(w, http.StatusOK, states)
}

// ListTownships handles GET /api/v1/pcodes/townships?sr=MMR013
func (h *Handler) ListTownships(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	sr := r.URL.Query().Get("sr")
	townships, err := h.service.ListTownships(ctx, sr)
	if err != nil {
		handleError(w, err)
		return
	}
	response.JSON(w, http.StatusOK, townships)
}

// ListWards handles GET /api/v1/pcodes/wards?ts=MMR013001
func (h *Handler) ListWards(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	ts := r.URL.Query().Get("ts")
	wards, err := h.service.ListWards(ctx, ts)
	if err != nil {
		handleError(w, err)
		return
	}
	response.JSON(w, http.StatusOK, wards)
}

// SearchPCodes handles GET /api/v1/pcodes/search?q=Dagon
func (h *Handler) SearchPCodes(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	q := r.URL.Query().Get("q")
	results, err := h.service.SearchPCodes(ctx, q)
	if err != nil {
		handleError(w, err)
		return
	}
	response.JSON(w, http.StatusOK, results)
}

// GetStudentBlockchainID handles GET /api/v1/students/{id}/blockchain-id
func (h *Handler) GetStudentBlockchainID(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	studentID, err := uuid.Parse(chi.URLParam(r, "id"))
	if err != nil {
		response.BadRequest(w, "invalid student ID format")
		return
	}

	result, err := h.service.GetOrCreateStudentBlockchainID(ctx, studentID)
	if err != nil {
		handleError(w, err)
		return
	}

	response.JSON(w, http.StatusOK, result)
}

// VerifyStudentCredential handles GET /api/v1/blockchain/verify?identifier=...
func (h *Handler) VerifyStudentCredential(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	identifier := r.URL.Query().Get("identifier")
	if identifier == "" {
		identifier = r.URL.Query().Get("did")
	}
	if identifier == "" {
		identifier = r.URL.Query().Get("hash")
	}

	if identifier == "" {
		response.BadRequest(w, "query parameter 'identifier', 'did', or 'hash' is required")
		return
	}

	result, err := h.service.VerifyStudentCredential(ctx, identifier)
	if err != nil {
		handleError(w, err)
		return
	}

	response.JSON(w, http.StatusOK, result)
}

// BatchAnchorCredentials handles POST /api/v1/blockchain/anchor-batch
func (h *Handler) BatchAnchorCredentials(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	user, ok := auth.UserFromContext(ctx)
	adminID := uuid.Nil
	if ok && user != nil {
		adminID = user.UserID
	}

	result, err := h.service.BatchAnchorCredentials(ctx, adminID)
	if err != nil {
		handleError(w, err)
		return
	}

	response.JSON(w, http.StatusOK, result)
}

// ListParentChildren handles GET /api/v1/parents/{id}/children or GET /api/v1/parents/my-children
func (h *Handler) ListParentChildren(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	parentIDStr := chi.URLParam(r, "id")
	var parentID uuid.UUID
	var err error

	if parentIDStr == "" || parentIDStr == "me" || parentIDStr == "my-children" {
		user, ok := auth.UserFromContext(ctx)
		if !ok || user == nil {
			response.Unauthorized(w, "authentication required")
			return
		}
		parentID = user.UserID
	} else {
		parentID, err = uuid.Parse(parentIDStr)
		if err != nil {
			response.BadRequest(w, "invalid parent ID format")
			return
		}
	}

	children, err := h.service.ListChildrenByParent(ctx, parentID)
	if err != nil {
		handleError(w, err)
		return
	}

	response.JSON(w, http.StatusOK, children)
}

// IngestWholeChildBatch handles POST /api/v1/sync/whole-child-batch
func (h *Handler) IngestWholeChildBatch(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	user, _ := auth.UserFromContext(ctx)

	var payload WholeChildSyncPayload
	if err := response.DecodeJSON(r, &payload); err != nil {
		response.BadRequest(w, "invalid sync payload: "+err.Error())
		return
	}

	syncMethod := r.URL.Query().Get("method")
	if syncMethod == "" {
		syncMethod = "direct_http"
	}

	var teacherID uuid.UUID
	var schoolID *uuid.UUID
	if user != nil {
		teacherID = user.UserID
		schoolID = user.SchoolID
	}

	res, err := h.service.IngestWholeChildBatch(ctx, teacherID, schoolID, payload, syncMethod)
	if err != nil {
		handleError(w, err)
		return
	}

	response.JSON(w, http.StatusOK, res)
}

// ListClassWholeChildProfiles handles GET /api/v1/classes/{id}/whole-child-profiles
func (h *Handler) ListClassWholeChildProfiles(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	classID, err := uuid.Parse(chi.URLParam(r, "id"))
	if err != nil {
		response.BadRequest(w, "invalid class ID format")
		return
	}

	period := r.URL.Query().Get("period")
	profiles, err := h.service.ListClassWholeChildProfiles(ctx, classID, period)
	if err != nil {
		handleError(w, err)
		return
	}

	response.JSON(w, http.StatusOK, profiles)
}

// BatchSaveClassWholeChildProfiles handles POST /api/v1/classes/{id}/whole-child-profiles
func (h *Handler) BatchSaveClassWholeChildProfiles(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	classID, err := uuid.Parse(chi.URLParam(r, "id"))
	if err != nil {
		response.BadRequest(w, "invalid class ID format")
		return
	}

	var req BatchSaveClassWholeChildRequest
	if err := response.DecodeJSON(r, &req); err != nil {
		response.BadRequest(w, "invalid request payload: "+err.Error())
		return
	}

	res, err := h.service.BatchSaveClassWholeChildProfiles(ctx, classID, req)
	if err != nil {
		handleError(w, err)
		return
	}

	response.JSON(w, http.StatusOK, res)
}

// GetStudentWholeChildProfile handles GET /api/v1/students/{id}/whole-child-profile
func (h *Handler) GetStudentWholeChildProfile(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	studentID, err := uuid.Parse(chi.URLParam(r, "id"))
	if err != nil {
		response.BadRequest(w, "invalid student ID format")
		return
	}

	period := r.URL.Query().Get("period")
	profile, err := h.service.GetStudentWholeChildProfile(ctx, studentID, period)
	if err != nil {
		handleError(w, err)
		return
	}

	response.JSON(w, http.StatusOK, profile)
}

// ListSyncBatches handles GET /api/v1/sync/batches
func (h *Handler) ListSyncBatches(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	user, ok := auth.UserFromContext(ctx)
	if !ok || user == nil || user.SchoolID == nil {
		response.Forbidden(w, "school association required")
		return
	}

	batches, err := h.service.ListSyncBatches(ctx, *user.SchoolID, 30, 0)
	if err != nil {
		handleError(w, err)
		return
	}

	response.JSON(w, http.StatusOK, batches)
}

// CreateConversation handles POST /api/v1/conversations
func (h *Handler) CreateConversation(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	user, ok := auth.UserFromContext(ctx)
	if !ok || user == nil {
		response.Unauthorized(w, "authentication required")
		return
	}

	var req CreateConversationRequest
	if err := response.DecodeJSON(r, &req); err != nil {
		response.BadRequest(w, "invalid request body: "+err.Error())
		return
	}

	conv, err := h.service.GetOrCreateConversation(ctx, user.UserID, user.Role, req)
	if err != nil {
		handleError(w, err)
		return
	}

	response.JSON(w, http.StatusCreated, conv)
}

// ListConversations handles GET /api/v1/conversations
func (h *Handler) ListConversations(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	user, ok := auth.UserFromContext(ctx)
	if !ok || user == nil {
		response.Unauthorized(w, "authentication required")
		return
	}

	convs, err := h.service.ListUserConversations(ctx, user.UserID)
	if err != nil {
		handleError(w, err)
		return
	}

	response.JSON(w, http.StatusOK, convs)
}

// GetConversation handles GET /api/v1/conversations/{id}
func (h *Handler) GetConversation(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	user, ok := auth.UserFromContext(ctx)
	if !ok || user == nil {
		response.Unauthorized(w, "authentication required")
		return
	}

	convID, err := uuid.Parse(chi.URLParam(r, "id"))
	if err != nil {
		response.BadRequest(w, "invalid conversation ID format")
		return
	}

	conv, err := h.service.GetConversation(ctx, user.UserID, convID)
	if err != nil {
		handleError(w, err)
		return
	}

	response.JSON(w, http.StatusOK, conv)
}

// ListMessages handles GET /api/v1/conversations/{id}/messages
func (h *Handler) ListMessages(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	user, ok := auth.UserFromContext(ctx)
	if !ok || user == nil {
		response.Unauthorized(w, "authentication required")
		return
	}

	convID, err := uuid.Parse(chi.URLParam(r, "id"))
	if err != nil {
		response.BadRequest(w, "invalid conversation ID format")
		return
	}

	msgs, err := h.service.ListMessages(ctx, user.UserID, convID)
	if err != nil {
		handleError(w, err)
		return
	}

	response.JSON(w, http.StatusOK, msgs)
}

// SendMessage handles POST /api/v1/conversations/{id}/messages
func (h *Handler) SendMessage(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	user, ok := auth.UserFromContext(ctx)
	if !ok || user == nil {
		response.Unauthorized(w, "authentication required")
		return
	}

	convID, err := uuid.Parse(chi.URLParam(r, "id"))
	if err != nil {
		response.BadRequest(w, "invalid conversation ID format")
		return
	}

	var req SendMessageRequest
	if err := response.DecodeJSON(r, &req); err != nil {
		response.BadRequest(w, "invalid request body: "+err.Error())
		return
	}

	msg, err := h.service.SendMessage(ctx, user.UserID, convID, req.Content)
	if err != nil {
		handleError(w, err)
		return
	}

	response.JSON(w, http.StatusCreated, msg)
}

// CreateAnnouncement handles POST /api/v1/classes/{id}/announcements
func (h *Handler) CreateAnnouncement(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	user, ok := auth.UserFromContext(ctx)
	if !ok || user == nil {
		response.Unauthorized(w, "authentication required")
		return
	}

	classID, err := uuid.Parse(chi.URLParam(r, "id"))
	if err != nil {
		response.BadRequest(w, "invalid class ID format")
		return
	}

	var req CreateAnnouncementRequest
	if err := response.DecodeJSON(r, &req); err != nil {
		response.BadRequest(w, "invalid request body: "+err.Error())
		return
	}

	ann, err := h.service.CreateAnnouncement(ctx, user.UserID, classID, req)
	if err != nil {
		handleError(w, err)
		return
	}

	response.JSON(w, http.StatusCreated, ann)
}

// ListClassAnnouncements handles GET /api/v1/classes/{id}/announcements
func (h *Handler) ListClassAnnouncements(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	classID, err := uuid.Parse(chi.URLParam(r, "id"))
	if err != nil {
		response.BadRequest(w, "invalid class ID format")
		return
	}

	anns, err := h.service.ListAnnouncements(ctx, classID)
	if err != nil {
		handleError(w, err)
		return
	}

	response.JSON(w, http.StatusOK, anns)
}

// ListParentAnnouncements handles GET /api/v1/parents/announcements
func (h *Handler) ListParentAnnouncements(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	user, ok := auth.UserFromContext(ctx)
	if !ok || user == nil {
		response.Unauthorized(w, "authentication required")
		return
	}

	anns, err := h.service.ListParentAnnouncements(ctx, user.UserID)
	if err != nil {
		handleError(w, err)
		return
	}

	response.JSON(w, http.StatusOK, anns)
}

// ListNotifications handles GET /api/v1/notifications
func (h *Handler) ListNotifications(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	user, ok := auth.UserFromContext(ctx)
	if !ok || user == nil {
		response.Unauthorized(w, "authentication required")
		return
	}

	limit := 30
	if lStr := r.URL.Query().Get("limit"); lStr != "" {
		if l, err := strconv.Atoi(lStr); err == nil && l > 0 {
			limit = l
		}
	}
	offset := 0
	if oStr := r.URL.Query().Get("offset"); oStr != "" {
		if o, err := strconv.Atoi(oStr); err == nil && o >= 0 {
			offset = o
		}
	}

	res, err := h.service.ListNotifications(ctx, user.UserID, limit, offset)
	if err != nil {
		handleError(w, err)
		return
	}

	response.JSON(w, http.StatusOK, res)
}

// MarkNotificationRead handles POST /api/v1/notifications/{id}/read
func (h *Handler) MarkNotificationRead(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	user, ok := auth.UserFromContext(ctx)
	if !ok || user == nil {
		response.Unauthorized(w, "authentication required")
		return
	}

	notifID, err := uuid.Parse(chi.URLParam(r, "id"))
	if err != nil {
		response.BadRequest(w, "invalid notification ID format")
		return
	}

	if err := h.service.MarkNotificationRead(ctx, user.UserID, notifID); err != nil {
		handleError(w, err)
		return
	}

	response.JSON(w, http.StatusOK, map[string]string{"status": "ok"})
}

// MarkAllNotificationsRead handles POST /api/v1/notifications/read-all
func (h *Handler) MarkAllNotificationsRead(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	user, ok := auth.UserFromContext(ctx)
	if !ok || user == nil {
		response.Unauthorized(w, "authentication required")
		return
	}

	if err := h.service.MarkAllNotificationsRead(ctx, user.UserID); err != nil {
		handleError(w, err)
		return
	}

	response.JSON(w, http.StatusOK, map[string]string{"status": "ok"})
}

// GetExamMarksRoster handles GET /api/v1/classes/{id}/exam-marks?exam_name=...
func (h *Handler) GetExamMarksRoster(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	classID, err := uuid.Parse(chi.URLParam(r, "id"))
	if err != nil {
		response.BadRequest(w, "invalid class ID format")
		return
	}

	examName := r.URL.Query().Get("exam_name")
	roster, err := h.service.GetExamRoster(ctx, classID, examName)
	if err != nil {
		handleError(w, err)
		return
	}

	response.JSON(w, http.StatusOK, roster)
}

// BatchRecordExamMarks handles POST /api/v1/classes/{id}/exam-marks
func (h *Handler) BatchRecordExamMarks(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	classID, err := uuid.Parse(chi.URLParam(r, "id"))
	if err != nil {
		response.BadRequest(w, "invalid class ID format")
		return
	}

	var req BatchExamMarksRequest
	if err := response.DecodeJSON(r, &req); err != nil {
		response.BadRequest(w, "invalid request body: "+err.Error())
		return
	}

	res, err := h.service.BatchRecordExamMarks(ctx, classID, req)
	if err != nil {
		handleError(w, err)
		return
	}

	response.JSON(w, http.StatusOK, res)
}

// ListClassExams handles GET /api/v1/classes/{id}/exams
func (h *Handler) ListClassExams(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	classID, err := uuid.Parse(chi.URLParam(r, "id"))
	if err != nil {
		response.BadRequest(w, "invalid class ID format")
		return
	}

	exams, err := h.service.ListClassExams(ctx, classID)
	if err != nil {
		handleError(w, err)
		return
	}

	response.JSON(w, http.StatusOK, exams)
}

// GetSchoolShiftConfig handles GET /api/v1/schools/{id}/shift-config
func (h *Handler) GetSchoolShiftConfig(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	schoolID, err := uuid.Parse(chi.URLParam(r, "id"))
	if err != nil {
		response.BadRequest(w, "invalid school ID format")
		return
	}

	configs, err := h.service.GetSchoolShiftConfigs(ctx, schoolID)
	if err != nil {
		handleError(w, err)
		return
	}

	response.JSON(w, http.StatusOK, configs)
}

// SaveSchoolShiftConfig handles PUT /api/v1/schools/{id}/shift-config
func (h *Handler) SaveSchoolShiftConfig(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	schoolID, err := uuid.Parse(chi.URLParam(r, "id"))
	if err != nil {
		response.BadRequest(w, "invalid school ID format")
		return
	}

	var req []ShiftConfigDTO
	if err := response.DecodeJSON(r, &req); err != nil {
		response.BadRequest(w, "invalid request body: "+err.Error())
		return
	}

	configs, err := h.service.SaveSchoolShiftConfigs(ctx, schoolID, req)
	if err != nil {
		handleError(w, err)
		return
	}

	response.JSON(w, http.StatusOK, configs)
}

// GetClassTimetable handles GET /api/v1/classes/{id}/timetable
func (h *Handler) GetClassTimetable(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	classID, err := uuid.Parse(chi.URLParam(r, "id"))
	if err != nil {
		response.BadRequest(w, "invalid class ID format")
		return
	}

	tt, err := h.service.GetClassTimetable(ctx, classID)
	if err != nil {
		handleError(w, err)
		return
	}

	response.JSON(w, http.StatusOK, tt)
}

// UpdateClassTimetable handles PUT /api/v1/classes/{id}/timetable
func (h *Handler) UpdateClassTimetable(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	classID, err := uuid.Parse(chi.URLParam(r, "id"))
	if err != nil {
		response.BadRequest(w, "invalid class ID format")
		return
	}

	var req UpdateClassTimetableRequest
	if err := response.DecodeJSON(r, &req); err != nil {
		response.BadRequest(w, "invalid request body: "+err.Error())
		return
	}
	req.ClassID = classID

	tt, err := h.service.UpdateClassTimetable(ctx, req)
	if err != nil {
		handleError(w, err)
		return
	}

	response.JSON(w, http.StatusOK, tt)
}

// PublishClassTimetable handles POST /api/v1/classes/{id}/timetable/publish
func (h *Handler) PublishClassTimetable(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	classID, err := uuid.Parse(chi.URLParam(r, "id"))
	if err != nil {
		response.BadRequest(w, "invalid class ID format")
		return
	}

	tt, err := h.service.PublishClassTimetable(ctx, classID)
	if err != nil {
		handleError(w, err)
		return
	}

	response.JSON(w, http.StatusOK, map[string]interface{}{
		"success":   true,
		"synced_at": time.Now().UTC().Format(time.RFC3339),
		"message":   "Timetable successfully published and synced to student mobile apps",
		"timetable": tt,
	})
}

// GetStudentTimetable handles GET /api/v1/students/{id}/timetable and GET /api/v1/students/me/timetable
func (h *Handler) GetStudentTimetable(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	user, _ := auth.UserFromContext(ctx)

	idParam := chi.URLParam(r, "id")
	var studentID uuid.UUID
	if idParam == "me" || idParam == "" {
		if user == nil {
			response.Unauthorized(w, "authentication required")
			return
		}
		studentID = user.UserID
	} else {
		parsed, err := uuid.Parse(idParam)
		if err != nil {
			if user != nil {
				studentID = user.UserID
			} else {
				response.BadRequest(w, "invalid student ID format")
				return
			}
		} else {
			studentID = parsed
		}
	}

	tt, err := h.service.GetStudentTimetable(ctx, studentID)
	if err != nil {
		handleError(w, err)
		return
	}

	response.JSON(w, http.StatusOK, tt)
}

// GetGateRoster handles GET /api/v1/gate/roster
func (h *Handler) GetGateRoster(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	user, _ := auth.UserFromContext(ctx)

	var schoolID *uuid.UUID
	schoolParam := r.URL.Query().Get("school_id")
	if schoolParam != "" {
		sid, err := uuid.Parse(schoolParam)
		if err != nil {
			response.BadRequest(w, "invalid school_id format")
			return
		}
		schoolID = &sid
	} else if user != nil && user.SchoolID != nil {
		schoolID = user.SchoolID
	}

	roster, err := h.service.GetGateRoster(ctx, schoolID)
	if err != nil {
		handleError(w, err)
		return
	}

	response.JSON(w, http.StatusOK, roster)
}

// SyncAttendanceBatch handles POST /api/v1/attendance/sync-batch and POST /api/v1/gate/sync-batch
func (h *Handler) SyncAttendanceBatch(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()

	var req SyncAttendanceBatchRequest
	if err := response.DecodeJSON(r, &req); err != nil {
		response.BadRequest(w, "invalid request body: "+err.Error())
		return
	}

	res, err := h.service.SyncAttendanceBatch(ctx, req)
	if err != nil {
		handleError(w, err)
		return
	}

	response.JSON(w, http.StatusOK, res)
}

func handleError(w http.ResponseWriter, err error) {
	switch {
	case errors.Is(err, ErrNotFound):
		response.NotFound(w, err.Error())
	case errors.Is(err, ErrBadRequest):
		response.BadRequest(w, err.Error())
	case errors.Is(err, ErrUnauthorized):
		response.Unauthorized(w, err.Error())
	case errors.Is(err, ErrForbidden):
		response.Forbidden(w, err.Error())
	case errors.Is(err, ErrConflict):
		response.Conflict(w, err.Error())
	default:
		response.InternalServerError(w, err.Error())
	}
}

// InitGatePairing handles POST /api/v1/gate/pair/init
func (h *Handler) InitGatePairing(w http.ResponseWriter, r *http.Request) {
	session := globalPairingStore.InitSession()
	response.JSON(w, http.StatusOK, session)
}

// GetGatePairingStatus handles GET /api/v1/gate/pair/status
func (h *Handler) GetGatePairingStatus(w http.ResponseWriter, r *http.Request) {
	pairingID := r.URL.Query().Get("pairing_id")
	if pairingID == "" {
		response.BadRequest(w, "pairing_id is required")
		return
	}

	session, found := globalPairingStore.GetSession(pairingID)
	if !found {
		response.NotFound(w, "pairing session expired or not found")
		return
	}

	response.JSON(w, http.StatusOK, session)
}

// ConfirmGatePairing handles POST /api/v1/gate/pair/confirm
func (h *Handler) ConfirmGatePairing(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	user, ok := auth.UserFromContext(ctx)
	if !ok || user == nil {
		response.Unauthorized(w, "authentication required")
		return
	}

	var req ConfirmGatePairingRequest
	if err := response.DecodeJSON(r, &req); err != nil {
		response.BadRequest(w, "invalid request: "+err.Error())
		return
	}

	if req.PairingID == "" {
		response.BadRequest(w, "pairing_id is required")
		return
	}

	var targetSchoolID uuid.UUID
	if req.SchoolID != "" {
		sid, err := uuid.Parse(req.SchoolID)
		if err == nil {
			targetSchoolID = sid
		}
	}

	if targetSchoolID == uuid.Nil && user.SchoolID != nil {
		targetSchoolID = *user.SchoolID
	}

	var school SchoolDTO
	if targetSchoolID != uuid.Nil {
		s, err := h.service.GetSchool(ctx, targetSchoolID)
		if err != nil {
			response.BadRequest(w, "target school not found: "+err.Error())
			return
		}
		school = s
	} else {
		// Fallback for demo: find Intaing or first school
		schools, err := h.service.ListSchools(ctx)
		if err != nil || len(schools) == 0 {
			response.BadRequest(w, "no school found for administrator")
			return
		}
		school = schools[0]
		for _, sc := range schools {
			if strings.Contains(sc.Code, "MMR013035") || strings.Contains(strings.ToLower(sc.Name), "intaing") {
				school = sc
				break
			}
		}
	}

	session, err := globalPairingStore.ConfirmSession(req.PairingID, school, req.GateName)
	if err != nil {
		response.BadRequest(w, err.Error())
		return
	}

	response.JSON(w, http.StatusOK, session)
}
