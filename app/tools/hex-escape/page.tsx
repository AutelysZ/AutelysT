"use client"

import * as React from "react"
import { Suspense } from "react"
import { z } from "zod"
import { ToolPageWrapper } from "@/components/tool-ui/tool-page-wrapper"
import { DualPaneLayout } from "@/components/tool-ui/dual-pane-layout"
import { useUrlSyncedState } from "@/lib/url-state/use-url-synced-state"
import { Card, CardContent } from "@/components/ui/card"
import { Checkbox } from "@/components/ui/checkbox"
import { Label } from "@/components/ui/label"
import { SearchableSelect } from "@/components/ui/searchable-select"
import { encodeHexEscape, decodeHexEscape, isValidHexEscape } from "@/lib/encoding/hex-escape"
import { encodeText, decodeText, getAllEncodings } from "@/lib/encoding/text-encodings"
import type { HistoryEntry } from "@/lib/history/db"

const paramsSchema = z.object({
  encoding: z.string().default("utf8"),
  upperCase: z.boolean().default(true),
  activeSide: z.enum(["left", "right"]).default("left"),
  leftText: z.string().default(""),
  rightText: z.string().default(""),
})

const encodings = getAllEncodings()

function HexEscapeContent() {
  const { state, setParam } = useUrlSyncedState("hex-escape", {
    schema: paramsSchema,
    defaults: paramsSchema.parse({}),
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

  const encodeToHexEscape = React.useCallback(
    (text: string) => {
      try {
        setLeftError(null)
        if (!text) {
          setParam("rightText", "")
          return
        }
        const bytes = encodeText(text, state.encoding)
        const encoded = encodeHexEscape(bytes, { upperCase: state.upperCase })
        setParam("rightText", encoded)
      } catch (err) {
        setLeftError(err instanceof Error ? err.message : "Encoding failed")
      }
    },
    [state.encoding, state.upperCase, setParam],
  )

  const decodeFromHexEscape = React.useCallback(
    (hexEscape: string) => {
      try {
        setRightError(null)
        if (!hexEscape) {
          setParam("leftText", "")
          return
        }
        if (!isValidHexEscape(hexEscape)) {
          setRightError("Invalid hex escape format")
          return
        }
        const bytes = decodeHexEscape(hexEscape)
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
      encodeToHexEscape(value)
    },
    [setParam, encodeToHexEscape],
  )

  const handleRightChange = React.useCallback(
    (value: string) => {
      setParam("rightText", value)
      setParam("activeSide", "right")
      decodeFromHexEscape(value)
    },
    [setParam, decodeFromHexEscape],
  )

  React.useEffect(() => {
    if (state.activeSide === "left" && state.leftText) {
      encodeToHexEscape(state.leftText)
    } else if (state.activeSide === "right" && state.rightText) {
      decodeFromHexEscape(state.rightText)
    }
  }, [state.encoding, state.upperCase])

  const handleLeftFileUpload = React.useCallback(
    async (file: File) => {
      try {
        const buffer = await file.arrayBuffer()
        const bytes = new Uint8Array(buffer)
        const encoded = encodeHexEscape(bytes, { upperCase: state.upperCase })

        const blob = new Blob([encoded], { type: "text/plain" })
        const url = URL.createObjectURL(blob)

        setLeftFileResult({
          status: "success",
          message: `Encoded ${file.name} (${bytes.length} bytes)`,
          downloadUrl: url,
          downloadName: file.name + ".hex-escape.txt",
        })
      } catch (err) {
        setLeftFileResult({
          status: "error",
          message: err instanceof Error ? err.message : "Encoding failed",
        })
      }
    },
    [state.upperCase],
  )

  const handleRightFileUpload = React.useCallback(async (file: File) => {
    try {
      const text = await file.text()
      const bytes = decodeHexEscape(text.trim())

      const blob = new Blob([bytes], { type: "application/octet-stream" })
      const url = URL.createObjectURL(blob)

      const baseName = file.name.replace(/\.hex-escape\.txt$/i, "").replace(/\.txt$/i, "")
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
      if (params.activeSide) setParam("activeSide", params.activeSide as "left" | "right")
    },
    [setParam],
  )

  return (
    <ToolPageWrapper
      toolId="hex-escape"
      title="Hex Escape"
      description="Encode and decode hex escape sequences (\\xff format)"
      onLoadHistory={handleLoadHistory}
    >
      <DualPaneLayout
        leftLabel="Plain Text"
        rightLabel="Hex Escape"
        leftValue={state.leftText}
        rightValue={state.rightText}
        onLeftChange={handleLeftChange}
        onRightChange={handleRightChange}
        activeSide={state.activeSide}
        onActiveSideChange={(side) => setParam("activeSide", side, true)}
        leftError={leftError}
        rightError={rightError}
        leftPlaceholder="Enter text to encode..."
        rightPlaceholder="Enter hex escape to decode (e.g., \x48\x65\x6c\x6c\x6f)..."
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
              <Label className="text-sm whitespace-nowrap">Text Encoding</Label>
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
    </ToolPageWrapper>
  )
}

export default function HexEscapePage() {
  return (
    <Suspense fallback={null}>
      <HexEscapeContent />
    </Suspense>
  )
}
