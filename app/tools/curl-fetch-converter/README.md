# cURL / fetch Converter

Convert cURL commands to fetch and generate cURL commands from fetch options.

## Features

- Convert cURL commands to browser fetch snippets
- Generate cURL commands from fetch URL + options JSON
- Copy-ready output with warnings
- Client-only rendering for cURL parsing to avoid server-side parser bundling

## Parameters

- Mode (cURL -> fetch or fetch -> cURL)
- cURL command input
- Fetch URL and options JSON

## Usage

- Paste a cURL command to generate fetch
- Provide a URL + options JSON to generate cURL

## URL State

- Inputs and parameters are synced to the URL hash for sharing
- Output-only fields are excluded from URL sync

## History

- Input edits create history entries
- Parameter changes update the latest entry
