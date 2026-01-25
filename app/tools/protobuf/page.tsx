"use client"

import * as React from "react"
import { Suspense } from "react"
import { z } from "zod"
import {
  AlertCircle,
  ArrowLeftRight,
  ChevronsUpDown,
  Copy,
  Check,
  Download,
  Upload,
  X,
  FileCode,
  Trash2,
  Sparkles,
} from "lucide-react"
import { ToolPageWrapper, useToolHistoryContext } from "@/components/tool-ui/tool-page-wrapper"
import { DEFAULT_URL_SYNC_DEBOUNCE_MS, useUrlSyncedState } from "@/lib/url-state/use-url-synced-state"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { Button } from "@/components/ui/button"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import type { HistoryEntry } from "@/lib/history/db"
import { cn } from "@/lib/utils"
import { ProtoEditor } from "./proto-editor"
import {
  type ProtoSchema,
  type ProtoMessage,
  decodeInputData,
  encodeOutputData,
  decodeProtobuf,
  encodeProtobuf,
  decodeProtobufWithoutSchema,
  decodeProtobufWithDetails,
  parseProtoFiles,
  validateJsonForProtobuf,
  validateYamlForProtobuf,
  objectToJson,
  objectToYaml,
  generateProtoFromDecodedFields,
  generateProtoFromObject,
  GENERATED_PROTO_FILENAME,
  GENERATED_PROTO_FULL_MESSAGE,
} from "@/lib/protobuf/codec"

// ============================================================================
// Schema & Constants
// ============================================================================

const inputEncodings = ["base64", "hex", "binary"] as const
type InputEncoding = (typeof inputEncodings)[number]

const outputEncodings = ["binary", "base64", "base64url", "hex"] as const
type OutputEncoding = (typeof outputEncodings)[number]

const inputFormats = ["json", "yaml"] as const
type InputFormat = (typeof inputFormats)[number]

const outputFormats = ["json", "yaml"] as const
type OutputFormat = (typeof outputFormats)[number]

const paramsSchema = z.object({
  mode: z.enum(["decode", "encode"]).default("decode"),
  input: z.string().default(""),
  inputEncoding: z.enum(inputEncodings).default("base64"),
  inputFormat: z.enum(inputFormats).default("json"),
  outputEncoding: z.enum(outputEncodings).default("base64"),
  outputFormat: z.enum(outputFormats).default("json"),
  messageName: z.string().default(""),
})

type ParamsState = z.infer<typeof paramsSchema>

// ============================================================================
// Main Page Component
// ============================================================================

export default function ProtobufCodecPage() {
  return (
    <Suspense fallback={null}>
      <ProtobufCodecContent />
    </Suspense>
  )
}

function ProtobufCodecContent() {
  const { state, setParam, oversizeKeys, hasUrlParams, hydrationSource, resetToDefaults } =
    useUrlSyncedState("protobuf", {
      schema: paramsSchema,
      defaults: paramsSchema.parse({}),
    })

  const [fileName, setFileName] = React.useState<string | null>(null)
  const [protoFiles, setProtoFiles] = React.useState<{ id: string; name: string; content: string }[]>([])
  const [protoSchema, setProtoSchema] = React.useState<ProtoSchema | null>(null)
  const [availableMessages, setAvailableMessages] = React.useState<ProtoMessage[]>([])
  const [schemaError, setSchemaError] = React.useState<string | null>(null)

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

  // Parse proto files when they change
  React.useEffect(() => {
    if (protoFiles.length > 0) {
      const filesForParsing = protoFiles.map((file) => ({
        name: file.name,
        content: file.content,
      }))

      parseProtoFiles(filesForParsing)
        .then((schema) => {
          setProtoSchema(schema)
          const messages = schema.files.flatMap((file) => file.messages)
          setAvailableMessages(messages)
          setSchemaError(null)

          // Auto-select first message if none selected
          if (!state.messageName && messages.length > 0) {
            setParam("messageName", messages[0].fullName)
          }
        })
        .catch((error) => {
          setProtoSchema(null)
          setAvailableMessages([])
          setSchemaError(error instanceof Error ? error.message : String(error))
        })
    } else {
      setProtoSchema(null)
      setAvailableMessages([])
      setSchemaError(null)
    }
  }, [protoFiles, state.messageName, setParam])

  return (
    <ToolPageWrapper
      toolId="protobuf"
      title="Protobuf"
      description="Encode and decode Protocol Buffers with schema support and smart type detection."
      onLoadHistory={handleLoadHistory}
    >
      <ProtobufCodecInner
        state={state}
        setParam={setParam}
        oversizeKeys={oversizeKeys}
        resetToDefaults={resetToDefaults}
        fileName={fileName}
        setFileName={setFileName}
        protoFiles={protoFiles}
        setProtoFiles={setProtoFiles}
        protoSchema={protoSchema}
        availableMessages={availableMessages}
        schemaError={schemaError}
      />
    </ToolPageWrapper>
  )
}

