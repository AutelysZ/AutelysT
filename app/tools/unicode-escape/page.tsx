"use client"

import * as React from "react"
import { Suspense } from "react"
import { z } from "zod"
import { ToolPageWrapper, useToolHistoryContext } from "@/components/tool-ui/tool-page-wrapper"
import { DualPaneLayout } from "@/components/tool-ui/dual-pane-layout"
import { DEFAULT_URL_SYNC_DEBOUNCE_MS, useUrlSyncedState } from "@/lib/url-state/use-url-synced-state"
import { Card, CardContent } from "@/components/ui/card"
import { Checkbox } from "@/components/ui/checkbox"
import { Label } from "@/components/ui/label"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  encodeUnicodeEscape,
  decodeUnicodeEscape,
  UNICODE_ESCAPE_MODES,
  type UnicodeEscapeMode,
} from "@/lib/encoding/unicode-escape"
import type { HistoryEntry } from "@/lib/history/db"

const paramsSchema = z.object({
  mode: z.enum(["all", "non-graphic-ascii", "non-graphic-latin"]).default("non-graphic-ascii"),
  upperCase: z.boolean().default(true),
  activeSide: z.enum(["left", "right"]).default("left"),
  leftText: z.string().default(""),
  rightText: z.string().default(""),
})

function UnicodeEscapeContent() {
  const { state, setParam, oversizeKeys, hasUrlParams, hydrationSource } = useUrlSyncedState("unicode-escape", {
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

  const encodeToUnicodeEscape = React.useCallback(
    (text: string) => {
      try {
        setLeftError(null)
        if (!text) {
          setParam("rightText", "")
          return
        }
        const encoded = encodeUnicodeEscape(text, {
          mode: state.mode as UnicodeEscapeMode,
          upperCase: state.upperCase,
        })
        setParam("rightText", encoded)
      } catch (err) {
        setLeftError(err instanceof Error ? err.message : "Encoding failed")
      }
    },
    [state.mode, state.upperCase, setParam],
  )

  const decodeFromUnicodeEscape = React.useCallback(
    (escaped: string) => {
      try {
        setRightError(null)
        if (!escaped) {
          setParam("leftText", "")
          return
        }
        const text = decodeUnicodeEscape(escaped)
        setParam("leftText", text)
      } catch (err) {
        setRightError(err instanceof Error ? err.message : "Decoding failed")
      }
    },
    [setParam],
  )

  const handleLeftChange = React.useCallback(
    (value: string) => {
      setParam("leftText", value)
      setParam("activeSide", "left")
      encodeToUnicodeEscape(value)
    },
    [setParam, encodeToUnicodeEscape],
  )

  const handleRightChange = React.useCallback(
    (value: string) => {
      setParam("rightText", value)
      setParam("activeSide", "right")
      decodeFromUnicodeEscape(value)
    },
    [setParam, decodeFromUnicodeEscape],
  )

  React.useEffect(() => {
    if (state.activeSide === "left" && state.leftText) {
      encodeToUnicodeEscape(state.leftText)
    } else if (state.activeSide === "right" && state.rightText) {
      decodeFromUnicodeEscape(state.rightText)
    }
  }, [state.mode, state.upperCase])

  const handleLoadHistory = React.useCallback(
    (entry: HistoryEntry) => {
      const { inputs, params } = entry
      if (inputs.leftText !== undefined) setParam("leftText", inputs.leftText)
      if (inputs.rightText !== undefined) setParam("rightText", inputs.rightText)
      if (params.mode) setParam("mode", params.mode as UnicodeEscapeMode)
      if (params.upperCase !== undefined) setParam("upperCase", params.upperCase as boolean)
      if (params.activeSide) setParam("activeSide", params.activeSide as "left" | "right")
    },
    [setParam],
  )

  return (
    <ToolPageWrapper
      toolId="unicode-escape"
      title="Unicode Escape"
      description="Encode and decode Unicode escape sequences (\\uXXXX format)"
      onLoadHistory={handleLoadHistory}
    >
      <UnicodeEscapeInner
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

function UnicodeEscapeInner({
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
    mode: state.mode,
    upperCase: state.upperCase,
    activeSide: state.activeSide,
  })
  const hasInitializedParamsRef = React.useRef(false)
  const hasHandledUrlRef = React.useRef(false)

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
        { mode: state.mode, upperCase: state.upperCase, activeSide: state.activeSide },
        state.activeSide,
        activeText.slice(0, 100),
      )
    }, DEFAULT_URL_SYNC_DEBOUNCE_MS)

    return () => clearTimeout(timer)
  }, [state.leftText, state.rightText, state.activeSide, state.mode, state.upperCase, upsertInputEntry])

  React.useEffect(() => {
    if (hasUrlParams && !hasHandledUrlRef.current) {
      hasHandledUrlRef.current = true
      const activeText = state.activeSide === "left" ? state.leftText : state.rightText
      if (activeText) {
        upsertInputEntry(
          { leftText: state.leftText, rightText: state.rightText },
          { mode: state.mode, upperCase: state.upperCase, activeSide: state.activeSide },
          state.activeSide,
          activeText.slice(0, 100),
        )
      } else {
        upsertParams(
          { mode: state.mode, upperCase: state.upperCase, activeSide: state.activeSide },
          "interpretation",
        )
      }
    }
  }, [
    hasUrlParams,
    state.leftText,
    state.rightText,
    state.activeSide,
    state.mode,
    state.upperCase,
    upsertInputEntry,
    upsertParams,
  ])

  React.useEffect(() => {
    const nextParams = {
      mode: state.mode,
      upperCase: state.upperCase,
      activeSide: state.activeSide,
    }
    if (!hasInitializedParamsRef.current) {
      hasInitializedParamsRef.current = true
      paramsRef.current = nextParams
      return
    }
    if (
      paramsRef.current.mode === nextParams.mode &&
      paramsRef.current.upperCase === nextParams.upperCase &&
      paramsRef.current.activeSide === nextParams.activeSide
    ) {
      return
    }
    paramsRef.current = nextParams
    upsertParams(nextParams, "interpretation")
  }, [state.mode, state.upperCase, state.activeSide, upsertParams])

  const leftWarning = oversizeKeys.includes("leftText")
    ? "Input exceeds 2 KB and is not synced to the URL."
    : null
  const rightWarning = oversizeKeys.includes("rightText")
    ? "Input exceeds 2 KB and is not synced to the URL."
    : null

  return (
    <DualPaneLayout
      leftLabel="Plain Text"
      rightLabel="Unicode Escape"
      leftValue={state.leftText}
      rightValue={state.rightText}
      onLeftChange={handleLeftChange}
      onRightChange={handleRightChange}
      activeSide={state.activeSide}
      leftError={leftError}
      rightError={rightError}
      leftWarning={leftWarning}
      rightWarning={rightWarning}
      leftPlaceholder="Enter text to encode..."
      rightPlaceholder="Enter unicode escape to decode (e.g., \u0048\u0065\u006C\u006C\u006F)..."
    >
      <Card>
        <CardContent className="flex flex-wrap items-center gap-6 p-4">
          <div className="flex items-center gap-2">
            <Label className="text-sm whitespace-nowrap">Escape Mode</Label>
            <Tabs
              value={state.mode}
              onValueChange={(v) => setParam("mode", v as UnicodeEscapeMode, true)}
            >
              <TabsList>
                {UNICODE_ESCAPE_MODES.map((m) => (
                  <TabsTrigger key={m.value} value={m.value} className="text-xs">
                    {m.label}
                  </TabsTrigger>
                ))}
              </TabsList>
            </Tabs>
          </div>
          <div className="flex items-center gap-2">
            <Checkbox
              id="upperCase"
              checked={state.upperCase}
              onCheckedChange={(c) => setParam("upperCase", c === true, true)}
            />
            <Label htmlFor="upperCase" className="text-sm cursor-pointer">
              Upper case
            </Label>
          </div>
        </CardContent>
      </Card>
    </DualPaneLayout>
  )
}

export default function UnicodeEscapePage() {
  return (
    <Suspense fallback={null}>
      <UnicodeEscapeContent />
    </Suspense>
  )
}
