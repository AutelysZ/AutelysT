"use client";

import * as React from "react";
import { Suspense } from "react";
import { z } from "zod";
import JsBarcode from "jsbarcode";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Download } from "lucide-react";
import type { HistoryEntry } from "@/lib/history/db";

const BARCODE_FORMATS = [
  { value: "CODE128", label: "CODE128" },
  { value: "CODE39", label: "CODE39" },
  { value: "EAN13", label: "EAN-13" },
  { value: "EAN8", label: "EAN-8" },
  { value: "UPC", label: "UPC-A" },
  { value: "ITF14", label: "ITF-14" },
  { value: "MSI", label: "MSI" },
  { value: "pharmacode", label: "Pharmacode" },
] as const;

const paramsSchema = z.object({
  text: z.string().default(""),
  format: z
    .enum([
      "CODE128",
      "CODE39",
      "EAN13",
      "EAN8",
      "UPC",
      "ITF14",
      "MSI",
      "pharmacode",
    ])
    .default("CODE128"),
  width: z.coerce.number().min(1).max(10).default(2),
  height: z.coerce.number().min(20).max(400).default(120),
  margin: z.coerce.number().min(0).max(30).default(10),
  displayValue: z.boolean().default(true),
  fontSize: z.coerce.number().min(8).max(40).default(14),
  lineColor: z.string().default("#000000"),
  background: z.string().default("#ffffff"),
  outputFormat: z.enum(["png", "svg"]).default("png"),
});

export default function BarcodePage() {
  return (
    <Suspense fallback={null}>
      <BarcodeContent />
    </Suspense>
  );
}

function BarcodeContent() {
  const { state, setParam, oversizeKeys, hasUrlParams, hydrationSource } =
    useUrlSyncedState("barcode", {
      schema: paramsSchema,
      defaults: paramsSchema.parse({}),
      restoreMissingKeys: (key) => key === "text",
    });

  const handleLoadHistory = React.useCallback(
    (entry: HistoryEntry) => {
      const { inputs, params } = entry;
      if (inputs.text !== undefined) setParam("text", inputs.text);
      if (params.format)
        setParam(
          "format",
          params.format as z.infer<typeof paramsSchema>["format"],
        );
      if (params.width !== undefined) setParam("width", params.width as number);
      if (params.height !== undefined)
        setParam("height", params.height as number);
      if (params.margin !== undefined)
        setParam("margin", params.margin as number);
      if (params.displayValue !== undefined)
        setParam("displayValue", params.displayValue as boolean);
      if (params.fontSize !== undefined)
        setParam("fontSize", params.fontSize as number);
      if (params.lineColor) setParam("lineColor", params.lineColor as string);
      if (params.background)
        setParam("background", params.background as string);
      if (params.outputFormat)
        setParam(
          "outputFormat",
          params.outputFormat as z.infer<typeof paramsSchema>["outputFormat"],
        );
    },
    [setParam],
  );

  return (
    <ToolPageWrapper
      toolId="barcode"
      title="Barcode Generator"
      description="Generate barcodes in multiple formats with custom styles"
      onLoadHistory={handleLoadHistory}
    >
      <BarcodeInner
        state={state}
        setParam={setParam}
        oversizeKeys={oversizeKeys}
        hasUrlParams={hasUrlParams}
        hydrationSource={hydrationSource}
      />
    </ToolPageWrapper>
  );
}

