"use client";

import * as React from "react";
import { Suspense } from "react";
import { z } from "zod";
import * as exifr from "exifr";
import piexif from "piexifjs";
import { Buffer } from "buffer";
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Upload, Download, RefreshCw, Trash2 } from "lucide-react";
import type { HistoryEntry } from "@/lib/history/db";
import { cn } from "@/lib/utils";

const paramsSchema = z.object({
  mode: z.enum(["view", "edit"]).default("view"),
  fileName: z.string().default(""),
  description: z.string().default(""),
  artist: z.string().default(""),
  copyright: z.string().default(""),
  software: z.string().default(""),
  dateTimeOriginal: z.string().default(""),
  gpsLat: z.string().default(""),
  gpsLng: z.string().default(""),
});

type OutputState = {
  status: "success" | "error";
  message: string;
  downloadUrl?: string;
  downloadName?: string;
};

function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes)) return "--";
  if (bytes < 1024) return `${bytes} B`;
  const kb = bytes / 1024;
  if (kb < 1024) return `${kb.toFixed(1)} KB`;
  const mb = kb / 1024;
  return `${mb.toFixed(2)} MB`;
}

function arrayBufferToDataUrl(buffer: ArrayBuffer, mime: string): string {
  const base64 = Buffer.from(buffer).toString("base64");
  return `data:${mime};base64,${base64}`;
}

function dataUrlToBlob(dataUrl: string): Blob {
  const [header, base64] = dataUrl.split(",");
  const mimeMatch = /data:(.*?);base64/.exec(header);
  const mime = mimeMatch ? mimeMatch[1] : "application/octet-stream";
  const bytes = Uint8Array.from(Buffer.from(base64, "base64"));
  return new Blob([bytes], { type: mime });
}

function stripAscii(str: string) {
  return str.replace(/\s+/g, " ").trim();
}

function toExifRational(value: number): [number, number] {
  const denominator = 1000000;
  return [Math.round(value * denominator), denominator];
}

function toExifDms(value: number): [number, number][] {
  const abs = Math.abs(value);
  const degrees = Math.floor(abs);
  const minutesFloat = (abs - degrees) * 60;
  const minutes = Math.floor(minutesFloat);
  const seconds = (minutesFloat - minutes) * 60;
  return [[degrees, 1], [minutes, 1], toExifRational(seconds)];
}

export default function ExifPage() {
  return (
    <Suspense fallback={null}>
      <ExifContent />
    </Suspense>
  );
}

function ExifContent() {
  const { state, setParam, oversizeKeys, hasUrlParams, hydrationSource } =
    useUrlSyncedState("exif", {
      schema: paramsSchema,
      defaults: paramsSchema.parse({}),
      restoreMissingKeys: (key) => key === "fileName",
    });

  const handleLoadHistory = React.useCallback(
    (entry: HistoryEntry) => {
      const { inputs, params } = entry;
      if (inputs.fileName !== undefined) setParam("fileName", inputs.fileName);
      if (inputs.description !== undefined)
        setParam("description", inputs.description);
      if (inputs.artist !== undefined) setParam("artist", inputs.artist);
      if (inputs.copyright !== undefined)
        setParam("copyright", inputs.copyright);
      if (inputs.software !== undefined) setParam("software", inputs.software);
      if (inputs.dateTimeOriginal !== undefined)
        setParam("dateTimeOriginal", inputs.dateTimeOriginal);
      if (inputs.gpsLat !== undefined) setParam("gpsLat", inputs.gpsLat);
      if (inputs.gpsLng !== undefined) setParam("gpsLng", inputs.gpsLng);
      if (params.mode)
        setParam("mode", params.mode as z.infer<typeof paramsSchema>["mode"]);
    },
    [setParam],
  );

  return (
    <ToolPageWrapper
      toolId="exif"
      title="Exif Tool"
      description="View, edit, and strip EXIF metadata from images in your browser"
      onLoadHistory={handleLoadHistory}
    >
      <ExifInner
        state={state}
        setParam={setParam}
        oversizeKeys={oversizeKeys}
        hasUrlParams={hasUrlParams}
        hydrationSource={hydrationSource}
      />
    </ToolPageWrapper>
  );
}

