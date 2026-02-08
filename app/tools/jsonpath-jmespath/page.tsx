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
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  evaluateStructuredQuery,
  formatQueryResult,
  type StructuredQueryEngine,
} from "@/lib/data/query-evaluator";

const paramsSchema = z.object({
  engine: z.enum(["jsonpath", "jmespath"]).default("jsonpath"),
  jsonText: z
    .string()
    .default('{"users":[{"id":1,"name":"Alice"},{"id":2,"name":"Bob"}]}'),
  query: z.string().default("$.users[*].name"),
});

export default function JsonpathJmespathPage() {
  return (
    <Suspense fallback={null}>
      <JsonpathJmespathContent />
    </Suspense>
  );
}

function JsonpathJmespathContent() {
  const { state, setParam, oversizeKeys, hasUrlParams, hydrationSource } =
    useUrlSyncedState("jsonpath-jmespath", {
      schema: paramsSchema,
      defaults: paramsSchema.parse({}),
    });

  const [resultText, setResultText] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);

  const evaluate = React.useCallback(() => {
    setError(null);
    const result = evaluateStructuredQuery(
      state.jsonText,
      state.query,
      state.engine,
    );
    if (result.error) {
      setError(result.error);
      setResultText("");
      return;
    }
    setResultText(formatQueryResult(result.result));
  }, [state.engine, state.jsonText, state.query]);

  React.useEffect(() => {
    evaluate();
  }, [evaluate]);

  const handleLoadHistory = React.useCallback(
    (entry: HistoryEntry) => {
      const { inputs, params } = entry;
      if (inputs.jsonText !== undefined) setParam("jsonText", inputs.jsonText);
      if (inputs.query !== undefined) setParam("query", inputs.query);
      if (params.engine)
        setParam("engine", params.engine as StructuredQueryEngine);
    },
    [setParam],
  );

  return (
    <ToolPageWrapper
      toolId="jsonpath-jmespath"
      title="JSONPath / JMESPath"
      description="Evaluate JSON queries with JSONPath or JMESPath engines."
      onLoadHistory={handleLoadHistory}
    >
      <JsonpathJmespathInner
        state={state}
        setParam={setParam}
        oversizeKeys={oversizeKeys}
        hasUrlParams={hasUrlParams}
        hydrationSource={hydrationSource}
        resultText={resultText}
        error={error}
        onEvaluate={evaluate}
      />
    </ToolPageWrapper>
  );
}

function JsonpathJmespathInner({
  state,
  setParam,
  oversizeKeys,
  hasUrlParams,
  hydrationSource,
  resultText,
  error,
  onEvaluate,
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
  resultText: string;
  error: string | null;
  onEvaluate: () => void;
}) {
  const { addHistoryEntry, updateHistoryParams } = useToolHistoryContext();
  const lastInputRef = React.useRef("");
  const hasHydratedInputRef = React.useRef(false);
  const hasHandledUrlRef = React.useRef(false);

  const paramsForHistory = React.useMemo(
    () => ({ engine: state.engine }),
    [state.engine],
  );
  const inputSnapshot = React.useMemo(
    () => `${state.jsonText}\n${state.query}`,
    [state.jsonText, state.query],
  );

  React.useEffect(() => {
    if (hasHydratedInputRef.current) return;
    if (hydrationSource === "default") return;
    lastInputRef.current = inputSnapshot;
    hasHydratedInputRef.current = true;
  }, [hydrationSource, inputSnapshot]);

  React.useEffect(() => {
    if (inputSnapshot === lastInputRef.current) return;
    const timer = setTimeout(() => {
      lastInputRef.current = inputSnapshot;
      addHistoryEntry(
        {
          jsonText: state.jsonText,
          query: state.query,
        },
        paramsForHistory,
        "left",
        state.query.slice(0, 100),
      );
    }, DEFAULT_URL_SYNC_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [
    addHistoryEntry,
    inputSnapshot,
    paramsForHistory,
    state.jsonText,
    state.query,
  ]);

  React.useEffect(() => {
    if (hasUrlParams && !hasHandledUrlRef.current) {
      hasHandledUrlRef.current = true;
      if (state.jsonText || state.query) {
        addHistoryEntry(
          {
            jsonText: state.jsonText,
            query: state.query,
          },
          paramsForHistory,
          "left",
          state.query.slice(0, 100),
        );
      } else {
        updateHistoryParams(paramsForHistory);
      }
    }
  }, [
    addHistoryEntry,
    hasUrlParams,
    paramsForHistory,
    state.jsonText,
    state.query,
    updateHistoryParams,
  ]);

  React.useEffect(() => {
    updateHistoryParams(paramsForHistory);
  }, [paramsForHistory, updateHistoryParams]);

  return (
    <div className="space-y-4 py-4 sm:py-6">
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Query Input</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="max-w-xs space-y-2">
            <Label>Engine</Label>
            <Select
              value={state.engine}
              onValueChange={(value) =>
                setParam("engine", value as StructuredQueryEngine, true)
              }
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="jsonpath">JSONPath</SelectItem>
                <SelectItem value="jmespath">JMESPath</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>JSON</Label>
            <Textarea
              value={state.jsonText}
              onChange={(event) => setParam("jsonText", event.target.value)}
              className="min-h-[140px] font-mono text-xs"
            />
            {oversizeKeys.includes("jsonText") ? (
              <p className="text-xs text-muted-foreground">
                Input exceeds 2 KB and is not synced to the URL.
              </p>
            ) : null}
          </div>
          <div className="space-y-2">
            <Label>Query</Label>
            <Textarea
              value={state.query}
              onChange={(event) => setParam("query", event.target.value)}
              className="min-h-[90px] font-mono text-xs"
            />
            {oversizeKeys.includes("query") ? (
              <p className="text-xs text-muted-foreground">
                Input exceeds 2 KB and is not synced to the URL.
              </p>
            ) : null}
          </div>
          <Button type="button" onClick={onEvaluate}>
            Evaluate Query
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Result</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <Textarea
            readOnly
            value={resultText}
            className="min-h-[160px] font-mono text-xs"
          />
          {error ? <p className="text-xs text-destructive">{error}</p> : null}
        </CardContent>
      </Card>
    </div>
  );
}
