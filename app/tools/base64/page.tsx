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
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { SearchableSelect } from "@/components/ui/searchable-select";
import {
  encodeBase64,
  decodeBase64,
  isValidBase64,
} from "@/lib/encoding/base64";
import {
  encodeText,
  decodeText,
  getAllEncodings,
} from "@/lib/encoding/text-encodings";
import type { HistoryEntry } from "@/lib/history/db";

const paramsSchema = z.object({
  encoding: z.string().default("UTF-8"),
  padding: z.boolean().default(true),
  urlSafe: z.boolean().default(false),
  mimeFormat: z.boolean().default(false),
  activeSide: z.enum(["left", "right"]).default("left"),
  leftText: z.string().default(""),
  rightText: z.string().default(""),
});

const encodings = getAllEncodings();

export default function Base64Page() {
  return (
    <Suspense fallback={null}>
      <Base64Content />
    </Suspense>
  );
}

function Base64Content() {
  const { state, setParam, oversizeKeys, hasUrlParams, hydrationSource } =
    useUrlSyncedState("base64", {
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
  const [downloadFilename, setDownloadFilename] = React.useState("");

  // Encode left text to base64
  const encodeToBase64 = React.useCallback(
    (text: string) => {
      try {
        setLeftError(null);
        if (!text) {
          setParam("rightText", "");
          return;
        }

        const bytes = encodeText(text, state.encoding);
        const encoded = encodeBase64(bytes, {
          padding: state.padding,
          urlSafe: state.urlSafe,
          mimeFormat: state.mimeFormat,
        });
        setParam("rightText", encoded);
      } catch (err) {
        setLeftError(err instanceof Error ? err.message : "Encoding failed");
      }
    },
    [state.encoding, state.padding, state.urlSafe, state.mimeFormat, setParam],
  );

  // Decode base64 to text
  const decodeFromBase64 = React.useCallback(
    (base64: string) => {
      try {
        setRightError(null);
        if (!base64) {
          setParam("leftText", "");
          return;
        }

        if (!isValidBase64(base64)) {
          setRightError("Invalid Base64 characters");
          return;
        }

        const bytes = decodeBase64(base64);
        const text = decodeText(bytes, state.encoding);
        setParam("leftText", text);
      } catch (err) {
        setRightError(err instanceof Error ? err.message : "Decoding failed");
      }
    },
    [state.encoding, setParam],
  );

  // Handle left text change
  const handleLeftChange = React.useCallback(
    (value: string) => {
      setParam("leftText", value);
      setParam("activeSide", "left");
      encodeToBase64(value);
    },
    [setParam, encodeToBase64],
  );

  // Handle right text change
  const handleRightChange = React.useCallback(
    (value: string) => {
      setParam("rightText", value);
      setParam("activeSide", "right");
      decodeFromBase64(value);
    },
    [setParam, decodeFromBase64],
  );

  // Recompute when params change
  React.useEffect(() => {
    if (state.activeSide === "left" && state.leftText) {
      encodeToBase64(state.leftText);
    } else if (state.activeSide === "right" && state.rightText) {
      decodeFromBase64(state.rightText);
    }
  }, [state.encoding, state.padding, state.urlSafe, state.mimeFormat]);

  // Handle file upload to left (encode)
  const handleLeftFileUpload = React.useCallback(
    async (file: File) => {
      try {
        const buffer = await file.arrayBuffer();
        const bytes = new Uint8Array(buffer);
        const encoded = encodeBase64(bytes, {
          padding: state.padding,
          urlSafe: state.urlSafe,
          mimeFormat: state.mimeFormat,
        });

        const blob = new Blob([encoded], { type: "text/plain" });
        const url = URL.createObjectURL(blob);

        setDownloadFilename(file.name + ".base64");
        setLeftFileResult({
          status: "success",
          message: `Encoded ${file.name} (${bytes.length} bytes)`,
          downloadUrl: url,
          downloadName: file.name + ".base64",
        });
      } catch (err) {
        setLeftFileResult({
          status: "error",
          message: err instanceof Error ? err.message : "Encoding failed",
        });
      }
    },
    [state.padding, state.urlSafe, state.mimeFormat],
  );

  // Handle file upload to right (decode)
  const handleRightFileUpload = React.useCallback(async (file: File) => {
    try {
      const text = await file.text();
      const bytes = decodeBase64(text);

      const blob = new Blob([bytes], { type: "application/octet-stream" });
      const url = URL.createObjectURL(blob);

      const baseName = file.name.replace(/\.base64$/i, "");
      setDownloadFilename(baseName + ".raw");
      setRightFileResult({
        status: "success",
        message: `Decoded ${file.name} (${bytes.length} bytes)`,
        downloadUrl: url,
        downloadName: baseName + ".raw",
      });
    } catch (err) {
      setRightFileResult({
        status: "error",
        message: err instanceof Error ? err.message : "Decoding failed",
      });
    }
  }, []);

  const handleLoadHistory = React.useCallback(
    (entry: HistoryEntry) => {
      const { inputs, params } = entry;
      if (inputs.leftText !== undefined) setParam("leftText", inputs.leftText);
      if (inputs.rightText !== undefined)
        setParam("rightText", inputs.rightText);
      if (params.encoding) setParam("encoding", params.encoding as string);
      if (params.padding !== undefined)
        setParam("padding", params.padding as boolean);
      if (params.urlSafe !== undefined)
        setParam("urlSafe", params.urlSafe as boolean);
      if (params.mimeFormat !== undefined)
        setParam("mimeFormat", params.mimeFormat as boolean);
      if (params.activeSide)
        setParam("activeSide", params.activeSide as "left" | "right");
    },
    [setParam],
  );

  return (
    <ToolPageWrapper
      toolId="base64"
      title="Base64"
      description="Encode and decode Base64 with various text encodings"
      onLoadHistory={handleLoadHistory}
    >
      <Base64Inner
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
        downloadFilename={downloadFilename}
        setDownloadFilename={setDownloadFilename}
      />
    </ToolPageWrapper>
  );
}

function Base64Inner({
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
  downloadFilename,
  setDownloadFilename,
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
  downloadFilename: string;
  setDownloadFilename: (v: string) => void;
}) {
  const { upsertInputEntry, upsertParams } = useToolHistoryContext();
  const lastInputRef = React.useRef<string>("");
  const hasHydratedInputRef = React.useRef(false);
  const paramsRef = React.useRef({
    encoding: state.encoding,
    padding: state.padding,
    urlSafe: state.urlSafe,
    mimeFormat: state.mimeFormat,
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
          encoding: state.encoding,
          padding: state.padding,
          urlSafe: state.urlSafe,
          mimeFormat: state.mimeFormat,
          activeSide: state.activeSide,
        },
        state.activeSide,
        activeText.slice(0, 100),
      );
    }, DEFAULT_URL_SYNC_DEBOUNCE_MS);

    return () => clearTimeout(timer);
  }, [
    state.leftText,
    state.rightText,
    state.activeSide,
    state.encoding,
    state.padding,
    state.urlSafe,
    state.mimeFormat,
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
            encoding: state.encoding,
            padding: state.padding,
            urlSafe: state.urlSafe,
            mimeFormat: state.mimeFormat,
            activeSide: state.activeSide,
          },
          state.activeSide,
          activeText.slice(0, 100),
        );
      } else {
        upsertParams(
          {
            encoding: state.encoding,
            padding: state.padding,
            urlSafe: state.urlSafe,
            mimeFormat: state.mimeFormat,
            activeSide: state.activeSide,
          },
          "interpretation",
        );
      }
    }
  }, [
    hasUrlParams,
    state.leftText,
    state.rightText,
    state.activeSide,
    state.encoding,
    state.padding,
    state.urlSafe,
    state.mimeFormat,
    upsertInputEntry,
    upsertParams,
  ]);

  React.useEffect(() => {
    const nextParams = {
      encoding: state.encoding,
      padding: state.padding,
      urlSafe: state.urlSafe,
      mimeFormat: state.mimeFormat,
      activeSide: state.activeSide,
    };
    if (!hasInitializedParamsRef.current) {
      hasInitializedParamsRef.current = true;
      paramsRef.current = nextParams;
      return;
    }
    if (
      paramsRef.current.encoding === nextParams.encoding &&
      paramsRef.current.padding === nextParams.padding &&
      paramsRef.current.urlSafe === nextParams.urlSafe &&
      paramsRef.current.mimeFormat === nextParams.mimeFormat &&
      paramsRef.current.activeSide === nextParams.activeSide
    ) {
      return;
    }
    paramsRef.current = nextParams;
    upsertParams(nextParams, "interpretation");
  }, [
    state.encoding,
    state.padding,
    state.urlSafe,
    state.mimeFormat,
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
      rightLabel="Base64"
      leftValue={state.leftText}
      rightValue={state.rightText}
      onLeftChange={handleLeftChange}
      onRightChange={handleRightChange}
      activeSide={state.activeSide}
      leftError={leftError}
      rightError={rightError}
      leftWarning={leftWarning}
      rightWarning={rightWarning}
      leftPlaceholder="Enter text to encode..."
      rightPlaceholder="Enter Base64 to decode..."
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
            <Label htmlFor="encoding" className="text-sm whitespace-nowrap">
              Text Encoding
            </Label>
            <SearchableSelect
              value={state.encoding}
              onValueChange={(v) => setParam("encoding", v, true)}
              options={encodings}
              placeholder="Select encoding..."
              searchPlaceholder="Search encodings..."
              triggerClassName="w-48"
              className="w-64"
            />
          </div>

          <div className="flex items-center gap-2">
            <Checkbox
              id="padding"
              checked={state.padding}
              onCheckedChange={(c) => setParam("padding", c === true, true)}
            />
            <Label htmlFor="padding" className="text-sm cursor-pointer">
              Padding
            </Label>
          </div>

          <div className="flex items-center gap-2">
            <Checkbox
              id="urlSafe"
              checked={state.urlSafe}
              onCheckedChange={(c) => setParam("urlSafe", c === true, true)}
            />
            <Label htmlFor="urlSafe" className="text-sm cursor-pointer">
              URL-safe
            </Label>
          </div>

          <div className="flex items-center gap-2">
            <Checkbox
              id="mimeFormat"
              checked={state.mimeFormat}
              onCheckedChange={(c) => setParam("mimeFormat", c === true, true)}
            />
            <Label htmlFor="mimeFormat" className="text-sm cursor-pointer">
              MIME format
            </Label>
          </div>

          {leftFileResult && (
            <div className="flex items-center gap-2">
              <Label
                htmlFor="downloadName"
                className="text-sm whitespace-nowrap"
              >
                Filename
              </Label>
              <Input
                id="downloadName"
                value={downloadFilename}
                onChange={(e) => setDownloadFilename(e.target.value)}
                className="w-40"
              />
            </div>
          )}
        </CardContent>
      </Card>
    </DualPaneLayout>
  );
}
