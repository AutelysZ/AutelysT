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
