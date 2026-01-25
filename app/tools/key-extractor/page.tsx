"use client"

import * as React from "react"
import { Suspense } from "react"
import { z } from "zod"
import { Check, Copy, Download, Upload, X } from "lucide-react"
import { ToolPageWrapper, useToolHistoryContext } from "@/components/tool-ui/tool-page-wrapper"
import { DEFAULT_URL_SYNC_DEBOUNCE_MS, useUrlSyncedState } from "@/lib/url-state/use-url-synced-state"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { Button } from "@/components/ui/button"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import type { HistoryEntry } from "@/lib/history/db"
import { detectBase64Options, decodeBase64, encodeBase64, isValidBase64 } from "@/lib/encoding/base64"
import { decodeHex, encodeHex, isValidHex } from "@/lib/encoding/hex"
import { cn } from "@/lib/utils"

const rsaAlgorithms = ["rsassa-sha256", "rsa-pss-sha256", "rsa-oaep-sha256"] as const
const ecAlgorithms = [
  "ecdsa-p256",
  "ecdsa-p384",
  "ecdsa-p521",
  "ecdh-p256",
  "ecdh-p384",
  "ecdh-p521",
] as const
const okpAlgorithms = ["ed25519", "ed448", "x25519", "x448"] as const
const algorithmValues = ["auto", ...rsaAlgorithms, ...ecAlgorithms, ...okpAlgorithms] as const

const algorithmFamilies = {
  auto: ["auto"],
  rsa: rsaAlgorithms,
  ec: ecAlgorithms,
  okp: okpAlgorithms,
} as const

const inputEncodings = [
  "auto",
  "pem",
  "jwk",
  "der-base64",
  "der-base64url",
  "der-hex",
  "der-binary",
] as const
const outputEncodings = ["pem", "jwk", "der-base64", "der-base64url", "der-hex", "der-binary"] as const

const paramsSchema = z.object({
  input: z.string().default(""),
  algorithm: z.enum(algorithmValues).default("auto"),
  inputEncoding: z.enum(inputEncodings).default("auto"),
  outputEncoding: z.enum(outputEncodings).default("jwk"),
})

type AlgorithmValue = (typeof algorithmValues)[number]
type AlgorithmFamily = keyof typeof algorithmFamilies
type InputEncoding = (typeof inputEncodings)[number]
type OutputEncoding = (typeof outputEncodings)[number]
type DetectedEncoding = Exclude<InputEncoding, "auto">
type KeyFormat = "spki" | "pkcs8"

type HashName = "SHA-256" | "SHA-384" | "SHA-512"
type NamedCurve = "P-256" | "P-384" | "P-521"
type AlgorithmConfig =
  | { name: "RSASSA-PKCS1-v1_5"; hash: HashName }
  | { name: "RSA-PSS"; hash: HashName }
  | { name: "RSA-OAEP"; hash: HashName }
  | { name: "ECDSA"; namedCurve: NamedCurve }
  | { name: "ECDH"; namedCurve: NamedCurve }
  | { name: "Ed25519" }
  | { name: "Ed448" }
  | { name: "X25519" }
  | { name: "X448" }

const algorithmFamilyLabels: Record<AlgorithmFamily, string> = {
  auto: "Auto",
  rsa: "RSA",
  ec: "EC",
  okp: "OKP",
}

const algorithmLabels: Record<AlgorithmValue, string> = {
  auto: "Auto detect",
  "rsassa-sha256": "RSASSA-PKCS1-v1_5 (SHA-256)",
  "rsa-pss-sha256": "RSA-PSS (SHA-256)",
  "rsa-oaep-sha256": "RSA-OAEP (SHA-256)",
  "ecdsa-p256": "ECDSA (P-256)",
  "ecdsa-p384": "ECDSA (P-384)",
  "ecdsa-p521": "ECDSA (P-521)",
  "ecdh-p256": "ECDH (P-256)",
  "ecdh-p384": "ECDH (P-384)",
  "ecdh-p521": "ECDH (P-521)",
  ed25519: "Ed25519",
  ed448: "Ed448",
  x25519: "X25519",
  x448: "X448",
}

const encodingLabels: Record<DetectedEncoding | "auto", string> = {
  auto: "Auto",
  pem: "PEM (SPKI/PKCS8)",
  jwk: "JWK",
  "der-base64": "DER (Base64)",
  "der-base64url": "DER (Base64url)",
  "der-hex": "DER (Hex)",
  "der-binary": "DER (Binary)",
}

const outputEncodingLabels: Record<OutputEncoding, string> = {
  pem: "PEM",
  jwk: "JWK",
  "der-base64": "DER Base64",
  "der-base64url": "DER Base64url",
  "der-hex": "DER Hex",
  "der-binary": "DER Binary",
}

