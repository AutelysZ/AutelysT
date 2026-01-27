"use client";

import * as React from "react";
import { Suspense } from "react";
import { z } from "zod";
import {
  ToolPageWrapper,
  useToolHistoryContext,
} from "@/components/tool-ui/tool-page-wrapper";
import { DualPaneLayout } from "@/components/tool-ui/dual-pane-layout";
import {
  DEFAULT_URL_SYNC_DEBOUNCE_MS,
  useUrlSyncedState,
} from "@/lib/url-state/use-url-synced-state";
import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { SearchableSelect } from "@/components/ui/searchable-select";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  encodeText,
  decodeText,
  getAllEncodings,
} from "@/lib/encoding/text-encodings";
import { compressGzip, decompressGzip, isGzipData } from "@/lib/encoding/gzip";
import { encodeBase64, decodeBase64 } from "@/lib/encoding/base64";
import { encodeHex, decodeHex } from "@/lib/encoding/hex";
import type { HistoryEntry } from "@/lib/history/db";

const outputFormats = ["base64", "hex"] as const;
type OutputFormat = (typeof outputFormats)[number];

const paramsSchema = z.object({
  textEncoding: z.string().default("UTF-8"),
  outputFormat: z.enum(outputFormats).default("base64"),
  activeSide: z.enum(["left", "right"]).default("left"),
  leftText: z.string().default(""),
  rightText: z.string().default(""),
});

const encodings = getAllEncodings();

export default function GzipPage() {
  return (
    <Suspense fallback={null}>
      <GzipContent />
    </Suspense>
  );
}

function GzipContent() {
  const { state, setParam, oversizeKeys, hasUrlParams, hydrationSource } =
    useUrlSyncedState("gzip", {
      schema: paramsSchema,
      defaults: paramsSchema.parse({}),
      inputSide: {
        sideKey: "activeSide",
        inputKeyBySide: {
          left: "leftText",
          right: "rightText",
        },
      },
    });

  const [leftError, setLeftError] = React.useState<string | null>(null);
  const [rightError, setRightError] = React.useState<string | null>(null);
  const [leftFileResult, setLeftFileResult] = React.useState<{
    status: "success" | "error";
    message: string;
    downloadUrl?: string;
    downloadName?: string;
  } | null>(null);
  const [rightFileResult, setRightFileResult] = React.useState<{
    status: "success" | "error";
    message: string;
    downloadUrl?: string;
    downloadName?: string;
  } | null>(null);

  // Compress left text to gzip
  const compressToGzip = React.useCallback(
    async (text: string) => {
      try {
        setLeftError(null);
        if (!text) {
          setParam("rightText", "");
          return;
        }

        const bytes = encodeText(text, state.textEncoding);
        const compressed = await compressGzip(bytes);
        const encoded =
          state.outputFormat === "base64"
            ? encodeBase64(compressed, { padding: true, urlSafe: false })
            : encodeHex(compressed, { upperCase: false });
        setParam("rightText", encoded);
      } catch (err) {
        setLeftError(
          err instanceof Error ? err.message : "Compression failed"
        );
      }
    },
    [state.textEncoding, state.outputFormat, setParam]
  );

  // Decompress gzip to text
  const decompressFromGzip = React.useCallback(
    async (encoded: string) => {
      try {
        setRightError(null);
        if (!encoded) {
          setParam("leftText", "");
          return;
        }

        const compressed =
          state.outputFormat === "base64"
            ? decodeBase64(encoded)
            : decodeHex(encoded);

        if (!isGzipData(compressed)) {
          setRightError("Invalid gzip data (missing magic bytes)");
          return;
        }

        const decompressed = await decompressGzip(compressed);
        const text = decodeText(decompressed, state.textEncoding);
        setParam("leftText", text);
      } catch (err) {
        setRightError(
          err instanceof Error ? err.message : "Decompression failed"
        );
      }
    },
    [state.textEncoding, state.outputFormat, setParam]
  );

  // Handle left text change
  const handleLeftChange = React.useCallback(
    (value: string) => {
      setParam("leftText", value);
      setParam("activeSide", "left");
      void compressToGzip(value);
    },
    [setParam, compressToGzip]
  );

  // Handle right text change
  const handleRightChange = React.useCallback(
    (value: string) => {
      setParam("rightText", value);
      setParam("activeSide", "right");
      void decompressFromGzip(value);
    },
    [setParam, decompressFromGzip]
  );

  // Recompute when params change
  React.useEffect(() => {
    if (state.activeSide === "left" && state.leftText) {
      void compressToGzip(state.leftText);
    } else if (state.activeSide === "right" && state.rightText) {
      void decompressFromGzip(state.rightText);
    }
  }, [state.textEncoding, state.outputFormat]);

  // Handle file upload to left (compress)
  const handleLeftFileUpload = React.useCallback(
    async (file: File) => {
      try {
        const buffer = await file.arrayBuffer();
        const bytes = new Uint8Array(buffer);
        const compressed = await compressGzip(bytes);

        const blob = new Blob([compressed], {
          type: "application/gzip",
        });
        const url = URL.createObjectURL(blob);

        setLeftFileResult({
          status: "success",
          message: `Compressed ${file.name} (${bytes.length} bytes → ${compressed.length} bytes, ${((compressed.length / bytes.length) * 100).toFixed(1)}%)`,
          downloadUrl: url,
          downloadName: file.name + ".gz",
        });
      } catch (err) {
        setLeftFileResult({
          status: "error",
          message: err instanceof Error ? err.message : "Compression failed",
        });
      }
    },
    []
  );

  // Handle file upload to right (decompress)
  const handleRightFileUpload = React.useCallback(async (file: File) => {
    try {
      const buffer = await file.arrayBuffer();
      const bytes = new Uint8Array(buffer);

      if (!isGzipData(bytes)) {
        setRightFileResult({
          status: "error",
          message: "File is not gzip compressed (missing magic bytes)",
        });
        return;
      }

      const decompressed = await decompressGzip(bytes);

      const blob = new Blob([decompressed], {
        type: "application/octet-stream",
      });
      const url = URL.createObjectURL(blob);

      const baseName = file.name.replace(/\.gz$/i, "");
      setRightFileResult({
        status: "success",
        message: `Decompressed ${file.name} (${bytes.length} bytes → ${decompressed.length} bytes)`,
        downloadUrl: url,
        downloadName: baseName || "decompressed",
      });
    } catch (err) {
      setRightFileResult({
        status: "error",
        message: err instanceof Error ? err.message : "Decompression failed",
      });
    }
  }, []);

  const handleLoadHistory = React.useCallback(
    (entry: HistoryEntry) => {
      const { inputs, params } = entry;
      if (inputs.leftText !== undefined) setParam("leftText", inputs.leftText);
      if (inputs.rightText !== undefined)
        setParam("rightText", inputs.rightText);
      if (params.textEncoding)
        setParam("textEncoding", params.textEncoding as string);
      if (params.outputFormat)
        setParam("outputFormat", params.outputFormat as OutputFormat);
      if (params.activeSide)
        setParam("activeSide", params.activeSide as "left" | "right");
    },
    [setParam]
  );

  return (
    <ToolPageWrapper
      toolId="gzip"
      title="Gzip"
      description="Compress and decompress data with gzip"
      onLoadHistory={handleLoadHistory}
    >
      <GzipInner
        state={state}
        setParam={setParam}
        oversizeKeys={oversizeKeys}
        hasUrlParams={hasUrlParams}
        hydrationSource={hydrationSource}
        leftError={leftError}
        rightError={rightError}
        handleLeftChange={handleLeftChange}
        handleRightChange={handleRightChange}
        handleLeftFileUpload={handleLeftFileUpload}
        handleRightFileUpload={handleRightFileUpload}
        leftFileResult={leftFileResult}
        rightFileResult={rightFileResult}
        setLeftFileResult={setLeftFileResult}
        setRightFileResult={setRightFileResult}
      />
    </ToolPageWrapper>
  );
}

