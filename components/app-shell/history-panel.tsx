"use client";

import * as React from "react";
import { Clock, Trash2, AlertTriangle, X, Copy, Check } from "lucide-react";
import { format } from "date-fns";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
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
} from "@/components/ui/alert-dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { HistoryEntry } from "@/lib/history/db";

interface HistoryPanelProps {
  entries: HistoryEntry[];
  loading: boolean;
  onSelect: (entry: HistoryEntry) => void;
  onDelete: (id: string) => void;
  onClear: (scope: "tool" | "all") => void;
  toolName: string;
  variant?: "default" | "password-generator" | "secret-generator";
}

export function HistoryPanel({
  entries,
  loading,
  onSelect,
  onDelete,
  onClear,
  toolName,
  variant = "default",
}: HistoryPanelProps) {
  const [open, setOpen] = React.useState(false);
  const [clearScope, setClearScope] = React.useState<"tool" | "all">("tool");
  const [copiedEntryId, setCopiedEntryId] = React.useState<string | null>(null);

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <Button
        variant="outline"
        size="sm"
        className="gap-2 bg-transparent px-2 md:px-3"
        onClick={() => setOpen(true)}
        aria-label="History"
      >
        <Clock className="h-4 w-4" />
        <span className="hidden md:inline">History</span>
      </Button>
      <SheetContent side="right" className="w-full sm:w-96 [&>button]:hidden">
        <SheetHeader className="flex flex-row items-center justify-between gap-2 pr-1">
          <SheetTitle className="flex-1">History</SheetTitle>
          <div className="flex items-center gap-1">
            <AlertDialog>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-8 gap-1 text-destructive hover:text-destructive"
                  >
                    <Trash2 className="h-4 w-4" />
                    Clear
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <AlertDialogTrigger asChild>
                    <DropdownMenuItem
                      className="text-destructive focus:text-destructive"
                      onSelect={(e) => {
                        e.preventDefault();
                        setClearScope("tool");
                      }}
                    >
                      Clear {toolName} history
                    </DropdownMenuItem>
                  </AlertDialogTrigger>
                  <AlertDialogTrigger asChild>
                    <DropdownMenuItem
                      className="text-destructive focus:text-destructive"
                      onSelect={(e) => {
                        e.preventDefault();
                        setClearScope("all");
                      }}
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
                  <AlertDialogDescription>
                    {clearScope === "tool"
                      ? `This will delete all history for ${toolName}. This action cannot be undone.`
                      : "This will delete all history for all tools. This action cannot be undone."}
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction
                    className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                    onClick={() => onClear(clearScope)}
                  >
                    Clear {clearScope === "tool" ? toolName : "All"}
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={() => setOpen(false)}
            >
              <X className="h-4 w-4" />
              <span className="sr-only">Close</span>
            </Button>
          </div>
        </SheetHeader>

        <ScrollArea className="mt-4 h-[calc(100vh-120px)]">
          {loading ? (
            <div className="flex items-center justify-center py-8 text-muted-foreground">
              Loading...
            </div>
          ) : entries.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-2 py-8 text-muted-foreground">
              <Clock className="h-8 w-8 opacity-50" />
              <p>No history yet</p>
              <p className="text-xs">Your interactions will appear here</p>
            </div>
          ) : (
            <div className="space-y-2 px-2 pb-4">
              {entries.map((entry) => {
                if (
                  variant === "password-generator" ||
                  variant === "secret-generator"
                ) {
                  const label = entry.inputs?.label?.trim() || "Untitled";
                  const password = entry.inputs?.password || "";
                  if (!password) {
                    return null;
                  }
                  return (
                    <div
                      key={entry.id}
                      className="group relative rounded-lg border border-border p-3 transition-colors hover:bg-accent/50"
                    >
                      <div className="mb-1 text-xs text-muted-foreground">
                        {format(entry.createdAt, "MMM d, yyyy HH:mm")}
                      </div>
                      <div className="text-sm font-medium">{label}</div>
                      <div className="mt-1 text-sm font-mono break-all">
                        {password}
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="absolute right-8 top-1 h-6 w-6 opacity-0 transition-opacity group-hover:opacity-100"
                        onClick={async () => {
                          if (!password) return;
                          await navigator.clipboard.writeText(password);
                          setCopiedEntryId(entry.id);
                          setTimeout(() => setCopiedEntryId(null), 2000);
                        }}
                        aria-label="Copy password"
                      >
                        {copiedEntryId === entry.id ? (
                          <Check className="h-3 w-3" />
                        ) : (
                          <Copy className="h-3 w-3" />
                        )}
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="absolute right-1 top-1 h-6 w-6 opacity-0 transition-opacity group-hover:opacity-100"
                        onClick={() => onDelete(entry.id)}
                        aria-label="Delete entry"
                      >
                        <Trash2 className="h-3 w-3 text-destructive" />
                      </Button>
                    </div>
                  );
                }

                return (
                  <div
                    key={entry.id}
                    className="group relative rounded-lg border border-border p-3 transition-colors hover:bg-accent/50"
                  >
                    <button
                      onClick={() => {
                        onSelect(entry);
                        setOpen(false);
                      }}
                      className="w-full text-left"
                    >
                      <div className="mb-1 text-xs text-muted-foreground">
                        {format(entry.createdAt, "MMM d, yyyy HH:mm")}
                      </div>
                      {entry.preview && (
                        <div className="line-clamp-2 text-sm">
                          {entry.preview}
                        </div>
                      )}
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
                );
              })}
            </div>
          )}
        </ScrollArea>
      </SheetContent>
    </Sheet>
  );
}
