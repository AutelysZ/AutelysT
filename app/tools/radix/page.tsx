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
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ArrowLeftRight, Check, Copy } from "lucide-react";
import {
  convertRadix,
  toBase60,
  fromBase60,
  isValidBase60,
} from "@/lib/numbers/radix";
import { cn } from "@/lib/utils";
import type { HistoryEntry } from "@/lib/history/db";

const paramsSchema = z.object({
  leftRadix: z.string().default("10"),
  leftCustomRadix: z.number().default(10),
  leftUpperCase: z.boolean().default(true),
  leftPadding: z.string().default("0"),
  rightRadix: z.string().default("16"),
  rightCustomRadix: z.number().default(16),
  rightUpperCase: z.boolean().default(true),
  rightPadding: z.string().default("0"),
  activeSide: z.enum(["left", "right"]).default("left"),
  leftText: z.string().default(""),
  rightText: z.string().default(""),
});

const RADIX_OPTIONS = [
  { value: "10", label: "Decimal (10)" },
  { value: "16", label: "Hexadecimal (16)" },
  { value: "8", label: "Octal (8)" },
  { value: "2", label: "Binary (2)" },
  { value: "60", label: "Base 60" },
  { value: "custom", label: "Custom" },
];

const PADDING_OPTIONS = ["0", "1", "2", "4", "8"];
const PADDING_OPTIONS_BASE60 = ["0", "2"];

