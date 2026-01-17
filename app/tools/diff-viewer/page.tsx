"use client"

import * as React from "react"
import { Suspense } from "react"
import { createPortal } from "react-dom"
import { Upload, AlertCircle, Maximize2, Minimize2, X, Download, Copy, Check } from "lucide-react"
import { z } from "zod"
import yaml from "js-yaml"
import toml from "@iarna/toml"
import { ToolPageWrapper, useToolHistoryContext } from "@/components/tool-ui/tool-page-wrapper"
import { DEFAULT_URL_SYNC_DEBOUNCE_MS, useUrlSyncedState } from "@/lib/url-state/use-url-synced-state"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { compareJSON, formatValue, type DiffChange } from "@/lib/data/json-diff"
import { computeTextDiff, getDiffStats, groupIntoHunks, type TextDiffLine } from "@/lib/data/text-diff"
import type { HistoryEntry } from "@/lib/history/db"
import { cn } from "@/lib/utils"

const formatOptions = [
  { value: "auto", label: "Auto" },
  { value: "text", label: "Text" },
  { value: "json", label: "JSON" },
  { value: "yaml", label: "YAML" },
  { value: "toml", label: "TOML" },
] as const

const formatLabels: Record<FormatType, string> = {
  auto: "Auto",
  text: "Text",
  json: "JSON",
  yaml: "YAML",
  toml: "TOML",
}

type FormatType = (typeof formatOptions)[number]["value"]
type StructuredFormat = Exclude<FormatType, "auto" | "text">

const paramsSchema = z.object({
  leftText: z.string().default(""),
  rightText: z.string().default(""),
  leftFormat: z.enum(["auto", "text", "json", "yaml", "toml"]).default("auto"),
  rightFormat: z.enum(["auto", "text", "json", "yaml", "toml"]).default("auto"),
  viewMode: z.enum(["table", "text"]).default("table"),
})

type ViewMode = z.infer<typeof paramsSchema>["viewMode"]

const FILE_SIZE_LIMIT = 1 * 2 ** 20

export default function DiffViewerPage() {
  return (
    <Suspense fallback={null}>
      <DiffViewerContent />
    </Suspense>
  )
}

function DiffViewerContent() {
  const { state, setParam, oversizeKeys, hasUrlParams, hydrationSource } = useUrlSyncedState("diff-viewer", {
    schema: paramsSchema,
    defaults: paramsSchema.parse({}),
  })

  const [leftFileName, setLeftFileName] = React.useState<string | null>(null)
  const [rightFileName, setRightFileName] = React.useState<string | null>(null)
  const [leftUploadError, setLeftUploadError] = React.useState<string | null>(null)
  const [rightUploadError, setRightUploadError] = React.useState<string | null>(null)
  const [leftFileTooLarge, setLeftFileTooLarge] = React.useState(false)
  const [rightFileTooLarge, setRightFileTooLarge] = React.useState(false)
  const [leftFileContent, setLeftFileContent] = React.useState<string | null>(null)
  const [rightFileContent, setRightFileContent] = React.useState<string | null>(null)
  const leftFileBlobRef = React.useRef<Blob | null>(null)
  const rightFileBlobRef = React.useRef<Blob | null>(null)

  const handleLoadHistory = React.useCallback(
    (entry: HistoryEntry) => {
      const { inputs, params } = entry
      if (inputs.leftText !== undefined) setParam("leftText", inputs.leftText)
      if (inputs.rightText !== undefined) setParam("rightText", inputs.rightText)
      if (params.leftFormat) setParam("leftFormat", params.leftFormat as z.infer<typeof paramsSchema>["leftFormat"])
      if (params.rightFormat) setParam("rightFormat", params.rightFormat as z.infer<typeof paramsSchema>["rightFormat"])
      if (params.viewMode) setParam("viewMode", params.viewMode as ViewMode)

      if (entry.files?.left) {
        restoreFileFromHistory({
          blob: entry.files.left,
          name: entry.files.leftName ?? null,
          side: "left",
          setParam,
          setFileName: setLeftFileName,
          setFileContent: setLeftFileContent,
          setFileTooLarge: setLeftFileTooLarge,
          setUploadError: setLeftUploadError,
          fileBlobRef: leftFileBlobRef,
        })
      } else {
        setLeftFileName(null)
        setLeftFileContent(null)
        setLeftFileTooLarge(false)
        setLeftUploadError(null)
        leftFileBlobRef.current = null
      }

      if (entry.files?.right) {
        restoreFileFromHistory({
          blob: entry.files.right,
          name: entry.files.rightName ?? null,
          side: "right",
          setParam,
          setFileName: setRightFileName,
          setFileContent: setRightFileContent,
          setFileTooLarge: setRightFileTooLarge,
          setUploadError: setRightUploadError,
          fileBlobRef: rightFileBlobRef,
        })
      } else {
        setRightFileName(null)
        setRightFileContent(null)
        setRightFileTooLarge(false)
        setRightUploadError(null)
        rightFileBlobRef.current = null
      }
    },
    [
      setParam,
      setLeftFileName,
      setRightFileName,
      setLeftFileContent,
      setRightFileContent,
      setLeftFileTooLarge,
      setRightFileTooLarge,
      setLeftUploadError,
      setRightUploadError,
    ],
  )

  return (
    <ToolPageWrapper
      toolId="diff-viewer"
      title="Diff Viewer"
      description="Compare text, JSON, YAML, or TOML inputs with table and text diff views"
      onLoadHistory={handleLoadHistory}
    >
      <DiffViewerInner
        state={state}
        setParam={setParam}
        oversizeKeys={oversizeKeys}
        hasUrlParams={hasUrlParams}
        hydrationSource={hydrationSource}
        leftFileName={leftFileName}
        rightFileName={rightFileName}
        leftFileContent={leftFileContent}
        rightFileContent={rightFileContent}
        leftFileBlobRef={leftFileBlobRef}
        rightFileBlobRef={rightFileBlobRef}
        setLeftFileContent={setLeftFileContent}
        setRightFileContent={setRightFileContent}
        leftUploadError={leftUploadError}
        rightUploadError={rightUploadError}
        leftFileTooLarge={leftFileTooLarge}
        rightFileTooLarge={rightFileTooLarge}
        setLeftUploadError={setLeftUploadError}
        setRightUploadError={setRightUploadError}
        setLeftFileTooLarge={setLeftFileTooLarge}
        setRightFileTooLarge={setRightFileTooLarge}
        setLeftFileName={setLeftFileName}
        setRightFileName={setRightFileName}
      />
    </ToolPageWrapper>
  )
}

