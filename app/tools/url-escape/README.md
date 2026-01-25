# URL Escape

Encode and decode URL percent-encoding sequences like %20 and %2F.

## Features

- Dual-pane encode/decode
- Text encoding selection
- Upper/lower case toggle
- Encoding modes for all bytes, components, or reserved characters

## Parameters

- Input Encoding
- Mode
- Upper case

## Usage

- Type in either pane to convert between text and URL escape

## URL State

- Inputs and parameters sync to the URL query
- Only the active input side and active side are synced
- Inputs over 2 KB are excluded with a warning

## History

- URL params take precedence on load; otherwise restore the latest history entry
- Input changes create valued history entries (debounced)
- Parameter changes update the latest entry or keep a valueless placeholder until input
