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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  formatBytes,
  optimizeImageFile,
  type ImageOutputFormat,
} from "@/lib/utility/image-optimizer";

const paramsSchema = z.object({
  outputFormat: z
    .enum(["image/jpeg", "image/png", "image/webp", "image/avif"])
    .default("image/webp"),
  quality: z.coerce.number().min(0.1).max(1).default(0.8),
  maxWidth: z.coerce.number().int().min(1).max(12000).default(1920),
  maxHeight: z.coerce.number().int().min(1).max(12000).default(1080),
  fileName: z.string().default(""),
});

export default function ImageOptimizerPage() {
  return (
    <Suspense fallback={null}>
      <ImageOptimizerContent />
    </Suspense>
  );
}

function ImageOptimizerContent() {
  const { state, setParam, hasUrlParams, hydrationSource } = useUrlSyncedState(
    "image-optimizer",
    {
      schema: paramsSchema,
      defaults: paramsSchema.parse({}),
    },
  );

  const [sourceFile, setSourceFile] = React.useState<File | null>(null);
  const [sourceUrl, setSourceUrl] = React.useState("");
  const [optimizedUrl, setOptimizedUrl] = React.useState("");
  const [optimizedBlob, setOptimizedBlob] = React.useState<Blob | null>(null);
  const [optimizedSize, setOptimizedSize] = React.useState<{
    width: number;
    height: number;
  } | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [isWorking, setIsWorking] = React.useState(false);

  React.useEffect(() => {
    return () => {
      if (sourceUrl) URL.revokeObjectURL(sourceUrl);
      if (optimizedUrl) URL.revokeObjectURL(optimizedUrl);
    };
  }, [optimizedUrl, sourceUrl]);

  const handleLoadHistory = React.useCallback(
    (entry: HistoryEntry) => {
      const { inputs, params } = entry;
      if (inputs.fileName !== undefined) setParam("fileName", inputs.fileName);
      if (params.outputFormat)
        setParam("outputFormat", params.outputFormat as ImageOutputFormat);
      if (params.quality !== undefined)
        setParam("quality", params.quality as number);
      if (params.maxWidth !== undefined)
        setParam("maxWidth", params.maxWidth as number);
      if (params.maxHeight !== undefined)
        setParam("maxHeight", params.maxHeight as number);
    },
    [setParam],
  );

  const handleFileChange = React.useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0] || null;
      setError(null);
      if (!file) return;
      setSourceFile(file);
      setParam("fileName", file.name);

      if (sourceUrl) URL.revokeObjectURL(sourceUrl);
      const nextSourceUrl = URL.createObjectURL(file);
      setSourceUrl(nextSourceUrl);

      if (optimizedUrl) {
        URL.revokeObjectURL(optimizedUrl);
      }
      setOptimizedUrl("");
      setOptimizedBlob(null);
      setOptimizedSize(null);
    },
    [optimizedUrl, setParam, sourceUrl],
  );

  const handleOptimize = React.useCallback(async () => {
    if (!sourceFile) {
      setError("Choose an image file first.");
      return;
    }

    setError(null);
    setIsWorking(true);
    try {
      const optimized = await optimizeImageFile(sourceFile, {
        maxWidth: state.maxWidth,
        maxHeight: state.maxHeight,
        quality: state.quality,
        outputFormat: state.outputFormat,
      });
      const nextUrl = URL.createObjectURL(optimized.blob);
      if (optimizedUrl) URL.revokeObjectURL(optimizedUrl);
      setOptimizedUrl(nextUrl);
      setOptimizedBlob(optimized.blob);
      setOptimizedSize({ width: optimized.width, height: optimized.height });
    } catch (caught) {
      console.error(caught);
      setError(
        caught instanceof Error ? caught.message : "Failed to optimize image.",
      );
    } finally {
      setIsWorking(false);
    }
  }, [
    optimizedUrl,
    sourceFile,
    state.maxHeight,
    state.maxWidth,
    state.outputFormat,
    state.quality,
  ]);

  const handleDownload = React.useCallback(() => {
    if (!optimizedUrl || !optimizedBlob) return;
    const extension =
      state.outputFormat === "image/jpeg"
        ? "jpg"
        : state.outputFormat === "image/png"
          ? "png"
          : state.outputFormat === "image/avif"
            ? "avif"
            : "webp";
    const baseName = state.fileName.replace(/\.[^.]+$/, "") || "optimized";
    const anchor = document.createElement("a");
    anchor.href = optimizedUrl;
    anchor.download = `${baseName}.${extension}`;
    anchor.click();
  }, [optimizedBlob, optimizedUrl, state.fileName, state.outputFormat]);

  return (
    <ToolPageWrapper
      toolId="image-optimizer"
      title="Image Optimizer"
      description="Resize, recompress, and convert images directly in your browser."
      onLoadHistory={handleLoadHistory}
    >
      <ImageOptimizerInner
        state={state}
        setParam={setParam}
        hasUrlParams={hasUrlParams}
        hydrationSource={hydrationSource}
        sourceFile={sourceFile}
        sourceUrl={sourceUrl}
        optimizedUrl={optimizedUrl}
        optimizedBlob={optimizedBlob}
        optimizedSize={optimizedSize}
        isWorking={isWorking}
        error={error}
        onFileChange={handleFileChange}
        onOptimize={handleOptimize}
        onDownload={handleDownload}
      />
    </ToolPageWrapper>
  );
}

