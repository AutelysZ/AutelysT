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
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Copy, Check, Download } from "lucide-react";
import {
  generateNanoIDs,
  DEFAULT_NANOID_ALPHABET,
} from "@/lib/identifier/nanoid";
import type { HistoryEntry } from "@/lib/history/db";
import { cn } from "@/lib/utils";

const paramsSchema = z.object({
  count: z.coerce.number().int().min(1).max(1000).default(1),
  length: z.coerce.number().int().min(1).max(256).default(21),
  alphabetPreset: z
    .enum([
      "default",
      "alphanumeric",
      "lowercase",
      "uppercase",
      "hexLower",
      "hexUpper",
      "custom",
    ])
    .default("default"),
  alphabet: z.string().default(DEFAULT_NANOID_ALPHABET),
  content: z.string().default(""),
});

const ALPHABET_PRESETS = [
  {
    value: "default",
    label: "Default (URL-safe)",
    alphabet: DEFAULT_NANOID_ALPHABET,
  },
  {
    value: "alphanumeric",
    label: "Alphanumeric",
    alphabet: "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789",
  },
  {
    value: "lowercase",
    label: "Lowercase + digits",
    alphabet: "abcdefghijklmnopqrstuvwxyz0123456789",
  },
  {
    value: "uppercase",
    label: "Uppercase + digits",
    alphabet: "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789",
  },
  {
    value: "hexLower",
    label: "Hex (lower)",
    alphabet: "0123456789abcdef",
  },
  {
    value: "hexUpper",
    label: "Hex (upper)",
    alphabet: "0123456789ABCDEF",
  },
  { value: "custom", label: "Custom", alphabet: "" },
] as const;

const presetAlphabetMap = ALPHABET_PRESETS.reduce<Record<string, string>>(
  (acc, preset) => {
    acc[preset.value] = preset.alphabet;
    return acc;
  },
  {},
);

export default function NanoIdPage() {
  return (
    <Suspense fallback={null}>
      <NanoIdContent />
    </Suspense>
  );
}

function NanoIdContent() {
  const { state, setParam, oversizeKeys, hasUrlParams, hydrationSource } =
    useUrlSyncedState("nanoid", {
      schema: paramsSchema,
      defaults: paramsSchema.parse({}),
    });

  React.useEffect(() => {
    if (state.alphabetPreset === "custom") return;
    const presetAlphabet = presetAlphabetMap[state.alphabetPreset];
    if (presetAlphabet && state.alphabet !== presetAlphabet) {
      setParam("alphabet", presetAlphabet, true);
    }
  }, [state.alphabetPreset, state.alphabet, setParam]);

  const handleLoadHistory = React.useCallback(
    (entry: HistoryEntry) => {
      const { inputs, params } = entry;
      if (inputs.content !== undefined) setParam("content", inputs.content);
      if (params.count) setParam("count", params.count as number);
      if (params.length) setParam("length", params.length as number);
      if (params.alphabetPreset)
        setParam(
          "alphabetPreset",
          params.alphabetPreset as z.infer<
            typeof paramsSchema
          >["alphabetPreset"],
        );
      if (params.alphabet) setParam("alphabet", params.alphabet as string);
    },
    [setParam],
  );

  return (
    <ToolPageWrapper
      toolId="nanoid"
      title="NanoID"
      description="Generate NanoIDs with custom alphabets and length settings"
      onLoadHistory={handleLoadHistory}
    >
      <NanoIdInner
        state={state}
        setParam={setParam}
        oversizeKeys={oversizeKeys}
        hasUrlParams={hasUrlParams}
        hydrationSource={hydrationSource}
      />
    </ToolPageWrapper>
  );
}

