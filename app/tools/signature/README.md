# Signature

Sign and verify messages with HMAC, RSA, ECDSA, EdDSA, Schnorr, and post-quantum signatures using PEM/JWK or PQC JSON keys and flexible encodings.

## Features
- Sign and verify modes with HMAC/RSA/ECDSA/EdDSA/Schnorr/ML-DSA/SLH-DSA algorithms
- Curve support via noble-curves: secp256k1, Schnorr, P-256/P-384/P-521, Ed25519/Ed448, brainpoolP256r1/384r1/512r1
- PEM (SPKI/PKCS8) for RSA plus JWK (EC/OKP) support for curve signatures
- ML-DSA and SLH-DSA parameter sets via noble-post-quantum (PQC JSON or raw key inputs)
- Keypair upload and in-browser generation for supported algorithms
- Base64/Base64url/Hex signature encodings
- File upload support for binary message signing
- URL-synced inputs and parameters (outputs excluded)

## Parameters
- Mode, algorithm family, and hash/curve selections
- Message and signature encodings
- HMAC secret with encoding
- RSA scheme, hash, salt length, modulus length, and public exponent
- ECDSA curve and hash (P-256/P-384/P-521, secp256k1, brainpool)
- EdDSA curve (Ed25519, Ed448)
- Schnorr (secp256k1)
- ML-DSA and SLH-DSA parameter sets
- Keypair upload and generation controls

## Usage
- Paste a message (or upload a file) and sign with the selected algorithm
- Switch to verify mode and paste the signature to validate

## URL State
- Inputs and parameters sync to the URL query
- Inputs over 2 KB are excluded with a warning
- Output is excluded from URL sync

## History
- Input edits create valued history entries (file uploads are tracked by filename only)
- Parameter changes update the latest entry
