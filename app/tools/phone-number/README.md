# Phone Number Parser

Parse and build phone numbers with `libphonenumber-js`, including region defaults and formatting output.

## Features

- Parse phone numbers into structured JSON
- Build phone numbers from JSON/table inputs
- Choose default country and output format
- Table and JSON views for structured editing

## Parameters

- Default country (for national numbers)
- Output format (E.164, International, National, RFC3966)
- Active side determines parse/build direction

## URL State

- Inputs, active side, and settings are synced to the URL

## History

- Active input creates history entries
- Settings are restored from history
