"use client";

import * as React from "react";
import { Suspense } from "react";
import { z } from "zod";
import { AlertCircle, Check, Copy, Download, RefreshCcw } from "lucide-react";
import {
  ToolPageWrapper,
  useToolHistoryContext,
} from "@/components/tool-ui/tool-page-wrapper";
import {
  DEFAULT_URL_SYNC_DEBOUNCE_MS,
  useUrlSyncedState,
} from "@/lib/url-state/use-url-synced-state";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Slider } from "@/components/ui/slider";
import { decodeBase64, encodeBase64 } from "@/lib/encoding/base64";
import { decodeHex, encodeHex } from "@/lib/encoding/hex";
import type { HistoryEntry } from "@/lib/history/db";
import { cn } from "@/lib/utils";

const inputEncodings = ["utf8", "base64", "hex"] as const;
const outputEncodings = ["base64", "base64url", "hex"] as const;
const paramEncodings = ["utf8", "base64", "hex"] as const;
const kdfAlgorithms = ["HKDF", "PBKDF2"] as const;
const kdfHashes = ["SHA-256", "SHA-384", "SHA-512"] as const;
const lengthPresets = ["256", "384", "512", "custom"] as const;

type InputEncoding = (typeof inputEncodings)[number];
type OutputEncoding = (typeof outputEncodings)[number];
type ParamEncoding = (typeof paramEncodings)[number];
type KdfAlgorithm = (typeof kdfAlgorithms)[number];
type KdfHash = (typeof kdfHashes)[number];
type LengthPreset = (typeof lengthPresets)[number];

const encodingLabels = {
  utf8: "UTF-8",
  base64: "Base64",
  base64url: "Base64url",
  hex: "Hex",
} as const;

const paramsSchema = z.object({
  input: z.string().default(""),
  inputEncoding: z.enum(inputEncodings).default("utf8"),
  outputEncoding: z.enum(outputEncodings).default("base64"),
  kdfAlgorithm: z.enum(kdfAlgorithms).default("HKDF"),
  kdfHash: z.enum(kdfHashes).default("SHA-256"),
  length: z.coerce.number().int().min(1).max(16320).default(32),
  salt: z.string().default(""),
  saltEncoding: z.enum(paramEncodings).default("base64"),
  info: z.string().default(""),
  infoEncoding: z.enum(paramEncodings).default("base64"),
  iterations: z.coerce.number().int().min(1).max(10000000).default(100000),
});

type KeyDerivationState = z.infer<typeof paramsSchema>;

const textEncoder = new TextEncoder();
const SALT_DEFAULT_LENGTH = 16;

function randomBytes(length: number) {
  if (!globalThis.crypto?.getRandomValues) {
    throw new Error("Secure random generation is unavailable.");
  }
  const bytes = new Uint8Array(length);
  crypto.getRandomValues(bytes);
  return bytes;
}

function randomAsciiString(length: number) {
  const alphabet =
    "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  const bytes = randomBytes(length);
  let value = "";
  for (let i = 0; i < bytes.length; i += 1) {
    value += alphabet[bytes[i] % alphabet.length];
  }
  return value;
}

function getMaxKdfLengthBytes(hash: KdfHash) {
  if (hash === "SHA-384") return 255 * 48;
  if (hash === "SHA-512") return 255 * 64;
  return 255 * 32;
}

function getLengthPreset(value: number): LengthPreset | null {
  if (value === 32) return "256";
  if (value === 48) return "384";
  if (value === 64) return "512";
  return null;
}

function encodeParamValue(bytes: Uint8Array, encoding: ParamEncoding) {
  if (encoding === "utf8") return randomAsciiString(bytes.length);
  if (encoding === "hex") return encodeHex(bytes, { upperCase: false });
  return encodeBase64(bytes, { urlSafe: false, padding: true });
}