function NanoIdInner({
  state,
  setParam,
  oversizeKeys,
  hasUrlParams,
  hydrationSource,
}: {
  state: z.infer<typeof paramsSchema>;
  setParam: <K extends keyof z.infer<typeof paramsSchema>>(
    key: K,
    value: z.infer<typeof paramsSchema>[K],
    updateHistory?: boolean,
  ) => void;
  oversizeKeys: (keyof z.infer<typeof paramsSchema>)[];
  hasUrlParams: boolean;
  hydrationSource: "default" | "url" | "history";
}) {
  const { upsertInputEntry, upsertParams } = useToolHistoryContext();
  const [copied, setCopied] = React.useState(false);
  const [generationError, setGenerationError] = React.useState<string | null>(
    null,
  );
  const lastSavedRef = React.useRef<string>("");
  const hasHydratedInputRef = React.useRef(false);
  const paramsRef = React.useRef({
    count: state.count,
    length: state.length,
    alphabetPreset: state.alphabetPreset,
    alphabet: state.alphabet,
  });
  const hasInitializedParamsRef = React.useRef(false);
  const hasHandledUrlRef = React.useRef(false);

  const alphabetInfo = React.useMemo(() => {
    const characters = Array.from(state.alphabet);
    const uniqueCharacters = Array.from(new Set(characters));
    const uniqueCount = uniqueCharacters.length;
    const duplicateCount = characters.length - uniqueCount;
    const entropyPerChar = uniqueCount > 1 ? Math.log2(uniqueCount) : 0;
    const entropyBits = entropyPerChar * state.length;
    const hasWhitespace = characters.some((char) => /\s/.test(char));

    return {
      length: characters.length,
      uniqueCount,
      duplicateCount,
      entropyBits,
      hasWhitespace,
    };
  }, [state.alphabet, state.length]);

  const validation = React.useMemo(() => {
    const trimmed = state.content.trim();
    if (!trimmed) {
      return { total: 0, valid: 0, invalid: 0 };
    }
    const lines = trimmed
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean);
    const alphabetSet = new Set(Array.from(state.alphabet));
    let invalid = 0;

    for (const line of lines) {
      if (line.length !== state.length) {
        invalid += 1;
        continue;
      }
      for (const char of line) {
        if (!alphabetSet.has(char)) {
          invalid += 1;
          break;
        }
      }
    }

    return { total: lines.length, valid: lines.length - invalid, invalid };
  }, [state.content, state.length, state.alphabet]);

  React.useEffect(() => {
    if (!generationError) return;
    setGenerationError(null);
  }, [state.count, state.length, state.alphabet, state.alphabetPreset]);

  React.useEffect(() => {
    if (hasHydratedInputRef.current) return;
    if (hydrationSource === "default") return;
    lastSavedRef.current = state.content;
    hasHydratedInputRef.current = true;
  }, [hydrationSource, state.content]);

  React.useEffect(() => {
    if (state.content === lastSavedRef.current) return;

    const timer = setTimeout(() => {
      lastSavedRef.current = state.content;
      upsertInputEntry(
        { content: state.content },
        {
          count: state.count,
          length: state.length,
          alphabetPreset: state.alphabetPreset,
          alphabet: state.alphabet,
        },
        "left",
        state.content ? state.content.slice(0, 100) : `x${state.count}`,
      );
    }, DEFAULT_URL_SYNC_DEBOUNCE_MS);

    return () => clearTimeout(timer);
  }, [
    state.content,
    state.count,
    state.length,
    state.alphabetPreset,
    state.alphabet,
    upsertInputEntry,
  ]);

  React.useEffect(() => {
    if (hasUrlParams && !hasHandledUrlRef.current) {
      hasHandledUrlRef.current = true;
      if (state.content) {
        upsertInputEntry(
          { content: state.content },
          {
            count: state.count,
            length: state.length,
            alphabetPreset: state.alphabetPreset,
            alphabet: state.alphabet,
          },
          "left",
          state.content.slice(0, 100),
        );
      } else {
        upsertParams(
          {
            count: state.count,
            length: state.length,
            alphabetPreset: state.alphabetPreset,
            alphabet: state.alphabet,
          },
          "interpretation",
        );
      }
    }
  }, [
    hasUrlParams,
    state.content,
    state.count,
    state.length,
    state.alphabetPreset,
    state.alphabet,
    upsertInputEntry,
    upsertParams,
  ]);

  React.useEffect(() => {
    const nextParams = {
      count: state.count,
      length: state.length,
      alphabetPreset: state.alphabetPreset,
      alphabet: state.alphabet,
    };
    if (!hasInitializedParamsRef.current) {
      hasInitializedParamsRef.current = true;
      paramsRef.current = nextParams;
      return;
    }
    if (
      paramsRef.current.count === nextParams.count &&
      paramsRef.current.length === nextParams.length &&
      paramsRef.current.alphabetPreset === nextParams.alphabetPreset &&
      paramsRef.current.alphabet === nextParams.alphabet
    ) {
      return;
    }
    paramsRef.current = nextParams;
    upsertParams(nextParams, "interpretation");
  }, [
    state.count,
    state.length,
    state.alphabetPreset,
    state.alphabet,
    upsertParams,
  ]);

  const handleGenerate = React.useCallback(() => {
    const { ids, error } = generateNanoIDs({
      count: state.count,
      length: state.length,
      alphabet: state.alphabet,
    });

    if (error) {
      setGenerationError(error);
      return;
    }

    const content = ids.join("\n");
    setParam("content", content);
    setGenerationError(null);

    lastSavedRef.current = content;
    upsertInputEntry(
      { content },
      {
        count: state.count,
        length: state.length,
        alphabetPreset: state.alphabetPreset,
        alphabet: state.alphabet,
      },
      "left",
      content.slice(0, 100),
    );
  }, [
    state.count,
    state.length,
    state.alphabet,
    state.alphabetPreset,
    setParam,
    upsertInputEntry,
  ]);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(state.content);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error("Copy failed", err);
    }
  };

  const handleDownload = () => {
    const blob = new Blob([state.content], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `nanoid-${state.length}-${state.count}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleContentChange = React.useCallback(
    (value: string) => {
      setParam("content", value);
    },
    [setParam],
  );

  const handleCountChange = React.useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      let value = Number.parseInt(e.target.value) || 1;
      value = Math.max(1, Math.min(1000, value));
      setParam("count", value, true);
    },
    [setParam],
  );

  const handleLengthChange = React.useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      let value = Number.parseInt(e.target.value) || 1;
      value = Math.max(1, Math.min(256, value));
      setParam("length", value, true);
    },
    [setParam],
  );

  const handleAlphabetChange = React.useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      if (state.alphabetPreset !== "custom") {
        setParam("alphabetPreset", "custom", true);
      }
      setParam("alphabet", e.target.value, true);
    },
    [setParam, state.alphabetPreset],
  );

  const alphabetError =
    alphabetInfo.uniqueCount < 2
      ? "Alphabet must contain at least 2 unique characters."
      : null;

  return (
    <div className="flex flex-col gap-4">
      <Card>
        <CardContent className="flex flex-wrap items-center gap-4 p-4">
          <div className="flex items-center gap-2">
            <Label htmlFor="length" className="text-sm whitespace-nowrap">
              Length
            </Label>
            <Input
              id="length"
              type="number"
              min={1}
              max={256}
              value={state.length}
              onChange={handleLengthChange}
              className="w-28"
            />
          </div>

          <div className="flex items-center gap-2">
            <Label htmlFor="count" className="text-sm whitespace-nowrap">
              Count
            </Label>
            <Input
              id="count"
              type="number"
              min={1}
              max={1000}
              value={state.count}
              onChange={handleCountChange}
              className="w-28"
            />
          </div>

          <div className="flex items-center gap-2">
            <Label
              htmlFor="alphabetPreset"
              className="text-sm whitespace-nowrap"
            >
              Alphabet
            </Label>
            <Select
              value={state.alphabetPreset}
              onValueChange={(value) =>
                setParam(
                  "alphabetPreset",
                  value as z.infer<typeof paramsSchema>["alphabetPreset"],
                  true,
                )
              }
            >
              <SelectTrigger id="alphabetPreset" className="w-60">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {ALPHABET_PRESETS.map((preset) => (
                  <SelectItem key={preset.value} value={preset.value}>
                    {preset.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex w-full flex-col gap-1 sm:max-w-[440px]">
            <Label htmlFor="alphabetInput" className="text-sm">
              Alphabet Characters
            </Label>
            <Input
              id="alphabetInput"
              value={state.alphabet}
              onChange={handleAlphabetChange}
              className="font-mono"
            />
            {alphabetError && (
              <p className="text-xs text-destructive">{alphabetError}</p>
            )}
            {alphabetInfo.hasWhitespace && !alphabetError && (
              <p className="text-xs text-muted-foreground">
                Alphabet contains whitespace characters.
              </p>
            )}
          </div>

          <Button onClick={handleGenerate} disabled={Boolean(alphabetError)}>
            Generate
          </Button>

          {generationError && (
            <p className="w-full text-xs text-destructive">{generationError}</p>
          )}
        </CardContent>
      </Card>

      <div className="flex min-h-0 flex-1 flex-col gap-4 md:flex-row">
        <div className="flex w-full flex-1 flex-col gap-2 md:w-0">
          <div className="flex items-center justify-between">
            <Label className="text-sm font-medium">NanoIDs</Label>
            <div className="flex items-center gap-1">
              <Button
                variant="ghost"
                size="sm"
                onClick={handleDownload}
                disabled={!state.content}
                className="h-7 gap-1 px-2 text-xs"
              >
                <Download className="h-3 w-3" />
                Download
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={handleCopy}
                disabled={!state.content}
                className="h-7 gap-1 px-2 text-xs"
              >
                {copied ? (
                  <>
                    <Check className="h-3 w-3" />
                    Copied
                  </>
                ) : (
                  <>
                    <Copy className="h-3 w-3" />
                    Copy
                  </>
                )}
              </Button>
            </div>
          </div>

          <Textarea
            value={state.content}
            onChange={(e) => handleContentChange(e.target.value)}
            placeholder="Generated NanoIDs will appear here..."
            className={cn(
              "min-h-[300px] max-h-[400px] resize-none overflow-auto overflow-x-hidden break-words whitespace-pre-wrap font-mono text-sm",
              generationError && "border-destructive",
            )}
          />

          {oversizeKeys.includes("content") && (
            <p className="text-xs text-muted-foreground">
              Input exceeds 2 KB and is not synced to the URL.
            </p>
          )}
        </div>

        <div className="flex w-full flex-1 flex-col gap-2 md:w-0">
          <Label className="text-sm font-medium">Alphabet & Validation</Label>
          <Card>
            <CardContent className="flex flex-col gap-3 p-4 text-sm">
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Alphabet length</span>
                <span className="font-mono">{alphabetInfo.length}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Unique characters</span>
                <span className="font-mono">{alphabetInfo.uniqueCount}</span>
              </div>
              {alphabetInfo.duplicateCount > 0 && (
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Duplicates</span>
                  <span className="font-mono">
                    {alphabetInfo.duplicateCount}
                  </span>
                </div>
              )}
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Entropy (bits)</span>
                <span className="font-mono">
                  {alphabetInfo.entropyBits.toFixed(2)}
                </span>
              </div>
              {validation.total > 0 && (
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Valid IDs</span>
                  <span className="font-mono">
                    {validation.valid}/{validation.total}
                  </span>
                </div>
              )}
              {validation.invalid > 0 && (
                <p className="text-xs text-destructive">
                  {validation.invalid} ID
                  {validation.invalid === 1 ? " is" : "s are"} invalid for the
                  current length or alphabet.
                </p>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
