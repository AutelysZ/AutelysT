"use client"

import * as React from "react"
import { Suspense } from "react"
import { z } from "zod"
import { Plus, X } from "lucide-react"
import { ToolPageWrapper, useToolHistoryContext } from "@/components/tool-ui/tool-page-wrapper"
import { DEFAULT_URL_SYNC_DEBOUNCE_MS, useUrlSyncedState } from "@/lib/url-state/use-url-synced-state"
import { Button } from "@/components/ui/button"
import { DateTimePicker } from "@/components/ui/date-time-picker"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { SearchableSelect } from "@/components/ui/searchable-select"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { getAllTimezones, formatTimestamp, parseTimestamp, isUnixEpochTimezone } from "@/lib/timezone/timezone"
import type { HistoryEntry } from "@/lib/history/db"

const paramsSchema = z.object({
  mode: z.enum(["live", "custom"]).default("live"),
  baseTime: z.string().default(""),
  zoneList: z
    .string()
    .default("local,UTC,America/New_York,Europe/London,Asia/Tokyo"),
})

const timezoneOptions = getAllTimezones().filter((tz) => !isUnixEpochTimezone(tz.value))
const timezoneMap = new Map(timezoneOptions.map((tz) => [tz.value, tz.label]))

function parseZoneList(value: string) {
  const seen = new Set<string>()
  const zones = value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean)
    .filter((item) => timezoneMap.has(item) || item === "UTC" || item === "local")
    .filter((item) => {
      if (seen.has(item)) return false
      seen.add(item)
      return true
    })
  return zones
}

function toZoneList(zones: string[]) {
  return zones.join(",")
}

export default function WorldClockPage() {
  return (
    <Suspense fallback={null}>
      <WorldClockContent />
    </Suspense>
  )
}

function WorldClockContent() {
  const { state, setParam, hasUrlParams, hydrationSource } = useUrlSyncedState("world-clock", {
    schema: paramsSchema,
    defaults: paramsSchema.parse({}),
  })

  const handleLoadHistory = React.useCallback(
    (entry: HistoryEntry) => {
      const { inputs, params } = entry
      if (inputs.baseTime !== undefined) setParam("baseTime", inputs.baseTime)
      if (params.mode) setParam("mode", params.mode as "live" | "custom")
      if (params.zoneList) setParam("zoneList", params.zoneList as string)
    },
    [setParam],
  )

  return (
    <ToolPageWrapper
      toolId="world-clock"
      title="World Clock"
      description="Track local and global time zones with live or custom reference time."
      onLoadHistory={handleLoadHistory}
    >
      <WorldClockInner
        state={state}
        setParam={setParam}
        hasUrlParams={hasUrlParams}
        hydrationSource={hydrationSource}
      />
    </ToolPageWrapper>
  )
}

