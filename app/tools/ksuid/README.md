# KSUID

Generate and parse KSUIDs (K-Sortable Unique Identifiers).

## Features

- Responsive layout on mobile
- Generate KSUIDs
- Parse one or more KSUIDs to extract timestamp and payload (multi-parse table supported)

## Parameters

- Generation count

## Usage

- Generate KSUIDs or paste one or more to parse

## URL State

- Inputs and parameters sync to the URL query
- Inputs over 2 KB are excluded with a warning

## History

- URL params take precedence on load; otherwise restore the latest history entry
- Input changes create valued history entries (debounced)
- Parameter changes create/update a valueless entry until input is generated or pasted
