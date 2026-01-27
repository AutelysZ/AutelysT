"use client";

import * as React from "react";
import { Suspense } from "react";
import { z } from "zod";
import {
  ToolPageWrapper,
  useToolHistoryContext,
} from "@/components/tool-ui/tool-page-wrapper";
import { useUrlSyncedState } from "@/lib/url-state/use-url-synced-state";
import { useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Slider } from "@/components/ui/slider";
import { Check, Copy, RefreshCw } from "lucide-react";
import {
  DEFAULT_SYMBOLS,
  generatePassword,
  type PasswordGeneratorOptions,
  type CaseMode,
} from "@/lib/crypto/password-generator";

const paramsSchema = z.object({
  caseMode: z.enum(["lower", "upper"]).default("lower"),
  symbols: z.string().default(DEFAULT_SYMBOLS),
  includeSymbols: z.boolean().default(true),
  includeUpper: z.boolean().default(true),
  includeLower: z.boolean().default(true),
  includeNumbers: z.boolean().default(true),
  lengthValue: z.coerce.number().int().min(1).max(4096).default(32),
});

export default function PasswordGeneratorPage() {
  return (
    <Suspense fallback={null}>
      <PasswordGeneratorContent />
    </Suspense>
  );
}

function PasswordGeneratorContent() {
  const searchParams = useSearchParams();
  const searchParamString = searchParams.toString();
  const { state, setParam, setStateSilently, hasUrlParams, oversizeKeys } =
    useUrlSyncedState("password-generator", {
      schema: paramsSchema,
      defaults: paramsSchema.parse({}),
      restoreFromHistory: false,
      initialSearch: searchParamString,
    });

  const [label, setLabel] = React.useState("");
  const [result, setResult] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);
  const paramsForHistory = React.useMemo(
    () => ({
      caseMode: state.caseMode,
      symbols: state.symbols,
      includeSymbols: state.includeSymbols,
      includeUpper: state.includeUpper,
      includeLower: state.includeLower,
      includeNumbers: state.includeNumbers,
      lengthValue: state.lengthValue,
    }),
    [
      state.caseMode,
      state.symbols,
      state.includeSymbols,
      state.includeUpper,
      state.includeLower,
      state.includeNumbers,
      state.lengthValue,
    ],
  );

  const generationOptions = React.useMemo<PasswordGeneratorOptions>(
    () => ({
      serialization: "graphic-ascii",
      base64NoPadding: false,
      base64UrlSafe: false,
      base32NoPadding: false,
      caseMode: state.caseMode as CaseMode,
      symbols: state.symbols,
      includeSymbols: state.includeSymbols,
      includeUpper: state.includeUpper,
      includeLower: state.includeLower,
      includeNumbers: state.includeNumbers,
      lengthType: "chars",
      length: state.lengthValue,
    }),
    [
      state.caseMode,
      state.symbols,
      state.includeSymbols,
      state.includeUpper,
      state.includeLower,
      state.includeNumbers,
      state.lengthValue,
    ],
  );

  const generate = React.useCallback(() => {
    const { value, error: generationError } =
      generatePassword(generationOptions);
    setResult(value);
    setError(generationError ?? null);
  }, [generationOptions]);

  React.useEffect(() => {
    if (typeof window === "undefined") return;
    generate();
  }, [generate]);

  return (
    <ToolPageWrapper
      toolId="password-generator"
      title="Password Generator"
      description="Generate secure passwords with customizable character sets and length"
      onLoadHistory={() => {}}
      historyVariant="password-generator"
    >
      <PasswordGeneratorInner
        state={state}
        setParam={setParam}
        setStateSilently={setStateSilently}
        oversizeKeys={oversizeKeys}
        label={label}
        setLabel={setLabel}
        result={result}
        error={error}
        onRegenerate={generate}
        hasUrlParams={hasUrlParams}
        paramsForHistory={paramsForHistory}
      />
    </ToolPageWrapper>
  );
}

