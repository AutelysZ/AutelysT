"use client"

import * as React from "react"
import { Suspense } from "react"
import { z } from "zod"
import { ToolPageWrapper, useToolHistoryContext } from "@/components/tool-ui/tool-page-wrapper"
import { useUrlSyncedState } from "@/lib/url-state/use-url-synced-state"
import { Card, CardContent } from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { ArrowLeftRight } from "lucide-react"
import {
  parseFormattedNumber,
  formatNumber,
  NUMBER_FORMATS,
  ENGINEERING_UNITS,
  type NumberFormat,
  type EngineeringUnit,
} from "@/lib/numbers/format"
import { cn } from "@/lib/utils"
import type { HistoryEntry } from "@/lib/history/db"

const paramsSchema = z.object({
  leftFormat: z.string().default("plain"),
  leftUnit: z.string().default("h"),
  rightFormat: z.string().default("comma"),
  rightUnit: z.string().default("h"),
  activeSide: z.enum(["left", "right"]).default("left"),
  leftText: z.string().default(""),
  rightText: z.string().default(""),
})

function NumberFormatContent() {
  const { state, setParam } = useUrlSyncedState("number-format", {
    schema: paramsSchema,
    defaults: paramsSchema.parse({}),
  })

  const [leftError, setLeftError] = React.useState<string | null>(null)
  const [rightError, setRightError] = React.useState<string | null>(null)

  const convertValue = React.useCallback(
    (value: string, fromSide: "left" | "right") => {
      const toSide = fromSide === "left" ? "right" : "left"
      const fromFormat = (fromSide === "left" ? state.leftFormat : state.rightFormat) as NumberFormat
      const toFormat = (toSide === "left" ? state.leftFormat : state.rightFormat) as NumberFormat
      const toUnit = (toSide === "left" ? state.leftUnit : state.rightUnit) as EngineeringUnit

      try {
        if (fromSide === "left") setLeftError(null)
        else setRightError(null)

        if (!value.trim()) {
          setParam(toSide === "left" ? "leftText" : "rightText", "")
          return
        }

        const num = parseFormattedNumber(value, fromFormat)
        if (isNaN(num)) {
          throw new Error("Invalid number format")
        }

        const result = formatNumber(num, toFormat, toUnit)
        setParam(toSide === "left" ? "leftText" : "rightText", result)
      } catch (err) {
        if (fromSide === "left") setLeftError(err instanceof Error ? err.message : "Conversion failed")
        else setRightError(err instanceof Error ? err.message : "Conversion failed")
      }
    },
    [state, setParam],
  )

  const handleLeftChange = React.useCallback(
    (value: string) => {
      setParam("leftText", value)
      setParam("activeSide", "left")
      convertValue(value, "left")
    },
    [setParam, convertValue],
  )

  const handleRightChange = React.useCallback(
    (value: string) => {
      setParam("rightText", value)
      setParam("activeSide", "right")
      convertValue(value, "right")
    },
    [setParam, convertValue],
  )

  // Reconvert when format changes
  React.useEffect(() => {
    if (state.activeSide === "left" && state.leftText) {
      convertValue(state.leftText, "left")
    } else if (state.activeSide === "right" && state.rightText) {
      convertValue(state.rightText, "right")
    }
  }, [state.leftFormat, state.leftUnit, state.rightFormat, state.rightUnit])

  const handleLoadHistory = React.useCallback(
    (entry: HistoryEntry) => {
      const { inputs, params } = entry
      if (inputs.leftText !== undefined) setParam("leftText", inputs.leftText)
      if (inputs.rightText !== undefined) setParam("rightText", inputs.rightText)
      if (params.activeSide) setParam("activeSide", params.activeSide as "left" | "right")
      if (params.leftFormat) setParam("leftFormat", params.leftFormat as string)
      if (params.rightFormat) setParam("rightFormat", params.rightFormat as string)
    },
    [setParam],
  )

  return (
    <ToolPageWrapper
      toolId="number-format"
      title="Number Format"
      description="Convert between different number formatting styles"
      onLoadHistory={handleLoadHistory}
    >
      <NumberFormatInner
        state={state}
        setParam={setParam}
        leftError={leftError}
        rightError={rightError}
        handleLeftChange={handleLeftChange}
        handleRightChange={handleRightChange}
      />
    </ToolPageWrapper>
  )
}

function NumberFormatInner({
  state,
  setParam,
  leftError,
  rightError,
  handleLeftChange,
  handleRightChange,
}: {
  state: z.infer<typeof paramsSchema>
  setParam: (key: string, value: unknown, updateHistory?: boolean) => void
  leftError: string | null
  rightError: string | null
  handleLeftChange: (value: string) => void
  handleRightChange: (value: string) => void
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
        { leftFormat: state.leftFormat, rightFormat: state.rightFormat, activeSide: state.activeSide },
        state.activeSide,
        activeText.slice(0, 100),
      )
    }, 1000)

    return () => clearTimeout(timer)
  }, [state.leftText, state.rightText, state.activeSide, state.leftFormat, state.rightFormat, addHistoryEntry])

  const renderSidePanel = (side: "left" | "right") => {
    const isLeft = side === "left"
    const format = isLeft ? state.leftFormat : state.rightFormat
    const unit = isLeft ? state.leftUnit : state.rightUnit
    const text = isLeft ? state.leftText : state.rightText
    const error = isLeft ? leftError : rightError
    const isActive = state.activeSide === side

    const showUnitSelect = format === "engineering"

    return (
      <div className="flex flex-1 flex-col gap-3">
        <Card>
          <CardContent className="flex flex-wrap items-center gap-4 p-4">
            <div className="flex items-center gap-2">
              <Label className="text-sm whitespace-nowrap">Format</Label>
              <Select value={format} onValueChange={(v) => setParam(isLeft ? "leftFormat" : "rightFormat", v, true)}>
                <SelectTrigger className="w-56">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {NUMBER_FORMATS.map((f) => (
                    <SelectItem key={f.value} value={f.value}>
                      {f.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {showUnitSelect && (
              <div className="flex items-center gap-2">
                <Label className="text-sm whitespace-nowrap">Unit</Label>
                <Select value={unit} onValueChange={(v) => setParam(isLeft ? "leftUnit" : "rightUnit", v, true)}>
                  <SelectTrigger className="w-40">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {ENGINEERING_UNITS.map((u) => (
                      <SelectItem key={u.value} value={u.value}>
                        {u.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
          </CardContent>
        </Card>

        <div className="flex-1">
          <Textarea
            value={text}
            onChange={(e) => (isLeft ? handleLeftChange(e.target.value) : handleRightChange(e.target.value))}
            onFocus={() => setParam("activeSide", side, true)}
            placeholder="Enter number..."
            className={cn(
              "h-full min-h-[150px] resize-none font-mono",
              error && "border-destructive",
              isActive && "ring-1 ring-primary",
            )}
          />
          {error && <p className="mt-1 text-xs text-destructive">{error}</p>}
        </div>
      </div>
    )
  }

  return (
    <div className="flex min-h-[400px] gap-4">
      {renderSidePanel("left")}
      <div className="flex items-center">
        <ArrowLeftRight className="h-5 w-5 text-muted-foreground" />
      </div>
      {renderSidePanel("right")}
    </div>
  )
}

export default function NumberFormatPage() {
  return (
    <Suspense fallback={null}>
      <NumberFormatContent />
    </Suspense>
  )
}
