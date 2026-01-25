# URL Builder

Parse a URL into editable components and rebuild it with custom percent-encoding.

## Features

- Parse full URLs into protocol, auth, host, path, query params, and hash params
- Treat hash as `pathname?query` and edit both sections
- Edit query and hash parameters with add/remove rows
- Choose the percent-encoding charset (UTF-8, GBK, etc.) for pathname, query, and hash values
- URL sync and history integration

## Usage

1. Paste a URL into the input field
2. Adjust components or parameters as needed
3. Copy the rebuilt URL

## Notes

- Query and hash params are percent-encoded using the selected charset.