function WorldClockInner({
  state,
  setParam,
  hasUrlParams,
  hydrationSource,
}: {
  state: z.infer<typeof paramsSchema>
  setParam: <K extends keyof z.infer<typeof paramsSchema>>(
    key: K,
    value: z.infer<typeof paramsSchema>[K],
    updateHistory?: boolean,
  ) => void
  hasUrlParams: boolean
  hydrationSource: "default" | "url" | "history"
}) {
  const { upsertInputEntry, upsertParams } = useToolHistoryContext()
  const [zoneToAdd, setZoneToAdd] = React.useState("local")
  const [customError, setCustomError] = React.useState<string | null>(null)
  const [tick, setTick] = React.useState(0)
  const lastInputRef = React.useRef("")
  const hasHydratedInputRef = React.useRef(false)
  const paramsRef = React.useRef({ mode: state.mode, zoneList: state.zoneList })
  const hasInitializedParamsRef = React.useRef(false)
  const hasHandledUrlRef = React.useRef(false)

  const zones = React.useMemo(() => parseZoneList(state.zoneList), [state.zoneList])

  React.useEffect(() => {
    if (state.mode !== "live") return
    const id = window.setInterval(() => setTick((prev) => prev + 1), 1000)
    return () => window.clearInterval(id)
  }, [state.mode])

  React.useEffect(() => {
    if (hasHydratedInputRef.current) return
    if (hydrationSource === "default") return
    lastInputRef.current = state.baseTime
    hasHydratedInputRef.current = true
  }, [hydrationSource, state.baseTime])

  React.useEffect(() => {
    if (state.mode !== "custom") return
    if (!state.baseTime || state.baseTime === lastInputRef.current) return

    const timer = setTimeout(() => {
      lastInputRef.current = state.baseTime
      upsertInputEntry(
        { baseTime: state.baseTime },
        { mode: state.mode, zoneList: state.zoneList },
        "left",
        state.baseTime.slice(0, 80),
      )
    }, DEFAULT_URL_SYNC_DEBOUNCE_MS)

    return () => clearTimeout(timer)
  }, [state.baseTime, state.mode, state.zoneList, upsertInputEntry])

  React.useEffect(() => {
    if (hasUrlParams && !hasHandledUrlRef.current) {
      hasHandledUrlRef.current = true
      if (state.mode === "custom" && state.baseTime) {
        upsertInputEntry(
          { baseTime: state.baseTime },
          { mode: state.mode, zoneList: state.zoneList },
          "left",
          state.baseTime.slice(0, 80),
        )
      } else {
        upsertParams({ mode: state.mode, zoneList: state.zoneList }, "interpretation")
      }
    }
  }, [hasUrlParams, state.baseTime, state.mode, state.zoneList, upsertInputEntry, upsertParams])

  React.useEffect(() => {
    const nextParams = { mode: state.mode, zoneList: state.zoneList }
    if (!hasInitializedParamsRef.current) {
      hasInitializedParamsRef.current = true
      paramsRef.current = nextParams
      return
    }
    if (paramsRef.current.mode === nextParams.mode && paramsRef.current.zoneList === nextParams.zoneList) {
      return
    }
    paramsRef.current = nextParams
    upsertParams(nextParams, "interpretation")
  }, [state.mode, state.zoneList, upsertParams])

  const referenceDate = React.useMemo(() => {
    if (state.mode === "live") {
      return new Date()
    }
    if (!state.baseTime) {
      return null
    }
    const parsed = parseTimestamp(state.baseTime, "local")
    return parsed
  }, [state.mode, state.baseTime, tick])

  React.useEffect(() => {
    if (state.mode === "live") {
      setCustomError(null)
      return
    }
    if (!state.baseTime) {
      setCustomError("Enter a date/time to use a custom reference.")
      return
    }
    const parsed = parseTimestamp(state.baseTime, "local")
    setCustomError(parsed ? null : "Invalid date/time format.")
  }, [state.mode, state.baseTime])

  const handleAddZone = React.useCallback(() => {
    if (!zoneToAdd) return
    if (zones.includes(zoneToAdd)) return
    const next = [...zones, zoneToAdd]
    setParam("zoneList", toZoneList(next), true)
  }, [zoneToAdd, zones, setParam])

  const handleRemoveZone = React.useCallback(
    (zone: string) => {
      const next = zones.filter((item) => item !== zone)
      setParam("zoneList", toZoneList(next), true)
    },
    [zones, setParam],
  )

  const handleCustomInput = React.useCallback(
    (value: string) => {
      setParam("baseTime", value)
    },
    [setParam],
  )

  const handlePick = React.useCallback(
    (date: Date | undefined) => {
      if (!date) return
      const formatted = formatTimestamp(date, "local")
      setParam("mode", "custom", true)
      setParam("baseTime", formatted)
    },
    [setParam],
  )

  return (
    <div className="flex w-full flex-col gap-6 py-6">
      <div className="grid gap-6 lg:grid-cols-[1fr_1.2fr]">
        <section className="flex flex-col gap-5">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-semibold">Reference Time</h2>
          </div>

          <div className="flex items-center gap-3">
            <Label className="w-28 shrink-0 text-sm">Mode</Label>
            <Tabs value={state.mode} onValueChange={(value) => setParam("mode", value as "live" | "custom", true)}>
              <TabsList>
                <TabsTrigger value="live">Live</TabsTrigger>
                <TabsTrigger value="custom">Custom</TabsTrigger>
              </TabsList>
            </Tabs>
          </div>

          <div className="flex items-center gap-3">
            <Label className="w-28 shrink-0 text-sm">Date & Time</Label>
            <div className="flex min-w-0 flex-1 items-center gap-2">
              <Input
                value={state.baseTime}
                onChange={(event) => handleCustomInput(event.target.value)}
                placeholder="YYYY-MM-DD HH:mm:ss"
                disabled={state.mode === "live"}
              />
              <DateTimePicker
                date={referenceDate ?? undefined}
                setDate={handlePick}
                iconOnly
                buttonLabel="Pick date/time"
              />
            </div>
          </div>
          {customError && <p className="text-xs text-destructive">{customError}</p>}

          <div className="flex flex-col gap-3">
            <Label className="text-sm">Time Zones</Label>
            <div className="flex flex-wrap items-center gap-2">
              <div className="min-w-[240px] flex-1">
                <SearchableSelect
                  value={zoneToAdd}
                  onValueChange={setZoneToAdd}
                  options={timezoneOptions}
                  placeholder="Select time zone..."
                  searchPlaceholder="Search time zones..."
                />
              </div>
              <Button variant="outline" onClick={handleAddZone}>
                <Plus className="h-4 w-4" />
                Add
              </Button>
            </div>
            <div className="flex flex-wrap gap-2">
              {zones.length > 0 ? (
                zones.map((zone) => (
                  <div key={zone} className="inline-flex items-center gap-2 rounded-md border px-2 py-1 text-xs">
                    <span>{timezoneMap.get(zone) ?? zone}</span>
                    <button
                      type="button"
                      className="text-muted-foreground hover:text-foreground"
                      onClick={() => handleRemoveZone(zone)}
                      aria-label={`Remove ${zone}`}
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </div>
                ))
              ) : (
                <span className="text-xs text-muted-foreground">No time zones selected.</span>
              )}
            </div>
          </div>
        </section>

        <section className="flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-semibold">World Clock</h2>
            <span className="text-xs text-muted-foreground">
              {state.mode === "live" ? "Live updates" : "Custom reference"}
            </span>
          </div>

          <div className="space-y-3">
            {referenceDate ? (
              zones.length > 0 ? (
                zones.map((zone) => (
                  <div
                    key={zone}
                    className="flex flex-col gap-1 rounded-lg border border-border px-4 py-3 sm:flex-row sm:items-center sm:justify-between"
                  >
                    <div className="flex flex-col gap-1">
                      <span className="text-sm font-medium">{timezoneMap.get(zone) ?? zone}</span>
                      <span className="text-xs text-muted-foreground">{zone}</span>
                    </div>
                    <div className="text-sm font-mono">{formatTimestamp(referenceDate, zone)}</div>
                  </div>
                ))
              ) : (
                <div className="rounded-lg border border-dashed border-border px-4 py-6 text-sm text-muted-foreground">
                  Add a time zone to see results.
                </div>
              )
            ) : (
              <div className="rounded-lg border border-dashed border-border px-4 py-6 text-sm text-muted-foreground">
                Enter a valid reference time to show world clock results.
              </div>
            )}
          </div>
        </section>
      </div>
    </div>
  )
}
