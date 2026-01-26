"use client";

import * as React from "react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { SearchableSelect } from "@/components/ui/searchable-select";
import { cn } from "@/lib/utils";
import {
  getExtensionsForMime,
  getMimeTypeFromFilename,
  isKnownMimeType,
  mimeTypeOptions,
  normalizeMimeInput,
} from "./mime-utils";

type MimeFormProps = {
  fileName: string;
  mimeType: string;
  fileDetection: {
    fileName: string;
    fileSize: number;
    browserMime: string;
    detectedMime: string;
    detectedExt: string;
  } | null;
  isDetecting: boolean;
  detectError: string | null;
  onFileNameChange: (value: string) => void;
  onMimeTypeChange: (value: string) => void;
  onFileUpload: (file: File) => void;
};

const mimeSelectOptions = mimeTypeOptions.map((value) => ({
  value,
  label: value,
}));

function formatBytes(value: number) {
  if (!Number.isFinite(value)) return "0 B";
  if (value < 1024) return `${value} B`;
  const units = ["KB", "MB", "GB", "TB"];
  let remaining = value / 1024;
  let unitIndex = 0;
  while (remaining >= 1024 && unitIndex < units.length - 1) {
    remaining /= 1024;
    unitIndex += 1;
  }
  return `${remaining.toFixed(1)} ${units[unitIndex]}`;
}

export default function MimeForm({
  fileName,
  mimeType,
  fileDetection,
  isDetecting,
  detectError,
  onFileNameChange,
  onMimeTypeChange,
  onFileUpload,
}: MimeFormProps) {
  const fileInputRef = React.useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = React.useState(false);
  const detected = getMimeTypeFromFilename(fileName);
  const detectedMimeValue = detected.mime;
  const detectedExtensions = detectedMimeValue
    ? getExtensionsForMime(detectedMimeValue)
    : [];

  const normalizedMimeType = normalizeMimeInput(mimeType);
  const mimeExtensions = normalizedMimeType
    ? getExtensionsForMime(normalizedMimeType)
    : [];
  const mimeSelectValue = normalizedMimeType;
  const mimeSelectList = React.useMemo(() => {
    if (!normalizedMimeType || isKnownMimeType(normalizedMimeType)) {
      return mimeSelectOptions;
    }
    return [
      { value: normalizedMimeType, label: `${normalizedMimeType} (custom)` },
      ...mimeSelectOptions,
    ];
  }, [normalizedMimeType]);

  const handleUploadClick = React.useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  const handleFileChange = React.useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      const nextFile = event.target.files?.[0];
      if (nextFile) {
        onFileUpload(nextFile);
      }
      event.target.value = "";
    },
    [onFileUpload],
  );

  const handleDragOver = React.useCallback(
    (event: React.DragEvent<HTMLDivElement>) => {
      event.preventDefault();
      event.dataTransfer.dropEffect = "copy";
      setIsDragging(true);
    },
    [],
  );

  const handleDragLeave = React.useCallback(() => {
    setIsDragging(false);
  }, []);

  const handleDrop = React.useCallback(
    (event: React.DragEvent<HTMLDivElement>) => {
      event.preventDefault();
      setIsDragging(false);
      const droppedFile = event.dataTransfer.files?.[0];
      if (droppedFile) {
        onFileUpload(droppedFile);
      }
    },
    [onFileUpload],
  );

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Card>
        <CardHeader>
          <CardTitle>Filename Lookup</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="mime-file-name">Filename</Label>
            <Input
              id="mime-file-name"
              value={fileName}
              onChange={(event) => onFileNameChange(event.target.value)}
              placeholder="example.pdf"
            />
          </div>
          <div className="space-y-2">
            <Label>Detected MIME</Label>
            <div className="rounded-md border bg-muted/20 px-3 py-2 text-sm">
              {detectedMimeValue || "Unknown"}
            </div>
          </div>
          <div className="space-y-2">
            <Label>Known Extensions</Label>
            {detectedExtensions.length > 0 ? (
              <div className="flex flex-wrap gap-2">
                {detectedExtensions.map((extension) => (
                  <Badge key={extension} variant="secondary">
                    .{extension}
                  </Badge>
                ))}
              </div>
            ) : (
              <p className="text-xs text-muted-foreground">
                No extensions found for this MIME type.
              </p>
            )}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>MIME Type Lookup</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="mime-type-value">MIME Type</Label>
            <SearchableSelect
              value={mimeSelectValue}
              onValueChange={onMimeTypeChange}
              options={mimeSelectList}
              placeholder="Select MIME type..."
              searchPlaceholder="Search MIME types..."
              triggerClassName="w-full justify-between"
              className="w-[min(320px,80vw)]"
            />
          </div>
          <div className="space-y-2">
            <Label>Known Extensions</Label>
            {mimeExtensions.length > 0 ? (
              <div className="flex flex-wrap gap-2">
                {mimeExtensions.map((extension) => (
                  <Badge key={extension} variant="secondary">
                    .{extension}
                  </Badge>
                ))}
              </div>
            ) : (
              <p className="text-xs text-muted-foreground">
                No extensions found for this MIME type.
              </p>
            )}
          </div>
        </CardContent>
      </Card>

      <Card className="lg:col-span-2">
        <CardHeader>
          <CardTitle>File Upload Detection</CardTitle>
        </CardHeader>
        <CardContent>
          <div
            className={cn(
              "rounded-lg border border-dashed bg-muted/30 p-4 text-sm transition-colors",
              isDragging && "border-primary/60 bg-primary/5",
            )}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
          >
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <div className="text-sm font-medium">Drop a file to detect</div>
                <p className="text-xs text-muted-foreground">
                  Uses filename extension lookup for detection.
                </p>
              </div>
              <div>
                <input
                  ref={fileInputRef}
                  type="file"
                  className="hidden"
                  onChange={handleFileChange}
                />
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  onClick={handleUploadClick}
                >
                  Choose file
                </Button>
              </div>
            </div>
            {isDragging && (
              <div className="mt-2 text-xs text-primary">
                Drop file to upload
              </div>
            )}
            {detectError && (
              <div className="mt-2 text-xs text-destructive">{detectError}</div>
            )}
            {fileDetection && (
              <div className="mt-4 grid gap-2 text-xs text-muted-foreground sm:grid-cols-2">
                <div>
                  <div className="font-medium text-foreground">File</div>
                  <div>{fileDetection.fileName}</div>
                </div>
                <div>
                  <div className="font-medium text-foreground">Size</div>
                  <div>{formatBytes(fileDetection.fileSize)}</div>
                </div>
                <div>
                  <div className="font-medium text-foreground">
                    Detected MIME
                  </div>
                  <div>
                    {isDetecting
                      ? "Detecting..."
                      : fileDetection.detectedMime
                        ? `${fileDetection.detectedMime}${fileDetection.detectedExt ? ` (.${fileDetection.detectedExt})` : ""}`
                        : "Unknown"}
                  </div>
                </div>
                <div>
                  <div className="font-medium text-foreground">
                    Browser MIME
                  </div>
                  <div>{fileDetection.browserMime || "Unavailable"}</div>
                </div>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
