package response

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"
)

func TestStandardErrorFormat(t *testing.T) {
	tests := []struct {
		name       string
		fn         func(w http.ResponseWriter)
		wantStatus int
		wantMsg    string
	}{
		{
			name: "BadRequest",
			fn: func(w http.ResponseWriter) {
				BadRequest(w, "invalid request parameter")
			},
			wantStatus: http.StatusBadRequest,
			wantMsg:    "invalid request parameter",
		},
		{
			name: "Unauthorized",
			fn: func(w http.ResponseWriter) {
				Unauthorized(w, "token expired")
			},
			wantStatus: http.StatusUnauthorized,
			wantMsg:    "token expired",
		},
		{
			name: "Forbidden",
			fn: func(w http.ResponseWriter) {
				Forbidden(w, "insufficient privileges")
			},
			wantStatus: http.StatusForbidden,
			wantMsg:    "insufficient privileges",
		},
		{
			name: "NotFound",
			fn: func(w http.ResponseWriter) {
				NotFound(w, "class not found")
			},
			wantStatus: http.StatusNotFound,
			wantMsg:    "class not found",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			rr := httptest.NewRecorder()
			tt.fn(rr)

			if rr.Code != tt.wantStatus {
				t.Fatalf("expected status %d, got %d", tt.wantStatus, rr.Code)
			}

			var payload ErrorResponse
			if err := json.Unmarshal(rr.Body.Bytes(), &payload); err != nil {
				t.Fatalf("failed to decode JSON error body: %v", err)
			}

			if payload.Status != tt.wantStatus {
				t.Errorf("expected payload status %d, got %d", tt.wantStatus, payload.Status)
			}
			if payload.Error != tt.wantMsg {
				t.Errorf("expected payload error %q, got %q", tt.wantMsg, payload.Error)
			}
		})
	}
}
