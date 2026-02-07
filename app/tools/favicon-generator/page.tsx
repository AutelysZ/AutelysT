"use client";

import * as React from "react";
import { Suspense } from "react";
import { z } from "zod";
import icoEndec from "ico-endec";
import JSZip from "jszip";
import { Buffer } from "buffer";
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
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Upload, Download, RefreshCw, Trash2 } from "lucide-react";
import type { HistoryEntry } from "@/lib/history/db";
import { cn } from "@/lib/utils";

const SIZE_OPTIONS = [16, 32, 48, 64, 128, 256];

const paramsSchema = z.object({
  fileName: z.string().default(""),
  sizes: z.string().default("16,32,48,64,128,256"),
  backgroundMode: z.enum(["transparent", "solid"]).default("transparent"),
  backgroundColor: z.string().default("#ffffff"),
  includeIco: z.boolean().default(true),
  includePngZip: z.boolean().default(true),
});

type PreviewItem = { size: number; url: string; name: string };

type OutputState = {
  status: "success" | "error";
  message: string;
  downloadUrl?: string;
  downloadName?: string;
};

function parseSizes(value: string): number[] {
  const sizes = value
    .split(",")
    .map((part) => Number.parseInt(part.trim(), 10))
    .filter((size) => Number.isFinite(size) && size > 0);
  return Array.from(new Set(sizes)).sort((a, b) => a - b);
}

function serializeSizes(sizes: number[]): string {
  return sizes.sort((a, b) => a - b).join(",");
}

function fileBaseName(name: string) {
  const index = name.lastIndexOf(".");
  if (index === -1) return name;
  return name.slice(0, index);
}

function readAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("Failed to read file"));
    reader.onload = () => resolve(String(reader.result));
    reader.readAsDataURL(file);
  });
}

function loadImage(dataUrl: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("Failed to load image"));
    image.src = dataUrl;
  });
}

function canvasToBlob(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) resolve(blob);
      else reject(new Error("Failed to render PNG"));
    }, "image/png");
  });
}

function ensureBufferGlobal() {
  const globalScope = globalThis as typeof globalThis & {
    Buffer?: typeof Buffer;
  };
  if (!globalScope.Buffer) {
    globalScope.Buffer = Buffer;
  }
}

export default function FaviconGeneratorPage() {
  return (
    <Suspense fallback={null}>
      <FaviconGeneratorContent />
    </Suspense>
  );
}

function FaviconGeneratorContent() {
  const { state, setParam, oversizeKeys, hasUrlParams, hydrationSource } =
    useUrlSyncedState("favicon-generator", {
      schema: paramsSchema,
      defaults: paramsSchema.parse({}),
      restoreMissingKeys: (key) => key === "fileName",
    });

  const handleLoadHistory = React.useCallback(
    (entry: HistoryEntry) => {
      const { inputs, params } = entry;
      if (inputs.fileName !== undefined) setParam("fileName", inputs.fileName);
      if (params.sizes) setParam("sizes", params.sizes as string);
      if (params.backgroundMode)
        setParam(
          "backgroundMode",
          params.backgroundMode as z.infer<
            typeof paramsSchema
          >["backgroundMode"],
        );
      if (params.backgroundColor)
        setParam("backgroundColor", params.backgroundColor as string);
      if (params.includeIco !== undefined)
        setParam("includeIco", params.includeIco as boolean);
      if (params.includePngZip !== undefined)
        setParam("includePngZip", params.includePngZip as boolean);
    },
    [setParam],
  );

  return (
    <ToolPageWrapper
      toolId="favicon-generator"
      title="Favicon Generator"
      description="Generate ICO and PNG favicon assets from a single image"
      onLoadHistory={handleLoadHistory}
    >
      <FaviconGeneratorInner
        state={state}
        setParam={setParam}
        oversizeKeys={oversizeKeys}
        hasUrlParams={hasUrlParams}
        hydrationSource={hydrationSource}
      />
    </ToolPageWrapper>
  );
}

