# JSON Schema Generator

Generate JSON Schema from sample JSON data.

## Features

- Responsive layout on mobile
- Type inference from sample inputs
- Error reporting for invalid JSON

## Parameters

- None

## Usage

- Paste sample JSON and generate schema

## URL State

- Inputs and parameters sync to the URL query
- Inputs over 2 KB are excluded with a warning

## History

- URL params take precedence on load; otherwise restore the latest history entry
- Input changes create valued history entries (debounced)
- Parameter changes update the latest entry or keep a valueless placeholder until input
