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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  generateCuid2Batch,
  getCuid2Defaults,
  parseCuid2Lines,
} from "@/lib/identifier/cuid2";

const defaults = getCuid2Defaults();

const paramsSchema = z.object({
  count: z.coerce.number().int().min(1).max(1000).default(5),
  length: z.coerce
    .number()
    .int()
    .min(defaults.minLength)
    .max(defaults.maxLength)
    .default(defaults.defaultLength),
  fingerprint: z.string().default(""),
  inputText: z.string().default(""),
});

export default function Cuid2Page() {
  return (
    <Suspense fallback={null}>
      <Cuid2Content />
    </Suspense>
  );
}

function Cuid2Content() {
  const { state, setParam, oversizeKeys, hasUrlParams, hydrationSource } =
    useUrlSyncedState("cuid2", {
      schema: paramsSchema,
      defaults: paramsSchema.parse({}),
    });

  const [generatedText, setGeneratedText] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);

  const parsedItems = React.useMemo(
    () => parseCuid2Lines(state.inputText),
    [state.inputText],
  );
  const validCount = parsedItems.filter((item) => item.valid).length;

  const handleLoadHistory = React.useCallback(
    (entry: HistoryEntry) => {
      const { inputs, params } = entry;
      if (inputs.inputText !== undefined)
        setParam("inputText", inputs.inputText);
      if (params.count) setParam("count", params.count as number);
      if (params.length) setParam("length", params.length as number);
      if (params.fingerprint !== undefined)
        setParam("fingerprint", params.fingerprint as string);
    },
    [setParam],
  );

  const handleGenerate = React.useCallback(() => {
    setError(null);
    const result = generateCuid2Batch({
      count: state.count,
      length: state.length,
      fingerprint: state.fingerprint.trim() || undefined,
    });
    if (result.error) {
      setError(result.error);
      setGeneratedText("");
      return;
    }
    setGeneratedText(result.ids.join("\n"));
  }, [state.count, state.fingerprint, state.length]);

  return (
    <ToolPageWrapper
      toolId="cuid2"
      title="CUID2"
      description="Generate and validate collision-resistant CUID2 identifiers."
      onLoadHistory={handleLoadHistory}
    >
      <Cuid2Inner
        state={state}
        setParam={setParam}
        oversizeKeys={oversizeKeys}
        hasUrlParams={hasUrlParams}
        hydrationSource={hydrationSource}
        generatedText={generatedText}
        parsedCount={parsedItems.length}
        validCount={validCount}
        error={error}
        onGenerate={handleGenerate}
      />
    </ToolPageWrapper>
  );
}

function Cuid2Inner({
  state,
  setParam,
  oversizeKeys,
  hasUrlParams,
  hydrationSource,
  generatedText,
  parsedCount,
  validCount,
  error,
  onGenerate,
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
  generatedText: string;
  parsedCount: number;
  validCount: number;
  error: string | null;
  onGenerate: () => void;
}) {
  const { addHistoryEntry, updateHistoryParams } = useToolHistoryContext();
  const lastInputRef = React.useRef("");
  const hasHydratedInputRef = React.useRef(false);
  const hasHandledUrlRef = React.useRef(false);

  const paramsForHistory = React.useMemo(
    () => ({
      count: state.count,
      length: state.length,
      fingerprint: state.fingerprint,
    }),
    [state.count, state.fingerprint, state.length],
  );

  React.useEffect(() => {
    if (hasHydratedInputRef.current) return;
    if (hydrationSource === "default") return;
    lastInputRef.current = state.inputText;
    hasHydratedInputRef.current = true;
  }, [hydrationSource, state.inputText]);

  React.useEffect(() => {
    if (state.inputText === lastInputRef.current) return;
    const timer = setTimeout(() => {
      lastInputRef.current = state.inputText;
      addHistoryEntry(
        { inputText: state.inputText },
        paramsForHistory,
        "left",
        state.inputText.slice(0, 120),
      );
    }, DEFAULT_URL_SYNC_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [addHistoryEntry, paramsForHistory, state.inputText]);

  React.useEffect(() => {
    if (hasUrlParams && !hasHandledUrlRef.current) {
      hasHandledUrlRef.current = true;
      if (state.inputText) {
        addHistoryEntry(
          { inputText: state.inputText },
          paramsForHistory,
          "left",
          state.inputText.slice(0, 120),
        );
      } else {
        updateHistoryParams(paramsForHistory);
      }
    }
  }, [
    addHistoryEntry,
    hasUrlParams,
    paramsForHistory,
    state.inputText,
    updateHistoryParams,
  ]);

  React.useEffect(() => {
    updateHistoryParams(paramsForHistory);
  }, [paramsForHistory, updateHistoryParams]);

  return (
    <div className="space-y-4 py-4 sm:py-6">
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Generator</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid gap-3 sm:grid-cols-3">
            <div className="space-y-2">
              <Label>Count</Label>
              <Input
                type="number"
                min={1}
                max={1000}
                value={state.count}
                onChange={(event) =>
                  setParam("count", Number(event.target.value) || 1, true)
                }
              />
            </div>
            <div className="space-y-2">
              <Label>Length</Label>
              <Input
                type="number"
                min={defaults.minLength}
                max={defaults.maxLength}
                value={state.length}
                onChange={(event) =>
                  setParam(
                    "length",
                    Number(event.target.value) || defaults.defaultLength,
                    true,
                  )
                }
              />
            </div>
            <div className="space-y-2">
              <Label>Fingerprint (optional)</Label>
              <Input
                value={state.fingerprint}
                onChange={(event) =>
                  setParam("fingerprint", event.target.value)
                }
                placeholder="service-node-a"
              />
            </div>
          </div>
          <Button type="button" onClick={onGenerate}>
            Generate CUID2 IDs
          </Button>
          {error ? <p className="text-xs text-destructive">{error}</p> : null}
          <Textarea
            value={generatedText}
            readOnly
            placeholder="Generated IDs will appear here"
            className="min-h-[120px] font-mono text-xs"
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Validator</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <Textarea
            value={state.inputText}
            onChange={(event) => setParam("inputText", event.target.value)}
            placeholder="Paste one CUID2 per line"
            className="min-h-[120px] font-mono text-xs"
          />
          {oversizeKeys.includes("inputText") ? (
            <p className="text-xs text-muted-foreground">
              Input exceeds 2 KB and is not synced to the URL.
            </p>
          ) : null}
          <p className="text-xs text-muted-foreground">
            Parsed: {parsedCount} | Valid: {validCount} | Invalid:{" "}
            {parsedCount - validCount}
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
