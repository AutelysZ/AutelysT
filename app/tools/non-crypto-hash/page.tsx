"use client"

import * as React from "react"
import { Suspense } from "react"
import { z } from "zod"
import { AlertCircle, Check, Copy, RefreshCcw, Upload, X } from "lucide-react"
import { Crc32, Murmur3_32, Spooky, XxHash64 } from "gnablib/checksum"
import * as siphash from "siphash"
import { ToolPageWrapper, useToolHistoryContext } from "@/components/tool-ui/tool-page-wrapper"
import { DEFAULT_URL_SYNC_DEBOUNCE_MS, useUrlSyncedState } from "@/lib/url-state/use-url-synced-state"
import { Textarea } from "@/components/ui/textarea"
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
const outputEncodings = ["hex", "base64", "base64url"] as const
const keyEncodings = ["utf8", "base64", "hex"] as const

const algorithmValues = [
  "murmur3-32",
  "xxhash64",
  "farmhash64",
  "siphash-2-4",
  "spookyhash",
  "highwayhash64",
  "fnv1a-64",
  "crc32",
] as const

type InputEncoding = (typeof inputEncodings)[number]
type OutputEncoding = (typeof outputEncodings)[number]
type KeyEncoding = (typeof keyEncodings)[number]
type HashAlgorithm = (typeof algorithmValues)[number]

const paramsSchema = z.object({
  input: z.string().default(""),
  inputEncoding: z.enum(inputEncodings).default("utf8"),
  outputEncoding: z.enum(outputEncodings).default("hex"),
  algorithm: z.enum(algorithmValues).default("xxhash64"),
  key: z.string().default(""),
  keyEncoding: z.enum(keyEncodings).default("hex"),
})

const algorithmLabels: Record<HashAlgorithm, string> = {
  "murmur3-32": "MurmurHash3 (32-bit)",
  xxhash64: "xxHash64",
  farmhash64: "CityHash/FarmHash (64-bit)",
  "siphash-2-4": "SipHash-2-4",
  spookyhash: "SpookyHash (128-bit)",
  highwayhash64: "HighwayHash (64-bit)",
  "fnv1a-64": "FNV-1a (64-bit)",
  crc32: "CRC32",
}

