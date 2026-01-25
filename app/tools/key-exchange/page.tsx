"use client"

import * as React from "react"
import { Suspense } from "react"
import { z } from "zod"
import { AlertCircle, Check, Copy, Download, RefreshCcw, Upload } from "lucide-react"
import { secp256k1, schnorr as schnorrCurve } from "@noble/curves/secp256k1.js"
import { x25519 } from "@noble/curves/ed25519.js"
import { x448 } from "@noble/curves/ed448.js"
import { ml_kem512, ml_kem768, ml_kem1024 } from "@noble/post-quantum/ml-kem.js"
import {
  ml_kem768_x25519,
  ml_kem768_p256,
  ml_kem1024_p384,
  KitchenSink_ml_kem768_x25519,
  XWing,
  QSF_ml_kem768_p256,
  QSF_ml_kem1024_p384,
} from "@noble/post-quantum/hybrid.js"
import type { KEM } from "@noble/post-quantum/utils.js"
import { ToolPageWrapper, useToolHistoryContext } from "@/components/tool-ui/tool-page-wrapper"
import { DEFAULT_URL_SYNC_DEBOUNCE_MS, useUrlSyncedState } from "@/lib/url-state/use-url-synced-state"
import { Textarea } from "@/components/ui/textarea"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Slider } from "@/components/ui/slider"
import { decodeBase64, encodeBase64 } from "@/lib/encoding/base64"
import { decodeHex, encodeHex } from "@/lib/encoding/hex"
import type { HistoryEntry } from "@/lib/history/db"
import { cn } from "@/lib/utils"

const algorithmValues = ["ECDH", "Schnorr", "X25519", "X448", "ML-KEM", "Hybrid KEM"] as const
const ecdhCurves = ["P-256", "P-384", "P-521", "secp256k1"] as const
const outputEncodings = ["base64", "base64url", "hex"] as const
const paramEncodings = ["utf8", "base64", "hex"] as const
const pqcKeyEncodings = ["base64", "base64url", "hex"] as const
const kdfAlgorithms = ["HKDF", "PBKDF2"] as const
const kdfHashes = ["SHA-256", "SHA-384", "SHA-512"] as const
const lengthPresets = ["256", "384", "512", "custom"] as const
const kemModes = ["encapsulate", "decapsulate"] as const
const pqcKemVariants = ["ML-KEM-512", "ML-KEM-768", "ML-KEM-1024"] as const
const pqcHybridVariants = [
  "XWing",
  "ML-KEM-768+X25519",
  "ML-KEM-768+P-256",
  "ML-KEM-1024+P-384",
  "KitchenSink ML-KEM-768+X25519",
  "QSF ML-KEM-768+P-256",
  "QSF ML-KEM-1024+P-384",
] as const

type AgreementAlgorithm = (typeof algorithmValues)[number]
type EcdhCurve = (typeof ecdhCurves)[number]
type OutputEncoding = (typeof outputEncodings)[number]
type ParamEncoding = (typeof paramEncodings)[number]
type PqcKeyEncoding = (typeof pqcKeyEncodings)[number]
type KdfAlgorithm = (typeof kdfAlgorithms)[number]
type KdfHash = (typeof kdfHashes)[number]
type LengthPreset = (typeof lengthPresets)[number]
type KemMode = (typeof kemModes)[number]
type PqcKemVariant = (typeof pqcKemVariants)[number]
type PqcHybridVariant = (typeof pqcHybridVariants)[number]

const encodingLabels = {
  utf8: "UTF-8",
  base64: "Base64",
  base64url: "Base64url",
  hex: "Hex",
} as const

const pqcKemMap: Record<PqcKemVariant, KEM> = {
  "ML-KEM-512": ml_kem512,
  "ML-KEM-768": ml_kem768,
  "ML-KEM-1024": ml_kem1024,
}

const pqcHybridMap: Record<PqcHybridVariant, KEM> = {
  XWing,
  "ML-KEM-768+X25519": ml_kem768_x25519,
  "ML-KEM-768+P-256": ml_kem768_p256,
  "ML-KEM-1024+P-384": ml_kem1024_p384,
  "KitchenSink ML-KEM-768+X25519": KitchenSink_ml_kem768_x25519,
  "QSF ML-KEM-768+P-256": QSF_ml_kem768_p256,
  "QSF ML-KEM-1024+P-384": QSF_ml_kem1024_p384,
}

const paramsSchema = z.object({
  algorithm: z.enum(algorithmValues).default("ECDH"),
  ecdhCurve: z.enum(ecdhCurves).default("P-256"),
  localPrivateKey: z.string().default(""),
  peerPublicKey: z.string().default(""),
  kemMode: z.enum(kemModes).default("encapsulate"),
  pqcKemVariant: z.enum(pqcKemVariants).default("ML-KEM-768"),
  pqcHybridVariant: z.enum(pqcHybridVariants).default("XWing"),
  pqcKeyEncoding: z.enum(pqcKeyEncodings).default("base64"),
  kemCiphertext: z.string().default(""),
  outputEncoding: z.enum(outputEncodings).default("base64"),
  useKdf: z.boolean().default(false),
  kdfAlgorithm: z.enum(kdfAlgorithms).default("HKDF"),
  kdfHash: z.enum(kdfHashes).default("SHA-256"),
  kdfLength: z.coerce.number().int().min(1).max(16320).default(32),
  kdfSalt: z.string().default(""),
  kdfSaltEncoding: z.enum(paramEncodings).default("base64"),
  kdfInfo: z.string().default(""),
  kdfInfoEncoding: z.enum(paramEncodings).default("base64"),
  kdfIterations: z.coerce.number().int().min(1).max(10000000).default(100000),
})

type KeyExchangeState = z.infer<typeof paramsSchema>

const textEncoder = new TextEncoder()
const SALT_DEFAULT_LENGTH = 16

function randomBytes(length: number) {
  if (!globalThis.crypto?.getRandomValues) {
    throw new Error("Secure random generation is unavailable.")
  }
  const bytes = new Uint8Array(length)
  crypto.getRandomValues(bytes)
  return bytes
}

function randomAsciiString(length: number) {
  const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789"
  const bytes = randomBytes(length)
  let value = ""
  for (let i = 0; i < bytes.length; i += 1) {
    value += alphabet[bytes[i] % alphabet.length]
  }
  return value
}

function getMaxKdfLengthBytes(hash: KdfHash) {
  if (hash === "SHA-384") return 255 * 48
  if (hash === "SHA-512") return 255 * 64
  return 255 * 32
}

function getLengthPreset(value: number): LengthPreset | null {
  if (value === 32) return "256"
  if (value === 48) return "384"
  if (value === 64) return "512"
  return null
}

function encodeParamValue(bytes: Uint8Array, encoding: ParamEncoding) {
  if (encoding === "utf8") return randomAsciiString(bytes.length)
  if (encoding === "hex") return encodeHex(bytes, { upperCase: false })
  return encodeBase64(bytes, { urlSafe: false, padding: true })
}

function encodeOutputBytes(bytes: Uint8Array, encoding: OutputEncoding) {
  if (encoding === "hex") return encodeHex(bytes, { upperCase: false })
  if (encoding === "base64") return encodeBase64(bytes, { urlSafe: false, padding: true })
  return encodeBase64(bytes, { urlSafe: true, padding: false })
}

function decodeOutputBytes(value: string, encoding: OutputEncoding): Uint8Array<ArrayBuffer> {
  if (!value) return new Uint8Array()
  if (encoding === "hex") return decodeHex(value)
  return decodeBase64(value)
}

function encodeBase64Url(bytes: Uint8Array) {
  return encodeBase64(bytes, { urlSafe: true, padding: false })
}

function decodeBase64Url(value: string): Uint8Array<ArrayBuffer> {
  return decodeBase64(value)
}

function decodeParamValue(value: string, encoding: ParamEncoding): Uint8Array<ArrayBuffer> {
  if (!value) return new Uint8Array()
  if (encoding === "utf8") return textEncoder.encode(value) as Uint8Array<ArrayBuffer>
  if (encoding === "hex") return decodeHex(value)
  return decodeBase64(value)
}

function padBytes(bytes: Uint8Array, length: number) {
  if (bytes.length === length) return bytes
  if (bytes.length > length) {
    throw new Error("Key length is invalid for the selected curve.")
  }
  const padded = new Uint8Array(length)
  padded.set(bytes, length - bytes.length)
  return padded
}

function parseJwk(text: string) {
  const trimmed = text.trim()
  if (!trimmed.startsWith("{")) return null
  try {
    const jwk = JSON.parse(trimmed)
    if (jwk && typeof jwk === "object" && "kty" in jwk) {
      return jwk as JsonWebKey
    }
  } catch {
    return null
  }
  return null
}

