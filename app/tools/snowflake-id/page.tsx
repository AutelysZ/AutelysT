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
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { DateTimePicker } from "@/components/ui/date-time-picker"
import { Copy, Check, Download } from "lucide-react"
import type { HistoryEntry } from "@/lib/history/db"
import { cn } from "@/lib/utils"

const SNOWFLAKE_EPOCH_MS = 1288834974657
const SONYFLAKE_EPOCH_MS = 1409529600000
const BIGINT_ZERO = BigInt(0)
const BIGINT_ONE = BigInt(1)
const MAX_BITS = 63

type SnowflakeConfig = {
  timestampBits: number
  datacenterBits: number
  workerBits: number
  sequenceBits: number
  startTimeMs: number
  timestampOffsetMs: number
}

type SnowflakeLayout = {
  sequenceMask: bigint
  workerMask: bigint
  datacenterMask: bigint
  timestampMask: bigint
  workerShift: bigint
  datacenterShift: bigint
  timestampShift: bigint
  totalBits: number
  totalMask: bigint
}

type SnowflakePreset = {
  id: "twitter" | "sony"
  label: string
  params: Pick<
    SnowflakeConfig,
    "timestampBits" | "datacenterBits" | "workerBits" | "sequenceBits" | "startTimeMs" | "timestampOffsetMs"
  >
  defaults: {
    datacenterId: number
    workerId: number
  }
}

const SNOWFLAKE_PRESETS: SnowflakePreset[] = [
  {
    id: "twitter",
    label: "Twitter",
    params: {
      timestampBits: 41,
      datacenterBits: 5,
      workerBits: 5,
      sequenceBits: 12,
      startTimeMs: SNOWFLAKE_EPOCH_MS,
      timestampOffsetMs: 1,
    },
    defaults: {
      datacenterId: 0,
      workerId: 0,
    },
  },
  {
    id: "sony",
    label: "Sony",
    params: {
      timestampBits: 39,
      datacenterBits: 0,
      workerBits: 16,
      sequenceBits: 8,
      startTimeMs: SONYFLAKE_EPOCH_MS,
      timestampOffsetMs: 10,
    },
    defaults: {
      datacenterId: 0,
      workerId: 0,
    },
  },
]

const paramsSchema = z.object({
  count: z.coerce.number().int().min(1).max(1000).default(1),
  datacenterId: z.coerce.number().int().min(0).max(Number.MAX_SAFE_INTEGER).default(0),
  workerId: z.coerce.number().int().min(0).max(Number.MAX_SAFE_INTEGER).default(0),
  timestampBits: z.coerce.number().int().min(1).max(MAX_BITS).default(41),
  datacenterBits: z.coerce.number().int().min(0).max(MAX_BITS).default(5),
  workerBits: z.coerce.number().int().min(0).max(MAX_BITS).default(5),
  sequenceBits: z.coerce.number().int().min(0).max(MAX_BITS).default(12),
  startTimeMs: z.coerce.number().int().min(0).default(SNOWFLAKE_EPOCH_MS),
  timestampOffsetMs: z.coerce.number().int().min(1).max(1000).default(1),
  content: z.string().default(""),
})

type ParsedSnowflake = {
  id: string
  timestampMs: number
  timestampIso: string
  timestampOffsetTicks: string
  timestampOffsetMs: string
  datacenterId: string
  workerId: string
  sequence: string
  overflow: boolean
  overflowReason?: string
}

type ParsedSnowflakeItem = {
  input: string
  result?: ParsedSnowflake
  error?: string
}

type SnowflakeHistoryParams = {
  count: number
  datacenterId: number
  workerId: number
  timestampBits: number
  datacenterBits: number
  workerBits: number
  sequenceBits: number
  startTimeMs: number
  timestampOffsetMs: number
}

const DEFAULT_PRESET = SNOWFLAKE_PRESETS[0]

function getMask(bits: number) {
  if (bits <= 0) return BIGINT_ZERO
  return (BIGINT_ONE << BigInt(bits)) - BIGINT_ONE
}

function buildLayout(config: SnowflakeConfig): SnowflakeLayout {
  const totalBits = config.timestampBits + config.datacenterBits + config.workerBits + config.sequenceBits
  const sequenceMask = getMask(config.sequenceBits)
  const workerMask = getMask(config.workerBits)
  const datacenterMask = getMask(config.datacenterBits)
  const timestampMask = getMask(config.timestampBits)
  const workerShift = BigInt(config.sequenceBits)
  const datacenterShift = BigInt(config.sequenceBits + config.workerBits)
  const timestampShift = BigInt(config.sequenceBits + config.workerBits + config.datacenterBits)
  const totalMask = getMask(totalBits)
  return {
    sequenceMask,
    workerMask,
    datacenterMask,
    timestampMask,
    workerShift,
    datacenterShift,
    timestampShift,
    totalBits,
    totalMask,
  }
}

