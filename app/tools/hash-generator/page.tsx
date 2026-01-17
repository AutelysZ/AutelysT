"use client"

import * as React from "react"
import { Suspense } from "react"
import { z } from "zod"
import { Upload, Copy, Check, AlertCircle, X } from "lucide-react"
import { ToolPageWrapper, useToolHistoryContext } from "@/components/tool-ui/tool-page-wrapper"
import { DEFAULT_URL_SYNC_DEBOUNCE_MS, useUrlSyncedState } from "@/lib/url-state/use-url-synced-state"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { Button } from "@/components/ui/button"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { SearchableSelect } from "@/components/ui/searchable-select"
import { decodeBase64, encodeBase64 } from "@/lib/encoding/base64"
import { decodeHex, encodeHex } from "@/lib/encoding/hex"
import type { HistoryEntry } from "@/lib/history/db"
import { cn } from "@/lib/utils"

const inputEncodings = ["utf8", "base64", "hex"] as const
type InputEncoding = (typeof inputEncodings)[number]
const outputEncodings = ["hex", "base64", "base64url"] as const
type OutputEncoding = (typeof outputEncodings)[number]

const algorithmValues = [
  "sha256",
  "sha384",
  "sha512",
  "sha3-224",
  "sha3-256",
  "sha3-384",
  "sha3-512",
  "blake2b-256",
  "blake2b-512",
  "blake2s-256",
  "blake3-256",
  "sha1",
  "md5",
  "md4",
  "md2",
] as const

type HashAlgorithm = (typeof algorithmValues)[number]

const paramsSchema = z.object({
  input: z.string().default(""),
  inputEncoding: z.enum(inputEncodings).default("utf8"),
  outputEncoding: z.enum(outputEncodings).default("hex"),
  algorithm: z.enum(algorithmValues).default("sha256"),
})

const algorithmLabels: Record<HashAlgorithm, string> = {
  sha256: "SHA-256",
  sha384: "SHA-384",
  sha512: "SHA-512",
  "sha3-224": "SHA3-224",
  "sha3-256": "SHA3-256",
  "sha3-384": "SHA3-384",
  "sha3-512": "SHA3-512",
  "blake2b-256": "BLAKE2b-256",
  "blake2b-512": "BLAKE2b-512",
  "blake2s-256": "BLAKE2s-256",
  "blake3-256": "BLAKE3-256",
  sha1: "SHA-1",
  md5: "MD5",
  md4: "MD4",
  md2: "MD2",
}

const expectedHexLength: Record<HashAlgorithm, number> = {
  sha256: 64,
  sha384: 96,
  sha512: 128,
  "sha3-224": 56,
  "sha3-256": 64,
  "sha3-384": 96,
  "sha3-512": 128,
  "blake2b-256": 64,
  "blake2b-512": 128,
  "blake2s-256": 64,
  "blake3-256": 64,
  sha1: 40,
  md2: 32,
  md4: 32,
  md5: 32,
}

type HashWasmModule = {
  createMD2: () => Promise<{ init: () => void; update: (data: Uint8Array) => void; digest: (encoding?: "hex" | "binary") => string | Uint8Array }>
  createMD4: () => Promise<{ init: () => void; update: (data: Uint8Array) => void; digest: (encoding?: "hex" | "binary") => string | Uint8Array }>
  createMD5: () => Promise<{ init: () => void; update: (data: Uint8Array) => void; digest: (encoding?: "hex" | "binary") => string | Uint8Array }>
  createSHA1: () => Promise<{ init: () => void; update: (data: Uint8Array) => void; digest: (encoding?: "hex" | "binary") => string | Uint8Array }>
  createSHA256: () => Promise<{ init: () => void; update: (data: Uint8Array) => void; digest: (encoding?: "hex" | "binary") => string | Uint8Array }>
  createSHA384: () => Promise<{ init: () => void; update: (data: Uint8Array) => void; digest: (encoding?: "hex" | "binary") => string | Uint8Array }>
  createSHA512: () => Promise<{ init: () => void; update: (data: Uint8Array) => void; digest: (encoding?: "hex" | "binary") => string | Uint8Array }>
  createSHA3: (
    bits: 224 | 256 | 384 | 512,
  ) => Promise<{ init: () => void; update: (data: Uint8Array) => void; digest: (encoding?: "hex" | "binary") => string | Uint8Array }>
  createBLAKE2b: (
    outputLength: number,
  ) => Promise<{ init: () => void; update: (data: Uint8Array) => void; digest: (encoding?: "hex" | "binary") => string | Uint8Array }>
  createBLAKE2s: (
    outputLength: number,
  ) => Promise<{ init: () => void; update: (data: Uint8Array) => void; digest: (encoding?: "hex" | "binary") => string | Uint8Array }>
  createBLAKE3: (
    outputLength: number,
  ) => Promise<{ init: () => void; update: (data: Uint8Array) => void; digest: (encoding?: "hex" | "binary") => string | Uint8Array }>
}

