"use client"

import * as React from "react"
import { Suspense } from "react"
import { z } from "zod"
import { AlertCircle, Check, Copy, Download, RefreshCcw, Upload, X } from "lucide-react"
import { ToolPageWrapper, useToolHistoryContext } from "@/components/tool-ui/tool-page-wrapper"
import { DEFAULT_URL_SYNC_DEBOUNCE_MS, useUrlSyncedState } from "@/lib/url-state/use-url-synced-state"
import { Textarea } from "@/components/ui/textarea"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Button } from "@/components/ui/button"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Badge } from "@/components/ui/badge"
import { decodeBase64, encodeBase64 } from "@/lib/encoding/base64"
import { decodeHex, encodeHex } from "@/lib/encoding/hex"
import type { HistoryEntry } from "@/lib/history/db"
import { cn } from "@/lib/utils"

const modeValues = ["sign", "verify"] as const
type ModeValue = (typeof modeValues)[number]

const algorithmValues = ["hmac", "rsa", "ecdsa", "eddsa"] as const
type AlgorithmValue = (typeof algorithmValues)[number]

const hmacHashes = ["SHA-256", "SHA-384", "SHA-512"] as const
type HmacHash = (typeof hmacHashes)[number]

const rsaSchemes = ["RSASSA-PKCS1-v1_5", "RSA-PSS"] as const
type RsaScheme = (typeof rsaSchemes)[number]

const rsaHashes = ["SHA-256", "SHA-384", "SHA-512"] as const
type RsaHash = (typeof rsaHashes)[number]

const ecdsaCurves = ["P-256", "P-384", "P-521"] as const
type EcdsaCurve = (typeof ecdsaCurves)[number]

const ecdsaHashes = ["SHA-256", "SHA-384", "SHA-512"] as const
type EcdsaHash = (typeof ecdsaHashes)[number]

const eddsaCurves = ["Ed25519", "Ed448"] as const
type EddsaCurve = (typeof eddsaCurves)[number]

const inputEncodings = ["utf8", "base64", "hex", "binary"] as const
type InputEncoding = (typeof inputEncodings)[number]

const signatureEncodings = ["base64", "base64url", "hex"] as const
type SignatureEncoding = (typeof signatureEncodings)[number]

const keyEncodings = ["utf8", "base64", "hex"] as const
type KeyEncoding = (typeof keyEncodings)[number]

const paramsSchema = z.object({
  mode: z.enum(modeValues).default("sign"),
  algorithm: z.enum(algorithmValues).default("hmac"),
  message: z.string().default(""),
  inputEncoding: z.enum(inputEncodings).default("utf8"),
  signature: z.string().default(""),
  signatureEncoding: z.enum(signatureEncodings).default("base64"),
  hmacHash: z.enum(hmacHashes).default("SHA-256"),
  hmacKey: z.string().default(""),
  hmacKeyEncoding: z.enum(keyEncodings).default("base64"),
  rsaScheme: z.enum(rsaSchemes).default("RSA-PSS"),
  rsaHash: z.enum(rsaHashes).default("SHA-256"),
  rsaSaltLength: z.coerce.number().int().min(0).max(1024).default(0),
  rsaModulusLength: z.coerce.number().int().min(1024).max(16384).default(2048),
  rsaPublicExponent: z.string().default("65537"),
  ecdsaCurve: z.enum(ecdsaCurves).default("P-256"),
  ecdsaHash: z.enum(ecdsaHashes).default("SHA-256"),
  eddsaCurve: z.enum(eddsaCurves).default("Ed25519"),
  rsaPrivateKey: z.string().default(""),
  rsaPublicKey: z.string().default(""),
  ecdsaPrivateKey: z.string().default(""),
  ecdsaPublicKey: z.string().default(""),
  eddsaPrivateKey: z.string().default(""),
  eddsaPublicKey: z.string().default(""),
})

type SignatureState = z.infer<typeof paramsSchema>

const algorithmLabels: Record<AlgorithmValue, string> = {
  hmac: "HMAC",
  rsa: "RSA",
  ecdsa: "ECDSA",
  eddsa: "EdDSA",
}

const encodingLabels = {
  utf8: "UTF-8",
  base64: "Base64",
  base64url: "Base64url",
  hex: "Hex",
  binary: "Binary",
} as const

const textEncoder = new TextEncoder()

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

function decodeInputBytes(value: string, encoding: InputEncoding) {
  if (encoding === "binary") {
    throw new Error("Binary input requires a file upload.")
  }
  if (!value) return new Uint8Array()
  if (encoding === "utf8") return textEncoder.encode(value)
  if (encoding === "hex") return decodeHex(value)
  return decodeBase64(value)
}

function decodeKeyBytes(value: string, encoding: KeyEncoding) {
  if (!value) return new Uint8Array()
  if (encoding === "utf8") return textEncoder.encode(value)
  if (encoding === "hex") return decodeHex(value)
  return decodeBase64(value)
}

function encodeSignatureBytes(bytes: Uint8Array, encoding: SignatureEncoding) {
  if (encoding === "hex") return encodeHex(bytes, { upperCase: false })
  if (encoding === "base64") return encodeBase64(bytes, { urlSafe: false, padding: true })
  return encodeBase64(bytes, { urlSafe: true, padding: false })
}

