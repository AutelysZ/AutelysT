"use client";

import * as React from "react";
import { Suspense } from "react";
import { z } from "zod";
import type { ReleaseType } from "semver";
import {
  ToolPageWrapper,
  useToolHistoryContext,
} from "@/components/tool-ui/tool-page-wrapper";
import {
  DEFAULT_URL_SYNC_DEBOUNCE_MS,
  useUrlSyncedState,
} from "@/lib/url-state/use-url-synced-state";
import type { HistoryEntry } from "@/lib/history/db";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  compareSemver,
  evaluateSemverRange,
  incrementSemver,
  sortSemverLines,
} from "@/lib/data/semver";

const RELEASE_TYPES: ReleaseType[] = [
  "major",
  "minor",
  "patch",
  "premajor",
  "preminor",
  "prepatch",
  "prerelease",
];

const paramsSchema = z.object({
  versionA: z.string().default("1.2.3"),
  versionB: z.string().default("2.0.0"),
  rangeVersion: z.string().default("1.5.0"),
  rangeExpr: z.string().default("^1.0.0"),
  incrementVersion: z.string().default("1.2.3"),
  releaseType: z
    .enum([
      "major",
      "minor",
      "patch",
      "premajor",
      "preminor",
      "prepatch",
      "prerelease",
    ])
    .default("patch"),
  preid: z.string().default("rc"),
  descending: z.boolean().default(false),
  sortInput: z.string().default("1.2.0\n1.2.0-beta.1\n2.0.0\ninvalid"),
});

export default function SemverPage() {
  return (
    <Suspense fallback={null}>
      <SemverContent />
    </Suspense>
  );
}

function SemverContent() {
  const { state, setParam, oversizeKeys, hasUrlParams, hydrationSource } =
    useUrlSyncedState("semver", {
      schema: paramsSchema,
      defaults: paramsSchema.parse({}),
    });

  const compareResult = React.useMemo(
    () => compareSemver(state.versionA, state.versionB),
    [state.versionA, state.versionB],
  );
  const rangeResult = React.useMemo(
    () => evaluateSemverRange(state.rangeVersion, state.rangeExpr),
    [state.rangeExpr, state.rangeVersion],
  );
  const sortedResult = React.useMemo(
    () => sortSemverLines(state.sortInput, state.descending),
    [state.descending, state.sortInput],
  );
  const incremented = React.useMemo(
    () =>
      incrementSemver(
        state.incrementVersion,
        state.releaseType as ReleaseType,
        state.preid || undefined,
      ),
    [state.incrementVersion, state.preid, state.releaseType],
  );

  const handleLoadHistory = React.useCallback(
    (entry: HistoryEntry) => {
      const { inputs, params } = entry;
      if (inputs.versionA !== undefined) setParam("versionA", inputs.versionA);
      if (inputs.versionB !== undefined) setParam("versionB", inputs.versionB);
      if (inputs.rangeVersion !== undefined)
        setParam("rangeVersion", inputs.rangeVersion);
      if (inputs.rangeExpr !== undefined)
        setParam("rangeExpr", inputs.rangeExpr);
      if (inputs.incrementVersion !== undefined)
        setParam("incrementVersion", inputs.incrementVersion);
      if (inputs.preid !== undefined) setParam("preid", inputs.preid);
      if (inputs.sortInput !== undefined)
        setParam("sortInput", inputs.sortInput);
      if (params.releaseType)
        setParam(
          "releaseType",
          params.releaseType as z.infer<typeof paramsSchema>["releaseType"],
        );
      if (params.descending !== undefined)
        setParam("descending", params.descending as boolean);
    },
    [setParam],
  );

  const handleCopySorted = React.useCallback(async () => {
    try {
      await navigator.clipboard.writeText(sortedResult.valid.join("\n"));
    } catch (error) {
      console.error(error);
    }
  }, [sortedResult.valid]);

  return (
    <ToolPageWrapper
      toolId="semver"
      title="SemVer"
      description="Compare versions, evaluate ranges, increment releases, and sort version lists."
      onLoadHistory={handleLoadHistory}
    >
      <SemverInner
        state={state}
        setParam={setParam}
        oversizeKeys={oversizeKeys}
        hasUrlParams={hasUrlParams}
        hydrationSource={hydrationSource}
        compareResult={compareResult}
        rangeResult={rangeResult}
        sortedResult={sortedResult}
        incremented={incremented}
        onCopySorted={handleCopySorted}
      />
    </ToolPageWrapper>
  );
}

