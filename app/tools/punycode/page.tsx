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
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  toASCII,
  toUnicode,
  encodePunycode,
  decodePunycode,
} from "@/lib/encoding/punycode";
import type { HistoryEntry } from "@/lib/history/db";

const paramsSchema = z.object({
  mode: z.enum(["domain", "label"]).default("domain"),
  activeSide: z.enum(["left", "right"]).default("left"),
  leftText: z.string().default(""),
  rightText: z.string().default(""),
});

export default function PunycodePage() {
  return (
    <Suspense fallback={null}>
      <PunycodeContent />
    </Suspense>
  );
}

function PunycodeContent() {
  const { state, setParam, oversizeKeys, hasUrlParams, hydrationSource } =
    useUrlSyncedState("punycode", {
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

  // Encode left text to Punycode/ASCII
  const encodeText = React.useCallback(
    (text: string) => {
      try {
        setLeftError(null);
        if (!text) {
          setParam("rightText", "");
          return;
        }

        const encoded =
          state.mode === "domain" ? toASCII(text) : encodePunycode(text);
        setParam("rightText", encoded);
      } catch (err) {
        setLeftError(err instanceof Error ? err.message : "Encoding failed");
      }
    },
    [state.mode, setParam],
  );

  // Decode Punycode/ASCII to Unicode
  const decodeText = React.useCallback(
    (text: string) => {
      try {
        setRightError(null);
        if (!text) {
          setParam("leftText", "");
          return;
        }

        const decoded =
          state.mode === "domain" ? toUnicode(text) : decodePunycode(text);
        setParam("leftText", decoded);
      } catch (err) {
        setRightError(err instanceof Error ? err.message : "Decoding failed");
      }
    },
    [state.mode, setParam],
  );

  // Handle left text change
  const handleLeftChange = React.useCallback(
    (value: string) => {
      setParam("leftText", value);
      setParam("activeSide", "left");
      encodeText(value);
    },
    [setParam, encodeText],
  );

  // Handle right text change
  const handleRightChange = React.useCallback(
    (value: string) => {
      setParam("rightText", value);
      setParam("activeSide", "right");
      decodeText(value);
    },
    [setParam, decodeText],
  );

  // Recompute when mode changes
  React.useEffect(() => {
    if (state.activeSide === "left" && state.leftText) {
      encodeText(state.leftText);
    } else if (state.activeSide === "right" && state.rightText) {
      decodeText(state.rightText);
    }
  }, [state.mode]);

  const handleLoadHistory = React.useCallback(
    (entry: HistoryEntry) => {
      const { inputs, params } = entry;
      if (inputs.leftText !== undefined) setParam("leftText", inputs.leftText);
      if (inputs.rightText !== undefined)
        setParam("rightText", inputs.rightText);
      if (params.mode) setParam("mode", params.mode as "domain" | "label");
      if (params.activeSide)
        setParam("activeSide", params.activeSide as "left" | "right");
    },
    [setParam],
  );

  return (
    <ToolPageWrapper
      toolId="punycode"
      title="Punycode"
      description="Encode and decode internationalized domain names (IDN)"
      onLoadHistory={handleLoadHistory}
    >
      <PunycodeInner
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

function PunycodeInner({
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
  const paramsRef = React.useRef({
    mode: state.mode,
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
    if (!activeText || activeText === lastInputRef.current) return;

    const timer = setTimeout(() => {
      lastInputRef.current = activeText;
      upsertInputEntry(
        { leftText: state.leftText, rightText: state.rightText },
        { mode: state.mode, activeSide: state.activeSide },
        state.activeSide,
        activeText.slice(0, 100),
      );
    }, DEFAULT_URL_SYNC_DEBOUNCE_MS);

    return () => clearTimeout(timer);
  }, [
    state.leftText,
    state.rightText,
    state.activeSide,
    state.mode,
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
          { mode: state.mode, activeSide: state.activeSide },
          state.activeSide,
          activeText.slice(0, 100),
        );
      } else {
        upsertParams(
          { mode: state.mode, activeSide: state.activeSide },
          "interpretation",
        );
      }
    }
  }, [
    hasUrlParams,
    state.leftText,
    state.rightText,
    state.activeSide,
    state.mode,
    upsertInputEntry,
    upsertParams,
  ]);

  React.useEffect(() => {
    const nextParams = {
      mode: state.mode,
      activeSide: state.activeSide,
    };
    if (!hasInitializedParamsRef.current) {
      hasInitializedParamsRef.current = true;
      paramsRef.current = nextParams;
      return;
    }
    if (
      paramsRef.current.mode === nextParams.mode &&
      paramsRef.current.activeSide === nextParams.activeSide
    ) {
      return;
    }
    paramsRef.current = nextParams;
    upsertParams(nextParams, "interpretation");
  }, [state.mode, state.activeSide, upsertParams]);

  const leftWarning = oversizeKeys.includes("leftText")
    ? "Input exceeds 2 KB and is not synced to the URL."
    : null;
  const rightWarning = oversizeKeys.includes("rightText")
    ? "Input exceeds 2 KB and is not synced to the URL."
    : null;

  return (
    <DualPaneLayout
      leftLabel="Unicode"
      rightLabel="Punycode (ASCII)"
      leftValue={state.leftText}
      rightValue={state.rightText}
      onLeftChange={handleLeftChange}
      onRightChange={handleRightChange}
      activeSide={state.activeSide}
      leftError={leftError}
      rightError={rightError}
      leftWarning={leftWarning}
      rightWarning={rightWarning}
      leftPlaceholder={
        state.mode === "domain"
          ? "Enter domain (e.g., example.com)"
          : "Enter text to encode..."
      }
      rightPlaceholder={
        state.mode === "domain"
          ? "Enter ASCII domain (e.g., xn--...)"
          : "Enter Punycode to decode..."
      }
    >
      <Card>
        <CardContent className="flex flex-wrap items-center gap-6 p-4">
          <div className="flex items-center gap-4">
            <Label className="text-sm whitespace-nowrap">Mode</Label>
            <RadioGroup
              value={state.mode}
              onValueChange={(v) =>
                setParam("mode", v as "domain" | "label", true)
              }
              className="flex gap-4"
            >
              <div className="flex items-center gap-2">
                <RadioGroupItem value="domain" id="mode-domain" />
                <Label htmlFor="mode-domain" className="cursor-pointer text-sm">
                  Domain (IDN)
                </Label>
              </div>
              <div className="flex items-center gap-2">
                <RadioGroupItem value="label" id="mode-label" />
                <Label htmlFor="mode-label" className="cursor-pointer text-sm">
                  Raw Label
                </Label>
              </div>
            </RadioGroup>
          </div>

          <div className="text-xs text-muted-foreground">
            {state.mode === "domain"
              ? "Converts full domain names with automatic xn-- prefix handling"
              : "Encodes/decodes raw Punycode without xn-- prefix"}
          </div>
        </CardContent>
      </Card>
    </DualPaneLayout>
  );
}