// ============================================================================
// Inner Component
// ============================================================================

function ProtobufCodecInner({
  state,
  setParam,
  oversizeKeys,
  resetToDefaults,
  fileName,
  setFileName,
  protoFiles,
  setProtoFiles,
  protoSchema,
  availableMessages,
  schemaError,
}: {
  state: ParamsState
  setParam: <K extends keyof ParamsState>(key: K, value: ParamsState[K], immediate?: boolean) => void
  oversizeKeys: (keyof ParamsState)[]
  resetToDefaults: () => void
  fileName: string | null
  setFileName: React.Dispatch<React.SetStateAction<string | null>>
  protoFiles: { id: string; name: string; content: string }[]
  setProtoFiles: React.Dispatch<React.SetStateAction<{ id: string; name: string; content: string }[]>>
  protoSchema: ProtoSchema | null
  availableMessages: ProtoMessage[]
  schemaError: string | null
}) {
  const { upsertInputEntry, clearHistory } = useToolHistoryContext()

  // Local state
  const [output, setOutput] = React.useState("")
  const [error, setError] = React.useState<string | null>(null)
  const [isWorking, setIsWorking] = React.useState(false)
  const [binaryMeta, setBinaryMeta] = React.useState<{ name: string; size: number } | null>(null)
  const [copied, setCopied] = React.useState(false)

  // Refs
  const fileInputRef = React.useRef<HTMLInputElement | null>(null)
  const [fileVersion, setFileVersion] = React.useState(0)
  const lastInputRef = React.useRef<string>("")
  const hasHydratedInputRef = React.useRef(false)
  const fileBytesRef = React.useRef<Uint8Array | null>(null)
  const outputBytesRef = React.useRef<Uint8Array | null>(null)
  const lastGeneratedProtoRef = React.useRef<string>("")

  // History tracking
  const hydrationSource = "default" // Simplified for this component

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

          let decoded: unknown

          if (protoSchema && state.messageName) {
            // Schema-based decoding with .proto files
            decoded = await decodeProtobuf(inputData, protoSchema, state.messageName)
          } else {
            // Schema-less decoding with detailed field info
            decoded = decodeProtobufWithoutSchema(inputData)
          }

          // Auto-generate/update generated.proto file
          // Only generate when: no proto files exist OR selected message is generated.GeneratedMessage
          const details = decodeProtobufWithDetails(inputData)
          const shouldGenerateProto =
            details.length > 0 &&
            (protoFiles.length === 0 || state.messageName === GENERATED_PROTO_FULL_MESSAGE)

          if (shouldGenerateProto) {
            const generatedProto = generateProtoFromDecodedFields(details)

            if (generatedProto !== lastGeneratedProtoRef.current) {
              lastGeneratedProtoRef.current = generatedProto
              const existingGenerated = protoFiles.find(
                (f) => f.name === GENERATED_PROTO_FILENAME
              )

              if (existingGenerated) {
                // Update existing generated.proto
                setProtoFiles(
                  protoFiles.map((f) =>
                    f.name === GENERATED_PROTO_FILENAME
                      ? { ...f, content: generatedProto }
                      : f
                  )
                )
              } else {
                // Create new generated.proto
                setProtoFiles([
                  ...protoFiles,
                  {
                    id: "generated_" + Date.now(),
                    name: GENERATED_PROTO_FILENAME,
                    content: generatedProto,
                  },
                ])
              }
            }
          }

          const outputText =
            state.outputFormat === "json" ? objectToJson(decoded) : objectToYaml(decoded)

          result = { text: outputText }
        } else {
          // Encode mode
          let inputData: unknown

          if (state.inputFormat === "json") {
            const validation = validateJsonForProtobuf(state.input)
            if (!validation.isValid) {
              throw new Error(`Invalid JSON: ${validation.error}`)
            }
            inputData = validation.parsed
          } else {
            const validation = validateYamlForProtobuf(state.input)
            if (!validation.isValid) {
              throw new Error(`Invalid YAML: ${validation.error}`)
            }
            inputData = validation.parsed
          }

          // Auto-generate/update generated.proto file
          // Only generate when: no proto files exist OR selected message is generated.GeneratedMessage
          const shouldGenerateProto =
            protoFiles.length === 0 || state.messageName === GENERATED_PROTO_FULL_MESSAGE

          if (shouldGenerateProto) {
            const generatedProto = generateProtoFromObject(
              inputData as Record<string, unknown>
            )

            if (generatedProto !== lastGeneratedProtoRef.current) {
              lastGeneratedProtoRef.current = generatedProto
              const existingGenerated = protoFiles.find(
                (f) => f.name === GENERATED_PROTO_FILENAME
              )

              if (existingGenerated) {
                // Update existing generated.proto
                setProtoFiles(
                  protoFiles.map((f) =>
                    f.name === GENERATED_PROTO_FILENAME
                      ? { ...f, content: generatedProto }
                      : f
                  )
                )
              } else {
                // Create new generated.proto
                setProtoFiles([
                  ...protoFiles,
                  {
                    id: "generated_encode_" + Date.now(),
                    name: GENERATED_PROTO_FILENAME,
                    content: generatedProto,
                  },
                ])
              }
            }
          }

          // Auto-select GeneratedMessage if available and not already selected
          const hasGeneratedMessage = availableMessages.some(
            (m) => m.fullName === GENERATED_PROTO_FULL_MESSAGE
          )
          if (hasGeneratedMessage && state.messageName !== GENERATED_PROTO_FULL_MESSAGE) {
            setParam("messageName", GENERATED_PROTO_FULL_MESSAGE, true)
            return // Wait for next render with correct message
          }

          // Wait for schema to be parsed if not ready
          if (!protoSchema || !state.messageName) {
            setError(null)
            setOutput("")
            return
          }

          let encoded: Uint8Array

          // Schema-based encoding with .proto files
          encoded = await encodeProtobuf(
            inputData as Record<string, unknown>,
            protoSchema,
            state.messageName
          )

          result = encodeOutputData(encoded, state.outputEncoding)
        }

        if (result.binary) {
          outputBytesRef.current = result.binary
          setBinaryMeta({ name: "output.bin", size: result.binary.length })
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
    state.messageName,
    protoSchema,
    protoFiles,
    availableMessages,
    fileName,
    fileVersion,
    setProtoFiles,
    setParam,
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
    // Clear history for this tool so it doesn't restore on refresh
    await clearHistory("tool")
    // Reset URL state to defaults
    resetToDefaults()
    // Clear URL completely to ensure clean state on refresh
    if (typeof window !== "undefined") {
      window.history.replaceState({}, "", window.location.pathname)
    }
    // Clear local state
    setFileName(null)
    fileBytesRef.current = null
    outputBytesRef.current = null
    lastGeneratedProtoRef.current = ""
    if (fileInputRef.current) fileInputRef.current.value = ""
    setFileVersion(0)
    setOutput("")
    setError(null)
    setIsWorking(false)
    setBinaryMeta(null)
    setCopied(false)
    setProtoFiles([])
  }, [clearHistory, resetToDefaults, setFileName, setProtoFiles])

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
      const blob = new Blob([outputBytesRef.current as Uint8Array<ArrayBuffer>], { type: "application/octet-stream" })
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

    // Clear file input if any
    if (hasFile) {
      handleClearFile()
    }

    // Swap content: output becomes new input
    const newInput = output

    if (newMode === "encode") {
      // Decode -> Encode: output (JSON/YAML) becomes input
      setParam("inputFormat", state.outputFormat as InputFormat, true)
      // Keep protobuf encoding: use current input encoding as output encoding
      // If input was a file, use binary output
      setParam("outputEncoding", hasFile ? "binary" : state.inputEncoding, true)

      // Ensure the generated message is selected for encoding
      if (!state.messageName && availableMessages.length > 0) {
        setParam("messageName", availableMessages[0].fullName, true)
      }
    } else {
      // Encode -> Decode: output (base64/hex) becomes input
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
  }, [state.mode, state.outputFormat, state.outputEncoding, state.inputFormat, state.inputEncoding, state.messageName, output, fileName, availableMessages, handleClearFile, setParam])

  // Generate proto from current input
  const handleGenerateProto = React.useCallback(() => {
    const hasFile = Boolean(fileName && fileBytesRef.current)
    const hasInputText = Boolean(state.input.trim())

    if (!hasInputText && !hasFile) {
      return
    }

    try {
      let generatedProto: string

      if (state.mode === "decode") {
        let inputData: Uint8Array

        if (hasFile) {
          inputData = fileBytesRef.current!
        } else {
          inputData = decodeInputData(state.input, state.inputEncoding)
        }

        const details = decodeProtobufWithDetails(inputData)
        if (details.length === 0) {
          return
        }
        generatedProto = generateProtoFromDecodedFields(details)
      } else {
        let inputData: unknown

        if (state.inputFormat === "json") {
          const validation = validateJsonForProtobuf(state.input)
          if (!validation.isValid) {
            return
          }
          inputData = validation.parsed
        } else {
          const validation = validateYamlForProtobuf(state.input)
          if (!validation.isValid) {
            return
          }
          inputData = validation.parsed
        }

        generatedProto = generateProtoFromObject(inputData as Record<string, unknown>)
      }

      lastGeneratedProtoRef.current = generatedProto
      const existingGenerated = protoFiles.find(
        (f) => f.name === GENERATED_PROTO_FILENAME
      )

      if (existingGenerated) {
        // Update existing generated.proto
        setProtoFiles(
          protoFiles.map((f) =>
            f.name === GENERATED_PROTO_FILENAME
              ? { ...f, content: generatedProto }
              : f
          )
        )
      } else {
        // Create new generated.proto
        setProtoFiles([
          ...protoFiles,
          {
            id: "generated_" + Date.now(),
            name: GENERATED_PROTO_FILENAME,
            content: generatedProto,
          },
        ])
      }

      // Auto-select GeneratedMessage
      setParam("messageName", GENERATED_PROTO_FULL_MESSAGE, true)
    } catch {
      // Ignore errors during manual generation
    }
  }, [state.mode, state.input, state.inputEncoding, state.inputFormat, fileName, protoFiles, setProtoFiles, setParam])

  const inputWarning = oversizeKeys.includes("input")
    ? "Input exceeds 2 KB and is not synced to URL."
    : null

  const hasProtoSchema = protoFiles.length > 0 && protoSchema !== null
  const selectedMessage = availableMessages.find(
    (m) => m.fullName === state.messageName || m.name === state.messageName
  )

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
              {state.mode === "decode" ? "Protobuf Data" : "Data to Encode"}
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
                  ? "Paste Base64/Hex encoded protobuf data or upload a file..."
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

      {/* Proto Schema */}
      <Card>
        <CardHeader className="flex flex-row items-center gap-3 space-y-0 px-4 py-2">
          <CardTitle className="text-sm font-medium">Proto Schema</CardTitle>
          {hasProtoSchema && availableMessages.length > 0 && (
            <MessageSelector
              messages={availableMessages}
              value={state.messageName}
              onChange={(value) => setParam("messageName", value, true)}
            />
          )}
          <Button
            variant="outline"
            size="sm"
            onClick={handleGenerateProto}
            disabled={!state.input.trim() && !fileName}
            className="h-7 gap-1.5 px-2 text-xs"
            title="Generate proto from current input"
          >
            <Sparkles className="h-3 w-3" />
            Generate
          </Button>
        </CardHeader>
        <CardContent className="p-0">
          {schemaError && (
            <Alert variant="destructive" className="mx-4 mb-2 py-2">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription className="text-xs">{schemaError}</AlertDescription>
            </Alert>
          )}
          <ProtoEditor files={protoFiles} onFilesChange={setProtoFiles} />
        </CardContent>
      </Card>

    </div>
  )
}

