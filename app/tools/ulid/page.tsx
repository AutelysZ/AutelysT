"use client"

import * as React from "react"
import { Suspense } from "react"
import { z } from "zod"
import { ToolPageWrapper, useToolHistoryContext } from "@/components/tool-ui/tool-page-wrapper"
import { useUrlSyncedState } from "@/lib/url-state/use-url-synced-state"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Copy, Check, Download } from "lucide-react"
import { generateULIDs, parseULID, type ParsedULID } from "@/lib/identifier/ulid"
import type { HistoryEntry } from "@/lib/history/db"
import { cn } from "@/lib/utils"

const paramsSchema = z.object({
  count: z.coerce.number().int().min(1).max(1000).default(1),
  content: z.string().default(""),
})

export default function ULIDPage() {
  return (
    <Suspense fallback={null}>
      <ULIDContent />
    </Suspense>
  )
}

function ULIDContent() {
  const { state, setParam } = useUrlSyncedState("ulid", {
    schema: paramsSchema,
    defaults: paramsSchema.parse({}),
  })

  const [parseError, setParseError] = React.useState<string | null>(null)
  const [parsedInfo, setParsedInfo] = React.useState<ParsedULID | null>(null)
  const [copied, setCopied] = React.useState(false)

  React.useEffect(() => {
    const trimmed = state.content.trim()
    if (!trimmed) {
      setParseError(null)
      setParsedInfo(null)
      return
    }

    const lines = trimmed.split("\n").filter((l) => l.trim())
    if (lines.length !== 1) {
      setParseError(null)
      setParsedInfo(null)
      return
    }

    const result = parseULID(lines[0])
    if ("error" in result) {
      setParseError(result.error)
      setParsedInfo(null)
    } else {
      setParseError(null)
      setParsedInfo(result)
    }
  }, [state.content])

  const handleContentChange = React.useCallback(
    (value: string) => {
      setParam("content", value)
    },
    [setParam],
  )

  const handleCopy = async () => {
    await navigator.clipboard.writeText(state.content)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const handleDownload = () => {
    const blob = new Blob([state.content], { type: "text/plain" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = `ulid-${state.count}.txt`
    a.click()
    URL.revokeObjectURL(url)
  }

  const handleLoadHistory = React.useCallback(
    (entry: HistoryEntry) => {
      const { inputs, params } = entry
      if (inputs.content !== undefined) setParam("content", inputs.content)
      if (params.count) setParam("count", params.count as number)
    },
    [setParam],
  )

  return (
    <ToolPageWrapper
      toolId="ulid"
      title="ULID"
      description="Generate and parse ULIDs (Universally Unique Lexicographically Sortable Identifiers)"
      onLoadHistory={handleLoadHistory}
    >
      <ULIDInner
        state={state}
        setParam={setParam}
        parseError={parseError}
        parsedInfo={parsedInfo}
        copied={copied}
        handleContentChange={handleContentChange}
        handleCopy={handleCopy}
        handleDownload={handleDownload}
      />
    </ToolPageWrapper>
  )
}

function ULIDInner({
  state,
  setParam,
  parseError,
  parsedInfo,
  copied,
  handleContentChange,
  handleCopy,
  handleDownload,
}: {
  state: z.infer<typeof paramsSchema>
  setParam: (key: string, value: unknown, immediate?: boolean) => void
  parseError: string | null
  parsedInfo: ParsedULID | null
  copied: boolean
  handleContentChange: (value: string) => void
  handleCopy: () => void
  handleDownload: () => void
}) {
  const { addHistoryEntry } = useToolHistoryContext()
  const lastSavedRef = React.useRef<string>("")

  React.useEffect(() => {
    const key = `${state.count}:${state.content}`
    if (key === lastSavedRef.current) return

    const timer = setTimeout(() => {
      lastSavedRef.current = key
      addHistoryEntry(
        { content: state.content },
        { count: state.count },
        "left",
        state.content ? state.content.slice(0, 100) : `x${state.count}`,
      )
    }, 1000)

    return () => clearTimeout(timer)
  }, [state.content, state.count, addHistoryEntry])

  const handleGenerate = React.useCallback(() => {
    const ulids = generateULIDs(state.count)
    const content = ulids.join("\n")
    setParam("content", content)

    lastSavedRef.current = `${state.count}:${content}`
    addHistoryEntry({ content }, { count: state.count }, "left", content.slice(0, 100))
  }, [state.count, setParam, addHistoryEntry])

  const handleCountChange = React.useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      let value = Number.parseInt(e.target.value) || 1
      value = Math.max(1, Math.min(1000, value))
      setParam("count", value, true)
    },
    [setParam],
  )

  return (
    <div className="flex flex-col gap-4">
      <Card>
        <CardContent className="flex flex-wrap items-center gap-4 p-4">
          <div className="flex items-center gap-2">
            <Label htmlFor="count" className="text-sm whitespace-nowrap">
              Count
            </Label>
            <Input
              id="count"
              type="number"
              min={1}
              max={1000}
              value={state.count}
              onChange={handleCountChange}
              className="w-24"
            />
          </div>

          <Button onClick={handleGenerate}>Generate</Button>
        </CardContent>
      </Card>

      <div className="flex min-h-0 flex-1 gap-4">
        <div className="flex w-0 flex-1 flex-col gap-2">
          <div className="flex items-center justify-between">
            <Label className="text-sm font-medium">ULIDs</Label>
            <div className="flex items-center gap-1">
              <Button
                variant="ghost"
                size="sm"
                onClick={handleDownload}
                disabled={!state.content}
                className="h-7 gap-1 px-2 text-xs"
              >
                <Download className="h-3 w-3" />
                Download
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={handleCopy}
                disabled={!state.content}
                className="h-7 gap-1 px-2 text-xs"
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
            </div>
          </div>

          <Textarea
            value={state.content}
            onChange={(e) => handleContentChange(e.target.value)}
            placeholder="Generated ULIDs will appear here, or paste a ULID to parse..."
            className={cn(
              "min-h-[300px] max-h-[400px] resize-none overflow-auto font-mono text-sm break-all",
              parseError && "border-destructive",
            )}
            style={{ wordBreak: "break-all", overflowWrap: "anywhere" }}
          />

          {parseError && <p className="text-xs text-destructive">{parseError}</p>}
        </div>

        <div className="flex w-0 flex-1 flex-col gap-2">
          <Label className="text-sm font-medium">Parsed Information</Label>

          {parsedInfo ? (
            <Card className="max-h-[400px] overflow-auto">
              <CardContent className="space-y-3 p-4">
                <InfoRow label="ULID" value={parsedInfo.ulid} mono />
                <InfoRow label="Timestamp (ISO)" value={parsedInfo.timestamp} />
                <InfoRow label="Timestamp (ms)" value={String(parsedInfo.timestampRaw)} mono />
                <InfoRow label="Randomness" value={parsedInfo.randomness} mono />
              </CardContent>
            </Card>
          ) : (
            <Card className="flex min-h-[300px] max-h-[400px] items-center justify-center">
              <p className="text-sm text-muted-foreground">
                {state.content.trim()
                  ? "Enter a single ULID to parse"
                  : "Generate or paste a single ULID to see parsed information"}
              </p>
            </Card>
          )}
        </div>
      </div>
    </div>
  )
}

function InfoRow({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="flex flex-col gap-1">
      <span className="text-xs text-muted-foreground">{label}</span>
      <span
        className={cn("text-sm break-all", mono && "font-mono")}
        style={{ wordBreak: "break-all", overflowWrap: "anywhere" }}
      >
        {value}
      </span>
    </div>
  )
}
