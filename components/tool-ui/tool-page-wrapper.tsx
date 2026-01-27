"use client";

import * as React from "react";
import { ToolHeader } from "@/components/app-shell/tool-header";
import { useToolHistory, useRecentTools } from "@/lib/history/use-tool-history";
import type { HistoryEntry } from "@/lib/history/db";
import { ScrollArea } from "@/components/ui/scroll-area";

interface ToolHistoryContextValue {
  entries: HistoryEntry[];
  loading: boolean;
  addHistoryEntry: (
    inputs: Record<string, string>,
    params: Record<string, unknown>,
    inputSide?: string,
    preview?: string,
    files?: HistoryEntry["files"],
  ) => Promise<HistoryEntry | null>;
  updateHistoryParams: (params: Record<string, unknown>) => Promise<void>;
  updateLatestEntry: (updates: {
    inputs?: Record<string, string>;
    params?: Record<string, unknown>;
    files?: HistoryEntry["files"];
    preview?: string;
    hasInput?: boolean;
  }) => Promise<void>;
  upsertInputEntry: (
    inputs: Record<string, string>,
    params: Record<string, unknown>,
    inputSide?: string,
    preview?: string,
    files?: HistoryEntry["files"],
  ) => Promise<HistoryEntry | null>;
  upsertParams: (
    params: Record<string, unknown>,
    mode: "interpretation" | "deferred",
  ) => Promise<void>;
  clearHistory: (scope: "tool" | "all") => Promise<void>;
}

const ToolHistoryContext = React.createContext<ToolHistoryContextValue | null>(
  null,
);

export function useToolHistoryContext() {
  const ctx = React.useContext(ToolHistoryContext);
  if (!ctx)
    throw new Error(
      "useToolHistoryContext must be used within ToolPageWrapper",
    );
  return ctx;
}

interface ToolPageWrapperProps {
  toolId: string;
  title: string;
  description: string;
  children: React.ReactNode;
  seoContent?: React.ReactNode;
  onLoadHistory?: (entry: HistoryEntry) => void;
  historyVariant?: "default" | "password-generator" | "secret-generator";
  scrollArea?: boolean;
  showHistory?: boolean;
}

export function ToolPageWrapper({
  toolId,
  title,
  description,
  children,
  seoContent,
  onLoadHistory,
  historyVariant = "default",
  scrollArea = true,
  showHistory = true,
}: ToolPageWrapperProps) {
  const {
    entries,
    loading,
    addEntry,
    updateLatestParams,
    updateLatestEntry,
    upsertInputEntry,
    upsertParams,
    deleteEntry,
    clearHistory,
  } = useToolHistory(toolId);

  const { recordToolUse } = useRecentTools();

  // Record tool use on mount
  React.useEffect(() => {
    recordToolUse(toolId);
  }, [toolId, recordToolUse]);

  const handleHistorySelect = React.useCallback(
    (entry: HistoryEntry) => {
      onLoadHistory?.(entry);
    },
    [onLoadHistory],
  );

  const visibleEntries = React.useMemo(
    () => entries.filter((entry) => entry.hasInput !== false),
    [entries],
  );

  const contextValue = React.useMemo(
    () => ({
      entries,
      loading,
      addHistoryEntry: addEntry,
      updateHistoryParams: updateLatestParams,
      updateLatestEntry,
      upsertInputEntry,
      upsertParams,
      clearHistory,
    }),
    [
      entries,
      loading,
      addEntry,
      updateLatestParams,
      updateLatestEntry,
      upsertInputEntry,
      upsertParams,
      clearHistory,
    ],
  );

  const ScrollAreaElement = scrollArea ? ScrollArea : "div";

  return (
    <ToolHistoryContext.Provider value={contextValue}>
      <div className="flex h-full flex-col">
        <ToolHeader
          toolId={toolId}
          title={title}
          description={description}
          historyEntries={visibleEntries}
          historyLoading={loading}
          onHistorySelect={handleHistorySelect}
          onHistoryDelete={deleteEntry}
          onHistoryClear={clearHistory}
          historyVariant={historyVariant}
          showHistory={showHistory}
        />
        <ScrollAreaElement className="flex-1">
          <div className="p-4 sm:p-6 w-screen sm:w-auto">
            {children}

            {/* SEO Content */}
            {seoContent && (
              <div className="mt-8 border-t border-border pt-8">
                {seoContent}
              </div>
            )}
          </div>
        </ScrollAreaElement>
      </div>
    </ToolHistoryContext.Provider>
  );
}
