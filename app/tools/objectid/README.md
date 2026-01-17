# BSON ObjectID

Generate and parse MongoDB BSON ObjectIDs.

## Features
- Responsive layout on mobile
- Generate ObjectIDs
- Parse to extract timestamp and components

## Parameters
- Generation count

## Usage
- Generate ObjectIDs or paste one to parse

## URL State
- Inputs and parameters sync to the URL query
- Inputs over 2 KB are excluded with a warning

## History
- URL params take precedence on load; otherwise restore the latest history entry
- Input changes create valued history entries (debounced)
- Parameter changes create/update a valueless entry until input is generated or pasted
