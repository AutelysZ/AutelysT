"use client"

import * as React from "react"
import { Suspense, useCallback, useRef, useState } from "react"
import { Copy, Check, Upload, Pipette, ImageIcon } from "lucide-react"
import { ToolPageWrapper } from "@/components/tool-ui/tool-page-wrapper"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { parseColor, getAllFormats, type RGB, type ColorFormats } from "@/lib/color/converter"

interface FormatCardProps {
  label: string
  value: string
  onCopy: (value: string) => void
  copiedValue: string | null
}

function FormatCard({ label, value, onCopy, copiedValue }: FormatCardProps) {
  const isCopied = copiedValue === value

  return (
    <div className="flex items-center justify-between gap-2 p-3 bg-muted/50 rounded-lg">
      <div className="min-w-0 flex-1">
        <div className="text-xs text-muted-foreground mb-1">{label}</div>
        <div className="font-mono text-sm truncate" title={value}>
          {value}
        </div>
      </div>
      <Button
        variant="ghost"
        size="sm"
        className="h-8 w-8 p-0 flex-shrink-0"
        onClick={() => onCopy(value)}
      >
        {isCopied ? (
          <Check className="h-4 w-4 text-green-500" />
        ) : (
          <Copy className="h-4 w-4" />
        )}
      </Button>
    </div>
  )
}

