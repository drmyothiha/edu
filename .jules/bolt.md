## 2026-10-02 - Merkle Tree Hash Pairing Allocation Reduction
**Learning:** `hex.DecodeString` allocates a new byte slice on every call. Decoding hex strings into fixed stack buffers (`var buf [64]byte`) with `hex.Decode` avoids heap allocations and reduces garbage collection pressure significantly when performing repeated cryptographic operations like Merkle tree hashing and proof verification.
**Action:** Use fixed-size stack arrays and direct string encoding for fixed-length hash functions (like SHA-256) instead of `hex.DecodeString` and slice appending.
