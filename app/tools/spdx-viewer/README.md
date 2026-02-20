# SPDX Viewer

Validate SPDX license expressions and inspect SPDX JSON document contents.

## Features

- Parse and validate SPDX expressions (including `AND`, `OR`, and `WITH`)
- Resolve license IDs to official SPDX license metadata
- Support custom `LicenseRef` identifiers
- Inspect SPDX JSON document metadata, package entries, and license expressions

## Parameters

- Mode (`auto`, `expression`, `document`)
- Input text (SPDX expression or SPDX JSON)

## Usage

- Choose mode or keep auto-detect enabled
- Paste an SPDX expression or SPDX JSON document
- Review validation output, resolved licenses, and package/license summaries

## URL State

- Mode and input are synced via hash-based URL state
- Output fields are not synced

## History

- Input changes create debounced history entries
- Mode changes update latest history params without adding a new entry