function getSnowflakeConfig(state: z.infer<typeof paramsSchema>): SnowflakeConfig {
  return {
    timestampBits: state.timestampBits,
    datacenterBits: state.datacenterBits,
    workerBits: state.workerBits,
    sequenceBits: state.sequenceBits,
    startTimeMs: state.startTimeMs,
    timestampOffsetMs: state.timestampOffsetMs,
  }
}

function matchPreset(state: z.infer<typeof paramsSchema>) {
  return SNOWFLAKE_PRESETS.find(
    (preset) =>
      preset.params.timestampBits === state.timestampBits &&
      preset.params.datacenterBits === state.datacenterBits &&
      preset.params.workerBits === state.workerBits &&
      preset.params.sequenceBits === state.sequenceBits &&
      preset.params.startTimeMs === state.startTimeMs &&
      preset.params.timestampOffsetMs === state.timestampOffsetMs,
  )
}

function formatParsedInfo(parsed: ParsedSnowflake) {
  const lines = [
    `Snowflake ID: ${parsed.id}`,
    `Timestamp (ISO): ${parsed.timestampIso}`,
    `Timestamp (ms): ${parsed.timestampMs}`,
    `Timestamp Offset (ticks): ${parsed.timestampOffsetTicks}`,
    `Timestamp Offset (ms): ${parsed.timestampOffsetMs}`,
    `Datacenter ID: ${parsed.datacenterId}`,
    `Worker ID: ${parsed.workerId}`,
    `Sequence: ${parsed.sequence}`,
    `Overflow: ${parsed.overflow ? "Yes" : "No"}`,
  ]
  if (parsed.overflow && parsed.overflowReason) {
    lines.push(`Overflow Details: ${parsed.overflowReason}`)
  }
  return lines.join("\n")
}

function escapeCsvValue(value: string) {
  if (value.includes('"') || value.includes(",") || value.includes("\n")) {
    return `"${value.replace(/"/g, '""')}"`
  }
  return value
}

function buildParsedCsv(items: ParsedSnowflakeItem[]) {
  const header = [
    "snowflake_id",
    "timestamp_iso",
    "timestamp_ms",
    "timestamp_offset_ticks",
    "timestamp_offset_ms",
    "datacenter_id",
    "worker_id",
    "sequence",
    "overflow",
    "overflow_reason",
    "error",
  ]
  const rows = items.map((item) => {
    if (item.error || !item.result) {
      return [
        item.input,
        "",
        "",
        "",
        "",
        "",
        "",
        "",
        "",
        "",
        item.error ?? "Unknown error",
      ].map(escapeCsvValue)
    }
    return [
      item.result.id,
      item.result.timestampIso,
      String(item.result.timestampMs),
      item.result.timestampOffsetTicks,
      item.result.timestampOffsetMs,
      item.result.datacenterId,
      item.result.workerId,
      item.result.sequence,
      item.result.overflow ? "true" : "false",
      item.result.overflowReason ?? "",
      "",
    ].map(escapeCsvValue)
  })
  return [header.join(","), ...rows.map((row) => row.join(","))].join("\n")
}

function bigIntToSafeNumber(value: bigint) {
  if (value > BigInt(Number.MAX_SAFE_INTEGER)) {
    return Number.MAX_SAFE_INTEGER
  }
  return Number(value)
}

function clampValue(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value))
}

function buildSnowflakeId(
  timestampOffset: bigint,
  datacenterId: bigint,
  workerId: bigint,
  sequence: bigint,
  layout: SnowflakeLayout,
) {
  const timePart = (timestampOffset & layout.timestampMask) << layout.timestampShift
  const datacenterPart = (datacenterId & layout.datacenterMask) << layout.datacenterShift
  const workerPart = (workerId & layout.workerMask) << layout.workerShift
  const sequencePart = sequence & layout.sequenceMask
  return timePart | datacenterPart | workerPart | sequencePart
}

function getTimestampOffset(timestampMs: number, config: SnowflakeConfig) {
  const offsetMs = timestampMs - config.startTimeMs
  if (offsetMs < 0) {
    throw new Error("System time is before the configured start time.")
  }
  return BigInt(Math.floor(offsetMs / config.timestampOffsetMs))
}

