"use client";

import * as React from "react";
import { Suspense } from "react";
import { z } from "zod";
import fetchToCurl from "fetch-to-curl";
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
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Copy, Check, RefreshCw } from "lucide-react";
import type { HistoryEntry } from "@/lib/history/db";
import { cn } from "@/lib/utils";

const paramsSchema = z.object({
  mode: z.enum(["curlToFetch", "fetchToCurl"]).default("curlToFetch"),
  curlCommand: z.string().default(""),
  fetchUrl: z.string().default(""),
  fetchOptions: z.string().default('{\n  "method": "GET",\n  "headers": {}\n}'),
});

type ConvertResult = {
  output: string;
  warnings?: string[];
};

export default function CurlFetchConverterPage() {
  return (
    <Suspense fallback={null}>
      <CurlFetchConverterContent />
    </Suspense>
  );
}

function CurlFetchConverterContent() {
  const { state, setParam, oversizeKeys, hasUrlParams, hydrationSource } =
    useUrlSyncedState("curl-fetch-converter", {
      schema: paramsSchema,
      defaults: paramsSchema.parse({}),
      restoreMissingKeys: (key) =>
        key === "curlCommand" || key === "fetchUrl" || key === "fetchOptions",
    });

  const handleLoadHistory = React.useCallback(
    (entry: HistoryEntry) => {
      const { inputs, params } = entry;
      if (inputs.curlCommand !== undefined)
        setParam("curlCommand", inputs.curlCommand);
      if (inputs.fetchUrl !== undefined) setParam("fetchUrl", inputs.fetchUrl);
      if (inputs.fetchOptions !== undefined)
        setParam("fetchOptions", inputs.fetchOptions);
      if (params.mode)
        setParam("mode", params.mode as z.infer<typeof paramsSchema>["mode"]);
    },
    [setParam],
  );

  return (
    <ToolPageWrapper
      toolId="curl-fetch-converter"
      title="cURL / fetch Converter"
      description="Convert cURL commands to fetch and generate cURL from fetch options"
      onLoadHistory={handleLoadHistory}
    >
      <CurlFetchConverterInner
        state={state}
        setParam={setParam}
        oversizeKeys={oversizeKeys}
        hasUrlParams={hasUrlParams}
        hydrationSource={hydrationSource}
      />
    </ToolPageWrapper>
  );
}

