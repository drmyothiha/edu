## 2026-10-03 - Stack Buffers for Merkle Hashing
**Learning:** Hex-encoding/decoding SHA-256 node hashes during Merkle tree construction allocated 6 heap objects per pair (336 B/op). Replacing `hex.DecodeString` and `append` with stack-allocated byte arrays `[64]byte` reduced allocations to 1 alloc/op (80 B/op) and speed by ~22%.
**Action:** In Go cryptographic and hashing routines using fixed 32-byte SHA-256 hashes, decode into stack arrays rather than slice-allocating dynamic byte slices.
