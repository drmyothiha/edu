package school

import (
	"context"
	"crypto/ed25519"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"log"
	"math"
	"strings"
	"sync"
	"time"

	"edu-platform/internal/database"
	"edu-platform/internal/identity"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgtype"
	"golang.org/x/crypto/bcrypt"
)

var (
	ErrNotFound       = errors.New("resource not found")
	ErrUnauthorized   = errors.New("unauthorized action")
	ErrBadRequest     = errors.New("bad request")
	ErrConflict       = errors.New("resource conflict")
	ErrInternalServer = errors.New("internal server error")
)

// NotificationPublisher defines an interface for notifying users of events
type NotificationPublisher interface {
	PublishNotification(ctx context.Context, notif database.Notification)
}

// Service defines the business logic for classes, attendance, and assignments
type Service struct {
	queries  database.Querier
	notifier NotificationPublisher
}

// NewService creates a new school Service instance
func NewService(queries database.Querier) *Service {
	return &Service{queries: queries}
}

// SetNotifier sets the notification publisher for dispatching live events and pushes
func (s *Service) SetNotifier(notifier NotificationPublisher) {
	s.notifier = notifier
}

// CreateClass creates a new class assigned to a teacher
func (s *Service) CreateClass(ctx context.Context, teacherID uuid.UUID, req CreateClassRequest) (ClassDTO, error) {
	req.Name = strings.TrimSpace(req.Name)
	req.GradeLevel = strings.TrimSpace(req.GradeLevel)
	req.AcademicYear = strings.TrimSpace(req.AcademicYear)

	if req.Name == "" {
		return ClassDTO{}, fmt.Errorf("%w: class name is required", ErrBadRequest)
	}
	if req.GradeLevel == "" {
		return ClassDTO{}, fmt.Errorf("%w: grade_level is required", ErrBadRequest)
	}
	if req.AcademicYear == "" {
		return ClassDTO{}, fmt.Errorf("%w: academic_year is required", ErrBadRequest)
	}

	targetTeacherID := teacherID
	if req.TeacherID != nil && *req.TeacherID != uuid.Nil {
		targetTeacherID = *req.TeacherID
	}

	// Verify teacher exists and has teacher or admin role
	teacher, err := s.queries.GetUserByID(ctx, targetTeacherID)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return ClassDTO{}, fmt.Errorf("%w: teacher not found", ErrBadRequest)
		}
		return ClassDTO{}, fmt.Errorf("%w: failed to fetch teacher", ErrInternalServer)
	}
	if teacher.Role != "teacher" && teacher.Role != "admin" && teacher.Role != "school_admin" && teacher.Role != "sysadmin" {
		return ClassDTO{}, fmt.Errorf("%w: assigned user must be a teacher or admin", ErrBadRequest)
	}

	// Multi-tenant: Resolve school_id
	schoolID := uuid.Nil
	if req.SchoolID != nil && *req.SchoolID != uuid.Nil {
		schoolID = *req.SchoolID
	} else if teacher.SchoolID.Valid {
		schoolID = uuid.UUID(teacher.SchoolID.Bytes)
	} else {
		// fallback to default facility
		schoolID = uuid.MustParse("a0000000-0000-0000-0000-000000000001")
	}

	class, err := s.queries.CreateClass(ctx, database.CreateClassParams{
		Name:         req.Name,
		GradeLevel:   req.GradeLevel,
		TeacherID:    targetTeacherID,
		AcademicYear: req.AcademicYear,
		SchoolID:     schoolID,
	})
	if err != nil {
		return ClassDTO{}, fmt.Errorf("%w: failed to create class", ErrInternalServer)
	}

	return ClassDTO{
		ID:           class.ID,
		Name:         class.Name,
		GradeLevel:   class.GradeLevel,
		TeacherID:    class.TeacherID,
		AcademicYear: class.AcademicYear,
		SchoolID:     class.SchoolID,
		CreatedAt:    class.CreatedAt.Time,
	}, nil
}

func textToPtr(t pgtype.Text) *string {
	if !t.Valid {
		return nil
	}
	s := t.String
	return &s
}

func ptrToText(s *string) pgtype.Text {
	if s == nil || strings.TrimSpace(*s) == "" {
		return pgtype.Text{Valid: false}
	}
	return pgtype.Text{String: strings.TrimSpace(*s), Valid: true}
}

func schoolModelToDTO(sc database.School) SchoolDTO {
	nameMy := textToPtr(sc.NameMy)
	nameEn := textToPtr(sc.NameEn)
	displayName := sc.Name
	if nameMy != nil && *nameMy != "" {
		displayName = *nameMy
	}

	return SchoolDTO{
		ID:              sc.ID,
		Name:            displayName,
		NameEn:          nameEn,
		NameMy:          nameMy,
		Code:            sc.Code,
		Address:         sc.Address,
		City:            sc.City,
		Region:          sc.Region,
		Phone:           sc.Phone,
		Status:          sc.Status,
		PCodeSR:         textToPtr(sc.PcodeSr),
		PCodeTS:         textToPtr(sc.PcodeTs),
		PCodeWardVT:     textToPtr(sc.PcodeWardVt),
		PCodeLevel:      textToPtr(sc.PcodeLevel),
		TownshipName:    textToPtr(sc.TownshipName),
		WardVillageName: textToPtr(sc.WardVillageName),
		SchoolCategory:  textToPtr(sc.SchoolCategory),
		CreatedAt:       sc.CreatedAt.Time,
	}
}

func pcodeModelToDTO(p database.MimuPcode) PCodeDTO {
	return PCodeDTO{
		PCode:       p.Pcode,
		ParentPCode: textToPtr(p.ParentPcode),
		AdminLevel:  int(p.AdminLevel),
		NameEn:      p.NameEn,
		NameMy:      p.NameMy,
		SRPCode:     textToPtr(p.SrPcode),
		TSPCode:     textToPtr(p.TsPcode),
		PCodeType:   p.PcodeType,
	}
}

// CreateSchool provisions a new school tenant
func (s *Service) CreateSchool(ctx context.Context, req CreateSchoolRequest) (SchoolDTO, error) {
	req.Name = strings.TrimSpace(req.Name)
	req.Code = strings.TrimSpace(strings.ToUpper(req.Code))
	req.City = strings.TrimSpace(req.City)
	req.Region = strings.TrimSpace(req.Region)

	// If Code is not provided, auto-generate Option A: {pcode_ward_vt}-{category}01
	if req.Code == "" && req.PCodeWardVT != nil && *req.PCodeWardVT != "" {
		cat := "HS"
		if req.SchoolCategory != nil && *req.SchoolCategory != "" {
			cat = strings.ToUpper(strings.TrimSpace(*req.SchoolCategory))
		}
		req.Code = fmt.Sprintf("%s-%s01", strings.TrimSpace(*req.PCodeWardVT), cat)
	}

	if req.Name == "" || req.Code == "" || req.City == "" || req.Region == "" {
		return SchoolDTO{}, fmt.Errorf("%w: name, code, city, and region are required", ErrBadRequest)
	}
	status := strings.TrimSpace(strings.ToLower(req.Status))
	if status == "" {
		status = "active"
	}

	school, err := s.queries.CreateSchool(ctx, database.CreateSchoolParams{
		Name:            req.Name,
		Code:            req.Code,
		Address:         strings.TrimSpace(req.Address),
		City:            req.City,
		Region:          req.Region,
		Phone:           strings.TrimSpace(req.Phone),
		Status:          status,
		PcodeSr:         ptrToText(req.PCodeSR),
		PcodeTs:         ptrToText(req.PCodeTS),
		PcodeWardVt:     ptrToText(req.PCodeWardVT),
		PcodeLevel:      ptrToText(req.PCodeLevel),
		TownshipName:    ptrToText(req.TownshipName),
		WardVillageName: ptrToText(req.WardVillageName),
		SchoolCategory:  ptrToText(req.SchoolCategory),
		NameEn:          ptrToText(req.NameEn),
		NameMy:          ptrToText(req.NameMy),
	})
	if err != nil {
		return SchoolDTO{}, fmt.Errorf("%w: failed to create school: %v", ErrInternalServer, err)
	}

	return schoolModelToDTO(school), nil
}

// GetSchool retrieves a school by ID
func (s *Service) GetSchool(ctx context.Context, id uuid.UUID) (SchoolDTO, error) {
	school, err := s.queries.GetSchoolByID(ctx, id)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return SchoolDTO{}, fmt.Errorf("%w: school not found", ErrNotFound)
		}
		return SchoolDTO{}, fmt.Errorf("%w: failed to fetch school", ErrInternalServer)
	}

	return schoolModelToDTO(school), nil
}

// ListSchools lists all schools (for backwards compatibility / sysadmin oversight)
func (s *Service) ListSchools(ctx context.Context) ([]SchoolDTO, error) {
	schools, err := s.queries.ListSchools(ctx)
	if err != nil {
		return nil, fmt.Errorf("%w: failed to list schools", ErrInternalServer)
	}

	res := make([]SchoolDTO, 0, len(schools))
	for _, sc := range schools {
		res = append(res, schoolModelToDTO(sc))
	}
	return res, nil
}

// ListSchoolsPaginated lists schools with server-side pagination, search, and MIMU filter queries
func (s *Service) ListSchoolsPaginated(ctx context.Context, params ListSchoolsParams) (*PaginatedSchoolsResponse, error) {
	page := params.Page
	if page < 1 {
		page = 1
	}
	limit := params.Limit
	if limit < 1 {
		limit = 20
	}
	if limit > 100 {
		limit = 100
	}
	offset := (page - 1) * limit

	searchTrim := strings.TrimSpace(params.Search)
	regionTrim := strings.TrimSpace(params.Region)
	if strings.ToLower(regionTrim) == "all" {
		regionTrim = ""
	}
	catTrim := strings.TrimSpace(params.Category)
	if strings.ToLower(catTrim) == "all" {
		catTrim = ""
	}
	srTrim := strings.TrimSpace(params.PCodeSR)
	tsTrim := strings.TrimSpace(params.PCodeTS)

	searchParam := pgtype.Text{String: searchTrim, Valid: searchTrim != ""}
	regionParam := pgtype.Text{String: regionTrim, Valid: regionTrim != ""}
	srParam := pgtype.Text{String: srTrim, Valid: srTrim != ""}
	tsParam := pgtype.Text{String: tsTrim, Valid: tsTrim != ""}
	catParam := pgtype.Text{String: catTrim, Valid: catTrim != ""}

	totalCount, err := s.queries.CountSchoolsFiltered(ctx, database.CountSchoolsFilteredParams{
		Search:   searchParam,
		Region:   regionParam,
		PcodeSr:  srParam,
		PcodeTs:  tsParam,
		Category: catParam,
	})
	if err != nil {
		return nil, fmt.Errorf("%w: failed to count schools: %v", ErrInternalServer, err)
	}

	schools, err := s.queries.ListSchoolsPaginated(ctx, database.ListSchoolsPaginatedParams{
		Limit:    int32(limit),
		Offset:   int32(offset),
		Search:   searchParam,
		Region:   regionParam,
		PcodeSr:  srParam,
		PcodeTs:  tsParam,
		Category: catParam,
	})
	if err != nil {
		return nil, fmt.Errorf("%w: failed to list paginated schools: %v", ErrInternalServer, err)
	}

	totalPages := 1
	if totalCount > 0 {
		totalPages = int(math.Ceil(float64(totalCount) / float64(limit)))
	}

	res := make([]SchoolDTO, 0, len(schools))
	for _, sc := range schools {
		res = append(res, schoolModelToDTO(sc))
	}

	return &PaginatedSchoolsResponse{
		Data: res,
		Pagination: PaginationMeta{
			Total:      totalCount,
			Page:       page,
			Limit:      limit,
			TotalPages: totalPages,
		},
	}, nil
}

// ListStateRegions returns all Level 1 State/Regions from MIMU P-Code dataset
func (s *Service) ListStateRegions(ctx context.Context) ([]PCodeDTO, error) {
	pcodes, err := s.queries.ListStateRegions(ctx)
	if err != nil {
		return nil, fmt.Errorf("%w: failed to list state/regions", ErrInternalServer)
	}
	res := make([]PCodeDTO, 0, len(pcodes))
	for _, p := range pcodes {
		res = append(res, pcodeModelToDTO(p))
	}
	return res, nil
}

// ListTownships returns all Level 3 Townships for a State/Region
func (s *Service) ListTownships(ctx context.Context, srPcode string) ([]PCodeDTO, error) {
	pcodes, err := s.queries.ListTownshipsBySR(ctx, pgtype.Text{String: srPcode, Valid: srPcode != ""})
	if err != nil {
		return nil, fmt.Errorf("%w: failed to list townships", ErrInternalServer)
	}
	res := make([]PCodeDTO, 0, len(pcodes))
	for _, p := range pcodes {
		res = append(res, pcodeModelToDTO(p))
	}
	return res, nil
}

// ListWards returns all Level 4 Wards / Village Tracts for a Township
func (s *Service) ListWards(ctx context.Context, tsPcode string) ([]PCodeDTO, error) {
	pcodes, err := s.queries.ListWardsByTownship(ctx, pgtype.Text{String: tsPcode, Valid: tsPcode != ""})
	if err != nil {
		return nil, fmt.Errorf("%w: failed to list wards", ErrInternalServer)
	}
	res := make([]PCodeDTO, 0, len(pcodes))
	for _, p := range pcodes {
		res = append(res, pcodeModelToDTO(p))
	}
	return res, nil
}

// SearchPCodes searches MIMU P-Codes by query string
func (s *Service) SearchPCodes(ctx context.Context, query string) ([]PCodeDTO, error) {
	pcodes, err := s.queries.SearchPCodes(ctx, pgtype.Text{String: query, Valid: query != ""})
	if err != nil {
		return nil, fmt.Errorf("%w: failed to search pcodes", ErrInternalServer)
	}
	res := make([]PCodeDTO, 0, len(pcodes))
	for _, p := range pcodes {
		res = append(res, pcodeModelToDTO(p))
	}
	return res, nil
}

// GetClass fetches a class by its ID
func (s *Service) GetClass(ctx context.Context, classID uuid.UUID) (ClassDTO, error) {
	class, err := s.queries.GetClassByID(ctx, classID)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return ClassDTO{}, fmt.Errorf("%w: class not found", ErrNotFound)
		}
		return ClassDTO{}, fmt.Errorf("%w: failed to fetch class", ErrInternalServer)
	}

	return ClassDTO{
		ID:           class.ID,
		Name:         class.Name,
		GradeLevel:   class.GradeLevel,
		TeacherID:    class.TeacherID,
		AcademicYear: class.AcademicYear,
		SchoolID:     class.SchoolID,
		CreatedAt:    class.CreatedAt.Time,
	}, nil
}

// ListClasses returns all classes or classes scoped by school / teacher
func (s *Service) ListClasses(ctx context.Context, schoolID *uuid.UUID, teacherID *uuid.UUID) ([]ClassDTO, error) {
	var classes []database.Class
	var err error

	if teacherID != nil {
		classes, err = s.queries.ListClassesByTeacher(ctx, *teacherID)
	} else if schoolID != nil && *schoolID != uuid.Nil {
		classes, err = s.queries.ListClassesBySchool(ctx, *schoolID)
	} else {
		classes, err = s.queries.ListClasses(ctx)
	}

	if err != nil {
		return nil, fmt.Errorf("%w: failed to list classes", ErrInternalServer)
	}

	result := make([]ClassDTO, 0, len(classes))
	for _, c := range classes {
		result = append(result, ClassDTO{
			ID:           c.ID,
			Name:         c.Name,
			GradeLevel:   c.GradeLevel,
			TeacherID:    c.TeacherID,
			AcademicYear: c.AcademicYear,
			SchoolID:     c.SchoolID,
			CreatedAt:    c.CreatedAt.Time,
		})
	}
	return result, nil
}