function BarcodeInner({
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
  const svgRef = React.useRef<SVGSVGElement | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const lastInputRef = React.useRef<string>("");
  const hasHydratedInputRef = React.useRef(false);
  const paramsRef = React.useRef({
    format: state.format,
    width: state.width,
    height: state.height,
    margin: state.margin,
    displayValue: state.displayValue,
    fontSize: state.fontSize,
    lineColor: state.lineColor,
    background: state.background,
    outputFormat: state.outputFormat,
  });
  const hasInitializedParamsRef = React.useRef(false);
  const hasHandledUrlRef = React.useRef(false);

  React.useEffect(() => {
    if (hasHydratedInputRef.current) return;
    if (hydrationSource === "default") return;
    lastInputRef.current = state.text;
    hasHydratedInputRef.current = true;
  }, [hydrationSource, state.text]);

  React.useEffect(() => {
    if (state.text === lastInputRef.current) return;

    const timer = setTimeout(() => {
      lastInputRef.current = state.text;
      upsertInputEntry(
        { text: state.text },
        {
          format: state.format,
          width: state.width,
          height: state.height,
          margin: state.margin,
          displayValue: state.displayValue,
          fontSize: state.fontSize,
          lineColor: state.lineColor,
          background: state.background,
          outputFormat: state.outputFormat,
        },
        "left",
        state.text.slice(0, 100),
      );
    }, DEFAULT_URL_SYNC_DEBOUNCE_MS);

    return () => clearTimeout(timer);
  }, [
    state.text,
    state.format,
    state.width,
    state.height,
    state.margin,
    state.displayValue,
    state.fontSize,
    state.lineColor,
    state.background,
    state.outputFormat,
    upsertInputEntry,
  ]);

  React.useEffect(() => {
    if (hasUrlParams && !hasHandledUrlRef.current) {
      hasHandledUrlRef.current = true;
      if (state.text) {
        upsertInputEntry(
          { text: state.text },
          {
            format: state.format,
            width: state.width,
            height: state.height,
            margin: state.margin,
            displayValue: state.displayValue,
            fontSize: state.fontSize,
            lineColor: state.lineColor,
            background: state.background,
            outputFormat: state.outputFormat,
          },
          "left",
          state.text.slice(0, 100),
        );
      } else {
        upsertParams(
          {
            format: state.format,
            width: state.width,
            height: state.height,
            margin: state.margin,
            displayValue: state.displayValue,
            fontSize: state.fontSize,
            lineColor: state.lineColor,
            background: state.background,
            outputFormat: state.outputFormat,
          },
          "interpretation",
        );
      }
    }
  }, [
    hasUrlParams,
    state.text,
    state.format,
    state.width,
    state.height,
    state.margin,
    state.displayValue,
    state.fontSize,
    state.lineColor,
    state.background,
    state.outputFormat,
    upsertInputEntry,
    upsertParams,
  ]);

  React.useEffect(() => {
    const nextParams = {
      format: state.format,
      width: state.width,
      height: state.height,
      margin: state.margin,
      displayValue: state.displayValue,
      fontSize: state.fontSize,
      lineColor: state.lineColor,
      background: state.background,
      outputFormat: state.outputFormat,
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
    state.format,
    state.width,
    state.height,
    state.margin,
    state.displayValue,
    state.fontSize,
    state.lineColor,
    state.background,
    state.outputFormat,
    upsertParams,
  ]);

  React.useEffect(() => {
    if (!state.text.trim()) {
      setError(null);
      if (svgRef.current) svgRef.current.innerHTML = "";
      return;
    }

    try {
      setError(null);
      if (svgRef.current) {
        JsBarcode(svgRef.current, state.text, {
          format: state.format,
          width: state.width,
          height: state.height,
          margin: state.margin,
          displayValue: state.displayValue,
          fontSize: state.fontSize,
          lineColor: state.lineColor,
          background: state.background,
        });
      }
    } catch (err) {
      console.error("Barcode generation failed", err);
      setError(
        err instanceof Error ? err.message : "Barcode generation failed",
      );
    }
  }, [
    state.text,
    state.format,
    state.width,
    state.height,
    state.margin,
    state.displayValue,
    state.fontSize,
    state.lineColor,
    state.background,
  ]);

  const handleDownload = () => {
    if (!state.text.trim()) return;
    if (state.outputFormat === "svg") {
      if (!svgRef.current) return;
      const svgContent = svgRef.current.outerHTML;
      const blob = new Blob([svgContent], { type: "image/svg+xml" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = "barcode.svg";
      link.click();
      URL.revokeObjectURL(url);
      return;
    }

    const canvas = document.createElement("canvas");
    try {
      JsBarcode(canvas, state.text, {
        format: state.format,
        width: state.width,
        height: state.height,
        margin: state.margin,
        displayValue: state.displayValue,
        fontSize: state.fontSize,
        lineColor: state.lineColor,
        background: state.background,
      });
      const url = canvas.toDataURL("image/png");
      const link = document.createElement("a");
      link.href = url;
      link.download = "barcode.png";
      link.click();
    } catch (err) {
      console.error("Barcode download failed", err);
      setError(err instanceof Error ? err.message : "Download failed");
    }
  };

  const showOversizeWarning = oversizeKeys.includes("text");

  return (
    <div className="flex flex-col gap-4">
      <Card>
        <CardContent className="flex flex-col gap-4 p-4">
          <div className="space-y-2">
            <Label className="text-sm">Barcode Value</Label>
            <Input
              value={state.text}
              onChange={(e) => setParam("text", e.target.value, true)}
              placeholder="Enter barcode value"
            />
          </div>

          <div className="grid gap-3 md:grid-cols-3">
            <div className="space-y-1">
              <Label className="text-sm">Format</Label>
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
                  {BARCODE_FORMATS.map((format) => (
                    <SelectItem key={format.value} value={format.value}>
                      {format.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-sm">Bar Width</Label>
              <Input
                type="number"
                min={1}
                max={10}
                value={state.width}
                onChange={(e) =>
                  setParam(
                    "width",
                    Number.parseInt(e.target.value, 10) || 2,
                    true,
                  )
                }
              />
            </div>
            <div className="space-y-1">
              <Label className="text-sm">Height</Label>
              <Input
                type="number"
                min={20}
                max={400}
                value={state.height}
                onChange={(e) =>
                  setParam(
                    "height",
                    Number.parseInt(e.target.value, 10) || 120,
                    true,
                  )
                }
              />
            </div>
          </div>

          <div className="grid gap-3 md:grid-cols-3">
            <div className="space-y-1">
              <Label className="text-sm">Margin</Label>
              <Input
                type="number"
                min={0}
                max={30}
                value={state.margin}
                onChange={(e) =>
                  setParam(
                    "margin",
                    Number.parseInt(e.target.value, 10) || 10,
                    true,
                  )
                }
              />
            </div>
            <div className="space-y-1">
              <Label className="text-sm">Font Size</Label>
              <Input
                type="number"
                min={8}
                max={40}
                value={state.fontSize}
                onChange={(e) =>
                  setParam(
                    "fontSize",
                    Number.parseInt(e.target.value, 10) || 14,
                    true,
                  )
                }
              />
            </div>
            <div className="space-y-1">
              <Label className="text-sm">Output Format</Label>
              <Select
                value={state.outputFormat}
                onValueChange={(value) =>
                  setParam(
                    "outputFormat",
                    value as z.infer<typeof paramsSchema>["outputFormat"],
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

          <div className="flex flex-wrap items-center gap-3">
            <label className="flex items-center gap-2 text-sm">
              <Checkbox
                checked={state.displayValue}
                onCheckedChange={(value) =>
                  setParam("displayValue", Boolean(value), true)
                }
              />
              Show Value Text
            </label>
            <div className="flex items-center gap-2">
              <Label className="text-sm">Line</Label>
              <Input
                type="color"
                value={state.lineColor}
                onChange={(e) => setParam("lineColor", e.target.value, true)}
                className="h-9 w-16 p-1"
              />
            </div>
            <div className="flex items-center gap-2">
              <Label className="text-sm">Background</Label>
              <Input
                type="color"
                value={state.background}
                onChange={(e) => setParam("background", e.target.value, true)}
                className="h-9 w-16 p-1"
              />
            </div>
          </div>

          <Button
            onClick={handleDownload}
            disabled={!state.text.trim()}
            className="w-fit gap-2"
          >
            <Download className="h-4 w-4" />
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
            <svg ref={svgRef} className="max-w-full" />
          ) : (
            <p className="text-sm text-muted-foreground">
              Enter a value to generate a barcode.
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