function ImageOptimizerInner({
  state,
  setParam,
  hasUrlParams,
  hydrationSource,
  sourceFile,
  sourceUrl,
  optimizedUrl,
  optimizedBlob,
  optimizedSize,
  isWorking,
  error,
  onFileChange,
  onOptimize,
  onDownload,
}: {
  state: z.infer<typeof paramsSchema>;
  setParam: <K extends keyof z.infer<typeof paramsSchema>>(
    key: K,
    value: z.infer<typeof paramsSchema>[K],
    immediate?: boolean,
  ) => void;
  hasUrlParams: boolean;
  hydrationSource: "default" | "url" | "history";
  sourceFile: File | null;
  sourceUrl: string;
  optimizedUrl: string;
  optimizedBlob: Blob | null;
  optimizedSize: { width: number; height: number } | null;
  isWorking: boolean;
  error: string | null;
  onFileChange: (event: React.ChangeEvent<HTMLInputElement>) => void;
  onOptimize: () => Promise<void>;
  onDownload: () => void;
}) {
  const { addHistoryEntry, updateHistoryParams } = useToolHistoryContext();
  const lastInputRef = React.useRef("");
  const hasHydratedInputRef = React.useRef(false);
  const hasHandledUrlRef = React.useRef(false);

  const paramsForHistory = React.useMemo(
    () => ({
      outputFormat: state.outputFormat,
      quality: state.quality,
      maxWidth: state.maxWidth,
      maxHeight: state.maxHeight,
    }),
    [state.maxHeight, state.maxWidth, state.outputFormat, state.quality],
  );

  React.useEffect(() => {
    if (hasHydratedInputRef.current) return;
    if (hydrationSource === "default") return;
    lastInputRef.current = state.fileName;
    hasHydratedInputRef.current = true;
  }, [hydrationSource, state.fileName]);

  React.useEffect(() => {
    if (state.fileName === lastInputRef.current) return;
    const timer = setTimeout(() => {
      lastInputRef.current = state.fileName;
      addHistoryEntry(
        { fileName: state.fileName },
        paramsForHistory,
        "left",
        state.fileName.slice(0, 120),
      );
    }, DEFAULT_URL_SYNC_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [addHistoryEntry, paramsForHistory, state.fileName]);

  React.useEffect(() => {
    if (hasUrlParams && !hasHandledUrlRef.current) {
      hasHandledUrlRef.current = true;
      if (state.fileName) {
        addHistoryEntry(
          { fileName: state.fileName },
          paramsForHistory,
          "left",
          state.fileName.slice(0, 120),
        );
      } else {
        updateHistoryParams(paramsForHistory);
      }
    }
  }, [
    addHistoryEntry,
    hasUrlParams,
    paramsForHistory,
    state.fileName,
    updateHistoryParams,
  ]);

  React.useEffect(() => {
    updateHistoryParams(paramsForHistory);
  }, [paramsForHistory, updateHistoryParams]);

  return (
    <div className="space-y-4 py-4 sm:py-6">
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Optimization Settings</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <Input type="file" accept="image/*" onChange={onFileChange} />
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <div className="space-y-2">
              <Label>Output Format</Label>
              <Select
                value={state.outputFormat}
                onValueChange={(value) =>
                  setParam("outputFormat", value as ImageOutputFormat, true)
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="image/webp">WebP</SelectItem>
                  <SelectItem value="image/jpeg">JPEG</SelectItem>
                  <SelectItem value="image/png">PNG</SelectItem>
                  <SelectItem value="image/avif">AVIF</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Quality (0.1-1.0)</Label>
              <Input
                type="number"
                min={0.1}
                max={1}
                step={0.05}
                value={state.quality}
                onChange={(event) =>
                  setParam("quality", Number(event.target.value) || 0.8, true)
                }
              />
            </div>
            <div className="space-y-2">
              <Label>Max Width</Label>
              <Input
                type="number"
                min={1}
                value={state.maxWidth}
                onChange={(event) =>
                  setParam("maxWidth", Number(event.target.value) || 1, true)
                }
              />
            </div>
            <div className="space-y-2">
              <Label>Max Height</Label>
              <Input
                type="number"
                min={1}
                value={state.maxHeight}
                onChange={(event) =>
                  setParam("maxHeight", Number(event.target.value) || 1, true)
                }
              />
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              onClick={() => void onOptimize()}
              disabled={!sourceFile || isWorking}
            >
              {isWorking ? "Optimizing..." : "Optimize Image"}
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={onDownload}
              disabled={!optimizedUrl}
            >
              Download Optimized
            </Button>
          </div>
          {error ? <p className="text-xs text-destructive">{error}</p> : null}
          {sourceFile ? (
            <p className="text-xs text-muted-foreground">
              Source: {sourceFile.name} ({formatBytes(sourceFile.size)})
            </p>
          ) : null}
          {optimizedBlob && optimizedSize ? (
            <p className="text-xs text-muted-foreground">
              Optimized: {formatBytes(optimizedBlob.size)} (
              {optimizedSize.width}x{optimizedSize.height})
            </p>
          ) : null}
        </CardContent>
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Original</CardTitle>
          </CardHeader>
          <CardContent>
            {sourceUrl ? (
              <img
                src={sourceUrl}
                alt="Original upload"
                className="max-h-[400px] w-full rounded border object-contain"
              />
            ) : (
              <p className="text-xs text-muted-foreground">
                No image selected.
              </p>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Optimized</CardTitle>
          </CardHeader>
          <CardContent>
            {optimizedUrl ? (
              <img
                src={optimizedUrl}
                alt="Optimized output"
                className="max-h-[400px] w-full rounded border object-contain"
              />
            ) : (
              <p className="text-xs text-muted-foreground">
                No optimized image yet.
              </p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
