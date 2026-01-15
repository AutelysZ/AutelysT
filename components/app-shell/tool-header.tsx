"use client"

import { HistoryPanel } from "./history-panel"
import type { HistoryEntry } from "@/lib/history/db"

interface ToolHeaderProps {
  title: string
  description?: string
  historyEntries: HistoryEntry[]
  historyLoading: boolean
  onHistorySelect: (entry: HistoryEntry) => void
  onHistoryDelete: (id: string) => void
  onHistoryClear: (scope: "tool" | "all") => void
  historyVariant?: "default" | "password-generator"
}

export function ToolHeader({
  title,
  description,
  historyEntries,
  historyLoading,
  onHistorySelect,
  onHistoryDelete,
  onHistoryClear,
  historyVariant = "default",
}: ToolHeaderProps) {
  return (
    <header className="flex items-center justify-between border-b border-border px-6 py-4">
      <div>
        <h1 className="text-xl font-semibold">{title}</h1>
        {description && <p className="mt-0.5 text-sm text-muted-foreground">{description}</p>}
      </div>
      <HistoryPanel
        entries={historyEntries}
        loading={historyLoading}
        onSelect={onHistorySelect}
        onDelete={onHistoryDelete}
        onClear={onHistoryClear}
        toolName={title}
        variant={historyVariant}
      />
    </header>
  )
}
