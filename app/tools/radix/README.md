# Base Conversion

Convert numbers between different bases (radixes).

## Features
- Dual-pane conversion
- Supports common bases and custom radix
- Base60 formatting support
- Responsive layout on small screens

## Parameters
- Radix per side (10/16/8/2/60/custom)
- Upper case
- Padding

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
