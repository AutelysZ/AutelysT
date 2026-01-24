# HTML Renderer

A live HTML editor with Monaco Editor syntax highlighting and real-time iframe preview that allows users to write HTML code and see instant rendered output.

## Features

- **Monaco Editor**: Professional code editor with HTML syntax highlighting, line numbers, and IntelliSense
- **Pretty Print**: Format HTML code using Prettier with one click
- **Live HTML Editing**: Write HTML code with automatic type detection
- **Real-time Preview**: See changes instantly with throttled auto-refresh
- **Smart Detection**: Automatically detects HTML snippets vs full documents
- **File Operations**: Upload HTML files, copy to clipboard, download your work
- **Fullscreen Mode**: Expand preview to full screen for better viewing
- **Console Panel**: Chrome-like output with filters, timestamps toggle, clear action, collapsible error stacks, and resizable height
- **History Support**: Track and restore previous editing sessions
- **URL Sync**: Share your HTML content via URL (for small files)
- **Clean Interface**: Streamlined layout following Hash tool design pattern

## Usage

1. **Write HTML**: Start typing HTML code in the Monaco Editor with syntax highlighting
2. **Pretty Print**: Click the "Pretty" button to format your HTML code using Prettier
3. **Auto-Detection**: The tool automatically detects if you're writing a snippet or full document
4. **Preview**: See rendered output in the preview pane with automatic updates
5. **File Operations**:
   - **Pretty**: Format HTML code using Prettier (Sparkles icon)
   - Upload existing HTML files (File button)
   - Copy HTML code to clipboard (Copy button)
   - Download your HTML as a file (Download button)
   - View preview in fullscreen mode (Fullscreen button)

## Editor Features

### Monaco Editor Capabilities
- **Syntax Highlighting**: Full HTML syntax highlighting with proper color coding
- **Line Numbers**: Easy navigation and reference
- **Auto Wrapping**: Long lines automatically wrap for better readability
- **Theme Support**: Adapts to light/dark theme automatically
- **Smart Indentation**: Proper HTML indentation and formatting

### Pretty Print Feature
- **Prettier Integration**: Uses industry-standard Prettier formatter
- **Configurable Options**: 
  - 2-space indentation
  - 120 character line width
  - HTML-specific whitespace handling
  - Attribute formatting rules
- **Error Handling**: Falls back to original code if formatting fails

## Detection Modes

### HTML Snippet Mode (Auto-Detected)
- Edit HTML fragments (like `<div>content</div>`)
- Automatically wraps your code in a basic HTML structure for preview
- Perfect for quick prototyping and testing components
- Detected when no DOCTYPE, html, head, or body tags are found

### Full Document Mode (Auto-Detected)
- Complete HTML documents with `<!DOCTYPE>`, `<html>`, `<head>`, `<body>`
- Full control over CSS, JavaScript, and meta tags
- Best for creating complete web pages
- Detected when HTML document structure is present

The tool automatically handles both snippets and full documents without manual configuration.

## Security

The iframe preview uses sandbox attributes for security:
- `allow-scripts`: Allows JavaScript execution
- `allow-same-origin`: Allows same-origin requests
- `allow-forms`: Allows form submissions
- `allow-modals`: Allows modal dialogs

## Tips

- Monaco Editor provides professional-grade editing experience with auto-completion
- Use the Pretty button to clean up messy HTML code
- Preview automatically refreshes with 300ms throttling for smooth editing
- HTML content over 2KB is not synced to URL to prevent long URLs
- Your editing history is automatically saved locally
- Use Fullscreen mode to preview responsive designs
- The tool intelligently handles both snippets and full documents without manual configuration
- Pretty Print is disabled while formatting to prevent conflicts
