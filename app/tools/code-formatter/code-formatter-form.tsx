"use client";

import * as React from "react";
import Editor, { type Monaco } from "@monaco-editor/react";
import { useTheme } from "next-themes";
import {
  Download,
  FileDown,
  FilePlus,
  FolderUp,
  SlidersHorizontal,
  Sparkles,
  Trash2,
  Upload,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { SearchableSelect } from "@/components/ui/searchable-select";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import SourceMapFileTree from "../source-map-viewer/source-map-file-tree";
import type { SourceTreeNode } from "../source-map-viewer/source-map-viewer-types";
import type { FormatterFile, ParamsState } from "./code-formatter-types";
import {
  LANGUAGE_BY_EXTENSION,
  getLanguageFromPath,
} from "../source-map-viewer/source-map-viewer-utils";

const TRAILING_COMMA_OPTIONS: Array<ParamsState["trailingComma"]> = [
  "none",
  "es5",
  "all",
];

const ARROW_PARENS_OPTIONS: Array<ParamsState["arrowParens"]> = [
  "always",
  "avoid",
];

const END_OF_LINE_OPTIONS: Array<ParamsState["endOfLine"]> = [
  "lf",
  "crlf",
  "cr",
  "auto",
];

const LANGUAGE_OPTIONS = Object.keys(LANGUAGE_BY_EXTENSION)
  .sort((a, b) => a.localeCompare(b))
  .map((extension) => ({
    label: `.${extension}`,
    value: extension,
    language: LANGUAGE_BY_EXTENSION[extension],
  }));

type CodeFormatterFormProps = {
  state: ParamsState;
  setParam: <K extends keyof ParamsState>(
    key: K,
    value: ParamsState[K],
    updateHistory?: boolean,
  ) => void;
  files: FormatterFile[];
  treeNodes: SourceTreeNode[];
  activeFile: FormatterFile | null;
  parseError: string | null;
  formatErrors: string[];
  activeFileError: string | null;
  downloadError: string | null;
  showFileTree: boolean;
  isFormatting: boolean;
  onFilesUpload: (files: File[]) => void;
  onCreateFile: (path: string, content: string) => void;
  onSelectFile: (fileId: string) => void;
  onEditorChange: (value: string) => void;
  onRenameActiveFile: (path: string) => void;
  onDeleteNode: (node: SourceTreeNode) => void;
  onFormatActive: () => void;
  onFormatAll: () => void;
  onDownloadFile: () => void;
  onDownloadAll: () => void;
  onClear: () => void;
};

export default function CodeFormatterForm({
  state,
  setParam,
  files,
  treeNodes,
  activeFile,
  parseError,
  formatErrors,
  activeFileError,
  downloadError,
  showFileTree,
  isFormatting,
  onFilesUpload,
  onCreateFile,
  onSelectFile,
  onEditorChange,
  onRenameActiveFile,
  onDeleteNode,
  onFormatActive,
  onFormatAll,
  onDownloadFile,
  onDownloadAll,
  onClear,
}: CodeFormatterFormProps) {
  const { resolvedTheme } = useTheme();
  const fileInputRef = React.useRef<HTMLInputElement>(null);
  const folderInputRef = React.useRef<HTMLInputElement>(null);
  const [isDialogOpen, setIsDialogOpen] = React.useState(false);
  const [newFilePath, setNewFilePath] = React.useState("");
  const [newFileContent, setNewFileContent] = React.useState("");
  const [isDragging, setIsDragging] = React.useState(false);
  const dragCounterRef = React.useRef(0);

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

  const handleFolderChange = React.useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      const nextFiles = event.target.files;
      if (nextFiles && nextFiles.length > 0) {
        onFilesUpload(Array.from(nextFiles));
      }
      event.target.value = "";
    },
    [onFilesUpload],
  );

  const handleCreateConfirm = React.useCallback(() => {
    if (!newFilePath.trim()) return;
    onCreateFile(newFilePath, newFileContent);
    setIsDialogOpen(false);
    setNewFilePath("");
    setNewFileContent("");
  }, [newFileContent, newFilePath, onCreateFile]);

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
          const collected: File[] = [];
          for (const entry of entries) {
            const files = await readEntryFiles(entry, "");
            collected.push(...files);
          }
          if (collected.length > 0) return collected;
        }
      } catch (error) {
        console.error("Failed to extract dropped entries.", error);
      }
      return fallbackFiles;
    },
    [readEntryFiles],
  );

  const handleDragEnter = React.useCallback((event: React.DragEvent) => {
    event.preventDefault();
    dragCounterRef.current += 1;
    setIsDragging(true);
  }, []);

  const handleDragLeave = React.useCallback((event: React.DragEvent) => {
    event.preventDefault();
    dragCounterRef.current -= 1;
    if (dragCounterRef.current <= 0) {
      dragCounterRef.current = 0;
      setIsDragging(false);
    }
  }, []);

  const handleDropFiles = React.useCallback(
    (event: React.DragEvent) => {
      event.preventDefault();
      dragCounterRef.current = 0;
      setIsDragging(false);
      void (async () => {
        const droppedFiles = await extractDroppedFiles(event);
        if (droppedFiles.length > 0) {
          onFilesUpload(droppedFiles);
        }
      })();
    },
    [extractDroppedFiles, onFilesUpload],
  );

  const handleSelectNode = React.useCallback(
    (node: SourceTreeNode) => {
      if (node.fileId) {
        onSelectFile(node.fileId);
      }
    },
    [onSelectFile],
  );

  const selectedLanguage = React.useMemo(() => {
    if (!activeFile) return "js";
    const extension = activeFile.path.split(".").pop()?.toLowerCase();
    const match = LANGUAGE_OPTIONS.find(
      (option) => option.value === extension,
    );
    return match?.value ?? "txt";
  }, [activeFile]);

  const handleLanguageChange = React.useCallback(
    (extension: string) => {
      const option = LANGUAGE_OPTIONS.find(
        (item) => item.value === extension,
      );
      if (!option) return;
      onRenameActiveFile(`untitled.${option.value}`);
    },
    [onRenameActiveFile],
  );

  const editorLanguage = activeFile
    ? getLanguageFromPath(activeFile.path)
    : "plaintext";

  const handleBeforeMount = React.useCallback((monaco: Monaco) => {
    const compilerOptions = {
      allowNonTsExtensions: true,
      jsx: monaco.languages.typescript.JsxEmit.ReactJSX,
      moduleResolution: monaco.languages.typescript.ModuleResolutionKind.NodeJs,
      target: monaco.languages.typescript.ScriptTarget.ESNext,
    };
    monaco.languages.typescript.typescriptDefaults.setCompilerOptions(
      compilerOptions,
    );
    monaco.languages.typescript.javascriptDefaults.setCompilerOptions(
      compilerOptions,
    );
  }, []);

  return (
    <TooltipProvider delayDuration={120}>
      <div className="flex flex-col gap-6">
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
          onChange={handleFolderChange}
          {...({
            webkitdirectory: "",
            directory: "",
          } as React.InputHTMLAttributes<HTMLInputElement>)}
        />

      <div
        className="relative h-[calc(100vh-9rem)] min-h-[360px] rounded-lg border bg-background"
        onDragEnter={handleDragEnter}
        onDragLeave={handleDragLeave}
        onDragOver={(event) => {
          event.preventDefault();
        }}
        onDrop={handleDropFiles}
      >
        <div
          className={
            showFileTree
              ? "grid h-full min-h-0 gap-0 lg:grid-cols-[280px_minmax(0,1fr)]"
              : "grid h-full min-h-0 gap-0"
          }
        >
          {isDragging ? (
            <div className="pointer-events-none absolute inset-0 z-20 flex items-center justify-center bg-background/70 text-sm text-muted-foreground backdrop-blur-sm">
              Drop files to add them
            </div>
          ) : null}
          {showFileTree ? (
            <div className="flex h-full min-h-0 flex-col border-r border-border/60 bg-muted/20">
              <div className="flex items-center justify-between border-b border-border/60 bg-background/80 px-3 py-2">
                <div className="text-xs font-medium text-muted-foreground">
                  Files
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
                        aria-label="Upload files"
                      >
                        <Upload className="h-4 w-4" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent side="bottom">Upload files</TooltipContent>
                  </Tooltip>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="h-8 w-8 p-0"
                        onClick={() => folderInputRef.current?.click()}
                        aria-label="Upload folder"
                      >
                        <FolderUp className="h-4 w-4" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent side="bottom">Upload folder</TooltipContent>
                  </Tooltip>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="h-8 w-8 p-0"
                        onClick={() => setIsDialogOpen(true)}
                        aria-label="New file"
                      >
                        <FilePlus className="h-4 w-4" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent side="bottom">New file</TooltipContent>
                  </Tooltip>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="h-8 w-8 p-0"
                        onClick={onDownloadAll}
                        disabled={files.length === 0}
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
                        disabled={files.length === 0}
                        aria-label="Clear files"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent side="bottom">Clear files</TooltipContent>
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
                  />
                </div>
              </ScrollArea>
            </div>
          ) : null}

          <div className="flex h-full min-h-0 flex-col bg-muted/10">
            <div className="border-b border-border/60 bg-background/80 px-3 py-2">
              <div className="flex flex-wrap items-center gap-2">
                <div className="flex flex-wrap items-center gap-2">
                  <SearchableSelect
                    value={selectedLanguage}
                    onValueChange={handleLanguageChange}
                    options={LANGUAGE_OPTIONS}
                    placeholder="Select extension..."
                    searchPlaceholder="Search extensions..."
                    triggerClassName="h-8 w-[180px]"
                    className="w-[240px]"
                  />
                </div>
                <div className="ml-auto flex flex-wrap items-center gap-2">
                  <Button
                    type="button"
                    variant="default"
                    size="sm"
                    className="h-8 gap-1"
                    onClick={onFormatActive}
                    disabled={!activeFile || isFormatting}
                  >
                    <Sparkles className="h-4 w-4" />
                    Format
                  </Button>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="h-8 w-8 p-0"
                        onClick={onFormatAll}
                        disabled={files.length === 0 || isFormatting}
                        aria-label="Format all"
                      >
                        <Sparkles className="h-4 w-4" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent side="bottom">Format all</TooltipContent>
                  </Tooltip>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="h-8 w-8 p-0"
                        onClick={onDownloadFile}
                        disabled={!activeFile}
                        aria-label="Download"
                      >
                        <Download className="h-4 w-4" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent side="bottom">Download</TooltipContent>
                  </Tooltip>
                  <Popover>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <PopoverTrigger asChild>
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            className="h-8 w-8 p-0"
                            aria-label="Options"
                          >
                            <SlidersHorizontal className="h-4 w-4" />
                          </Button>
                        </PopoverTrigger>
                      </TooltipTrigger>
                      <TooltipContent side="bottom">Options</TooltipContent>
                    </Tooltip>
                    <PopoverContent align="end" className="w-[min(92vw,420px)]">
                      <div className="space-y-3">
                        <div className="text-sm font-medium">Format Options</div>
                        <div className="grid gap-3 sm:grid-cols-2">
                          <div className="space-y-2">
                            <Label className="text-xs">Print Width</Label>
                            <Input
                              type="number"
                              value={state.printWidth}
                              min={40}
                              max={400}
                              onChange={(event) => {
                                const value = event.target.valueAsNumber;
                                if (Number.isNaN(value)) return;
                                setParam("printWidth", value);
                              }}
                            />
                          </div>
                          <div className="space-y-2">
                            <Label className="text-xs">Tab Width</Label>
                            <Input
                              type="number"
                              value={state.tabWidth}
                              min={1}
                              max={8}
                              onChange={(event) => {
                                const value = event.target.valueAsNumber;
                                if (Number.isNaN(value)) return;
                                setParam("tabWidth", value);
                              }}
                            />
                          </div>
                          <div className="flex items-center gap-2">
                            <Checkbox
                              id="useTabs"
                              checked={state.useTabs}
                              onCheckedChange={(checked) =>
                                setParam("useTabs", checked === true, true)
                              }
                            />
                            <Label htmlFor="useTabs" className="text-xs">
                              Use tabs
                            </Label>
                          </div>
                          <div className="flex items-center gap-2">
                            <Checkbox
                              id="semi"
                              checked={state.semi}
                              onCheckedChange={(checked) =>
                                setParam("semi", checked === true, true)
                              }
                            />
                            <Label htmlFor="semi" className="text-xs">
                              Semicolons
                            </Label>
                          </div>
                          <div className="flex items-center gap-2">
                            <Checkbox
                              id="singleQuote"
                              checked={state.singleQuote}
                              onCheckedChange={(checked) =>
                                setParam("singleQuote", checked === true, true)
                              }
                            />
                            <Label htmlFor="singleQuote" className="text-xs">
                              Single quotes
                            </Label>
                          </div>
                          <div className="flex items-center gap-2">
                            <Checkbox
                              id="bracketSpacing"
                              checked={state.bracketSpacing}
                              onCheckedChange={(checked) =>
                                setParam("bracketSpacing", checked === true, true)
                              }
                            />
                            <Label htmlFor="bracketSpacing" className="text-xs">
                              Bracket spacing
                            </Label>
                          </div>
                          <div className="space-y-2">
                            <Label className="text-xs">Trailing Comma</Label>
                            <Select
                              value={state.trailingComma}
                              onValueChange={(value) =>
                                setParam(
                                  "trailingComma",
                                  value as ParamsState["trailingComma"],
                                  true,
                                )
                              }
                            >
                              <SelectTrigger className="w-full">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                {TRAILING_COMMA_OPTIONS.map((option) => (
                                  <SelectItem key={option} value={option}>
                                    {option}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                          <div className="space-y-2">
                            <Label className="text-xs">Arrow Parens</Label>
                            <Select
                              value={state.arrowParens}
                              onValueChange={(value) =>
                                setParam(
                                  "arrowParens",
                                  value as ParamsState["arrowParens"],
                                  true,
                                )
                              }
                            >
                              <SelectTrigger className="w-full">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                {ARROW_PARENS_OPTIONS.map((option) => (
                                  <SelectItem key={option} value={option}>
                                    {option}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                          <div className="space-y-2">
                            <Label className="text-xs">End of Line</Label>
                            <Select
                              value={state.endOfLine}
                              onValueChange={(value) =>
                                setParam(
                                  "endOfLine",
                                  value as ParamsState["endOfLine"],
                                  true,
                                )
                              }
                            >
                              <SelectTrigger className="w-full">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                {END_OF_LINE_OPTIONS.map((option) => (
                                  <SelectItem key={option} value={option}>
                                    {option}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                        </div>
                      </div>
                    </PopoverContent>
                  </Popover>
                </div>
              </div>
            </div>
            <div className="relative flex-1 overflow-hidden">
              {activeFile ? (
                <Editor
                  height="100%"
                  language={editorLanguage}
                  path={activeFile.path}
                  theme={resolvedTheme === "dark" ? "vs-dark" : "light"}
                  value={activeFile.content}
                  beforeMount={handleBeforeMount}
                  onChange={(value) => onEditorChange(value ?? "")}
                  options={{
                    readOnly: false,
                    minimap: { enabled: false },
                    fontSize: 13,
                    lineNumbers: "on",
                    scrollBeyondLastLine: false,
                    wordWrap: "on",
                    tabSize: state.tabWidth,
                    insertSpaces: !state.useTabs,
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
                  Upload a file to start formatting.
                </div>
              )}
            </div>
            {activeFileError && (
              <div className="px-3 py-2 text-xs text-destructive">
                {activeFileError}
              </div>
            )}
            {(parseError || downloadError || formatErrors.length > 0) && (
              <div className="border-t border-border/60 px-3 py-2 text-xs text-muted-foreground">
                {parseError && (
                  <div className="text-destructive">{parseError}</div>
                )}
                {downloadError && (
                  <div className="text-destructive">{downloadError}</div>
                )}
                {formatErrors.length > 0 && (
                  <div className="space-y-1 text-destructive">
                    {formatErrors.map((error) => (
                      <div key={error}>{error}</div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create File</DialogTitle>
            <DialogDescription>
              Add a new file to the workspace with an optional initial content.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-2">
              <Label className="text-xs">Path</Label>
              <Input
                value={newFilePath}
                onChange={(event) => setNewFilePath(event.target.value)}
                placeholder="src/index.ts"
              />
            </div>
            <div className="space-y-2">
              <Label className="text-xs">Initial Content</Label>
              <Textarea
                value={newFileContent}
                onChange={(event) => setNewFileContent(event.target.value)}
                placeholder="Optional content..."
                className="min-h-[120px]"
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="ghost"
              onClick={() => setIsDialogOpen(false)}
            >
              Cancel
            </Button>
            <Button type="button" onClick={handleCreateConfirm}>
              Create
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      </div>
    </TooltipProvider>
  );
}
