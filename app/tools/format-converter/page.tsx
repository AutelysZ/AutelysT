"use client"

import * as React from "react"
import { Suspense } from "react"
import { Upload, Copy, Check, Download, AlertCircle, ArrowRight } from "lucide-react"
import { ToolPageWrapper, useToolHistoryContext } from "@/components/tool-ui/tool-page-wrapper"
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

export default function FormatConverterPage() {
  return (
    <Suspense fallback={null}>
      <FormatConverterContent />
    </Suspense>
  )
}

function FormatConverterContent() {
  const [input, setInput] = React.useState("")
  const [inputFormat, setInputFormat] = React.useState<FormatType>("json")
  const [outputFormat, setOutputFormat] = React.useState<FormatType>("yaml")
  const [fileName, setFileName] = React.useState<string | null>(null)

  const handleLoadHistory = React.useCallback((entry: HistoryEntry) => {
    const { inputs, params } = entry

    if (params.fileName) {
      alert("This history entry contains an uploaded file and cannot be restored. Only the file name was recorded.")
      return
    }

    if (inputs.input !== undefined) setInput(inputs.input)
    if (params.inputFormat) setInputFormat(params.inputFormat as FormatType)
    if (params.outputFormat) setOutputFormat(params.outputFormat as FormatType)
  }, [])

  return (
    <ToolPageWrapper
      toolId="format-converter"
      title="Format Converter"
      description="Convert between JSON, YAML, and TOML formats"
      onLoadHistory={handleLoadHistory}
    >
      <FormatConverterInner
        input={input}
        setInput={setInput}
        inputFormat={inputFormat}
        setInputFormat={setInputFormat}
        outputFormat={outputFormat}
        setOutputFormat={setOutputFormat}
        fileName={fileName}
        setFileName={setFileName}
      />
    </ToolPageWrapper>
  )
}

function FormatConverterInner({
  input,
  setInput,
  inputFormat,
  setInputFormat,
  outputFormat,
  setOutputFormat,
  fileName,
  setFileName,
}: {
  input: string
  setInput: (v: string) => void
  inputFormat: FormatType
  setInputFormat: (v: FormatType) => void
  outputFormat: FormatType
  setOutputFormat: (v: FormatType) => void
  fileName: string | null
  setFileName: (v: string | null) => void
}) {
  const { addHistoryEntry } = useToolHistoryContext()
  const lastInputRef = React.useRef<string>("")
  const fileInputRef = React.useRef<HTMLInputElement>(null)
  const [copied, setCopied] = React.useState(false)

  // Parse and convert
  const { output, error } = React.useMemo(() => {
    if (!input.trim()) {
      return { output: "", error: null }
    }

    try {
      const parsed = parseInput(input, inputFormat)
      const result = formatOutput(parsed, outputFormat)
      return { output: result, error: null }
    } catch (e) {
      return { output: "", error: (e as Error).message }
    }
  }, [input, inputFormat, outputFormat])

  // Auto-detect format on input change
  React.useEffect(() => {
    if (input.trim()) {
      const detected = detectFormat(input)
      if (detected && detected !== inputFormat) {
        setInputFormat(detected)
      }
    }
  }, [input]) // eslint-disable-line react-hooks/exhaustive-deps

  // Save history
  React.useEffect(() => {
    const combined = `${input}|${inputFormat}|${outputFormat}`
    if (!input) return
    if (combined === lastInputRef.current) return

    const timer = setTimeout(() => {
      lastInputRef.current = combined
      addHistoryEntry(
        { input: fileName ? "" : input },
        { inputFormat, outputFormat, fileName },
        "input",
        fileName || `${inputFormat.toUpperCase()} → ${outputFormat.toUpperCase()}`,
      )
    }, 1000)

    return () => clearTimeout(timer)
  }, [input, inputFormat, outputFormat, fileName, addHistoryEntry])

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    const reader = new FileReader()
    reader.onload = (event) => {
      const content = event.target?.result as string
      setInput(content)
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
    const ext = FORMAT_OPTIONS.find((f) => f.value === outputFormat)?.ext || ".txt"
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
          <Select value={inputFormat} onValueChange={(v) => setInputFormat(v as FormatType)}>
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
          <Select value={outputFormat} onValueChange={(v) => setOutputFormat(v as FormatType)}>
            <SelectTrigger className="h-8 w-24">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {FORMAT_OPTIONS.filter((f) => f.value !== inputFormat).map((f) => (
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
              Input ({inputFormat.toUpperCase()}) {fileName && `(${fileName})`}
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
            value={input}
            onChange={(e) => {
              setInput(e.target.value)
              setFileName(null)
            }}
            placeholder={`Paste ${inputFormat.toUpperCase()} here...`}
            className={cn(
              "max-h-[400px] min-h-[300px] overflow-auto overflow-x-hidden break-words whitespace-pre-wrap font-mono text-sm",
              error && "border-destructive",
            )}
          />
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
            <Label className="text-sm font-medium">Output ({outputFormat.toUpperCase()})</Label>
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
