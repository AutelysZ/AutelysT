"use client";

import * as React from "react";
import Editor from "@monaco-editor/react";
import { useTheme } from "next-themes";
import { Download, FileDown, FolderUp, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
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
  oversizeKeys: string[];
  onFilesUpload: (files: File[]) => void;
  onClear: () => void;
  onSelectFile: (mapId: string, fileId: string) => void;
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
  oversizeKeys,
  onFilesUpload,
  onClear,
  onSelectFile,
  onDownloadFile,
  onDownloadAll,
}: SourceMapViewerFormProps) {
  const { resolvedTheme } = useTheme();
  const fileInputRef = React.useRef<HTMLInputElement>(null);

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

  const handleUploadClick = React.useCallback(() => {
    fileInputRef.current?.click();
  }, []);

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
    <div className="flex flex-col gap-6">
      <div className="rounded-lg border bg-background p-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="text-sm font-medium">Uploads</div>
            <p className="text-xs text-muted-foreground">
              Upload source maps or JavaScript/CSS files with inline source
              maps. Multiple files are supported.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <input
              ref={fileInputRef}
              type="file"
              multiple
              accept={ACCEPTED_FILE_TYPES}
              className="hidden"
              onChange={handleFileChange}
            />
            <Button
              type="button"
              variant="secondary"
              size="sm"
              className="h-8 gap-1"
              onClick={handleUploadClick}
            >
              <FolderUp className="h-4 w-4" />
              Upload
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-8 gap-1"
              onClick={onDownloadAll}
              disabled={totalSources === 0}
            >
              <FileDown className="h-4 w-4" />
              Download ZIP
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-8 gap-1 text-destructive hover:text-destructive"
              onClick={onClear}
              disabled={totalSources === 0}
            >
              <Trash2 className="h-4 w-4" />
              Clear
            </Button>
          </div>
        </div>
        <div className="mt-3 flex flex-wrap gap-4 text-xs text-muted-foreground">
          <span>Maps: {bundles.length}</span>
          <span>Sources: {totalSources}</span>
          {missingSources > 0 && <span>Missing content: {missingSources}</span>}
        </div>
        {parseErrors.length > 0 && (
          <div className="mt-3 space-y-1 text-xs text-destructive">
            {parseErrors.map((error) => (
              <div key={error}>{error}</div>
            ))}
          </div>
        )}
        {downloadError && (
          <p className="mt-2 text-xs text-destructive">{downloadError}</p>
        )}
        {oversizeKeys.length > 0 && (
          <p className="mt-2 text-xs text-muted-foreground">
            Selection exceeds 2 KB and is not synced to URL.
          </p>
        )}
      </div>

      <div className="rounded-lg border bg-background">
        <div className="grid gap-0 lg:grid-cols-[280px_minmax(0,1fr)]">
          <div className="min-h-[280px] border-r border-border/60 bg-muted/20">
            <ScrollArea className="h-[calc(100vh-16rem)] min-h-[280px]">
              <div className="px-2 py-3">
                <SourceMapFileTree
                  nodes={treeNodes}
                  activeFileId={activeFile?.id ?? ""}
                  onSelect={handleSelectNode}
                />
              </div>
            </ScrollArea>
          </div>

          <div className="flex min-h-[280px] flex-col bg-muted/10">
            <div className="relative flex-1 overflow-hidden">
              <div className="absolute right-2 top-2 z-10">
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  className="h-8 gap-1"
                  onClick={onDownloadFile}
                  disabled={!activeFile || activeFile.content === null}
                >
                  <Download className="h-4 w-4" />
                  Download file
                </Button>
              </div>
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
      </div>
    </div>
  );
}