// ============================================================================
// Message Selector Component
// ============================================================================

function MessageSelector({
  messages,
  value,
  onChange,
}: {
  messages: ProtoMessage[]
  value: string
  onChange: (value: string) => void
}) {
  const [open, setOpen] = React.useState(false)
  const selectedMessage = messages.find((m) => m.fullName === value || m.name === value)

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className="h-7 w-[200px] justify-between px-2 text-xs"
        >
          <span className="truncate">
            {selectedMessage ? selectedMessage.fullName : "Select message..."}
          </span>
          <ChevronsUpDown className="ml-1 h-3 w-3 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[280px] p-0" align="end">
        <Command>
          <CommandInput placeholder="Search message..." className="h-8 text-xs" />
          <CommandList>
            <CommandEmpty>No message found.</CommandEmpty>
            <CommandGroup>
              {messages.map((msg) => (
                <CommandItem
                  key={msg.fullName}
                  value={msg.fullName}
                  onSelect={() => {
                    onChange(msg.fullName)
                    setOpen(false)
                  }}
                  className="text-xs"
                >
                  <Check
                    className={cn(
                      "mr-2 h-3 w-3",
                      value === msg.fullName ? "opacity-100" : "opacity-0"
                    )}
                  />
                  <div className="flex flex-col">
                    <span className="font-medium">{msg.fullName}</span>
                    <span className="text-muted-foreground">
                      {msg.fields.length} field{msg.fields.length !== 1 ? "s" : ""}
                    </span>
                  </div>
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  )
}
