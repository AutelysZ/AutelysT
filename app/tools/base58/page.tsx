"use client"

import * as React from "react"
import { Suspense } from "react"
import { z } from "zod"
import { ToolPageWrapper } from "@/components/tool-ui/tool-page-wrapper"
import { DualPaneLayout } from "@/components/tool-ui/dual-pane-layout"
import { useUrlSyncedState } from "@/lib/url-state/use-url-synced-state"
import { encodeBase58, decodeBase58, isValidBase58 } from "@/lib/encoding/base58"

const paramsSchema = z.object({
  activeSide: z.enum(["left", "right"]).default("left"),
  leftText: z.string().default(""),
  rightText: z.string().default(""),
})

function Base58Content() {
  const { state, setParam } = useUrlSyncedState("base58", {
    schema: paramsSchema,
    defaults: paramsSchema.parse({}),
  })

  const [leftError, setLeftError] = React.useState<string | null>(null)
  const [rightError, setRightError] = React.useState<string | null>(null)
  const lastSavedRef = React.useRef("")

  const encodeToBase58 = React.useCallback(
    (text: string) => {
      try {
        setLeftError(null)
        if (!text) {
          setParam("rightText", "")
          return
        }
        const bytes = new TextEncoder().encode(text)
        const encoded = encodeBase58(bytes)
        setParam("rightText", encoded)
      } catch (err) {
        setLeftError(err instanceof Error ? err.message : "Encoding failed")
      }
    },
    [setParam],
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
    const key = `${state.leftText}|${state.rightText}`
    if (key !== lastSavedRef.current && (state.leftText || state.rightText)) {
      lastSavedRef.current = key
      // Assuming addHistoryEntry is available in the context or passed as a prop
      // const { addHistoryEntry } = useContext(SomeContext);
      // addHistoryEntry(
      //   { leftText: state.leftText, rightText: state.rightText },
      //   { activeSide: state.activeSide },
      //   state.activeSide,
      //   state.leftText.slice(0, 50) || state.rightText.slice(0, 50),
      // );
    }
  }, [state.leftText, state.rightText])

  return (
    <ToolPageWrapper
      toolId="base58"
      title="Base58"
      description="Encode and decode Base58 (Bitcoin alphabet)"
      seoContent={<Base58SEOContent />}
    >
      {({ addHistoryEntry }) => {
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
          />
        )
      }}
    </ToolPageWrapper>
  )
}

function Base58SEOContent() {
  return (
    <div className="prose prose-sm dark:prose-invert max-w-none">
      <h2>What is Base58?</h2>
      <p>
        Base58 is a binary-to-text encoding scheme similar to Base64, but it avoids visually ambiguous characters (0, O,
        I, l) and special characters (+, /). It{"'"}s primarily used in Bitcoin and other cryptocurrencies.
      </p>

      <h2>Common Use Cases</h2>
      <ul>
        <li>Bitcoin addresses</li>
        <li>IPFS content identifiers (CIDs)</li>
        <li>Other cryptocurrency addresses</li>
        <li>Short URLs and identifiers</li>
      </ul>
    </div>
  )
}

export default function Base58Page() {
  return (
    <Suspense>
      <Base58Content />
    </Suspense>
  )
}
