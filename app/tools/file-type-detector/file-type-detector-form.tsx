"use client";

import * as React from "react";
import { FolderUp, FileSearch, Trash2, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import type {
  FileRecord,
  FileTreeNode,
  PreviewState,
} from "./file-type-detector-types";
import FileTypeDetectorFileTree from "./file-type-detector-file-tree";

type FileTypeDetectorFormProps = {
  files: FileRecord[];
  treeNodes: FileTreeNode[];
  activeFileId: string;
  activeFile: FileRecord | null;
  preview: PreviewState;
  isLoading: boolean;
  error: string | null;
  onFilesUpload: (files: File[]) => void;
  onSelectFile: (fileId: string) => void;
  onClear: () => void;
};

function formatBytes(value: number): string {
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

export default function FileTypeDetectorForm({
  files,
  treeNodes,
  activeFileId,
  activeFile,
  preview,
  isLoading,
  error,
  onFilesUpload,
  onSelectFile,
  onClear,
}: FileTypeDetectorFormProps) {
  const fileInputRef = React.useRef<HTMLInputElement>(null);
  const folderInputRef = React.useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = React.useState(false);

  const totalSize = React.useMemo(
    () => files.reduce((acc, item) => acc + item.size, 0),
    [files],
  );
  const activeDetected = activeFile?.detectedType ?? null;
  const activeMime = activeDetected?.mime || activeFile?.file.type || "";

  const handleUploadClick = React.useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  const handleFolderClick = React.useCallback(() => {
    folderInputRef.current?.click();
  }, []);

  const handleFileChange = React.useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      const nextFiles = event.target.files;
      if (nextFiles && nextFiles.length > 0) {
        onFilesUpload(Array.from(nextFiles));
      }
      event.target.value = "";
    },
    [onFilesUpload],
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
      const droppedFiles = Array.from(event.dataTransfer.files);
      if (droppedFiles.length) {
        onFilesUpload(droppedFiles);
      }
    },
    [onFilesUpload],
  );

  return (
    <div className="flex flex-col gap-6">
      <div
        className={cn(
          "rounded-lg border bg-background p-4 transition-colors",
          isDragging && "border-primary/60 bg-primary/5",
        )}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
      >
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="text-sm font-medium">File Type Detector</div>
            <p className="text-xs text-muted-foreground">
              Upload files or folders to detect their true type and preview
              printable formats.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <input
              ref={fileInputRef}
              type="file"
              multiple
              className="hidden"
              onChange={handleFileChange}
            />
            <input
              ref={folderInputRef}
              type="file"
              multiple
              className="hidden"
              onChange={handleFileChange}
              // @ts-expect-error webkitdirectory is not in React types.
              webkitdirectory="true"
            />
            <Button
              type="button"
              variant="secondary"
              size="sm"
              className="h-8 gap-1"
              onClick={handleUploadClick}
            >
              <Upload className="h-4 w-4" />
              Upload files
            </Button>
            <Button
              type="button"
              variant="secondary"
              size="sm"
              className="h-8 gap-1"
              onClick={handleFolderClick}
            >
              <FolderUp className="h-4 w-4" />
              Upload folder
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-8 gap-1 text-destructive hover:text-destructive"
              onClick={onClear}
              disabled={files.length === 0 && !error}
            >
              <Trash2 className="h-4 w-4" />
              Clear
            </Button>
          </div>
        </div>
        <div className="mt-3 flex flex-wrap gap-4 text-xs text-muted-foreground">
          <span>Files: {files.length}</span>
          <span>Total size: {formatBytes(totalSize)}</span>
          {isDragging && (
            <span className="text-primary">Drop files to upload</span>
          )}
        </div>
        {error && <p className="mt-3 text-xs text-destructive">{error}</p>}
      </div>

      <div className="grid items-stretch gap-4 lg:grid-cols-[320px_minmax(0,1fr)]">
        <div className="flex h-[calc(100vh-16rem)] min-h-[480px] flex-col rounded-lg border bg-background p-4">
          <Label className="text-sm font-medium">Files</Label>
          <ScrollArea className="mt-3 min-h-0 flex-1">
            <FileTypeDetectorFileTree
              nodes={treeNodes}
              activeFileId={activeFileId}
              onSelect={onSelectFile}
            />
          </ScrollArea>
        </div>

        <div className="flex h-[calc(100vh-16rem)] min-h-[480px] flex-col rounded-lg border bg-background p-4">
          <div className="flex items-center gap-2 text-sm font-medium">
            <FileSearch className="h-4 w-4 text-muted-foreground" />
            Detection Details
          </div>
          <div className="mt-3 grid gap-2 text-xs text-muted-foreground sm:grid-cols-2">
            <div>
              <div className="font-medium text-foreground">Detected type</div>
              <div>
                {activeDetected
                  ? `${activeDetected.mime} (.${activeDetected.ext})`
                  : "Unknown"}
              </div>
            </div>
            <div>
              <div className="font-medium text-foreground">Browser MIME</div>
              <div>{activeMime || "Unavailable"}</div>
            </div>
            <div>
              <div className="font-medium text-foreground">File size</div>
              <div>{activeFile ? formatBytes(activeFile.size) : "0 B"}</div>
            </div>
            <div>
              <div className="font-medium text-foreground">Preview status</div>
              <div>
                {isLoading ? "Detecting..." : activeFile ? "Ready" : "No file"}
              </div>
            </div>
          </div>

          <Label className="mt-4 block text-sm font-medium">Preview</Label>
          <div className="mt-3 min-h-0 flex-1 overflow-hidden rounded-md border bg-muted/20">
            {!activeFile && (
              <div className="flex h-full items-center justify-center text-xs text-muted-foreground">
                Upload files to preview printable content.
              </div>
            )}
            {activeFile && preview.kind === "none" && (
              <div className="flex h-full items-center justify-center text-xs text-muted-foreground">
                No preview available for this file type.
              </div>
            )}
            {preview.kind === "text" && (
              <div className="h-full overflow-auto p-3">
                <pre className="whitespace-pre font-mono text-xs text-foreground">
                  {preview.content}
                </pre>
                {preview.truncated && (
                  <p className="mt-2 text-[11px] text-muted-foreground">
                    Preview truncated to 200 KB. Download the file to view the
                    full contents.
                  </p>
                )}
              </div>
            )}
            {preview.kind === "image" && (
              <div className="flex h-full items-center justify-center p-3">
                <img
                  src={preview.url}
                  alt={activeFile?.name || "Preview"}
                  className="max-h-full max-w-full object-contain"
                />
              </div>
            )}
            {preview.kind === "video" && (
              <div className="flex h-full items-center justify-center p-3">
                <video
                  src={preview.url}
                  controls
                  className="max-h-full max-w-full"
                />
              </div>
            )}
            {preview.kind === "pdf" && (
              <iframe
                title="PDF preview"
                src={preview.url}
                className="h-full w-full"
              />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
