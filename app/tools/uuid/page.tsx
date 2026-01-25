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
  generateUUIDs,
  parseUUID,
  type UUIDVersion,
  type ParsedUUID,
} from "@/lib/uuid/uuid";
import type { HistoryEntry } from "@/lib/history/db";
import { cn } from "@/lib/utils";

const paramsSchema = z.object({
  version: z.enum(["v7", "v4", "v1", "v6"]).default("v7"),
  count: z.coerce.number().int().min(1).max(1000).default(1),
  content: z.string().default(""),
});

type ParsedUUIDItem = {
  input: string;
  result?: ParsedUUID;
  error?: string;
};

export default function UUIDPage() {
  return (
    <Suspense fallback={null}>
      <UUIDContent />
    </Suspense>
  );
}

function UUIDContent() {
  const { state, setParam, oversizeKeys, hasUrlParams, hydrationSource } =
    useUrlSyncedState("uuid", {
      schema: paramsSchema,
      defaults: paramsSchema.parse({}),
    });

  const [parseError, setParseError] = React.useState<string | null>(null);
  const [parsedItems, setParsedItems] = React.useState<ParsedUUIDItem[]>([]);
  const [copied, setCopied] = React.useState(false);

  React.useEffect(() => {
    const trimmed = state.content.trim();
    if (!trimmed) {
      setParseError(null);
      setParsedItems([]);
      return;
    }

    const lines = trimmed
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean);
    const results = lines.map((line) => {
      const result = parseUUID(line);
      if ("error" in result) {
        return { input: line, error: result.error };
      }
      return { input: line, result };
    });

    const hasErrors = results.some((item) => item.error);
    if (lines.length === 1 && hasErrors) {
      setParseError(results[0].error ?? "UUID is invalid.");
    } else if (hasErrors) {
      setParseError("One or more UUIDs are invalid.");
    } else {
      setParseError(null);
    }

    setParsedItems(results);
  }, [state.content]);

  const handleContentChange = React.useCallback(
    (value: string) => {
      setParam("content", value);
    },
    [setParam],
  );

  const handleCopy = async () => {
    await navigator.clipboard.writeText(state.content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownload = () => {
    const blob = new Blob([state.content], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `uuid-${state.version}-${state.count}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleLoadHistory = React.useCallback(
    (entry: HistoryEntry) => {
      const { inputs, params } = entry;
      if (inputs.content !== undefined) setParam("content", inputs.content);
      if (params.version)
        setParam(
          "version",
          params.version as z.infer<typeof paramsSchema>["version"],
        );
      if (params.count) setParam("count", params.count as number);
    },
    [setParam],
  );

  return (
    <ToolPageWrapper
      toolId="uuid"
      title="UUID"
      description="Generate and parse UUIDs v1, v4, v6, and v7"
      onLoadHistory={handleLoadHistory}
    >
      <UUIDInner
        state={state}
        setParam={setParam}
        oversizeKeys={oversizeKeys}
        hasUrlParams={hasUrlParams}
        hydrationSource={hydrationSource}
        parseError={parseError}
        parsedItems={parsedItems}
        copied={copied}
        handleContentChange={handleContentChange}
        handleCopy={handleCopy}
        handleDownload={handleDownload}
      />
    </ToolPageWrapper>
  );
}

function UUIDInner({
  state,
  setParam,
  oversizeKeys,
  hasUrlParams,
  hydrationSource,
  parseError,
  parsedItems,
  copied,
  handleContentChange,
  handleCopy,
  handleDownload,
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
  parseError: string | null;
  parsedItems: ParsedUUIDItem[];
  copied: boolean;
  handleContentChange: (value: string) => void;
  handleCopy: () => void;
  handleDownload: () => void;
}) {
  const { upsertInputEntry, upsertParams } = useToolHistoryContext();
  const lastSavedRef = React.useRef<string>("");
  const hasHydratedInputRef = React.useRef(false);
  const paramsRef = React.useRef({
    version: state.version,
    count: state.count,
  });
  const hasInitializedParamsRef = React.useRef(false);
  const hasHandledUrlRef = React.useRef(false);

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
        { version: state.version, count: state.count },
        "left",
        state.content
          ? state.content.slice(0, 100)
          : `${state.version} x${state.count}`,
      );
    }, DEFAULT_URL_SYNC_DEBOUNCE_MS);

    return () => clearTimeout(timer);
  }, [state.content, state.version, state.count, upsertInputEntry]);

  React.useEffect(() => {
    if (hasUrlParams && !hasHandledUrlRef.current) {
      hasHandledUrlRef.current = true;
      if (state.content) {
        upsertInputEntry(
          { content: state.content },
          { version: state.version, count: state.count },
          "left",
          state.content.slice(0, 100),
        );
      } else {
        upsertParams(
          { version: state.version, count: state.count },
          "deferred",
        );
      }
    }
  }, [
    hasUrlParams,
    state.content,
    state.version,
    state.count,
    upsertInputEntry,
    upsertParams,
  ]);

  React.useEffect(() => {
    const nextParams = { version: state.version, count: state.count };
    if (!hasInitializedParamsRef.current) {
      hasInitializedParamsRef.current = true;
      paramsRef.current = nextParams;
      return;
    }
    if (
      paramsRef.current.version === nextParams.version &&
      paramsRef.current.count === nextParams.count
    ) {
      return;
    }
    paramsRef.current = nextParams;
    upsertParams(nextParams, "deferred");
  }, [state.version, state.count, upsertParams]);

  const handleGenerate = React.useCallback(() => {
    const uuids = generateUUIDs(state.version as UUIDVersion, state.count);
    const content = uuids.join("\n");
    setParam("content", content);

    lastSavedRef.current = content;
    upsertInputEntry(
      { content },
      { version: state.version, count: state.count },
      "left",
      content.slice(0, 100),
    );
  }, [state.version, state.count, setParam, upsertInputEntry]);

  const handleCountChange = React.useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      let value = Number.parseInt(e.target.value) || 1;
      value = Math.max(1, Math.min(1000, value));
      setParam("count", value, true);
    },
    [setParam],
  );
  const singleItem = parsedItems.length === 1 ? parsedItems[0] : null;
  const singleParsed = singleItem?.result ?? null;
  const singleError = singleItem?.error ?? null;

  return (
    <div className="flex flex-col gap-4">
      <Card>
        <CardContent className="flex flex-wrap items-center gap-4 p-4">
          <div className="flex items-center gap-2">
            <Label htmlFor="version" className="text-sm whitespace-nowrap">
              Version
            </Label>
            <Select
              value={state.version}
              onValueChange={(v) =>
                setParam(
                  "version",
                  v as z.infer<typeof paramsSchema>["version"],
                  true,
                )
              }
            >
              <SelectTrigger id="version" className="w-24">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="v7">v7</SelectItem>
                <SelectItem value="v4">v4</SelectItem>
                <SelectItem value="v1">v1</SelectItem>
                <SelectItem value="v6">v6</SelectItem>
              </SelectContent>
            </Select>
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
              className="w-24"
            />
          </div>

          <Button onClick={handleGenerate}>Generate</Button>
        </CardContent>
      </Card>

      <div className="flex min-h-0 flex-1 flex-col gap-4 md:flex-row">
        <div className="flex w-full flex-1 flex-col gap-2 md:w-0">
          <div className="flex items-center justify-between">
            <Label className="text-sm font-medium">UUIDs</Label>
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
            placeholder="Generated UUIDs will appear here, or paste UUIDs to parse..."
            className={cn(
              "min-h-[300px] max-h-[400px] resize-none overflow-auto overflow-x-hidden break-words whitespace-pre-wrap font-mono text-sm",
              parseError && "border-destructive",
            )}
          />

          {parseError && (
            <p className="text-xs text-destructive">{parseError}</p>
          )}
          {oversizeKeys.includes("content") && (
            <p className="text-xs text-muted-foreground">
              Input exceeds 2 KB and is not synced to the URL.
            </p>
          )}
        </div>

        <div className="flex w-full flex-1 flex-col gap-2 md:w-0">
          <Label className="text-sm font-medium">Parsed Information</Label>

          {parsedItems.length ? (
            parsedItems.length > 1 ? (
              <Card>
                <CardContent className="p-4">
                  <div className="w-full overflow-x-auto">
                    <table className="min-w-[900px] table-fixed text-sm">
                      <thead className="text-xs text-muted-foreground">
                        <tr>
                          <th className="px-2 py-2 text-left font-medium">
                            UUID
                          </th>
                          <th className="px-2 py-2 text-left font-medium">
                            Version
                          </th>
                          <th className="px-2 py-2 text-left font-medium">
                            Variant
                          </th>
                          <th className="px-2 py-2 text-left font-medium">
                            Timestamp
                          </th>
                          <th className="px-2 py-2 text-left font-medium">
                            Node ID
                          </th>
                          <th className="px-2 py-2 text-left font-medium">
                            Clock Seq
                          </th>
                          <th className="px-2 py-2 text-left font-medium">
                            Error
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {parsedItems.map((item, index) => {
                          const key = `${item.input}-${index}`;
                          if (item.error || !item.result) {
                            return (
                              <tr key={key} className="border-t">
                                <td className="px-2 py-2 align-top break-all font-mono">
                                  {item.input}
                                </td>
                                <td className="px-2 py-2 align-top text-muted-foreground">
                                  N/A
                                </td>
                                <td className="px-2 py-2 align-top text-muted-foreground">
                                  N/A
                                </td>
                                <td className="px-2 py-2 align-top text-muted-foreground">
                                  N/A
                                </td>
                                <td className="px-2 py-2 align-top text-muted-foreground">
                                  N/A
                                </td>
                                <td className="px-2 py-2 align-top text-muted-foreground">
                                  N/A
                                </td>
                                <td className="px-2 py-2 align-top text-destructive">
                                  {item.error ?? "Invalid"}
                                </td>
                              </tr>
                            );
                          }

                          const timestampRaw =
                            item.result.timestampRaw !== undefined
                              ? String(item.result.timestampRaw)
                              : null;

                          return (
                            <tr key={key} className="border-t">
                              <td className="px-2 py-2 align-top break-all font-mono">
                                {item.result.uuid}
                              </td>
                              <td className="px-2 py-2 align-top">
                                {item.result.version}
                              </td>
                              <td className="px-2 py-2 align-top">
                                {item.result.variant}
                              </td>
                              <td className="px-2 py-2 align-top">
                                {item.result.timestamp ? (
                                  <div className="flex flex-col gap-1">
                                    <span className="break-all">
                                      {item.result.timestamp}
                                    </span>
                                    {timestampRaw && (
                                      <span className="text-xs font-mono text-muted-foreground">
                                        {timestampRaw}
                                      </span>
                                    )}
                                  </div>
                                ) : (
                                  <span className="text-muted-foreground">
                                    N/A
                                  </span>
                                )}
                              </td>
                              <td className="px-2 py-2 align-top font-mono">
                                {item.result.nodeId ?? "N/A"}
                              </td>
                              <td className="px-2 py-2 align-top">
                                {item.result.clockSeq !== undefined
                                  ? item.result.clockSeq
                                  : "N/A"}
                              </td>
                              <td className="px-2 py-2 align-top text-muted-foreground">
                                N/A
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </CardContent>
              </Card>
            ) : singleParsed ? (
              <Card className="max-h-[400px] overflow-auto">
                <CardContent className="space-y-3 p-4">
                  <InfoRow label="UUID" value={singleParsed.uuid} mono />
                  <InfoRow label="Version" value={`${singleParsed.version}`} />
                  <InfoRow label="Variant" value={singleParsed.variant} />

                  {singleParsed.timestamp && (
                    <>
                      <InfoRow
                        label="Timestamp (ISO)"
                        value={singleParsed.timestamp}
                      />
                      <InfoRow
                        label="Timestamp (Raw)"
                        value={String(singleParsed.timestampRaw)}
                        mono
                      />
                    </>
                  )}

                  {singleParsed.nodeId && (
                    <InfoRow label="Node ID" value={singleParsed.nodeId} mono />
                  )}

                  {singleParsed.clockSeq !== undefined && (
                    <InfoRow
                      label="Clock Sequence"
                      value={String(singleParsed.clockSeq)}
                    />
                  )}
                </CardContent>
              </Card>
            ) : (
              <Card className="flex min-h-[300px] max-h-[400px] items-center justify-center">
                <p className="text-sm text-destructive">
                  {singleError ?? "UUID is invalid."}
                </p>
              </Card>
            )
          ) : (
            <Card className="flex min-h-[300px] max-h-[400px] items-center justify-center">
              <p className="text-sm text-muted-foreground">
                {state.content.trim()
                  ? "Enter one or more UUIDs to parse"
                  : "Generate or paste UUIDs to see parsed information"}
              </p>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}

function InfoRow({
  label,
  value,
  mono,
}: {
  label: string;
  value: string;
  mono?: boolean;
}) {
  return (
    <div className="flex flex-col gap-1">
      <span className="text-xs text-muted-foreground">{label}</span>
      <span
        className={cn("text-sm break-all", mono && "font-mono")}
        style={{ wordBreak: "break-all", overflowWrap: "anywhere" }}
      >
        {value}
      </span>
    </div>
  );
}
