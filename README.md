# AutelysT - Web Toolkit

[![Built with AI](https://img.shields.io/badge/Built%20with-AI-blue?style=flat-square)](https://v0.dev)
[![License: GPL v3](https://img.shields.io/badge/License-GPLv3-blue.svg)](https://www.gnu.org/licenses/gpl-3.0)
[![Next.js](https://img.shields.io/badge/Next.js-16-black?style=flat-square&logo=next.js)](https://nextjs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5-blue?style=flat-square&logo=typescript)](https://www.typescriptlang.org/)

> **🤖 This entire project was designed and built by AI** using [v0.dev](https://v0.dev) by Vercel. From architecture to implementation, every line of code, component design, and feature was generated through natural language conversations with AI.

A comprehensive web-based toolkit for developers featuring encoding tools, identifier generators, and number converters. Built with Next.js 16, React 19, and TypeScript.

## ✨ Features

### 🔐 Encoding Tools
- **Base64** - Encode/decode with 100+ text encodings (UTF-8, GBK, GB2312, etc.), URL-safe mode, MIME format
- **Base58** - Bitcoin-compatible encoding/decoding
- **Base45** - QR code and EU Digital COVID Certificate format
- **Base36** - Alphanumeric encoding
- **Base32** - TOTP/2FA compatible encoding
- **Hex (Base16)** - Hexadecimal conversion
- **Hex Escape** - Byte sequence encoding (\xff format)

### 🆔 Identifier Tools
- **UUID** - Generate and parse v1, v4, v6, v7 UUIDs with timestamp extraction
- **ULID** - Universally Unique Lexicographically Sortable Identifiers
- **KSUID** - K-Sortable Unique Identifiers
- **BSON ObjectID** - MongoDB ObjectID generation and parsing

### 🔢 Number Tools
- **Base Conversion** - Convert between binary, octal, decimal, hex, base60, and custom bases
- **Number Format** - Convert between formats including Chinese numerals (十万零五), Roman numerals, scientific notation

### 💫 Core Features
- **File Support** - Drag-and-drop or upload files for encoding/decoding
- **Text Encoding Support** - 100+ character encodings via iconv-lite
- **URL State Sync** - Share tool configurations via URL parameters
- **History Management** - IndexedDB-powered history with restore functionality
- **Search & Discovery** - Full-text search with OpenSearch browser integration
- **Dark Mode** - System-aware theme switching
- **Responsive Design** - Mobile-first responsive interface
- **Offline Ready** - Client-side processing, works without internet

## 🚀 Getting Started

### Prerequisites
- Node.js 18+
- pnpm (recommended) or npm

### Installation

```bash
# Clone the repository
git clone https://github.com/yourusername/autelyst.git
cd autelyst

# Install dependencies
pnpm install

# Run development server
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000) to see the application.

### Build for Production

```bash
# Build the application
pnpm build

# Start production server
pnpm start
```

## 🛠️ Tech Stack

### Core
- **Framework** - [Next.js 16](https://nextjs.org/) (App Router, React 19.2)
- **Language** - [TypeScript 5](https://www.typescriptlang.org/)
- **Styling** - [Tailwind CSS 4](https://tailwindcss.com/)
- **Components** - [shadcn/ui](https://ui.shadcn.com/) + [Radix UI](https://www.radix-ui.com/)

### Key Libraries
- **State Management** - React Hooks + URL State Sync
- **Form Handling** - React Hook Form + Zod validation
- **Database** - IndexedDB (via idb) for history
- **Encoding** - iconv-lite (100+ text encodings)
- **Identifiers** - uuid, ulid, ksuid, bson
- **Number Conversion** - nzh (Chinese numerals)

## 📁 Project Structure

```
├── app/                    # Next.js App Router pages
│   ├── tools/             # Individual tool pages
│   │   ├── base64/
│   │   ├── uuid/
│   │   └── ...
│   ├── search/            # Search functionality
│   └── layout.tsx         # Root layout
├── components/            # React components
│   ├── app-shell/         # Navigation, sidebar, header
│   ├── tool-ui/           # Tool-specific UI components
│   └── ui/                # shadcn/ui components
├── lib/                   # Business logic & utilities
│   ├── encoding/          # Encoding algorithms
│   ├── identifier/        # ID generation & parsing
│   ├── numbers/           # Number conversion
│   ├── history/           # IndexedDB history
│   ├── url-state/         # URL state synchronization
│   └── tools/             # Tool registry
└── public/                # Static assets
```

## 🤖 Built with AI

This project showcases the capabilities of AI-assisted development:

- **Design System** - AI generated a cohesive design with consistent typography, colors, and spacing
- **Architecture** - Modular architecture with reusable components and utilities
- **State Management** - URL-synced state with IndexedDB persistence
- **Type Safety** - Comprehensive TypeScript types throughout
- **Accessibility** - ARIA labels, keyboard navigation, and semantic HTML
- **SEO** - Dynamic metadata, sitemaps, and OpenSearch integration

Every feature request was implemented through natural language conversations, demonstrating how AI can build production-ready applications.

## 📝 License

This project is licensed under the GNU General Public License v3.0 - see the [LICENSE](LICENSE) file for details.

The GPL v3 ensures:
- ✅ Freedom to use, study, and modify the software
- ✅ Freedom to distribute modified versions
- ✅ Copyleft protection - derivative works must be open source
- ✅ No warranty or liability

## 🤝 Contributing

Contributions are welcome! Since this is an AI-built project, feel free to:

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit your changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

## 🔗 Links

- **Demo** - [autelyst.vercel.app](https://autelyst.vercel.app) (deploy your own!)
- **Built with** - [v0.dev](https://v0.dev) by Vercel
- **Report Issues** - [GitHub Issues](https://github.com/yourusername/autelyst/issues)

## 🙏 Acknowledgments

- Built entirely with [v0.dev](https://v0.dev) - Vercel's AI-powered development platform
- UI components from [shadcn/ui](https://ui.shadcn.com/)
- Icons from [Lucide](https://lucide.dev/)
- Hosted on [Vercel](https://vercel.com)

---

**Made with 🤖 by AI** | **Powered by [v0.dev](https://v0.dev)**
