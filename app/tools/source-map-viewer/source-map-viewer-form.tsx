"use client";

import * as React from "react";
import Editor from "@monaco-editor/react";
import { useTheme } from "next-themes";
import { Download, FileDown, Trash2, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import SourceMapFileTree from "./source-map-file-tree";
import type {
  SourceFile,
  SourceMapBundle,
  SourceTreeNode,
} from "./source-map-viewer-types";
import { getLanguageFromPath } from "./source-map-viewer-utils";

const ACCEPTED_FILE_TYPES =
  ".map,.js,.mjs,.cjs,.jsx,.ts,.tsx,.css,.scss,.sass,.less";

type SourceMapViewerFormProps = {
  bundles: SourceMapBundle[];
  treeNodes: SourceTreeNode[];
  activeBundle: SourceMapBundle | null;
  activeFile: SourceFile | null;
  parseErrors: string[];
  downloadError: string | null;
  onFilesUpload: (files: File[]) => void;
  onClear: () => void;
  onSelectFile: (mapId: string, fileId: string) => void;
  onDeleteNode: (node: SourceTreeNode) => void;
  onDownloadFile: () => void;
  onDownloadAll: () => void;
};

export default function SourceMapViewerForm({
  bundles,
  treeNodes,
  activeBundle,
  activeFile,
  parseErrors,
  downloadError,
  onFilesUpload,
  onClear,
  onSelectFile,
  onDeleteNode,
  onDownloadFile,
  onDownloadAll,
}: SourceMapViewerFormProps) {
  const { resolvedTheme } = useTheme();
  const fileInputRef = React.useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = React.useState(false);
  const dragCounterRef = React.useRef(0);

  const readEntryFiles = React.useCallback(
    async (entry: FileSystemEntry, prefix: string): Promise<File[]> => {
      if (entry.isFile) {
        const file = await new Promise<File | null>((resolve) => {
          try {
            (entry as FileSystemFileEntry).file(
              (result) => resolve(result),
              () => resolve(null),
            );
          } catch (error) {
            console.error("Failed to read dropped file entry.", error);
            resolve(null);
          }
        });
        if (!file) return [];
        if (!prefix) return [file];
        return [
          new File([file], `${prefix}${file.name}`, { type: file.type }),
        ];
      }
      if (!entry.isDirectory) return [];
      const reader = (entry as FileSystemDirectoryEntry).createReader();
      const results: File[] = [];
      while (true) {
        let entries: FileSystemEntry[] = [];
        try {
          entries = await new Promise<FileSystemEntry[]>((resolve, reject) => {
            reader.readEntries(resolve, reject);
          });
        } catch (error) {
          console.error("Failed to read dropped directory entry.", error);
          break;
        }
        if (!entries.length) break;
        for (const child of entries) {
          const childFiles = await readEntryFiles(
            child,
            `${prefix}${entry.name}/`,
          );
          results.push(...childFiles);
        }
      }
      return results;
    },
    [],
  );

  const extractDroppedFiles = React.useCallback(
    async (event: React.DragEvent) => {
      const fallbackFiles = Array.from(event.dataTransfer?.files ?? []);
      try {
        const items = Array.from(event.dataTransfer?.items ?? []);
        const entries = items
          .map((item) => item.webkitGetAsEntry?.())
          .filter(Boolean) as FileSystemEntry[];
        if (entries.length > 0) {
          const containsDirectory = entries.some((entry) => entry.isDirectory);
          const collected: File[] = [];
          for (const entry of entries) {
            const files = await readEntryFiles(entry, "");
            collected.push(...files);
          }
          if (collected.length > 0) {
            if (containsDirectory) {
              return collected.filter((file) =>
                file.name.toLowerCase().endsWith(".map"),
              );
            }
            return collected;
          }
        }
      } catch (error) {
        console.error("Failed to extract dropped entries.", error);
      }
      return fallbackFiles;
    },
    [readEntryFiles],
  );

  const totalSources = React.useMemo(
    () => bundles.reduce((acc, bundle) => acc + bundle.sources.length, 0),
    [bundles],
  );

  const missingSources = React.useMemo(
    () =>
      bundles.reduce(
        (acc, bundle) =>
          acc +
          bundle.sources.filter((source) => source.content === null).length,
        0,
      ),
    [bundles],
  );

  const handleFileChange = React.useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      const files = event.target.files;
      if (files && files.length > 0) {
        onFilesUpload(Array.from(files));
      }
      event.target.value = "";
    },
    [onFilesUpload],
  );

  const handleSelectNode = React.useCallback(
    (node: SourceTreeNode) => {
      if (node.fileId && node.mapId) {
        onSelectFile(node.mapId, node.fileId);
      }
    },
    [onSelectFile],
  );

  const editorLanguage = activeFile
    ? getLanguageFromPath(activeFile.path)
    : "plaintext";
  const editorContent = activeFile?.content ?? "";

  return (
    <TooltipProvider delayDuration={120}>
      <div
        className="relative rounded-lg border bg-background h-[calc(100vh-9rem)] min-h-[360px]"
        onDragEnter={(event) => {
          event.preventDefault();
          dragCounterRef.current += 1;
          setIsDragging(true);
        }}
        onDragLeave={(event) => {
          event.preventDefault();
          dragCounterRef.current -= 1;
          if (dragCounterRef.current <= 0) {
            dragCounterRef.current = 0;
            setIsDragging(false);
          }
        }}
        onDragOver={(event) => {
          event.preventDefault();
        }}
        onDrop={(event) => {
          event.preventDefault();
          dragCounterRef.current = 0;
          setIsDragging(false);
          void (async () => {
            const droppedFiles = await extractDroppedFiles(event);
            if (droppedFiles.length > 0) {
              onFilesUpload(droppedFiles);
            }
          })();
        }}
      >
        {isDragging ? (
          <div className="pointer-events-none absolute inset-0 z-20 flex items-center justify-center bg-background/70 text-sm text-muted-foreground backdrop-blur-sm">
            Drop files or folders to add them
          </div>
        ) : null}
        <input
          ref={fileInputRef}
          type="file"
          multiple
          accept={ACCEPTED_FILE_TYPES}
          className="hidden"
          onChange={handleFileChange}
        />
        <div className="flex h-full min-h-0 flex-col">
          <div className="grid flex-1 min-h-0 gap-0 lg:grid-cols-[280px_minmax(0,1fr)]">
            <div className="flex h-full min-h-0 flex-col border-r border-border/60 bg-muted/20">
            <div className="flex items-center justify-between border-b border-border/60 bg-background/80 px-3 py-2">
              <div className="text-xs font-medium text-muted-foreground">
                Maps
              </div>
              <div className="flex items-center gap-1">
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="h-8 w-8 p-0"
                      onClick={() => fileInputRef.current?.click()}
                      aria-label="Upload maps"
                    >
                      <Upload className="h-4 w-4" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent side="bottom">Upload</TooltipContent>
                </Tooltip>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="h-8 w-8 p-0"
                      onClick={onDownloadAll}
                      disabled={totalSources === 0}
                      aria-label="Download ZIP"
                    >
                      <FileDown className="h-4 w-4" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent side="bottom">Download ZIP</TooltipContent>
                </Tooltip>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="h-8 w-8 p-0 text-destructive hover:text-destructive"
                      onClick={onClear}
                      disabled={totalSources === 0}
                      aria-label="Clear"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent side="bottom">Clear</TooltipContent>
                </Tooltip>
              </div>
            </div>
            <ScrollArea className="flex-1 min-h-0">
              <div className="px-2 py-3">
                <SourceMapFileTree
                  nodes={treeNodes}
                  activeFileId={activeFile?.id ?? ""}
                  onSelect={handleSelectNode}
                  onDelete={onDeleteNode}
                  canDeleteNode={(node) => node.id.startsWith("map:")}
                />
              </div>
            </ScrollArea>
            </div>

            <div className="flex h-full min-h-0 flex-col bg-muted/10">
            <div className="flex items-center justify-between border-b border-border/60 bg-background/80 px-3 py-2">
              <div className="text-xs font-medium text-muted-foreground">
                Preview
              </div>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-8 w-8 p-0"
                    onClick={onDownloadFile}
                    disabled={!activeFile || activeFile.content === null}
                    aria-label="Download file"
                  >
                    <Download className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="bottom">Download file</TooltipContent>
              </Tooltip>
            </div>
            <div className="relative flex-1 overflow-hidden">
              {activeFile ? (
                <Editor
                  height="100%"
                  language={editorLanguage}
                  theme={resolvedTheme === "dark" ? "vs-dark" : "light"}
                  value={editorContent}
                  options={{
                    readOnly: true,
                    minimap: { enabled: false },
                    fontSize: 13,
                    lineNumbers: "on",
                    scrollBeyondLastLine: false,
                    wordWrap: "on",
                    tabSize: 4,
                    detectIndentation: false,
                    automaticLayout: true,
                    padding: { top: 8, bottom: 8 },
                    scrollbar: {
                      vertical: "auto",
                      horizontal: "auto",
                      verticalScrollbarSize: 8,
                      horizontalScrollbarSize: 8,
                    },
                  }}
                />
              ) : (
                <div className="flex h-full items-center justify-center text-xs text-muted-foreground">
                  Upload a source map to view files.
                </div>
              )}
            </div>
            {activeFile && activeFile.content === null && (
              <p className="px-3 py-2 text-xs text-muted-foreground">
                This source map does not embed source content for the selected
                file.
              </p>
            )}
            </div>
          </div>
          {(parseErrors.length > 0 || downloadError) && (
            <div className="border-t border-border/60 px-3 py-2 text-xs text-destructive">
              {parseErrors.map((error) => (
                <div key={error}>{error}</div>
              ))}
              {downloadError && <div>{downloadError}</div>}
            </div>
          )}
          <div className="border-t border-border/60 px-3 py-2 text-xs text-muted-foreground">
            <span>Maps: {bundles.length}</span>
            <span className="ml-4">Sources: {totalSources}</span>
            {missingSources > 0 && (
              <span className="ml-4">Missing content: {missingSources}</span>
            )}
          </div>
        </div>
      </div>
    </TooltipProvider>
  );
}
