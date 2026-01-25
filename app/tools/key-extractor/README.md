# Key Extractor

Inspect and convert cryptographic keys between PEM, JWK, and DER encodings.

## Features

- Two-panel workflow with input on the left and read-only output on the right
- Algorithm selection with auto-detect for RSA, EC, and OKP keys
- Key encoding auto-detect for PEM, JWK, and DER (Base64/Hex/Binary)
- Parsed details for encoding, algorithm, key type, and key parameters
- Convert output to PEM, JWK, or DER variants with download and zip export

## Parameters

- Algorithm selection (auto or explicit)
- Input encoding selection (auto/PEM/JWK/DER)
- Output encoding selection (PEM/JWK/DER)

## URL State

- Input text, algorithm, input encoding, and output encoding are synced to the URL
- Output-only data is excluded from URL sync

## History

- Input edits create history entries
- Parameter changes update the latest entry