const algorithmConfigByValue: Record<Exclude<AlgorithmValue, "auto">, AlgorithmConfig> = {
  "rsassa-sha256": { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
  "rsa-pss-sha256": { name: "RSA-PSS", hash: "SHA-256" },
  "rsa-oaep-sha256": { name: "RSA-OAEP", hash: "SHA-256" },
  "ecdsa-p256": { name: "ECDSA", namedCurve: "P-256" },
  "ecdsa-p384": { name: "ECDSA", namedCurve: "P-384" },
  "ecdsa-p521": { name: "ECDSA", namedCurve: "P-521" },
  "ecdh-p256": { name: "ECDH", namedCurve: "P-256" },
  "ecdh-p384": { name: "ECDH", namedCurve: "P-384" },
  "ecdh-p521": { name: "ECDH", namedCurve: "P-521" },
  ed25519: { name: "Ed25519" },
  ed448: { name: "Ed448" },
  x25519: { name: "X25519" },
  x448: { name: "X448" },
}

const pemAutoCandidates: AlgorithmConfig[] = [
  { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
  { name: "RSA-PSS", hash: "SHA-256" },
  { name: "RSA-OAEP", hash: "SHA-256" },
  { name: "ECDSA", namedCurve: "P-256" },
  { name: "ECDSA", namedCurve: "P-384" },
  { name: "ECDSA", namedCurve: "P-521" },
  { name: "ECDH", namedCurve: "P-256" },
  { name: "ECDH", namedCurve: "P-384" },
  { name: "ECDH", namedCurve: "P-521" },
  { name: "Ed25519" },
  { name: "Ed448" },
  { name: "X25519" },
  { name: "X448" },
]

function toPem(buffer: ArrayBuffer, label: "PUBLIC KEY" | "PRIVATE KEY") {
  const bytes = new Uint8Array(buffer)
  let binary = ""
  for (const byte of bytes) {
    binary += String.fromCharCode(byte)
  }
  const base64 = btoa(binary).replace(/(.{64})/g, "$1\n")
  return `-----BEGIN ${label}-----\n${base64}\n-----END ${label}-----`
}

function extractPemBlock(pem: string) {
  const trimmed = pem.trim()
  if (!trimmed) return null
  const match = trimmed.match(/-----BEGIN ([^-]+)-----([\s\S]+?)-----END \1-----/)
  if (!match) return null
  const label = match[1]
  const body = match[2].replace(/\s+/g, "")
  return { label, body }
}

function pemToArrayBuffer(pem: string) {
  const block = extractPemBlock(pem)
  if (!block) return null
  const binary = atob(block.body)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i)
  }
  return { label: block.label, buffer: bytes.buffer }
}

function inferHashFromAlg(value?: string): HashName {
  if (!value) return "SHA-256"
  if (value.includes("384")) return "SHA-384"
  if (value.includes("512")) return "SHA-512"
  return "SHA-256"
}

function inferAlgorithmFromJwk(jwk: JsonWebKey): AlgorithmConfig | null {
  if (jwk.kty === "RSA") {
    const alg = typeof jwk.alg === "string" ? jwk.alg : undefined
    const hash = inferHashFromAlg(alg)
    if (alg?.startsWith("PS")) return { name: "RSA-PSS", hash }
    if (alg?.startsWith("RS")) return { name: "RSASSA-PKCS1-v1_5", hash }
    if (alg?.startsWith("RSA-OAEP")) return { name: "RSA-OAEP", hash }
    return { name: "RSASSA-PKCS1-v1_5", hash }
  }

  if (jwk.kty === "EC") {
    const crv = jwk.crv as NamedCurve | undefined
    if (!crv) return null
    const alg = typeof jwk.alg === "string" ? jwk.alg : undefined
    if (alg?.startsWith("ECDH")) return { name: "ECDH", namedCurve: crv }
    return { name: "ECDSA", namedCurve: crv }
  }

  if (jwk.kty === "OKP") {
    const crv = jwk.crv
    if (crv === "Ed25519") return { name: "Ed25519" }
    if (crv === "Ed448") return { name: "Ed448" }
    if (crv === "X25519") return { name: "X25519" }
    if (crv === "X448") return { name: "X448" }
  }

  return null
}

function getKeyUsages(alg: AlgorithmConfig["name"], isPrivate: boolean): KeyUsage[] {
  if (alg === "RSA-OAEP") return isPrivate ? ["decrypt"] : ["encrypt"]
  if (alg === "ECDH" || alg === "X25519" || alg === "X448") {
    return isPrivate ? ["deriveBits"] : []
  }
  if (alg === "RSASSA-PKCS1-v1_5" || alg === "RSA-PSS" || alg === "ECDSA" || alg === "Ed25519" || alg === "Ed448") {
    return isPrivate ? ["sign"] : ["verify"]
  }
  return []
}

function getAlgorithmConfig(value: AlgorithmValue, jwk?: JsonWebKey): AlgorithmConfig | null {
  if (value !== "auto") return algorithmConfigByValue[value]
  if (jwk) return inferAlgorithmFromJwk(jwk)
  return null
}

type ImportAlgorithm = AlgorithmIdentifier | RsaHashedImportParams | EcKeyImportParams

function buildAlgorithmParams(config: AlgorithmConfig): ImportAlgorithm {
  if (config.name === "RSASSA-PKCS1-v1_5" || config.name === "RSA-PSS" || config.name === "RSA-OAEP") {
    return { name: config.name, hash: { name: config.hash } } as RsaHashedImportParams
  }
  if (config.name === "ECDSA" || config.name === "ECDH") {
    return { name: config.name, namedCurve: config.namedCurve } as EcKeyImportParams
  }
  return { name: config.name }
}

async function importPemKey(pem: string, config: AlgorithmConfig, isPrivate: boolean) {
  const parsed = pemToArrayBuffer(pem)
  if (!parsed) throw new Error("PEM block not found.")
  if (
    parsed.label !== "PUBLIC KEY" &&
    parsed.label !== "PRIVATE KEY" &&
    parsed.label.includes("PRIVATE KEY")
  ) {
    throw new Error("Unsupported PEM format. Use PKCS8 for private keys.")
  }
  if (parsed.label !== "PUBLIC KEY" && parsed.label !== "PRIVATE KEY") {
    throw new Error("Unsupported PEM format. Use SPKI public keys or PKCS8 private keys.")
  }
  const format = isPrivate ? "pkcs8" : "spki"
  const algorithm = buildAlgorithmParams(config)
  const usages = getKeyUsages(config.name, isPrivate)
  return crypto.subtle.importKey(format, parsed.buffer, algorithm, true, usages)
}

