# Number Format

Convert between number formatting styles (grouping, numerals, scientific, etc.).

## Features
- Dual-pane conversion with single-line inputs
- Multiple formats including Chinese, Roman, scientific, engineering
- Copy buttons for inputs/outputs

## Parameters
- Format type
- Unit (engineering notation)

## Usage
- Type in either pane to convert

## URL State
- Inputs and parameters sync to the URL query
- Only the active input side and active side are synced
- Inputs over 2 KB are excluded with a warning

## History
- URL params take precedence on load; otherwise restore the latest history entry
- Input changes create valued history entries (debounced)
- Parameter changes update the latest entry or keep a valueless placeholder until input
