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
import { encodeBase36, decodeBase36, isValidBase36 } from "@/lib/encoding/base36"

const paramsSchema = z.object({
  upperCase: z.boolean().default(true),
  activeSide: z.enum(["left", "right"]).default("left"),
  leftText: z.string().default(""),
  rightText: z.string().default(""),
})

function Base36Content() {
  const { state, setParam } = useUrlSyncedState("base36", {
    schema: paramsSchema,
    defaults: paramsSchema.parse({}),
  })

  const [leftError, setLeftError] = React.useState<string | null>(null)
  const [rightError, setRightError] = React.useState<string | null>(null)

  const encodeToBase36 = React.useCallback(
    (text: string) => {
      try {
        setLeftError(null)
        if (!text) {
          setParam("rightText", "")
          return
        }
        const bytes = new TextEncoder().encode(text)
        const encoded = encodeBase36(bytes, { upperCase: state.upperCase })
        setParam("rightText", encoded)
      } catch (err) {
        setLeftError(err instanceof Error ? err.message : "Encoding failed")
      }
    },
    [state.upperCase, setParam],
  )

  const decodeFromBase36 = React.useCallback(
    (base36: string) => {
      try {
        setRightError(null)
        if (!base36) {
          setParam("leftText", "")
          return
        }
        if (!isValidBase36(base36)) {
          setRightError("Invalid Base36 characters")
          return
        }
        const bytes = decodeBase36(base36)
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
      encodeToBase36(value)
    },
    [setParam, encodeToBase36],
  )

  const handleRightChange = React.useCallback(
    (value: string) => {
      setParam("rightText", value)
      setParam("activeSide", "right")
      decodeFromBase36(value)
    },
    [setParam, decodeFromBase36],
  )

  React.useEffect(() => {
    if (state.activeSide === "left" && state.leftText) {
      encodeToBase36(state.leftText)
    }
  }, [state.upperCase])

  return (
    <ToolPageWrapper
      toolId="base36"
      title="Base36"
      description="Encode and decode Base36 (alphanumeric: 0-9, A-Z)"
      seoContent={<Base36SEOContent />}
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
            rightLabel="Base36"
            leftValue={state.leftText}
            rightValue={state.rightText}
            onLeftChange={handleLeftChange}
            onRightChange={handleRightChange}
            activeSide={state.activeSide}
            onActiveSideChange={(side) => setParam("activeSide", side, true)}
            leftError={leftError}
            rightError={rightError}
            leftPlaceholder="Enter text to encode..."
            rightPlaceholder="Enter Base36 to decode..."
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

function Base36SEOContent() {
  return (
    <div className="prose prose-sm dark:prose-invert max-w-none">
      <h2>What is Base36?</h2>
      <p>
        Base36 uses the characters 0-9 and A-Z (36 characters total) to represent binary data. It{"'"}s commonly used
        for generating short, human-readable identifiers.
      </p>

      <h2>Common Use Cases</h2>
      <ul>
        <li>Short URL identifiers</li>
        <li>Case-insensitive unique IDs</li>
        <li>Compact number representation</li>
      </ul>
    </div>
  )
}

export default function Base36Page() {
  return (
    <Suspense>
      <Base36Content />
    </Suspense>
  )
}
