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
import { encodeHexEscape, decodeHexEscape, isValidHexEscape } from "@/lib/encoding/hex-escape"

const paramsSchema = z.object({
  upperCase: z.boolean().default(true),
  activeSide: z.enum(["left", "right"]).default("left"),
  leftText: z.string().default(""),
  rightText: z.string().default(""),
})

function HexEscapeContent() {
  const { state, setParam } = useUrlSyncedState("hex-escape", {
    schema: paramsSchema,
    defaults: paramsSchema.parse({}),
  })

  const [leftError, setLeftError] = React.useState<string | null>(null)
  const [rightError, setRightError] = React.useState<string | null>(null)

  const encodeToHexEscape = React.useCallback(
    (text: string) => {
      try {
        setLeftError(null)
        if (!text) {
          setParam("rightText", "")
          return
        }
        const bytes = new TextEncoder().encode(text)
        const encoded = encodeHexEscape(bytes, { upperCase: state.upperCase })
        setParam("rightText", encoded)
      } catch (err) {
        setLeftError(err instanceof Error ? err.message : "Encoding failed")
      }
    },
    [state.upperCase, setParam],
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
        const text = new TextDecoder().decode(bytes)
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
    }
  }, [state.upperCase])

  return (
    <ToolPageWrapper
      toolId="hex-escape"
      title="Hex Escape"
      description="Encode and decode hex escape sequences (\\xff format)"
      seoContent={<HexEscapeSEOContent />}
    >
      {({ addHistoryEntry }) => {
        const lastSavedRef = React.useRef("")
        React.useEffect(() => {
          const key = `${state.leftText}|${state.rightText}`
          if (key !== lastSavedRef.current && (state.leftText || state.rightText)) {
            lastSavedRef.current = key
            addHistoryEntry(
              { leftText: state.leftText, rightText: state.rightText },
              { upperCase: state.upperCase, activeSide: state.activeSide },
              state.activeSide,
              state.leftText.slice(0, 50) || state.rightText.slice(0, 50),
            )
          }
        }, [state.leftText, state.rightText])

        return (
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
          >
            <Card>
              <CardContent className="flex items-center gap-4 p-4">
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
      }}
    </ToolPageWrapper>
  )
}

function HexEscapeSEOContent() {
  return (
    <div className="prose prose-sm dark:prose-invert max-w-none">
      <h2>What is Hex Escape?</h2>
      <p>
        Hex escape sequences represent bytes using the format \xNN where NN is a two-digit hexadecimal number. This
        format is commonly used in programming languages like C, Python, and JavaScript.
      </p>

      <h2>Common Use Cases</h2>
      <ul>
        <li>String literals in programming</li>
        <li>Binary data in source code</li>
        <li>Shellcode representation</li>
        <li>Debugging binary data</li>
      </ul>
    </div>
  )
}

export default function HexEscapePage() {
  return (
    <Suspense>
      <HexEscapeContent />
    </Suspense>
  )
}
