# Hash (Digest)

Generate cryptographic digests from text or uploaded files with support for MD, SHA, SHA3, and BLAKE families.

## Features
- Text input with UTF-8, Base64, or Hex decoding
- File upload with hashing of raw bytes
- Searchable algorithm selector
- Digest output in hex, base64, or base64url
- Copy digest output
- URL-synced inputs and history tracking

## Parameters
- Algorithm selection
- Input encoding
- Digest encoding
- Input text

## URL State
- Input, algorithm, and encodings are synced to the URL
- Oversized input (>2 KB) is excluded from URL sync with a warning

## History
- Input edits create valued history entries
- Algorithm and encoding updates revise the latest entry
