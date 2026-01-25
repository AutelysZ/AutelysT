# Password Generator

Generate secure passwords with multiple serialization modes and length presets.

## Features

- Graphic ASCII and base encodings
- Tabbed selections for serialization, case, and length presets
- Length presets and custom input
- One-click regenerate and copy
- Mobile-friendly layout

## Parameters

- Serialization mode
- Base64 options (No Padding, URL Safe)
- Base32 No Padding
- Case (lower/upper)
- Graphic ASCII options (symbols + letter/digit toggles)
- Length type (bytes/chars) and length preset/custom

## Usage

- Adjust parameters to auto-generate
- Click refresh to regenerate
- Save and copy to record in history

## URL State

- Parameters sync to the URL query (label and output do not)
- Inputs over 2 KB are excluded with a warning

## History

- URL params take precedence on load; otherwise restore the latest history entry
- History entries are created only on Save and Copy
- Parameter changes create/update a valueless entry until saved
- History list shows time, label, and password only (click does not restore state)
