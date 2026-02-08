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
  evaluateXPath,
  formatQueryResult,
  type XPathReturnType,
} from "@/lib/data/query-evaluator";

const paramsSchema = z.object({
  xmlText: z
    .string()
    .default("<root><user id='1'>Alice</user><user id='2'>Bob</user></root>"),
  expression: z.string().default("/root/user/@id"),
  returnType: z
    .enum(["nodeset", "string", "number", "boolean"])
    .default("nodeset"),
});

export default function XPathPage() {
  return (
    <Suspense fallback={null}>
      <XPathContent />
    </Suspense>
  );
}

function XPathContent() {
  const { state, setParam, oversizeKeys, hasUrlParams, hydrationSource } =
    useUrlSyncedState("xpath", {
      schema: paramsSchema,
      defaults: paramsSchema.parse({}),
    });

  const [resultText, setResultText] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);

  const evaluate = React.useCallback(() => {
    setError(null);
    const result = evaluateXPath(
      state.xmlText,
      state.expression,
      state.returnType,
    );
    if (result.error) {
      setError(result.error);
      setResultText("");
      return;
    }
    setResultText(formatQueryResult(result.result));
  }, [state.expression, state.returnType, state.xmlText]);

  React.useEffect(() => {
    evaluate();
  }, [evaluate]);

  const handleLoadHistory = React.useCallback(
    (entry: HistoryEntry) => {
      const { inputs, params } = entry;
      if (inputs.xmlText !== undefined) setParam("xmlText", inputs.xmlText);
      if (inputs.expression !== undefined)
        setParam("expression", inputs.expression);
      if (params.returnType)
        setParam("returnType", params.returnType as XPathReturnType);
    },
    [setParam],
  );

  return (
    <ToolPageWrapper
      toolId="xpath"
      title="XPath"
      description="Evaluate XPath expressions against XML/HTML input."
      onLoadHistory={handleLoadHistory}
    >
      <XPathInner
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

function XPathInner({
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
    () => ({ returnType: state.returnType }),
    [state.returnType],
  );
  const inputSnapshot = React.useMemo(
    () => `${state.xmlText}\n${state.expression}`,
    [state.expression, state.xmlText],
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
        { xmlText: state.xmlText, expression: state.expression },
        paramsForHistory,
        "left",
        state.expression.slice(0, 100),
      );
    }, DEFAULT_URL_SYNC_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [
    addHistoryEntry,
    inputSnapshot,
    paramsForHistory,
    state.expression,
    state.xmlText,
  ]);

  React.useEffect(() => {
    if (hasUrlParams && !hasHandledUrlRef.current) {
      hasHandledUrlRef.current = true;
      if (state.xmlText || state.expression) {
        addHistoryEntry(
          { xmlText: state.xmlText, expression: state.expression },
          paramsForHistory,
          "left",
          state.expression.slice(0, 100),
        );
      } else {
        updateHistoryParams(paramsForHistory);
      }
    }
  }, [
    addHistoryEntry,
    hasUrlParams,
    paramsForHistory,
    state.expression,
    state.xmlText,
    updateHistoryParams,
  ]);

  React.useEffect(() => {
    updateHistoryParams(paramsForHistory);
  }, [paramsForHistory, updateHistoryParams]);

  return (
    <div className="space-y-4 py-4 sm:py-6">
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">XPath Input</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="max-w-xs space-y-2">
            <Label>Return Type</Label>
            <Select
              value={state.returnType}
              onValueChange={(value) =>
                setParam("returnType", value as XPathReturnType, true)
              }
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="nodeset">Node Set</SelectItem>
                <SelectItem value="string">String</SelectItem>
                <SelectItem value="number">Number</SelectItem>
                <SelectItem value="boolean">Boolean</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>XML / HTML</Label>
            <Textarea
              value={state.xmlText}
              onChange={(event) => setParam("xmlText", event.target.value)}
              className="min-h-[160px] font-mono text-xs"
            />
            {oversizeKeys.includes("xmlText") ? (
              <p className="text-xs text-muted-foreground">
                Input exceeds 2 KB and is not synced to the URL.
              </p>
            ) : null}
          </div>
          <div className="space-y-2">
            <Label>XPath Expression</Label>
            <Textarea
              value={state.expression}
              onChange={(event) => setParam("expression", event.target.value)}
              className="min-h-[90px] font-mono text-xs"
            />
            {oversizeKeys.includes("expression") ? (
              <p className="text-xs text-muted-foreground">
                Input exceeds 2 KB and is not synced to the URL.
              </p>
            ) : null}
          </div>
          <Button type="button" onClick={onEvaluate}>
            Evaluate XPath
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Result</CardTitle>
        </CardHeader>
        <CardContent>
          <Textarea
            readOnly
            value={resultText}
            className="min-h-[180px] font-mono text-xs"
          />
          {error ? (
            <p className="mt-2 text-xs text-destructive">{error}</p>
          ) : null}
        </CardContent>
      </Card>
    </div>
  );
}
