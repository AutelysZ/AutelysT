"use client";

import * as React from "react";
import { ArrowLeftRight, Copy, Check, Upload, Download, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

interface PaneProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
  isActive: boolean;
  error?: string | null;
  warning?: string | null;
  placeholder?: string;
  disabled?: boolean;
  readOnly?: boolean;
  headerExtra?: React.ReactNode;
  customContent?: React.ReactNode;
  contentClassName?: string;
  onFileUpload?: (file: File) => void;
  onCopy?: () => Promise<void> | void;
  overlay?: React.ReactNode;
  leftDownload?: () => void;
  rightDownload?: () => void;
  fileResult?: {
    status: "success" | "error";
    message: string;
    downloadUrl?: string;
    downloadName?: string;
  } | null;
  onClearFile?: () => void;
}

function Pane({
  label,
  value,
  onChange,
  isActive,
  error,
  warning,
  placeholder,
  disabled,
  readOnly,
  headerExtra,
  customContent,
  contentClassName,
  onFileUpload,
  onCopy,
  overlay,
  leftDownload,
  rightDownload,
  fileResult,
  onClearFile,
}: PaneProps) {
  const [copied, setCopied] = React.useState(false);
  const [isDragOver, setIsDragOver] = React.useState(false);
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  const handleCopy = async () => {
    try {
      if (onCopy) {
        await onCopy();
      } else {
        await navigator.clipboard.writeText(value);
      }
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (error) {
      console.error("Copy failed", error);
    }
  };

  const handleDrop = React.useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragOver(false);
      const file = e.dataTransfer.files[0];
      if (file && onFileUpload) {
        onFileUpload(file);
      }
    },
    [onFileUpload],
  );

  const handleFileChange = React.useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file && onFileUpload) {
        onFileUpload(file);
      }
      e.target.value = "";
    },
    [onFileUpload],
  );

  return (
    <div className="flex w-full flex-1 flex-col md:w-0">
      <div className="mb-2 flex items-center justify-between">
        <span className={cn("text-sm font-medium", isActive && "text-primary")}>
          {label}
        </span>
        <div className="flex items-center gap-1">
          {headerExtra}
          {onFileUpload && (
            <>
              <input
                ref={fileInputRef}
                type="file"
                className="hidden"
                onChange={handleFileChange}
              />
              <Button
                variant="ghost"
                size="sm"
                onClick={() => fileInputRef.current?.click()}
                className="h-7 gap-1 px-2 text-xs"
              >
                <Upload className="h-3 w-3" />
                File
              </Button>
            </>
          )}
          {leftDownload && (
            <Button
              variant="ghost"
              size="sm"
              onClick={leftDownload}
              disabled={!value}
              className="h-7 gap-1 px-2 text-xs"
            >
              <Download className="h-3 w-3" />
              Download
            </Button>
          )}
          <Button
            variant="ghost"
            size="sm"
            onClick={handleCopy}
            disabled={!value && !onCopy}
            className="h-7 gap-1 px-2 text-xs"
          >
            {copied ? (
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
          {rightDownload && (
            <Button
              variant="ghost"
              size="sm"
              onClick={rightDownload}
              disabled={!value}
              className="h-7 gap-1 px-2 text-xs"
            >
              <Download className="h-3 w-3" />
              Download
            </Button>
          )}
        </div>
      </div>

      {fileResult ? (
        <div
          className={cn(
            "flex flex-1 flex-col items-center justify-center gap-4 rounded-md border-2 border-dashed p-6",
            fileResult.status === "success"
              ? "border-green-500/50 bg-green-500/5"
              : "border-destructive/50 bg-destructive/5",
          )}
        >
          <div className="text-center">
            <p
              className={cn(
                "font-medium",
                fileResult.status === "success"
                  ? "text-green-600 dark:text-green-400"
                  : "text-destructive",
              )}
            >
              {fileResult.message}
            </p>
          </div>
          <div className="flex gap-2">
            {fileResult.downloadUrl && (
              <Button asChild size="sm">
                <a
                  href={fileResult.downloadUrl}
                  download={fileResult.downloadName}
                >
                  <Download className="mr-2 h-4 w-4" />
                  Download
                </a>
              </Button>
            )}
            <Button variant="outline" size="sm" onClick={onClearFile}>
              <X className="mr-2 h-4 w-4" />
              Clear
            </Button>
          </div>
        </div>
      ) : (
        <div
          className={cn(
            "relative flex-1",
            isDragOver &&
              "after:absolute after:inset-0 after:rounded-md after:border-2 after:border-dashed after:border-primary after:bg-primary/5",
          )}
          onDragOver={(e) => {
            e.preventDefault();
            setIsDragOver(true);
          }}
          onDragLeave={() => setIsDragOver(false)}
          onDrop={handleDrop}
        >
          {customContent ? (
            <div
              className={cn(
                "h-full min-h-[200px] max-h-[400px] overflow-auto rounded-md border border-transparent",
                error && "border-destructive",
                isActive && "ring-1 ring-primary",
                contentClassName,
              )}
            >
              {customContent}
            </div>
          ) : (
            <Textarea
              value={value}
              onChange={(e) => onChange(e.target.value)}
              placeholder={placeholder}
              disabled={disabled}
              readOnly={readOnly}
              className={cn(
                "h-full min-h-[200px] max-h-[400px] resize-none overflow-auto font-mono text-sm break-all",
                error && "border-destructive",
                isActive && "ring-1 ring-primary",
                contentClassName,
              )}
              style={{ wordBreak: "break-all", overflowWrap: "anywhere" }}
            />
          )}
          {overlay && <div className="absolute inset-0 z-10">{overlay}</div>}
        </div>
      )}

      {error && <p className="mt-1 text-xs text-destructive">{error}</p>}
      {warning && (
        <p className="mt-1 text-xs text-muted-foreground">{warning}</p>
      )}
    </div>
  );
}

interface DualPaneLayoutProps {
  leftLabel?: string;
  rightLabel?: string;
  leftValue: string;
  rightValue: string;
  onLeftChange: (value: string) => void;
  onRightChange: (value: string) => void;
  activeSide: "left" | "right";
  leftError?: string | null;
  rightError?: string | null;
  leftWarning?: string | null;
  rightWarning?: string | null;
  leftPlaceholder?: string;
  rightPlaceholder?: string;
  leftReadOnly?: boolean;
  rightReadOnly?: boolean;
  leftHeaderExtra?: React.ReactNode;
  rightHeaderExtra?: React.ReactNode;
  leftCustomContent?: React.ReactNode;
  rightCustomContent?: React.ReactNode;
  leftContentClassName?: string;
  rightContentClassName?: string;
  leftOverlay?: React.ReactNode;
  rightOverlay?: React.ReactNode;
  leftOnCopy?: () => Promise<void> | void;
  rightOnCopy?: () => Promise<void> | void;
  leftFileUpload?: (file: File) => void;
  rightFileUpload?: (file: File) => void;
  leftDownload?: () => void;
  rightDownload?: () => void;
  leftFileResult?: {
    status: "success" | "error";
    message: string;
    downloadUrl?: string;
    downloadName?: string;
  } | null;
  rightFileResult?: {
    status: "success" | "error";
    message: string;
    downloadUrl?: string;
    downloadName?: string;
  } | null;
  onClearLeftFile?: () => void;
  onClearRightFile?: () => void;
  children?: React.ReactNode;
  layoutClassName?: string;
  panesClassName?: string;
}

export function DualPaneLayout({
  leftLabel = "Input",
  rightLabel = "Output",
  leftValue,
  rightValue,
  onLeftChange,
  onRightChange,
  activeSide,
  leftError,
  rightError,
  leftWarning,
  rightWarning,
  leftPlaceholder,
  rightPlaceholder,
  leftReadOnly,
  rightReadOnly,
  leftHeaderExtra,
  rightHeaderExtra,
  leftCustomContent,
  rightCustomContent,
  leftContentClassName,
  rightContentClassName,
  leftOverlay,
  rightOverlay,
  leftOnCopy,
  rightOnCopy,
  leftFileUpload,
  rightFileUpload,
  leftDownload,
  rightDownload,
  leftFileResult,
  rightFileResult,
  onClearLeftFile,
  onClearRightFile,
  children,
  layoutClassName,
  panesClassName,
}: DualPaneLayoutProps) {
  return (
    <div className={cn("flex h-full flex-col gap-4", layoutClassName)}>
      {/* Parameters */}
      {children && <div className="shrink-0">{children}</div>}

      {/* Panes */}
      <div
        className={cn(
          "flex min-h-0 flex-1 flex-col gap-4 md:flex-row",
          panesClassName,
        )}
      >
        <Pane
          label={leftLabel}
          value={leftValue}
          onChange={onLeftChange}
          isActive={activeSide === "left"}
          error={leftError}
          warning={leftWarning}
          placeholder={leftPlaceholder}
          readOnly={leftReadOnly}
          headerExtra={leftHeaderExtra}
          customContent={leftCustomContent}
          contentClassName={leftContentClassName}
          onFileUpload={leftFileUpload}
          onCopy={leftOnCopy}
          overlay={leftOverlay}
          leftDownload={leftDownload}
          fileResult={leftFileResult}
          onClearFile={onClearLeftFile}
        />

        <div className="flex shrink-0 items-center justify-center text-muted-foreground md:rotate-0 rotate-90">
          <ArrowLeftRight className="h-5 w-5" />
        </div>

        <Pane
          label={rightLabel}
          value={rightValue}
          onChange={onRightChange}
          isActive={activeSide === "right"}
          error={rightError}
          warning={rightWarning}
          placeholder={rightPlaceholder}
          readOnly={rightReadOnly}
          headerExtra={rightHeaderExtra}
          customContent={rightCustomContent}
          contentClassName={rightContentClassName}
          onFileUpload={rightFileUpload}
          onCopy={rightOnCopy}
          overlay={rightOverlay}
          rightDownload={rightDownload}
          fileResult={rightFileResult}
          onClearFile={onClearRightFile}
        />
      </div>
    </div>
  );
}
