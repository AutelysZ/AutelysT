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
import { SearchableSelect } from "@/components/ui/searchable-select"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { encodeUrlEscape, decodeUrlEscape, isValidUrlEscape, type EncodeMode } from "@/lib/encoding/url-escape"
import { encodeText, decodeText, getAllEncodings } from "@/lib/encoding/text-encodings"
import type { HistoryEntry } from "@/lib/history/db"

const paramsSchema = z.object({
  encoding: z.string().default("UTF-8"),
  upperCase: z.boolean().default(true),
  mode: z.enum(["all", "component", "reserved"]).default("all"),
  activeSide: z.enum(["left", "right"]).default("left"),
  leftText: z.string().default(""),
  rightText: z.string().default(""),
})

const encodings = getAllEncodings()

const modeOptions = [
  { value: "all", label: "Encode All", description: "Encode all bytes to %XX" },
  { value: "component", label: "Component", description: "Keep unreserved chars (A-Z, a-z, 0-9, -, ., _, ~)" },
  { value: "reserved", label: "Keep Reserved", description: "Keep unreserved + reserved chars (: / ? # etc.)" },
]

function UrlEscapeContent() {
  const { state, setParam, oversizeKeys, hasUrlParams, hydrationSource } = useUrlSyncedState("url-escape", {
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
  const [leftFileResult, setLeftFileResult] = React.useState<{
    status: "success" | "error"
    message: string
    downloadUrl?: string
    downloadName?: string
  } | null>(null)
  const [rightFileResult, setRightFileResult] = React.useState<{
    status: "success" | "error"
    message: string
    downloadUrl?: string
    downloadName?: string
  } | null>(null)

  const encodeToUrlEscape = React.useCallback(
    (text: string) => {
      try {
        setLeftError(null)
        if (!text) {
          setParam("rightText", "")
          return
        }
        const bytes = encodeText(text, state.encoding)
        const encoded = encodeUrlEscape(bytes, { upperCase: state.upperCase, mode: state.mode as EncodeMode })
        setParam("rightText", encoded)
      } catch (err) {
        setLeftError(err instanceof Error ? err.message : "Encoding failed")
      }
    },
    [state.encoding, state.upperCase, state.mode, setParam],
  )

  const decodeFromUrlEscape = React.useCallback(
    (urlEscape: string) => {
      try {
        setRightError(null)
        if (!urlEscape) {
          setParam("leftText", "")
          return
        }
        if (!isValidUrlEscape(urlEscape)) {
          setRightError("Invalid URL escape format (incomplete %XX sequence)")
          return
        }
        const bytes = decodeUrlEscape(urlEscape)
        const text = decodeText(bytes, state.encoding)
        setParam("leftText", text)
      } catch (err) {
        setRightError(err instanceof Error ? err.message : "Decoding failed")
      }
    },
    [state.encoding, setParam],
  )

  const handleLeftChange = React.useCallback(
    (value: string) => {
      setParam("leftText", value)
      setParam("activeSide", "left")
      encodeToUrlEscape(value)
    },
    [setParam, encodeToUrlEscape],
  )

  const handleRightChange = React.useCallback(
    (value: string) => {
      setParam("rightText", value)
      setParam("activeSide", "right")
      decodeFromUrlEscape(value)
    },
    [setParam, decodeFromUrlEscape],
  )

  React.useEffect(() => {
    if (state.activeSide === "left" && state.leftText) {
      encodeToUrlEscape(state.leftText)
    } else if (state.activeSide === "right" && state.rightText) {
      decodeFromUrlEscape(state.rightText)
    }
  }, [state.encoding, state.upperCase, state.mode])

  const handleLeftFileUpload = React.useCallback(
    async (file: File) => {
      try {
        const buffer = await file.arrayBuffer()
        const bytes = new Uint8Array(buffer)
        const encoded = encodeUrlEscape(bytes, { upperCase: state.upperCase, mode: state.mode as EncodeMode })

        const blob = new Blob([encoded], { type: "text/plain" })
        const url = URL.createObjectURL(blob)

        setLeftFileResult({
          status: "success",
          message: `Encoded ${file.name} (${bytes.length} bytes)`,
          downloadUrl: url,
          downloadName: file.name + ".url-escape.txt",
        })
      } catch (err) {
        setLeftFileResult({
          status: "error",
          message: err instanceof Error ? err.message : "Encoding failed",
        })
      }
    },
    [state.upperCase, state.mode],
  )

  const handleRightFileUpload = React.useCallback(async (file: File) => {
    try {
      const text = await file.text()
      const bytes = decodeUrlEscape(text.trim())

      const blob = new Blob([bytes], { type: "application/octet-stream" })
      const url = URL.createObjectURL(blob)

      const baseName = file.name.replace(/\.url-escape\.txt$/i, "").replace(/\.txt$/i, "")
      setRightFileResult({
        status: "success",
        message: `Decoded ${file.name} (${bytes.length} bytes)`,
        downloadUrl: url,
        downloadName: baseName + ".raw",
      })
    } catch (err) {
      setRightFileResult({
        status: "error",
        message: err instanceof Error ? err.message : "Decoding failed",
      })
    }
  }, [])

  const handleLoadHistory = React.useCallback(
    (entry: HistoryEntry) => {
      const { inputs, params } = entry
      if (inputs.leftText !== undefined) setParam("leftText", inputs.leftText)
      if (inputs.rightText !== undefined) setParam("rightText", inputs.rightText)
      if (params.encoding) setParam("encoding", params.encoding as string)
      if (params.upperCase !== undefined) setParam("upperCase", params.upperCase as boolean)
      if (params.mode) setParam("mode", params.mode as "all" | "component" | "reserved")
      if (params.activeSide) setParam("activeSide", params.activeSide as "left" | "right")
    },
    [setParam],
  )

  return (
    <ToolPageWrapper
      toolId="url-escape"
      title="URL Escape"
      description="Encode and decode URL percent-encoding (%XX format)"
      onLoadHistory={handleLoadHistory}
    >
      <UrlEscapeInner
        state={state}
        setParam={setParam}
        oversizeKeys={oversizeKeys}
        hasUrlParams={hasUrlParams}
        hydrationSource={hydrationSource}
        leftError={leftError}
        rightError={rightError}
        handleLeftChange={handleLeftChange}
        handleRightChange={handleRightChange}
        handleLeftFileUpload={handleLeftFileUpload}
        handleRightFileUpload={handleRightFileUpload}
        leftFileResult={leftFileResult}
        rightFileResult={rightFileResult}
        setLeftFileResult={setLeftFileResult}
        setRightFileResult={setRightFileResult}
      />
    </ToolPageWrapper>
  )
}

function UrlEscapeInner({
  state,
  setParam,
  oversizeKeys,
  hasUrlParams,
  hydrationSource,
  leftError,
  rightError,
  handleLeftChange,
  handleRightChange,
  handleLeftFileUpload,
  handleRightFileUpload,
  leftFileResult,
  rightFileResult,
  setLeftFileResult,
  setRightFileResult,
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
  handleLeftFileUpload: (file: File) => void
  handleRightFileUpload: (file: File) => void
  leftFileResult: { status: "success" | "error"; message: string; downloadUrl?: string; downloadName?: string } | null
  rightFileResult: { status: "success" | "error"; message: string; downloadUrl?: string; downloadName?: string } | null
  setLeftFileResult: (v: typeof leftFileResult) => void
  setRightFileResult: (v: typeof rightFileResult) => void
}) {
  const { upsertInputEntry, upsertParams } = useToolHistoryContext()
  const lastInputRef = React.useRef<string>("")
  const hasHydratedInputRef = React.useRef(false)
  const paramsRef = React.useRef({
    encoding: state.encoding,
    upperCase: state.upperCase,
    mode: state.mode,
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
        { encoding: state.encoding, upperCase: state.upperCase, mode: state.mode, activeSide: state.activeSide },
        state.activeSide,
        activeText.slice(0, 100),
      )
    }, DEFAULT_URL_SYNC_DEBOUNCE_MS)

    return () => clearTimeout(timer)
  }, [state.leftText, state.rightText, state.activeSide, state.encoding, state.upperCase, state.mode, upsertInputEntry])

  React.useEffect(() => {
    if (hasUrlParams && !hasHandledUrlRef.current) {
      hasHandledUrlRef.current = true
      const activeText = state.activeSide === "left" ? state.leftText : state.rightText
      if (activeText) {
        upsertInputEntry(
          { leftText: state.leftText, rightText: state.rightText },
          { encoding: state.encoding, upperCase: state.upperCase, mode: state.mode, activeSide: state.activeSide },
          state.activeSide,
          activeText.slice(0, 100),
        )
      } else {
        upsertParams(
          { encoding: state.encoding, upperCase: state.upperCase, mode: state.mode, activeSide: state.activeSide },
          "interpretation",
        )
      }
    }
  }, [
    hasUrlParams,
    state.leftText,
    state.rightText,
    state.activeSide,
    state.encoding,
    state.upperCase,
    state.mode,
    upsertInputEntry,
    upsertParams,
  ])

  React.useEffect(() => {
    const nextParams = {
      encoding: state.encoding,
      upperCase: state.upperCase,
      mode: state.mode,
      activeSide: state.activeSide,
    }
    if (!hasInitializedParamsRef.current) {
      hasInitializedParamsRef.current = true
      paramsRef.current = nextParams
      return
    }
    if (
      paramsRef.current.encoding === nextParams.encoding &&
      paramsRef.current.upperCase === nextParams.upperCase &&
      paramsRef.current.mode === nextParams.mode &&
      paramsRef.current.activeSide === nextParams.activeSide
    ) {
      return
    }
    paramsRef.current = nextParams
    upsertParams(nextParams, "interpretation")
  }, [state.encoding, state.upperCase, state.mode, state.activeSide, upsertParams])

  const leftWarning = oversizeKeys.includes("leftText") ? "Input exceeds 2 KB and is not synced to the URL." : null
  const rightWarning = oversizeKeys.includes("rightText") ? "Input exceeds 2 KB and is not synced to the URL." : null

  return (
    <DualPaneLayout
      leftLabel="Plain Text"
      rightLabel="URL Escape"
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
      rightPlaceholder="Enter URL escape to decode (e.g., %48%65%6C%6C%6F or Hello%21)..."
      leftFileUpload={handleLeftFileUpload}
      rightFileUpload={handleRightFileUpload}
      leftFileResult={leftFileResult}
      rightFileResult={rightFileResult}
      onClearLeftFile={() => setLeftFileResult(null)}
      onClearRightFile={() => setRightFileResult(null)}
    >
      <Card>
        <CardContent className="flex flex-wrap items-center gap-6 p-4">
          <div className="flex items-center gap-2">
            <Label className="whitespace-nowrap text-sm">Input Encoding</Label>
            <SearchableSelect
              value={state.encoding}
              onValueChange={(v) => setParam("encoding", v, true)}
              options={encodings}
              placeholder="Select encoding..."
              searchPlaceholder="Search encodings..."
              triggerClassName="w-48"
              className="w-64"
            />
          </div>
          <div className="flex items-center gap-2">
            <Label className="whitespace-nowrap text-sm">Mode</Label>
            <Select value={state.mode} onValueChange={(v) => setParam("mode", v as EncodeMode, true)}>
              <SelectTrigger className="w-44">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {modeOptions.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>
                    <span className="font-medium">{opt.label}</span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-center gap-2">
            <Checkbox
              id="upperCase"
              checked={state.upperCase}
              onCheckedChange={(c) => setParam("upperCase", c === true, true)}
            />
            <Label htmlFor="upperCase" className="cursor-pointer text-sm">
              Upper case
            </Label>
          </div>
        </CardContent>
      </Card>
    </DualPaneLayout>
  )
}

export default function UrlEscapePage() {
  return (
    <Suspense fallback={null}>
      <UrlEscapeContent />
    </Suspense>
  )
}
