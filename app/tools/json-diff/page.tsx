"use client"

import * as React from "react"
import { Suspense } from "react"
import { Upload, Copy, Check, FileJson, AlertCircle, Maximize2, Minimize2 } from "lucide-react"
import { ToolPageWrapper, useToolHistoryContext } from "@/components/tool-ui/tool-page-wrapper"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { compareJSON, formatValue, type DiffChange } from "@/lib/data/json-diff"
import { computeTextDiff, getDiffStats, groupIntoHunks, type TextDiffLine, type DiffHunk } from "@/lib/data/text-diff"
import type { HistoryEntry } from "@/lib/history/db"
import { cn } from "@/lib/utils"

export default function JSONDiffPage() {
  return (
    <Suspense fallback={null}>
      <JSONDiffContent />
    </Suspense>
  )
}

function JSONDiffContent() {
  const [left, setLeft] = React.useState("")
  const [right, setRight] = React.useState("")
  const [leftFileName, setLeftFileName] = React.useState<string | null>(null)
  const [rightFileName, setRightFileName] = React.useState<string | null>(null)
  const [leftError, setLeftError] = React.useState<string | null>(null)
  const [rightError, setRightError] = React.useState<string | null>(null)
  const [viewMode, setViewMode] = React.useState<"table" | "text">("table")
  const [isFullscreen, setIsFullscreen] = React.useState(false)

  const handleLoadHistory = React.useCallback((entry: HistoryEntry) => {
    const { inputs, params } = entry

    if (params.leftFileName || params.rightFileName) {
      alert("This history entry contains uploaded files and cannot be restored. Only file names were recorded.")
      return
    }

    if (inputs.left !== undefined) setLeft(inputs.left)
    if (inputs.right !== undefined) setRight(inputs.right)
  }, [])

  return (
    <ToolPageWrapper
      toolId="json-diff"
      title="JSON Diff Viewer"
      description="Compare two JSON files or inputs and view differences"
      onLoadHistory={handleLoadHistory}
    >
      <JSONDiffInner
        left={left}
        right={right}
        setLeft={setLeft}
        setRight={setRight}
        leftFileName={leftFileName}
        rightFileName={rightFileName}
        setLeftFileName={setLeftFileName}
        setRightFileName={setRightFileName}
        leftError={leftError}
        rightError={rightError}
        setLeftError={setLeftError}
        setRightError={setRightError}
        viewMode={viewMode}
        setViewMode={setViewMode}
        isFullscreen={isFullscreen}
        setIsFullscreen={setIsFullscreen}
      />
    </ToolPageWrapper>
  )
}

