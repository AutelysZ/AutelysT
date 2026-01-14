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
import { encodeBase32, decodeBase32, isValidBase32 } from "@/lib/encoding/base32"

const paramsSchema = z.object({
  upperCase: z.boolean().default(true),
  activeSide: z.enum(["left", "right"]).default("left"),
  leftText: z.string().default(""),
  rightText: z.string().default(""),
})

function Base32Content() {
  const { state, setParam } = useUrlSyncedState("base32", {
    schema: paramsSchema,
    defaults: paramsSchema.parse({}),
  })

  const [leftError, setLeftError] = React.useState<string | null>(null)
  const [rightError, setRightError] = React.useState<string | null>(null)

  const encodeToBase32 = React.useCallback(
    (text: string) => {
      try {
        setLeftError(null)
        if (!text) {
          setParam("rightText", "")
          return
        }
        const bytes = new TextEncoder().encode(text)
        const encoded = encodeBase32(bytes, { upperCase: state.upperCase })
        setParam("rightText", encoded)
      } catch (err) {
        setLeftError(err instanceof Error ? err.message : "Encoding failed")
      }
    },
    [state.upperCase, setParam],
  )

  const decodeFromBase32 = React.useCallback(
    (base32: string) => {
      try {
        setRightError(null)
        if (!base32) {
          setParam("leftText", "")
          return
        }
        if (!isValidBase32(base32)) {
          setRightError("Invalid Base32 characters")
          return
        }
        const bytes = decodeBase32(base32)
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
      encodeToBase32(value)
    },
    [setParam, encodeToBase32],
  )

  const handleRightChange = React.useCallback(
    (value: string) => {
      setParam("rightText", value)
      setParam("activeSide", "right")
      decodeFromBase32(value)
    },
    [setParam, decodeFromBase32],
  )

  React.useEffect(() => {
    if (state.activeSide === "left" && state.leftText) {
      encodeToBase32(state.leftText)
    }
  }, [state.upperCase])

  return (
    <ToolPageWrapper
      toolId="base32"
      title="Base32"
      description="Encode and decode Base32 (RFC 4648)"
      seoContent={<Base32SEOContent />}
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
            rightLabel="Base32"
            leftValue={state.leftText}
            rightValue={state.rightText}
            onLeftChange={handleLeftChange}
            onRightChange={handleRightChange}
            activeSide={state.activeSide}
            onActiveSideChange={(side) => setParam("activeSide", side, true)}
            leftError={leftError}
            rightError={rightError}
            leftPlaceholder="Enter text to encode..."
            rightPlaceholder="Enter Base32 to decode..."
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

function Base32SEOContent() {
  return (
    <div className="prose prose-sm dark:prose-invert max-w-none">
      <h2>What is Base32?</h2>
      <p>
        Base32 uses a 32-character alphabet (A-Z and 2-7) to encode binary data. It{"'"}s less efficient than Base64 but
        is case-insensitive and avoids visually similar characters.
      </p>

      <h2>Common Use Cases</h2>
      <ul>
        <li>TOTP/HOTP secrets (Google Authenticator, etc.)</li>
        <li>Case-insensitive file systems</li>
        <li>Human-readable data encoding</li>
      </ul>
    </div>
  )
}

export default function Base32Page() {
  return (
    <Suspense>
      <Base32Content />
    </Suspense>
  )
}
