"use client"

import * as React from "react"
import { ToolHeader } from "@/components/app-shell/tool-header"
import { useToolHistory, useRecentTools } from "@/lib/history/use-tool-history"
import type { HistoryEntry } from "@/lib/history/db"
import { ScrollArea } from "@/components/ui/scroll-area"

interface ToolHistoryContextValue {
  addHistoryEntry: (
    inputs: Record<string, string>,
    params: Record<string, unknown>,
    inputSide?: "left" | "right",
    preview?: string,
  ) => Promise<HistoryEntry | null>
  updateHistoryParams: (params: Record<string, unknown>) => Promise<void>
}

const ToolHistoryContext = React.createContext<ToolHistoryContextValue | null>(null)

export function useToolHistoryContext() {
  const ctx = React.useContext(ToolHistoryContext)
  if (!ctx) throw new Error("useToolHistoryContext must be used within ToolPageWrapper")
  return ctx
}

interface ToolPageWrapperProps {
  toolId: string
  title: string
  description: string
  children: React.ReactNode
  seoContent?: React.ReactNode
  onLoadHistory?: (entry: HistoryEntry) => void
}

export function ToolPageWrapper({
  toolId,
  title,
  description,
  children,
  seoContent,
  onLoadHistory,
}: ToolPageWrapperProps) {
  const { entries, loading, addEntry, updateLatestParams, deleteEntry, clearHistory } = useToolHistory(toolId)

  const { recordToolUse } = useRecentTools()

  // Record tool use on mount
  React.useEffect(() => {
    recordToolUse(toolId)
  }, [toolId, recordToolUse])

  const handleHistorySelect = React.useCallback(
    (entry: HistoryEntry) => {
      onLoadHistory?.(entry)
    },
    [onLoadHistory],
  )

  const contextValue = React.useMemo(
    () => ({
      addHistoryEntry: addEntry,
      updateHistoryParams: updateLatestParams,
    }),
    [addEntry, updateLatestParams],
  )

  return (
    <ToolHistoryContext.Provider value={contextValue}>
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
            {children}

            {/* SEO Content */}
            {seoContent && <div className="mt-8 border-t border-border pt-8">{seoContent}</div>}
          </div>
        </ScrollArea>
      </div>
    </ToolHistoryContext.Provider>
  )
}
