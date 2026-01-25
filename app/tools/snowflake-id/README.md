# Snowflake ID

Generate and parse Twitter Snowflake-style IDs with timestamp decoding.

## Features

- Responsive layout on mobile
- Generate multiple Snowflake IDs
- Parse single or multiple Snowflake IDs with decoded fields
- Custom epoch, timestamp step, and bit layout controls
- Twitter and Sonyflake presets with one-click reset
- CSV export for parsed tables

## Parameters

- Count
- Datacenter ID
- Worker ID
- Timestamp Bits
- Datacenter Bits
- Worker Bits
- Sequence Bits
- Start Time (ms)
- Timestamp Offset (ms)

## Usage

- Generate Snowflake IDs or paste one/many to parse
- Use presets to reset layout/epoch values quickly

## URL State

- Inputs and parameters sync to the URL query
- Inputs over 2 KB are excluded with a warning

## History

- URL params take precedence on load; otherwise restore the latest history entry
- Input changes create valued history entries (debounced)
- Parameter changes create/update a valueless entry until input is generated or pasted
