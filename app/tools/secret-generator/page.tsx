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
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Slider } from "@/components/ui/slider";
import { Check, Copy, RefreshCw } from "lucide-react";
import {
  generatePassword,
  type PasswordGeneratorOptions,
  type PasswordSerialization,
  type CaseMode,
} from "@/lib/crypto/password-generator";

const paramsSchema = z.object({
  serialization: z
    .enum(["hex", "base64", "base58", "base45", "base32"])
    .default("hex"),
  base64NoPadding: z.boolean().default(false),
  base64UrlSafe: z.boolean().default(false),
  base32NoPadding: z.boolean().default(false),
  caseMode: z.enum(["lower", "upper"]).default("lower"),
  lengthPreset: z.enum(["32", "16", "64", "custom"]).default("32"),
  lengthValue: z.coerce.number().int().min(1).max(4096).default(32),
});

const lengthPresets = [
  { value: "16", label: "16 (128-bit)" },
  { value: "32", label: "32 (256-bit)" },
  { value: "64", label: "64 (512-bit)" },
  { value: "custom", label: "Custom" },
];

const serializationOptions = [
  { value: "hex", label: "Hex" },
  { value: "base64", label: "Base64" },
  { value: "base58", label: "Base58" },
  { value: "base45", label: "Base45" },
  { value: "base32", label: "Base32" },
];

function ScrollableTabsList({ children }: { children: React.ReactNode }) {
  return (
    <div className="w-full min-w-0">
      <TabsList className="inline-flex h-auto max-w-full flex-wrap items-center justify-start gap-1 [&_[data-slot=tabs-trigger]]:flex-none [&_[data-slot=tabs-trigger]]:!text-sm [&_[data-slot=tabs-trigger][data-state=active]]:border-border">
        {children}
      </TabsList>
    </div>
  );
}

export default function SecretGeneratorPage() {
  return (
    <Suspense fallback={null}>
      <SecretGeneratorContent />
    </Suspense>
  );
}

