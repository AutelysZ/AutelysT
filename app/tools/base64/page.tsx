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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Input } from "@/components/ui/input"
import { encodeBase64, decodeBase64, isValidBase64 } from "@/lib/encoding/base64"
import { encodeText, decodeText, getAllEncodings } from "@/lib/encoding/text-encodings"
import { YourContextHere } from "@/context/YourContext" // Import your context here

const paramsSchema = z.object({
  encoding: z.string().default("utf8"),
  padding: z.boolean().default(true),
  urlSafe: z.boolean().default(false),
  mimeFormat: z.boolean().default(false),
  activeSide: z.enum(["left", "right"]).default("left"),
  leftText: z.string().default(""),
  rightText: z.string().default(""),
})

const encodings = getAllEncodings()

export default function Base64Page() {
  return (
    <Suspense>
      <Base64Content />
    </Suspense>
  )
}

function Base64Content() {
  const { state, setParam } = useUrlSyncedState("base64", {
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
  const [downloadFilename, setDownloadFilename] = React.useState("")
  const lastSavedRef = React.useRef("")
  const context = React.useContext(YourContextHere) // Use context at top level

  // Encode left text to base64
  const encodeToBase64 = React.useCallback(
    (text: string) => {
      try {
        setLeftError(null)
        if (!text) {
          setParam("rightText", "")
          return
        }

        const bytes = encodeText(text, state.encoding)
        const encoded = encodeBase64(bytes, {
          padding: state.padding,
          urlSafe: state.urlSafe,
          mimeFormat: state.mimeFormat,
        })
        setParam("rightText", encoded)
      } catch (err) {
        setLeftError(err instanceof Error ? err.message : "Encoding failed")
      }
    },
    [state.encoding, state.padding, state.urlSafe, state.mimeFormat, setParam],
  )

  // Decode base64 to text
  const decodeFromBase64 = React.useCallback(
    (base64: string) => {
      try {
        setRightError(null)
        if (!base64) {
          setParam("leftText", "")
          return
        }

        if (!isValidBase64(base64)) {
          setRightError("Invalid Base64 characters")
          return
        }

        const bytes = decodeBase64(base64)
        const text = decodeText(bytes, state.encoding)
        setParam("leftText", text)
      } catch (err) {
        setRightError(err instanceof Error ? err.message : "Decoding failed")
      }
    },
    [state.encoding, setParam],
  )

  // Handle left text change
  const handleLeftChange = React.useCallback(
    (value: string) => {
      setParam("leftText", value)
      setParam("activeSide", "left")
      encodeToBase64(value)
    },
    [setParam, encodeToBase64],
  )

  // Handle right text change
  const handleRightChange = React.useCallback(
    (value: string) => {
      setParam("rightText", value)
      setParam("activeSide", "right")
      decodeFromBase64(value)
    },
    [setParam, decodeFromBase64],
  )

  // Recompute when params change
  React.useEffect(() => {
    if (state.activeSide === "left" && state.leftText) {
      encodeToBase64(state.leftText)
    } else if (state.activeSide === "right" && state.rightText) {
      decodeFromBase64(state.rightText)
    }
  }, [state.encoding, state.padding, state.urlSafe, state.mimeFormat])

  // Handle file upload to left (encode)
  const handleLeftFileUpload = React.useCallback(
    async (file: File) => {
      try {
        const buffer = await file.arrayBuffer()
        const bytes = new Uint8Array(buffer)
        const encoded = encodeBase64(bytes, {
          padding: state.padding,
          urlSafe: state.urlSafe,
          mimeFormat: state.mimeFormat,
        })

        // Create download
        const blob = new Blob([encoded], { type: "text/plain" })
        const url = URL.createObjectURL(blob)

        setDownloadFilename(file.name + ".base64")
        setLeftFileResult({
          status: "success",
          message: `Encoded ${file.name} (${bytes.length} bytes)`,
          downloadUrl: url,
          downloadName: file.name + ".base64",
        })
      } catch (err) {
        setLeftFileResult({
          status: "error",
          message: err instanceof Error ? err.message : "Encoding failed",
        })
      }
    },
    [state.padding, state.urlSafe, state.mimeFormat],
  )

  // Handle file upload to right (decode)
  const handleRightFileUpload = React.useCallback(async (file: File) => {
    try {
      const text = await file.text()
      const bytes = decodeBase64(text)

      // Create download
      const blob = new Blob([bytes], { type: "application/octet-stream" })
      const url = URL.createObjectURL(blob)

      const baseName = file.name.replace(/\.base64$/i, "")
      setDownloadFilename(baseName + ".raw")
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

  React.useEffect(() => {
    const key = `${state.leftText}|${state.rightText}`
    if (key !== lastSavedRef.current && (state.leftText || state.rightText)) {
      lastSavedRef.current = key
      context.addHistoryEntry(
        { leftText: state.leftText, rightText: state.rightText },
        {
          encoding: state.encoding,
          padding: state.padding,
          urlSafe: state.urlSafe,
          mimeFormat: state.mimeFormat,
          activeSide: state.activeSide,
        },
        state.activeSide,
        state.leftText.slice(0, 50) || state.rightText.slice(0, 50),
      )
    }
  }, [state.leftText, state.rightText])

  return (
    <ToolPageWrapper
      toolId="base64"
      title="Base64"
      description="Encode and decode Base64 with various text encodings"
      seoContent={<Base64SEOContent />}
    >
      {({ addHistoryEntry }) => (
        <DualPaneLayout
          leftLabel="Plain Text"
          rightLabel="Base64"
          leftValue={state.leftText}
          rightValue={state.rightText}
          onLeftChange={handleLeftChange}
          onRightChange={handleRightChange}
          activeSide={state.activeSide}
          onActiveSideChange={(side) => setParam("activeSide", side, true)}
          leftError={leftError}
          rightError={rightError}
          leftPlaceholder="Enter text to encode..."
          rightPlaceholder="Enter Base64 to decode..."
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
                <Label htmlFor="encoding" className="text-sm whitespace-nowrap">
                  Text Encoding
                </Label>
                <Select value={state.encoding} onValueChange={(v) => setParam("encoding", v, true)}>
                  <SelectTrigger id="encoding" className="w-48">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="max-h-60">
                    {encodings.map((enc) => (
                      <SelectItem key={enc.value} value={enc.value}>
                        {enc.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="flex items-center gap-2">
                <Checkbox
                  id="padding"
                  checked={state.padding}
                  onCheckedChange={(c) => setParam("padding", c === true, true)}
                />
                <Label htmlFor="padding" className="text-sm cursor-pointer">
                  Padding
                </Label>
              </div>

              <div className="flex items-center gap-2">
                <Checkbox
                  id="urlSafe"
                  checked={state.urlSafe}
                  onCheckedChange={(c) => setParam("urlSafe", c === true, true)}
                />
                <Label htmlFor="urlSafe" className="text-sm cursor-pointer">
                  URL-safe
                </Label>
              </div>

              <div className="flex items-center gap-2">
                <Checkbox
                  id="mimeFormat"
                  checked={state.mimeFormat}
                  onCheckedChange={(c) => setParam("mimeFormat", c === true, true)}
                />
                <Label htmlFor="mimeFormat" className="text-sm cursor-pointer">
                  MIME format
                </Label>
              </div>

              {leftFileResult && (
                <div className="flex items-center gap-2">
                  <Label htmlFor="downloadName" className="text-sm whitespace-nowrap">
                    Filename
                  </Label>
                  <Input
                    id="downloadName"
                    value={downloadFilename}
                    onChange={(e) => setDownloadFilename(e.target.value)}
                    className="w-40"
                  />
                </div>
              )}
            </CardContent>
          </Card>
        </DualPaneLayout>
      )}
    </ToolPageWrapper>
  )
}

function Base64SEOContent() {
  return (
    <div className="prose prose-sm dark:prose-invert max-w-none">
      <h2>What is Base64?</h2>
      <p>
        Base64 is a binary-to-text encoding scheme that represents binary data in an ASCII string format. It{"'"}s
        commonly used when there is a need to encode binary data that needs to be stored and transferred over media
        designed to deal with text.
      </p>

      <h2>Common Use Cases</h2>
      <ul>
        <li>Embedding images in HTML/CSS using data URIs</li>
        <li>Encoding email attachments (MIME)</li>
        <li>Storing binary data in JSON or XML</li>
        <li>Basic HTTP authentication headers</li>
        <li>Transferring binary data over REST APIs</li>
      </ul>

      <h2>URL-Safe Base64</h2>
      <p>
        Standard Base64 uses + and / characters which have special meaning in URLs. URL-safe Base64 replaces these with
        - and _ respectively, making it safe for use in URLs and filenames.
      </p>

      <h2>FAQ</h2>
      <h3>Is Base64 encryption?</h3>
      <p>
        No, Base64 is an encoding scheme, not encryption. It{"'"}s easily reversible and provides no security. Use
        actual encryption algorithms like AES for sensitive data.
      </p>

      <h3>Why does Base64 increase file size?</h3>
      <p>
        Base64 encoding increases data size by approximately 33% because it represents 3 bytes of binary data as 4 ASCII
        characters.
      </p>
    </div>
  )
}
