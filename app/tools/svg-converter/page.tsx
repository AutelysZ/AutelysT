"use client";

import * as React from "react";
import { Suspense, useCallback, useRef, useState } from "react";
import Editor from "@monaco-editor/react";
import { useTheme } from "next-themes";
import { z } from "zod";
import {
  ToolPageWrapper,
  useToolHistoryContext,
} from "@/components/tool-ui/tool-page-wrapper";
import {
  DEFAULT_URL_SYNC_DEBOUNCE_MS,
  useUrlSyncedState,
} from "@/lib/url-state/use-url-synced-state";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Download,
  Upload,
  ImageIcon,
  RefreshCw,
  Trash2,
  Link2,
  Sparkles,
} from "lucide-react";
import type { HistoryEntry } from "@/lib/history/db";

const paramsSchema = z.object({
  svgContent: z.string().default(""),
  svgFileName: z.string().default(""),
  width: z.number().default(512),
  height: z.number().default(512),
  originalSize: z.boolean().default(true),
  maintainAspectRatio: z.boolean().default(true),
  backgroundColor: z.string().default("transparent"),
});

export default function SvgConverterPage() {
  return (
    <Suspense fallback={null}>
      <SvgConverterContent />
    </Suspense>
  );
}

function SvgConverterContent() {
  const defaults = React.useMemo(() => paramsSchema.parse({}), []);
  const { state, setParam, oversizeKeys, hasUrlParams, hydrationSource } =
    useUrlSyncedState("svg-converter", {
      schema: paramsSchema,
      defaults,
      restoreMissingKeys: (key) =>
        key === "svgContent" || key === "svgFileName",
    });

  const handleLoadHistory = useCallback(
    (entry: HistoryEntry) => {
      const { inputs, params } = entry;
      if (inputs.svgContent !== undefined)
        setParam("svgContent", inputs.svgContent);
      if (params.svgFileName !== undefined)
        setParam("svgFileName", params.svgFileName as string);
      if (params.width !== undefined) setParam("width", params.width as number);
      if (params.height !== undefined)
        setParam("height", params.height as number);
      if (params.originalSize !== undefined)
        setParam("originalSize", params.originalSize as boolean);
      if (params.maintainAspectRatio !== undefined)
        setParam("maintainAspectRatio", params.maintainAspectRatio as boolean);
      if (params.backgroundColor !== undefined)
        setParam("backgroundColor", params.backgroundColor as string);
    },
    [setParam],
  );

  return (
    <ToolPageWrapper
      toolId="svg-converter"
      title="SVG Converter"
      description="Convert SVG to PNG with custom size, edit SVG content, and preview in real-time"
      onLoadHistory={handleLoadHistory}
    >
      <SvgConverterInner
        state={state}
        setParam={setParam}
        defaults={defaults}
        oversizeKeys={oversizeKeys}
        hasUrlParams={hasUrlParams}
        hydrationSource={hydrationSource}
      />
    </ToolPageWrapper>
  );
}

