import type { Tool, ToolCategory } from "./types"

export type { Tool, ToolCategory }

export const tools: Tool[] = [
  // Encoding Tools
  {
    id: "base64",
    name: "Base64",
    description: "Encode and decode Base64 with support for various text encodings, URL-safe mode, and file handling",
    category: "Encoding",
    route: "/tools/base64",
    keywords: ["base64", "encode", "decode", "binary", "text", "file"],
    seo: {
      title: "Base64 Encoder/Decoder - AutelysT",
      description:
        "Free online Base64 encoder and decoder. Supports UTF-8, URL-safe mode, MIME format, and 100+ text encodings including GBK, GB2312.",
      keywords: ["base64", "encoder", "decoder", "online tool", "utf-8", "url-safe"],
    },
  },
  {
    id: "base58",
    name: "Base58",
    description: "Encode and decode Base58, commonly used in Bitcoin addresses",
    category: "Encoding",
    route: "/tools/base58",
    keywords: ["base58", "encode", "decode", "bitcoin", "cryptocurrency"],
    seo: {
      title: "Base58 Encoder/Decoder - AutelysT",
      description: "Free online Base58 encoder and decoder. Used in Bitcoin, IPFS, and other cryptocurrency addresses.",
      keywords: ["base58", "encoder", "decoder", "bitcoin", "cryptocurrency"],
    },
  },
  {
    id: "base45",
    name: "Base45",
    description: "Encode and decode Base45, used in EU Digital COVID Certificates",
    category: "Encoding",
    route: "/tools/base45",
    keywords: ["base45", "encode", "decode", "qr", "covid", "certificate"],
    seo: {
      title: "Base45 Encoder/Decoder - AutelysT",
      description: "Free online Base45 encoder and decoder. Used in QR codes and EU Digital COVID Certificates.",
      keywords: ["base45", "encoder", "decoder", "qr code"],
    },
  },
  {
    id: "base36",
    name: "Base36",
    description: "Encode and decode Base36 using alphanumeric characters",
    category: "Encoding",
    route: "/tools/base36",
    keywords: ["base36", "encode", "decode", "alphanumeric"],
    seo: {
      title: "Base36 Encoder/Decoder - AutelysT",
      description: "Free online Base36 encoder and decoder. Convert between text and base36 representation.",
      keywords: ["base36", "encoder", "decoder", "alphanumeric"],
    },
  },
  {
    id: "base32",
    name: "Base32",
    description: "Encode and decode Base32, commonly used in TOTP and file systems",
    category: "Encoding",
    route: "/tools/base32",
    keywords: ["base32", "encode", "decode", "totp", "2fa"],
    seo: {
      title: "Base32 Encoder/Decoder - AutelysT",
      description:
        "Free online Base32 encoder and decoder. Used in TOTP authenticators and case-insensitive file systems.",
      keywords: ["base32", "encoder", "decoder", "totp", "2fa"],
    },
  },
  {
    id: "hex",
    name: "Hex (Base16)",
    description: "Encode and decode hexadecimal (Base16)",
    category: "Encoding",
    route: "/tools/hex",
    keywords: ["hex", "hexadecimal", "base16", "encode", "decode"],
    seo: {
      title: "Hex (Base16) Encoder/Decoder - AutelysT",
      description: "Free online Hexadecimal encoder and decoder. Convert text to hex and hex to text.",
      keywords: ["hex", "hexadecimal", "base16", "encoder", "decoder"],
    },
  },
  {
    id: "hex-escape",
    name: "Hex Escape",
    description: "Encode and decode hex escape sequences like \\xff\\x00",
    category: "Encoding",
    route: "/tools/hex-escape",
    keywords: ["hex", "escape", "encode", "decode", "byte"],
    seo: {
      title: "Hex Escape Encoder/Decoder - AutelysT",
      description: "Free online Hex escape sequence encoder and decoder. Convert to and from \\xff format.",
      keywords: ["hex escape", "encoder", "decoder", "byte sequence"],
    },
  },
  // Crypto Tools
  {
    id: "password-generator",
    name: "Password Generator",
    description: "Generate secure passwords with ASCII and base encoding serialization options",
    category: "Crypto",
    route: "/tools/password-generator",
    keywords: ["password", "generator", "random", "secure", "ascii", "base64", "base58", "base45", "base32", "hex"],
    seo: {
      title: "Password Generator - AutelysT",
      description:
        "Free online password generator. Create strong passwords with Graphic ASCII, Base64, Hex, Base58, Base45, or Base32 serialization.",
      keywords: ["password generator", "secure password", "random password", "base64", "hex", "base58"],
    },
  },
  // Identifier Tools
  {
    id: "uuid",
    name: "UUID",
    description: "Generate and parse UUIDs v1, v4, v6, and v7 with timestamp and node ID extraction",
    category: "Identifier",
    route: "/tools/uuid",
    keywords: ["uuid", "guid", "generate", "parse", "v1", "v4", "v6", "v7", "timestamp"],
    seo: {
      title: "UUID - AutelysT",
      description:
        "Free online UUID generator and parser. Generate v1, v4, v6, v7 UUIDs and parse to extract timestamp, node ID, and version info.",
      keywords: ["uuid generator", "uuid parser", "guid", "v1", "v4", "v6", "v7"],
    },
  },
  {
    id: "ulid",
    name: "ULID",
    description: "Generate and parse ULIDs (Universally Unique Lexicographically Sortable Identifiers)",
    category: "Identifier",
    route: "/tools/ulid",
    keywords: ["ulid", "generate", "parse", "sortable", "timestamp", "unique"],
    seo: {
      title: "ULID - AutelysT",
      description:
        "Free online ULID generator and parser. Generate ULIDs and parse to extract timestamp and randomness.",
      keywords: ["ulid generator", "ulid parser", "sortable identifier"],
    },
  },
  {
    id: "ksuid",
    name: "KSUID",
    description: "Generate and parse KSUIDs (K-Sortable Unique Identifiers)",
    category: "Identifier",
    route: "/tools/ksuid",
    keywords: ["ksuid", "generate", "parse", "sortable", "timestamp", "unique"],
    seo: {
      title: "KSUID - AutelysT",
      description:
        "Free online KSUID generator and parser. Generate KSUIDs and parse to extract timestamp and payload.",
      keywords: ["ksuid generator", "ksuid parser", "sortable identifier"],
    },
  },
  {
    id: "objectid",
    name: "BSON ObjectID",
    description: "Generate and parse MongoDB BSON ObjectIDs",
    category: "Identifier",
    route: "/tools/objectid",
    keywords: ["objectid", "mongodb", "bson", "generate", "parse", "timestamp"],
    seo: {
      title: "BSON ObjectID - AutelysT",
      description:
        "Free online MongoDB BSON ObjectID generator and parser. Generate ObjectIDs and parse to extract timestamp and machine info.",
      keywords: ["objectid generator", "objectid parser", "mongodb", "bson"],
    },
  },
  // Number Tools
  {
    id: "radix",
    name: "Base Conversion",
    description:
      "Convert numbers between different radixes (bases) including binary, octal, decimal, hexadecimal, and base60",
    category: "Numbers",
    route: "/tools/radix",
    keywords: ["radix", "base", "convert", "binary", "octal", "decimal", "hex", "base60"],
    seo: {
      title: "Radix/Base Converter - AutelysT",
      description:
        "Free online number base converter. Convert between binary, octal, decimal, hexadecimal, base60, and custom bases.",
      keywords: ["radix converter", "base converter", "binary", "hexadecimal"],
    },
  },
  {
    id: "number-format",
    name: "Number Format",
    description:
      "Convert number formatting styles including grouping, Chinese numerals, Roman numerals, and scientific notation",
    category: "Numbers",
    route: "/tools/number-format",
    keywords: ["number", "format", "thousand", "separator", "chinese", "roman", "scientific"],
    seo: {
      title: "Number Format Converter - AutelysT",
      description:
        "Free online number format converter. Convert between different number representations including Chinese, Roman, and scientific notation.",
      keywords: ["number format", "thousand separator", "chinese numerals", "roman numerals"],
    },
  },
  // Date & Time Tools
  {
    id: "timezone",
    name: "Time Zone Converter",
    description: "Convert times between different time zones with Unix epoch support",
    category: "Date & Time",
    route: "/tools/timezone",
    keywords: ["timezone", "time", "date", "convert", "epoch", "unix", "utc", "iana"],
    seo: {
      title: "Time Zone Converter - AutelysT",
      description:
        "Free online time zone converter. Convert times between different time zones with Unix epoch timestamp support. Supports all IANA time zones.",
      keywords: ["timezone converter", "time zone", "unix timestamp", "epoch converter"],
    },
  },
  // Web Tools
  {
    id: "url-encode",
    name: "URL Encoder/Decoder",
    description: "Encode and decode URL strings with detailed URL parsing including search params and hash params",
    category: "Web",
    route: "/tools/url-encode",
    keywords: ["url", "encode", "decode", "percent", "uri", "query", "parser", "search params", "hash"],
    seo: {
      title: "URL Encoder/Decoder - AutelysT",
      description:
        "Free online URL encoder and decoder. Encode and decode URL strings with detailed parsing of protocol, hostname, pathname, search params, and hash params.",
      keywords: ["url encoder", "url decoder", "percent encoding", "uri encode", "query string", "url parser"],
    },
  },
  // Data Tools
  {
    id: "json-diff",
    name: "JSON Diff Viewer",
    description: "Compare two JSON files or inputs and view differences with table and text views",
    category: "Data",
    route: "/tools/json-diff",
    keywords: ["json", "diff", "compare", "viewer", "difference", "file"],
    seo: {
      title: "JSON Diff Viewer - AutelysT",
      description: "Free online JSON diff viewer. Compare two JSON files with table and unified text views.",
      keywords: ["json diff", "json compare", "diff viewer", "json comparison"],
    },
  },
  {
    id: "yaml-diff",
    name: "YAML Diff Viewer",
    description: "Compare two YAML files or inputs and view differences with table and text views",
    category: "Data",
    route: "/tools/yaml-diff",
    keywords: ["yaml", "diff", "compare", "viewer", "difference", "file"],
    seo: {
      title: "YAML Diff Viewer - AutelysT",
      description: "Free online YAML diff viewer. Compare two YAML files with table and unified text views.",
      keywords: ["yaml diff", "yaml compare", "diff viewer", "yaml comparison"],
    },
  },
  {
    id: "json-schema",
    name: "JSON Schema Generator",
    description: "Generate JSON Schema from sample JSON data with automatic type inference",
    category: "Data",
    route: "/tools/json-schema",
    keywords: ["json", "schema", "generate", "validate", "draft", "inference"],
    seo: {
      title: "JSON Schema Generator - AutelysT",
      description: "Free online JSON Schema generator. Generate JSON Schema from sample data with type inference.",
      keywords: ["json schema", "schema generator", "json validation", "json schema draft"],
    },
  },
  {
    id: "text-diff",
    name: "Text Diff Viewer",
    description: "Compare two text files with GitHub-style unified diff, character highlighting, and fullscreen mode",
    category: "Data",
    route: "/tools/text-diff",
    keywords: ["text", "diff", "compare", "viewer", "difference", "file", "line", "unified"],
    seo: {
      title: "Text Diff Viewer - AutelysT",
      description: "Free online text diff viewer. Compare text files with GitHub-style unified diff view.",
      keywords: ["text diff", "text compare", "diff viewer", "file comparison", "unified diff"],
    },
  },
  {
    id: "format-converter",
    name: "Format Converter",
    description: "Convert between JSON, YAML, and TOML formats with auto-detection",
    category: "Data",
    route: "/tools/format-converter",
    keywords: ["json", "yaml", "toml", "convert", "format", "transform"],
    seo: {
      title: "Format Converter - AutelysT",
      description: "Free online format converter. Convert between JSON, YAML, and TOML formats instantly.",
      keywords: ["json to yaml", "yaml to json", "toml converter", "format converter"],
    },
  },
]

export function getToolById(id: string): Tool | undefined {
  return tools.find((tool) => tool.id === id)
}

export function getToolsByCategory(category: ToolCategory): Tool[] {
  return tools.filter((tool) => tool.category === category)
}

export function getToolCategories(): ToolCategory[] {
  return [...new Set(tools.map((tool) => tool.category))]
}

export function searchTools(query: string): Tool[] {
  const lowerQuery = query.toLowerCase()
  return tools.filter(
    (tool) =>
      tool.name.toLowerCase().includes(lowerQuery) ||
      tool.description.toLowerCase().includes(lowerQuery) ||
      tool.keywords.some((kw) => kw.toLowerCase().includes(lowerQuery)),
  )
}

export function getToolsGroupedByCategory(): Record<ToolCategory, Tool[]> {
  const grouped: Partial<Record<ToolCategory, Tool[]>> = {}
  for (const tool of tools) {
    if (!grouped[tool.category]) {
      grouped[tool.category] = []
    }
    grouped[tool.category]!.push(tool)
  }
  return grouped as Record<ToolCategory, Tool[]>
}
