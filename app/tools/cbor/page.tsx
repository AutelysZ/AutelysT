"use client"

import * as React from "react"
import { Suspense } from "react"
import { z } from "zod"
import {
  AlertCircle,
  ArrowLeftRight,
  Copy,
  Check,
  Download,
  Upload,
  X,
  FileCode,
  Trash2,
} from "lucide-react"
import { ToolPageWrapper, useToolHistoryContext } from "@/components/tool-ui/tool-page-wrapper"
import { DEFAULT_URL_SYNC_DEBOUNCE_MS, useUrlSyncedState } from "@/lib/url-state/use-url-synced-state"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { Button } from "@/components/ui/button"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import type { HistoryEntry } from "@/lib/history/db"
import {
  type InputEncoding,
  type OutputEncoding,
  type InputFormat,
  type OutputFormat,
  decodeInputData,
  encodeOutputData,
  encodeCbor,
  decodeCbor,
  decodeCborWithDetails,
  validateJsonForCbor,
  validateYamlForCbor,
  objectToJson,
  objectToYaml,
  type CborField,
} from "@/lib/cbor/codec"

// ============================================================================
// Schema & Constants
// ============================================================================

const inputEncodings = ["base64", "hex", "binary"] as const
const outputEncodings = ["binary", "base64", "base64url", "hex"] as const
const inputFormats = ["json", "yaml"] as const
const outputFormats = ["json", "yaml"] as const

const paramsSchema = z.object({
  mode: z.enum(["decode", "encode"]).default("decode"),
  input: z.string().default(""),
  inputEncoding: z.enum(inputEncodings).default("base64"),
  inputFormat: z.enum(inputFormats).default("json"),
  outputEncoding: z.enum(outputEncodings).default("base64"),
  outputFormat: z.enum(outputFormats).default("json"),
})

type ParamsState = z.infer<typeof paramsSchema>

// ============================================================================
// Main Page Component
// ============================================================================

export default function CborCodecPage() {
  return (
    <Suspense fallback={null}>
      <CborCodecContent />
    </Suspense>
  )
}

function CborCodecContent() {
  const { state, setParam, oversizeKeys, resetToDefaults } =
    useUrlSyncedState("cbor", {
      schema: paramsSchema,
      defaults: paramsSchema.parse({}),
    })

  const [fileName, setFileName] = React.useState<string | null>(null)

  const handleLoadHistory = React.useCallback(
    (entry: HistoryEntry) => {
      const { inputs, params } = entry
      if (params.fileName) {
        alert("This history entry contains an uploaded file and cannot be restored.")
        return
      }
      setFileName(null)
      if (inputs.input !== undefined) setParam("input", inputs.input)
      const typedParams = params as Partial<ParamsState>
      ;(Object.keys(paramsSchema.shape) as (keyof ParamsState)[]).forEach((key) => {
        if (typedParams[key] !== undefined) {
          setParam(key, typedParams[key] as ParamsState[typeof key])
        }
      })
    },
    [setParam]
  )

  return (
    <ToolPageWrapper
      toolId="cbor"
      title="CBOR"
      description="Encode and decode CBOR (Concise Binary Object Representation) with JSON/YAML conversion."
      onLoadHistory={handleLoadHistory}
    >
      <CborCodecInner
        state={state}
        setParam={setParam}
        oversizeKeys={oversizeKeys}
        resetToDefaults={resetToDefaults}
        fileName={fileName}
        setFileName={setFileName}
      />
    </ToolPageWrapper>
  )
}

// ============================================================================
// Inner Component
// ============================================================================

