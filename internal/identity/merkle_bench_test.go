package identity

import (
	"fmt"
	"testing"
)

func BenchmarkHashPair(b *testing.B) {
	left := "0x1111111111111111111111111111111111111111111111111111111111111111"
	right := "0x2222222222222222222222222222222222222222222222222222222222222222"
	b.ResetTimer()
	b.ReportAllocs()
	for i := 0; i < b.N; i++ {
		_ = HashPair(left, right)
	}
}

func BenchmarkBuildMerkleTree(b *testing.B) {
	leaves := make([]string, 128)
	for i := range leaves {
		leaves[i] = fmt.Sprintf("0x%064x", i+1)
	}
	b.ResetTimer()
	b.ReportAllocs()
	for i := 0; i < b.N; i++ {
		_, _, _ = BuildMerkleTree(leaves)
	}
}

func BenchmarkVerifyMerkleProof(b *testing.B) {
	leaves := make([]string, 128)
	for i := range leaves {
		leaves[i] = fmt.Sprintf("0x%064x", i+1)
	}
	root, proofs, _ := BuildMerkleTree(leaves)
	leaf := leaves[0]
	proof := proofs[leaf]
	b.ResetTimer()
	b.ReportAllocs()
	for i := 0; i < b.N; i++ {
		_ = VerifyMerkleProof(leaf, root, proof)
	}
}
