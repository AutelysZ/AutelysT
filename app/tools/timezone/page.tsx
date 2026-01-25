"use client";

import * as React from "react";
import { Suspense } from "react";
import { z } from "zod";
import { Clock, Copy, Check } from "lucide-react";
import {
  ToolPageWrapper,
  useToolHistoryContext,
} from "@/components/tool-ui/tool-page-wrapper";
import {
  DEFAULT_URL_SYNC_DEBOUNCE_MS,
  useUrlSyncedState,
} from "@/lib/url-state/use-url-synced-state";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { SearchableSelect } from "@/components/ui/searchable-select";
import { DateTimePicker } from "@/components/ui/date-time-picker";
import { Label } from "@/components/ui/label";
import {
  getAllTimezones,
  isUnixEpochTimezone,
  parseTimestamp,
  formatTimestamp,
  getFormattedOutputs,
} from "@/lib/timezone/timezone";
import type { HistoryEntry } from "@/lib/history/db";
import { cn } from "@/lib/utils";

const paramsSchema = z.object({
  leftTimezone: z.string().default("local"),
  rightTimezone: z.string().default("unix-s"),
  leftText: z.string().default(""),
  rightText: z.string().default(""),
  activeSide: z.enum(["left", "right"]).default("left"),
});

const timezones = getAllTimezones();

export default function TimezonePage() {
  return (
    <Suspense fallback={null}>
      <TimezoneContent />
    </Suspense>
  );
}

