"use client"

import * as React from "react"
import { Suspense } from "react"
import { z } from "zod"
import { AlertCircle, Check, Copy, RefreshCcw, Upload, X } from "lucide-react"
import { Spooky, SpookyLong, SpookyShort } from "gnablib/checksum"
import { U64 } from "gnablib/primitive/number"
import MurmurHash3 from "murmurhash3js-revisited"
import { crc32, crc64, xxhash128, xxhash3, xxhash32, xxhash64 } from "hash-wasm"
import { ToolPageWrapper, useToolHistoryContext } from "@/components/tool-ui/tool-page-wrapper"
import { DEFAULT_URL_SYNC_DEBOUNCE_MS, useUrlSyncedState } from "@/lib/url-state/use-url-synced-state"
import { Textarea } from "@/components/ui/textarea"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Button } from "@/components/ui/button"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { decodeBase64, encodeBase64 } from "@/lib/encoding/base64"
import { decodeHex, encodeHex } from "@/lib/encoding/hex"
import { cn } from "@/lib/utils"
import type { HistoryEntry } from "@/lib/history/db"

type HighwayHashModule = typeof import("highwayhash-wasm")
type HighwayHashResult = Awaited<ReturnType<HighwayHashModule["useHighwayHash"]>>

let highwayHasherPromise: Promise<HighwayHashResult> | null = null
let farmhashPromise: Promise<typeof import("farmhash-modern")> | null = null

const inputEncodings = ["utf8", "base64", "hex"] as const
const outputEncodings = ["hex", "base64", "base64url", "decimal"] as const
const keyEncodings = ["utf8", "base64", "hex"] as const

const algorithmFamilies = [
  "murmur3",
  "xxhash",
  "farmhash",
  "siphash",
  "spookyhash",
  "highwayhash",
  "fnv",
  "crc",
] as const
const murmurVariants = ["x86-32", "x86-128", "x64-128"] as const
const xxhashVariants = ["xxhash32", "xxhash64", "xxhash3", "xxhash128"] as const
const farmhashVariants = [
  "fingerprint32",
  "fingerprint64",
  "hash32",
  "hash32WithSeed",
  "hash64",
  "hash64WithSeed",
  "bigqueryFingerprint",
] as const
const spookyVariants = ["auto", "short", "long"] as const
const highwayVariants = ["64", "128", "256"] as const
const fnvVariants = ["fnv1", "fnv1a"] as const
const fnvSizes = ["32", "64"] as const
const crcVariants = ["crc32", "crc64"] as const

type InputEncoding = (typeof inputEncodings)[number]
type OutputEncoding = (typeof outputEncodings)[number]
type KeyEncoding = (typeof keyEncodings)[number]
type AlgorithmFamily = (typeof algorithmFamilies)[number]
type MurmurVariant = (typeof murmurVariants)[number]
type XxhashVariant = (typeof xxhashVariants)[number]
type FarmhashVariant = (typeof farmhashVariants)[number]
type SpookyVariant = (typeof spookyVariants)[number]
type HighwayVariant = (typeof highwayVariants)[number]
type FnvVariant = (typeof fnvVariants)[number]
type FnvSize = (typeof fnvSizes)[number]
type CrcVariant = (typeof crcVariants)[number]

const paramsSchema = z.object({
  input: z.string().default(""),
  inputEncoding: z.enum(inputEncodings).default("utf8"),
  outputEncoding: z.enum(outputEncodings).default("hex"),
  algorithmFamily: z.enum(algorithmFamilies).default("xxhash"),
  murmurVariant: z.enum(murmurVariants).default("x86-32"),
  murmurSeed: z.string().default("0"),
  xxhashVariant: z.enum(xxhashVariants).default("xxhash64"),
  xxhashSeed: z.string().default("0"),
  farmhashVariant: z.enum(farmhashVariants).default("fingerprint64"),
  farmhashSeed: z.string().default("0"),
  siphashCRounds: z.coerce.number().int().min(1).max(32).default(2),
  siphashDRounds: z.coerce.number().int().min(1).max(32).default(4),
  spookyVariant: z.enum(spookyVariants).default("auto"),
  spookySeed1: z.string().default("0"),
  spookySeed2: z.string().default("0"),
  highwayVariant: z.enum(highwayVariants).default("64"),
  fnvVariant: z.enum(fnvVariants).default("fnv1a"),
  fnvSize: z.enum(fnvSizes).default("64"),
  crcVariant: z.enum(crcVariants).default("crc32"),
  key: z.string().default(""),
  keyEncoding: z.enum(keyEncodings).default("hex"),
})

const algorithmLabels: Record<AlgorithmFamily, string> = {
  murmur3: "MurmurHash3",
  xxhash: "xxHash",
  farmhash: "CityHash/FarmHash",
  siphash: "SipHash",
  spookyhash: "SpookyHash",
  highwayhash: "HighwayHash",
  fnv: "FNV",
  crc: "CRC",
}

const outputEncodingLabels: Record<OutputEncoding, string> = {
  hex: "Hex",
  base64: "Base64",
  base64url: "Base64url",
  decimal: "Decimal",
}

const textEncoder = new TextEncoder()

function parseInputBytes(value: string, encoding: InputEncoding) {
  if (!value) return new Uint8Array()
  if (encoding === "utf8") return textEncoder.encode(value)
  if (encoding === "base64") return decodeBase64(value)
  return decodeHex(value)
}

function parseKeyBytes(value: string, encoding: KeyEncoding) {
  if (!value) return new Uint8Array()
  if (encoding === "utf8") return textEncoder.encode(value)
  if (encoding === "base64") return decodeBase64(value)
  return decodeHex(value)
}

