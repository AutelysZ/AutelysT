# Base32

Encode and decode Base32 (RFC 4648).

## Features

- Dual-pane encode/decode
- Text encoding selection
- Upper/lower case toggle
- File upload and download

## Parameters

- Text Encoding
- Upper case

## Usage

- Type in either pane to convert

## URL State

- Inputs and parameters sync to the URL query
- Only the active input side and active side are synced
- Inputs over 2 KB are excluded with a warning

## History

- URL params take precedence on load; otherwise restore the latest history entry
- Input changes create valued history entries (debounced)
- Parameter changes update the latest entry or keep a valueless placeholder until input
