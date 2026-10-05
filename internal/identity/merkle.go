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
	var combined [64]byte
	decodeHexToBuf(left, combined[:32])
	decodeHexToBuf(right, combined[32:])
	h := sha256.Sum256(combined[:])
	return "0x" + hex.EncodeToString(h[:])
}

// HashPairBytes computes sha256(left + right) for fixed 32-byte hashes without memory allocations
func HashPairBytes(left, right [32]byte) [32]byte {
	var combined [64]byte
	copy(combined[:32], left[:])
	copy(combined[32:], right[:])
	return sha256.Sum256(combined[:])
}

// decodeHexToBuf decodes hex characters from s into dst without heap allocations
func decodeHexToBuf(s string, dst []byte) {
	if strings.HasPrefix(s, "0x") || strings.HasPrefix(s, "0X") {
		s = s[2:]
	}
	i, j := 0, 0
	for i+1 < len(s) && j < len(dst) {
		dst[j] = (fromHexChar(s[i]) << 4) | fromHexChar(s[i+1])
		i += 2
		j++
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

// VerifyMerkleProof checks whether a given leaf hash belongs to the Merkle root
func VerifyMerkleProof(leafHash string, root string, proofs []MerkleProof) bool {
	var current [32]byte
	var expectedRoot [32]byte
	decodeHexToBuf(leafHash, current[:])
	decodeHexToBuf(root, expectedRoot[:])

	for _, p := range proofs {
		var pHash [32]byte
		decodeHexToBuf(p.Hash, pHash[:])
		if p.Position == "right" {
			current = HashPairBytes(current, pHash)
		} else {
			current = HashPairBytes(pHash, current)
		}
	}

	return current == expectedRoot
}