function CurlFetchConverterInner({
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
  const [curlResult, setCurlResult] = React.useState<ConvertResult | null>(
    null,
  );
  const [fetchResult, setFetchResult] = React.useState<ConvertResult | null>(
    null,
  );
  const [curlError, setCurlError] = React.useState<string | null>(null);
  const [fetchError, setFetchError] = React.useState<string | null>(null);
  const [isConverting, setIsConverting] = React.useState(false);
  const [copied, setCopied] = React.useState<"curl" | "fetch" | null>(null);
  const lastInputRef = React.useRef<string>("");
  const hasHydratedInputRef = React.useRef(false);
  const paramsRef = React.useRef({ mode: state.mode });
  const hasInitializedParamsRef = React.useRef(false);
  const hasHandledUrlRef = React.useRef(false);

  React.useEffect(() => {
    if (hasHydratedInputRef.current) return;
    if (hydrationSource === "default") return;
    lastInputRef.current = JSON.stringify({
      mode: state.mode,
      curlCommand: state.curlCommand,
      fetchUrl: state.fetchUrl,
      fetchOptions: state.fetchOptions,
    });
    hasHydratedInputRef.current = true;
  }, [
    hydrationSource,
    state.mode,
    state.curlCommand,
    state.fetchUrl,
    state.fetchOptions,
  ]);

  React.useEffect(() => {
    const snapshot = JSON.stringify({
      mode: state.mode,
      curlCommand: state.curlCommand,
      fetchUrl: state.fetchUrl,
      fetchOptions: state.fetchOptions,
    });
    if (snapshot === lastInputRef.current) return;

    const timer = setTimeout(() => {
      lastInputRef.current = snapshot;
      upsertInputEntry(
        {
          curlCommand: state.curlCommand,
          fetchUrl: state.fetchUrl,
          fetchOptions: state.fetchOptions,
        },
        { mode: state.mode },
        "left",
        state.mode === "curlToFetch"
          ? state.curlCommand.slice(0, 100)
          : state.fetchUrl || "fetch",
      );
    }, DEFAULT_URL_SYNC_DEBOUNCE_MS);

    return () => clearTimeout(timer);
  }, [
    state.mode,
    state.curlCommand,
    state.fetchUrl,
    state.fetchOptions,
    upsertInputEntry,
  ]);

  React.useEffect(() => {
    if (hasUrlParams && !hasHandledUrlRef.current) {
      hasHandledUrlRef.current = true;
      if (state.curlCommand || state.fetchUrl || state.fetchOptions) {
        upsertInputEntry(
          {
            curlCommand: state.curlCommand,
            fetchUrl: state.fetchUrl,
            fetchOptions: state.fetchOptions,
          },
          { mode: state.mode },
          "left",
          state.mode === "curlToFetch"
            ? state.curlCommand.slice(0, 100)
            : state.fetchUrl || "fetch",
        );
      } else {
        upsertParams({ mode: state.mode }, "interpretation");
      }
    }
  }, [
    hasUrlParams,
    state.curlCommand,
    state.fetchUrl,
    state.fetchOptions,
    state.mode,
    upsertInputEntry,
    upsertParams,
  ]);

  React.useEffect(() => {
    const nextParams = { mode: state.mode };
    if (!hasInitializedParamsRef.current) {
      hasInitializedParamsRef.current = true;
      paramsRef.current = nextParams;
      return;
    }
    if (paramsRef.current.mode === nextParams.mode) return;
    paramsRef.current = nextParams;
    upsertParams(nextParams, "interpretation");
  }, [state.mode, upsertParams]);

  const handleCopy = async (target: "curl" | "fetch") => {
    const value =
      target === "curl" ? curlResult?.output || "" : fetchResult?.output || "";
    if (!value) return;
    await navigator.clipboard.writeText(value);
    setCopied(target);
    setTimeout(() => setCopied(null), 2000);
  };

  const handleConvertCurl = async () => {
    if (!state.curlCommand.trim()) {
      setCurlError("Enter a cURL command to convert.");
      setCurlResult(null);
      return;
    }
    setIsConverting(true);
    setCurlError(null);
    try {
      const module = await import("curlconverter");
      const [output, rawWarnings] = module.toJavaScriptWarn(
        state.curlCommand,
      ) as [string, Array<[string, string]>];
      const warningMessages = (rawWarnings || []).map((item) => item[1]);
      setCurlResult({ output, warnings: warningMessages });
    } catch (err) {
      console.error("Failed to convert cURL", err);
      setCurlError(
        err instanceof Error ? err.message : "Failed to convert cURL",
      );
      setCurlResult(null);
    } finally {
      setIsConverting(false);
    }
  };

  const handleConvertFetch = () => {
    setFetchError(null);
    setFetchResult(null);

    if (!state.fetchUrl.trim()) {
      setFetchError("Enter a request URL.");
      return;
    }

    try {
      const options = state.fetchOptions.trim()
        ? JSON.parse(state.fetchOptions)
        : {};
      const output = fetchToCurl(state.fetchUrl.trim(), options);
      setFetchResult({ output });
    } catch (err) {
      console.error("Failed to convert fetch", err);
      setFetchError(
        err instanceof Error ? err.message : "Failed to convert fetch",
      );
    }
  };

  const showOversizeWarning = oversizeKeys.some((key) =>
    ["curlCommand", "fetchOptions"].includes(String(key)),
  );

  return (
    <div className="flex flex-col gap-4">
      <Card>
        <CardContent className="p-4">
          <Tabs
            value={state.mode}
            onValueChange={(value) =>
              setParam(
                "mode",
                value as z.infer<typeof paramsSchema>["mode"],
                true,
              )
            }
          >
            <TabsList className="w-full justify-start">
              <TabsTrigger value="curlToFetch">cURL to fetch</TabsTrigger>
              <TabsTrigger value="fetchToCurl">fetch to cURL</TabsTrigger>
            </TabsList>
            <TabsContent value="curlToFetch" className="mt-4 space-y-4">
              <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
                <div className="space-y-2">
                  <Label className="text-sm">cURL Command</Label>
                  <Textarea
                    value={state.curlCommand}
                    onChange={(e) =>
                      setParam("curlCommand", e.target.value, true)
                    }
                    placeholder="curl https://api.example.com -H 'Authorization: Bearer ...'"
                    className="min-h-[220px] font-mono text-sm"
                  />
                  {curlError && (
                    <p className="text-xs text-destructive">{curlError}</p>
                  )}
                </div>

                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label className="text-sm">Fetch Output</Label>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleCopy("curl")}
                      disabled={!curlResult?.output}
                      className="h-7 gap-1 px-2 text-xs"
                    >
                      {copied === "curl" ? (
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
                  <Textarea
                    value={curlResult?.output ?? ""}
                    readOnly
                    placeholder="Converted fetch code will appear here"
                    className="min-h-[220px] font-mono text-sm"
                  />
                  {curlResult?.warnings?.length ? (
                    <div className="space-y-1 text-xs text-muted-foreground">
                      {curlResult.warnings.map((warning, index) => (
                        <div key={`${warning}-${index}`}>- {warning}</div>
                      ))}
                    </div>
                  ) : null}
                </div>
              </div>

              <Button
                onClick={handleConvertCurl}
                disabled={isConverting}
                className="gap-2"
              >
                <RefreshCw
                  className={cn("h-4 w-4", isConverting && "animate-spin")}
                />
                Convert cURL
              </Button>
            </TabsContent>

            <TabsContent value="fetchToCurl" className="mt-4 space-y-4">
              <div className="grid gap-4 lg:grid-cols-[minmax(0,0.6fr)_minmax(0,1fr)]">
                <div className="space-y-2">
                  <Label className="text-sm">Request URL</Label>
                  <Input
                    value={state.fetchUrl}
                    onChange={(e) => setParam("fetchUrl", e.target.value, true)}
                    placeholder="https://api.example.com/resource"
                  />
                  <Label className="text-sm">Fetch Options (JSON)</Label>
                  <Textarea
                    value={state.fetchOptions}
                    onChange={(e) =>
                      setParam("fetchOptions", e.target.value, true)
                    }
                    placeholder='{"method": "POST", "headers": {"Content-Type": "application/json"}, "body": "{}"}'
                    className="min-h-[220px] font-mono text-sm"
                  />
                  {fetchError && (
                    <p className="text-xs text-destructive">{fetchError}</p>
                  )}
                </div>

                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label className="text-sm">cURL Output</Label>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleCopy("fetch")}
                      disabled={!fetchResult?.output}
                      className="h-7 gap-1 px-2 text-xs"
                    >
                      {copied === "fetch" ? (
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
                  <Textarea
                    value={fetchResult?.output ?? ""}
                    readOnly
                    placeholder="Converted cURL command will appear here"
                    className="min-h-[320px] font-mono text-sm"
                  />
                </div>
              </div>

              <Button onClick={handleConvertFetch} className="gap-2">
                <RefreshCw className="h-4 w-4" />
                Convert fetch
              </Button>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>

      {showOversizeWarning && (
        <p className="text-xs text-muted-foreground">
          Some inputs exceed 2 KB and are not synced to the URL.
        </p>
      )}
    </div>
  );
}