// SeedDefaultClasses provisions default KG and Grade 1 to Grade 12 (with Section A and Section B)
// registered strictly under the specified school facility.
func (s *Service) SeedDefaultClasses(ctx context.Context, schoolID uuid.UUID, academicYear string) ([]ClassDTO, error) {
	if schoolID == uuid.Nil {
		return nil, fmt.Errorf("%w: valid school_id is required", ErrBadRequest)
	}
	if academicYear == "" {
		academicYear = "2026-2027"
	}

	// Verify school exists
	_, err := s.queries.GetSchoolByID(ctx, schoolID)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, fmt.Errorf("%w: school facility not found", ErrNotFound)
		}
		return nil, fmt.Errorf("%w: failed to verify school facility", ErrInternalServer)
	}

	// Determine assigned teacher ID
	assignedTeacherID := uuid.Nil

	// 1. Try finding an existing teacher in this school
	teachers, err := s.queries.ListUsersBySchoolAndRole(ctx, database.ListUsersBySchoolAndRoleParams{
		SchoolID: pgtype.UUID{Bytes: schoolID, Valid: true},
		Role:     "teacher",
	})
	if err == nil && len(teachers) > 0 {
		assignedTeacherID = teachers[0].ID
	}

	// 2. Try finding school_admin in this school
	if assignedTeacherID == uuid.Nil {
		admins, err := s.queries.ListUsersBySchoolAndRole(ctx, database.ListUsersBySchoolAndRoleParams{
			SchoolID: pgtype.UUID{Bytes: schoolID, Valid: true},
			Role:     "school_admin",
		})
		if err == nil && len(admins) > 0 {
			assignedTeacherID = admins[0].ID
		}
	}

	// 3. Try finding admin in this school
	if assignedTeacherID == uuid.Nil {
		admins, err := s.queries.ListUsersBySchoolAndRole(ctx, database.ListUsersBySchoolAndRoleParams{
			SchoolID: pgtype.UUID{Bytes: schoolID, Valid: true},
			Role:     "admin",
		})
		if err == nil && len(admins) > 0 {
			assignedTeacherID = admins[0].ID
		}
	}

	// 4. Fallback to any teacher or admin in system
	if assignedTeacherID == uuid.Nil {
		allTeachers, err := s.queries.ListUsersByRole(ctx, "teacher")
		if err == nil && len(allTeachers) > 0 {
			assignedTeacherID = allTeachers[0].ID
		} else {
			allUsers, err := s.queries.ListUsers(ctx)
			if err == nil && len(allUsers) > 0 {
				assignedTeacherID = allUsers[0].ID
			} else {
				return nil, fmt.Errorf("%w: no teacher or admin user found to assign classes", ErrBadRequest)
			}
		}
	}

	// Standard Myanmar Curriculum Grades: KG, Grade 1 to Grade 12
	grades := []string{
		"KG",
		"Grade 1",
		"Grade 2",
		"Grade 3",
		"Grade 4",
		"Grade 5",
		"Grade 6",
		"Grade 7",
		"Grade 8",
		"Grade 9",
		"Grade 10",
		"Grade 11",
		"Grade 12",
	}
	sections := []string{"Section A", "Section B"}

	existingClasses, err := s.queries.ListClassesBySchool(ctx, schoolID)
	if err != nil && !errors.Is(err, pgx.ErrNoRows) {
		return nil, fmt.Errorf("%w: failed to inspect existing classes", ErrInternalServer)
	}

	existingMap := make(map[string]bool)
	for _, c := range existingClasses {
		existingMap[c.GradeLevel+"::"+c.Name] = true
	}

	for _, g := range grades {
		for _, sec := range sections {
			name := fmt.Sprintf("%s - %s", g, sec)
			if existingMap[g+"::"+name] {
				continue
			}
			_, err := s.queries.CreateClass(ctx, database.CreateClassParams{
				Name:         name,
				GradeLevel:   g,
				TeacherID:    assignedTeacherID,
				AcademicYear: academicYear,
				SchoolID:     schoolID,
			})
			if err != nil {
				return nil, fmt.Errorf("%w: failed to seed %s: %v", ErrInternalServer, name, err)
			}
		}
	}

	return s.ListClasses(ctx, &schoolID, nil)
}

// DeleteClass deletes a class by ID
func (s *Service) DeleteClass(ctx context.Context, classID uuid.UUID) error {
	return s.queries.DeleteClass(ctx, classID)
}

// ListSchoolFaculty returns all teachers and school admins belonging to a school
func (s *Service) ListSchoolFaculty(ctx context.Context, schoolID uuid.UUID) ([]FacultyMemberDTO, error) {
	users, err := s.queries.ListUsersBySchool(ctx, pgtype.UUID{Bytes: schoolID, Valid: true})
	if err != nil {
		return nil, fmt.Errorf("%w: failed to query faculty", ErrInternalServer)
	}

	// Fetch classes to map assigned teachers
	classes, _ := s.queries.ListClassesBySchool(ctx, schoolID)
	assignedClassesMap := make(map[uuid.UUID][]string)
	for _, c := range classes {
		assignedClassesMap[c.TeacherID] = append(assignedClassesMap[c.TeacherID], c.Name)
	}

	schoolName := ""
	if sch, err := s.queries.GetSchoolByID(ctx, schoolID); err == nil {
		if sch.NameMy.Valid && sch.NameMy.String != "" {
			schoolName = sch.NameMy.String
		} else {
			schoolName = sch.Name
		}
	}

	result := make([]FacultyMemberDTO, 0)
	for _, u := range users {
		if u.Role == "teacher" || u.Role == "school_admin" || u.Role == "admin" {
			var sid *uuid.UUID
			if u.SchoolID.Valid {
				id := uuid.UUID(u.SchoolID.Bytes)
				sid = &id
			}
			result = append(result, FacultyMemberDTO{
				ID:              u.ID,
				Email:           u.Email,
				FullName:        u.FullName,
				Role:            u.Role,
				SchoolID:        sid,
				SchoolName:      schoolName,
				AssignedClasses: assignedClassesMap[u.ID],
			})
		}
	}
	return result, nil
}

// CreateTeacher creates a new teacher or faculty member under a school
func (s *Service) CreateTeacher(ctx context.Context, schoolID uuid.UUID, req CreateTeacherRequest) (FacultyMemberDTO, error) {
	req.FullName = strings.TrimSpace(req.FullName)
	req.Email = strings.TrimSpace(req.Email)
	if req.FullName == "" {
		return FacultyMemberDTO{}, fmt.Errorf("%w: teacher full name is required", ErrBadRequest)
	}
	if req.Email == "" {
		clean := strings.ToLower(strings.ReplaceAll(req.FullName, " ", "."))
		req.Email = fmt.Sprintf("%s.%s@edu.local", clean, schoolID.String()[:4])
	}
	password := req.Password
	if strings.TrimSpace(password) == "" {
		password = "Teacher123!"
	}
	hashBytes, err := bcrypt.GenerateFromPassword([]byte(password), bcrypt.DefaultCost)
	if err != nil {
		return FacultyMemberDTO{}, fmt.Errorf("%w: failed to hash password", ErrInternalServer)
	}

	role := "teacher"
	if req.Role == "school_admin" || req.Role == "admin" {
		role = req.Role
	}

	targetSchoolID := schoolID
	if req.SchoolID != nil && *req.SchoolID != uuid.Nil {
		targetSchoolID = *req.SchoolID
	}

	user, err := s.queries.CreateUser(ctx, database.CreateUserParams{
		Email:        req.Email,
		PasswordHash: string(hashBytes),
		FullName:     req.FullName,
		Role:         role,
		SchoolID:     pgtype.UUID{Bytes: targetSchoolID, Valid: true},
	})
	if err != nil {
		return FacultyMemberDTO{}, fmt.Errorf("%w: failed to create teacher: %v", ErrInternalServer, err)
	}

	schoolName := ""
	if sch, err := s.queries.GetSchoolByID(ctx, targetSchoolID); err == nil {
		if sch.NameMy.Valid && sch.NameMy.String != "" {
			schoolName = sch.NameMy.String
		} else {
			schoolName = sch.Name
		}
	}

	sid := targetSchoolID
	return FacultyMemberDTO{
		ID:              user.ID,
		Email:           user.Email,
		FullName:        user.FullName,
		Role:            user.Role,
		SchoolID:        &sid,
		SchoolName:      schoolName,
		AssignedClasses: []string{},
	}, nil
}

// UpdateTeacher updates a teacher's details or transfers them to another school
func (s *Service) UpdateTeacher(ctx context.Context, teacherID uuid.UUID, req UpdateTeacherRequest) (FacultyMemberDTO, error) {
	existing, err := s.queries.GetUserByID(ctx, teacherID)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return FacultyMemberDTO{}, fmt.Errorf("%w: teacher not found", ErrNotFound)
		}
		return FacultyMemberDTO{}, fmt.Errorf("%w: failed to get teacher", ErrInternalServer)
	}

	fullName := existing.FullName
	if req.FullName != nil && strings.TrimSpace(*req.FullName) != "" {
		fullName = strings.TrimSpace(*req.FullName)
	}

	email := existing.Email
	if req.Email != nil && strings.TrimSpace(*req.Email) != "" {
		email = strings.TrimSpace(*req.Email)
	}

	schoolID := existing.SchoolID
	if req.SchoolID != nil && *req.SchoolID != uuid.Nil {
		schoolID = pgtype.UUID{Bytes: *req.SchoolID, Valid: true}
	}

	updated, err := s.queries.UpdateUser(ctx, database.UpdateUserParams{
		ID:       teacherID,
		FullName: fullName,
		Email:    email,
		SchoolID: schoolID,
	})
	if err != nil {
		return FacultyMemberDTO{}, fmt.Errorf("%w: failed to update teacher: %v", ErrInternalServer, err)
	}

	var sid *uuid.UUID
	schoolName := ""
	if updated.SchoolID.Valid {
		id := uuid.UUID(updated.SchoolID.Bytes)
		sid = &id
		if sch, err := s.queries.GetSchoolByID(ctx, id); err == nil {
			if sch.NameMy.Valid && sch.NameMy.String != "" {
				schoolName = sch.NameMy.String
			} else {
				schoolName = sch.Name
			}
		}
	}

	var assignedClasses []string
	if sid != nil {
		classes, _ := s.queries.ListClassesBySchool(ctx, *sid)
		for _, c := range classes {
			if c.TeacherID == teacherID {
				assignedClasses = append(assignedClasses, c.Name)
			}
		}
	}

	return FacultyMemberDTO{
		ID:              updated.ID,
		Email:           updated.Email,
		FullName:        updated.FullName,
		Role:            updated.Role,
		SchoolID:        sid,
		SchoolName:      schoolName,
		AssignedClasses: assignedClasses,
	}, nil
}

// DeleteTeacher deletes a teacher user by ID
func (s *Service) DeleteTeacher(ctx context.Context, teacherID uuid.UUID) error {
	return s.queries.DeleteUser(ctx, teacherID)
}

// ListSchoolStudents returns all students belonging to a school with enrolled class & grade level
func (s *Service) ListSchoolStudents(ctx context.Context, schoolID uuid.UUID) ([]SchoolStudentDTO, error) {
	rows, err := s.queries.ListStudentsBySchool(ctx, pgtype.UUID{Bytes: schoolID, Valid: true})
	if err != nil {
		return nil, fmt.Errorf("%w: failed to list students: %v", ErrInternalServer, err)
	}

	result := make([]SchoolStudentDTO, 0, len(rows))
	for _, r := range rows {
		var classID *uuid.UUID
		if r.ClassID.Valid {
			cid := uuid.UUID(r.ClassID.Bytes)
			classID = &cid
		}
		var className *string
		if r.ClassName.Valid && r.ClassName.String != "" {
			className = &r.ClassName.String
		}
		var gradeLevel *string
		if r.GradeLevel.Valid && r.GradeLevel.String != "" {
			gradeLevel = &r.GradeLevel.String
		}

		result = append(result, SchoolStudentDTO{
			ID:         r.ID,
			Email:      r.Email,
			FullName:   r.FullName,
			Role:       r.Role,
			SchoolID:   schoolID,
			SchoolName: r.SchoolName,
			ClassID:    classID,
			ClassName:  className,
			GradeLevel: gradeLevel,
			CreatedAt:  r.CreatedAt.Time,
		})
	}
	return result, nil
}

// CreateSchoolStudent creates a student user and optionally enrolls them into a class
func (s *Service) CreateSchoolStudent(ctx context.Context, schoolID uuid.UUID, req CreateSchoolStudentRequest) (SchoolStudentDTO, error) {
	req.FullName = strings.TrimSpace(req.FullName)
	if req.FullName == "" {
		return SchoolStudentDTO{}, fmt.Errorf("%w: student full name is required", ErrBadRequest)
	}
	email := strings.TrimSpace(req.Email)
	if email == "" {
		clean := strings.ToLower(strings.ReplaceAll(req.FullName, " ", "."))
		email = fmt.Sprintf("%s.%d@edu.local", clean, time.Now().UnixNano()%100000)
	}

	hashBytes, _ := bcrypt.GenerateFromPassword([]byte("Student123!"), bcrypt.DefaultCost)
	user, err := s.queries.CreateUser(ctx, database.CreateUserParams{
		Email:        email,
		PasswordHash: string(hashBytes),
		FullName:     req.FullName,
		Role:         "student",
		SchoolID:     pgtype.UUID{Bytes: schoolID, Valid: true},
	})
	if err != nil {
		return SchoolStudentDTO{}, fmt.Errorf("%w: failed to create student: %v", ErrInternalServer, err)
	}

	var classID *uuid.UUID
	var className *string
	var gradeLevel *string
	if req.ClassID != nil && *req.ClassID != uuid.Nil {
		class, err := s.queries.GetClassByID(ctx, *req.ClassID)
		if err == nil {
			_, _ = s.queries.CreateEnrollment(ctx, database.CreateEnrollmentParams{
				ClassID:   *req.ClassID,
				StudentID: user.ID,
			})
			classID = req.ClassID
			className = &class.Name
			gradeLevel = &class.GradeLevel
		}
	}

	schoolName := ""
	if sch, err := s.queries.GetSchoolByID(ctx, schoolID); err == nil {
		if sch.NameMy.Valid && sch.NameMy.String != "" {
			schoolName = sch.NameMy.String
		} else {
			schoolName = sch.Name
		}
	}

	return SchoolStudentDTO{
		ID:         user.ID,
		Email:      user.Email,
		FullName:   user.FullName,
		Role:       user.Role,
		SchoolID:   schoolID,
		SchoolName: schoolName,
		ClassID:    classID,
		ClassName:  className,
		GradeLevel: gradeLevel,
		CreatedAt:  user.CreatedAt.Time,
	}, nil
}

// SeedSampleStudents populates realistic sample students across KG to Grade 12 for a school
func (s *Service) SeedSampleStudents(ctx context.Context, schoolID uuid.UUID) ([]SchoolStudentDTO, error) {
	classes, err := s.queries.ListClassesBySchool(ctx, schoolID)
	if err != nil || len(classes) == 0 {
		_, _ = s.SeedDefaultClasses(ctx, schoolID, "2026-2027")
		classes, _ = s.queries.ListClassesBySchool(ctx, schoolID)
	}

	gradeToClasses := make(map[string][]database.Class)
	for _, c := range classes {
		gradeToClasses[c.GradeLevel] = append(gradeToClasses[c.GradeLevel], c)
	}

	type sampleStudent struct {
		grade string
		name  string
	}

	samples := []sampleStudent{
		{grade: "KG", name: "မောင်ဇွဲမာန်"},
		{grade: "KG", name: "မအိမ့်ချစ်သူ"},
		{grade: "Grade 1", name: "မောင်ဟိန်းထက်"},
		{grade: "Grade 1", name: "မခင်သီတာ"},
		{grade: "Grade 2", name: "မောင်ရဲလင်း"},
		{grade: "Grade 2", name: "မနှင်းဝေ"},
		{grade: "Grade 3", name: "မောင်ကောင်းဆက်"},
		{grade: "Grade 3", name: "မယမင်းသူ"},
		{grade: "Grade 4", name: "မောင်ဖြိုးဝေ"},
		{grade: "Grade 4", name: "မဆုမြတ်နိုး"},
		{grade: "Grade 5", name: "မောင်သီဟဇော်"},
		{grade: "Grade 5", name: "မအေးချမ်းမေ"},
		{grade: "Grade 6", name: "မောင်အောင်ကိုကို"},
		{grade: "Grade 6", name: "မပန်းအိဖြူ"},
		{grade: "Grade 7", name: "မောင်ကျော်ဇင်"},
		{grade: "Grade 7", name: "မနဒီလှိုင်"},
		{grade: "Grade 8", name: "မောင်ဇင်မင်းထွန်း"},
		{grade: "Grade 8", name: "မသန္တာအောင်"},
		{grade: "Grade 9", name: "မောင်မင်းခန့်"},
		{grade: "Grade 9", name: "မကြည်ဖြူဝင်း"},
		{grade: "Grade 10", name: "မောင်စည်သူ"},
		{grade: "Grade 10", name: "မခင်စန္ဒာ"},
		{grade: "Grade 11", name: "မောင်နေလင်းထွန်း"},
		{grade: "Grade 11", name: "မရွှေရည်ဝင်း"},
		{grade: "Grade 12", name: "မောင်ဝေယံဖြိုး"},
		{grade: "Grade 12", name: "မသုတထွေး"},
	}

	hashBytes, _ := bcrypt.GenerateFromPassword([]byte("Student123!"), bcrypt.DefaultCost)
	shortID := schoolID.String()[:5]

	for idx, samp := range samples {
		email := fmt.Sprintf("st.%s.%d.%d@edu.local", shortID, idx+1, time.Now().Unix()%100000)
		user, err := s.queries.CreateUser(ctx, database.CreateUserParams{
			Email:        email,
			PasswordHash: string(hashBytes),
			FullName:     samp.name,
			Role:         "student",
			SchoolID:     pgtype.UUID{Bytes: schoolID, Valid: true},
		})
		if err != nil {
			continue
		}

		if clList, ok := gradeToClasses[samp.grade]; ok && len(clList) > 0 {
			targetClass := clList[idx%len(clList)]
			_, _ = s.queries.CreateEnrollment(ctx, database.CreateEnrollmentParams{
				ClassID:   targetClass.ID,
				StudentID: user.ID,
			})
		}
	}

	return s.ListSchoolStudents(ctx, schoolID)
}

