# Key Agreement

Derive shared secrets using ECDH, X25519/X448, or post-quantum KEMs and optionally run HKDF or PBKDF2 to produce a final key.

## Features
- ECDH (P-256/P-384/P-521/secp256k1), Schnorr (secp256k1), X25519/X448, ML-KEM, and hybrid KEM support
- secp256k1, Schnorr, X448, plus ML-KEM/hybrid KEM handled with noble-curves and noble-post-quantum
- PEM (SPKI/PKCS8) and JWK key inputs with upload and generation helpers
- Encapsulate/decapsulate modes for PQC KEMs with ciphertext input/output
- Shared secret output with Base64/Base64url/Hex encodings
- Optional HKDF or PBKDF2 to derive a final key with length presets and custom slider
- Salt generation helpers for KDF flows

## Parameters
- Algorithm and curve selection
- Local private key input, peer public key input, and KEM ciphertext input/output
- ML-KEM and hybrid KEM parameter sets
- Output encoding for shared/derived secrets
- KDF settings (HKDF/PBKDF2, hash, salt, info, iterations, output length)

## URL State
- Inputs and parameters sync to the URL (except oversized values)
- Output is excluded from URL sync

## History
- Key inputs create valued history entries
- Parameter changes update the latest entry
