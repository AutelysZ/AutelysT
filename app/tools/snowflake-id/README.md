# Snowflake ID

Generate and parse Twitter Snowflake-style IDs with timestamp decoding.

## Features
- Responsive layout on mobile
- Generate multiple Snowflake IDs
- Parse a single Snowflake ID to extract fields

## Parameters
- Count
- Datacenter ID
- Worker ID

## Usage
- Generate Snowflake IDs or paste one to parse

## URL State
- Inputs and parameters sync to the URL query
- Inputs over 2 KB are excluded with a warning

## History
- URL params take precedence on load; otherwise restore the latest history entry
- Input changes create valued history entries (debounced)
- Parameter changes create/update a valueless entry until input is generated or pasted
