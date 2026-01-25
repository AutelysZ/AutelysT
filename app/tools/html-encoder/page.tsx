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
import type { HistoryEntry } from "@/lib/history/db";

const paramsSchema = z.object({
  activeSide: z.enum(["left", "right"]).default("left"),
  leftText: z.string().default(""),
  rightText: z.string().default(""),
});

function encodeHtml(value: string) {
  if (typeof document !== "undefined") {
    const node = document.createElement("textarea");
    node.textContent = value;
    return node.innerHTML;
  }
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function decodeHtml(value: string) {
  if (typeof document !== "undefined") {
    const node = document.createElement("textarea");
    node.innerHTML = value;
    return node.value;
  }
  return value
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, "&");
}

export default function HtmlEncoderPage() {
  return (
    <Suspense fallback={null}>
      <HtmlEncoderContent />
    </Suspense>
  );
}

function HtmlEncoderContent() {
  const { state, setParam, oversizeKeys, hasUrlParams, hydrationSource } =
    useUrlSyncedState("html-encoder", {
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

  const encodeToHtml = React.useCallback(
    (text: string) => {
      try {
        setLeftError(null);
        if (!text) {
          setParam("rightText", "");
          return;
        }
        const encoded = encodeHtml(text);
        if (encoded !== state.rightText) {
          setParam("rightText", encoded);
        }
      } catch (error) {
        setLeftError(
          error instanceof Error ? error.message : "Encoding failed",
        );
      }
    },
    [setParam, state.rightText],
  );

  const decodeFromHtml = React.useCallback(
    (text: string) => {
      try {
        setRightError(null);
        if (!text) {
          setParam("leftText", "");
          return;
        }
        const decoded = decodeHtml(text);
        if (decoded !== state.leftText) {
          setParam("leftText", decoded);
        }
      } catch (error) {
        setRightError(
          error instanceof Error ? error.message : "Decoding failed",
        );
      }
    },
    [setParam, state.leftText],
  );

  const handleLeftChange = React.useCallback(
    (value: string) => {
      setParam("leftText", value);
      setParam("activeSide", "left");
      encodeToHtml(value);
    },
    [setParam, encodeToHtml],
  );

  const handleRightChange = React.useCallback(
    (value: string) => {
      setParam("rightText", value);
      setParam("activeSide", "right");
      decodeFromHtml(value);
    },
    [setParam, decodeFromHtml],
  );

  React.useEffect(() => {
    if (state.activeSide === "left") {
      encodeToHtml(state.leftText);
    } else {
      decodeFromHtml(state.rightText);
    }
  }, [
    state.activeSide,
    state.leftText,
    state.rightText,
    encodeToHtml,
    decodeFromHtml,
  ]);

  const handleLoadHistory = React.useCallback(
    (entry: HistoryEntry) => {
      const { inputs, params } = entry;
      if (inputs.leftText !== undefined) setParam("leftText", inputs.leftText);
      if (inputs.rightText !== undefined)
        setParam("rightText", inputs.rightText);
      if (params.activeSide)
        setParam("activeSide", params.activeSide as "left" | "right");
    },
    [setParam],
  );

  return (
    <ToolPageWrapper
      toolId="html-encoder"
      title="HTML Escape"
      description="Escape text to HTML entities or unescape HTML entities back to readable text."
      onLoadHistory={handleLoadHistory}
    >
      <HtmlEncoderInner
        state={state}
        setParam={setParam}
        oversizeKeys={oversizeKeys}
        hasUrlParams={hasUrlParams}
        hydrationSource={hydrationSource}
        leftError={leftError}
        rightError={rightError}
        handleLeftChange={handleLeftChange}
        handleRightChange={handleRightChange}
      />
    </ToolPageWrapper>
  );
}

function HtmlEncoderInner({
  state,
  setParam,
  oversizeKeys,
  hasUrlParams,
  hydrationSource,
  leftError,
  rightError,
  handleLeftChange,
  handleRightChange,
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
}) {
  const { upsertInputEntry, upsertParams } = useToolHistoryContext();
  const lastInputRef = React.useRef<string>("");
  const hasHydratedInputRef = React.useRef(false);
  const paramsRef = React.useRef({ activeSide: state.activeSide });
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
    if (!activeText || activeText === lastInputRef.current) return;

    const timer = setTimeout(() => {
      lastInputRef.current = activeText;
      upsertInputEntry(
        { leftText: state.leftText, rightText: state.rightText },
        { activeSide: state.activeSide },
        state.activeSide,
        activeText.slice(0, 100),
      );
    }, DEFAULT_URL_SYNC_DEBOUNCE_MS);

    return () => clearTimeout(timer);
  }, [state.leftText, state.rightText, state.activeSide, upsertInputEntry]);

  React.useEffect(() => {
    if (hasUrlParams && !hasHandledUrlRef.current) {
      hasHandledUrlRef.current = true;
      const activeText =
        state.activeSide === "left" ? state.leftText : state.rightText;
      if (activeText) {
        upsertInputEntry(
          { leftText: state.leftText, rightText: state.rightText },
          { activeSide: state.activeSide },
          state.activeSide,
          activeText.slice(0, 100),
        );
      } else {
        upsertParams({ activeSide: state.activeSide }, "interpretation");
      }
    }
  }, [
    hasUrlParams,
    state.leftText,
    state.rightText,
    state.activeSide,
    upsertInputEntry,
    upsertParams,
  ]);

  React.useEffect(() => {
    const nextParams = { activeSide: state.activeSide };
    if (!hasInitializedParamsRef.current) {
      hasInitializedParamsRef.current = true;
      paramsRef.current = nextParams;
      return;
    }
    if (paramsRef.current.activeSide === nextParams.activeSide) return;
    paramsRef.current = nextParams;
    upsertParams(nextParams, "interpretation");
  }, [state.activeSide, upsertParams]);

  const leftWarning = oversizeKeys.includes("leftText")
    ? "Input exceeds 2 KB and is not synced to the URL."
    : null;
  const rightWarning = oversizeKeys.includes("rightText")
    ? "Input exceeds 2 KB and is not synced to the URL."
    : null;

  return (
    <DualPaneLayout
      leftLabel="Plain Text"
      rightLabel="HTML"
      leftValue={state.leftText}
      rightValue={state.rightText}
      onLeftChange={handleLeftChange}
      onRightChange={handleRightChange}
      activeSide={state.activeSide}
      leftError={leftError}
      rightError={rightError}
      leftWarning={leftWarning}
      rightWarning={rightWarning}
      leftPlaceholder="Type plain text to encode..."
      rightPlaceholder="Paste HTML entities to decode..."
    />
  );
}
