# Charset Converter

Convert text between character sets supported by iconv-lite with input/output encoding controls, auto-detection, and BOM handling.

## Features
- Input text or upload a file
- File uploads keep the filename and can sync content into the URL when small
- Input encoding: Raw, Base64 (auto padding and URL-safe detection), Hex (plain, hex escape, or URL % forms)
- Auto-detect input charset with chardet and selectable confidence results
- BOM detection display
- Output encoding: Raw, Base64 (URL-safe + padding options), Hex (hex, hex escape, or URL output)
- Optional output BOM for Unicode charsets
- URL-synced inputs with history restore

## Parameters
- Input text
- File name + small file content (URL-synced)
- Input charset and encoding
- Output charset and encoding
- Output Base64 options
- Output Hex options
- Output BOM
- Auto-detect toggle

## URL State
- Inputs, small file uploads, and conversion settings are synced to the URL
- Output is not synced

## History
- Input changes create history entries
- Selecting a history entry restores inputs and settings