function SecretGeneratorContent() {
  const searchParams = useSearchParams();
  const searchParamString = searchParams.toString();
  const { state, setParam, setStateSilently, hasUrlParams, oversizeKeys } =
    useUrlSyncedState("secret-generator", {
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
      serialization: state.serialization,
      base64NoPadding: state.base64NoPadding,
      base64UrlSafe: state.base64UrlSafe,
      base32NoPadding: state.base32NoPadding,
      caseMode: state.caseMode,
      lengthPreset: state.lengthPreset,
      lengthValue: state.lengthValue,
    }),
    [
      state.serialization,
      state.base64NoPadding,
      state.base64UrlSafe,
      state.base32NoPadding,
      state.caseMode,
      state.lengthPreset,
      state.lengthValue,
    ],
  );

  const generationOptions = React.useMemo<PasswordGeneratorOptions>(
    () => ({
      serialization: state.serialization as PasswordSerialization,
      base64NoPadding: state.base64NoPadding,
      base64UrlSafe: state.base64UrlSafe,
      base32NoPadding: state.base32NoPadding,
      caseMode: state.caseMode as CaseMode,
      symbols: "", // Not used
      includeSymbols: false,
      includeUpper: false,
      includeLower: false,
      includeNumbers: false,
      lengthType: "bytes",
      length: state.lengthValue,
    }),
    [
      state.serialization,
      state.base64NoPadding,
      state.base64UrlSafe,
      state.base32NoPadding,
      state.caseMode,
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

  React.useEffect(() => {
    if (state.lengthPreset === "custom") return;
    const presetValue = Number(state.lengthPreset);
    if (!Number.isNaN(presetValue) && state.lengthValue !== presetValue) {
      setParam("lengthValue", presetValue, true);
    }
  }, [state.lengthPreset, state.lengthValue, setParam]);

  return (
    <ToolPageWrapper
      toolId="secret-generator"
      title="Secret Generator"
      description="Generate cryptographic secrets in Hex, Base64, and other formats"
      onLoadHistory={() => {}}
      historyVariant="secret-generator"
    >
      <SecretGeneratorInner
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

function SecretGeneratorInner({
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
            <h2 className="text-base font-semibold">Secret Settings</h2>
          </div>
          <div className="space-y-4 sm:space-y-6">
            <div className="flex items-start gap-3">
              <Label className="w-28 shrink-0 text-sm">Format</Label>
              <Tabs
                value={state.serialization}
                onValueChange={(value) =>
                  setParam(
                    "serialization",
                    value as z.infer<typeof paramsSchema>["serialization"],
                    true,
                  )
                }
                className="min-w-0 flex-1"
              >
                <ScrollableTabsList>
                  {serializationOptions.map((item) => (
                    <TabsTrigger
                      key={item.value}
                      value={item.value}
                      className="text-xs flex-none"
                    >
                      {item.label}
                    </TabsTrigger>
                  ))}
                </ScrollableTabsList>
              </Tabs>
            </div>

            {state.serialization === "base64" && (
              <div className="flex items-start gap-3">
                <Label className="w-28 shrink-0 text-sm">Base64</Label>
                <div className="flex flex-wrap items-center gap-4">
                  <label className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Checkbox
                      id="base64NoPadding"
                      checked={state.base64NoPadding}
                      onCheckedChange={(checked) =>
                        setParam("base64NoPadding", checked === true, true)
                      }
                    />
                    <span>No Padding</span>
                  </label>
                  <label className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Checkbox
                      id="base64UrlSafe"
                      checked={state.base64UrlSafe}
                      onCheckedChange={(checked) =>
                        setParam("base64UrlSafe", checked === true, true)
                      }
                    />
                    <span>URL Safe</span>
                  </label>
                </div>
              </div>
            )}

            {["hex", "base45", "base32"].includes(state.serialization) && (
              <div className="flex items-start gap-3">
                <Label className="w-28 shrink-0 text-sm">Case</Label>
                <div className="flex flex-wrap items-center gap-4">
                  <Tabs
                    value={state.caseMode}
                    onValueChange={(value) =>
                      setParam(
                        "caseMode",
                        value as z.infer<typeof paramsSchema>["caseMode"],
                        true,
                      )
                    }
                  >
                    <ScrollableTabsList>
                      <TabsTrigger value="lower" className="text-xs flex-none">
                        Lower
                      </TabsTrigger>
                      <TabsTrigger value="upper" className="text-xs flex-none">
                        Upper
                      </TabsTrigger>
                    </ScrollableTabsList>
                  </Tabs>
                  {state.serialization === "base32" && (
                    <label className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Checkbox
                        id="base32NoPadding"
                        checked={state.base32NoPadding}
                        onCheckedChange={(checked) =>
                          setParam("base32NoPadding", checked === true, true)
                        }
                      />
                      <span>No Padding</span>
                    </label>
                  )}
                </div>
              </div>
            )}

            <div className="space-y-4">
              <div className="flex items-start gap-3">
                <Label className="w-28 shrink-0 text-sm">Length</Label>
                <Tabs
                  value={state.lengthPreset}
                  onValueChange={(value) => {
                    setParam(
                      "lengthPreset",
                      value as z.infer<typeof paramsSchema>["lengthPreset"],
                      true,
                    );
                    if (value !== "custom") {
                      setParam("lengthValue", Number(value), true);
                    }
                  }}
                  className="min-w-0 flex-1"
                >
                  <ScrollableTabsList>
                    {lengthPresets.map((preset) => (
                      <TabsTrigger
                        key={preset.value}
                        value={preset.value}
                        className="text-xs flex-none"
                      >
                        {preset.label}
                      </TabsTrigger>
                    ))}
                  </ScrollableTabsList>
                </Tabs>
              </div>

              {state.lengthPreset === "custom" && (
                <div className="flex items-center gap-3">
                  <Label className="w-28 shrink-0 text-sm">
                    Bytes ({state.lengthValue})
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
              )}
            </div>
          </div>
        </section>

        <section className="flex flex-col gap-4 sm:gap-6">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-base font-semibold">Generated Secret</h2>
            <Button
              variant="ghost"
              size="icon"
              onClick={onRegenerate}
              aria-label="Regenerate secret"
            >
              <RefreshCw className="h-4 w-4" />
            </Button>
          </div>
          <div className="rounded-md border px-3 py-3">
            <div className="min-h-[96px] max-h-48 overflow-y-auto font-mono text-lg font-semibold tracking-tight break-all">
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