// DeleteStudent deletes a student user by ID
func (s *Service) DeleteStudent(ctx context.Context, studentID uuid.UUID) error {
	return s.queries.DeleteUser(ctx, studentID)
}

// GetStudentDetail returns comprehensive details of a student for drill-down views
func (s *Service) GetStudentDetail(ctx context.Context, studentID uuid.UUID) (StudentDetailDTO, error) {
	student, err := s.queries.GetUserByID(ctx, studentID)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return StudentDetailDTO{}, fmt.Errorf("%w: student not found", ErrNotFound)
		}
		return StudentDetailDTO{}, fmt.Errorf("%w: failed to fetch student", ErrInternalServer)
	}

	var schoolID *uuid.UUID
	schoolName := ""
	schoolCode := ""
	if student.SchoolID.Valid {
		sid := uuid.UUID(student.SchoolID.Bytes)
		schoolID = &sid
		if sch, err := s.queries.GetSchoolByID(ctx, sid); err == nil {
			if sch.NameMy.Valid && sch.NameMy.String != "" {
				schoolName = sch.NameMy.String
			} else {
				schoolName = sch.Name
			}
			schoolCode = sch.Code
		}
	}

	var classID *uuid.UUID
	className := ""
	gradeLevel := ""
	academicYear := ""
	classes, err := s.queries.ListClassesByStudentID(ctx, studentID)
	if err == nil && len(classes) > 0 {
		cid := classes[0].ID
		classID = &cid
		className = classes[0].Name
		gradeLevel = classes[0].GradeLevel
		academicYear = classes[0].AcademicYear
	}

	var parentID *uuid.UUID
	parentName := ""
	parentEmail := ""
	if student.ParentID.Valid {
		pid := uuid.UUID(student.ParentID.Bytes)
		parentID = &pid
		if p, err := s.queries.GetUserByID(ctx, pid); err == nil {
			parentName = p.FullName
			parentEmail = p.Email
		}
	}

	// Attempt to load overview, blockchain ID, whole-child profile
	var overview *StudentOverviewResponse
	if ov, err := s.GetStudentOverview(ctx, studentID); err == nil {
		overview = &ov
	}

	var blockchainID *StudentBlockchainIDResponse
	if bc, err := s.GetOrCreateStudentBlockchainID(ctx, studentID); err == nil {
		blockchainID = &bc
	}

	var wholeChild *WholeChildProfileDTO
	if wc, err := s.GetStudentWholeChildProfile(ctx, studentID, ""); err == nil {
		wholeChild = &wc
	}

	return StudentDetailDTO{
		ID:           student.ID,
		Email:        student.Email,
		FullName:     student.FullName,
		Role:         student.Role,
		SchoolID:     schoolID,
		SchoolName:   schoolName,
		SchoolCode:   schoolCode,
		ClassID:      classID,
		ClassName:    className,
		GradeLevel:   gradeLevel,
		AcademicYear: academicYear,
		ParentID:     parentID,
		ParentName:   parentName,
		ParentEmail:  parentEmail,
		CreatedAt:    student.CreatedAt.Time,
		Overview:     overview,
		BlockchainID: blockchainID,
		WholeChild:   wholeChild,
	}, nil
}



// EnrollStudent enrolls a student into a class
func (s *Service) EnrollStudent(ctx context.Context, classID, studentID uuid.UUID) error {
	// Verify class exists
	_, err := s.queries.GetClassByID(ctx, classID)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return fmt.Errorf("%w: class not found", ErrNotFound)
		}
		return fmt.Errorf("%w: failed to verify class", ErrInternalServer)
	}

	// Verify student exists and has 'student' role
	student, err := s.queries.GetUserByID(ctx, studentID)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return fmt.Errorf("%w: student not found", ErrNotFound)
		}
		return fmt.Errorf("%w: failed to verify student", ErrInternalServer)
	}
	if student.Role != "student" {
		return fmt.Errorf("%w: user is not a student (role: %s)", ErrBadRequest, student.Role)
	}

	_, err = s.queries.CreateEnrollment(ctx, database.CreateEnrollmentParams{
		ClassID:   classID,
		StudentID: studentID,
	})
	if err != nil {
		return fmt.Errorf("%w: failed to enroll student", ErrInternalServer)
	}

	return nil
}

// ListClassStudents returns the list of students enrolled in a class
func (s *Service) ListClassStudents(ctx context.Context, classID uuid.UUID) ([]StudentDTO, error) {
	// Verify class exists
	_, err := s.queries.GetClassByID(ctx, classID)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, fmt.Errorf("%w: class not found", ErrNotFound)
		}
		return nil, fmt.Errorf("%w: failed to verify class", ErrInternalServer)
	}

	students, err := s.queries.ListStudentsByClassID(ctx, classID)
	if err != nil {
		return nil, fmt.Errorf("%w: failed to fetch students", ErrInternalServer)
	}

	result := make([]StudentDTO, 0, len(students))
	for _, st := range students {
		result = append(result, StudentDTO{
			ID:         st.ID,
			Email:      st.Email,
			FullName:   st.FullName,
			Role:       st.Role,
			EnrolledAt: st.EnrolledAt.Time,
		})
	}
	return result, nil
}

// BatchRecordAttendance batch records or updates attendance for students in a class on a specific date
func (s *Service) BatchRecordAttendance(ctx context.Context, classID uuid.UUID, req BatchAttendanceRequest) (BatchAttendanceResponse, error) {
	// Verify class exists
	_, err := s.queries.GetClassByID(ctx, classID)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return BatchAttendanceResponse{}, fmt.Errorf("%w: class not found", ErrNotFound)
		}
		return BatchAttendanceResponse{}, fmt.Errorf("%w: failed to verify class", ErrInternalServer)
	}

	parsedDate, err := time.Parse("2006-01-02", strings.TrimSpace(req.Date))
	if err != nil {
		return BatchAttendanceResponse{}, fmt.Errorf("%w: invalid date format, expected YYYY-MM-DD", ErrBadRequest)
	}

	validStatuses := map[string]bool{
		"present": true,
		"absent":  true,
		"late":    true,
		"excused": true,
	}

	if len(req.Records) == 0 {
		return BatchAttendanceResponse{}, fmt.Errorf("%w: attendance records list cannot be empty", ErrBadRequest)
	}

	recorded := make([]AttendanceItem, 0, len(req.Records))
	pgDate := pgtype.Date{
		Time:  parsedDate,
		Valid: true,
	}

	for _, item := range req.Records {
		status := strings.ToLower(strings.TrimSpace(item.Status))
		if !validStatuses[status] {
			return BatchAttendanceResponse{}, fmt.Errorf("%w: invalid attendance status %q for student %s (allowed: present, absent, late, excused)", ErrBadRequest, item.Status, item.StudentID)
		}

		// Verify enrollment
		enrolled, err := s.queries.IsStudentEnrolled(ctx, database.IsStudentEnrolledParams{
			ClassID:   classID,
			StudentID: item.StudentID,
		})
		if err != nil {
			return BatchAttendanceResponse{}, fmt.Errorf("%w: failed to check student enrollment: %v", ErrInternalServer, err)
		}
		if !enrolled {
			return BatchAttendanceResponse{}, fmt.Errorf("%w: student %s is not enrolled in class %s", ErrBadRequest, item.StudentID, classID)
		}

		_, err = s.queries.UpsertAttendance(ctx, database.UpsertAttendanceParams{
			ClassID:   classID,
			StudentID: item.StudentID,
			Date:      pgDate,
			Status:    status,
			Notes:     strings.TrimSpace(item.Notes),
		})
		if err != nil {
			return BatchAttendanceResponse{}, fmt.Errorf("%w: failed to upsert attendance record for student %s: %v", ErrInternalServer, item.StudentID, err)
		}

		if status == "absent" {
			s.triggerAbsenceNotification(ctx, item.StudentID, classID, req.Date)
		}

		recorded = append(recorded, AttendanceItem{
			StudentID: item.StudentID,
			Status:    status,
			Notes:     strings.TrimSpace(item.Notes),
		})
	}

	return BatchAttendanceResponse{
		ClassID:       classID,
		Date:          req.Date,
		RecordedCount: len(recorded),
		Records:       recorded,
	}, nil
}

// GetAttendanceRoster returns all enrolled students in a class and their attendance status on the given date
func (s *Service) GetAttendanceRoster(ctx context.Context, classID uuid.UUID, dateStr string) (AttendanceRosterResponse, error) {
	// Verify class exists
	_, err := s.queries.GetClassByID(ctx, classID)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return AttendanceRosterResponse{}, fmt.Errorf("%w: class not found", ErrNotFound)
		}
		return AttendanceRosterResponse{}, fmt.Errorf("%w: failed to verify class", ErrInternalServer)
	}

	parsedDate, err := time.Parse("2006-01-02", strings.TrimSpace(dateStr))
	if err != nil {
		return AttendanceRosterResponse{}, fmt.Errorf("%w: invalid date format, expected YYYY-MM-DD", ErrBadRequest)
	}

	pgDate := pgtype.Date{
		Time:  parsedDate,
		Valid: true,
	}

	rows, err := s.queries.GetClassAttendanceRoster(ctx, database.GetClassAttendanceRosterParams{
		ClassID: classID,
		Date:    pgDate,
	})
	if err != nil {
		return AttendanceRosterResponse{}, fmt.Errorf("%w: failed to fetch attendance roster: %v", ErrInternalServer, err)
	}

	items := make([]AttendanceRosterItem, 0, len(rows))
	for _, r := range rows {
		var attID *uuid.UUID
		if r.AttendanceID.Valid {
			id := uuid.UUID(r.AttendanceID.Bytes)
			attID = &id
		}

		items = append(items, AttendanceRosterItem{
			StudentID:    r.StudentID,
			StudentName:  r.StudentName,
			StudentEmail: r.StudentEmail,
			AttendanceID: attID,
			Status:       r.Status,
			Notes:        r.Notes,
			Date:         dateStr,
		})
	}

	return AttendanceRosterResponse{
		ClassID: classID,
		Date:    dateStr,
		Total:   len(items),
		Roster:  items,
	}, nil
}

// CreateAssignment creates an assignment for a class
func (s *Service) CreateAssignment(ctx context.Context, classID uuid.UUID, req CreateAssignmentRequest) (AssignmentDTO, error) {
	// Verify class exists
	_, err := s.queries.GetClassByID(ctx, classID)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return AssignmentDTO{}, fmt.Errorf("%w: class not found", ErrNotFound)
		}
		return AssignmentDTO{}, fmt.Errorf("%w: failed to verify class", ErrInternalServer)
	}

	req.Title = strings.TrimSpace(req.Title)
	if req.Title == "" {
		return AssignmentDTO{}, fmt.Errorf("%w: title is required", ErrBadRequest)
	}
	if req.MaxScore <= 0 {
		req.MaxScore = 100
	}
	if req.DueDate.IsZero() {
		return AssignmentDTO{}, fmt.Errorf("%w: due_date is required", ErrBadRequest)
	}

	assignment, err := s.queries.CreateAssignment(ctx, database.CreateAssignmentParams{
		ClassID:     classID,
		Title:       req.Title,
		Description: strings.TrimSpace(req.Description),
		DueDate: pgtype.Timestamptz{
			Time:  req.DueDate,
			Valid: true,
		},
		MaxScore: req.MaxScore,
	})
	if err != nil {
		return AssignmentDTO{}, fmt.Errorf("%w: failed to create assignment", ErrInternalServer)
	}

	return AssignmentDTO{
		ID:          assignment.ID,
		ClassID:     assignment.ClassID,
		Title:       assignment.Title,
		Description: assignment.Description,
		DueDate:     assignment.DueDate.Time,
		MaxScore:    assignment.MaxScore,
		CreatedAt:   assignment.CreatedAt.Time,
	}, nil
}

// ListAssignments lists all assignments for a class
func (s *Service) ListAssignments(ctx context.Context, classID uuid.UUID) ([]AssignmentDTO, error) {
	// Verify class exists
	_, err := s.queries.GetClassByID(ctx, classID)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, fmt.Errorf("%w: class not found", ErrNotFound)
		}
		return nil, fmt.Errorf("%w: failed to verify class", ErrInternalServer)
	}

	assignments, err := s.queries.ListAssignmentsByClassID(ctx, classID)
	if err != nil {
		return nil, fmt.Errorf("%w: failed to fetch assignments", ErrInternalServer)
	}

	result := make([]AssignmentDTO, 0, len(assignments))
	for _, a := range assignments {
		result = append(result, AssignmentDTO{
			ID:          a.ID,
			ClassID:     a.ClassID,
			Title:       a.Title,
			Description: a.Description,
			DueDate:     a.DueDate.Time,
			MaxScore:    a.MaxScore,
			CreatedAt:   a.CreatedAt.Time,
		})
	}
	return result, nil
}

// SubmitAssignment allows a student to submit an assignment
func (s *Service) SubmitAssignment(ctx context.Context, assignmentID, studentID uuid.UUID) error {
	// Verify assignment exists
	assignment, err := s.queries.GetAssignmentByID(ctx, assignmentID)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return fmt.Errorf("%w: assignment not found", ErrNotFound)
		}
		return fmt.Errorf("%w: failed to fetch assignment", ErrInternalServer)
	}

	// Verify student enrollment in the assignment's class
	enrolled, err := s.queries.IsStudentEnrolled(ctx, database.IsStudentEnrolledParams{
		ClassID:   assignment.ClassID,
		StudentID: studentID,
	})
	if err != nil {
		return fmt.Errorf("%w: failed to check enrollment", ErrInternalServer)
	}
	if !enrolled {
		return fmt.Errorf("%w: student is not enrolled in this class", ErrForbidden)
	}

	status := "submitted"
	if time.Now().After(assignment.DueDate.Time) {
		status = "late"
	}

	_, err = s.queries.UpsertSubmission(ctx, database.UpsertSubmissionParams{
		AssignmentID: assignmentID,
		StudentID:    studentID,
		Status:       status,
	})
	if err != nil {
		return fmt.Errorf("%w: failed to record submission", ErrInternalServer)
	}

	return nil
}

var ErrForbidden = errors.New("forbidden")

// GradeSubmission allows a teacher to assign a grade and feedback to a submission
func (s *Service) GradeSubmission(ctx context.Context, submissionID uuid.UUID, grade float64, feedback string) error {
	if grade < 0 {
		return fmt.Errorf("%w: grade cannot be negative", ErrBadRequest)
	}

	// Convert grade to pgtype.Numeric
	var pgGrade pgtype.Numeric
	if err := pgGrade.Scan(fmt.Sprintf("%.2f", grade)); err != nil {
		return fmt.Errorf("%w: invalid grade format", ErrBadRequest)
	}

	_, err := s.queries.GradeSubmission(ctx, database.GradeSubmissionParams{
		ID:       submissionID,
		Grade:    pgGrade,
		Feedback: strings.TrimSpace(feedback),
	})
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return fmt.Errorf("%w: submission not found", ErrNotFound)
		}
		return fmt.Errorf("%w: failed to grade submission", ErrInternalServer)
	}

	return nil
}

// GetStudentOverview returns attendance summary and pending assignments for a student
func (s *Service) GetStudentOverview(ctx context.Context, studentID uuid.UUID) (StudentOverviewResponse, error) {
	// Verify student exists and role is student
	student, err := s.queries.GetUserByID(ctx, studentID)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return StudentOverviewResponse{}, fmt.Errorf("%w: student not found", ErrNotFound)
		}
		return StudentOverviewResponse{}, fmt.Errorf("%w: failed to verify student", ErrInternalServer)
	}
	if student.Role != "student" {
		return StudentOverviewResponse{}, fmt.Errorf("%w: user is not a student (role: %s)", ErrBadRequest, student.Role)
	}

	// Fetch attendance stats
	summaryRows, err := s.queries.GetStudentAttendanceSummary(ctx, studentID)
	if err != nil {
		return StudentOverviewResponse{}, fmt.Errorf("%w: failed to fetch attendance summary", ErrInternalServer)
	}

	var summary AttendanceSummary
	for _, row := range summaryRows {
		switch strings.ToLower(row.Status) {
		case "present":
			summary.Present += row.Count
		case "absent":
			summary.Absent += row.Count
		case "late":
			summary.Late += row.Count
		case "excused":
			summary.Excused += row.Count
		}
		summary.Total += row.Count
	}

	if summary.Total > 0 {
		// Attendance rate counts present + late attendance as attended days
		rate := (float64(summary.Present+summary.Late) / float64(summary.Total)) * 100.0
		summary.AttendanceRate = math.Round(rate*100) / 100
	}

	// Fetch pending assignments (assignments without a student submission)
	pendingRows, err := s.queries.ListPendingAssignmentsByStudentID(ctx, studentID)
	if err != nil {
		return StudentOverviewResponse{}, fmt.Errorf("%w: failed to fetch pending assignments", ErrInternalServer)
	}

	pending := make([]PendingAssignmentDTO, 0, len(pendingRows))
	for _, p := range pendingRows {
		pending = append(pending, PendingAssignmentDTO{
			ID:          p.ID,
			ClassID:     p.ClassID,
			ClassName:   p.ClassName,
			Title:       p.Title,
			Description: p.Description,
			DueDate:     p.DueDate.Time,
			MaxScore:    p.MaxScore,
			CreatedAt:   p.CreatedAt.Time,
		})
	}

	return StudentOverviewResponse{
		StudentID:          studentID,
		AttendanceSummary:  summary,
		PendingAssignments: pending,
	}, nil
}

