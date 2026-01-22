# UUID

Generate and parse UUIDs (v1, v4, v6, v7).

## Features
- Responsive layout on mobile
- Generate multiple UUIDs
- Parse one or more UUIDs to extract fields (multi-parse table supported, including non-RFC variants)

## Parameters
- Version
- Count

## Usage
- Generate UUIDs or paste one or more to parse

## URL State
- Inputs and parameters sync to the URL query
- Inputs over 2 KB are excluded with a warning

## History
- URL params take precedence on load; otherwise restore the latest history entry
- Input changes create valued history entries (debounced)
- Parameter changes create/update a valueless entry until input is generated or pasted
