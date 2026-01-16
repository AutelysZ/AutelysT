"use client"

import * as React from "react"
import { createPortal } from "react-dom"
import { Star } from "lucide-react"
import { HistoryPanel } from "./history-panel"
import type { HistoryEntry } from "@/lib/history/db"
import { useFavorites } from "@/lib/history/use-favorites"
import { Button } from "@/components/ui/button"

interface ToolHeaderProps {
  toolId: string
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
  toolId,
  title,
  description,
  historyEntries,
  historyLoading,
  onHistorySelect,
  onHistoryDelete,
  onHistoryClear,
  historyVariant = "default",
}: ToolHeaderProps) {
  const [titleTarget, setTitleTarget] = React.useState<HTMLElement | null>(null)
  const [actionTarget, setActionTarget] = React.useState<HTMLElement | null>(null)
  const { toggleFavorite, isFavorite } = useFavorites()
  const favoriteActive = isFavorite(toolId)

  React.useEffect(() => {
    setTitleTarget(document.getElementById("mobile-header-title"))
    setActionTarget(document.getElementById("mobile-header-action"))
  }, [])

  return (
    <header className="hidden border-b border-border px-4 py-4 md:block md:px-6">
      {titleTarget &&
        createPortal(
          <span className="truncate">{title}</span>,
          titleTarget,
        )}
      {actionTarget &&
        createPortal(
          <div className="flex items-center gap-1">
            <Button
              variant="outline"
              size="sm"
              className="h-9 w-9 p-0"
              aria-label={favoriteActive ? "Remove from favorites" : "Add to favorites"}
              onClick={() => toggleFavorite(toolId)}
            >
              <Star className={favoriteActive ? "h-4 w-4 fill-current" : "h-4 w-4"} />
            </Button>
            <HistoryPanel
              entries={historyEntries}
              loading={historyLoading}
              onSelect={onHistorySelect}
              onDelete={onHistoryDelete}
              onClear={onHistoryClear}
              toolName={title}
              variant={historyVariant}
            />
          </div>,
          actionTarget,
        )}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="hidden text-xl font-semibold md:block">{title}</h1>
          {description && <p className="mt-0.5 hidden text-sm text-muted-foreground md:block">{description}</p>}
        </div>
        <div className="hidden md:flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            className="h-8 w-8 p-0"
            aria-label={favoriteActive ? "Remove from favorites" : "Add to favorites"}
            onClick={() => toggleFavorite(toolId)}
          >
            <Star className={favoriteActive ? "h-4 w-4 fill-current" : "h-4 w-4"} />
          </Button>
          <HistoryPanel
            entries={historyEntries}
            loading={historyLoading}
            onSelect={onHistorySelect}
            onDelete={onHistoryDelete}
            onClear={onHistoryClear}
            toolName={title}
            variant={historyVariant}
          />
        </div>
      </div>
    </header>
  )
}