// GetOrCreateStudentBlockchainID retrieves or provisions an immutable W3C Verifiable Credential for a student
func (s *Service) GetOrCreateStudentBlockchainID(ctx context.Context, studentID uuid.UUID) (StudentBlockchainIDResponse, error) {
	// 1. Verify student exists
	student, err := s.queries.GetUserByID(ctx, studentID)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return StudentBlockchainIDResponse{}, fmt.Errorf("%w: student not found", ErrNotFound)
		}
		return StudentBlockchainIDResponse{}, fmt.Errorf("%w: failed to fetch student", ErrInternalServer)
	}

	// 2. Check if a verifiable credential already exists
	existingVC, err := s.queries.GetVerifiableCredentialByStudentID(ctx, studentID)
	if err == nil {
		var schoolName, schoolCode, region, township string
		var issuerSchoolEn, issuerSchoolMy *string
		if student.SchoolID.Valid {
			if sc, errSc := s.queries.GetSchoolByID(ctx, student.SchoolID.Bytes); errSc == nil {
				schoolName = sc.Name
				if sc.NameMy.Valid && sc.NameMy.String != "" {
					schoolName = sc.NameMy.String
				}
				issuerSchoolEn = textToPtr(sc.NameEn)
				issuerSchoolMy = textToPtr(sc.NameMy)
				schoolCode = sc.Code
				region = sc.Region
				if sc.TownshipName.Valid {
					township = sc.TownshipName.String
				}
			}
		}

		var merkleRootPtr, polygonTxPtr *string
		if existingVC.MerkleRoot.Valid {
			s := existingVC.MerkleRoot.String
			merkleRootPtr = &s
		}
		if existingVC.PolygonTxHash.Valid {
			s := existingVC.PolygonTxHash.String
			polygonTxPtr = &s
		}

		anchorStatus := "unanchored"
		if existingVC.MerkleRoot.Valid && existingVC.PolygonTxHash.Valid {
			anchorStatus = "anchored"
		} else if existingVC.MerkleRoot.Valid {
			anchorStatus = "pending"
		}

		var rawCred interface{}
		_ = json.Unmarshal(existingVC.RawCredentialJson, &rawCred)

		var merkleProof interface{}
		_ = json.Unmarshal(existingVC.MerkleProof, &merkleProof)

		var bAddr, pubK string
		if student.BlockchainAddress.Valid {
			bAddr = student.BlockchainAddress.String
		}
		if student.PublicKey.Valid {
			pubK = student.PublicKey.String
		}

		return StudentBlockchainIDResponse{
			StudentID:        studentID,
			StudentName:      student.FullName,
			StudentEmail:     student.Email,
			DID:              existingVC.Did,
			BlockchainAddr:   bAddr,
			PublicKey:        pubK,
			CredentialHash:   existingVC.CredentialHash,
			MerkleRoot:       merkleRootPtr,
			MerkleProof:      merkleProof,
			PolygonTxHash:    polygonTxPtr,
			AnchorStatus:     anchorStatus,
			IssuerSchool:     schoolName,
			IssuerSchoolEn:   issuerSchoolEn,
			IssuerSchoolMy:   issuerSchoolMy,
			SchoolCode:       schoolCode,
			Region:           region,
			Township:         township,
			RawCredential:    rawCred,
			DigitalSignature: existingVC.Signature,
			IssuedAt:         existingVC.IssuedAt.Time,
			IsRevoked:        existingVC.IsRevoked,
		}, nil
	}

	// 3. Generate fresh cryptographic keys & DID
	kp, err := identity.GenerateKeyPair()
	if err != nil {
		return StudentBlockchainIDResponse{}, fmt.Errorf("%w: failed to generate keypair: %v", ErrInternalServer, err)
	}

	var school database.School
	if student.SchoolID.Valid {
		school, err = s.queries.GetSchoolByID(ctx, student.SchoolID.Bytes)
		if err != nil {
			return StudentBlockchainIDResponse{}, fmt.Errorf("%w: failed to fetch school: %v", ErrInternalServer, err)
		}
	} else {
		// Fallback school facility
		school = database.School{
			ID:     uuid.New(),
			Name:   "National Education Registry",
			Code:   "MMR013001001-BEHS01",
			Region: "Yangon Region",
		}
	}

	regionCode := "MMR013"
	if school.PcodeSr.Valid {
		regionCode = school.PcodeSr.String
	}
	townshipName := "Dagon"
	if school.TownshipName.Valid {
		townshipName = school.TownshipName.String
	}

	// Deterministic seq number from last 4 bytes of student UUID
	seqVal := int(studentID[14])<<8 | int(studentID[15])
	if seqVal == 0 {
		seqVal = 1
	}

	did := identity.FormatStudentDID(regionCode, school.Code, fmt.Sprintf("%d", time.Now().Year()), seqVal)

	// In real-world deployment, the school's private key is stored in HSM/Vault.
	// Here we generate or use deterministic authority seed derived from school Code
	schoolSeed := sha256.Sum256([]byte("edu-school-authority-signing-key:" + school.Code))
	schoolPriv := ed25519.NewKeyFromSeed(schoolSeed[:])

	vc, hashHex, err := identity.IssueStudentCredential(
		studentID,
		did,
		fmt.Sprintf("ROLL-%04d", seqVal),
		school.Code,
		school.Name,
		school.Region,
		townshipName,
		fmt.Sprintf("%d-%d", time.Now().Year(), time.Now().Year()+1),
		kp.PublicKeyHex,
		schoolPriv,
	)
	if err != nil {
		return StudentBlockchainIDResponse{}, fmt.Errorf("%w: failed to issue credential: %v", ErrInternalServer, err)
	}

	vcJSON, _ := json.Marshal(vc)

	// Save to verifiable_credentials table
	savedVC, err := s.queries.CreateVerifiableCredential(ctx, database.CreateVerifiableCredentialParams{
		StudentID: studentID,
		IssuerSchoolID: pgtype.UUID{
			Bytes: [16]byte(school.ID),
			Valid: true,
		},
		Did:               did,
		CredentialType:    "StudentIdentityCredential",
		CredentialHash:    hashHex,
		RawCredentialJson: vcJSON,
		Signature:         vc.Proof.ProofValue,
	})
	if err != nil {
		return StudentBlockchainIDResponse{}, fmt.Errorf("%w: failed to save credential: %v", ErrInternalServer, err)
	}

	// Update user record
	_ = s.queries.UpdateUserBlockchainIdentity(ctx, database.UpdateUserBlockchainIdentityParams{
		ID: studentID,
		Did: pgtype.Text{
			String: did,
			Valid:  true,
		},
		BlockchainAddress: pgtype.Text{
			String: kp.EthAddress,
			Valid:  true,
		},
		PublicKey: pgtype.Text{
			String: kp.PublicKeyHex,
			Valid:  true,
		},
		CredentialHash: pgtype.Text{
			String: hashHex,
			Valid:  true,
		},
		AnchorStatus: pgtype.Text{
			String: "unanchored",
			Valid:  true,
		},
	})

	var rawCred interface{}
	_ = json.Unmarshal(vcJSON, &rawCred)

	issuerSchool := school.Name
	if school.NameMy.Valid && school.NameMy.String != "" {
		issuerSchool = school.NameMy.String
	}

	return StudentBlockchainIDResponse{
		StudentID:        studentID,
		StudentName:      student.FullName,
		StudentEmail:     student.Email,
		DID:              did,
		BlockchainAddr:   kp.EthAddress,
		PublicKey:        kp.PublicKeyHex,
		CredentialHash:   hashHex,
		AnchorStatus:     "unanchored",
		IssuerSchool:     issuerSchool,
		IssuerSchoolEn:   textToPtr(school.NameEn),
		IssuerSchoolMy:   textToPtr(school.NameMy),
		SchoolCode:       school.Code,
		Region:           school.Region,
		Township:         townshipName,
		RawCredential:    rawCred,
		DigitalSignature: vc.Proof.ProofValue,
		IssuedAt:         savedVC.IssuedAt.Time,
		IsRevoked:        false,
	}, nil
}

// VerifyStudentCredential independently verifies a student DID or credential hash without login
func (s *Service) VerifyStudentCredential(ctx context.Context, identifier string) (VerificationResult, error) {
	identifier = strings.TrimSpace(identifier)
	if identifier == "" {
		return VerificationResult{}, fmt.Errorf("%w: identifier is required", ErrBadRequest)
	}

	var vc database.VerifiableCredential
	var err error

	if strings.HasPrefix(identifier, "did:edu:") {
		vc, err = s.queries.GetVerifiableCredentialByDID(ctx, identifier)
	} else {
		vc, err = s.queries.GetVerifiableCredentialByHash(ctx, identifier)
	}

	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return VerificationResult{
				IsValid:          false,
				Message:          "Credential not found in registry",
				VerificationTime: time.Now().UTC(),
			}, nil
		}
		return VerificationResult{}, fmt.Errorf("%w: database error: %v", ErrInternalServer, err)
	}

	var rawVC identity.VerifiableCredential
	if err := json.Unmarshal(vc.RawCredentialJson, &rawVC); err != nil {
		return VerificationResult{}, fmt.Errorf("%w: corrupted credential json: %v", ErrInternalServer, err)
	}

	// Determine Credential Type and Trust Model
	credType := vc.CredentialType
	if credType == "" {
		credType = "StudentIdentityCredential"
	}

	// Step 2: High-Stakes vs Daily Student Identity Credential
	// Only final high school completion diplomas and national university degrees require on-chain Polygon L2 Merkle proof.
	// Daily student ID cards use W3C did:web Standard PKI (zero gas, no blockchain dependency, 100% offline capable).
	isHighStakes := strings.EqualFold(credType, "HighSchoolDiploma") ||
		strings.EqualFold(credType, "GraduationCertificate") ||
		strings.EqualFold(credType, "Diploma") ||
		strings.EqualFold(credType, "OfficialTranscript") ||
		strings.EqualFold(credType, "NationalDegree")

	trustModel := "did_web_pki"
	networkName := "W3C did:web (PKI)"
	if isHighStakes {
		trustModel = "polygon_l2_merkle"
		networkName = "Polygon Amoy (L2)"
	}

	issuerDID := fmt.Sprintf("did:web:moe.gov.mm:schools:%s", rawVC.CredentialSubject.SchoolCode)
	publicKeyURL := "https://moe.gov.mm/.well-known/did.json"

	// Verify School Signature
	schoolCode := rawVC.CredentialSubject.SchoolCode
	schoolSeed := sha256.Sum256([]byte("edu-school-authority-signing-key:" + schoolCode))
	schoolPub := ed25519.NewKeyFromSeed(schoolSeed[:]).Public().(ed25519.PublicKey)

	sigValid, _ := identity.VerifyCredentialSignature(&rawVC, schoolPub)

	// Verify Merkle Proof (Required for High-Stakes Diplomas, optional audit for daily cards)
	merkleValid := false
	if vc.MerkleRoot.Valid {
		if strings.EqualFold(vc.CredentialHash, vc.MerkleRoot.String) {
			merkleValid = true
		} else if len(vc.MerkleProof) > 0 {
			var proofs []identity.MerkleProof
			if errProof := json.Unmarshal(vc.MerkleProof, &proofs); errProof == nil && len(proofs) > 0 {
				merkleValid = identity.VerifyMerkleProof(vc.CredentialHash, vc.MerkleRoot.String, proofs)
			}
		}
	}

	// Overall valid evaluation:
	var isValid bool
	var msg string

	if isHighStakes {
		isValid = sigValid && !vc.IsRevoked && (vc.MerkleRoot.Valid && merkleValid)
		if vc.IsRevoked {
			msg = fmt.Sprintf("Diploma REVOKED by authority: %s", vc.RevocationReason.String)
		} else if !sigValid {
			msg = "Signature verification failed: diploma data may have been altered"
		} else if !vc.MerkleRoot.Valid || !merkleValid {
			msg = "High-Stakes Diploma requires Polygon L2 Merkle proof, but on-chain anchor is missing or invalid"
		} else {
			msg = "Diploma is authentic, independently verified via Layer-2 Polygon Blockchain Merkle Anchor"
		}
	} else {
		isValid = sigValid && !vc.IsRevoked
		if vc.IsRevoked {
			msg = fmt.Sprintf("Student ID REVOKED by authority: %s", vc.RevocationReason.String)
		} else if !sigValid {
			msg = "Signature verification failed: student ID data may have been altered"
		} else {
			msg = "Student ID is authentic and verified via W3C did:web Standard PKI (Ministry of Education)"
		}
	}

	var mRoot, polyTx string
	if vc.MerkleRoot.Valid {
		mRoot = vc.MerkleRoot.String
	}
	if vc.PolygonTxHash.Valid {
		polyTx = vc.PolygonTxHash.String
	}

	studentName := rawVC.CredentialSubject.StudentID
	if vc.StudentID != uuid.Nil {
		if u, err := s.queries.GetUserByID(ctx, vc.StudentID); err == nil && u.FullName != "" {
			studentName = u.FullName
		}
	}

	return VerificationResult{
		IsValid:          isValid,
		IsRevoked:        vc.IsRevoked,
		SignatureValid:   sigValid,
		MerkleProofValid: merkleValid,
		DID:              vc.Did,
		StudentName:      studentName,
		SchoolName:       rawVC.CredentialSubject.SchoolName,
		SchoolCode:       rawVC.CredentialSubject.SchoolCode,
		CredentialHash:   vc.CredentialHash,
		CredentialType:   credType,
		TrustModel:       trustModel,
		IssuerDID:        issuerDID,
		PublicKeyURL:     publicKeyURL,
		MerkleRoot:       mRoot,
		PolygonTxHash:    polyTx,
		Network:          networkName,
		VerificationTime: time.Now().UTC(),
		Message:          msg,
	}, nil
}

// GetMoeDIDDocument generates the official W3C did:web:moe.gov.mm DID Resolution Document
func (s *Service) GetMoeDIDDocument(ctx context.Context) identity.DIDDocument {
	schoolCodes := []string{"MMR013035-BEHS01", "MMR013001001-BEHS01", "MMR013034-PV02"}
	if schools, err := s.queries.ListSchools(ctx); err == nil {
		for _, sc := range schools {
			if sc.Code != "" {
				schoolCodes = append(schoolCodes, sc.Code)
			}
		}
	}
	return identity.GenerateMoeDIDDocument(schoolCodes)
}

// BatchAnchorCredentials collects all unanchored credentials, creates a Merkle Tree, and anchors to Layer-2
func (s *Service) BatchAnchorCredentials(ctx context.Context, adminID uuid.UUID) (BatchAnchorResponse, error) {
	unanchored, err := s.queries.ListUnanchoredCredentials(ctx)
	if err != nil {
		return BatchAnchorResponse{}, fmt.Errorf("%w: failed to fetch unanchored credentials: %v", ErrInternalServer, err)
	}

	if len(unanchored) == 0 {
		return BatchAnchorResponse{
			MerkleRoot: "0x0000000000000000000000000000000000000000000000000000000000000000",
			BatchSize:  0,
			Network:    "Polygon Amoy (L2)",
			Status:     "nothing_to_anchor",
			AnchoredAt: time.Now().UTC(),
		}, nil
	}

	hashes := make([]string, len(unanchored))
	for i, c := range unanchored {
		hashes[i] = c.CredentialHash
	}

	root, proofs, err := identity.BuildMerkleTree(hashes)
	if err != nil {
		return BatchAnchorResponse{}, fmt.Errorf("%w: failed to build Merkle tree: %v", ErrInternalServer, err)
	}

	// Deterministic mock transaction hash simulating Polygon Amoy Layer-2 anchor
	txPayload := fmt.Sprintf("polygon-anchor:%s:%d", root, time.Now().UnixNano())
	txBytes := sha256.Sum256([]byte(txPayload))
	txHash := "0x" + hex.EncodeToString(txBytes[:])
	blockNumber := int64(14285700 + len(unanchored))
	contractAddr := "0x742d35Cc6634C0532925a3b844Bc454e4438f44e"

	now := time.Now().UTC()

	// Update each credential with its Merkle root & path
	for _, c := range unanchored {
		cProof := proofs[c.CredentialHash]
		proofJSON, _ := json.Marshal(cProof)

		_ = s.queries.UpdateCredentialAnchor(ctx, database.UpdateCredentialAnchorParams{
			ID: c.ID,
			MerkleRoot: pgtype.Text{
				String: root,
				Valid:  true,
			},
			MerkleProof: proofJSON,
			PolygonTxHash: pgtype.Text{
				String: txHash,
				Valid:  true,
			},
			PolygonBlockNumber: pgtype.Int8{
				Int64: blockNumber,
				Valid: true,
			},
		})

		_ = s.queries.UpdateUserAnchorStatus(ctx, database.UpdateUserAnchorStatusParams{
			ID: c.StudentID,
			AnchorStatus: pgtype.Text{
				String: "anchored",
				Valid:  true,
			},
			MerkleRoot: pgtype.Text{
				String: root,
				Valid:  true,
			},
			BlockchainTxHash: pgtype.Text{
				String: txHash,
				Valid:  true,
			},
		})
	}

	// Record in anchor_batches table
	_, _ = s.queries.CreateAnchorBatch(ctx, database.CreateAnchorBatchParams{
		MerkleRoot: root,
		BatchSize:  int32(len(unanchored)),
		Network:    "Polygon Amoy (L2)",
		ContractAddress: pgtype.Text{
			String: contractAddr,
			Valid:  true,
		},
		TxHash: pgtype.Text{
			String: txHash,
			Valid:  true,
		},
		BlockNumber: pgtype.Int8{
			Int64: blockNumber,
			Valid: true,
		},
		AnchoredBy: pgtype.UUID{
			Bytes: [16]byte(adminID),
			Valid: adminID != uuid.Nil,
		},
		Status: "anchored",
		AnchoredAt: pgtype.Timestamptz{
			Time:  now,
			Valid: true,
		},
	})

	return BatchAnchorResponse{
		MerkleRoot:      root,
		BatchSize:       len(unanchored),
		Network:         "Polygon Amoy (L2)",
		ContractAddress: contractAddr,
		TxHash:          txHash,
		Status:          "anchored",
		AnchoredAt:      now,
	}, nil
}

