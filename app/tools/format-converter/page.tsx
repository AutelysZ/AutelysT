"use client"

import * as React from "react"
import { Suspense } from "react"
import { Upload, Copy, Check, Download, AlertCircle, ArrowRight } from "lucide-react"
import { z } from "zod"
import { ToolPageWrapper, useToolHistoryContext } from "@/components/tool-ui/tool-page-wrapper"
import { DEFAULT_URL_SYNC_DEBOUNCE_MS, useUrlSyncedState } from "@/lib/url-state/use-url-synced-state"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { detectFormat, parseInput, formatOutput, type FormatType } from "@/lib/data/format-converter"
import type { HistoryEntry } from "@/lib/history/db"
import { cn } from "@/lib/utils"

const FORMAT_OPTIONS: { value: FormatType; label: string; ext: string }[] = [
  { value: "json", label: "JSON", ext: ".json" },
  { value: "yaml", label: "YAML", ext: ".yaml" },
  { value: "toml", label: "TOML", ext: ".toml" },
]

const paramsSchema = z.object({
  input: z.string().default(""),
  inputFormat: z.enum(["json", "yaml", "toml"]).default("json"),
  outputFormat: z.enum(["json", "yaml", "toml"]).default("yaml"),
})

export default function FormatConverterPage() {
  return (
    <Suspense fallback={null}>
      <FormatConverterContent />
    </Suspense>
  )
}

