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
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  createMermaidRenderId,
  DEFAULT_MERMAID_SOURCE,
  extractMermaidErrorMessage,
  sanitizeMermaidSource,
} from "@/lib/data/mermaid";

const paramsSchema = z.object({
  source: z.string().default(DEFAULT_MERMAID_SOURCE),
  theme: z.enum(["default", "neutral", "forest", "dark"]).default("default"),
  pngScale: z.coerce.number().min(1).max(4).default(2),
});

export default function MermaidRendererPage() {
  return (
    <Suspense fallback={null}>
      <MermaidRendererContent />
    </Suspense>
  );
}

function MermaidRendererContent() {
  const { state, setParam, oversizeKeys, hasUrlParams, hydrationSource } =
    useUrlSyncedState("mermaid-renderer", {
      schema: paramsSchema,
      defaults: paramsSchema.parse({}),
    });

  const [svgText, setSvgText] = React.useState("");
  const [pngDataUrl, setPngDataUrl] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);

  const renderDiagram = React.useCallback(async () => {
    setError(null);
    setPngDataUrl("");

    try {
      const source = sanitizeMermaidSource(state.source);
      if (!source) {
        setSvgText("");
        return;
      }
      const mermaid = (await import("mermaid")).default;
      mermaid.initialize({
        startOnLoad: false,
        theme: state.theme,
        securityLevel: "strict",
      });
      const { svg } = await mermaid.render(createMermaidRenderId(), source);
      setSvgText(svg);
    } catch (caught) {
      console.error(caught);
      setSvgText("");
      setError(extractMermaidErrorMessage(caught));
    }
  }, [state.source, state.theme]);

  React.useEffect(() => {
    void renderDiagram();
  }, [renderDiagram]);

  const generatePng = React.useCallback(async () => {
    try {
      setError(null);
      if (!svgText) {
        throw new Error("Render a diagram first.");
      }

      const svgBlob = new Blob([svgText], {
        type: "image/svg+xml;charset=utf-8",
      });
      const svgUrl = URL.createObjectURL(svgBlob);
      const image = new Image();
      try {
        const loaded = await new Promise<void>((resolve, reject) => {
          image.onload = () => resolve();
          image.onerror = () => reject(new Error("Failed to load SVG image."));
          image.src = svgUrl;
        });
        void loaded;
      } finally {
        URL.revokeObjectURL(svgUrl);
      }

      const width = Math.max(
        1,
        Math.round(image.naturalWidth * state.pngScale),
      );
      const height = Math.max(
        1,
        Math.round(image.naturalHeight * state.pngScale),
      );
      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      const context = canvas.getContext("2d");
      if (!context) {
        throw new Error("Failed to acquire 2D context.");
      }
      context.drawImage(image, 0, 0, width, height);
      setPngDataUrl(canvas.toDataURL("image/png"));
    } catch (caught) {
      console.error(caught);
      setError(
        caught instanceof Error ? caught.message : "Failed to render PNG.",
      );
    }
  }, [state.pngScale, svgText]);

  const handleDownloadSvg = React.useCallback(() => {
    if (!svgText) return;
    const blob = new Blob([svgText], { type: "image/svg+xml;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = "diagram.svg";
    anchor.click();
    URL.revokeObjectURL(url);
  }, [svgText]);

  const handleDownloadPng = React.useCallback(() => {
    if (!pngDataUrl) return;
    const anchor = document.createElement("a");
    anchor.href = pngDataUrl;
    anchor.download = "diagram.png";
    anchor.click();
  }, [pngDataUrl]);

  const handleLoadHistory = React.useCallback(
    (entry: HistoryEntry) => {
      const { inputs, params } = entry;
      if (inputs.source !== undefined) setParam("source", inputs.source);
      if (params.theme)
        setParam(
          "theme",
          params.theme as z.infer<typeof paramsSchema>["theme"],
        );
      if (params.pngScale !== undefined)
        setParam("pngScale", params.pngScale as number);
    },
    [setParam],
  );

  return (
    <ToolPageWrapper
      toolId="mermaid-renderer"
      title="Mermaid Renderer"
      description="Render Mermaid diagrams to SVG and export PNG snapshots."
      onLoadHistory={handleLoadHistory}
    >
      <MermaidRendererInner
        state={state}
        setParam={setParam}
        oversizeKeys={oversizeKeys}
        hasUrlParams={hasUrlParams}
        hydrationSource={hydrationSource}
        svgText={svgText}
        pngDataUrl={pngDataUrl}
        error={error}
        onRender={renderDiagram}
        onGeneratePng={generatePng}
        onDownloadSvg={handleDownloadSvg}
        onDownloadPng={handleDownloadPng}
      />
    </ToolPageWrapper>
  );
}

function MermaidRendererInner({
  state,
  setParam,
  oversizeKeys,
  hasUrlParams,
  hydrationSource,
  svgText,
  pngDataUrl,
  error,
  onRender,
  onGeneratePng,
  onDownloadSvg,
  onDownloadPng,
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
  svgText: string;
  pngDataUrl: string;
  error: string | null;
  onRender: () => Promise<void>;
  onGeneratePng: () => Promise<void>;
  onDownloadSvg: () => void;
  onDownloadPng: () => void;
}) {
  const { addHistoryEntry, updateHistoryParams } = useToolHistoryContext();
  const lastInputRef = React.useRef("");
  const hasHydratedInputRef = React.useRef(false);
  const hasHandledUrlRef = React.useRef(false);

  const paramsForHistory = React.useMemo(
    () => ({
      theme: state.theme,
      pngScale: state.pngScale,
    }),
    [state.pngScale, state.theme],
  );

  React.useEffect(() => {
    if (hasHydratedInputRef.current) return;
    if (hydrationSource === "default") return;
    lastInputRef.current = state.source;
    hasHydratedInputRef.current = true;
  }, [hydrationSource, state.source]);

  React.useEffect(() => {
    if (state.source === lastInputRef.current) return;
    const timer = setTimeout(() => {
      lastInputRef.current = state.source;
      addHistoryEntry(
        { source: state.source },
        paramsForHistory,
        "left",
        state.source.slice(0, 120),
      );
    }, DEFAULT_URL_SYNC_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [addHistoryEntry, paramsForHistory, state.source]);

  React.useEffect(() => {
    if (hasUrlParams && !hasHandledUrlRef.current) {
      hasHandledUrlRef.current = true;
      if (state.source) {
        addHistoryEntry(
          { source: state.source },
          paramsForHistory,
          "left",
          state.source.slice(0, 120),
        );
      } else {
        updateHistoryParams(paramsForHistory);
      }
    }
  }, [
    addHistoryEntry,
    hasUrlParams,
    paramsForHistory,
    state.source,
    updateHistoryParams,
  ]);

  React.useEffect(() => {
    updateHistoryParams(paramsForHistory);
  }, [paramsForHistory, updateHistoryParams]);

  return (
    <div className="space-y-4 py-4 sm:py-6">
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Diagram Source</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>Theme</Label>
              <Select
                value={state.theme}
                onValueChange={(value) =>
                  setParam(
                    "theme",
                    value as z.infer<typeof paramsSchema>["theme"],
                    true,
                  )
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="default">Default</SelectItem>
                  <SelectItem value="neutral">Neutral</SelectItem>
                  <SelectItem value="forest">Forest</SelectItem>
                  <SelectItem value="dark">Dark</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>PNG Scale</Label>
              <Input
                type="number"
                min={1}
                max={4}
                step={0.5}
                value={state.pngScale}
                onChange={(event) =>
                  setParam("pngScale", Number(event.target.value) || 2, true)
                }
              />
            </div>
          </div>
          <Textarea
            value={state.source}
            onChange={(event) => setParam("source", event.target.value)}
            className="min-h-[180px] font-mono text-xs"
          />
          {oversizeKeys.includes("source") ? (
            <p className="text-xs text-muted-foreground">
              Input exceeds 2 KB and is not synced to the URL.
            </p>
          ) : null}
          <div className="flex flex-wrap gap-2">
            <Button type="button" onClick={() => void onRender()}>
              Render Diagram
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={() => void onGeneratePng()}
            >
              Render PNG
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={onDownloadSvg}
              disabled={!svgText}
            >
              Download SVG
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={onDownloadPng}
              disabled={!pngDataUrl}
            >
              Download PNG
            </Button>
          </div>
          {error ? <p className="text-xs text-destructive">{error}</p> : null}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Preview</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="overflow-auto rounded border bg-background p-3">
            {svgText ? (
              <div
                className="min-h-[120px]"
                dangerouslySetInnerHTML={{ __html: svgText }}
              />
            ) : (
              <p className="text-xs text-muted-foreground">
                No SVG rendered yet.
              </p>
            )}
          </div>
          {pngDataUrl ? (
            <img
              src={pngDataUrl}
              alt="Mermaid PNG preview"
              className="max-w-full rounded border"
            />
          ) : null}
        </CardContent>
      </Card>
    </div>
  );
}