// ListChildrenByParent returns all students linked to a parent
func (s *Service) ListChildrenByParent(ctx context.Context, parentID uuid.UUID) ([]ChildDTO, error) {
	rows, err := s.queries.ListStudentsByParentID(ctx, pgtype.UUID{Bytes: [16]byte(parentID), Valid: true})
	if err != nil {
		return nil, fmt.Errorf("%w: failed to fetch children: %v", ErrInternalServer, err)
	}

	res := make([]ChildDTO, 0, len(rows))
	for _, r := range rows {
		var classIDPtr *uuid.UUID
		if r.ClassID.Valid {
			cid := uuid.UUID(r.ClassID.Bytes)
			classIDPtr = &cid
		}

		var merkleRootPtr *string
		if r.MerkleRoot.Valid {
			m := r.MerkleRoot.String
			merkleRootPtr = &m
		}

		var schoolID uuid.UUID
		if r.SchoolID.Valid {
			schoolID = uuid.UUID(r.SchoolID.Bytes)
		}

		res = append(res, ChildDTO{
			ID:             r.ID,
			FullName:       r.FullName,
			Email:          r.Email,
			Role:           r.Role,
			SchoolID:       schoolID,
			SchoolName:     r.SchoolName,
			SchoolNameEn:   textToPtr(r.SchoolNameEn),
			SchoolNameMy:   textToPtr(r.SchoolNameMy),
			SchoolCode:     r.SchoolCode.String,
			SchoolRegion:   r.SchoolRegion.String,
			SchoolTownship: r.SchoolTownship.String,
			ClassID:        classIDPtr,
			ClassName:      r.ClassName.String,
			GradeLevel:     r.GradeLevel.String,
			DID:            r.Did.String,
			BlockchainAddr: r.BlockchainAddress.String,
			CredentialHash: r.CredentialHash.String,
			MerkleRoot:     merkleRootPtr,
			AnchorStatus:   r.AnchorStatus.String,
		})
	}
	return res, nil
}

// IngestWholeChildBatch processes an offline sync bundle containing Whole-Child development records
func (s *Service) IngestWholeChildBatch(ctx context.Context, teacherID uuid.UUID, userSchoolID *uuid.UUID, payload WholeChildSyncPayload, syncMethod string) (WholeChildSyncResponse, error) {
	if len(payload.Students) == 0 {
		return WholeChildSyncResponse{}, fmt.Errorf("%w: sync payload contains no student records", ErrBadRequest)
	}

	// 1. Resolve School
	var schoolID uuid.UUID
	if payload.SyncMetadata.SchoolCode != "" {
		sch, err := s.queries.GetSchoolByCode(ctx, strings.TrimSpace(payload.SyncMetadata.SchoolCode))
		if err == nil {
			schoolID = sch.ID
		}
	}
	if schoolID == uuid.Nil && userSchoolID != nil && *userSchoolID != uuid.Nil {
		schoolID = *userSchoolID
	}
	if schoolID == uuid.Nil {
		return WholeChildSyncResponse{}, fmt.Errorf("%w: unable to identify school for sync", ErrBadRequest)
	}

	// 2. Resolve Class
	var classID uuid.UUID
	if payload.SyncMetadata.ClassID != "" {
		parsedClassID, err := uuid.Parse(payload.SyncMetadata.ClassID)
		if err == nil {
			classID = parsedClassID
		}
	}
	if classID == uuid.Nil {
		// Look up class by name or grade level in this school
		classes, err := s.queries.ListClassesBySchool(ctx, schoolID)
		if err == nil && len(classes) > 0 {
			for _, c := range classes {
				if strings.EqualFold(c.Name, payload.SyncMetadata.ClassName) || strings.EqualFold(c.GradeLevel, "Grade 5") {
					classID = c.ID
					break
				}
			}
			if classID == uuid.Nil {
				classID = classes[0].ID
			}
		}
	}

	if classID == uuid.Nil {
		return WholeChildSyncResponse{}, fmt.Errorf("%w: unable to resolve target class for sync", ErrBadRequest)
	}

	// 3. Compute or verify batch checksum
	rawPayloadBytes, err := json.Marshal(payload)
	if err != nil {
		return WholeChildSyncResponse{}, fmt.Errorf("%w: failed to serialize sync payload", ErrBadRequest)
	}
	checksum := strings.TrimSpace(payload.SyncMetadata.Checksum)
	if checksum == "" {
		h := sha256.Sum256(rawPayloadBytes)
		checksum = "sha256:" + hex.EncodeToString(h[:])
	}

	// Check idempotency: If this checksum was already processed, return existing status
	existingBatch, err := s.queries.GetOfflineSyncBatchByChecksum(ctx, checksum)
	if err == nil && existingBatch.ID != uuid.Nil {
		return WholeChildSyncResponse{
			BatchID:           existingBatch.ID,
			Checksum:          checksum,
			Status:            "already_processed",
			ProcessedStudents: int(existingBatch.TotalStudents),
			SyncedAt:          existingBatch.SyncedAt.Time,
			Message:           "Batch already ingested idempotently",
		}, nil
	}

	// 4. Ingest each student's 5-pillar profile
	period := strings.TrimSpace(payload.SyncMetadata.ReportingPeriod)
	if period == "" {
		period = time.Now().Format("2006-01")
	}
	academicYear := strings.TrimSpace(payload.SyncMetadata.AcademicYear)
	if academicYear == "" {
		academicYear = "2026-2027"
	}

	processedCount := 0
	for _, entry := range payload.Students {
		var targetStudentID uuid.UUID
		if entry.StudentID != "" {
			parsed, pErr := uuid.Parse(entry.StudentID)
			if pErr == nil {
				targetStudentID = parsed
			}
		}

		// Fallback: match by email or student DID
		if targetStudentID == uuid.Nil && entry.NationalStudentID != "" {
			user, uErr := s.queries.GetUserByEmail(ctx, entry.NationalStudentID)
			if uErr == nil {
				targetStudentID = user.ID
			}
		}

		if targetStudentID == uuid.Nil {
			// Try finding student by name within class enrollments
			enrolled, _ := s.queries.GetClassAttendanceRoster(ctx, database.GetClassAttendanceRosterParams{
				ClassID: classID,
				Date:    pgtype.Date{Time: time.Now(), Valid: true},
			})
			for _, stu := range enrolled {
				if strings.Contains(strings.ToLower(stu.StudentName), strings.ToLower(entry.FullName)) ||
					strings.Contains(strings.ToLower(entry.FullName), strings.ToLower(stu.StudentName)) {
					targetStudentID = stu.StudentID
					break
				}
			}
		}

		if targetStudentID == uuid.Nil {
			// If still not found, create student user record
			cleanEmail := fmt.Sprintf("%s.%s@edu.local", strings.ToLower(strings.ReplaceAll(entry.RollNo, "-", "")), schoolID.String()[:8])
			newStu, cErr := s.queries.CreateUser(ctx, database.CreateUserParams{
				Email:        cleanEmail,
				PasswordHash: "$2a$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy", // default 'mth'
				FullName:     entry.FullName,
				Role:         "student",
				SchoolID:     pgtype.UUID{Bytes: [16]byte(schoolID), Valid: true},
			})
			if cErr == nil {
				targetStudentID = newStu.ID
				_, _ = s.queries.CreateEnrollment(ctx, database.CreateEnrollmentParams{
					ClassID:   classID,
					StudentID: targetStudentID,
				})
			} else {
				continue
			}
		}

		// Extract attendance rate percentage
		var attPct float64 = 0.0
		if entry.AcademicProfile != nil {
			if attMap, ok := entry.AcademicProfile["attendance"].(map[string]interface{}); ok {
				if rate, exists := attMap["attendance_rate_pct"]; exists {
					switch v := rate.(type) {
					case float64:
						attPct = v
					case int:
						attPct = float64(v)
					}
				}
			}
		}

		acadJSON, _ := json.Marshal(entry.AcademicProfile)
		physJSON, _ := json.Marshal(entry.PhysicalGrowthProfile)
		healthJSON, _ := json.Marshal(entry.HealthVisibilityProfile)
		wellbeingJSON, _ := json.Marshal(entry.WellbeingProfile)
		socialJSON, _ := json.Marshal(entry.SocialCitizenshipProfile)

		var attNumeric pgtype.Numeric
		_ = attNumeric.Scan(fmt.Sprintf("%.2f", attPct))

		_, uErr := s.queries.UpsertWholeChildProfile(ctx, database.UpsertWholeChildProfileParams{
			StudentID:                targetStudentID,
			SchoolID:                 schoolID,
			ClassID:                  classID,
			AcademicYear:             academicYear,
			Period:                   period,
			AttendanceRatePct:        attNumeric,
			AcademicProfile:          acadJSON,
			PhysicalGrowthProfile:    physJSON,
			HealthVisibilityProfile:  healthJSON,
			WellbeingProfile:         wellbeingJSON,
			SocialCitizenshipProfile: socialJSON,
			SyncSource:               pgtype.Text{String: "offline_mobile_sync", Valid: true},
			SyncRecordHash:           pgtype.Text{String: entry.SyncRecordHash, Valid: entry.SyncRecordHash != ""},
		})
		if uErr == nil {
			processedCount++
		}
	}

	// 5. Record batch metadata in offline_sync_batches
	method := "direct_http"
	if syncMethod != "" {
		method = syncMethod
	}

	batchRecord, err := s.queries.CreateOfflineSyncBatch(ctx, database.CreateOfflineSyncBatchParams{
		BatchChecksum:   checksum,
		SchoolID:        schoolID,
		ClassID:         classID,
		TeacherID:       pgtype.UUID{Bytes: [16]byte(teacherID), Valid: teacherID != uuid.Nil},
		Period:          period,
		ProtocolVersion: payload.SyncMetadata.ProtocolVersion,
		TotalStudents:   int32(processedCount),
		RawPayload:      rawPayloadBytes,
		SyncMethod:      pgtype.Text{String: method, Valid: true},
	})
	if err != nil {
		return WholeChildSyncResponse{}, fmt.Errorf("%w: failed to save batch record: %v", ErrInternalServer, err)
	}

	return WholeChildSyncResponse{
		BatchID:           batchRecord.ID,
		Checksum:          checksum,
		Status:            "ingested",
		ProcessedStudents: processedCount,
		SyncedAt:          batchRecord.SyncedAt.Time,
		Message:           fmt.Sprintf("Successfully ingested %d Whole-Child profiles for %s", processedCount, period),
	}, nil
}

// ListClassWholeChildProfiles returns all student Whole-Child profiles for a class and period
func (s *Service) ListClassWholeChildProfiles(ctx context.Context, classID uuid.UUID, period string) ([]WholeChildProfileDTO, error) {
	if strings.TrimSpace(period) == "" {
		period = time.Now().Format("2006-01")
	}

	rows, err := s.queries.ListWholeChildProfilesByClassAndPeriod(ctx, database.ListWholeChildProfilesByClassAndPeriodParams{
		ClassID: classID,
		Period:  strings.TrimSpace(period),
	})
	if err != nil {
		return nil, fmt.Errorf("%w: failed to fetch whole child profiles: %v", ErrInternalServer, err)
	}

	dtos := make([]WholeChildProfileDTO, 0, len(rows))
	for _, r := range rows {
		var acad, phys, health, wellbeing, social map[string]interface{}
		_ = json.Unmarshal(r.AcademicProfile, &acad)
		_ = json.Unmarshal(r.PhysicalGrowthProfile, &phys)
		_ = json.Unmarshal(r.HealthVisibilityProfile, &health)
		_ = json.Unmarshal(r.WellbeingProfile, &wellbeing)
		_ = json.Unmarshal(r.SocialCitizenshipProfile, &social)

		var attRate float64
		if r.AttendanceRatePct.Valid {
			f, _ := r.AttendanceRatePct.Float64Value()
			attRate = f.Float64
		}

		dtos = append(dtos, WholeChildProfileDTO{
			ID:                       r.ID,
			StudentID:                r.StudentID,
			StudentName:              r.StudentName,
			StudentEmail:             r.StudentEmail,
			StudentDID:               textToPtr(r.StudentDid),
			SchoolID:                 r.SchoolID,
			ClassID:                  r.ClassID,
			AcademicYear:             r.AcademicYear,
			Period:                   r.Period,
			AttendanceRatePct:        attRate,
			AcademicProfile:          acad,
			PhysicalGrowthProfile:    phys,
			HealthVisibilityProfile:  health,
			WellbeingProfile:         wellbeing,
			SocialCitizenshipProfile: social,
			SyncSource:               r.SyncSource.String,
			SyncRecordHash:           textToPtr(r.SyncRecordHash),
			CreatedAt:                r.CreatedAt.Time,
			UpdatedAt:                r.UpdatedAt.Time,
		})
	}

	return dtos, nil
}

func mergeMaps(base, override map[string]interface{}) map[string]interface{} {
	result := make(map[string]interface{})
	for k, v := range base {
		result[k] = v
	}
	for k, v := range override {
		if v != nil {
			result[k] = v
		}
	}
	return result
}

// BatchSaveClassWholeChildProfiles saves or updates multiple students' Whole-Child profiles for a class
func (s *Service) BatchSaveClassWholeChildProfiles(ctx context.Context, classID uuid.UUID, req BatchSaveClassWholeChildRequest) (BatchSaveClassWholeChildResponse, error) {
	class, err := s.queries.GetClassByID(ctx, classID)
	if err != nil {
		return BatchSaveClassWholeChildResponse{}, fmt.Errorf("%w: class not found", ErrNotFound)
	}

	period := strings.TrimSpace(req.Period)
	if period == "" {
		period = time.Now().Format("2006-01")
	}
	academicYear := strings.TrimSpace(req.AcademicYear)
	if academicYear == "" {
		if class.AcademicYear != "" {
			academicYear = class.AcademicYear
		} else {
			academicYear = "2026-2027"
		}
	}

	updatedCount := 0
	for _, p := range req.Profiles {
		if p.StudentID == uuid.Nil {
			continue
		}

		var existingAcad, existingPhys, existingHealth, existingWell, existingSocial map[string]interface{}
		var existingAttPct float64 = 95.0

		existing, eErr := s.queries.GetWholeChildProfileByStudentAndPeriod(ctx, database.GetWholeChildProfileByStudentAndPeriodParams{
			StudentID: p.StudentID,
			Period:    period,
		})
		if eErr == nil {
			_ = json.Unmarshal(existing.AcademicProfile, &existingAcad)
			_ = json.Unmarshal(existing.PhysicalGrowthProfile, &existingPhys)
			_ = json.Unmarshal(existing.HealthVisibilityProfile, &existingHealth)
			_ = json.Unmarshal(existing.WellbeingProfile, &existingWell)
			_ = json.Unmarshal(existing.SocialCitizenshipProfile, &existingSocial)
			if existing.AttendanceRatePct.Valid {
				f, _ := existing.AttendanceRatePct.Float64Value()
				existingAttPct = f.Float64
			}
		} else {
			if latest, lErr := s.queries.GetLatestWholeChildProfileByStudent(ctx, p.StudentID); lErr == nil {
				_ = json.Unmarshal(latest.AcademicProfile, &existingAcad)
				_ = json.Unmarshal(latest.PhysicalGrowthProfile, &existingPhys)
				_ = json.Unmarshal(latest.HealthVisibilityProfile, &existingHealth)
				_ = json.Unmarshal(latest.WellbeingProfile, &existingWell)
				_ = json.Unmarshal(latest.SocialCitizenshipProfile, &existingSocial)
				if latest.AttendanceRatePct.Valid {
					f, _ := latest.AttendanceRatePct.Float64Value()
					existingAttPct = f.Float64
				}
			}
		}

		finalPhys := mergeMaps(existingPhys, p.PhysicalGrowthProfile)
		finalHealth := mergeMaps(existingHealth, p.HealthVisibilityProfile)
		finalWell := mergeMaps(existingWell, p.WellbeingProfile)
		finalSocial := mergeMaps(existingSocial, p.SocialCitizenshipProfile)
		finalAcad := mergeMaps(existingAcad, p.AcademicProfile)

		if p.AttendanceRatePct != nil {
			existingAttPct = *p.AttendanceRatePct
		}

		physBytes, _ := json.Marshal(finalPhys)
		healthBytes, _ := json.Marshal(finalHealth)
		wellBytes, _ := json.Marshal(finalWell)
		socialBytes, _ := json.Marshal(finalSocial)
		acadBytes, _ := json.Marshal(finalAcad)

		var attNumeric pgtype.Numeric
		_ = attNumeric.Scan(fmt.Sprintf("%.2f", existingAttPct))

		_, uErr := s.queries.UpsertWholeChildProfile(ctx, database.UpsertWholeChildProfileParams{
			StudentID:                p.StudentID,
			SchoolID:                 class.SchoolID,
			ClassID:                  classID,
			AcademicYear:             academicYear,
			Period:                   period,
			AttendanceRatePct:        attNumeric,
			AcademicProfile:          acadBytes,
			PhysicalGrowthProfile:    physBytes,
			HealthVisibilityProfile:  healthBytes,
			WellbeingProfile:         wellBytes,
			SocialCitizenshipProfile: socialBytes,
			SyncSource:               pgtype.Text{String: "teacher_sheet_entry", Valid: true},
			SyncRecordHash:           pgtype.Text{String: fmt.Sprintf("sheet_%s_%d", period, time.Now().Unix()), Valid: true},
		})
		if uErr == nil {
			updatedCount++
		}
	}

	return BatchSaveClassWholeChildResponse{
		UpdatedCount: updatedCount,
		Period:       period,
		Message:      fmt.Sprintf("Successfully updated %d Whole-Child profiles", updatedCount),
	}, nil
}

