"use client";

import * as React from "react";
import JsonView from "@uiw/react-json-view";
import { createPortal } from "react-dom";
import {
  Upload,
  Copy,
  Check,
  ChevronUp,
  ChevronDown,
  WandSparkles,
  Maximize2,
  Minimize2,
} from "lucide-react";
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
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import {
  buildJsonPath,
  clampCollapseDepth,
  decodeEscapedStringForDisplay,
  formatJsonForDisplay,
} from "@/lib/data/json-viewer";

const DEPTH_OPTIONS = [1, 2, 3, 4, 5, 6, 7, 8] as const;

const SAMPLE_JSON = `{
  "meta": {
    "app": "AutelysT",
    "timestamp": "2026-02-19T12:00:00Z"
  },
  "users": [
    {
      "id": 1,
      "name": "Alice",
      "roles": ["admin", "editor"],
      "active": true
    },
    {
      "id": 2,
      "name": "Bob",
      "roles": ["viewer"],
      "active": false
    }
  ],
  "settings": {
    "theme": "system",
    "notifications": {
      "email": true,
      "push": false
    }
  }
}`;

const paramsSchema = z.object({
  input: z.string().default(""),
  collapseDepth: z.coerce.number().int().min(1).max(8).default(2),
});
const defaultParams = paramsSchema.parse({});

const jsonViewerTheme = {
  "--w-rjv-font-family": "var(--font-mono)",
  "--w-rjv-background-color": "transparent",
  "--w-rjv-color": "var(--foreground)",
  "--w-rjv-line-color": "var(--border)",
  "--w-rjv-arrow-color": "var(--muted-foreground)",
  "--w-rjv-copied-color": "var(--muted-foreground)",
  "--w-rjv-copied-success-color": "var(--primary)",
} as React.CSSProperties;

