"use client"

import * as React from "react"
import { Suspense } from "react"
import { z } from "zod"
import { ToolPageWrapper, useToolHistoryContext } from "@/components/tool-ui/tool-page-wrapper"
import { DualPaneLayout } from "@/components/tool-ui/dual-pane-layout"
import { useUrlSyncedState } from "@/lib/url-state/use-url-synced-state"
import { Card, CardContent } from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import { SearchableSelect } from "@/components/ui/searchable-select"
import { encodeBase58, decodeBase58, isValidBase58 } from "@/lib/encoding/base58"
import { encodeText, decodeText, getAllEncodings } from "@/lib/encoding/text-encodings"
import type { HistoryEntry } from "@/lib/history/db"

const paramsSchema = z.object({
  encoding: z.string().default("UTF-8"),
  activeSide: z.enum(["left", "right"]).default("left"),
  leftText: z.string().default(""),
  rightText: z.string().default(""),
})

const encodings = getAllEncodings()

function Base58Content() {
  const { state, setParam } = useUrlSyncedState("base58", {
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

  const encodeToBase58 = React.useCallback(
    (text: string) => {
      try {
        setLeftError(null)
        if (!text) {
          setParam("rightText", "")
          return
        }
        const bytes = encodeText(text, state.encoding)
        const encoded = encodeBase58(bytes)
        setParam("rightText", encoded)
      } catch (err) {
        setLeftError(err instanceof Error ? err.message : "Encoding failed")
      }
    },
    [state.encoding, setParam],
  )

  const decodeFromBase58 = React.useCallback(
    (base58: string) => {
      try {
        setRightError(null)
        if (!base58) {
          setParam("leftText", "")
          return
        }
        if (!isValidBase58(base58)) {
          setRightError("Invalid Base58 characters")
          return
        }
        const bytes = decodeBase58(base58)
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
      encodeToBase58(value)
    },
    [setParam, encodeToBase58],
  )

  const handleRightChange = React.useCallback(
    (value: string) => {
      setParam("rightText", value)
      setParam("activeSide", "right")
      decodeFromBase58(value)
    },
    [setParam, decodeFromBase58],
  )

  React.useEffect(() => {
    if (state.activeSide === "left" && state.leftText) {
      encodeToBase58(state.leftText)
    } else if (state.activeSide === "right" && state.rightText) {
      decodeFromBase58(state.rightText)
    }
  }, [state.encoding])

  const handleLeftFileUpload = React.useCallback(async (file: File) => {
    try {
      const buffer = await file.arrayBuffer()
      const bytes = new Uint8Array(buffer)
      const encoded = encodeBase58(bytes)

      const blob = new Blob([encoded], { type: "text/plain" })
      const url = URL.createObjectURL(blob)

      setLeftFileResult({
        status: "success",
        message: `Encoded ${file.name} (${bytes.length} bytes)`,
        downloadUrl: url,
        downloadName: file.name + ".base58",
      })
    } catch (err) {
      setLeftFileResult({
        status: "error",
        message: err instanceof Error ? err.message : "Encoding failed",
      })
    }
  }, [])

  const handleRightFileUpload = React.useCallback(async (file: File) => {
    try {
      const text = await file.text()
      const bytes = decodeBase58(text.trim())

      const blob = new Blob([bytes], { type: "application/octet-stream" })
      const url = URL.createObjectURL(blob)

      const baseName = file.name.replace(/\.base58$/i, "")
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
      if (params.activeSide) setParam("activeSide", params.activeSide as "left" | "right")
    },
    [setParam],
  )

  return (
    <ToolPageWrapper
      toolId="base58"
      title="Base58"
      description="Encode and decode Base58 (Bitcoin alphabet)"
      onLoadHistory={handleLoadHistory}
    >
      <Base58Inner
        state={state}
        setParam={setParam}
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

function Base58Inner({
  state,
  setParam,
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
  setParam: (key: string, value: unknown, updateHistory?: boolean) => void
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
  const { addHistoryEntry } = useToolHistoryContext()
  const lastInputRef = React.useRef<string>("")

  React.useEffect(() => {
    const activeText = state.activeSide === "left" ? state.leftText : state.rightText
    if (!activeText || activeText === lastInputRef.current) return

    const timer = setTimeout(() => {
      lastInputRef.current = activeText
      addHistoryEntry(
        { leftText: state.leftText, rightText: state.rightText },
        { encoding: state.encoding, activeSide: state.activeSide },
        state.activeSide,
        activeText.slice(0, 100),
      )
    }, 1000)

    return () => clearTimeout(timer)
  }, [state.leftText, state.rightText, state.activeSide, state.encoding, addHistoryEntry])

  return (
    <DualPaneLayout
      leftLabel="Plain Text"
      rightLabel="Base58"
      leftValue={state.leftText}
      rightValue={state.rightText}
      onLeftChange={handleLeftChange}
      onRightChange={handleRightChange}
      activeSide={state.activeSide}
      onActiveSideChange={(side) => setParam("activeSide", side, true)}
      leftError={leftError}
      rightError={rightError}
      leftPlaceholder="Enter text to encode..."
      rightPlaceholder="Enter Base58 to decode..."
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
        </CardContent>
      </Card>
    </DualPaneLayout>
  )
}

export default function Base58Page() {
  return (
    <Suspense fallback={null}>
      <Base58Content />
    </Suspense>
  )
}
