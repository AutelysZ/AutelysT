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
import { analyzeHar, parseHarJson } from "@/lib/data/har-analyzer";
import { formatBytes } from "@/lib/utility/image-optimizer";

const paramsSchema = z.object({
  topN: z.coerce.number().int().min(1).max(50).default(10),
  harText: z.string().default(""),
});

export default function HarAnalyzerPage() {
  return (
    <Suspense fallback={null}>
      <HarAnalyzerContent />
    </Suspense>
  );
}

function HarAnalyzerContent() {
  const { state, setParam, oversizeKeys, hasUrlParams, hydrationSource } =
    useUrlSyncedState("har-analyzer", {
      schema: paramsSchema,
      defaults: paramsSchema.parse({}),
    });

  const [error, setError] = React.useState<string | null>(null);
  const [summary, setSummary] = React.useState<ReturnType<
    typeof analyzeHar
  > | null>(null);

  const handleAnalyze = React.useCallback(() => {
    setError(null);
    const parsed = parseHarJson(state.harText);
    if (parsed.error || !parsed.har) {
      setSummary(null);
      setError(parsed.error || "Invalid HAR input.");
      return;
    }

    try {
      setSummary(analyzeHar(parsed.har));
    } catch (caught) {
      console.error(caught);
      setSummary(null);
      setError(
        caught instanceof Error ? caught.message : "Failed to analyze HAR.",
      );
    }
  }, [state.harText]);

  React.useEffect(() => {
    if (!state.harText.trim()) {
      setSummary(null);
      setError(null);
      return;
    }
    handleAnalyze();
  }, [handleAnalyze, state.harText]);

  const handleLoadHistory = React.useCallback(
    (entry: HistoryEntry) => {
      const { inputs, params } = entry;
      if (inputs.harText !== undefined) setParam("harText", inputs.harText);
      if (params.topN !== undefined) setParam("topN", params.topN as number);
    },
    [setParam],
  );

  return (
    <ToolPageWrapper
      toolId="har-analyzer"
      title="HAR Analyzer"
      description="Analyze HAR files for request counts, latency hotspots, status distribution, and host breakdown."
      onLoadHistory={handleLoadHistory}
    >
      <HarAnalyzerInner
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

function HarAnalyzerInner({
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
  summary: ReturnType<typeof analyzeHar> | null;
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
    lastInputRef.current = state.harText;
    hasHydratedInputRef.current = true;
  }, [hydrationSource, state.harText]);

  React.useEffect(() => {
    if (state.harText === lastInputRef.current) return;
    const timer = setTimeout(() => {
      lastInputRef.current = state.harText;
      addHistoryEntry(
        { harText: state.harText },
        paramsForHistory,
        "left",
        state.harText.slice(0, 120),
      );
    }, DEFAULT_URL_SYNC_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [addHistoryEntry, paramsForHistory, state.harText]);

  React.useEffect(() => {
    if (hasUrlParams && !hasHandledUrlRef.current) {
      hasHandledUrlRef.current = true;
      if (state.harText) {
        addHistoryEntry(
          { harText: state.harText },
          paramsForHistory,
          "left",
          state.harText.slice(0, 120),
        );
      } else {
        updateHistoryParams(paramsForHistory);
      }
    }
  }, [
    addHistoryEntry,
    hasUrlParams,
    paramsForHistory,
    state.harText,
    updateHistoryParams,
  ]);

  React.useEffect(() => {
    updateHistoryParams(paramsForHistory);
  }, [paramsForHistory, updateHistoryParams]);

  return (
    <div className="space-y-4 py-4 sm:py-6">
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">HAR Input</CardTitle>
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
            value={state.harText}
            onChange={(event) => setParam("harText", event.target.value)}
            placeholder='Paste HAR JSON (starts with {"log": ...})'
            className="min-h-[220px] font-mono text-xs"
          />
          {oversizeKeys.includes("harText") ? (
            <p className="text-xs text-muted-foreground">
              Input exceeds 2 KB and is not synced to the URL.
            </p>
          ) : null}
          <Button type="button" onClick={onAnalyze}>
            Analyze HAR
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
              Entries: {summary.totalEntries} | Total transfer:{" "}
              {formatBytes(summary.totalTransferBytes)} | Total time:{" "}
              {summary.totalTimeMs.toFixed(0)} ms
            </p>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="rounded border p-3">
                <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  Method Counts
                </p>
                <pre className="whitespace-pre-wrap text-xs">
                  {JSON.stringify(summary.methods, null, 2)}
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
                Slowest Requests
              </p>
              <div className="max-h-64 overflow-auto font-mono text-xs">
                {summary.slowestRequests
                  .slice(0, state.topN)
                  .map((item, index) => (
                    <p key={`${item.url}-${index}`} className="break-all">
                      {item.timeMs.toFixed(0)} ms | {item.status} |{" "}
                      {item.method} | {item.url}
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