function SemverInner({
  state,
  setParam,
  oversizeKeys,
  hasUrlParams,
  hydrationSource,
  compareResult,
  rangeResult,
  sortedResult,
  incremented,
  onCopySorted,
}: {
  state: z.infer<typeof paramsSchema>;
  setParam: <K extends keyof z.infer<typeof paramsSchema>>(
    key: K,
    value: z.infer<typeof paramsSchema>[K],
    immediate?: boolean,
  ) => void;
  oversizeKeys: (keyof z.infer<typeof paramsSchema>)[];
  hasUrlParams: boolean;
  hydrationSource: "default" | "url" | "history";
  compareResult: ReturnType<typeof compareSemver>;
  rangeResult: ReturnType<typeof evaluateSemverRange>;
  sortedResult: ReturnType<typeof sortSemverLines>;
  incremented: string | null;
  onCopySorted: () => Promise<void>;
}) {
  const { addHistoryEntry, updateHistoryParams } = useToolHistoryContext();
  const lastInputRef = React.useRef("");
  const hasHydratedInputRef = React.useRef(false);
  const hasHandledUrlRef = React.useRef(false);

  const paramsForHistory = React.useMemo(
    () => ({
      releaseType: state.releaseType,
      descending: state.descending,
    }),
    [state.descending, state.releaseType],
  );

  const inputSnapshot = React.useMemo(
    () =>
      [
        state.versionA,
        state.versionB,
        state.rangeVersion,
        state.rangeExpr,
        state.incrementVersion,
        state.preid,
        state.sortInput,
      ].join("\n"),
    [
      state.incrementVersion,
      state.preid,
      state.rangeExpr,
      state.rangeVersion,
      state.sortInput,
      state.versionA,
      state.versionB,
    ],
  );

  React.useEffect(() => {
    if (hasHydratedInputRef.current) return;
    if (hydrationSource === "default") return;
    lastInputRef.current = inputSnapshot;
    hasHydratedInputRef.current = true;
  }, [hydrationSource, inputSnapshot]);

  React.useEffect(() => {
    if (inputSnapshot === lastInputRef.current) return;
    const timer = setTimeout(() => {
      lastInputRef.current = inputSnapshot;
      addHistoryEntry(
        {
          versionA: state.versionA,
          versionB: state.versionB,
          rangeVersion: state.rangeVersion,
          rangeExpr: state.rangeExpr,
          incrementVersion: state.incrementVersion,
          preid: state.preid,
          sortInput: state.sortInput,
        },
        paramsForHistory,
        "left",
        state.versionA.slice(0, 100),
      );
    }, DEFAULT_URL_SYNC_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [
    addHistoryEntry,
    inputSnapshot,
    paramsForHistory,
    state.incrementVersion,
    state.preid,
    state.rangeExpr,
    state.rangeVersion,
    state.sortInput,
    state.versionA,
    state.versionB,
  ]);

  React.useEffect(() => {
    if (hasUrlParams && !hasHandledUrlRef.current) {
      hasHandledUrlRef.current = true;
      if (state.versionA || state.versionB || state.sortInput) {
        addHistoryEntry(
          {
            versionA: state.versionA,
            versionB: state.versionB,
            rangeVersion: state.rangeVersion,
            rangeExpr: state.rangeExpr,
            incrementVersion: state.incrementVersion,
            preid: state.preid,
            sortInput: state.sortInput,
          },
          paramsForHistory,
          "left",
          state.versionA.slice(0, 100),
        );
      } else {
        updateHistoryParams(paramsForHistory);
      }
    }
  }, [
    addHistoryEntry,
    hasUrlParams,
    paramsForHistory,
    state.incrementVersion,
    state.preid,
    state.rangeExpr,
    state.rangeVersion,
    state.sortInput,
    state.versionA,
    state.versionB,
    updateHistoryParams,
  ]);

  React.useEffect(() => {
    updateHistoryParams(paramsForHistory);
  }, [paramsForHistory, updateHistoryParams]);

  return (
    <div className="space-y-4 py-4 sm:py-6">
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Compare</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-2">
            <Label>Version A</Label>
            <Input
              value={state.versionA}
              onChange={(event) => setParam("versionA", event.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label>Version B</Label>
            <Input
              value={state.versionB}
              onChange={(event) => setParam("versionB", event.target.value)}
            />
          </div>
          <p className="text-xs text-muted-foreground sm:col-span-2">
            {compareResult.validA && compareResult.validB
              ? `Comparison: ${compareResult.comparison} | Difference: ${compareResult.diff ?? "none"}`
              : "Provide valid semantic versions to compare."}
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Range Check</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-2">
            <Label>Version</Label>
            <Input
              value={state.rangeVersion}
              onChange={(event) => setParam("rangeVersion", event.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label>Range</Label>
            <Input
              value={state.rangeExpr}
              onChange={(event) => setParam("rangeExpr", event.target.value)}
            />
          </div>
          <p className="text-xs text-muted-foreground sm:col-span-2">
            {rangeResult.validVersion && rangeResult.validRange
              ? rangeResult.satisfies
                ? "Version satisfies the range."
                : "Version does not satisfy the range."
              : "Provide a valid version and range."}
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Increment</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3 sm:grid-cols-4">
          <div className="space-y-2 sm:col-span-2">
            <Label>Current Version</Label>
            <Input
              value={state.incrementVersion}
              onChange={(event) =>
                setParam("incrementVersion", event.target.value)
              }
            />
          </div>
          <div className="space-y-2">
            <Label>Release Type</Label>
            <Select
              value={state.releaseType}
              onValueChange={(value) =>
                setParam(
                  "releaseType",
                  value as z.infer<typeof paramsSchema>["releaseType"],
                  true,
                )
              }
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {RELEASE_TYPES.map((releaseType) => (
                  <SelectItem key={releaseType} value={releaseType}>
                    {releaseType}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Pre-ID</Label>
            <Input
              value={state.preid}
              onChange={(event) => setParam("preid", event.target.value)}
            />
          </div>
          <p className="text-xs text-muted-foreground sm:col-span-4">
            Next version: {incremented ?? "invalid input"}
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Sort Versions</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <Textarea
            value={state.sortInput}
            onChange={(event) => setParam("sortInput", event.target.value)}
            className="min-h-[130px] font-mono text-xs"
            placeholder="One version per line"
          />
          {oversizeKeys.includes("sortInput") ? (
            <p className="text-xs text-muted-foreground">
              Input exceeds 2 KB and is not synced to the URL.
            </p>
          ) : null}
          <div className="flex flex-wrap items-center gap-2">
            <Button
              type="button"
              variant={state.descending ? "default" : "outline"}
              onClick={() => setParam("descending", !state.descending, true)}
            >
              {state.descending ? "Descending" : "Ascending"}
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={() => void onCopySorted()}
            >
              Copy Sorted
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">
            Valid: {sortedResult.valid.length} | Invalid:{" "}
            {sortedResult.invalid.length}
          </p>
          <Textarea
            readOnly
            value={sortedResult.valid.join("\n")}
            className="min-h-[120px] font-mono text-xs"
          />
        </CardContent>
      </Card>
    </div>
  );
}
