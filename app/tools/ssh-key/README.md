# SSH Key Tool

Generate SSH keypairs, inspect OpenSSH public keys, and view fingerprints and metadata.

## Features

- Generate Ed25519, RSA, and ECDSA keypairs
- Export OpenSSH public keys, PEM (SPKI/PKCS8), and JWK
- Inspect OpenSSH public keys and compute SHA-256/MD5 fingerprints
- Convert supported PEM public/private keys to OpenSSH public keys
- Download all generated public/private formats in a single zip file

## Parameters

- Mode (Generate or Inspect)
- Algorithm selection with RSA key size
- Optional comment for OpenSSH public keys
- SSH key input for inspection

## URL State

- Inputs and parameters are synced to the URL hash for sharing
- Output-only fields are excluded from URL sync

## History

- Inspection input edits create history entries
- Generator settings update the latest entry
- Copying a generated public key saves it to history for later inspection