function SvgConverterInner({
  state,
  setParam,
  defaults,
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
  defaults: z.infer<typeof paramsSchema>;
  oversizeKeys: (keyof z.infer<typeof paramsSchema>)[];
  hasUrlParams: boolean;
  hydrationSource: "default" | "url" | "history";
}) {
  const { upsertInputEntry, upsertParams } = useToolHistoryContext();
  const { resolvedTheme } = useTheme();
  const [error, setError] = useState<string | null>(null);
  const [svgDimensions, setSvgDimensions] = useState<{
    width: number;
    height: number;
  } | null>(null);
  const [isConverting, setIsConverting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const lastInputRef = useRef<string>("");
  const hasHydratedInputRef = useRef(false);
  const sizeRef = useRef({ width: state.width, height: state.height });
  const paramsRef = useRef({
    svgFileName: state.svgFileName,
    width: state.width,
    height: state.height,
    originalSize: state.originalSize,
    maintainAspectRatio: state.maintainAspectRatio,
    backgroundColor: state.backgroundColor,
  });
  const hasInitializedParamsRef = useRef(false);
  const hasHandledUrlRef = useRef(false);
  const svgOriginalSizeLabel = svgDimensions
    ? `${Math.round(svgDimensions.width)}x${Math.round(svgDimensions.height)}`
    : "--x--";
  const svgRatio = React.useMemo(() => {
    if (!svgDimensions || svgDimensions.width <= 0) return 1;
    const ratio = svgDimensions.height / svgDimensions.width;
    return Number.isFinite(ratio) && ratio > 0 ? ratio : 1;
  }, [svgDimensions]);

  const handleClearSvg = useCallback(() => {
    const nextParams = {
      svgFileName: "",
      width: state.width,
      height: state.height,
      originalSize: state.originalSize,
      maintainAspectRatio: state.maintainAspectRatio,
      backgroundColor: state.backgroundColor,
    };
    lastInputRef.current = "";
    setParam("svgContent", "");
    setParam("svgFileName", "", true);
    setError(null);
    setSvgDimensions(null);
    upsertInputEntry({ svgContent: "" }, nextParams, undefined, "");
  }, [
    setParam,
    state.width,
    state.height,
    state.originalSize,
    state.maintainAspectRatio,
    state.backgroundColor,
    upsertInputEntry,
  ]);

  React.useEffect(() => {
    if (!state.maintainAspectRatio) {
      setParam("maintainAspectRatio", true, true);
    }
  }, [state.maintainAspectRatio, setParam]);

  React.useEffect(() => {
    sizeRef.current = { width: state.width, height: state.height };
  }, [state.width, state.height]);

  // History tracking effects
  React.useEffect(() => {
    if (hasHydratedInputRef.current) return;
    if (hydrationSource === "default") return;
    lastInputRef.current = state.svgContent;
    hasHydratedInputRef.current = true;
  }, [hydrationSource, state.svgContent]);

  React.useEffect(() => {
    if (!state.svgContent || state.svgContent === lastInputRef.current) return;

    const timer = setTimeout(() => {
      lastInputRef.current = state.svgContent;
      upsertInputEntry(
        { svgContent: state.svgContent },
        {
          svgFileName: state.svgFileName,
          width: state.width,
          height: state.height,
          originalSize: state.originalSize,
          maintainAspectRatio: state.maintainAspectRatio,
          backgroundColor: state.backgroundColor,
        },
        undefined,
        state.svgContent.slice(0, 100),
      );
    }, DEFAULT_URL_SYNC_DEBOUNCE_MS);

    return () => clearTimeout(timer);
  }, [
    state.svgContent,
    state.svgFileName,
    state.width,
    state.height,
    state.maintainAspectRatio,
    state.backgroundColor,
    upsertInputEntry,
  ]);

  React.useEffect(() => {
    if (hasUrlParams && !hasHandledUrlRef.current) {
      hasHandledUrlRef.current = true;
      if (state.svgContent) {
        upsertInputEntry(
          { svgContent: state.svgContent },
          {
            svgFileName: state.svgFileName,
            width: state.width,
            height: state.height,
            originalSize: state.originalSize,
            maintainAspectRatio: state.maintainAspectRatio,
            backgroundColor: state.backgroundColor,
          },
          undefined,
          state.svgContent.slice(0, 100),
        );
      } else {
        upsertParams(
          {
            svgFileName: state.svgFileName,
            width: state.width,
            height: state.height,
            originalSize: state.originalSize,
            maintainAspectRatio: state.maintainAspectRatio,
            backgroundColor: state.backgroundColor,
          },
          "interpretation",
        );
      }
    }
  }, [
    hasUrlParams,
    state.svgContent,
    state.svgFileName,
    state.width,
    state.height,
    state.maintainAspectRatio,
    state.backgroundColor,
    upsertInputEntry,
    upsertParams,
  ]);

  React.useEffect(() => {
    const nextParams = {
      svgFileName: state.svgFileName,
      width: state.width,
      height: state.height,
      originalSize: state.originalSize,
      maintainAspectRatio: state.maintainAspectRatio,
      backgroundColor: state.backgroundColor,
    };
    if (!hasInitializedParamsRef.current) {
      hasInitializedParamsRef.current = true;
      paramsRef.current = nextParams;
      return;
    }
    if (
      paramsRef.current.svgFileName === nextParams.svgFileName &&
      paramsRef.current.width === nextParams.width &&
      paramsRef.current.height === nextParams.height &&
      paramsRef.current.originalSize === nextParams.originalSize &&
      paramsRef.current.maintainAspectRatio ===
        nextParams.maintainAspectRatio &&
      paramsRef.current.backgroundColor === nextParams.backgroundColor
    ) {
      return;
    }
    paramsRef.current = nextParams;
    upsertParams(nextParams, "interpretation");
  }, [
    state.svgFileName,
    state.width,
    state.height,
    state.originalSize,
    state.maintainAspectRatio,
    state.backgroundColor,
    upsertParams,
  ]);

  // Parse SVG dimensions from content
  const parseSvgDimensions = useCallback(
    (svgString: string, updateSize: boolean) => {
      try {
        const parser = new DOMParser();
        const doc = parser.parseFromString(svgString, "image/svg+xml");
        const svg = doc.querySelector("svg");

        if (!svg) {
          setError("Invalid SVG: No <svg> element found");
          setSvgDimensions(null);
          return null;
        }

        const parserError = doc.querySelector("parsererror");
        if (parserError) {
          setError("Invalid SVG: " + parserError.textContent?.slice(0, 100));
          setSvgDimensions(null);
          return null;
        }

        let width = 0;
        let height = 0;

        // Try to get dimensions from width/height attributes
        const widthAttr = svg.getAttribute("width");
        const heightAttr = svg.getAttribute("height");

        if (widthAttr && heightAttr) {
          width = parseFloat(widthAttr) || 0;
          height = parseFloat(heightAttr) || 0;
        }

        // If no width/height, try viewBox
        if ((!width || !height) && svg.getAttribute("viewBox")) {
          const viewBox = svg
            .getAttribute("viewBox")!
            .split(/\s+|,/)
            .map(Number);
          if (viewBox.length >= 4) {
            width = viewBox[2];
            height = viewBox[3];
          }
        }

        // Default fallback
        if (!width) width = 100;
        if (!height) height = 100;

        setError(null);
        const dimensions = { width, height };
        setSvgDimensions(dimensions);

        if (updateSize && width && height) {
          setParam("width", Math.round(width), true);
          setParam("height", Math.round(height), true);
        }

        return dimensions;
      } catch {
        setError("Failed to parse SVG");
        setSvgDimensions(null);
        return null;
      }
    },
    [setParam],
  );

  React.useEffect(() => {
    if (!state.svgContent.trim()) {
      setError(null);
      setSvgDimensions(null);
      return;
    }

    const timer = setTimeout(() => {
      const dimensions = parseSvgDimensions(
        state.svgContent,
        state.originalSize,
      );
      if (!dimensions) return;
      if (!state.originalSize) {
        const ratio =
          dimensions.width > 0 ? dimensions.height / dimensions.width : 1;
        const normalized = Number.isFinite(ratio) && ratio > 0 ? ratio : 1;
        const nextHeight = Math.max(
          1,
          Math.round(sizeRef.current.width * normalized),
        );
        if (nextHeight !== sizeRef.current.height) {
          setParam("height", nextHeight, true);
        }
      }
    }, DEFAULT_URL_SYNC_DEBOUNCE_MS);

    return () => clearTimeout(timer);
  }, [state.svgContent, state.originalSize, parseSvgDimensions, setParam]);

  // Handle SVG content change
  const handleSvgChange = useCallback(
    (value: string) => {
      setParam("svgContent", value);
      if (!value.trim()) {
        setError(null);
        setSvgDimensions(null);
      }
    },
    [setParam],
  );

  const formatSvg = useCallback(async (value: string) => {
    const prettierModule = await import("prettier/standalone");
    const parserHtmlModule = await import("prettier/parser-html");
    const prettier =
      "default" in prettierModule ? prettierModule.default : prettierModule;
    const parserHtml =
      "default" in parserHtmlModule
        ? parserHtmlModule.default
        : parserHtmlModule;
    const formatted = await prettier.format(value, {
      parser: "html",
      plugins: [parserHtml],
      printWidth: 80,
    });
    return formatted.trim();
  }, []);

  const handlePrettyPrint = useCallback(async () => {
    if (!state.svgContent.trim()) return;
    try {
      const formatted = await formatSvg(state.svgContent);
      handleSvgChange(formatted);
    } catch (err) {
      console.error("Failed to pretty print SVG", err);
      setError(
        err instanceof Error ? err.message : "Failed to pretty print SVG",
      );
    }
  }, [formatSvg, handleSvgChange, state.svgContent]);

  // Handle file upload
  const handleFileUpload = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;

      if (!file.type.includes("svg") && !file.name.endsWith(".svg")) {
        setError("Please upload an SVG file");
        return;
      }

      try {
        const text = await file.text();
        handleSvgChange(text);
        setParam("svgFileName", file.name, true);
      } catch {
        setError("Failed to read file");
        setParam("svgFileName", "", true);
      }

      // Reset input
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    },
    [handleSvgChange, setParam],
  );

  // Handle width change with aspect ratio
  const handleWidthChange = useCallback(
    (value: string) => {
      if (state.originalSize) return;
      const newWidth = parseInt(value) || 0;
      setParam("width", newWidth, true);

      const nextHeight = Math.max(1, Math.round(newWidth * svgRatio));
      if (nextHeight !== state.height) {
        setParam("height", nextHeight, true);
      }
    },
    [setParam, state.originalSize, state.height, svgRatio],
  );

  // Handle height change with aspect ratio
  const handleHeightChange = useCallback(
    (value: string) => {
      if (state.originalSize) return;
      const newHeight = parseInt(value) || 0;
      setParam("height", newHeight, true);

      const nextWidth = Math.max(1, Math.round(newHeight * (1 / svgRatio)));
      if (nextWidth !== state.width) {
        setParam("width", nextWidth, true);
      }
    },
    [setParam, state.originalSize, state.width, svgRatio],
  );

  // Convert SVG to PNG and download
  const convertAndDownload = useCallback(async () => {
    if (!state.svgContent || !state.width || !state.height) return;

    setIsConverting(true);
    setError(null);

    try {
      const canvas = canvasRef.current;
      if (!canvas) throw new Error("Canvas not available");

      const ctx = canvas.getContext("2d");
      if (!ctx) throw new Error("Canvas context not available");

      canvas.width = state.width;
      canvas.height = state.height;

      // Clear canvas with background color
      if (state.backgroundColor === "transparent") {
        ctx.clearRect(0, 0, state.width, state.height);
      } else {
        ctx.fillStyle = state.backgroundColor;
        ctx.fillRect(0, 0, state.width, state.height);
      }

      // Create blob from SVG
      const svgBlob = new Blob([state.svgContent], {
        type: "image/svg+xml;charset=utf-8",
      });
      const url = URL.createObjectURL(svgBlob);

      const img = new window.Image();
      img.crossOrigin = "anonymous";

      await new Promise<void>((resolve, reject) => {
        img.onload = () => {
          ctx.drawImage(img, 0, 0, state.width, state.height);
          URL.revokeObjectURL(url);
          resolve();
        };
        img.onerror = () => {
          URL.revokeObjectURL(url);
          reject(new Error("Failed to load SVG image"));
        };
        img.src = url;
      });

      // Convert to PNG and download
      canvas.toBlob((blob) => {
        if (!blob) {
          setError("Failed to create PNG");
          setIsConverting(false);
          return;
        }

        const downloadUrl = URL.createObjectURL(blob);
        const a = document.createElement("a");
        const rawName = state.svgFileName.trim();
        const baseName = rawName ? rawName.replace(/\.svg$/i, "") : "converted";
        a.href = downloadUrl;
        a.download = `${baseName}-${state.width}x${state.height}.png`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(downloadUrl);
        setIsConverting(false);
      }, "image/png");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Conversion failed");
      setIsConverting(false);
    }
  }, [
    state.svgContent,
    state.svgFileName,
    state.width,
    state.height,
    state.backgroundColor,
  ]);

  // Create preview URL
  const previewUrl = React.useMemo(() => {
    if (!state.svgContent) return null;
    try {
      const blob = new Blob([state.svgContent], {
        type: "image/svg+xml;charset=utf-8",
      });
      return URL.createObjectURL(blob);
    } catch {
      return null;
    }
  }, [state.svgContent]);

  // Cleanup preview URL
  React.useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
  }, [previewUrl]);

  const oversizeWarning = oversizeKeys.includes("svgContent")
    ? "SVG content exceeds 2 KB and is not synced to the URL."
    : null;

  return (
    <div className="space-y-6">
      {/* Hidden canvas for conversion */}
      <canvas ref={canvasRef} className="hidden" />

      {/* Upload and Controls */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-medium">Settings</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap items-stretch gap-6">
            <div className="flex flex-col gap-2">
              <Label className="text-sm">&nbsp;</Label>
              <div className="flex items-center gap-2 flex-1">
                <Checkbox
                  id="original-size"
                  checked={state.originalSize}
                  onCheckedChange={(checked) => {
                    const enabled = checked === true;
                    setParam("originalSize", enabled, true);
                    if (enabled && svgDimensions) {
                      setParam("width", Math.round(svgDimensions.width), true);
                      setParam(
                        "height",
                        Math.round(svgDimensions.height),
                        true,
                      );
                    }
                  }}
                />
                <Label
                  htmlFor="original-size"
                  className="text-sm cursor-pointer"
                >
                  Original
                </Label>
              </div>
            </div>

            <div className="flex flex-col gap-2">
              <Label htmlFor="width" className="text-sm">
                Width (px)
              </Label>
              <div className="flex items-center gap-2">
                <Input
                  id="width"
                  type="number"
                  min={1}
                  max={8192}
                  value={state.width}
                  onChange={(e) => handleWidthChange(e.target.value)}
                  className="w-28"
                  disabled={state.originalSize}
                />
              </div>
            </div>

            <div className="flex flex-col gap-2">
              <Label className="text-sm">&nbsp;</Label>
              <div className="flex items-center gap-2">
                <Button
                  variant="ghost"
                  size="icon-sm"
                  className="h-8 w-8"
                  onClick={() => setParam("maintainAspectRatio", true, true)}
                  aria-pressed={state.maintainAspectRatio}
                  aria-label={
                    state.maintainAspectRatio
                      ? "Unlock aspect ratio"
                      : "Lock aspect ratio"
                  }
                  disabled
                >
                  <Link2
                    className={`h-4 w-4 ${state.maintainAspectRatio ? "text-primary" : "text-muted-foreground"}`}
                  />
                </Button>
              </div>
            </div>

            <div className="flex flex-col gap-2">
              <Label htmlFor="height" className="text-sm">
                Height (px)
              </Label>
              <div className="flex items-center gap-2">
                <Input
                  id="height"
                  type="number"
                  min={1}
                  max={8192}
                  value={state.height}
                  onChange={(e) => handleHeightChange(e.target.value)}
                  className="w-28"
                  disabled={state.originalSize}
                />
              </div>
            </div>

            <div className="flex flex-col gap-2">
              <Label className="text-sm">Quick Sizes</Label>
              <div className="flex items-center flex-1">
                <div className="inline-flex overflow-hidden rounded-md border border-input bg-background">
                  {[
                    { label: "16", w: 16, h: 16 },
                    { label: "32", w: 32, h: 32 },
                    { label: "64", w: 64, h: 64 },
                    { label: "128", w: 128, h: 128 },
                    { label: "256", w: 256, h: 256 },
                    { label: "512", w: 512, h: 512 },
                    { label: "1024", w: 1024, h: 1024 },
                  ].map((preset, index, array) => (
                    <Button
                      key={preset.label}
                      variant="ghost"
                      size="sm"
                      className={`h-7 rounded-none px-2 text-xs ${index < array.length - 1 ? "border-r border-input" : ""}`}
                      onClick={() => {
                        const ratio = svgRatio;
                        if (state.originalSize) {
                          setParam("originalSize", false, true);
                          setParam("width", preset.w, true);
                          setParam(
                            "height",
                            Math.round(preset.w * ratio),
                            true,
                          );
                          return;
                        }
                        setParam("width", preset.w, true);
                        setParam("height", Math.round(preset.w * ratio), true);
                      }}
                    >
                      {preset.label}
                    </Button>
                  ))}
                </div>
              </div>
            </div>

            <div className="flex flex-col gap-2">
              <Label htmlFor="bg-color" className="text-sm">
                Background
              </Label>
              <div className="flex items-center gap-2">
                <Input
                  id="bg-color"
                  type="text"
                  value={state.backgroundColor}
                  onChange={(e) =>
                    setParam("backgroundColor", e.target.value, true)
                  }
                  placeholder="transparent"
                  className="w-32"
                />
                <Input
                  type="color"
                  value={
                    state.backgroundColor === "transparent"
                      ? "#ffffff"
                      : state.backgroundColor
                  }
                  onChange={(e) =>
                    setParam("backgroundColor", e.target.value, true)
                  }
                  className="h-9 w-12 p-1"
                />
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setParam("originalSize", defaults.originalSize, true);
                    setParam("width", defaults.width, true);
                    setParam("height", defaults.height, true);
                    setParam(
                      "maintainAspectRatio",
                      defaults.maintainAspectRatio,
                      true,
                    );
                    setParam("backgroundColor", defaults.backgroundColor, true);
                    setError(null);
                    setSvgDimensions(null);
                    if (defaults.originalSize && state.svgContent.trim()) {
                      parseSvgDimensions(state.svgContent, true);
                    }
                  }}
                >
                  Reset
                </Button>
              </div>
            </div>
          </div>

          {/* SVG Dimensions Info */}
        </CardContent>
      </Card>

      {/* Error display */}
      {error && (
        <Card className="border-destructive">
          <CardContent className="p-4">
            <p className="text-sm text-destructive">{error}</p>
          </CardContent>
        </Card>
      )}

      {/* Main content area */}
      <div className="flex flex-col gap-4 md:flex-row">
        {/* SVG Editor */}
        <div className="flex w-full flex-1 flex-col gap-2 md:w-0">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <Label className="text-sm font-medium">SVG Code</Label>
              <span
                className="max-w-[220px] truncate text-xs text-muted-foreground"
                title={
                  state.svgFileName
                    ? `${state.svgFileName} (${svgOriginalSizeLabel})`
                    : `(${svgOriginalSizeLabel})`
                }
              >
                {state.svgFileName
                  ? `${state.svgFileName} (${svgOriginalSizeLabel})`
                  : `(${svgOriginalSizeLabel})`}
              </span>
            </div>
            <div className="flex items-center gap-1">
              <input
                ref={fileInputRef}
                id="svg-upload"
                type="file"
                accept=".svg,image/svg+xml"
                onChange={handleFileUpload}
                className="hidden"
              />
              <Button
                variant="ghost"
                size="sm"
                onClick={() => fileInputRef.current?.click()}
                className="h-7 gap-1 px-2 text-xs"
              >
                <Upload className="h-3 w-3" />
                Upload
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={handlePrettyPrint}
                disabled={!state.svgContent.trim()}
                className="h-7 gap-1 px-2 text-xs"
              >
                <Sparkles className="h-3 w-3" />
                Pretty
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  if (!state.svgContent) return;
                  const blob = new Blob([state.svgContent], {
                    type: "image/svg+xml;charset=utf-8",
                  });
                  const url = URL.createObjectURL(blob);
                  const a = document.createElement("a");
                  a.href = url;
                  a.download = state.svgFileName.trim()
                    ? state.svgFileName
                    : "image.svg";
                  document.body.appendChild(a);
                  a.click();
                  document.body.removeChild(a);
                  URL.revokeObjectURL(url);
                }}
                disabled={!state.svgContent}
                className="h-7 gap-1 px-2 text-xs"
              >
                <Download className="h-3 w-3" />
                SVG
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  handleClearSvg();
                }}
                disabled={!state.svgContent}
                className="h-7 w-7 p-0"
                aria-label="Clear SVG"
              >
                <Trash2 className="h-3 w-3" />
              </Button>
            </div>
          </div>
          <div className="relative overflow-hidden rounded-md border">
            <Editor
              height="360px"
              language="xml"
              theme={resolvedTheme === "dark" ? "vs-dark" : "light"}
              value={state.svgContent}
              onChange={(value) => handleSvgChange(value ?? "")}
              options={{
                minimap: { enabled: false },
                fontSize: 13,
                lineNumbers: "on",
                scrollBeyondLastLine: false,
                wordWrap: "on",
                tabSize: 2,
                automaticLayout: true,
                padding: { top: 8, bottom: 8 },
                scrollbar: {
                  vertical: "auto",
                  horizontal: "auto",
                  verticalScrollbarSize: 8,
                  horizontalScrollbarSize: 8,
                },
              }}
            />
          </div>
          {oversizeWarning && (
            <p className="text-xs text-muted-foreground">{oversizeWarning}</p>
          )}
        </div>

        {/* Preview */}
        <div className="flex w-full flex-1 flex-col gap-2 md:w-0">
          <div className="flex items-center justify-between gap-2">
            <Label className="text-sm font-medium">Preview</Label>
            <div className="flex items-center gap-1">
              <Button
                variant="ghost"
                size="sm"
                onClick={convertAndDownload}
                disabled={
                  !state.svgContent ||
                  !state.width ||
                  !state.height ||
                  isConverting
                }
                className="h-7 gap-1 px-2 text-xs"
              >
                {isConverting ? (
                  <>
                    <RefreshCw className="h-3 w-3 animate-spin" />
                    Converting...
                  </>
                ) : (
                  <>
                    <Download className="h-3 w-3" />
                    PNG
                  </>
                )}
              </Button>
            </div>
          </div>
          <div className="grid h-[360px] place-items-center">
            {previewUrl ? (
              <div
                style={{
                  aspectRatio: state.width / state.height,
                }}
                className="max-h-[360px] border border-dashed border-muted/foreground/40"
              >
                <img
                  src={previewUrl || "/placeholder.svg"}
                  alt="SVG Preview"
                  className="object-fill block w-full h-full"
                  style={{
                    backgroundColor:
                      state.backgroundColor === "transparent" ||
                      !state.backgroundColor
                        ? "transparent"
                        : state.backgroundColor,
                    backgroundImage:
                      state.backgroundColor === "transparent" ||
                      !state.backgroundColor
                        ? "repeating-conic-gradient(#e5e7eb 0% 25%, transparent 0% 50%)"
                        : "none",
                    backgroundPosition: "50% 50%",
                    backgroundSize: "20px 20px",
                    backgroundClip: "padding-box",
                  }}
                />
              </div>
            ) : (
              <div className="flex min-h-[200px] flex-col items-center justify-center text-muted-foreground">
                <ImageIcon className="mb-4 h-12 w-12 opacity-50" />
                <p className="text-sm">Upload or paste SVG to see preview</p>
              </div>
            )}
          </div>
          {state.svgContent && (
            <div className="text-center text-xs text-muted-foreground">
              Output: {state.width} x {state.height} PNG
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
