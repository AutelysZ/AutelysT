"use client"

import * as React from "react"
import { Suspense } from "react"
import { z } from "zod"
import { AlertCircle, Check, Copy, RefreshCcw, Upload } from "lucide-react"
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
import type { HistoryEntry } from "@/lib/history/db"
import { cn } from "@/lib/utils"

const modeValues = ["encrypt", "decrypt"] as const

type ModeValue = (typeof modeValues)[number]

const messageEncodings = ["utf8", "base64", "hex"] as const
const cipherEncodings = ["base64", "base64url", "hex"] as const
const rsaHashes = ["SHA-1", "SHA-256", "SHA-384", "SHA-512"] as const

type MessageEncoding = (typeof messageEncodings)[number]
type CipherEncoding = (typeof cipherEncodings)[number]
type RsaHash = (typeof rsaHashes)[number]

const paramsSchema = z.object({
  mode: z.enum(modeValues).default("encrypt"),
  input: z.string().default(""),
  messageEncoding: z.enum(messageEncodings).default("utf8"),
  cipherEncoding: z.enum(cipherEncodings).default("base64"),
  rsaHash: z.enum(rsaHashes).default("SHA-256"),
  rsaModulusLength: z.coerce.number().int().min(1024).max(16384).default(2048),
  rsaPublicExponent: z.string().default("65537"),
  publicKey: z.string().default(""),
  privateKey: z.string().default(""),
})

type AsymmetricState = z.infer<typeof paramsSchema>

const encodingLabels = {
  utf8: "UTF-8",
  base64: "Base64",
  base64url: "Base64url",
  hex: "Hex",
} as const

const textEncoder = new TextEncoder()
const textDecoder = new TextDecoder()

function decodeMessageBytes(value: string, encoding: MessageEncoding): Uint8Array<ArrayBuffer> {
  if (!value) return new Uint8Array()
  if (encoding === "utf8") return textEncoder.encode(value) as Uint8Array<ArrayBuffer>
  if (encoding === "hex") return decodeHex(value)
  return decodeBase64(value)
}

function encodeMessageBytes(bytes: Uint8Array, encoding: MessageEncoding) {
  if (encoding === "utf8") return textDecoder.decode(bytes)
  if (encoding === "hex") return encodeHex(bytes, { upperCase: false })
  return encodeBase64(bytes, { urlSafe: false, padding: true })
}

function decodeCipherBytes(value: string, encoding: CipherEncoding): Uint8Array<ArrayBuffer> {
  if (!value) return new Uint8Array()
  if (encoding === "hex") return decodeHex(value)
  return decodeBase64(value)
}

