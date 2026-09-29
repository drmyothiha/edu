package zkp

import (
	"crypto/ed25519"
	"encoding/hex"
	"encoding/json"
	"net/http"

	"edu-platform/internal/response"
)

type Handler struct {
	verifier *Verifier
}

func NewHandler(verifier *Verifier) *Handler {
	return &Handler{verifier: verifier}
}

// VerifyDisclosure handles POST /api/v1/zkp/verify-disclosure
func (h *Handler) VerifyDisclosure(w http.ResponseWriter, r *http.Request) {
	var body struct {
		Proof           SelectiveDisclosureProof `json:"proof"`
		IssuerPublicKey string                   `json:"issuer_public_key"` // hex
	}

	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		response.Error(w, http.StatusBadRequest, "invalid request body")
		return
	}

	pubBytes, err := hex.DecodeString(body.IssuerPublicKey)
	if err != nil || len(pubBytes) != ed25519.PublicKeySize {
		response.Error(w, http.StatusBadRequest, "invalid 32-byte hex issuer public key")
		return
	}

	res := h.verifier.VerifySelectiveDisclosure(&body.Proof, ed25519.PublicKey(pubBytes))
	response.JSON(w, http.StatusOK, res)
}

// VerifyPredicate handles POST /api/v1/zkp/verify-predicate
func (h *Handler) VerifyPredicate(w http.ResponseWriter, r *http.Request) {
	var body struct {
		Proof           ZKPredicateProof `json:"proof"`
		IssuerPublicKey string           `json:"issuer_public_key"` // hex
	}

	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		response.Error(w, http.StatusBadRequest, "invalid request body")
		return
	}

	pubBytes, err := hex.DecodeString(body.IssuerPublicKey)
	if err != nil || len(pubBytes) != ed25519.PublicKeySize {
		response.Error(w, http.StatusBadRequest, "invalid 32-byte hex issuer public key")
		return
	}

	res := h.verifier.VerifyZKPredicate(&body.Proof, ed25519.PublicKey(pubBytes))
	response.JSON(w, http.StatusOK, res)
}