type HashResult = {
  bytes: Uint8Array
  bits: number
  value?: bigint
}

function bigIntToBytes(value: bigint, length: number) {
  const bytes = new Uint8Array(length)
  let working = value
  for (let i = length - 1; i >= 0; i -= 1) {
    bytes[i] = Number(working & 0xffn)
    working >>= 8n
  }
  return bytes
}

function bytesToBigInt(bytes: Uint8Array) {
  let value = 0n
  for (const byte of bytes) {
    value = (value << 8n) | BigInt(byte)
  }
  return value
}

function bytesToBinaryString(bytes: Uint8Array) {
  let value = ""
  const chunkSize = 0x8000
  for (let i = 0; i < bytes.length; i += chunkSize) {
    value += String.fromCharCode(...bytes.subarray(i, i + chunkSize))
  }
  return value
}

function parseSeedValue(value: string) {
  const trimmed = value.trim()
  if (!trimmed) return 0n
  try {
    return BigInt(trimmed)
  } catch {
    throw new Error("Seed must be an integer (decimal or 0x...).")
  }
}

function seedToU32(seed: bigint) {
  return Number(seed & 0xffffffffn) >>> 0
}

function seedToU64Parts(seed: bigint) {
  return {
    low: Number(seed & 0xffffffffn) >>> 0,
    high: Number((seed >> 32n) & 0xffffffffn) >>> 0,
  }
}

function parseU64Seed(value: string) {
  const seed = parseSeedValue(value)
  const { low, high } = seedToU64Parts(seed)
  return U64.fromI32s(low, high)
}

function formatOutput(result: HashResult, encoding: OutputEncoding) {
  if (encoding === "decimal") {
    const value = result.value ?? bytesToBigInt(result.bytes)
    return BigInt.asUintN(result.bits, value).toString(10)
  }
  if (encoding === "hex") return encodeHex(result.bytes, { upperCase: false })
  if (encoding === "base64") return encodeBase64(result.bytes, { urlSafe: false, padding: true })
  return encodeBase64(result.bytes, { urlSafe: true, padding: false })
}

function fnvHash32(bytes: Uint8Array, variant: FnvVariant) {
  let hash = 0x811c9dc5
  const prime = 0x01000193
  for (const byte of bytes) {
    if (variant === "fnv1") {
      hash = Math.imul(hash, prime) >>> 0
      hash ^= byte
    } else {
      hash ^= byte
      hash = Math.imul(hash, prime) >>> 0
    }
  }
  return hash >>> 0
}

function fnvHash64(bytes: Uint8Array, variant: FnvVariant) {
  let hash = 0xcbf29ce484222325n
  const prime = 0x100000001b3n
  for (const byte of bytes) {
    if (variant === "fnv1") {
      hash = (hash * prime) & 0xffffffffffffffffn
      hash ^= BigInt(byte)
    } else {
      hash ^= BigInt(byte)
      hash = (hash * prime) & 0xffffffffffffffffn
    }
  }
  return hash
}

function sipHashKeyFromBytes(bytes: Uint8Array) {
  if (bytes.length !== 16) {
    throw new Error("SipHash requires a 16-byte key.")
  }
  const key = new Uint32Array(4)
  key[0] = (bytes[3] << 24) | (bytes[2] << 16) | (bytes[1] << 8) | bytes[0]
  key[1] = (bytes[7] << 24) | (bytes[6] << 16) | (bytes[5] << 8) | bytes[4]
  key[2] = (bytes[11] << 24) | (bytes[10] << 16) | (bytes[9] << 8) | bytes[8]
  key[3] = (bytes[15] << 24) | (bytes[14] << 16) | (bytes[13] << 8) | bytes[12]
  return key
}

function sipHash64(key: Uint32Array, input: Uint8Array, cRounds: number, dRounds: number) {
  const add = (a: { h: number; l: number }, b: { h: number; l: number }) => {
    const rl = a.l + b.l
    a.h = (a.h + b.h + ((rl / 2) >>> 31)) >>> 0
    a.l = rl >>> 0
  }
  const xor = (a: { h: number; l: number }, b: { h: number; l: number }) => {
    a.h = (a.h ^ b.h) >>> 0
    a.l = (a.l ^ b.l) >>> 0
  }
  const rotl = (a: { h: number; l: number }, n: number) => {
    const h = (a.h << n) | (a.l >>> (32 - n))
    const l = (a.l << n) | (a.h >>> (32 - n))
    a.h = h >>> 0
    a.l = l >>> 0
  }
  const rotl32 = (a: { h: number; l: number }) => {
    const tmp = a.l
    a.l = a.h
    a.h = tmp
  }
  const compress = (v0: { h: number; l: number }, v1: { h: number; l: number }, v2: { h: number; l: number }, v3: { h: number; l: number }) => {
    add(v0, v1)
    add(v2, v3)
    rotl(v1, 13)
    rotl(v3, 16)
    xor(v1, v0)
    xor(v3, v2)
    rotl32(v0)
    add(v2, v1)
    add(v0, v3)
    rotl(v1, 17)
    rotl(v3, 21)
    xor(v1, v2)
    xor(v3, v0)
    rotl32(v2)
  }
  const getInt = (arr: Uint8Array, offset: number) =>
    (arr[offset + 3] << 24) | (arr[offset + 2] << 16) | (arr[offset + 1] << 8) | arr[offset]

  const k0 = { h: key[1] >>> 0, l: key[0] >>> 0 }
  const k1 = { h: key[3] >>> 0, l: key[2] >>> 0 }
  const v0 = { h: k0.h, l: k0.l }
  const v1 = { h: k1.h, l: k1.l }
  const v2 = { h: k0.h, l: k0.l }
  const v3 = { h: k1.h, l: k1.l }

  xor(v0, { h: 0x736f6d65, l: 0x70736575 })
  xor(v1, { h: 0x646f7261, l: 0x6e646f6d })
  xor(v2, { h: 0x6c796765, l: 0x6e657261 })
  xor(v3, { h: 0x74656462, l: 0x79746573 })

  const mLen = input.length
  const mLenAligned = mLen - (mLen % 8)
  for (let offset = 0; offset < mLenAligned; offset += 8) {
    const mi = { h: getInt(input, offset + 4), l: getInt(input, offset) }
    xor(v3, mi)
    for (let i = 0; i < cRounds; i += 1) {
      compress(v0, v1, v2, v3)
    }
    xor(v0, mi)
  }

  const tail = new Uint8Array(8)
  tail[7] = mLen & 0xff
  for (let i = 0; i < mLen - mLenAligned; i += 1) {
    tail[i] = input[mLenAligned + i] ?? 0
  }
  const last = {
    h: (tail[7] << 24) | (tail[6] << 16) | (tail[5] << 8) | tail[4],
    l: (tail[3] << 24) | (tail[2] << 16) | (tail[1] << 8) | tail[0],
  }
  xor(v3, last)
  for (let i = 0; i < cRounds; i += 1) {
    compress(v0, v1, v2, v3)
  }
  xor(v0, last)
  xor(v2, { h: 0, l: 0xff })
  for (let i = 0; i < dRounds; i += 1) {
    compress(v0, v1, v2, v3)
  }

  const h = { h: v0.h, l: v0.l }
  xor(h, v1)
  xor(h, v2)
  xor(h, v3)
  return (BigInt(h.h >>> 0) << 32n) | BigInt(h.l >>> 0)
}

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