function encodeOutputBytes(bytes: Uint8Array, encoding: OutputEncoding) {
  if (encoding === "hex") return encodeHex(bytes, { upperCase: false });
  if (encoding === "base64")
    return encodeBase64(bytes, { urlSafe: false, padding: true });
  return encodeBase64(bytes, { urlSafe: true, padding: false });
}

function decodeInputBytes(
  value: string,
  encoding: InputEncoding,
): Uint8Array<ArrayBuffer> {
  if (!value) return new Uint8Array();
  if (encoding === "utf8")
    return textEncoder.encode(value) as Uint8Array<ArrayBuffer>;
  if (encoding === "hex") return decodeHex(value);
  return decodeBase64(value);
}

function decodeParamValue(
  value: string,
  encoding: ParamEncoding,
): Uint8Array<ArrayBuffer> {
  if (!value) return new Uint8Array();
  if (encoding === "utf8")
    return textEncoder.encode(value) as Uint8Array<ArrayBuffer>;
  if (encoding === "hex") return decodeHex(value);
  return decodeBase64(value);
}

async function deriveKeyBytes(
  inputBytes: Uint8Array<ArrayBuffer>,
  state: KeyDerivationState,
) {
  if (!globalThis.crypto?.subtle) {
    throw new Error("Web Crypto is unavailable in this environment.");
  }
  const lengthBits = state.length * 8;
  const salt = decodeParamValue(state.salt, state.saltEncoding);
  if (state.kdfAlgorithm === "HKDF") {
    const info = decodeParamValue(state.info, state.infoEncoding);
    const keyMaterial = await crypto.subtle.importKey(
      "raw",
      inputBytes,
      "HKDF",
      false,
      ["deriveBits"],
    );
    const bits = await crypto.subtle.deriveBits(
      { name: "HKDF", hash: { name: state.kdfHash }, salt, info },
      keyMaterial,
      lengthBits,
    );
    return new Uint8Array(bits);
  }
  const keyMaterial = await crypto.subtle.importKey(
    "raw",
    inputBytes,
    "PBKDF2",
    false,
    ["deriveBits"],
  );
  const bits = await crypto.subtle.deriveBits(
    {
      name: "PBKDF2",
      hash: { name: state.kdfHash },
      salt,
      iterations: state.iterations,
    },
    keyMaterial,
    lengthBits,
  );
  return new Uint8Array(bits);
}

function ScrollableTabsList({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className="min-w-0 w-full overflow-x-auto">
      <TabsList className={cn("inline-flex w-max justify-start", className)}>
        {children}
      </TabsList>
    </div>
  );
}

export default function KeyDerivationPage() {
  return (
    <Suspense fallback={null}>
      <KeyDerivationContent />
    </Suspense>
  );
}

function KeyDerivationContent() {
  const {
    state,
    setParam,
    oversizeKeys,
    hasUrlParams,
    hydrationSource,
    resetToDefaults,
  } = useUrlSyncedState("key-derivation", {
    schema: paramsSchema,
    defaults: paramsSchema.parse({}),
  });

  const handleLoadHistory = React.useCallback(
    (entry: HistoryEntry) => {
      const { inputs, params } = entry;
      if (inputs.input !== undefined) setParam("input", inputs.input);
      const typedParams = params as Partial<KeyDerivationState>;
      (Object.keys(paramsSchema.shape) as (keyof KeyDerivationState)[]).forEach(
        (key) => {
          if (typedParams[key] !== undefined) {
            setParam(key, typedParams[key] as KeyDerivationState[typeof key]);
          }
        },
      );
    },
    [setParam],
  );

  return (
    <ToolPageWrapper
      toolId="key-derivation"
      title="Key Derivation"
      description="Derive keys with HKDF or PBKDF2 using configurable hash, salt, and output length."
      onLoadHistory={handleLoadHistory}
    >
      <KeyDerivationInner
        state={state}
        setParam={setParam}
        oversizeKeys={oversizeKeys}
        hasUrlParams={hasUrlParams}
        hydrationSource={hydrationSource}
        resetToDefaults={resetToDefaults}
      />
    </ToolPageWrapper>
  );
}

