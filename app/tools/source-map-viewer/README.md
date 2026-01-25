# Source Map Viewer

View and download original source files from uploaded source maps with a tree explorer and syntax-highlighted preview.

## Features
- Upload one or more source map files
- Upload files that contain inline source maps
- Browse sources via a tree view
- Read-only Monaco editor preview
- Download individual source files or export all sources as a ZIP

## Parameters
- Active map ID
- Active source file ID

## URL State
- Active map and active source are synced to the URL
- Uploaded source contents are excluded from URL sync

## History
- Uploading maps creates history entries
- Selecting a different source updates history params without creating new entries
