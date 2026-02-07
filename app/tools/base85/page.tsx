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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  encodeBase85,
  decodeBase85,
  isValidBase85,
  type Base85Variant,
} from "@/lib/encoding/base85";
import {
  encodeBase91,
  decodeBase91,
  isValidBase91,
} from "@/lib/encoding/base91";
import {
  encodeText,
  decodeText,
  getAllEncodings,
} from "@/lib/encoding/text-encodings";
import type { HistoryEntry } from "@/lib/history/db";

const paramsSchema = z.object({
  encoding: z.string().default("UTF-8"),
  variant: z.enum(["ascii85", "a85", "z85", "base91"]).default("ascii85"),
  activeSide: z.enum(["left", "right"]).default("left"),
  leftText: z.string().default(""),
  rightText: z.string().default(""),
});

const encodings = getAllEncodings();

const variantOptions = [
  { value: "ascii85", label: "Ascii85 (Adobe, framed)" },
  { value: "a85", label: "Ascii85 (raw)" },
  { value: "z85", label: "Z85 (ZeroMQ)" },
  { value: "base91", label: "Base91" },
] as const;

const variantMeta = {
  ascii85: {
    label: "Ascii85",
    extension: "ascii85",
    hint: "Ascii85 wraps output in <~ ~> framing.",
  },
  a85: {
    label: "Ascii85 (raw)",
    extension: "a85",
    hint: "Raw Ascii85 without <~ ~> framing.",
  },
  z85: {
    label: "Z85",
    extension: "z85",
    hint: "Z85 requires input length to be a multiple of 4 bytes.",
  },
  base91: {
    label: "Base91",
    extension: "base91",
    hint: "Base91 uses a 91-character alphabet for compact encoding.",
  },
} as const;

