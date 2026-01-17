"use client"

import * as React from "react"
import { Suspense } from "react"
import { Upload, Copy, Check, Download, AlertCircle } from "lucide-react"
import { z } from "zod"
import { ToolPageWrapper, useToolHistoryContext } from "@/components/tool-ui/tool-page-wrapper"
import { DEFAULT_URL_SYNC_DEBOUNCE_MS, useUrlSyncedState } from "@/lib/url-state/use-url-synced-state"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Checkbox } from "@/components/ui/checkbox"
import { generateSchema, formatSchema } from "@/lib/data/json-schema"
import type { HistoryEntry } from "@/lib/history/db"
import { cn } from "@/lib/utils"

const paramsSchema = z.object({
  input: z.string().default(""),
  includeExamples: z.boolean().default(false),
})

export default function JSONSchemaPage() {
  return (
    <Suspense fallback={null}>
      <JSONSchemaContent />
    </Suspense>
  )
}

function JSONSchemaContent() {
  const { state, setParam, oversizeKeys, hasUrlParams, hydrationSource } = useUrlSyncedState("json-schema", {
    schema: paramsSchema,
    defaults: paramsSchema.parse({}),
  })
  const [fileName, setFileName] = React.useState<string | null>(null)
  const [error, setError] = React.useState<string | null>(null)

  const handleLoadHistory = React.useCallback((entry: HistoryEntry) => {
    const { inputs, params } = entry

    if (params.fileName) {
      alert("This history entry contains an uploaded file and cannot be restored. Only the file name was recorded.")
      return
    }

    if (inputs.input !== undefined) setParam("input", inputs.input)
    if (params.includeExamples !== undefined) setParam("includeExamples", params.includeExamples as boolean)
  }, [setParam])

  return (
    <ToolPageWrapper
      toolId="json-schema"
      title="JSON Schema Generator"
      description="Generate JSON Schema from sample JSON data"
      onLoadHistory={handleLoadHistory}
    >
      <JSONSchemaInner
        state={state}
        setParam={setParam}
        oversizeKeys={oversizeKeys}
        hasUrlParams={hasUrlParams}
        hydrationSource={hydrationSource}
        fileName={fileName}
        setFileName={setFileName}
        error={error}
        setError={setError}
      />
    </ToolPageWrapper>
  )
}

function JSONSchemaInner({
  state,
  setParam,
  oversizeKeys,
  hasUrlParams,
  hydrationSource,
  fileName,
  setFileName,
  error,
  setError,
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
  error: string | null
  setError: (v: string | null) => void
}) {
  const { upsertInputEntry, upsertParams } = useToolHistoryContext()
  const lastInputRef = React.useRef<string>("")
  const fileInputRef = React.useRef<HTMLInputElement>(null)
  const [copied, setCopied] = React.useState(false)
  const paramsRef = React.useRef({ includeExamples: state.includeExamples, fileName })
  const hasInitializedParamsRef = React.useRef(false)
  const hasHandledUrlRef = React.useRef(false)
  const hasHydratedInputRef = React.useRef(false)

  const { schema, schemaString, parseError } = React.useMemo(() => {
    if (!state.input.trim()) {
      return { schema: null, schemaString: "", parseError: null }
    }

    try {
      const parsed = JSON.parse(state.input)
      const schema = generateSchema(parsed, { includeExamples: state.includeExamples })
      schema.$schema = "http://json-schema.org/draft-07/schema#"
      return { schema, schemaString: formatSchema(schema), parseError: null }
    } catch (e) {
      return { schema: null, schemaString: "", parseError: (e as Error).message }
    }
  }, [state.input, state.includeExamples])

  React.useEffect(() => {
    setError(parseError)
  }, [parseError, setError])

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
        { fileName, includeExamples: state.includeExamples },
        "left",
        fileName || state.input.slice(0, 100),
      )
    }, DEFAULT_URL_SYNC_DEBOUNCE_MS)

    return () => clearTimeout(timer)
  }, [state.input, fileName, state.includeExamples, upsertInputEntry])

  React.useEffect(() => {
    if (hasUrlParams && !hasHandledUrlRef.current) {
      hasHandledUrlRef.current = true
      if (state.input) {
        upsertInputEntry(
          { input: fileName ? "" : state.input },
          { fileName, includeExamples: state.includeExamples },
          "left",
          fileName || state.input.slice(0, 100),
        )
      } else {
        upsertParams({ fileName, includeExamples: state.includeExamples }, "interpretation")
      }
    }
  }, [hasUrlParams, state.input, state.includeExamples, fileName, upsertInputEntry, upsertParams])

  React.useEffect(() => {
    const nextParams = { includeExamples: state.includeExamples, fileName }
    if (!hasInitializedParamsRef.current) {
      hasInitializedParamsRef.current = true
      paramsRef.current = nextParams
      return
    }
    if (
      paramsRef.current.includeExamples === nextParams.includeExamples &&
      paramsRef.current.fileName === nextParams.fileName
    ) {
      return
    }
    paramsRef.current = nextParams
    upsertParams(nextParams, "interpretation")
  }, [state.includeExamples, fileName, upsertParams])

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
    <div className="flex flex-col gap-4 md:flex-row">
      {/* Left - Input */}
      <div className="flex w-full flex-1 flex-col gap-2 md:w-0">
        <div className="flex items-center justify-between">
          <Label className="text-sm font-medium">JSON Input {fileName && `(${fileName})`}</Label>
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1.5">
              <Checkbox
                id="include-examples"
                checked={state.includeExamples}
                onCheckedChange={(checked) => setParam("includeExamples", checked as boolean, true)}
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
          value={state.input}
          onChange={(e) => {
            setParam("input", e.target.value)
            setFileName(null)
          }}
          placeholder="Paste JSON here to generate schema..."
          className={cn(
            "max-h-[500px] min-h-[400px] overflow-auto overflow-x-hidden break-words whitespace-pre-wrap font-mono text-sm",
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

      {/* Right - Schema Output */}
      <div className="flex w-full flex-1 flex-col gap-2 md:w-0">
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
          className="max-h-[500px] min-h-[400px] overflow-auto overflow-x-hidden break-words whitespace-pre-wrap font-mono text-sm"
        />
      </div>
    </div>
  )
}