const keyRequirements: Partial<Record<HashAlgorithm, number>> = {
  "siphash-2-4": 16,
  highwayhash64: 32,
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

function encodeOutput(bytes: Uint8Array, encoding: OutputEncoding) {
  if (encoding === "hex") return encodeHex(bytes, { upperCase: false })
  if (encoding === "base64") return encodeBase64(bytes, { urlSafe: false, padding: true })
  return encodeBase64(bytes, { urlSafe: true, padding: false })
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

function fnv1a64(bytes: Uint8Array) {
  let hash = 0xcbf29ce484222325n
  const prime = 0x100000001b3n
  for (const byte of bytes) {
    hash ^= BigInt(byte)
    hash = (hash * prime) & 0xffffffffffffffffn
  }
  return bigIntToBytes(hash, 8)
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

async function computeHashBytes({
  algorithm,
  input,
  keyBytes,
}: {
  algorithm: HashAlgorithm
  input: Uint8Array
  keyBytes: Uint8Array | null
}) {
  switch (algorithm) {
    case "murmur3-32": {
      const hasher = new Murmur3_32()
      hasher.write(input)
      return hasher.sum()
    }
    case "xxhash64": {
      const hasher = new XxHash64()
      hasher.write(input)
      return hasher.sum()
    }
    case "farmhash64": {
      const farmhash = await getFarmhashModule()
      const value = farmhash.fingerprint64(input)
      return bigIntToBytes(value, 8)
    }
    case "siphash-2-4": {
      if (!keyBytes) throw new Error("SipHash requires a key.")
      const key = sipHashKeyFromBytes(keyBytes)
      const result = siphash.hash(key, input)
      const value = (BigInt(result.h >>> 0) << 32n) | BigInt(result.l >>> 0)
      return bigIntToBytes(value, 8)
    }
    case "spookyhash": {
      const hasher = new Spooky()
      hasher.write(input)
      return hasher.sum()
    }
    case "highwayhash64": {
      if (!keyBytes) throw new Error("HighwayHash requires a key.")
      const highway = await getHighwayHasher()
      const hash = highway.hasher.hash64(keyBytes, input)
      return hash.toBytes()
    }
    case "fnv1a-64": {
      return fnv1a64(input)
    }
    case "crc32": {
      const hasher = new Crc32()
      hasher.write(input)
      return hasher.sum()
    }
    default:
      return new Uint8Array()
  }
}

function ScrollableTabsList({ children }: { children: React.ReactNode }) {
  return (
    <div className="w-full min-w-0 overflow-x-auto">
      <TabsList className="inline-flex w-max justify-start">{children}</TabsList>
    </div>
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
  const paramsRef = React.useRef({
    inputEncoding: state.inputEncoding,
    outputEncoding: state.outputEncoding,
    algorithm: state.algorithm,
    key: state.key,
    keyEncoding: state.keyEncoding,
    fileName,
  })
  const hasInitializedParamsRef = React.useRef(false)
  const hasHandledUrlRef = React.useRef(false)
  const hashRunRef = React.useRef(0)
  const fileBytesRef = React.useRef<Uint8Array | null>(null)
  const [fileVersion, setFileVersion] = React.useState(0)

  const keyRequirement = keyRequirements[state.algorithm]

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
        {
          inputEncoding: state.inputEncoding,
          outputEncoding: state.outputEncoding,
          algorithm: state.algorithm,
          key: state.key,
          keyEncoding: state.keyEncoding,
          fileName,
        },
        "left",
        preview,
      )
    }, DEFAULT_URL_SYNC_DEBOUNCE_MS)

    return () => clearTimeout(timer)
  }, [
    state.input,
    state.inputEncoding,
    state.outputEncoding,
    state.algorithm,
    state.key,
    state.keyEncoding,
    fileName,
    fileVersion,
    upsertInputEntry,
  ])

  React.useEffect(() => {
    if (hasUrlParams && !hasHandledUrlRef.current) {
      hasHandledUrlRef.current = true
      const activeText = state.input
      if (activeText) {
        upsertInputEntry(
          { input: state.input },
          {
            inputEncoding: state.inputEncoding,
            outputEncoding: state.outputEncoding,
            algorithm: state.algorithm,
            key: state.key,
            keyEncoding: state.keyEncoding,
            fileName,
          },
          "left",
          activeText.slice(0, 100),
        )
      } else {
        upsertParams(
          {
            inputEncoding: state.inputEncoding,
            outputEncoding: state.outputEncoding,
            algorithm: state.algorithm,
            key: state.key,
            keyEncoding: state.keyEncoding,
            fileName,
          },
          "interpretation",
        )
      }
    }
  }, [
    hasUrlParams,
    state.input,
    state.inputEncoding,
    state.outputEncoding,
    state.algorithm,
    state.key,
    state.keyEncoding,
    fileName,
    upsertInputEntry,
    upsertParams,
  ])

  React.useEffect(() => {
    const nextParams = {
      inputEncoding: state.inputEncoding,
      outputEncoding: state.outputEncoding,
      algorithm: state.algorithm,
      key: state.key,
      keyEncoding: state.keyEncoding,
      fileName,
    }
    if (!hasInitializedParamsRef.current) {
      hasInitializedParamsRef.current = true
      paramsRef.current = nextParams
      return
    }
    if (
      paramsRef.current.inputEncoding === nextParams.inputEncoding &&
      paramsRef.current.outputEncoding === nextParams.outputEncoding &&
      paramsRef.current.algorithm === nextParams.algorithm &&
      paramsRef.current.key === nextParams.key &&
      paramsRef.current.keyEncoding === nextParams.keyEncoding &&
      paramsRef.current.fileName === nextParams.fileName
    ) {
      return
    }
    paramsRef.current = nextParams
    upsertParams(nextParams, "interpretation")
  }, [state.inputEncoding, state.outputEncoding, state.algorithm, state.key, state.keyEncoding, fileName, upsertParams])

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
            throw new Error(`${algorithmLabels[state.algorithm]} requires a ${keyRequirement}-byte key.`)
          }
          keyBytes = parseKeyBytes(state.key, state.keyEncoding)
          if (keyBytes.length !== keyRequirement) {
            throw new Error(`${algorithmLabels[state.algorithm]} requires a ${keyRequirement}-byte key.`)
          }
        }

        const digestBytes = await computeHashBytes({
          algorithm: state.algorithm,
          input: bytes,
          keyBytes,
        })
        const normalized = encodeOutput(digestBytes, state.outputEncoding)
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
    state.algorithm,
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
          <Tabs value={state.algorithm} onValueChange={(value) => setParam("algorithm", value as HashAlgorithm, true)}>
            <ScrollableTabsList>
              {algorithmValues.map((alg) => (
                <TabsTrigger key={alg} value={alg} className="text-xs">
                  {algorithmLabels[alg]}
                </TabsTrigger>
              ))}
            </ScrollableTabsList>
          </Tabs>
        </div>
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
                <ScrollableTabsList>
                  <TabsTrigger value="utf8" className="text-xs">
                    UTF-8
                  </TabsTrigger>
                  <TabsTrigger value="base64" className="text-xs">
                    Base64
                  </TabsTrigger>
                  <TabsTrigger value="hex" className="text-xs">
                    Hex
                  </TabsTrigger>
                </ScrollableTabsList>
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
                <ScrollableTabsList>
                  <TabsTrigger value="utf8" className="text-xs">
                    UTF-8
                  </TabsTrigger>
                  <TabsTrigger value="base64" className="text-xs">
                    Base64
                  </TabsTrigger>
                  <TabsTrigger value="hex" className="text-xs">
                    Hex
                  </TabsTrigger>
                </ScrollableTabsList>
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
                <ScrollableTabsList>
                  <TabsTrigger value="hex" className="text-xs">
                    Hex
                  </TabsTrigger>
                  <TabsTrigger value="base64" className="text-xs">
                    Base64
                  </TabsTrigger>
                  <TabsTrigger value="base64url" className="text-xs">
                    Base64url
                  </TabsTrigger>
                </ScrollableTabsList>
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
