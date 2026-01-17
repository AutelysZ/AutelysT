# JWK Converter

Convert cryptographic keys between PEM (SPKI/PKCS8) and JWK formats using Web Crypto.

## Features
- Two-way editable panes for PEM and JWK
- File upload and download for both formats
- URL-synced input side with oversized input warnings
- Auto-detect algorithm support for RSA, EC, and OKP keys

## Parameters
- Algorithm selection (auto or explicit)
- Active input side (PEM or JWK)

## URL State
- Active side and its input value are synced to the URL
- Output-only value is excluded from URL sync

## History
- Input edits create valued history entries
- Parameter changes update the latest entry
