package revocation

import (
	"bytes"
	"compress/gzip"
	"encoding/base64"
	"fmt"
	"io"
	"sync"
)

// BitSet implements an in-memory bit vector with W3C gzip+base64url compression
type BitSet struct {
	mu       sync.RWMutex
	capacity int
	bytes    []byte
}

// NewBitSet initializes a bitset for a given number of bits (default 131,072)
func NewBitSet(totalBits int) *BitSet {
	if totalBits <= 0 {
		totalBits = 131072
	}
	numBytes := (totalBits + 7) / 8
	return &BitSet{
		capacity: totalBits,
		bytes:    make([]byte, numBytes),
	}
}

// Set marks bit at position (0 = valid, 1 = revoked)
func (b *BitSet) Set(pos int, value bool) error {
	b.mu.Lock()
	defer b.mu.Unlock()

	if pos < 0 || pos >= b.capacity {
		return fmt.Errorf("bit position %d out of range (capacity: %d)", pos, b.capacity)
	}

	byteIdx := pos / 8
	bitOffset := uint(pos % 8)

	if value {
		b.bytes[byteIdx] |= (1 << bitOffset)
	} else {
		b.bytes[byteIdx] &= ^(1 << bitOffset)
	}
	return nil
}

// Get checks if the bit at pos is 1 (revoked)
func (b *BitSet) Get(pos int) (bool, error) {
	b.mu.RLock()
	defer b.mu.RUnlock()

	if pos < 0 || pos >= b.capacity {
		return false, fmt.Errorf("bit position %d out of range (capacity: %d)", pos, b.capacity)
	}

	byteIdx := pos / 8
	bitOffset := uint(pos % 8)

	return (b.bytes[byteIdx] & (1 << bitOffset)) != 0, nil
}

// EncodeCompressed compresses the bitstring using gzip and encodes to base64url
func (b *BitSet) EncodeCompressed() (string, error) {
	b.mu.RLock()
	defer b.mu.RUnlock()

	var buf bytes.Buffer
	zw := gzip.NewWriter(&buf)
	if _, err := zw.Write(b.bytes); err != nil {
		return "", fmt.Errorf("gzip write error: %w", err)
	}
	if err := zw.Close(); err != nil {
		return "", fmt.Errorf("gzip close error: %w", err)
	}

	return base64.RawURLEncoding.EncodeToString(buf.Bytes()), nil
}

// DecodeCompressed loads an encoded gzip+base64url string into the BitSet
func DecodeCompressed(encoded string, totalBits int) (*BitSet, error) {
	compressedBytes, err := base64.RawURLEncoding.DecodeString(encoded)
	if err != nil {
		return nil, fmt.Errorf("failed to decode base64url: %w", err)
	}

	zr, err := gzip.NewReader(bytes.NewReader(compressedBytes))
	if err != nil {
		return nil, fmt.Errorf("failed to create gzip reader: %w", err)
	}
	defer zr.Close()

	decompressed, err := io.ReadAll(zr)
	if err != nil {
		return nil, fmt.Errorf("failed to decompress gzip bytes: %w", err)
	}

	bs := NewBitSet(totalBits)
	bs.mu.Lock()
	defer bs.mu.Unlock()

	copy(bs.bytes, decompressed)
	return bs, nil
}