function createEcJwk(curve: EcdhCurve, publicKey: Uint8Array, privateKey?: Uint8Array) {
  const coordLength = (publicKey.length - 1) / 2
  const x = publicKey.slice(1, 1 + coordLength)
  const y = publicKey.slice(1 + coordLength)
  const jwk: JsonWebKey = {
    kty: "EC",
    crv: curve,
    x: encodeBase64Url(x),
    y: encodeBase64Url(y),
  }
  if (privateKey) {
    jwk.d = encodeBase64Url(privateKey)
  }
  return jwk
}

function createOkpJwk(curve: "X25519" | "X448", publicKey: Uint8Array, privateKey?: Uint8Array) {
  const jwk: JsonWebKey = {
    kty: "OKP",
    crv: curve,
    x: encodeBase64Url(publicKey),
  }
  if (privateKey) {
    jwk.d = encodeBase64Url(privateKey)
  }
  return jwk
}

type PqcKeyPayload = {
  publicKey?: string
  secretKey?: string
  privateKey?: string
  encoding?: string
}

function parsePqcKeyPayload(text: string) {
  const trimmed = text.trim()
  if (!trimmed.startsWith("{")) return null
  try {
    const parsed = JSON.parse(trimmed)
    if (parsed && typeof parsed === "object") return parsed as PqcKeyPayload
  } catch {
    return null
  }
  return null
}

function normalizePqcEncoding(value?: string): PqcKeyEncoding | null {
  if (value === "base64" || value === "base64url" || value === "hex") return value
  return null
}

function decodePqcKeyBytes(value: string, encoding: PqcKeyEncoding) {
  if (!value) return new Uint8Array()
  if (encoding === "hex") return decodeHex(value)
  return decodeBase64(value)
}

function resolvePqcKeyBytes(keyText: string, encoding: PqcKeyEncoding, type: "public" | "private") {
  const trimmed = keyText.trim()
  if (!trimmed) {
    throw new Error(`${type === "public" ? "Public" : "Private"} key is required.`)
  }
  const payload = parsePqcKeyPayload(trimmed)
  if (payload) {
    const keyEncoding = normalizePqcEncoding(payload.encoding) ?? encoding
    const keyValue = type === "public" ? payload.publicKey : payload.secretKey || payload.privateKey
    if (!keyValue) {
      throw new Error(`${type === "public" ? "Public" : "Private"} key is required.`)
    }
    return decodePqcKeyBytes(keyValue, keyEncoding)
  }
  return decodePqcKeyBytes(trimmed, encoding)
}

function encodePqcKey(bytes: Uint8Array, encoding: PqcKeyEncoding) {
  if (encoding === "hex") return encodeHex(bytes, { upperCase: false })
  if (encoding === "base64url") return encodeBase64(bytes, { urlSafe: true, padding: false })
  return encodeBase64(bytes, { urlSafe: false, padding: true })
}

function createPqcPublicKey(algorithm: string, publicKey: Uint8Array, encoding: PqcKeyEncoding) {
  return {
    kty: "PQC",
    alg: algorithm,
    encoding,
    publicKey: encodePqcKey(publicKey, encoding),
  }
}

function createPqcPrivateKey(
  algorithm: string,
  publicKey: Uint8Array,
  secretKey: Uint8Array,
  encoding: PqcKeyEncoding,
) {
  return {
    kty: "PQC",
    alg: algorithm,
    encoding,
    publicKey: encodePqcKey(publicKey, encoding),
    secretKey: encodePqcKey(secretKey, encoding),
  }
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
  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i)
  }
  return { label: block.label, buffer: bytes.buffer }
}

function toPem(buffer: ArrayBuffer, label: "PUBLIC KEY" | "PRIVATE KEY") {
  const bytes = new Uint8Array(buffer)
  let binary = ""
  for (const byte of bytes) {
    binary += String.fromCharCode(byte)
  }
  const base64 = btoa(binary).replace(/(.{64})/g, "$1\n")
  return `-----BEGIN ${label}-----\n${base64}\n-----END ${label}-----`
}

function isKeyPair(key: CryptoKey | CryptoKeyPair): key is CryptoKeyPair {
  return "publicKey" in key && "privateKey" in key
}

function getWebCryptoAlgorithm(state: KeyExchangeState): EcKeyImportParams | null {
  if (state.algorithm === "ECDH" && state.ecdhCurve !== "secp256k1") {
    return { name: "ECDH", namedCurve: state.ecdhCurve }
  }
  return null
}

function getDeriveParams(publicKey: CryptoKey): EcdhKeyDeriveParams {
  return { name: "ECDH", public: publicKey }
}

function getAgreementKeyId(state: KeyExchangeState) {
  if (state.algorithm === "ECDH") return `ECDH:${state.ecdhCurve}`
  if (state.algorithm === "ML-KEM") return `ML-KEM:${state.pqcKemVariant}`
  if (state.algorithm === "Hybrid KEM") return `Hybrid KEM:${state.pqcHybridVariant}`
  return state.algorithm
}

function getSharedSecretBits(algorithm: AgreementAlgorithm, curve: EcdhCurve) {
  if (algorithm === "ECDH") {
    if (curve === "P-384") return 384
    if (curve === "P-521") return 528
    return 256
  }
  if (algorithm === "ML-KEM" || algorithm === "Hybrid KEM") return 256
  if (algorithm === "Schnorr") return 256
  if (algorithm === "X448") return 448
  return 256
}

async function importWebCryptoAgreementKey({
  keyText,
  algorithm,
  type,
}: {
  keyText: string
  algorithm: EcKeyImportParams
  type: "private" | "public"
}) {
  if (!globalThis.crypto?.subtle) {
    throw new Error("Web Crypto is unavailable in this environment.")
  }
  const jwk = parseJwk(keyText)
  if (jwk) {
    if (type === "private" && !jwk.d) return null
    if (type === "public" && jwk.d) return null
    return crypto.subtle.importKey("jwk", jwk, algorithm, false, type === "private" ? ["deriveBits"] : [])
  }
  const parsed = pemToArrayBuffer(keyText)
  if (!parsed) return null
  if (type === "private" && parsed.label.includes("PUBLIC KEY")) return null
  if (type === "public" && parsed.label.includes("PRIVATE KEY")) return null
  const format = parsed.label.includes("PRIVATE KEY") ? "pkcs8" : "spki"
  return crypto.subtle.importKey(format, parsed.buffer, algorithm, false, type === "private" ? ["deriveBits"] : [])
}

function getSecp256k1PrivateKeyBytes(keyText: string) {
  const jwk = parseJwk(keyText)
  if (!jwk || jwk.kty !== "EC" || jwk.crv !== "secp256k1") {
    throw new Error("Invalid key format. Use EC JWK with secp256k1.")
  }
  if (!jwk.d) {
    throw new Error("Private EC JWK (with d) is required.")
  }
  const raw = decodeBase64Url(jwk.d)
  const length = secp256k1.lengths.secretKey ?? raw.length
  return padBytes(raw, length)
}

function getSecp256k1PublicKeyBytes(keyText: string) {
  const jwk = parseJwk(keyText)
  if (!jwk || jwk.kty !== "EC" || jwk.crv !== "secp256k1") {
    throw new Error("Invalid key format. Use EC JWK with secp256k1.")
  }
  if (jwk.x && jwk.y) {
    const x = decodeBase64Url(jwk.x)
    const y = decodeBase64Url(jwk.y)
    const publicKey = new Uint8Array(1 + x.length + y.length)
    publicKey[0] = 4
    publicKey.set(x, 1)
    publicKey.set(y, 1 + x.length)
    return publicKey
  }
  if (jwk.d) {
    const secret = getSecp256k1PrivateKeyBytes(JSON.stringify(jwk))
    return secp256k1.getPublicKey(secret, false)
  }
  throw new Error("Public EC JWK must include x and y coordinates.")
}

function getSchnorrPublicKeyBytes(keyText: string) {
  const jwk = parseJwk(keyText)
  if (!jwk || jwk.kty !== "EC" || jwk.crv !== "secp256k1") {
    throw new Error("Invalid key format. Use EC JWK with secp256k1.")
  }
  if (jwk.x) {
    const x = padBytes(decodeBase64Url(jwk.x), 32)
    if (jwk.y) {
      const y = decodeBase64Url(jwk.y)
      const publicKey = new Uint8Array(1 + x.length + y.length)
      publicKey[0] = 4
      publicKey.set(x, 1)
      publicKey.set(y, 1 + x.length)
      return publicKey
    }
    const compressed = new Uint8Array(33)
    compressed[0] = 2
    compressed.set(x, 1)
    return compressed
  }
  if (jwk.d) {
    const secret = getSecp256k1PrivateKeyBytes(JSON.stringify(jwk))
    return secp256k1.getPublicKey(secret, true)
  }
  throw new Error("Public EC JWK must include x (and optionally y).")
}

