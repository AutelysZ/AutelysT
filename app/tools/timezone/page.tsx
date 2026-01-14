"use client"

import * as React from "react"
import { Suspense } from "react"
import { z } from "zod"
import { Clock, Copy, Check } from "lucide-react"
import { ToolPageWrapper, useToolHistoryContext } from "@/components/tool-ui/tool-page-wrapper"
import { useUrlSyncedState } from "@/lib/url-state/use-url-synced-state"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { SearchableSelect } from "@/components/ui/searchable-select"
import { DateTimePicker } from "@/components/ui/date-time-picker"
import { Label } from "@/components/ui/label"
import {
  getAllTimezones,
  isUnixEpochTimezone,
  parseTimestamp,
  formatTimestamp,
  getFormattedOutputs,
} from "@/lib/timezone/timezone"
import type { HistoryEntry } from "@/lib/history/db"
import { cn } from "@/lib/utils"

const paramsSchema = z.object({
  leftTimezone: z.string().default("local"),
  rightTimezone: z.string().default("unix-s"),
  leftText: z.string().default(""),
  rightText: z.string().default(""),
  activeSide: z.enum(["left", "right"]).default("left"),
})

const timezones = getAllTimezones()

export default function TimezonePage() {
  return (
    <Suspense fallback={null}>
      <TimezoneContent />
    </Suspense>
  )
}

function TimezoneContent() {
  const { state, setParam } = useUrlSyncedState("timezone", {
    schema: paramsSchema,
    defaults: paramsSchema.parse({}),
  })

  const [leftError, setLeftError] = React.useState<string | null>(null)
  const [rightError, setRightError] = React.useState<string | null>(null)

  const handleLeftChange = React.useCallback(
    (value: string) => {
      setParam("leftText", value)
      setParam("activeSide", "left")
      setLeftError(null)

      if (!value) {
        setParam("rightText", "")
        return
      }

      const date = parseTimestamp(value, state.leftTimezone)
      if (!date) {
        setLeftError("Invalid date/time format")
        return
      }

      const formatted = formatTimestamp(date, state.rightTimezone)
      setParam("rightText", formatted)
    },
    [state.leftTimezone, state.rightTimezone, setParam],
  )

  const handleRightChange = React.useCallback(
    (value: string) => {
      setParam("rightText", value)
      setParam("activeSide", "right")
      setRightError(null)

      if (!value) {
        setParam("leftText", "")
        return
      }

      const date = parseTimestamp(value, state.rightTimezone)
      if (!date) {
        setRightError("Invalid date/time format")
        return
      }

      const formatted = formatTimestamp(date, state.leftTimezone)
      setParam("leftText", formatted)
    },
    [state.leftTimezone, state.rightTimezone, setParam],
  )

  const handleNow = React.useCallback(
    (side: "left" | "right") => {
      const now = new Date()

      if (side === "left") {
        const leftFormatted = formatTimestamp(now, state.leftTimezone)
        const rightFormatted = formatTimestamp(now, state.rightTimezone)
        setParam("leftText", leftFormatted)
        setParam("rightText", rightFormatted)
        setParam("activeSide", "left")
      } else {
        const rightFormatted = formatTimestamp(now, state.rightTimezone)
        const leftFormatted = formatTimestamp(now, state.leftTimezone)
        setParam("rightText", rightFormatted)
        setParam("leftText", leftFormatted)
        setParam("activeSide", "right")
      }
    },
    [state.leftTimezone, state.rightTimezone, setParam],
  )

  const handleLoadHistory = React.useCallback(
    (entry: HistoryEntry) => {
      const { inputs, params } = entry
      if (inputs.leftText !== undefined) setParam("leftText", inputs.leftText)
      if (inputs.rightText !== undefined) setParam("rightText", inputs.rightText)
      if (params.leftTimezone) setParam("leftTimezone", params.leftTimezone as string)
      if (params.rightTimezone) setParam("rightTimezone", params.rightTimezone as string)
      if (params.activeSide) setParam("activeSide", params.activeSide as "left" | "right")
    },
    [setParam],
  )

  React.useEffect(() => {
    if (state.activeSide === "left" && state.leftText) {
      handleLeftChange(state.leftText)
    } else if (state.activeSide === "right" && state.rightText) {
      handleRightChange(state.rightText)
    }
  }, [state.leftTimezone, state.rightTimezone])

  return (
    <ToolPageWrapper
      toolId="timezone"
      title="Time Zone Converter"
      description="Convert times between different time zones with Unix epoch support"
      onLoadHistory={handleLoadHistory}
    >
      <TimezoneInner
        state={state}
        setParam={setParam}
        leftError={leftError}
        rightError={rightError}
        handleLeftChange={handleLeftChange}
        handleRightChange={handleRightChange}
        handleNow={handleNow}
      />
    </ToolPageWrapper>
  )
}

