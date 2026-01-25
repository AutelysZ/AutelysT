"use client";

import * as React from "react";
import { Suspense } from "react";
import { z } from "zod";
import {
  Clock,
  Copy,
  Check,
  ArrowRight,
  Calendar,
  RotateCcw,
} from "lucide-react";
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
import { Label } from "@/components/ui/label";
import { DateTimePicker } from "@/components/ui/date-time-picker";
import { Badge } from "@/components/ui/badge";
import {
  parseDuration,
  buildDuration,
  toTotalSeconds,
  toTotalMinutes,
  toTotalHours,
  toTotalDays,
  toTotalWeeks,
  toHumanReadable,
  addDurationToDate,
  DURATION_PRESETS,
  EMPTY_DURATION,
  type DurationComponents,
} from "@/lib/duration/duration";
import type { HistoryEntry } from "@/lib/history/db";
import { cn } from "@/lib/utils";

const paramsSchema = z.object({
  input: z.string().default(""),
  years: z.coerce.number().default(0),
  months: z.coerce.number().default(0),
  weeks: z.coerce.number().default(0),
  days: z.coerce.number().default(0),
  hours: z.coerce.number().default(0),
  minutes: z.coerce.number().default(0),
  seconds: z.coerce.number().default(0),
  startDate: z.string().default(""),
  mode: z.enum(["parse", "build"]).default("parse"),
});

type ParamsType = z.infer<typeof paramsSchema>;

export default function DurationPage() {
  return (
    <Suspense fallback={null}>
      <DurationContent />
    </Suspense>
  );
}

