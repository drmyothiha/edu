package identity

import (
	"crypto/sha256"
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

const hexTable = "0123456789abcdef"

func decodeHex32(s string, out []byte) {
	if len(s) >= 2 && (s[0] == '0' && (s[1] == 'x' || s[1] == 'X')) {
		s = s[2:]
	}
	for i := 0; i < 32 && i*2+1 < len(s); i++ {
		out[i] = (fromHexChar(s[i*2]) << 4) | fromHexChar(s[i*2+1])
	}
}

func fromHexChar(c byte) byte {
	switch {
	case '0' <= c && c <= '9':
		return c - '0'
	case 'a' <= c && c <= 'f':
		return c - 'a' + 10
	case 'A' <= c && c <= 'F':
		return c - 'A' + 10
	}
	return 0
}

// HashPair computes sha256(left + right) in hex with zero slice heap allocations
func HashPair(left, right string) string {
	// Performance optimization: decode left and right hex directly into stack-allocated buffer
	// to avoid slice heap allocations during Merkle tree construction & verification.
	var combined [64]byte
	decodeHex32(left, combined[0:32])
	decodeHex32(right, combined[32:64])

	h := sha256.Sum256(combined[:])

	// Format output hex string with 0x prefix using a single string allocation
	var buf [66]byte
	buf[0] = '0'
	buf[1] = 'x'
	for i, v := range h {
		buf[2+i*2] = hexTable[v>>4]
		buf[2+i*2+1] = hexTable[v&0x0f]
	}
	return string(buf[:])
}

// VerifyMerkleProof checks whether a given leaf hash belongs to the Merkle root
func VerifyMerkleProof(leafHash string, root string, proofs []MerkleProof) bool {
	current := "0x" + strings.TrimPrefix(strings.ToLower(leafHash), "0x")
	expectedRoot := "0x" + strings.TrimPrefix(strings.ToLower(root), "0x")

	for _, p := range proofs {
		pHash := "0x" + strings.TrimPrefix(strings.ToLower(p.Hash), "0x")
		if p.Position == "right" {
			current = HashPair(current, pHash)
		} else {
			current = HashPair(pHash, current)
		}
	}

	return current == expectedRoot
}