function generateSnowflakeIds(
  count: number,
  datacenterId: number,
  workerId: number,
  config: SnowflakeConfig,
) {
  const layout = buildLayout(config)
  const datacenterValue = BigInt(datacenterId)
  const workerValue = BigInt(workerId)

  if (datacenterValue > layout.datacenterMask) {
    throw new Error(`Datacenter ID exceeds ${config.datacenterBits} bits.`)
  }
  if (workerValue > layout.workerMask) {
    throw new Error(`Worker ID exceeds ${config.workerBits} bits.`)
  }

  let timestampMs = Date.now()
  let timestampOffset = getTimestampOffset(timestampMs, config)
  if (timestampOffset > layout.timestampMask) {
    throw new Error("Timestamp exceeds the configured bit length.")
  }

  let sequence = BIGINT_ZERO
  const ids: string[] = []

  for (let i = 0; i < count; i += 1) {
    if (sequence > layout.sequenceMask) {
      timestampMs += config.timestampOffsetMs
      timestampOffset = getTimestampOffset(timestampMs, config)
      if (timestampOffset > layout.timestampMask) {
        throw new Error("Timestamp exceeds the configured bit length.")
      }
      sequence = BIGINT_ZERO
    }
    const id = buildSnowflakeId(timestampOffset, datacenterValue, workerValue, sequence, layout)
    ids.push(id.toString())
    sequence += BIGINT_ONE
  }

  return ids
}