function KeyDerivationInner({
  state,
  setParam,
  oversizeKeys,
  hasUrlParams,
  hydrationSource,
  resetToDefaults,
}: {
  state: KeyDerivationState;
  setParam: <K extends keyof KeyDerivationState>(
    key: K,
    value: KeyDerivationState[K],
    immediate?: boolean,
  ) => void;
  oversizeKeys: (keyof KeyDerivationState)[];
  hasUrlParams: boolean;
  hydrationSource: "default" | "url" | "history";
  resetToDefaults: () => void;
}) {
  const { upsertInputEntry, upsertParams } = useToolHistoryContext();
  const [output, setOutput] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);
  const [isWorking, setIsWorking] = React.useState(false);
  const [copied, setCopied] = React.useState(false);
  const [lengthMode, setLengthMode] = React.useState<LengthPreset>(
    () => getLengthPreset(state.length) ?? "custom",
  );
  const lastInputRef = React.useRef("");
  const hasHydratedInputRef = React.useRef(false);
  const hasHandledUrlRef = React.useRef(false);
  const paramsRef = React.useRef({
    inputEncoding: state.inputEncoding,
    outputEncoding: state.outputEncoding,
    kdfAlgorithm: state.kdfAlgorithm,
    kdfHash: state.kdfHash,
    length: state.length,
    salt: state.salt,
    saltEncoding: state.saltEncoding,
    info: state.info,
    infoEncoding: state.infoEncoding,
    iterations: state.iterations,
  });
  const hasInitializedParamsRef = React.useRef(false);
  const runRef = React.useRef(0);
  const maxKdfLength = React.useMemo(
    () => getMaxKdfLengthBytes(state.kdfHash),
    [state.kdfHash],
  );

  React.useEffect(() => {
    if (state.length > maxKdfLength) {
      setParam("length", maxKdfLength, true);
    }
  }, [state.length, maxKdfLength, setParam]);

  React.useEffect(() => {
    if (lengthMode === "custom") return;
    const preset = getLengthPreset(state.length) ?? "custom";
    if (preset !== lengthMode) {
      setLengthMode(preset);
    }
  }, [state.length, lengthMode]);

  const historyParams = React.useMemo(
    () => ({
      inputEncoding: state.inputEncoding,
      outputEncoding: state.outputEncoding,
      kdfAlgorithm: state.kdfAlgorithm,
      kdfHash: state.kdfHash,
      length: state.length,
      salt: state.salt,
      saltEncoding: state.saltEncoding,
      info: state.info,
      infoEncoding: state.infoEncoding,
      iterations: state.iterations,
    }),
    [
      state.inputEncoding,
      state.outputEncoding,
      state.kdfAlgorithm,
      state.kdfHash,
      state.length,
      state.salt,
      state.saltEncoding,
      state.info,
      state.infoEncoding,
      state.iterations,
    ],
  );

  React.useEffect(() => {
    if (hasHydratedInputRef.current) return;
    if (hydrationSource === "default") return;
    lastInputRef.current = state.input;
    hasHydratedInputRef.current = true;
  }, [hydrationSource, state.input]);

  React.useEffect(() => {
    if (!state.input || state.input === lastInputRef.current) return;

    const timer = setTimeout(() => {
      lastInputRef.current = state.input;
      upsertInputEntry(
        { input: state.input },
        historyParams,
        "left",
        state.input.slice(0, 100),
      );
    }, DEFAULT_URL_SYNC_DEBOUNCE_MS);

    return () => clearTimeout(timer);
  }, [state.input, historyParams, upsertInputEntry]);

  React.useEffect(() => {
    if (hasUrlParams && !hasHandledUrlRef.current) {
      hasHandledUrlRef.current = true;
      if (state.input) {
        upsertInputEntry(
          { input: state.input },
          historyParams,
          "left",
          state.input.slice(0, 100),
        );
      } else {
        upsertParams(historyParams, "interpretation");
      }
    }
  }, [
    hasUrlParams,
    state.input,
    historyParams,
    upsertInputEntry,
    upsertParams,
  ]);

  React.useEffect(() => {
    const nextParams = historyParams;
    if (!hasInitializedParamsRef.current) {
      hasInitializedParamsRef.current = true;
      paramsRef.current = nextParams;
      return;
    }
    if (
      paramsRef.current.inputEncoding === nextParams.inputEncoding &&
      paramsRef.current.outputEncoding === nextParams.outputEncoding &&
      paramsRef.current.kdfAlgorithm === nextParams.kdfAlgorithm &&
      paramsRef.current.kdfHash === nextParams.kdfHash &&
      paramsRef.current.length === nextParams.length &&
      paramsRef.current.salt === nextParams.salt &&
      paramsRef.current.saltEncoding === nextParams.saltEncoding &&
      paramsRef.current.info === nextParams.info &&
      paramsRef.current.infoEncoding === nextParams.infoEncoding &&
      paramsRef.current.iterations === nextParams.iterations
    ) {
      return;
    }
    paramsRef.current = nextParams;
    upsertParams(nextParams, "interpretation");
  }, [historyParams, upsertParams]);

  React.useEffect(() => {
    if (!state.input.trim()) {
      setOutput("");
      setError(null);
      setIsWorking(false);
      return;
    }

    const runId = ++runRef.current;
    setIsWorking(true);
    setError(null);

    const run = async () => {
      try {
        const inputBytes = decodeInputBytes(state.input, state.inputEncoding);
        const derived = await deriveKeyBytes(inputBytes, state);
        const outputText = encodeOutputBytes(derived, state.outputEncoding);
        if (runRef.current !== runId) return;
        setOutput(outputText);
        setError(null);
      } catch (err) {
        if (runRef.current !== runId) return;
        setError(err instanceof Error ? err.message : "Failed to derive key.");
        setOutput("");
      } finally {
        if (runRef.current === runId) {
          setIsWorking(false);
        }
      }
    };

    run();
  }, [
    state.input,
    state.inputEncoding,
    state.outputEncoding,
    state.kdfAlgorithm,
    state.kdfHash,
    state.length,
    state.salt,
    state.saltEncoding,
    state.info,
    state.infoEncoding,
    state.iterations,
  ]);

  const handleLengthPresetChange = (value: LengthPreset) => {
    setLengthMode(value);
    if (value === "256") setParam("length", 32, true);
    if (value === "384") setParam("length", 48, true);
    if (value === "512") setParam("length", 64, true);
  };

  const handleGenerateSalt = () => {
    try {
      const bytes = randomBytes(SALT_DEFAULT_LENGTH);
      const encoded = encodeParamValue(bytes, state.saltEncoding);
      setParam("salt", encoded);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to generate salt.");
    }
  };

  const handleCopyOutput = async () => {
    if (!output) return;
    await navigator.clipboard.writeText(output);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownloadOutput = () => {
    if (!output) return;
    const blob = new Blob([output], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "derived-key.txt";
    link.click();
    URL.revokeObjectURL(url);
  };

  const handleClearAll = React.useCallback(() => {
    runRef.current += 1;
    resetToDefaults();
    setOutput("");
    setError(null);
    setIsWorking(false);
    setCopied(false);
  }, [resetToDefaults]);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-base font-semibold">Key Derivation</h2>
        <Button
          variant="ghost"
          size="sm"
          onClick={handleClearAll}
          className="h-8 px-3 text-sm"
        >
          Clear
        </Button>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="flex flex-col gap-4">
          <div className="space-y-3">
            <div className="flex items-center gap-3">
              <Label className="w-24 text-sm sm:w-32">Algorithm</Label>
              <Tabs
                value={state.kdfAlgorithm}
                onValueChange={(value) =>
                  setParam("kdfAlgorithm", value as KdfAlgorithm, true)
                }
              >
                <TabsList className="h-8">
                  {kdfAlgorithms.map((alg) => (
                    <TabsTrigger key={alg} value={alg} className="text-xs">
                      {alg}
                    </TabsTrigger>
                  ))}
                </TabsList>
              </Tabs>
            </div>
            <div className="flex items-center gap-3">
              <Label className="w-24 text-sm sm:w-32">Hash</Label>
              <Tabs
                value={state.kdfHash}
                onValueChange={(value) =>
                  setParam("kdfHash", value as KdfHash, true)
                }
              >
                <ScrollableTabsList>
                  {kdfHashes.map((hash) => (
                    <TabsTrigger key={hash} value={hash} className="text-xs">
                      {hash}
                    </TabsTrigger>
                  ))}
                </ScrollableTabsList>
              </Tabs>
            </div>
            <div className="flex items-center gap-3">
              <Label className="w-24 text-sm sm:w-32">Length</Label>
              <Tabs
                value={lengthMode}
                onValueChange={(value) =>
                  handleLengthPresetChange(value as LengthPreset)
                }
              >
                <TabsList className="h-8">
                  <TabsTrigger value="256" className="text-xs">
                    256-bit
                  </TabsTrigger>
                  <TabsTrigger value="384" className="text-xs">
                    384-bit
                  </TabsTrigger>
                  <TabsTrigger value="512" className="text-xs">
                    512-bit
                  </TabsTrigger>
                  <TabsTrigger value="custom" className="text-xs">
                    Custom
                  </TabsTrigger>
                </TabsList>
              </Tabs>
            </div>
            {lengthMode === "custom" && (
              <div className="flex items-center gap-3">
                <div className="w-24 sm:w-32" />
                <div className="min-w-0 flex-1 space-y-1">
                  <Slider
                    value={[state.length]}
                    min={1}
                    max={maxKdfLength}
                    step={1}
                    onValueChange={(value) =>
                      setParam("length", value[0] ?? 1, true)
                    }
                  />
                  <p className="text-xs text-muted-foreground">
                    {state.length * 8} bits
                  </p>
                </div>
              </div>
            )}
            {state.kdfAlgorithm === "PBKDF2" && (
              <div className="flex items-center gap-3">
                <Label className="w-24 text-sm sm:w-32">Iterations</Label>
                <Input
                  type="number"
                  min={1}
                  max={10000000}
                  value={state.iterations}
                  onChange={(event) => {
                    const value = Number.parseInt(event.target.value, 10);
                    setParam(
                      "iterations",
                      Number.isNaN(value) ? 100000 : value,
                      true,
                    );
                  }}
                  className="h-9 w-32"
                />
              </div>
            )}
            <div className="flex items-center gap-3">
              <Label className="w-24 text-sm sm:w-32">Salt</Label>
              <div className="flex min-w-0 flex-1 flex-col gap-2">
                <Input
                  value={state.salt}
                  onChange={(event) => setParam("salt", event.target.value)}
                  placeholder="Enter salt..."
                  className={cn(
                    "h-8 font-mono text-xs",
                    oversizeKeys.includes("salt") && "border-destructive",
                  )}
                />
                <div className="flex items-center gap-2">
                  <Tabs
                    value={state.saltEncoding}
                    onValueChange={(value) =>
                      setParam("saltEncoding", value as ParamEncoding, true)
                    }
                  >
                    <TabsList className="h-6">
                      {paramEncodings.map((encoding) => (
                        <TabsTrigger
                          key={encoding}
                          value={encoding}
                          className="text-[10px] sm:text-xs px-2"
                        >
                          {encodingLabels[encoding]}
                        </TabsTrigger>
                      ))}
                    </TabsList>
                  </Tabs>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleGenerateSalt}
                    className="ml-auto h-6 gap-1 px-2 text-[10px] sm:text-xs"
                    aria-label="Generate salt"
                  >
                    <RefreshCcw className="h-3 w-3" />
                    Generate
                  </Button>
                </div>
              </div>
            </div>
            {state.kdfAlgorithm === "HKDF" && (
              <div className="flex items-center gap-3">
                <Label className="w-24 text-sm sm:w-32">Info</Label>
                <div className="flex min-w-0 flex-1 flex-col gap-2">
                  <Input
                    value={state.info}
                    onChange={(event) => setParam("info", event.target.value)}
                    placeholder="Enter info..."
                    className={cn(
                      "h-8 font-mono text-xs",
                      oversizeKeys.includes("info") && "border-destructive",
                    )}
                  />
                  <div className="flex items-center">
                    <Tabs
                      value={state.infoEncoding}
                      onValueChange={(value) =>
                        setParam("infoEncoding", value as ParamEncoding, true)
                      }
                    >
                      <TabsList className="h-6">
                        {paramEncodings.map((encoding) => (
                          <TabsTrigger
                            key={encoding}
                            value={encoding}
                            className="text-[10px] sm:text-xs px-2"
                          >
                            {encodingLabels[encoding]}
                          </TabsTrigger>
                        ))}
                      </TabsList>
                    </Tabs>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="flex flex-col gap-4">
          <div className="space-y-2">
            <div className="flex items-center gap-3">
              <Label className="text-sm">Input</Label>
              <Tabs
                value={state.inputEncoding}
                onValueChange={(value) =>
                  setParam("inputEncoding", value as InputEncoding, true)
                }
                className="min-w-0 flex-1"
              >
                <ScrollableTabsList className="h-6">
                  {inputEncodings.map((encoding) => (
                    <TabsTrigger
                      key={encoding}
                      value={encoding}
                      className="text-[10px] sm:text-xs flex-none"
                    >
                      {encodingLabels[encoding]}
                    </TabsTrigger>
                  ))}
                </ScrollableTabsList>
              </Tabs>
            </div>
            <Textarea
              value={state.input}
              onChange={(event) => setParam("input", event.target.value)}
              placeholder="Enter input material..."
              className={cn(
                "min-h-[200px] max-h-[320px] overflow-auto break-all font-mono text-sm",
                oversizeKeys.includes("input") && "border-destructive",
              )}
            />
            {oversizeKeys.includes("input") && (
              <p className="text-xs text-muted-foreground">
                Input exceeds 2 KB and is not synced to the URL.
              </p>
            )}
          </div>

          <div className="space-y-2">
            <div className="flex items-center gap-3">
              <Label className="text-sm">Derived Key</Label>
              <Tabs
                value={state.outputEncoding}
                onValueChange={(value) =>
                  setParam("outputEncoding", value as OutputEncoding, true)
                }
                className="min-w-0 flex-1"
              >
                <ScrollableTabsList className="h-6">
                  {outputEncodings.map((encoding) => (
                    <TabsTrigger
                      key={encoding}
                      value={encoding}
                      className="text-[10px] sm:text-xs flex-none"
                    >
                      {encodingLabels[encoding]}
                    </TabsTrigger>
                  ))}
                </ScrollableTabsList>
              </Tabs>
              <div className="ml-auto flex shrink-0 items-center gap-1">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleCopyOutput}
                  className="h-7 w-7 p-0"
                  aria-label="Copy derived key"
                  disabled={!output}
                >
                  {copied ? (
                    <Check className="h-3 w-3" />
                  ) : (
                    <Copy className="h-3 w-3" />
                  )}
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleDownloadOutput}
                  className="h-7 w-7 p-0"
                  aria-label="Download derived key"
                  disabled={!output}
                >
                  <Download className="h-3 w-3" />
                </Button>
              </div>
            </div>
            <Textarea
              value={output}
              readOnly
              placeholder="Derived key will appear here..."
              className="min-h-[260px] max-h-[420px] overflow-auto break-all font-mono text-sm"
            />
          </div>

          {isWorking && (
            <p className="text-xs text-muted-foreground">Deriving key...</p>
          )}
          {error && (
            <Alert variant="destructive" className="py-2">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription className="text-xs">{error}</AlertDescription>
            </Alert>
          )}
        </div>
      </div>
    </div>
  );
}