// GetStudentWholeChildProfile returns a single student's whole child profile
func (s *Service) GetStudentWholeChildProfile(ctx context.Context, studentID uuid.UUID, period string) (WholeChildProfileDTO, error) {
	if strings.TrimSpace(period) != "" {
		row, err := s.queries.GetWholeChildProfileByStudentAndPeriod(ctx, database.GetWholeChildProfileByStudentAndPeriodParams{
			StudentID: studentID,
			Period:    strings.TrimSpace(period),
		})
		if err != nil {
			if errors.Is(err, pgx.ErrNoRows) {
				return WholeChildProfileDTO{}, fmt.Errorf("%w: no whole child profile found for period %s", ErrNotFound, period)
			}
			return WholeChildProfileDTO{}, fmt.Errorf("%w: failed to fetch profile: %v", ErrInternalServer, err)
		}
		return mapStudentRowToDTO(row.ID, row.StudentID, row.StudentName, row.StudentEmail, row.StudentDid, row.SchoolID, row.ClassID, row.AcademicYear, row.Period, row.AttendanceRatePct, row.AcademicProfile, row.PhysicalGrowthProfile, row.HealthVisibilityProfile, row.WellbeingProfile, row.SocialCitizenshipProfile, row.SyncSource.String, row.SyncRecordHash, row.CreatedAt, row.UpdatedAt), nil
	}

	// Fetch latest
	row, err := s.queries.GetLatestWholeChildProfileByStudent(ctx, studentID)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return WholeChildProfileDTO{}, fmt.Errorf("%w: no whole child profile found for student", ErrNotFound)
		}
		return WholeChildProfileDTO{}, fmt.Errorf("%w: failed to fetch profile: %v", ErrInternalServer, err)
	}

	return mapStudentRowToDTO(row.ID, row.StudentID, row.StudentName, row.StudentEmail, row.StudentDid, row.SchoolID, row.ClassID, row.AcademicYear, row.Period, row.AttendanceRatePct, row.AcademicProfile, row.PhysicalGrowthProfile, row.HealthVisibilityProfile, row.WellbeingProfile, row.SocialCitizenshipProfile, row.SyncSource.String, row.SyncRecordHash, row.CreatedAt, row.UpdatedAt), nil
}

func mapStudentRowToDTO(id, studentID uuid.UUID, name, email string, did pgtype.Text, schoolID, classID uuid.UUID, academicYear, period string, att pgtype.Numeric, acadBytes, physBytes, healthBytes, wellBytes, socialBytes []byte, source string, syncHash pgtype.Text, created, updated pgtype.Timestamptz) WholeChildProfileDTO {
	var acad, phys, health, wellbeing, social map[string]interface{}
	_ = json.Unmarshal(acadBytes, &acad)
	_ = json.Unmarshal(physBytes, &phys)
	_ = json.Unmarshal(healthBytes, &health)
	_ = json.Unmarshal(wellBytes, &wellbeing)
	_ = json.Unmarshal(socialBytes, &social)

	var attRate float64
	if att.Valid {
		f, _ := att.Float64Value()
		attRate = f.Float64
	}

	return WholeChildProfileDTO{
		ID:                       id,
		StudentID:                studentID,
		StudentName:              name,
		StudentEmail:             email,
		StudentDID:               textToPtr(did),
		SchoolID:                 schoolID,
		ClassID:                  classID,
		AcademicYear:             academicYear,
		Period:                   period,
		AttendanceRatePct:        attRate,
		AcademicProfile:          acad,
		PhysicalGrowthProfile:    phys,
		HealthVisibilityProfile:  health,
		WellbeingProfile:         wellbeing,
		SocialCitizenshipProfile: social,
		SyncSource:               source,
		SyncRecordHash:           textToPtr(syncHash),
		CreatedAt:                created.Time,
		UpdatedAt:                updated.Time,
	}
}

// ListSyncBatches lists recent sync batches for a school
func (s *Service) ListSyncBatches(ctx context.Context, schoolID uuid.UUID, limit, offset int32) ([]database.OfflineSyncBatch, error) {
	if limit <= 0 {
		limit = 20
	}
	return s.queries.ListOfflineSyncBatchesBySchool(ctx, database.ListOfflineSyncBatchesBySchoolParams{
		SchoolID: schoolID,
		Limit:    limit,
		Offset:   offset,
	})
}

// triggerAbsenceNotification sends an urgent alert to the parent of an absent student
func (s *Service) triggerAbsenceNotification(ctx context.Context, studentID uuid.UUID, classID uuid.UUID, dateStr string) {
	go func() {
		bgCtx := context.Background()
		parent, err := s.queries.GetParentByStudentID(bgCtx, studentID)
		if err != nil {
			return // No linked parent found
		}

		st, err := s.queries.GetUserByID(bgCtx, studentID)
		if err != nil {
			return
		}

		cls, err := s.queries.GetClassByID(bgCtx, classID)
		if err != nil {
			return
		}

		title := fmt.Sprintf("Attendance Alert: %s Absent", st.FullName)
		body := fmt.Sprintf("%s was marked absent on %s in %s. Please check with your school if this was unexpected. (ကျောင်းပျက်ကွက်မှု သတိပေးချက်)", st.FullName, dateStr, cls.Name)

		payload, _ := json.Marshal(map[string]any{
			"student_id":   studentID.String(),
			"student_name": st.FullName,
			"class_id":     classID.String(),
			"class_name":   cls.Name,
			"date":         dateStr,
			"type":         "absence_alert",
		})

		notif, err := s.queries.CreateNotification(bgCtx, database.CreateNotificationParams{
			UserID: parent.ID,
			Type:   "absence_alert",
			Title:  title,
			Body:   body,
			Data:   payload,
		})
		if err == nil && s.notifier != nil {
			s.notifier.PublishNotification(bgCtx, notif)
		}
	}()
}

// CreateAnnouncement broadcasts an announcement to a class and notifies parents
func (s *Service) CreateAnnouncement(ctx context.Context, teacherID uuid.UUID, classID uuid.UUID, req CreateAnnouncementRequest) (AnnouncementDTO, error) {
	req.Title = strings.TrimSpace(req.Title)
	req.Content = strings.TrimSpace(req.Content)
	priority := strings.ToLower(strings.TrimSpace(req.Priority))
	if priority == "" {
		priority = "normal"
	}
	if req.Title == "" || req.Content == "" {
		return AnnouncementDTO{}, fmt.Errorf("%w: title and content are required", ErrBadRequest)
	}

	cls, err := s.queries.GetClassByID(ctx, classID)
	if err != nil {
		return AnnouncementDTO{}, fmt.Errorf("%w: class not found", ErrNotFound)
	}

	ann, err := s.queries.CreateAnnouncement(ctx, database.CreateAnnouncementParams{
		ClassID:   classID,
		TeacherID: teacherID,
		Title:     req.Title,
		Content:   req.Content,
		Priority:  priority,
	})
	if err != nil {
		return AnnouncementDTO{}, fmt.Errorf("%w: failed to create announcement: %v", ErrInternalServer, err)
	}

	teacher, _ := s.queries.GetUserByID(ctx, teacherID)

	// Fan out notification to all enrolled students' parents
	go func() {
		bgCtx := context.Background()
		parents, err := s.queries.ListParentsByClassID(bgCtx, classID)
		if err == nil {
			for _, p := range parents {
				title := fmt.Sprintf("Class Announcement: %s (%s)", req.Title, cls.Name)
				payload, _ := json.Marshal(map[string]any{
					"announcement_id": ann.ID.String(),
					"class_id":        classID.String(),
					"class_name":      cls.Name,
					"priority":        priority,
				})
				notif, err := s.queries.CreateNotification(bgCtx, database.CreateNotificationParams{
					UserID: p.ID,
					Type:   "announcement",
					Title:  title,
					Body:   req.Content,
					Data:   payload,
				})
				if err == nil && s.notifier != nil {
					s.notifier.PublishNotification(bgCtx, notif)
				}
			}
		}
	}()

	return AnnouncementDTO{
		ID:          ann.ID,
		ClassID:     ann.ClassID,
		TeacherID:   ann.TeacherID,
		TeacherName: teacher.FullName,
		ClassName:   cls.Name,
		Title:       ann.Title,
		Content:     ann.Content,
		Priority:    ann.Priority,
		CreatedAt:   ann.CreatedAt.Time,
	}, nil
}

// ListAnnouncements lists announcements for a specific class
func (s *Service) ListAnnouncements(ctx context.Context, classID uuid.UUID) ([]AnnouncementDTO, error) {
	rows, err := s.queries.ListAnnouncementsByClass(ctx, classID)
	if err != nil {
		return nil, fmt.Errorf("%w: failed to list announcements: %v", ErrInternalServer, err)
	}
	result := make([]AnnouncementDTO, 0, len(rows))
	for _, r := range rows {
		result = append(result, AnnouncementDTO{
			ID:          r.ID,
			ClassID:     r.ClassID,
			TeacherID:   r.TeacherID,
			TeacherName: r.TeacherName,
			ClassName:   r.ClassName,
			Title:       r.Title,
			Content:     r.Content,
			Priority:    r.Priority,
			CreatedAt:   r.CreatedAt.Time,
		})
	}
	return result, nil
}

// ListParentAnnouncements lists announcements for classes where the parent's children are enrolled
func (s *Service) ListParentAnnouncements(ctx context.Context, parentID uuid.UUID) ([]AnnouncementDTO, error) {
	rows, err := s.queries.ListAnnouncementsForParent(ctx, pgtype.UUID{Bytes: parentID, Valid: true})
	if err != nil {
		return nil, fmt.Errorf("%w: failed to list parent announcements: %v", ErrInternalServer, err)
	}
	result := make([]AnnouncementDTO, 0, len(rows))
	for _, r := range rows {
		stName := r.StudentName
		result = append(result, AnnouncementDTO{
			ID:          r.ID,
			ClassID:     r.ClassID,
			TeacherID:   r.TeacherID,
			TeacherName: r.TeacherName,
			ClassName:   r.ClassName,
			StudentName: &stName,
			Title:       r.Title,
			Content:     r.Content,
			Priority:    r.Priority,
			CreatedAt:   r.CreatedAt.Time,
		})
	}
	return result, nil
}

// GetOrCreateConversation creates or fetches a conversation between parent and teacher
func (s *Service) GetOrCreateConversation(ctx context.Context, callerID uuid.UUID, callerRole string, req CreateConversationRequest) (ConversationDTO, error) {
	var teacherID uuid.UUID
	var parentID uuid.UUID
	var studentID *uuid.UUID

	if req.StudentID != nil && *req.StudentID != uuid.Nil {
		studentID = req.StudentID
	}

	if callerRole == "teacher" {
		teacherID = callerID
		if req.ParentID != nil && *req.ParentID != uuid.Nil {
			parentID = *req.ParentID
		} else if studentID != nil {
			p, err := s.queries.GetParentByStudentID(ctx, *studentID)
			if err != nil {
				return ConversationDTO{}, fmt.Errorf("%w: parent not found for student", ErrNotFound)
			}
			parentID = p.ID
		} else {
			return ConversationDTO{}, fmt.Errorf("%w: parent_id or student_id is required", ErrBadRequest)
		}
	} else if callerRole == "parent" {
		parentID = callerID
		if req.TeacherID != nil && *req.TeacherID != uuid.Nil {
			teacherID = *req.TeacherID
		} else if studentID != nil {
			t, err := s.queries.GetTeacherByStudentID(ctx, *studentID)
			if err != nil {
				return ConversationDTO{}, fmt.Errorf("%w: teacher not found for student's class", ErrNotFound)
			}
			teacherID = t.ID
		} else {
			return ConversationDTO{}, fmt.Errorf("%w: teacher_id or student_id is required", ErrBadRequest)
		}
	} else {
		// Admin / Sysadmin
		if req.TeacherID == nil || req.ParentID == nil {
			return ConversationDTO{}, fmt.Errorf("%w: teacher_id and parent_id are required", ErrBadRequest)
		}
		teacherID = *req.TeacherID
		parentID = *req.ParentID
	}

	var pgStudentID pgtype.UUID
	if studentID != nil {
		pgStudentID = pgtype.UUID{Bytes: *studentID, Valid: true}
	}

	// Caller's school
	caller, _ := s.queries.GetUserByID(ctx, callerID)
	var schoolID pgtype.UUID
	if caller.SchoolID.Valid {
		schoolID = caller.SchoolID
	}

	conv, err := s.queries.CreateConversation(ctx, database.CreateConversationParams{
		SchoolID:  schoolID,
		TeacherID: teacherID,
		ParentID:  parentID,
		StudentID: pgStudentID,
	})
	if err != nil {
		return ConversationDTO{}, fmt.Errorf("%w: failed to create conversation: %v", ErrInternalServer, err)
	}

	return s.GetConversation(ctx, callerID, conv.ID)
}

// GetConversation fetches conversation details
func (s *Service) GetConversation(ctx context.Context, callerID uuid.UUID, convID uuid.UUID) (ConversationDTO, error) {
	row, err := s.queries.GetConversationByID(ctx, convID)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return ConversationDTO{}, fmt.Errorf("%w: conversation not found", ErrNotFound)
		}
		return ConversationDTO{}, fmt.Errorf("%w: failed to fetch conversation", ErrInternalServer)
	}

	var sID *uuid.UUID
	if row.StudentID.Valid {
		id := uuid.UUID(row.StudentID.Bytes)
		sID = &id
	}
	var scID *uuid.UUID
	if row.SchoolID.Valid {
		id := uuid.UUID(row.SchoolID.Bytes)
		scID = &id
	}

	return ConversationDTO{
		ID:              row.ID,
		SchoolID:        scID,
		TeacherID:       row.TeacherID,
		ParentID:        row.ParentID,
		StudentID:       sID,
		TeacherName:     row.TeacherName,
		TeacherEmail:    row.TeacherEmail,
		ParentName:      row.ParentName,
		ParentEmail:     row.ParentEmail,
		StudentName:     row.StudentName,
		LatestMessageAt: row.LastMessageAt.Time,
		CreatedAt:       row.CreatedAt.Time,
	}, nil
}

// ListUserConversations lists all conversations for a teacher or parent
func (s *Service) ListUserConversations(ctx context.Context, userID uuid.UUID) ([]ConversationDTO, error) {
	rows, err := s.queries.ListUserConversations(ctx, userID)
	if err != nil {
		return nil, fmt.Errorf("%w: failed to list conversations: %v", ErrInternalServer, err)
	}
	result := make([]ConversationDTO, 0, len(rows))
	for _, r := range rows {
		var sID *uuid.UUID
		if r.StudentID.Valid {
			id := uuid.UUID(r.StudentID.Bytes)
			sID = &id
		}
		var scID *uuid.UUID
		if r.SchoolID.Valid {
			id := uuid.UUID(r.SchoolID.Bytes)
			scID = &id
		}
		result = append(result, ConversationDTO{
			ID:                   r.ID,
			SchoolID:             scID,
			TeacherID:            r.TeacherID,
			ParentID:             r.ParentID,
			StudentID:            sID,
			TeacherName:          r.TeacherName,
			TeacherEmail:         r.TeacherEmail,
			ParentName:           r.ParentName,
			ParentEmail:          r.ParentEmail,
			StudentName:          r.StudentName,
			LatestMessageContent: r.LatestMessageContent,
			LatestMessageAt:      r.LatestMessageAt.Time,
			UnreadCount:          r.UnreadCount,
			CreatedAt:            r.CreatedAt.Time,
		})
	}
	return result, nil
}