function parseInputBytes(value: string, encoding: InputEncoding) {
  if (!value) return new Uint8Array()
  if (encoding === "utf8") {
    return new TextEncoder().encode(value)
  }
  if (encoding === "base64") {
    return decodeBase64(value)
  }
  if (encoding === "hex") {
    return decodeHex(value)
  }
  return new Uint8Array()
}

async function createHasher(algorithm: HashAlgorithm) {
  const hashWasm = (await import("hash-wasm")) as unknown as HashWasmModule

  switch (algorithm) {
    case "md2":
      return hashWasm.createMD2()
    case "md4":
      return hashWasm.createMD4()
    case "md5":
      return hashWasm.createMD5()
    case "sha1":
      return hashWasm.createSHA1()
    case "sha256":
      return hashWasm.createSHA256()
    case "sha384":
      return hashWasm.createSHA384()
    case "sha512":
      return hashWasm.createSHA512()
    case "sha3-224":
      return hashWasm.createSHA3(224)
    case "sha3-256":
      return hashWasm.createSHA3(256)
    case "sha3-384":
      return hashWasm.createSHA3(384)
    case "sha3-512":
      return hashWasm.createSHA3(512)
    case "blake2b-256":
      return hashWasm.createBLAKE2b(256)
    case "blake2b-512":
      return hashWasm.createBLAKE2b(512)
    case "blake2s-256":
      return hashWasm.createBLAKE2s(256)
    case "blake3-256":
      return hashWasm.createBLAKE3(256)
    default:
      return hashWasm.createSHA256()
  }
}

export default function HashPage() {
  return (
    <Suspense fallback={null}>
      <HashContent />
    </Suspense>
  )
}

