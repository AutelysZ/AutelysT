# ULID

Generate and parse ULIDs (Universally Unique Lexicographically Sortable Identifiers).

## Features
- Responsive layout on mobile
- Generate ULIDs
- Parse to extract timestamp and randomness

## Parameters
- Generation count

## Usage
- Generate ULIDs or paste one to parse

## URL State
- Inputs and parameters sync to the URL query
- Inputs over 2 KB are excluded with a warning

## History
- URL params take precedence on load; otherwise restore the latest history entry
- Input changes create valued history entries (debounced)
- Parameter changes create/update a valueless entry until input is generated or pasted
