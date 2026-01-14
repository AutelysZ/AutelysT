"use client"

import * as React from "react"
import { ToolHeader } from "@/components/app-shell/tool-header"
import { useToolHistory, useRecentTools } from "@/lib/history/use-tool-history"
import type { HistoryEntry } from "@/lib/history/db"
import { ScrollArea } from "@/components/ui/scroll-area"

interface ToolPageWrapperProps {
  toolId: string
  title: string
  description: string
  children:
    | React.ReactNode
    | ((props: {
        addHistoryEntry: (
          inputs: Record<string, string>,
          params: Record<string, unknown>,
          inputSide?: "left" | "right",
          preview?: string,
        ) => Promise<HistoryEntry | null>
        updateHistoryParams: (params: Record<string, unknown>) => Promise<void>
        loadFromHistory: HistoryEntry | null
        setLoadFromHistory: (entry: HistoryEntry | null) => void
      }) => React.ReactNode)
  seoContent?: React.ReactNode
}

export function ToolPageWrapper({ toolId, title, description, children, seoContent }: ToolPageWrapperProps) {
  const { entries, loading, addEntry, updateLatestParams, deleteEntry, clearHistory } = useToolHistory(toolId)

  const { recordToolUse } = useRecentTools()
  const [loadFromHistory, setLoadFromHistory] = React.useState<HistoryEntry | null>(null)

  // Record tool use on mount
  React.useEffect(() => {
    recordToolUse(toolId)
  }, [toolId, recordToolUse])

  const handleHistorySelect = React.useCallback((entry: HistoryEntry) => {
    setLoadFromHistory(entry)
  }, [])

  const childProps = {
    addHistoryEntry: addEntry,
    updateHistoryParams: updateLatestParams,
    loadFromHistory,
    setLoadFromHistory,
  }

  return (
    <div className="flex h-full flex-col">
      <ToolHeader
        title={title}
        description={description}
        historyEntries={entries}
        historyLoading={loading}
        onHistorySelect={handleHistorySelect}
        onHistoryDelete={deleteEntry}
        onHistoryClear={clearHistory}
      />
      <ScrollArea className="flex-1">
        <div className="p-6">
          {typeof children === "function" ? children(childProps) : children}

          {/* SEO Content */}
          {seoContent && <div className="mt-8 border-t border-border pt-8">{seoContent}</div>}
        </div>
      </ScrollArea>
    </div>
  )
}