function encodeCipherBytes(bytes: Uint8Array, encoding: CipherEncoding) {
  if (encoding === "hex") return encodeHex(bytes, { upperCase: false })
  if (encoding === "base64") return encodeBase64(bytes, { urlSafe: false, padding: true })
  return encodeBase64(bytes, { urlSafe: true, padding: false })
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

function getHashByteLength(hash: RsaHash) {
  if (hash === "SHA-1") return 20
  if (hash === "SHA-384") return 48
  if (hash === "SHA-512") return 64
  return 32
}

function getMaxMessageBytes(modulusLength: number, hash: RsaHash) {
  const modulusBytes = Math.floor(modulusLength / 8)
  const hashBytes = getHashByteLength(hash)
  return Math.max(0, modulusBytes - 2 * hashBytes - 2)
}

async function importRsaKey({
  keyText,
  mode,
  hash,
}: {
  keyText: string
  mode: "encrypt" | "decrypt"
  hash: RsaHash
}) {
  const jwk = parseJwk(keyText)
  const algorithm = { name: "RSA-OAEP", hash: { name: hash } }
  if (jwk) {
    if (mode === "encrypt" && "d" in jwk) return null
    if (mode === "decrypt" && !("d" in jwk)) return null
    try {
      return await crypto.subtle.importKey("jwk", jwk, algorithm, false, [mode])
    } catch {
      return null
    }
  }
  const parsed = pemToArrayBuffer(keyText)
  if (!parsed) return null
  if (mode === "encrypt" && !parsed.label.includes("PUBLIC KEY")) return null
  if (mode === "decrypt" && !parsed.label.includes("PRIVATE KEY")) return null
  const format = parsed.label.includes("PRIVATE KEY") ? "pkcs8" : "spki"
  try {
    return await crypto.subtle.importKey(format, parsed.buffer, algorithm, false, [mode])
  } catch {
    return null
  }
}

async function generateKeypair(state: AsymmetricState) {
  if (!globalThis.crypto?.subtle) {
    throw new Error("Web Crypto is unavailable in this environment.")
  }
  const exponent = parseExponent(state.rsaPublicExponent)
  if (!exponent) {
    throw new Error("Invalid RSA public exponent.")
  }
  const algorithm = {
    name: "RSA-OAEP",
    modulusLength: state.rsaModulusLength,
    publicExponent: exponent,
    hash: { name: state.rsaHash },
  }
  const keyPair = await crypto.subtle.generateKey(algorithm, true, ["encrypt", "decrypt"])
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

export default function AsymmetricEncryptionPage() {
  return (
    <Suspense fallback={null}>
      <AsymmetricEncryptionContent />
    </Suspense>
  )
}

function AsymmetricEncryptionContent() {
  const { state, setParam, oversizeKeys, hasUrlParams, hydrationSource, resetToDefaults } = useUrlSyncedState(
    "asymmetric-encryption",
    {
      schema: paramsSchema,
      defaults: paramsSchema.parse({}),
    },
  )

  const handleLoadHistory = React.useCallback(
    (entry: HistoryEntry) => {
      const { inputs, params } = entry
      if (inputs.input !== undefined) setParam("input", inputs.input)
      const typedParams = params as Partial<AsymmetricState>
      ;(Object.keys(paramsSchema.shape) as (keyof AsymmetricState)[]).forEach((key) => {
        if (typedParams[key] !== undefined) {
          setParam(key, typedParams[key] as AsymmetricState[typeof key])
        }
      })
    },
    [setParam],
  )

  return (
    <ToolPageWrapper
      toolId="asymmetric-encryption"
      title="Asymmetric Encryption"
      description="Encrypt and decrypt messages with RSA-OAEP using PEM/JWK keys."
      onLoadHistory={handleLoadHistory}
    >
      <AsymmetricEncryptionInner
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

function AsymmetricEncryptionInner({
  state,
  setParam,
  oversizeKeys,
  hasUrlParams,
  hydrationSource,
  resetToDefaults,
}: {
  state: AsymmetricState
  setParam: <K extends keyof AsymmetricState>(key: K, value: AsymmetricState[K], immediate?: boolean) => void
  oversizeKeys: (keyof AsymmetricState)[]
  hasUrlParams: boolean
  hydrationSource: "default" | "url" | "history"
  resetToDefaults: () => void
}) {
  const { upsertInputEntry, upsertParams } = useToolHistoryContext()
  const [output, setOutput] = React.useState("")
  const [error, setError] = React.useState<string | null>(null)
  const [isWorking, setIsWorking] = React.useState(false)
  const [copied, setCopied] = React.useState(false)
  const [isGeneratingKeys, setIsGeneratingKeys] = React.useState(false)
  const publicKeyInputRef = React.useRef<HTMLInputElement>(null)
  const privateKeyInputRef = React.useRef<HTMLInputElement>(null)
  const lastInputRef = React.useRef<string>("")
  const hasHydratedInputRef = React.useRef(false)
  const hasHandledUrlRef = React.useRef(false)
  const runRef = React.useRef(0)
  const paramsRef = React.useRef({
    mode: state.mode,
    messageEncoding: state.messageEncoding,
    cipherEncoding: state.cipherEncoding,
    rsaHash: state.rsaHash,
    rsaModulusLength: state.rsaModulusLength,
    rsaPublicExponent: state.rsaPublicExponent,
    publicKey: state.publicKey,
    privateKey: state.privateKey,
  })
  const hasInitializedParamsRef = React.useRef(false)

  const historyParams = React.useMemo(
    () => ({
      mode: state.mode,
      messageEncoding: state.messageEncoding,
      cipherEncoding: state.cipherEncoding,
      rsaHash: state.rsaHash,
      rsaModulusLength: state.rsaModulusLength,
      rsaPublicExponent: state.rsaPublicExponent,
      publicKey: state.publicKey,
      privateKey: state.privateKey,
    }),
    [
      state.mode,
      state.messageEncoding,
      state.cipherEncoding,
      state.rsaHash,
      state.rsaModulusLength,
      state.rsaPublicExponent,
      state.publicKey,
      state.privateKey,
    ],
  )

  React.useEffect(() => {
    if (hasHydratedInputRef.current) return
    if (hydrationSource === "default") return
    lastInputRef.current = state.input
    hasHydratedInputRef.current = true
  }, [hydrationSource, state.input])

  React.useEffect(() => {
    if (!state.input || state.input === lastInputRef.current) return

    const timer = setTimeout(() => {
      lastInputRef.current = state.input
      upsertInputEntry({ input: state.input }, historyParams, "left", state.input.slice(0, 100))
    }, DEFAULT_URL_SYNC_DEBOUNCE_MS)

    return () => clearTimeout(timer)
  }, [state.input, historyParams, upsertInputEntry])

  React.useEffect(() => {
    if (hasUrlParams && !hasHandledUrlRef.current) {
      hasHandledUrlRef.current = true
      if (state.input) {
        upsertInputEntry({ input: state.input }, historyParams, "left", state.input.slice(0, 100))
      } else {
        upsertParams(historyParams, "interpretation")
      }
    }
  }, [hasUrlParams, state.input, historyParams, upsertInputEntry, upsertParams])

  React.useEffect(() => {
    const nextParams = historyParams
    if (!hasInitializedParamsRef.current) {
      hasInitializedParamsRef.current = true
      paramsRef.current = nextParams
      return
    }
    if (
      paramsRef.current.mode === nextParams.mode &&
      paramsRef.current.messageEncoding === nextParams.messageEncoding &&
      paramsRef.current.cipherEncoding === nextParams.cipherEncoding &&
      paramsRef.current.rsaHash === nextParams.rsaHash &&
      paramsRef.current.rsaModulusLength === nextParams.rsaModulusLength &&
      paramsRef.current.rsaPublicExponent === nextParams.rsaPublicExponent &&
      paramsRef.current.publicKey === nextParams.publicKey &&
      paramsRef.current.privateKey === nextParams.privateKey
    ) {
      return
    }
    paramsRef.current = nextParams
    upsertParams(nextParams, "interpretation")
  }, [historyParams, upsertParams])

  const maxMessageBytes = React.useMemo(
    () => getMaxMessageBytes(state.rsaModulusLength, state.rsaHash),
    [state.rsaModulusLength, state.rsaHash],
  )

  const messageByteLength = React.useMemo(() => {
    if (state.mode !== "encrypt" || !state.input.trim()) return null
    try {
      return decodeMessageBytes(state.input, state.messageEncoding).length
    } catch {
      return null
    }
  }, [state.input, state.messageEncoding, state.mode])

  const messageLimitWarning =
    state.mode === "encrypt" && messageByteLength !== null && messageByteLength > maxMessageBytes

  React.useEffect(() => {
    if (!state.input.trim()) {
      setOutput("")
      setError(null)
      setIsWorking(false)
      return
    }

    const runId = ++runRef.current
    setIsWorking(true)
    setError(null)

    const run = async () => {
      try {
        if (!globalThis.crypto?.subtle) {
          throw new Error("Web Crypto is unavailable in this environment.")
        }
        if (state.mode === "encrypt") {
          const messageBytes = decodeMessageBytes(state.input, state.messageEncoding)
          if (messageBytes.length > maxMessageBytes) {
            throw new Error(
              `Message length ${messageBytes.length} bytes exceeds max ${maxMessageBytes} bytes for RSA-OAEP (${state.rsaHash}).`,
            )
          }
          const keyText = state.publicKey.trim()
          if (!keyText) {
            throw new Error("Public key is required to encrypt.")
          }
          const key = await importRsaKey({ keyText, mode: "encrypt", hash: state.rsaHash })
          if (!key) {
            throw new Error("Invalid public key format. Use SPKI PEM or JWK.")
          }
          const cipherBuffer = await crypto.subtle.encrypt({ name: "RSA-OAEP" }, key, messageBytes)
          const cipherBytes = new Uint8Array(cipherBuffer)
          const encoded = encodeCipherBytes(cipherBytes, state.cipherEncoding)
          if (runRef.current !== runId) return
          setOutput(encoded)
        } else {
          const cipherBytes = decodeCipherBytes(state.input, state.cipherEncoding)
          const keyText = state.privateKey.trim()
          if (!keyText) {
            throw new Error("Private key is required to decrypt.")
          }
          const key = await importRsaKey({ keyText, mode: "decrypt", hash: state.rsaHash })
          if (!key) {
            throw new Error("Invalid private key format. Use PKCS8 PEM or JWK.")
          }
          const plainBuffer = await crypto.subtle.decrypt({ name: "RSA-OAEP" }, key, cipherBytes)
          const plainBytes = new Uint8Array(plainBuffer)
          const decoded = encodeMessageBytes(plainBytes, state.messageEncoding)
          if (runRef.current !== runId) return
          setOutput(decoded)
        }
        setError(null)
      } catch (err) {
        if (runRef.current !== runId) return
        setError(err instanceof Error ? err.message : "Failed to process encryption.")
        setOutput("")
      } finally {
        if (runRef.current === runId) {
          setIsWorking(false)
        }
      }
    }

    run()
  }, [
    state.mode,
    state.input,
    state.messageEncoding,
    state.cipherEncoding,
    state.publicKey,
    state.privateKey,
    state.rsaHash,
    maxMessageBytes,
  ])

  const handleCopyOutput = async () => {
    if (!output) return
    await navigator.clipboard.writeText(output)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const handleKeyUploadClick = (type: "public" | "private") => {
    if (type === "public") {
      publicKeyInputRef.current?.click()
    } else {
      privateKeyInputRef.current?.click()
    }
  }

  const handleKeyFileUpload = (type: "public" | "private", event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = () => {
      const result = reader.result
      if (typeof result !== "string") return
      setParam(type === "public" ? "publicKey" : "privateKey", result)
    }
    reader.readAsText(file)
  }

  const handleGenerateKeypair = async () => {
    try {
      setIsGeneratingKeys(true)
      setError(null)
      const { publicPem, privatePem } = await generateKeypair(state)
      setParam("publicKey", publicPem)
      setParam("privateKey", privatePem)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to generate keypair.")
    } finally {
      setIsGeneratingKeys(false)
    }
  }

  const handleClearAll = React.useCallback(() => {
    runRef.current += 1
    resetToDefaults()
    setOutput("")
    setError(null)
    setIsWorking(false)
    setCopied(false)
  }, [resetToDefaults])

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Tabs value={state.mode} onValueChange={(value) => setParam("mode", value as ModeValue, true)}>
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
          <div className="flex items-center gap-3">
            <Label className="w-20 text-sm sm:w-28">Algorithm</Label>
            <span className="text-sm font-medium">RSA-OAEP</span>
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

          <div className="flex items-start gap-3">
            <Label className="w-20 text-sm sm:w-28 pt-2">{state.mode === "encrypt" ? "Public Key" : "Private Key"}</Label>
            <div className="min-w-0 flex-1">
              <Textarea
                value={state.mode === "encrypt" ? state.publicKey : state.privateKey}
                onChange={(event) =>
                  setParam(state.mode === "encrypt" ? "publicKey" : "privateKey", event.target.value)
                }
                placeholder={state.mode === "encrypt" ? "-----BEGIN PUBLIC KEY-----" : "-----BEGIN PRIVATE KEY-----"}
                rows={10}
                className={cn(
                  "min-h-[160px] max-h-[240px] overflow-auto break-all font-mono text-xs",
                  oversizeKeys.includes(state.mode === "encrypt" ? "publicKey" : "privateKey") && "border-destructive",
                )}
              />
              <div className="mt-2 flex items-center justify-between gap-2">
                <p className="text-xs text-muted-foreground">
                  {state.mode === "encrypt" ? "PEM (SPKI) or JWK" : "PEM (PKCS8) or JWK"}
                </p>
                <div className="flex items-center gap-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleKeyUploadClick(state.mode === "encrypt" ? "public" : "private")}
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
              {oversizeKeys.includes(state.mode === "encrypt" ? "publicKey" : "privateKey") && (
                <p className="text-xs text-muted-foreground">
                  {state.mode === "encrypt" ? "Public" : "Private"} key exceeds 2 KB and is not synced to the URL.
                </p>
              )}
            </div>
          </div>
          <input
            ref={publicKeyInputRef}
            type="file"
            onChange={(event) => handleKeyFileUpload("public", event)}
            className="hidden"
          />
          <input
            ref={privateKeyInputRef}
            type="file"
            onChange={(event) => handleKeyFileUpload("private", event)}
            className="hidden"
          />
        </div>

        <div className="flex flex-col gap-4">
          <div className="space-y-2">
            <div className="flex items-center gap-3">
              <Label className="text-sm">{state.mode === "encrypt" ? "Message" : "Ciphertext"}</Label>
              <Tabs
                value={state.mode === "encrypt" ? state.messageEncoding : state.cipherEncoding}
                onValueChange={(value) => {
                  if (state.mode === "encrypt") {
                    setParam("messageEncoding", value as MessageEncoding, true)
                  } else {
                    setParam("cipherEncoding", value as CipherEncoding, true)
                  }
                }}
                className="min-w-0 flex-1"
              >
                <ScrollableTabsList>
                  {(state.mode === "encrypt" ? messageEncodings : cipherEncodings).map((encoding) => (
                    <TabsTrigger key={encoding} value={encoding} className="text-xs flex-none">
                      {encodingLabels[encoding]}
                    </TabsTrigger>
                  ))}
                </ScrollableTabsList>
              </Tabs>
            </div>
            <Textarea
              value={state.input}
              onChange={(event) => setParam("input", event.target.value)}
              placeholder={state.mode === "encrypt" ? "Enter message to encrypt..." : "Paste ciphertext to decrypt..."}
              className={cn(
                "max-h-[320px] min-h-[200px] overflow-auto overflow-x-hidden break-all whitespace-pre-wrap font-mono text-sm",
                oversizeKeys.includes("input") && "border-destructive",
              )}
            />
            {oversizeKeys.includes("input") && (
              <p className="text-xs text-muted-foreground">Input exceeds 2 KB and is not synced to the URL.</p>
            )}
            {state.mode === "encrypt" && (
              <p
                className={cn(
                  "text-xs",
                  messageLimitWarning ? "text-destructive" : "text-muted-foreground",
                )}
              >
                Max message size: {maxMessageBytes} bytes for RSA-OAEP ({state.rsaHash}).
              </p>
            )}
          </div>

          <div className="space-y-2">
            <div className="flex items-center gap-3">
              <Label className="text-sm">{state.mode === "encrypt" ? "Ciphertext" : "Message"}</Label>
              <Tabs
                value={state.mode === "encrypt" ? state.cipherEncoding : state.messageEncoding}
                onValueChange={(value) => {
                  if (state.mode === "encrypt") {
                    setParam("cipherEncoding", value as CipherEncoding, true)
                  } else {
                    setParam("messageEncoding", value as MessageEncoding, true)
                  }
                }}
                className="min-w-0 flex-1"
              >
                <ScrollableTabsList>
                  {(state.mode === "encrypt" ? cipherEncodings : messageEncodings).map((encoding) => (
                    <TabsTrigger key={encoding} value={encoding} className="text-xs flex-none">
                      {encodingLabels[encoding]}
                    </TabsTrigger>
                  ))}
                </ScrollableTabsList>
              </Tabs>
              <Button
                variant="ghost"
                size="sm"
                onClick={handleCopyOutput}
                className="h-7 w-7 p-0"
                aria-label="Copy output"
                disabled={!output}
              >
                {copied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
              </Button>
            </div>
            <Textarea
              value={output}
              readOnly
              placeholder={state.mode === "encrypt" ? "Ciphertext will appear here..." : "Message will appear here..."}
              className="max-h-[320px] min-h-[200px] overflow-auto overflow-x-hidden break-all whitespace-pre-wrap font-mono text-sm"
            />
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
  )
}
