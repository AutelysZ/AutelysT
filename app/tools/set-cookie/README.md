# Set-Cookie Builder & Parser

Build and parse HTTP `Set-Cookie` headers with a dual-panel editor. Edit either side to convert between header strings and JSON.

## Features

- Parse `Set-Cookie` headers into JSON
- Build header strings from JSON
- Toggle between JSON and table views
- Supports multiple cookies per header input
- Syncs input to URL and history

## Parameters

- Left panel header input
- Right panel JSON input
- Active side (parse/build direction)

## URL State

- Both panel inputs are synced to the URL
- Output is derived from the active side

## History

- Active input creates history entries
- Switching sides updates history params
