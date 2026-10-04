package identity

import (
	"crypto/ed25519"
	"crypto/rand"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"strings"
	"time"

	"github.com/google/uuid"
)

// StudentIdentitySubject represents the non-PII claims inside the Verifiable Credential
type StudentIdentitySubject struct {
	ID                string `json:"id"`                  // did:edu:mm:...
	StudentID         string `json:"student_id"`          // Internal UUID
	StudentRollNumber string `json:"student_roll_number"` // Academic roll or sequence
	SchoolCode        string `json:"school_code"`         // MIMU Option A Code e.g. MMR013001001-BEHS01
	SchoolName        string `json:"school_name"`
	Region            string `json:"region"`
	Township          string `json:"township"`
	AcademicYear      string `json:"academic_year"`
	PublicKeyHex      string `json:"public_key,omitempty"`
}

// CredentialSchema specifies the schema used to validate the credential (W3C VC 2.0)
type CredentialSchema struct {
	ID   string `json:"id"`
	Type string `json:"type"` // e.g. "JsonSchema"
}

// CredentialStatus represents status evaluation such as revocation (W3C Bitstring Status List v1.0)
type CredentialStatus struct {
	ID                   string `json:"id"`
	Type                 string `json:"type"`                 // "BitstringStatusListEntry"
	StatusPurpose        string `json:"statusPurpose"`        // "revocation"
	StatusListIndex      string `json:"statusListIndex"`      // Bit index e.g. "42"
	StatusListCredential string `json:"statusListCredential"` // URL of status list credential
}

// VerifiableCredential represents a W3C Verifiable Credentials 2.0 digital credential structure
// Spec: https://www.w3.org/TR/vc-data-model-2.0/
type VerifiableCredential struct {
	Context           []string               `json:"@context"`
	ID                string                 `json:"id"`
	Type              []string               `json:"type"`
	Issuer            string                 `json:"issuer"` // did:edu:school:... or DID document
	ValidFrom         string                 `json:"validFrom"` // W3C VC 2.0 replaces issuanceDate with validFrom
	ValidUntil        string                 `json:"validUntil,omitempty"`
	CredentialSubject StudentIdentitySubject `json:"credentialSubject"`
	CredentialSchema  *CredentialSchema      `json:"credentialSchema,omitempty"`
	CredentialStatus  *CredentialStatus      `json:"credentialStatus,omitempty"`
	Proof             CredentialProof        `json:"proof"`
}

// CredentialProof contains the cryptographic Data Integrity proof (W3C Data Integrity 1.0 / VC 2.0)
type CredentialProof struct {
	Type               string `json:"type"`               // DataIntegrityProof
	CryptoSuite        string `json:"cryptosuite"`        // eddsa-jcs-2022
	Created            string `json:"created"`
	VerificationMethod string `json:"verificationMethod"`
	ProofPurpose       string `json:"proofPurpose"`
	ProofValue         string `json:"proofValue"`
}

// KeyPair holds a generated Ed25519 key pair with its hex representations
type KeyPair struct {
	PublicKeyHex  string
	PrivateKeyHex string
	EthAddress    string // Deterministic 0x address derived from public key
}

// GenerateKeyPair creates a fresh Ed25519 keypair and Ethereum-compatible address
func GenerateKeyPair() (*KeyPair, error) {
	pub, priv, err := ed25519.GenerateKey(rand.Reader)
	if err != nil {
		return nil, fmt.Errorf("failed to generate ed25519 key: %w", err)
	}

	pubHex := hex.EncodeToString(pub)
	privHex := hex.EncodeToString(priv)

	// Derive a standard EVM-like address (0x + first 20 bytes of sha256)
	hash := sha256.Sum256(pub)
	ethAddr := "0x" + hex.EncodeToString(hash[:20])

	return &KeyPair{
		PublicKeyHex:  pubHex,
		PrivateKeyHex: privHex,
		EthAddress:    ethAddr,
	}, nil
}

