"use client"

import * as React from "react"
import { Clock, Trash2, AlertTriangle } from "lucide-react"
import { format } from "date-fns"
import { Button } from "@/components/ui/button"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import type { HistoryEntry } from "@/lib/history/db"

interface HistoryPanelProps {
  entries: HistoryEntry[]
  loading: boolean
  onSelect: (entry: HistoryEntry) => void
  onDelete: (id: string) => void
  onClear: (scope: "tool" | "all") => void
  toolName: string
}

export function HistoryPanel({ entries, loading, onSelect, onDelete, onClear, toolName }: HistoryPanelProps) {
  const [open, setOpen] = React.useState(false)

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button variant="outline" size="sm" className="gap-2 bg-transparent">
          <Clock className="h-4 w-4" />
          History
        </Button>
      </SheetTrigger>
      <SheetContent side="right" className="w-96">
        <SheetHeader className="flex flex-row items-center justify-between">
          <SheetTitle>History</SheetTitle>
          <AlertDialog>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="sm" className="gap-1 text-destructive hover:text-destructive">
                  <Trash2 className="h-4 w-4" />
                  Clear
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <AlertDialogTrigger asChild>
                  <DropdownMenuItem
                    className="text-destructive focus:text-destructive"
                    onSelect={(e) => e.preventDefault()}
                  >
                    Clear {toolName} history
                  </DropdownMenuItem>
                </AlertDialogTrigger>
                <AlertDialogTrigger asChild>
                  <DropdownMenuItem
                    className="text-destructive focus:text-destructive"
                    onSelect={(e) => e.preventDefault()}
                  >
                    Clear all tools history
                  </DropdownMenuItem>
                </AlertDialogTrigger>
              </DropdownMenuContent>
            </DropdownMenu>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle className="flex items-center gap-2">
                  <AlertTriangle className="h-5 w-5 text-destructive" />
                  Clear History
                </AlertDialogTitle>
                <AlertDialogDescription>This action cannot be undone. Choose what to clear:</AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter className="flex-col gap-2 sm:flex-row">
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction
                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                  onClick={() => onClear("tool")}
                >
                  Clear {toolName} only
                </AlertDialogAction>
                <AlertDialogAction
                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                  onClick={() => onClear("all")}
                >
                  Clear all tools
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </SheetHeader>

        <ScrollArea className="mt-4 h-[calc(100vh-120px)]">
          {loading ? (
            <div className="flex items-center justify-center py-8 text-muted-foreground">Loading...</div>
          ) : entries.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-2 py-8 text-muted-foreground">
              <Clock className="h-8 w-8 opacity-50" />
              <p>No history yet</p>
              <p className="text-xs">Your interactions will appear here</p>
            </div>
          ) : (
            <div className="space-y-2">
              {entries.map((entry) => (
                <div
                  key={entry.id}
                  className="group relative rounded-lg border border-border p-3 transition-colors hover:bg-accent/50"
                >
                  <button
                    onClick={() => {
                      onSelect(entry)
                      setOpen(false)
                    }}
                    className="w-full text-left"
                  >
                    <div className="mb-1 text-xs text-muted-foreground">
                      {format(entry.createdAt, "MMM d, yyyy HH:mm")}
                    </div>
                    {entry.preview && <div className="line-clamp-2 text-sm">{entry.preview}</div>}
                    {Object.keys(entry.params).length > 0 && (
                      <div className="mt-2 flex flex-wrap gap-1">
                        {Object.entries(entry.params)
                          .slice(0, 3)
                          .map(([key, value]) => (
                            <span
                              key={key}
                              className="rounded bg-secondary px-1.5 py-0.5 text-xs text-secondary-foreground"
                            >
                              {key}: {String(value)}
                            </span>
                          ))}
                      </div>
                    )}
                  </button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="absolute right-1 top-1 h-6 w-6 opacity-0 transition-opacity group-hover:opacity-100"
                    onClick={() => onDelete(entry.id)}
                  >
                    <Trash2 className="h-3 w-3 text-destructive" />
                  </Button>
                </div>
              ))}
            </div>
          )}
        </ScrollArea>
      </SheetContent>
    </Sheet>
  )
}