function parseSnowflakeId(
  value: string,
  config: SnowflakeConfig,
  layoutOverride?: SnowflakeLayout,
): ParsedSnowflake | { error: string } {
  if (!/^\d+$/.test(value)) {
    return { error: "Snowflake ID must be a decimal number." }
  }

  const id = BigInt(value)
  if (id < BIGINT_ZERO) {
    return { error: "Snowflake ID must be non-negative." }
  }

  const layout = layoutOverride ?? buildLayout(config)
  const sequence = id & layout.sequenceMask
  const workerId = (id >> layout.workerShift) & layout.workerMask
  const datacenterId = (id >> layout.datacenterShift) & layout.datacenterMask
  const timestampOffset = id >> layout.timestampShift
  const overflowReasons: string[] = []

  if (layout.totalBits > 0 && id > layout.totalMask) {
    overflowReasons.push(`ID exceeds ${layout.totalBits} bits`)
  }
  if (timestampOffset > layout.timestampMask) {
    overflowReasons.push("Timestamp offset exceeds configured bits")
  }

  const timestampMsBig =
    BigInt(config.startTimeMs) + timestampOffset * BigInt(Math.max(config.timestampOffsetMs, 1))
  if (timestampMsBig > BigInt(Number.MAX_SAFE_INTEGER)) {
    return { error: "Snowflake timestamp is out of range." }
  }
  if (timestampMsBig < BIGINT_ZERO) {
    return { error: "Snowflake timestamp is invalid." }
  }

  const timestampMs = Number(timestampMsBig)
  const date = new Date(timestampMs)
  if (Number.isNaN(date.getTime())) {
    return { error: "Snowflake timestamp is invalid." }
  }

  return {
    id: value,
    timestampMs,
    timestampIso: date.toISOString(),
    timestampOffsetTicks: timestampOffset.toString(),
    timestampOffsetMs: (timestampOffset * BigInt(config.timestampOffsetMs)).toString(),
    datacenterId: datacenterId.toString(),
    workerId: workerId.toString(),
    sequence: sequence.toString(),
    overflow: overflowReasons.length > 0,
    overflowReason: overflowReasons.length ? overflowReasons.join("; ") : undefined,
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

  const config = React.useMemo(
    () => getSnowflakeConfig(state),
    [
      state.timestampBits,
      state.datacenterBits,
      state.workerBits,
      state.sequenceBits,
      state.startTimeMs,
      state.timestampOffsetMs,
    ],
  )
  const layout = React.useMemo(() => buildLayout(config), [config])

  const [parseError, setParseError] = React.useState<string | null>(null)
  const [parsedItems, setParsedItems] = React.useState<ParsedSnowflakeItem[]>([])
  const [copied, setCopied] = React.useState(false)
  const [parsedCopied, setParsedCopied] = React.useState(false)

  React.useEffect(() => {
    const trimmed = state.content.trim()
    if (!trimmed) {
      setParseError(null)
      setParsedItems([])
      return
    }

    const lines = trimmed
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean)
    const results = lines.map((line) => {
      const result = parseSnowflakeId(line, config, layout)
      if ("error" in result) {
        return { input: line, error: result.error }
      }
      return { input: line, result }
    })

    const hasErrors = results.some((item) => item.error)
    if (lines.length === 1 && hasErrors) {
      setParseError(results[0].error ?? "Snowflake ID is invalid.")
    } else if (hasErrors) {
      setParseError("One or more Snowflake IDs are invalid.")
    } else {
      setParseError(null)
    }

    setParsedItems(results)
  }, [config, layout, state.content])

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

  const handleParsedCopy = async () => {
    const single = parsedItems.length === 1 ? parsedItems[0].result : null
    if (!single) return
    await navigator.clipboard.writeText(formatParsedInfo(single))
    setParsedCopied(true)
    setTimeout(() => setParsedCopied(false), 2000)
  }

  const handleParsedDownload = () => {
    if (!parsedItems.length) return
    const csv = buildParsedCsv(parsedItems)
    const blob = new Blob([csv], { type: "text/csv" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = `snowflake-parsed-${parsedItems.length}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  const handleLoadHistory = React.useCallback(
    (entry: HistoryEntry) => {
      const { inputs, params } = entry
      if (inputs.content !== undefined) setParam("content", inputs.content)
      if (params.count !== undefined) setParam("count", params.count as number)
      if (params.datacenterId !== undefined) setParam("datacenterId", params.datacenterId as number)
      if (params.workerId !== undefined) setParam("workerId", params.workerId as number)
      if (params.timestampBits !== undefined) setParam("timestampBits", params.timestampBits as number)
      if (params.datacenterBits !== undefined) setParam("datacenterBits", params.datacenterBits as number)
      if (params.workerBits !== undefined) setParam("workerBits", params.workerBits as number)
      if (params.sequenceBits !== undefined) setParam("sequenceBits", params.sequenceBits as number)
      if (params.startTimeMs !== undefined) setParam("startTimeMs", params.startTimeMs as number)
      if (params.timestampOffsetMs !== undefined) setParam("timestampOffsetMs", params.timestampOffsetMs as number)
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
        config={config}
        parseError={parseError}
        parsedItems={parsedItems}
        copied={copied}
        parsedCopied={parsedCopied}
        handleContentChange={handleContentChange}
        handleCopy={handleCopy}
        handleDownload={handleDownload}
        handleParsedCopy={handleParsedCopy}
        handleParsedDownload={handleParsedDownload}
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
  config,
  parseError,
  parsedItems,
  copied,
  parsedCopied,
  handleContentChange,
  handleCopy,
  handleDownload,
  handleParsedCopy,
  handleParsedDownload,
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
  config: SnowflakeConfig
  parseError: string | null
  parsedItems: ParsedSnowflakeItem[]
  copied: boolean
  parsedCopied: boolean
  handleContentChange: (value: string) => void
  handleCopy: () => void
  handleDownload: () => void
  handleParsedCopy: () => void
  handleParsedDownload: () => void
}) {
  const { upsertInputEntry, upsertParams } = useToolHistoryContext()
  const lastSavedRef = React.useRef<string>("")
  const hasHydratedInputRef = React.useRef(false)
  const paramsRef = React.useRef<SnowflakeHistoryParams>({
    count: state.count,
    datacenterId: state.datacenterId,
    workerId: state.workerId,
    timestampBits: state.timestampBits,
    datacenterBits: state.datacenterBits,
    workerBits: state.workerBits,
    sequenceBits: state.sequenceBits,
    startTimeMs: state.startTimeMs,
    timestampOffsetMs: state.timestampOffsetMs,
  })
  const hasInitializedParamsRef = React.useRef(false)
  const hasHandledUrlRef = React.useRef(false)
  const layout = React.useMemo(() => buildLayout(config), [config])
  const datacenterMax = React.useMemo(() => bigIntToSafeNumber(layout.datacenterMask), [layout.datacenterMask])
  const workerMax = React.useMemo(() => bigIntToSafeNumber(layout.workerMask), [layout.workerMask])
  const presetMatch = React.useMemo(() => matchPreset(state), [
    state.timestampBits,
    state.datacenterBits,
    state.workerBits,
    state.sequenceBits,
    state.startTimeMs,
    state.timestampOffsetMs,
  ])
  const startTimeIso = React.useMemo(() => {
    const date = new Date(state.startTimeMs)
    if (Number.isNaN(date.getTime())) return "Invalid start time"
    return date.toISOString()
  }, [state.startTimeMs])
  const startTimeDate = React.useMemo(() => {
    const date = new Date(state.startTimeMs)
    if (Number.isNaN(date.getTime())) return undefined
    return date
  }, [state.startTimeMs])
  const paramWarnings = React.useMemo(() => {
    const warnings: string[] = []
    if (layout.totalBits > MAX_BITS) {
      warnings.push(`Total bits (${layout.totalBits}) exceed ${MAX_BITS}-bit Snowflake IDs.`)
    }
    if (BigInt(state.datacenterId) > layout.datacenterMask) {
      warnings.push(
        `Datacenter ID exceeds ${state.datacenterBits}-bit max (${layout.datacenterMask.toString()}).`,
      )
    }
    if (BigInt(state.workerId) > layout.workerMask) {
      warnings.push(`Worker ID exceeds ${state.workerBits}-bit max (${layout.workerMask.toString()}).`)
    }
    const now = BigInt(Date.now())
    const maxTimestampMs = BigInt(state.startTimeMs) + layout.timestampMask * BigInt(state.timestampOffsetMs)
    if (now < BigInt(state.startTimeMs)) {
      warnings.push("Start time is in the future; generation will fail.")
    } else if (now > maxTimestampMs) {
      warnings.push("Current time exceeds the configured timestamp range.")
    }
    return warnings
  }, [
    layout.datacenterMask,
    layout.workerMask,
    layout.timestampMask,
    layout.totalBits,
    state.datacenterId,
    state.workerId,
    state.datacenterBits,
    state.workerBits,
    state.startTimeMs,
    state.timestampOffsetMs,
  ])
  const historyParams = React.useMemo<SnowflakeHistoryParams>(
    () => ({
      count: state.count,
      datacenterId: state.datacenterId,
      workerId: state.workerId,
      timestampBits: state.timestampBits,
      datacenterBits: state.datacenterBits,
      workerBits: state.workerBits,
      sequenceBits: state.sequenceBits,
      startTimeMs: state.startTimeMs,
      timestampOffsetMs: state.timestampOffsetMs,
    }),
    [
      state.count,
      state.datacenterId,
      state.workerId,
      state.timestampBits,
      state.datacenterBits,
      state.workerBits,
      state.sequenceBits,
      state.startTimeMs,
      state.timestampOffsetMs,
    ],
  )
  const [generationError, setGenerationError] = React.useState<string | null>(null)

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
        historyParams,
        "left",
        state.content ? state.content.slice(0, 100) : `x${historyParams.count}`,
      )
    }, DEFAULT_URL_SYNC_DEBOUNCE_MS)

    return () => clearTimeout(timer)
  }, [state.content, historyParams, upsertInputEntry])

  React.useEffect(() => {
    if (hasUrlParams && !hasHandledUrlRef.current) {
      hasHandledUrlRef.current = true
      if (state.content) {
        upsertInputEntry(
          { content: state.content },
          historyParams,
          "left",
          state.content.slice(0, 100),
        )
      } else {
        upsertParams(historyParams, "deferred")
      }
    }
  }, [hasUrlParams, state.content, historyParams, upsertInputEntry, upsertParams])

  React.useEffect(() => {
    const nextParams = historyParams
    if (!hasInitializedParamsRef.current) {
      hasInitializedParamsRef.current = true
      paramsRef.current = nextParams
      return
    }
    if (
      paramsRef.current.count === nextParams.count &&
      paramsRef.current.datacenterId === nextParams.datacenterId &&
      paramsRef.current.workerId === nextParams.workerId &&
      paramsRef.current.timestampBits === nextParams.timestampBits &&
      paramsRef.current.datacenterBits === nextParams.datacenterBits &&
      paramsRef.current.workerBits === nextParams.workerBits &&
      paramsRef.current.sequenceBits === nextParams.sequenceBits &&
      paramsRef.current.startTimeMs === nextParams.startTimeMs &&
      paramsRef.current.timestampOffsetMs === nextParams.timestampOffsetMs
    ) {
      return
    }
    paramsRef.current = nextParams
    upsertParams(nextParams, "deferred")
  }, [historyParams, upsertParams])

  const handleGenerate = React.useCallback(() => {
    try {
      const ids = generateSnowflakeIds(state.count, state.datacenterId, state.workerId, config)
      const content = ids.join("\n")
      setParam("content", content)

      lastSavedRef.current = content
      upsertInputEntry({ content }, historyParams, "left", content.slice(0, 100))
      setGenerationError(null)
    } catch (error) {
      setGenerationError(error instanceof Error ? error.message : "Unable to generate Snowflake IDs.")
    }
  }, [state.count, state.datacenterId, state.workerId, config, setParam, upsertInputEntry, historyParams])

  const handleCountChange = React.useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      let value = Number.parseInt(e.target.value, 10)
      if (Number.isNaN(value)) value = 1
      value = clampValue(value, 1, 1000)
      setParam("count", value, true)
    },
    [setParam],
  )

  const handleDatacenterChange = React.useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      let value = Number.parseInt(e.target.value, 10)
      if (Number.isNaN(value)) value = 0
      value = clampValue(value, 0, datacenterMax)
      setParam("datacenterId", value, true)
    },
    [datacenterMax, setParam],
  )

  const handleWorkerChange = React.useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      let value = Number.parseInt(e.target.value, 10)
      if (Number.isNaN(value)) value = 0
      value = clampValue(value, 0, workerMax)
      setParam("workerId", value, true)
    },
    [workerMax, setParam],
  )

  const handleTimestampBitsChange = React.useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      let value = Number.parseInt(e.target.value, 10)
      if (Number.isNaN(value)) value = 1
      value = clampValue(value, 1, MAX_BITS)
      setParam("timestampBits", value, true)
    },
    [setParam],
  )

  const handleDatacenterBitsChange = React.useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      let value = Number.parseInt(e.target.value, 10)
      if (Number.isNaN(value)) value = 0
      value = clampValue(value, 0, MAX_BITS)
      setParam("datacenterBits", value, true)
    },
    [setParam],
  )

  const handleWorkerBitsChange = React.useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      let value = Number.parseInt(e.target.value, 10)
      if (Number.isNaN(value)) value = 0
      value = clampValue(value, 0, MAX_BITS)
      setParam("workerBits", value, true)
    },
    [setParam],
  )

  const handleSequenceBitsChange = React.useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      let value = Number.parseInt(e.target.value, 10)
      if (Number.isNaN(value)) value = 0
      value = clampValue(value, 0, MAX_BITS)
      setParam("sequenceBits", value, true)
    },
    [setParam],
  )

  const handleStartTimeChange = React.useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      let value = Number.parseInt(e.target.value, 10)
      if (Number.isNaN(value)) value = SNOWFLAKE_EPOCH_MS
      value = Math.max(0, value)
      setParam("startTimeMs", value, true)
    },
    [setParam],
  )

  const handleStartTimeDateChange = React.useCallback(
    (pickedDate: Date | undefined) => {
      if (!pickedDate) return
      setParam("startTimeMs", pickedDate.getTime(), true)
    },
    [setParam],
  )

  const handleTimestampOffsetChange = React.useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      let value = Number.parseInt(e.target.value, 10)
      if (Number.isNaN(value)) value = 1
      value = clampValue(value, 1, 1000)
      setParam("timestampOffsetMs", value, true)
    },
    [setParam],
  )

  const handlePresetChange = React.useCallback(
    (presetId: SnowflakePreset["id"]) => {
      const preset = SNOWFLAKE_PRESETS.find((item) => item.id === presetId) ?? DEFAULT_PRESET
      setParam("timestampBits", preset.params.timestampBits, true)
      setParam("datacenterBits", preset.params.datacenterBits, true)
      setParam("workerBits", preset.params.workerBits, true)
      setParam("sequenceBits", preset.params.sequenceBits, true)
      setParam("startTimeMs", preset.params.startTimeMs, true)
      setParam("timestampOffsetMs", preset.params.timestampOffsetMs, true)
      setParam("datacenterId", preset.defaults.datacenterId, true)
      setParam("workerId", preset.defaults.workerId, true)
    },
    [setParam],
  )

  const singleParsedItem = parsedItems.length === 1 ? parsedItems[0] : null
  const singleParsed = singleParsedItem?.result ?? null
  const singleParsedError = singleParsedItem?.error ?? null
  const hasMultipleParsed = parsedItems.length > 1

  return (
    <div className="flex flex-col gap-4">
      <Card>
        <CardContent className="space-y-4 p-4">
          <div className="flex flex-wrap items-center gap-3">
            <Label className="text-sm whitespace-nowrap">Preset</Label>
            <Tabs
              value={presetMatch?.id ?? "custom"}
              onValueChange={(value) => {
                if (value === "twitter" || value === "sony") {
                  handlePresetChange(value)
                }
              }}
            >
              <TabsList className="h-8">
                {SNOWFLAKE_PRESETS.map((preset) => (
                  <TabsTrigger key={preset.id} value={preset.id} className="text-xs">
                    {preset.label}
                  </TabsTrigger>
                ))}
              </TabsList>
            </Tabs>
            <span className="text-xs text-muted-foreground">Total bits: {layout.totalBits}</span>
          </div>

          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <div className="flex items-center gap-2">
              <Label htmlFor="timestampBits" className="text-sm whitespace-nowrap">
                Timestamp Bits
              </Label>
              <Input
                id="timestampBits"
                type="number"
                min={1}
                max={MAX_BITS}
                value={state.timestampBits}
                onChange={handleTimestampBitsChange}
                className="w-24"
              />
            </div>

            <div className="flex items-center gap-2">
              <Label htmlFor="datacenterBits" className="text-sm whitespace-nowrap">
                Datacenter Bits
              </Label>
              <Input
                id="datacenterBits"
                type="number"
                min={0}
                max={MAX_BITS}
                value={state.datacenterBits}
                onChange={handleDatacenterBitsChange}
                className="w-24"
              />
            </div>

            <div className="flex items-center gap-2">
              <Label htmlFor="workerBits" className="text-sm whitespace-nowrap">
                Worker Bits
              </Label>
              <Input
                id="workerBits"
                type="number"
                min={0}
                max={MAX_BITS}
                value={state.workerBits}
                onChange={handleWorkerBitsChange}
                className="w-24"
              />
            </div>

            <div className="flex items-center gap-2">
              <Label htmlFor="sequenceBits" className="text-sm whitespace-nowrap">
                Sequence Bits
              </Label>
              <Input
                id="sequenceBits"
                type="number"
                min={0}
                max={MAX_BITS}
                value={state.sequenceBits}
                onChange={handleSequenceBitsChange}
                className="w-24"
              />
            </div>

            <div className="flex items-center gap-2">
              <Label htmlFor="startTimeMs" className="text-sm whitespace-nowrap">
                Start Time (ms)
              </Label>
              <div className="relative">
                <Input
                  id="startTimeMs"
                  type="number"
                  min={0}
                  value={state.startTimeMs}
                  onChange={handleStartTimeChange}
                  className="w-48 pr-10"
                />
                <div className="absolute right-0 top-1/2 -translate-y-1/2">
                  <DateTimePicker
                    date={startTimeDate}
                    setDate={handleStartTimeDateChange}
                    iconOnly
                    buttonLabel="Pick start time"
                  />
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <Label htmlFor="timestampOffsetMs" className="text-sm whitespace-nowrap">
                Timestamp Offset (ms)
              </Label>
              <Input
                id="timestampOffsetMs"
                type="number"
                min={1}
                max={1000}
                value={state.timestampOffsetMs}
                onChange={handleTimestampOffsetChange}
                className="w-24"
              />
            </div>
          </div>

          {paramWarnings.length > 0 && (
            <div className="space-y-1 text-xs text-destructive">
              {paramWarnings.map((warning) => (
                <p key={warning}>{warning}</p>
              ))}
            </div>
          )}
          {generationError && <p className="text-xs text-destructive">{generationError}</p>}

          <div className="flex flex-wrap items-center gap-4">
            <div className="flex items-center gap-2">
              <Label htmlFor="datacenterId" className="text-sm whitespace-nowrap">
                Datacenter ID
              </Label>
              <Input
                id="datacenterId"
                type="number"
                min={0}
                max={datacenterMax}
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
                max={workerMax}
                value={state.workerId}
                onChange={handleWorkerChange}
                className="w-24"
              />
            </div>

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
          </div>
        </CardContent>
      </Card>

      <p className="text-xs text-muted-foreground">
        Start time: {startTimeIso}. Timestamp offset: {state.timestampOffsetMs} ms per tick.
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
          <div className="flex items-center justify-between">
            <Label className="text-sm font-medium">Parsed Information</Label>
            <div className="flex items-center gap-1">
              {hasMultipleParsed ? (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleParsedDownload}
                  disabled={!parsedItems.length}
                  className="h-7 gap-1 px-2 text-xs"
                >
                  <Download className="h-3 w-3" />
                  Download CSV
                </Button>
              ) : (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleParsedCopy}
                  disabled={!singleParsed}
                  className="h-7 gap-1 px-2 text-xs"
                >
                  {parsedCopied ? (
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
              )}
            </div>
          </div>

          {parsedItems.length ? (
            hasMultipleParsed ? (
              <Card>
                <CardContent className="p-4">
                  <div className="w-full overflow-x-auto">
                    <table className="min-w-[900px] table-fixed text-sm">
                      <thead className="text-xs text-muted-foreground">
                        <tr>
                          <th className="px-2 py-2 text-left font-medium">Snowflake ID</th>
                          <th className="px-2 py-2 text-left font-medium">Timestamp</th>
                          <th className="px-2 py-2 text-left font-medium">Offset</th>
                          <th className="px-2 py-2 text-left font-medium">Datacenter</th>
                          <th className="px-2 py-2 text-left font-medium">Worker</th>
                          <th className="px-2 py-2 text-left font-medium">Sequence</th>
                          <th className="px-2 py-2 text-left font-medium">Overflow</th>
                          <th className="px-2 py-2 text-left font-medium">Error</th>
                        </tr>
                      </thead>
                      <tbody>
                        {parsedItems.map((item, index) => {
                          const key = `${item.input}-${index}`
                          if (item.error || !item.result) {
                            return (
                              <tr key={key} className="border-t">
                                <td className="px-2 py-2 align-top break-all font-mono">{item.input}</td>
                                <td className="px-2 py-2 align-top text-muted-foreground">N/A</td>
                                <td className="px-2 py-2 align-top text-muted-foreground">N/A</td>
                                <td className="px-2 py-2 align-top text-muted-foreground">N/A</td>
                                <td className="px-2 py-2 align-top text-muted-foreground">N/A</td>
                                <td className="px-2 py-2 align-top text-muted-foreground">N/A</td>
                                <td className="px-2 py-2 align-top text-muted-foreground">N/A</td>
                                <td className="px-2 py-2 align-top text-destructive">{item.error ?? "Invalid"}</td>
                              </tr>
                            )
                          }
                          return (
                            <tr key={key} className="border-t">
                              <td className="px-2 py-2 align-top break-all font-mono">{item.result.id}</td>
                              <td className="px-2 py-2 align-top">
                                <div className="flex flex-col gap-1">
                                  <span className="break-all">{item.result.timestampIso}</span>
                                  <span className="text-xs font-mono text-muted-foreground">
                                    {item.result.timestampMs}
                                  </span>
                                </div>
                              </td>
                              <td className="px-2 py-2 align-top">
                                <div className="flex flex-col gap-1 font-mono">
                                  <span>{item.result.timestampOffsetTicks}</span>
                                  <span className="text-xs text-muted-foreground">{item.result.timestampOffsetMs}</span>
                                </div>
                              </td>
                              <td className="px-2 py-2 align-top font-mono">{item.result.datacenterId}</td>
                              <td className="px-2 py-2 align-top font-mono">{item.result.workerId}</td>
                              <td className="px-2 py-2 align-top font-mono">{item.result.sequence}</td>
                              <td className="px-2 py-2 align-top">
                                {item.result.overflow
                                  ? item.result.overflowReason ?? "Yes"
                                  : "No"}
                              </td>
                              <td className="px-2 py-2 align-top text-muted-foreground">N/A</td>
                            </tr>
                          )
                        })}
                      </tbody>
                    </table>
                  </div>
                </CardContent>
              </Card>
            ) : singleParsed ? (
              <Card>
                <CardContent className="space-y-3 p-4">
                  <InfoRow label="Snowflake ID" value={singleParsed.id} mono />
                  <InfoRow label="Timestamp (ISO)" value={singleParsed.timestampIso} />
                  <InfoRow label="Timestamp (ms)" value={String(singleParsed.timestampMs)} mono />
                  <InfoRow label="Timestamp Offset (ticks)" value={singleParsed.timestampOffsetTicks} mono />
                  <InfoRow label="Timestamp Offset (ms)" value={singleParsed.timestampOffsetMs} mono />
                  <InfoRow label="Datacenter ID" value={singleParsed.datacenterId} mono />
                  <InfoRow label="Worker ID" value={singleParsed.workerId} mono />
                  <InfoRow label="Sequence" value={singleParsed.sequence} mono />
                  <InfoRow
                    label="Overflow"
                    value={singleParsed.overflow ? singleParsed.overflowReason ?? "Yes" : "No"}
                  />
                </CardContent>
              </Card>
            ) : (
              <Card className="flex min-h-[300px] items-center justify-center">
                <p className="text-sm text-destructive">{singleParsedError ?? "Snowflake ID is invalid."}</p>
              </Card>
            )
          ) : (
            <Card className="flex min-h-[300px] items-center justify-center">
              <p className="text-sm text-muted-foreground">
                {state.content.trim()
                  ? "Enter one or more Snowflake IDs to parse"
                  : "Generate or paste Snowflake IDs to see parsed information"}
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
