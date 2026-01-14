"use client"

import * as React from "react"
import { ArrowLeftRight, Copy, Check, Upload, Download, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { cn } from "@/lib/utils"

interface PaneProps {
  label: string
  value: string
  onChange: (value: string) => void
  onFocus: () => void
  isActive: boolean
  error?: string | null
  placeholder?: string
  disabled?: boolean
  onFileUpload?: (file: File) => void
  fileResult?: {
    status: "success" | "error"
    message: string
    downloadUrl?: string
    downloadName?: string
  } | null
  onClearFile?: () => void
}

function Pane({
  label,
  value,
  onChange,
  onFocus,
  isActive,
  error,
  placeholder,
  disabled,
  onFileUpload,
  fileResult,
  onClearFile,
}: PaneProps) {
  const [copied, setCopied] = React.useState(false)
  const [isDragOver, setIsDragOver] = React.useState(false)
  const fileInputRef = React.useRef<HTMLInputElement>(null)

  const handleCopy = async () => {
    await navigator.clipboard.writeText(value)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const handleDrop = React.useCallback(
    (e: React.DragEvent) => {
      e.preventDefault()
      setIsDragOver(false)
      const file = e.dataTransfer.files[0]
      if (file && onFileUpload) {
        onFileUpload(file)
      }
    },
    [onFileUpload],
  )

  const handleFileChange = React.useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0]
      if (file && onFileUpload) {
        onFileUpload(file)
      }
    },
    [onFileUpload],
  )

  return (
    <div className="flex w-0 flex-1 flex-col">
      <div className="mb-2 flex items-center justify-between">
        <span className={cn("text-sm font-medium", isActive && "text-primary")}>{label}</span>
        <div className="flex items-center gap-1">
          {onFileUpload && (
            <>
              <input ref={fileInputRef} type="file" className="hidden" onChange={handleFileChange} />
              <Button
                variant="ghost"
                size="sm"
                onClick={() => fileInputRef.current?.click()}
                className="h-7 gap-1 px-2 text-xs"
              >
                <Upload className="h-3 w-3" />
                File
              </Button>
            </>
          )}
          <Button variant="ghost" size="sm" onClick={handleCopy} disabled={!value} className="h-7 gap-1 px-2 text-xs">
            {copied ? (
              <>
                <Check className="h-3 w-3" />
                Copied
              </>
            ) : (
              <>
                <Copy className="h-3 w-3" />
                Copy
              </>
            )}
          </Button>
        </div>
      </div>

      {fileResult ? (
        <div
          className={cn(
            "flex flex-1 flex-col items-center justify-center gap-4 rounded-md border-2 border-dashed p-6",
            fileResult.status === "success"
              ? "border-green-500/50 bg-green-500/5"
              : "border-destructive/50 bg-destructive/5",
          )}
        >
          <div className="text-center">
            <p
              className={cn(
                "font-medium",
                fileResult.status === "success" ? "text-green-600 dark:text-green-400" : "text-destructive",
              )}
            >
              {fileResult.message}
            </p>
          </div>
          <div className="flex gap-2">
            {fileResult.downloadUrl && (
              <Button asChild size="sm">
                <a href={fileResult.downloadUrl} download={fileResult.downloadName}>
                  <Download className="mr-2 h-4 w-4" />
                  Download
                </a>
              </Button>
            )}
            <Button variant="outline" size="sm" onClick={onClearFile}>
              <X className="mr-2 h-4 w-4" />
              Clear
            </Button>
          </div>
        </div>
      ) : (
        <div
          className={cn(
            "relative flex-1",
            isDragOver &&
              "after:absolute after:inset-0 after:rounded-md after:border-2 after:border-dashed after:border-primary after:bg-primary/5",
          )}
          onDragOver={(e) => {
            e.preventDefault()
            setIsDragOver(true)
          }}
          onDragLeave={() => setIsDragOver(false)}
          onDrop={handleDrop}
        >
          <Textarea
            value={value}
            onChange={(e) => onChange(e.target.value)}
            onFocus={onFocus}
            placeholder={placeholder}
            disabled={disabled}
            className={cn(
              "h-full min-h-[200px] max-h-[400px] resize-none overflow-auto font-mono text-sm break-all",
              error && "border-destructive",
              isActive && "ring-1 ring-primary",
            )}
            style={{ wordBreak: "break-all", overflowWrap: "anywhere" }}
          />
        </div>
      )}

      {error && <p className="mt-1 text-xs text-destructive">{error}</p>}
    </div>
  )
}

interface DualPaneLayoutProps {
  leftLabel?: string
  rightLabel?: string
  leftValue: string
  rightValue: string
  onLeftChange: (value: string) => void
  onRightChange: (value: string) => void
  activeSide: "left" | "right"
  onActiveSideChange: (side: "left" | "right") => void
  leftError?: string | null
  rightError?: string | null
  leftPlaceholder?: string
  rightPlaceholder?: string
  leftFileUpload?: (file: File) => void
  rightFileUpload?: (file: File) => void
  leftFileResult?: {
    status: "success" | "error"
    message: string
    downloadUrl?: string
    downloadName?: string
  } | null
  rightFileResult?: {
    status: "success" | "error"
    message: string
    downloadUrl?: string
    downloadName?: string
  } | null
  onClearLeftFile?: () => void
  onClearRightFile?: () => void
  children?: React.ReactNode
}

export function DualPaneLayout({
  leftLabel = "Input",
  rightLabel = "Output",
  leftValue,
  rightValue,
  onLeftChange,
  onRightChange,
  activeSide,
  onActiveSideChange,
  leftError,
  rightError,
  leftPlaceholder,
  rightPlaceholder,
  leftFileUpload,
  rightFileUpload,
  leftFileResult,
  rightFileResult,
  onClearLeftFile,
  onClearRightFile,
  children,
}: DualPaneLayoutProps) {
  return (
    <div className="flex h-full flex-col gap-4">
      {/* Parameters */}
      {children && <div className="shrink-0">{children}</div>}

      {/* Panes */}
      <div className="flex min-h-0 flex-1 gap-4">
        <Pane
          label={leftLabel}
          value={leftValue}
          onChange={onLeftChange}
          onFocus={() => onActiveSideChange("left")}
          isActive={activeSide === "left"}
          error={leftError}
          placeholder={leftPlaceholder}
          onFileUpload={leftFileUpload}
          fileResult={leftFileResult}
          onClearFile={onClearLeftFile}
        />

        <div className="flex shrink-0 items-center">
          <ArrowLeftRight className="h-5 w-5 text-muted-foreground" />
        </div>

        <Pane
          label={rightLabel}
          value={rightValue}
          onChange={onRightChange}
          onFocus={() => onActiveSideChange("right")}
          isActive={activeSide === "right"}
          error={rightError}
          placeholder={rightPlaceholder}
          onFileUpload={rightFileUpload}
          fileResult={rightFileResult}
          onClearFile={onClearRightFile}
        />
      </div>
    </div>
  )
}
