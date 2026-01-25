"use client";

import * as React from "react";
import { Suspense } from "react";
import { z } from "zod";
import { ArrowRightLeft, Copy, Check } from "lucide-react";
import {
  ToolPageWrapper,
  useToolHistoryContext,
} from "@/components/tool-ui/tool-page-wrapper";
import {
  DEFAULT_URL_SYNC_DEBOUNCE_MS,
  useUrlSyncedState,
} from "@/lib/url-state/use-url-synced-state";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { HistoryEntry } from "@/lib/history/db";
import {
  type UnitCategory,
  unitCategories,
  convert,
  formatNumber,
  getUnitsByCategory,
} from "@/lib/units/converter";

const categoryValues = unitCategories.map((c) => c.id) as [
  UnitCategory,
  ...UnitCategory[],
];

const paramsSchema = z.object({
  value: z.string().default("1"),
  category: z.enum(categoryValues).default("length"),
  fromUnit: z.string().default("m"),
  toUnit: z.string().default("ft"),
});

// Category families for tab grouping
const categoryFamilies = {
  measurement: ["length", "mass", "volume", "area"],
  physics: ["speed", "pressure", "energy", "power", "force"],
  other: [
    "temperature",
    "time",
    "data",
    "angle",
    "frequency",
    "fuel",
    "cooking",
  ],
} as const;

type CategoryFamily = keyof typeof categoryFamilies;

const categoryFamilyLabels: Record<CategoryFamily, string> = {
  measurement: "Measurement",
  physics: "Physics",
  other: "Other",
};

const categoryFamilyMap: Record<UnitCategory, CategoryFamily> = {
  length: "measurement",
  mass: "measurement",
  volume: "measurement",
  area: "measurement",
  speed: "physics",
  pressure: "physics",
  energy: "physics",
  power: "physics",
  force: "physics",
  temperature: "other",
  time: "other",
  data: "other",
  angle: "other",
  frequency: "other",
  fuel: "other",
  cooking: "other",
};

const categoryLabels: Record<UnitCategory, string> = {
  length: "Length",
  mass: "Mass",
  volume: "Volume",
  area: "Area",
  temperature: "Temperature",
  time: "Time",
  speed: "Speed",
  pressure: "Pressure",
  energy: "Energy",
  power: "Power",
  data: "Data",
  angle: "Angle",
  frequency: "Frequency",
  force: "Force",
  fuel: "Fuel",
  cooking: "Cooking",
};

function ScrollableTabsList({ children }: { children: React.ReactNode }) {
  return (
    <div className="w-full min-w-0">
      <TabsList className="inline-flex h-auto max-w-full flex-wrap items-center justify-start gap-1 [&_[data-slot=tabs-trigger]]:flex-none [&_[data-slot=tabs-trigger]]:!text-sm [&_[data-slot=tabs-trigger][data-state=active]]:border-border">
        {children}
      </TabsList>
    </div>
  );
}

export default function UnitConverterPage() {
  return (
    <Suspense fallback={null}>
      <UnitConverterContent />
    </Suspense>
  );
}

function UnitConverterContent() {
  const { state, setParam, hasUrlParams, hydrationSource } = useUrlSyncedState(
    "unit-converter",
    {
      schema: paramsSchema,
      defaults: paramsSchema.parse({}),
    },
  );

  const handleLoadHistory = React.useCallback(
    (entry: HistoryEntry) => {
      const { inputs, params } = entry;
      if (inputs.value !== undefined) setParam("value", inputs.value);
      if (params.category)
        setParam("category", params.category as UnitCategory);
      if (params.fromUnit !== undefined)
        setParam("fromUnit", params.fromUnit as string);
      if (params.toUnit !== undefined)
        setParam("toUnit", params.toUnit as string);
    },
    [setParam],
  );

  return (
    <ToolPageWrapper
      toolId="unit-converter"
      title="Unit Converter"
      description="Convert between units across 16 categories including length, mass, temperature, and more."
      onLoadHistory={handleLoadHistory}
    >
      <UnitConverterInner
        state={state}
        setParam={setParam}
        hasUrlParams={hasUrlParams}
        hydrationSource={hydrationSource}
      />
    </ToolPageWrapper>
  );
}