function DiffViewerInner({
  state,
  setParam,
  oversizeKeys,
  hasUrlParams,
  hydrationSource,
  leftFileName,
  rightFileName,
  leftFileContent,
  rightFileContent,
  leftFileBlobRef,
  rightFileBlobRef,
  setLeftFileContent,
  setRightFileContent,
  leftUploadError,
  rightUploadError,
  leftFileTooLarge,
  rightFileTooLarge,
  setLeftUploadError,
  setRightUploadError,
  setLeftFileTooLarge,
  setRightFileTooLarge,
  setLeftFileName,
  setRightFileName,
}: {
  state: z.infer<typeof paramsSchema>
  setParam: <K extends keyof z.infer<typeof paramsSchema>>(
    key: K,
    value: z.infer<typeof paramsSchema>[K],
    immediate?: boolean,
  ) => void
  oversizeKeys: (keyof z.infer<typeof paramsSchema>)[]
  hasUrlParams: boolean
  hydrationSource: "default" | "url" | "history"
  leftFileName: string | null
  rightFileName: string | null
  leftFileContent: string | null
  rightFileContent: string | null
  leftFileBlobRef: React.MutableRefObject<Blob | null>
  rightFileBlobRef: React.MutableRefObject<Blob | null>
  setLeftFileContent: (value: string | null) => void
  setRightFileContent: (value: string | null) => void
  leftUploadError: string | null
  rightUploadError: string | null
  leftFileTooLarge: boolean
  rightFileTooLarge: boolean
  setLeftUploadError: (value: string | null) => void
  setRightUploadError: (value: string | null) => void
  setLeftFileTooLarge: (value: boolean) => void
  setRightFileTooLarge: (value: boolean) => void
  setLeftFileName: (v: string | null) => void
  setRightFileName: (v: string | null) => void
}) {
  const { upsertInputEntry, upsertParams } = useToolHistoryContext()
  const lastInputRef = React.useRef<string>("")
  const leftInputRef = React.useRef<HTMLInputElement | null>(null)
  const rightInputRef = React.useRef<HTMLInputElement | null>(null)
  const [isFullscreen, setIsFullscreen] = React.useState(false)
  const [mounted, setMounted] = React.useState(false)
  const hasHydratedInputRef = React.useRef(false)
  const paramsRef = React.useRef({
    leftFormat: state.leftFormat,
    rightFormat: state.rightFormat,
    viewMode: state.viewMode,
    leftFileName,
    rightFileName,
  })
  const hasInitializedParamsRef = React.useRef(false)
  const hasHandledUrlRef = React.useRef(false)

  const leftEffectiveText = leftFileContent ?? state.leftText
  const rightEffectiveText = rightFileContent ?? state.rightText

  const leftDetected = React.useMemo(() => detectFormat(leftEffectiveText), [leftEffectiveText])
  const rightDetected = React.useMemo(() => detectFormat(rightEffectiveText), [rightEffectiveText])
  const leftTooLong = React.useMemo(() => oversizeKeys.includes("leftText"), [oversizeKeys])
  const rightTooLong = React.useMemo(() => oversizeKeys.includes("rightText"), [oversizeKeys])

  const leftResolved = state.leftFormat === "auto" ? leftDetected.format : state.leftFormat
  const rightResolved = state.rightFormat === "auto" ? rightDetected.format : state.rightFormat

  const shouldTreatAsText = leftResolved === "text" || rightResolved === "text"

  const leftParse = React.useMemo(
    () =>
      shouldTreatAsText
        ? { value: null, error: null }
        : parseWithFormat(leftEffectiveText, state.leftFormat, leftDetected),
    [leftEffectiveText, state.leftFormat, leftDetected, shouldTreatAsText],
  )
  const rightParse = React.useMemo(
    () =>
      shouldTreatAsText
        ? { value: null, error: null }
        : parseWithFormat(rightEffectiveText, state.rightFormat, rightDetected),
    [rightEffectiveText, state.rightFormat, rightDetected, shouldTreatAsText],
  )

  const showTabs = leftResolved !== "text" && rightResolved !== "text"

  React.useEffect(() => {
    if (!showTabs && state.viewMode !== "text") {
      setParam("viewMode", "text", true)
    }
  }, [showTabs, state.viewMode, setParam])

  React.useEffect(() => {
    const nextParams = {
      leftFormat: state.leftFormat,
      rightFormat: state.rightFormat,
      viewMode: state.viewMode,
      leftFileName,
      rightFileName,
    }
    if (!hasInitializedParamsRef.current) {
      hasInitializedParamsRef.current = true
      paramsRef.current = nextParams
      return
    }
    const same =
      paramsRef.current.leftFormat === nextParams.leftFormat &&
      paramsRef.current.rightFormat === nextParams.rightFormat &&
      paramsRef.current.viewMode === nextParams.viewMode &&
      paramsRef.current.leftFileName === nextParams.leftFileName &&
      paramsRef.current.rightFileName === nextParams.rightFileName
    if (same) return
    paramsRef.current = nextParams
    upsertParams(nextParams, "interpretation")
  }, [state.leftFormat, state.rightFormat, state.viewMode, leftFileName, rightFileName, upsertParams])

  const { changes, stats } = React.useMemo(() => {
    if (!showTabs) {
      return { changes: [] as DiffChange[], stats: { added: 0, removed: 0, modified: 0, total: 0 } }
    }

    if (!leftParse.value || !rightParse.value || leftParse.error || rightParse.error) {
      return { changes: [] as DiffChange[], stats: { added: 0, removed: 0, modified: 0, total: 0 } }
    }

    const diffChanges = compareJSON(leftParse.value, rightParse.value)
    const added = diffChanges.filter((c) => c.type === "added").length
    const removed = diffChanges.filter((c) => c.type === "removed").length
    const modified = diffChanges.filter((c) => c.type === "modified").length
    return {
      changes: diffChanges,
      stats: { added, removed, modified, total: added + removed + modified },
    }
  }, [leftParse, rightParse, showTabs])

  const { textDiff, textStats, diffSkipped } = React.useMemo(() => {
    const shouldAlignToLeftFormat = leftResolved !== "text" && rightResolved !== "text"
    const leftText = shouldAlignToLeftFormat
      ? formatStructured(leftParse.value, leftResolved) ?? leftEffectiveText
      : getTextForDiff(leftEffectiveText, leftResolved, leftParse.value, leftDetected)
    const rightText = shouldAlignToLeftFormat
      ? formatStructured(rightParse.value, leftResolved) ?? rightEffectiveText
      : getTextForDiff(rightEffectiveText, rightResolved, rightParse.value, rightDetected)
    if (!leftText && !rightText) {
      return { textDiff: [] as TextDiffLine[], textStats: { added: 0, removed: 0, unchanged: 0 }, diffSkipped: false }
    }
    const leftBytes = getByteLength(leftText)
    const rightBytes = getByteLength(rightText)
    const leftLines = countLines(leftText)
    const rightLines = countLines(rightText)
    const skip =
      leftBytes > FILE_SIZE_LIMIT || rightBytes > FILE_SIZE_LIMIT || leftLines > 200000 || rightLines > 200000
    if (skip) {
      return { textDiff: [] as TextDiffLine[], textStats: { added: 0, removed: 0, unchanged: 0 }, diffSkipped: true }
    }
    const diff = computeTextDiff(leftText, rightText)
    const stats = getDiffStats(diff)
    return { textDiff: diff, textStats: stats, diffSkipped: false }
  }, [leftEffectiveText, rightEffectiveText, leftResolved, rightResolved, leftParse.value, rightParse.value, leftDetected, rightDetected])

  const hasTextChanges = React.useMemo(() => textDiff.some((line) => line.type !== "unchanged"), [textDiff])
  const changedLines = React.useMemo(() => textDiff.filter((line) => line.type !== "unchanged"), [textDiff])
  const diffLineCount = changedLines.length
  const diffByteSize = React.useMemo(() => getDiffByteSize(changedLines), [changedLines])
  const suppressDetail = diffLineCount > 10000 || diffByteSize > 1024 * 1024

  React.useEffect(() => {
    if (hasHydratedInputRef.current) return
    if (hydrationSource === "default") return
    lastInputRef.current = `${state.leftText}|${state.rightText}`
    hasHydratedInputRef.current = true
  }, [hydrationSource, state.leftText, state.rightText])

  React.useEffect(() => {
    const combined = `${state.leftText}|${state.rightText}`
    if (!state.leftText && !state.rightText) return
    if (combined === lastInputRef.current) return

    const timer = setTimeout(() => {
      lastInputRef.current = combined
      upsertInputEntry(
        { leftText: leftFileName ? "" : state.leftText, rightText: rightFileName ? "" : state.rightText },
        { leftFormat: state.leftFormat, rightFormat: state.rightFormat, viewMode: state.viewMode, leftFileName, rightFileName },
        "left",
        leftFileName || rightFileName || state.leftText.slice(0, 50) + (state.rightText ? " vs " + state.rightText.slice(0, 50) : ""),
        {
          left: leftFileBlobRef.current ?? undefined,
          right: rightFileBlobRef.current ?? undefined,
          leftName: leftFileName ?? undefined,
          rightName: rightFileName ?? undefined,
        },
      )
    }, DEFAULT_URL_SYNC_DEBOUNCE_MS)

    return () => clearTimeout(timer)
  }, [
    state.leftText,
    state.rightText,
    state.leftFormat,
    state.rightFormat,
    state.viewMode,
    leftFileName,
    rightFileName,
    upsertInputEntry,
  ])

  React.useEffect(() => {
    if (hasUrlParams && !hasHandledUrlRef.current) {
      hasHandledUrlRef.current = true
      if (state.leftText || state.rightText) {
        upsertInputEntry(
          { leftText: leftFileName ? "" : state.leftText, rightText: rightFileName ? "" : state.rightText },
          { leftFormat: state.leftFormat, rightFormat: state.rightFormat, viewMode: state.viewMode, leftFileName, rightFileName },
          "left",
          leftFileName || rightFileName || state.leftText.slice(0, 50) + (state.rightText ? " vs " + state.rightText.slice(0, 50) : ""),
          {
            left: leftFileBlobRef.current ?? undefined,
            right: rightFileBlobRef.current ?? undefined,
            leftName: leftFileName ?? undefined,
            rightName: rightFileName ?? undefined,
          },
        )
      } else {
        upsertParams(
          { leftFormat: state.leftFormat, rightFormat: state.rightFormat, viewMode: state.viewMode, leftFileName, rightFileName },
          "interpretation",
        )
      }
    }
  }, [
    hasUrlParams,
    state.leftText,
    state.rightText,
    state.leftFormat,
    state.rightFormat,
    state.viewMode,
    leftFileName,
    rightFileName,
    upsertInputEntry,
    upsertParams,
  ])

  const handleFileUpload = (side: "left" | "right") => (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    e.target.value = ""
    if (!file) return

    if (side === "left") {
      setLeftUploadError(null)
      setLeftFileTooLarge(false)
      setLeftFileName(file.name)
      setLeftFileContent(null)
      leftFileBlobRef.current = file
    } else {
      setRightUploadError(null)
      setRightFileTooLarge(false)
      setRightFileName(file.name)
      setRightFileContent(null)
      rightFileBlobRef.current = file
    }

    if (file.size > FILE_SIZE_LIMIT) {
      if (side === "left") {
        setLeftFileTooLarge(true)
        setLeftFileContent(null)
        setLeftUploadError(null)
      } else {
        setRightFileTooLarge(true)
        setRightFileContent(null)
        setRightUploadError(null)
      }
      return
    }

    const reader = new FileReader()
    reader.onload = (event) => {
      const buffer = event.target?.result as ArrayBuffer
      if (!buffer) return
      try {
        const decoder = new TextDecoder("utf-8", { fatal: true })
        const content = decoder.decode(buffer)
        if (side === "left") {
          setLeftFileContent(null)
          setParam("leftText", content)
        } else {
          setRightFileContent(null)
          setParam("rightText", content)
        }
      } catch {
        if (side === "left") {
          setLeftUploadError("File is not valid UTF-8.")
        } else {
          setRightUploadError("File is not valid UTF-8.")
        }
      }
    }
    reader.readAsArrayBuffer(file)
  }

  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isFullscreen) {
        setIsFullscreen(false)
      }
    }
    window.addEventListener("keydown", handleKeyDown)
    return () => window.removeEventListener("keydown", handleKeyDown)
  }, [isFullscreen])

  React.useEffect(() => {
    setMounted(true)
  }, [])

  const showDiffContent =
    mounted && Boolean(leftEffectiveText) && Boolean(rightEffectiveText)

  const content = (
    <div
      className={cn(
        "flex flex-col gap-4",
        isFullscreen && "fixed inset-0 z-50 bg-background p-4 pt-0 overflow-y-auto",
      )}
    >
      {!isFullscreen && (
        <div className="flex flex-col gap-4 md:flex-row">
          <DiffInputPanel
            side="left"
            label={`Original ${leftFileName ? `(${leftFileName})` : ""}`}
            value={state.leftText}
            formatValue={state.leftFormat}
            detectedFormat={state.leftFormat === "auto" ? leftDetected.format : null}
            showDetected={mounted}
            tooLong={leftTooLong}
            uploadError={leftUploadError}
            fileTooLarge={leftFileTooLarge}
            onDismissTooLarge={() => setLeftFileTooLarge(false)}
            errorMessage={leftParse.error}
            inputRef={leftInputRef}
            onFileUpload={handleFileUpload("left")}
            onValueChange={(value) => {
              setParam("leftText", value)
              setLeftFileName(null)
              setLeftUploadError(null)
              setLeftFileTooLarge(false)
              setLeftFileContent(null)
              leftFileBlobRef.current = null
            }}
            onFormatChange={(value) => setParam("leftFormat", value, true)}
          />
          <DiffInputPanel
            side="right"
            label={`Modified ${rightFileName ? `(${rightFileName})` : ""}`}
            value={state.rightText}
            formatValue={state.rightFormat}
            detectedFormat={state.rightFormat === "auto" ? rightDetected.format : null}
            showDetected={mounted}
            tooLong={rightTooLong}
            uploadError={rightUploadError}
            fileTooLarge={rightFileTooLarge}
            onDismissTooLarge={() => setRightFileTooLarge(false)}
            errorMessage={rightParse.error}
            inputRef={rightInputRef}
            onFileUpload={handleFileUpload("right")}
            onValueChange={(value) => {
              setParam("rightText", value)
              setRightFileName(null)
              setRightUploadError(null)
              setRightFileTooLarge(false)
              setRightFileContent(null)
              rightFileBlobRef.current = null
            }}
            onFormatChange={(value) => setParam("rightFormat", value, true)}
          />
        </div>
      )}

      <hr className="border-border" />

      {showDiffContent ? (
        (showTabs && changes.length === 0) || (!showTabs && !hasTextChanges) ? (
          <Alert>
            <AlertDescription>No changes detected.</AlertDescription>
          </Alert>
        ) : (
          <div className={cn("space-y-3", isFullscreen && "flex flex-1 flex-col relative pt-3")}>
            <div className="flex flex-wrap items-center justify-between gap-2">
              {suppressDetail ? (
                <div className="text-xs text-muted-foreground">Diff summary</div>
              ) : showTabs ? (
                <Tabs
                  value={state.viewMode}
                  onValueChange={(v) => setParam("viewMode", v as ViewMode, true)}
                  className="w-auto"
                >
                  <TabsList className="h-8">
                    <TabsTrigger value="table" className="px-3 py-1 text-xs">
                      Table View
                    </TabsTrigger>
                    <TabsTrigger value="text" className="px-3 py-1 text-xs">
                      Text View
                    </TabsTrigger>
                  </TabsList>
                </Tabs>
              ) : (
                <div className="text-xs text-muted-foreground">Text View</div>
              )}

              <div className="flex flex-wrap items-center gap-2 sm:gap-4">
                <div className="flex items-center gap-3 text-xs sm:text-sm">
                  {showTabs ? (
                    <>
                      <span className="text-green-600">+{stats.added}</span>
                      <span className="text-red-600">-{stats.removed}</span>
                      <span className="text-yellow-600">~{stats.modified}</span>
                    </>
                  ) : (
                    <>
                      <span className="text-green-600">+{textStats.added}</span>
                      <span className="text-red-600">-{textStats.removed}</span>
                      <span className="text-muted-foreground">{textStats.unchanged} unchanged</span>
                    </>
                  )}
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <DownloadPatchButton
                    textDiff={textDiff}
                    leftLabel={leftFileName ?? "original"}
                    rightLabel={rightFileName ?? "modified"}
                    disabled={diffSkipped}
                  />
                  {!suppressDetail && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setIsFullscreen(!isFullscreen)}
                      className="h-7 w-7 p-0"
                      aria-label={isFullscreen ? "Exit fullscreen" : "Enter fullscreen"}
                    >
                      {isFullscreen ? <Minimize2 className="h-3 w-3" /> : <Maximize2 className="h-3 w-3" />}
                    </Button>
                  )}
                </div>
              </div>
            </div>

            {diffSkipped ? (
              <div className="rounded-md border border-dashed p-3 text-xs text-muted-foreground">
                Files are too large to diff in-browser. Reduce size or download files for external comparison.
              </div>
            ) : suppressDetail ? (
              <div className="rounded-md border border-dashed p-3 text-xs text-muted-foreground">
                Diff is too large to render ({diffLineCount.toLocaleString()} lines, {formatBytes(diffByteSize)}). Use the
                download button to view the full patch.
              </div>
            ) : showTabs && state.viewMode === "table" ? (
              <div className={cn("rounded-md border overflow-x-auto", isFullscreen ? "flex-1" : undefined)}>
                <table className="w-full text-sm">
                  <thead className="sticky top-0 bg-muted">
                    <tr className="border-b">
                      <th className="px-3 py-2 text-left font-medium">Path</th>
                      <th className="px-3 py-2 text-left font-medium">Change</th>
                      <th className="px-3 py-2 text-left font-medium">Old Value</th>
                      <th className="px-3 py-2 text-left font-medium">New Value</th>
                    </tr>
                  </thead>
                  <tbody>
                    {changes.map((change, idx) => (
                      <DiffRow key={idx} change={change} />
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className={cn("rounded-md border font-mono text-sm", isFullscreen ? "flex-1" : undefined)}>
                <UnifiedDiffView diffLines={textDiff} />
              </div>
            )}
          </div>
        )
      ) : (
        <div className="text-xs text-muted-foreground">Paste content to compare.</div>
      )}
    </div>
  )

  if (mounted && isFullscreen) {
    return createPortal(content, document.body)
  }

  return content
}

