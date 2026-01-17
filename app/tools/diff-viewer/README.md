# Diff Viewer

Compare text, JSON, YAML, or TOML content side-by-side with table and text diff views.

## Features
- Auto-detect JSON/YAML/TOML inputs
- Format selection per side
- Table view for structured data
- Unified text diff view with character highlights
- Collapsed unchanged lines with expandable context
- Download unified patch output from Text View

## Parameters
- Left/right format (Auto/Text/JSON/YAML/TOML)
- View mode (table/text)

## Usage
- Paste or upload content on both sides
- Use Auto to detect formats or set a specific format
- Switch between table and text views when available
- Uploads require UTF-8 text; files over 1 MB are too large to compare
- If diffs exceed 10k lines or 1 MB, the UI shows summary only with patch download
- Very large inputs skip in-browser diffing to avoid crashes; download may be disabled

## URL State
- Inputs and parameters sync to the URL query (inputs over 2 KB are excluded with a warning)
- URL params take precedence on load; otherwise restore the latest history entry

## History
- Input changes create valued history entries (debounced)
- Parameter changes update the latest entry or keep a valueless placeholder until input