function FaviconGeneratorInner({
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
  const [file, setFile] = React.useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = React.useState<string | null>(null);
  const [previews, setPreviews] = React.useState<PreviewItem[]>([]);
  const [icoOutput, setIcoOutput] = React.useState<OutputState | null>(null);
  const [zipOutput, setZipOutput] = React.useState<OutputState | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [isGenerating, setIsGenerating] = React.useState(false);
  const fileInputRef = React.useRef<HTMLInputElement>(null);
  const lastInputRef = React.useRef<string>("");
  const hasHydratedInputRef = React.useRef(false);
  const paramsRef = React.useRef({
    sizes: state.sizes,
    backgroundMode: state.backgroundMode,
    backgroundColor: state.backgroundColor,
    includeIco: state.includeIco,
    includePngZip: state.includePngZip,
  });
  const hasInitializedParamsRef = React.useRef(false);
  const hasHandledUrlRef = React.useRef(false);
  const outputUrlsRef = React.useRef<string[]>([]);

  const revokeOutputUrls = React.useCallback(() => {
    outputUrlsRef.current.forEach((url) => URL.revokeObjectURL(url));
    outputUrlsRef.current = [];
  }, []);

  React.useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
      previews.forEach((item) => URL.revokeObjectURL(item.url));
    };
  }, [previewUrl, previews]);

  React.useEffect(() => {
    return () => {
      revokeOutputUrls();
    };
  }, [revokeOutputUrls]);

  React.useEffect(() => {
    if (hasHydratedInputRef.current) return;
    if (hydrationSource === "default") return;
    lastInputRef.current = JSON.stringify({
      fileName: state.fileName,
      sizes: state.sizes,
      backgroundMode: state.backgroundMode,
      backgroundColor: state.backgroundColor,
      includeIco: state.includeIco,
      includePngZip: state.includePngZip,
    });
    hasHydratedInputRef.current = true;
  }, [
    hydrationSource,
    state.fileName,
    state.sizes,
    state.backgroundMode,
    state.backgroundColor,
    state.includeIco,
    state.includePngZip,
  ]);

  React.useEffect(() => {
    const snapshot = JSON.stringify({
      fileName: state.fileName,
      sizes: state.sizes,
      backgroundMode: state.backgroundMode,
      backgroundColor: state.backgroundColor,
      includeIco: state.includeIco,
      includePngZip: state.includePngZip,
    });
    if (snapshot === lastInputRef.current) return;

    const timer = setTimeout(() => {
      lastInputRef.current = snapshot;
      upsertInputEntry(
        { fileName: state.fileName },
        {
          sizes: state.sizes,
          backgroundMode: state.backgroundMode,
          backgroundColor: state.backgroundColor,
          includeIco: state.includeIco,
          includePngZip: state.includePngZip,
        },
        "left",
        state.fileName || "favicon",
      );
    }, DEFAULT_URL_SYNC_DEBOUNCE_MS);

    return () => clearTimeout(timer);
  }, [
    state.fileName,
    state.sizes,
    state.backgroundMode,
    state.backgroundColor,
    state.includeIco,
    state.includePngZip,
    upsertInputEntry,
  ]);

  React.useEffect(() => {
    if (hasUrlParams && !hasHandledUrlRef.current) {
      hasHandledUrlRef.current = true;
      if (state.fileName) {
        upsertInputEntry(
          { fileName: state.fileName },
          {
            sizes: state.sizes,
            backgroundMode: state.backgroundMode,
            backgroundColor: state.backgroundColor,
            includeIco: state.includeIco,
            includePngZip: state.includePngZip,
          },
          "left",
          state.fileName,
        );
      } else {
        upsertParams(
          {
            sizes: state.sizes,
            backgroundMode: state.backgroundMode,
            backgroundColor: state.backgroundColor,
            includeIco: state.includeIco,
            includePngZip: state.includePngZip,
          },
          "interpretation",
        );
      }
    }
  }, [
    hasUrlParams,
    state.fileName,
    state.sizes,
    state.backgroundMode,
    state.backgroundColor,
    state.includeIco,
    state.includePngZip,
    upsertInputEntry,
    upsertParams,
  ]);

  React.useEffect(() => {
    const nextParams = {
      sizes: state.sizes,
      backgroundMode: state.backgroundMode,
      backgroundColor: state.backgroundColor,
      includeIco: state.includeIco,
      includePngZip: state.includePngZip,
    };
    if (!hasInitializedParamsRef.current) {
      hasInitializedParamsRef.current = true;
      paramsRef.current = nextParams;
      return;
    }
    if (JSON.stringify(paramsRef.current) === JSON.stringify(nextParams))
      return;
    paramsRef.current = nextParams;
    upsertParams(nextParams, "interpretation");
  }, [
    state.sizes,
    state.backgroundMode,
    state.backgroundColor,
    state.includeIco,
    state.includePngZip,
    upsertParams,
  ]);

  const selectedSizes = parseSizes(state.sizes);

  const toggleSize = (size: number) => {
    const next = new Set(selectedSizes);
    if (next.has(size)) next.delete(size);
    else next.add(size);
    const serialized = serializeSizes(Array.from(next));
    setParam("sizes", serialized, true);
  };

  const handleFileSelect = (nextFile: File | null) => {
    if (!nextFile) return;
    setFile(nextFile);
    setParam("fileName", nextFile.name, true);
    setError(null);
    setIcoOutput(null);
    setZipOutput(null);
    revokeOutputUrls();
    previews.forEach((item) => URL.revokeObjectURL(item.url));
    setPreviews([]);

    if (previewUrl) URL.revokeObjectURL(previewUrl);
    const url = URL.createObjectURL(nextFile);
    setPreviewUrl(url);
  };

  const handleGenerate = async () => {
    if (!file) {
      setError("Upload an image before generating.");
      return;
    }
    if (!selectedSizes.length) {
      setError("Select at least one size.");
      return;
    }

    setIsGenerating(true);
    setError(null);
    setIcoOutput(null);
    setZipOutput(null);
    revokeOutputUrls();

    try {
      const dataUrl = await readAsDataUrl(file);
      const image = await loadImage(dataUrl);
      const baseName = fileBaseName(file.name || "favicon");
      const nextPreviews: PreviewItem[] = [];
      const pngBuffers: ArrayBuffer[] = [];
      const pngBlobs: { name: string; blob: Blob }[] = [];

      for (const size of selectedSizes) {
        const canvas = document.createElement("canvas");
        canvas.width = size;
        canvas.height = size;
        const ctx = canvas.getContext("2d");
        if (!ctx) {
          throw new Error("Canvas rendering failed");
        }

        if (state.backgroundMode === "solid") {
          ctx.fillStyle = state.backgroundColor;
          ctx.fillRect(0, 0, size, size);
        } else {
          ctx.clearRect(0, 0, size, size);
        }

        const scale = Math.min(size / image.width, size / image.height);
        const drawWidth = image.width * scale;
        const drawHeight = image.height * scale;
        const offsetX = (size - drawWidth) / 2;
        const offsetY = (size - drawHeight) / 2;
        ctx.drawImage(image, offsetX, offsetY, drawWidth, drawHeight);

        const blob = await canvasToBlob(canvas);
        const buffer = await blob.arrayBuffer();
        const name = `${baseName}-${size}x${size}.png`;
        pngBuffers.push(buffer);
        pngBlobs.push({ name, blob });

        const previewUrl = URL.createObjectURL(blob);
        nextPreviews.push({ size, url: previewUrl, name });
      }

      setPreviews(nextPreviews);

      if (state.includeIco) {
        ensureBufferGlobal();
        const icoBuffer = icoEndec.encode(pngBuffers);
        const icoBlob = new Blob([icoBuffer], {
          type: "image/x-icon",
        });
        const icoUrl = URL.createObjectURL(icoBlob);
        outputUrlsRef.current.push(icoUrl);
        setIcoOutput({
          status: "success",
          message: `Generated ${selectedSizes.length} sizes into .ico`,
          downloadUrl: icoUrl,
          downloadName: `${baseName}.ico`,
        });
      }

      if (state.includePngZip) {
        const zip = new JSZip();
        for (const entry of pngBlobs) {
          zip.file(entry.name, entry.blob);
        }
        const zipBlob = await zip.generateAsync({ type: "blob" });
        const zipUrl = URL.createObjectURL(zipBlob);
        outputUrlsRef.current.push(zipUrl);
        setZipOutput({
          status: "success",
          message: "PNG set ready",
          downloadUrl: zipUrl,
          downloadName: `${baseName}-pngs.zip`,
        });
      }
    } catch (err) {
      console.error("Favicon generation failed", err);
      setError(err instanceof Error ? err.message : "Generation failed");
    } finally {
      setIsGenerating(false);
    }
  };

  const clearFile = () => {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    previews.forEach((item) => URL.revokeObjectURL(item.url));
    setPreviewUrl(null);
    setPreviews([]);
    setFile(null);
    setParam("fileName", "", true);
    setError(null);
    setIcoOutput(null);
    setZipOutput(null);
    revokeOutputUrls();
  };

  const showOversizeWarning = oversizeKeys.includes("sizes");

  return (
    <div className="flex flex-col gap-4">
      <Card>
        <CardContent className="flex flex-wrap items-center gap-4 p-4">
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => {
              handleFileSelect(e.target.files?.[0] ?? null);
              e.target.value = "";
            }}
          />
          <Button
            variant="secondary"
            onClick={() => fileInputRef.current?.click()}
            className="gap-2"
          >
            <Upload className="h-4 w-4" />
            Select Image
          </Button>
          {state.fileName && (
            <div className="text-sm text-muted-foreground">
              <div className="font-medium text-foreground">
                {state.fileName}
              </div>
              <div>Selected</div>
            </div>
          )}
          {state.fileName && (
            <Button variant="ghost" size="sm" onClick={clearFile}>
              <Trash2 className="mr-2 h-4 w-4" />
              Clear
            </Button>
          )}
        </CardContent>
      </Card>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <Card>
          <CardContent className="flex flex-col gap-4 p-4">
            <div className="text-sm font-medium">Source Preview</div>
            {previewUrl ? (
              <img
                src={previewUrl}
                alt="Source preview"
                className="max-h-[320px] w-full rounded-md border object-contain"
              />
            ) : (
              <div className="flex h-[240px] items-center justify-center rounded-md border border-dashed text-sm text-muted-foreground">
                Upload an image to generate favicons.
              </div>
            )}
            <div className="flex flex-wrap gap-3">
              <Button
                onClick={handleGenerate}
                disabled={isGenerating || !file}
                className="gap-2"
              >
                <RefreshCw
                  className={cn("h-4 w-4", isGenerating && "animate-spin")}
                />
                Generate
              </Button>
              {error && <p className="text-xs text-destructive">{error}</p>}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="flex flex-col gap-4 p-4">
            <div className="text-sm font-medium">Settings</div>
            <div className="grid gap-3">
              <div className="space-y-2">
                <Label className="text-sm">Sizes</Label>
                <div className="flex flex-wrap gap-2">
                  {SIZE_OPTIONS.map((size) => (
                    <label
                      key={size}
                      className="flex items-center gap-2 rounded-md border px-2 py-1 text-sm"
                    >
                      <Checkbox
                        checked={selectedSizes.includes(size)}
                        onCheckedChange={() => toggleSize(size)}
                      />
                      {size}x{size}
                    </label>
                  ))}
                </div>
              </div>

              <div className="space-y-2">
                <Label className="text-sm">Background</Label>
                <div className="flex flex-wrap items-center gap-3">
                  <label className="flex items-center gap-2 text-sm">
                    <Checkbox
                      checked={state.backgroundMode === "solid"}
                      onCheckedChange={(value) =>
                        setParam(
                          "backgroundMode",
                          value ? "solid" : "transparent",
                          true,
                        )
                      }
                    />
                    Solid
                  </label>
                  <Input
                    type="color"
                    value={state.backgroundColor}
                    onChange={(e) =>
                      setParam("backgroundColor", e.target.value, true)
                    }
                    disabled={state.backgroundMode !== "solid"}
                    className="h-9 w-20 p-1"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label className="text-sm">Outputs</Label>
                <div className="flex flex-wrap gap-3 text-sm">
                  <label className="flex items-center gap-2">
                    <Checkbox
                      checked={state.includeIco}
                      onCheckedChange={(value) =>
                        setParam("includeIco", Boolean(value), true)
                      }
                    />
                    .ico file
                  </label>
                  <label className="flex items-center gap-2">
                    <Checkbox
                      checked={state.includePngZip}
                      onCheckedChange={(value) =>
                        setParam("includePngZip", Boolean(value), true)
                      }
                    />
                    PNG zip
                  </label>
                </div>
              </div>
            </div>

            {showOversizeWarning && (
              <p className="text-xs text-muted-foreground">
                Some inputs exceed 2 KB and are not synced to the URL.
              </p>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardContent className="flex flex-col gap-4 p-4">
          <div className="text-sm font-medium">Generated Assets</div>
          {previews.length ? (
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
              {previews.map((item) => (
                <div
                  key={item.size}
                  className="flex flex-col items-center gap-2 rounded-md border p-2"
                >
                  <img
                    src={item.url}
                    alt={`${item.size}px`}
                    className="h-16 w-16"
                  />
                  <span className="text-xs text-muted-foreground">
                    {item.size}x{item.size}
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">
              Generated PNG previews will appear here.
            </p>
          )}

          <div className="flex flex-wrap gap-3">
            {icoOutput?.downloadUrl && (
              <Button asChild variant="secondary" size="sm">
                <a
                  href={icoOutput.downloadUrl}
                  download={icoOutput.downloadName}
                >
                  <Download className="mr-2 h-4 w-4" />
                  Download .ico
                </a>
              </Button>
            )}
            {zipOutput?.downloadUrl && (
              <Button asChild variant="secondary" size="sm">
                <a
                  href={zipOutput.downloadUrl}
                  download={zipOutput.downloadName}
                >
                  <Download className="mr-2 h-4 w-4" />
                  Download PNG Zip
                </a>
              </Button>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
