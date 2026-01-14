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
import { encodeHex, decodeHex, isValidHex } from "@/lib/encoding/hex"

const paramsSchema = z.object({
  upperCase: z.boolean().default(true),
  activeSide: z.enum(["left", "right"]).default("left"),
  leftText: z.string().default(""),
  rightText: z.string().default(""),
})

function HexContent() {
  const { state, setParam } = useUrlSyncedState("hex", {
    schema: paramsSchema,
    defaults: paramsSchema.parse({}),
  })

  const [leftError, setLeftError] = React.useState<string | null>(null)
  const [rightError, setRightError] = React.useState<string | null>(null)

  const encodeToHex = React.useCallback(
    (text: string) => {
      try {
        setLeftError(null)
        if (!text) {
          setParam("rightText", "")
          return
        }
        const bytes = new TextEncoder().encode(text)
        const encoded = encodeHex(bytes, { upperCase: state.upperCase })
        setParam("rightText", encoded)
      } catch (err) {
        setLeftError(err instanceof Error ? err.message : "Encoding failed")
      }
    },
    [state.upperCase, setParam],
  )

  const decodeFromHex = React.useCallback(
    (hex: string) => {
      try {
        setRightError(null)
        if (!hex) {
          setParam("leftText", "")
          return
        }
        if (!isValidHex(hex)) {
          setRightError("Invalid hexadecimal characters or odd length")
          return
        }
        const bytes = decodeHex(hex)
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
      encodeToHex(value)
    },
    [setParam, encodeToHex],
  )

  const handleRightChange = React.useCallback(
    (value: string) => {
      setParam("rightText", value)
      setParam("activeSide", "right")
      decodeFromHex(value)
    },
    [setParam, decodeFromHex],
  )

  React.useEffect(() => {
    if (state.activeSide === "left" && state.leftText) {
      encodeToHex(state.leftText)
    }
  }, [state.upperCase])

  return (
    <ToolPageWrapper
      toolId="hex"
      title="Hex (Base16)"
      description="Encode and decode hexadecimal"
      seoContent={<HexSEOContent />}
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
            rightLabel="Hexadecimal"
            leftValue={state.leftText}
            rightValue={state.rightText}
            onLeftChange={handleLeftChange}
            onRightChange={handleRightChange}
            activeSide={state.activeSide}
            onActiveSideChange={(side) => setParam("activeSide", side, true)}
            leftError={leftError}
            rightError={rightError}
            leftPlaceholder="Enter text to encode..."
            rightPlaceholder="Enter hex to decode..."
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

function HexSEOContent() {
  return (
    <div className="prose prose-sm dark:prose-invert max-w-none">
      <h2>What is Hexadecimal?</h2>
      <p>
        Hexadecimal (hex) is a base-16 number system using digits 0-9 and letters A-F. Each hex digit represents 4 bits,
        making it ideal for representing binary data compactly.
      </p>

      <h2>Common Use Cases</h2>
      <ul>
        <li>Color codes in CSS (#FF5733)</li>
        <li>Memory addresses and debugging</li>
        <li>MAC addresses and network data</li>
        <li>Cryptographic hashes</li>
      </ul>
    </div>
  )
}

export default function HexPage() {
  return (
    <Suspense>
      <HexContent />
    </Suspense>
  )
}