function ColorContent() {
  const [inputValue, setInputValue] = useState("#3b82f6")
  const [rgb, setRgb] = useState<RGB | null>({ r: 59, g: 130, b: 246, a: 1 })
  const [error, setError] = useState<string | null>(null)
  const [copiedValue, setCopiedValue] = useState<string | null>(null)
  const [imageUrl, setImageUrl] = useState<string | null>(null)
  const [isPickingFromImage, setIsPickingFromImage] = useState(false)

  const colorInputRef = useRef<HTMLInputElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const imageRef = useRef<HTMLImageElement>(null)

  const handleInputChange = useCallback((value: string) => {
    setInputValue(value)
    const parsed = parseColor(value)
    if (parsed) {
      setRgb(parsed)
      setError(null)
    } else if (value.trim()) {
      setError("Invalid color format")
    } else {
      setError(null)
      setRgb(null)
    }
  }, [])

  const handleColorPickerChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const hex = e.target.value
    setInputValue(hex)
    const parsed = parseColor(hex)
    if (parsed) {
      setRgb(parsed)
      setError(null)
    }
  }, [])

  const handleCopy = useCallback(async (value: string) => {
    try {
      await navigator.clipboard.writeText(value)
      setCopiedValue(value)
      setTimeout(() => setCopiedValue(null), 2000)
    } catch {
      // Fallback for older browsers
      const textarea = document.createElement("textarea")
      textarea.value = value
      document.body.appendChild(textarea)
      textarea.select()
      document.execCommand("copy")
      document.body.removeChild(textarea)
      setCopiedValue(value)
      setTimeout(() => setCopiedValue(null), 2000)
    }
  }, [])

  const handleFileUpload = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    const url = URL.createObjectURL(file)
    setImageUrl(url)
    setIsPickingFromImage(true)
  }, [])

  const handleImageClick = useCallback(
    (e: React.MouseEvent<HTMLCanvasElement>) => {
      const canvas = canvasRef.current
      if (!canvas) return

      const rect = canvas.getBoundingClientRect()
      const scaleX = canvas.width / rect.width
      const scaleY = canvas.height / rect.height

      const x = Math.floor((e.clientX - rect.left) * scaleX)
      const y = Math.floor((e.clientY - rect.top) * scaleY)

      const ctx = canvas.getContext("2d")
      if (!ctx) return

      const pixel = ctx.getImageData(x, y, 1, 1).data
      const newRgb: RGB = {
        r: pixel[0],
        g: pixel[1],
        b: pixel[2],
        a: pixel[3] / 255,
      }

      setRgb(newRgb)
      const hex = `#${newRgb.r.toString(16).padStart(2, "0")}${newRgb.g.toString(16).padStart(2, "0")}${newRgb.b.toString(16).padStart(2, "0")}`
      setInputValue(hex)
      setError(null)
    },
    [],
  )

  const handleImageLoad = useCallback(() => {
    const canvas = canvasRef.current
    const image = imageRef.current
    if (!canvas || !image) return

    // Set canvas size to match image (with max dimensions)
    const maxWidth = 600
    const maxHeight = 400
    let width = image.naturalWidth
    let height = image.naturalHeight

    if (width > maxWidth) {
      height = (height * maxWidth) / width
      width = maxWidth
    }
    if (height > maxHeight) {
      width = (width * maxHeight) / height
      height = maxHeight
    }

    canvas.width = width
    canvas.height = height

    const ctx = canvas.getContext("2d")
    if (!ctx) return

    ctx.drawImage(image, 0, 0, width, height)
  }, [])

  const handleCloseImagePicker = useCallback(() => {
    setIsPickingFromImage(false)
    if (imageUrl) {
      URL.revokeObjectURL(imageUrl)
      setImageUrl(null)
    }
  }, [imageUrl])

  const formats: ColorFormats | null = rgb ? getAllFormats(rgb) : null

  const formatEntries: { key: keyof ColorFormats; label: string }[] = [
    { key: "hex", label: "Hex" },
    { key: "rgb", label: "rgb()" },
    { key: "rgba", label: "rgba()" },
    { key: "hsl", label: "hsl()" },
    { key: "hsla", label: "hsla()" },
    { key: "hwb", label: "hwb()" },
    { key: "lab", label: "lab()" },
    { key: "lch", label: "lch()" },
    { key: "oklab", label: "oklab()" },
    { key: "oklch", label: "oklch()" },
    { key: "color", label: "color()" },
    { key: "colorMix", label: "color-mix()" },
    { key: "deviceCmyk", label: "device-cmyk()" },
  ]

  return (
    <ToolPageWrapper
      toolId="color"
      title="Color Converter"
      description="Parse, pick, and convert colors between multiple CSS formats"
    >
      <div className="space-y-6">
        {/* Input Section */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Color Input</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-wrap gap-4">
              {/* Text input */}
              <div className="flex-1 min-w-[200px]">
                <Label className="text-sm mb-2 block">Enter color (any format)</Label>
                <Input
                  value={inputValue}
                  onChange={(e) => handleInputChange(e.target.value)}
                  placeholder="#ff0000, rgb(255,0,0), hsl(0,100%,50%), red..."
                  className={error ? "border-destructive" : ""}
                />
                {error && <p className="text-sm text-destructive mt-1">{error}</p>}
              </div>

              {/* Color picker */}
              <div>
                <Label className="text-sm mb-2 block">Pick color</Label>
                <div className="flex gap-2">
                  <div className="relative">
                    <input
                      ref={colorInputRef}
                      type="color"
                      value={rgb ? `#${rgb.r.toString(16).padStart(2, "0")}${rgb.g.toString(16).padStart(2, "0")}${rgb.b.toString(16).padStart(2, "0")}` : "#000000"}
                      onChange={handleColorPickerChange}
                      className="w-12 h-10 cursor-pointer rounded border"
                    />
                  </div>
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={() => colorInputRef.current?.click()}
                    title="Open color picker"
                  >
                    <Pipette className="h-4 w-4" />
                  </Button>
                </div>
              </div>

              {/* Image picker */}
              <div>
                <Label className="text-sm mb-2 block">Pick from image</Label>
                <div className="flex gap-2">
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    onChange={handleFileUpload}
                    className="hidden"
                  />
                  <Button
                    variant="outline"
                    onClick={() => fileInputRef.current?.click()}
                  >
                    <Upload className="h-4 w-4 mr-2" />
                    Upload Image
                  </Button>
                </div>
              </div>
            </div>

            {/* Image picker canvas */}
            {isPickingFromImage && imageUrl && (
              <div className="mt-4 space-y-2">
                <div className="flex items-center justify-between">
                  <Label className="text-sm">Click on image to pick color</Label>
                  <Button variant="ghost" size="sm" onClick={handleCloseImagePicker}>
                    Close
                  </Button>
                </div>
                <div className="relative inline-block border rounded-lg overflow-hidden cursor-crosshair">
                  <img
                    ref={imageRef}
                    src={imageUrl}
                    alt="Color picker source"
                    onLoad={handleImageLoad}
                    className="hidden"
                  />
                  <canvas
                    ref={canvasRef}
                    onClick={handleImageClick}
                    className="max-w-full"
                  />
                </div>
              </div>
            )}

            {/* Color preview */}
            {rgb && (
              <div className="flex items-center gap-4 mt-4">
                <div
                  className="w-24 h-24 rounded-lg border shadow-inner"
                  style={{
                    backgroundColor: `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${rgb.a})`,
                  }}
                />
                <div className="space-y-1">
                  <div className="text-sm">
                    <span className="text-muted-foreground">R:</span> {rgb.r}
                    <span className="text-muted-foreground ml-4">G:</span> {rgb.g}
                    <span className="text-muted-foreground ml-4">B:</span> {rgb.b}
                    <span className="text-muted-foreground ml-4">A:</span> {rgb.a.toFixed(2)}
                  </div>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Output Formats */}
        {formats && (
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Color Formats</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                {formatEntries.map(({ key, label }) => (
                  <FormatCard
                    key={key}
                    label={label}
                    value={formats[key]}
                    onCopy={handleCopy}
                    copiedValue={copiedValue}
                  />
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* No color selected */}
        {!rgb && !error && (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-12 text-muted-foreground">
              <ImageIcon className="h-12 w-12 mb-4 opacity-50" />
              <p>Enter a color value or use the color picker to get started</p>
            </CardContent>
          </Card>
        )}
      </div>
    </ToolPageWrapper>
  )
}

export default function ColorPage() {
  return (
    <Suspense fallback={null}>
      <ColorContent />
    </Suspense>
  )
}
