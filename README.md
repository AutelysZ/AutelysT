# AutelysT - Web Toolkit

[![License: GPL v3](https://img.shields.io/badge/License-GPLv3-blue.svg)](https://www.gnu.org/licenses/gpl-3.0)
[![Next.js](https://img.shields.io/badge/Next.js-16-black?logo=next.js)](https://nextjs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5-blue?logo=typescript)](https://typescriptlang.org/)

A comprehensive web-based developer toolkit featuring encoding tools, password generation, identifier generators, time conversion, diff viewers, and more. Built with Next.js 16, React 19, and TypeScript.

## Features

### Encoding Tools
Base64, Base58, Base45, Base36, Base32, Hex, Hex Escape, HTML Encoder/Decoder with 100+ text encodings, file upload/download, and URL-safe modes.

### Crypto Tools
- **Password Generator** - Generate secure passwords with ASCII and base serialization options
- **Keypair Generator** - Generate RSA/EC/Ed keypairs with PEM and JWK export
- **JWK Converter** - Convert cryptographic keys between PEM and JWK formats
- **JWT** - Parse, edit, and generate JSON Web Tokens with signature validation
- **Signature** - Sign and verify messages with HMAC, RSA, ECDSA, and EdDSA
- **Hash** - Generate MD, SHA, SHA3, and BLAKE hash digests
- **Symmetric Encryption** - Encrypt/decrypt using AES, ChaCha20, Salsa20, DES, or 3DES

### Identifier Tools
Generate and parse UUID (v1/v4/v6/v7), ULID, KSUID, BSON ObjectID, and Snowflake ID with timestamp extraction.

### Data Tools
- **JSON/YAML Diff Viewer** - Compare files with table and GitHub-style unified text views, character-level highlighting, fullscreen mode
- **Text Diff Viewer** - Compare text files with collapsible hunks and character highlighting
- **JSON Schema Generator** - Generate JSON Schema from sample data
- **Format Converter** - Convert between JSON, YAML, and TOML with auto-detection

### Converters
- **Base Conversion** - Convert between binary, decimal, hex, and custom bases
- **Number Format** - Chinese numerals, Roman numerals, scientific notation
- **Timezone** - Convert times between timezones with Unix epoch support
- **World Clock** - View multiple time zones with live or custom reference time
- **URL Encoder** - Encode/decode URLs with component parsing

### Core Features
- **Search** - Full-text tool search with OpenSearch browser integration
- **Favorites** - Star frequently used tools
- **History** - Automatic state persistence with IndexedDB
- **URL Sharing** - Share tool configurations via URL parameters
- **Dark Mode** - System-aware theme switching (light/dark/system)

## Getting Started

```bash
pnpm install && pnpm dev
```

Open [http://localhost:3000](http://localhost:3000)

## Tech Stack

Next.js 16, React 19, TypeScript 5, Tailwind CSS 4, shadcn/ui, IndexedDB

## License

GNU General Public License v3.0

---

**Built with AI** | Powered by [v0.dev](https://v0.dev)
