package response

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/gin-gonic/gin"
)

func TestOKWritesSuccessEnvelope(t *testing.T) {
	t.Parallel()

	gin.SetMode(gin.TestMode)
	w := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(w)

	OK(c, http.StatusCreated, gin.H{"id": "item-1"})

	if w.Code != http.StatusCreated {
		t.Fatalf("status = %d", w.Code)
	}
	var body Response
	if err := json.Unmarshal(w.Body.Bytes(), &body); err != nil {
		t.Fatalf("decoding response: %v", err)
	}
	if !body.Success || body.Data == nil {
		t.Fatalf("unexpected body: %+v", body)
	}
}

func TestErrorAbortsWithErrorEnvelope(t *testing.T) {
	t.Parallel()

	gin.SetMode(gin.TestMode)
	w := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(w)

	Error(c, http.StatusForbidden, "sin permisos")

	if w.Code != http.StatusForbidden {
		t.Fatalf("status = %d", w.Code)
	}
	if !c.IsAborted() {
		t.Fatal("context should be aborted")
	}
	var body Response
	if err := json.Unmarshal(w.Body.Bytes(), &body); err != nil {
		t.Fatalf("decoding response: %v", err)
	}
	if body.Success || body.Error != "sin permisos" {
		t.Fatalf("unexpected body: %+v", body)
	}
}