function getOkpPrivateKeyBytes(keyText: string, curve: "X25519" | "X448") {
  const jwk = parseJwk(keyText)
  if (!jwk || jwk.kty !== "OKP" || jwk.crv !== curve) {
    throw new Error(`Invalid key format. Use OKP JWK with ${curve}.`)
  }
  if (!jwk.d) {
    throw new Error("Private OKP JWK (with d) is required.")
  }
  const raw = decodeBase64Url(jwk.d)
  const lengths = curve === "X448" ? x448.lengths : x25519.lengths
  return padBytes(raw, lengths.secretKey ?? raw.length)
}

function getOkpPublicKeyBytes(keyText: string, curve: "X25519" | "X448") {
  const jwk = parseJwk(keyText)
  if (!jwk || jwk.kty !== "OKP" || jwk.crv !== curve) {
    throw new Error(`Invalid key format. Use OKP JWK with ${curve}.`)
  }
  if (jwk.x) {
    const raw = decodeBase64Url(jwk.x)
    const lengths = curve === "X448" ? x448.lengths : x25519.lengths
    return padBytes(raw, lengths.publicKey ?? raw.length)
  }
  if (jwk.d) {
    const secret = getOkpPrivateKeyBytes(JSON.stringify(jwk), curve)
    const keygen = curve === "X448" ? x448 : x25519
    return keygen.getPublicKey(secret)
  }
  throw new Error("Public OKP JWK must include x.")
}

async function deriveKdfBytes(sharedSecret: Uint8Array<ArrayBuffer>, state: KeyExchangeState) {
  if (!globalThis.crypto?.subtle) {
    throw new Error("Web Crypto is unavailable in this environment.")
  }
  const lengthBits = state.kdfLength * 8
  const salt = decodeParamValue(state.kdfSalt, state.kdfSaltEncoding)
  if (state.kdfAlgorithm === "HKDF") {
    const info = decodeParamValue(state.kdfInfo, state.kdfInfoEncoding)
    const keyMaterial = await crypto.subtle.importKey("raw", sharedSecret, "HKDF", false, ["deriveBits"])
    const bits = await crypto.subtle.deriveBits(
      { name: "HKDF", hash: { name: state.kdfHash }, salt, info },
      keyMaterial,
      lengthBits,
    )
    return new Uint8Array(bits)
  }
  const keyMaterial = await crypto.subtle.importKey("raw", sharedSecret, "PBKDF2", false, ["deriveBits"])
  const bits = await crypto.subtle.deriveBits(
    { name: "PBKDF2", hash: { name: state.kdfHash }, salt, iterations: state.kdfIterations },
    keyMaterial,
    lengthBits,
  )
  return new Uint8Array(bits)
}

async function generateKeypair(state: KeyExchangeState) {
  const webCryptoAlgorithm = getWebCryptoAlgorithm(state)
  if (webCryptoAlgorithm) {
    if (!globalThis.crypto?.subtle) {
      throw new Error("Web Crypto is unavailable in this environment.")
    }
    const keyPair = await crypto.subtle.generateKey(webCryptoAlgorithm, true, ["deriveBits"])
    if (!isKeyPair(keyPair)) {
      throw new Error("Keypair generation failed.")
    }
    const publicKey = await crypto.subtle.exportKey("spki", keyPair.publicKey)
    const privateKey = await crypto.subtle.exportKey("pkcs8", keyPair.privateKey)
    return {
      publicPem: toPem(publicKey, "PUBLIC KEY"),
      privatePem: toPem(privateKey, "PRIVATE KEY"),
    }
  }

  if (state.algorithm === "ML-KEM") {
    const kem = pqcKemMap[state.pqcKemVariant]
    const { publicKey, secretKey } = kem.keygen()
    const publicPayload = createPqcPublicKey(state.pqcKemVariant, publicKey, state.pqcKeyEncoding)
    const privatePayload = createPqcPrivateKey(state.pqcKemVariant, publicKey, secretKey, state.pqcKeyEncoding)
    return {
      publicPem: JSON.stringify(publicPayload, null, 2),
      privatePem: JSON.stringify(privatePayload, null, 2),
    }
  }

  if (state.algorithm === "Hybrid KEM") {
    const kem = pqcHybridMap[state.pqcHybridVariant]
    const { publicKey, secretKey } = kem.keygen()
    const publicPayload = createPqcPublicKey(state.pqcHybridVariant, publicKey, state.pqcKeyEncoding)
    const privatePayload = createPqcPrivateKey(state.pqcHybridVariant, publicKey, secretKey, state.pqcKeyEncoding)
    return {
      publicPem: JSON.stringify(publicPayload, null, 2),
      privatePem: JSON.stringify(privatePayload, null, 2),
    }
  }

  if (state.algorithm === "ECDH") {
    const { secretKey } = secp256k1.keygen()
    const publicKey = secp256k1.getPublicKey(secretKey, false)
    const publicJwk = createEcJwk("secp256k1", publicKey)
    const privateJwk = createEcJwk("secp256k1", publicKey, secretKey)
    return {
      publicPem: JSON.stringify(publicJwk, null, 2),
      privatePem: JSON.stringify(privateJwk, null, 2),
    }
  }

  if (state.algorithm === "Schnorr") {
    const { secretKey } = schnorrCurve.keygen()
    const publicKey = secp256k1.getPublicKey(secretKey, false)
    const publicJwk = createEcJwk("secp256k1", publicKey)
    const privateJwk = createEcJwk("secp256k1", publicKey, secretKey)
    return {
      publicPem: JSON.stringify(publicJwk, null, 2),
      privatePem: JSON.stringify(privateJwk, null, 2),
    }
  }

  if (state.algorithm === "X25519") {
    const { secretKey, publicKey } = x25519.keygen()
    const publicJwk = createOkpJwk("X25519", publicKey)
    const privateJwk = createOkpJwk("X25519", publicKey, secretKey)
    return {
      publicPem: JSON.stringify(publicJwk, null, 2),
      privatePem: JSON.stringify(privateJwk, null, 2),
    }
  }

  const { secretKey, publicKey } = x448.keygen()
  const publicJwk = createOkpJwk("X448", publicKey)
  const privateJwk = createOkpJwk("X448", publicKey, secretKey)
  return {
    publicPem: JSON.stringify(publicJwk, null, 2),
    privatePem: JSON.stringify(privateJwk, null, 2),
  }
}

function ScrollableTabsList({ children }: { children: React.ReactNode }) {
  return (
    <div className="w-full min-w-0">
      <TabsList className="inline-flex h-auto max-w-full flex-wrap items-center justify-start gap-1 [&_[data-slot=tabs-trigger]]:flex-none [&_[data-slot=tabs-trigger]]:!text-sm [&_[data-slot=tabs-trigger][data-state=active]]:border-border">
        {children}
      </TabsList>
    </div>
  )
}

function InlineTabsList({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <TabsList
      className={cn(
        "inline-flex h-7 flex-nowrap items-center gap-1 [&_[data-slot=tabs-trigger]]:flex-none [&_[data-slot=tabs-trigger]]:!text-xs [&_[data-slot=tabs-trigger][data-state=active]]:border-border",
        className,
      )}
    >
      {children}
    </TabsList>
  )
}

export default function KeyExchangePage() {
  return (
    <Suspense fallback={null}>
      <KeyExchangeContent />
    </Suspense>
  )
}

function KeyExchangeContent() {
  const { state, setParam, oversizeKeys, hasUrlParams, hydrationSource, resetToDefaults } = useUrlSyncedState(
    "key-exchange",
    {
      schema: paramsSchema,
      defaults: paramsSchema.parse({}),
    },
  )

  const handleLoadHistory = React.useCallback(
    (entry: HistoryEntry) => {
      const { inputs, params } = entry
      if (inputs.localPrivateKey !== undefined) setParam("localPrivateKey", inputs.localPrivateKey)
      if (inputs.peerPublicKey !== undefined) setParam("peerPublicKey", inputs.peerPublicKey)
      const typedParams = params as Partial<KeyExchangeState>
      ;(Object.keys(paramsSchema.shape) as (keyof KeyExchangeState)[]).forEach((key) => {
        if (typedParams[key] !== undefined) {
          setParam(key, typedParams[key] as KeyExchangeState[typeof key])
        }
      })
    },
    [setParam],
  )

  return (
    <ToolPageWrapper
      toolId="key-exchange"
      title="Key Exchange"
      description="Derive shared secrets with ECDH, X25519/X448, or post-quantum KEMs (ML-KEM/hybrid), plus optional HKDF/PBKDF2 key derivation."
      onLoadHistory={handleLoadHistory}
    >
      <KeyExchangeInner
        state={state}
        setParam={setParam}
        oversizeKeys={oversizeKeys}
        hasUrlParams={hasUrlParams}
        hydrationSource={hydrationSource}
        resetToDefaults={resetToDefaults}
      />
    </ToolPageWrapper>
  )
}

