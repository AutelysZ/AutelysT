# Hybrid Encryption

Encrypt or decrypt messages with CMS, OpenPGP, JWE, or HPKE using browser-based cryptography and clear key inputs.

## Features
- CMS (PKCS#7) enveloped data encryption with PEM or Base64 DER output
- OpenPGP armored message encryption and decryption
- JWE compact serialization with Direct (A256GCM) or RSA-OAEP-256 key management
- HPKE with selectable KEM/KDF/AEAD suites and EC JWK keys
- In-tool generation for CMS certificates, OpenPGP keypairs, JWE RSA keypairs, and HPKE keypairs
- URL-synced inputs and parameters (output excluded)

## Parameters
- Standard and mode selection
- CMS recipient certificate or private key
- OpenPGP public/private key and passphrase
- JWE key management and key material
- HPKE KEM/KDF/AEAD settings, keys, and encapsulated key input/output

## URL State
- Inputs and parameters sync to the URL (except oversized values)
- Output is excluded from URL sync

## History
- Input edits create valued history entries
- Parameter changes update the latest entry
