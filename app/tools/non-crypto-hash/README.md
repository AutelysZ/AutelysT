# Non-Crypto Hash

Generate fast, non-cryptographic hashes from text or uploaded files with support for MurmurHash, xxHash, CityHash/FarmHash, SipHash, SpookyHash, HighwayHash, FNV, and CRC32.

## Features
- Algorithm tabs covering MurmurHash, xxHash, CityHash/FarmHash, SipHash, SpookyHash, HighwayHash, FNV, and CRC32
- UTF-8, Base64, or Hex input decoding with optional file upload
- Hex, Base64, and Base64url digest output
- Keyed hashing for SipHash and HighwayHash with encoding control
- URL-synced inputs and history tracking

## Parameters
- Algorithm selection
- Input encoding
- Output encoding
- Optional key and key encoding (SipHash/HighwayHash)
- Input text or file

## URL State
- Input, algorithm, encodings, and key are synced to the URL
- Oversized input/key (>2 KB) is excluded from URL sync with a warning

## History
- Input edits create valued history entries
- Algorithm and encoding updates revise the latest entry
