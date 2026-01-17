"use client"

import * as React from "react"
import { Suspense } from "react"
import { z } from "zod"
import { ToolPageWrapper, useToolHistoryContext } from "@/components/tool-ui/tool-page-wrapper"
import { DEFAULT_URL_SYNC_DEBOUNCE_MS, useUrlSyncedState } from "@/lib/url-state/use-url-synced-state"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Copy, Check, Download } from "lucide-react"
import type { HistoryEntry } from "@/lib/history/db"
import { cn } from "@/lib/utils"

const SNOWFLAKE_EPOCH_MS = 1288834974657
const SNOWFLAKE_EPOCH = BigInt(SNOWFLAKE_EPOCH_MS)
const SEQUENCE_BITS = 12
const WORKER_ID_BITS = 5
const DATACENTER_ID_BITS = 5
const BIGINT_ZERO = BigInt(0)
const BIGINT_ONE = BigInt(1)
const SEQUENCE_MASK = (BIGINT_ONE << BigInt(SEQUENCE_BITS)) - BIGINT_ONE
const WORKER_ID_MASK = (BIGINT_ONE << BigInt(WORKER_ID_BITS)) - BIGINT_ONE
const DATACENTER_ID_MASK = (BIGINT_ONE << BigInt(DATACENTER_ID_BITS)) - BIGINT_ONE
const WORKER_ID_SHIFT = BigInt(SEQUENCE_BITS)
const DATACENTER_ID_SHIFT = BigInt(SEQUENCE_BITS + WORKER_ID_BITS)
const TIMESTAMP_SHIFT = BigInt(SEQUENCE_BITS + WORKER_ID_BITS + DATACENTER_ID_BITS)

const paramsSchema = z.object({
  count: z.coerce.number().int().min(1).max(1000).default(1),
  datacenterId: z.coerce.number().int().min(0).max(31).default(0),
  workerId: z.coerce.number().int().min(0).max(31).default(0),
  content: z.string().default(""),
})

type ParsedSnowflake = {
  id: string
  timestampMs: number
  timestampIso: string
  timestampOffsetMs: number
  datacenterId: number
  workerId: number
  sequence: number
}

function buildSnowflakeId(timestampMs: number, datacenterId: number, workerId: number, sequence: number) {
  const timePart = (BigInt(timestampMs) - SNOWFLAKE_EPOCH) << TIMESTAMP_SHIFT
  const datacenterPart = (BigInt(datacenterId) & DATACENTER_ID_MASK) << DATACENTER_ID_SHIFT
  const workerPart = (BigInt(workerId) & WORKER_ID_MASK) << WORKER_ID_SHIFT
  const sequencePart = BigInt(sequence) & SEQUENCE_MASK
  return timePart | datacenterPart | workerPart | sequencePart
}

function generateSnowflakeIds(count: number, datacenterId: number, workerId: number) {
  const now = Date.now()
  if (now < SNOWFLAKE_EPOCH_MS) {
    throw new Error("System time is before the Snowflake epoch.")
  }

  let timestampMs = now
  let sequence = 0
  const ids: string[] = []

  for (let i = 0; i < count; i += 1) {
    if (sequence > Number(SEQUENCE_MASK)) {
      timestampMs += 1
      sequence = 0
    }
    const id = buildSnowflakeId(timestampMs, datacenterId, workerId, sequence)
    ids.push(id.toString())
    sequence += 1
  }

  return ids
}

function parseSnowflakeId(value: string): ParsedSnowflake | { error: string } {
  if (!/^\d+$/.test(value)) {
    return { error: "Snowflake ID must be a decimal number." }
  }

  const id = BigInt(value)
  if (id < BIGINT_ZERO) {
    return { error: "Snowflake ID must be non-negative." }
  }

  const sequence = Number(id & SEQUENCE_MASK)
  const workerId = Number((id >> WORKER_ID_SHIFT) & WORKER_ID_MASK)
  const datacenterId = Number((id >> DATACENTER_ID_SHIFT) & DATACENTER_ID_MASK)
  const timestampOffset = id >> TIMESTAMP_SHIFT
  const timestampMs = Number(timestampOffset + SNOWFLAKE_EPOCH)

  if (!Number.isFinite(timestampMs)) {
    return { error: "Snowflake timestamp is out of range." }
  }

  const date = new Date(timestampMs)
  if (Number.isNaN(date.getTime())) {
    return { error: "Snowflake timestamp is invalid." }
  }

  return {
    id: value,
    timestampMs,
    timestampIso: date.toISOString(),
    timestampOffsetMs: Number(timestampOffset),
    datacenterId,
    workerId,
    sequence,
  }
}