function DurationContent() {
  const { state, setParam, oversizeKeys, hasUrlParams, hydrationSource } =
    useUrlSyncedState("duration", {
      schema: paramsSchema,
      defaults: paramsSchema.parse({}),
    });

  const [parseError, setParseError] = React.useState<string | null>(null);
  const [copied, setCopied] = React.useState<string | null>(null);

  const handleLoadHistory = React.useCallback(
    (entry: HistoryEntry) => {
      const { inputs, params } = entry;
      if (inputs.input !== undefined) setParam("input", inputs.input);
      if (params.mode) setParam("mode", params.mode as "parse" | "build");
      if (params.years !== undefined) setParam("years", Number(params.years));
      if (params.months !== undefined)
        setParam("months", Number(params.months));
      if (params.weeks !== undefined) setParam("weeks", Number(params.weeks));
      if (params.days !== undefined) setParam("days", Number(params.days));
      if (params.hours !== undefined) setParam("hours", Number(params.hours));
      if (params.minutes !== undefined)
        setParam("minutes", Number(params.minutes));
      if (params.seconds !== undefined)
        setParam("seconds", Number(params.seconds));
      if (params.startDate !== undefined)
        setParam("startDate", params.startDate as string);
    },
    [setParam],
  );

  // Parse mode: parse input and update components
  const parsedComponents = React.useMemo(() => {
    if (state.mode !== "parse" || !state.input) {
      setParseError(null);
      return null;
    }
    const { components, error } = parseDuration(state.input);
    setParseError(error);
    return error ? null : components;
  }, [state.mode, state.input]);

  // Build mode: build duration from components
  const builtDuration = React.useMemo(() => {
    if (state.mode !== "build") return null;
    const components: DurationComponents = {
      years: state.years,
      months: state.months,
      weeks: state.weeks,
      days: state.days,
      hours: state.hours,
      minutes: state.minutes,
      seconds: state.seconds,
    };
    return buildDuration(components);
  }, [
    state.mode,
    state.years,
    state.months,
    state.weeks,
    state.days,
    state.hours,
    state.minutes,
    state.seconds,
  ]);

  // Active components for display
  const activeComponents: DurationComponents = React.useMemo(() => {
    if (state.mode === "parse" && parsedComponents) {
      return parsedComponents;
    }
    return {
      years: state.years,
      months: state.months,
      weeks: state.weeks,
      days: state.days,
      hours: state.hours,
      minutes: state.minutes,
      seconds: state.seconds,
    };
  }, [
    state.mode,
    parsedComponents,
    state.years,
    state.months,
    state.weeks,
    state.days,
    state.hours,
    state.minutes,
    state.seconds,
  ]);

  // Calculate totals
  const totals = React.useMemo(() => {
    const hasValues = Object.values(activeComponents).some((v) => v !== 0);
    if (!hasValues) return null;
    return {
      seconds: toTotalSeconds(activeComponents),
      minutes: toTotalMinutes(activeComponents),
      hours: toTotalHours(activeComponents),
      days: toTotalDays(activeComponents),
      weeks: toTotalWeeks(activeComponents),
      humanReadable: toHumanReadable(activeComponents),
    };
  }, [activeComponents]);

  // End date calculation
  const endDate = React.useMemo(() => {
    if (!state.startDate) return null;
    const start = new Date(state.startDate);
    if (isNaN(start.getTime())) return null;
    return addDurationToDate(start, activeComponents);
  }, [state.startDate, activeComponents]);

  const handleCopy = async (value: string, key: string) => {
    await navigator.clipboard.writeText(value);
    setCopied(key);
    setTimeout(() => setCopied(null), 2000);
  };

  const handlePreset = (preset: string) => {
    setParam("input", preset);
    setParam("mode", "parse");
  };

  const handleReset = () => {
    setParam("input", "");
    setParam("years", 0);
    setParam("months", 0);
    setParam("weeks", 0);
    setParam("days", 0);
    setParam("hours", 0);
    setParam("minutes", 0);
    setParam("seconds", 0);
    setParam("startDate", "");
  };

  const handleComponentChange = (
    key: keyof DurationComponents,
    value: string,
  ) => {
    const numValue = parseFloat(value) || 0;
    setParam(key, numValue);
  };

  const handleStartDateChange = (date: Date | undefined) => {
    if (date) {
      setParam("startDate", date.toISOString());
    } else {
      setParam("startDate", "");
    }
  };

  const currentStartDate = React.useMemo(() => {
    if (!state.startDate) return undefined;
    const date = new Date(state.startDate);
    return isNaN(date.getTime()) ? undefined : date;
  }, [state.startDate]);

  return (
    <ToolPageWrapper
      toolId="duration"
      title="ISO 8601 Duration"
      description="Parse and build ISO 8601 duration strings"
      onLoadHistory={handleLoadHistory}
    >
      <DurationInner
        state={state}
        setParam={setParam}
        parseError={parseError}
        parsedComponents={parsedComponents}
        builtDuration={builtDuration}
        activeComponents={activeComponents}
        totals={totals}
        endDate={endDate}
        currentStartDate={currentStartDate}
        copied={copied}
        handleCopy={handleCopy}
        handlePreset={handlePreset}
        handleReset={handleReset}
        handleComponentChange={handleComponentChange}
        handleStartDateChange={handleStartDateChange}
        hydrationSource={hydrationSource}
        hasUrlParams={hasUrlParams}
      />
    </ToolPageWrapper>
  );
}