function PasswordGeneratorInner({
  state,
  setParam,
  setStateSilently,
  oversizeKeys,
  label,
  setLabel,
  result,
  error,
  onRegenerate,
  hasUrlParams,
  paramsForHistory,
}: {
  state: z.infer<typeof paramsSchema>;
  setParam: <K extends keyof z.infer<typeof paramsSchema>>(
    key: K,
    value: z.infer<typeof paramsSchema>[K],
    immediate?: boolean,
  ) => void;
  setStateSilently: (
    updater:
      | z.infer<typeof paramsSchema>
      | ((prev: z.infer<typeof paramsSchema>) => z.infer<typeof paramsSchema>),
  ) => void;
  oversizeKeys: (keyof z.infer<typeof paramsSchema>)[];
  label: string;
  setLabel: (value: string) => void;
  result: string;
  error: string | null;
  onRegenerate: () => void;
  hasUrlParams: boolean;
  paramsForHistory: Record<string, unknown>;
}) {
  const { entries, loading, upsertInputEntry, upsertParams } =
    useToolHistoryContext();
  const [copied, setCopied] = React.useState(false);
  const historyInitializedRef = React.useRef(false);
  const symbolsWarning = oversizeKeys.includes("symbols")
    ? "Input exceeds 2 KB and is not synced to the URL."
    : null;

  const handleCopy = async () => {
    if (!result || error) return;
    await navigator.clipboard.writeText(result);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);

    const preview = label ? `${label}: ${result}` : result;
    await upsertInputEntry(
      { label, password: result },
      paramsForHistory,
      "left",
      preview.slice(0, 100),
    );
    await upsertParams(paramsForHistory, "deferred");
  };

  React.useEffect(() => {
    if (loading || historyInitializedRef.current) return;

    if (entries.length === 0) {
      upsertParams(paramsForHistory, "deferred");
      historyInitializedRef.current = true;
      return;
    }

    if (hasUrlParams) {
      upsertParams(paramsForHistory, "deferred");
      historyInitializedRef.current = true;
      return;
    }

    const defaults = paramsSchema.parse({});
    const latest = entries[0];
    const merged = { ...defaults, ...latest.params };
    const parsed = paramsSchema.safeParse(merged);
    if (parsed.success) {
      setStateSilently(parsed.data);
      if (latest.hasInput !== false) {
        upsertParams(parsed.data, "deferred");
      }
    }

    historyInitializedRef.current = true;
  }, [
    entries,
    hasUrlParams,
    loading,
    paramsForHistory,
    setStateSilently,
    upsertParams,
  ]);

  React.useEffect(() => {
    if (!historyInitializedRef.current) return;
    upsertParams(paramsForHistory, "deferred");
  }, [paramsForHistory, upsertParams]);

  return (
    <div className="flex w-full flex-col gap-4 py-4 sm:gap-6 sm:py-6">
      <div className="grid gap-4 sm:gap-6 lg:grid-cols-2">
        <section className="flex flex-col gap-4 sm:gap-6">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-base font-semibold">Password Settings</h2>
          </div>
          <div className="space-y-4 sm:space-y-6">
            <div className="space-y-3">
              <div className="flex items-start gap-3">
                <Label className="w-28 shrink-0 text-sm">Character Set</Label>
                <div className="flex flex-wrap items-center gap-3">
                  <label className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Checkbox
                      id="includeUpper"
                      checked={state.includeUpper}
                      onCheckedChange={(checked) =>
                        setParam("includeUpper", checked === true, true)
                      }
                    />
                    <span>Upper letters</span>
                  </label>
                  <label className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Checkbox
                      id="includeLower"
                      checked={state.includeLower}
                      onCheckedChange={(checked) =>
                        setParam("includeLower", checked === true, true)
                      }
                    />
                    <span>Lower letters</span>
                  </label>
                  <label className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Checkbox
                      id="includeNumbers"
                      checked={state.includeNumbers}
                      onCheckedChange={(checked) =>
                        setParam("includeNumbers", checked === true, true)
                      }
                    />
                    <span>Numbers</span>
                  </label>
                  <label className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Checkbox
                      id="includeSymbols"
                      checked={state.includeSymbols}
                      onCheckedChange={(checked) =>
                        setParam("includeSymbols", checked === true, true)
                      }
                    />
                    <span>Symbols</span>
                  </label>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <div className="w-28 shrink-0" />
                <div className="relative flex min-w-0 flex-1 items-center">
                  <Input
                    id="symbols"
                    value={state.symbols}
                    onChange={(e) => setParam("symbols", e.target.value)}
                    disabled={!state.includeSymbols}
                    className="h-9 w-full min-w-0 pr-16 font-mono"
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => setParam("symbols", DEFAULT_SYMBOLS, true)}
                    disabled={!state.includeSymbols}
                    className="absolute right-1 top-1/2 h-7 -translate-y-1/2 px-2 text-xs"
                  >
                    Reset
                  </Button>
                </div>
              </div>
              {symbolsWarning && (
                <p className="text-xs text-muted-foreground">
                  {symbolsWarning}
                </p>
              )}
            </div>

            <div className="flex items-center gap-3">
              <Label className="w-28 shrink-0 text-sm">
                Length ({state.lengthValue})
              </Label>
              <div className="flex flex-1 items-center gap-4">
                <Slider
                  min={1}
                  max={2048}
                  step={1}
                  value={[Math.min(state.lengthValue, 2048)]}
                  onValueChange={(val) => setParam("lengthValue", val[0])}
                  className="flex-1"
                />
                <Input
                  type="number"
                  min={1}
                  max={4096}
                  value={state.lengthValue}
                  onChange={(e) => {
                    const nextValue = Math.max(
                      1,
                      Math.min(4096, Number(e.target.value) || 1),
                    );
                    setParam("lengthValue", nextValue, true);
                  }}
                  className="h-9 w-20"
                />
              </div>
            </div>
          </div>
        </section>

        <section className="flex flex-col gap-4 sm:gap-6">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-base font-semibold">Generated Password</h2>
            <Button
              variant="ghost"
              size="icon"
              onClick={onRegenerate}
              aria-label="Regenerate password"
            >
              <RefreshCw className="h-4 w-4" />
            </Button>
          </div>
          <div className="rounded-md border px-3 py-3">
            <div className="min-h-[96px] max-h-36 overflow-y-auto font-mono text-lg font-semibold tracking-tight break-all">
              {result || "-"}
            </div>
          </div>
          <div className="flex flex-col gap-3">
            <div className="space-y-2">
              <Label htmlFor="label" className="text-sm font-medium">
                Label
              </Label>
              <Input
                id="label"
                value={label}
                onChange={(e) => setLabel(e.target.value)}
                placeholder="Optional label for history"
                className="h-9 w-full"
              />
            </div>
            <Button onClick={handleCopy} disabled={!result || !!error}>
              {copied ? (
                <>
                  <Check className="h-4 w-4" />
                  Saved and Copied
                </>
              ) : (
                <>
                  <Copy className="h-4 w-4" />
                  Save and Copy
                </>
              )}
            </Button>
            {error && <p className="text-xs text-destructive">{error}</p>}
          </div>
        </section>
      </div>
    </div>
  );
}
