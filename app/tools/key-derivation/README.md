# Key Derivation

Derive keys from input material using HKDF or PBKDF2 with configurable hash, salt, and output length.

## Features

- HKDF and PBKDF2 key derivation with length presets and custom slider
- UTF-8/Base64/Hex input encoding
- Base64/Base64url/Hex output encoding
- Configurable salt (with generate), info, iterations, and output length

## Parameters

- Input material and encoding
- KDF algorithm, hash, and length
- Salt/info with encoding selection
- PBKDF2 iteration count

## URL State

- Inputs and parameters sync to the URL (except oversized values)
- Output is excluded from URL sync

## History

- Input edits create valued history entries
- Parameter changes update the latest entry