async function importDerKey(buffer: ArrayBuffer, config: AlgorithmConfig, format: KeyFormat) {
  const isPrivate = format === "pkcs8"
  const algorithm = buildAlgorithmParams(config)
  const usages = getKeyUsages(config.name, isPrivate)
  return crypto.subtle.importKey(format, buffer, algorithm, true, usages)
}

async function importJwkKey(jwk: JsonWebKey, config: AlgorithmConfig, isPrivate: boolean) {
  const algorithm = buildAlgorithmParams(config)
  const usages = getKeyUsages(config.name, isPrivate)
  return crypto.subtle.importKey("jwk", jwk, algorithm, true, usages)
}

function parseJwkText(value: string): JsonWebKey {
  const trimmed = value.trim()
  if (!trimmed) throw new Error("JWK is empty.")
  let parsed: unknown
  try {
    parsed = JSON.parse(trimmed)
  } catch (error) {
    throw new Error(error instanceof Error ? error.message : "Invalid JSON.")
  }
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new Error("JWK must be a JSON object.")
  }
  const jwk = parsed as JsonWebKey
  if (!jwk.kty) throw new Error("JWK is missing kty.")
  return jwk
}

function detectEncoding(value: string): DetectedEncoding | null {
  const trimmed = value.trim()
  if (!trimmed) return null
  if (trimmed.includes("-----BEGIN")) return "pem"
  if (trimmed.startsWith("{")) {
    try {
      const parsed = JSON.parse(trimmed)
      if (parsed && typeof parsed === "object" && "kty" in parsed) {
        return "jwk"
      }
    } catch {
      // ignore
    }
  }
  if (isValidHex(trimmed)) return "der-hex"
  if (isValidBase64(trimmed)) {
    const { isUrlSafe } = detectBase64Options(trimmed)
    return isUrlSafe ? "der-base64url" : "der-base64"
  }
  return null
}

function decodeDerText(value: string, encoding: "der-base64" | "der-base64url" | "der-hex") {
  const trimmed = value.trim()
  if (!trimmed) return null
  if (encoding === "der-hex") return decodeHex(trimmed)
  return decodeBase64(trimmed)
}

function encodeDerBytes(bytes: Uint8Array, encoding: "der-base64" | "der-base64url" | "der-hex") {
  if (encoding === "der-hex") return encodeHex(bytes, { upperCase: false })
  return encodeBase64(bytes, { urlSafe: encoding === "der-base64url", padding: encoding === "der-base64" })
}

function formatParsedEncodingLabel(encoding: DetectedEncoding, format: KeyFormat) {
  const formatLabel = format === "spki" ? "SPKI" : "PKCS8"
  if (encoding === "pem") return `PEM (${formatLabel})`
  if (encoding === "jwk") return "JWK"
  if (encoding === "der-base64") return `DER (${formatLabel}) Base64`
  if (encoding === "der-base64url") return `DER (${formatLabel}) Base64url`
  if (encoding === "der-hex") return `DER (${formatLabel}) Hex`
  return `DER (${formatLabel}) Binary`
}

function describeAlgorithm(config: AlgorithmConfig) {
  switch (config.name) {
    case "RSASSA-PKCS1-v1_5":
      return `RSASSA-PKCS1-v1_5 (${config.hash})`
    case "RSA-PSS":
      return `RSA-PSS (${config.hash})`
    case "RSA-OAEP":
      return `RSA-OAEP (${config.hash})`
    case "ECDSA":
      return `ECDSA (${config.namedCurve})`
    case "ECDH":
      return `ECDH (${config.namedCurve})`
    case "Ed25519":
      return "Ed25519"
    case "Ed448":
      return "Ed448"
    case "X25519":
      return "X25519"
    case "X448":
      return "X448"
  }
}

function bytesToBigInt(bytes: Uint8Array) {
  let value = 0n
  for (const byte of bytes) {
    value = (value << 8n) + BigInt(byte)
  }
  return value
}

function bytesToBitLength(bytes: Uint8Array) {
  if (!bytes.length) return 0
  const first = bytes[0]
  let bits = bytes.length * 8
  for (let shift = 7; shift >= 0; shift -= 1) {
    if ((first >> shift) & 1) break
    bits -= 1
  }
  return bits
}

function getJwkParams(jwk: JsonWebKey) {
  const params: Array<{ label: string; value: string }> = []
  if (jwk.kty) params.push({ label: "kty", value: jwk.kty })
  if (jwk.crv) params.push({ label: "crv", value: jwk.crv })
  if (jwk.alg) params.push({ label: "alg", value: jwk.alg })
  if (jwk.use) params.push({ label: "use", value: jwk.use })
  if (jwk.key_ops?.length) params.push({ label: "key_ops", value: jwk.key_ops.join(", ") })
  const kid = (jwk as { kid?: string }).kid
  if (kid) params.push({ label: "kid", value: kid })

  if (jwk.kty === "RSA" && jwk.n && jwk.e) {
    const modulusBytes = decodeBase64(jwk.n)
    const exponentBytes = decodeBase64(jwk.e)
    params.push({ label: "modulus", value: `${bytesToBitLength(modulusBytes)} bits` })
    params.push({ label: "exponent", value: bytesToBigInt(exponentBytes).toString() })
    if (jwk.d) {
      const privateBytes = decodeBase64(jwk.d)
      params.push({ label: "private_d", value: `${privateBytes.length} bytes` })
    }
  }

  if (jwk.kty === "EC" && jwk.x && jwk.y) {
    const xBytes = decodeBase64(jwk.x)
    const yBytes = decodeBase64(jwk.y)
    params.push({ label: "x", value: `${xBytes.length} bytes` })
    params.push({ label: "y", value: `${yBytes.length} bytes` })
    if (jwk.d) {
      const dBytes = decodeBase64(jwk.d)
      params.push({ label: "d", value: `${dBytes.length} bytes` })
    }
  }

  if (jwk.kty === "OKP" && jwk.x) {
    const xBytes = decodeBase64(jwk.x)
    params.push({ label: "x", value: `${xBytes.length} bytes` })
    if (jwk.d) {
      const dBytes = decodeBase64(jwk.d)
      params.push({ label: "d", value: `${dBytes.length} bytes` })
    }
  }

  return params
}

