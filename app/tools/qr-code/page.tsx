"use client";

import * as React from "react";
import { Suspense } from "react";
import { z } from "zod";
import * as QRCode from "qrcode";
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
import { Download } from "lucide-react";
import type { HistoryEntry } from "@/lib/history/db";
import { cn } from "@/lib/utils";

const paramsSchema = z.object({
  text: z.string().default(""),
  size: z.coerce.number().int().min(64).max(2048).default(256),
  margin: z.coerce.number().int().min(0).max(10).default(2),
  errorCorrection: z.enum(["L", "M", "Q", "H"]).default("M"),
  darkColor: z.string().default("#000000"),
  lightColor: z.string().default("#ffffff"),
  format: z.enum(["png", "svg"]).default("png"),
});

export default function QrCodePage() {
  return (
    <Suspense fallback={null}>
      <QrCodeContent />
    </Suspense>
  );
}

function QrCodeContent() {
  const { state, setParam, oversizeKeys, hasUrlParams, hydrationSource } =
    useUrlSyncedState("qr-code", {
      schema: paramsSchema,
      defaults: paramsSchema.parse({}),
      restoreMissingKeys: (key) => key === "text",
    });

  const handleLoadHistory = React.useCallback(
    (entry: HistoryEntry) => {
      const { inputs, params } = entry;
      if (inputs.text !== undefined) setParam("text", inputs.text);
      if (params.size !== undefined) setParam("size", params.size as number);
      if (params.margin !== undefined)
        setParam("margin", params.margin as number);
      if (params.errorCorrection)
        setParam(
          "errorCorrection",
          params.errorCorrection as z.infer<
            typeof paramsSchema
          >["errorCorrection"],
        );
      if (params.darkColor) setParam("darkColor", params.darkColor as string);
      if (params.lightColor)
        setParam("lightColor", params.lightColor as string);
      if (params.format)
        setParam(
          "format",
          params.format as z.infer<typeof paramsSchema>["format"],
        );
    },
    [setParam],
  );

  return (
    <ToolPageWrapper
      toolId="qr-code"
      title="QR Code Generator"
      description="Generate QR codes with custom size, colors, and error correction"
      onLoadHistory={handleLoadHistory}
    >
      <QrCodeInner
        state={state}
        setParam={setParam}
        oversizeKeys={oversizeKeys}
        hasUrlParams={hasUrlParams}
        hydrationSource={hydrationSource}
      />
    </ToolPageWrapper>
  );
}

