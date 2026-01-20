"use client"

import * as React from "react"
import { Suspense, useCallback, useEffect, useRef, useState } from "react"
import { z } from "zod"
import { ToolPageWrapper, useToolHistoryContext } from "@/components/tool-ui/tool-page-wrapper"
import { DualPaneLayout } from "@/components/tool-ui/dual-pane-layout"
import { DEFAULT_URL_SYNC_DEBOUNCE_MS, useUrlSyncedState } from "@/lib/url-state/use-url-synced-state"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Label } from "@/components/ui/label"
import { SearchableSelect } from "@/components/ui/searchable-select"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  convertCharset,
  getAllCharsets,
  validateInput,
  getBytesForDownload,
  autoDetectCharsetAndEncoding,
  autoDetectFromFile,
  type InputEncodingType,
  type OutputEncodingType,
} from "@/lib/encoding/charset-converter"
import type { HistoryEntry } from "@/lib/history/db"
import { ArrowRightLeft, Download, FileText } from "lucide-react"

const INPUT_ENCODING_OPTIONS: { value: string; label: string }[] = [
  { value: "raw", label: "Raw" },
  { value: "base64", label: "Base64" },
  { value: "url", label: "URL" },
  { value: "hex-escape", label: "Hex Escape" },
]

const OUTPUT_ENCODING_OPTIONS: { value: string; label: string }[] = [
  { value: "raw", label: "Raw" },
  { value: "base64", label: "Base64" },
  { value: "url", label: "URL" },
  { value: "hex-escape", label: "Hex Escape" },
]

const paramsSchema = z.object({
  inputCharset: z.string().default("UTF-8"),
  inputEncoding: z.string().default("raw"),
  outputCharset: z.string().default("UTF-8"),
  outputEncoding: z.string().default("raw"),
  urlSafeBase64: z.boolean().default(false),
  base64Padding: z.boolean().default(true),
  hexEscapeUpperCase: z.boolean().default(true),
  outputBOM: z.boolean().default(false),
  autoDetect: z.boolean().default(false),
  activeSide: z.string().default("left"),
  leftText: z.string().default(""),
  rightText: z.string().default(""),
})

const charsets = getAllCharsets()

function ScrollableTabsList({ children }: { children: React.ReactNode }) {
  return (
    <div className="w-full min-w-0">
      <TabsList className="inline-flex h-auto max-w-full flex-wrap items-center justify-start gap-1 [&_[data-slot=tabs-trigger]]:flex-none [&_[data-slot=tabs-trigger]]:!text-xs [&_[data-slot=tabs-trigger]][data-state=active]]:border-border">
        {children}
      </TabsList>
    </div>
  )
}

export default function CharsetConverterPage() {
  return (
    <Suspense fallback={null}>
      <CharsetConverterContent />
    </Suspense>
  )
}

type ParamsState = z.infer<typeof paramsSchema>