function CborCodecInner({
  state,
  setParam,
  oversizeKeys,
  resetToDefaults,
  fileName,
  setFileName,
}: {
  state: ParamsState
  setParam: <K extends keyof ParamsState>(key: K, value: ParamsState[K], immediate?: boolean) => void
  oversizeKeys: (keyof ParamsState)[]
  resetToDefaults: () => void
  fileName: string | null
  setFileName: React.Dispatch<React.SetStateAction<string | null>>
}) {
  const { upsertInputEntry, clearHistory } = useToolHistoryContext()

  // Local state
  const [output, setOutput] = React.useState("")
  const [error, setError] = React.useState<string | null>(null)
  const [isWorking, setIsWorking] = React.useState(false)
  const [binaryMeta, setBinaryMeta] = React.useState<{ name: string; size: number } | null>(null)
  const [copied, setCopied] = React.useState(false)
  const [decodedFields, setDecodedFields] = React.useState<CborField[]>([])

  // Refs
  const fileInputRef = React.useRef<HTMLInputElement | null>(null)
  const [fileVersion, setFileVersion] = React.useState(0)
  const lastInputRef = React.useRef<string>("")
  const hasHydratedInputRef = React.useRef(false)
  const fileBytesRef = React.useRef<Uint8Array | null>(null)
  const outputBytesRef = React.useRef<Uint8Array | null>(null)

  // History tracking
  const hydrationSource = "default"

  React.useEffect(() => {
    if (hasHydratedInputRef.current) return
    if (hydrationSource === "default") return
    lastInputRef.current = fileName ? `file:${fileName}:${fileVersion}` : `text:${state.input}`
    hasHydratedInputRef.current = true
  }, [state.input, fileName, fileVersion])

  React.useEffect(() => {
    const hasFile = Boolean(fileName && fileBytesRef.current && fileVersion)
    const signature = hasFile ? `file:${fileName}:${fileVersion}` : `text:${state.input}`
    if ((!state.input && !hasFile) || signature === lastInputRef.current) return
    const timer = setTimeout(() => {
      lastInputRef.current = signature
      const preview = fileName || state.input.slice(0, 100)
      upsertInputEntry({ input: fileName ? "" : state.input }, { ...state, fileName }, "left", preview)
    }, DEFAULT_URL_SYNC_DEBOUNCE_MS)
    return () => clearTimeout(timer)
  }, [state, fileName, fileVersion, upsertInputEntry])

  // Main processing effect
  React.useEffect(() => {
    const hasFile = Boolean(fileName && fileBytesRef.current && fileVersion)
    const hasInputText = Boolean(state.input.trim())

    if (!hasInputText && !hasFile) {
      setOutput("")
      setError(null)
      setIsWorking(false)
      setBinaryMeta(null)
      setDecodedFields([])
      outputBytesRef.current = null
      return
    }

    setIsWorking(true)

    void (async () => {
      try {
        let result: { text?: string; binary?: Uint8Array }

        if (state.mode === "decode") {
          let inputData: Uint8Array

          if (hasFile) {
            inputData = fileBytesRef.current!
          } else {
            inputData = decodeInputData(state.input, state.inputEncoding)
          }

          const decoded = decodeCbor(inputData)
          const details = decodeCborWithDetails(inputData)
          setDecodedFields(details)

          const outputText =
            state.outputFormat === "json" ? objectToJson(decoded) : objectToYaml(decoded)

          result = { text: outputText }
        } else {
          // Encode mode
          let inputData: unknown

          if (state.inputFormat === "json") {
            const validation = validateJsonForCbor(state.input)
            if (!validation.isValid) {
              throw new Error(`Invalid JSON: ${validation.error}`)
            }
            inputData = validation.parsed
          } else {
            const validation = validateYamlForCbor(state.input)
            if (!validation.isValid) {
              throw new Error(`Invalid YAML: ${validation.error}`)
            }
            inputData = validation.parsed
          }

          const encoded = encodeCbor(inputData)
          result = encodeOutputData(encoded, state.outputEncoding)
          setDecodedFields([])
        }

        if (result.binary) {
          outputBytesRef.current = result.binary
          setBinaryMeta({ name: "output.cbor", size: result.binary.length })
          setOutput("")
        } else {
          setOutput(result.text || "")
          setBinaryMeta(null)
          outputBytesRef.current = null
        }

        setError(null)
      } catch (err) {
        setOutput("")
        setBinaryMeta(null)
        outputBytesRef.current = null
        setDecodedFields([])
        setError(err instanceof Error ? err.message : "Failed to process input.")
      } finally {
        setIsWorking(false)
      }
    })()
  }, [
    state.mode,
    state.input,
    state.inputEncoding,
    state.inputFormat,
    state.outputEncoding,
    state.outputFormat,
    fileName,
    fileVersion,
  ])

  // Handlers
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
    [setParam, setFileName]
  )

  const handleClearFile = React.useCallback(() => {
    setFileName(null)
    fileBytesRef.current = null
    setFileVersion(0)
  }, [setFileName])

  const handleClearAll = React.useCallback(async () => {
    await clearHistory("tool")
    resetToDefaults()
    if (typeof window !== "undefined") {
      window.history.replaceState({}, "", window.location.pathname)
    }
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
    setDecodedFields([])
  }, [clearHistory, resetToDefaults, setFileName])

  const handleInputChange = (value: string) => {
    setParam("input", value)
    if (fileName || fileBytesRef.current) {
      handleClearFile()
    }
  }

  const handleCopyResult = async () => {
    if (!output) return
    await navigator.clipboard.writeText(output)
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }

  const handleDownloadOutput = React.useCallback(() => {
    if (binaryMeta && outputBytesRef.current) {
      const blob = new Blob([outputBytesRef.current], { type: "application/octet-stream" })
      const url = URL.createObjectURL(blob)
      const link = document.createElement("a")
      link.href = url
      link.download = binaryMeta.name
      link.click()
      setTimeout(() => URL.revokeObjectURL(url), 0)
    } else if (output) {
      const ext = state.outputFormat === "json" ? "json" : "yaml"
      const blob = new Blob([output], { type: "text/plain" })
      const url = URL.createObjectURL(blob)
      const link = document.createElement("a")
      link.href = url
      link.download = `result.${ext}`
      link.click()
      setTimeout(() => URL.revokeObjectURL(url), 0)
    }
  }, [binaryMeta, output, state.outputFormat])

  // Swap input/output and toggle mode
  const handleSwap = React.useCallback(() => {
    const newMode = state.mode === "decode" ? "encode" : "decode"
    const hasFile = Boolean(fileName || fileBytesRef.current)

    if (hasFile) {
      handleClearFile()
    }

    const newInput = output

    if (newMode === "encode") {
      setParam("inputFormat", state.outputFormat as InputFormat, true)
      setParam("outputEncoding", hasFile ? "binary" : state.inputEncoding, true)
    } else {
      if (state.outputEncoding === "binary") {
        setParam("inputEncoding", "base64", true)
      } else {
        setParam("inputEncoding", state.outputEncoding as InputEncoding, true)
      }
      setParam("outputFormat", state.inputFormat as OutputFormat, true)
    }

    setParam("input", newInput)
    setParam("mode", newMode, true)
    setOutput("")
    setError(null)
    setDecodedFields([])
  }, [state.mode, state.outputFormat, state.outputEncoding, state.inputFormat, state.inputEncoding, output, fileName, handleClearFile, setParam])

  const inputWarning = oversizeKeys.includes("input")
    ? "Input exceeds 2 KB and is not synced to URL."
    : null

  return (
    <div className="flex h-full flex-col gap-4">
      {/* Mode selector and actions */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Tabs
          value={state.mode}
          onValueChange={(value) => setParam("mode", value as "decode" | "encode", true)}
        >
          <TabsList>
            <TabsTrigger value="decode" className="px-6">
              Decode
            </TabsTrigger>
            <TabsTrigger value="encode" className="px-6">
              Encode
            </TabsTrigger>
          </TabsList>
        </Tabs>
        <Button variant="ghost" size="sm" onClick={handleClearAll} className="h-8 gap-1.5 px-3">
          <Trash2 className="h-3.5 w-3.5" />
          Clear All
        </Button>
      </div>

      {/* Main content area */}
      <div className="grid gap-4 lg:grid-cols-[1fr_auto_1fr]">
        {/* Left column: Input */}
        <div className="flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <Label className="text-sm font-medium">
              {state.mode === "decode" ? "CBOR Data" : "Data to Encode"}
            </Label>
            <div className="flex items-center gap-2">
              {state.mode === "decode" && (
                <Tabs
                  value={state.inputEncoding}
                  onValueChange={(v) => setParam("inputEncoding", v as InputEncoding, true)}
                >
                  <TabsList className="h-7">
                    <TabsTrigger value="base64" className="px-2 text-xs">
                      Base64
                    </TabsTrigger>
                    <TabsTrigger value="hex" className="px-2 text-xs">
                      Hex
                    </TabsTrigger>
                    <TabsTrigger value="binary" className="px-2 text-xs">
                      File
                    </TabsTrigger>
                  </TabsList>
                </Tabs>
              )}
              {state.mode === "encode" && (
                <Tabs
                  value={state.inputFormat}
                  onValueChange={(v) => setParam("inputFormat", v as InputFormat, true)}
                >
                  <TabsList className="h-7">
                    <TabsTrigger value="json" className="px-2 text-xs">
                      JSON
                    </TabsTrigger>
                    <TabsTrigger value="yaml" className="px-2 text-xs">
                      YAML
                    </TabsTrigger>
                  </TabsList>
                </Tabs>
              )}
              {state.mode === "decode" && (
                <>
                  <input
                    ref={fileInputRef}
                    type="file"
                    onChange={handleFileUpload}
                    className="hidden"
                  />
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => fileInputRef.current?.click()}
                    className="h-7 gap-1 px-2 text-xs"
                  >
                    <Upload className="h-3 w-3" />
                    Upload
                  </Button>
                </>
              )}
            </div>
          </div>

          <div className="relative">
            <Textarea
              value={state.input}
              onChange={(e) => handleInputChange(e.target.value)}
              readOnly={Boolean(fileName)}
              placeholder={
                state.mode === "decode"
                  ? "Paste Base64/Hex encoded CBOR data or upload a file..."
                  : "Enter JSON or YAML data to encode..."
              }
              className="min-h-[200px] font-mono text-sm"
            />
            {fileName && (
              <div className="absolute inset-0 flex items-center justify-center gap-3 rounded-md border bg-background/95">
                <FileCode className="h-5 w-5 text-muted-foreground" />
                <span className="max-w-[60%] truncate font-medium">{fileName}</span>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleClearFile}
                  className="h-7 w-7 p-0"
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            )}
          </div>

          {inputWarning && <p className="text-xs text-muted-foreground">{inputWarning}</p>}
        </div>

        {/* Swap button */}
        <div className="flex items-center justify-center">
          <Button
            variant="ghost"
            size="sm"
            onClick={handleSwap}
            disabled={!output}
            className="h-8 w-8 p-0"
            title="Swap input/output and toggle mode"
          >
            <ArrowLeftRight className="h-4 w-4" />
          </Button>
        </div>

        {/* Right column: Output */}
        <div className="flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <Label className="text-sm font-medium">Result</Label>
            <div className="flex items-center gap-2">
              {state.mode === "decode" && (
                <Tabs
                  value={state.outputFormat}
                  onValueChange={(v) => setParam("outputFormat", v as OutputFormat, true)}
                >
                  <TabsList className="h-7">
                    <TabsTrigger value="json" className="px-2 text-xs">
                      JSON
                    </TabsTrigger>
                    <TabsTrigger value="yaml" className="px-2 text-xs">
                      YAML
                    </TabsTrigger>
                  </TabsList>
                </Tabs>
              )}
              {state.mode === "encode" && (
                <Tabs
                  value={state.outputEncoding}
                  onValueChange={(v) => setParam("outputEncoding", v as OutputEncoding, true)}
                >
                  <TabsList className="h-7">
                    <TabsTrigger value="base64" className="px-2 text-xs">
                      Base64
                    </TabsTrigger>
                    <TabsTrigger value="hex" className="px-2 text-xs">
                      Hex
                    </TabsTrigger>
                    <TabsTrigger value="binary" className="px-2 text-xs">
                      Binary
                    </TabsTrigger>
                  </TabsList>
                </Tabs>
              )}
              <Button
                variant="ghost"
                size="sm"
                onClick={handleCopyResult}
                disabled={!output}
                className="h-7 w-7 p-0"
              >
                {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={handleDownloadOutput}
                disabled={!output && !binaryMeta}
                className="h-7 w-7 p-0"
              >
                <Download className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>

          <div className="relative">
            <Textarea
              value={output}
              readOnly
              placeholder={isWorking ? "Processing..." : "Result will appear here..."}
              className="min-h-[200px] font-mono text-sm"
            />
            {binaryMeta && state.mode === "encode" && state.outputEncoding === "binary" && (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 rounded-md border bg-background/95">
                <FileCode className="h-8 w-8 text-muted-foreground" />
                <div className="text-center">
                  <p className="font-medium">{binaryMeta.name}</p>
                  <p className="text-sm text-muted-foreground">{binaryMeta.size} bytes</p>
                </div>
                <Button variant="outline" size="sm" onClick={handleDownloadOutput} className="gap-1.5">
                  <Download className="h-3.5 w-3.5" />
                  Download
                </Button>
              </div>
            )}
          </div>

          {error && (
            <Alert variant="destructive" className="py-2">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription className="text-xs">{error}</AlertDescription>
            </Alert>
          )}
        </div>
      </div>

      {/* Type Details (only in decode mode) */}
      {state.mode === "decode" && decodedFields.length > 0 && (
        <Card>
          <CardHeader className="px-4 py-2">
            <CardTitle className="text-sm font-medium">Type Details</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="max-h-[300px] overflow-auto">
              <table className="w-full text-xs">
                <thead className="sticky top-0 bg-muted">
                  <tr>
                    <th className="px-4 py-2 text-left font-medium">Path</th>
                    <th className="px-4 py-2 text-left font-medium">Type</th>
                    <th className="px-4 py-2 text-left font-medium">Value</th>
                  </tr>
                </thead>
                <tbody>
                  {renderFields(decodedFields)}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}

function renderFields(fields: CborField[], depth = 0): React.ReactNode[] {
  const rows: React.ReactNode[] = []

  for (const field of fields) {
    rows.push(
      <tr key={field.path} className="border-t">
        <td className="px-4 py-1.5 font-mono" style={{ paddingLeft: `${depth * 16 + 16}px` }}>
          {field.path}
        </td>
        <td className="px-4 py-1.5 text-muted-foreground">{field.type}</td>
        <td className="max-w-[200px] truncate px-4 py-1.5 font-mono">
          {typeof field.value === "string" ? field.value : JSON.stringify(field.value)}
        </td>
      </tr>
    )

    if (field.children) {
      rows.push(...renderFields(field.children, depth + 1))
    }
  }

  return rows
}