// FormatStudentDID builds the canonical DID: did:edu:mm:<region_code>:<school_code>-<year>-<seq>
func FormatStudentDID(regionPCode, schoolCode string, academicYear string, seqNum int) string {
	region := strings.ToLower(strings.TrimPrefix(regionPCode, "MMR"))
	if region == "" {
		region = "mm"
	}
	year := strings.ReplaceAll(academicYear, "-", "")
	if len(year) > 4 {
		year = year[:4]
	}
	return fmt.Sprintf("did:edu:mm:%s:%s-%s-STU%04d", region, schoolCode, year, seqNum)
}

// FormatSchoolDID builds the canonical school issuer DID
func FormatSchoolDID(schoolCode string) string {
	return fmt.Sprintf("did:edu:school:%s", schoolCode)
}

// ComputeCredentialHash calculates sha256 digest of normalized canonical JSON claims
func ComputeCredentialHash(claims StudentIdentitySubject) (string, []byte, error) {
	data, err := json.Marshal(claims)
	if err != nil {
		return "", nil, err
	}
	h := sha256.Sum256(data)
	return "0x" + hex.EncodeToString(h[:]), h[:], nil
}

// IssueStudentCredential issues and signs a W3C-compliant Verifiable Credential
func IssueStudentCredential(
	studentID uuid.UUID,
	did string,
	studentRollNumber string,
	schoolCode string,
	schoolName string,
	region string,
	township string,
	academicYear string,
	studentPublicKeyHex string,
	schoolPrivateKey ed25519.PrivateKey,
) (*VerifiableCredential, string, error) {
	issuanceTime := time.Now().UTC().Format(time.RFC3339)
	issuerDID := FormatSchoolDID(schoolCode)

	subject := StudentIdentitySubject{
		ID:                did,
		StudentID:         studentID.String(),
		StudentRollNumber: studentRollNumber,
		SchoolCode:        schoolCode,
		SchoolName:        schoolName,
		Region:            region,
		Township:          township,
		AcademicYear:      academicYear,
		PublicKeyHex:      studentPublicKeyHex,
	}

	hashHex, hashBytes, err := ComputeCredentialHash(subject)
	if err != nil {
		return nil, "", fmt.Errorf("failed to hash subject: %w", err)
	}

	// Sign the hash with the school's private key
	signatureBytes := ed25519.Sign(schoolPrivateKey, hashBytes)
	signatureHex := hex.EncodeToString(signatureBytes)

	vc := &VerifiableCredential{
		Context: []string{
			"https://www.w3.org/ns/credentials/v2",
			"https://schema.edu.gov.mm/credentials/v2",
		},
		ID:         fmt.Sprintf("urn:uuid:%s", studentID.String()),
		Type:       []string{"VerifiableCredential", "StudentIdentityCredential"},
		Issuer:     issuerDID,
		ValidFrom:  issuanceTime,
		CredentialSubject: subject,
		CredentialSchema: &CredentialSchema{
			ID:   "https://schema.edu.gov.mm/credentials/StudentIdentity.json",
			Type: "JsonSchema",
		},
		Proof: CredentialProof{
			Type:               "DataIntegrityProof",
			CryptoSuite:        "eddsa-jcs-2022",
			Created:            issuanceTime,
			VerificationMethod: fmt.Sprintf("%s#key-1", issuerDID),
			ProofPurpose:       "assertionMethod",
			ProofValue:         signatureHex,
		},
	}

	return vc, hashHex, nil
}

// AttachCredentialStatus attaches a W3C Bitstring Status List v1.0 revocation status entry to the credential
func (vc *VerifiableCredential) AttachCredentialStatus(statusListBaseURL string, bitIndex int) {
	vc.CredentialStatus = &CredentialStatus{
		ID:                   fmt.Sprintf("%s#%d", statusListBaseURL, bitIndex),
		Type:                 "BitstringStatusListEntry",
		StatusPurpose:        "revocation",
		StatusListIndex:      fmt.Sprintf("%d", bitIndex),
		StatusListCredential: statusListBaseURL,
	}
}