function Base85Content() {
  const { state, setParam, oversizeKeys, hasUrlParams, hydrationSource } =
    useUrlSyncedState("base85", {
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

  const encodeToBase = React.useCallback(
    (text: string) => {
      try {
        setLeftError(null);
        if (!text) {
          setParam("rightText", "");
          return;
        }

        const bytes = encodeText(text, state.encoding);
        if (state.variant === "z85" && bytes.length % 4 !== 0) {
          setLeftError(
            "Z85 requires input length to be a multiple of 4 bytes.",
          );
          setParam("rightText", "");
          return;
        }

        const encoded =
          state.variant === "base91"
            ? encodeBase91(bytes)
            : encodeBase85(bytes, state.variant as Base85Variant);
        setParam("rightText", encoded);
      } catch (err) {
        console.error("Base85 encoding failed", err);
        setLeftError(err instanceof Error ? err.message : "Encoding failed");
      }
    },
    [state.encoding, state.variant, setParam],
  );

  const decodeFromBase = React.useCallback(
    (value: string) => {
      try {
        setRightError(null);
        if (!value) {
          setParam("leftText", "");
          return;
        }

        const trimmed = value.trim();

        if (
          state.variant === "ascii85" &&
          (!trimmed.startsWith("<~") || !trimmed.endsWith("~>"))
        ) {
          setRightError(
            "Ascii85 input must start with <~ and end with ~>. Choose Ascii85 (raw) if unframed.",
          );
          return;
        }

        if (state.variant === "z85") {
          const compact = trimmed.replace(/\s+/g, "");
          if (compact.length % 5 !== 0) {
            setRightError(
              "Z85 input length must be a multiple of 5 characters.",
            );
            return;
          }
        }

        const isValid =
          state.variant === "base91"
            ? isValidBase91(trimmed)
            : isValidBase85(trimmed, state.variant as Base85Variant);
        if (!isValid) {
          setRightError(
            `Invalid ${state.variant === "base91" ? "Base91" : "Base85"} input`,
          );
          return;
        }

        const bytes =
          state.variant === "base91"
            ? decodeBase91(trimmed)
            : decodeBase85(trimmed, state.variant as Base85Variant);
        const text = decodeText(bytes, state.encoding);
        setParam("leftText", text);
      } catch (err) {
        console.error("Base85 decoding failed", err);
        setRightError(err instanceof Error ? err.message : "Decoding failed");
      }
    },
    [state.variant, state.encoding, setParam],
  );

  const handleLeftChange = React.useCallback(
    (value: string) => {
      setParam("leftText", value);
      setParam("activeSide", "left");
      encodeToBase(value);
    },
    [setParam, encodeToBase],
  );

  const handleRightChange = React.useCallback(
    (value: string) => {
      setParam("rightText", value);
      setParam("activeSide", "right");
      decodeFromBase(value);
    },
    [setParam, decodeFromBase],
  );

  React.useEffect(() => {
    if (state.activeSide === "left" && state.leftText) {
      encodeToBase(state.leftText);
    } else if (state.activeSide === "right" && state.rightText) {
      decodeFromBase(state.rightText);
    }
  }, [state.encoding, state.variant]);

  const handleLeftFileUpload = React.useCallback(
    async (file: File) => {
      try {
        const buffer = await file.arrayBuffer();
        const bytes = new Uint8Array(buffer);

        if (state.variant === "z85" && bytes.length % 4 !== 0) {
          setLeftFileResult({
            status: "error",
            message: "Z85 requires input length to be a multiple of 4 bytes.",
          });
          return;
        }

        const encoded =
          state.variant === "base91"
            ? encodeBase91(bytes)
            : encodeBase85(bytes, state.variant as Base85Variant);

        const blob = new Blob([encoded], { type: "text/plain" });
        const url = URL.createObjectURL(blob);

        const extension = variantMeta[state.variant].extension;
        setLeftFileResult({
          status: "success",
          message: `Encoded ${file.name} (${bytes.length} bytes)`,
          downloadUrl: url,
          downloadName: `${file.name}.${extension}`,
        });
      } catch (err) {
        console.error("Base85 file encoding failed", err);
        setLeftFileResult({
          status: "error",
          message: err instanceof Error ? err.message : "Encoding failed",
        });
      }
    },
    [state.variant],
  );

  const handleRightFileUpload = React.useCallback(
    async (file: File) => {
      try {
        const text = (await file.text()).trim();
        if (
          state.variant === "ascii85" &&
          (!text.startsWith("<~") || !text.endsWith("~>"))
        ) {
          setRightFileResult({
            status: "error",
            message:
              "Ascii85 input must start with <~ and end with ~>. Choose Ascii85 (raw) if unframed.",
          });
          return;
        }

        if (state.variant === "z85") {
          const compact = text.replace(/\s+/g, "");
          if (compact.length % 5 !== 0) {
            setRightFileResult({
              status: "error",
              message: "Z85 input length must be a multiple of 5 characters.",
            });
            return;
          }
        }

        const bytes =
          state.variant === "base91"
            ? decodeBase91(text)
            : decodeBase85(text, state.variant as Base85Variant);

        const blob = new Blob([bytes], { type: "application/octet-stream" });
        const url = URL.createObjectURL(blob);

        const baseName = file.name.replace(/\.(ascii85|a85|z85|base91)$/i, "");
        setRightFileResult({
          status: "success",
          message: `Decoded ${file.name} (${bytes.length} bytes)`,
          downloadUrl: url,
          downloadName: `${baseName}.raw`,
        });
      } catch (err) {
        console.error("Base85 file decoding failed", err);
        setRightFileResult({
          status: "error",
          message: err instanceof Error ? err.message : "Decoding failed",
        });
      }
    },
    [state.variant],
  );

  const handleLoadHistory = React.useCallback(
    (entry: HistoryEntry) => {
      const { inputs, params } = entry;
      if (inputs.leftText !== undefined) setParam("leftText", inputs.leftText);
      if (inputs.rightText !== undefined)
        setParam("rightText", inputs.rightText);
      if (params.encoding) setParam("encoding", params.encoding as string);
      if (params.variant)
        setParam(
          "variant",
          params.variant as z.infer<typeof paramsSchema>["variant"],
        );
      if (params.activeSide)
        setParam("activeSide", params.activeSide as "left" | "right");
    },
    [setParam],
  );

  return (
    <ToolPageWrapper
      toolId="base85"
      title="Base85 / Base91"
      description="Encode and decode Base85 (Ascii85/Z85) and Base91 with text encoding support"
      onLoadHistory={handleLoadHistory}
    >
      <Base85Inner
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

function Base85Inner({
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
}) {
  const { upsertInputEntry, upsertParams } = useToolHistoryContext();
  const lastInputRef = React.useRef<string>("");
  const hasHydratedInputRef = React.useRef(false);
  const paramsRef = React.useRef({
    encoding: state.encoding,
    variant: state.variant,
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
          variant: state.variant,
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
    state.variant,
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
            variant: state.variant,
            activeSide: state.activeSide,
          },
          state.activeSide,
          activeText.slice(0, 100),
        );
      } else {
        upsertParams(
          {
            encoding: state.encoding,
            variant: state.variant,
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
    state.variant,
    upsertInputEntry,
    upsertParams,
  ]);

  React.useEffect(() => {
    const nextParams = {
      encoding: state.encoding,
      variant: state.variant,
      activeSide: state.activeSide,
    };
    if (!hasInitializedParamsRef.current) {
      hasInitializedParamsRef.current = true;
      paramsRef.current = nextParams;
      return;
    }
    if (
      paramsRef.current.encoding === nextParams.encoding &&
      paramsRef.current.variant === nextParams.variant &&
      paramsRef.current.activeSide === nextParams.activeSide
    ) {
      return;
    }
    paramsRef.current = nextParams;
    upsertParams(nextParams, "interpretation");
  }, [state.encoding, state.variant, state.activeSide, upsertParams]);

  const leftWarning = oversizeKeys.includes("leftText")
    ? "Input exceeds 2 KB and is not synced to the URL."
    : null;
  const rightWarning = oversizeKeys.includes("rightText")
    ? "Input exceeds 2 KB and is not synced to the URL."
    : null;

  const variantInfo = variantMeta[state.variant];

  return (
    <DualPaneLayout
      leftLabel="Plain Text"
      rightLabel={variantInfo.label}
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
      rightPlaceholder="Enter encoded text to decode..."
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
            <Label className="text-sm whitespace-nowrap">Text Encoding</Label>
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
            <Label className="text-sm whitespace-nowrap">Encoding</Label>
            <Select
              value={state.variant}
              onValueChange={(v) =>
                setParam(
                  "variant",
                  v as z.infer<typeof paramsSchema>["variant"],
                  true,
                )
              }
            >
              <SelectTrigger className="w-56">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {variantOptions.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <p className="w-full text-xs text-muted-foreground">
            {variantInfo.hint}
          </p>
        </CardContent>
      </Card>
    </DualPaneLayout>
  );
}

export default function Base85Page() {
  return (
    <Suspense fallback={null}>
      <Base85Content />
    </Suspense>
  );
}
