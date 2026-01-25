# Non-Crypto Hash

Generate fast, non-cryptographic hashes from text or uploaded files with support for MurmurHash, xxHash, CityHash/FarmHash, SipHash, SpookyHash, HighwayHash, FNV, and CRC32.

## Features

- Algorithm families with variant/parameter tabs for MurmurHash3, xxHash, CityHash/FarmHash, SipHash, SpookyHash, HighwayHash, FNV, and CRC32/CRC64
- Seed and round controls for algorithms that support them (MurmurHash3, xxHash, FarmHash, SipHash, SpookyHash)
- UTF-8, Base64, or Hex input decoding with optional file upload
- Hex, Base64, Base64url, and decimal digest output (decimal for 32/64-bit results)
- Keyed hashing for SipHash and HighwayHash with encoding control
- URL-synced inputs and history tracking

## Parameters

- Algorithm family and variant selection
- Seeds, rounds, and output sizes as supported per algorithm
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
