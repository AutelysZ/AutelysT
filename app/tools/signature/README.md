# Signature

Sign and verify messages with HMAC, RSA, ECDSA, or EdDSA using PEM/JWK keys and flexible encodings.

## Features
- Sign and verify modes with HMAC/RSA/ECDSA/EdDSA algorithms
- PEM (SPKI/PKCS8) and JWK key support for asymmetric signatures
- Keypair upload and in-browser generation for supported algorithms
- Base64/Base64url/Hex signature encodings
- File upload support for binary message signing
- URL-synced inputs and parameters (outputs excluded)

## Parameters
- Mode, algorithm family, and hash/curve selections
- Message and signature encodings
- HMAC secret with encoding
- RSA scheme, hash, salt length, modulus length, and public exponent
- ECDSA curve and hash
- EdDSA curve
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
