"use client"

import * as React from "react"
import { Suspense } from "react"
import { Upload, Copy, Check, FileText, ChevronDown, ChevronUp, Maximize2, Minimize2 } from "lucide-react"
import { ToolPageWrapper, useToolHistoryContext } from "@/components/tool-ui/tool-page-wrapper"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { computeTextDiff, getDiffStats, groupIntoHunks, type TextDiffLine, type DiffHunk } from "@/lib/data/text-diff"
import type { HistoryEntry } from "@/lib/history/db"
import { cn } from "@/lib/utils"

export default function TextDiffPage() {
  return (
    <Suspense fallback={null}>
      <TextDiffContent />
    </Suspense>
  )
}

function TextDiffContent() {
  const [left, setLeft] = React.useState("")
  const [right, setRight] = React.useState("")
  const [leftFileName, setLeftFileName] = React.useState<string | null>(null)
  const [rightFileName, setRightFileName] = React.useState<string | null>(null)
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
      toolId="text-diff"
      title="Text Diff Viewer"
      description="Compare two text files or inputs and view differences line by line"
      onLoadHistory={handleLoadHistory}
    >
      <TextDiffInner
        left={left}
        right={right}
        setLeft={setLeft}
        setRight={setRight}
        leftFileName={leftFileName}
        rightFileName={rightFileName}
        setLeftFileName={setLeftFileName}
        setRightFileName={setRightFileName}
        isFullscreen={isFullscreen}
        setIsFullscreen={setIsFullscreen}
      />
    </ToolPageWrapper>
  )
}

function TextDiffInner({
  left,
  right,
  setLeft,
  setRight,
  leftFileName,
  rightFileName,
  setLeftFileName,
  setRightFileName,
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
  isFullscreen: boolean
  setIsFullscreen: (v: boolean) => void
}) {
  const { addHistoryEntry } = useToolHistoryContext()
  const lastInputRef = React.useRef<string>("")
  const leftInputRef = React.useRef<HTMLInputElement>(null)
  const rightInputRef = React.useRef<HTMLInputElement>(null)

  // Compute diff
  const diff = React.useMemo(() => {
    if (!left && !right) return []
    return computeTextDiff(left, right)
  }, [left, right])

  const hunks = React.useMemo(() => groupIntoHunks(diff, 3), [diff])

  const stats = React.useMemo(() => getDiffStats(diff), [diff])

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

  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isFullscreen) {
        setIsFullscreen(false)
      }
    }
    window.addEventListener("keydown", handleKeyDown)
    return () => window.removeEventListener("keydown", handleKeyDown)
  }, [isFullscreen, setIsFullscreen])

  const hasChanges = diff.some((l) => l.type !== "unchanged")

  return (
    <div className={cn("flex flex-col gap-4", isFullscreen && "fixed inset-0 z-50 bg-background p-4")}>
      {/* Input Section */}
      {!isFullscreen && (
        <div className="flex gap-4">
          {/* Left Input */}
          <div className="flex w-0 flex-1 flex-col gap-2">
            <div className="flex items-center justify-between">
              <Label className="text-sm font-medium">Original Text {leftFileName && `(${leftFileName})`}</Label>
              <div className="flex gap-1">
                <input
                  ref={leftInputRef}
                  type="file"
                  accept=".txt,.md,.js,.ts,.jsx,.tsx,.css,.html,.json,.xml,.yaml,.yml,text/*"
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
              placeholder="Paste original text here..."
              className="max-h-[250px] min-h-[150px] overflow-auto font-mono text-sm"
            />
          </div>

          {/* Right Input */}
          <div className="flex w-0 flex-1 flex-col gap-2">
            <div className="flex items-center justify-between">
              <Label className="text-sm font-medium">Modified Text {rightFileName && `(${rightFileName})`}</Label>
              <div className="flex gap-1">
                <input
                  ref={rightInputRef}
                  type="file"
                  accept=".txt,.md,.js,.ts,.jsx,.tsx,.css,.html,.json,.xml,.yaml,.yml,text/*"
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
              placeholder="Paste modified text here..."
              className="max-h-[250px] min-h-[150px] overflow-auto font-mono text-sm"
            />
          </div>
        </div>
      )}

      {/* Diff Results */}
      {hunks.length > 0 && (
        <div className={cn("space-y-3", isFullscreen && "flex flex-1 flex-col overflow-hidden")}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4 text-sm">
              <span className="font-medium">Changes:</span>
              <span className="text-green-600">+{stats.added} added</span>
              <span className="text-red-600">-{stats.removed} removed</span>
              <span className="text-muted-foreground">{stats.unchanged} unchanged</span>
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

          <div
            className={cn(
              "overflow-auto rounded-md border font-mono text-sm",
              isFullscreen ? "flex-1" : "max-h-[400px]",
            )}
          >
            {hunks.map((hunk, hunkIdx) => (
              <DiffHunkView key={hunkIdx} hunk={hunk} isFirst={hunkIdx === 0} isLast={hunkIdx === hunks.length - 1} />
            ))}
          </div>
        </div>
      )}

      {left && right && !hasChanges && (
        <Alert>
          <FileText className="h-4 w-4" />
          <AlertDescription>The two text documents are identical.</AlertDescription>
        </Alert>
      )}
    </div>
  )
}