// ListMessages fetches messages in a conversation and marks unread as read
func (s *Service) ListMessages(ctx context.Context, callerID uuid.UUID, convID uuid.UUID) ([]MessageDTO, error) {
	conv, err := s.queries.GetConversationByID(ctx, convID)
	if err != nil {
		return nil, fmt.Errorf("%w: conversation not found", ErrNotFound)
	}
	if conv.TeacherID != callerID && conv.ParentID != callerID {
		caller, _ := s.queries.GetUserByID(ctx, callerID)
		if caller.Role != "admin" && caller.Role != "sysadmin" {
			return nil, fmt.Errorf("%w: unauthorized to view conversation", ErrUnauthorized)
		}
	}

	_ = s.queries.MarkMessagesAsRead(ctx, database.MarkMessagesAsReadParams{
		ConversationID: convID,
		SenderID:       callerID,
	})

	rows, err := s.queries.ListMessagesByConversation(ctx, convID)
	if err != nil {
		return nil, fmt.Errorf("%w: failed to list messages: %v", ErrInternalServer, err)
	}

	result := make([]MessageDTO, 0, len(rows))
	for _, r := range rows {
		result = append(result, MessageDTO{
			ID:             r.ID,
			ConversationID: r.ConversationID,
			SenderID:       r.SenderID,
			SenderName:     r.SenderName,
			SenderRole:     r.SenderRole,
			Content:        r.Content,
			IsRead:         r.IsRead,
			CreatedAt:      r.CreatedAt.Time,
		})
	}
	return result, nil
}

// SendMessage sends a message in a conversation and triggers notification
func (s *Service) SendMessage(ctx context.Context, senderID uuid.UUID, convID uuid.UUID, content string) (MessageDTO, error) {
	content = strings.TrimSpace(content)
	if content == "" {
		return MessageDTO{}, fmt.Errorf("%w: message content cannot be empty", ErrBadRequest)
	}

	conv, err := s.queries.GetConversationByID(ctx, convID)
	if err != nil {
		return MessageDTO{}, fmt.Errorf("%w: conversation not found", ErrNotFound)
	}

	if conv.TeacherID != senderID && conv.ParentID != senderID {
		return MessageDTO{}, fmt.Errorf("%w: unauthorized to send message in this conversation", ErrUnauthorized)
	}

	msg, err := s.queries.CreateMessage(ctx, database.CreateMessageParams{
		ConversationID: convID,
		SenderID:       senderID,
		Content:        content,
	})
	if err != nil {
		return MessageDTO{}, fmt.Errorf("%w: failed to create message: %v", ErrInternalServer, err)
	}

	_ = s.queries.TouchConversation(ctx, convID)

	sender, _ := s.queries.GetUserByID(ctx, senderID)

	var recipientID uuid.UUID
	if senderID == conv.TeacherID {
		recipientID = conv.ParentID
	} else {
		recipientID = conv.TeacherID
	}

	go func() {
		bgCtx := context.Background()
		payload, _ := json.Marshal(map[string]any{
			"conversation_id": convID.String(),
			"sender_id":       senderID.String(),
			"sender_name":     sender.FullName,
			"student_name":    conv.StudentName,
		})
		notif, err := s.queries.CreateNotification(bgCtx, database.CreateNotificationParams{
			UserID: recipientID,
			Type:   "message",
			Title:  fmt.Sprintf("New message from %s", sender.FullName),
			Body:   content,
			Data:   payload,
		})
		if err == nil && s.notifier != nil {
			s.notifier.PublishNotification(bgCtx, notif)
		}
	}()

	return MessageDTO{
		ID:             msg.ID,
		ConversationID: msg.ConversationID,
		SenderID:       msg.SenderID,
		SenderName:     sender.FullName,
		SenderRole:     sender.Role,
		Content:        msg.Content,
		IsRead:         msg.IsRead,
		CreatedAt:      msg.CreatedAt.Time,
	}, nil
}

// ListNotifications lists notifications with unread count
func (s *Service) ListNotifications(ctx context.Context, userID uuid.UUID, limit, offset int) (NotificationListResponse, error) {
	if limit <= 0 {
		limit = 30
	}
	if offset < 0 {
		offset = 0
	}

	notifs, err := s.queries.ListNotificationsByUser(ctx, database.ListNotificationsByUserParams{
		UserID: userID,
		Limit:  int32(limit),
		Offset: int32(offset),
	})
	if err != nil {
		return NotificationListResponse{}, fmt.Errorf("%w: failed to list notifications: %v", ErrInternalServer, err)
	}

	unreadCount, err := s.queries.CountUnreadNotifications(ctx, userID)
	if err != nil {
		unreadCount = 0
	}

	list := make([]NotificationDTO, 0, len(notifs))
	for _, n := range notifs {
		var dataMap map[string]any
		if len(n.Data) > 0 {
			_ = json.Unmarshal(n.Data, &dataMap)
		}
		if dataMap == nil {
			dataMap = make(map[string]any)
		}
		list = append(list, NotificationDTO{
			ID:        n.ID,
			UserID:    n.UserID,
			Type:      n.Type,
			Title:     n.Title,
			Body:      n.Body,
			Data:      dataMap,
			IsRead:    n.IsRead,
			CreatedAt: n.CreatedAt.Time,
		})
	}

	return NotificationListResponse{
		Notifications: list,
		UnreadCount:   unreadCount,
	}, nil
}

// MarkNotificationRead marks a notification as read
func (s *Service) MarkNotificationRead(ctx context.Context, userID, notifID uuid.UUID) error {
	return s.queries.MarkNotificationAsRead(ctx, database.MarkNotificationAsReadParams{
		ID:     notifID,
		UserID: userID,
	})
}

// MarkAllNotificationsRead marks all notifications as read for a user
func (s *Service) MarkAllNotificationsRead(ctx context.Context, userID uuid.UUID) error {
	return s.queries.MarkAllNotificationsAsRead(ctx, userID)
}

func numericToFloatPtr(num pgtype.Numeric) *float64 {
	if !num.Valid {
		return nil
	}
	f, err := num.Float64Value()
	if err != nil || !f.Valid {
		return nil
	}
	val := f.Float64
	return &val
}

func floatPtrToNumeric(f *float64) pgtype.Numeric {
	var num pgtype.Numeric
	if f == nil {
		return num // num.Valid is false
	}
	_ = num.Scan(fmt.Sprintf("%.2f", *f))
	return num
}

// GetExamRoster returns all enrolled students in a class with their marks for a specified exam
func (s *Service) GetExamRoster(ctx context.Context, classID uuid.UUID, examName string) (*ExamRosterResponse, error) {
	cls, err := s.queries.GetClassByID(ctx, classID)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, fmt.Errorf("%w: class not found", ErrNotFound)
		}
		return nil, fmt.Errorf("%w: failed to fetch class", ErrInternalServer)
	}

	trimmedExam := strings.TrimSpace(examName)
	if trimmedExam == "" {
		trimmedExam = "ပထမနှစ်ဝက် စာမေးပွဲ (First Term Exam)"
	}

	// 1. Fetch available exams for the class
	distinctExams, _ := s.queries.ListDistinctExamsByClass(ctx, classID)
	available := make([]ExamSummaryInfo, 0, len(distinctExams))
	for _, de := range distinctExams {
		var lu *time.Time
		if t, ok := de.LastUpdated.(time.Time); ok {
			lu = &t
		}
		available = append(available, ExamSummaryInfo{
			ExamName:     de.ExamName,
			AcademicYear: de.AcademicYear,
			StudentCount: de.StudentCount,
			LastUpdated:  lu,
		})
	}

	// 2. Fetch roster with marks for this exam
	rows, err := s.queries.GetClassExamRoster(ctx, database.GetClassExamRosterParams{
		ClassID:  classID,
		ExamName: trimmedExam,
	})
	if err != nil {
		return nil, fmt.Errorf("%w: failed to fetch exam roster", ErrInternalServer)
	}

	roster := make([]ExamRosterItem, 0, len(rows))
	for _, r := range rows {
		var markID *uuid.UUID
		if r.ExamMarkID.Valid {
			u := uuid.UUID(r.ExamMarkID.Bytes)
			markID = &u
		}
		var updated *time.Time
		if r.UpdatedAt.Valid {
			updated = &r.UpdatedAt.Time
		}

		roster = append(roster, ExamRosterItem{
			StudentID:    r.StudentID,
			StudentName:  r.StudentName,
			StudentEmail: r.StudentEmail,
			ExamMarkID:   markID,
			ExamName:     r.ExamName,
			AcademicYear: r.AcademicYear,
			Myanmar:      numericToFloatPtr(r.Myanmar),
			English:      numericToFloatPtr(r.English),
			Maths:        numericToFloatPtr(r.Maths),
			Phy:          numericToFloatPtr(r.Phy),
			Chem:         numericToFloatPtr(r.Chem),
			Bio:          numericToFloatPtr(r.Bio),
			Geo:          numericToFloatPtr(r.Geo),
			His:          numericToFloatPtr(r.His),
			Eco:          numericToFloatPtr(r.Eco),
			Social:       numericToFloatPtr(r.Social),
			Remarks:      r.Remarks,
			UpdatedAt:    updated,
		})
	}

	return &ExamRosterResponse{
		ClassID:        classID,
		ClassName:      cls.Name,
		GradeLevel:     cls.GradeLevel,
		AcademicYear:   cls.AcademicYear,
		ExamName:       trimmedExam,
		AvailableExams: available,
		TotalStudents:  len(roster),
		Roster:         roster,
	}, nil
}

// BatchRecordExamMarks saves/upserts exam marks for multiple students in a class
func (s *Service) BatchRecordExamMarks(ctx context.Context, classID uuid.UUID, req BatchExamMarksRequest) (*BatchExamMarksResponse, error) {
	trimmedExam := strings.TrimSpace(req.ExamName)
	if trimmedExam == "" {
		return nil, fmt.Errorf("%w: exam_name is required", ErrBadRequest)
	}

	cls, err := s.queries.GetClassByID(ctx, classID)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, fmt.Errorf("%w: class not found", ErrNotFound)
		}
		return nil, fmt.Errorf("%w: failed to fetch class", ErrInternalServer)
	}

	academicYear := strings.TrimSpace(req.AcademicYear)
	if academicYear == "" {
		academicYear = cls.AcademicYear
	}
	if academicYear == "" {
		academicYear = "2026-2027"
	}

	recorded := make([]ExamMarkItem, 0, len(req.Records))
	for _, rec := range req.Records {
		if rec.StudentID == uuid.Nil {
			continue
		}

		_, err := s.queries.UpsertExamMark(ctx, database.UpsertExamMarkParams{
			ClassID:      classID,
			StudentID:    rec.StudentID,
			ExamName:     trimmedExam,
			AcademicYear: academicYear,
			Myanmar:      floatPtrToNumeric(rec.Myanmar),
			English:      floatPtrToNumeric(rec.English),
			Maths:        floatPtrToNumeric(rec.Maths),
			Phy:          floatPtrToNumeric(rec.Phy),
			Chem:         floatPtrToNumeric(rec.Chem),
			Bio:          floatPtrToNumeric(rec.Bio),
			Geo:          floatPtrToNumeric(rec.Geo),
			His:          floatPtrToNumeric(rec.His),
			Eco:          floatPtrToNumeric(rec.Eco),
			Social:       floatPtrToNumeric(rec.Social),
			Remarks:      strings.TrimSpace(rec.Remarks),
		})
		if err != nil {
			return nil, fmt.Errorf("%w: failed to save mark for student %s: %v", ErrInternalServer, rec.StudentID, err)
		}
		recorded = append(recorded, rec)
	}

	return &BatchExamMarksResponse{
		ClassID:       classID,
		ExamName:      trimmedExam,
		RecordedCount: len(recorded),
		Records:       recorded,
	}, nil
}

// ListClassExams returns all distinct exam names recorded for a class
func (s *Service) ListClassExams(ctx context.Context, classID uuid.UUID) ([]ExamSummaryInfo, error) {
	rows, err := s.queries.ListDistinctExamsByClass(ctx, classID)
	if err != nil {
		return nil, fmt.Errorf("%w: failed to list distinct exams", ErrInternalServer)
	}

	result := make([]ExamSummaryInfo, 0, len(rows))
	for _, r := range rows {
		var lu *time.Time
		if t, ok := r.LastUpdated.(time.Time); ok {
			lu = &t
		}
		result = append(result, ExamSummaryInfo{
			ExamName:     r.ExamName,
			AcademicYear: r.AcademicYear,
			StudentCount: r.StudentCount,
			LastUpdated:  lu,
		})
	}
	return result, nil
}

var (
	shiftConfigMu      sync.RWMutex
	schoolShiftConfigs = make(map[uuid.UUID][]ShiftConfigDTO)

	classTimetableMu sync.RWMutex
	classTimetables  = make(map[uuid.UUID]*ClassTimetableDTO)
)

// GetDefaultShiftConfigs returns default 3 Myanmar school shifts
func GetDefaultShiftConfigs(schoolID uuid.UUID) []ShiftConfigDTO {
	return []ShiftConfigDTO{
		{
			ID:           uuid.New(),
			SchoolID:     schoolID,
			ShiftType:    "full_day",
			Name:         "Full Day Section (8:00 AM - 4:00 PM)",
			NameMy:       "တစ်နေကုန် အဆိုင်း",
			StartTime:    "08:00",
			EndTime:      "16:00",
			TotalPeriods: 8,
			Description:  "Standard 8-period full day curriculum with midday lunch recess (12:00-13:00)",
			Active:       true,
		},
		{
			ID:           uuid.New(),
			SchoolID:     schoolID,
			ShiftType:    "morning",
			Name:         "Morning Section (8:00 AM - 12:30 PM)",
			NameMy:       "နံနက်ပိုင်း အဆိုင်း",
			StartTime:    "08:00",
			EndTime:      "12:30",
			TotalPeriods: 5,
			Description:  "Split morning shift for high enrollment facilities (5 periods)",
			Active:       true,
		},
		{
			ID:           uuid.New(),
			SchoolID:     schoolID,
			ShiftType:    "afternoon",
			Name:         "Afternoon / Evening Section (12:30 PM - 4:30 PM)",
			NameMy:       "ညနေပိုင်း အဆိုင်း",
			StartTime:    "12:30",
			EndTime:      "16:30",
			TotalPeriods: 5,
			Description:  "Split second group afternoon shift (5 periods)",
			Active:       true,
		},
	}
}

// GetSchoolShiftConfigs returns the teaching shifts configured for a school
func (s *Service) GetSchoolShiftConfigs(ctx context.Context, schoolID uuid.UUID) ([]ShiftConfigDTO, error) {
	shiftConfigMu.RLock()
	configs, exists := schoolShiftConfigs[schoolID]
	shiftConfigMu.RUnlock()

	if exists && len(configs) > 0 {
		return configs, nil
	}

	defaults := GetDefaultShiftConfigs(schoolID)
	shiftConfigMu.Lock()
	schoolShiftConfigs[schoolID] = defaults
	shiftConfigMu.Unlock()
	return defaults, nil
}

// SaveSchoolShiftConfigs persists updated shift configurations for a school
func (s *Service) SaveSchoolShiftConfigs(ctx context.Context, schoolID uuid.UUID, configs []ShiftConfigDTO) ([]ShiftConfigDTO, error) {
	shiftConfigMu.Lock()
	schoolShiftConfigs[schoolID] = configs
	shiftConfigMu.Unlock()
	return configs, nil
}

// GetClassTimetable returns the weekly timetable for a given class section
func (s *Service) GetClassTimetable(ctx context.Context, classID uuid.UUID) (*ClassTimetableDTO, error) {
	classTimetableMu.RLock()
	cached, exists := classTimetables[classID]
	classTimetableMu.RUnlock()

	if exists && cached != nil {
		return cached, nil
	}

	// Fetch class details from database
	cls, err := s.queries.GetClassByID(ctx, classID)
	className := "Class"
	gradeLevel := "Grade 8"
	academicYear := "2026-2027"
	if err == nil {
		className = cls.Name
		gradeLevel = cls.GradeLevel
		academicYear = cls.AcademicYear
	}

	// Generate default realistic Myanmar curriculum periods
	shiftType := "full_day"
	periods := generateDefaultPeriods(classID.String(), gradeLevel, shiftType)

	tt := &ClassTimetableDTO{
		ClassID:      classID,
		ClassName:    className,
		GradeLevel:   gradeLevel,
		ShiftType:    shiftType,
		AcademicYear: academicYear,
		Periods:      periods,
		UpdatedAt:    time.Now().UTC(),
	}

	classTimetableMu.Lock()
	classTimetables[classID] = tt
	classTimetableMu.Unlock()

	return tt, nil
}