function KeyExchangeInner({
  state,
  setParam,
  oversizeKeys,
  hasUrlParams,
  hydrationSource,
  resetToDefaults,
}: {
  state: KeyExchangeState
  setParam: <K extends keyof KeyExchangeState>(key: K, value: KeyExchangeState[K], immediate?: boolean) => void
  oversizeKeys: (keyof KeyExchangeState)[]
  hasUrlParams: boolean
  hydrationSource: "default" | "url" | "history"
  resetToDefaults: () => void
}) {
  const { upsertInputEntry, upsertParams } = useToolHistoryContext()
  const [sharedSecret, setSharedSecret] = React.useState("")
  const [derivedSecret, setDerivedSecret] = React.useState("")
  const [sharedBytes, setSharedBytes] = React.useState<Uint8Array<ArrayBuffer> | null>(null)
  const [kemCiphertextBytes, setKemCiphertextBytes] = React.useState<Uint8Array<ArrayBuffer> | null>(null)
  const [error, setError] = React.useState<string | null>(null)
  const [isWorking, setIsWorking] = React.useState(false)
  const [copied, setCopied] = React.useState<"shared" | "derived" | "ciphertext" | null>(null)
  const [isGeneratingKeys, setIsGeneratingKeys] = React.useState(false)
  const [isGeneratingPeerKey, setIsGeneratingPeerKey] = React.useState(false)
  const [encapsulateNonce, setEncapsulateNonce] = React.useState(0)
  const [lengthMode, setLengthMode] = React.useState<LengthPreset>(() => getLengthPreset(state.kdfLength) ?? "custom")
  const keyCacheRef = React.useRef<
    Partial<Record<string, { localPrivateKey: string; peerPublicKey: string }>>
  >({})
  const selectionRef = React.useRef(getAgreementKeyId(state))
  const localPrivateKeyRef = React.useRef<HTMLInputElement>(null)
  const peerPublicKeyRef = React.useRef<HTMLInputElement>(null)
  const lastEncapsulateRef = React.useRef(0)
  const kemInputsRef = React.useRef({
    peerPublicKey: state.peerPublicKey,
    localPrivateKey: state.localPrivateKey,
    kemCiphertext: state.kemCiphertext,
    pqcKemVariant: state.pqcKemVariant,
    pqcHybridVariant: state.pqcHybridVariant,
    pqcKeyEncoding: state.pqcKeyEncoding,
  })
  const kemCiphertextSourceRef = React.useRef<"encapsulate" | "manual" | "external">("external")
  const hasHydratedInputRef = React.useRef(false)
  const hasHandledUrlRef = React.useRef(false)
  const lastInputRef = React.useRef("")
  const paramsRef = React.useRef({
    algorithm: state.algorithm,
    ecdhCurve: state.ecdhCurve,
    localPrivateKey: state.localPrivateKey,
    peerPublicKey: state.peerPublicKey,
    kemMode: state.kemMode,
    pqcKemVariant: state.pqcKemVariant,
    pqcHybridVariant: state.pqcHybridVariant,
    pqcKeyEncoding: state.pqcKeyEncoding,
    kemCiphertext: state.kemCiphertext,
    outputEncoding: state.outputEncoding,
    useKdf: state.useKdf,
    kdfAlgorithm: state.kdfAlgorithm,
    kdfHash: state.kdfHash,
    kdfLength: state.kdfLength,
    kdfSalt: state.kdfSalt,
    kdfSaltEncoding: state.kdfSaltEncoding,
    kdfInfo: state.kdfInfo,
    kdfInfoEncoding: state.kdfInfoEncoding,
    kdfIterations: state.kdfIterations,
  })
  const hasInitializedParamsRef = React.useRef(false)
  const computeRunRef = React.useRef(0)
  const deriveRunRef = React.useRef(0)
  const maxKdfLength = React.useMemo(() => getMaxKdfLengthBytes(state.kdfHash), [state.kdfHash])
  const isKemAlgorithm = state.algorithm === "ML-KEM" || state.algorithm === "Hybrid KEM"

  React.useEffect(() => {
    if (state.kdfLength > maxKdfLength) {
      setParam("kdfLength", maxKdfLength, true)
    }
  }, [state.kdfLength, maxKdfLength, setParam])

  React.useEffect(() => {
    if (lengthMode === "custom") return
    const preset = getLengthPreset(state.kdfLength) ?? "custom"
    if (preset !== lengthMode) {
      setLengthMode(preset)
    }
  }, [state.kdfLength, lengthMode])

  const historyParams = React.useMemo(
    () => ({
      algorithm: state.algorithm,
      ecdhCurve: state.ecdhCurve,
      localPrivateKey: state.localPrivateKey,
      peerPublicKey: state.peerPublicKey,
      kemMode: state.kemMode,
      pqcKemVariant: state.pqcKemVariant,
      pqcHybridVariant: state.pqcHybridVariant,
      pqcKeyEncoding: state.pqcKeyEncoding,
      kemCiphertext: state.kemCiphertext,
      outputEncoding: state.outputEncoding,
      useKdf: state.useKdf,
      kdfAlgorithm: state.kdfAlgorithm,
      kdfHash: state.kdfHash,
      kdfLength: state.kdfLength,
      kdfSalt: state.kdfSalt,
      kdfSaltEncoding: state.kdfSaltEncoding,
      kdfInfo: state.kdfInfo,
      kdfInfoEncoding: state.kdfInfoEncoding,
      kdfIterations: state.kdfIterations,
    }),
    [
      state.algorithm,
      state.ecdhCurve,
      state.localPrivateKey,
      state.peerPublicKey,
      state.kemMode,
      state.pqcKemVariant,
      state.pqcHybridVariant,
      state.pqcKeyEncoding,
      state.kemCiphertext,
      state.outputEncoding,
      state.useKdf,
      state.kdfAlgorithm,
      state.kdfHash,
      state.kdfLength,
      state.kdfSalt,
      state.kdfSaltEncoding,
      state.kdfInfo,
      state.kdfInfoEncoding,
      state.kdfIterations,
    ],
  )

  React.useEffect(() => {
    const selectionKey = getAgreementKeyId(state)
    const prevKey = selectionRef.current
    if (prevKey !== selectionKey) {
      keyCacheRef.current[prevKey] = {
        localPrivateKey: state.localPrivateKey,
        peerPublicKey: state.peerPublicKey,
      }
      const cached = keyCacheRef.current[selectionKey]
      const nextLocalPrivate = cached?.localPrivateKey ?? ""
      const nextPeerPublic = cached?.peerPublicKey ?? ""
      if (nextLocalPrivate !== state.localPrivateKey) setParam("localPrivateKey", nextLocalPrivate)
      if (nextPeerPublic !== state.peerPublicKey) setParam("peerPublicKey", nextPeerPublic)
      selectionRef.current = selectionKey
      return
    }
    keyCacheRef.current[selectionKey] = {
      localPrivateKey: state.localPrivateKey,
      peerPublicKey: state.peerPublicKey,
    }
  }, [
    state.algorithm,
    state.ecdhCurve,
    state.pqcKemVariant,
    state.pqcHybridVariant,
    state.localPrivateKey,
    state.peerPublicKey,
    setParam,
  ])

  React.useEffect(() => {
    if (hasHydratedInputRef.current) return
    if (hydrationSource === "default") return
    const signature = `${state.localPrivateKey}|${state.peerPublicKey}|${state.kemCiphertext}`
    lastInputRef.current = signature
    hasHydratedInputRef.current = true
  }, [hydrationSource, state.localPrivateKey, state.peerPublicKey, state.kemCiphertext])

  React.useEffect(() => {
    const signature = `${state.localPrivateKey}|${state.peerPublicKey}|${state.kemCiphertext}`
    if (!signature.trim() || signature === lastInputRef.current) return

    const timer = setTimeout(() => {
      lastInputRef.current = signature
      const previewBase = state.peerPublicKey || state.localPrivateKey
      const preview = previewBase ? previewBase.slice(0, 100) : "Key agreement"
      upsertInputEntry(
        {
          localPrivateKey: state.localPrivateKey,
          peerPublicKey: state.peerPublicKey,
          kemCiphertext: state.kemCiphertext,
        },
        historyParams,
        "left",
        preview,
      )
    }, DEFAULT_URL_SYNC_DEBOUNCE_MS)

    return () => clearTimeout(timer)
  }, [state.localPrivateKey, state.peerPublicKey, state.kemCiphertext, historyParams, upsertInputEntry])

  React.useEffect(() => {
    if (hasUrlParams && !hasHandledUrlRef.current) {
      hasHandledUrlRef.current = true
    const signature = `${state.localPrivateKey}|${state.peerPublicKey}|${state.kemCiphertext}`
      if (signature.trim()) {
        const previewBase = state.peerPublicKey || state.localPrivateKey
        const preview = previewBase ? previewBase.slice(0, 100) : "Key agreement"
        upsertInputEntry(
          {
            localPrivateKey: state.localPrivateKey,
            peerPublicKey: state.peerPublicKey,
            kemCiphertext: state.kemCiphertext,
          },
          historyParams,
          "left",
          preview,
        )
      } else {
        upsertParams(historyParams, "interpretation")
      }
    }
  }, [
    hasUrlParams,
    state.localPrivateKey,
    state.peerPublicKey,
    state.kemCiphertext,
    historyParams,
    upsertInputEntry,
    upsertParams,
  ])

  React.useEffect(() => {
    const nextParams = historyParams
    if (!hasInitializedParamsRef.current) {
      hasInitializedParamsRef.current = true
      paramsRef.current = nextParams
      return
    }
    if (
      paramsRef.current.algorithm === nextParams.algorithm &&
      paramsRef.current.ecdhCurve === nextParams.ecdhCurve &&
      paramsRef.current.localPrivateKey === nextParams.localPrivateKey &&
      paramsRef.current.peerPublicKey === nextParams.peerPublicKey &&
      paramsRef.current.kemMode === nextParams.kemMode &&
      paramsRef.current.pqcKemVariant === nextParams.pqcKemVariant &&
      paramsRef.current.pqcHybridVariant === nextParams.pqcHybridVariant &&
      paramsRef.current.pqcKeyEncoding === nextParams.pqcKeyEncoding &&
      paramsRef.current.kemCiphertext === nextParams.kemCiphertext &&
      paramsRef.current.outputEncoding === nextParams.outputEncoding &&
      paramsRef.current.useKdf === nextParams.useKdf &&
      paramsRef.current.kdfAlgorithm === nextParams.kdfAlgorithm &&
      paramsRef.current.kdfHash === nextParams.kdfHash &&
      paramsRef.current.kdfLength === nextParams.kdfLength &&
      paramsRef.current.kdfSalt === nextParams.kdfSalt &&
      paramsRef.current.kdfSaltEncoding === nextParams.kdfSaltEncoding &&
      paramsRef.current.kdfInfo === nextParams.kdfInfo &&
      paramsRef.current.kdfInfoEncoding === nextParams.kdfInfoEncoding &&
      paramsRef.current.kdfIterations === nextParams.kdfIterations
    ) {
      return
    }
    paramsRef.current = nextParams
    upsertParams(nextParams, "interpretation")
  }, [historyParams, upsertParams])

  React.useEffect(() => {
    if (!isKemAlgorithm) return
    const nextInputs = {
      peerPublicKey: state.peerPublicKey,
      localPrivateKey: state.localPrivateKey,
      kemCiphertext: state.kemCiphertext,
      pqcKemVariant: state.pqcKemVariant,
      pqcHybridVariant: state.pqcHybridVariant,
      pqcKeyEncoding: state.pqcKeyEncoding,
    }
    const prevInputs = kemInputsRef.current
    const ciphertextChanged = prevInputs.kemCiphertext !== nextInputs.kemCiphertext
    const otherChanged =
      prevInputs.peerPublicKey !== nextInputs.peerPublicKey ||
      prevInputs.localPrivateKey !== nextInputs.localPrivateKey ||
      prevInputs.pqcKemVariant !== nextInputs.pqcKemVariant ||
      prevInputs.pqcHybridVariant !== nextInputs.pqcHybridVariant ||
      prevInputs.pqcKeyEncoding !== nextInputs.pqcKeyEncoding
    if (!ciphertextChanged && !otherChanged) {
      return
    }
    kemInputsRef.current = nextInputs
    if (otherChanged) {
      kemCiphertextSourceRef.current = "external"
    }
    if (ciphertextChanged && !otherChanged && kemCiphertextSourceRef.current === "encapsulate") {
      return
    }
    setSharedBytes(null)
    setKemCiphertextBytes(null)
    setSharedSecret("")
    setDerivedSecret("")
    setError(null)
    setIsWorking(false)
  }, [
    isKemAlgorithm,
    state.peerPublicKey,
    state.localPrivateKey,
    state.kemCiphertext,
    state.pqcKemVariant,
    state.pqcHybridVariant,
    state.pqcKeyEncoding,
  ])

  React.useEffect(() => {
    if (isKemAlgorithm) return
    const privateKeyText = state.localPrivateKey.trim()
    const peerKeyText = state.peerPublicKey.trim()
    if (!privateKeyText || !peerKeyText) {
      setSharedBytes(null)
      setKemCiphertextBytes(null)
      setSharedSecret("")
      setDerivedSecret("")
      setError(null)
      setIsWorking(false)
      return
    }

    const runId = ++computeRunRef.current
    setIsWorking(true)
    setError(null)

    const run = async () => {
      try {
        const webCryptoAlgorithm = getWebCryptoAlgorithm(state)
        if (webCryptoAlgorithm && !globalThis.crypto?.subtle) {
          throw new Error("Web Crypto is unavailable in this environment.")
        }

        let nextSharedBytes: Uint8Array

        if (webCryptoAlgorithm) {
          const privateKey = await importWebCryptoAgreementKey({ keyText: privateKeyText, algorithm: webCryptoAlgorithm, type: "private" })
          if (!privateKey) {
            throw new Error("Invalid private key format. Use PKCS8 PEM or JWK.")
          }
          const publicKey = await importWebCryptoAgreementKey({ keyText: peerKeyText, algorithm: webCryptoAlgorithm, type: "public" })
          if (!publicKey) {
            throw new Error("Invalid peer public key format. Use SPKI PEM or JWK.")
          }
          const bits = getSharedSecretBits(state.algorithm, state.ecdhCurve)
          const derived = await crypto.subtle.deriveBits(getDeriveParams(publicKey), privateKey, bits)
          nextSharedBytes = new Uint8Array(derived)
        } else if (state.algorithm === "ECDH") {
          const secretKey = getSecp256k1PrivateKeyBytes(privateKeyText)
          const publicKey = getSecp256k1PublicKeyBytes(peerKeyText)
          const shared = secp256k1.getSharedSecret(secretKey, publicKey, true)
          nextSharedBytes = shared.slice(1)
        } else if (state.algorithm === "Schnorr") {
          const secretKey = getSecp256k1PrivateKeyBytes(privateKeyText)
          const publicKey = getSchnorrPublicKeyBytes(peerKeyText)
          const shared = secp256k1.getSharedSecret(secretKey, publicKey, true)
          nextSharedBytes = shared.slice(1)
        } else if (state.algorithm === "X25519") {
          const secretKey = getOkpPrivateKeyBytes(privateKeyText, "X25519")
          const publicKey = getOkpPublicKeyBytes(peerKeyText, "X25519")
          nextSharedBytes = x25519.getSharedSecret(secretKey, publicKey)
        } else {
          const secretKey = getOkpPrivateKeyBytes(privateKeyText, "X448")
          const publicKey = getOkpPublicKeyBytes(peerKeyText, "X448")
          nextSharedBytes = x448.getSharedSecret(secretKey, publicKey)
        }

        if (computeRunRef.current !== runId) return
        setSharedBytes(nextSharedBytes as Uint8Array<ArrayBuffer>)
        setKemCiphertextBytes(null)
        setError(null)
      } catch (err) {
        if (computeRunRef.current !== runId) return
        setError(err instanceof Error ? err.message : "Failed to derive shared secret.")
        setSharedBytes(null)
        setKemCiphertextBytes(null)
        setSharedSecret("")
        setDerivedSecret("")
      } finally {
        if (computeRunRef.current === runId) {
          setIsWorking(false)
        }
      }
    }

    run()
  }, [isKemAlgorithm, state.algorithm, state.ecdhCurve, state.localPrivateKey, state.peerPublicKey])

  React.useEffect(() => {
    if (!isKemAlgorithm) return
    if (encapsulateNonce === 0 || encapsulateNonce === lastEncapsulateRef.current) return
    lastEncapsulateRef.current = encapsulateNonce
    const peerKeyText = state.peerPublicKey.trim()
    if (!peerKeyText) {
      setError("Provide a public key to encapsulate.")
      return
    }

    const runId = ++computeRunRef.current
    setIsWorking(true)
    setError(null)

    const run = async () => {
      try {
        const kem = state.algorithm === "ML-KEM" ? pqcKemMap[state.pqcKemVariant] : pqcHybridMap[state.pqcHybridVariant]
        const publicKey = resolvePqcKeyBytes(peerKeyText, state.pqcKeyEncoding, "public")
        const { cipherText, sharedSecret } = kem.encapsulate(publicKey)
        const encodedCiphertext = encodeOutputBytes(cipherText, state.outputEncoding)
        if (computeRunRef.current !== runId) return
        setSharedBytes(sharedSecret as Uint8Array<ArrayBuffer>)
        setKemCiphertextBytes(cipherText as Uint8Array<ArrayBuffer>)
        setParam("kemCiphertext", encodedCiphertext)
        setError(null)
      } catch (err) {
        if (computeRunRef.current !== runId) return
        setError(err instanceof Error ? err.message : "Failed to encapsulate shared secret.")
        setSharedBytes(null)
        setKemCiphertextBytes(null)
        setSharedSecret("")
        setDerivedSecret("")
      } finally {
        if (computeRunRef.current === runId) {
          setIsWorking(false)
        }
      }
    }

    run()
  }, [
    isKemAlgorithm,
    encapsulateNonce,
    state.algorithm,
    state.pqcKemVariant,
    state.pqcHybridVariant,
    state.pqcKeyEncoding,
    state.peerPublicKey,
    state.outputEncoding,
    setParam,
  ])

  React.useEffect(() => {
    if (!isKemAlgorithm) return
    const privateKeyText = state.localPrivateKey.trim()
    const ciphertextText = state.kemCiphertext.trim()
    if (!ciphertextText) {
      return
    }

    if (kemCiphertextSourceRef.current === "encapsulate" && !privateKeyText) {
      return
    }

    if (!privateKeyText) {
      setError("Provide a private key to decapsulate ciphertext.")
      setSharedBytes(null)
      setKemCiphertextBytes(null)
      setSharedSecret("")
      setDerivedSecret("")
      return
    }

    const runId = ++computeRunRef.current
    setIsWorking(true)
    setError(null)

    const run = async () => {
      try {
        const kem = state.algorithm === "ML-KEM" ? pqcKemMap[state.pqcKemVariant] : pqcHybridMap[state.pqcHybridVariant]
        const secretKey = resolvePqcKeyBytes(privateKeyText, state.pqcKeyEncoding, "private")
        const cipherText = decodeOutputBytes(state.kemCiphertext, state.outputEncoding)
        const nextSharedBytes = kem.decapsulate(cipherText, secretKey)
        if (computeRunRef.current !== runId) return
        setSharedBytes(nextSharedBytes as Uint8Array<ArrayBuffer>)
        setKemCiphertextBytes(null)
        setError(null)
      } catch (err) {
        if (computeRunRef.current !== runId) return
        setError(err instanceof Error ? err.message : "Failed to decapsulate shared secret.")
        setSharedBytes(null)
        setKemCiphertextBytes(null)
        setSharedSecret("")
        setDerivedSecret("")
      } finally {
        if (computeRunRef.current === runId) {
          setIsWorking(false)
        }
      }
    }

    run()
  }, [
    isKemAlgorithm,
    state.algorithm,
    state.pqcKemVariant,
    state.pqcHybridVariant,
    state.pqcKeyEncoding,
    state.localPrivateKey,
    state.kemCiphertext,
    state.outputEncoding,
  ])

  React.useEffect(() => {
    if (!sharedBytes) {
      setSharedSecret("")
      setDerivedSecret("")
      return
    }

    const runId = ++deriveRunRef.current
    setIsWorking(true)
    setError(null)

    const run = async () => {
      try {
        if (state.useKdf && !globalThis.crypto?.subtle) {
          throw new Error("Web Crypto is unavailable in this environment.")
        }
        const sharedText = encodeOutputBytes(sharedBytes, state.outputEncoding)
        const shouldSyncCiphertext =
          isKemAlgorithm && kemCiphertextBytes && kemCiphertextSourceRef.current === "encapsulate"
        const nextCiphertext = shouldSyncCiphertext
          ? encodeOutputBytes(kemCiphertextBytes, state.outputEncoding)
          : null
        const kdfBytes = state.useKdf ? await deriveKdfBytes(sharedBytes, state) : null
        const derivedText = kdfBytes ? encodeOutputBytes(kdfBytes, state.outputEncoding) : ""
        if (deriveRunRef.current !== runId) return
        setSharedSecret(sharedText)
        setDerivedSecret(derivedText)
        if (nextCiphertext && nextCiphertext !== state.kemCiphertext) {
          setParam("kemCiphertext", nextCiphertext)
        }
        setError(null)
      } catch (err) {
        if (deriveRunRef.current !== runId) return
        setError(err instanceof Error ? err.message : "Failed to derive shared secret.")
        setSharedSecret("")
        setDerivedSecret("")
      } finally {
        if (deriveRunRef.current === runId) {
          setIsWorking(false)
        }
      }
    }

    run()
  }, [
    sharedBytes,
    kemCiphertextBytes,
    isKemAlgorithm,
    state.outputEncoding,
    state.useKdf,
    state.kdfAlgorithm,
    state.kdfHash,
    state.kdfLength,
    state.kdfSalt,
    state.kdfSaltEncoding,
    state.kdfInfo,
    state.kdfInfoEncoding,
    state.kdfIterations,
    state.kemCiphertext,
    setParam,
  ])

  const handleLengthPresetChange = (value: LengthPreset) => {
    setLengthMode(value)
    if (value === "256") setParam("kdfLength", 32, true)
    if (value === "384") setParam("kdfLength", 48, true)
    if (value === "512") setParam("kdfLength", 64, true)
  }

  const handleGenerateSalt = () => {
    try {
      const bytes = randomBytes(SALT_DEFAULT_LENGTH)
      const encoded = encodeParamValue(bytes, state.kdfSaltEncoding)
      setParam("kdfSalt", encoded)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to generate salt.")
    }
  }

  const handleGenerateKeypair = async () => {
    try {
      setIsGeneratingKeys(true)
      setError(null)
      const { privatePem, publicPem } = await generateKeypair(state)
      setParam("localPrivateKey", privatePem)
      if (isKemAlgorithm) {
        setParam("peerPublicKey", publicPem)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to generate keypair.")
    } finally {
      setIsGeneratingKeys(false)
    }
  }

  const handleGeneratePeerKey = async () => {
    try {
      setIsGeneratingPeerKey(true)
      setError(null)
      const { privatePem, publicPem } = await generateKeypair(state)
      setParam("peerPublicKey", publicPem)
      if (isKemAlgorithm) {
        setParam("localPrivateKey", privatePem)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to generate peer key.")
    } finally {
      setIsGeneratingPeerKey(false)
    }
  }

  const handleEncapsulate = React.useCallback(() => {
    setParam("kemMode", "encapsulate", true)
    kemCiphertextSourceRef.current = "encapsulate"
    setEncapsulateNonce((prev) => prev + 1)
  }, [setParam])

  const handleCopy = async (value: string, target: "shared" | "derived" | "ciphertext") => {
    if (!value) return
    await navigator.clipboard.writeText(value)
    setCopied(target)
    setTimeout(() => setCopied(null), 2000)
  }

  const handleDownload = (value: string, name: string) => {
    if (!value) return
    const blob = new Blob([value], { type: "text/plain" })
    const url = URL.createObjectURL(blob)
    const link = document.createElement("a")
    link.href = url
    link.download = name
    link.click()
    URL.revokeObjectURL(url)
  }

  const handleKeyUploadClick = (type: "localPrivate" | "peerPublic") => {
    if (type === "localPrivate") {
      localPrivateKeyRef.current?.click()
    } else {
      peerPublicKeyRef.current?.click()
    }
  }

  const handleKeyFileUpload = (
    type: "localPrivate" | "peerPublic",
    event: React.ChangeEvent<HTMLInputElement>,
  ) => {
    const file = event.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = () => {
      const result = reader.result
      if (typeof result !== "string") return
      if (type === "localPrivate") {
        setParam("localPrivateKey", result)
      } else {
        setParam("peerPublicKey", result)
      }
    }
    reader.readAsText(file)
  }

  const handleClearAll = React.useCallback(() => {
    computeRunRef.current += 1
    deriveRunRef.current += 1
    resetToDefaults()
    setSharedSecret("")
    setDerivedSecret("")
    setSharedBytes(null)
    setKemCiphertextBytes(null)
    setEncapsulateNonce(0)
    kemCiphertextSourceRef.current = "external"
    setError(null)
    setIsWorking(false)
    setCopied(null)
  }, [resetToDefaults])

  const isKem = isKemAlgorithm
  const showLocalPrivateKey = true
  const showPeerPublicKey = true

  const localKeyHint = React.useMemo(() => {
    if (state.algorithm === "ECDH") {
      return state.ecdhCurve === "secp256k1" ? "JWK (EC secp256k1)" : "PEM (PKCS8) or JWK (EC)"
    }
    if (state.algorithm === "Schnorr") {
      return "JWK (EC secp256k1)"
    }
    if (state.algorithm === "ML-KEM" || state.algorithm === "Hybrid KEM") {
      return "PQC JSON or raw key"
    }
    return state.algorithm === "X448" ? "JWK (OKP X448)" : "JWK (OKP X25519)"
  }, [state.algorithm, state.ecdhCurve])

  const peerPublicHint = React.useMemo(() => {
    if (state.algorithm === "ECDH") {
      return state.ecdhCurve === "secp256k1" ? "JWK (EC secp256k1)" : "PEM (SPKI) or JWK (EC)"
    }
    if (state.algorithm === "Schnorr") {
      return "JWK (EC secp256k1, x-only ok)"
    }
    if (state.algorithm === "ML-KEM" || state.algorithm === "Hybrid KEM") {
      return "PQC JSON or raw key"
    }
    return state.algorithm === "X448" ? "JWK (OKP X448)" : "JWK (OKP X25519)"
  }, [state.algorithm, state.ecdhCurve])

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-base font-semibold">Key Exchange</h2>
        <Button variant="ghost" size="sm" onClick={handleClearAll} className="h-8 px-3 text-sm">
          Clear
        </Button>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="flex flex-col gap-4">
          <div className="flex items-center gap-3">
            <Label className="w-24 text-sm sm:w-32">Algorithm</Label>
            <Tabs
              value={state.algorithm}
              onValueChange={(value) => setParam("algorithm", value as AgreementAlgorithm, true)}
              className="min-w-0 flex-1"
            >
              <ScrollableTabsList>
                {algorithmValues.map((value) => (
                  <TabsTrigger key={value} value={value} className="text-xs">
                    {value}
                  </TabsTrigger>
                ))}
              </ScrollableTabsList>
            </Tabs>
          </div>

          {state.algorithm === "ML-KEM" && (
            <div className="flex items-center gap-3">
              <Label className="w-24 text-sm sm:w-32">Parameter Set</Label>
              <Tabs
                value={state.pqcKemVariant}
                onValueChange={(value) => setParam("pqcKemVariant", value as PqcKemVariant, true)}
                className="min-w-0 flex-1"
              >
                <ScrollableTabsList>
                  {pqcKemVariants.map((variant) => (
                    <TabsTrigger key={variant} value={variant} className="text-xs">
                      {variant}
                    </TabsTrigger>
                  ))}
                </ScrollableTabsList>
              </Tabs>
            </div>
          )}

          {state.algorithm === "Hybrid KEM" && (
            <div className="flex items-center gap-3">
              <Label className="w-24 text-sm sm:w-32">Parameter Set</Label>
              <Tabs
                value={state.pqcHybridVariant}
                onValueChange={(value) => setParam("pqcHybridVariant", value as PqcHybridVariant, true)}
                className="min-w-0 flex-1"
              >
                <ScrollableTabsList>
                  {pqcHybridVariants.map((variant) => (
                    <TabsTrigger key={variant} value={variant} className="text-xs">
                      {variant}
                    </TabsTrigger>
                  ))}
                </ScrollableTabsList>
              </Tabs>
            </div>
          )}

          {state.algorithm === "ECDH" && (
            <div className="flex items-center gap-3">
              <Label className="w-24 text-sm sm:w-32">Curve</Label>
              <Tabs
                value={state.ecdhCurve}
                onValueChange={(value) => setParam("ecdhCurve", value as EcdhCurve, true)}
              >
                <ScrollableTabsList>
                  {ecdhCurves.map((curve) => (
                    <TabsTrigger key={curve} value={curve} className="text-xs">
                      {curve}
                    </TabsTrigger>
                  ))}
                </ScrollableTabsList>
              </Tabs>
            </div>
          )}
          {state.algorithm === "Schnorr" && (
            <div className="flex items-center gap-3">
              <Label className="w-24 text-sm sm:w-32">Curve</Label>
              <span className="text-sm font-medium">secp256k1</span>
            </div>
          )}

          {showLocalPrivateKey && (
            <div className="flex items-start gap-3">
              <Label className="w-24 text-sm sm:w-32 pt-2">
                {isKem ? "Private Key" : "Local Private Key"}
              </Label>
              <div className="min-w-0 flex-1">
                <Textarea
                  value={state.localPrivateKey}
                  onChange={(event) => setParam("localPrivateKey", event.target.value)}
                  placeholder={isKem ? "Paste private key..." : "-----BEGIN PRIVATE KEY-----"}
                  className={cn(
                    "min-h-[160px] max-h-[240px] overflow-auto break-all font-mono text-xs",
                    oversizeKeys.includes("localPrivateKey") && "border-destructive",
                  )}
                />
                <div className="mt-2 flex items-center justify-between gap-2">
                  <p className="text-xs text-muted-foreground">{localKeyHint}</p>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleKeyUploadClick("localPrivate")}
                      className="h-7 gap-1 px-2 text-xs"
                    >
                      <Upload className="h-3 w-3" />
                      Upload
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={handleGenerateKeypair}
                      className="h-7 gap-1 px-2 text-xs"
                      disabled={isGeneratingKeys}
                    >
                      <RefreshCcw className="h-3 w-3" />
                      {isGeneratingKeys ? "Generating..." : "Generate"}
                    </Button>
                  </div>
                </div>
                {isKem && (
                  <div className="mt-2 flex items-center justify-end">
                    <Tabs
                      value={state.pqcKeyEncoding}
                      onValueChange={(value) => setParam("pqcKeyEncoding", value as PqcKeyEncoding, true)}
                      className="flex-row gap-0"
                    >
                    <InlineTabsList className="h-6 gap-1">
                      {pqcKeyEncodings.map((encoding) => (
                        <TabsTrigger key={encoding} value={encoding} className="text-[10px] sm:text-xs px-2">
                          {encodingLabels[encoding]}
                        </TabsTrigger>
                      ))}
                    </InlineTabsList>
                  </Tabs>
                </div>
              )}
                {oversizeKeys.includes("localPrivateKey") && (
                  <p className="text-xs text-muted-foreground">Private key exceeds 2 KB and is not synced to the URL.</p>
                )}
              </div>
            </div>
          )}

          {showPeerPublicKey && (
            <div className="flex items-start gap-3">
              <Label className="w-24 text-sm sm:w-32 pt-2">
                {isKem ? "Public Key" : "Peer Public Key"}
              </Label>
              <div className="min-w-0 flex-1">
                <Textarea
                  value={state.peerPublicKey}
                  onChange={(event) => setParam("peerPublicKey", event.target.value)}
                  placeholder={isKem ? "Paste public key..." : "-----BEGIN PUBLIC KEY-----"}
                  className={cn(
                    "min-h-[160px] max-h-[240px] overflow-auto break-all font-mono text-xs",
                    oversizeKeys.includes("peerPublicKey") && "border-destructive",
                  )}
                />
                <div className="mt-2 flex items-center justify-between gap-2">
                  <p className="text-xs text-muted-foreground">{peerPublicHint}</p>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleKeyUploadClick("peerPublic")}
                      className="h-7 gap-1 px-2 text-xs"
                    >
                      <Upload className="h-3 w-3" />
                      Upload
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={handleGeneratePeerKey}
                      className="h-7 gap-1 px-2 text-xs"
                      disabled={isGeneratingPeerKey}
                    >
                      <RefreshCcw className="h-3 w-3" />
                      {isGeneratingPeerKey ? "Generating..." : "Generate"}
                    </Button>
                  </div>
                </div>
                {isKem && (
                  <div className="mt-2 flex items-center justify-end">
                    <Tabs
                      value={state.pqcKeyEncoding}
                      onValueChange={(value) => setParam("pqcKeyEncoding", value as PqcKeyEncoding, true)}
                      className="flex-row gap-0"
                    >
                    <InlineTabsList className="h-6 gap-1">
                      {pqcKeyEncodings.map((encoding) => (
                        <TabsTrigger key={encoding} value={encoding} className="text-[10px] sm:text-xs px-2">
                          {encodingLabels[encoding]}
                        </TabsTrigger>
                      ))}
                    </InlineTabsList>
                  </Tabs>
                </div>
              )}
                {oversizeKeys.includes("peerPublicKey") && (
                  <p className="text-xs text-muted-foreground">Peer key exceeds 2 KB and is not synced to the URL.</p>
                )}
              </div>
            </div>
          )}

          <input
            ref={localPrivateKeyRef}
            type="file"
            onChange={(event) => handleKeyFileUpload("localPrivate", event)}
            className="hidden"
          />
          <input
            ref={peerPublicKeyRef}
            type="file"
            onChange={(event) => handleKeyFileUpload("peerPublic", event)}
            className="hidden"
          />
        </div>

        <div className="flex flex-col gap-4">
          {isKem && (
            <div className="space-y-2">
              <div className="flex items-center gap-3">
                <Label className="text-sm">Ciphertext</Label>
                <div className="ml-auto flex shrink-0 items-center gap-1">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleEncapsulate}
                    className="h-7 gap-1 px-2 text-xs"
                    disabled={isWorking || !state.peerPublicKey.trim()}
                  >
                    <RefreshCcw className="h-3 w-3" />
                    Encapsulate
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleCopy(state.kemCiphertext, "ciphertext")}
                    className="h-7 w-7 p-0"
                    aria-label="Copy ciphertext"
                    disabled={!state.kemCiphertext}
                  >
                    {copied === "ciphertext" ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleDownload(state.kemCiphertext, "key-exchange-ciphertext.txt")}
                    className="h-7 w-7 p-0"
                    aria-label="Download ciphertext"
                    disabled={!state.kemCiphertext}
                  >
                    <Download className="h-3 w-3" />
                  </Button>
                </div>
              </div>
              <Textarea
                value={state.kemCiphertext}
                onChange={(event) => {
                  kemCiphertextSourceRef.current = "manual"
                  setParam("kemCiphertext", event.target.value)
                }}
                placeholder="Paste or generate ciphertext..."
                className={cn(
                  "min-h-[120px] max-h-[200px] overflow-auto break-all font-mono text-xs",
                  oversizeKeys.includes("kemCiphertext") && "border-destructive",
                )}
              />
              <div className="flex items-start justify-between gap-2">
                <p className="text-xs text-muted-foreground">
                  Uses the shared secret encoding. Public key required to encapsulate; private key required to
                  decapsulate edited ciphertext.
                </p>
              </div>
              {oversizeKeys.includes("kemCiphertext") && (
                <p className="text-xs text-muted-foreground">Ciphertext exceeds 2 KB and is not synced to the URL.</p>
              )}
            </div>
          )}

          <div className="space-y-2">
            <div className="flex items-center gap-3">
              <Label className="text-sm">Shared Secret</Label>
              <Tabs
                value={state.outputEncoding}
                onValueChange={(value) => setParam("outputEncoding", value as OutputEncoding, true)}
                className="min-w-0 flex-1"
              >
                <InlineTabsList>
                  {outputEncodings.map((encoding) => (
                    <TabsTrigger key={encoding} value={encoding} className="text-xs flex-none">
                      {encodingLabels[encoding]}
                    </TabsTrigger>
                  ))}
                </InlineTabsList>
              </Tabs>
              <div className="flex shrink-0 items-center gap-1">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handleCopy(sharedSecret, "shared")}
                  className="h-7 w-7 p-0"
                  aria-label="Copy shared secret"
                  disabled={!sharedSecret}
                >
                  {copied === "shared" ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handleDownload(sharedSecret, "key-exchange-shared.txt")}
                  className="h-7 w-7 p-0"
                  aria-label="Download shared secret"
                  disabled={!sharedSecret}
                >
                  <Download className="h-3 w-3" />
                </Button>
              </div>
            </div>
            <Textarea
              value={sharedSecret}
              readOnly
              placeholder="Shared secret will appear here..."
              className="min-h-[160px] max-h-[240px] overflow-auto break-all font-mono text-xs"
            />
          </div>

          <div className="rounded-md border p-3">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <Checkbox
                  id="use-kdf"
                  checked={state.useKdf}
                  onCheckedChange={(value) => setParam("useKdf", Boolean(value), true)}
                />
                <Label htmlFor="use-kdf" className="text-sm">
                  Use KDF
                </Label>
              </div>
              <span className="text-xs text-muted-foreground">Derive a final key from the shared secret.</span>
            </div>

            {state.useKdf && (
              <div className="mt-3 space-y-3">
                <div className="flex items-center gap-3">
                  <Label className="w-24 text-sm sm:w-32">Algorithm</Label>
                  <Tabs
                    value={state.kdfAlgorithm}
                    onValueChange={(value) => setParam("kdfAlgorithm", value as KdfAlgorithm, true)}
                  >
                  <ScrollableTabsList>
                    {kdfAlgorithms.map((alg) => (
                      <TabsTrigger key={alg} value={alg} className="text-xs">
                        {alg}
                      </TabsTrigger>
                    ))}
                  </ScrollableTabsList>
                </Tabs>
              </div>
              <div className="flex items-center gap-3">
                <Label className="w-24 text-sm sm:w-32">Hash</Label>
                <Tabs value={state.kdfHash} onValueChange={(value) => setParam("kdfHash", value as KdfHash, true)}>
                    <ScrollableTabsList>
                      {kdfHashes.map((hash) => (
                        <TabsTrigger key={hash} value={hash} className="text-xs">
                          {hash}
                        </TabsTrigger>
                      ))}
                    </ScrollableTabsList>
                  </Tabs>
                </div>
                <div className="flex items-center gap-3">
                  <Label className="w-24 text-sm sm:w-32">Length</Label>
                  <Tabs value={lengthMode} onValueChange={(value) => handleLengthPresetChange(value as LengthPreset)}>
                  <ScrollableTabsList>
                    <TabsTrigger value="256" className="text-xs">
                      256-bit
                    </TabsTrigger>
                    <TabsTrigger value="384" className="text-xs">
                      384-bit
                    </TabsTrigger>
                    <TabsTrigger value="512" className="text-xs">
                      512-bit
                    </TabsTrigger>
                    <TabsTrigger value="custom" className="text-xs">
                      Custom
                    </TabsTrigger>
                  </ScrollableTabsList>
                </Tabs>
              </div>
                {lengthMode === "custom" && (
                  <div className="flex items-center gap-3">
                    <div className="w-24 sm:w-32" />
                    <div className="min-w-0 flex-1 space-y-1">
                      <Slider
                        value={[state.kdfLength]}
                        min={1}
                        max={maxKdfLength}
                        step={1}
                        onValueChange={(value) => setParam("kdfLength", value[0] ?? 1, true)}
                      />
                      <p className="text-xs text-muted-foreground">{state.kdfLength * 8} bits</p>
                    </div>
                  </div>
                )}
                {state.kdfAlgorithm === "PBKDF2" && (
                  <div className="flex items-center gap-3">
                    <Label className="w-24 text-sm sm:w-32">Iterations</Label>
                    <Input
                      type="number"
                      min={1}
                      max={10000000}
                      value={state.kdfIterations}
                      onChange={(event) => {
                        const value = Number.parseInt(event.target.value, 10)
                        setParam("kdfIterations", Number.isNaN(value) ? 100000 : value, true)
                      }}
                      className="h-9 w-32"
                    />
                  </div>
                )}
                <div className="flex items-center gap-3">
                  <Label className="w-24 text-sm sm:w-32">Salt</Label>
                  <div className="flex min-w-0 flex-1 flex-col gap-2">
                    <Tabs
                      value={state.kdfSaltEncoding}
                      onValueChange={(value) => setParam("kdfSaltEncoding", value as ParamEncoding, true)}
                    >
                      <InlineTabsList className="h-7">
                        {paramEncodings.map((encoding) => (
                          <TabsTrigger key={encoding} value={encoding} className="text-[10px] sm:text-xs px-2">
                            {encodingLabels[encoding]}
                          </TabsTrigger>
                        ))}
                      </InlineTabsList>
                    </Tabs>
                    <div className="relative">
                      <Input
                        value={state.kdfSalt}
                        onChange={(event) => setParam("kdfSalt", event.target.value)}
                        placeholder="Enter salt..."
                        className={cn(
                          "h-9 pr-10 font-mono text-xs",
                          oversizeKeys.includes("kdfSalt") && "border-destructive",
                        )}
                      />
                      <div className="absolute right-1 top-1/2 -translate-y-1/2">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={handleGenerateSalt}
                          className="h-7 w-7 p-0"
                          aria-label="Generate salt"
                        >
                          <RefreshCcw className="h-3 w-3" />
                        </Button>
                      </div>
                    </div>
                  </div>
                </div>
                {state.kdfAlgorithm === "HKDF" && (
                  <div className="flex items-center gap-3">
                    <Label className="w-24 text-sm sm:w-32">Info</Label>
                    <div className="flex min-w-0 flex-1 flex-col gap-2">
                      <Tabs
                        value={state.kdfInfoEncoding}
                        onValueChange={(value) => setParam("kdfInfoEncoding", value as ParamEncoding, true)}
                      >
                      <InlineTabsList className="h-7">
                        {paramEncodings.map((encoding) => (
                          <TabsTrigger key={encoding} value={encoding} className="text-[10px] sm:text-xs px-2">
                            {encodingLabels[encoding]}
                          </TabsTrigger>
                        ))}
                      </InlineTabsList>
                    </Tabs>
                      <Input
                        value={state.kdfInfo}
                        onChange={(event) => setParam("kdfInfo", event.target.value)}
                        placeholder="Enter info..."
                        className={cn("h-9 font-mono text-xs", oversizeKeys.includes("kdfInfo") && "border-destructive")}
                      />
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          {state.useKdf && (
            <div className="space-y-2">
              <div className="flex items-center gap-3">
                <Label className="text-sm">Derived Key</Label>
                <div className="ml-auto flex shrink-0 items-center gap-1">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleCopy(derivedSecret, "derived")}
                    className="h-7 w-7 p-0"
                    aria-label="Copy derived key"
                    disabled={!derivedSecret}
                  >
                    {copied === "derived" ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleDownload(derivedSecret, "key-exchange-derived.txt")}
                    className="h-7 w-7 p-0"
                    aria-label="Download derived key"
                    disabled={!derivedSecret}
                  >
                    <Download className="h-3 w-3" />
                  </Button>
                </div>
              </div>
              <Textarea
                value={derivedSecret}
                readOnly
                placeholder="Derived key will appear here..."
                className="min-h-[160px] max-h-[240px] overflow-auto break-all font-mono text-xs"
              />
            </div>
          )}

          {isWorking && <p className="text-xs text-muted-foreground">Deriving shared secret...</p>}
          {error && (
            <Alert variant="destructive" className="py-2">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription className="text-xs">{error}</AlertDescription>
            </Alert>
          )}
        </div>
      </div>
    </div>
  )
}
