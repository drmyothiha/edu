package identity

import (
	"crypto/sha256"
	"encoding/hex"
	"fmt"
	"strings"
)

// MerkleProof represents an audit proof path for a leaf in a Merkle tree
type MerkleProof struct {
	Position string `json:"position"` // "left" or "right"
	Hash     string `json:"hash"`     // 0x...
}

// BuildMerkleTree constructs a binary Merkle tree from leaf hashes and returns the root & proofs
func BuildMerkleTree(leafHashes []string) (string, map[string][]MerkleProof, error) {
	if len(leafHashes) == 0 {
		return "", nil, fmt.Errorf("cannot build Merkle tree from empty list")
	}

	// Normalize all leaf hashes to lowercase 0x
	normalized := make([]string, len(leafHashes))
	for i, h := range leafHashes {
		h = strings.TrimPrefix(strings.ToLower(h), "0x")
		normalized[i] = "0x" + h
	}

	// Store proof traces for each leaf
	proofs := make(map[string][]MerkleProof)
	for _, leaf := range normalized {
		proofs[leaf] = make([]MerkleProof, 0)
	}

	// If only 1 leaf, root is the leaf hash itself
	if len(normalized) == 1 {
		return normalized[0], proofs, nil
	}

	currentLevel := make([]string, len(normalized))
	copy(currentLevel, normalized)

	// Keep track of which original leaves belong to which current level index
	leafIndices := make([][]string, len(normalized))
	for i, leaf := range normalized {
		leafIndices[i] = []string{leaf}
	}

	for len(currentLevel) > 1 {
		var nextLevel []string
		var nextIndices [][]string

		for i := 0; i < len(currentLevel); i += 2 {
			left := currentLevel[i]
			var right string

			if i+1 < len(currentLevel) {
				right = currentLevel[i+1]
			} else {
				// Odd number of leaves: duplicate the last leaf
				right = left
			}

			// Add proof elements to corresponding leaves
			for _, originalLeaf := range leafIndices[i] {
				proofs[originalLeaf] = append(proofs[originalLeaf], MerkleProof{
					Position: "right",
					Hash:     right,
				})
			}
			if i+1 < len(currentLevel) {
				for _, originalLeaf := range leafIndices[i+1] {
					proofs[originalLeaf] = append(proofs[originalLeaf], MerkleProof{
						Position: "left",
						Hash:     left,
					})
				}
			}

			parentHash := HashPair(left, right)
			nextLevel = append(nextLevel, parentHash)

			mergedLeaves := append([]string{}, leafIndices[i]...)
			if i+1 < len(currentLevel) {
				mergedLeaves = append(mergedLeaves, leafIndices[i+1]...)
			}
			nextIndices = append(nextIndices, mergedLeaves)
		}

		currentLevel = nextLevel
		leafIndices = nextIndices
	}

	return currentLevel[0], proofs, nil
}

// HashPair computes sha256(left + right) in hex
func HashPair(left, right string) string {
	if len(left) >= 2 && (left[0] == '0' && (left[1] == 'x' || left[1] == 'X')) {
		left = left[2:]
	}
	if len(right) >= 2 && (right[0] == '0' && (right[1] == 'x' || right[1] == 'X')) {
		right = right[2:]
	}

	// Single stack-allocated 64-byte array to hold decoded left and right bytes
	var buf [64]byte
	_, _ = hex.Decode(buf[:32], []byte(left))
	_, _ = hex.Decode(buf[32:], []byte(right))

	h := sha256.Sum256(buf[:])

	// Direct encoding to string with '0x' prefix to avoid intermediate byte slice allocations
	const hextable = "0123456789abcdef"
	var out [66]byte
	out[0] = '0'
	out[1] = 'x'
	for i, v := range h {
		out[2+i*2] = hextable[v>>4]
		out[2+i*2+1] = hextable[v&0x0f]
	}
	return string(out[:])
}

// VerifyMerkleProof checks whether a given leaf hash belongs to the Merkle root
func VerifyMerkleProof(leafHash string, root string, proofs []MerkleProof) bool {
	current := leafHash

	for _, p := range proofs {
		if p.Position == "right" {
			current = HashPair(current, p.Hash)
		} else {
			current = HashPair(p.Hash, current)
		}
	}

	return equalHex(current, root)
}

func equalHex(a, b string) bool {
	if len(a) >= 2 && (a[0] == '0' && (a[1] == 'x' || a[1] == 'X')) {
		a = a[2:]
	}
	if len(b) >= 2 && (b[0] == '0' && (b[1] == 'x' || b[1] == 'X')) {
		b = b[2:]
	}
	return strings.EqualFold(a, b)
}
