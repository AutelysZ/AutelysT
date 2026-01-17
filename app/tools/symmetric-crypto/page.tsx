"use client"

import * as React from "react"
import { Suspense } from "react"
import { z } from "zod"
import { AlertCircle, Check, Copy, Download, RefreshCcw, Upload, X } from "lucide-react"
import CryptoJS from "crypto-js"
import { ToolPageWrapper, useToolHistoryContext } from "@/components/tool-ui/tool-page-wrapper"
import { DEFAULT_URL_SYNC_DEBOUNCE_MS, useUrlSyncedState } from "@/lib/url-state/use-url-synced-state"
import { Textarea } from "@/components/ui/textarea"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { decodeBase64, encodeBase64 } from "@/lib/encoding/base64"
import { decodeHex, encodeHex } from "@/lib/encoding/hex"
import type { HistoryEntry } from "@/lib/history/db"
import { cn } from "@/lib/utils"

const algorithmValues = ["aes", "chacha20", "salsa20", "twofish", "blowfish", "des", "3des"] as const
type AlgorithmValue = (typeof algorithmValues)[number]

const aesModes = ["GCM", "CBC", "CFB", "CTR", "OFB", "ECB"] as const
type AesMode = (typeof aesModes)[number]

const desModes = ["CBC", "ECB"] as const
type DesMode = (typeof desModes)[number]

const paddings = ["Pkcs7", "AnsiX923", "Iso10126", "Iso97971", "ZeroPadding", "NoPadding"] as const
type PaddingValue = (typeof paddings)[number]

const blowfishModes = ["ECB", "CBC"] as const
type BlowfishMode = (typeof blowfishModes)[number]

const blowfishPaddings = ["PKCS5", "ONE_AND_ZEROS", "LAST_BYTE", "NULL", "SPACES"] as const
type BlowfishPadding = (typeof blowfishPaddings)[number]

const twofishModes = ["ECB", "CBC"] as const
type TwofishMode = (typeof twofishModes)[number]

const twofishPaddings = paddings
type TwofishPadding = (typeof twofishPaddings)[number]

const kdfAlgorithms = ["PBKDF2", "HKDF"] as const
type KdfAlgorithm = (typeof kdfAlgorithms)[number]

const kdfHashes = ["SHA-256", "SHA-512"] as const
type KdfHash = (typeof kdfHashes)[number]

const inputEncodings = ["utf8", "base64", "hex", "binary"] as const
type InputEncoding = (typeof inputEncodings)[number]

const outputEncodings = ["base64", "base64url", "hex", "binary"] as const
type OutputEncoding = (typeof outputEncodings)[number]

const paramEncodings = ["utf8", "base64", "hex"] as const
type ParamEncoding = (typeof paramEncodings)[number]

const encodingLabels = {
  utf8: "UTF-8",
  base64: "Base64",
  base64url: "Base64url",
  hex: "Hex",
  binary: "Binary",
} as const

const paramsSchema = z.object({
  mode: z.enum(["encrypt", "decrypt"]).default("encrypt"),
  algorithm: z.enum(algorithmValues).default("aes"),
  input: z.string().default(""),
  inputEncoding: z.enum(inputEncodings).default("base64"),
  outputEncoding: z.enum(outputEncodings).default("base64"),
  key: z.string().default(""),
  keyEncoding: z.enum(paramEncodings).default("base64"),
  useKdf: z.boolean().default(false),
  kdfAlgorithm: z.enum(kdfAlgorithms).default("PBKDF2"),
  salt: z.string().default(""),
  saltEncoding: z.enum(paramEncodings).default("base64"),
  iterations: z.number().default(100000),
  kdfHash: z.enum(kdfHashes).default("SHA-256"),
  kdfInfo: z.string().default(""),
  kdfInfoEncoding: z.enum(paramEncodings).default("base64"),
  aesMode: z.enum(aesModes).default("GCM"),
  aesPadding: z.enum(paddings).default("Pkcs7"),
  aesKeySize: z.number().default(256),
  aesIv: z.string().default(""),
  aesIvEncoding: z.enum(paramEncodings).default("base64"),
  desMode: z.enum(desModes).default("CBC"),
  desPadding: z.enum(paddings).default("Pkcs7"),
  desIv: z.string().default(""),
  desIvEncoding: z.enum(paramEncodings).default("base64"),
  blowfishMode: z.enum(blowfishModes).default("CBC"),
  blowfishPadding: z.enum(blowfishPaddings).default("PKCS5"),
  blowfishIv: z.string().default(""),
  blowfishIvEncoding: z.enum(paramEncodings).default("base64"),
  twofishMode: z.enum(twofishModes).default("CBC"),
  twofishPadding: z.enum(twofishPaddings).default("Pkcs7"),
  twofishIv: z.string().default(""),
  twofishIvEncoding: z.enum(paramEncodings).default("base64"),
  chachaNonce: z.string().default(""),
  chachaNonceEncoding: z.enum(paramEncodings).default("base64"),
  chachaPoly1305: z.boolean().default(true),
  chachaCounter: z.number().default(0),
  salsaNonce: z.string().default(""),
  salsaNonceEncoding: z.enum(paramEncodings).default("base64"),
  salsaCounter: z.number().default(0),
})

const algorithmLabels: Record<AlgorithmValue, string> = {
  aes: "AES",
  chacha20: "ChaCha20",
  salsa20: "Salsa20",
  twofish: "Twofish",
  blowfish: "Blowfish",
  des: "DES",
  "3des": "3DES",
}

const paddingMap: Record<PaddingValue, typeof CryptoJS.pad.Pkcs7> = {
  Pkcs7: CryptoJS.pad.Pkcs7,
  AnsiX923: CryptoJS.pad.AnsiX923,
  Iso10126: CryptoJS.pad.Iso10126,
  Iso97971: CryptoJS.pad.Iso97971,
  ZeroPadding: CryptoJS.pad.ZeroPadding,
  NoPadding: CryptoJS.pad.NoPadding,
}

const aesModeMap: Record<Exclude<AesMode, "GCM">, typeof CryptoJS.mode.CBC> = {
  CBC: CryptoJS.mode.CBC,
  CFB: CryptoJS.mode.CFB,
  CTR: CryptoJS.mode.CTR,
  OFB: CryptoJS.mode.OFB,
  ECB: CryptoJS.mode.ECB,
}

const desModeMap: Record<DesMode, typeof CryptoJS.mode.CBC> = {
  CBC: CryptoJS.mode.CBC,
  ECB: CryptoJS.mode.ECB,
}

const textEncoder = new TextEncoder()
const textDecoder = new TextDecoder()

const AES_IV_DEFAULT_LENGTH = 16
const AES_GCM_IV_DEFAULT_LENGTH = 12
const DES_IV_DEFAULT_LENGTH = 8
const BLOWFISH_IV_DEFAULT_LENGTH = 8
const TWOFISH_IV_DEFAULT_LENGTH = 16
const CHACHA_NONCE_DEFAULT_LENGTH = 12
const SALSA_NONCE_DEFAULT_LENGTH = 8
const SALT_DEFAULT_LENGTH = 16

function bytesToWordArray(bytes: Uint8Array) {
  const words: number[] = []
  for (let i = 0; i < bytes.length; i += 4) {
    words.push(
      ((bytes[i] ?? 0) << 24) |
        ((bytes[i + 1] ?? 0) << 16) |
        ((bytes[i + 2] ?? 0) << 8) |
        (bytes[i + 3] ?? 0),
    )
  }
  return CryptoJS.lib.WordArray.create(words, bytes.length)
}