function decodeSignatureBytes(value: string, encoding: SignatureEncoding) {
  if (!value) return new Uint8Array()
  if (encoding === "hex") return decodeHex(value)
  return decodeBase64(value)
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

function toPem(buffer: ArrayBuffer, label: "PUBLIC KEY" | "PRIVATE KEY") {
  const bytes = new Uint8Array(buffer)
  let binary = ""
  for (const byte of bytes) {
    binary += String.fromCharCode(byte)
  }
  const base64 = btoa(binary).replace(/(.{64})/g, "$1\n")
  return `-----BEGIN ${label}-----\n${base64}\n-----END ${label}-----`
}

function parseExponent(value: string) {
  const trimmed = value.trim()
  if (!/^\d+$/.test(trimmed)) return null
  const num = Number(trimmed)
  if (!Number.isSafeInteger(num) || num <= 0) return null
  const bytes: number[] = []
  let remaining = num
  while (remaining > 0) {
    bytes.unshift(remaining & 0xff)
    remaining = Math.floor(remaining / 256)
  }
  return new Uint8Array(bytes)
}

function isKeyPair(key: CryptoKey | CryptoKeyPair): key is CryptoKeyPair {
  return "publicKey" in key && "privateKey" in key
}

function getHmacKeyLength(hash: HmacHash) {
  if (hash === "SHA-384") return 48
  if (hash === "SHA-512") return 64
  return 32
}

function getRsaSaltLength(hash: RsaHash, override: number) {
  if (override > 0) return override
  if (hash === "SHA-384") return 48
  if (hash === "SHA-512") return 64
  return 32
}

function getImportAlgorithm(state: SignatureState) {
  if (state.algorithm === "rsa") {
    return { name: state.rsaScheme, hash: { name: state.rsaHash } }
  }
  if (state.algorithm === "ecdsa") {
    return { name: "ECDSA", namedCurve: state.ecdsaCurve }
  }
  if (state.algorithm === "eddsa") {
    return { name: state.eddsaCurve }
  }
  return null
}

function getKeyFields(algorithm: AlgorithmValue) {
  if (algorithm === "rsa") {
    return { privateKey: "rsaPrivateKey", publicKey: "rsaPublicKey" } as const
  }
  if (algorithm === "ecdsa") {
    return { privateKey: "ecdsaPrivateKey", publicKey: "ecdsaPublicKey" } as const
  }
  return { privateKey: "eddsaPrivateKey", publicKey: "eddsaPublicKey" } as const
}

function getKeySelection(state: SignatureState) {
  if (state.algorithm === "rsa") {
    return { privateKey: state.rsaPrivateKey, publicKey: state.rsaPublicKey }
  }
  if (state.algorithm === "ecdsa") {
    return { privateKey: state.ecdsaPrivateKey, publicKey: state.ecdsaPublicKey }
  }
  return { privateKey: state.eddsaPrivateKey, publicKey: state.eddsaPublicKey }
}

async function importAsymmetricKey({
  keyText,
  mode,
  state,
}: {
  keyText: string
  mode: "sign" | "verify"
  state: SignatureState
}) {
  const jwk = parseJwk(keyText)
  const algorithm = getImportAlgorithm(state)
  if (!algorithm) return null
  if (jwk) {
    if (mode === "sign" && !("d" in jwk)) return null
    return crypto.subtle.importKey("jwk", jwk, algorithm, false, [mode])
  }
  const parsed = pemToArrayBuffer(keyText)
  if (!parsed) return null
  if (mode === "sign" && !parsed.label.includes("PRIVATE KEY")) return null
  const format = parsed.label.includes("PRIVATE KEY") ? "pkcs8" : "spki"
  return crypto.subtle.importKey(format, parsed.buffer, algorithm, false, [mode])
}

async function signMessage({
  messageBytes,
  state,
  privateKeyText,
}: {
  messageBytes: Uint8Array
  state: SignatureState
  privateKeyText: string
}) {
  if (!globalThis.crypto?.subtle) {
    throw new Error("Web Crypto is unavailable in this environment.")
  }
  if (state.algorithm === "hmac") {
    const keyBytes = decodeKeyBytes(state.hmacKey, state.hmacKeyEncoding)
    const key = await crypto.subtle.importKey(
      "raw",
      keyBytes,
      {
        name: "HMAC",
        hash: { name: state.hmacHash },
      },
      false,
      ["sign"],
    )
    const signature = await crypto.subtle.sign("HMAC", key, messageBytes)
    return new Uint8Array(signature)
  }
  const keyText = privateKeyText.trim()
  if (!keyText) {
    throw new Error("Private key is required to sign.")
  }
  const key = await importAsymmetricKey({ keyText, mode: "sign", state })
  if (!key) {
    throw new Error("Invalid private key format. Use PKCS8 PEM or JWK.")
  }
  if (state.algorithm === "rsa") {
    if (state.rsaScheme === "RSA-PSS") {
      const signature = await crypto.subtle.sign(
        { name: "RSA-PSS", saltLength: getRsaSaltLength(state.rsaHash, state.rsaSaltLength) },
        key,
        messageBytes,
      )
      return new Uint8Array(signature)
    }
    const signature = await crypto.subtle.sign("RSASSA-PKCS1-v1_5", key, messageBytes)
    return new Uint8Array(signature)
  }
  if (state.algorithm === "ecdsa") {
    const signature = await crypto.subtle.sign(
      { name: "ECDSA", hash: { name: state.ecdsaHash } },
      key,
      messageBytes,
    )
    return new Uint8Array(signature)
  }
  const signature = await crypto.subtle.sign(state.eddsaCurve, key, messageBytes)
  return new Uint8Array(signature)
}

async function verifyMessage({
  messageBytes,
  signatureBytes,
  state,
  publicKeyText,
  privateKeyText,
}: {
  messageBytes: Uint8Array
  signatureBytes: Uint8Array
  state: SignatureState
  publicKeyText: string
  privateKeyText: string
}) {
  if (!globalThis.crypto?.subtle) {
    throw new Error("Web Crypto is unavailable in this environment.")
  }
  if (state.algorithm === "hmac") {
    const keyBytes = decodeKeyBytes(state.hmacKey, state.hmacKeyEncoding)
    const key = await crypto.subtle.importKey(
      "raw",
      keyBytes,
      {
        name: "HMAC",
        hash: { name: state.hmacHash },
      },
      false,
      ["verify"],
    )
    return crypto.subtle.verify("HMAC", key, signatureBytes, messageBytes)
  }
  const keyText = publicKeyText.trim() || privateKeyText.trim()
  if (!keyText) {
    throw new Error("Public or private key is required to verify.")
  }
  const key = await importAsymmetricKey({ keyText, mode: "verify", state })
  if (!key) {
    throw new Error("Invalid key format. Use SPKI/PKCS8 PEM or JWK.")
  }
  if (state.algorithm === "rsa") {
    if (state.rsaScheme === "RSA-PSS") {
      return crypto.subtle.verify(
        { name: "RSA-PSS", saltLength: getRsaSaltLength(state.rsaHash, state.rsaSaltLength) },
        key,
        signatureBytes,
        messageBytes,
      )
    }
    return crypto.subtle.verify("RSASSA-PKCS1-v1_5", key, signatureBytes, messageBytes)
  }
  if (state.algorithm === "ecdsa") {
    return crypto.subtle.verify(
      { name: "ECDSA", hash: { name: state.ecdsaHash } },
      key,
      signatureBytes,
      messageBytes,
    )
  }
  return crypto.subtle.verify(state.eddsaCurve, key, signatureBytes, messageBytes)
}

async function generateKeypair(state: SignatureState) {
  if (!globalThis.crypto?.subtle) {
    throw new Error("Web Crypto is unavailable in this environment.")
  }
  if (state.algorithm === "hmac") {
    throw new Error("Keypair generation is not available for HMAC.")
  }
  if (state.algorithm === "rsa") {
    const exponent = parseExponent(state.rsaPublicExponent)
    if (!exponent) {
      throw new Error("Invalid RSA public exponent.")
    }
    const algorithm = {
      name: state.rsaScheme,
      modulusLength: state.rsaModulusLength,
      publicExponent: exponent,
      hash: { name: state.rsaHash },
    }
    const keyPair = await crypto.subtle.generateKey(algorithm, true, ["sign", "verify"])
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
  if (state.algorithm === "ecdsa") {
    const keyPair = await crypto.subtle.generateKey({ name: "ECDSA", namedCurve: state.ecdsaCurve }, true, [
      "sign",
      "verify",
    ])
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
  const keyPair = await crypto.subtle.generateKey({ name: state.eddsaCurve }, true, ["sign", "verify"])
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

function ScrollableTabsList({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-w-0 w-full overflow-x-auto">
      <TabsList className="inline-flex w-max justify-start">{children}</TabsList>
    </div>
  )
}

export default function SignaturePage() {
  return (
    <Suspense fallback={null}>
      <SignatureContent />
    </Suspense>
  )
}

function SignatureContent() {
  const { state, setParam, oversizeKeys, hasUrlParams, hydrationSource, resetToDefaults } = useUrlSyncedState(
    "signature",
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
      if (inputs.message !== undefined) setParam("message", inputs.message)
      if (inputs.signature !== undefined) setParam("signature", inputs.signature)
      const typedParams = params as Partial<SignatureState>
      ;(Object.keys(paramsSchema.shape) as (keyof SignatureState)[]).forEach((key) => {
        if (typedParams[key] !== undefined) {
          setParam(key, typedParams[key] as SignatureState[typeof key])
        }
      })
    },
    [setParam],
  )

  return (
    <ToolPageWrapper
      toolId="signature"
      title="Signature"
      description="Sign and verify messages with HMAC, RSA, ECDSA, and EdDSA."
      onLoadHistory={handleLoadHistory}
    >
      <SignatureInner
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

function SignatureInner({
  state,
  setParam,
  oversizeKeys,
  hasUrlParams,
  hydrationSource,
  resetToDefaults,
  fileName,
  setFileName,
}: {
  state: SignatureState
  setParam: <K extends keyof SignatureState>(key: K, value: SignatureState[K], immediate?: boolean) => void
  oversizeKeys: (keyof SignatureState)[]
  hasUrlParams: boolean
  hydrationSource: "default" | "url" | "history"
  resetToDefaults: () => void
  fileName: string | null
  setFileName: (value: string | null) => void
}) {
  const { upsertInputEntry, upsertParams } = useToolHistoryContext()
  const [output, setOutput] = React.useState("")
  const [verificationStatus, setVerificationStatus] = React.useState<boolean | null>(null)
  const [error, setError] = React.useState<string | null>(null)
  const [isWorking, setIsWorking] = React.useState(false)
  const [copied, setCopied] = React.useState(false)
  const fileInputRef = React.useRef<HTMLInputElement>(null)
  const privateKeyInputRef = React.useRef<HTMLInputElement>(null)
  const publicKeyInputRef = React.useRef<HTMLInputElement>(null)
  const [isGeneratingKeys, setIsGeneratingKeys] = React.useState(false)
  const lastInputRef = React.useRef<string>("")
  const hasHydratedInputRef = React.useRef(false)
  const fileBytesRef = React.useRef<Uint8Array | null>(null)
  const [fileVersion, setFileVersion] = React.useState(0)
  const [fileMeta, setFileMeta] = React.useState<{ name: string; size: number } | null>(null)
  const paramsRef = React.useRef({
    mode: state.mode,
    algorithm: state.algorithm,
    inputEncoding: state.inputEncoding,
    signatureEncoding: state.signatureEncoding,
    hmacHash: state.hmacHash,
    hmacKey: state.hmacKey,
    hmacKeyEncoding: state.hmacKeyEncoding,
    rsaScheme: state.rsaScheme,
    rsaHash: state.rsaHash,
    rsaSaltLength: state.rsaSaltLength,
    rsaModulusLength: state.rsaModulusLength,
    rsaPublicExponent: state.rsaPublicExponent,
    ecdsaCurve: state.ecdsaCurve,
    ecdsaHash: state.ecdsaHash,
    eddsaCurve: state.eddsaCurve,
    rsaPrivateKey: state.rsaPrivateKey,
    rsaPublicKey: state.rsaPublicKey,
    ecdsaPrivateKey: state.ecdsaPrivateKey,
    ecdsaPublicKey: state.ecdsaPublicKey,
    eddsaPrivateKey: state.eddsaPrivateKey,
    eddsaPublicKey: state.eddsaPublicKey,
    fileName,
  })
  const hasInitializedParamsRef = React.useRef(false)
  const hasHandledUrlRef = React.useRef(false)
  const runRef = React.useRef(0)

  const historyParams = React.useMemo(
    () => ({
      mode: state.mode,
      algorithm: state.algorithm,
      inputEncoding: state.inputEncoding,
      signatureEncoding: state.signatureEncoding,
      hmacHash: state.hmacHash,
      hmacKey: state.hmacKey,
      hmacKeyEncoding: state.hmacKeyEncoding,
      rsaScheme: state.rsaScheme,
      rsaHash: state.rsaHash,
      rsaSaltLength: state.rsaSaltLength,
      rsaModulusLength: state.rsaModulusLength,
      rsaPublicExponent: state.rsaPublicExponent,
      ecdsaCurve: state.ecdsaCurve,
      ecdsaHash: state.ecdsaHash,
      eddsaCurve: state.eddsaCurve,
      rsaPrivateKey: state.rsaPrivateKey,
      rsaPublicKey: state.rsaPublicKey,
      ecdsaPrivateKey: state.ecdsaPrivateKey,
      ecdsaPublicKey: state.ecdsaPublicKey,
      eddsaPrivateKey: state.eddsaPrivateKey,
      eddsaPublicKey: state.eddsaPublicKey,
      fileName,
    }),
    [
      state.mode,
      state.algorithm,
      state.inputEncoding,
      state.signatureEncoding,
      state.hmacHash,
      state.hmacKey,
      state.hmacKeyEncoding,
      state.rsaScheme,
      state.rsaHash,
      state.rsaSaltLength,
      state.rsaModulusLength,
      state.rsaPublicExponent,
      state.ecdsaCurve,
      state.ecdsaHash,
      state.eddsaCurve,
      state.rsaPrivateKey,
      state.rsaPublicKey,
      state.ecdsaPrivateKey,
      state.ecdsaPublicKey,
      state.eddsaPrivateKey,
      state.eddsaPublicKey,
      fileName,
    ],
  )

  React.useEffect(() => {
    if (hasHydratedInputRef.current) return
    if (hydrationSource === "default") return
    const signature = fileName ? `file:${fileName}:${fileVersion}` : `text:${state.message}`
    const inputSignature = `${signature}|sig:${state.signature}`
    lastInputRef.current = inputSignature
    hasHydratedInputRef.current = true
  }, [hydrationSource, state.message, state.signature, fileName, fileVersion])

  React.useEffect(() => {
    if (!fileName && fileBytesRef.current) {
      fileBytesRef.current = null
      setFileMeta(null)
      if (fileVersion) setFileVersion(0)
    }
  }, [fileName, fileVersion])

  React.useEffect(() => {
    const hasFile = Boolean(fileName && fileVersion)
    const signature = hasFile ? `file:${fileName}:${fileVersion}` : `text:${state.message}`
    const inputSignature = `${signature}|sig:${state.signature}`
    if ((!hasFile && !state.message && !state.signature) || inputSignature === lastInputRef.current) return

    const timer = setTimeout(() => {
      lastInputRef.current = inputSignature
      const preview = fileName ?? (state.message ? state.message.slice(0, 100) : state.signature.slice(0, 100))
      upsertInputEntry(
        { message: fileName ? "" : state.message, signature: state.signature },
        historyParams,
        "left",
        preview,
      )
    }, DEFAULT_URL_SYNC_DEBOUNCE_MS)

    return () => clearTimeout(timer)
  }, [state.message, state.signature, fileName, fileVersion, upsertInputEntry, historyParams])

  React.useEffect(() => {
    if (hasUrlParams && !hasHandledUrlRef.current) {
      hasHandledUrlRef.current = true
      const hasInput = Boolean(state.message || state.signature)
      if (hasInput) {
        const preview = state.message ? state.message.slice(0, 100) : state.signature.slice(0, 100)
        upsertInputEntry({ message: state.message, signature: state.signature }, historyParams, "left", preview)
      } else {
        upsertParams(historyParams, "interpretation")
      }
    }
  }, [hasUrlParams, state.message, state.signature, historyParams, upsertInputEntry, upsertParams])

  React.useEffect(() => {
    const nextParams = historyParams
    if (!hasInitializedParamsRef.current) {
      hasInitializedParamsRef.current = true
      paramsRef.current = nextParams
      return
    }
    if (
      paramsRef.current.mode === nextParams.mode &&
      paramsRef.current.algorithm === nextParams.algorithm &&
      paramsRef.current.inputEncoding === nextParams.inputEncoding &&
      paramsRef.current.signatureEncoding === nextParams.signatureEncoding &&
      paramsRef.current.hmacHash === nextParams.hmacHash &&
      paramsRef.current.hmacKey === nextParams.hmacKey &&
      paramsRef.current.hmacKeyEncoding === nextParams.hmacKeyEncoding &&
      paramsRef.current.rsaScheme === nextParams.rsaScheme &&
      paramsRef.current.rsaHash === nextParams.rsaHash &&
      paramsRef.current.rsaSaltLength === nextParams.rsaSaltLength &&
      paramsRef.current.rsaModulusLength === nextParams.rsaModulusLength &&
      paramsRef.current.rsaPublicExponent === nextParams.rsaPublicExponent &&
      paramsRef.current.ecdsaCurve === nextParams.ecdsaCurve &&
      paramsRef.current.ecdsaHash === nextParams.ecdsaHash &&
      paramsRef.current.eddsaCurve === nextParams.eddsaCurve &&
      paramsRef.current.rsaPrivateKey === nextParams.rsaPrivateKey &&
      paramsRef.current.rsaPublicKey === nextParams.rsaPublicKey &&
      paramsRef.current.ecdsaPrivateKey === nextParams.ecdsaPrivateKey &&
      paramsRef.current.ecdsaPublicKey === nextParams.ecdsaPublicKey &&
      paramsRef.current.eddsaPrivateKey === nextParams.eddsaPrivateKey &&
      paramsRef.current.eddsaPublicKey === nextParams.eddsaPublicKey &&
      paramsRef.current.fileName === nextParams.fileName
    ) {
      return
    }
    paramsRef.current = nextParams
    upsertParams(nextParams, "interpretation")
  }, [historyParams, upsertParams])

  React.useEffect(() => {
    if (fileName) {
      if (state.inputEncoding !== "binary") {
        setParam("inputEncoding", "binary", true)
      }
      return
    }
    const allowed: InputEncoding[] = ["utf8", "base64", "hex"]
    if (!allowed.includes(state.inputEncoding)) {
      setParam("inputEncoding", "utf8", true)
    }
  }, [fileName, state.inputEncoding, setParam])

  const keySelection = React.useMemo(() => getKeySelection(state), [
    state.algorithm,
    state.rsaPrivateKey,
    state.rsaPublicKey,
    state.ecdsaPrivateKey,
    state.ecdsaPublicKey,
    state.eddsaPrivateKey,
    state.eddsaPublicKey,
  ])

  React.useEffect(() => {
    const hasFile = Boolean(fileBytesRef.current && fileName)
    const hasMessage = hasFile || Boolean(state.message)
    if (!hasMessage) {
      setOutput("")
      setVerificationStatus(null)
      setError(null)
      setIsWorking(false)
      return
    }
    if (state.mode === "verify" && !state.signature.trim()) {
      setOutput("")
      setVerificationStatus(null)
      setError(null)
      setIsWorking(false)
      return
    }

    const runId = ++runRef.current
    setIsWorking(true)
    setError(null)

    const run = async () => {
      try {
        const messageBytes = hasFile
          ? fileBytesRef.current!
          : decodeInputBytes(state.message, state.inputEncoding)
        if (state.mode === "sign") {
          const signatureBytes = await signMessage({ messageBytes, state, privateKeyText: keySelection.privateKey })
          const encoded = encodeSignatureBytes(signatureBytes, state.signatureEncoding)
          if (runRef.current !== runId) return
          setOutput(encoded)
          setVerificationStatus(null)
        } else {
          const signatureBytes = decodeSignatureBytes(state.signature, state.signatureEncoding)
          const valid = await verifyMessage({
            messageBytes,
            signatureBytes,
            state,
            publicKeyText: keySelection.publicKey,
            privateKeyText: keySelection.privateKey,
          })
          if (runRef.current !== runId) return
          setVerificationStatus(valid)
          setOutput("")
        }
        setError(null)
      } catch (err) {
        if (runRef.current !== runId) return
        setError(err instanceof Error ? err.message : "Failed to process signature.")
        setOutput("")
        setVerificationStatus(null)
      } finally {
        if (runRef.current === runId) {
          setIsWorking(false)
        }
      }
    }

    run()
  }, [state, fileName, fileVersion, keySelection])

  const handleCopyOutput = async () => {
    await navigator.clipboard.writeText(output)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const handleDownloadOutput = () => {
    const blob = new Blob([output], { type: "text/plain" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = `signature.${state.signatureEncoding === "hex" ? "hex" : "txt"}`
    a.click()
    URL.revokeObjectURL(url)
  }

  const handleUploadClick = () => {
    fileInputRef.current?.click()
  }

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = () => {
      const buffer = reader.result
      if (!(buffer instanceof ArrayBuffer)) return
      fileBytesRef.current = new Uint8Array(buffer)
      setFileName(file.name)
      setFileMeta({ name: file.name, size: file.size })
      setFileVersion((prev) => prev + 1)
    }
    reader.readAsArrayBuffer(file)
  }

  const handleClearFile = () => {
    fileBytesRef.current = null
    setFileName(null)
    setFileMeta(null)
    if (fileInputRef.current) fileInputRef.current.value = ""
  }

  const handleClearAll = React.useCallback(() => {
    runRef.current += 1
    resetToDefaults()
    setFileName(null)
    setFileMeta(null)
    fileBytesRef.current = null
    if (fileInputRef.current) fileInputRef.current.value = ""
    setFileVersion(0)
    setOutput("")
    setVerificationStatus(null)
    setError(null)
    setIsWorking(false)
    setCopied(false)
  }, [resetToDefaults, setFileName])

  const handleGenerateKey = () => {
    try {
      const bytes = randomBytes(hmacDefaultLength)
      const encoded =
        state.hmacKeyEncoding === "utf8"
          ? randomAsciiString(hmacDefaultLength)
          : state.hmacKeyEncoding === "hex"
          ? encodeHex(bytes, { upperCase: false })
          : encodeBase64(bytes, { urlSafe: false, padding: true })
      setParam("hmacKey", encoded)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to generate a key.")
    }
  }

  const handleKeyUploadClick = (type: "private" | "public") => {
    if (type === "private") {
      privateKeyInputRef.current?.click()
    } else {
      publicKeyInputRef.current?.click()
    }
  }

  const handleKeyFileUpload = (type: "private" | "public", event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = () => {
      const result = reader.result
      if (typeof result !== "string") return
      const fields = getKeyFields(state.algorithm)
      setParam(type === "private" ? fields.privateKey : fields.publicKey, result)
    }
    reader.readAsText(file)
  }

  const handleGenerateKeypair = async () => {
    try {
      setIsGeneratingKeys(true)
      setError(null)
      const { publicPem, privatePem } = await generateKeypair(state)
      const fields = getKeyFields(state.algorithm)
      setParam(fields.publicKey, publicPem)
      setParam(fields.privateKey, privatePem)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to generate keypair.")
    } finally {
      setIsGeneratingKeys(false)
    }
  }

  const inputWarning =
    state.inputEncoding === "binary" && !fileName ? "Binary input requires a file upload." : null
  const inputEncodingOptions: InputEncoding[] = fileName ? ["binary"] : ["utf8", "base64", "hex"]
  const hmacDefaultLength = React.useMemo(() => getHmacKeyLength(state.hmacHash), [state.hmacHash])
  const hmacKeyWarning = React.useMemo(() => {
    if (!state.hmacKey.trim()) return null
    try {
      const bytes = decodeKeyBytes(state.hmacKey, state.hmacKeyEncoding)
      if (bytes.length < hmacDefaultLength) {
        return {
          message: `Key length is ${bytes.length} bytes; recommended at least ${hmacDefaultLength} bytes for ${state.hmacHash}.`,
          tone: "warning" as const,
        }
      }
      return null
    } catch {
      return { message: "Key encoding is invalid.", tone: "error" as const }
    }
  }, [state.hmacKey, state.hmacKeyEncoding, state.hmacHash, hmacDefaultLength])

  const showHmac = state.algorithm === "hmac"
  const showRsa = state.algorithm === "rsa"
  const showEcdsa = state.algorithm === "ecdsa"
  const showEddsa = state.algorithm === "eddsa"

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Tabs value={state.mode} onValueChange={(value) => setParam("mode", value as ModeValue, true)}>
          <TabsList>
            <TabsTrigger value="sign" className="px-5 text-base">
              Sign
            </TabsTrigger>
            <TabsTrigger value="verify" className="px-5 text-base">
              Verify
            </TabsTrigger>
          </TabsList>
        </Tabs>
        <Button variant="ghost" size="sm" onClick={handleClearAll} className="h-8 px-3 text-sm">
          Clear
        </Button>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="flex flex-col gap-4">
          <div className="flex flex-wrap items-center gap-3">
            <Label className="w-20 text-sm sm:w-28">Algorithm</Label>
            <Tabs value={state.algorithm} onValueChange={(value) => setParam("algorithm", value as AlgorithmValue, true)}>
              <ScrollableTabsList>
                {algorithmValues.map((value) => (
                  <TabsTrigger key={value} value={value} className="text-xs">
                    {algorithmLabels[value]}
                  </TabsTrigger>
                ))}
              </ScrollableTabsList>
            </Tabs>
          </div>

          {showHmac && (
            <div className="space-y-3">
              <div className="flex items-center gap-3">
                <Label className="w-20 text-sm sm:w-28">Hash</Label>
                <Tabs value={state.hmacHash} onValueChange={(value) => setParam("hmacHash", value as HmacHash, true)}>
                  <ScrollableTabsList>
                    {hmacHashes.map((hash) => (
                      <TabsTrigger key={hash} value={hash} className="text-xs">
                        {hash}
                      </TabsTrigger>
                    ))}
                  </ScrollableTabsList>
                </Tabs>
              </div>
              <div className="flex items-center gap-3">
                <Label className="w-20 text-sm sm:w-28">Key</Label>
                <div className="flex min-w-0 flex-1 flex-col gap-2">
                  <Tabs
                    value={state.hmacKeyEncoding}
                    onValueChange={(value) => setParam("hmacKeyEncoding", value as KeyEncoding, true)}
                  >
                    <TabsList className="h-7">
                      <TabsTrigger value="utf8" className="text-[10px] sm:text-xs px-2">
                        {encodingLabels.utf8}
                      </TabsTrigger>
                      <TabsTrigger value="base64" className="text-[10px] sm:text-xs px-2">
                        {encodingLabels.base64}
                      </TabsTrigger>
                      <TabsTrigger value="hex" className="text-[10px] sm:text-xs px-2">
                        {encodingLabels.hex}
                      </TabsTrigger>
                    </TabsList>
                  </Tabs>
                  <div className="relative min-w-0 flex-1">
                    <Input
                      value={state.hmacKey}
                      onChange={(event) => setParam("hmacKey", event.target.value)}
                      placeholder="Enter secret key..."
                      className={cn(
                        "h-9 min-w-0 pr-10 font-mono text-sm",
                        oversizeKeys.includes("hmacKey") && "border-destructive",
                      )}
                    />
                    <div className="absolute right-1 top-1/2 -translate-y-1/2">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={handleGenerateKey}
                        className="h-7 w-7 p-0"
                        aria-label="Generate key"
                      >
                        <RefreshCcw className="h-3 w-3" />
                      </Button>
                    </div>
                  </div>
                </div>
              </div>
              {oversizeKeys.includes("hmacKey") && (
                <div className="flex items-start gap-3">
                  <div className="w-20 sm:w-28" />
                  <p className="text-xs text-muted-foreground">Key exceeds 2 KB and is not synced to the URL.</p>
                </div>
              )}
              {hmacKeyWarning && (
                <div className="flex items-start gap-3">
                  <div className="w-20 sm:w-28" />
                  <p className={cn("text-xs", hmacKeyWarning.tone === "error" ? "text-destructive" : "text-muted-foreground")}>
                    {hmacKeyWarning.message}
                  </p>
                </div>
              )}
            </div>
          )}

          {showRsa && (
            <div className="space-y-3">
              <div className="flex items-center gap-3">
                <Label className="w-20 text-sm sm:w-28">Scheme</Label>
                <Tabs value={state.rsaScheme} onValueChange={(value) => setParam("rsaScheme", value as RsaScheme, true)}>
                  <TabsList className="h-8">
                    {rsaSchemes.map((scheme) => (
                      <TabsTrigger key={scheme} value={scheme} className="text-xs">
                        {scheme}
                      </TabsTrigger>
                    ))}
                  </TabsList>
                </Tabs>
              </div>
              <div className="flex items-center gap-3">
                <Label className="w-20 text-sm sm:w-28">Hash</Label>
                <Tabs value={state.rsaHash} onValueChange={(value) => setParam("rsaHash", value as RsaHash, true)}>
                  <ScrollableTabsList>
                    {rsaHashes.map((hash) => (
                      <TabsTrigger key={hash} value={hash} className="text-xs">
                        {hash}
                      </TabsTrigger>
                    ))}
                  </ScrollableTabsList>
                </Tabs>
              </div>
              {state.rsaScheme === "RSA-PSS" && (
                <div className="flex items-center gap-3">
                  <Label className="w-20 text-sm sm:w-28">Salt Length</Label>
                  <Input
                    type="number"
                    min={0}
                    max={1024}
                    value={state.rsaSaltLength}
                    onChange={(event) => {
                      const value = Number.parseInt(event.target.value, 10)
                      setParam("rsaSaltLength", Number.isNaN(value) ? 0 : value, true)
                    }}
                    className="h-9 w-28"
                  />
                  <span className="text-xs text-muted-foreground">
                    0 = {getRsaSaltLength(state.rsaHash, 0)} bytes
                  </span>
                </div>
              )}
            </div>
          )}

          {showEcdsa && (
            <div className="space-y-3">
              <div className="flex items-center gap-3">
                <Label className="w-20 text-sm sm:w-28">Curve</Label>
                <Tabs value={state.ecdsaCurve} onValueChange={(value) => setParam("ecdsaCurve", value as EcdsaCurve, true)}>
                  <ScrollableTabsList>
                    {ecdsaCurves.map((curve) => (
                      <TabsTrigger key={curve} value={curve} className="text-xs">
                        {curve}
                      </TabsTrigger>
                    ))}
                  </ScrollableTabsList>
                </Tabs>
              </div>
              <div className="flex items-center gap-3">
                <Label className="w-20 text-sm sm:w-28">Hash</Label>
                <Tabs value={state.ecdsaHash} onValueChange={(value) => setParam("ecdsaHash", value as EcdsaHash, true)}>
                  <ScrollableTabsList>
                    {ecdsaHashes.map((hash) => (
                      <TabsTrigger key={hash} value={hash} className="text-xs">
                        {hash}
                      </TabsTrigger>
                    ))}
                  </ScrollableTabsList>
                </Tabs>
              </div>
            </div>
          )}

          {showEddsa && (
            <div className="flex items-center gap-3">
              <Label className="w-20 text-sm sm:w-28">Curve</Label>
              <Tabs value={state.eddsaCurve} onValueChange={(value) => setParam("eddsaCurve", value as EddsaCurve, true)}>
                <TabsList className="h-8">
                  {eddsaCurves.map((curve) => (
                    <TabsTrigger key={curve} value={curve} className="text-xs">
                      {curve}
                    </TabsTrigger>
                  ))}
                </TabsList>
              </Tabs>
            </div>
          )}

          {!showHmac && (
            <div className="space-y-3">
              {state.mode === "sign" ? (
                <div className="flex items-start gap-3">
                  <Label className="w-20 text-sm sm:w-28 pt-2">Private Key</Label>
                  <div className="min-w-0 flex-1">
                    <Textarea
                      value={keySelection.privateKey}
                      onChange={(event) => setParam(getKeyFields(state.algorithm).privateKey, event.target.value)}
                      placeholder="-----BEGIN PRIVATE KEY-----"
                      className={cn(
                        "min-h-[160px] font-mono text-xs",
                        oversizeKeys.includes(getKeyFields(state.algorithm).privateKey) && "border-destructive",
                      )}
                    />
                    <div className="mt-2 flex items-center justify-between gap-2">
                      <p className="text-xs text-muted-foreground">PEM (PKCS8) or JWK</p>
                      <div className="flex items-center gap-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleKeyUploadClick("private")}
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
                    {oversizeKeys.includes(getKeyFields(state.algorithm).privateKey) && (
                      <p className="text-xs text-muted-foreground">
                        Private key exceeds 2 KB and is not synced to the URL.
                      </p>
                    )}
                  </div>
                </div>
              ) : (
                <div className="flex items-start gap-3">
                  <Label className="w-20 text-sm sm:w-28 pt-2">Public Key</Label>
                  <div className="min-w-0 flex-1">
                    <Textarea
                      value={keySelection.publicKey}
                      onChange={(event) => setParam(getKeyFields(state.algorithm).publicKey, event.target.value)}
                      placeholder="-----BEGIN PUBLIC KEY-----"
                      className={cn(
                        "min-h-[160px] font-mono text-xs",
                        oversizeKeys.includes(getKeyFields(state.algorithm).publicKey) && "border-destructive",
                      )}
                    />
                    <div className="mt-2 flex items-center justify-between gap-2">
                      <p className="text-xs text-muted-foreground">PEM (SPKI) or JWK</p>
                      <div className="flex items-center gap-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleKeyUploadClick("public")}
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
                    {oversizeKeys.includes(getKeyFields(state.algorithm).publicKey) && (
                      <p className="text-xs text-muted-foreground">
                        Public key exceeds 2 KB and is not synced to the URL.
                      </p>
                    )}
                  </div>
                </div>
              )}
              <input
                ref={privateKeyInputRef}
                type="file"
                onChange={(event) => handleKeyFileUpload("private", event)}
                className="hidden"
              />
              <input
                ref={publicKeyInputRef}
                type="file"
                onChange={(event) => handleKeyFileUpload("public", event)}
                className="hidden"
              />
            </div>
          )}
        </div>

        <div className="flex flex-col gap-4">
          <div className="space-y-2">
            <div className="flex items-center gap-3">
              <Label className="text-sm">Message</Label>
              <Tabs
                value={state.inputEncoding}
                onValueChange={(value) => setParam("inputEncoding", value as InputEncoding, true)}
                className="min-w-0 flex-1"
              >
                <ScrollableTabsList>
                  {inputEncodingOptions.map((encoding) => (
                    <TabsTrigger key={encoding} value={encoding} className="text-xs flex-none">
                      {encodingLabels[encoding]}
                    </TabsTrigger>
                  ))}
                </ScrollableTabsList>
              </Tabs>
              <Button variant="ghost" size="sm" onClick={handleUploadClick} className="h-7 gap-1 px-2 text-xs">
                <Upload className="h-3 w-3" />
                Upload
              </Button>
            </div>
            <div className="relative">
              <Textarea
                value={state.message}
                onChange={(event) => setParam("message", event.target.value)}
                placeholder="Enter message to sign or verify..."
                className={cn(
                  "max-h-[320px] min-h-[200px] overflow-auto overflow-x-hidden break-all whitespace-pre-wrap font-mono text-sm",
                  oversizeKeys.includes("message") && "border-destructive",
                )}
              />
              {fileName && (
                <div className="absolute inset-0 flex items-center justify-center gap-3 rounded-md border bg-background/95 text-sm text-muted-foreground">
                  <span className="max-w-[70%] truncate font-medium text-foreground">
                    {fileMeta?.name ?? fileName}
                  </span>
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
            <input ref={fileInputRef} type="file" onChange={handleFileUpload} className="hidden" />
            {oversizeKeys.includes("message") && (
              <p className="text-xs text-muted-foreground">Message exceeds 2 KB and is not synced to the URL.</p>
            )}
            {inputWarning && <p className="text-xs text-muted-foreground">{inputWarning}</p>}
          </div>

          {state.mode === "verify" && (
            <div className="space-y-2">
              <div className="flex items-center gap-3">
                <Label className="text-sm">Signature</Label>
                <Tabs
                  value={state.signatureEncoding}
                  onValueChange={(value) => setParam("signatureEncoding", value as SignatureEncoding, true)}
                  className="min-w-0 flex-1"
                >
                  <ScrollableTabsList>
                    {signatureEncodings.map((encoding) => (
                      <TabsTrigger key={encoding} value={encoding} className="text-xs flex-none">
                        {encodingLabels[encoding]}
                      </TabsTrigger>
                    ))}
                  </ScrollableTabsList>
                </Tabs>
              </div>
              <Textarea
                value={state.signature}
                onChange={(event) => setParam("signature", event.target.value)}
                placeholder="Paste signature to verify..."
                className={cn(
                  "max-h-[200px] min-h-[160px] overflow-auto overflow-x-hidden break-all whitespace-pre-wrap font-mono text-sm",
                  oversizeKeys.includes("signature") && "border-destructive",
                )}
              />
              {oversizeKeys.includes("signature") && (
                <p className="text-xs text-muted-foreground">Signature exceeds 2 KB and is not synced to the URL.</p>
              )}
              <div className="rounded-md border p-4">
                <div className="flex items-center justify-between">
                  <Label className="text-sm font-medium">Verification Result</Label>
                  {verificationStatus !== null && (
                    <Badge variant={verificationStatus ? "default" : "destructive"}>
                      {verificationStatus ? "Valid" : "Invalid"}
                    </Badge>
                  )}
                </div>
                {verificationStatus === null ? (
                  <p className="text-sm text-muted-foreground">Provide a message and signature to verify.</p>
                ) : verificationStatus ? (
                  <p className="text-sm text-emerald-600">Signature matches the message.</p>
                ) : (
                  <p className="text-sm text-destructive">Signature does not match the message.</p>
                )}
              </div>
            </div>
          )}

          {state.mode === "sign" && (
            <div className="space-y-2">
              <div className="flex items-center gap-3">
                <Label className="text-sm">Signature</Label>
                <Tabs
                  value={state.signatureEncoding}
                  onValueChange={(value) => setParam("signatureEncoding", value as SignatureEncoding, true)}
                  className="min-w-0 flex-1"
                >
                  <ScrollableTabsList>
                    {signatureEncodings.map((encoding) => (
                      <TabsTrigger key={encoding} value={encoding} className="text-xs flex-none">
                        {encodingLabels[encoding]}
                      </TabsTrigger>
                    ))}
                  </ScrollableTabsList>
                </Tabs>
                <div className="flex shrink-0 items-center gap-1">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleCopyOutput}
                    className="h-7 w-7 p-0"
                    aria-label="Copy signature"
                    disabled={!output}
                  >
                    {copied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleDownloadOutput}
                    className="h-7 w-7 p-0"
                    aria-label="Download signature"
                    disabled={!output}
                  >
                    <Download className="h-3 w-3" />
                  </Button>
                </div>
              </div>
              <Textarea
                value={output}
                readOnly
                placeholder="Signature will appear here..."
                className="max-h-[320px] min-h-[200px] overflow-auto overflow-x-hidden break-all whitespace-pre-wrap font-mono text-sm"
              />
            </div>
          )}

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
  )
}
