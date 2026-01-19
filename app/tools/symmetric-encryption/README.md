# Symmetric Encryption

Encrypt or decrypt data using AES, ChaCha20, Salsa20, Twofish, Blowfish, DES, or 3DES with selectable encodings.

## Features
- Encrypt/decrypt modes with UTF-8/Base64/Hex input and Base64/Base64url/Hex/Binary output encodings
- AES (including GCM), ChaCha20 (with optional Poly1305), Salsa20, Twofish, Blowfish, DES, and 3DES support
- IV/nonce generation helpers with per-field encoding selection
- Wrap-friendly tab selectors for algorithm and parameter choices
- Key input supports UTF-8, Base64, and Hex encoding with auto-generated values
- Optional key derivation with PBKDF2 or HKDF
- File uploads for binary encryption; decrypt file decoding follows the input encoding selection

## Parameters
- Algorithm, mode, and input/output encoding
- Key material (UTF-8/Base64/Hex)
- Key derivation settings (PBKDF2/HKDF, hash, salt, iterations, info)
- AES mode, padding, key size, IV
- DES/3DES mode, padding, IV
- Twofish/Blowfish mode, padding, IV
- ChaCha20/Salsa20 nonce and counter

## URL State
- Inputs and parameters are synced to the URL (except oversized values)
- File uploads are not synced to the URL
- Output is excluded from URL sync

## History
- Input edits create valued history entries (file uploads are tracked by filename only)
- Parameter changes update the latest entry