function wordArrayToBytes(wordArray: CryptoJS.lib.WordArray) {
  const { words, sigBytes } = wordArray
  const bytes = new Uint8Array(sigBytes)
  for (let i = 0; i < sigBytes; i++) {
    bytes[i] = (words[i >>> 2] >>> (24 - (i % 4) * 8)) & 0xff
  }
  return bytes
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

function encodeOutputBytes(bytes: Uint8Array, encoding: OutputEncoding) {
  if (encoding === "binary") {
    return { binary: bytes, text: "" }
  }
  if (encoding === "base64") {
    return { text: encodeBase64(bytes, { urlSafe: false, padding: true }), binary: null }
  }
  if (encoding === "hex") {
    return { text: encodeHex(bytes, { upperCase: false }), binary: null }
  }
  return { text: encodeBase64(bytes, { urlSafe: true, padding: false }), binary: null }
}

function decodeInputText(value: string, encoding: InputEncoding) {
  if (encoding === "binary") {
    throw new Error("Binary input requires a file upload.")
  }
  if (!value) return new Uint8Array()
  if (encoding === "utf8") {
    return textEncoder.encode(value)
  }
  if (encoding === "hex") {
    return decodeHex(value)
  }
  return decodeBase64(value)
}

function decodeParamValue(value: string, encoding: ParamEncoding) {
  if (!value) return new Uint8Array()
  if (encoding === "utf8") {
    return textEncoder.encode(value)
  }
  if (encoding === "hex") {
    return decodeHex(value)
  }
  return decodeBase64(value)
}

function encodeParamValue(bytes: Uint8Array, encoding: ParamEncoding) {
  if (encoding === "utf8") {
    return textDecoder.decode(bytes)
  }
  if (encoding === "hex") {
    return encodeHex(bytes, { upperCase: false })
  }
  return encodeBase64(bytes, { urlSafe: false, padding: true })
}

function xorBytes(left: Uint8Array, right: Uint8Array) {
  const length = Math.min(left.length, right.length)
  const result = new Uint8Array(length)
  for (let i = 0; i < length; i += 1) {
    result[i] = left[i] ^ right[i]
  }
  return result
}

function applyPadding(bytes: Uint8Array, padding: PaddingValue, blockSize: number) {
  if (padding === "NoPadding") {
    if (bytes.length % blockSize !== 0) {
      throw new Error(`NoPadding requires plaintext length to be a multiple of ${blockSize} bytes.`)
    }
    return bytes
  }
  const wordArray = bytesToWordArray(bytes)
  paddingMap[padding].pad(wordArray, blockSize / 4)
  return wordArrayToBytes(wordArray)
}

function removePadding(bytes: Uint8Array, padding: PaddingValue) {
  if (padding === "NoPadding") {
    return bytes
  }
  const wordArray = bytesToWordArray(bytes)
  paddingMap[padding].unpad(wordArray)
  return wordArrayToBytes(wordArray)
}

function runStreamCipher(
  factory: (...args: unknown[]) => unknown,
  key: Uint8Array,
  nonce: Uint8Array,
  counter: number,
  data: Uint8Array,
) {
  try {
    const candidate = factory(key, nonce, counter)
    if (candidate instanceof Uint8Array) return candidate
    if (typeof candidate === "function") return candidate(data)
    if (candidate && typeof (candidate as { encrypt?: (input: Uint8Array) => Uint8Array }).encrypt === "function") {
      return (candidate as { encrypt: (input: Uint8Array) => Uint8Array }).encrypt(data)
    }
  } catch {
    // Try alternate signatures.
  }
  const direct = factory(key, nonce, counter, data)
  if (direct instanceof Uint8Array) return direct
  if (direct && typeof (direct as { encrypt?: (input: Uint8Array) => Uint8Array }).encrypt === "function") {
    return (direct as { encrypt: (input: Uint8Array) => Uint8Array }).encrypt(data)
  }
  if (typeof direct === "function") return direct(data)
  throw new Error("Unsupported cipher implementation.")
}

async function deriveKeyBytes(options: {
  algorithm: KdfAlgorithm
  passphraseBytes: Uint8Array
  saltBytes: Uint8Array
  iterations: number
  hash: KdfHash
  lengthBytes: number
  infoBytes: Uint8Array
}) {
  if (!globalThis.crypto?.subtle) {
    throw new Error("Web Crypto is unavailable in this browser.")
  }
  const { algorithm, passphraseBytes, saltBytes, iterations, hash, lengthBytes, infoBytes } = options
  const baseKey = await crypto.subtle.importKey("raw", passphraseBytes, algorithm, false, ["deriveBits"])
  const bits = await crypto.subtle.deriveBits(
    algorithm === "PBKDF2"
      ? {
          name: "PBKDF2",
          salt: saltBytes,
          iterations,
          hash,
        }
      : {
          name: "HKDF",
          hash,
          salt: saltBytes,
          info: infoBytes,
        },
    baseKey,
    lengthBytes * 8,
  )
  return new Uint8Array(bits)
}

function getKeyLengthBytes(state: z.infer<typeof paramsSchema>) {
  if (state.algorithm === "aes") {
    return Math.floor(state.aesKeySize / 8)
  }
  if (state.algorithm === "des") {
    return 8
  }
  if (state.algorithm === "3des") {
    return 24
  }
  if (state.algorithm === "blowfish") {
    return 32
  }
  if (state.algorithm === "twofish") {
    return 32
  }
  return 32
}

export default function SymmetricCryptoPage() {
  return (
    <Suspense fallback={null}>
      <SymmetricCryptoContent />
    </Suspense>
  )
}

function SymmetricCryptoContent() {
  const { state, setParam, oversizeKeys, hasUrlParams, hydrationSource, resetToDefaults } = useUrlSyncedState(
    "symmetric-crypto",
    {
      schema: paramsSchema,
      defaults: paramsSchema.parse({}),
    },
  )
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
    [setParam, setFileName],
  )

  return (
    <ToolPageWrapper
      toolId="symmetric-crypto"
      title="Symmetric Crypto"
      description="Encrypt or decrypt data using AES, ChaCha20, Salsa20, Twofish, Blowfish, DES, or 3DES."
      onLoadHistory={handleLoadHistory}
    >
      <SymmetricCryptoInner
        state={state}
        setParam={setParam}
        oversizeKeys={oversizeKeys}
        hasUrlParams={hasUrlParams}
        hydrationSource={hydrationSource}
        resetToDefaults={resetToDefaults}
        fileName={fileName}
        setFileName={setFileName}
      />
    </ToolPageWrapper>
  )
}

function ScrollableTabsList({
  children,
  className,
}: {
  children: React.ReactNode
  className?: string
}) {
  return (
    <div className="min-w-0 w-full overflow-x-auto">
      <TabsList className={cn("inline-flex w-max justify-start", className)}>{children}</TabsList>
    </div>
  )
}

