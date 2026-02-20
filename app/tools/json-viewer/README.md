# JSON Viewer

Inspect JSON with a collapsible tree, per-node copy actions, and file upload support.

## Features

- Paste raw JSON input
- Upload `.json` files
- Side-by-side input and output panels (1:1 width)
- Collapse or expand nodes in the tree
- Copy individual node values or the whole JSON payload
- Apply default collapse depth for large payloads
- Full-page mode for the tree panel
- Tree output panel uses its own scroll area
- String output preserves real newlines and tab characters

## Parameters

- Collapse depth

## Usage

- Paste or upload JSON, then inspect it in the tree panel
- Hover nodes and click the copy icon to copy values

## URL State

- Input and parameters are restored via hash-based shared state
- Inputs over 2 KB are excluded from URL state with a warning

## History

- Input changes create debounced history entries
- Parameter changes update the latest history entry