function slugify(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)+/g, "")
}

type ParsedKey = {
  key: CryptoKey
  jwk: JsonWebKey
  isPrivate: boolean
  format: KeyFormat
  algorithm: AlgorithmConfig
  inputEncoding: DetectedEncoding
}

async function resolveKeyFromInput({
  input,
  inputEncoding,
  algorithmValue,
  binaryInput,
}: {
  input: string
  inputEncoding: InputEncoding
  algorithmValue: AlgorithmValue
  binaryInput: Uint8Array | null
}): Promise<ParsedKey> {
  if (!globalThis.crypto?.subtle) {
    throw new Error("Web Crypto is unavailable in this browser.")
  }

  let resolvedEncoding: DetectedEncoding | null =
    inputEncoding === "auto" ? detectEncoding(input) : (inputEncoding as DetectedEncoding)

  if (!resolvedEncoding && binaryInput) {
    resolvedEncoding = "der-binary"
  }

  if (!resolvedEncoding) {
    throw new Error("Unable to detect key encoding. Select one from the list.")
  }

  if (resolvedEncoding === "jwk") {
    const jwk = parseJwkText(input)
    const isPrivate = Boolean(jwk.d)
    const config = getAlgorithmConfig(algorithmValue, jwk)
    if (!config) {
      throw new Error("Unable to detect key algorithm. Select one from the list.")
    }
    const key = await importJwkKey(jwk, config, isPrivate)
    const exported = await crypto.subtle.exportKey("jwk", key)
    const format: KeyFormat = isPrivate ? "pkcs8" : "spki"
    return { key, jwk: exported, isPrivate, format, algorithm: config, inputEncoding: resolvedEncoding }
  }

  if (resolvedEncoding === "pem") {
    const parsed = pemToArrayBuffer(input)
    if (!parsed) throw new Error("PEM block not found.")
    if (
      parsed.label !== "PUBLIC KEY" &&
      parsed.label !== "PRIVATE KEY" &&
      parsed.label.includes("PRIVATE KEY")
    ) {
      throw new Error("Unsupported PEM format. Use PKCS8 for private keys.")
    }
    if (parsed.label !== "PUBLIC KEY" && parsed.label !== "PRIVATE KEY") {
      throw new Error("Unsupported PEM format. Use SPKI public keys or PKCS8 private keys.")
    }
    const isPrivate = parsed.label === "PRIVATE KEY"
    const format: KeyFormat = isPrivate ? "pkcs8" : "spki"

    if (algorithmValue !== "auto") {
      const config = algorithmConfigByValue[algorithmValue]
      const key = await importPemKey(input, config, isPrivate)
      const jwk = await crypto.subtle.exportKey("jwk", key)
      return { key, jwk, isPrivate, format, algorithm: config, inputEncoding: resolvedEncoding }
    }

    for (const candidate of pemAutoCandidates) {
      try {
        const key = await importPemKey(input, candidate, isPrivate)
        const jwk = await crypto.subtle.exportKey("jwk", key)
        return { key, jwk, isPrivate, format, algorithm: candidate, inputEncoding: resolvedEncoding }
      } catch {
        // Try next candidate.
      }
    }

    throw new Error("Unable to detect key algorithm. Select one from the list.")
  }

  const derBytes =
    resolvedEncoding === "der-binary"
      ? binaryInput
      : decodeDerText(input, resolvedEncoding as "der-base64" | "der-base64url" | "der-hex")

  if (!derBytes) {
    throw new Error("DER input is empty. Provide data or upload a key file.")
  }

  const buffer = derBytes.buffer.slice(derBytes.byteOffset, derBytes.byteOffset + derBytes.byteLength) as ArrayBuffer

  if (algorithmValue !== "auto") {
    const config = algorithmConfigByValue[algorithmValue]
    try {
      const key = await importDerKey(buffer, config, "spki")
      const jwk = await crypto.subtle.exportKey("jwk", key)
      return { key, jwk, isPrivate: false, format: "spki", algorithm: config, inputEncoding: resolvedEncoding }
    } catch {
      const key = await importDerKey(buffer, config, "pkcs8")
      const jwk = await crypto.subtle.exportKey("jwk", key)
      return { key, jwk, isPrivate: true, format: "pkcs8", algorithm: config, inputEncoding: resolvedEncoding }
    }
  }

  for (const candidate of pemAutoCandidates) {
    try {
      const key = await importDerKey(buffer, candidate, "spki")
      const jwk = await crypto.subtle.exportKey("jwk", key)
      return { key, jwk, isPrivate: false, format: "spki", algorithm: candidate, inputEncoding: resolvedEncoding }
    } catch {
      // continue
    }
    try {
      const key = await importDerKey(buffer, candidate, "pkcs8")
      const jwk = await crypto.subtle.exportKey("jwk", key)
      return { key, jwk, isPrivate: true, format: "pkcs8", algorithm: candidate, inputEncoding: resolvedEncoding }
    } catch {
      // continue
    }
  }

  throw new Error("Unable to detect key algorithm. Select one from the list.")
}