function SymmetricCryptoInner({
  state,
  setParam,
  oversizeKeys,
  hasUrlParams,
  hydrationSource,
  resetToDefaults,
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
  resetToDefaults: () => void
  fileName: string | null
  setFileName: React.Dispatch<React.SetStateAction<string | null>>
}) {
  const { upsertInputEntry, upsertParams } = useToolHistoryContext()
  const [output, setOutput] = React.useState("")
  const [error, setError] = React.useState<string | null>(null)
  const [isWorking, setIsWorking] = React.useState(false)
  const [binaryMeta, setBinaryMeta] = React.useState<{ name: string; size: number } | null>(null)
  const [copied, setCopied] = React.useState(false)
  const fileInputRef = React.useRef<HTMLInputElement>(null)
  const [fileVersion, setFileVersion] = React.useState(0)
  const lastInputRef = React.useRef<string>("")
  const hasHydratedInputRef = React.useRef(false)
  const fileBytesRef = React.useRef<Uint8Array | null>(null)
  const outputBytesRef = React.useRef<Uint8Array | null>(null)
  const paramsRef = React.useRef({
    mode: state.mode,
    algorithm: state.algorithm,
    key: state.key,
    keyEncoding: state.keyEncoding,
    useKdf: state.useKdf,
    kdfAlgorithm: state.kdfAlgorithm,
    inputEncoding: state.inputEncoding,
    outputEncoding: state.outputEncoding,
    fileName,
    salt: state.salt,
    saltEncoding: state.saltEncoding,
    iterations: state.iterations,
    kdfHash: state.kdfHash,
    kdfInfo: state.kdfInfo,
    kdfInfoEncoding: state.kdfInfoEncoding,
    aesMode: state.aesMode,
    aesPadding: state.aesPadding,
    aesKeySize: state.aesKeySize,
    aesIv: state.aesIv,
    aesIvEncoding: state.aesIvEncoding,
    desMode: state.desMode,
    desPadding: state.desPadding,
    desIv: state.desIv,
    desIvEncoding: state.desIvEncoding,
    blowfishMode: state.blowfishMode,
    blowfishPadding: state.blowfishPadding,
    blowfishIv: state.blowfishIv,
    blowfishIvEncoding: state.blowfishIvEncoding,
    twofishMode: state.twofishMode,
    twofishPadding: state.twofishPadding,
    twofishIv: state.twofishIv,
    twofishIvEncoding: state.twofishIvEncoding,
    chachaNonce: state.chachaNonce,
    chachaNonceEncoding: state.chachaNonceEncoding,
    chachaPoly1305: state.chachaPoly1305,
    chachaCounter: state.chachaCounter,
    salsaNonce: state.salsaNonce,
    salsaNonceEncoding: state.salsaNonceEncoding,
    salsaCounter: state.salsaCounter,
  })
  const hasInitializedParamsRef = React.useRef(false)
  const hasHandledUrlRef = React.useRef(false)
  const runRef = React.useRef(0)

  React.useEffect(() => {
    if (fileName) {
      if (state.mode === "encrypt") {
        if (state.inputEncoding !== "binary") {
          setParam("inputEncoding", "binary", true)
        }
      } else {
        const allowed = ["binary", "base64", "hex"]
        if (!allowed.includes(state.inputEncoding)) {
          setParam("inputEncoding", "binary", true)
        }
      }
      return
    }
    const allowed = ["utf8", "base64", "hex"]
    if (!allowed.includes(state.inputEncoding)) {
      setParam("inputEncoding", "base64", true)
    }
  }, [fileName, state.mode, state.inputEncoding, setParam])

  React.useEffect(() => {
    if (!fileName && fileBytesRef.current) {
      fileBytesRef.current = null
      if (fileVersion) setFileVersion(0)
    }
  }, [fileName, fileVersion])

  React.useEffect(() => {
    if (hasHydratedInputRef.current) return
    if (hydrationSource === "default") return
    lastInputRef.current = fileName ? `file:${fileName}:${fileVersion}` : `text:${state.input}`
    hasHydratedInputRef.current = true
  }, [hydrationSource, state.input, fileName, fileVersion])

  React.useEffect(() => {
    const hasFile = Boolean(fileName && fileVersion)
    const signature = hasFile ? `file:${fileName}:${fileVersion}` : `text:${state.input}`
    if ((!state.input && !hasFile) || signature === lastInputRef.current) return
    const timer = setTimeout(() => {
      lastInputRef.current = signature
      const preview = fileName || state.input.slice(0, 100)
      upsertInputEntry({ input: fileName ? "" : state.input }, { ...paramsRef.current }, "left", preview)
    }, DEFAULT_URL_SYNC_DEBOUNCE_MS)
    return () => clearTimeout(timer)
  }, [state.input, fileName, fileVersion, upsertInputEntry])

  React.useEffect(() => {
    if (hasUrlParams && !hasHandledUrlRef.current) {
      hasHandledUrlRef.current = true
      if (state.input) {
        upsertInputEntry(
          { input: state.input },
          { ...paramsRef.current },
          "left",
          state.input.slice(0, 100),
        )
      } else {
        upsertParams({ ...paramsRef.current }, "interpretation")
      }
    }
  }, [hasUrlParams, state.input, upsertInputEntry, upsertParams])

  React.useEffect(() => {
    const nextParams = {
      mode: state.mode,
      algorithm: state.algorithm,
      key: state.key,
      keyEncoding: state.keyEncoding,
      useKdf: state.useKdf,
      kdfAlgorithm: state.kdfAlgorithm,
      inputEncoding: state.inputEncoding,
      outputEncoding: state.outputEncoding,
      fileName,
      salt: state.salt,
      saltEncoding: state.saltEncoding,
      iterations: state.iterations,
      kdfHash: state.kdfHash,
      kdfInfo: state.kdfInfo,
      kdfInfoEncoding: state.kdfInfoEncoding,
      aesMode: state.aesMode,
      aesPadding: state.aesPadding,
      aesKeySize: state.aesKeySize,
      aesIv: state.aesIv,
      aesIvEncoding: state.aesIvEncoding,
      desMode: state.desMode,
      desPadding: state.desPadding,
      desIv: state.desIv,
      desIvEncoding: state.desIvEncoding,
      blowfishMode: state.blowfishMode,
      blowfishPadding: state.blowfishPadding,
      blowfishIv: state.blowfishIv,
      blowfishIvEncoding: state.blowfishIvEncoding,
      twofishMode: state.twofishMode,
      twofishPadding: state.twofishPadding,
      twofishIv: state.twofishIv,
      twofishIvEncoding: state.twofishIvEncoding,
      chachaNonce: state.chachaNonce,
      chachaNonceEncoding: state.chachaNonceEncoding,
      chachaPoly1305: state.chachaPoly1305,
      chachaCounter: state.chachaCounter,
      salsaNonce: state.salsaNonce,
      salsaNonceEncoding: state.salsaNonceEncoding,
      salsaCounter: state.salsaCounter,
    }
    if (!hasInitializedParamsRef.current) {
      hasInitializedParamsRef.current = true
      paramsRef.current = nextParams
      return
    }
    const prev = paramsRef.current
    const unchanged = Object.entries(nextParams).every(([key, value]) => (prev as Record<string, unknown>)[key] === value)
    if (unchanged) return
    paramsRef.current = nextParams
    upsertParams(nextParams, "interpretation")
  }, [
    state.mode,
    state.algorithm,
    state.key,
    state.keyEncoding,
    state.useKdf,
    state.kdfAlgorithm,
    state.inputEncoding,
    state.outputEncoding,
    fileName,
    state.salt,
    state.saltEncoding,
    state.iterations,
    state.kdfHash,
    state.kdfInfo,
    state.kdfInfoEncoding,
    state.aesMode,
    state.aesPadding,
    state.aesKeySize,
    state.aesIv,
    state.aesIvEncoding,
    state.desMode,
    state.desPadding,
    state.desIv,
    state.desIvEncoding,
    state.blowfishMode,
    state.blowfishPadding,
    state.blowfishIv,
    state.blowfishIvEncoding,
    state.twofishMode,
    state.twofishPadding,
    state.twofishIv,
    state.twofishIvEncoding,
    state.chachaNonce,
    state.chachaNonceEncoding,
    state.chachaPoly1305,
    state.chachaCounter,
    state.salsaNonce,
    state.salsaNonceEncoding,
    state.salsaCounter,
    upsertParams,
  ])

  React.useEffect(() => {
    const hasFile = Boolean(fileName && fileBytesRef.current && fileVersion)
    const hasInputText = Boolean(state.input)
    if (!hasInputText && !hasFile) {
      setOutput("")
      setError(null)
      setIsWorking(false)
      setBinaryMeta(null)
      outputBytesRef.current = null
      return
    }
    const runId = ++runRef.current
    setIsWorking(true)

    void (async () => {
      try {
        let inputBytes: Uint8Array
        if (hasFile) {
          const bytes = fileBytesRef.current!
          if (state.mode === "encrypt") {
            inputBytes = bytes
          } else if (state.inputEncoding === "binary") {
            inputBytes = bytes
          } else {
            inputBytes = decodeInputText(textDecoder.decode(bytes), state.inputEncoding)
          }
        } else {
          if (state.inputEncoding === "binary") {
            throw new Error("Binary input requires a file upload.")
          }
          inputBytes = decodeInputText(state.input, state.inputEncoding)
        }

        if (!state.key) {
          throw new Error("Key material is required.")
        }

        const keyLength = getKeyLengthBytes(state)
        let derivedKey: Uint8Array
        if (state.useKdf) {
          const keyBytes = decodeParamValue(state.key, state.keyEncoding)
          const saltBytes = decodeParamValue(state.salt, state.saltEncoding)
          const infoBytes = decodeParamValue(state.kdfInfo, state.kdfInfoEncoding)
          derivedKey = await deriveKeyBytes({
            algorithm: state.kdfAlgorithm,
            passphraseBytes: keyBytes,
            saltBytes,
            iterations: Math.max(1, state.iterations),
            hash: state.kdfHash,
            lengthBytes: keyLength,
            infoBytes,
          })
        } else {
          const rawKey = decodeParamValue(state.key, state.keyEncoding)
          if (state.algorithm === "blowfish") {
            if (rawKey.length < 4 || rawKey.length > 56) {
              throw new Error("Blowfish keys must be between 4 and 56 bytes.")
            }
          } else if (state.algorithm === "twofish") {
            if (![8, 16, 24, 32].includes(rawKey.length)) {
              throw new Error("Twofish keys must be 8, 16, 24, or 32 bytes.")
            }
          } else if (rawKey.length !== keyLength) {
            throw new Error(`Key must be ${keyLength} bytes for the selected algorithm.`)
          }
          derivedKey = rawKey
        }

        let resultBytes: Uint8Array
        if (state.algorithm === "aes") {
          const ivBytes = state.aesMode === "ECB" ? new Uint8Array() : decodeParamValue(state.aesIv, state.aesIvEncoding)
          if (state.aesMode !== "ECB" && ivBytes.length === 0) {
            throw new Error("IV is required for the selected AES mode.")
          }

          if (state.aesMode === "GCM") {
            if (!globalThis.crypto?.subtle) {
              throw new Error("Web Crypto is unavailable in this browser.")
            }
            const aesKey = await crypto.subtle.importKey(
              "raw",
              derivedKey,
              { name: "AES-GCM", length: keyLength * 8 },
              false,
              [state.mode === "encrypt" ? "encrypt" : "decrypt"],
            )
            const algo = { name: "AES-GCM", iv: ivBytes, tagLength: 128 }
            const result = state.mode === "encrypt"
              ? await crypto.subtle.encrypt(algo, aesKey, inputBytes)
              : await crypto.subtle.decrypt(algo, aesKey, inputBytes)
            resultBytes = new Uint8Array(result)
          } else {
            if (state.aesMode !== "ECB" && ivBytes.length !== AES_IV_DEFAULT_LENGTH) {
              throw new Error("IV must be 16 bytes for the selected AES mode.")
            }
            const keyWordArray = bytesToWordArray(derivedKey)
            const ivWordArray = state.aesMode === "ECB" ? undefined : bytesToWordArray(ivBytes)
            const mode = aesModeMap[state.aesMode]
            const padding = paddingMap[state.aesPadding]
            if (state.mode === "encrypt") {
              if (padding === CryptoJS.pad.NoPadding && inputBytes.length % 16 !== 0) {
                throw new Error("NoPadding requires plaintext length to be a multiple of 16 bytes.")
              }
              const encrypted = CryptoJS.AES.encrypt(bytesToWordArray(inputBytes), keyWordArray, {
                iv: ivWordArray,
                mode,
                padding,
              })
              resultBytes = wordArrayToBytes(encrypted.ciphertext)
            } else {
              const cipherParams = CryptoJS.lib.CipherParams.create({ ciphertext: bytesToWordArray(inputBytes) })
              const decrypted = CryptoJS.AES.decrypt(cipherParams, keyWordArray, {
                iv: ivWordArray,
                mode,
                padding,
              })
              resultBytes = wordArrayToBytes(decrypted)
            }
          }
        } else if (state.algorithm === "des" || state.algorithm === "3des") {
          const ivBytes = state.desMode === "ECB" ? new Uint8Array() : decodeParamValue(state.desIv, state.desIvEncoding)
          if (state.desMode !== "ECB" && ivBytes.length === 0) {
            throw new Error("IV is required for the selected DES mode.")
          }
          if (state.desMode !== "ECB" && ivBytes.length !== DES_IV_DEFAULT_LENGTH) {
            throw new Error("IV must be 8 bytes for the selected DES mode.")
          }
          const keyWordArray = bytesToWordArray(derivedKey)
          const ivWordArray = state.desMode === "ECB" ? undefined : bytesToWordArray(ivBytes)
          const mode = desModeMap[state.desMode]
          const padding = paddingMap[state.desPadding]
          const cipher = state.algorithm === "3des" ? CryptoJS.TripleDES : CryptoJS.DES
          if (state.mode === "encrypt") {
            if (padding === CryptoJS.pad.NoPadding && inputBytes.length % 8 !== 0) {
              throw new Error("NoPadding requires plaintext length to be a multiple of 8 bytes.")
            }
            const encrypted = cipher.encrypt(bytesToWordArray(inputBytes), keyWordArray, {
              iv: ivWordArray,
              mode,
              padding,
            })
            resultBytes = wordArrayToBytes(encrypted.ciphertext)
          } else {
            const cipherParams = CryptoJS.lib.CipherParams.create({ ciphertext: bytesToWordArray(inputBytes) })
            const decrypted = cipher.decrypt(cipherParams, keyWordArray, {
              iv: ivWordArray,
              mode,
              padding,
            })
            resultBytes = wordArrayToBytes(decrypted)
          }
        } else if (state.algorithm === "blowfish") {
          const { Blowfish } = await import("egoroof-blowfish")
          const mode = Blowfish.MODE[state.blowfishMode]
          const padding = Blowfish.PADDING[state.blowfishPadding]
          const bf = new Blowfish(derivedKey, mode, padding)
          if (state.blowfishMode === "CBC") {
            const ivBytes = decodeParamValue(state.blowfishIv, state.blowfishIvEncoding)
            if (!ivBytes.length) {
              throw new Error("IV is required for Blowfish CBC mode.")
            }
            if (ivBytes.length !== BLOWFISH_IV_DEFAULT_LENGTH) {
              throw new Error("IV must be 8 bytes for Blowfish CBC.")
            }
            bf.setIv(ivBytes)
          }
          resultBytes =
            state.mode === "encrypt"
              ? bf.encode(inputBytes)
              : bf.decode(inputBytes, Blowfish.TYPE.UINT8_ARRAY)
        } else if (state.algorithm === "twofish") {
          const { makeSession, encrypt, decrypt } = await import("twofish-ts")
          const blockSize = TWOFISH_IV_DEFAULT_LENGTH
          let ivBytes = new Uint8Array()
          if (state.twofishMode === "CBC") {
            ivBytes = decodeParamValue(state.twofishIv, state.twofishIvEncoding)
            if (!ivBytes.length) {
              throw new Error("IV is required for Twofish CBC mode.")
            }
            if (ivBytes.length !== blockSize) {
              throw new Error("IV must be 16 bytes for Twofish CBC.")
            }
          }
          const session = makeSession(derivedKey)
          if (state.mode === "encrypt") {
            const padded = applyPadding(inputBytes, state.twofishPadding, blockSize)
            const outputBuffer = new Uint8Array(padded.length)
            let prev = ivBytes
            for (let offset = 0; offset < padded.length; offset += blockSize) {
              const block = padded.subarray(offset, offset + blockSize)
              const toEncrypt = state.twofishMode === "CBC" ? xorBytes(block, prev) : block
              const outBlock = new Uint8Array(blockSize)
              encrypt(toEncrypt, 0, outBlock, 0, session)
              outputBuffer.set(outBlock, offset)
              if (state.twofishMode === "CBC") {
                prev = outBlock
              }
            }
            resultBytes = outputBuffer
          } else {
            if (inputBytes.length % blockSize !== 0) {
              throw new Error("Ciphertext length must be a multiple of 16 bytes for Twofish.")
            }
            const outputBuffer = new Uint8Array(inputBytes.length)
            let prev = ivBytes
            for (let offset = 0; offset < inputBytes.length; offset += blockSize) {
              const block = inputBytes.subarray(offset, offset + blockSize)
              const outBlock = new Uint8Array(blockSize)
              decrypt(block, 0, outBlock, 0, session)
              const plainBlock = state.twofishMode === "CBC" ? xorBytes(outBlock, prev) : outBlock
              outputBuffer.set(plainBlock, offset)
              if (state.twofishMode === "CBC") {
                prev = block
              }
            }
            resultBytes = removePadding(outputBuffer, state.twofishPadding)
          }
        } else if (state.algorithm === "chacha20") {
          const nonceBytes = decodeParamValue(state.chachaNonce, state.chachaNonceEncoding)
          if (!nonceBytes.length) {
            throw new Error("Nonce is required for ChaCha20.")
          }
          if (nonceBytes.length !== CHACHA_NONCE_DEFAULT_LENGTH) {
            throw new Error("Nonce must be 12 bytes for ChaCha20.")
          }
          if (state.chachaPoly1305) {
            const { chacha20poly1305 } = await import("@noble/ciphers/chacha")
            const aead = chacha20poly1305(derivedKey, nonceBytes)
            resultBytes = state.mode === "encrypt" ? aead.encrypt(inputBytes) : aead.decrypt(inputBytes)
          } else {
            const { chacha20 } = await import("@noble/ciphers/chacha")
            resultBytes = chacha20(derivedKey, nonceBytes, inputBytes, undefined, Math.max(0, state.chachaCounter))
          }
        } else {
          const { salsa20 } = await import("@noble/ciphers/salsa")
          const nonceBytes = decodeParamValue(state.salsaNonce, state.salsaNonceEncoding)
          if (!nonceBytes.length) {
            throw new Error("Nonce is required for Salsa20.")
          }
          if (nonceBytes.length !== SALSA_NONCE_DEFAULT_LENGTH) {
            throw new Error("Nonce must be 8 bytes for Salsa20.")
          }
          resultBytes = salsa20(derivedKey, nonceBytes, inputBytes, undefined, Math.max(0, state.salsaCounter))
        }

        if (runRef.current !== runId) return
        const { text, binary } = encodeOutputBytes(resultBytes, state.outputEncoding)
        outputBytesRef.current = binary
        if (state.outputEncoding === "binary") {
          const outputName = fileName
            ? state.mode === "encrypt"
              ? `${fileName}.enc`
              : `${fileName}.dec`
            : state.mode === "encrypt"
              ? "encrypted.bin"
              : "decrypted.bin"
          setBinaryMeta(binary ? { name: outputName, size: binary.length } : null)
          setOutput("")
        } else {
          setBinaryMeta(null)
          setOutput(text)
        }
        setError(null)
      } catch (err) {
        if (runRef.current !== runId) return
        setOutput("")
        setBinaryMeta(null)
        outputBytesRef.current = null
        setError(err instanceof Error ? err.message : "Failed to process input.")
      } finally {
        if (runRef.current === runId) setIsWorking(false)
      }
    })()
  }, [
    state.mode,
    state.algorithm,
    state.input,
    state.inputEncoding,
    state.outputEncoding,
    state.key,
    state.keyEncoding,
    state.useKdf,
    state.kdfAlgorithm,
    state.salt,
    state.saltEncoding,
    state.iterations,
    state.kdfHash,
    state.kdfInfo,
    state.kdfInfoEncoding,
    state.aesMode,
    state.aesPadding,
    state.aesKeySize,
    state.aesIv,
    state.aesIvEncoding,
    state.desMode,
    state.desPadding,
    state.desIv,
    state.desIvEncoding,
    state.blowfishMode,
    state.blowfishPadding,
    state.blowfishIv,
    state.blowfishIvEncoding,
    state.twofishMode,
    state.twofishPadding,
    state.twofishIv,
    state.twofishIvEncoding,
    state.chachaNonce,
    state.chachaNonceEncoding,
    state.chachaPoly1305,
    state.chachaCounter,
    state.salsaNonce,
    state.salsaNonceEncoding,
    state.salsaCounter,
    fileName,
    fileVersion,
  ])

  const isDeprecated =
    state.algorithm === "salsa20" ||
    state.algorithm === "twofish" ||
    state.algorithm === "blowfish" ||
    state.algorithm === "des" ||
    state.algorithm === "3des"

  const handleGenerate = (
    field: "key" | "salt" | "aesIv" | "desIv" | "blowfishIv" | "twofishIv" | "chachaNonce" | "salsaNonce",
  ) => {
    try {
      let length = SALT_DEFAULT_LENGTH
      let encoding: ParamEncoding = "base64"
      if (field === "aesIv") {
        length = state.aesMode === "GCM" ? AES_GCM_IV_DEFAULT_LENGTH : AES_IV_DEFAULT_LENGTH
        encoding = state.aesIvEncoding
      }
      if (field === "desIv") {
        length = DES_IV_DEFAULT_LENGTH
        encoding = state.desIvEncoding
      }
      if (field === "blowfishIv") {
        length = BLOWFISH_IV_DEFAULT_LENGTH
        encoding = state.blowfishIvEncoding
      }
      if (field === "twofishIv") {
        length = TWOFISH_IV_DEFAULT_LENGTH
        encoding = state.twofishIvEncoding
      }
      if (field === "chachaNonce") {
        length = CHACHA_NONCE_DEFAULT_LENGTH
        encoding = state.chachaNonceEncoding
      }
      if (field === "salsaNonce") {
        length = SALSA_NONCE_DEFAULT_LENGTH
        encoding = state.salsaNonceEncoding
      }
      if (field === "salt") {
        length = SALT_DEFAULT_LENGTH
        encoding = state.saltEncoding
      }
      if (field === "key") {
        length = getKeyLengthBytes(state)
        encoding = state.keyEncoding
      }

      const value =
        encoding === "utf8"
          ? randomAsciiString(length)
          : encodeParamValue(randomBytes(length), encoding)
      setParam(field, value)
      setError(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to generate random bytes.")
    }
  }

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
        setParam("inputEncoding", "binary", true)
        setFileName(file.name)
        setFileVersion((prev) => prev + 1)
        setError(null)
      }
      reader.readAsArrayBuffer(file)
    },
    [setParam, setFileName],
  )

  const handleClearFile = React.useCallback(() => {
    setFileName(null)
    fileBytesRef.current = null
    setFileVersion(0)
  }, [setFileName])

  const handleClearAll = React.useCallback(() => {
    runRef.current += 1
    resetToDefaults()
    setFileName(null)
    fileBytesRef.current = null
    outputBytesRef.current = null
    if (fileInputRef.current) fileInputRef.current.value = ""
    setFileVersion(0)
    setOutput("")
    setError(null)
    setIsWorking(false)
    setBinaryMeta(null)
    setCopied(false)
  }, [resetToDefaults, setFileName])

  const handleInputChange = (value: string) => {
    setParam("input", value)
    if (fileName || fileBytesRef.current) {
      handleClearFile()
    }
  }

  const handleDownloadOutput = React.useCallback(() => {
    const bytes = outputBytesRef.current
    if (!bytes) return
    const blob = new Blob([bytes], { type: "application/octet-stream" })
    const url = URL.createObjectURL(blob)
    const link = document.createElement("a")
    link.href = url
    link.download = binaryMeta?.name ?? "output.bin"
    link.click()
    setTimeout(() => URL.revokeObjectURL(url), 0)
  }, [binaryMeta])

  const handleCopyResult = async () => {
    if (!output) return
    await navigator.clipboard.writeText(output)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const handleDownloadTextResult = () => {
    if (!output) return
    const blob = new Blob([output], { type: "text/plain" })
    const url = URL.createObjectURL(blob)
    const link = document.createElement("a")
    link.href = url
    link.download = "result.txt"
    link.click()
    setTimeout(() => URL.revokeObjectURL(url), 0)
  }

  const inputWarning = oversizeKeys.includes("input")
    ? "Input exceeds 2 KB and is not synced to the URL."
    : null
  const keyWarning = oversizeKeys.includes("key")
    ? "Key exceeds 2 KB and is not synced to the URL."
    : null
  const saltWarning = oversizeKeys.includes("salt")
    ? "Salt exceeds 2 KB and is not synced to the URL."
    : null
  const kdfInfoWarning = oversizeKeys.includes("kdfInfo")
    ? "Info exceeds 2 KB and is not synced to the URL."
    : null
  const aesIvWarning = oversizeKeys.includes("aesIv")
    ? "IV exceeds 2 KB and is not synced to the URL."
    : null
  const desIvWarning = oversizeKeys.includes("desIv")
    ? "IV exceeds 2 KB and is not synced to the URL."
    : null
  const blowfishIvWarning = oversizeKeys.includes("blowfishIv")
    ? "IV exceeds 2 KB and is not synced to the URL."
    : null
  const twofishIvWarning = oversizeKeys.includes("twofishIv")
    ? "IV exceeds 2 KB and is not synced to the URL."
    : null
  const chachaNonceWarning = oversizeKeys.includes("chachaNonce")
    ? "Nonce exceeds 2 KB and is not synced to the URL."
    : null
  const salsaNonceWarning = oversizeKeys.includes("salsaNonce")
    ? "Nonce exceeds 2 KB and is not synced to the URL."
    : null
  const hasFileInput = Boolean(fileName)
  const showInputEncodingSelect = !hasFileInput || state.mode === "decrypt"
  const inputEncodingOptions = showInputEncodingSelect
    ? hasFileInput
      ? ([
          { value: "binary", label: encodingLabels.binary },
          { value: "base64", label: encodingLabels.base64 },
          { value: "hex", label: encodingLabels.hex },
        ] as { value: InputEncoding; label: string }[])
      : ([
          { value: "utf8", label: encodingLabels.utf8 },
          { value: "base64", label: encodingLabels.base64 },
          { value: "hex", label: encodingLabels.hex },
        ] as { value: InputEncoding; label: string }[])
    : []

  return (
    <div className="flex h-full flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Tabs value={state.mode} onValueChange={(value) => setParam("mode", value as "encrypt" | "decrypt", true)}>
          <TabsList>
            <TabsTrigger value="encrypt" className="px-5 text-base">
              Encrypt
            </TabsTrigger>
            <TabsTrigger value="decrypt" className="px-5 text-base">
              Decrypt
            </TabsTrigger>
          </TabsList>
        </Tabs>
        <Button variant="ghost" size="sm" onClick={handleClearAll} className="h-8 px-3 text-sm">
          Clear
        </Button>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="flex flex-col gap-4 overflow-x-hidden">
          <div className="flex flex-wrap items-center gap-4">
            <div className="flex min-w-0 items-center gap-3">
              <Label className="w-20 text-sm sm:w-28">Algorithm</Label>
              <Tabs
                value={state.algorithm}
                onValueChange={(value) => setParam("algorithm", value as AlgorithmValue, true)}
                className="min-w-0 flex-1"
              >
                <ScrollableTabsList>
                  {algorithmValues.map((value) => (
                    <TabsTrigger key={value} value={value} className="whitespace-nowrap text-xs flex-none">
                      {algorithmLabels[value]}
                    </TabsTrigger>
                  ))}
                </ScrollableTabsList>
              </Tabs>
            </div>
          </div>

          {isDeprecated && (
            <Alert variant="destructive" className="py-2">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription className="text-xs">
                {state.algorithm === "salsa20"
                  ? "Salsa20"
                  : state.algorithm === "twofish"
                    ? "Twofish"
                    : state.algorithm === "blowfish"
                      ? "Blowfish"
                      : state.algorithm === "3des"
                        ? "3DES"
                        : "DES"}{" "}
                is deprecated. Prefer AES or ChaCha20 for new work.
              </AlertDescription>
            </Alert>
          )}

          <div className="space-y-3">
            {state.algorithm === "aes" && (
              <>
                <div className="flex min-w-0 items-center gap-3">
                  <Label className="w-20 text-sm sm:w-28">AES Mode</Label>
                  <Tabs
                    value={state.aesMode}
                    onValueChange={(value) => setParam("aesMode", value as AesMode, true)}
                    className="min-w-0 flex-1"
                  >
                    <ScrollableTabsList>
                      {aesModes.map((value) => (
                        <TabsTrigger key={value} value={value} className="whitespace-nowrap text-xs flex-none">
                          {value}
                        </TabsTrigger>
                      ))}
                    </ScrollableTabsList>
                  </Tabs>
                </div>
                <div className="flex min-w-0 items-center gap-3">
                  <Label className="w-20 text-sm sm:w-28">Key Size</Label>
                  <Tabs
                    value={String(state.aesKeySize)}
                    onValueChange={(value) => setParam("aesKeySize", Number(value), true)}
                    className="min-w-0 flex-1"
                  >
                    <ScrollableTabsList>
                      <TabsTrigger value="128" className="whitespace-nowrap text-xs flex-none">
                        128-bit
                      </TabsTrigger>
                      <TabsTrigger value="192" className="whitespace-nowrap text-xs flex-none">
                        192-bit
                      </TabsTrigger>
                      <TabsTrigger value="256" className="whitespace-nowrap text-xs flex-none">
                        256-bit
                      </TabsTrigger>
                    </ScrollableTabsList>
                  </Tabs>
                </div>
              </>
            )}

            {(state.algorithm === "des" || state.algorithm === "3des") && (
              <>
                <div className="flex min-w-0 items-center gap-3">
                  <Label className="w-20 text-sm sm:w-28">{state.algorithm === "3des" ? "3DES Mode" : "DES Mode"}</Label>
                  <Tabs
                    value={state.desMode}
                    onValueChange={(value) => setParam("desMode", value as DesMode, true)}
                    className="min-w-0 flex-1"
                  >
                    <ScrollableTabsList>
                      {desModes.map((value) => (
                        <TabsTrigger key={value} value={value} className="whitespace-nowrap text-xs flex-none">
                          {value}
                        </TabsTrigger>
                      ))}
                    </ScrollableTabsList>
                  </Tabs>
                </div>
              </>
            )}

            {state.algorithm === "blowfish" && (
              <div className="flex min-w-0 items-center gap-3">
                <Label className="w-20 text-sm sm:w-28">Blowfish Mode</Label>
                <Tabs
                  value={state.blowfishMode}
                  onValueChange={(value) => setParam("blowfishMode", value as BlowfishMode, true)}
                  className="min-w-0 flex-1"
                >
                  <ScrollableTabsList>
                    {blowfishModes.map((value) => (
                      <TabsTrigger key={value} value={value} className="whitespace-nowrap text-xs flex-none">
                        {value}
                      </TabsTrigger>
                    ))}
                  </ScrollableTabsList>
                </Tabs>
              </div>
            )}

            {state.algorithm === "twofish" && (
              <div className="flex min-w-0 items-center gap-3">
                <Label className="w-20 text-sm sm:w-28">Twofish Mode</Label>
                <Tabs
                  value={state.twofishMode}
                  onValueChange={(value) => setParam("twofishMode", value as TwofishMode, true)}
                  className="min-w-0 flex-1"
                >
                  <ScrollableTabsList>
                    {twofishModes.map((value) => (
                      <TabsTrigger key={value} value={value} className="whitespace-nowrap text-xs flex-none">
                        {value}
                      </TabsTrigger>
                    ))}
                  </ScrollableTabsList>
                </Tabs>
              </div>
            )}

            {state.algorithm === "chacha20" && (
              <>
                <div className="flex min-w-0 items-center gap-3">
                  <Label className="w-20 text-sm sm:w-28">Poly1305</Label>
                  <div className="flex items-center gap-2">
                    <Checkbox
                      id="chachaPoly1305"
                      checked={state.chachaPoly1305}
                      onCheckedChange={(value) => setParam("chachaPoly1305", Boolean(value), true)}
                    />
                    <Label htmlFor="chachaPoly1305" className="text-sm">
                      Enabled
                    </Label>
                  </div>
                </div>
              </>
            )}
          </div>

          <hr className="border-border/60" />
          <div className="space-y-2">
            <div className="flex min-w-0 items-center gap-3">
              <Label className="w-20 text-sm sm:w-28">Key</Label>
              <Input
                value={state.key}
                onChange={(e) => setParam("key", e.target.value)}
                placeholder="Key material"
                className="min-w-0 flex-1"
              />
            </div>
            <div className="flex items-center gap-2">
              <div className="w-20 sm:w-28" aria-hidden="true" />
              <div className="flex min-w-0 flex-1 items-center gap-2">
                <Tabs
                  value={state.keyEncoding}
                  onValueChange={(value) => setParam("keyEncoding", value as ParamEncoding, true)}
                  className="min-w-0 flex-1"
                >
                  <ScrollableTabsList>
                    <TabsTrigger value="utf8" className="whitespace-nowrap text-xs flex-none">
                      {encodingLabels.utf8}
                    </TabsTrigger>
                    <TabsTrigger value="base64" className="whitespace-nowrap text-xs flex-none">
                      {encodingLabels.base64}
                    </TabsTrigger>
                    <TabsTrigger value="hex" className="whitespace-nowrap text-xs flex-none">
                      {encodingLabels.hex}
                    </TabsTrigger>
                  </ScrollableTabsList>
                </Tabs>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 gap-1 px-2 text-xs"
                  onClick={() => handleGenerate("key")}
                >
                  <RefreshCcw className="h-3 w-3" />
                  Random
                </Button>
              </div>
            </div>
            {keyWarning && <p className="text-xs text-muted-foreground">{keyWarning}</p>}
          </div>
          <div className="space-y-2">
            <div className="flex min-w-0 items-center gap-3">
              <Label className="w-20 text-sm sm:w-28">KDF</Label>
              <Tabs
                value={state.useKdf ? state.kdfAlgorithm : "none"}
                onValueChange={(value) => {
                  if (value === "none") {
                    setParam("useKdf", false, true)
                  } else {
                    setParam("useKdf", true, true)
                    setParam("kdfAlgorithm", value as KdfAlgorithm, true)
                  }
                }}
                className="min-w-0 flex-1"
              >
                <ScrollableTabsList>
                  <TabsTrigger value="none" className="whitespace-nowrap text-xs flex-none">
                    None
                  </TabsTrigger>
                  {kdfAlgorithms.map((value) => (
                    <TabsTrigger key={value} value={value} className="whitespace-nowrap text-xs flex-none">
                      {value}
                    </TabsTrigger>
                  ))}
                </ScrollableTabsList>
              </Tabs>
            </div>
            {state.useKdf && (
              <div className="space-y-3">
                <div className="flex min-w-0 items-center gap-3">
                  <Label className="w-20 text-sm sm:w-28">Hash</Label>
                  <Tabs
                    value={state.kdfHash}
                    onValueChange={(value) => setParam("kdfHash", value as KdfHash, true)}
                    className="min-w-0 flex-1"
                  >
                    <ScrollableTabsList>
                      {kdfHashes.map((value) => (
                        <TabsTrigger key={value} value={value} className="whitespace-nowrap text-xs flex-none">
                          {value}
                        </TabsTrigger>
                      ))}
                    </ScrollableTabsList>
                  </Tabs>
                </div>
                {state.kdfAlgorithm === "PBKDF2" && (
                  <div className="flex min-w-0 items-center gap-3">
                    <Label className="w-20 text-sm sm:w-28">Iterations</Label>
                    <Input
                      type="number"
                      min={1}
                      value={state.iterations}
                      onChange={(e) => setParam("iterations", Math.max(1, Number(e.target.value) || 0), true)}
                      className="w-32"
                    />
                  </div>
                )}
                <div className="space-y-2">
                  <div className="flex min-w-0 items-center gap-3">
                    <Label className="w-20 text-sm sm:w-28">Salt</Label>
                    <Input
                      value={state.salt}
                      onChange={(e) => setParam("salt", e.target.value)}
                      placeholder="Salt value"
                      className="min-w-0 flex-1"
                    />
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-20 sm:w-28" aria-hidden="true" />
                    <div className="flex min-w-0 flex-1 items-center gap-2">
                      <Tabs
                        value={state.saltEncoding}
                        onValueChange={(value) => setParam("saltEncoding", value as ParamEncoding, true)}
                        className="min-w-0 flex-1"
                      >
                        <ScrollableTabsList>
                          <TabsTrigger value="utf8" className="whitespace-nowrap text-xs flex-none">
                            {encodingLabels.utf8}
                          </TabsTrigger>
                          <TabsTrigger value="base64" className="whitespace-nowrap text-xs flex-none">
                            {encodingLabels.base64}
                          </TabsTrigger>
                          <TabsTrigger value="hex" className="whitespace-nowrap text-xs flex-none">
                            {encodingLabels.hex}
                          </TabsTrigger>
                        </ScrollableTabsList>
                      </Tabs>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 gap-1 px-2 text-xs"
                        onClick={() => handleGenerate("salt")}
                      >
                        <RefreshCcw className="h-3 w-3" />
                        Random
                      </Button>
                    </div>
                  </div>
                  {saltWarning && <p className="text-xs text-muted-foreground">{saltWarning}</p>}
                </div>
                {state.kdfAlgorithm === "HKDF" && (
                  <div className="space-y-2">
                    <div className="flex min-w-0 items-center gap-3">
                      <Label className="w-20 text-sm sm:w-28">Info</Label>
                      <Input
                        value={state.kdfInfo}
                        onChange={(e) => setParam("kdfInfo", e.target.value)}
                        placeholder="Context info"
                        className="min-w-0 flex-1"
                      />
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="w-20 sm:w-28" aria-hidden="true" />
                      <Tabs
                        value={state.kdfInfoEncoding}
                        onValueChange={(value) => setParam("kdfInfoEncoding", value as ParamEncoding, true)}
                        className="min-w-0 flex-1"
                      >
                        <ScrollableTabsList>
                          <TabsTrigger value="utf8" className="whitespace-nowrap text-xs flex-none">
                            {encodingLabels.utf8}
                          </TabsTrigger>
                          <TabsTrigger value="base64" className="whitespace-nowrap text-xs flex-none">
                            {encodingLabels.base64}
                          </TabsTrigger>
                          <TabsTrigger value="hex" className="whitespace-nowrap text-xs flex-none">
                            {encodingLabels.hex}
                          </TabsTrigger>
                        </ScrollableTabsList>
                      </Tabs>
                    </div>
                    {kdfInfoWarning && <p className="text-xs text-muted-foreground">{kdfInfoWarning}</p>}
                  </div>
                )}
              </div>
            )}
          </div>
          <hr className="border-border/60" />

          <div className="space-y-3">
            {state.algorithm === "aes" && (
              <>
                {state.aesMode !== "GCM" && (
                  <div className="flex min-w-0 items-center gap-3">
                    <Label className="w-20 text-sm sm:w-28">Padding</Label>
                    <Tabs
                      value={state.aesPadding}
                      onValueChange={(value) => setParam("aesPadding", value as PaddingValue, true)}
                      className="min-w-0 flex-1"
                    >
                      <ScrollableTabsList>
                        {paddings.map((value) => (
                          <TabsTrigger key={value} value={value} className="whitespace-nowrap text-xs flex-none">
                            {value}
                          </TabsTrigger>
                        ))}
                      </ScrollableTabsList>
                    </Tabs>
                  </div>
                )}
                {state.aesMode !== "ECB" && (
                  <div className="space-y-2">
                    <div className="flex min-w-0 items-center gap-3">
                      <Label className="w-20 text-sm sm:w-28">IV</Label>
                      <Input
                        value={state.aesIv}
                        onChange={(e) => setParam("aesIv", e.target.value)}
                        placeholder="IV value"
                        className="min-w-0 flex-1"
                      />
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="w-20 sm:w-28" aria-hidden="true" />
                      <div className="flex min-w-0 flex-1 items-center gap-2">
                        <Tabs
                          value={state.aesIvEncoding}
                          onValueChange={(value) => setParam("aesIvEncoding", value as ParamEncoding, true)}
                          className="min-w-0 flex-1"
                        >
                          <ScrollableTabsList>
                            <TabsTrigger value="utf8" className="whitespace-nowrap text-xs flex-none">
                              {encodingLabels.utf8}
                            </TabsTrigger>
                            <TabsTrigger value="base64" className="whitespace-nowrap text-xs flex-none">
                              {encodingLabels.base64}
                            </TabsTrigger>
                            <TabsTrigger value="hex" className="whitespace-nowrap text-xs flex-none">
                              {encodingLabels.hex}
                            </TabsTrigger>
                          </ScrollableTabsList>
                        </Tabs>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 gap-1 px-2 text-xs"
                          onClick={() => handleGenerate("aesIv")}
                        >
                          <RefreshCcw className="h-3 w-3" />
                          Random
                        </Button>
                      </div>
                    </div>
                    {aesIvWarning && <p className="text-xs text-muted-foreground">{aesIvWarning}</p>}
                  </div>
                )}
              </>
            )}

            {(state.algorithm === "des" || state.algorithm === "3des") && (
              <>
                <div className="flex min-w-0 items-center gap-3">
                  <Label className="w-20 text-sm sm:w-28">Padding</Label>
                  <Tabs
                    value={state.desPadding}
                    onValueChange={(value) => setParam("desPadding", value as PaddingValue, true)}
                    className="min-w-0 flex-1"
                  >
                    <ScrollableTabsList>
                      {paddings.map((value) => (
                        <TabsTrigger key={value} value={value} className="whitespace-nowrap text-xs flex-none">
                          {value}
                        </TabsTrigger>
                      ))}
                    </ScrollableTabsList>
                  </Tabs>
                </div>
                {state.desMode !== "ECB" && (
                  <div className="space-y-2">
                    <div className="flex min-w-0 items-center gap-3">
                      <Label className="w-20 text-sm sm:w-28">IV</Label>
                      <Input
                        value={state.desIv}
                        onChange={(e) => setParam("desIv", e.target.value)}
                        placeholder="IV value"
                        className="min-w-0 flex-1"
                      />
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="w-20 sm:w-28" aria-hidden="true" />
                      <div className="flex min-w-0 flex-1 items-center gap-2">
                        <Tabs
                          value={state.desIvEncoding}
                          onValueChange={(value) => setParam("desIvEncoding", value as ParamEncoding, true)}
                          className="min-w-0 flex-1"
                        >
                          <ScrollableTabsList>
                            <TabsTrigger value="utf8" className="whitespace-nowrap text-xs flex-none">
                              {encodingLabels.utf8}
                            </TabsTrigger>
                            <TabsTrigger value="base64" className="whitespace-nowrap text-xs flex-none">
                              {encodingLabels.base64}
                            </TabsTrigger>
                            <TabsTrigger value="hex" className="whitespace-nowrap text-xs flex-none">
                              {encodingLabels.hex}
                            </TabsTrigger>
                          </ScrollableTabsList>
                        </Tabs>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 gap-1 px-2 text-xs"
                          onClick={() => handleGenerate("desIv")}
                        >
                          <RefreshCcw className="h-3 w-3" />
                          Random
                        </Button>
                      </div>
                    </div>
                    {desIvWarning && <p className="text-xs text-muted-foreground">{desIvWarning}</p>}
                  </div>
                )}
              </>
            )}

            {state.algorithm === "blowfish" && (
              <>
                <div className="flex min-w-0 items-center gap-3">
                  <Label className="w-20 text-sm sm:w-28">Padding</Label>
                  <Tabs
                    value={state.blowfishPadding}
                    onValueChange={(value) => setParam("blowfishPadding", value as BlowfishPadding, true)}
                    className="min-w-0 flex-1"
                  >
                    <ScrollableTabsList>
                      {blowfishPaddings.map((value) => (
                        <TabsTrigger key={value} value={value} className="whitespace-nowrap text-xs flex-none">
                          {value}
                        </TabsTrigger>
                      ))}
                    </ScrollableTabsList>
                  </Tabs>
                </div>
                {state.blowfishMode !== "ECB" && (
                  <div className="space-y-2">
                    <div className="flex min-w-0 items-center gap-3">
                      <Label className="w-20 text-sm sm:w-28">IV</Label>
                      <Input
                        value={state.blowfishIv}
                        onChange={(e) => setParam("blowfishIv", e.target.value)}
                        placeholder="IV value"
                        className="min-w-0 flex-1"
                      />
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="w-20 sm:w-28" aria-hidden="true" />
                      <div className="flex min-w-0 flex-1 items-center gap-2">
                        <Tabs
                          value={state.blowfishIvEncoding}
                          onValueChange={(value) => setParam("blowfishIvEncoding", value as ParamEncoding, true)}
                          className="min-w-0 flex-1"
                        >
                          <ScrollableTabsList>
                            <TabsTrigger value="utf8" className="whitespace-nowrap text-xs flex-none">
                              {encodingLabels.utf8}
                            </TabsTrigger>
                            <TabsTrigger value="base64" className="whitespace-nowrap text-xs flex-none">
                              {encodingLabels.base64}
                            </TabsTrigger>
                            <TabsTrigger value="hex" className="whitespace-nowrap text-xs flex-none">
                              {encodingLabels.hex}
                            </TabsTrigger>
                          </ScrollableTabsList>
                        </Tabs>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 gap-1 px-2 text-xs"
                          onClick={() => handleGenerate("blowfishIv")}
                        >
                          <RefreshCcw className="h-3 w-3" />
                          Random
                        </Button>
                      </div>
                    </div>
                    {blowfishIvWarning && <p className="text-xs text-muted-foreground">{blowfishIvWarning}</p>}
                  </div>
                )}
              </>
            )}

            {state.algorithm === "twofish" && (
              <>
                <div className="flex min-w-0 items-center gap-3">
                  <Label className="w-20 text-sm sm:w-28">Padding</Label>
                  <Tabs
                    value={state.twofishPadding}
                    onValueChange={(value) => setParam("twofishPadding", value as TwofishPadding, true)}
                    className="min-w-0 flex-1"
                  >
                    <ScrollableTabsList>
                      {twofishPaddings.map((value) => (
                        <TabsTrigger key={value} value={value} className="whitespace-nowrap text-xs flex-none">
                          {value}
                        </TabsTrigger>
                      ))}
                    </ScrollableTabsList>
                  </Tabs>
                </div>
                {state.twofishMode !== "ECB" && (
                  <div className="space-y-2">
                    <div className="flex min-w-0 items-center gap-3">
                      <Label className="w-20 text-sm sm:w-28">IV</Label>
                      <Input
                        value={state.twofishIv}
                        onChange={(e) => setParam("twofishIv", e.target.value)}
                        placeholder="IV value"
                        className="min-w-0 flex-1"
                      />
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="w-20 sm:w-28" aria-hidden="true" />
                      <div className="flex min-w-0 flex-1 items-center gap-2">
                        <Tabs
                          value={state.twofishIvEncoding}
                          onValueChange={(value) => setParam("twofishIvEncoding", value as ParamEncoding, true)}
                          className="min-w-0 flex-1"
                        >
                          <ScrollableTabsList>
                            <TabsTrigger value="utf8" className="whitespace-nowrap text-xs flex-none">
                              {encodingLabels.utf8}
                            </TabsTrigger>
                            <TabsTrigger value="base64" className="whitespace-nowrap text-xs flex-none">
                              {encodingLabels.base64}
                            </TabsTrigger>
                            <TabsTrigger value="hex" className="whitespace-nowrap text-xs flex-none">
                              {encodingLabels.hex}
                            </TabsTrigger>
                          </ScrollableTabsList>
                        </Tabs>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 gap-1 px-2 text-xs"
                          onClick={() => handleGenerate("twofishIv")}
                        >
                          <RefreshCcw className="h-3 w-3" />
                          Random
                        </Button>
                      </div>
                    </div>
                    {twofishIvWarning && <p className="text-xs text-muted-foreground">{twofishIvWarning}</p>}
                  </div>
                )}
              </>
            )}

            {state.algorithm === "chacha20" && (
              <>
                {state.chachaPoly1305 && (
                  <div className="space-y-2">
                    <div className="flex min-w-0 items-center gap-3">
                      <Label className="w-20 text-sm sm:w-28">Nonce</Label>
                      <Input
                        value={state.chachaNonce}
                        onChange={(e) => setParam("chachaNonce", e.target.value)}
                        placeholder="Nonce value"
                        className="min-w-0 flex-1"
                      />
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="w-20 sm:w-28" aria-hidden="true" />
                      <div className="flex min-w-0 flex-1 items-center gap-2">
                        <Tabs
                          value={state.chachaNonceEncoding}
                          onValueChange={(value) => setParam("chachaNonceEncoding", value as ParamEncoding, true)}
                          className="min-w-0 flex-1"
                        >
                          <ScrollableTabsList>
                            <TabsTrigger value="utf8" className="whitespace-nowrap text-xs flex-none">
                              {encodingLabels.utf8}
                            </TabsTrigger>
                            <TabsTrigger value="base64" className="whitespace-nowrap text-xs flex-none">
                              {encodingLabels.base64}
                            </TabsTrigger>
                            <TabsTrigger value="hex" className="whitespace-nowrap text-xs flex-none">
                              {encodingLabels.hex}
                            </TabsTrigger>
                          </ScrollableTabsList>
                        </Tabs>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 gap-1 px-2 text-xs"
                          onClick={() => handleGenerate("chachaNonce")}
                        >
                          <RefreshCcw className="h-3 w-3" />
                          Random
                        </Button>
                      </div>
                    </div>
                    {chachaNonceWarning && <p className="text-xs text-muted-foreground">{chachaNonceWarning}</p>}
                  </div>
                )}
                {!state.chachaPoly1305 && (
                  <div className="flex min-w-0 items-center gap-3">
                    <Label className="w-20 text-sm sm:w-28">Counter</Label>
                    <Input
                      type="number"
                      min={0}
                      value={state.chachaCounter}
                      onChange={(e) => setParam("chachaCounter", Number(e.target.value) || 0, true)}
                      className="w-24"
                    />
                  </div>
                )}
              </>
            )}

            {state.algorithm === "salsa20" && (
              <>
                <div className="space-y-2">
                  <div className="flex min-w-0 items-center gap-3">
                    <Label className="w-20 text-sm sm:w-28">Nonce</Label>
                    <Input
                      value={state.salsaNonce}
                      onChange={(e) => setParam("salsaNonce", e.target.value)}
                      placeholder="Nonce value"
                      className="min-w-0 flex-1"
                    />
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-20 sm:w-28" aria-hidden="true" />
                    <div className="flex min-w-0 flex-1 items-center gap-2">
                      <Tabs
                        value={state.salsaNonceEncoding}
                        onValueChange={(value) => setParam("salsaNonceEncoding", value as ParamEncoding, true)}
                        className="min-w-0 flex-1"
                      >
                        <ScrollableTabsList>
                          <TabsTrigger value="utf8" className="whitespace-nowrap text-xs flex-none">
                            {encodingLabels.utf8}
                          </TabsTrigger>
                          <TabsTrigger value="base64" className="whitespace-nowrap text-xs flex-none">
                            {encodingLabels.base64}
                          </TabsTrigger>
                          <TabsTrigger value="hex" className="whitespace-nowrap text-xs flex-none">
                            {encodingLabels.hex}
                          </TabsTrigger>
                        </ScrollableTabsList>
                      </Tabs>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 gap-1 px-2 text-xs"
                        onClick={() => handleGenerate("salsaNonce")}
                      >
                        <RefreshCcw className="h-3 w-3" />
                        Random
                      </Button>
                    </div>
                  </div>
                  {salsaNonceWarning && <p className="text-xs text-muted-foreground">{salsaNonceWarning}</p>}
                </div>
                <div className="flex min-w-0 items-center gap-3">
                  <Label className="w-20 text-sm sm:w-28">Counter</Label>
                  <Input
                    type="number"
                    min={0}
                    value={state.salsaCounter}
                    onChange={(e) => setParam("salsaCounter", Number(e.target.value) || 0, true)}
                    className="w-24"
                  />
                </div>
              </>
            )}
          </div>

        </div>

        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between gap-2">
              <div className="flex min-w-0 flex-1 items-center gap-2">
                <Label className="text-sm font-medium">Input</Label>
                {showInputEncodingSelect ? (
                  <Tabs
                    value={state.inputEncoding}
                    onValueChange={(value) => setParam("inputEncoding", value as InputEncoding, true)}
                    className="min-w-0 flex-1"
                  >
                    <ScrollableTabsList>
                      {inputEncodingOptions.map((option) => (
                        <TabsTrigger key={option.value} value={option.value} className="whitespace-nowrap text-xs flex-none">
                          {option.label}
                        </TabsTrigger>
                      ))}
                    </ScrollableTabsList>
                  </Tabs>
                ) : (
                  <span className="rounded-md border px-2 py-1 text-xs">{encodingLabels.binary}</span>
                )}
              </div>
              <div className="flex shrink-0 items-center gap-1">
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
                readOnly={Boolean(fileName) || state.inputEncoding === "binary"}
                placeholder={
                  state.inputEncoding === "binary"
                    ? "Upload a file for binary input..."
                    : state.mode === "encrypt"
                      ? "Paste input data to encrypt..."
                      : "Paste input data to decrypt..."
                }
                className={cn(
                  "max-h-[320px] min-h-[200px] overflow-auto overflow-x-hidden break-all whitespace-pre-wrap font-mono text-sm",
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
            {inputWarning && <p className="text-xs text-muted-foreground">{inputWarning}</p>}
          </div>

          <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between gap-2">
              <div className="flex min-w-0 flex-1 items-center gap-2">
                <Label className="text-sm font-medium">Result</Label>
                <Tabs
                  value={state.outputEncoding}
                  onValueChange={(value) => setParam("outputEncoding", value as OutputEncoding, true)}
                  className="min-w-0 flex-1"
                >
                  <ScrollableTabsList>
                    <TabsTrigger value="base64" className="whitespace-nowrap text-xs flex-none">
                      {encodingLabels.base64}
                    </TabsTrigger>
                    <TabsTrigger value="base64url" className="whitespace-nowrap text-xs flex-none">
                      {encodingLabels.base64url}
                    </TabsTrigger>
                    <TabsTrigger value="hex" className="whitespace-nowrap text-xs flex-none">
                      {encodingLabels.hex}
                    </TabsTrigger>
                    <TabsTrigger value="binary" className="whitespace-nowrap text-xs flex-none">
                      {encodingLabels.binary}
                    </TabsTrigger>
                  </ScrollableTabsList>
                </Tabs>
              </div>
              {state.outputEncoding !== "binary" && (
                <div className="flex shrink-0 items-center gap-1">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleCopyResult}
                    className="h-7 w-7 p-0"
                    aria-label="Copy result"
                    disabled={!output}
                  >
                    {copied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleDownloadTextResult}
                    className="h-7 w-7 p-0"
                    aria-label="Download result"
                    disabled={!output}
                  >
                    <Download className="h-3 w-3" />
                  </Button>
                </div>
              )}
            </div>
            <div className="relative">
              <Textarea
                value={output}
                readOnly
                placeholder="Result will appear here..."
                className="max-h-[320px] min-h-[200px] overflow-auto overflow-x-hidden break-all whitespace-pre-wrap font-mono text-sm"
              />
              {state.outputEncoding === "binary" && (
                <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 rounded-md border bg-background/95 px-4 text-center text-sm text-muted-foreground">
                  <span>Binary output cannot be displayed. Download to use it.</span>
                  {binaryMeta && (
                    <>
                      <div className="flex w-full items-center justify-between gap-3 text-xs">
                        <span className="truncate font-medium text-foreground">{binaryMeta.name}</span>
                        <span className="shrink-0 text-muted-foreground">{binaryMeta.size} bytes</span>
                      </div>
                      <Button variant="ghost" size="sm" onClick={handleDownloadOutput} className="h-7 gap-1 px-2 text-xs">
                        <Download className="h-3 w-3" />
                        Download
                      </Button>
                    </>
                  )}
                </div>
              )}
            </div>
            {isWorking && <p className="text-xs text-muted-foreground">Processing...</p>}
            {error && (
              <Alert variant="destructive" className="py-2">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription className="text-xs">{error}</AlertDescription>
              </Alert>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