function FormatConverterContent() {
  const { state, setParam, oversizeKeys, hasUrlParams, hydrationSource } = useUrlSyncedState("format-converter", {
    schema: paramsSchema,
    defaults: paramsSchema.parse({}),
  })
  const [fileName, setFileName] = React.useState<string | null>(null)

  const handleLoadHistory = React.useCallback((entry: HistoryEntry) => {
    const { inputs, params } = entry

    if (params.fileName) {
      alert("This history entry contains an uploaded file and cannot be restored. Only the file name was recorded.")
      return
    }

    if (inputs.input !== undefined) setParam("input", inputs.input)
    if (params.inputFormat) setParam("inputFormat", params.inputFormat as FormatType)
    if (params.outputFormat) setParam("outputFormat", params.outputFormat as FormatType)
  }, [setParam])

  return (
    <ToolPageWrapper
      toolId="format-converter"
      title="Format Converter"
      description="Convert between JSON, YAML, and TOML formats"
      onLoadHistory={handleLoadHistory}
    >
      <FormatConverterInner
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

function FormatConverterInner({
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
  setFileName: (v: string | null) => void
}) {
  const { upsertInputEntry, upsertParams } = useToolHistoryContext()
  const lastInputRef = React.useRef<string>("")
  const fileInputRef = React.useRef<HTMLInputElement>(null)
  const [copied, setCopied] = React.useState(false)
  const paramsRef = React.useRef({
    inputFormat: state.inputFormat,
    outputFormat: state.outputFormat,
    fileName,
  })
  const hasInitializedParamsRef = React.useRef(false)
  const hasHandledUrlRef = React.useRef(false)
  const hasHydratedInputRef = React.useRef(false)

  // Parse and convert
  const { output, error } = React.useMemo(() => {
    if (!state.input.trim()) {
      return { output: "", error: null }
    }

    try {
      const parsed = parseInput(state.input, state.inputFormat)
      const result = formatOutput(parsed, state.outputFormat)
      return { output: result, error: null }
    } catch (e) {
      return { output: "", error: (e as Error).message }
    }
  }, [state.input, state.inputFormat, state.outputFormat])

  // Auto-detect format on input change
  React.useEffect(() => {
    if (state.input.trim()) {
      const detected = detectFormat(state.input)
      if (detected && detected !== state.inputFormat) {
        setParam("inputFormat", detected, true)
      }
    }
  }, [state.input, state.inputFormat, setParam])

  React.useEffect(() => {
    if (hasHydratedInputRef.current) return
    if (hydrationSource === "default") return
    lastInputRef.current = state.input
    hasHydratedInputRef.current = true
  }, [hydrationSource, state.input])

  // Save history
  React.useEffect(() => {
    if (state.input === lastInputRef.current) return

    const timer = setTimeout(() => {
      lastInputRef.current = state.input
      upsertInputEntry(
        { input: fileName ? "" : state.input },
        { inputFormat: state.inputFormat, outputFormat: state.outputFormat, fileName },
        "input",
        fileName || `${state.inputFormat.toUpperCase()} → ${state.outputFormat.toUpperCase()}`,
      )
    }, DEFAULT_URL_SYNC_DEBOUNCE_MS)

    return () => clearTimeout(timer)
  }, [state.input, state.inputFormat, state.outputFormat, fileName, upsertInputEntry])

  React.useEffect(() => {
    if (hasUrlParams && !hasHandledUrlRef.current) {
      hasHandledUrlRef.current = true
      if (state.input) {
        upsertInputEntry(
          { input: fileName ? "" : state.input },
          { inputFormat: state.inputFormat, outputFormat: state.outputFormat, fileName },
          "input",
          fileName || `${state.inputFormat.toUpperCase()} → ${state.outputFormat.toUpperCase()}`,
        )
      } else {
        upsertParams({ inputFormat: state.inputFormat, outputFormat: state.outputFormat, fileName }, "interpretation")
      }
    }
  }, [
    hasUrlParams,
    state.input,
    state.inputFormat,
    state.outputFormat,
    fileName,
    upsertInputEntry,
    upsertParams,
  ])

  React.useEffect(() => {
    const nextParams = {
      inputFormat: state.inputFormat,
      outputFormat: state.outputFormat,
      fileName,
    }
    if (!hasInitializedParamsRef.current) {
      hasInitializedParamsRef.current = true
      paramsRef.current = nextParams
      return
    }
    if (
      paramsRef.current.inputFormat === nextParams.inputFormat &&
      paramsRef.current.outputFormat === nextParams.outputFormat &&
      paramsRef.current.fileName === nextParams.fileName
    ) {
      return
    }
    paramsRef.current = nextParams
    upsertParams(nextParams, "interpretation")
  }, [state.inputFormat, state.outputFormat, fileName, upsertParams])

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    e.target.value = ""
    if (!file) return

    const reader = new FileReader()
    reader.onload = (event) => {
      const content = event.target?.result as string
      setParam("input", content)
      setFileName(file.name)
    }
    reader.readAsText(file)
  }

  const handleCopy = async () => {
    await navigator.clipboard.writeText(output)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const handleDownload = () => {
    const ext = FORMAT_OPTIONS.find((f) => f.value === state.outputFormat)?.ext || ".txt"
    const blob = new Blob([output], { type: "text/plain" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = `converted${ext}`
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="flex flex-col gap-4">
      {/* Format Selection Row */}
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-2">
          <Label className="text-sm">From:</Label>
          <Select value={state.inputFormat} onValueChange={(v) => setParam("inputFormat", v as FormatType, true)}>
            <SelectTrigger className="h-8 w-24">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {FORMAT_OPTIONS.map((f) => (
                <SelectItem key={f.value} value={f.value}>
                  {f.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <ArrowRight className="h-4 w-4 text-muted-foreground" />

        <div className="flex items-center gap-2">
          <Label className="text-sm">To:</Label>
          <Select value={state.outputFormat} onValueChange={(v) => setParam("outputFormat", v as FormatType, true)}>
            <SelectTrigger className="h-8 w-24">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {FORMAT_OPTIONS.filter((f) => f.value !== state.inputFormat).map((f) => (
                <SelectItem key={f.value} value={f.value}>
                  {f.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Input/Output Section */}
      <div className="flex flex-col gap-4 md:flex-row">
        {/* Input */}
        <div className="flex w-full flex-1 flex-col gap-2 md:w-0">
          <div className="flex items-center justify-between">
            <Label className="text-sm font-medium">
              Input ({state.inputFormat.toUpperCase()}) {fileName && `(${fileName})`}
            </Label>
            <div className="flex gap-1">
              <input
                ref={fileInputRef}
                type="file"
                accept=".json,.yaml,.yml,.toml,application/json,application/x-yaml,text/yaml"
                onChange={handleFileUpload}
                className="hidden"
              />
              <Button
                variant="outline"
                size="sm"
                onClick={() => fileInputRef.current?.click()}
                className="h-7 gap-1 px-2 text-xs"
              >
                <Upload className="h-3 w-3" />
                Upload
              </Button>
            </div>
          </div>
          <Textarea
            value={state.input}
            onChange={(e) => {
              setParam("input", e.target.value)
              setFileName(null)
            }}
            placeholder={`Paste ${state.inputFormat.toUpperCase()} here...`}
            className={cn(
              "max-h-[400px] min-h-[300px] overflow-auto overflow-x-hidden break-words whitespace-pre-wrap font-mono text-sm",
              error && "border-destructive",
            )}
          />
          {oversizeKeys.includes("input") && (
            <p className="text-xs text-muted-foreground">Input exceeds 2 KB and is not synced to the URL.</p>
          )}
          {error && (
            <Alert variant="destructive" className="py-2">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription className="text-xs">{error}</AlertDescription>
            </Alert>
          )}
        </div>

        {/* Output */}
        <div className="flex w-full flex-1 flex-col gap-2 md:w-0">
          <div className="flex items-center justify-between">
          <Label className="text-sm font-medium">Output ({state.outputFormat.toUpperCase()})</Label>
            <div className="flex gap-1">
              <Button
                variant="outline"
                size="sm"
                onClick={handleCopy}
                disabled={!output}
                className="h-7 gap-1 px-2 text-xs bg-transparent"
              >
                {copied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
                Copy
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={handleDownload}
                disabled={!output}
                className="h-7 gap-1 px-2 text-xs bg-transparent"
              >
                <Download className="h-3 w-3" />
                Download
              </Button>
            </div>
          </div>
          <Textarea
            value={output}
            readOnly
            placeholder="Converted output will appear here..."
            className="max-h-[400px] min-h-[300px] overflow-auto overflow-x-hidden break-words whitespace-pre-wrap font-mono text-sm"
          />
        </div>
      </div>
    </div>
  )
}
