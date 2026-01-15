import { z } from "zod"

export interface ToolSEO {
  title: string
  description: string
  keywords?: string[]
}

export interface Tool {
  id: string
  name: string
  description: string
  category: ToolCategory
  route: string
  keywords: string[]
  seo: ToolSEO
  icon?: string
}

export type ToolCategory =
  | "Encoding"
  | "Numbers"
  | "Identifier"
  | "Text"
  | "Date & Time"
  | "Crypto"
  | "Web"
  | "Data"
  | "Misc"

export const CATEGORY_KEYWORDS: Record<ToolCategory, string[]> = {
  Encoding: [
    "base64",
    "base58",
    "base45",
    "base36",
    "base32",
    "hex",
    "encode",
    "decode",
    "escape",
    "unescape",
    "url",
    "uri",
  ],
  Numbers: ["number", "radix", "convert", "binary", "decimal", "octal", "hexadecimal", "format", "roman", "chinese"],
  Identifier: ["uuid", "ulid", "ksuid", "objectid", "guid", "id", "unique", "generate"],
  Text: ["text", "string", "regex", "replace", "format", "case", "trim", "split", "join"],
  "Date & Time": ["date", "time", "timestamp", "timezone", "epoch", "unix", "calendar"],
  Crypto: ["hash", "md5", "sha", "encrypt", "decrypt", "aes", "rsa", "hmac"],
  Web: ["json", "xml", "html", "css", "url", "query", "jwt", "uuid"],
  Data: ["json", "diff", "compare", "schema", "text", "viewer", "generate"],
  Misc: [],
}

export function categorizeByKeywords(keywords: string[]): ToolCategory {
  const scores: Record<ToolCategory, number> = {
    Encoding: 0,
    Numbers: 0,
    Identifier: 0,
    Text: 0,
    "Date & Time": 0,
    Crypto: 0,
    Web: 0,
    Data: 0,
    Misc: 0,
  }

  for (const keyword of keywords) {
    const lowerKeyword = keyword.toLowerCase()
    for (const [category, categoryKeywords] of Object.entries(CATEGORY_KEYWORDS)) {
      if (categoryKeywords.some((ck) => lowerKeyword.includes(ck) || ck.includes(lowerKeyword))) {
        scores[category as ToolCategory]++
      }
    }
  }

  const maxScore = Math.max(...Object.values(scores))
  if (maxScore === 0) return "Misc"

  return Object.entries(scores).find(([, score]) => score === maxScore)![0] as ToolCategory
}

export const toolParamsSchema = z.record(z.string(), z.union([z.string(), z.boolean(), z.number()]).nullable())

export type ToolParams = z.infer<typeof toolParamsSchema>
