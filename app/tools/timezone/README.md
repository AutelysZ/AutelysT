# Time Zone Converter

Convert times between time zones, including Unix epoch formats.

## Features

- Dual input panes with a dedicated formatted output panel
- Date/time picker
- IANA timezone support

## Parameters

- Left timezone
- Right timezone

## Usage

- Enter a time on either side to convert

## URL State

- Inputs and parameters sync to the URL query
- Only the active input side and active side are synced
- Inputs over 2 KB are excluded with a warning

## History

- URL params take precedence on load; otherwise restore the latest history entry
- Input changes create valued history entries (debounced)
- Parameter changes update the latest entry or keep a valueless placeholder until input