async function buildOutputValue(parsed: ParsedKey, encoding: OutputEncoding) {
  if (encoding === "jwk") {
    return { text: JSON.stringify(parsed.jwk, null, 2), binary: null }
  }

  const keyBuffer = await crypto.subtle.exportKey(parsed.format, parsed.key)
  const keyBytes = new Uint8Array(keyBuffer)

  if (encoding === "pem") {
    const label = parsed.isPrivate ? "PRIVATE KEY" : "PUBLIC KEY"
    return { text: toPem(keyBuffer, label), binary: null }
  }

  if (encoding === "der-binary") {
    return { text: "", binary: keyBytes }
  }

  const text = encodeDerBytes(keyBytes, encoding)
  return { text, binary: null }
}

function ScrollableTabsList({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div className="w-full min-w-0">
      <TabsList
        className={cn(
          "inline-flex h-auto max-w-full flex-wrap items-center justify-start gap-1 [&_[data-slot=tabs-trigger]]:flex-none [&_[data-slot=tabs-trigger][data-state=active]]:border-border",
          className,
        )}
      >
        {children}
      </TabsList>
    </div>
  )
}

export default function KeyExtractorPage() {
  return (
    <Suspense fallback={null}>
      <KeyExtractorContent />
    </Suspense>
  )
}

function KeyExtractorContent() {
  const { state, setParam, oversizeKeys, hasUrlParams, hydrationSource } = useUrlSyncedState("key-extractor", {
    schema: paramsSchema,
    defaults: paramsSchema.parse({}),
  })

  const handleLoadHistory = React.useCallback(
    (entry: HistoryEntry) => {
      const { inputs, params } = entry
      if (inputs.input !== undefined) setParam("input", inputs.input)
      if (params.algorithm) setParam("algorithm", params.algorithm as AlgorithmValue)
      if (params.inputEncoding) setParam("inputEncoding", params.inputEncoding as InputEncoding)
      if (params.outputEncoding) setParam("outputEncoding", params.outputEncoding as OutputEncoding)
    },
    [setParam],
  )

  return (
    <ToolPageWrapper
      toolId="key-extractor"
      title="Key Extractor"
      description="Inspect and convert cryptographic keys across PEM, JWK, and DER encodings with algorithm detection."
      onLoadHistory={handleLoadHistory}
    >
      <KeyExtractorInner
        state={state}
        setParam={setParam}
        oversizeKeys={oversizeKeys}
        hasUrlParams={hasUrlParams}
        hydrationSource={hydrationSource}
      />
    </ToolPageWrapper>
  )
}

