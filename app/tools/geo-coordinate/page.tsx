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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Copy, Check, MapPin } from "lucide-react";
import type { HistoryEntry } from "@/lib/history/db";
import { cn } from "@/lib/utils";
import {
  buildPlatformUrls,
  formatDecimal,
  formatDecimalCardinal,
  formatDdm,
  formatDms,
  getSourceLabel,
  parseCoordinateInput,
} from "@/lib/geo/coordinates";

const paramsSchema = z.object({
  input: z.string().default(""),
  zoom: z.coerce.number().int().min(1).max(20).default(16),
  precision: z.coerce.number().int().min(2).max(8).default(6),
});

type FormatRow = {
  id: string;
  label: string;
  value: string;
};

export default function GeoCoordinatePage() {
  return (
    <Suspense fallback={null}>
      <GeoCoordinateContent />
    </Suspense>
  );
}

function GeoCoordinateContent() {
  const { state, setParam, oversizeKeys, hasUrlParams, hydrationSource } =
    useUrlSyncedState("geo-coordinate", {
      schema: paramsSchema,
      defaults: paramsSchema.parse({}),
      restoreMissingKeys: (key) => key === "input",
    });

  const handleLoadHistory = React.useCallback(
    (entry: HistoryEntry) => {
      const { inputs, params } = entry;
      if (inputs.input !== undefined) setParam("input", inputs.input);
      if (params.zoom !== undefined) setParam("zoom", params.zoom as number);
      if (params.precision !== undefined)
        setParam("precision", params.precision as number);
    },
    [setParam],
  );

  return (
    <ToolPageWrapper
      toolId="geo-coordinate"
      title="Geographic Coordinate Converter"
      description="Parse coordinates or map URLs and generate standardized formats with platform links"
      onLoadHistory={handleLoadHistory}
    >
      <GeoCoordinateInner
        state={state}
        setParam={setParam}
        oversizeKeys={oversizeKeys}
        hasUrlParams={hasUrlParams}
        hydrationSource={hydrationSource}
      />
    </ToolPageWrapper>
  );
}

