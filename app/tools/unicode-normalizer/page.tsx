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
  detectConfusableCharacters,
  getNormalizationDiff,
  listCodePoints,
  normalizeUnicode,
  type UnicodeNormalizationForm,
} from "@/lib/encoding/unicode-normalizer";

const paramsSchema = z.object({
  normalizationForm: z.enum(["NFC", "NFD", "NFKC", "NFKD"]).default("NFC"),
  stripCombiningMarks: z.boolean().default(false),
  inputText: z.string().default("Cafe\u0301 and p\u0430ypal"),
});

export default function UnicodeNormalizerPage() {
  return (
    <Suspense fallback={null}>
      <UnicodeNormalizerContent />
    </Suspense>
  );
}

function UnicodeNormalizerContent() {
  const { state, setParam, oversizeKeys, hasUrlParams, hydrationSource } =
    useUrlSyncedState("unicode-normalizer", {
      schema: paramsSchema,
      defaults: paramsSchema.parse({}),
    });

  const normalizedText = React.useMemo(
    () =>
      normalizeUnicode(
        state.inputText,
        state.normalizationForm,
        state.stripCombiningMarks,
      ),
    [state.inputText, state.normalizationForm, state.stripCombiningMarks],
  );
  const diff = React.useMemo(
    () => getNormalizationDiff(state.inputText, normalizedText),
    [normalizedText, state.inputText],
  );
  const codePoints = React.useMemo(
    () => listCodePoints(normalizedText),
    [normalizedText],
  );
  const confusables = React.useMemo(
    () => detectConfusableCharacters(state.inputText),
    [state.inputText],
  );

  const handleLoadHistory = React.useCallback(
    (entry: HistoryEntry) => {
      const { inputs, params } = entry;
      if (inputs.inputText !== undefined)
        setParam("inputText", inputs.inputText);
      if (params.normalizationForm)
        setParam(
          "normalizationForm",
          params.normalizationForm as UnicodeNormalizationForm,
        );
      if (params.stripCombiningMarks !== undefined)
        setParam("stripCombiningMarks", params.stripCombiningMarks as boolean);
    },
    [setParam],
  );

  const handleCopyOutput = React.useCallback(async () => {
    try {
      await navigator.clipboard.writeText(normalizedText);
    } catch (error) {
      console.error(error);
    }
  }, [normalizedText]);

  return (
    <ToolPageWrapper
      toolId="unicode-normalizer"
      title="Unicode Normalizer"
      description="Normalize Unicode text, inspect code points, and detect visually confusable characters."
      onLoadHistory={handleLoadHistory}
    >
      <UnicodeNormalizerInner
        state={state}
        setParam={setParam}
        oversizeKeys={oversizeKeys}
        hasUrlParams={hasUrlParams}
        hydrationSource={hydrationSource}
        normalizedText={normalizedText}
        diff={diff}
        codePoints={codePoints}
        confusables={confusables}
        onCopyOutput={handleCopyOutput}
      />
    </ToolPageWrapper>
  );
}

function UnicodeNormalizerInner({
  state,
  setParam,
  oversizeKeys,
  hasUrlParams,
  hydrationSource,
  normalizedText,
  diff,
  codePoints,
  confusables,
  onCopyOutput,
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
  normalizedText: string;
  diff: ReturnType<typeof getNormalizationDiff>;
  codePoints: ReturnType<typeof listCodePoints>;
  confusables: ReturnType<typeof detectConfusableCharacters>;
  onCopyOutput: () => Promise<void>;
}) {
  const { addHistoryEntry, updateHistoryParams } = useToolHistoryContext();
  const lastInputRef = React.useRef("");
  const hasHydratedInputRef = React.useRef(false);
  const hasHandledUrlRef = React.useRef(false);

  const paramsForHistory = React.useMemo(
    () => ({
      normalizationForm: state.normalizationForm,
      stripCombiningMarks: state.stripCombiningMarks,
    }),
    [state.normalizationForm, state.stripCombiningMarks],
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
          <CardTitle className="text-base">Input and Normalization</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>Normalization Form</Label>
              <Select
                value={state.normalizationForm}
                onValueChange={(value) =>
                  setParam(
                    "normalizationForm",
                    value as UnicodeNormalizationForm,
                    true,
                  )
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="NFC">NFC</SelectItem>
                  <SelectItem value="NFD">NFD</SelectItem>
                  <SelectItem value="NFKC">NFKC</SelectItem>
                  <SelectItem value="NFKD">NFKD</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Strip Combining Marks</Label>
              <Button
                type="button"
                variant={state.stripCombiningMarks ? "default" : "outline"}
                onClick={() =>
                  setParam(
                    "stripCombiningMarks",
                    !state.stripCombiningMarks,
                    true,
                  )
                }
                className="w-full"
              >
                {state.stripCombiningMarks ? "Enabled" : "Disabled"}
              </Button>
            </div>
          </div>
          <Textarea
            value={state.inputText}
            onChange={(event) => setParam("inputText", event.target.value)}
            className="min-h-[140px] font-mono text-xs"
          />
          {oversizeKeys.includes("inputText") ? (
            <p className="text-xs text-muted-foreground">
              Input exceeds 2 KB and is not synced to the URL.
            </p>
          ) : null}
          <Textarea
            readOnly
            value={normalizedText}
            className="min-h-[120px] font-mono text-xs"
          />
          <div className="flex flex-wrap items-center gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => void onCopyOutput()}
            >
              Copy Output
            </Button>
            <p className="text-xs text-muted-foreground">
              Changed: {diff.changed ? "yes" : "no"}
              {diff.changed ? ` (first diff index ${diff.firstDiffIndex})` : ""}
            </p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Confusable Characters</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {confusables.length === 0 ? (
            <p className="text-xs text-muted-foreground">
              No confusables from the built-in detection set were found.
            </p>
          ) : (
            confusables.map((item) => (
              <p
                key={`${item.index}-${item.codePoint}`}
                className="font-mono text-xs"
              >
                index {item.index}: {item.char} ({item.codePoint}){" -> "}
                {item.suggestedAscii} [{item.script}]
              </p>
            ))
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Code Points</CardTitle>
        </CardHeader>
        <CardContent className="max-h-64 space-y-1 overflow-auto font-mono text-xs">
          {codePoints.map((point, index) => (
            <p key={`${point.codePoint}-${index}`}>
              {index}: {point.char} {point.codePoint} ({point.decimal})
            </p>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