function JSONDiffInner({
  left,
  right,
  setLeft,
  setRight,
  leftFileName,
  rightFileName,
  setLeftFileName,
  setRightFileName,
  leftError,
  rightError,
  setLeftError,
  setRightError,
  viewMode,
  setViewMode,
  isFullscreen,
  setIsFullscreen,
}: {
  left: string
  right: string
  setLeft: (v: string) => void
  setRight: (v: string) => void
  leftFileName: string | null
  rightFileName: string | null
  setLeftFileName: (v: string | null) => void
  setRightFileName: (v: string | null) => void
  leftError: string | null
  rightError: string | null
  setLeftError: (v: string | null) => void
  setRightError: (v: string | null) => void
  viewMode: "table" | "text"
  setViewMode: (v: "table" | "text") => void
  isFullscreen: boolean
  setIsFullscreen: (v: boolean) => void
}) {
  const { addHistoryEntry } = useToolHistoryContext()
  const lastInputRef = React.useRef<string>("")
  const leftInputRef = React.useRef<HTMLInputElement>(null)
  const rightInputRef = React.useRef<HTMLInputElement>(null)

  // Parse JSON and compute diff
  const { leftParsed, rightParsed, changes, leftParseError, rightParseError } = React.useMemo(() => {
    let leftParsed: unknown = null
    let rightParsed: unknown = null
    let changes: DiffChange[] = []
    let leftParseError: string | null = null
    let rightParseError: string | null = null

    try {
      if (left.trim()) {
        leftParsed = JSON.parse(left)
      }
    } catch (e) {
      leftParseError = (e as Error).message
    }

    try {
      if (right.trim()) {
        rightParsed = JSON.parse(right)
      }
    } catch (e) {
      rightParseError = (e as Error).message
    }

    if (leftParsed !== null && rightParsed !== null) {
      changes = compareJSON(leftParsed, rightParsed)
    }

    return { leftParsed, rightParsed, changes, leftParseError, rightParseError }
  }, [left, right])

  const { textDiff, textHunks, textStats } = React.useMemo(() => {
    if (!leftParsed || !rightParsed) {
      return { textDiff: [], textHunks: [], textStats: { added: 0, removed: 0, unchanged: 0 } }
    }
    const leftFormatted = JSON.stringify(leftParsed, null, 2)
    const rightFormatted = JSON.stringify(rightParsed, null, 2)
    const diff = computeTextDiff(leftFormatted, rightFormatted)
    const hunks = groupIntoHunks(diff, 3)
    const stats = getDiffStats(diff)
    return { textDiff: diff, textHunks: hunks, textStats: stats }
  }, [leftParsed, rightParsed])

  // Update error states
  React.useEffect(() => {
    setLeftError(leftParseError)
  }, [leftParseError, setLeftError])

  React.useEffect(() => {
    setRightError(rightParseError)
  }, [rightParseError, setRightError])

  // Save history
  React.useEffect(() => {
    const combined = `${left}|${right}`
    if (!left && !right) return
    if (combined === lastInputRef.current) return

    const timer = setTimeout(() => {
      lastInputRef.current = combined
      addHistoryEntry(
        { left: leftFileName ? "" : left, right: rightFileName ? "" : right },
        { leftFileName, rightFileName },
        "left",
        leftFileName || rightFileName || left.slice(0, 50) + (right ? " vs " + right.slice(0, 50) : ""),
      )
    }, 1000)

    return () => clearTimeout(timer)
  }, [left, right, leftFileName, rightFileName, addHistoryEntry])

  const handleFileUpload = (side: "left" | "right") => (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    const reader = new FileReader()
    reader.onload = (event) => {
      const content = event.target?.result as string
      if (side === "left") {
        setLeft(content)
        setLeftFileName(file.name)
      } else {
        setRight(content)
        setRightFileName(file.name)
      }
    }
    reader.readAsText(file)
  }

  const stats = React.useMemo(() => {
    const added = changes.filter((c) => c.type === "added").length
    const removed = changes.filter((c) => c.type === "removed").length
    const modified = changes.filter((c) => c.type === "modified").length
    return { added, removed, modified, total: added + removed + modified }
  }, [changes])

  // Handle ESC key to exit fullscreen
  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isFullscreen) {
        setIsFullscreen(false)
      }
    }
    window.addEventListener("keydown", handleKeyDown)
    return () => window.removeEventListener("keydown", handleKeyDown)
  }, [isFullscreen, setIsFullscreen])

  const hasValidJson = leftParsed !== null && rightParsed !== null

  return (
    <div className={cn("flex flex-col gap-4", isFullscreen && "fixed inset-0 z-50 bg-background p-4")}>
      {/* Input Section */}
      {!isFullscreen && (
        <div className="flex gap-4">
          {/* Left Input */}
          <div className="flex w-0 flex-1 flex-col gap-2">
            <div className="flex items-center justify-between">
              <Label className="text-sm font-medium">Original JSON {leftFileName && `(${leftFileName})`}</Label>
              <div className="flex gap-1">
                <input
                  ref={leftInputRef}
                  type="file"
                  accept=".json,application/json"
                  onChange={handleFileUpload("left")}
                  className="hidden"
                />
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => leftInputRef.current?.click()}
                  className="h-7 gap-1 px-2 text-xs"
                >
                  <Upload className="h-3 w-3" />
                  Upload
                </Button>
              </div>
            </div>
            <Textarea
              value={left}
              onChange={(e) => {
                setLeft(e.target.value)
                setLeftFileName(null)
              }}
              placeholder="Paste original JSON here..."
              className={cn(
                "max-h-[300px] min-h-[200px] overflow-auto font-mono text-sm",
                leftError && "border-destructive",
              )}
            />
            {leftError && (
              <Alert variant="destructive" className="py-2">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription className="text-xs">{leftError}</AlertDescription>
              </Alert>
            )}
          </div>

          {/* Right Input */}
          <div className="flex w-0 flex-1 flex-col gap-2">
            <div className="flex items-center justify-between">
              <Label className="text-sm font-medium">Modified JSON {rightFileName && `(${rightFileName})`}</Label>
              <div className="flex gap-1">
                <input
                  ref={rightInputRef}
                  type="file"
                  accept=".json,application/json"
                  onChange={handleFileUpload("right")}
                  className="hidden"
                />
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => rightInputRef.current?.click()}
                  className="h-7 gap-1 px-2 text-xs"
                >
                  <Upload className="h-3 w-3" />
                  Upload
                </Button>
              </div>
            </div>
            <Textarea
              value={right}
              onChange={(e) => {
                setRight(e.target.value)
                setRightFileName(null)
              }}
              placeholder="Paste modified JSON here..."
              className={cn(
                "max-h-[300px] min-h-[200px] overflow-auto font-mono text-sm",
                rightError && "border-destructive",
              )}
            />
            {rightError && (
              <Alert variant="destructive" className="py-2">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription className="text-xs">{rightError}</AlertDescription>
              </Alert>
            )}
          </div>
        </div>
      )}

      {/* Diff Results */}
      {hasValidJson && (changes.length > 0 || textHunks.length > 0) && (
        <div className={cn("space-y-3", isFullscreen && "flex flex-1 flex-col overflow-hidden")}>
          <div className="flex items-center justify-between">
            <Tabs value={viewMode} onValueChange={(v) => setViewMode(v as "table" | "text")} className="w-auto">
              <TabsList className="h-8">
                <TabsTrigger value="table" className="px-3 py-1 text-xs">
                  Table View
                </TabsTrigger>
                <TabsTrigger value="text" className="px-3 py-1 text-xs">
                  Text View
                </TabsTrigger>
              </TabsList>
            </Tabs>

            <div className="flex items-center gap-4">
              <div className="flex items-center gap-4 text-sm">
                <span className="text-green-600">+{viewMode === "table" ? stats.added : textStats.added}</span>
                <span className="text-red-600">-{viewMode === "table" ? stats.removed : textStats.removed}</span>
                {viewMode === "table" && <span className="text-yellow-600">~{stats.modified}</span>}
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setIsFullscreen(!isFullscreen)}
                className="h-7 gap-1 px-2 text-xs"
              >
                {isFullscreen ? <Minimize2 className="h-3 w-3" /> : <Maximize2 className="h-3 w-3" />}
                {isFullscreen ? "Exit" : "Fullscreen"}
              </Button>
            </div>
          </div>

          {viewMode === "table" ? (
            <div className={cn("overflow-auto rounded-md border", isFullscreen ? "flex-1" : "max-h-[400px]")}>
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
            <div
              className={cn(
                "overflow-auto rounded-md border font-mono text-sm",
                isFullscreen ? "flex-1" : "max-h-[400px]",
              )}
            >
              {textHunks.map((hunk, hunkIdx) => (
                <TextDiffHunkView key={hunkIdx} hunk={hunk} />
              ))}
            </div>
          )}
        </div>
      )}

      {hasValidJson && changes.length === 0 && (
        <Alert>
          <FileJson className="h-4 w-4" />
          <AlertDescription>The two JSON documents are identical.</AlertDescription>
        </Alert>
      )}
    </div>
  )
}