export function JsonViewerContent() {
  const { state, setParam, oversizeKeys, hasUrlParams, hydrationSource } =
    useUrlSyncedState("json-viewer", {
      schema: paramsSchema,
      defaults: defaultParams,
    });
  const [fileName, setFileName] = React.useState<string | null>(null);
  const [viewerCollapsed, setViewerCollapsed] = React.useState<
    boolean | number
  >(state.collapseDepth);
  const [viewerRevision, setViewerRevision] = React.useState(0);
  const [copiedAll, setCopiedAll] = React.useState(false);
  const [copiedPath, setCopiedPath] = React.useState<string | null>(null);
  const [isTreeFullscreen, setIsTreeFullscreen] = React.useState(false);
  const [mounted, setMounted] = React.useState(false);
  const copyPathTimeoutRef = React.useRef<ReturnType<typeof setTimeout> | null>(
    null,
  );
  const fileInputRef = React.useRef<HTMLInputElement>(null);
  const lastLoggedParseErrorRef = React.useRef<string | null>(null);

  const parsedResult = React.useMemo(() => {
    const trimmed = state.input.trim();
    if (!trimmed) {
      return { value: null as unknown, error: null as string | null };
    }

    try {
      const parsed = JSON.parse(trimmed) as unknown;
      lastLoggedParseErrorRef.current = null;
      return { value: parsed, error: null as string | null };
    } catch (caught) {
      const message =
        caught instanceof Error ? caught.message : "Failed to parse JSON.";
      if (lastLoggedParseErrorRef.current !== message) {
        console.error(caught);
        lastLoggedParseErrorRef.current = message;
      }
      return {
        value: null as unknown,
        error: message,
      };
    }
  }, [state.input]);

  const parsedValue = parsedResult.value;
  const parseError = parsedResult.error;
  const isObjectOrArray =
    parsedValue !== null && typeof parsedValue === "object";

  React.useEffect(() => {
    if (!isObjectOrArray) return;
    setViewerCollapsed(state.collapseDepth);
    setViewerRevision((previous) => previous + 1);
  }, [isObjectOrArray, state.collapseDepth, state.input]);

  React.useEffect(
    () => () => {
      if (copyPathTimeoutRef.current) {
        clearTimeout(copyPathTimeoutRef.current);
      }
    },
    [],
  );

  React.useEffect(() => {
    setMounted(true);
  }, []);

  React.useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape" && isTreeFullscreen) {
        setIsTreeFullscreen(false);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isTreeFullscreen]);

  const handleLoadHistory = React.useCallback(
    (entry: HistoryEntry) => {
      const { inputs, params } = entry;

      if (params.fileName) {
        alert(
          "This history entry contains an uploaded file and cannot be restored. Only the file name was recorded.",
        );
        return;
      }

      if (inputs.input !== undefined) {
        setParam("input", inputs.input);
        setFileName(null);
      }
      if (params.collapseDepth !== undefined) {
        const collapseDepth = clampCollapseDepth(Number(params.collapseDepth));
        setParam("collapseDepth", collapseDepth, true);
        setViewerCollapsed(collapseDepth);
        setViewerRevision((previous) => previous + 1);
      }
    },
    [setParam],
  );

  const handleFileUpload = React.useCallback(
    async (event: React.ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0];
      event.target.value = "";
      if (!file) return;

      try {
        const content = await file.text();
        setParam("input", content);
        setFileName(file.name);
      } catch (caught) {
        console.error(caught);
      }
    },
    [setParam],
  );

  const handleCopyAll = React.useCallback(async () => {
    if (parsedValue === null) return;
    try {
      await navigator.clipboard.writeText(formatJsonForDisplay(parsedValue));
      setCopiedAll(true);
      setTimeout(() => setCopiedAll(false), 2000);
    } catch (caught) {
      console.error(caught);
    }
  }, [parsedValue]);

  const handleFormatInput = React.useCallback(() => {
    if (!state.input.trim()) return;
    try {
      const parsed = JSON.parse(state.input) as unknown;
      setParam("input", JSON.stringify(parsed, null, 2));
      setFileName(null);
    } catch (caught) {
      console.error(caught);
    }
  }, [setParam, state.input]);

  const handleCollapseAll = React.useCallback(() => {
    setViewerCollapsed(true);
    setViewerRevision((previous) => previous + 1);
  }, []);

  const handleExpandAll = React.useCallback(() => {
    setViewerCollapsed(false);
    setViewerRevision((previous) => previous + 1);
  }, []);

  const handleApplyCollapseDepth = React.useCallback(() => {
    setViewerCollapsed(state.collapseDepth);
    setViewerRevision((previous) => previous + 1);
  }, [state.collapseDepth]);

  const handleBeforeCopy = React.useCallback(
    (
      copyText: string,
      _keyName?: string | number,
      value?: unknown,
      _parentValue?: object,
      _expandKey?: string,
      keys?: (number | string)[],
    ) => {
      const path = buildJsonPath(keys ?? []);
      setCopiedPath(path);
      if (copyPathTimeoutRef.current) {
        clearTimeout(copyPathTimeoutRef.current);
      }
      copyPathTimeoutRef.current = setTimeout(() => setCopiedPath(null), 2000);
      if (typeof value === "string") {
        return value;
      }
      return copyText;
    },
    [],
  );

  const renderTreeCard = (fullscreen: boolean) => (
    <div
      className={cn(
        "flex h-full min-h-0 min-w-0 w-full flex-col gap-2",
        fullscreen ? "basis-full" : "flex-1 basis-1/2 md:w-0",
      )}
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Label className="text-sm font-medium">Tree Viewer</Label>
        <div className="flex flex-wrap items-center gap-1">
          <Label className="text-xs text-muted-foreground">
            Collapse Depth
          </Label>
          <Select
            value={String(state.collapseDepth)}
            onValueChange={(value) => {
              const collapseDepth = clampCollapseDepth(Number(value));
              setParam("collapseDepth", collapseDepth, true);
            }}
          >
            <SelectTrigger
              size="sm"
              className="w-[74px] py-0 text-xs data-[size=sm]:h-7"
            >
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {DEPTH_OPTIONS.map((depth) => (
                <SelectItem
                  key={depth}
                  value={String(depth)}
                  className="text-xs"
                >
                  {depth}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={handleApplyCollapseDepth}
            disabled={!isObjectOrArray}
            className="h-7 px-2 text-xs"
          >
            Apply
          </Button>
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={handleExpandAll}
            disabled={!isObjectOrArray}
            className="h-7 gap-1 px-2 text-xs"
          >
            <ChevronDown className="h-3 w-3" />
            Expand
          </Button>
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={handleCollapseAll}
            disabled={!isObjectOrArray}
            className="h-7 gap-1 px-2 text-xs"
          >
            <ChevronUp className="h-3 w-3" />
            Collapse
          </Button>
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={handleCopyAll}
            disabled={parsedValue === null}
            className="h-7 gap-1 px-2 text-xs"
          >
            {copiedAll ? (
              <Check className="h-3 w-3" />
            ) : (
              <Copy className="h-3 w-3" />
            )}
            Copy JSON
          </Button>
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={() => setIsTreeFullscreen(!fullscreen)}
            className="h-7 w-7 p-0"
            aria-label={fullscreen ? "Exit full page" : "Enter full page"}
          >
            {fullscreen ? (
              <Minimize2 className="h-3 w-3" />
            ) : (
              <Maximize2 className="h-3 w-3" />
            )}
          </Button>
        </div>
      </div>

      <div className="flex min-h-0 flex-1 flex-col gap-2 overflow-hidden">
        {!state.input.trim() ? (
          <p className="text-sm text-muted-foreground">
            Paste or upload JSON to inspect it in a collapsible tree.
          </p>
        ) : null}

        {state.input.trim() && !parseError && isObjectOrArray ? (
          <>
            <div className="min-h-0 flex-1 overflow-y-auto overflow-x-auto rounded-md border bg-muted/20 p-3">
              <JsonView
                key={`json-viewer-${viewerRevision}`}
                value={parsedValue as object}
                collapsed={viewerCollapsed}
                enableClipboard
                displayDataTypes={false}
                shortenTextAfterLength={0}
                style={jsonViewerTheme}
                beforeCopy={handleBeforeCopy}
              >
                <JsonView.Row
                  style={{
                    display: "flex",
                    alignItems: "flex-start",
                    minWidth: "max-content",
                  }}
                />
                <JsonView.String
                  render={(props, result) => {
                    if (
                      result.type !== "value" ||
                      typeof result.value !== "string"
                    ) {
                      return undefined;
                    }

                    const decoded = decodeEscapedStringForDisplay(result.value);

                    return (
                      <>
                        <span className="w-rjv-quotes">"</span>
                        <span
                          {...props}
                          className={cn("w-rjv-value", props.className)}
                          style={{
                            ...(props.style as React.CSSProperties),
                            whiteSpace: "pre",
                            wordBreak: "normal",
                            overflowWrap: "normal",
                            verticalAlign: "top",
                            tabSize: 2,
                          }}
                        >
                          {decoded}
                        </span>
                        <span className="w-rjv-quotes">"</span>
                      </>
                    );
                  }}
                />
              </JsonView>
            </div>
            <p className="text-xs text-muted-foreground">
              Hover a node and click the clipboard icon to copy that value.
            </p>
            {copiedPath ? (
              <p className="text-xs text-emerald-600">
                Copied from {copiedPath}
              </p>
            ) : null}
          </>
        ) : null}

        {state.input.trim() && !parseError && !isObjectOrArray ? (
          <div className="rounded-md border bg-muted/20 p-3">
            <p className="mb-2 text-xs text-muted-foreground">
              Root JSON value is a primitive:
            </p>
            <pre className="overflow-x-auto whitespace-pre font-mono text-xs">
              {formatJsonForDisplay(parsedValue)}
            </pre>
          </div>
        ) : null}
      </div>
    </div>
  );

  return (
    <ToolPageWrapper
      toolId="json-viewer"
      title="JSON Viewer"
      description="Paste or upload JSON, inspect collapsible nodes, and copy values directly from the tree."
      onLoadHistory={handleLoadHistory}
      scrollArea={false}
    >
      <JsonViewerHistorySync
        state={state}
        fileName={fileName}
        hasUrlParams={hasUrlParams}
        hydrationSource={hydrationSource}
      />
      <div className="flex h-[calc(100dvh-9.5rem)] min-h-0 min-w-0 flex-col gap-3 overflow-hidden md:h-[calc(100dvh-12.5rem)] md:flex-row">
        {!isTreeFullscreen ? (
          <div className="flex h-full min-h-0 min-w-0 w-full flex-1 basis-1/2 flex-col gap-2 md:w-0">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <Label className="text-sm font-medium">
                JSON Input {fileName ? `(${fileName})` : ""}
              </Label>
              <div className="flex flex-wrap items-center gap-1">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".json,application/json"
                  onChange={(event) => {
                    void handleFileUpload(event);
                  }}
                  className="hidden"
                />
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => fileInputRef.current?.click()}
                  className="h-7 gap-1 px-2 text-xs"
                >
                  <Upload className="h-3 w-3" />
                  Upload
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    setParam("input", SAMPLE_JSON);
                    setFileName(null);
                  }}
                  className="h-7 gap-1 px-2 text-xs"
                >
                  <WandSparkles className="h-3 w-3" />
                  Sample
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={handleFormatInput}
                  disabled={!state.input.trim() || Boolean(parseError)}
                  className="h-7 px-2 text-xs"
                >
                  Format
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    setParam("input", "");
                    setFileName(null);
                  }}
                  disabled={!state.input}
                  className="h-7 px-2 text-xs"
                >
                  Clear
                </Button>
              </div>
            </div>
            <div className="min-h-0 flex-1">
              <Textarea
                value={state.input}
                onChange={(event) => {
                  setParam("input", event.target.value);
                  setFileName(null);
                }}
                placeholder='Paste JSON here, e.g. {"name":"AutelysT","items":[1,2,3]}'
                style={{ fieldSizing: "fixed" } as React.CSSProperties}
                className={cn(
                  "h-full min-h-0 resize-none overflow-auto font-mono text-xs",
                  parseError && "border-destructive",
                )}
              />
            </div>
            {oversizeKeys.includes("input") ? (
              <p className="text-xs text-muted-foreground">
                Input exceeds 2 KB and is not synced to the URL.
              </p>
            ) : null}
            {parseError ? (
              <Alert variant="destructive" className="py-2">
                <AlertDescription className="text-xs">
                  {parseError}
                </AlertDescription>
              </Alert>
            ) : null}
          </div>
        ) : null}

        {!isTreeFullscreen ? renderTreeCard(false) : null}
      </div>
      {mounted && isTreeFullscreen
        ? createPortal(
            <div className="fixed inset-0 z-50 flex overflow-hidden bg-background p-4">
              {renderTreeCard(true)}
            </div>,
            document.body,
          )
        : null}
    </ToolPageWrapper>
  );
}

