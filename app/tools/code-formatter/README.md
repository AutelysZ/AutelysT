# Code Formatter

Format code files with Prettier using a tree view and Monaco editor.

## Features

- Upload files or folders, or create new files
- Tree explorer with editable Monaco editor
- Format active file or all files with Prettier (built-in plugins for JS/TS, HTML/CSS, Markdown, YAML, GraphQL, plus Angular, Flow, Glimmer, Pug, XML, Java, BigCommerce Stencil, Gherkin, Hugo, Jinja, Nginx, Rust, SQL, TOML, XQuery)
- Shell (.sh, .bash, .zsh, .ksh) formatting via sh-syntax
- Configurable formatting options (print width, tab width, quotes, commas)
- Download a single file or all files as a ZIP
- URL-synced state and history for quick sharing and restore
- JSONata plugin omitted because the available npm package is deprecated

## URL State

- Files, active selection, and formatting options are synced to the URL
- Large inputs may skip URL sync

## History

- Input changes create history entries
- Option changes update history params