function TimezoneInner({
  state,
  setParam,
  leftError,
  rightError,
  handleLeftChange,
  handleRightChange,
  handleNow,
}: {
  state: z.infer<typeof paramsSchema>
  setParam: (key: string, value: unknown, updateHistory?: boolean) => void
  leftError: string | null
  rightError: string | null
  handleLeftChange: (value: string) => void
  handleRightChange: (value: string) => void
  handleNow: (side: "left" | "right") => void
}) {
  const { addHistoryEntry } = useToolHistoryContext()
  const lastInputRef = React.useRef<string>("")

  React.useEffect(() => {
    const activeText = state.activeSide === "left" ? state.leftText : state.rightText
    if (!activeText || activeText === lastInputRef.current) return

    const timer = setTimeout(() => {
      lastInputRef.current = activeText
      addHistoryEntry(
        { leftText: state.leftText, rightText: state.rightText },
        {
          leftTimezone: state.leftTimezone,
          rightTimezone: state.rightTimezone,
          activeSide: state.activeSide,
        },
        state.activeSide,
        activeText.slice(0, 100),
      )
    }, 1000)

    return () => clearTimeout(timer)
  }, [state.leftText, state.rightText, state.activeSide, state.leftTimezone, state.rightTimezone, addHistoryEntry])

  const leftDate = React.useMemo(() => {
    if (!state.leftText) return null
    return parseTimestamp(state.leftText, state.leftTimezone)
  }, [state.leftText, state.leftTimezone])

  const rightDate = React.useMemo(() => {
    if (!state.rightText) return null
    return parseTimestamp(state.rightText, state.rightTimezone)
  }, [state.rightText, state.rightTimezone])

  return (
    <div className="flex h-full flex-col gap-4">
      <div className="flex min-h-0 flex-1 gap-4">
        {/* Left Column */}
        <TimezonePaneColumn
          side="left"
          timezone={state.leftTimezone}
          text={state.leftText}
          error={leftError}
          isActive={state.activeSide === "left"}
          date={leftDate}
          onTimezoneChange={(v) => setParam("leftTimezone", v, true)}
          onTextChange={handleLeftChange}
          onNow={() => handleNow("left")}
          onFocus={() => setParam("activeSide", "left", true)}
        />

        {/* Divider */}
        <div className="flex shrink-0 items-center justify-center">
          <Clock className="h-5 w-5 text-muted-foreground" />
        </div>

        {/* Right Column */}
        <TimezonePaneColumn
          side="right"
          timezone={state.rightTimezone}
          text={state.rightText}
          error={rightError}
          isActive={state.activeSide === "right"}
          date={rightDate}
          onTimezoneChange={(v) => setParam("rightTimezone", v, true)}
          onTextChange={handleRightChange}
          onNow={() => handleNow("right")}
          onFocus={() => setParam("activeSide", "right", true)}
        />
      </div>
    </div>
  )
}

function TimezonePaneColumn({
  side,
  timezone,
  text,
  error,
  isActive,
  date,
  onTimezoneChange,
  onTextChange,
  onNow,
  onFocus,
}: {
  side: "left" | "right"
  timezone: string
  text: string
  error: string | null
  isActive: boolean
  date: Date | null
  onTimezoneChange: (v: string) => void
  onTextChange: (v: string) => void
  onNow: () => void
  onFocus: () => void
}) {
  const [copied, setCopied] = React.useState<string | null>(null)

  const handleCopy = async (value: string, key: string) => {
    await navigator.clipboard.writeText(value)
    setCopied(key)
    setTimeout(() => setCopied(null), 2000)
  }

  const handleDateTimeChange = React.useCallback(
    (pickedDate: Date | undefined) => {
      if (!pickedDate) return
      const formatted = formatTimestamp(pickedDate, timezone)
      onTextChange(formatted)
    },
    [timezone, onTextChange],
  )

  const currentDate = React.useMemo(() => {
    if (!text) return undefined
    const parsed = parseTimestamp(text, timezone)
    return parsed || undefined
  }, [text, timezone])

  const outputs = React.useMemo(() => {
    if (!date || isUnixEpochTimezone(timezone)) return null
    return getFormattedOutputs(date, timezone)
  }, [date, timezone])

  return (
    <div className="flex w-0 flex-1 flex-col gap-3">
      <div className="flex shrink-0 flex-wrap items-center gap-2">
        <SearchableSelect
          value={timezone}
          onValueChange={onTimezoneChange}
          options={timezones}
          placeholder="Select timezone..."
          searchPlaceholder="Search timezones..."
          triggerClassName="flex-1 min-w-[140px]"
          className="w-80"
        />
        <DateTimePicker date={currentDate} setDate={handleDateTimeChange} />
        <Button variant="outline" size="sm" onClick={onNow}>
          Now
        </Button>
      </div>

      {/* Row 2: Input without card wrapper */}
      <div className="shrink-0">
        <div className="mb-1 flex items-center justify-between">
          <Label className={cn("text-sm font-medium", isActive && "text-primary")}>
            {isUnixEpochTimezone(timezone) ? "Timestamp" : "Date & Time"}
          </Label>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => handleCopy(text, "input")}
            disabled={!text}
            className="h-7 gap-1 px-2 text-xs"
          >
            {copied === "input" ? (
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
        <Input
          value={text}
          onChange={(e) => onTextChange(e.target.value)}
          onFocus={onFocus}
          placeholder={
            isUnixEpochTimezone(timezone) ? "Enter unix timestamp..." : "Enter date/time or pick from calendar..."
          }
          className={cn("font-mono text-sm", error && "border-destructive", isActive && "ring-1 ring-primary")}
        />
        {error && <p className="mt-1 text-xs text-destructive">{error}</p>}
      </div>

      {outputs && (
        <div className="min-h-0 flex-1 space-y-2 overflow-auto text-sm">
          {Object.entries(outputs).map(([label, value]) => (
            <div key={label} className="group flex items-start gap-1">
              <span className="shrink-0 text-muted-foreground">{label}:</span>
              <code className="break-all text-muted-foreground">{value}</code>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => handleCopy(value, label)}
                className="h-5 w-5 shrink-0 opacity-0 transition-opacity group-hover:opacity-100"
                aria-label={`Copy ${label}`}
              >
                {copied === label ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
              </Button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
