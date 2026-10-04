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

const hexTable = "0123456789abcdef"

// decodeHex64Chars decodes a 64-char hex string (with or without 0x/0X prefix) directly into a 32-byte destination array without heap allocations.
func decodeHex64Chars(s string, dst []byte) bool {
	if len(s) == 66 && s[0] == '0' && (s[1] == 'x' || s[1] == 'X') {
		s = s[2:]
	} else if len(s) != 64 {
		s = strings.TrimPrefix(strings.TrimPrefix(s, "0x"), "0X")
		if len(s) != 64 {
			return false
		}
	}
	for i := 0; i < 32; i++ {
		a := s[i*2]
		b := s[i*2+1]
		var ha, hb byte
		if a >= '0' && a <= '9' {
			ha = a - '0'
		} else if a >= 'a' && a <= 'f' {
			ha = a - 'a' + 10
		} else if a >= 'A' && a <= 'F' {
			ha = a - 'A' + 10
		} else {
			return false
		}
		if b >= '0' && b <= '9' {
			hb = b - '0'
		} else if b >= 'a' && b <= 'f' {
			hb = b - 'a' + 10
		} else if b >= 'A' && b <= 'F' {
			hb = b - 'A' + 10
		} else {
			return false
		}
		dst[i] = (ha << 4) | hb
	}
	return true
}

// encodeHex66 formats a 32-byte SHA-256 digest into a 0x-prefixed 66-character lower-case hex string with 1 allocation.
func encodeHex66(h *[32]byte) string {
	var out [66]byte
	out[0] = '0'
	out[1] = 'x'
	for i, v := range h {
		out[2+i*2] = hexTable[v>>4]
		out[2+i*2+1] = hexTable[v&0x0f]
	}
	return string(out[:])
}

// BuildMerkleTree constructs a binary Merkle tree from leaf hashes and returns the root & proofs.
// Performance Optimization:
// 1. Pre-allocates proof slices for leaves based on calculated tree depth ceil(log2(n)).
// 2. Tracks leaf index ranges [start, end] for tree nodes instead of dynamically allocating & merging string slices at each level.
// 3. Uses optimized HashPair hashing with zero internal slice allocations.
func BuildMerkleTree(leafHashes []string) (string, map[string][]MerkleProof, error) {
	if len(leafHashes) == 0 {
		return "", nil, fmt.Errorf("cannot build Merkle tree from empty list")
	}

	n := len(leafHashes)

	// Normalize all leaf hashes to lowercase 0x
	normalized := make([]string, n)
	for i, h := range leafHashes {
		h = strings.TrimPrefix(strings.ToLower(h), "0x")
		normalized[i] = "0x" + h
	}

	// Calculate maximum tree depth to pre-allocate proof slices
	depth := 0
	for (1 << depth) < n {
		depth++
	}

	proofList := make([][]MerkleProof, n)
	for i := 0; i < n; i++ {
		proofList[i] = make([]MerkleProof, 0, depth)
	}

	proofs := make(map[string][]MerkleProof, n)

	// If only 1 leaf, root is the leaf hash itself
	if n == 1 {
		proofs[normalized[0]] = proofList[0]
		return normalized[0], proofs, nil
	}

	currentLevel := make([]string, n)
	copy(currentLevel, normalized)

	// leafRanges tracks [start, end] leaf indices covered by each node in currentLevel
	type rangeIdx struct {
		start, end int
	}
	leafRanges := make([]rangeIdx, n)
	for i := 0; i < n; i++ {
		leafRanges[i] = rangeIdx{start: i, end: i}
	}

	for len(currentLevel) > 1 {
		nextLen := (len(currentLevel) + 1) / 2
		nextLevel := make([]string, 0, nextLen)
		nextRanges := make([]rangeIdx, 0, nextLen)

		for i := 0; i < len(currentLevel); i += 2 {
			left := currentLevel[i]
			leftRange := leafRanges[i]

			var right string
			var rightRange rangeIdx

			if i+1 < len(currentLevel) {
				right = currentLevel[i+1]
				rightRange = leafRanges[i+1]
			} else {
				// Odd number of leaves: duplicate the last leaf
				right = left
				rightRange = leftRange
			}

			// Add proof elements to corresponding leaf ranges
			for k := leftRange.start; k <= leftRange.end; k++ {
				proofList[k] = append(proofList[k], MerkleProof{
					Position: "right",
					Hash:     right,
				})
			}

			if i+1 < len(currentLevel) {
				for k := rightRange.start; k <= rightRange.end; k++ {
					proofList[k] = append(proofList[k], MerkleProof{
						Position: "left",
						Hash:     left,
					})
				}
				nextRanges = append(nextRanges, rangeIdx{start: leftRange.start, end: rightRange.end})
			} else {
				nextRanges = append(nextRanges, leftRange)
			}

			parentHash := HashPair(left, right)
			nextLevel = append(nextLevel, parentHash)
		}

		currentLevel = nextLevel
		leafRanges = nextRanges
	}

	for i, leaf := range normalized {
		proofs[leaf] = proofList[i]
	}

	return currentLevel[0], proofs, nil
}

// HashPair computes sha256(left + right) in hex.
// Performance Optimization: Uses stack-allocated byte arrays for zero-allocation hex decoding and sha256 input buffer.
func HashPair(left, right string) string {
	var buf [64]byte
	if !decodeHex64Chars(left, buf[:32]) || !decodeHex64Chars(right, buf[32:]) {
		// Fallback for non-standard length hex strings
		lBytes, _ := hex.DecodeString(strings.TrimPrefix(left, "0x"))
		rBytes, _ := hex.DecodeString(strings.TrimPrefix(right, "0x"))
		combined := append(lBytes, rBytes...)
		h := sha256.Sum256(combined)
		return "0x" + hex.EncodeToString(h[:])
	}

	h := sha256.Sum256(buf[:])
	return encodeHex66(&h)
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
