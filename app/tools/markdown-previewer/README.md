# Markdown Previewer

A live Markdown editor with a real-time preview pane, history support, and shareable URL state.

## Features

- **Live Preview**: See rendered Markdown as you type
- **Split/Editor/Preview Modes**: Switch between split view or focus on one pane
- **Upload (HTML/Markdown)**: Load `.md` or `.html` files via the toolbar or drag-and-drop into the editor
- **Download Markdown**: Export your Markdown as a `.md` file
- **Export HTML**: Save the rendered Markdown as a standalone HTML document
- **Print Preview**: Print the rendered Markdown directly from the preview pane
- **History Support**: Restore previous Markdown sessions from history
- **URL Sync**: Share Markdown via URL (small inputs)
- **Markdown Subset**: Headings, lists, blockquotes, code blocks, inline code, links, emphasis, strikethrough, and horizontal rules

## Usage

1. **Write Markdown**: Type in the editor on the left
2. **Switch Views**: Choose Split, Editor, or Preview depending on your workflow
3. **Preview Output**: Rendered Markdown appears instantly on the right

## Notes

- Rendering and HTML export use `marked` with `marked-highlight` + `highlight.js`; HTML import uses `turndown`.
- Large Markdown inputs are excluded from the URL to keep links short.