function HashContent() {
  const { state, setParam, oversizeKeys, hasUrlParams, hydrationSource } = useUrlSyncedState("hash-generator", {
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
      if (params.inputEncoding) setParam("inputEncoding", params.inputEncoding as InputEncoding)
      if (params.outputEncoding) setParam("outputEncoding", params.outputEncoding as OutputEncoding)
      if (params.algorithm) setParam("algorithm", params.algorithm as HashAlgorithm)
    },
    [setParam, setFileName],
  )

  return (
    <ToolPageWrapper
      toolId="hash-generator"
      title="Hash"
      description="Generate cryptographic digests for text or uploaded files."
      onLoadHistory={handleLoadHistory}
    >
      <HashInner
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

function HashInner({
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
    fileName,
  })
  const hasInitializedParamsRef = React.useRef(false)
  const hasHandledUrlRef = React.useRef(false)
  const hashRunRef = React.useRef(0)
  const fileBytesRef = React.useRef<Uint8Array | null>(null)
  const [fileVersion, setFileVersion] = React.useState(0)

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
        { inputEncoding: state.inputEncoding, outputEncoding: state.outputEncoding, algorithm: state.algorithm, fileName },
        "left",
        preview,
      )
    }, DEFAULT_URL_SYNC_DEBOUNCE_MS)

    return () => clearTimeout(timer)
  }, [state.input, state.inputEncoding, state.outputEncoding, state.algorithm, fileName, fileVersion, upsertInputEntry])

  React.useEffect(() => {
    if (hasUrlParams && !hasHandledUrlRef.current) {
      hasHandledUrlRef.current = true
      const activeText = state.input
      if (activeText) {
        upsertInputEntry(
          { input: state.input },
          { inputEncoding: state.inputEncoding, outputEncoding: state.outputEncoding, algorithm: state.algorithm, fileName },
          "left",
          activeText.slice(0, 100),
        )
      } else {
        upsertParams(
          { inputEncoding: state.inputEncoding, outputEncoding: state.outputEncoding, algorithm: state.algorithm, fileName },
          "interpretation",
        )
      }
    }
  }, [hasUrlParams, state.input, state.inputEncoding, state.outputEncoding, state.algorithm, fileName, upsertInputEntry, upsertParams])

  React.useEffect(() => {
    const nextParams = {
      inputEncoding: state.inputEncoding,
      outputEncoding: state.outputEncoding,
      algorithm: state.algorithm,
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
      paramsRef.current.fileName === nextParams.fileName
    ) {
      return
    }
    paramsRef.current = nextParams
    upsertParams(nextParams, "interpretation")
  }, [state.inputEncoding, state.outputEncoding, state.algorithm, fileName, upsertParams])

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
        const hasher = await createHasher(state.algorithm)
        hasher.init()
        hasher.update(bytes)
        const digestBytes = hasher.digest("binary")
        const digestArray = digestBytes instanceof Uint8Array ? digestBytes : new TextEncoder().encode(digestBytes)
        let normalized = ""
        if (state.outputEncoding === "hex") {
          normalized = encodeHex(digestArray, { upperCase: false })
          const expected = expectedHexLength[state.algorithm]
          if (normalized.length < expected) {
            normalized = normalized.padStart(expected, "0")
          }
        } else if (state.outputEncoding === "base64") {
          normalized = encodeBase64(digestArray, { padding: true, urlSafe: false })
        } else {
          normalized = encodeBase64(digestArray, { padding: false, urlSafe: true })
        }
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
  }, [state.input, state.inputEncoding, state.outputEncoding, state.algorithm, fileName, fileVersion])

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

  return (
    <div className="flex h-full flex-col gap-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="flex items-center gap-3">
          <Label className="w-28 shrink-0 text-sm">Algorithm</Label>
          <div className="min-w-0 flex-1">
            <SearchableSelect
              value={state.algorithm}
              onValueChange={(value) => setParam("algorithm", value as HashAlgorithm, true)}
              options={algorithmValues.map((value) => ({ value, label: algorithmLabels[value] }))}
              placeholder="Select algorithm..."
              searchPlaceholder="Search algorithms..."
              triggerClassName="w-full"
            />
          </div>
        </div>
      </div>

      <div className="flex flex-col gap-4 md:flex-row">
        <div className="flex w-full flex-1 flex-col gap-2 md:w-0">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <Label className="text-sm font-medium">Input</Label>
              <Select
                value={state.inputEncoding}
                onValueChange={(value) => setParam("inputEncoding", value as InputEncoding, true)}
              >
                <SelectTrigger size="sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="utf8">UTF-8</SelectItem>
                  <SelectItem value="base64">Base64</SelectItem>
                  <SelectItem value="hex">Hex</SelectItem>
                </SelectContent>
              </Select>
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
                  onClick={() => {
                    setFileName(null)
                    fileBytesRef.current = null
                    setFileVersion(0)
                  }}
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
              <Select
                value={state.outputEncoding}
                onValueChange={(value) => setParam("outputEncoding", value as OutputEncoding, true)}
              >
                <SelectTrigger size="sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="hex">Hex</SelectItem>
                  <SelectItem value="base64">Base64</SelectItem>
                  <SelectItem value="base64url">Base64url</SelectItem>
                </SelectContent>
              </Select>
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
