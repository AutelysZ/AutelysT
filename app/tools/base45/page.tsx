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
import { encodeBase45, decodeBase45, isValidBase45 } from "@/lib/encoding/base45"

const paramsSchema = z.object({
  upperCase: z.boolean().default(true),
  activeSide: z.enum(["left", "right"]).default("left"),
  leftText: z.string().default(""),
  rightText: z.string().default(""),
})

function Base45Content() {
  const { state, setParam } = useUrlSyncedState("base45", {
    schema: paramsSchema,
    defaults: paramsSchema.parse({}),
  })

  const [leftError, setLeftError] = React.useState<string | null>(null)
  const [rightError, setRightError] = React.useState<string | null>(null)

  const encodeToBase45 = React.useCallback(
    (text: string) => {
      try {
        setLeftError(null)
        if (!text) {
          setParam("rightText", "")
          return
        }
        const bytes = new TextEncoder().encode(text)
        const encoded = encodeBase45(bytes, { upperCase: state.upperCase })
        setParam("rightText", encoded)
      } catch (err) {
        setLeftError(err instanceof Error ? err.message : "Encoding failed")
      }
    },
    [state.upperCase, setParam],
  )

  const decodeFromBase45 = React.useCallback(
    (base45: string) => {
      try {
        setRightError(null)
        if (!base45) {
          setParam("leftText", "")
          return
        }
        if (!isValidBase45(base45)) {
          setRightError("Invalid Base45 characters")
          return
        }
        const bytes = decodeBase45(base45)
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
      encodeToBase45(value)
    },
    [setParam, encodeToBase45],
  )

  const handleRightChange = React.useCallback(
    (value: string) => {
      setParam("rightText", value)
      setParam("activeSide", "right")
      decodeFromBase45(value)
    },
    [setParam, decodeFromBase45],
  )

  React.useEffect(() => {
    if (state.activeSide === "left" && state.leftText) {
      encodeToBase45(state.leftText)
    }
  }, [state.upperCase])

  return (
    <ToolPageWrapper
      toolId="base45"
      title="Base45"
      description="Encode and decode Base45 (EU Digital COVID Certificate)"
      seoContent={<Base45SEOContent />}
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
            rightLabel="Base45"
            leftValue={state.leftText}
            rightValue={state.rightText}
            onLeftChange={handleLeftChange}
            onRightChange={handleRightChange}
            activeSide={state.activeSide}
            onActiveSideChange={(side) => setParam("activeSide", side, true)}
            leftError={leftError}
            rightError={rightError}
            leftPlaceholder="Enter text to encode..."
            rightPlaceholder="Enter Base45 to decode..."
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

function Base45SEOContent() {
  return (
    <div className="prose prose-sm dark:prose-invert max-w-none">
      <h2>What is Base45?</h2>
      <p>
        Base45 is a binary-to-text encoding optimized for QR codes. It was standardized in RFC 9285 and is notably used
        in EU Digital COVID Certificates.
      </p>

      <h2>Common Use Cases</h2>
      <ul>
        <li>EU Digital COVID Certificates (DCC)</li>
        <li>QR code data encoding</li>
        <li>Compact data representation for alphanumeric QR mode</li>
      </ul>
    </div>
  )
}

export default function Base45Page() {
  return (
    <Suspense>
      <Base45Content />
    </Suspense>
  )
}
