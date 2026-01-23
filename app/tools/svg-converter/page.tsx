"use client"

import * as React from "react"
import { Suspense, useCallback, useRef, useState } from "react"
import { z } from "zod"
import { ToolPageWrapper, useToolHistoryContext } from "@/components/tool-ui/tool-page-wrapper"
import { DEFAULT_URL_SYNC_DEBOUNCE_MS, useUrlSyncedState } from "@/lib/url-state/use-url-synced-state"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Checkbox } from "@/components/ui/checkbox"
import { Download, Upload, ImageIcon, RefreshCw, Trash2, Link2 } from "lucide-react"
import type { HistoryEntry } from "@/lib/history/db"

const paramsSchema = z.object({
  svgContent: z.string().default(""),
  width: z.number().default(512),
  height: z.number().default(512),
  maintainAspectRatio: z.boolean().default(true),
  backgroundColor: z.string().default("transparent"),
})

export default function SvgConverterPage() {
  return (
    <Suspense fallback={null}>
      <SvgConverterContent />
    </Suspense>
  )
}

function SvgConverterContent() {
  const { state, setParam, oversizeKeys, hasUrlParams, hydrationSource } = useUrlSyncedState("svg-converter", {
    schema: paramsSchema,
    defaults: paramsSchema.parse({}),
  })

  const handleLoadHistory = useCallback(
    (entry: HistoryEntry) => {
      const { inputs, params } = entry
      if (inputs.svgContent !== undefined) setParam("svgContent", inputs.svgContent)
      if (params.width !== undefined) setParam("width", params.width as number)
      if (params.height !== undefined) setParam("height", params.height as number)
      if (params.maintainAspectRatio !== undefined) setParam("maintainAspectRatio", params.maintainAspectRatio as boolean)
      if (params.backgroundColor !== undefined) setParam("backgroundColor", params.backgroundColor as string)
    },
    [setParam],
  )

  return (
    <ToolPageWrapper
      toolId="svg-converter"
      title="SVG Converter"
      description="Convert SVG to PNG with custom size, edit SVG content, and preview in real-time"
      onLoadHistory={handleLoadHistory}
    >
      <SvgConverterInner
        state={state}
        setParam={setParam}
        oversizeKeys={oversizeKeys}
        hasUrlParams={hasUrlParams}
        hydrationSource={hydrationSource}
      />
    </ToolPageWrapper>
  )
}