function UnitConverterInner({
  state,
  setParam,
  hasUrlParams,
  hydrationSource,
}: {
  state: z.infer<typeof paramsSchema>;
  setParam: <K extends keyof z.infer<typeof paramsSchema>>(
    key: K,
    value: z.infer<typeof paramsSchema>[K],
    immediate?: boolean,
  ) => void;
  hasUrlParams: boolean;
  hydrationSource: "default" | "url" | "history";
}) {
  const { upsertInputEntry, upsertParams } = useToolHistoryContext();
  const [output, setOutput] = React.useState("");
  const [copied, setCopied] = React.useState(false);
  const categoryFamily = categoryFamilyMap[state.category];
  const activeCategories = categoryFamilies[categoryFamily];
  const units = getUnitsByCategory(state.category);
  const lastInputRef = React.useRef<string>("");
  const hasHydratedInputRef = React.useRef(false);
  const paramsRef = React.useRef({
    category: state.category,
    fromUnit: state.fromUnit,
    toUnit: state.toUnit,
  });
  const hasInitializedParamsRef = React.useRef(false);
  const hasHandledUrlRef = React.useRef(false);

  // Hydration tracking
  React.useEffect(() => {
    if (hasHydratedInputRef.current) return;
    if (hydrationSource === "default") return;
    lastInputRef.current = state.value;
    hasHydratedInputRef.current = true;
  }, [hydrationSource, state.value]);

  // Track input changes for history
  React.useEffect(() => {
    if (!state.value || state.value === lastInputRef.current) return;

    const timer = setTimeout(() => {
      lastInputRef.current = state.value;
      upsertInputEntry(
        { value: state.value },
        {
          category: state.category,
          fromUnit: state.fromUnit,
          toUnit: state.toUnit,
        },
        "left",
        `${state.value} ${state.fromUnit}`,
      );
    }, DEFAULT_URL_SYNC_DEBOUNCE_MS);

    return () => clearTimeout(timer);
  }, [
    state.value,
    state.category,
    state.fromUnit,
    state.toUnit,
    upsertInputEntry,
  ]);

  // Handle URL params on load
  React.useEffect(() => {
    if (hasUrlParams && !hasHandledUrlRef.current) {
      hasHandledUrlRef.current = true;
      if (state.value) {
        upsertInputEntry(
          { value: state.value },
          {
            category: state.category,
            fromUnit: state.fromUnit,
            toUnit: state.toUnit,
          },
          "left",
          `${state.value} ${state.fromUnit}`,
        );
      } else {
        upsertParams(
          {
            category: state.category,
            fromUnit: state.fromUnit,
            toUnit: state.toUnit,
          },
          "interpretation",
        );
      }
    }
  }, [
    hasUrlParams,
    state.value,
    state.category,
    state.fromUnit,
    state.toUnit,
    upsertInputEntry,
    upsertParams,
  ]);

  // Track param changes
  React.useEffect(() => {
    const nextParams = {
      category: state.category,
      fromUnit: state.fromUnit,
      toUnit: state.toUnit,
    };
    if (!hasInitializedParamsRef.current) {
      hasInitializedParamsRef.current = true;
      paramsRef.current = nextParams;
      return;
    }
    if (
      paramsRef.current.category === nextParams.category &&
      paramsRef.current.fromUnit === nextParams.fromUnit &&
      paramsRef.current.toUnit === nextParams.toUnit
    ) {
      return;
    }
    paramsRef.current = nextParams;
    upsertParams(nextParams, "interpretation");
  }, [state.category, state.fromUnit, state.toUnit, upsertParams]);

  // Perform conversion
  React.useEffect(() => {
    const numValue = parseFloat(state.value);
    if (isNaN(numValue)) {
      setOutput("");
      return;
    }

    try {
      const result = convert(
        numValue,
        state.fromUnit,
        state.toUnit,
        state.category,
      );
      setOutput(formatNumber(result));
    } catch {
      setOutput("Error");
    }
  }, [state.value, state.fromUnit, state.toUnit, state.category]);

  // When category changes, reset units to sensible defaults
  const handleCategoryChange = React.useCallback(
    (newCategory: UnitCategory) => {
      const newUnits = getUnitsByCategory(newCategory);
      const defaultFrom = newUnits[0]?.id ?? "";
      const defaultTo = newUnits[1]?.id ?? newUnits[0]?.id ?? "";
      setParam("category", newCategory, true);
      setParam("fromUnit", defaultFrom, true);
      setParam("toUnit", defaultTo, true);
    },
    [setParam],
  );

  const handleSwapUnits = () => {
    const from = state.fromUnit;
    const to = state.toUnit;
    setParam("fromUnit", to, true);
    setParam("toUnit", from, true);
  };

  const handleCopy = async () => {
    if (!output) return;
    await navigator.clipboard.writeText(output);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const fromUnit = units.find((u) => u.id === state.fromUnit);
  const toUnit = units.find((u) => u.id === state.toUnit);

  return (
    <div className="flex h-full flex-col gap-4">
      {/* Category Selection */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="flex items-start gap-3">
          <Label className="w-28 shrink-0 text-sm">Category</Label>
          <div className="min-w-0 flex-1 space-y-2">
            <Tabs
              value={categoryFamily}
              onValueChange={(value) => {
                const family = value as CategoryFamily;
                const next = categoryFamilies[family][0] as UnitCategory;
                if (state.category !== next) {
                  handleCategoryChange(next);
                }
              }}
            >
              <ScrollableTabsList>
                {(Object.keys(categoryFamilies) as CategoryFamily[]).map(
                  (family) => (
                    <TabsTrigger
                      key={family}
                      value={family}
                      className="flex-none text-xs"
                    >
                      {categoryFamilyLabels[family]}
                    </TabsTrigger>
                  ),
                )}
              </ScrollableTabsList>
            </Tabs>
            <Tabs
              value={state.category}
              onValueChange={(value) =>
                handleCategoryChange(value as UnitCategory)
              }
            >
              <ScrollableTabsList>
                {activeCategories.map((cat) => (
                  <TabsTrigger
                    key={cat}
                    value={cat}
                    className="flex-none text-xs"
                  >
                    {categoryLabels[cat as UnitCategory]}
                  </TabsTrigger>
                ))}
              </ScrollableTabsList>
            </Tabs>
          </div>
        </div>
      </div>

      {/* Conversion Interface */}
      <div className="flex flex-col gap-4 md:flex-row">
        {/* From Unit */}
        <div className="flex w-full flex-1 flex-col gap-2 md:w-0">
          <div className="flex items-center justify-between gap-2">
            <Label className="text-sm font-medium">From</Label>
          </div>
          <Select
            value={state.fromUnit}
            onValueChange={(v) => setParam("fromUnit", v, true)}
          >
            <SelectTrigger className="w-full">
              <SelectValue placeholder="Select unit" />
            </SelectTrigger>
            <SelectContent>
              {units.map((unit) => (
                <SelectItem key={unit.id} value={unit.id}>
                  {unit.name} ({unit.symbol})
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Input
            type="text"
            inputMode="decimal"
            value={state.value}
            onChange={(e) => setParam("value", e.target.value)}
            placeholder="Enter value..."
            className="font-mono text-lg"
          />
          {fromUnit && (
            <p className="text-xs text-muted-foreground">
              {state.value || "0"} {fromUnit.symbol}
            </p>
          )}
        </div>

        {/* Swap Button */}
        <div className="flex items-center justify-center md:pt-8">
          <Button
            variant="outline"
            size="icon"
            onClick={handleSwapUnits}
            className="h-10 w-10 rounded-full bg-transparent"
            aria-label="Swap units"
          >
            <ArrowRightLeft className="h-4 w-4" />
          </Button>
        </div>

        {/* To Unit */}
        <div className="flex w-full flex-1 flex-col gap-2 md:w-0">
          <div className="flex items-center justify-between gap-2">
            <Label className="text-sm font-medium">To</Label>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleCopy}
              disabled={!output}
              className="h-7 gap-1 px-2 text-xs"
            >
              {copied ? (
                <Check className="h-3 w-3" />
              ) : (
                <Copy className="h-3 w-3" />
              )}
              {copied ? "Copied" : "Copy"}
            </Button>
          </div>
          <Select
            value={state.toUnit}
            onValueChange={(v) => setParam("toUnit", v, true)}
          >
            <SelectTrigger className="w-full">
              <SelectValue placeholder="Select unit" />
            </SelectTrigger>
            <SelectContent>
              {units.map((unit) => (
                <SelectItem key={unit.id} value={unit.id}>
                  {unit.name} ({unit.symbol})
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <div className="flex min-h-[44px] items-center rounded-md border bg-muted/50 px-3 font-mono text-lg">
            {output || <span className="text-muted-foreground">-</span>}
          </div>
          {toUnit && output && (
            <p className="text-xs text-muted-foreground">
              {output} {toUnit.symbol}
            </p>
          )}
        </div>
      </div>

      {/* Quick Reference */}
      <div className="mt-4 rounded-lg border bg-muted/30 p-4">
        <h3 className="mb-2 text-sm font-medium">Quick Reference</h3>
        <div className="grid gap-2 text-xs text-muted-foreground sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
          {units.slice(0, 8).map((unit) => {
            const numValue = parseFloat(state.value);
            if (isNaN(numValue) || unit.id === state.fromUnit) return null;
            try {
              const converted = convert(
                numValue,
                state.fromUnit,
                unit.id,
                state.category,
              );
              return (
                <div key={unit.id} className="flex justify-between gap-2">
                  <span>{unit.name}:</span>
                  <span className="font-mono">
                    {formatNumber(converted, 6)} {unit.symbol}
                  </span>
                </div>
              );
            } catch {
              return null;
            }
          })}
        </div>
      </div>
    </div>
  );
}
