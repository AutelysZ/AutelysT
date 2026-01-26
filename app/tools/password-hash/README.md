# Password Hash

Generate, verify, and parse password hashes using bcrypt, scrypt, and Argon2 with configurable parameters.

## Features

- Bcrypt hashing with cost control
- Scrypt hashing with N/r/p and derived key length
- Argon2 hashing with variant, time, memory, and parallelism controls
- Verify hashes and parse parameters on the same page

## Parameters

- Per-algorithm password, salt, and tuning parameters
- Output format selection for Argon2 (type) and scrypt settings

## URL State

- All input fields and settings are synced to the URL
- Generated hashes are output-only and not stored in the URL

## History

- Input changes create history entries
- Parameters are restored from history