// VerifyCredentialSignature checks the signature against the issuer's public key
func VerifyCredentialSignature(vc *VerifiableCredential, schoolPublicKey ed25519.PublicKey) (bool, error) {
	_, hashBytes, err := ComputeCredentialHash(vc.CredentialSubject)
	if err != nil {
		return false, err
	}

	sigBytes, err := hex.DecodeString(vc.Proof.ProofValue)
	if err != nil {
		return false, fmt.Errorf("invalid signature hex: %w", err)
	}

	valid := ed25519.Verify(schoolPublicKey, hashBytes, sigBytes)
	return valid, nil
}

// DIDDocument represents a standard W3C Decentralized Identifier Resolution Document
// Spec: https://www.w3.org/TR/did-core/
type DIDDocument struct {
	Context            []string             `json:"@context"`
	ID                 string               `json:"id"`
	VerificationMethod []VerificationMethod `json:"verificationMethod"`
	Authentication     []string             `json:"authentication"`
	AssertionMethod    []string             `json:"assertionMethod"`
}

// VerificationMethod describes a cryptographic public key in a DID Document
type VerificationMethod struct {
	ID           string `json:"id"`
	Type         string `json:"type"` // JsonWebKey2020 or Ed25519VerificationKey2020
	Controller   string `json:"controller"`
	PublicKeyHex string `json:"publicKeyHex"`
}

// GenerateDIDDocument produces a W3C-compliant DID Resolution document
func GenerateDIDDocument(did string, publicKeyHex string) DIDDocument {
	keyID := fmt.Sprintf("%s#key-1", did)
	return DIDDocument{
		Context: []string{
			"https://www.w3.org/ns/did/v1",
			"https://w3id.org/security/suites/jws-2020/v1",
		},
		ID: did,
		VerificationMethod: []VerificationMethod{
			{
				ID:           keyID,
				Type:         "Ed25519VerificationKey2020",
				Controller:   did,
				PublicKeyHex: publicKeyHex,
			},
		},
		Authentication:  []string{keyID},
		AssertionMethod: []string{keyID},
	}
}

// GetSchoolPublicKeyHex derives the deterministic Ed25519 public key hex for a school
func GetSchoolPublicKeyHex(schoolCode string) string {
	seed := sha256.Sum256([]byte("edu-school-authority-signing-key:" + schoolCode))
	pub := ed25519.NewKeyFromSeed(seed[:]).Public().(ed25519.PublicKey)
	return hex.EncodeToString(pub)
}

// GetMinistryRootPublicKeyHex derives the deterministic root public key hex for Ministry of Education
func GetMinistryRootPublicKeyHex() string {
	seed := sha256.Sum256([]byte("moe-national-root-authority-signing-key:mm"))
	pub := ed25519.NewKeyFromSeed(seed[:]).Public().(ed25519.PublicKey)
	return hex.EncodeToString(pub)
}

// GenerateMoeDIDDocument creates the official W3C did:web:moe.gov.mm DID Document
func GenerateMoeDIDDocument(schools []string) DIDDocument {
	rootDid := "did:web:moe.gov.mm"
	rootKeyID := fmt.Sprintf("%s#root-key-1", rootDid)
	methods := []VerificationMethod{
		{
			ID:           rootKeyID,
			Type:         "Ed25519VerificationKey2020",
			Controller:   rootDid,
			PublicKeyHex: GetMinistryRootPublicKeyHex(),
		},
	}
	assertions := []string{rootKeyID}

	for _, sc := range schools {
		sc = strings.TrimSpace(sc)
		if sc == "" {
			continue
		}
		scKeyID := fmt.Sprintf("%s#%s", rootDid, sc)
		methods = append(methods, VerificationMethod{
			ID:           scKeyID,
			Type:         "Ed25519VerificationKey2020",
			Controller:   rootDid,
			PublicKeyHex: GetSchoolPublicKeyHex(sc),
		})
		assertions = append(assertions, scKeyID)
	}

	return DIDDocument{
		Context: []string{
			"https://www.w3.org/ns/did/v1",
			"https://w3id.org/security/suites/jws-2020/v1",
			"https://w3id.org/security/suites/ed25519-2020/v1",
		},
		ID:                 rootDid,
		VerificationMethod: methods,
		Authentication:     assertions,
		AssertionMethod:    assertions,
	}
}


