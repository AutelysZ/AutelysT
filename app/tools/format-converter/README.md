# Format Converter

Convert between JSON, YAML, and TOML with auto-detection.

## Features

- Responsive layout on mobile
- Dual-pane conversion
- Auto-detect input format
- Error reporting

## Parameters

- Output format selection

## Usage

- Paste input on one side to convert to the other

## URL State

- Inputs and parameters sync to the URL query
- Inputs over 2 KB are excluded with a warning

## History

- URL params take precedence on load; otherwise restore the latest history entry
- Input changes create valued history entries (debounced)
- Parameter changes update the latest entry or keep a valueless placeholder until input
