# AutelysT - Web Toolkit

[![License: GPL v3](https://img.shields.io/badge/License-GPLv3-blue.svg)](https://www.gnu.org/licenses/gpl-3.0)
[![Next.js](https://img.shields.io/badge/Next.js-16-black?logo=next.js)](https://nextjs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5-blue?logo=typescript)](https://typescriptlang.org/)

A comprehensive web-based developer toolkit featuring encoding tools, identifier generators, time conversion, and URL utilities. Built with Next.js 16, React 19, and TypeScript.

## Features

### Encoding Tools
Base64, Base58, Base45, Base36, Base32, Hex, Hex Escape with support for 100+ text encodings (UTF-8, GBK, GB2312, Big5, etc.), file upload/download, and URL-safe modes.

### Identifier Tools
Generate and parse UUID (v1/v4/v6/v7), ULID, KSUID, and BSON ObjectID with timestamp and metadata extraction.

### Converters
- **Base Conversion** - Convert between binary, decimal, hex, and custom bases (2-64)
- **Number Format** - Convert to/from Chinese numerals, Roman numerals, scientific notation
- **Timezone** - Convert times between timezones with Unix epoch support
- **URL Encoder** - Encode/decode URLs with detailed component parsing

### Core Features
- **Search** - Full-text tool search with OpenSearch browser integration
- **Favorites** - Star frequently used tools
- **History** - Automatic state persistence with IndexedDB
- **URL Sharing** - Share tool configurations via URL parameters
- **Dark Mode** - System-aware theme switching (light/dark/system)
- **Responsive** - Mobile-first design with collapsible sidebar

## Getting Started

```bash
# Install dependencies
pnpm install

# Run development server
pnpm dev

# Build for production
pnpm build && pnpm start
```

Open [http://localhost:3000](http://localhost:3000)

## Tech Stack

- **Framework** - Next.js 16 (App Router, React 19.2)
- **Language** - TypeScript 5
- **Styling** - Tailwind CSS 4, shadcn/ui, Radix UI
- **Storage** - IndexedDB (idb)
- **Libraries** - iconv-lite, uuid, ulid, ksuid, bson, nzh, date-fns

## Project Structure

```
app/                    # Next.js pages
  tools/                # Tool pages (base64, uuid, timezone, etc.)
components/             # React components
  app-shell/            # Navigation, sidebar
  tool-ui/              # Shared tool UI components
  ui/                   # shadcn/ui components
lib/                    # Business logic
  encoding/             # Encoding algorithms
  identifier/           # ID generation
  timezone/             # Time conversion
  url/                  # URL parsing
  history/              # IndexedDB storage
  tools/                # Tool registry
```

## License

GNU General Public License v3.0 - see [LICENSE](LICENSE)

## Contributing

Contributions welcome! Fork, create a feature branch, and submit a PR.

---

**Built with AI** | Powered by [v0.dev](https://v0.dev)