function TimezoneContent() {
  const { state, setParam, oversizeKeys, hasUrlParams, hydrationSource } =
    useUrlSyncedState("timezone", {
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

  const convertFromSide = React.useCallback(
    (value: string, fromSide: "left" | "right", updateActiveSide: boolean) => {
      const fromTimezone =
        fromSide === "left" ? state.leftTimezone : state.rightTimezone;
      const toTimezone =
        fromSide === "left" ? state.rightTimezone : state.leftTimezone;
      const setError = fromSide === "left" ? setLeftError : setRightError;
      const targetKey = fromSide === "left" ? "rightText" : "leftText";

      setError(null);

      if (!value) {
        setParam(targetKey, "");
        return;
      }

      const date = parseTimestamp(value, fromTimezone);
      if (!date) {
        setError("Invalid date/time format");
        return;
      }

      const formatted = formatTimestamp(date, toTimezone);
      setParam(targetKey, formatted);
      if (updateActiveSide) {
        setParam("activeSide", fromSide);
      }
    },
    [state.leftTimezone, state.rightTimezone, setParam],
  );

  const handleLeftChange = React.useCallback(
    (value: string) => {
      setParam("leftText", value);
      convertFromSide(value, "left", true);
    },
    [setParam, convertFromSide],
  );

  const handleRightChange = React.useCallback(
    (value: string) => {
      setParam("rightText", value);
      convertFromSide(value, "right", true);
    },
    [setParam, convertFromSide],
  );

  const handleNow = React.useCallback(
    (side: "left" | "right") => {
      const now = new Date();

      if (side === "left") {
        const leftFormatted = formatTimestamp(now, state.leftTimezone);
        const rightFormatted = formatTimestamp(now, state.rightTimezone);
        setParam("leftText", leftFormatted);
        setParam("rightText", rightFormatted);
        setParam("activeSide", "left");
      } else {
        const rightFormatted = formatTimestamp(now, state.rightTimezone);
        const leftFormatted = formatTimestamp(now, state.leftTimezone);
        setParam("rightText", rightFormatted);
        setParam("leftText", leftFormatted);
        setParam("activeSide", "right");
      }
    },
    [state.leftTimezone, state.rightTimezone, setParam],
  );

  const handleLoadHistory = React.useCallback(
    (entry: HistoryEntry) => {
      const { inputs, params } = entry;
      if (inputs.leftText !== undefined) setParam("leftText", inputs.leftText);
      if (inputs.rightText !== undefined)
        setParam("rightText", inputs.rightText);
      if (params.leftTimezone)
        setParam("leftTimezone", params.leftTimezone as string);
      if (params.rightTimezone)
        setParam("rightTimezone", params.rightTimezone as string);
      if (params.activeSide)
        setParam("activeSide", params.activeSide as "left" | "right");
    },
    [setParam],
  );

  React.useEffect(() => {
    if (state.activeSide === "left" && state.leftText) {
      convertFromSide(state.leftText, "left", false);
    } else if (state.activeSide === "right" && state.rightText) {
      convertFromSide(state.rightText, "right", false);
    }
  }, [
    state.leftTimezone,
    state.rightTimezone,
    state.activeSide,
    state.leftText,
    state.rightText,
    convertFromSide,
  ]);

  return (
    <ToolPageWrapper
      toolId="timezone"
      title="Time Zone Converter"
      description="Convert times between different time zones with Unix epoch support"
      onLoadHistory={handleLoadHistory}
    >
      <TimezoneInner
        state={state}
        setParam={setParam}
        oversizeKeys={oversizeKeys}
        hasUrlParams={hasUrlParams}
        hydrationSource={hydrationSource}
        leftError={leftError}
        rightError={rightError}
        handleLeftChange={handleLeftChange}
        handleRightChange={handleRightChange}
        handleNow={handleNow}
      />
    </ToolPageWrapper>
  );
}

function TimezoneInner({
  state,
  setParam,
  oversizeKeys,
  hasUrlParams,
  hydrationSource,
  leftError,
  rightError,
  handleLeftChange,
  handleRightChange,
  handleNow,
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
  handleNow: (side: "left" | "right") => void;
}) {
  const { upsertInputEntry, upsertParams } = useToolHistoryContext();
  const lastInputRef = React.useRef<string>("");
  const hasHydratedInputRef = React.useRef(false);
  const paramsRef = React.useRef({
    leftTimezone: state.leftTimezone,
    rightTimezone: state.rightTimezone,
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
          leftTimezone: state.leftTimezone,
          rightTimezone: state.rightTimezone,
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
    state.leftTimezone,
    state.rightTimezone,
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
            leftTimezone: state.leftTimezone,
            rightTimezone: state.rightTimezone,
            activeSide: state.activeSide,
          },
          state.activeSide,
          activeText.slice(0, 100),
        );
      } else {
        upsertParams(
          {
            leftTimezone: state.leftTimezone,
            rightTimezone: state.rightTimezone,
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
    state.leftTimezone,
    state.rightTimezone,
    upsertInputEntry,
    upsertParams,
  ]);

  React.useEffect(() => {
    const nextParams = {
      leftTimezone: state.leftTimezone,
      rightTimezone: state.rightTimezone,
      activeSide: state.activeSide,
    };
    if (!hasInitializedParamsRef.current) {
      hasInitializedParamsRef.current = true;
      paramsRef.current = nextParams;
      return;
    }
    if (
      paramsRef.current.leftTimezone === nextParams.leftTimezone &&
      paramsRef.current.rightTimezone === nextParams.rightTimezone &&
      paramsRef.current.activeSide === nextParams.activeSide
    ) {
      return;
    }
    paramsRef.current = nextParams;
    upsertParams(nextParams, "interpretation");
  }, [state.leftTimezone, state.rightTimezone, state.activeSide, upsertParams]);

  const leftDate = React.useMemo(() => {
    if (!state.leftText) return null;
    return parseTimestamp(state.leftText, state.leftTimezone);
  }, [state.leftText, state.leftTimezone]);

  const rightDate = React.useMemo(() => {
    if (!state.rightText) return null;
    return parseTimestamp(state.rightText, state.rightTimezone);
  }, [state.rightText, state.rightTimezone]);

  const baseDate = state.activeSide === "left" ? leftDate : rightDate;
  const outputDate = baseDate ?? leftDate ?? rightDate;

  return (
    <div className="flex h-full flex-col gap-4">
      <div className="flex min-h-0 flex-1 flex-col gap-4 md:flex-row">
        {/* Left Column */}
        <div className="flex w-full flex-col gap-4 md:flex-1 min-w-0">
          <TimezoneInputPane
            side="left"
            timezone={state.leftTimezone}
            text={state.leftText}
            error={leftError}
            isActive={state.activeSide === "left"}
            warning={
              oversizeKeys.includes("leftText")
                ? "Input exceeds 2 KB and is not synced to the URL."
                : null
            }
            onTimezoneChange={(v) => setParam("leftTimezone", v, true)}
            onTextChange={handleLeftChange}
            onNow={() => handleNow("left")}
          />
          <div className="flex items-center justify-center text-muted-foreground">
            <Clock className="h-4 w-4" />
          </div>
          <TimezoneInputPane
            side="right"
            timezone={state.rightTimezone}
            text={state.rightText}
            error={rightError}
            isActive={state.activeSide === "right"}
            warning={
              oversizeKeys.includes("rightText")
                ? "Input exceeds 2 KB and is not synced to the URL."
                : null
            }
            onTimezoneChange={(v) => setParam("rightTimezone", v, true)}
            onTextChange={handleRightChange}
            onNow={() => handleNow("right")}
          />
        </div>

        {/* Right Column */}
        <TimezoneOutputPane date={outputDate} timezone={state.rightTimezone} />
      </div>
    </div>
  );
}

function TimezoneInputPane({
  side,
  timezone,
  text,
  error,
  isActive,
  warning,
  onTimezoneChange,
  onTextChange,
  onNow,
}: {
  side: "left" | "right";
  timezone: string;
  text: string;
  error: string | null;
  isActive: boolean;
  warning: string | null;
  onTimezoneChange: (v: string) => void;
  onTextChange: (v: string) => void;
  onNow: () => void;
}) {
  const [copied, setCopied] = React.useState<string | null>(null);

  const handleCopy = async (value: string, key: string) => {
    await navigator.clipboard.writeText(value);
    setCopied(key);
    setTimeout(() => setCopied(null), 2000);
  };

  const handleDateTimeChange = React.useCallback(
    (pickedDate: Date | undefined) => {
      if (!pickedDate) return;
      const formatted = formatTimestamp(pickedDate, timezone);
      onTextChange(formatted);
    },
    [timezone, onTextChange],
  );

  const currentDate = React.useMemo(() => {
    if (!text) return undefined;
    const parsed = parseTimestamp(text, timezone);
    return parsed || undefined;
  }, [text, timezone]);

  return (
    <div className="flex w-full flex-col gap-3 rounded-md border p-4">
      <div className="flex items-center gap-2 flex-nowrap">
        <div className="min-w-0 flex-1">
          <SearchableSelect
            value={timezone}
            onValueChange={onTimezoneChange}
            options={timezones}
            placeholder="Select timezone..."
            searchPlaceholder="Search timezones..."
            triggerClassName="w-full"
            className="w-full"
          />
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <DateTimePicker date={currentDate} setDate={handleDateTimeChange} />
          <Button variant="outline" size="sm" onClick={onNow}>
            Now
          </Button>
        </div>
      </div>

      {/* Row 2: Input without card wrapper */}
      <div className="shrink-0">
        <div className="mb-1 flex items-center justify-between">
          <Label
            className={cn("text-sm font-medium", isActive && "text-primary")}
          >
            {isUnixEpochTimezone(timezone) ? "Timestamp" : "Date & Time"}
          </Label>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => handleCopy(text, "input")}
            disabled={!text}
            className="h-7 gap-1 px-2 text-xs"
          >
            {copied === "input" ? (
              <>
                <Check className="h-3 w-3" />
                Copied
              </>
            ) : (
              <>
                <Copy className="h-3 w-3" />
                Copy
              </>
            )}
          </Button>
        </div>
        <Input
          value={text}
          onChange={(e) => onTextChange(e.target.value)}
          placeholder={
            isUnixEpochTimezone(timezone)
              ? "Enter unix timestamp..."
              : "Enter date/time or pick from calendar..."
          }
          className={cn(
            "font-mono text-sm",
            error && "border-destructive",
            isActive && "ring-1 ring-primary",
          )}
        />
        {error && <p className="mt-1 text-xs text-destructive">{error}</p>}
        {warning && (
          <p className="mt-1 text-xs text-muted-foreground">{warning}</p>
        )}
      </div>
    </div>
  );
}

function TimezoneOutputPane({
  date,
  timezone,
}: {
  date: Date | null;
  timezone: string;
}) {
  const [copied, setCopied] = React.useState<string | null>(null);

  const handleCopy = async (value: string, key: string) => {
    await navigator.clipboard.writeText(value);
    setCopied(key);
    setTimeout(() => setCopied(null), 2000);
  };

  const outputs = React.useMemo(() => {
    if (!date) return null;
    return getFormattedOutputs(date, timezone);
  }, [date, timezone]);

  if (!outputs) {
    return (
      <div className="flex w-full flex-col gap-3 rounded-md border p-4 md:flex-1 min-w-0">
        <div className="text-sm text-muted-foreground">
          Formatted outputs appear here.
        </div>
      </div>
    );
  }

  return (
    <div className="flex w-full flex-col gap-3 rounded-md border p-4 md:flex-1 min-w-0">
      <div className="text-sm font-medium text-muted-foreground">
        Formatted ({timezone})
      </div>
      <div className="min-h-0 flex-1 overflow-auto">
        <table className="w-full text-sm">
          <tbody>
            {Object.entries(outputs).map(([label, value]) => (
              <tr key={label} className="group border-b last:border-b-0">
                <td className="py-2 pr-3 align-top text-muted-foreground whitespace-nowrap">
                  {label}
                </td>
                <td className="py-2 align-top">
                  <code className="break-all text-muted-foreground">
                    {value}
                  </code>
                </td>
                <td className="py-2 pl-2 align-top text-right">
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => handleCopy(value, label)}
                    className="h-5 w-5 shrink-0 text-muted-foreground transition-opacity sm:opacity-0 sm:group-hover:opacity-100"
                    aria-label={`Copy ${label}`}
                  >
                    {copied === label ? (
                      <Check className="h-3 w-3" />
                    ) : (
                      <Copy className="h-3 w-3" />
                    )}
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
