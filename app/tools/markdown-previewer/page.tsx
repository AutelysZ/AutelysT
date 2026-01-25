"use client";

import * as React from "react";
import { Suspense } from "react";
import { z } from "zod";
import Editor from "@monaco-editor/react";
import { useTheme } from "next-themes";
import { Marked } from "marked";
import { markedHighlight } from "marked-highlight";
import hljs from "highlight.js";
import TurndownService from "turndown";
import {
  ToolPageWrapper,
  useToolHistoryContext,
} from "@/components/tool-ui/tool-page-wrapper";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  DEFAULT_URL_SYNC_DEBOUNCE_MS,
  useUrlSyncedState,
} from "@/lib/url-state/use-url-synced-state";
import type { HistoryEntry } from "@/lib/history/db";
import { cn } from "@/lib/utils";
import {
  Download,
  FileDown,
  MoreHorizontal,
  Printer,
  RotateCcw,
  Upload,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

const paramsSchema = z.object({
  markdown: z.string().default(""),
  viewMode: z.enum(["split", "editor", "preview"]).default("split"),
});

const defaultMarkdown = `# Markdown Previewer

Write Markdown on the left and see the preview on the right.

## Highlights

- **Bold** and *italic* text
- \`inline code\` and fenced code blocks
- [Links](https://example.com)
- > Blockquotes

---

\`\`\`ts
type PreviewMode = "split" | "editor" | "preview"
console.log("Hello, Markdown")
\`\`\`
`;
function buildHtmlDocument(renderedHtml: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Markdown Export</title>
  <style>
    body { font-family: system-ui, -apple-system, \"Segoe UI\", sans-serif; line-height: 1.6; padding: 24px; margin: 0; background: #ffffff; color: #111827; }
    h1, h2, h3, h4, h5, h6 { font-weight: 600; margin: 1.2em 0 0.6em; }
    h1 { font-size: 2em; }
    h2 { font-size: 1.5em; }
    h3 { font-size: 1.25em; }
    h4 { font-size: 1.1em; }
    h5 { font-size: 1em; }
    h6 { font-size: 0.9em; }
    p { margin: 0.6em 0; }
    pre { background: #f5f5f5; padding: 12px; overflow-x: auto; }
    code { font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, \"Liberation Mono\", \"Courier New\", monospace; background: #f1f5f9; padding: 0.2em 0.35em; border-radius: 4px; }
    pre code { background: transparent; padding: 0; }
    blockquote { border-left: 3px solid #bbb; padding-left: 12px; color: #555; margin: 0.8em 0; }
    ul, ol { padding-left: 24px; }
    hr { border: none; border-top: 1px solid #ddd; margin: 1.5em 0; }
    a { color: #1d4ed8; }
    pre code.hljs { display: block; overflow-x: auto; padding: 0; }
    code.hljs { padding: 3px 5px; }
    .hljs { color: #24292e; background: transparent; }
    .hljs-doctag, .hljs-keyword, .hljs-meta .hljs-keyword, .hljs-template-tag, .hljs-template-variable, .hljs-type, .hljs-variable.language_ { color: #d73a49; }
    .hljs-title, .hljs-title.class_, .hljs-title.class_.inherited__, .hljs-title.function_ { color: #6f42c1; }
    .hljs-attr, .hljs-attribute, .hljs-literal, .hljs-meta, .hljs-number, .hljs-operator, .hljs-variable, .hljs-selector-attr, .hljs-selector-class, .hljs-selector-id { color: #005cc5; }
    .hljs-regexp, .hljs-string, .hljs-meta .hljs-string { color: #032f62; }
    .hljs-built_in, .hljs-symbol { color: #e36209; }
    .hljs-comment, .hljs-code, .hljs-formula { color: #6a737d; }
    .hljs-name, .hljs-quote, .hljs-selector-tag, .hljs-selector-pseudo { color: #22863a; }
    .hljs-subst { color: #24292e; }
    .hljs-section { color: #005cc5; font-weight: bold; }
    .hljs-bullet { color: #735c0f; }
    .hljs-emphasis { color: #24292e; font-style: italic; }
    .hljs-strong { color: #24292e; font-weight: bold; }
    .hljs-addition { color: #22863a; background-color: #f0fff4; }
    .hljs-deletion { color: #b31d28; background-color: #ffeef0; }
    @media print {
      a[href]::after {
        content: " (" attr(href) ")";
        font-size: 0.9em;
        color: #4b5563;
        word-break: break-all;
      }
    }
  </style>
</head>
<body>
${renderedHtml}
</body>
</html>`;
}

export default function MarkdownPreviewerPage() {
  return (
    <Suspense fallback={null}>
      <MarkdownPreviewerContent />
    </Suspense>
  );
}

function MarkdownPreviewerContent() {
  const { state, setParam, oversizeKeys, hasUrlParams, hydrationSource } =
    useUrlSyncedState("markdown-previewer", {
      schema: paramsSchema,
      defaults: paramsSchema.parse({
        markdown: defaultMarkdown,
      }),
    });

  const { resolvedTheme } = useTheme();
  const markedParser = React.useMemo(() => {
    const instance = new Marked({ gfm: true, breaks: true });
    instance.use(
      markedHighlight({
        langPrefix: "hljs language-",
        highlight(code, language) {
          const safeLanguage =
            language && hljs.getLanguage(language) ? language : "plaintext";
          return hljs.highlight(code, { language: safeLanguage }).value;
        },
      }),
    );
    instance.use({
      renderer: {
        html: () => "",
      },
    });
    return instance;
  }, []);
  const turndownService = React.useMemo(
    () =>
      new TurndownService({
        codeBlockStyle: "fenced",
        headingStyle: "atx",
      }),
    [],
  );
  const uploadInputRef = React.useRef<HTMLInputElement>(null);
  const [isDragActive, setIsDragActive] = React.useState(false);

  const handleMarkdownChange = React.useCallback(
    (value: string | undefined) => {
      setParam("markdown", value ?? "");
    },
    [setParam],
  );

  const handleDownloadMarkdown = React.useCallback(() => {
    const content = state.markdown;
    if (!content) return;
    const blob = new Blob([content], { type: "text/markdown" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = "markdown.md";
    document.body.appendChild(anchor);
    anchor.click();
    document.body.removeChild(anchor);
    URL.revokeObjectURL(url);
  }, [state.markdown]);

  const getFileType = React.useCallback((file: File) => {
    const name = file.name.toLowerCase();
    if (
      name.endsWith(".html") ||
      name.endsWith(".htm") ||
      file.type === "text/html"
    )
      return "html";
    if (name.endsWith(".md") || name.endsWith(".markdown")) return "markdown";
    return "unknown";
  }, []);

  const importFile = React.useCallback(
    async (file: File) => {
      try {
        const fileType = getFileType(file);
        const content = await file.text();
        if (fileType === "html") {
          setParam("markdown", turndownService.turndown(content));
          return;
        }
        if (fileType === "markdown") {
          setParam("markdown", content);
        }
      } catch (error) {
        console.error("File import failed", error);
      }
    },
    [getFileType, setParam, turndownService],
  );

  const handleUpload = React.useCallback(
    async (event: React.ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0];
      if (!file) return;
      await importFile(file);
      event.target.value = "";
    },
    [importFile],
  );

  const handleExportHtml = React.useCallback(() => {
    const content = state.markdown.trim();
    if (!content) return;
    const html = buildHtmlDocument(
      markedParser.parse(content, { async: false }),
    );
    const blob = new Blob([html], { type: "text/html" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = "markdown.html";
    document.body.appendChild(anchor);
    anchor.click();
    document.body.removeChild(anchor);
    URL.revokeObjectURL(url);
  }, [markedParser, state.markdown]);

  const handlePrint = React.useCallback(() => {
    const content = state.markdown.trim();
    if (!content) return;
    const html = buildHtmlDocument(
      markedParser.parse(content, { async: false }),
    );
    const blob = new Blob([html], { type: "text/html" });
    const url = URL.createObjectURL(blob);
    const frame = document.createElement("iframe");
    frame.style.position = "fixed";
    frame.style.right = "0";
    frame.style.bottom = "0";
    frame.style.width = "0";
    frame.style.height = "0";
    frame.style.border = "0";
    frame.style.visibility = "hidden";
    frame.src = url;
    frame.onload = () => {
      const printWindow = frame.contentWindow;
      if (printWindow) {
        printWindow.focus();
        printWindow.print();
      }
      setTimeout(() => {
        URL.revokeObjectURL(url);
        frame.remove();
      }, 1000);
    };
    document.body.appendChild(frame);
  }, [markedParser, state.markdown]);

  const handleDragOver = React.useCallback(
    (event: React.DragEvent<HTMLDivElement>) => {
      if (!event.dataTransfer.types.includes("Files")) return;
      event.preventDefault();
    },
    [],
  );

  const handleDragEnter = React.useCallback(
    (event: React.DragEvent<HTMLDivElement>) => {
      if (!event.dataTransfer.types.includes("Files")) return;
      event.preventDefault();
      setIsDragActive(true);
    },
    [],
  );

  const handleDragLeave = React.useCallback(
    (event: React.DragEvent<HTMLDivElement>) => {
      if (event.currentTarget.contains(event.relatedTarget as Node | null))
        return;
      setIsDragActive(false);
    },
    [],
  );

  const handleDrop = React.useCallback(
    async (event: React.DragEvent<HTMLDivElement>) => {
      if (!event.dataTransfer.types.includes("Files")) return;
      event.preventDefault();
      setIsDragActive(false);
      const file = event.dataTransfer.files?.[0];
      if (!file) return;
      if (getFileType(file) === "unknown") return;
      await importFile(file);
    },
    [getFileType, importFile],
  );

  const handleViewModeChange = React.useCallback(
    (value: "split" | "editor" | "preview") => {
      setParam("viewMode", value, true);
    },
    [setParam],
  );

  const handleLoadHistory = React.useCallback(
    (entry: HistoryEntry) => {
      const { inputs, params } = entry;
      if (inputs.markdown !== undefined) setParam("markdown", inputs.markdown);
      if (params.viewMode)
        setParam(
          "viewMode",
          params.viewMode as "split" | "editor" | "preview",
          true,
        );
    },
    [setParam],
  );

  const previewHtml = React.useMemo(
    () => markedParser.parse(state.markdown || "", { async: false }),
    [markedParser, state.markdown],
  );

  return (
    <ToolPageWrapper
      toolId="markdown-previewer"
      title="Markdown Previewer"
      description="Live Markdown editor with split preview and shareable URL state."
      onLoadHistory={handleLoadHistory}
    >
      <MarkdownPreviewerInner
        state={state}
        setParam={setParam}
        oversizeKeys={oversizeKeys}
        hasUrlParams={hasUrlParams}
        hydrationSource={hydrationSource}
        resolvedTheme={resolvedTheme}
        uploadInputRef={uploadInputRef}
        previewHtml={previewHtml}
        isDragActive={isDragActive}
        handleDragOver={handleDragOver}
        handleDragEnter={handleDragEnter}
        handleDragLeave={handleDragLeave}
        handleDrop={handleDrop}
        handleMarkdownChange={handleMarkdownChange}
        handleDownloadMarkdown={handleDownloadMarkdown}
        handleExportHtml={handleExportHtml}
        handlePrint={handlePrint}
        handleUpload={handleUpload}
        handleViewModeChange={handleViewModeChange}
      />
    </ToolPageWrapper>
  );
}

function MarkdownPreviewerInner({
  state,
  setParam,
  oversizeKeys,
  hasUrlParams,
  hydrationSource,
  resolvedTheme,
  uploadInputRef,
  previewHtml,
  isDragActive,
  handleDragOver,
  handleDragEnter,
  handleDragLeave,
  handleDrop,
  handleMarkdownChange,
  handleDownloadMarkdown,
  handleExportHtml,
  handlePrint,
  handleUpload,
  handleViewModeChange,
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
  resolvedTheme: string | undefined;
  uploadInputRef: React.RefObject<HTMLInputElement | null>;
  previewHtml: string;
  isDragActive: boolean;
  handleDragOver: (event: React.DragEvent<HTMLDivElement>) => void;
  handleDragEnter: (event: React.DragEvent<HTMLDivElement>) => void;
  handleDragLeave: (event: React.DragEvent<HTMLDivElement>) => void;
  handleDrop: (event: React.DragEvent<HTMLDivElement>) => void;
  handleMarkdownChange: (value: string | undefined) => void;
  handleDownloadMarkdown: () => void;
  handleExportHtml: () => void;
  handlePrint: () => void;
  handleUpload: (event: React.ChangeEvent<HTMLInputElement>) => void;
  handleViewModeChange: (value: "split" | "editor" | "preview") => void;
}) {
  const { upsertInputEntry, upsertParams } = useToolHistoryContext();
  const lastInputRef = React.useRef("");
  const hasHydratedInputRef = React.useRef(false);
  const paramsRef = React.useRef({ viewMode: state.viewMode });
  const hasInitializedParamsRef = React.useRef(false);
  const hasHandledUrlRef = React.useRef(false);

  React.useEffect(() => {
    if (hasHydratedInputRef.current) return;
    if (hydrationSource === "default") return;
    lastInputRef.current = state.markdown;
    hasHydratedInputRef.current = true;
  }, [hydrationSource, state.markdown]);

  React.useEffect(() => {
    if (state.markdown === lastInputRef.current) return;

    const timer = setTimeout(() => {
      lastInputRef.current = state.markdown;
      upsertInputEntry(
        { markdown: state.markdown },
        { viewMode: state.viewMode },
        "left",
        state.markdown.slice(0, 120),
      );
    }, DEFAULT_URL_SYNC_DEBOUNCE_MS);

    return () => clearTimeout(timer);
  }, [state.markdown, state.viewMode, upsertInputEntry]);

  React.useEffect(() => {
    if (hasUrlParams && !hasHandledUrlRef.current) {
      hasHandledUrlRef.current = true;
      if (state.markdown) {
        upsertInputEntry(
          { markdown: state.markdown },
          { viewMode: state.viewMode },
          "left",
          state.markdown.slice(0, 120),
        );
      } else {
        upsertParams({ viewMode: state.viewMode }, "interpretation");
      }
    }
  }, [
    hasUrlParams,
    state.markdown,
    state.viewMode,
    upsertInputEntry,
    upsertParams,
  ]);

  React.useEffect(() => {
    const nextParams = { viewMode: state.viewMode };
    if (!hasInitializedParamsRef.current) {
      hasInitializedParamsRef.current = true;
      paramsRef.current = nextParams;
      return;
    }
    if (paramsRef.current.viewMode === nextParams.viewMode) return;
    paramsRef.current = nextParams;
    upsertParams(nextParams, "interpretation");
  }, [state.viewMode, upsertParams]);

  const hasMarkdown = state.markdown.trim().length > 0;
  const showEditor = state.viewMode !== "preview";
  const showPreview = state.viewMode !== "editor";

  return (
    <div className="flex flex-col gap-4">
      <div className="print-background" aria-hidden="true" />
      <div className="flex flex-wrap items-center justify-end gap-2">
        <div className="inline-flex items-center gap-1 rounded-md border bg-background p-1">
          <Button
            type="button"
            variant={state.viewMode === "split" ? "secondary" : "ghost"}
            size="sm"
            className="h-7 px-2"
            onClick={() => handleViewModeChange("split")}
          >
            Split
          </Button>
          <Button
            type="button"
            variant={state.viewMode === "editor" ? "secondary" : "ghost"}
            size="sm"
            className="h-7 px-2"
            onClick={() => handleViewModeChange("editor")}
          >
            Editor
          </Button>
          <Button
            type="button"
            variant={state.viewMode === "preview" ? "secondary" : "ghost"}
            size="sm"
            className="h-7 px-2"
            onClick={() => handleViewModeChange("preview")}
          >
            Preview
          </Button>
        </div>
      </div>

      <div className="flex flex-col gap-4 md:flex-row">
        {showEditor && (
          <div className="flex w-full flex-1 flex-col gap-2 md:w-0">
            <div className="flex h-8 items-center justify-between gap-2">
              <Label className="text-sm font-medium">Markdown</Label>
              <div className="flex items-center gap-2">
                <input
                  ref={uploadInputRef}
                  type="file"
                  accept=".md,.markdown,.html,.htm"
                  className="hidden"
                  onChange={handleUpload}
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-7 px-2"
                  onClick={() => uploadInputRef.current?.click()}
                >
                  <Upload className="mr-1 h-3 w-3" />
                  Upload
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-7 px-2"
                  onClick={handleDownloadMarkdown}
                >
                  <Download className="mr-1 h-3 w-3" />
                  Download
                </Button>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7"
                    >
                      <MoreHorizontal className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onClick={handleExportHtml}>
                      <FileDown className="h-4 w-4" />
                      Export HTML
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      onClick={() =>
                        setParam("markdown", defaultMarkdown, true)
                      }
                    >
                      <RotateCcw className="h-4 w-4" />
                      Reset Sample
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </div>
            <div
              className={cn(
                "relative overflow-hidden rounded-md border transition-colors",
                isDragActive && "border-primary bg-primary/5",
              )}
              onDragOver={handleDragOver}
              onDragEnter={handleDragEnter}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
            >
              <div className="h-[calc(100vh-15rem)] min-h-[300px]">
                <Editor
                  height="100%"
                  language="markdown"
                  theme={resolvedTheme === "dark" ? "vs-dark" : "light"}
                  value={state.markdown}
                  onChange={handleMarkdownChange}
                  options={{
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
              </div>
            </div>
            {oversizeKeys.includes("markdown") && (
              <p className="text-xs text-muted-foreground">
                Markdown exceeds 2 KB and is not synced to URL.
              </p>
            )}
          </div>
        )}

        {showPreview && (
          <div
            className={cn(
              "flex w-full flex-1 flex-col gap-2 md:w-0",
              showEditor ? "" : "md:w-full",
            )}
          >
            <div className="flex h-8 items-center justify-between gap-2">
              <Label className="text-sm font-medium">Preview</Label>
              <div className="flex items-center gap-2">
                <div className="text-xs text-muted-foreground">
                  {hasMarkdown ? "Live" : "Empty"}
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-7 px-2"
                  onClick={handlePrint}
                >
                  <Printer className="mr-1 h-3 w-3" />
                  Print
                </Button>
              </div>
            </div>
            <div className="relative overflow-hidden rounded-lg border bg-background">
              <div className="markdown-preview-print min-h-[300px] h-[calc(100vh-15rem)] overflow-auto p-4">
                {hasMarkdown ? (
                  <div
                    className="markdown-preview text-sm leading-relaxed"
                    dangerouslySetInnerHTML={{ __html: previewHtml }}
                  />
                ) : (
                  <div className="text-sm text-muted-foreground italic">
                    Write Markdown to see the preview here.
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
      <style jsx global>{`
        .markdown-preview h1,
        .markdown-preview h2,
        .markdown-preview h3,
        .markdown-preview h4,
        .markdown-preview h5,
        .markdown-preview h6 {
          font-weight: 600;
          margin: 1.2em 0 0.6em;
        }
        .markdown-preview h1 {
          font-size: 2em;
        }
        .markdown-preview h2 {
          font-size: 1.5em;
        }
        .markdown-preview h3 {
          font-size: 1.25em;
        }
        .markdown-preview h4 {
          font-size: 1.1em;
        }
        .markdown-preview h5 {
          font-size: 1em;
        }
        .markdown-preview h6 {
          font-size: 0.9em;
        }
        .markdown-preview p {
          margin: 0.6em 0;
        }
        .markdown-preview pre {
          background: rgba(148, 163, 184, 0.2);
          padding: 12px;
          overflow-x: auto;
          border-radius: 8px;
        }
        .markdown-preview code {
          font-family:
            ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas,
            "Liberation Mono", "Courier New", monospace;
          background: rgba(148, 163, 184, 0.2);
          padding: 0.2em 0.35em;
          border-radius: 4px;
        }
        .markdown-preview pre code {
          background: transparent;
          padding: 0;
        }
        .markdown-preview blockquote {
          border-left: 3px solid rgba(148, 163, 184, 0.6);
          padding-left: 12px;
          color: rgba(100, 116, 139, 1);
          margin: 0.8em 0;
        }
        .markdown-preview ul,
        .markdown-preview ol {
          padding-left: 24px;
          margin: 0.6em 0;
          list-style-position: outside;
        }
        .markdown-preview ul {
          list-style-type: disc;
        }
        .markdown-preview ol {
          list-style-type: decimal;
        }
        .markdown-preview hr {
          border: none;
          border-top: 1px solid rgba(148, 163, 184, 0.35);
          margin: 1.5em 0;
        }
        .markdown-preview a {
          color: #1d4ed8;
          text-decoration: underline;
          text-underline-offset: 3px;
        }
        .dark .markdown-preview a {
          color: #60a5fa;
        }
        .dark .markdown-preview code {
          background: rgba(148, 163, 184, 0.25);
          color: #e2e8f0;
        }
        .markdown-preview pre code.hljs,
        .markdown-preview code.hljs {
          display: block;
          overflow-x: auto;
          padding: 0;
          background: transparent;
        }
        .markdown-preview .hljs {
          color: #24292e;
          background: transparent;
        }
        .markdown-preview .hljs-doctag,
        .markdown-preview .hljs-keyword,
        .markdown-preview .hljs-meta .hljs-keyword,
        .markdown-preview .hljs-template-tag,
        .markdown-preview .hljs-template-variable,
        .markdown-preview .hljs-type,
        .markdown-preview .hljs-variable.language_ {
          color: #d73a49;
        }
        .markdown-preview .hljs-title,
        .markdown-preview .hljs-title.class_,
        .markdown-preview .hljs-title.class_.inherited__,
        .markdown-preview .hljs-title.function_ {
          color: #6f42c1;
        }
        .markdown-preview .hljs-attr,
        .markdown-preview .hljs-attribute,
        .markdown-preview .hljs-literal,
        .markdown-preview .hljs-meta,
        .markdown-preview .hljs-number,
        .markdown-preview .hljs-operator,
        .markdown-preview .hljs-variable,
        .markdown-preview .hljs-selector-attr,
        .markdown-preview .hljs-selector-class,
        .markdown-preview .hljs-selector-id {
          color: #005cc5;
        }
        .markdown-preview .hljs-regexp,
        .markdown-preview .hljs-string,
        .markdown-preview .hljs-meta .hljs-string {
          color: #032f62;
        }
        .markdown-preview .hljs-built_in,
        .markdown-preview .hljs-symbol {
          color: #e36209;
        }
        .markdown-preview .hljs-comment,
        .markdown-preview .hljs-code,
        .markdown-preview .hljs-formula {
          color: #6a737d;
        }
        .markdown-preview .hljs-name,
        .markdown-preview .hljs-quote,
        .markdown-preview .hljs-selector-tag,
        .markdown-preview .hljs-selector-pseudo {
          color: #22863a;
        }
        .markdown-preview .hljs-subst {
          color: #24292e;
        }
        .markdown-preview .hljs-section {
          color: #005cc5;
          font-weight: bold;
        }
        .markdown-preview .hljs-bullet {
          color: #735c0f;
        }
        .markdown-preview .hljs-emphasis {
          color: #24292e;
          font-style: italic;
        }
        .markdown-preview .hljs-strong {
          color: #24292e;
          font-weight: bold;
        }
        .markdown-preview .hljs-addition {
          color: #22863a;
          background-color: rgba(52, 208, 88, 0.2);
        }
        .markdown-preview .hljs-deletion {
          color: #b31d28;
          background-color: rgba(248, 81, 73, 0.2);
        }
        .dark .markdown-preview .hljs {
          color: #c9d1d9;
        }
        .dark .markdown-preview .hljs-doctag,
        .dark .markdown-preview .hljs-keyword,
        .dark .markdown-preview .hljs-meta .hljs-keyword,
        .dark .markdown-preview .hljs-template-tag,
        .dark .markdown-preview .hljs-template-variable,
        .dark .markdown-preview .hljs-type,
        .dark .markdown-preview .hljs-variable.language_ {
          color: #ff7b72;
        }
        .dark .markdown-preview .hljs-title,
        .dark .markdown-preview .hljs-title.class_,
        .dark .markdown-preview .hljs-title.class_.inherited__,
        .dark .markdown-preview .hljs-title.function_ {
          color: #d2a8ff;
        }
        .dark .markdown-preview .hljs-attr,
        .dark .markdown-preview .hljs-attribute,
        .dark .markdown-preview .hljs-literal,
        .dark .markdown-preview .hljs-meta,
        .dark .markdown-preview .hljs-number,
        .dark .markdown-preview .hljs-operator,
        .dark .markdown-preview .hljs-variable,
        .dark .markdown-preview .hljs-selector-attr,
        .dark .markdown-preview .hljs-selector-class,
        .dark .markdown-preview .hljs-selector-id {
          color: #79c0ff;
        }
        .dark .markdown-preview .hljs-regexp,
        .dark .markdown-preview .hljs-string,
        .dark .markdown-preview .hljs-meta .hljs-string {
          color: #a5d6ff;
        }
        .dark .markdown-preview .hljs-built_in,
        .dark .markdown-preview .hljs-symbol {
          color: #ffa657;
        }
        .dark .markdown-preview .hljs-comment,
        .dark .markdown-preview .hljs-code,
        .dark .markdown-preview .hljs-formula {
          color: #8b949e;
        }
        .dark .markdown-preview .hljs-name,
        .dark .markdown-preview .hljs-quote,
        .dark .markdown-preview .hljs-selector-tag,
        .dark .markdown-preview .hljs-selector-pseudo {
          color: #7ee787;
        }
        .dark .markdown-preview .hljs-subst {
          color: #c9d1d9;
        }
        .dark .markdown-preview .hljs-section {
          color: #1f6feb;
          font-weight: bold;
        }
        .dark .markdown-preview .hljs-bullet {
          color: #f2cc60;
        }
        .dark .markdown-preview .hljs-emphasis {
          color: #c9d1d9;
          font-style: italic;
        }
        .dark .markdown-preview .hljs-strong {
          color: #c9d1d9;
          font-weight: bold;
        }
        .dark .markdown-preview .hljs-addition {
          color: #aff5b4;
          background-color: rgba(46, 160, 67, 0.25);
        }
        .dark .markdown-preview .hljs-deletion {
          color: #ffdcd7;
          background-color: rgba(248, 81, 73, 0.2);
        }
        @media print {
          @page {
            margin: 0;
          }
          :root {
            color-scheme: light;
          }
          html,
          body {
            margin: 0;
            padding: 0;
            background: #ffffff !important;
            print-color-adjust: exact;
            -webkit-print-color-adjust: exact;
          }
          .print-background {
            display: block;
            position: fixed;
            inset: 0;
            background: #ffffff;
            z-index: 0;
          }
          .markdown-preview,
          .markdown-preview * {
            color: #111827 !important;
            border-color: #e5e7eb !important;
          }
          .markdown-preview a {
            color: #1d4ed8 !important;
          }
          .markdown-preview a[href]::after {
            content: " (" attr(href) ")";
            font-size: 0.9em;
            color: #4b5563 !important;
            word-break: break-all;
          }
          .markdown-preview pre {
            background: #f3f4f6 !important;
          }
          .markdown-preview code {
            background: #e5e7eb !important;
            color: #111827 !important;
          }
          .markdown-preview pre code {
            background: transparent !important;
          }
          .markdown-preview blockquote {
            color: #4b5563 !important;
            border-left-color: #d1d5db !important;
          }
          .markdown-preview .hljs {
            color: #24292e !important;
          }
          .markdown-preview .hljs-doctag,
          .markdown-preview .hljs-keyword,
          .markdown-preview .hljs-meta .hljs-keyword,
          .markdown-preview .hljs-template-tag,
          .markdown-preview .hljs-template-variable,
          .markdown-preview .hljs-type,
          .markdown-preview .hljs-variable.language_ {
            color: #d73a49 !important;
          }
          .markdown-preview .hljs-title,
          .markdown-preview .hljs-title.class_,
          .markdown-preview .hljs-title.class_.inherited__,
          .markdown-preview .hljs-title.function_ {
            color: #6f42c1 !important;
          }
          .markdown-preview .hljs-attr,
          .markdown-preview .hljs-attribute,
          .markdown-preview .hljs-literal,
          .markdown-preview .hljs-meta,
          .markdown-preview .hljs-number,
          .markdown-preview .hljs-operator,
          .markdown-preview .hljs-variable,
          .markdown-preview .hljs-selector-attr,
          .markdown-preview .hljs-selector-class,
          .markdown-preview .hljs-selector-id {
            color: #005cc5 !important;
          }
          .markdown-preview .hljs-regexp,
          .markdown-preview .hljs-string,
          .markdown-preview .hljs-meta .hljs-string {
            color: #032f62 !important;
          }
          .markdown-preview .hljs-built_in,
          .markdown-preview .hljs-symbol {
            color: #e36209 !important;
          }
          .markdown-preview .hljs-comment,
          .markdown-preview .hljs-code,
          .markdown-preview .hljs-formula {
            color: #6a737d !important;
          }
          .markdown-preview .hljs-name,
          .markdown-preview .hljs-quote,
          .markdown-preview .hljs-selector-tag,
          .markdown-preview .hljs-selector-pseudo {
            color: #22863a !important;
          }
          .markdown-preview .hljs-subst {
            color: #24292e !important;
          }
          .markdown-preview .hljs-section {
            color: #005cc5 !important;
            font-weight: bold;
          }
          .markdown-preview .hljs-bullet {
            color: #735c0f !important;
          }
          .markdown-preview .hljs-emphasis {
            color: #24292e !important;
            font-style: italic;
          }
          .markdown-preview .hljs-strong {
            color: #24292e !important;
            font-weight: bold;
          }
          .markdown-preview .hljs-addition {
            color: #22863a !important;
            background-color: #f0fff4 !important;
          }
          .markdown-preview .hljs-deletion {
            color: #b31d28 !important;
            background-color: #ffeef0 !important;
          }
          body * {
            visibility: hidden;
          }
          .print-background {
            visibility: visible;
          }
          .markdown-preview-print,
          .markdown-preview-print * {
            visibility: visible;
          }
          .markdown-preview-print {
            position: fixed;
            inset: 0;
            padding: 24px !important;
            border: none !important;
            overflow: visible !important;
            background: white !important;
            z-index: 1;
          }
        }
        .print-background {
          display: none;
        }
      `}</style>
    </div>
  );
}