function ExifInner({
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
  const [fileInfo, setFileInfo] = React.useState<{
    name: string;
    type: string;
    size: number;
  } | null>(null);
  const [imageUrl, setImageUrl] = React.useState<string | null>(null);
  const [exifJson, setExifJson] = React.useState<string>("");
  const [exifError, setExifError] = React.useState<string | null>(null);
  const [output, setOutput] = React.useState<OutputState | null>(null);
  const [isProcessing, setIsProcessing] = React.useState(false);
  const [isJpeg, setIsJpeg] = React.useState(false);
  const fileInputRef = React.useRef<HTMLInputElement>(null);
  const lastInputRef = React.useRef<string>("");
  const hasHydratedInputRef = React.useRef(false);
  const paramsRef = React.useRef({ mode: state.mode });
  const hasInitializedParamsRef = React.useRef(false);
  const hasHandledUrlRef = React.useRef(false);
  const exifObjRef = React.useRef<any | null>(null);
  const dataUrlRef = React.useRef<string | null>(null);
  const outputUrlRef = React.useRef<string | null>(null);

  const revokeOutputUrl = React.useCallback(() => {
    if (outputUrlRef.current) {
      URL.revokeObjectURL(outputUrlRef.current);
      outputUrlRef.current = null;
    }
  }, []);

  React.useEffect(() => {
    return () => {
      if (imageUrl) URL.revokeObjectURL(imageUrl);
      revokeOutputUrl();
    };
  }, [imageUrl, revokeOutputUrl]);

  React.useEffect(() => {
    if (hasHydratedInputRef.current) return;
    if (hydrationSource === "default") return;
    lastInputRef.current = JSON.stringify({
      fileName: state.fileName,
      description: state.description,
      artist: state.artist,
      copyright: state.copyright,
      software: state.software,
      dateTimeOriginal: state.dateTimeOriginal,
      gpsLat: state.gpsLat,
      gpsLng: state.gpsLng,
      mode: state.mode,
    });
    hasHydratedInputRef.current = true;
  }, [
    hydrationSource,
    state.fileName,
    state.description,
    state.artist,
    state.copyright,
    state.software,
    state.dateTimeOriginal,
    state.gpsLat,
    state.gpsLng,
    state.mode,
  ]);

  React.useEffect(() => {
    const snapshot = JSON.stringify({
      fileName: state.fileName,
      description: state.description,
      artist: state.artist,
      copyright: state.copyright,
      software: state.software,
      dateTimeOriginal: state.dateTimeOriginal,
      gpsLat: state.gpsLat,
      gpsLng: state.gpsLng,
      mode: state.mode,
    });
    if (snapshot === lastInputRef.current) return;

    const timer = setTimeout(() => {
      lastInputRef.current = snapshot;
      upsertInputEntry(
        {
          fileName: state.fileName,
          description: state.description,
          artist: state.artist,
          copyright: state.copyright,
          software: state.software,
          dateTimeOriginal: state.dateTimeOriginal,
          gpsLat: state.gpsLat,
          gpsLng: state.gpsLng,
        },
        { mode: state.mode },
        "left",
        state.fileName || "EXIF",
      );
    }, DEFAULT_URL_SYNC_DEBOUNCE_MS);

    return () => clearTimeout(timer);
  }, [
    state.fileName,
    state.description,
    state.artist,
    state.copyright,
    state.software,
    state.dateTimeOriginal,
    state.gpsLat,
    state.gpsLng,
    state.mode,
    upsertInputEntry,
  ]);

  React.useEffect(() => {
    if (hasUrlParams && !hasHandledUrlRef.current) {
      hasHandledUrlRef.current = true;
      if (state.fileName) {
        upsertInputEntry(
          {
            fileName: state.fileName,
            description: state.description,
            artist: state.artist,
            copyright: state.copyright,
            software: state.software,
            dateTimeOriginal: state.dateTimeOriginal,
            gpsLat: state.gpsLat,
            gpsLng: state.gpsLng,
          },
          { mode: state.mode },
          "left",
          state.fileName,
        );
      } else {
        upsertParams({ mode: state.mode }, "interpretation");
      }
    }
  }, [
    hasUrlParams,
    state.fileName,
    state.description,
    state.artist,
    state.copyright,
    state.software,
    state.dateTimeOriginal,
    state.gpsLat,
    state.gpsLng,
    state.mode,
    upsertInputEntry,
    upsertParams,
  ]);

  React.useEffect(() => {
    const nextParams = { mode: state.mode };
    if (!hasInitializedParamsRef.current) {
      hasInitializedParamsRef.current = true;
      paramsRef.current = nextParams;
      return;
    }
    if (paramsRef.current.mode === nextParams.mode) return;
    paramsRef.current = nextParams;
    upsertParams(nextParams, "interpretation");
  }, [state.mode, upsertParams]);

  const handleFileSelect = React.useCallback(
    async (file: File | null) => {
      if (!file) return;
      setExifError(null);
      setOutput(null);
      revokeOutputUrl();

      if (imageUrl) URL.revokeObjectURL(imageUrl);
      const previewUrl = URL.createObjectURL(file);
      setImageUrl(previewUrl);

      const info = {
        name: file.name,
        type: file.type || "unknown",
        size: file.size,
      };
      setFileInfo(info);
      setParam("fileName", file.name, true);

      const buffer = await file.arrayBuffer();
      const mime = file.type || "image/jpeg";
      const dataUrl = arrayBufferToDataUrl(buffer, mime);
      dataUrlRef.current = dataUrl;

      const isJpegFile =
        file.type === "image/jpeg" ||
        file.name.toLowerCase().endsWith(".jpg") ||
        file.name.toLowerCase().endsWith(".jpeg");
      setIsJpeg(isJpegFile);

      let parsedData: Record<string, unknown> | null = null;
      try {
        const parsed = await exifr.parse(buffer, {
          tiff: true,
          exif: true,
          gps: true,
          iptc: true,
          xmp: true,
          icc: true,
          jfif: true,
        });
        if (parsed) {
          parsedData = parsed as Record<string, unknown>;
          const json = JSON.stringify(
            parsed,
            (_key, value) => {
              if (typeof value === "bigint") return value.toString();
              if (value instanceof Date) return value.toISOString();
              return value;
            },
            2,
          );
          setExifJson(json);
        } else {
          setExifJson("{}");
        }
      } catch (err) {
        console.error("Failed to parse EXIF", err);
        setExifJson("");
        setExifError(err instanceof Error ? err.message : "Parse failed");
      }

      if (isJpegFile) {
        try {
          const exifObj = piexif.load(dataUrl);
          exifObjRef.current = exifObj;

          const zeroth = exifObj["0th"] ?? {};
          const exif = exifObj["Exif"] ?? {};
          const gps = exifObj["GPS"] ?? {};

          const description = zeroth[piexif.ImageIFD.ImageDescription] ?? "";
          const artist = zeroth[piexif.ImageIFD.Artist] ?? "";
          const copyright = zeroth[piexif.ImageIFD.Copyright] ?? "";
          const software = zeroth[piexif.ImageIFD.Software] ?? "";
          const dateTimeOriginal = exif[piexif.ExifIFD.DateTimeOriginal] ?? "";

          const parsedLat =
            parsedData && typeof parsedData.latitude === "number"
              ? (parsedData.latitude as number)
              : null;
          const parsedLng =
            parsedData && typeof parsedData.longitude === "number"
              ? (parsedData.longitude as number)
              : null;
          const gpsLat = parsedLat !== null ? String(parsedLat.toFixed(6)) : "";
          const gpsLng = parsedLng !== null ? String(parsedLng.toFixed(6)) : "";

          if (!state.description) setParam("description", description);
          if (!state.artist) setParam("artist", artist);
          if (!state.copyright) setParam("copyright", copyright);
          if (!state.software) setParam("software", software);
          if (!state.dateTimeOriginal)
            setParam("dateTimeOriginal", dateTimeOriginal);
          if (!state.gpsLat && !state.gpsLng) {
            if (gpsLat) setParam("gpsLat", gpsLat);
            if (gpsLng) setParam("gpsLng", gpsLng);
          }
        } catch (err) {
          console.error("Failed to read EXIF for editing", err);
        }
      }
    },
    [
      imageUrl,
      revokeOutputUrl,
      setParam,
      state.description,
      state.artist,
      state.copyright,
      state.software,
      state.dateTimeOriginal,
      state.gpsLat,
      state.gpsLng,
    ],
  );

  const handleInputChange = React.useCallback(
    (key: keyof z.infer<typeof paramsSchema>) =>
      (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
        setParam(key, e.target.value, true);
      },
    [setParam],
  );

  const applyEdits = React.useCallback(async () => {
    if (!dataUrlRef.current || !isJpeg) {
      setOutput({
        status: "error",
        message: "Editing is only available for JPEG images.",
      });
      return;
    }

    setIsProcessing(true);
    try {
      const baseExif = exifObjRef.current
        ? JSON.parse(JSON.stringify(exifObjRef.current))
        : { "0th": {}, Exif: {}, GPS: {} };
      const zeroth = baseExif["0th"] ?? {};
      const exif = baseExif["Exif"] ?? {};
      const gps = baseExif["GPS"] ?? {};

      const description = stripAscii(state.description);
      const artist = stripAscii(state.artist);
      const copyright = stripAscii(state.copyright);
      const software = stripAscii(state.software);
      const dateTimeOriginal = stripAscii(state.dateTimeOriginal);

      if (description) zeroth[piexif.ImageIFD.ImageDescription] = description;
      else delete zeroth[piexif.ImageIFD.ImageDescription];

      if (artist) zeroth[piexif.ImageIFD.Artist] = artist;
      else delete zeroth[piexif.ImageIFD.Artist];

      if (copyright) zeroth[piexif.ImageIFD.Copyright] = copyright;
      else delete zeroth[piexif.ImageIFD.Copyright];

      if (software) zeroth[piexif.ImageIFD.Software] = software;
      else delete zeroth[piexif.ImageIFD.Software];

      if (dateTimeOriginal)
        exif[piexif.ExifIFD.DateTimeOriginal] = dateTimeOriginal;
      else delete exif[piexif.ExifIFD.DateTimeOriginal];

      const lat = Number.parseFloat(state.gpsLat);
      const lng = Number.parseFloat(state.gpsLng);
      if (Number.isFinite(lat) && Number.isFinite(lng)) {
        gps[piexif.GPSIFD.GPSLatitudeRef] = lat >= 0 ? "N" : "S";
        gps[piexif.GPSIFD.GPSLatitude] = toExifDms(lat);
        gps[piexif.GPSIFD.GPSLongitudeRef] = lng >= 0 ? "E" : "W";
        gps[piexif.GPSIFD.GPSLongitude] = toExifDms(lng);
        gps[piexif.GPSIFD.GPSVersionID] = [2, 3, 0, 0];
      } else {
        delete gps[piexif.GPSIFD.GPSLatitudeRef];
        delete gps[piexif.GPSIFD.GPSLatitude];
        delete gps[piexif.GPSIFD.GPSLongitudeRef];
        delete gps[piexif.GPSIFD.GPSLongitude];
      }

      const exifStr = piexif.dump({
        "0th": zeroth,
        Exif: exif,
        GPS: gps,
      });
      const updatedDataUrl = piexif.insert(exifStr, dataUrlRef.current);
      const blob = dataUrlToBlob(updatedDataUrl);
      const downloadUrl = URL.createObjectURL(blob);

      revokeOutputUrl();
      outputUrlRef.current = downloadUrl;
      setOutput({
        status: "success",
        message: "Updated EXIF metadata.",
        downloadUrl,
        downloadName: state.fileName
          ? state.fileName.replace(/\.(jpe?g)$/i, "-edited.$1")
          : "exif-edited.jpg",
      });
    } catch (err) {
      console.error("Failed to write EXIF", err);
      setOutput({
        status: "error",
        message: err instanceof Error ? err.message : "EXIF update failed",
      });
    } finally {
      setIsProcessing(false);
    }
  }, [
    state.description,
    state.artist,
    state.copyright,
    state.software,
    state.dateTimeOriginal,
    state.gpsLat,
    state.gpsLng,
    state.fileName,
    isJpeg,
    revokeOutputUrl,
  ]);

  const stripExif = React.useCallback(async () => {
    if (!dataUrlRef.current || !isJpeg) {
      setOutput({
        status: "error",
        message: "Stripping is only available for JPEG images.",
      });
      return;
    }

    setIsProcessing(true);
    try {
      const stripped = piexif.remove(dataUrlRef.current);
      const blob = dataUrlToBlob(stripped);
      const downloadUrl = URL.createObjectURL(blob);

      revokeOutputUrl();
      outputUrlRef.current = downloadUrl;
      setOutput({
        status: "success",
        message: "Stripped EXIF metadata.",
        downloadUrl,
        downloadName: state.fileName
          ? state.fileName.replace(/\.(jpe?g)$/i, "-stripped.$1")
          : "exif-stripped.jpg",
      });
    } catch (err) {
      console.error("Failed to strip EXIF", err);
      setOutput({
        status: "error",
        message: err instanceof Error ? err.message : "EXIF strip failed",
      });
    } finally {
      setIsProcessing(false);
    }
  }, [state.fileName, isJpeg, revokeOutputUrl]);

  const clearFile = () => {
    if (imageUrl) URL.revokeObjectURL(imageUrl);
    setImageUrl(null);
    setFileInfo(null);
    setExifJson("");
    setExifError(null);
    setIsJpeg(false);
    exifObjRef.current = null;
    dataUrlRef.current = null;
    setParam("fileName", "", true);
    setOutput(null);
    revokeOutputUrl();
  };

  const jsonPreview = exifJson || "{}";
  const showOversizeWarning = oversizeKeys.some((key) =>
    [
      "description",
      "artist",
      "copyright",
      "software",
      "dateTimeOriginal",
      "gpsLat",
      "gpsLng",
    ].includes(String(key)),
  );

  return (
    <div className="flex flex-col gap-4">
      <Card>
        <CardContent className="flex flex-wrap items-center gap-4 p-4">
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0] ?? null;
              void handleFileSelect(file);
              e.target.value = "";
            }}
          />
          <Button
            variant="secondary"
            onClick={() => fileInputRef.current?.click()}
            className="gap-2"
          >
            <Upload className="h-4 w-4" />
            Select Image
          </Button>
          {fileInfo && (
            <div className="text-sm text-muted-foreground">
              <div className="font-medium text-foreground">{fileInfo.name}</div>
              <div>
                {fileInfo.type || "unknown"} - {formatBytes(fileInfo.size)}
              </div>
            </div>
          )}
          {fileInfo && (
            <Button variant="ghost" size="sm" onClick={clearFile}>
              <Trash2 className="mr-2 h-4 w-4" />
              Clear
            </Button>
          )}
        </CardContent>
      </Card>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)]">
        <Card>
          <CardContent className="flex flex-col gap-4 p-4">
            <div className="text-sm font-medium">Preview</div>
            {imageUrl ? (
              <img
                src={imageUrl}
                alt="Selected preview"
                className="max-h-[360px] w-full rounded-md border object-contain"
              />
            ) : (
              <div className="flex h-[220px] items-center justify-center rounded-md border border-dashed text-sm text-muted-foreground">
                Upload an image to view EXIF data.
              </div>
            )}
            {output && (
              <div
                className={cn(
                  "rounded-md border px-3 py-2 text-sm",
                  output.status === "success"
                    ? "border-emerald-500/30 bg-emerald-500/5 text-emerald-600 dark:text-emerald-300"
                    : "border-destructive/40 bg-destructive/5 text-destructive",
                )}
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span>{output.message}</span>
                  {output.downloadUrl && (
                    <Button asChild size="sm">
                      <a
                        href={output.downloadUrl}
                        download={output.downloadName}
                      >
                        <Download className="mr-2 h-4 w-4" />
                        Download
                      </a>
                    </Button>
                  )}
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <Tabs
              value={state.mode}
              onValueChange={(value) =>
                setParam(
                  "mode",
                  value as z.infer<typeof paramsSchema>["mode"],
                  true,
                )
              }
            >
              <TabsList className="w-full justify-start">
                <TabsTrigger value="view">View</TabsTrigger>
                <TabsTrigger value="edit">Edit</TabsTrigger>
              </TabsList>
              <TabsContent value="view" className="mt-4 space-y-3">
                <Label className="text-sm">Raw Metadata</Label>
                <Textarea
                  value={jsonPreview}
                  readOnly
                  className="min-h-[320px] font-mono text-xs"
                />
                {exifError && (
                  <p className="text-xs text-destructive">{exifError}</p>
                )}
              </TabsContent>
              <TabsContent value="edit" className="mt-4 space-y-4">
                <div className="grid gap-3 md:grid-cols-2">
                  <div className="space-y-1">
                    <Label className="text-sm">Description</Label>
                    <Input
                      value={state.description}
                      onChange={handleInputChange("description")}
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-sm">Artist</Label>
                    <Input
                      value={state.artist}
                      onChange={handleInputChange("artist")}
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-sm">Copyright</Label>
                    <Input
                      value={state.copyright}
                      onChange={handleInputChange("copyright")}
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-sm">Software</Label>
                    <Input
                      value={state.software}
                      onChange={handleInputChange("software")}
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-sm">Date/Time Original</Label>
                    <Input
                      value={state.dateTimeOriginal}
                      onChange={handleInputChange("dateTimeOriginal")}
                      placeholder="YYYY:MM:DD HH:MM:SS"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-sm">GPS Latitude</Label>
                    <Input
                      value={state.gpsLat}
                      onChange={handleInputChange("gpsLat")}
                      placeholder="37.7749"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-sm">GPS Longitude</Label>
                    <Input
                      value={state.gpsLng}
                      onChange={handleInputChange("gpsLng")}
                      placeholder="-122.4194"
                    />
                  </div>
                </div>

                <div className="flex flex-wrap gap-2">
                  <Button
                    onClick={applyEdits}
                    disabled={!fileInfo || isProcessing || !isJpeg}
                  >
                    <RefreshCw className="mr-2 h-4 w-4" />
                    Apply Metadata
                  </Button>
                  <Button
                    variant="outline"
                    onClick={stripExif}
                    disabled={!fileInfo || isProcessing || !isJpeg}
                  >
                    <Trash2 className="mr-2 h-4 w-4" />
                    Strip EXIF
                  </Button>
                </div>

                {!isJpeg && fileInfo && (
                  <p className="text-xs text-muted-foreground">
                    Editing and stripping are available for JPEG images only.
                  </p>
                )}
                {showOversizeWarning && (
                  <p className="text-xs text-muted-foreground">
                    Some inputs exceed 2 KB and are not synced to the URL.
                  </p>
                )}
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
