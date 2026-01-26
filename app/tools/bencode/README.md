# Bencode

Encode and decode Bencode data with JSON/YAML conversion, file upload support, and type details.

## Features

- Decode Base64/Hex or uploaded bencode files
- Encode JSON/YAML into bencode
- Output as Base64, Hex, or binary download
- Type details table for decoded data
- URL-synced inputs with history support

## Parameters

- Mode (decode/encode)
- Input encoding or format
- Output format or encoding

## URL State

- Input, mode, and format/encoding selections are synced to the URL
- Binary file uploads are not stored in URL or history

## History

- Text inputs create history entries
- Entries with uploaded files are not restored
