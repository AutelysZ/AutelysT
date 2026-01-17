# Base64

Encode and decode Base64 with support for multiple text encodings and file handling.

## Features
- Dual-pane encode/decode with last edited side tracking
- URL-safe and padding options
- MIME line breaks support
- File upload and download for raw bytes

## Parameters
- Text Encoding
- Padding
- URL Safe
- MIME Format (line breaks)

## Usage
- Type in either pane to convert
- Upload files to encode/decode binary data

## URL State
- Inputs and parameters sync to the URL query
- Only the active input side and active side are synced
- Inputs over 2 KB are excluded with a warning

## History
- URL params take precedence on load; otherwise restore the latest history entry
- Input changes create valued history entries (debounced)
- Parameter changes update the latest entry or keep a valueless placeholder until input