function KeyExtractorInner({
  state,
  setParam,
  oversizeKeys,
  hasUrlParams,
  hydrationSource,
}: {
  state: z.infer<typeof paramsSchema>
  setParam: <K extends keyof z.infer<typeof paramsSchema>>(
    key: K,
    value: z.infer<typeof paramsSchema>[K],
    updateHistory?: boolean,
  ) => void
  oversizeKeys: (keyof z.infer<typeof paramsSchema>)[]
  hasUrlParams: boolean
  hydrationSource: "default" | "url" | "history"
}) {
  const { upsertInputEntry, upsertParams } = useToolHistoryContext()
  const [parsed, setParsed] = React.useState<ParsedKey | null>(null)
  const [outputText, setOutputText] = React.useState("")
  const [binaryOutput, setBinaryOutput] = React.useState<Uint8Array<ArrayBuffer> | null>(null)
  const [error, setError] = React.useState<string | null>(null)
  const [copied, setCopied] = React.useState(false)
  const [inputFileName, setInputFileName] = React.useState<string | null>(null)
  const binaryInputRef = React.useRef<Uint8Array | null>(null)
  const [binaryInputVersion, setBinaryInputVersion] = React.useState(0)
  const fileInputRef = React.useRef<HTMLInputElement>(null)
  const parseRef = React.useRef(0)
  const outputRef = React.useRef(0)
  const lastInputRef = React.useRef<string>("")
  const hasHydratedInputRef = React.useRef(false)
  const paramsRef = React.useRef({
    algorithm: state.algorithm,
    inputEncoding: state.inputEncoding,
    outputEncoding: state.outputEncoding,
  })
  const hasInitializedParamsRef = React.useRef(false)
  const hasHandledUrlRef = React.useRef(false)

  const algorithmFamily = React.useMemo(
    () =>
      state.algorithm === "auto"
        ? "auto"
        : (Object.keys(algorithmFamilies) as AlgorithmFamily[]).find((family) =>
            algorithmFamilies[family].includes(state.algorithm as never),
          ) ?? "auto",
    [state.algorithm],
  )

  const activeAlgorithms = algorithmFamilies[algorithmFamily]

  const parsedEncodingLabel = parsed ? formatParsedEncodingLabel(parsed.inputEncoding, parsed.format) : ""
  const parsedEncodingDisplay = parsed
    ? state.inputEncoding === "auto"
      ? `Auto (${parsedEncodingLabel})`
      : parsedEncodingLabel
    : "—"

  const parsedAlgorithmDisplay = parsed
    ? state.algorithm === "auto"
      ? `Auto (${describeAlgorithm(parsed.algorithm)})`
      : describeAlgorithm(parsed.algorithm)
    : "—"

  const keyParams = React.useMemo(() => (parsed ? getJwkParams(parsed.jwk) : []), [parsed])

  const inputWarning = oversizeKeys.includes("input")
    ? "Input exceeds 2 KB and is not synced to the URL."
    : null

  const binaryWarning = inputFileName ? "Binary input is not synced to the URL or history." : null

  React.useEffect(() => {
    if (hasHydratedInputRef.current) return
    if (hydrationSource === "default") return
    const signature = inputFileName ? `binary:${inputFileName}:${binaryInputVersion}` : `text:${state.input}`
    lastInputRef.current = signature
    hasHydratedInputRef.current = true
  }, [hydrationSource, state.input, inputFileName, binaryInputVersion])

  React.useEffect(() => {
    const hasBinary = Boolean(inputFileName && binaryInputVersion)
    const signature = hasBinary ? `binary:${inputFileName}:${binaryInputVersion}` : `text:${state.input}`
    if ((!hasBinary && !state.input) || signature === lastInputRef.current) return

    const timer = setTimeout(() => {
      lastInputRef.current = signature
      const preview = inputFileName ?? state.input.slice(0, 100)
      upsertInputEntry(
        { input: hasBinary ? "" : state.input },
        { algorithm: state.algorithm, inputEncoding: state.inputEncoding, outputEncoding: state.outputEncoding },
        "left",
        preview,
      )
    }, DEFAULT_URL_SYNC_DEBOUNCE_MS)

    return () => clearTimeout(timer)
  }, [state.input, state.algorithm, state.inputEncoding, state.outputEncoding, inputFileName, binaryInputVersion, upsertInputEntry])

  React.useEffect(() => {
    if (hasUrlParams && !hasHandledUrlRef.current) {
      hasHandledUrlRef.current = true
      if (state.input) {
        upsertInputEntry(
          { input: state.input },
          { algorithm: state.algorithm, inputEncoding: state.inputEncoding, outputEncoding: state.outputEncoding },
          "left",
          state.input.slice(0, 100),
        )
      } else {
        upsertParams({ algorithm: state.algorithm, inputEncoding: state.inputEncoding, outputEncoding: state.outputEncoding }, "interpretation")
      }
    }
  }, [hasUrlParams, state.input, state.algorithm, state.inputEncoding, state.outputEncoding, upsertInputEntry, upsertParams])

  React.useEffect(() => {
    const nextParams = {
      algorithm: state.algorithm,
      inputEncoding: state.inputEncoding,
      outputEncoding: state.outputEncoding,
    }
    if (!hasInitializedParamsRef.current) {
      hasInitializedParamsRef.current = true
      paramsRef.current = nextParams
      return
    }
    if (
      paramsRef.current.algorithm === nextParams.algorithm &&
      paramsRef.current.inputEncoding === nextParams.inputEncoding &&
      paramsRef.current.outputEncoding === nextParams.outputEncoding
    ) {
      return
    }
    paramsRef.current = nextParams
    upsertParams(nextParams, "interpretation")
  }, [state.algorithm, state.inputEncoding, state.outputEncoding, upsertParams])

  React.useEffect(() => {
    if (state.inputEncoding !== "der-binary" && state.inputEncoding !== "auto") {
      if (binaryInputRef.current) {
        binaryInputRef.current = null
        setBinaryInputVersion(0)
        setInputFileName(null)
      }
    }
  }, [state.inputEncoding])

  React.useEffect(() => {
    const runId = ++parseRef.current
    setError(null)

    if (!state.input.trim() && !binaryInputRef.current) {
      setParsed(null)
      setOutputText("")
      setBinaryOutput(null)
      return
    }

    void (async () => {
      try {
        const resolved = await resolveKeyFromInput({
          input: state.input,
          inputEncoding: state.inputEncoding,
          algorithmValue: state.algorithm,
          binaryInput: binaryInputRef.current,
        })
        if (parseRef.current !== runId) return
        setParsed(resolved)
        setError(null)
      } catch (err) {
        if (parseRef.current !== runId) return
        setParsed(null)
        setOutputText("")
        setBinaryOutput(null)
        setError(err instanceof Error ? err.message : "Failed to parse key.")
      }
    })()
  }, [state.input, state.inputEncoding, state.algorithm, binaryInputVersion])

  React.useEffect(() => {
    const runId = ++outputRef.current
    if (!parsed) {
      setOutputText("")
      setBinaryOutput(null)
      return
    }

    void (async () => {
      try {
        const { text, binary } = await buildOutputValue(parsed, state.outputEncoding)
        if (outputRef.current !== runId) return
        setOutputText(text)
        setBinaryOutput(binary)
        setError(null)
      } catch (err) {
        if (outputRef.current !== runId) return
        setOutputText("")
        setBinaryOutput(null)
        setError(err instanceof Error ? err.message : "Failed to convert key.")
      }
    })()
  }, [parsed, state.outputEncoding])

  const handleCopy = async () => {
    if (!outputText) return
    await navigator.clipboard.writeText(outputText)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const handleDownload = () => {
    if (!parsed) return
    const extensionMap: Record<OutputEncoding, string> = {
      pem: "pem",
      jwk: "jwk.json",
      "der-base64": "der.base64",
      "der-base64url": "der.base64url",
      "der-hex": "der.hex",
      "der-binary": "der",
    }
    const baseName = `key-${slugify(describeAlgorithm(parsed.algorithm))}-${parsed.isPrivate ? "private" : "public"}`
    const filename = `${baseName}.${extensionMap[state.outputEncoding]}`

    if (state.outputEncoding === "der-binary" && binaryOutput) {
      const blob = new Blob([binaryOutput], { type: "application/octet-stream" })
      const url = URL.createObjectURL(blob)
      const link = document.createElement("a")
      link.href = url
      link.download = filename
      link.click()
      URL.revokeObjectURL(url)
      return
    }

    if (!outputText) return
    const blob = new Blob([outputText], { type: "text/plain" })
    const url = URL.createObjectURL(blob)
    const link = document.createElement("a")
    link.href = url
    link.download = filename
    link.click()
    URL.revokeObjectURL(url)
  }

  const handleDownloadAll = React.useCallback(async () => {
    if (!parsed) return
    try {
      const { default: JSZip } = await import("jszip")
      const zip = new JSZip()
      const baseName = `key-${slugify(describeAlgorithm(parsed.algorithm))}-${parsed.isPrivate ? "private" : "public"}`
      const extensionMap: Record<OutputEncoding, string> = {
        pem: "pem",
        jwk: "jwk.json",
        "der-base64": "der.base64",
        "der-base64url": "der.base64url",
        "der-hex": "der.hex",
        "der-binary": "der",
      }

      for (const encoding of outputEncodings) {
        const { text, binary } = await buildOutputValue(parsed, encoding)
        const filename = `${baseName}.${extensionMap[encoding]}`
        if (encoding === "der-binary") {
          if (binary) {
            zip.file(filename, binary)
          }
        } else if (text) {
          zip.file(filename, text)
        }
      }

      const blob = await zip.generateAsync({ type: "blob" })
      const url = URL.createObjectURL(blob)
      const link = document.createElement("a")
      link.href = url
      link.download = `${baseName}.zip`
      link.click()
      URL.revokeObjectURL(url)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to generate zip file.")
    }
  }, [parsed])

  const handleInputChange = (value: string) => {
    if (binaryInputRef.current) {
      binaryInputRef.current = null
      setBinaryInputVersion(0)
      setInputFileName(null)
    }
    setParam("input", value)
  }

  const handleClear = () => {
    binaryInputRef.current = null
    setBinaryInputVersion(0)
    setInputFileName(null)
    setParam("input", "")
    setError(null)
  }

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return

    try {
      if (state.inputEncoding === "der-binary") {
        const buffer = await file.arrayBuffer()
        binaryInputRef.current = new Uint8Array(buffer)
        setBinaryInputVersion((value) => value + 1)
        setInputFileName(file.name)
        setParam("input", "")
        return
      }

      if (state.inputEncoding === "auto") {
        const buffer = await file.arrayBuffer()
        const text = new TextDecoder().decode(buffer)
        const detected = detectEncoding(text)
        if (!detected) {
          binaryInputRef.current = new Uint8Array(buffer)
          setBinaryInputVersion((value) => value + 1)
          setInputFileName(file.name)
          setParam("input", "")
          return
        }
        binaryInputRef.current = null
        setBinaryInputVersion(0)
        setInputFileName(null)
        setParam("input", text)
        return
      }

      const text = await file.text()
      binaryInputRef.current = null
      setBinaryInputVersion(0)
      setInputFileName(null)
      setParam("input", text)
    } finally {
      event.target.value = ""
    }
  }

  const inputPlaceholder =
    state.inputEncoding === "jwk"
      ? "Paste JWK JSON..."
      : state.inputEncoding === "pem"
        ? "Paste PEM (SPKI/PKCS8) key..."
        : state.inputEncoding === "der-hex"
          ? "Paste DER (Hex) data..."
          : state.inputEncoding === "der-base64" || state.inputEncoding === "der-base64url"
            ? "Paste DER (Base64/Base64url) data..."
            : "Paste PEM, JWK, or DER data..."

  const outputPlaceholder = parsed
    ? "Converted output will appear here."
    : "Provide a key to extract details and convert formats."

  return (
    <div className="flex w-full flex-col gap-4 py-4 sm:gap-6 sm:py-6">
      <div className="grid gap-6 lg:grid-cols-2">
        <section className="flex flex-col gap-4">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-base font-semibold">Input</h2>
            <Button variant="ghost" size="sm" onClick={handleClear} className="h-8 px-3 text-sm">
              Clear
            </Button>
          </div>

          <div className="space-y-4">
            <div className="flex items-start gap-3">
              <Label className="w-24 shrink-0 text-sm sm:w-32">Algorithm</Label>
              <div className="min-w-0 flex-1 space-y-2">
                <Tabs
                  value={algorithmFamily}
                  onValueChange={(value) => {
                    const family = value as AlgorithmFamily
                    const next = algorithmFamilies[family][0] as AlgorithmValue
                    if (state.algorithm !== next) {
                      setParam("algorithm", next, true)
                    }
                  }}
                >
                  <ScrollableTabsList>
                    {(Object.keys(algorithmFamilies) as AlgorithmFamily[]).map((family) => (
                      <TabsTrigger key={family} value={family}>
                        {algorithmFamilyLabels[family]}
                      </TabsTrigger>
                    ))}
                  </ScrollableTabsList>
                </Tabs>
                <Tabs value={state.algorithm} onValueChange={(value) => setParam("algorithm", value as AlgorithmValue, true)}>
                  <ScrollableTabsList>
                    {activeAlgorithms.map((value) => (
                      <TabsTrigger key={value} value={value}>
                        {algorithmLabels[value as AlgorithmValue]}
                      </TabsTrigger>
                    ))}
                  </ScrollableTabsList>
                </Tabs>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <Label className="w-24 shrink-0 text-sm sm:w-32">Key Encoding</Label>
              <Tabs
                value={state.inputEncoding}
                onValueChange={(value) => setParam("inputEncoding", value as InputEncoding, true)}
                className="min-w-0 flex-1"
              >
                <ScrollableTabsList className="min-h-6 h-auto">
                  {inputEncodings.map((value) => (
                    <TabsTrigger key={value} value={value} className="text-[10px] sm:text-xs">
                      {encodingLabels[value]}
                    </TabsTrigger>
                  ))}
                </ScrollableTabsList>
              </Tabs>
            </div>

            <p className="text-xs text-muted-foreground">
              Auto-detect supports PEM, JWK, and DER (Base64/Hex). PKCS1 and SEC1 PEM blocks are not supported.
            </p>

            <div className="space-y-2">
              <div className="flex items-center justify-between gap-2">
                <Label className="text-sm">Key Input</Label>
                <div className="flex items-center gap-2">
                  <input ref={fileInputRef} type="file" className="hidden" onChange={handleFileUpload} />
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => fileInputRef.current?.click()}
                    className="h-7 gap-1 px-2 text-xs"
                  >
                    <Upload className="h-3 w-3" />
                    Upload
                  </Button>
                  {inputFileName && (
                    <Button variant="ghost" size="sm" onClick={handleClear} className="h-7 gap-1 px-2 text-xs">
                      <X className="h-3 w-3" />
                      Clear File
                    </Button>
                  )}
                </div>
              </div>
              <Textarea
                value={state.input}
                onChange={(event) => handleInputChange(event.target.value)}
                placeholder={inputPlaceholder}
                disabled={state.inputEncoding === "der-binary"}
                className={cn(
                  "min-h-[220px] resize-none overflow-auto font-mono text-sm break-all",
                  error && "border-destructive",
                )}
                style={{ wordBreak: "break-all", overflowWrap: "anywhere" }}
              />
              {inputFileName && (
                <p className="text-xs text-muted-foreground">Binary key loaded: {inputFileName}</p>
              )}
              {inputWarning && <p className="text-xs text-muted-foreground">{inputWarning}</p>}
              {binaryWarning && <p className="text-xs text-muted-foreground">{binaryWarning}</p>}
            </div>
          </div>
        </section>

        <section className="flex flex-col gap-4">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-base font-semibold">Output</h2>
            <div className="flex items-center gap-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={handleCopy}
                disabled={!outputText}
                className="h-7 gap-1 px-2 text-xs"
              >
                {copied ? (
                  <>
                    <Check className="h-3 w-3" />
                    Copied
                  </>
                ) : (
                  <>
                    <Copy className="h-3 w-3" />
                    Copy
                  </>
                )}
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={handleDownload}
                disabled={!parsed || (state.outputEncoding !== "der-binary" && !outputText)}
                className="h-7 gap-1 px-2 text-xs"
              >
                <Download className="h-3 w-3" />
                Download
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={handleDownloadAll}
                disabled={!parsed}
                className="h-7 gap-1 px-2 text-xs"
              >
                <Download className="h-3 w-3" />
                Download All
              </Button>
            </div>
          </div>

          <div className="space-y-4">
            <div className="space-y-2 text-sm">
              <div className="flex items-center gap-3">
                <Label className="w-28 shrink-0 text-xs text-muted-foreground sm:w-32">Parsed Encoding</Label>
                <span>{parsedEncodingDisplay}</span>
              </div>
              <div className="flex items-center gap-3">
                <Label className="w-28 shrink-0 text-xs text-muted-foreground sm:w-32">Algorithm</Label>
                <span>{parsedAlgorithmDisplay}</span>
              </div>
              <div className="flex items-center gap-3">
                <Label className="w-28 shrink-0 text-xs text-muted-foreground sm:w-32">Key Type</Label>
                <span>{parsed ? (parsed.isPrivate ? "Private" : "Public") : "—"}</span>
              </div>
              <div className="flex items-start gap-3">
                <Label className="w-28 shrink-0 text-xs text-muted-foreground sm:w-32">Key Params</Label>
                <div className="min-w-0 flex-1 space-y-1 text-xs text-muted-foreground">
                  {keyParams.length ? (
                    keyParams.map((param) => (
                      <div key={param.label} className="flex items-center gap-2">
                        <span className="w-20 shrink-0 font-mono text-[11px] uppercase text-muted-foreground">
                          {param.label}
                        </span>
                        <span className="font-mono break-all">{param.value}</span>
                      </div>
                    ))
                  ) : (
                    <span>—</span>
                  )}
                </div>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <Label className="w-28 shrink-0 text-sm sm:w-32">Convert To</Label>
              <Tabs
                value={state.outputEncoding}
                onValueChange={(value) => setParam("outputEncoding", value as OutputEncoding, true)}
                className="min-w-0 flex-1"
              >
                <ScrollableTabsList className="min-h-6 h-auto">
                  {outputEncodings.map((value) => (
                    <TabsTrigger key={value} value={value} className="text-[10px] sm:text-xs">
                      {outputEncodingLabels[value]}
                    </TabsTrigger>
                  ))}
                </ScrollableTabsList>
              </Tabs>
            </div>

            {state.outputEncoding === "der-binary" ? (
              <div className="rounded-md border border-dashed p-4 text-xs text-muted-foreground">
                Binary output is available for download only.
              </div>
            ) : (
              <Textarea
                value={outputText}
                readOnly
                placeholder={outputPlaceholder}
                className="min-h-[220px] resize-none overflow-auto font-mono text-sm break-all"
                style={{ wordBreak: "break-all", overflowWrap: "anywhere" }}
              />
            )}

            {error && <p className="text-xs text-destructive">{error}</p>}
          </div>
        </section>
      </div>
    </div>
  )
}
