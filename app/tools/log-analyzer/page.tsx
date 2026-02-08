"use client";

import * as React from "react";
import { Suspense } from "react";
import { z } from "zod";
import {
  ToolPageWrapper,
  useToolHistoryContext,
} from "@/components/tool-ui/tool-page-wrapper";
import {
  DEFAULT_URL_SYNC_DEBOUNCE_MS,
  useUrlSyncedState,
} from "@/lib/url-state/use-url-synced-state";
import type { HistoryEntry } from "@/lib/history/db";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { analyzeLogs } from "@/lib/data/log-analyzer";

const paramsSchema = z.object({
  topN: z.coerce.number().int().min(1).max(50).default(10),
  logText: z.string().default(""),
});

export default function LogAnalyzerPage() {
  return (
    <Suspense fallback={null}>
      <LogAnalyzerContent />
    </Suspense>
  );
}

function LogAnalyzerContent() {
  const { state, setParam, oversizeKeys, hasUrlParams, hydrationSource } =
    useUrlSyncedState("log-analyzer", {
      schema: paramsSchema,
      defaults: paramsSchema.parse({}),
    });

  const [summary, setSummary] = React.useState<
    ReturnType<typeof analyzeLogs>["summary"] | null
  >(null);
  const [error, setError] = React.useState<string | null>(null);

  const handleAnalyze = React.useCallback(() => {
    try {
      setError(null);
      if (!state.logText.trim()) {
        setSummary(null);
        return;
      }
      setSummary(analyzeLogs(state.logText).summary);
    } catch (caught) {
      console.error(caught);
      setError(
        caught instanceof Error ? caught.message : "Failed to analyze logs.",
      );
      setSummary(null);
    }
  }, [state.logText]);

  React.useEffect(() => {
    handleAnalyze();
  }, [handleAnalyze]);

  const handleLoadHistory = React.useCallback(
    (entry: HistoryEntry) => {
      const { inputs, params } = entry;
      if (inputs.logText !== undefined) setParam("logText", inputs.logText);
      if (params.topN !== undefined) setParam("topN", params.topN as number);
    },
    [setParam],
  );

  return (
    <ToolPageWrapper
      toolId="log-analyzer"
      title="Log Analyzer"
      description="Parse raw logs and summarize levels, status classes, top paths, and error lines."
      onLoadHistory={handleLoadHistory}
    >
      <LogAnalyzerInner
        state={state}
        setParam={setParam}
        oversizeKeys={oversizeKeys}
        hasUrlParams={hasUrlParams}
        hydrationSource={hydrationSource}
        summary={summary}
        error={error}
        onAnalyze={handleAnalyze}
      />
    </ToolPageWrapper>
  );
}

function LogAnalyzerInner({
  state,
  setParam,
  oversizeKeys,
  hasUrlParams,
  hydrationSource,
  summary,
  error,
  onAnalyze,
}: {
  state: z.infer<typeof paramsSchema>;
  setParam: <K extends keyof z.infer<typeof paramsSchema>>(
    key: K,
    value: z.infer<typeof paramsSchema>[K],
    immediate?: boolean,
  ) => void;
  oversizeKeys: (keyof z.infer<typeof paramsSchema>)[];
  hasUrlParams: boolean;
  hydrationSource: "default" | "url" | "history";
  summary: ReturnType<typeof analyzeLogs>["summary"] | null;
  error: string | null;
  onAnalyze: () => void;
}) {
  const { addHistoryEntry, updateHistoryParams } = useToolHistoryContext();
  const lastInputRef = React.useRef("");
  const hasHydratedInputRef = React.useRef(false);
  const hasHandledUrlRef = React.useRef(false);

  const paramsForHistory = React.useMemo(
    () => ({ topN: state.topN }),
    [state.topN],
  );

  React.useEffect(() => {
    if (hasHydratedInputRef.current) return;
    if (hydrationSource === "default") return;
    lastInputRef.current = state.logText;
    hasHydratedInputRef.current = true;
  }, [hydrationSource, state.logText]);

  React.useEffect(() => {
    if (state.logText === lastInputRef.current) return;
    const timer = setTimeout(() => {
      lastInputRef.current = state.logText;
      addHistoryEntry(
        { logText: state.logText },
        paramsForHistory,
        "left",
        state.logText.slice(0, 120),
      );
    }, DEFAULT_URL_SYNC_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [addHistoryEntry, paramsForHistory, state.logText]);

  React.useEffect(() => {
    if (hasUrlParams && !hasHandledUrlRef.current) {
      hasHandledUrlRef.current = true;
      if (state.logText) {
        addHistoryEntry(
          { logText: state.logText },
          paramsForHistory,
          "left",
          state.logText.slice(0, 120),
        );
      } else {
        updateHistoryParams(paramsForHistory);
      }
    }
  }, [
    addHistoryEntry,
    hasUrlParams,
    paramsForHistory,
    state.logText,
    updateHistoryParams,
  ]);

  React.useEffect(() => {
    updateHistoryParams(paramsForHistory);
  }, [paramsForHistory, updateHistoryParams]);

  return (
    <div className="space-y-4 py-4 sm:py-6">
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Raw Logs</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="max-w-xs space-y-2">
            <Label>Top Rows</Label>
            <Input
              type="number"
              min={1}
              max={50}
              value={state.topN}
              onChange={(event) =>
                setParam("topN", Number(event.target.value) || 10, true)
              }
            />
          </div>
          <Textarea
            value={state.logText}
            onChange={(event) => setParam("logText", event.target.value)}
            className="min-h-[220px] font-mono text-xs"
            placeholder="Paste plain text logs, JSON logs, or access logs"
          />
          {oversizeKeys.includes("logText") ? (
            <p className="text-xs text-muted-foreground">
              Input exceeds 2 KB and is not synced to the URL.
            </p>
          ) : null}
          <Button type="button" onClick={onAnalyze}>
            Analyze Logs
          </Button>
          {error ? <p className="text-xs text-destructive">{error}</p> : null}
        </CardContent>
      </Card>

      {summary ? (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Summary</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-sm">
              Total lines: {summary.totalLines} | Parsed: {summary.parsedLines}{" "}
              | Unparsed: {summary.unparsedLines}
            </p>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="rounded border p-3">
                <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  Levels
                </p>
                <pre className="whitespace-pre-wrap text-xs">
                  {JSON.stringify(summary.levelCounts, null, 2)}
                </pre>
              </div>
              <div className="rounded border p-3">
                <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  Status Buckets
                </p>
                <pre className="whitespace-pre-wrap text-xs">
                  {JSON.stringify(summary.statusBuckets, null, 2)}
                </pre>
              </div>
            </div>
            <div className="rounded border p-3">
              <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Top Paths
              </p>
              <div className="font-mono text-xs">
                {summary.topPaths.slice(0, state.topN).map((pathItem) => (
                  <p key={pathItem.path} className="break-all">
                    {pathItem.count}x {pathItem.path}
                  </p>
                ))}
              </div>
            </div>
            <div className="rounded border p-3">
              <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Recent Errors
              </p>
              <div className="max-h-64 overflow-auto font-mono text-xs">
                {summary.recentErrors
                  .slice(0, state.topN)
                  .map((entry, index) => (
                    <p key={`${entry.raw}-${index}`} className="break-all">
                      {entry.level ?? "-"} {entry.status ?? "-"}{" "}
                      {entry.path ?? "-"} | {entry.raw}
                    </p>
                  ))}
              </div>
            </div>
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}