function CharsetConverterContent() {
  const { state, setParam, oversizeKeys, hasUrlParams, hydrationSource } = useUrlSyncedState("charset-converter", {
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

  const [leftError, setLeftError] = useState<string | null>(null)
  const [detectedInfo, setDetectedInfo] = useState<{ charset: string; encoding: string } | null>(null)

  const convert = useCallback(
    (input: string, charsetOverride?: string, encodingOverride?: string) => {
      try {
        if (!input) {
          setParam("rightText", "")
          setLeftError(null)
          setDetectedInfo(null)
          return
        }

        setLeftError(null)

        const effectiveCharset = charsetOverride || state.inputCharset
        const effectiveEncoding = (encodingOverride || state.inputEncoding) as InputEncodingType

        if (!validateInput(input, effectiveEncoding)) {
          setLeftError(`Invalid ${effectiveEncoding} format`)
          return
        }

        const result = convertCharset(input, {
          inputCharset: effectiveCharset,
          inputEncoding: effectiveEncoding,
          outputCharset: state.outputCharset,
          outputEncoding: state.outputEncoding as OutputEncodingType,
          urlSafeBase64: state.urlSafeBase64,
          base64Padding: state.base64Padding,
          hexEscapeUpperCase: state.hexEscapeUpperCase,
        })

        setParam("rightText", result.displayText)
      } catch (err) {
        setLeftError(err instanceof Error ? err.message : "Conversion failed")
      }
    },
    [state.inputCharset, state.inputEncoding, state.outputCharset, state.outputEncoding, state.urlSafeBase64, state.base64Padding, state.hexEscapeUpperCase, setParam],
  )

  const handleLeftChange = useCallback(
    (value: string) => {
      setParam("leftText", value)
      setParam("activeSide", "left")

      if (state.autoDetect) {
        const detection = autoDetectCharsetAndEncoding(value)
        if (detection.isValid) {
          setDetectedInfo({ charset: detection.charset, encoding: detection.encoding })
          if (detection.charset !== state.inputCharset || detection.encoding !== state.inputEncoding) {
            setParam("inputCharset", detection.charset)
            setParam("inputEncoding", detection.encoding)
          }
          convert(value, detection.charset, detection.encoding)
        } else {
          setLeftError("Could not auto-detect input format. Please select charset and encoding manually.")
          setDetectedInfo(null)
        }
      } else {
        setDetectedInfo(null)
        convert(value)
      }
    },
    [state.autoDetect, state.inputCharset, state.inputEncoding, convert, setParam],
  )

  const handleFileUpload = useCallback(
    async (file: File) => {
      try {
        const arrayBuffer = await file.arrayBuffer()
        const bytes = new Uint8Array(arrayBuffer)

        if (state.autoDetect) {
          const detection = autoDetectFromFile(bytes)
          if (detection.isValid) {
            let text = ""
            try {
              text = new TextDecoder(detection.charset.toLowerCase().replace("-", "")).decode(bytes)
            } catch {
              text = new TextDecoder("utf-8", { fatal: false }).decode(bytes)
            }
            setDetectedInfo({ charset: detection.charset, encoding: detection.encoding })
            setParam("inputCharset", detection.charset)
            setParam("inputEncoding", detection.encoding)
            setParam("leftText", text)
            setParam("activeSide", "left")
            convert(text, detection.charset, detection.encoding)
          } else {
            setLeftError("Could not auto-detect file format. Please select charset and encoding manually.")
            setDetectedInfo(null)
          }
        } else {
          const text = new TextDecoder("utf-8", { fatal: false }).decode(bytes)
          setParam("leftText", text)
          setParam("activeSide", "left")
          convert(text)
        }
      } catch (err) {
        setLeftError(err instanceof Error ? err.message : "Failed to load file")
      }
    },
    [state.autoDetect, convert, setParam],
  )

  const handleSwapCharsets = useCallback(() => {
    const newInputCharset = state.outputCharset
    const newOutputCharset = state.inputCharset
    setParam("inputCharset", newInputCharset)
    setParam("outputCharset", newOutputCharset)
    if (state.leftText) {
      convert(state.leftText, newInputCharset, state.inputEncoding)
    }
  }, [state.inputCharset, state.outputCharset, state.leftText, state.inputEncoding, convert, setParam])

  const handleSwapEncodings = useCallback(() => {
    const newInputEncoding = state.outputEncoding
    const newOutputEncoding = state.inputEncoding
    setParam("inputEncoding", newInputEncoding)
    setParam("outputEncoding", newOutputEncoding)
    if (state.leftText) {
      convert(state.leftText, state.inputCharset, newInputEncoding as InputEncodingType)
    }
  }, [state.inputEncoding, state.outputEncoding, state.leftText, state.inputCharset, convert, setParam])

  useEffect(() => {
    if (state.activeSide === "left" && state.leftText && !state.autoDetect) {
      convert(state.leftText)
    }
  }, [state.activeSide, state.inputCharset, state.inputEncoding, state.outputCharset, state.outputEncoding, state.urlSafeBase64, state.base64Padding, state.hexEscapeUpperCase, convert, state.leftText, state.autoDetect])

  const handleDownload = useCallback(() => {
    const output = state.rightText
    if (!output) return

    try {
      const bytes = new TextEncoder().encode(output)
      let finalBytes = bytes

      if (state.outputBOM && state.outputCharset !== "UTF-8") {
        const bomMap: Record<string, Uint8Array> = {
          "UTF-16LE": new Uint8Array([0xff, 0xfe]),
          "UTF-16BE": new Uint8Array([0xfe, 0xff]),
          "UTF-32LE": new Uint8Array([0xff, 0xfe, 0x00, 0x00]),
          "UTF-32BE": new Uint8Array([0x00, 0x00, 0xfe, 0xff]),
        }
        const bom = bomMap[state.outputCharset]
        if (bom) {
          const withBom = new Uint8Array(bom.length + finalBytes.length)
          withBom.set(bom, 0)
          withBom.set(finalBytes, bom.length)
          finalBytes = withBom
        }
      }

      const { content, mimeType } = getBytesForDownload(finalBytes, state.outputEncoding as OutputEncodingType, state.outputCharset, {
        urlSafeBase64: state.urlSafeBase64,
        base64Padding: state.base64Padding,
        hexEscapeUpperCase: state.hexEscapeUpperCase,
      })

      const blob = content instanceof Uint8Array ? new Blob([content], { type: mimeType }) : new Blob([content], { type: mimeType })
      const url = URL.createObjectURL(blob)
      const filename = `converted-${state.outputCharset.toLowerCase()}-${state.outputEncoding}.txt`

      const a = document.createElement("a")
      a.href = url
      a.download = filename
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
    } catch (err) {
      setLeftError(err instanceof Error ? err.message : "Failed to prepare download")
    }
  }, [state.rightText, state.outputEncoding, state.outputCharset, state.outputBOM, state.urlSafeBase64, state.base64Padding, state.hexEscapeUpperCase])

  const handleLoadHistory = useCallback(
    (entry: HistoryEntry) => {
      const { inputs, params } = entry
      if (inputs.leftText !== undefined) setParam("leftText", inputs.leftText as string)
      if (inputs.rightText !== undefined) setParam("rightText", inputs.rightText as string)
      if (params.inputCharset) setParam("inputCharset", params.inputCharset as string)
      if (params.inputEncoding) setParam("inputEncoding", params.inputEncoding as string)
      if (params.outputCharset) setParam("outputCharset", params.outputCharset as string)
      if (params.outputEncoding) setParam("outputEncoding", params.outputEncoding as string)
      if (params.urlSafeBase64 !== undefined) setParam("urlSafeBase64", params.urlSafeBase64 as boolean)
      if (params.base64Padding !== undefined) setParam("base64Padding", params.base64Padding as boolean)
      if (params.hexEscapeUpperCase !== undefined) setParam("hexEscapeUpperCase", params.hexEscapeUpperCase as boolean)
      if (params.outputBOM !== undefined) setParam("outputBOM", params.outputBOM as boolean)
      if (params.autoDetect !== undefined) setParam("autoDetect", params.autoDetect as boolean)
      if (params.activeSide) setParam("activeSide", params.activeSide as string)
    },
    [setParam],
  )

  return (
    <ToolPageWrapper
      toolId="charset-converter"
      title="Text Charset Converter"
      description="Convert text between 100+ charsets and encoding formats (UTF-8, GBK, Shift_JIS, etc.) with auto-detect support. Encode/decode Base64, URL, and Hex Escape sequences."
      onLoadHistory={handleLoadHistory}
    >
      <CharsetConverterInner
        state={state}
        setParam={setParam}
        oversizeKeys={oversizeKeys}
        hasUrlParams={hasUrlParams}
        hydrationSource={hydrationSource}
        leftError={leftError}
        detectedInfo={detectedInfo}
        handleLeftChange={handleLeftChange}
        handleFileUpload={handleFileUpload}
        handleSwapCharsets={handleSwapCharsets}
        handleSwapEncodings={handleSwapEncodings}
        handleDownload={handleDownload}
      />
    </ToolPageWrapper>
  )
}

interface CharsetConverterInnerProps {
  state: ParamsState
  setParam: <K extends keyof ParamsState>(key: K, value: ParamsState[K], updateHistory?: boolean) => void
  oversizeKeys: (keyof ParamsState)[]
  hasUrlParams: boolean
  hydrationSource: "default" | "url" | "history"
  leftError: string | null
  detectedInfo: { charset: string; encoding: string } | null
  handleLeftChange: (value: string) => void
  handleFileUpload: (file: File) => void
  handleSwapCharsets: () => void
  handleSwapEncodings: () => void
  handleDownload: () => void
}

function CharsetConverterInner({
  state,
  setParam,
  oversizeKeys,
  hasUrlParams,
  hydrationSource,
  leftError,
  detectedInfo,
  handleLeftChange,
  handleFileUpload,
  handleSwapCharsets,
  handleSwapEncodings,
  handleDownload,
}: CharsetConverterInnerProps) {
  const { upsertInputEntry, upsertParams } = useToolHistoryContext()
  const lastInputRef = useRef<string>("")
  const hasHydratedInputRef = useRef(false)
  const paramsRef = useRef({
    inputCharset: state.inputCharset,
    inputEncoding: state.inputEncoding,
    outputCharset: state.outputCharset,
    outputEncoding: state.outputEncoding,
    urlSafeBase64: state.urlSafeBase64,
    base64Padding: state.base64Padding,
    hexEscapeUpperCase: state.hexEscapeUpperCase,
    outputBOM: state.outputBOM,
    autoDetect: state.autoDetect,
    activeSide: state.activeSide,
  })
  const hasInitializedParamsRef = useRef(false)
  const hasHandledUrlRef = useRef(false)

  const leftWarning = oversizeKeys.includes("leftText" as keyof ParamsState)
    ? "Input exceeds 2 KB and is not synced to the URL."
    : null

  useEffect(() => {
    if (hasHydratedInputRef.current) return
    if (hydrationSource === "default") return
    const activeText = state.activeSide === "left" ? state.leftText : state.rightText
    lastInputRef.current = activeText
    hasHydratedInputRef.current = true
  }, [hydrationSource, state.activeSide, state.leftText, state.rightText])

  useEffect(() => {
    const activeText = state.activeSide === "left" ? state.leftText : state.rightText
    if (!activeText || activeText === lastInputRef.current) return

    const timer = setTimeout(() => {
      lastInputRef.current = activeText
      upsertInputEntry(
        { leftText: state.leftText, rightText: state.rightText },
        {
          inputCharset: state.inputCharset,
          inputEncoding: state.inputEncoding,
          outputCharset: state.outputCharset,
          outputEncoding: state.outputEncoding,
          urlSafeBase64: state.urlSafeBase64,
          base64Padding: state.base64Padding,
          hexEscapeUpperCase: state.hexEscapeUpperCase,
          outputBOM: state.outputBOM,
          autoDetect: state.autoDetect,
          activeSide: state.activeSide,
        },
        state.activeSide,
        activeText.slice(0, 100),
      )
    }, DEFAULT_URL_SYNC_DEBOUNCE_MS)

    return () => clearTimeout(timer)
  }, [
    state.leftText,
    state.rightText,
    state.activeSide,
    state.inputCharset,
    state.inputEncoding,
    state.outputCharset,
    state.outputEncoding,
    state.urlSafeBase64,
    state.base64Padding,
    state.hexEscapeUpperCase,
    state.outputBOM,
    state.autoDetect,
    upsertInputEntry,
  ])

  useEffect(() => {
    if (hasUrlParams && !hasHandledUrlRef.current) {
      hasHandledUrlRef.current = true
      const activeText = state.activeSide === "left" ? state.leftText : state.rightText
      if (activeText) {
        upsertInputEntry(
          { leftText: state.leftText, rightText: state.rightText },
          {
            inputCharset: state.inputCharset,
            inputEncoding: state.inputEncoding,
            outputCharset: state.outputCharset,
            outputEncoding: state.outputEncoding,
            urlSafeBase64: state.urlSafeBase64,
            base64Padding: state.base64Padding,
            hexEscapeUpperCase: state.hexEscapeUpperCase,
            outputBOM: state.outputBOM,
            autoDetect: state.autoDetect,
            activeSide: state.activeSide,
          },
          state.activeSide,
          activeText.slice(0, 100),
        )
      } else {
        upsertParams(
          {
            inputCharset: state.inputCharset,
            inputEncoding: state.inputEncoding,
            outputCharset: state.outputCharset,
            outputEncoding: state.outputEncoding,
            urlSafeBase64: state.urlSafeBase64,
            base64Padding: state.base64Padding,
            hexEscapeUpperCase: state.hexEscapeUpperCase,
            outputBOM: state.outputBOM,
            autoDetect: state.autoDetect,
            activeSide: state.activeSide,
          },
          "interpretation",
        )
      }
    }
  }, [
    hasUrlParams,
    state.leftText,
    state.rightText,
    state.activeSide,
    state.inputCharset,
    state.inputEncoding,
    state.outputCharset,
    state.outputEncoding,
    state.urlSafeBase64,
    state.base64Padding,
    state.hexEscapeUpperCase,
    state.outputBOM,
    state.autoDetect,
    upsertInputEntry,
    upsertParams,
  ])

  useEffect(() => {
    const nextParams = {
      inputCharset: state.inputCharset,
      inputEncoding: state.inputEncoding,
      outputCharset: state.outputCharset,
      outputEncoding: state.outputEncoding,
      urlSafeBase64: state.urlSafeBase64,
      base64Padding: state.base64Padding,
      hexEscapeUpperCase: state.hexEscapeUpperCase,
      outputBOM: state.outputBOM,
      autoDetect: state.autoDetect,
      activeSide: state.activeSide,
    }
    if (!hasInitializedParamsRef.current) {
      hasInitializedParamsRef.current = true
      paramsRef.current = nextParams
      return
    }
    if (
      paramsRef.current.inputCharset === nextParams.inputCharset &&
      paramsRef.current.inputEncoding === nextParams.inputEncoding &&
      paramsRef.current.outputCharset === nextParams.outputCharset &&
      paramsRef.current.outputEncoding === nextParams.outputEncoding &&
      paramsRef.current.urlSafeBase64 === nextParams.urlSafeBase64 &&
      paramsRef.current.base64Padding === nextParams.base64Padding &&
      paramsRef.current.hexEscapeUpperCase === nextParams.hexEscapeUpperCase &&
      paramsRef.current.outputBOM === nextParams.outputBOM &&
      paramsRef.current.autoDetect === nextParams.autoDetect &&
      paramsRef.current.activeSide === nextParams.activeSide
    ) {
      return
    }
    paramsRef.current = nextParams
    upsertParams(nextParams, "interpretation")
  }, [
    state.inputCharset,
    state.inputEncoding,
    state.outputCharset,
    state.outputEncoding,
    state.urlSafeBase64,
    state.base64Padding,
    state.hexEscapeUpperCase,
    state.outputBOM,
    state.autoDetect,
    state.activeSide,
    upsertParams,
  ])

  return (
    <div className="flex h-full flex-col gap-4">
      <div className="flex flex-col gap-3 w-full">
        <div className="flex items-start gap-3">
          <Label className="w-20 shrink-0 text-sm">Charset</Label>
          <div className="flex flex-wrap items-center gap-2">
            <SearchableSelect
              value={state.inputCharset}
              onValueChange={(v) => {
                setParam("inputCharset", v)
                setParam("autoDetect", false)
              }}
              options={charsets}
              placeholder="Input..."
              searchPlaceholder="Search..."
              triggerClassName="w-24 text-xs h-8"
              className="w-24"
              disabled={state.autoDetect}
            />
            <Button variant="outline" size="icon" onClick={handleSwapCharsets} className="h-8 w-8 shrink-0" title="Swap charsets">
              <ArrowRightLeft className="h-3.5 w-3.5" />
            </Button>
            <SearchableSelect
              value={state.outputCharset}
              onValueChange={(v) => setParam("outputCharset", v)}
              options={charsets}
              placeholder="Output..."
              searchPlaceholder="Search..."
              triggerClassName="w-24 text-xs h-8"
              className="w-24"
            />
          </div>
        </div>

        <div className="flex items-start gap-3">
          <Label className="w-20 shrink-0 text-sm">Encoding</Label>
          <div className="flex flex-wrap items-center gap-2">
            <Tabs
              value={state.inputEncoding}
              onValueChange={(v) => {
                setParam("inputEncoding", v)
                setParam("autoDetect", false)
              }}
              className="min-w-0 flex-1"
            >
              <ScrollableTabsList>
                {INPUT_ENCODING_OPTIONS.map((opt) => (
                  <TabsTrigger key={opt.value} value={opt.value} className="text-xs flex-none">
                    {opt.label}
                  </TabsTrigger>
                ))}
              </ScrollableTabsList>
            </Tabs>
            <Button variant="outline" size="icon" onClick={handleSwapEncodings} className="h-8 w-8 shrink-0" title="Swap encodings">
              <ArrowRightLeft className="h-3.5 w-3.5" />
            </Button>
            <Tabs
              value={state.outputEncoding}
              onValueChange={(v) => setParam("outputEncoding", v)}
              className="min-w-0 flex-1"
            >
              <ScrollableTabsList>
                {OUTPUT_ENCODING_OPTIONS.map((opt) => (
                  <TabsTrigger key={opt.value} value={opt.value} className="text-xs flex-none">
                    {opt.label}
                  </TabsTrigger>
                ))}
              </ScrollableTabsList>
            </Tabs>
          </div>
        </div>

        <div className="flex items-start gap-3">
          <Label className="w-20 shrink-0 text-sm">Options</Label>
          <div className="flex flex-wrap items-center gap-4">
            <label className="flex items-center gap-1.5 text-xs cursor-pointer">
              <Checkbox
                id="autoDetect"
                checked={state.autoDetect}
                onCheckedChange={(c) => setParam("autoDetect", c === true)}
              />
              <span>Auto-detect</span>
            </label>

            {(state.inputEncoding === "base64" || state.outputEncoding === "base64") && (
              <>
                <label className="flex items-center gap-1.5 text-xs cursor-pointer">
                  <Checkbox
                    id="urlSafeBase64"
                    checked={state.urlSafeBase64}
                    onCheckedChange={(c) => setParam("urlSafeBase64", c === true)}
                  />
                  <span>URL-safe</span>
                </label>
                <label className="flex items-center gap-1.5 text-xs cursor-pointer">
                  <Checkbox
                    id="base64Padding"
                    checked={state.base64Padding}
                    onCheckedChange={(c) => setParam("base64Padding", c === true)}
                  />
                  <span>Padding</span>
                </label>
              </>
            )}

            {state.outputEncoding === "hex-escape" && (
              <label className="flex items-center gap-1.5 text-xs cursor-pointer">
                <Checkbox
                  id="hexEscapeUpperCase"
                  checked={state.hexEscapeUpperCase}
                  onCheckedChange={(c) => setParam("hexEscapeUpperCase", c === true)}
                />
                <span>Uppercase</span>
              </label>
            )}

            {state.outputEncoding === "raw" && state.outputCharset !== "UTF-8" && (
              <label className="flex items-center gap-1.5 text-xs cursor-pointer">
                <Checkbox
                  id="outputBOM"
                  checked={state.outputBOM}
                  onCheckedChange={(c) => setParam("outputBOM", c === true)}
                />
                <span>BOM</span>
              </label>
            )}
          </div>
        </div>

        {detectedInfo && state.autoDetect && (
          <div className="flex items-start gap-3">
            <Label className="w-20 shrink-0 text-sm">Detected</Label>
            <div className="flex items-center gap-2 text-xs text-muted-foreground bg-muted/50 rounded px-3 py-1.5">
              <FileText className="h-3.5 w-3.5" />
              <span>
                <span className="font-medium">{detectedInfo.charset}</span> / <span className="font-medium">{detectedInfo.encoding}</span>
              </span>
            </div>
          </div>
        )}
      </div>

      <DualPaneLayout
        leftLabel={`Input (${state.autoDetect ? "Auto" : state.inputCharset})`}
        rightLabel={`Output (${state.outputCharset})`}
        leftValue={state.leftText}
        rightValue={state.rightText}
        onLeftChange={handleLeftChange}
        onRightChange={() => {}}
        activeSide={state.activeSide as "left" | "right"}
        leftError={leftError}
        leftWarning={leftWarning}
        leftPlaceholder="Enter text or drag & drop file..."
        rightPlaceholder="Converted text will appear here..."
        leftFileUpload={handleFileUpload}
        rightDownload={handleDownload}
      />
    </div>
  )
}