function DiffHunkView({ hunk, isFirst, isLast }: { hunk: DiffHunk; isFirst: boolean; isLast: boolean }) {
  const [expanded, setExpanded] = React.useState(false)

  return (
    <div className="border-b last:border-0">
      {/* Hunk header - click to expand/collapse */}
      <div
        className="flex cursor-pointer items-center gap-2 bg-blue-50 px-3 py-1 text-xs text-blue-700 hover:bg-blue-100 dark:bg-blue-950/50 dark:text-blue-300 dark:hover:bg-blue-950/70"
        onClick={() => setExpanded(!expanded)}
      >
        {expanded ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
        <span>
          @@ -{hunk.startLeft},{hunk.lines.filter((l) => l.type !== "added").length} +{hunk.startRight},
          {hunk.lines.filter((l) => l.type !== "removed").length} @@
        </span>
        <span className="text-muted-foreground">{expanded ? "Click to collapse" : "Click to expand context"}</span>
      </div>

      {/* Diff lines */}
      {hunk.lines.map((line, idx) => {
        // Show all lines if expanded, otherwise only show changed lines and immediate context
        const isChanged = line.type !== "unchanged"
        const nearChange =
          expanded || isChanged || hunk.lines.slice(Math.max(0, idx - 1), idx + 2).some((l) => l.type !== "unchanged")

        if (!nearChange) return null

        return <DiffLine key={idx} line={line} />
      })}
    </div>
  )
}

function DiffLine({ line }: { line: TextDiffLine }) {
  const [copied, setCopied] = React.useState(false)

  const handleCopy = async () => {
    await navigator.clipboard.writeText(line.content)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

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
    <div className={cn("group flex items-start border-b last:border-0", bgClass)}>
      <div className="w-10 shrink-0 border-r bg-muted/50 px-2 py-0.5 text-right text-xs text-muted-foreground">
        {line.lineNumber?.left || ""}
      </div>
      <div className="w-10 shrink-0 border-r bg-muted/50 px-2 py-0.5 text-right text-xs text-muted-foreground">
        {line.lineNumber?.right || ""}
      </div>
      <span className={cn("w-4 shrink-0 px-1 py-0.5 text-center", prefixClass)}>{prefix}</span>
      <span className="flex-1 whitespace-pre-wrap break-all px-2 py-0.5">
        {line.charDiff ? (
          line.charDiff.map((part, idx) => (
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
        ) : (
          <>{line.content || " "}</>
        )}
      </span>
      <Button
        variant="ghost"
        size="icon"
        onClick={handleCopy}
        className="h-6 w-6 shrink-0 opacity-0 transition-opacity group-hover:opacity-100"
      >
        {copied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
      </Button>
    </div>
  )
}