function SvgConverterInner({
  state,
  setParam,
  oversizeKeys,
  hasUrlParams,
  hydrationSource,
}: {
  state: z.infer<typeof paramsSchema>
  setParam: <K extends keyof z.infer<typeof paramsSchema>>(
    key: K,
    value: z.infer<typeof paramsSchema>[K],
    updateHistory?: boolean,
  ) => void
  oversizeKeys: (keyof z.infer<typeof paramsSchema>)[]
  hasUrlParams: boolean
  hydrationSource: "default" | "url" | "history"
}) {
  const { upsertInputEntry, upsertParams } = useToolHistoryContext()
  const [error, setError] = useState<string | null>(null)
  const [svgDimensions, setSvgDimensions] = useState<{ width: number; height: number } | null>(null)
  const [isConverting, setIsConverting] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const lastInputRef = useRef<string>("")
  const hasHydratedInputRef = useRef(false)
  const paramsRef = useRef({
    width: state.width,
    height: state.height,
    maintainAspectRatio: state.maintainAspectRatio,
    backgroundColor: state.backgroundColor,
  })
  const hasInitializedParamsRef = useRef(false)
  const hasHandledUrlRef = useRef(false)

  // History tracking effects
  React.useEffect(() => {
    if (hasHydratedInputRef.current) return
    if (hydrationSource === "default") return
    lastInputRef.current = state.svgContent
    hasHydratedInputRef.current = true
  }, [hydrationSource, state.svgContent])

  React.useEffect(() => {
    if (!state.svgContent || state.svgContent === lastInputRef.current) return

    const timer = setTimeout(() => {
      lastInputRef.current = state.svgContent
      upsertInputEntry(
        { svgContent: state.svgContent },
        {
          width: state.width,
          height: state.height,
          maintainAspectRatio: state.maintainAspectRatio,
          backgroundColor: state.backgroundColor,
        },
        undefined,
        state.svgContent.slice(0, 100),
      )
    }, DEFAULT_URL_SYNC_DEBOUNCE_MS)

    return () => clearTimeout(timer)
  }, [state.svgContent, state.width, state.height, state.maintainAspectRatio, state.backgroundColor, upsertInputEntry])

  React.useEffect(() => {
    if (hasUrlParams && !hasHandledUrlRef.current) {
      hasHandledUrlRef.current = true
      if (state.svgContent) {
        upsertInputEntry(
          { svgContent: state.svgContent },
          {
            width: state.width,
            height: state.height,
            maintainAspectRatio: state.maintainAspectRatio,
            backgroundColor: state.backgroundColor,
          },
          undefined,
          state.svgContent.slice(0, 100),
        )
      } else {
        upsertParams(
          {
            width: state.width,
            height: state.height,
            maintainAspectRatio: state.maintainAspectRatio,
            backgroundColor: state.backgroundColor,
          },
          "interpretation",
        )
      }
    }
  }, [hasUrlParams, state.svgContent, state.width, state.height, state.maintainAspectRatio, state.backgroundColor, upsertInputEntry, upsertParams])

  React.useEffect(() => {
    const nextParams = {
      width: state.width,
      height: state.height,
      maintainAspectRatio: state.maintainAspectRatio,
      backgroundColor: state.backgroundColor,
    }
    if (!hasInitializedParamsRef.current) {
      hasInitializedParamsRef.current = true
      paramsRef.current = nextParams
      return
    }
    if (
      paramsRef.current.width === nextParams.width &&
      paramsRef.current.height === nextParams.height &&
      paramsRef.current.maintainAspectRatio === nextParams.maintainAspectRatio &&
      paramsRef.current.backgroundColor === nextParams.backgroundColor
    ) {
      return
    }
    paramsRef.current = nextParams
    upsertParams(nextParams, "interpretation")
  }, [state.width, state.height, state.maintainAspectRatio, state.backgroundColor, upsertParams])

  // Parse SVG dimensions from content
  const parseSvgDimensions = useCallback((svgString: string) => {
    try {
      const parser = new DOMParser()
      const doc = parser.parseFromString(svgString, "image/svg+xml")
      const svg = doc.querySelector("svg")
      
      if (!svg) {
        setError("Invalid SVG: No <svg> element found")
        setSvgDimensions(null)
        return
      }

      const parserError = doc.querySelector("parsererror")
      if (parserError) {
        setError("Invalid SVG: " + parserError.textContent?.slice(0, 100))
        setSvgDimensions(null)
        return
      }

      let width = 0
      let height = 0

      // Try to get dimensions from width/height attributes
      const widthAttr = svg.getAttribute("width")
      const heightAttr = svg.getAttribute("height")
      
      if (widthAttr && heightAttr) {
        width = parseFloat(widthAttr) || 0
        height = parseFloat(heightAttr) || 0
      }

      // If no width/height, try viewBox
      if ((!width || !height) && svg.getAttribute("viewBox")) {
        const viewBox = svg.getAttribute("viewBox")!.split(/\s+|,/).map(Number)
        if (viewBox.length >= 4) {
          width = viewBox[2]
          height = viewBox[3]
        }
      }

      // Default fallback
      if (!width) width = 100
      if (!height) height = 100

      setError(null)
      setSvgDimensions({ width, height })
      
      // Update state dimensions if maintain aspect ratio and this is first load
      if (state.maintainAspectRatio && width && height) {
        setParam("width", Math.round(width), true)
        setParam("height", Math.round(height), true)
      }
    } catch {
      setError("Failed to parse SVG")
      setSvgDimensions(null)
    }
  }, [state.maintainAspectRatio, setParam])

  // Handle SVG content change
  const handleSvgChange = useCallback((value: string) => {
    setParam("svgContent", value)
    if (value.trim()) {
      parseSvgDimensions(value)
    } else {
      setError(null)
      setSvgDimensions(null)
    }
  }, [setParam, parseSvgDimensions])

  // Handle file upload
  const handleFileUpload = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    if (!file.type.includes("svg") && !file.name.endsWith(".svg")) {
      setError("Please upload an SVG file")
      return
    }

    try {
      const text = await file.text()
      handleSvgChange(text)
    } catch {
      setError("Failed to read file")
    }

    // Reset input
    if (fileInputRef.current) {
      fileInputRef.current.value = ""
    }
  }, [handleSvgChange])

  // Handle width change with aspect ratio
  const handleWidthChange = useCallback((value: string) => {
    const newWidth = parseInt(value) || 0
    setParam("width", newWidth, true)
    
    if (state.maintainAspectRatio && svgDimensions) {
      const ratio = svgDimensions.height / svgDimensions.width
      setParam("height", Math.round(newWidth * ratio), true)
    }
  }, [setParam, state.maintainAspectRatio, svgDimensions])

  // Handle height change with aspect ratio
  const handleHeightChange = useCallback((value: string) => {
    const newHeight = parseInt(value) || 0
    setParam("height", newHeight, true)
    
    if (state.maintainAspectRatio && svgDimensions) {
      const ratio = svgDimensions.width / svgDimensions.height
      setParam("width", Math.round(newHeight * ratio), true)
    }
  }, [setParam, state.maintainAspectRatio, svgDimensions])

  // Convert SVG to PNG and download
  const convertAndDownload = useCallback(async () => {
    if (!state.svgContent || !state.width || !state.height) return

    setIsConverting(true)
    setError(null)

    try {
      const canvas = canvasRef.current
      if (!canvas) throw new Error("Canvas not available")

      const ctx = canvas.getContext("2d")
      if (!ctx) throw new Error("Canvas context not available")

      canvas.width = state.width
      canvas.height = state.height

      // Clear canvas with background color
      if (state.backgroundColor === "transparent") {
        ctx.clearRect(0, 0, state.width, state.height)
      } else {
        ctx.fillStyle = state.backgroundColor
        ctx.fillRect(0, 0, state.width, state.height)
      }

      // Create blob from SVG
      const svgBlob = new Blob([state.svgContent], { type: "image/svg+xml;charset=utf-8" })
      const url = URL.createObjectURL(svgBlob)

      const img = new window.Image()
      img.crossOrigin = "anonymous"

      await new Promise<void>((resolve, reject) => {
        img.onload = () => {
          ctx.drawImage(img, 0, 0, state.width, state.height)
          URL.revokeObjectURL(url)
          resolve()
        }
        img.onerror = () => {
          URL.revokeObjectURL(url)
          reject(new Error("Failed to load SVG image"))
        }
        img.src = url
      })

      // Convert to PNG and download
      canvas.toBlob((blob) => {
        if (!blob) {
          setError("Failed to create PNG")
          setIsConverting(false)
          return
        }

        const downloadUrl = URL.createObjectURL(blob)
        const a = document.createElement("a")
        a.href = downloadUrl
        a.download = `converted-${state.width}x${state.height}.png`
        document.body.appendChild(a)
        a.click()
        document.body.removeChild(a)
        URL.revokeObjectURL(downloadUrl)
        setIsConverting(false)
      }, "image/png")
    } catch (err) {
      setError(err instanceof Error ? err.message : "Conversion failed")
      setIsConverting(false)
    }
  }, [state.svgContent, state.width, state.height, state.backgroundColor])

  // Create preview URL
  const previewUrl = React.useMemo(() => {
    if (!state.svgContent) return null
    try {
      const blob = new Blob([state.svgContent], { type: "image/svg+xml;charset=utf-8" })
      return URL.createObjectURL(blob)
    } catch {
      return null
    }
  }, [state.svgContent])

  // Cleanup preview URL
  React.useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl)
    }
  }, [previewUrl])

  const oversizeWarning = oversizeKeys.includes("svgContent")
    ? "SVG content exceeds 2 KB and is not synced to the URL."
    : null

  return (
    <div className="space-y-6">
      {/* Hidden canvas for conversion */}
      <canvas ref={canvasRef} className="hidden" />

      {/* Upload and Controls */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-medium">Settings</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap items-end gap-4">
            {/* File Upload */}
            <div className="flex flex-col gap-2">
              <Label htmlFor="svg-upload">Upload SVG</Label>
              <div className="flex gap-2">
                <input
                  ref={fileInputRef}
                  id="svg-upload"
                  type="file"
                  accept=".svg,image/svg+xml"
                  onChange={handleFileUpload}
                  className="hidden"
                />
                <Button
                  variant="outline"
                  onClick={() => fileInputRef.current?.click()}
                >
                  <Upload className="mr-2 h-4 w-4" />
                  Choose File
                </Button>
              </div>
            </div>

            {/* Width */}
            <div className="flex flex-col gap-2">
              <Label htmlFor="width">Width (px)</Label>
              <Input
                id="width"
                type="number"
                min={1}
                max={8192}
                value={state.width}
                onChange={(e) => handleWidthChange(e.target.value)}
                className="w-28"
              />
            </div>

            {/* Link icon for aspect ratio */}
            <div className="flex items-center pb-2">
              <Link2 className={`h-4 w-4 ${state.maintainAspectRatio ? "text-primary" : "text-muted-foreground"}`} />
            </div>

            {/* Height */}
            <div className="flex flex-col gap-2">
              <Label htmlFor="height">Height (px)</Label>
              <Input
                id="height"
                type="number"
                min={1}
                max={8192}
                value={state.height}
                onChange={(e) => handleHeightChange(e.target.value)}
                className="w-28"
              />
            </div>

            {/* Aspect Ratio */}
            <div className="flex items-center gap-2 pb-2">
              <Checkbox
                id="aspect-ratio"
                checked={state.maintainAspectRatio}
                onCheckedChange={(checked) => setParam("maintainAspectRatio", checked === true, true)}
              />
              <Label htmlFor="aspect-ratio" className="text-sm cursor-pointer">
                Lock Aspect Ratio
              </Label>
            </div>

            {/* Background Color */}
            <div className="flex flex-col gap-2">
              <Label htmlFor="bg-color">Background</Label>
              <div className="flex gap-2">
                <Input
                  id="bg-color"
                  type="text"
                  value={state.backgroundColor}
                  onChange={(e) => setParam("backgroundColor", e.target.value, true)}
                  placeholder="transparent"
                  className="w-32"
                />
                {state.backgroundColor !== "transparent" && (
                  <Input
                    type="color"
                    value={state.backgroundColor === "transparent" ? "#ffffff" : state.backgroundColor}
                    onChange={(e) => setParam("backgroundColor", e.target.value, true)}
                    className="w-12 p-1 h-9"
                  />
                )}
              </div>
            </div>

            {/* Quick presets */}
            <div className="flex flex-col gap-2">
              <Label>Quick Sizes</Label>
              <div className="flex gap-1">
                {[
                  { label: "16", w: 16, h: 16 },
                  { label: "32", w: 32, h: 32 },
                  { label: "64", w: 64, h: 64 },
                  { label: "128", w: 128, h: 128 },
                  { label: "256", w: 256, h: 256 },
                  { label: "512", w: 512, h: 512 },
                  { label: "1024", w: 1024, h: 1024 },
                ].map((preset) => (
                  <Button
                    key={preset.label}
                    variant="outline"
                    size="sm"
                    className="px-2 bg-transparent"
                    onClick={() => {
                      if (state.maintainAspectRatio && svgDimensions) {
                        const ratio = svgDimensions.height / svgDimensions.width
                        setParam("width", preset.w, true)
                        setParam("height", Math.round(preset.w * ratio), true)
                      } else {
                        setParam("width", preset.w, true)
                        setParam("height", preset.h, true)
                      }
                    }}
                  >
                    {preset.label}
                  </Button>
                ))}
              </div>
            </div>
          </div>

          {/* SVG Dimensions Info */}
          {svgDimensions && (
            <div className="mt-4 text-sm text-muted-foreground">
              Original SVG size: {svgDimensions.width} x {svgDimensions.height}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Error display */}
      {error && (
        <Card className="border-destructive">
          <CardContent className="p-4">
            <p className="text-sm text-destructive">{error}</p>
          </CardContent>
        </Card>
      )}

      {/* Oversize warning */}
      {oversizeWarning && (
        <Card className="border-yellow-500">
          <CardContent className="p-4">
            <p className="text-sm text-yellow-600">{oversizeWarning}</p>
          </CardContent>
        </Card>
      )}

      {/* Main content area */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* SVG Editor */}
        <Card className="flex flex-col">
          <CardHeader className="pb-3 flex-row items-center justify-between space-y-0">
            <CardTitle className="text-base font-medium">SVG Code</CardTitle>
            <div className="flex gap-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => handleSvgChange("")}
                disabled={!state.svgContent}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          </CardHeader>
          <CardContent className="flex-1">
            <Textarea
              value={state.svgContent}
              onChange={(e) => handleSvgChange(e.target.value)}
              placeholder={`Paste your SVG code here or upload a file...

Example:
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">
  <circle cx="50" cy="50" r="40" fill="blue"/>
</svg>`}
              className="min-h-[400px] font-mono text-sm resize-none"
            />
          </CardContent>
        </Card>

        {/* Preview */}
        <Card className="flex flex-col">
          <CardHeader className="pb-3 flex-row items-center justify-between space-y-0">
            <CardTitle className="text-base font-medium">Preview</CardTitle>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  if (state.svgContent) parseSvgDimensions(state.svgContent)
                }}
                disabled={!state.svgContent}
              >
                <RefreshCw className="h-4 w-4 mr-1" />
                Refresh
              </Button>
              <Button
                variant="default"
                size="sm"
                onClick={convertAndDownload}
                disabled={!state.svgContent || !state.width || !state.height || isConverting}
              >
                {isConverting ? (
                  <>
                    <RefreshCw className="h-4 w-4 mr-1 animate-spin" />
                    Converting...
                  </>
                ) : (
                  <>
                    <Download className="h-4 w-4 mr-1" />
                    Download PNG
                  </>
                )}
              </Button>
            </div>
          </CardHeader>
          <CardContent className="flex-1 flex items-center justify-center">
            {previewUrl ? (
              <div
                className="relative flex items-center justify-center rounded-lg border border-dashed border-muted-foreground/25 p-4"
                style={{
                  backgroundColor: state.backgroundColor === "transparent" 
                    ? "repeating-conic-gradient(#e5e7eb 0% 25%, transparent 0% 50%) 50% / 20px 20px" 
                    : state.backgroundColor,
                  minWidth: 200,
                  minHeight: 200,
                }}
              >
                <img
                  src={previewUrl || "/placeholder.svg"}
                  alt="SVG Preview"
                  style={{
                    maxWidth: "100%",
                    maxHeight: 400,
                    width: state.width > 400 ? 400 : state.width,
                    height: "auto",
                  }}
                />
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center text-muted-foreground min-h-[200px]">
                <ImageIcon className="h-12 w-12 mb-4 opacity-50" />
                <p className="text-sm">Upload or paste SVG to see preview</p>
              </div>
            )}
          </CardContent>
          {state.svgContent && (
            <div className="px-6 pb-4 text-sm text-muted-foreground text-center">
              Output: {state.width} x {state.height} PNG
            </div>
          )}
        </Card>
      </div>
    </div>
  )
}
