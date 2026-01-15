"use client"

import * as React from "react"
import { Suspense } from "react"
import { Upload, Copy, Check, Download, AlertCircle } from "lucide-react"
import { ToolPageWrapper, useToolHistoryContext } from "@/components/tool-ui/tool-page-wrapper"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Checkbox } from "@/components/ui/checkbox"
import { generateSchema, formatSchema } from "@/lib/data/json-schema"
import type { HistoryEntry } from "@/lib/history/db"
import { cn } from "@/lib/utils"

export default function JSONSchemaPage() {
  return (
    <Suspense fallback={null}>
      <JSONSchemaContent />
    </Suspense>
  )
}

function JSONSchemaContent() {
  const [input, setInput] = React.useState("")
  const [fileName, setFileName] = React.useState<string | null>(null)
  const [includeExamples, setIncludeExamples] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)

  const handleLoadHistory = React.useCallback((entry: HistoryEntry) => {
    const { inputs, params } = entry

    if (params.fileName) {
      alert("This history entry contains an uploaded file and cannot be restored. Only the file name was recorded.")
      return
    }

    if (inputs.input !== undefined) setInput(inputs.input)
    if (params.includeExamples !== undefined) setIncludeExamples(params.includeExamples as boolean)
  }, [])

  return (
    <ToolPageWrapper
      toolId="json-schema"
      title="JSON Schema Generator"
      description="Generate JSON Schema from sample JSON data"
      onLoadHistory={handleLoadHistory}
    >
      <JSONSchemaInner
        input={input}
        setInput={setInput}
        fileName={fileName}
        setFileName={setFileName}
        includeExamples={includeExamples}
        setIncludeExamples={setIncludeExamples}
        error={error}
        setError={setError}
      />
    </ToolPageWrapper>
  )
}

function JSONSchemaInner({
  input,
  setInput,
  fileName,
  setFileName,
  includeExamples,
  setIncludeExamples,
  error,
  setError,
}: {
  input: string
  setInput: (v: string) => void
  fileName: string | null
  setFileName: (v: string | null) => void
  includeExamples: boolean
  setIncludeExamples: (v: boolean) => void
  error: string | null
  setError: (v: string | null) => void
}) {
  const { addHistoryEntry } = useToolHistoryContext()
  const lastInputRef = React.useRef<string>("")
  const fileInputRef = React.useRef<HTMLInputElement>(null)
  const [copied, setCopied] = React.useState(false)

  const { schema, schemaString, parseError } = React.useMemo(() => {
    if (!input.trim()) {
      return { schema: null, schemaString: "", parseError: null }
    }

    try {
      const parsed = JSON.parse(input)
      const schema = generateSchema(parsed, { includeExamples })
      schema.$schema = "http://json-schema.org/draft-07/schema#"
      return { schema, schemaString: formatSchema(schema), parseError: null }
    } catch (e) {
      return { schema: null, schemaString: "", parseError: (e as Error).message }
    }
  }, [input, includeExamples])

  React.useEffect(() => {
    setError(parseError)
  }, [parseError, setError])

  // Save history
  React.useEffect(() => {
    if (!input) return
    if (input === lastInputRef.current) return

    const timer = setTimeout(() => {
      lastInputRef.current = input
      addHistoryEntry(
        { input: fileName ? "" : input },
        { fileName, includeExamples },
        "left",
        fileName || input.slice(0, 100),
      )
    }, 1000)

    return () => clearTimeout(timer)
  }, [input, fileName, includeExamples, addHistoryEntry])

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
    await navigator.clipboard.writeText(schemaString)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const handleDownload = () => {
    const blob = new Blob([schemaString], { type: "application/json" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = "schema.json"
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="flex gap-4">
      {/* Left - Input */}
      <div className="flex w-0 flex-1 flex-col gap-2">
        <div className="flex items-center justify-between">
          <Label className="text-sm font-medium">JSON Input {fileName && `(${fileName})`}</Label>
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1.5">
              <Checkbox
                id="include-examples"
                checked={includeExamples}
                onCheckedChange={(checked) => setIncludeExamples(checked as boolean)}
              />
              <Label htmlFor="include-examples" className="text-xs font-normal">
                Include examples
              </Label>
            </div>
            <input
              ref={fileInputRef}
              type="file"
              accept=".json,application/json"
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
          placeholder="Paste JSON here to generate schema..."
          className={cn("max-h-[500px] min-h-[400px] overflow-auto font-mono text-sm", error && "border-destructive")}
        />
        {error && (
          <Alert variant="destructive" className="py-2">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription className="text-xs">{error}</AlertDescription>
          </Alert>
        )}
      </div>

      {/* Right - Schema Output */}
      <div className="flex w-0 flex-1 flex-col gap-2">
        <div className="flex items-center justify-between">
          <Label className="text-sm font-medium">Generated Schema</Label>
          <div className="flex gap-1">
            <Button
              variant="outline"
              size="sm"
              onClick={handleCopy}
              disabled={!schemaString}
              className="h-7 gap-1 px-2 text-xs bg-transparent"
            >
              {copied ? (
                <>
                  <Check className="h-3 w-3" />
                  Copied
                </>
              ) : (
                <>
                  <Copy className="h-3 w-3" />
                  Copy
                </>
              )}
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={handleDownload}
              disabled={!schemaString}
              className="h-7 gap-1 px-2 text-xs bg-transparent"
            >
              <Download className="h-3 w-3" />
              Download
            </Button>
          </div>
        </div>
        <Textarea
          value={schemaString}
          readOnly
          placeholder="Generated schema will appear here..."
          className="max-h-[500px] min-h-[400px] overflow-auto font-mono text-sm"
        />
      </div>
    </div>
  )
}