function TextDiffHunkView({ hunk }: { hunk: DiffHunk }) {
  const [expanded, setExpanded] = React.useState(false)

  return (
    <div className="border-b last:border-0">
      <div
        className="flex cursor-pointer items-center gap-2 bg-blue-50 px-3 py-1 text-xs text-blue-700 hover:bg-blue-100 dark:bg-blue-950/50 dark:text-blue-300 dark:hover:bg-blue-950/70"
        onClick={() => setExpanded(!expanded)}
      >
        <span>
          @@ -{hunk.startLeft},{hunk.lines.filter((l) => l.type !== "added").length} +{hunk.startRight},
          {hunk.lines.filter((l) => l.type !== "removed").length} @@
        </span>
      </div>

      {hunk.lines.map((line, idx) => {
        const isChanged = line.type !== "unchanged"
        const nearChange =
          expanded || isChanged || hunk.lines.slice(Math.max(0, idx - 1), idx + 2).some((l) => l.type !== "unchanged")

        if (!nearChange) return null

        return <TextDiffLineView key={idx} line={line} />
      })}
    </div>
  )
}

function TextDiffLineView({ line }: { line: TextDiffLine }) {
  const bgClass =
    line.type === "added"
      ? "bg-green-50 dark:bg-green-950/30"
      : line.type === "removed"
        ? "bg-red-50 dark:bg-red-950/30"
        : ""

  const prefix = line.type === "added" ? "+" : line.type === "removed" ? "-" : " "
  const prefixClass =
    line.type === "added" ? "text-green-600" : line.type === "removed" ? "text-red-600" : "text-muted-foreground"

  return (
    <div className={cn("flex items-start border-b last:border-0", bgClass)}>
      <div className="w-10 shrink-0 border-r bg-muted/50 px-2 py-0.5 text-right text-xs text-muted-foreground">
        {line.lineNumber?.left || ""}
      </div>
      <div className="w-10 shrink-0 border-r bg-muted/50 px-2 py-0.5 text-right text-xs text-muted-foreground">
        {line.lineNumber?.right || ""}
      </div>
      <span className={cn("w-4 shrink-0 px-1 py-0.5 text-center", prefixClass)}>{prefix}</span>
      <span className="flex-1 whitespace-pre-wrap break-all px-2 py-0.5">
        {line.charDiff
          ? line.charDiff.map((part, idx) => (
              <span
                key={idx}
                className={cn(
                  part.type === "added" && "bg-green-200 dark:bg-green-800",
                  part.type === "removed" && "bg-red-200 dark:bg-red-800",
                )}
              >
                {part.text}
              </span>
            ))
          : line.content || " "}
      </span>
    </div>
  )
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