function RadixContent() {
  const { state, setParam, oversizeKeys, hasUrlParams, hydrationSource } =
    useUrlSyncedState("radix", {
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
  const [copiedSide, setCopiedSide] = React.useState<"left" | "right" | null>(
    null,
  );

  const handleCopy = React.useCallback(
    async (side: "left" | "right") => {
      const value = side === "left" ? state.leftText : state.rightText;
      if (!value) return;
      try {
        await navigator.clipboard.writeText(value);
        setCopiedSide(side);
        setTimeout(() => setCopiedSide(null), 1500);
      } catch {}
    },
    [state.leftText, state.rightText],
  );

  const getEffectiveRadix = (side: "left" | "right"): number => {
    const radix = side === "left" ? state.leftRadix : state.rightRadix;
    const custom =
      side === "left" ? state.leftCustomRadix : state.rightCustomRadix;
    if (radix === "custom") return custom;
    return Number.parseInt(radix, 10);
  };

  const getPadding = (side: "left" | "right"): number => {
    const padding = side === "left" ? state.leftPadding : state.rightPadding;
    return Number.parseInt(padding, 10);
  };

  const convertValue = React.useCallback(
    (value: string, fromSide: "left" | "right") => {
      const toSide = fromSide === "left" ? "right" : "left";
      const fromRadix = getEffectiveRadix(fromSide);
      const toRadix = getEffectiveRadix(toSide);
      const toUpperCase =
        toSide === "left" ? state.leftUpperCase : state.rightUpperCase;
      const toPadding = getPadding(toSide);

      try {
        if (fromSide === "left") setLeftError(null);
        else setRightError(null);

        if (!value.trim()) {
          setParam(toSide === "left" ? "leftText" : "rightText", "");
          return;
        }

        let result: string;

        // Handle base60 special case
        if (fromRadix === 60) {
          if (!isValidBase60(value)) throw new Error("Invalid base60 format");
          const decimal = fromBase60(value);
          if (toRadix === 60) {
            result = toBase60(decimal, toPadding as 0 | 2);
          } else {
            result = convertRadix(decimal.toString(), 10, toRadix, {
              upperCase: toUpperCase,
              padding: toPadding,
            });
          }
        } else if (toRadix === 60) {
          const decimal = BigInt(
            convertRadix(value, fromRadix, 10, { upperCase: true }),
          );
          result = toBase60(decimal, toPadding as 0 | 2);
        } else {
          result = convertRadix(value, fromRadix, toRadix, {
            upperCase: toUpperCase,
            padding: toPadding,
          });
        }

        setParam(toSide === "left" ? "leftText" : "rightText", result);
      } catch (err) {
        if (fromSide === "left")
          setLeftError(
            err instanceof Error ? err.message : "Conversion failed",
          );
        else
          setRightError(
            err instanceof Error ? err.message : "Conversion failed",
          );
      }
    },
    [state, setParam],
  );

  const handleLeftChange = React.useCallback(
    (value: string) => {
      setParam("leftText", value);
      setParam("activeSide", "left");
      convertValue(value, "left");
    },
    [setParam, convertValue],
  );

  const handleRightChange = React.useCallback(
    (value: string) => {
      setParam("rightText", value);
      setParam("activeSide", "right");
      convertValue(value, "right");
    },
    [setParam, convertValue],
  );

  // Reconvert when params change
  React.useEffect(() => {
    if (state.activeSide === "left" && state.leftText) {
      convertValue(state.leftText, "left");
    } else if (state.activeSide === "right" && state.rightText) {
      convertValue(state.rightText, "right");
    }
  }, [
    state.leftRadix,
    state.leftCustomRadix,
    state.leftUpperCase,
    state.leftPadding,
    state.rightRadix,
    state.rightCustomRadix,
    state.rightUpperCase,
    state.rightPadding,
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

  const renderSidePanel = (side: "left" | "right") => {
    const isLeft = side === "left";
    const radix = isLeft ? state.leftRadix : state.rightRadix;
    const customRadix = isLeft ? state.leftCustomRadix : state.rightCustomRadix;
    const upperCase = isLeft ? state.leftUpperCase : state.rightUpperCase;
    const padding = isLeft ? state.leftPadding : state.rightPadding;
    const text = isLeft ? state.leftText : state.rightText;
    const error = isLeft ? leftError : rightError;
    const isActive = state.activeSide === side;
    const warning = oversizeKeys.includes(isLeft ? "leftText" : "rightText")
      ? "Input exceeds 2 KB and is not synced to the URL."
      : null;

    const effectiveRadix =
      radix === "custom" ? customRadix : Number.parseInt(radix, 10);
    const showPadding =
      effectiveRadix === 2 || effectiveRadix === 16 || effectiveRadix === 60;
    const paddingOptions =
      effectiveRadix === 60 ? PADDING_OPTIONS_BASE60 : PADDING_OPTIONS;

    return (
      <div className="flex flex-1 flex-col gap-3">
        <Card>
          <CardContent className="space-y-4 p-4">
            <div className="flex flex-col gap-2">
              <div className="flex items-center gap-2">
                <Label className="text-sm whitespace-nowrap">Radix</Label>
                <div className="flex-1 min-w-0 sm:hidden">
                  <Select
                    value={radix}
                    onValueChange={(v) =>
                      setParam(isLeft ? "leftRadix" : "rightRadix", v, true)
                    }
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {RADIX_OPTIONS.map((opt) => (
                        <SelectItem key={opt.value} value={opt.value}>
                          {opt.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="hidden flex-1 sm:block">
                  <RadioGroup
                    value={radix}
                    onValueChange={(v) =>
                      setParam(isLeft ? "leftRadix" : "rightRadix", v, true)
                    }
                    className="grid grid-cols-3 gap-2"
                  >
                    {RADIX_OPTIONS.map((opt) => (
                      <div
                        key={opt.value}
                        className="flex items-center gap-1.5"
                      >
                        <RadioGroupItem
                          value={opt.value}
                          id={`${side}-radix-${opt.value}`}
                        />
                        <Label
                          htmlFor={`${side}-radix-${opt.value}`}
                          className="text-sm cursor-pointer"
                        >
                          {opt.label}
                        </Label>
                      </div>
                    ))}
                  </RadioGroup>
                </div>
              </div>
              {radix === "custom" && (
                <div className="flex items-center gap-2">
                  <Label className="text-sm whitespace-nowrap">Custom</Label>
                  <Input
                    type="number"
                    min={2}
                    max={36}
                    value={customRadix}
                    onChange={(e) =>
                      setParam(
                        isLeft ? "leftCustomRadix" : "rightCustomRadix",
                        Number.parseInt(e.target.value) || 10,
                        true,
                      )
                    }
                    className="flex-1 min-w-0 sm:flex-none sm:w-24"
                    placeholder="2-36"
                  />
                </div>
              )}
            </div>

            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-4">
              <div className="flex items-center gap-2">
                <Checkbox
                  id={`${side}-uppercase`}
                  checked={upperCase}
                  onCheckedChange={(c) =>
                    setParam(
                      isLeft ? "leftUpperCase" : "rightUpperCase",
                      c === true,
                      true,
                    )
                  }
                />
                <Label
                  htmlFor={`${side}-uppercase`}
                  className="text-sm cursor-pointer"
                >
                  Upper case
                </Label>
              </div>

              {showPadding && (
                <div className="flex items-center gap-2">
                  <Label className="text-sm">Padding</Label>
                  <div className="flex-1 min-w-0 sm:flex-none sm:w-20">
                    <Select
                      value={padding}
                      onValueChange={(v) =>
                        setParam(
                          isLeft ? "leftPadding" : "rightPadding",
                          v,
                          true,
                        )
                      }
                    >
                      <SelectTrigger className="w-full">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {paddingOptions.map((p) => (
                          <SelectItem key={p} value={p}>
                            {p === "0" ? "None" : p}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        <div className="flex-1">
          <div className="relative">
            <Input
              value={text}
              onChange={(e) =>
                isLeft
                  ? handleLeftChange(e.target.value)
                  : handleRightChange(e.target.value)
              }
              placeholder={`Enter ${effectiveRadix === 60 ? "base60 (xx:xx:xx)" : `base ${effectiveRadix}`} number...`}
              className={cn(
                "pr-10 font-mono",
                error && "border-destructive",
                isActive && "ring-1 ring-primary",
              )}
            />
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => handleCopy(side)}
              disabled={!text}
              className="absolute right-1 top-1/2 h-7 -translate-y-1/2 px-2 text-xs"
            >
              {copiedSide === side ? (
                <Check className="h-3 w-3" />
              ) : (
                <Copy className="h-3 w-3" />
              )}
            </Button>
          </div>
          {error && <p className="mt-1 text-xs text-destructive">{error}</p>}
          {warning && (
            <p className="mt-1 text-xs text-muted-foreground">{warning}</p>
          )}
        </div>
      </div>
    );
  };

  return (
    <ToolPageWrapper
      toolId="radix"
      title="Base Conversion"
      description="Convert numbers between different bases (radixes)"
      onLoadHistory={handleLoadHistory}
    >
      <RadixInner
        state={state}
        renderSidePanel={renderSidePanel}
        hasUrlParams={hasUrlParams}
        hydrationSource={hydrationSource}
      />
    </ToolPageWrapper>
  );
}

function RadixInner({
  state,
  renderSidePanel,
  hasUrlParams,
  hydrationSource,
}: {
  state: z.infer<typeof paramsSchema>;
  renderSidePanel: (side: "left" | "right") => React.ReactNode;
  hasUrlParams: boolean;
  hydrationSource: "default" | "url" | "history";
}) {
  const { upsertInputEntry, upsertParams } = useToolHistoryContext();
  const lastInputRef = React.useRef<string>("");
  const hasHydratedInputRef = React.useRef(false);
  const paramsRef = React.useRef({
    leftRadix: state.leftRadix,
    leftCustomRadix: state.leftCustomRadix,
    leftUpperCase: state.leftUpperCase,
    leftPadding: state.leftPadding,
    rightRadix: state.rightRadix,
    rightCustomRadix: state.rightCustomRadix,
    rightUpperCase: state.rightUpperCase,
    rightPadding: state.rightPadding,
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
        {
          leftRadix: state.leftRadix,
          leftCustomRadix: state.leftCustomRadix,
          leftUpperCase: state.leftUpperCase,
          leftPadding: state.leftPadding,
          rightRadix: state.rightRadix,
          rightCustomRadix: state.rightCustomRadix,
          rightUpperCase: state.rightUpperCase,
          rightPadding: state.rightPadding,
          activeSide: state.activeSide,
        },
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
          {
            leftRadix: state.leftRadix,
            leftCustomRadix: state.leftCustomRadix,
            leftUpperCase: state.leftUpperCase,
            leftPadding: state.leftPadding,
            rightRadix: state.rightRadix,
            rightCustomRadix: state.rightCustomRadix,
            rightUpperCase: state.rightUpperCase,
            rightPadding: state.rightPadding,
            activeSide: state.activeSide,
          },
          state.activeSide,
          activeText.slice(0, 100),
        );
      } else {
        upsertParams(
          {
            leftRadix: state.leftRadix,
            leftCustomRadix: state.leftCustomRadix,
            leftUpperCase: state.leftUpperCase,
            leftPadding: state.leftPadding,
            rightRadix: state.rightRadix,
            rightCustomRadix: state.rightCustomRadix,
            rightUpperCase: state.rightUpperCase,
            rightPadding: state.rightPadding,
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
    upsertInputEntry,
    upsertParams,
  ]);

  React.useEffect(() => {
    const nextParams = {
      leftRadix: state.leftRadix,
      leftCustomRadix: state.leftCustomRadix,
      leftUpperCase: state.leftUpperCase,
      leftPadding: state.leftPadding,
      rightRadix: state.rightRadix,
      rightCustomRadix: state.rightCustomRadix,
      rightUpperCase: state.rightUpperCase,
      rightPadding: state.rightPadding,
      activeSide: state.activeSide,
    };
    if (!hasInitializedParamsRef.current) {
      hasInitializedParamsRef.current = true;
      paramsRef.current = nextParams;
      return;
    }
    const same =
      paramsRef.current.leftRadix === nextParams.leftRadix &&
      paramsRef.current.leftCustomRadix === nextParams.leftCustomRadix &&
      paramsRef.current.leftUpperCase === nextParams.leftUpperCase &&
      paramsRef.current.leftPadding === nextParams.leftPadding &&
      paramsRef.current.rightRadix === nextParams.rightRadix &&
      paramsRef.current.rightCustomRadix === nextParams.rightCustomRadix &&
      paramsRef.current.rightUpperCase === nextParams.rightUpperCase &&
      paramsRef.current.rightPadding === nextParams.rightPadding &&
      paramsRef.current.activeSide === nextParams.activeSide;
    if (same) return;
    paramsRef.current = nextParams;
    upsertParams(nextParams, "interpretation");
  }, [
    state.leftRadix,
    state.leftCustomRadix,
    state.leftUpperCase,
    state.leftPadding,
    state.rightRadix,
    state.rightCustomRadix,
    state.rightUpperCase,
    state.rightPadding,
    state.activeSide,
    upsertParams,
  ]);

  return (
    <div className="flex flex-col gap-4 md:min-h-[400px] md:flex-row">
      {renderSidePanel("left")}
      <div className="flex items-center justify-center">
        <ArrowLeftRight className="h-5 w-5 text-muted-foreground rotate-90 md:rotate-0" />
      </div>
      {renderSidePanel("right")}
    </div>
  );
}

export default function RadixPage() {
  return (
    <Suspense fallback={null}>
      <RadixContent />
    </Suspense>
  );
}