function GzipInner({
  state,
  setParam,
  oversizeKeys,
  hasUrlParams,
  hydrationSource,
  leftError,
  rightError,
  handleLeftChange,
  handleRightChange,
  handleLeftFileUpload,
  handleRightFileUpload,
  leftFileResult,
  rightFileResult,
  setLeftFileResult,
  setRightFileResult,
}: {
  state: z.infer<typeof paramsSchema>;
  setParam: <K extends keyof z.infer<typeof paramsSchema>>(
    key: K,
    value: z.infer<typeof paramsSchema>[K],
    updateHistory?: boolean
  ) => void;
  oversizeKeys: (keyof z.infer<typeof paramsSchema>)[];
  hasUrlParams: boolean;
  hydrationSource: "default" | "url" | "history";
  leftError: string | null;
  rightError: string | null;
  handleLeftChange: (value: string) => void;
  handleRightChange: (value: string) => void;
  handleLeftFileUpload: (file: File) => void;
  handleRightFileUpload: (file: File) => void;
  leftFileResult: {
    status: "success" | "error";
    message: string;
    downloadUrl?: string;
    downloadName?: string;
  } | null;
  rightFileResult: {
    status: "success" | "error";
    message: string;
    downloadUrl?: string;
    downloadName?: string;
  } | null;
  setLeftFileResult: (v: typeof leftFileResult) => void;
  setRightFileResult: (v: typeof rightFileResult) => void;
}) {
  const { upsertInputEntry, upsertParams } = useToolHistoryContext();
  const lastInputRef = React.useRef<string>("");
  const hasHydratedInputRef = React.useRef(false);
  const paramsRef = React.useRef({
    textEncoding: state.textEncoding,
    outputFormat: state.outputFormat,
    activeSide: state.activeSide,
  });
  const hasInitializedParamsRef = React.useRef(false);
  const hasHandledUrlRef = React.useRef(false);

  React.useEffect(() => {
    if (hasHydratedInputRef.current) return;
    if (hydrationSource === "default") return;
    const activeText =
      state.activeSide === "left" ? state.leftText : state.rightText;
    lastInputRef.current = activeText;
    hasHydratedInputRef.current = true;
  }, [hydrationSource, state.activeSide, state.leftText, state.rightText]);

  React.useEffect(() => {
    const activeText =
      state.activeSide === "left" ? state.leftText : state.rightText;
    if (activeText === lastInputRef.current) return;

    const timer = setTimeout(() => {
      lastInputRef.current = activeText;
      upsertInputEntry(
        { leftText: state.leftText, rightText: state.rightText },
        {
          textEncoding: state.textEncoding,
          outputFormat: state.outputFormat,
          activeSide: state.activeSide,
        },
        state.activeSide,
        activeText.slice(0, 100)
      );
    }, DEFAULT_URL_SYNC_DEBOUNCE_MS);

    return () => clearTimeout(timer);
  }, [
    state.leftText,
    state.rightText,
    state.activeSide,
    state.textEncoding,
    state.outputFormat,
    upsertInputEntry,
  ]);

  React.useEffect(() => {
    if (hasUrlParams && !hasHandledUrlRef.current) {
      hasHandledUrlRef.current = true;
      const activeText =
        state.activeSide === "left" ? state.leftText : state.rightText;
      if (activeText) {
        upsertInputEntry(
          { leftText: state.leftText, rightText: state.rightText },
          {
            textEncoding: state.textEncoding,
            outputFormat: state.outputFormat,
            activeSide: state.activeSide,
          },
          state.activeSide,
          activeText.slice(0, 100)
        );
      } else {
        upsertParams(
          {
            textEncoding: state.textEncoding,
            outputFormat: state.outputFormat,
            activeSide: state.activeSide,
          },
          "interpretation"
        );
      }
    }
  }, [
    hasUrlParams,
    state.leftText,
    state.rightText,
    state.activeSide,
    state.textEncoding,
    state.outputFormat,
    upsertInputEntry,
    upsertParams,
  ]);

  React.useEffect(() => {
    const nextParams = {
      textEncoding: state.textEncoding,
      outputFormat: state.outputFormat,
      activeSide: state.activeSide,
    };
    if (!hasInitializedParamsRef.current) {
      hasInitializedParamsRef.current = true;
      paramsRef.current = nextParams;
      return;
    }
    if (
      paramsRef.current.textEncoding === nextParams.textEncoding &&
      paramsRef.current.outputFormat === nextParams.outputFormat &&
      paramsRef.current.activeSide === nextParams.activeSide
    ) {
      return;
    }
    paramsRef.current = nextParams;
    upsertParams(nextParams, "interpretation");
  }, [
    state.textEncoding,
    state.outputFormat,
    state.activeSide,
    upsertParams,
  ]);

  const leftWarning = oversizeKeys.includes("leftText")
    ? "Input exceeds 2 KB and is not synced to the URL."
    : null;
  const rightWarning = oversizeKeys.includes("rightText")
    ? "Input exceeds 2 KB and is not synced to the URL."
    : null;

  return (
    <DualPaneLayout
      leftLabel="Plain Text"
      rightLabel="Gzip Compressed"
      leftValue={state.leftText}
      rightValue={state.rightText}
      onLeftChange={handleLeftChange}
      onRightChange={handleRightChange}
      activeSide={state.activeSide}
      leftError={leftError}
      rightError={rightError}
      leftWarning={leftWarning}
      rightWarning={rightWarning}
      leftPlaceholder="Enter text to compress..."
      rightPlaceholder="Enter gzip data to decompress..."
      leftFileUpload={handleLeftFileUpload}
      rightFileUpload={handleRightFileUpload}
      leftFileResult={leftFileResult}
      rightFileResult={rightFileResult}
      onClearLeftFile={() => setLeftFileResult(null)}
      onClearRightFile={() => setRightFileResult(null)}
    >
      <Card>
        <CardContent className="flex flex-wrap items-center gap-6 p-4">
          <div className="flex items-center gap-2">
            <Label htmlFor="textEncoding" className="text-sm whitespace-nowrap">
              Text Encoding
            </Label>
            <SearchableSelect
              value={state.textEncoding}
              onValueChange={(v) => setParam("textEncoding", v, true)}
              options={encodings}
              placeholder="Select encoding..."
              searchPlaceholder="Search encodings..."
              triggerClassName="w-48"
              className="w-64"
            />
          </div>

          <div className="flex items-center gap-2">
            <Label className="text-sm whitespace-nowrap">Output Format</Label>
            <Tabs
              value={state.outputFormat}
              onValueChange={(v) =>
                setParam("outputFormat", v as OutputFormat, true)
              }
            >
              <TabsList className="h-8">
                <TabsTrigger value="base64" className="text-xs">
                  Base64
                </TabsTrigger>
                <TabsTrigger value="hex" className="text-xs">
                  Hex
                </TabsTrigger>
              </TabsList>
            </Tabs>
          </div>
        </CardContent>
      </Card>
    </DualPaneLayout>
  );
}
