# CSV Tool

Edit and convert CSV/Excel files with multi-tab management, frozen rows/columns, and fast scrolling for million-row datasets.

## Features
- Upload multiple CSV files, Excel workbooks, or entire folders (recurses for all `.csv` files).
- Excel sheets are imported as CSV with `sheet-name.csv` filenames; conflicts prompt to overwrite.
- Pure text editing: no type conversion on import/export; values are kept exactly as displayed.
- Virtualized grid with sheet-style headers for resizing columns/rows, frozen panes, and inline cell editing.
- Drag header borders to resize; double-click to auto-fit; drag freeze lines to set frozen rows/columns.
- Right-click cells or headers for context menus (insert rows/columns with multi-add submenus, freeze operations, auto-fit).
- Add rows/columns on the fly; data stays as objects until export.
- Download the active file as CSV, download all as a ZIP of CSVs, or export all files into a single XLSX (sheet names derived from filenames; too-long names are rejected).
- Local workspace restore: edits are saved in the browser for quick reloads (history entries are disabled for this tool).

## Usage
1. Upload CSV/XLSX files or an entire folder of CSVs.
2. Switch between files via tabs; adjust frozen rows/columns as needed.
3. Edit cells directly; use the right-click menu on headers/cells for add/insert/freeze/auto-fit.
4. Download as CSV (or zipped CSVs) or export everything as XLSX (sheet names use the filename without `.csv`).

> Note: Your edits are stored locally in the browser for restore on refresh. History entries are not recorded for this tool.