async function getHighwayHasher() {
  if (!highwayHasherPromise) {
    highwayHasherPromise = import("highwayhash-wasm").then((mod) => mod.useHighwayHash())
  }
  return highwayHasherPromise
}

async function getFarmhashModule() {
  if (!farmhashPromise) {
    farmhashPromise = import("farmhash-modern")
  }
  return farmhashPromise
}

function getOutputBits(state: z.infer<typeof paramsSchema>) {
  switch (state.algorithmFamily) {
    case "murmur3":
      return state.murmurVariant === "x86-32" ? 32 : 128
    case "xxhash":
      if (state.xxhashVariant === "xxhash32") return 32
      if (state.xxhashVariant === "xxhash64" || state.xxhashVariant === "xxhash3") return 64
      return 128
    case "farmhash":
      return state.farmhashVariant.includes("32") ? 32 : 64
    case "siphash":
      return 64
    case "spookyhash":
      return 128
    case "highwayhash":
      return Number(state.highwayVariant)
    case "fnv":
      return state.fnvSize === "32" ? 32 : 64
    case "crc":
      return state.crcVariant === "crc32" ? 32 : 64
    default:
      return 64
  }
}

function createSpookyHasher(state: z.infer<typeof paramsSchema>) {
  const seed1 = parseU64Seed(state.spookySeed1)
  const seed2 = parseU64Seed(state.spookySeed2)
  if (state.spookyVariant === "short") return new SpookyShort(seed1, seed2)
  if (state.spookyVariant === "long") return new SpookyLong(seed1, seed2)
  return new Spooky(seed1, seed2)
}