function GeoCoordinateInner({
  state,
  setParam,
  oversizeKeys,
  hasUrlParams,
  hydrationSource,
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
}) {
  const { upsertInputEntry, upsertParams } = useToolHistoryContext();
  const [copied, setCopied] = React.useState<string | null>(null);
  const lastInputRef = React.useRef<string>("");
  const hasHydratedInputRef = React.useRef(false);
  const paramsRef = React.useRef({
    zoom: state.zoom,
    precision: state.precision,
  });
  const hasInitializedParamsRef = React.useRef(false);
  const hasHandledUrlRef = React.useRef(false);

  React.useEffect(() => {
    if (hasHydratedInputRef.current) return;
    if (hydrationSource === "default") return;
    lastInputRef.current = JSON.stringify({
      input: state.input,
      zoom: state.zoom,
      precision: state.precision,
    });
    hasHydratedInputRef.current = true;
  }, [hydrationSource, state.input, state.zoom, state.precision]);

  React.useEffect(() => {
    const snapshot = JSON.stringify({
      input: state.input,
      zoom: state.zoom,
      precision: state.precision,
    });
    if (snapshot === lastInputRef.current) return;

    const timer = setTimeout(() => {
      lastInputRef.current = snapshot;
      upsertInputEntry(
        { input: state.input },
        { zoom: state.zoom, precision: state.precision },
        "left",
        state.input.slice(0, 100) || "coordinates",
      );
    }, DEFAULT_URL_SYNC_DEBOUNCE_MS);

    return () => clearTimeout(timer);
  }, [state.input, state.zoom, state.precision, upsertInputEntry]);

  React.useEffect(() => {
    if (hasUrlParams && !hasHandledUrlRef.current) {
      hasHandledUrlRef.current = true;
      if (state.input) {
        upsertInputEntry(
          { input: state.input },
          { zoom: state.zoom, precision: state.precision },
          "left",
          state.input.slice(0, 100),
        );
      } else {
        upsertParams(
          { zoom: state.zoom, precision: state.precision },
          "interpretation",
        );
      }
    }
  }, [
    hasUrlParams,
    state.input,
    state.zoom,
    state.precision,
    upsertInputEntry,
    upsertParams,
  ]);

  React.useEffect(() => {
    const nextParams = { zoom: state.zoom, precision: state.precision };
    if (!hasInitializedParamsRef.current) {
      hasInitializedParamsRef.current = true;
      paramsRef.current = nextParams;
      return;
    }
    if (JSON.stringify(paramsRef.current) === JSON.stringify(nextParams))
      return;
    paramsRef.current = nextParams;
    upsertParams(nextParams, "interpretation");
  }, [state.zoom, state.precision, upsertParams]);

  const result = React.useMemo(
    () => parseCoordinateInput(state.input),
    [state.input],
  );

  const formatRows: FormatRow[] = React.useMemo(() => {
    if (!result.coordinates) return [];
    const { lat, lng } = result.coordinates;
    return [
      {
        id: "decimal",
        label: "Decimal degrees",
        value: formatDecimal(lat, lng, state.precision),
      },
      {
        id: "decimal-cardinal",
        label: "Decimal with N/S/E/W",
        value: formatDecimalCardinal(lat, lng, state.precision),
      },
      {
        id: "dms",
        label: "Degrees, minutes, seconds",
        value: formatDms(lat, lng),
      },
      {
        id: "ddm",
        label: "Degrees and decimal minutes",
        value: formatDdm(lat, lng),
      },
      {
        id: "geo-uri",
        label: "Geo URI",
        value: `geo:${lat.toFixed(state.precision)},${lng.toFixed(state.precision)}`,
      },
    ];
  }, [result.coordinates, state.precision]);

  const platformLinks = React.useMemo(() => {
    if (!result.coordinates) return [];
    return buildPlatformUrls(
      result.coordinates.lat,
      result.coordinates.lng,
      state.zoom,
    );
  }, [result.coordinates, state.zoom]);

  const handleCopy = async (value: string) => {
    if (!value) return;
    await navigator.clipboard.writeText(value);
    setCopied(value);
    setTimeout(() => setCopied(null), 1500);
  };

  const showOversizeWarning = oversizeKeys.includes("input");

  return (
    <div className="flex flex-col gap-4">
      <Card>
        <CardContent className="flex flex-col gap-4 p-4">
          <div className="space-y-2">
            <Label className="text-sm">Coordinate or Maps URL</Label>
            <Textarea
              value={state.input}
              onChange={(e) => setParam("input", e.target.value, true)}
              placeholder="Paste coordinates or a maps URL (Google, Apple, Bing, OpenStreetMap, Waze, HERE, geo:)"
              className="min-h-[140px] font-mono text-sm"
            />
          </div>

          <div className="grid gap-3 md:grid-cols-3">
            <div className="space-y-1">
              <Label className="text-sm">Zoom</Label>
              <Input
                type="number"
                min={1}
                max={20}
                value={state.zoom}
                onChange={(e) =>
                  setParam(
                    "zoom",
                    Number.parseInt(e.target.value, 10) || 16,
                    true,
                  )
                }
              />
            </div>
            <div className="space-y-1">
              <Label className="text-sm">Precision</Label>
              <Input
                type="number"
                min={2}
                max={8}
                value={state.precision}
                onChange={(e) =>
                  setParam(
                    "precision",
                    Number.parseInt(e.target.value, 10) || 6,
                    true,
                  )
                }
              />
            </div>
            <div className="space-y-1">
              <Label className="text-sm">Detected Source</Label>
              <Input
                value={
                  result.coordinates
                    ? getSourceLabel(result.coordinates.source)
                    : "--"
                }
                readOnly
              />
            </div>
          </div>

          {result.error && (
            <p className="text-sm text-destructive">{result.error}</p>
          )}
          {showOversizeWarning && (
            <p className="text-xs text-muted-foreground">
              Input exceeds 2 KB and is not synced to the URL.
            </p>
          )}
        </CardContent>
      </Card>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <Card>
          <CardContent className="flex flex-col gap-3 p-4">
            <div className="text-sm font-medium">Formatted Coordinates</div>
            {formatRows.length ? (
              <div className="space-y-3">
                {formatRows.map((row) => (
                  <div
                    key={row.id}
                    className="rounded-md border px-3 py-2 text-sm"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div className="min-w-0">
                        <div className="text-xs text-muted-foreground">
                          {row.label}
                        </div>
                        <div className="truncate font-mono">{row.value}</div>
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleCopy(row.value)}
                        className="h-7 gap-1 px-2 text-xs"
                      >
                        {copied === row.value ? (
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
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">
                Enter a coordinate to see formatted output.
              </p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardContent className="flex flex-col gap-3 p-4">
            <div className="text-sm font-medium">Open in Maps</div>
            {platformLinks.length ? (
              <div className="space-y-2">
                {platformLinks.map((link) => (
                  <div
                    key={link.id}
                    className="flex items-center justify-between gap-2"
                  >
                    <div className="text-sm font-medium">{link.name}</div>
                    <div className="flex items-center gap-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleCopy(link.url)}
                        className="h-7 gap-1 px-2 text-xs"
                      >
                        {copied === link.url ? (
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
                      <Button asChild size="sm" className="gap-1">
                        <a href={link.url} target="_blank" rel="noreferrer">
                          <MapPin className="h-3 w-3" />
                          Open
                        </a>
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">
                Map links appear after parsing a coordinate.
              </p>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardContent className="p-4">
          <div className="text-sm font-medium">Supported Inputs</div>
          <div className="mt-2 grid gap-2 text-xs text-muted-foreground">
            <div>Coordinates: decimal, DMS, DDM, with or without N/S/E/W</div>
            <div>Geo URI: geo:lat,lng</div>
            <div>
              Map URLs: Google Maps, Apple Maps, Bing Maps, OpenStreetMap, Waze,
              HERE WeGo
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
