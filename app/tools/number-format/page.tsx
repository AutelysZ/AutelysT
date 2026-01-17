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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { ArrowLeftRight, Check, Copy } from "lucide-react"
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
  const { state, setParam, oversizeKeys, hasUrlParams, hydrationSource } = useUrlSyncedState("number-format", {
    schema: paramsSchema,
    defaults: paramsSchema.parse({}),
    inputSide: {
      sideKey: "activeSide",
      inputKeyBySide: {
        left: "leftText",
        right: "rightText",
      },
    },
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
        oversizeKeys={oversizeKeys}
        hasUrlParams={hasUrlParams}
        hydrationSource={hydrationSource}
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
  oversizeKeys,
  hasUrlParams,
  hydrationSource,
  leftError,
  rightError,
  handleLeftChange,
  handleRightChange,
}: {
  state: z.infer<typeof paramsSchema>
  setParam: <K extends keyof z.infer<typeof paramsSchema>>(
    key: K,
    value: z.infer<typeof paramsSchema>[K],
    updateHistory?: boolean,
  ) => void
  oversizeKeys: (keyof z.infer<typeof paramsSchema>)[]
  hasUrlParams: boolean
  hydrationSource: "default" | "url" | "history"
  leftError: string | null
  rightError: string | null
  handleLeftChange: (value: string) => void
  handleRightChange: (value: string) => void
}) {
  const { upsertInputEntry, upsertParams } = useToolHistoryContext()
  const lastInputRef = React.useRef<string>("")
  const hasHydratedInputRef = React.useRef(false)
  const paramsRef = React.useRef({
    leftFormat: state.leftFormat,
    leftUnit: state.leftUnit,
    rightFormat: state.rightFormat,
    rightUnit: state.rightUnit,
    activeSide: state.activeSide,
  })
  const hasInitializedParamsRef = React.useRef(false)
  const hasHandledUrlRef = React.useRef(false)
  const [copiedSide, setCopiedSide] = React.useState<"left" | "right" | null>(null)

  const handleCopy = React.useCallback(
    async (side: "left" | "right") => {
      const value = side === "left" ? state.leftText : state.rightText
      if (!value) return
      try {
        await navigator.clipboard.writeText(value)
        setCopiedSide(side)
        setTimeout(() => setCopiedSide(null), 1500)
      } catch {}
    },
    [state.leftText, state.rightText],
  )

  React.useEffect(() => {
    if (hasHydratedInputRef.current) return
    if (hydrationSource === "default") return
    const activeText = state.activeSide === "left" ? state.leftText : state.rightText
    lastInputRef.current = activeText
    hasHydratedInputRef.current = true
  }, [hydrationSource, state.activeSide, state.leftText, state.rightText])

  React.useEffect(() => {
    const activeText = state.activeSide === "left" ? state.leftText : state.rightText
    if (!activeText || activeText === lastInputRef.current) return

    const timer = setTimeout(() => {
      lastInputRef.current = activeText
      upsertInputEntry(
        { leftText: state.leftText, rightText: state.rightText },
        {
          leftFormat: state.leftFormat,
          leftUnit: state.leftUnit,
          rightFormat: state.rightFormat,
          rightUnit: state.rightUnit,
          activeSide: state.activeSide,
        },
        state.activeSide,
        activeText.slice(0, 100),
      )
    }, DEFAULT_URL_SYNC_DEBOUNCE_MS)

    return () => clearTimeout(timer)
  }, [
    state.leftText,
    state.rightText,
    state.activeSide,
    state.leftFormat,
    state.leftUnit,
    state.rightFormat,
    state.rightUnit,
    upsertInputEntry,
  ])

  React.useEffect(() => {
    if (hasUrlParams && !hasHandledUrlRef.current) {
      hasHandledUrlRef.current = true
      const activeText = state.activeSide === "left" ? state.leftText : state.rightText
      if (activeText) {
        upsertInputEntry(
          { leftText: state.leftText, rightText: state.rightText },
          {
            leftFormat: state.leftFormat,
            leftUnit: state.leftUnit,
            rightFormat: state.rightFormat,
            rightUnit: state.rightUnit,
            activeSide: state.activeSide,
          },
          state.activeSide,
          activeText.slice(0, 100),
        )
      } else {
        upsertParams(
          {
            leftFormat: state.leftFormat,
            leftUnit: state.leftUnit,
            rightFormat: state.rightFormat,
            rightUnit: state.rightUnit,
            activeSide: state.activeSide,
          },
          "interpretation",
        )
      }
    }
  }, [
    hasUrlParams,
    state.leftText,
    state.rightText,
    state.activeSide,
    state.leftFormat,
    state.leftUnit,
    state.rightFormat,
    state.rightUnit,
    upsertInputEntry,
    upsertParams,
  ])

  React.useEffect(() => {
    const nextParams = {
      leftFormat: state.leftFormat,
      leftUnit: state.leftUnit,
      rightFormat: state.rightFormat,
      rightUnit: state.rightUnit,
      activeSide: state.activeSide,
    }
    if (!hasInitializedParamsRef.current) {
      hasInitializedParamsRef.current = true
      paramsRef.current = nextParams
      return
    }
    const same =
      paramsRef.current.leftFormat === nextParams.leftFormat &&
      paramsRef.current.leftUnit === nextParams.leftUnit &&
      paramsRef.current.rightFormat === nextParams.rightFormat &&
      paramsRef.current.rightUnit === nextParams.rightUnit &&
      paramsRef.current.activeSide === nextParams.activeSide
    if (same) return
    paramsRef.current = nextParams
    upsertParams(nextParams, "interpretation")
  }, [state.leftFormat, state.leftUnit, state.rightFormat, state.rightUnit, state.activeSide, upsertParams])

  const renderSidePanel = (side: "left" | "right") => {
    const isLeft = side === "left"
    const format = isLeft ? state.leftFormat : state.rightFormat
    const unit = isLeft ? state.leftUnit : state.rightUnit
    const text = isLeft ? state.leftText : state.rightText
    const error = isLeft ? leftError : rightError
    const isActive = state.activeSide === side
    const warning = oversizeKeys.includes(isLeft ? "leftText" : "rightText")
      ? "Input exceeds 2 KB and is not synced to the URL."
      : null

    const showUnitSelect = format === "engineering"

    return (
      <div className="flex flex-1 flex-col gap-3">
        <Card>
          <CardContent className="flex flex-col gap-3 p-4">
            <div className="flex items-center gap-2">
              <Label className="text-sm whitespace-nowrap">Format</Label>
              <div className="flex-1 min-w-0">
                <Select value={format} onValueChange={(v) => setParam(isLeft ? "leftFormat" : "rightFormat", v, true)}>
                  <SelectTrigger className="w-full">
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
            </div>

            {showUnitSelect && (
              <div className="flex items-center gap-2">
                <Label className="text-sm whitespace-nowrap">Unit</Label>
                <div className="flex-1 min-w-0">
                  <Select value={unit} onValueChange={(v) => setParam(isLeft ? "leftUnit" : "rightUnit", v, true)}>
                    <SelectTrigger className="w-full">
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
              </div>
            )}
          </CardContent>
        </Card>

        <div className="flex-1">
          <div className="relative">
            <Input
              value={text}
              onChange={(e) => (isLeft ? handleLeftChange(e.target.value) : handleRightChange(e.target.value))}
              placeholder="Enter number..."
              className={cn(
                "pr-10 font-mono",
                error && "border-destructive",
                isActive && "ring-1 ring-primary",
              )}
            />
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => handleCopy(side)}
              disabled={!text}
              className="absolute right-1 top-1/2 h-7 -translate-y-1/2 px-2 text-xs"
            >
              {copiedSide === side ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
            </Button>
          </div>
          {error && <p className="mt-1 text-xs text-destructive">{error}</p>}
          {warning && <p className="mt-1 text-xs text-muted-foreground">{warning}</p>}
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-4 md:min-h-[400px] md:flex-row">
      {renderSidePanel("left")}
      <div className="flex items-center justify-center">
        <ArrowLeftRight className="h-5 w-5 text-muted-foreground rotate-90 md:rotate-0" />
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
