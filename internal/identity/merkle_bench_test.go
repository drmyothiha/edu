package identity

import (
	"crypto/sha256"
	"encoding/hex"
	"fmt"
	"testing"
)

func BenchmarkHashPair(b *testing.B) {
	left := "0x1111111111111111111111111111111111111111111111111111111111111111"
	right := "0x2222222222222222222222222222222222222222222222222222222222222222"
	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		_ = HashPair(left, right)
	}
}

func BenchmarkBuildMerkleTree1000(b *testing.B) {
	leaves := make([]string, 1000)
	for i := 0; i < 1000; i++ {
		h := sha256.Sum256([]byte(fmt.Sprintf("leaf-%d", i)))
		leaves[i] = "0x" + hex.EncodeToString(h[:])
	}
	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		_, _, _ = BuildMerkleTree(leaves)
	}
}

func BenchmarkVerifyMerkleProof(b *testing.B) {
	leaves := make([]string, 1000)
	for i := 0; i < 1000; i++ {
		h := sha256.Sum256([]byte(fmt.Sprintf("leaf-%d", i)))
		leaves[i] = "0x" + hex.EncodeToString(h[:])
	}
	root, proofs, _ := BuildMerkleTree(leaves)
	leaf := leaves[0]
	proof := proofs[leaf]
	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		_ = VerifyMerkleProof(leaf, root, proof)
	}
}