function QrCodeInner({
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
  const [pngUrl, setPngUrl] = React.useState<string>("");
  const [svgMarkup, setSvgMarkup] = React.useState<string>("");
  const [error, setError] = React.useState<string | null>(null);
  const [isGenerating, setIsGenerating] = React.useState(false);
  const lastInputRef = React.useRef<string>("");
  const hasHydratedInputRef = React.useRef(false);
  const paramsRef = React.useRef({
    size: state.size,
    margin: state.margin,
    errorCorrection: state.errorCorrection,
    darkColor: state.darkColor,
    lightColor: state.lightColor,
    format: state.format,
  });
  const hasInitializedParamsRef = React.useRef(false);
  const hasHandledUrlRef = React.useRef(false);

  React.useEffect(() => {
    if (hasHydratedInputRef.current) return;
    if (hydrationSource === "default") return;
    lastInputRef.current = JSON.stringify({ text: state.text });
    hasHydratedInputRef.current = true;
  }, [hydrationSource, state.text]);

  React.useEffect(() => {
    if (state.text === lastInputRef.current) return;

    const timer = setTimeout(() => {
      lastInputRef.current = state.text;
      upsertInputEntry(
        { text: state.text },
        {
          size: state.size,
          margin: state.margin,
          errorCorrection: state.errorCorrection,
          darkColor: state.darkColor,
          lightColor: state.lightColor,
          format: state.format,
        },
        "left",
        state.text.slice(0, 100),
      );
    }, DEFAULT_URL_SYNC_DEBOUNCE_MS);

    return () => clearTimeout(timer);
  }, [
    state.text,
    state.size,
    state.margin,
    state.errorCorrection,
    state.darkColor,
    state.lightColor,
    state.format,
    upsertInputEntry,
  ]);

  React.useEffect(() => {
    if (hasUrlParams && !hasHandledUrlRef.current) {
      hasHandledUrlRef.current = true;
      if (state.text) {
        upsertInputEntry(
          { text: state.text },
          {
            size: state.size,
            margin: state.margin,
            errorCorrection: state.errorCorrection,
            darkColor: state.darkColor,
            lightColor: state.lightColor,
            format: state.format,
          },
          "left",
          state.text.slice(0, 100),
        );
      } else {
        upsertParams(
          {
            size: state.size,
            margin: state.margin,
            errorCorrection: state.errorCorrection,
            darkColor: state.darkColor,
            lightColor: state.lightColor,
            format: state.format,
          },
          "interpretation",
        );
      }
    }
  }, [
    hasUrlParams,
    state.text,
    state.size,
    state.margin,
    state.errorCorrection,
    state.darkColor,
    state.lightColor,
    state.format,
    upsertInputEntry,
    upsertParams,
  ]);

  React.useEffect(() => {
    const nextParams = {
      size: state.size,
      margin: state.margin,
      errorCorrection: state.errorCorrection,
      darkColor: state.darkColor,
      lightColor: state.lightColor,
      format: state.format,
    };
    if (!hasInitializedParamsRef.current) {
      hasInitializedParamsRef.current = true;
      paramsRef.current = nextParams;
      return;
    }
    if (JSON.stringify(paramsRef.current) === JSON.stringify(nextParams)) {
      return;
    }
    paramsRef.current = nextParams;
    upsertParams(nextParams, "interpretation");
  }, [
    state.size,
    state.margin,
    state.errorCorrection,
    state.darkColor,
    state.lightColor,
    state.format,
    upsertParams,
  ]);

  React.useEffect(() => {
    if (!state.text.trim()) {
      setPngUrl("");
      setSvgMarkup("");
      return;
    }

    let active = true;
    const generate = async () => {
      setIsGenerating(true);
      setError(null);
      try {
        const options = {
          width: state.size,
          margin: state.margin,
          errorCorrectionLevel: state.errorCorrection,
          color: { dark: state.darkColor, light: state.lightColor },
        };
        const png = await QRCode.toDataURL(state.text, options);
        const svg = await QRCode.toString(state.text, {
          ...options,
          type: "svg",
        });
        if (active) {
          setPngUrl(png);
          setSvgMarkup(svg);
        }
      } catch (err) {
        console.error("QR generation failed", err);
        if (active) {
          setError(err instanceof Error ? err.message : "QR generation failed");
        }
      } finally {
        if (active) setIsGenerating(false);
      }
    };

    void generate();
    return () => {
      active = false;
    };
  }, [
    state.text,
    state.size,
    state.margin,
    state.errorCorrection,
    state.darkColor,
    state.lightColor,
  ]);

  const handleDownload = () => {
    if (!state.text.trim()) return;
    if (state.format === "svg") {
      const blob = new Blob([svgMarkup], { type: "image/svg+xml" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = "qr-code.svg";
      link.click();
      URL.revokeObjectURL(url);
    } else {
      const link = document.createElement("a");
      link.href = pngUrl;
      link.download = "qr-code.png";
      link.click();
    }
  };

  const showOversizeWarning = oversizeKeys.includes("text");

  return (
    <div className="flex flex-col gap-4">
      <Card>
        <CardContent className="flex flex-col gap-4 p-4">
          <div className="space-y-2">
            <Label className="text-sm">Content</Label>
            <Textarea
              value={state.text}
              onChange={(e) => setParam("text", e.target.value, true)}
              placeholder="Enter text or URL"
              className="min-h-[120px]"
            />
          </div>

          <div className="grid gap-3 md:grid-cols-3">
            <div className="space-y-1">
              <Label className="text-sm">Size (px)</Label>
              <Input
                type="number"
                min={64}
                max={2048}
                value={state.size}
                onChange={(e) =>
                  setParam(
                    "size",
                    Number.parseInt(e.target.value, 10) || 256,
                    true,
                  )
                }
              />
            </div>
            <div className="space-y-1">
              <Label className="text-sm">Margin</Label>
              <Input
                type="number"
                min={0}
                max={10}
                value={state.margin}
                onChange={(e) =>
                  setParam(
                    "margin",
                    Number.parseInt(e.target.value, 10) || 0,
                    true,
                  )
                }
              />
            </div>
            <div className="space-y-1">
              <Label className="text-sm">Error Correction</Label>
              <Select
                value={state.errorCorrection}
                onValueChange={(value) =>
                  setParam(
                    "errorCorrection",
                    value as z.infer<typeof paramsSchema>["errorCorrection"],
                    true,
                  )
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="L">L (7%)</SelectItem>
                  <SelectItem value="M">M (15%)</SelectItem>
                  <SelectItem value="Q">Q (25%)</SelectItem>
                  <SelectItem value="H">H (30%)</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid gap-3 md:grid-cols-3">
            <div className="space-y-1">
              <Label className="text-sm">Foreground</Label>
              <Input
                type="color"
                value={state.darkColor}
                onChange={(e) => setParam("darkColor", e.target.value, true)}
                className="h-9 w-20 p-1"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-sm">Background</Label>
              <Input
                type="color"
                value={state.lightColor}
                onChange={(e) => setParam("lightColor", e.target.value, true)}
                className="h-9 w-20 p-1"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-sm">Download Format</Label>
              <Select
                value={state.format}
                onValueChange={(value) =>
                  setParam(
                    "format",
                    value as z.infer<typeof paramsSchema>["format"],
                    true,
                  )
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="png">PNG</SelectItem>
                  <SelectItem value="svg">SVG</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <Button
            onClick={handleDownload}
            disabled={!state.text.trim() || isGenerating}
            className="w-fit gap-2"
          >
            <Download
              className={cn("h-4 w-4", isGenerating && "animate-spin")}
            />
            Download
          </Button>

          {error && <p className="text-xs text-destructive">{error}</p>}
          {showOversizeWarning && (
            <p className="text-xs text-muted-foreground">
              Input exceeds 2 KB and is not synced to the URL.
            </p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardContent className="flex flex-col items-center gap-4 p-6">
          {state.text.trim() ? (
            state.format === "svg" ? (
              <div
                className="max-w-full"
                dangerouslySetInnerHTML={{ __html: svgMarkup }}
              />
            ) : pngUrl ? (
              <img
                src={pngUrl}
                alt="Generated QR code"
                className="max-w-full"
              />
            ) : (
              <p className="text-sm text-muted-foreground">
                Generating QR code preview.
              </p>
            )
          ) : (
            <p className="text-sm text-muted-foreground">
              Enter content to generate a QR code.
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