function DurationInner({
  state,
  setParam,
  parseError,
  parsedComponents,
  builtDuration,
  activeComponents,
  totals,
  endDate,
  currentStartDate,
  copied,
  handleCopy,
  handlePreset,
  handleReset,
  handleComponentChange,
  handleStartDateChange,
  hydrationSource,
  hasUrlParams,
}: {
  state: ParamsType;
  setParam: <K extends keyof ParamsType>(
    key: K,
    value: ParamsType[K],
    updateHistory?: boolean,
  ) => void;
  parseError: string | null;
  parsedComponents: DurationComponents | null;
  builtDuration: string | null;
  activeComponents: DurationComponents;
  totals: {
    seconds: number;
    minutes: number;
    hours: number;
    days: number;
    weeks: number;
    humanReadable: string;
  } | null;
  endDate: Date | null;
  currentStartDate: Date | undefined;
  copied: string | null;
  handleCopy: (value: string, key: string) => void;
  handlePreset: (preset: string) => void;
  handleReset: () => void;
  handleComponentChange: (key: keyof DurationComponents, value: string) => void;
  handleStartDateChange: (date: Date | undefined) => void;
  hydrationSource: "default" | "url" | "history";
  hasUrlParams: boolean;
}) {
  const { upsertInputEntry, upsertParams } = useToolHistoryContext();
  const lastInputRef = React.useRef<string>("");
  const hasHydratedInputRef = React.useRef(false);
  const hasHandledUrlRef = React.useRef(false);

  React.useEffect(() => {
    if (hasHydratedInputRef.current) return;
    if (hydrationSource === "default") return;
    lastInputRef.current = state.input;
    hasHydratedInputRef.current = true;
  }, [hydrationSource, state.input]);

  React.useEffect(() => {
    if (!state.input || state.input === lastInputRef.current) return;

    const timer = setTimeout(() => {
      lastInputRef.current = state.input;
      upsertInputEntry(
        { input: state.input },
        {
          mode: state.mode,
          years: state.years,
          months: state.months,
          weeks: state.weeks,
          days: state.days,
          hours: state.hours,
          minutes: state.minutes,
          seconds: state.seconds,
          startDate: state.startDate,
        },
        "input",
        state.input.slice(0, 100),
      );
    }, DEFAULT_URL_SYNC_DEBOUNCE_MS);

    return () => clearTimeout(timer);
  }, [state, upsertInputEntry]);

  React.useEffect(() => {
    if (hasUrlParams && !hasHandledUrlRef.current) {
      hasHandledUrlRef.current = true;
      if (state.input) {
        upsertInputEntry(
          { input: state.input },
          {
            mode: state.mode,
            years: state.years,
            months: state.months,
            weeks: state.weeks,
            days: state.days,
            hours: state.hours,
            minutes: state.minutes,
            seconds: state.seconds,
            startDate: state.startDate,
          },
          "input",
          state.input.slice(0, 100),
        );
      }
    }
  }, [hasUrlParams, state, upsertInputEntry]);

  const durationOutput =
    state.mode === "parse"
      ? parsedComponents
        ? buildDuration(parsedComponents)
        : null
      : builtDuration;

  return (
    <div className="flex h-full flex-col gap-6">
      {/* Mode Toggle & Presets */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex rounded-lg border p-1">
          <Button
            variant={state.mode === "parse" ? "default" : "ghost"}
            size="sm"
            onClick={() => setParam("mode", "parse")}
            className="rounded-md"
          >
            Parse
          </Button>
          <Button
            variant={state.mode === "build" ? "default" : "ghost"}
            size="sm"
            onClick={() => setParam("mode", "build")}
            className="rounded-md"
          >
            Build
          </Button>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <span className="text-sm text-muted-foreground">Presets:</span>
          {DURATION_PRESETS.map((preset) => (
            <Badge
              key={preset.value}
              variant="outline"
              className="cursor-pointer hover:bg-accent"
              onClick={() => handlePreset(preset.value)}
            >
              {preset.label}
            </Badge>
          ))}
        </div>

        <Button
          variant="ghost"
          size="sm"
          onClick={handleReset}
          className="ml-auto gap-1.5"
        >
          <RotateCcw className="h-3.5 w-3.5" />
          Reset
        </Button>
      </div>

      <div className="flex min-h-0 flex-1 flex-col gap-6 lg:flex-row">
        {/* Left Column - Input */}
        <div className="flex w-full flex-col gap-4 lg:flex-1 min-w-0">
          {/* Parse Mode Input */}
          {state.mode === "parse" && (
            <div className="rounded-lg border p-4">
              <div className="mb-3 flex items-center justify-between">
                <Label className="text-sm font-medium">
                  ISO 8601 Duration String
                </Label>
                {state.input && !parseError && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleCopy(state.input, "input")}
                    className="h-7 gap-1 px-2 text-xs"
                  >
                    {copied === "input" ? (
                      <Check className="h-3 w-3" />
                    ) : (
                      <Copy className="h-3 w-3" />
                    )}
                    Copy
                  </Button>
                )}
              </div>
              <Input
                value={state.input}
                onChange={(e) => setParam("input", e.target.value)}
                placeholder="e.g., P1Y2M3DT4H5M6S"
                className={cn(
                  "font-mono text-base",
                  parseError && "border-destructive",
                )}
              />
              {parseError && (
                <p className="mt-2 text-sm text-destructive">{parseError}</p>
              )}
              <p className="mt-2 text-xs text-muted-foreground">
                Format:
                P[years]Y[months]M[weeks]W[days]DT[hours]H[minutes]M[seconds]S
              </p>
            </div>
          )}

          {/* Build Mode Input */}
          {state.mode === "build" && (
            <div className="rounded-lg border p-4">
              <div className="mb-3 flex items-center justify-between">
                <Label className="text-sm font-medium">
                  Duration Components
                </Label>
                {builtDuration && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleCopy(builtDuration, "built")}
                    className="h-7 gap-1 px-2 text-xs"
                  >
                    {copied === "built" ? (
                      <Check className="h-3 w-3" />
                    ) : (
                      <Copy className="h-3 w-3" />
                    )}
                    Copy
                  </Button>
                )}
              </div>

              {/* Built Duration Output */}
              {builtDuration && (
                <div className="mb-4 rounded-md bg-muted/50 p-3">
                  <code className="font-mono text-lg font-semibold">
                    {builtDuration}
                  </code>
                </div>
              )}

              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                {/* Date Components */}
                <div className="space-y-1.5">
                  <Label className="text-xs text-muted-foreground">Years</Label>
                  <Input
                    type="number"
                    min="0"
                    step="1"
                    value={state.years || ""}
                    onChange={(e) =>
                      handleComponentChange("years", e.target.value)
                    }
                    placeholder="0"
                    className="font-mono"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs text-muted-foreground">
                    Months
                  </Label>
                  <Input
                    type="number"
                    min="0"
                    step="1"
                    value={state.months || ""}
                    onChange={(e) =>
                      handleComponentChange("months", e.target.value)
                    }
                    placeholder="0"
                    className="font-mono"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs text-muted-foreground">Weeks</Label>
                  <Input
                    type="number"
                    min="0"
                    step="1"
                    value={state.weeks || ""}
                    onChange={(e) =>
                      handleComponentChange("weeks", e.target.value)
                    }
                    placeholder="0"
                    className="font-mono"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs text-muted-foreground">Days</Label>
                  <Input
                    type="number"
                    min="0"
                    step="1"
                    value={state.days || ""}
                    onChange={(e) =>
                      handleComponentChange("days", e.target.value)
                    }
                    placeholder="0"
                    className="font-mono"
                  />
                </div>

                {/* Time Components */}
                <div className="space-y-1.5">
                  <Label className="text-xs text-muted-foreground">Hours</Label>
                  <Input
                    type="number"
                    min="0"
                    step="1"
                    value={state.hours || ""}
                    onChange={(e) =>
                      handleComponentChange("hours", e.target.value)
                    }
                    placeholder="0"
                    className="font-mono"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs text-muted-foreground">
                    Minutes
                  </Label>
                  <Input
                    type="number"
                    min="0"
                    step="1"
                    value={state.minutes || ""}
                    onChange={(e) =>
                      handleComponentChange("minutes", e.target.value)
                    }
                    placeholder="0"
                    className="font-mono"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs text-muted-foreground">
                    Seconds
                  </Label>
                  <Input
                    type="number"
                    min="0"
                    step="0.001"
                    value={state.seconds || ""}
                    onChange={(e) =>
                      handleComponentChange("seconds", e.target.value)
                    }
                    placeholder="0"
                    className="font-mono"
                  />
                </div>
              </div>
            </div>
          )}

          {/* Parsed Components Display (Parse Mode) */}
          {state.mode === "parse" && parsedComponents && (
            <div className="rounded-lg border p-4">
              <Label className="mb-3 block text-sm font-medium">
                Parsed Components
              </Label>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                {(
                  [
                    "years",
                    "months",
                    "weeks",
                    "days",
                    "hours",
                    "minutes",
                    "seconds",
                  ] as const
                ).map((key) => (
                  <div key={key} className="rounded-md bg-muted/50 p-2.5">
                    <div className="text-xs text-muted-foreground capitalize">
                      {key}
                    </div>
                    <div className="font-mono text-lg font-semibold">
                      {parsedComponents[key]}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Right Column - Output */}
        <div className="flex w-full flex-col gap-4 lg:flex-1 min-w-0">
          {/* Human Readable */}
          {totals && (
            <div className="rounded-lg border p-4">
              <Label className="mb-3 block text-sm font-medium">
                Human Readable
              </Label>
              <p className="text-base leading-relaxed">
                {totals.humanReadable}
              </p>
            </div>
          )}

          {/* Total Conversions */}
          {totals && (
            <div className="rounded-lg border p-4">
              <div className="mb-3 flex items-center justify-between">
                <Label className="text-sm font-medium">Total Conversions</Label>
                <span className="text-xs text-muted-foreground">
                  (approximate)
                </span>
              </div>
              <div className="space-y-2">
                {[
                  {
                    label: "Total Seconds",
                    value: totals.seconds,
                    key: "seconds",
                  },
                  {
                    label: "Total Minutes",
                    value: totals.minutes,
                    key: "minutes",
                  },
                  { label: "Total Hours", value: totals.hours, key: "hours" },
                  { label: "Total Days", value: totals.days, key: "days" },
                  { label: "Total Weeks", value: totals.weeks, key: "weeks" },
                ].map(({ label, value, key }) => (
                  <div
                    key={key}
                    className="group flex items-center justify-between rounded-md bg-muted/50 px-3 py-2"
                  >
                    <span className="text-sm text-muted-foreground">
                      {label}
                    </span>
                    <div className="flex items-center gap-2">
                      <code className="font-mono text-sm">
                        {formatTotalValue(value)}
                      </code>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleCopy(value.toString(), key)}
                        className="h-6 w-6 opacity-0 transition-opacity group-hover:opacity-100"
                      >
                        {copied === key ? (
                          <Check className="h-3 w-3" />
                        ) : (
                          <Copy className="h-3 w-3" />
                        )}
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Date Calculator */}
          <div className="rounded-lg border p-4">
            <Label className="mb-3 block text-sm font-medium">
              Date Calculator
            </Label>
            <div className="flex flex-col gap-3">
              <div className="flex items-center gap-2">
                <DateTimePicker
                  date={currentStartDate}
                  setDate={handleStartDateChange}
                />
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleStartDateChange(new Date())}
                >
                  Now
                </Button>
              </div>

              {currentStartDate && totals && (
                <div className="flex items-center gap-3 rounded-md bg-muted/50 p-3">
                  <div className="flex-1">
                    <div className="text-xs text-muted-foreground">
                      Start Date
                    </div>
                    <div className="font-mono text-sm">
                      {formatDate(currentStartDate)}
                    </div>
                  </div>
                  <ArrowRight className="h-4 w-4 text-muted-foreground shrink-0" />
                  <div className="flex-1">
                    <div className="text-xs text-muted-foreground">
                      End Date
                    </div>
                    <div className="font-mono text-sm">
                      {endDate ? formatDate(endDate) : "—"}
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Empty State */}
          {!totals && (
            <div className="flex flex-1 items-center justify-center rounded-lg border border-dashed p-8">
              <div className="text-center text-muted-foreground">
                <Clock className="mx-auto mb-2 h-8 w-8 opacity-50" />
                <p className="text-sm">
                  {state.mode === "parse"
                    ? "Enter an ISO 8601 duration string to parse"
                    : "Enter duration components to build"}
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function formatTotalValue(value: number): string {
  if (Number.isInteger(value)) {
    return value.toLocaleString();
  }
  // Show up to 4 decimal places, remove trailing zeros
  return value.toLocaleString(undefined, { maximumFractionDigits: 4 });
}

function formatDate(date: Date): string {
  return date.toLocaleString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}