async function computeHashResult({
  state,
  input,
  keyBytes,
}: {
  state: z.infer<typeof paramsSchema>
  input: Uint8Array
  keyBytes: Uint8Array | null
}): Promise<HashResult> {
  switch (state.algorithmFamily) {
    case "murmur3": {
      const seed = seedToU32(parseSeedValue(state.murmurSeed))
      const payload = bytesToBinaryString(input)
      if (state.murmurVariant === "x86-32") {
        const value = MurmurHash3.x86.hash32(payload, seed) >>> 0
        return { bytes: bigIntToBytes(BigInt(value), 4), bits: 32, value: BigInt(value) }
      }
      if (state.murmurVariant === "x86-128") {
        const hex = MurmurHash3.x86.hash128(payload, seed)
        return { bytes: decodeHex(hex), bits: 128 }
      }
      const hex = MurmurHash3.x64.hash128(payload, seed)
      return { bytes: decodeHex(hex), bits: 128 }
    }
    case "xxhash": {
      const seed = parseSeedValue(state.xxhashSeed)
      const { low, high } = seedToU64Parts(seed)
      if (state.xxhashVariant === "xxhash32") {
        const hex = await xxhash32(input, seedToU32(seed))
        const bytes = decodeHex(hex)
        return { bytes, bits: 32, value: BigInt(`0x${hex}`) }
      }
      if (state.xxhashVariant === "xxhash64") {
        const hex = await xxhash64(input, low, high)
        const bytes = decodeHex(hex)
        return { bytes, bits: 64, value: BigInt(`0x${hex}`) }
      }
      if (state.xxhashVariant === "xxhash3") {
        const hex = await xxhash3(input, low, high)
        const bytes = decodeHex(hex)
        return { bytes, bits: 64, value: BigInt(`0x${hex}`) }
      }
      const hex = await xxhash128(input, low, high)
      return { bytes: decodeHex(hex), bits: 128 }
    }
    case "farmhash": {
      const farmhash = await getFarmhashModule()
      switch (state.farmhashVariant) {
        case "fingerprint32": {
          const value = farmhash.fingerprint32(input) >>> 0
          return { bytes: bigIntToBytes(BigInt(value), 4), bits: 32, value: BigInt(value) }
        }
        case "hash32": {
          const value = farmhash.hash32(input) >>> 0
          return { bytes: bigIntToBytes(BigInt(value), 4), bits: 32, value: BigInt(value) }
        }
        case "hash32WithSeed": {
          const seed = seedToU32(parseSeedValue(state.farmhashSeed))
          const value = farmhash.hash32WithSeed(input, seed) >>> 0
          return { bytes: bigIntToBytes(BigInt(value), 4), bits: 32, value: BigInt(value) }
        }
        case "fingerprint64": {
          const value = BigInt.asUintN(64, BigInt(farmhash.fingerprint64(input)))
          return { bytes: bigIntToBytes(value, 8), bits: 64, value }
        }
        case "hash64": {
          const value = BigInt.asUintN(64, BigInt(farmhash.hash64(input)))
          return { bytes: bigIntToBytes(value, 8), bits: 64, value }
        }
        case "hash64WithSeed": {
          const seed = BigInt.asUintN(64, parseSeedValue(state.farmhashSeed))
          const value = BigInt.asUintN(64, BigInt(farmhash.hash64WithSeed(input, seed)))
          return { bytes: bigIntToBytes(value, 8), bits: 64, value }
        }
        case "bigqueryFingerprint": {
          const value = BigInt.asUintN(64, BigInt(farmhash.bigqueryFingerprint(input)))
          return { bytes: bigIntToBytes(value, 8), bits: 64, value }
        }
        default:
          return { bytes: new Uint8Array(), bits: 64 }
      }
    }
    case "siphash": {
      if (!keyBytes) throw new Error("SipHash requires a key.")
      const key = sipHashKeyFromBytes(keyBytes)
      const cRounds = state.siphashCRounds
      const dRounds = state.siphashDRounds
      const value = sipHash64(key, input, cRounds, dRounds)
      return { bytes: bigIntToBytes(value, 8), bits: 64, value }
    }
    case "spookyhash": {
      const hasher = createSpookyHasher(state)
      hasher.write(input)
      const bytes = hasher.sum()
      return { bytes, bits: bytes.length * 8 }
    }
    case "highwayhash": {
      if (!keyBytes) throw new Error("HighwayHash requires a key.")
      const highway = await getHighwayHasher()
      if (state.highwayVariant === "128") {
        const hash = highway.hasher.hash128(keyBytes, input)
        return { bytes: hash.toBytes(), bits: 128 }
      }
      if (state.highwayVariant === "256") {
        const hash = highway.hasher.hash256(keyBytes, input)
        return { bytes: hash.toBytes(), bits: 256 }
      }
      const hash = highway.hasher.hash64(keyBytes, input)
      return { bytes: hash.toBytes(), bits: 64 }
    }
    case "fnv": {
      if (state.fnvSize === "32") {
        const value = fnvHash32(input, state.fnvVariant)
        return { bytes: bigIntToBytes(BigInt(value), 4), bits: 32, value: BigInt(value) }
      }
      const value = fnvHash64(input, state.fnvVariant)
      const unsigned = BigInt.asUintN(64, value)
      return { bytes: bigIntToBytes(unsigned, 8), bits: 64, value: unsigned }
    }
    case "crc": {
      if (state.crcVariant === "crc64") {
        const hex = await crc64(input)
        const bytes = decodeHex(hex)
        return { bytes, bits: 64, value: BigInt(`0x${hex}`) }
      }
      const hex = await crc32(input)
      const bytes = decodeHex(hex)
      return { bytes, bits: 32, value: BigInt(`0x${hex}`) }
    }
    default:
      return { bytes: new Uint8Array(), bits: 64 }
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

export default function NonCryptoHashPage() {
  return (
    <Suspense fallback={null}>
      <NonCryptoHashContent />
    </Suspense>
  )
}

function NonCryptoHashContent() {
  const { state, setParam, oversizeKeys, hasUrlParams, hydrationSource } = useUrlSyncedState("non-crypto-hash", {
    schema: paramsSchema,
    defaults: paramsSchema.parse({}),
  })
  const [fileName, setFileName] = React.useState<string | null>(null)

  const handleLoadHistory = React.useCallback(
    (entry: HistoryEntry) => {
      const { inputs, params } = entry

      if (params.fileName) {
        alert("This history entry contains an uploaded file and cannot be restored. Only the file name was recorded.")
        return
      }

      setFileName(null)
      if (inputs.input !== undefined) setParam("input", inputs.input)
      const typedParams = params as Partial<z.infer<typeof paramsSchema>>
      ;(Object.keys(paramsSchema.shape) as (keyof z.infer<typeof paramsSchema>)[]).forEach((key) => {
        if (typedParams[key] !== undefined) {
          setParam(key, typedParams[key] as z.infer<typeof paramsSchema>[typeof key])
        }
      })
    },
    [setParam],
  )

  return (
    <ToolPageWrapper
      toolId="non-crypto-hash"
      title="Non-Crypto Hash"
      description="Generate fast, non-cryptographic hashes including MurmurHash, xxHash, CityHash/FarmHash, SipHash, SpookyHash, HighwayHash, FNV, and CRC32."
      onLoadHistory={handleLoadHistory}
    >
      <NonCryptoHashInner
        state={state}
        setParam={setParam}
        oversizeKeys={oversizeKeys}
        hasUrlParams={hasUrlParams}
        hydrationSource={hydrationSource}
        fileName={fileName}
        setFileName={setFileName}
      />
    </ToolPageWrapper>
  )
}

function NonCryptoHashInner({
  state,
  setParam,
  oversizeKeys,
  hasUrlParams,
  hydrationSource,
  fileName,
  setFileName,
}: {
  state: z.infer<typeof paramsSchema>
  setParam: <K extends keyof z.infer<typeof paramsSchema>>(
    key: K,
    value: z.infer<typeof paramsSchema>[K],
    immediate?: boolean,
  ) => void
  oversizeKeys: (keyof z.infer<typeof paramsSchema>)[]
  hasUrlParams: boolean
  hydrationSource: "default" | "url" | "history"
  fileName: string | null
  setFileName: (value: string | null) => void
}) {
  const { upsertInputEntry, upsertParams } = useToolHistoryContext()
  const [output, setOutput] = React.useState("")
  const [error, setError] = React.useState<string | null>(null)
  const [isHashing, setIsHashing] = React.useState(false)
  const [copied, setCopied] = React.useState(false)
  const fileInputRef = React.useRef<HTMLInputElement>(null)
  const lastInputRef = React.useRef<string>("")
  const hasHydratedInputRef = React.useRef(false)
  const hasInitializedParamsRef = React.useRef(false)
  const hasHandledUrlRef = React.useRef(false)
  const hashRunRef = React.useRef(0)
  const fileBytesRef = React.useRef<Uint8Array | null>(null)
  const [fileVersion, setFileVersion] = React.useState(0)
  const outputBits = getOutputBits(state)
  const allowedOutputEncodings = React.useMemo(
    () => (outputBits <= 64 ? outputEncodings : outputEncodings.filter((encoding) => encoding !== "decimal")),
    [outputBits],
  )
  const keyRequirement =
    state.algorithmFamily === "siphash" ? 16 : state.algorithmFamily === "highwayhash" ? 32 : null

  const paramsForHistory = React.useMemo(
    () => ({
      inputEncoding: state.inputEncoding,
      outputEncoding: state.outputEncoding,
      algorithmFamily: state.algorithmFamily,
      murmurVariant: state.murmurVariant,
      murmurSeed: state.murmurSeed,
      xxhashVariant: state.xxhashVariant,
      xxhashSeed: state.xxhashSeed,
      farmhashVariant: state.farmhashVariant,
      farmhashSeed: state.farmhashSeed,
      siphashCRounds: state.siphashCRounds,
      siphashDRounds: state.siphashDRounds,
      spookyVariant: state.spookyVariant,
      spookySeed1: state.spookySeed1,
      spookySeed2: state.spookySeed2,
      highwayVariant: state.highwayVariant,
      fnvVariant: state.fnvVariant,
      fnvSize: state.fnvSize,
      crcVariant: state.crcVariant,
      key: state.key,
      keyEncoding: state.keyEncoding,
      fileName,
    }),
    [
      state.inputEncoding,
      state.outputEncoding,
      state.algorithmFamily,
      state.murmurVariant,
      state.murmurSeed,
      state.xxhashVariant,
      state.xxhashSeed,
      state.farmhashVariant,
      state.farmhashSeed,
      state.siphashCRounds,
      state.siphashDRounds,
      state.spookyVariant,
      state.spookySeed1,
      state.spookySeed2,
      state.highwayVariant,
      state.fnvVariant,
      state.fnvSize,
      state.crcVariant,
      state.key,
      state.keyEncoding,
      fileName,
    ],
  )

  const paramsRef = React.useRef(paramsForHistory)

  React.useEffect(() => {
    if (outputBits > 64 && state.outputEncoding === "decimal") {
      setParam("outputEncoding", "hex", true)
    }
  }, [outputBits, state.outputEncoding, setParam])

  React.useEffect(() => {
    if (hasHydratedInputRef.current) return
    if (hydrationSource === "default") return
    lastInputRef.current = fileName ? `file:${fileName}:${fileVersion}` : `text:${state.input}`
    hasHydratedInputRef.current = true
  }, [hydrationSource, state.input, fileName, fileVersion])

  React.useEffect(() => {
    if (!fileName && fileBytesRef.current) {
      fileBytesRef.current = null
      if (fileVersion) setFileVersion(0)
    }
  }, [fileName, fileVersion])

  React.useEffect(() => {
    const hasFile = Boolean(fileName && fileVersion)
    const activeSignature = hasFile ? `file:${fileName}:${fileVersion}` : `text:${state.input}`
    if ((!hasFile && !state.input) || activeSignature === lastInputRef.current) return

    const timer = setTimeout(() => {
      lastInputRef.current = activeSignature
      const preview = fileName ?? state.input.slice(0, 100)
      upsertInputEntry(
        { input: fileName ? "" : state.input },
        paramsForHistory,
        "left",
        preview,
      )
    }, DEFAULT_URL_SYNC_DEBOUNCE_MS)

    return () => clearTimeout(timer)
  }, [state.input, fileName, fileVersion, paramsForHistory, upsertInputEntry])

  React.useEffect(() => {
    if (hasUrlParams && !hasHandledUrlRef.current) {
      hasHandledUrlRef.current = true
      const activeText = state.input
      if (activeText) {
        upsertInputEntry(
          { input: state.input },
          paramsForHistory,
          "left",
          activeText.slice(0, 100),
        )
      } else {
        upsertParams(paramsForHistory, "interpretation")
      }
    }
  }, [hasUrlParams, state.input, paramsForHistory, upsertInputEntry, upsertParams])

  React.useEffect(() => {
    const nextParams = paramsForHistory
    if (!hasInitializedParamsRef.current) {
      hasInitializedParamsRef.current = true
      paramsRef.current = nextParams
      return
    }
    const keys = Object.keys(nextParams) as (keyof typeof nextParams)[]
    const same = keys.every((key) => paramsRef.current[key] === nextParams[key])
    if (same) return
    paramsRef.current = nextParams
    upsertParams(nextParams, "interpretation")
  }, [paramsForHistory, upsertParams])

  React.useEffect(() => {
    const inputValue = state.input
    const hasFile = Boolean(fileBytesRef.current && fileName)
    if (!inputValue.trim() && !hasFile) {
      setOutput("")
      setError(null)
      setIsHashing(false)
      return
    }

    const runId = ++hashRunRef.current
    setIsHashing(true)

    void (async () => {
      try {
        const bytes = hasFile ? fileBytesRef.current! : parseInputBytes(inputValue, state.inputEncoding)
        let keyBytes: Uint8Array | null = null

        if (keyRequirement) {
          if (!state.key.trim()) {
            throw new Error(`${algorithmLabels[state.algorithmFamily]} requires a ${keyRequirement}-byte key.`)
          }
          keyBytes = parseKeyBytes(state.key, state.keyEncoding)
          if (keyBytes.length !== keyRequirement) {
            throw new Error(`${algorithmLabels[state.algorithmFamily]} requires a ${keyRequirement}-byte key.`)
          }
        }

        const digest = await computeHashResult({ state, input: bytes, keyBytes })
        const normalized = formatOutput(digest, state.outputEncoding)
        if (hashRunRef.current !== runId) return
        setOutput(normalized)
        setError(null)
      } catch (err) {
        if (hashRunRef.current !== runId) return
        setOutput("")
        setError(err instanceof Error ? err.message : "Failed to hash input.")
      } finally {
        if (hashRunRef.current === runId) {
          setIsHashing(false)
        }
      }
    })()
  }, [
    state.input,
    state.inputEncoding,
    state.outputEncoding,
    state.algorithmFamily,
    state.murmurVariant,
    state.murmurSeed,
    state.xxhashVariant,
    state.xxhashSeed,
    state.farmhashVariant,
    state.farmhashSeed,
    state.siphashCRounds,
    state.siphashDRounds,
    state.spookyVariant,
    state.spookySeed1,
    state.spookySeed2,
    state.highwayVariant,
    state.fnvVariant,
    state.fnvSize,
    state.crcVariant,
    state.key,
    state.keyEncoding,
    fileName,
    fileVersion,
    keyRequirement,
  ])

  const handleFileUpload = React.useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0]
      event.target.value = ""
      if (!file) return

      const reader = new FileReader()
      reader.onload = (e) => {
        const buffer = e.target?.result as ArrayBuffer
        if (!buffer) return
        fileBytesRef.current = new Uint8Array(buffer)
        setParam("input", "")
        setFileName(file.name)
        setFileVersion((prev) => prev + 1)
        setError(null)
      }
      reader.readAsArrayBuffer(file)
    },
    [setParam, setFileName],
  )

  const handleCopy = async () => {
    if (!output) return
    await navigator.clipboard.writeText(output)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const handleClearFile = () => {
    setFileName(null)
    fileBytesRef.current = null
    setFileVersion(0)
  }

  const handleInputChange = (value: string) => {
    setParam("input", value)
    if (fileName || fileBytesRef.current) {
      handleClearFile()
    }
  }

  const handleGenerateKey = () => {
    if (!keyRequirement) return
    try {
      if (state.keyEncoding === "utf8") {
        setParam("key", randomAsciiString(keyRequirement))
        setError(null)
        return
      }
      const bytes = randomBytes(keyRequirement)
      if (state.keyEncoding === "hex") {
        setParam("key", encodeHex(bytes, { upperCase: false }))
        setError(null)
        return
      }
      setParam("key", encodeBase64(bytes, { urlSafe: false, padding: true }))
      setError(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to generate key.")
    }
  }

  return (
    <div className="flex h-full flex-col gap-4">
      <div className="flex flex-col gap-3">
        <div className="flex items-start gap-3">
          <Label className="w-28 shrink-0 text-sm">Algorithm</Label>
          <Tabs
            value={state.algorithmFamily}
            onValueChange={(value) => setParam("algorithmFamily", value as AlgorithmFamily, true)}
            className="min-w-0 flex-1"
          >
            <ScrollableTabsList>
              {algorithmFamilies.map((family) => (
                <TabsTrigger key={family} value={family} className="text-xs flex-none">
                  {algorithmLabels[family]}
                </TabsTrigger>
              ))}
            </ScrollableTabsList>
          </Tabs>
        </div>

        {state.algorithmFamily === "murmur3" && (
          <>
            <div className="flex items-center gap-3">
              <Label className="w-28 shrink-0 text-sm">Variant</Label>
              <Tabs
                value={state.murmurVariant}
                onValueChange={(value) => setParam("murmurVariant", value as MurmurVariant, true)}
                className="min-w-0 flex-1"
              >
                <ScrollableTabsList>
                  {murmurVariants.map((variant) => (
                    <TabsTrigger key={variant} value={variant} className="text-xs flex-none">
                      {variant}
                    </TabsTrigger>
                  ))}
                </ScrollableTabsList>
              </Tabs>
            </div>
            <div className="flex items-center gap-3">
              <Label className="w-28 shrink-0 text-sm">Seed</Label>
              <Input
                value={state.murmurSeed}
                onChange={(event) => setParam("murmurSeed", event.target.value, true)}
                placeholder="0 or 0x..."
                className="min-w-0 flex-1 font-mono text-xs"
              />
            </div>
          </>
        )}

        {state.algorithmFamily === "xxhash" && (
          <>
            <div className="flex items-center gap-3">
              <Label className="w-28 shrink-0 text-sm">Variant</Label>
              <Tabs
                value={state.xxhashVariant}
                onValueChange={(value) => setParam("xxhashVariant", value as XxhashVariant, true)}
                className="min-w-0 flex-1"
              >
                <ScrollableTabsList>
                  {xxhashVariants.map((variant) => (
                    <TabsTrigger key={variant} value={variant} className="text-xs flex-none">
                      {variant}
                    </TabsTrigger>
                  ))}
                </ScrollableTabsList>
              </Tabs>
            </div>
            <div className="flex items-center gap-3">
              <Label className="w-28 shrink-0 text-sm">Seed</Label>
              <Input
                value={state.xxhashSeed}
                onChange={(event) => setParam("xxhashSeed", event.target.value, true)}
                placeholder="64-bit seed"
                className="min-w-0 flex-1 font-mono text-xs"
              />
            </div>
          </>
        )}

        {state.algorithmFamily === "farmhash" && (
          <>
            <div className="flex items-center gap-3">
              <Label className="w-28 shrink-0 text-sm">Variant</Label>
              <Tabs
                value={state.farmhashVariant}
                onValueChange={(value) => setParam("farmhashVariant", value as FarmhashVariant, true)}
                className="min-w-0 flex-1"
              >
                <ScrollableTabsList>
                  {farmhashVariants.map((variant) => (
                    <TabsTrigger key={variant} value={variant} className="text-xs flex-none">
                      {variant}
                    </TabsTrigger>
                  ))}
                </ScrollableTabsList>
              </Tabs>
            </div>
            {state.farmhashVariant.includes("Seed") && (
              <div className="flex items-center gap-3">
                <Label className="w-28 shrink-0 text-sm">Seed</Label>
                <Input
                  value={state.farmhashSeed}
                  onChange={(event) => setParam("farmhashSeed", event.target.value, true)}
                  placeholder="Seed value"
                  className="min-w-0 flex-1 font-mono text-xs"
                />
              </div>
            )}
          </>
        )}

        {state.algorithmFamily === "siphash" && (
          <div className="flex items-center gap-3">
            <Label className="w-28 shrink-0 text-sm">Rounds</Label>
            <div className="flex min-w-0 flex-1 gap-2">
              <Input
                type="number"
                min={1}
                max={32}
                value={state.siphashCRounds}
                onChange={(event) => setParam("siphashCRounds", Number(event.target.value) || 1, true)}
                className="w-24 font-mono text-xs"
              />
              <Input
                type="number"
                min={1}
                max={32}
                value={state.siphashDRounds}
                onChange={(event) => setParam("siphashDRounds", Number(event.target.value) || 1, true)}
                className="w-24 font-mono text-xs"
              />
              <span className="text-xs text-muted-foreground">c rounds / d rounds</span>
            </div>
          </div>
        )}

        {state.algorithmFamily === "spookyhash" && (
          <>
            <div className="flex items-center gap-3">
              <Label className="w-28 shrink-0 text-sm">Variant</Label>
              <Tabs
                value={state.spookyVariant}
                onValueChange={(value) => setParam("spookyVariant", value as SpookyVariant, true)}
                className="min-w-0 flex-1"
              >
                <ScrollableTabsList>
                  {spookyVariants.map((variant) => (
                    <TabsTrigger key={variant} value={variant} className="text-xs flex-none">
                      {variant}
                    </TabsTrigger>
                  ))}
                </ScrollableTabsList>
              </Tabs>
            </div>
            <div className="flex items-center gap-3">
              <Label className="w-28 shrink-0 text-sm">Seeds</Label>
              <div className="flex min-w-0 flex-1 gap-2">
                <Input
                  value={state.spookySeed1}
                  onChange={(event) => setParam("spookySeed1", event.target.value, true)}
                  placeholder="Seed 1"
                  className="min-w-0 flex-1 font-mono text-xs"
                />
                <Input
                  value={state.spookySeed2}
                  onChange={(event) => setParam("spookySeed2", event.target.value, true)}
                  placeholder="Seed 2"
                  className="min-w-0 flex-1 font-mono text-xs"
                />
              </div>
            </div>
          </>
        )}

        {state.algorithmFamily === "highwayhash" && (
          <div className="flex items-center gap-3">
            <Label className="w-28 shrink-0 text-sm">Output</Label>
            <Tabs
              value={state.highwayVariant}
              onValueChange={(value) => setParam("highwayVariant", value as HighwayVariant, true)}
              className="min-w-0 flex-1"
            >
              <ScrollableTabsList>
                {highwayVariants.map((variant) => (
                  <TabsTrigger key={variant} value={variant} className="text-xs flex-none">
                    {variant}-bit
                  </TabsTrigger>
                ))}
              </ScrollableTabsList>
            </Tabs>
          </div>
        )}

        {state.algorithmFamily === "fnv" && (
          <>
            <div className="flex items-center gap-3">
              <Label className="w-28 shrink-0 text-sm">Variant</Label>
              <Tabs
                value={state.fnvVariant}
                onValueChange={(value) => setParam("fnvVariant", value as FnvVariant, true)}
                className="min-w-0 flex-1"
              >
                <ScrollableTabsList>
                  {fnvVariants.map((variant) => (
                    <TabsTrigger key={variant} value={variant} className="text-xs flex-none">
                      {variant.toUpperCase()}
                    </TabsTrigger>
                  ))}
                </ScrollableTabsList>
              </Tabs>
            </div>
            <div className="flex items-center gap-3">
              <Label className="w-28 shrink-0 text-sm">Size</Label>
              <Tabs
                value={state.fnvSize}
                onValueChange={(value) => setParam("fnvSize", value as FnvSize, true)}
                className="min-w-0 flex-1"
              >
                <ScrollableTabsList>
                  {fnvSizes.map((size) => (
                    <TabsTrigger key={size} value={size} className="text-xs flex-none">
                      {size}-bit
                    </TabsTrigger>
                  ))}
                </ScrollableTabsList>
              </Tabs>
            </div>
          </>
        )}

        {state.algorithmFamily === "crc" && (
          <div className="flex items-center gap-3">
            <Label className="w-28 shrink-0 text-sm">Variant</Label>
            <Tabs
              value={state.crcVariant}
              onValueChange={(value) => setParam("crcVariant", value as CrcVariant, true)}
              className="min-w-0 flex-1"
            >
              <ScrollableTabsList>
                {crcVariants.map((variant) => (
                  <TabsTrigger key={variant} value={variant} className="text-xs flex-none">
                    {variant.toUpperCase()}
                  </TabsTrigger>
                ))}
              </ScrollableTabsList>
            </Tabs>
          </div>
        )}
      </div>

      {keyRequirement && (
        <div className="flex items-start gap-3">
          <Label className="w-28 shrink-0 text-sm">Key</Label>
          <div className="min-w-0 flex-1 space-y-2">
            <Textarea
              value={state.key}
              onChange={(event) => setParam("key", event.target.value)}
              placeholder="Enter key material..."
              className={cn("min-h-[96px] font-mono text-xs break-all", error && "border-destructive")}
            />
            <div className="flex flex-wrap items-center justify-between gap-2">
              <Tabs value={state.keyEncoding} onValueChange={(value) => setParam("keyEncoding", value as KeyEncoding, true)}>
                <InlineTabsList>
                  <TabsTrigger value="utf8" className="text-xs">
                    UTF-8
                  </TabsTrigger>
                  <TabsTrigger value="base64" className="text-xs">
                    Base64
                  </TabsTrigger>
                  <TabsTrigger value="hex" className="text-xs">
                    Hex
                  </TabsTrigger>
                </InlineTabsList>
              </Tabs>
              <Button variant="ghost" size="sm" onClick={handleGenerateKey} className="h-8 px-2 text-xs">
                <RefreshCcw className="h-4 w-4" />
                Generate
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">Requires a {keyRequirement}-byte key.</p>
            {oversizeKeys.includes("key") && (
              <p className="text-xs text-muted-foreground">Key exceeds 2 KB and is not synced to the URL.</p>
            )}
          </div>
        </div>
      )}

      <div className="flex flex-col gap-4 md:flex-row">
        <div className="flex w-full flex-1 flex-col gap-2 md:w-0">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <Label className="text-sm font-medium">Input</Label>
              <Tabs
                value={state.inputEncoding}
                onValueChange={(value) => setParam("inputEncoding", value as InputEncoding, true)}
              >
                <InlineTabsList>
                  <TabsTrigger value="utf8" className="text-xs">
                    UTF-8
                  </TabsTrigger>
                  <TabsTrigger value="base64" className="text-xs">
                    Base64
                  </TabsTrigger>
                  <TabsTrigger value="hex" className="text-xs">
                    Hex
                  </TabsTrigger>
                </InlineTabsList>
              </Tabs>
            </div>
            <div className="flex items-center gap-1">
              <input ref={fileInputRef} type="file" onChange={handleFileUpload} className="hidden" />
              <Button
                variant="ghost"
                size="sm"
                onClick={() => fileInputRef.current?.click()}
                className="h-7 gap-1 px-2 text-xs"
              >
                <Upload className="h-3 w-3" />
                File
              </Button>
              {fileName && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleClearFile}
                  className="h-7 w-7 p-0"
                  aria-label="Clear file"
                >
                  <X className="h-3 w-3" />
                </Button>
              )}
            </div>
          </div>
          <div className="relative">
            <Textarea
              value={state.input}
              onChange={(e) => handleInputChange(e.target.value)}
              placeholder="Enter text to hash..."
              className={cn(
                "max-h-[360px] min-h-[240px] overflow-auto overflow-x-hidden break-all whitespace-pre-wrap font-mono text-sm",
                error && "border-destructive",
              )}
            />
            {fileName && (
              <div className="absolute inset-0 flex items-center justify-center gap-3 rounded-md border bg-background/95 text-sm text-muted-foreground">
                <span className="max-w-[70%] truncate font-medium text-foreground">{fileName}</span>
                <button
                  type="button"
                  className="inline-flex h-6 w-6 items-center justify-center rounded hover:bg-muted/60"
                  onClick={handleClearFile}
                  aria-label="Clear file"
                >
                  <X className="h-3 w-3" />
                </button>
              </div>
            )}
          </div>
          {oversizeKeys.includes("input") && (
            <p className="text-xs text-muted-foreground">Input exceeds 2 KB and is not synced to the URL.</p>
          )}
          {isHashing && <p className="text-xs text-muted-foreground">Hashing...</p>}
          {error && (
            <Alert variant="destructive" className="py-2">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription className="text-xs">{error}</AlertDescription>
            </Alert>
          )}
        </div>

        <div className="flex w-full flex-1 flex-col gap-2 md:w-0">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <Label className="text-sm font-medium">Digest</Label>
              <Tabs
                value={state.outputEncoding}
                onValueChange={(value) => setParam("outputEncoding", value as OutputEncoding, true)}
              >
                <InlineTabsList>
                  {allowedOutputEncodings.map((encoding) => (
                    <TabsTrigger key={encoding} value={encoding} className="text-xs">
                      {outputEncodingLabels[encoding]}
                    </TabsTrigger>
                  ))}
                </InlineTabsList>
              </Tabs>
            </div>
            <div className="flex items-center gap-1">
              <Button
                variant="ghost"
                size="sm"
                onClick={handleCopy}
                disabled={!output}
                className="h-7 gap-1 px-2 text-xs"
              >
                {copied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
                {copied ? "Copied" : "Copy"}
              </Button>
            </div>
          </div>
          <Textarea
            value={output}
            readOnly
            placeholder="Digest will appear here..."
            className="max-h-[360px] min-h-[240px] overflow-auto overflow-x-hidden break-all whitespace-pre-wrap font-mono text-sm"
          />
        </div>
      </div>
    </div>
  )
}