// UpdateClassTimetable saves an updated timetable configured by the principal
func (s *Service) UpdateClassTimetable(ctx context.Context, req UpdateClassTimetableRequest) (*ClassTimetableDTO, error) {
	if req.ClassID == uuid.Nil {
		return nil, fmt.Errorf("%w: class ID is required", ErrBadRequest)
	}

	cls, _ := s.queries.GetClassByID(ctx, req.ClassID)
	className := "Class"
	gradeLevel := "Grade 8"
	academicYear := "2026-2027"
	if cls.ID != uuid.Nil {
		className = cls.Name
		gradeLevel = cls.GradeLevel
		academicYear = cls.AcademicYear
	}

	shiftType := req.ShiftType
	if shiftType == "" {
		shiftType = "full_day"
	}

	tt := &ClassTimetableDTO{
		ClassID:      req.ClassID,
		ClassName:    className,
		GradeLevel:   gradeLevel,
		ShiftType:    shiftType,
		AcademicYear: academicYear,
		Periods:      req.Periods,
		UpdatedAt:    time.Now().UTC(),
	}

	classTimetableMu.Lock()
	classTimetables[req.ClassID] = tt
	classTimetableMu.Unlock()

	return tt, nil
}

// PublishClassTimetable marks the timetable as officially published to students and guardians
func (s *Service) PublishClassTimetable(ctx context.Context, classID uuid.UUID) (*ClassTimetableDTO, error) {
	tt, err := s.GetClassTimetable(ctx, classID)
	if err != nil {
		return nil, err
	}
	tt.UpdatedAt = time.Now().UTC()

	classTimetableMu.Lock()
	classTimetables[classID] = tt
	classTimetableMu.Unlock()

	// Dispatch real-time push notification and in-app alert to all enrolled students and parents
	go func() {
		defer func() {
			if r := recover(); r != nil {
				log.Printf("[PublishClassTimetable] Notification dispatch recovered: %v", r)
			}
		}()
		bgCtx := context.Background()
		className := tt.ClassName
		if className == "" {
			cls, err := s.queries.GetClassByID(bgCtx, classID)
			if err == nil {
				className = cls.Name
			}
		}

		title := fmt.Sprintf("အတန်းချိန်ဇယား အသစ် ထုတ်ပြန်ပြီးပါပြီ (%s)", className)
		body := fmt.Sprintf("%s ၏ အပတ်စဉ် သင်ရိုးမာတိကာ အချိန်ဇယားကို ဆရာမှ အတည်ပြုထုတ်ပြန်လိုက်ပါပြီ။ Mobile App တွင် အချိန်ဇယားကို ရယူနိုင်ပါပြီ။", className)
		payload, _ := json.Marshal(map[string]any{
			"class_id":   classID.String(),
			"type":       "timetable_published",
			"action":     "sync_timetable",
			"updated_at": tt.UpdatedAt.Format(time.RFC3339),
		})

		// 1. Notify enrolled students
		students, err := s.queries.ListStudentsByClassID(bgCtx, classID)
		if err == nil {
			for _, st := range students {
				notif, err := s.queries.CreateNotification(bgCtx, database.CreateNotificationParams{
					UserID: st.ID,
					Type:   "timetable_published",
					Title:  title,
					Body:   body,
					Data:   payload,
				})
				if err == nil && s.notifier != nil {
					s.notifier.PublishNotification(bgCtx, notif)
				}
			}
		}

		// 2. Notify guardians/parents of the class
		parents, err := s.queries.ListParentsByClassID(bgCtx, classID)
		if err == nil {
			for _, p := range parents {
				notif, err := s.queries.CreateNotification(bgCtx, database.CreateNotificationParams{
					UserID: p.ID,
					Type:   "timetable_published",
					Title:  title,
					Body:   body,
					Data:   payload,
				})
				if err == nil && s.notifier != nil {
					s.notifier.PublishNotification(bgCtx, notif)
				}
			}
		}
	}()

	return tt, nil
}

// GetStudentTimetable returns the weekly curriculum timetable for a student's assigned class
func (s *Service) GetStudentTimetable(ctx context.Context, studentID uuid.UUID) (*ClassTimetableDTO, error) {
	// 1. Try to find the class the student is directly enrolled in
	classes, err := s.queries.ListClassesByStudentID(ctx, studentID)
	if err == nil && len(classes) > 0 {
		return s.GetClassTimetable(ctx, classes[0].ID)
	}

	// 2. Try looking up user profile to find their school
	user, err := s.queries.GetUserByID(ctx, studentID)
	if err == nil && user.SchoolID.Valid {
		schoolID := uuid.UUID(user.SchoolID.Bytes)
		schoolClasses, err := s.queries.ListClassesBySchool(ctx, schoolID)
		if err == nil && len(schoolClasses) > 0 {
			// Prefer Grade 8 or first available class in school
			for _, sc := range schoolClasses {
				if strings.Contains(strings.ToLower(sc.GradeLevel), "8") {
					return s.GetClassTimetable(ctx, sc.ID)
				}
			}
			return s.GetClassTimetable(ctx, schoolClasses[0].ID)
		}
	}

	// 3. Fallback: if there are any cached class timetables, return the first one
	classTimetableMu.RLock()
	for _, tt := range classTimetables {
		if tt != nil && len(tt.Periods) > 0 {
			classTimetableMu.RUnlock()
			return tt, nil
		}
	}
	classTimetableMu.RUnlock()

	// 4. Default: generate fallback timetable for Grade 8
	defaultClassID := uuid.New()
	return s.GetClassTimetable(ctx, defaultClassID)
}

func isGradeUpTo6(gradeLevel string) bool {
	gl := strings.ToLower(strings.TrimSpace(gradeLevel))
	if strings.Contains(gl, "kg") || strings.Contains(gl, "kindergarten") {
		return true
	}
	for i := 1; i <= 6; i++ {
		if i == 1 && (strings.Contains(gl, "10") || strings.Contains(gl, "11") || strings.Contains(gl, "12")) {
			continue
		}
		if strings.Contains(gl, fmt.Sprintf("grade %d", i)) ||
			strings.Contains(gl, fmt.Sprintf("grade-%d", i)) ||
			strings.Contains(gl, fmt.Sprintf("grade%d", i)) ||
			strings.Contains(gl, fmt.Sprintf("g%d", i)) ||
			strings.Contains(gl, fmt.Sprintf("%d", i)) {
			return true
		}
	}
	return false
}

func generateDefaultPeriods(classID string, gradeLevel string, shiftType string) []TimetablePeriodDTO {
	type subjectDef struct {
		name   string
		nameMy string
		code   string
		color  string
	}

	var coreSubjects []subjectDef
	if isGradeUpTo6(gradeLevel) {
		// Up to Grade 6: strictly 5 subjects in Myanmar Basic Education Curriculum:
		// မြန်မာ၊ အင်္ဂလိပ်၊ သင်္ချာ၊ သိပ္ပံ၊ လူမှုရေး
		coreSubjects = []subjectDef{
			{name: "Myanmar", nameMy: "မြန်မာစာ", code: "MYA-101", color: "#64748B"},
			{name: "English", nameMy: "အင်္ဂလိပ်စာ", code: "ENG-201", color: "#64748B"},
			{name: "Mathematics", nameMy: "သင်္ချာ", code: "MTH-301", color: "#64748B"},
			{name: "Science", nameMy: "သိပ္ပံ", code: "SCI-101", color: "#64748B"},
			{name: "Social Studies", nameMy: "လူမှုရေး", code: "SOC-101", color: "#64748B"},
		}
	} else {
		// Grade 7 and above: Middle & High school subjects
		coreSubjects = []subjectDef{
			{name: "Mathematics", nameMy: "သင်္ချာ", code: "MTH-301", color: "#64748B"},
			{name: "English", nameMy: "အင်္ဂလိပ်စာ", code: "ENG-201", color: "#64748B"},
			{name: "Myanmar", nameMy: "မြန်မာစာ", code: "MYA-101", color: "#64748B"},
			{name: "Physics / General Science", nameMy: "ရူပဗေဒ / သိပ္ပံ", code: "SCI-401", color: "#64748B"},
			{name: "Chemistry", nameMy: "ဓာတုဗေဒ", code: "CHM-402", color: "#64748B"},
			{name: "Biology", nameMy: "ဇီဝဗေဒ", code: "BIO-403", color: "#64748B"},
			{name: "Social Studies", nameMy: "လူမှုရေးသိပ္ပံ", code: "SOC-202", color: "#64748B"},
			{name: "Physical Education", nameMy: "ကာယပညာ", code: "PED-102", color: "#64748B"},
		}
	}

	fullDayHours := []struct {
		start string
		end   string
		idx   int
	}{
		{"08:00", "09:00", 1},
		{"09:00", "10:00", 2},
		{"10:00", "11:00", 3},
		{"11:00", "12:00", 4},
		{"13:00", "14:00", 5},
		{"14:00", "15:00", 6},
		{"15:00", "16:00", 7},
	}

	var periods []TimetablePeriodDTO
	for day := 1; day <= 5; day++ {
		for hIdx, slot := range fullDayHours {
			subj := coreSubjects[(day+hIdx)%len(coreSubjects)]
			periods = append(periods, TimetablePeriodDTO{
				ID:            fmt.Sprintf("per-%s-%d-%d", classID, day, slot.idx),
				ClassID:       classID,
				GradeLevel:    gradeLevel,
				Section:       "Section A",
				DayOfWeek:     day,
				StartTime:     slot.start,
				EndTime:       slot.end,
				PeriodIndex:   slot.idx,
				SubjectName:   subj.name,
				SubjectNameMy: subj.nameMy,
				SubjectCode:   subj.code,
				TeacherName:   "ဒေါ်လှလှဝင်း (Daw Hla Hla Win)",
				RoomNumber:    "Room 302",
				ColorHex:      subj.color,
				Topic:         fmt.Sprintf("Chapter %d: Core Curriculum Lesson", slot.idx),
				ShiftType:     shiftType,
			})
		}
	}

	return periods
}

// GetGateRoster exports a high-performance offline roster bundle for gate entrance kiosks
func (s *Service) GetGateRoster(ctx context.Context, schoolID *uuid.UUID) (GateRosterResponse, error) {
	var targetSchool database.School
	var err error

	if schoolID != nil && *schoolID != uuid.Nil {
		targetSchool, err = s.queries.GetSchoolByID(ctx, *schoolID)
		if err != nil {
			if errors.Is(err, pgx.ErrNoRows) {
				return GateRosterResponse{}, fmt.Errorf("%w: school not found", ErrNotFound)
			}
			return GateRosterResponse{}, fmt.Errorf("%w: failed to fetch school", ErrInternalServer)
		}
	} else {
		// Attempt to locate BEHS Intaing or first school
		schools, listErr := s.queries.ListSchools(ctx)
		if listErr != nil || len(schools) == 0 {
			return GateRosterResponse{}, fmt.Errorf("%w: no schools registered in system", ErrNotFound)
		}
		found := false
		for _, sc := range schools {
			if strings.Contains(sc.Code, "MMR013035") || strings.Contains(strings.ToLower(sc.Name), "intaing") {
				targetSchool = sc
				found = true
				break
			}
		}
		if !found {
			targetSchool = schools[0]
		}
	}

	students, err := s.queries.ListStudentsBySchool(ctx, pgtype.UUID{Bytes: targetSchool.ID, Valid: true})
	if err != nil {
		return GateRosterResponse{}, fmt.Errorf("%w: failed to list school students: %v", ErrInternalServer, err)
	}

	schoolNameMy := targetSchool.Name
	if targetSchool.NameMy.Valid && targetSchool.NameMy.String != "" {
		schoolNameMy = targetSchool.NameMy.String
	}

	regionCode := "MMR013"
	if targetSchool.PcodeSr.Valid && targetSchool.PcodeSr.String != "" {
		regionCode = targetSchool.PcodeSr.String
	}

	roster := make([]GateStudentDTO, 0, len(students))
	for _, st := range students {
		var did string
		vc, vcErr := s.queries.GetVerifiableCredentialByStudentID(ctx, st.ID)
		if vcErr == nil && vc.Did != "" {
			did = vc.Did
		} else {
			seqVal := int(st.ID[14])<<8 | int(st.ID[15])
			if seqVal == 0 {
				seqVal = 1
			}
			did = identity.FormatStudentDID(regionCode, targetSchool.Code, fmt.Sprintf("%d", time.Now().Year()), seqVal)
		}

		className := "Grade 5-A"
		if st.ClassName.Valid && st.ClassName.String != "" {
			className = st.ClassName.String
		}

		gradeLevel := "Grade 5 (Primary)"
		if st.GradeLevel.Valid && st.GradeLevel.String != "" {
			gradeLevel = st.GradeLevel.String
		}

		rollNo := st.Email
		if strings.Contains(rollNo, "@") {
			rollNo = strings.Split(rollNo, "@")[0]
		}

		var classIDPtr *uuid.UUID
		if st.ClassID.Valid {
			cid := uuid.UUID(st.ClassID.Bytes)
			classIDPtr = &cid
		}

		roster = append(roster, GateStudentDTO{
			ID:           st.ID,
			DID:          did,
			FullName:     st.FullName,
			FullNameMy:   st.FullName,
			RollNo:       rollNo,
			ClassID:      classIDPtr,
			ClassName:    className,
			GradeLevel:   gradeLevel,
			SchoolName:   targetSchool.Name,
			SchoolNameMy: schoolNameMy,
			SchoolCode:   targetSchool.Code,
			UpdatedAt:    st.CreatedAt.Time,
		})
	}

	return GateRosterResponse{
		SchoolID:    targetSchool.ID,
		SchoolCode:  targetSchool.Code,
		SchoolName:  schoolNameMy,
		TotalCount:  len(roster),
		Students:    roster,
		GeneratedAt: time.Now().UTC(),
	}, nil
}

// SyncAttendanceBatch processes queued offline attendance swipe events from gate kiosks
func (s *Service) SyncAttendanceBatch(ctx context.Context, req SyncAttendanceBatchRequest) (SyncAttendanceBatchResponse, error) {
	if len(req.Events) == 0 {
		return SyncAttendanceBatchResponse{
			SyncedCount: 0,
			FailedCount: 0,
			SyncedIDs:   []string{},
		}, nil
	}

	syncedIDs := make([]string, 0, len(req.Events))
	errs := make([]string, 0)

	for _, ev := range req.Events {
		var studentID uuid.UUID

		// 1. Resolve StudentID: accept a real UUID from the server roster,
		// otherwise fall back to the DID lookup. Offline demo kiosks send
		// human-readable ids like "student-demo-001" which are not UUIDs.
		if ev.StudentID != "" {
			if parsed, err := uuid.Parse(ev.StudentID); err == nil {
				studentID = parsed
			}
		}
		if studentID == uuid.Nil && ev.DID != "" {
			vc, err := s.queries.GetVerifiableCredentialByDID(ctx, ev.DID)
			if err == nil {
				studentID = vc.StudentID
			}
		}

		if studentID == uuid.Nil {
			errs = append(errs, fmt.Sprintf("Event %s: cannot resolve student from DID %s", ev.EventID, ev.DID))
			continue
		}

		// 2. Resolve ClassID
		var classID uuid.UUID
		if ev.ClassID != nil && *ev.ClassID != uuid.Nil {
			classID = *ev.ClassID
		} else {
			classes, err := s.queries.ListClassesByStudentID(ctx, studentID)
			if err == nil && len(classes) > 0 {
				classID = classes[0].ID
			} else {
				errs = append(errs, fmt.Sprintf("Event %s: student %s not enrolled in any class", ev.EventID, studentID))
				continue
			}
		}

		// 3. Resolve Date
		eventDate := strings.TrimSpace(ev.EventDate)
		if eventDate == "" && ev.ScannedAt != "" {
			if t, err := time.Parse(time.RFC3339, ev.ScannedAt); err == nil {
				eventDate = t.Format("2006-01-02")
			}
		}
		if eventDate == "" {
			eventDate = time.Now().Format("2006-01-02")
		}

		parsedDate, err := time.Parse("2006-01-02", eventDate)
		if err != nil {
			parsedDate = time.Now()
		}

		// 4. Resolve Status & Notes
		status := strings.ToLower(strings.TrimSpace(ev.Status))
		if status != "present" && status != "late" {
			status = "present"
		}

		scanMethod := ev.ScanMethod
		if scanMethod == "" {
			scanMethod = "nfc_tap"
		}
		timeDisp := ev.TimeDisplay
		if timeDisp == "" {
			timeDisp = time.Now().Format("15:04:05")
		}
		devID := ev.DeviceID
		if devID == "" {
			devID = req.DeviceID
		}
		if devID == "" {
			devID = "GATE-01"
		}

		notes := fmt.Sprintf("Gate swipe via %s at %s (Device: %s)", scanMethod, timeDisp, devID)

		// 5. Upsert Attendance
		_, err = s.queries.UpsertAttendance(ctx, database.UpsertAttendanceParams{
			ClassID:   classID,
			StudentID: studentID,
			Date: pgtype.Date{
				Time:  parsedDate,
				Valid: true,
			},
			Status: status,
			Notes:  notes,
		})
		if err != nil {
			errs = append(errs, fmt.Sprintf("Event %s: failed to upsert attendance: %v", ev.EventID, err))
			continue
		}

		syncedIDs = append(syncedIDs, ev.EventID)
	}

	return SyncAttendanceBatchResponse{
		SyncedCount: len(syncedIDs),
		FailedCount: len(errs),
		SyncedIDs:   syncedIDs,
		Errors:      errs,
	}, nil
}