function DiffInputPanel({
  side,
  label,
  value,
  formatValue,
  detectedFormat,
  showDetected,
  tooLong,
  uploadError,
  fileTooLarge,
  onDismissTooLarge,
  errorMessage,
  inputRef,
  onFileUpload,
  onValueChange,
  onFormatChange,
}: {
  side: "left" | "right"
  label: string
  value: string
  formatValue: FormatType
  detectedFormat: FormatType | null
  showDetected: boolean
  tooLong: boolean
  uploadError: string | null
  fileTooLarge: boolean
  onDismissTooLarge: () => void
  errorMessage: string | null
  inputRef: React.RefObject<HTMLInputElement | null>
  onFileUpload: (e: React.ChangeEvent<HTMLInputElement>) => void
  onValueChange: (value: string) => void
  onFormatChange: (value: FormatType) => void
}) {
  const detectedLabel = detectedFormat ? formatLabels[detectedFormat] : "—"

  return (
    <div className="flex w-full flex-1 flex-col gap-2 md:w-0">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Label className="text-sm font-medium">{label}</Label>
        <div className="flex flex-wrap items-center gap-2">
          <Label className="text-xs text-muted-foreground">Format</Label>
          <Select value={formatValue} onValueChange={onFormatChange}>
            <SelectTrigger className="h-8 w-28">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {formatOptions.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {formatValue === "auto" && (
            <span className="text-xs text-muted-foreground">Detected: {showDetected ? detectedLabel : "—"}</span>
          )}
          <input ref={inputRef} type="file" onChange={onFileUpload} className="hidden" />
          <Button
            variant="outline"
            size="sm"
            onClick={() => inputRef.current?.click()}
            className="h-8 gap-1 px-2 text-xs"
          >
            <Upload className="h-3 w-3" />
            Upload
          </Button>
        </div>
      </div>
      <div className="relative">
        <Textarea
          value={value}
          onChange={(e) => onValueChange(e.target.value)}
          placeholder="Paste content here..."
          maxLength={10 * 2 ** 20}
          className={cn(
            "max-h-[300px] min-h-[200px] overflow-auto overflow-x-hidden break-all whitespace-pre-wrap font-mono text-sm",
            errorMessage && "border-destructive",
          )}
        />
        {fileTooLarge && (
          <div className="absolute inset-0 flex items-center justify-center rounded-md border bg-background/95 text-sm text-muted-foreground">
            <span>File exceeds 5 MB and cannot be compared.</span>
            <button
              type="button"
              className="ml-2 inline-flex h-6 w-6 items-center justify-center rounded hover:bg-muted/60"
              onClick={onDismissTooLarge}
              aria-label="Dismiss"
            >
              <X className="h-3 w-3" />
            </button>
          </div>
        )}
      </div>
      {uploadError && <div className="text-xs text-destructive">{uploadError}</div>}
      {tooLong && <div className="text-xs text-muted-foreground">Input exceeds 2 KB and is not synced to the URL.</div>}
      {errorMessage && (
        <Alert variant="destructive" className="py-2">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription className="text-xs">{errorMessage}</AlertDescription>
        </Alert>
      )}
    </div>
  )
}

function DownloadPatchButton({
  textDiff,
  leftLabel,
  rightLabel,
  disabled = false,
}: {
  textDiff: TextDiffLine[]
  leftLabel: string
  rightLabel: string
  disabled?: boolean
}) {
  const handleDownload = () => {
    if (disabled) return
    const patch = buildUnifiedPatch(textDiff, leftLabel, rightLabel)
    const blob = new Blob([patch], { type: "text/plain;charset=utf-8" })
    const url = URL.createObjectURL(blob)
    const anchor = document.createElement("a")
    anchor.href = url
    anchor.download = "diff.patch"
    anchor.click()
    URL.revokeObjectURL(url)
  }

  return (
    <Button
      variant="outline"
      size="sm"
      onClick={handleDownload}
      className="h-7 w-7 p-0"
      aria-label="Download patch"
      disabled={disabled}
    >
      <Download className="h-3 w-3" />
    </Button>
  )
}

function buildUnifiedPatch(lines: TextDiffLine[], leftLabel: string, rightLabel: string) {
  const safeLeft = leftLabel.trim() || "original"
  const safeRight = rightLabel.trim() || "modified"
  const hunks = groupIntoHunks(lines, 3)
  const output: string[] = [`--- a/${safeLeft}`, `+++ b/${safeRight}`]

  if (hunks.length === 0) {
    return output.join("\n")
  }

  for (const hunk of hunks) {
    const leftCount = hunk.lines.filter((line) => line.type !== "added").length
    const rightCount = hunk.lines.filter((line) => line.type !== "removed").length
    output.push(`@@ -${hunk.startLeft},${leftCount} +${hunk.startRight},${rightCount} @@`)
    for (const line of hunk.lines) {
      const prefix = line.type === "added" ? "+" : line.type === "removed" ? "-" : " "
      output.push(`${prefix}${line.content}`)
    }
  }

  return output.join("\n")
}

function getByteLength(value: string) {
  return new TextEncoder().encode(value).length
}

function getDiffByteSize(lines: TextDiffLine[]) {
  let total = 0
  for (const line of lines) {
    total += getByteLength(line.content) + 1
  }
  return total
}

function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function countLines(text: string) {
  if (!text) return 0
  let count = 1
  for (let i = 0; i < text.length; i++) {
    if (text.charCodeAt(i) === 10) count++
  }
  return count
}

async function restoreFileFromHistory({
  blob,
  name,
  side,
  setParam,
  setFileName,
  setFileContent,
  setFileTooLarge,
  setUploadError,
  fileBlobRef,
}: {
  blob: Blob
  name: string | null
  side: "left" | "right"
  setParam: <K extends keyof z.infer<typeof paramsSchema>>(
    key: K,
    value: z.infer<typeof paramsSchema>[K],
    immediate?: boolean,
  ) => void
  setFileName: (value: string | null) => void
  setFileContent: (value: string | null) => void
  setFileTooLarge: (value: boolean) => void
  setUploadError: (value: string | null) => void
  fileBlobRef: React.MutableRefObject<Blob | null>
}) {
  setUploadError(null)
  setFileName(name)
  fileBlobRef.current = blob

  try {
    const buffer = await blob.arrayBuffer()
    const decoder = new TextDecoder("utf-8", { fatal: true })
    const content = decoder.decode(buffer)

    if (blob.size > FILE_SIZE_LIMIT) {
      setFileTooLarge(true)
      setFileContent(null)
      setParam(side === "left" ? "leftText" : "rightText", "", true)
      return
    }

    setFileTooLarge(false)
    setFileContent(null)
    setParam(side === "left" ? "leftText" : "rightText", content)
  } catch {
    setUploadError("Saved file is not valid UTF-8.")
    setFileContent(null)
    setFileTooLarge(false)
  }
}

function detectFormat(text: string): { format: FormatType; parsed: unknown | null } {
  if (!text.trim()) return { format: "text", parsed: null }

  try {
    const parsed = JSON.parse(text)
    if (parsed && (Array.isArray(parsed) || typeof parsed === "object")) {
      return { format: "json", parsed }
    }
  } catch {}

  try {
    const parsed = yaml.load(text)
    if (parsed && (Array.isArray(parsed) || typeof parsed === "object")) {
      return { format: "yaml", parsed }
    }
  } catch {}

  try {
    const parsed = toml.parse(text)
    if (parsed && typeof parsed === "object") {
      return { format: "toml", parsed }
    }
  } catch {}

  return { format: "text", parsed: null }
}

function parseWithFormat(
  text: string,
  format: FormatType,
  detected: { format: FormatType; parsed: unknown | null },
): { value: unknown | null; error: string | null } {
  if (!text.trim()) return { value: null, error: null }
  if (format === "text") return { value: null, error: null }
  if (format === "auto") return { value: detected.parsed, error: null }

  try {
    if (format === "json") {
      return { value: JSON.parse(text), error: null }
    }
    if (format === "yaml") {
      return { value: yaml.load(text), error: null }
    }
    if (format === "toml") {
      return { value: toml.parse(text), error: null }
    }
    return { value: null, error: null }
  } catch (err) {
    return { value: null, error: err instanceof Error ? err.message : "Parse failed" }
  }
}

function getTextForDiff(
  rawText: string,
  format: FormatType,
  parsed: unknown | null,
  detected: { format: FormatType; parsed: unknown | null },
) {
  if (!rawText.trim()) return ""
  if (format === "text") return rawText

  const resolved = format === "auto" ? detected.format : format
  const value = format === "auto" ? detected.parsed : parsed
  if (!value) return rawText

  try {
    if (resolved === "json") {
      return JSON.stringify(value, null, 2)
    }
    if (resolved === "yaml") {
      return yaml.dump(value)
    }
    if (resolved === "toml") {
      return toml.stringify(value as toml.JsonMap)
    }
  } catch {
    return rawText
  }

  return rawText
}

function formatStructured(value: unknown | null, format: FormatType) {
  if (!value) return null
  try {
    if (format === "json") {
      return JSON.stringify(value, null, 2)
    }
    if (format === "yaml") {
      return yaml.dump(value)
    }
    if (format === "toml") {
      return toml.stringify(value as toml.JsonMap)
    }
  } catch {
    return null
  }
  return null
}

function DiffRow({ change }: { change: DiffChange }) {
  const [copied, setCopied] = React.useState<string | null>(null)

  const handleCopy = async (text: string, key: string) => {
    await navigator.clipboard.writeText(text)
    setCopied(key)
    setTimeout(() => setCopied(null), 2000)
  }

  const bgClass =
    change.type === "added"
      ? "bg-green-50 dark:bg-green-950/30"
      : change.type === "removed"
        ? "bg-red-50 dark:bg-red-950/30"
        : change.type === "modified"
          ? "bg-yellow-50 dark:bg-yellow-950/30"
          : ""

  const badgeClass =
    change.type === "added"
      ? "bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300"
      : change.type === "removed"
        ? "bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300"
        : "bg-yellow-100 text-yellow-700 dark:bg-yellow-900 dark:text-yellow-300"

  return (
    <tr className={cn("group border-b last:border-0", bgClass)}>
      <td className="px-3 py-2 font-mono text-xs">{change.path}</td>
      <td className="px-3 py-2">
        <span className={cn("rounded px-1.5 py-0.5 text-xs font-medium", badgeClass)}>{change.type}</span>
      </td>
      <td className="group/cell relative max-w-[200px] px-3 py-2">
        {change.oldValue !== undefined && (
          <div className="flex items-start gap-1">
            <code className="block truncate font-mono text-xs text-muted-foreground">
              {formatValue(change.oldValue)}
            </code>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => handleCopy(formatValue(change.oldValue), `old-${change.path}`)}
              className="h-5 w-5 shrink-0 opacity-0 transition-opacity group-hover/cell:opacity-100"
            >
              {copied === `old-${change.path}` ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
            </Button>
          </div>
        )}
      </td>
      <td className="group/cell relative max-w-[200px] px-3 py-2">
        {change.newValue !== undefined && (
          <div className="flex items-start gap-1">
            <code className="block truncate font-mono text-xs text-muted-foreground">
              {formatValue(change.newValue)}
            </code>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => handleCopy(formatValue(change.newValue), `new-${change.path}`)}
              className="h-5 w-5 shrink-0 opacity-0 transition-opacity group-hover/cell:opacity-100"
            >
              {copied === `new-${change.path}` ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
            </Button>
          </div>
        )}
      </td>
    </tr>
  )
}

function UnifiedDiffView({ diffLines }: { diffLines: TextDiffLine[] }) {
  const [expandedGaps, setExpandedGaps] = React.useState<Record<string, { start: number; end: number }>>({})

  type DisplayItem =
    | { kind: "line"; index: number }
    | {
        kind: "gap"
        id: string
        start: number
        end: number
        hiddenCount: number
        leftRange: { start: number; count: number }
        rightRange: { start: number; count: number }
      }

  const displayItems = React.useMemo<DisplayItem[]>(() => {
    const contextLines = 3
    const visible = new Array(diffLines.length).fill(false)
    const changedIndices: number[] = []

    diffLines.forEach((line, idx) => {
      if (line.type !== "unchanged") changedIndices.push(idx)
    })

    if (changedIndices.length === 0) {
      return diffLines.map((_, idx) => ({ kind: "line" as const, index: idx }))
    }

    for (const idx of changedIndices) {
      const start = Math.max(0, idx - contextLines)
      const end = Math.min(diffLines.length - 1, idx + contextLines)
      for (let i = start; i <= end; i++) visible[i] = true
    }

    let cursor = 0
    while (cursor < diffLines.length) {
      if (visible[cursor]) {
        cursor++
        continue
      }
      const start = cursor
      while (cursor < diffLines.length && !visible[cursor]) cursor++
      const end = cursor - 1
      const length = end - start + 1
      if (length < 3) {
        for (let i = start; i <= end; i++) visible[i] = true
      }
    }

    const items: DisplayItem[] = []

    cursor = 0
    while (cursor < diffLines.length) {
      if (visible[cursor]) {
        items.push({ kind: "line", index: cursor })
        cursor++
        continue
      }

      const start = cursor
      while (cursor < diffLines.length && !visible[cursor]) cursor++
      const end = cursor - 1
      const length = end - start + 1
      const gapId = `gap-${start}`
      const expanded = expandedGaps[gapId] ?? { start: 0, end: 0 }
      const extraStart = Math.min(expanded.start, length)
      const extraEnd = Math.min(expanded.end, Math.max(0, length - extraStart))

      for (let i = 0; i < extraStart; i++) {
        items.push({ kind: "line", index: start + i })
      }

      const remaining = length - extraStart - extraEnd
      if (remaining > 0) {
        if (remaining < 3) {
          for (let i = start + extraStart; i <= end - extraEnd; i++) {
            items.push({ kind: "line", index: i })
          }
        } else {
          const gapStart = start + extraStart
          const gapEnd = end - extraEnd
          const { leftRange, rightRange } = getGapRanges(diffLines, gapStart, gapEnd)
          items.push({
            kind: "gap",
            id: gapId,
            start: gapStart,
            end: gapEnd,
            hiddenCount: remaining,
            leftRange,
            rightRange,
          })
        }
      }

      for (let i = 0; i < extraEnd; i++) {
        items.push({ kind: "line", index: end - extraEnd + 1 + i })
      }
    }

    return items
  }, [diffLines, expandedGaps])

  return (
    <div>
      {displayItems.map((item) => {
        if (item.kind === "line") {
          const line = diffLines[item.index]
          return <TextDiffLineRow key={`line-${item.index}`} line={line} />
        }

        if (item.kind !== "gap") return null

        const atStart = item.start === 0
        const atEnd = item.end === diffLines.length - 1

        return (
          <div
            key={item.id}
            className="flex w-full items-center gap-2 bg-muted/40 px-3 py-1 text-xs text-muted-foreground"
          >
            <div className="flex w-[84px] gap-2 font-mono text-sm text-muted-foreground">
              <div className="flex w-7">
                <button
                  type="button"
                  className={cn(
                    "h-5 w-7 rounded hover:bg-muted/70",
                    atStart && "invisible",
                    "flex items-center justify-center leading-none",
                  )}
                  onClick={() =>
                    setExpandedGaps((prev) => ({
                      ...prev,
                      [item.id]: { start: (prev[item.id]?.start ?? 0) + 10, end: prev[item.id]?.end ?? 0 },
                    }))
                  }
                >
                  ↓
                </button>
              </div>
              <div className="flex w-7">
                <button
                  type="button"
                  className={cn(
                    "h-5 w-7 rounded hover:bg-muted/70",
                    atEnd && "invisible",
                    "flex items-center justify-center leading-none",
                  )}
                  onClick={() =>
                    setExpandedGaps((prev) => ({
                      ...prev,
                      [item.id]: { start: prev[item.id]?.start ?? 0, end: (prev[item.id]?.end ?? 0) + 10 },
                    }))
                  }
                >
                  ↑
                </button>
              </div>
              <div className="w-4" />
            </div>
            <div className="flex-1 font-mono text-sm text-muted-foreground">
              @@ -{item.leftRange.start},{item.leftRange.count} +{item.rightRange.start},{item.rightRange.count} @@
            </div>
          </div>
        )
      })}
    </div>
  )
}

function TextDiffLineRow({ line }: { line: TextDiffLine }) {
  const bgClass =
    line.type === "added"
      ? "bg-green-50 dark:bg-green-950/30"
      : line.type === "removed"
        ? "bg-red-50 dark:bg-red-950/30"
        : ""

  const prefix = line.type === "added" ? "+" : line.type === "removed" ? "-" : " "
  const hasCharDiff = Boolean(line.charDiff && (line.type === "added" || line.type === "removed"))
  const content = line.content === "" ? " " : line.content

  return (
    <div className={cn("flex items-start gap-2 px-3 py-1 text-sm", bgClass)}>
      <div className="flex w-[84px] gap-2 font-mono text-sm text-muted-foreground">
        <span className="w-7 text-right">{line.lineNumber?.left ?? ""}</span>
        <span className="w-7 text-right">{line.lineNumber?.right ?? ""}</span>
        <span className="w-4 text-center">{prefix}</span>
      </div>
      <code className="flex-1 whitespace-pre-wrap break-all">
        {hasCharDiff
          ? line.charDiff?.map((part, idx) => {
              const partClass =
                part.type === "added"
                  ? "bg-green-200/70 dark:bg-green-900/50"
                  : part.type === "removed"
                    ? "bg-red-200/70 dark:bg-red-900/50"
                    : ""
              return (
                <span key={idx} className={partClass}>
                  {part.text === "" ? " " : part.text}
                </span>
              )
            })
          : content}
      </code>
    </div>
  )
}

function getGapRanges(lines: TextDiffLine[], start: number, end: number) {
  let leftStart: number | undefined
  let rightStart: number | undefined
  let leftCount = 0
  let rightCount = 0

  for (let i = start; i <= end; i++) {
    const line = lines[i]
    if (line.type !== "added") leftCount += 1
    if (line.type !== "removed") rightCount += 1
    if (leftStart === undefined && line.lineNumber?.left !== undefined) leftStart = line.lineNumber.left
    if (rightStart === undefined && line.lineNumber?.right !== undefined) rightStart = line.lineNumber.right
  }

  if (leftStart === undefined) {
    const fallback = findPrevLineNumber(lines, start, "left")
    leftStart = fallback !== null ? fallback + 1 : 1
  }
  if (rightStart === undefined) {
    const fallback = findPrevLineNumber(lines, start, "right")
    rightStart = fallback !== null ? fallback + 1 : 1
  }

  return { leftRange: { start: leftStart, count: leftCount }, rightRange: { start: rightStart, count: rightCount } }
}

function findPrevLineNumber(lines: TextDiffLine[], start: number, side: "left" | "right") {
  for (let i = start - 1; i >= 0; i--) {
    const value = side === "left" ? lines[i].lineNumber?.left : lines[i].lineNumber?.right
    if (value !== undefined) return value
  }
  return null
}