function JsonViewerHistorySync({
  state,
  fileName,
  hasUrlParams,
  hydrationSource,
}: {
  state: z.infer<typeof paramsSchema>;
  fileName: string | null;
  hasUrlParams: boolean;
  hydrationSource: "default" | "url" | "history";
}) {
  const { upsertInputEntry, upsertParams } = useToolHistoryContext();
  const lastInputRef = React.useRef<string>("");
  const paramsRef = React.useRef({
    collapseDepth: state.collapseDepth,
    fileName,
  });
  const hasInitializedParamsRef = React.useRef(false);
  const hasHandledUrlRef = React.useRef(false);
  const hasHydratedInputRef = React.useRef(false);

  React.useEffect(() => {
    if (hasHydratedInputRef.current) return;
    if (hydrationSource === "default") return;
    lastInputRef.current = state.input;
    hasHydratedInputRef.current = true;
  }, [hydrationSource, state.input]);

  React.useEffect(() => {
    if (state.input === lastInputRef.current) return;

    const timer = setTimeout(() => {
      lastInputRef.current = state.input;
      upsertInputEntry(
        { input: fileName ? "" : state.input },
        {
          collapseDepth: state.collapseDepth,
          fileName,
        },
        "left",
        fileName || state.input.slice(0, 120),
      );
    }, DEFAULT_URL_SYNC_DEBOUNCE_MS);

    return () => clearTimeout(timer);
  }, [state.input, state.collapseDepth, fileName, upsertInputEntry]);

  React.useEffect(() => {
    if (hasUrlParams && !hasHandledUrlRef.current) {
      hasHandledUrlRef.current = true;
      if (state.input) {
        upsertInputEntry(
          { input: fileName ? "" : state.input },
          {
            collapseDepth: state.collapseDepth,
            fileName,
          },
          "left",
          fileName || state.input.slice(0, 120),
        );
      } else {
        upsertParams(
          {
            collapseDepth: state.collapseDepth,
            fileName,
          },
          "interpretation",
        );
      }
    }
  }, [
    hasUrlParams,
    state.input,
    state.collapseDepth,
    fileName,
    upsertInputEntry,
    upsertParams,
  ]);

  React.useEffect(() => {
    const nextParams = {
      collapseDepth: state.collapseDepth,
      fileName,
    };
    if (!hasInitializedParamsRef.current) {
      hasInitializedParamsRef.current = true;
      paramsRef.current = nextParams;
      return;
    }
    if (
      paramsRef.current.collapseDepth === nextParams.collapseDepth &&
      paramsRef.current.fileName === nextParams.fileName
    ) {
      return;
    }
    paramsRef.current = nextParams;
    upsertParams(nextParams, "interpretation");
  }, [state.collapseDepth, fileName, upsertParams]);

  return null;
}
