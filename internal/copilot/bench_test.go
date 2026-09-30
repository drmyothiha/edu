package copilot

import (
	"testing"
)

func BenchmarkGenerateDenseVector(b *testing.B) {
	encoder := NewSemanticDenseEncoder("", "", "")
	text := "Mathematics Grade 8 Pythagorean Theorem Right Triangle Hypotenuse Calculation Lesson Plan Curriculum Alignment Bloom Taxonomy Assessment"

	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		_ = encoder.generateDenseVector(text)
	}
}

func BenchmarkCosineSimilarity(b *testing.B) {
	encoder := NewSemanticDenseEncoder("", "", "")
	vecA := encoder.generateDenseVector("Mathematics Grade 8 Pythagorean Theorem")
	vecB := encoder.generateDenseVector("Geometry Right Triangle Calculation")

	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		_ = CosineSimilarity(vecA, vecB)
	}
}