export default function SnowflakeIdPage() {
  return (
    <Suspense fallback={null}>
      <SnowflakeIdContent />
    </Suspense>
  )
}

function SnowflakeIdContent() {
  const { state, setParam, oversizeKeys, hasUrlParams, hydrationSource } = useUrlSyncedState("snowflake-id", {
    schema: paramsSchema,
    defaults: paramsSchema.parse({}),
  })

  const [parseError, setParseError] = React.useState<string | null>(null)
  const [parsedInfo, setParsedInfo] = React.useState<ParsedSnowflake | null>(null)
  const [copied, setCopied] = React.useState(false)

  React.useEffect(() => {
    const trimmed = state.content.trim()
    if (!trimmed) {
      setParseError(null)
      setParsedInfo(null)
      return
    }

    const lines = trimmed.split("\n").filter((line) => line.trim())
    if (lines.length !== 1) {
      setParseError(null)
      setParsedInfo(null)
      return
    }

    const result = parseSnowflakeId(lines[0])
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
    a.download = `snowflake-${state.count}.txt`
    a.click()
    URL.revokeObjectURL(url)
  }

  const handleLoadHistory = React.useCallback(
    (entry: HistoryEntry) => {
      const { inputs, params } = entry
      if (inputs.content !== undefined) setParam("content", inputs.content)
      if (params.count) setParam("count", params.count as number)
      if (params.datacenterId !== undefined) setParam("datacenterId", params.datacenterId as number)
      if (params.workerId !== undefined) setParam("workerId", params.workerId as number)
    },
    [setParam],
  )

  return (
    <ToolPageWrapper
      toolId="snowflake-id"
      title="Snowflake ID"
      description="Generate and parse Snowflake IDs with timestamp decoding."
      onLoadHistory={handleLoadHistory}
    >
      <SnowflakeIdInner
        state={state}
        setParam={setParam}
        oversizeKeys={oversizeKeys}
        hasUrlParams={hasUrlParams}
        hydrationSource={hydrationSource}
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

function SnowflakeIdInner({
  state,
  setParam,
  oversizeKeys,
  hasUrlParams,
  hydrationSource,
  parseError,
  parsedInfo,
  copied,
  handleContentChange,
  handleCopy,
  handleDownload,
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
  parseError: string | null
  parsedInfo: ParsedSnowflake | null
  copied: boolean
  handleContentChange: (value: string) => void
  handleCopy: () => void
  handleDownload: () => void
}) {
  const { upsertInputEntry, upsertParams } = useToolHistoryContext()
  const lastSavedRef = React.useRef<string>("")
  const hasHydratedInputRef = React.useRef(false)
  const paramsRef = React.useRef({
    count: state.count,
    datacenterId: state.datacenterId,
    workerId: state.workerId,
  })
  const hasInitializedParamsRef = React.useRef(false)
  const hasHandledUrlRef = React.useRef(false)

  React.useEffect(() => {
    if (hasHydratedInputRef.current) return
    if (hydrationSource === "default") return
    lastSavedRef.current = state.content
    hasHydratedInputRef.current = true
  }, [hydrationSource, state.content])

  React.useEffect(() => {
    if (state.content === lastSavedRef.current) return

    const timer = setTimeout(() => {
      lastSavedRef.current = state.content
      upsertInputEntry(
        { content: state.content },
        { count: state.count, datacenterId: state.datacenterId, workerId: state.workerId },
        "left",
        state.content ? state.content.slice(0, 100) : `x${state.count}`,
      )
    }, DEFAULT_URL_SYNC_DEBOUNCE_MS)

    return () => clearTimeout(timer)
  }, [state.content, state.count, state.datacenterId, state.workerId, upsertInputEntry])

  React.useEffect(() => {
    if (hasUrlParams && !hasHandledUrlRef.current) {
      hasHandledUrlRef.current = true
      if (state.content) {
        upsertInputEntry(
          { content: state.content },
          { count: state.count, datacenterId: state.datacenterId, workerId: state.workerId },
          "left",
          state.content.slice(0, 100),
        )
      } else {
        upsertParams({ count: state.count, datacenterId: state.datacenterId, workerId: state.workerId }, "deferred")
      }
    }
  }, [hasUrlParams, state.content, state.count, state.datacenterId, state.workerId, upsertInputEntry, upsertParams])

  React.useEffect(() => {
    const nextParams = {
      count: state.count,
      datacenterId: state.datacenterId,
      workerId: state.workerId,
    }
    if (!hasInitializedParamsRef.current) {
      hasInitializedParamsRef.current = true
      paramsRef.current = nextParams
      return
    }
    if (
      paramsRef.current.count === nextParams.count &&
      paramsRef.current.datacenterId === nextParams.datacenterId &&
      paramsRef.current.workerId === nextParams.workerId
    ) {
      return
    }
    paramsRef.current = nextParams
    upsertParams(nextParams, "deferred")
  }, [state.count, state.datacenterId, state.workerId, upsertParams])

  const handleGenerate = React.useCallback(() => {
    const ids = generateSnowflakeIds(state.count, state.datacenterId, state.workerId)
    const content = ids.join("\n")
    setParam("content", content)

    lastSavedRef.current = content
    upsertInputEntry(
      { content },
      { count: state.count, datacenterId: state.datacenterId, workerId: state.workerId },
      "left",
      content.slice(0, 100),
    )
  }, [state.count, state.datacenterId, state.workerId, setParam, upsertInputEntry])

  const handleCountChange = React.useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      let value = Number.parseInt(e.target.value, 10)
      if (Number.isNaN(value)) value = 1
      value = Math.max(1, Math.min(1000, value))
      setParam("count", value, true)
    },
    [setParam],
  )

  const handleDatacenterChange = React.useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      let value = Number.parseInt(e.target.value, 10)
      if (Number.isNaN(value)) value = 0
      value = Math.max(0, Math.min(31, value))
      setParam("datacenterId", value, true)
    },
    [setParam],
  )

  const handleWorkerChange = React.useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      let value = Number.parseInt(e.target.value, 10)
      if (Number.isNaN(value)) value = 0
      value = Math.max(0, Math.min(31, value))
      setParam("workerId", value, true)
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

          <div className="flex items-center gap-2">
            <Label htmlFor="datacenterId" className="text-sm whitespace-nowrap">
              Datacenter ID
            </Label>
            <Input
              id="datacenterId"
              type="number"
              min={0}
              max={31}
              value={state.datacenterId}
              onChange={handleDatacenterChange}
              className="w-24"
            />
          </div>

          <div className="flex items-center gap-2">
            <Label htmlFor="workerId" className="text-sm whitespace-nowrap">
              Worker ID
            </Label>
            <Input
              id="workerId"
              type="number"
              min={0}
              max={31}
              value={state.workerId}
              onChange={handleWorkerChange}
              className="w-24"
            />
          </div>

          <Button onClick={handleGenerate}>Generate</Button>
        </CardContent>
      </Card>

      <p className="text-xs text-muted-foreground">
        Uses the Twitter Snowflake epoch ({new Date(SNOWFLAKE_EPOCH_MS).toISOString()}).
      </p>

      <div className="flex min-h-0 flex-1 flex-col gap-4 md:flex-row">
        <div className="flex w-full flex-1 flex-col gap-2 md:w-0">
          <div className="flex items-center justify-between">
            <Label className="text-sm font-medium">Snowflake IDs</Label>
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
            placeholder="Generated Snowflake IDs will appear here, or paste one to parse..."
            className={cn(
              "min-h-[300px] max-h-[400px] resize-none overflow-auto overflow-x-hidden break-words whitespace-pre-wrap font-mono text-sm",
              parseError && "border-destructive",
            )}
          />

          {parseError && <p className="text-xs text-destructive">{parseError}</p>}
          {oversizeKeys.includes("content") && (
            <p className="text-xs text-muted-foreground">Input exceeds 2 KB and is not synced to the URL.</p>
          )}
        </div>

        <div className="flex w-full flex-1 flex-col gap-2 md:w-0">
          <Label className="text-sm font-medium">Parsed Information</Label>

          {parsedInfo ? (
            <Card className="max-h-[400px] overflow-auto">
              <CardContent className="space-y-3 p-4">
                <InfoRow label="Snowflake ID" value={parsedInfo.id} mono />
                <InfoRow label="Timestamp (ISO)" value={parsedInfo.timestampIso} />
                <InfoRow label="Timestamp (ms)" value={String(parsedInfo.timestampMs)} mono />
                <InfoRow label="Timestamp Offset (ms)" value={String(parsedInfo.timestampOffsetMs)} mono />
                <InfoRow label="Datacenter ID" value={String(parsedInfo.datacenterId)} />
                <InfoRow label="Worker ID" value={String(parsedInfo.workerId)} />
                <InfoRow label="Sequence" value={String(parsedInfo.sequence)} />
              </CardContent>
            </Card>
          ) : (
            <Card className="flex min-h-[300px] max-h-[400px] items-center justify-center">
              <p className="text-sm text-muted-foreground">
                {state.content.trim()
                  ? "Enter a single Snowflake ID to parse"
                  : "Generate or paste a single Snowflake ID to see parsed information"}
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
