"use client";

import * as React from "react";
import { Suspense } from "react";
import { z } from "zod";
import JSZip from "jszip";
import { PDFDocument } from "pdf-lib";
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
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Upload, Download, Trash2, ArrowUp, ArrowDown } from "lucide-react";
import type { HistoryEntry } from "@/lib/history/db";
import { cn } from "@/lib/utils";

const paramsSchema = z.object({
  mode: z.enum(["merge", "split", "reorder"]).default("merge"),
  mergeFileNames: z.string().default(""),
  splitFileName: z.string().default(""),
  reorderFileName: z.string().default(""),
  splitRanges: z.string().default(""),
  reorderPages: z.string().default(""),
});

type PdfEntry = {
  id: string;
  file: File;
  name: string;
  size: number;
  pageCount: number;
  buffer: ArrayBuffer;
};

type OutputState = {
  status: "success" | "error";
  message: string;
  downloadUrl?: string;
  downloadName?: string;
};

function generateId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

function fileBaseName(name: string) {
  const index = name.lastIndexOf(".");
  if (index === -1) return name;
  return name.slice(0, index);
}

function parseRangeSpec(input: string, max: number) {
  const cleaned = input.replace(/\s+/g, "");
  if (!cleaned) return { ranges: [], pages: [] as number[] };

  const ranges: number[][] = [];
  const pages: number[] = [];
  const seen = new Set<number>();

  for (const token of cleaned.split(",").filter(Boolean)) {
    const rangeMatch = token.split("-");
    if (rangeMatch.length === 2) {
      const start = Number.parseInt(rangeMatch[0], 10);
      const end = Number.parseInt(rangeMatch[1], 10);
      if (!Number.isFinite(start) || !Number.isFinite(end)) {
        return { error: `Invalid range: ${token}` };
      }
      const min = Math.min(start, end);
      const maxRange = Math.max(start, end);
      if (min < 1 || maxRange > max) {
        return { error: `Range out of bounds: ${token}` };
      }
      const rangePages: number[] = [];
      for (let page = min; page <= maxRange; page++) {
        if (seen.has(page)) {
          return { error: `Duplicate page: ${page}` };
        }
        seen.add(page);
        rangePages.push(page);
        pages.push(page);
      }
      ranges.push(rangePages);
    } else if (rangeMatch.length === 1) {
      const page = Number.parseInt(token, 10);
      if (!Number.isFinite(page)) {
        return { error: `Invalid page: ${token}` };
      }
      if (page < 1 || page > max) {
        return { error: `Page out of bounds: ${page}` };
      }
      if (seen.has(page)) {
        return { error: `Duplicate page: ${page}` };
      }
      seen.add(page);
      pages.push(page);
      ranges.push([page]);
    } else {
      return { error: `Invalid range: ${token}` };
    }
  }

  return { ranges, pages };
}

export default function PdfToolPage() {
  return (
    <Suspense fallback={null}>
      <PdfToolContent />
    </Suspense>
  );
}

function PdfToolContent() {
  const { state, setParam, oversizeKeys, hasUrlParams, hydrationSource } =
    useUrlSyncedState("pdf-tool", {
      schema: paramsSchema,
      defaults: paramsSchema.parse({}),
      restoreMissingKeys: (key) =>
        key === "mergeFileNames" ||
        key === "splitFileName" ||
        key === "reorderFileName" ||
        key === "splitRanges" ||
        key === "reorderPages",
    });

  const handleLoadHistory = React.useCallback(
    (entry: HistoryEntry) => {
      const { inputs, params } = entry;
      if (inputs.mergeFileNames !== undefined)
        setParam("mergeFileNames", inputs.mergeFileNames);
      if (inputs.splitFileName !== undefined)
        setParam("splitFileName", inputs.splitFileName);
      if (inputs.reorderFileName !== undefined)
        setParam("reorderFileName", inputs.reorderFileName);
      if (params.mode)
        setParam("mode", params.mode as z.infer<typeof paramsSchema>["mode"]);
      if (params.splitRanges !== undefined)
        setParam("splitRanges", params.splitRanges as string);
      if (params.reorderPages !== undefined)
        setParam("reorderPages", params.reorderPages as string);
    },
    [setParam],
  );

  return (
    <ToolPageWrapper
      toolId="pdf-tool"
      title="PDF Tool"
      description="Merge, split, and reorder PDF files directly in your browser"
      onLoadHistory={handleLoadHistory}
    >
      <PdfToolInner
        state={state}
        setParam={setParam}
        oversizeKeys={oversizeKeys}
        hasUrlParams={hasUrlParams}
        hydrationSource={hydrationSource}
      />
    </ToolPageWrapper>
  );
}

function PdfToolInner({
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
  const [mergeFiles, setMergeFiles] = React.useState<PdfEntry[]>([]);
  const [splitFile, setSplitFile] = React.useState<PdfEntry | null>(null);
  const [reorderFile, setReorderFile] = React.useState<PdfEntry | null>(null);
  const [output, setOutput] = React.useState<OutputState | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [isWorking, setIsWorking] = React.useState(false);
  const outputUrlRef = React.useRef<string | null>(null);
  const mergeInputRef = React.useRef<HTMLInputElement>(null);
  const splitInputRef = React.useRef<HTMLInputElement>(null);
  const reorderInputRef = React.useRef<HTMLInputElement>(null);
  const lastInputRef = React.useRef<string>("");
  const hasHydratedInputRef = React.useRef(false);
  const paramsRef = React.useRef({
    mode: state.mode,
    splitRanges: state.splitRanges,
    reorderPages: state.reorderPages,
  });
  const hasInitializedParamsRef = React.useRef(false);
  const hasHandledUrlRef = React.useRef(false);

  const revokeOutputUrl = React.useCallback(() => {
    if (outputUrlRef.current) {
      URL.revokeObjectURL(outputUrlRef.current);
      outputUrlRef.current = null;
    }
  }, []);

  React.useEffect(() => {
    return () => revokeOutputUrl();
  }, [revokeOutputUrl]);

  React.useEffect(() => {
    if (hasHydratedInputRef.current) return;
    if (hydrationSource === "default") return;
    lastInputRef.current = JSON.stringify({
      mergeFileNames: state.mergeFileNames,
      splitFileName: state.splitFileName,
      reorderFileName: state.reorderFileName,
      splitRanges: state.splitRanges,
      reorderPages: state.reorderPages,
      mode: state.mode,
    });
    hasHydratedInputRef.current = true;
  }, [
    hydrationSource,
    state.mergeFileNames,
    state.splitFileName,
    state.reorderFileName,
    state.splitRanges,
    state.reorderPages,
    state.mode,
  ]);

  React.useEffect(() => {
    const snapshot = JSON.stringify({
      mergeFileNames: state.mergeFileNames,
      splitFileName: state.splitFileName,
      reorderFileName: state.reorderFileName,
      splitRanges: state.splitRanges,
      reorderPages: state.reorderPages,
      mode: state.mode,
    });
    if (snapshot === lastInputRef.current) return;

    const timer = setTimeout(() => {
      lastInputRef.current = snapshot;
      upsertInputEntry(
        {
          mergeFileNames: state.mergeFileNames,
          splitFileName: state.splitFileName,
          reorderFileName: state.reorderFileName,
        },
        {
          mode: state.mode,
          splitRanges: state.splitRanges,
          reorderPages: state.reorderPages,
        },
        "left",
        state.mergeFileNames || state.splitFileName || state.reorderFileName,
      );
    }, DEFAULT_URL_SYNC_DEBOUNCE_MS);

    return () => clearTimeout(timer);
  }, [
    state.mergeFileNames,
    state.splitFileName,
    state.reorderFileName,
    state.splitRanges,
    state.reorderPages,
    state.mode,
    upsertInputEntry,
  ]);

  React.useEffect(() => {
    if (hasUrlParams && !hasHandledUrlRef.current) {
      hasHandledUrlRef.current = true;
      if (
        state.mergeFileNames ||
        state.splitFileName ||
        state.reorderFileName
      ) {
        upsertInputEntry(
          {
            mergeFileNames: state.mergeFileNames,
            splitFileName: state.splitFileName,
            reorderFileName: state.reorderFileName,
          },
          {
            mode: state.mode,
            splitRanges: state.splitRanges,
            reorderPages: state.reorderPages,
          },
          "left",
          state.mergeFileNames || state.splitFileName || state.reorderFileName,
        );
      } else {
        upsertParams(
          {
            mode: state.mode,
            splitRanges: state.splitRanges,
            reorderPages: state.reorderPages,
          },
          "interpretation",
        );
      }
    }
  }, [
    hasUrlParams,
    state.mergeFileNames,
    state.splitFileName,
    state.reorderFileName,
    state.splitRanges,
    state.reorderPages,
    state.mode,
    upsertInputEntry,
    upsertParams,
  ]);

  React.useEffect(() => {
    const nextParams = {
      mode: state.mode,
      splitRanges: state.splitRanges,
      reorderPages: state.reorderPages,
    };
    if (!hasInitializedParamsRef.current) {
      hasInitializedParamsRef.current = true;
      paramsRef.current = nextParams;
      return;
    }
    if (JSON.stringify(paramsRef.current) === JSON.stringify(nextParams)) {
      return;
    }
    paramsRef.current = nextParams;
    upsertParams(nextParams, "interpretation");
  }, [state.mode, state.splitRanges, state.reorderPages, upsertParams]);

  const loadPdfEntry = async (file: File): Promise<PdfEntry> => {
    const buffer = await file.arrayBuffer();
    const doc = await PDFDocument.load(buffer);
    return {
      id: generateId(),
      file,
      name: file.name,
      size: file.size,
      pageCount: doc.getPageCount(),
      buffer,
    };
  };

  const handleMergeSelect = async (files: FileList | null) => {
    if (!files?.length) return;
    setError(null);
    setOutput(null);
    revokeOutputUrl();

    try {
      const entries = await Promise.all(
        Array.from(files).map((file) => loadPdfEntry(file)),
      );
      const combined = [...mergeFiles, ...entries];
      setMergeFiles(combined);
      setParam(
        "mergeFileNames",
        combined.map((entry) => entry.name).join(", "),
        true,
      );
    } catch (err) {
      console.error("Failed to load PDFs", err);
      setError(err instanceof Error ? err.message : "Failed to load PDFs");
    }
  };

  const handleSplitSelect = async (file: File | null) => {
    if (!file) return;
    setError(null);
    setOutput(null);
    revokeOutputUrl();

    try {
      const entry = await loadPdfEntry(file);
      setSplitFile(entry);
      setParam("splitFileName", entry.name, true);
    } catch (err) {
      console.error("Failed to load PDF", err);
      setError(err instanceof Error ? err.message : "Failed to load PDF");
    }
  };

  const handleReorderSelect = async (file: File | null) => {
    if (!file) return;
    setError(null);
    setOutput(null);
    revokeOutputUrl();

    try {
      const entry = await loadPdfEntry(file);
      setReorderFile(entry);
      setParam("reorderFileName", entry.name, true);
    } catch (err) {
      console.error("Failed to load PDF", err);
      setError(err instanceof Error ? err.message : "Failed to load PDF");
    }
  };

  const moveMergeItem = (index: number, direction: number) => {
    const next = [...mergeFiles];
    const target = index + direction;
    if (target < 0 || target >= next.length) return;
    const [item] = next.splice(index, 1);
    next.splice(target, 0, item);
    setMergeFiles(next);
    setParam(
      "mergeFileNames",
      next.map((entry) => entry.name).join(", "),
      true,
    );
  };

  const removeMergeItem = (index: number) => {
    const next = [...mergeFiles];
    next.splice(index, 1);
    setMergeFiles(next);
    setParam(
      "mergeFileNames",
      next.map((entry) => entry.name).join(", "),
      true,
    );
  };

  const handleMerge = async () => {
    if (mergeFiles.length < 2) {
      setError("Add at least two PDFs to merge.");
      return;
    }
    setIsWorking(true);
    setError(null);
    setOutput(null);
    revokeOutputUrl();

    try {
      const merged = await PDFDocument.create();
      for (const entry of mergeFiles) {
        const src = await PDFDocument.load(entry.buffer);
        const pages = await merged.copyPages(src, src.getPageIndices());
        pages.forEach((page) => merged.addPage(page));
      }
      const bytes = await merged.save();
      const blob = new Blob([bytes], { type: "application/pdf" });
      const url = URL.createObjectURL(blob);
      outputUrlRef.current = url;
      setOutput({
        status: "success",
        message: `Merged ${mergeFiles.length} PDFs`,
        downloadUrl: url,
        downloadName: "merged.pdf",
      });
    } catch (err) {
      console.error("PDF merge failed", err);
      setError(err instanceof Error ? err.message : "Merge failed");
    } finally {
      setIsWorking(false);
    }
  };

  const handleSplit = async () => {
    if (!splitFile) {
      setError("Select a PDF to split.");
      return;
    }
    setIsWorking(true);
    setError(null);
    setOutput(null);
    revokeOutputUrl();

    try {
      const source = await PDFDocument.load(splitFile.buffer);
      const pageCount = source.getPageCount();
      const parsed = parseRangeSpec(state.splitRanges, pageCount);
      if (parsed.error) {
        setError(parsed.error);
        setIsWorking(false);
        return;
      }

      const ranges = parsed.ranges.length
        ? parsed.ranges
        : Array.from({ length: pageCount }, (_, idx) => [idx + 1]);

      if (ranges.length === 1) {
        const doc = await PDFDocument.create();
        const pages = await doc.copyPages(
          source,
          ranges[0].map((page) => page - 1),
        );
        pages.forEach((page) => doc.addPage(page));
        const bytes = await doc.save();
        const blob = new Blob([bytes], { type: "application/pdf" });
        const url = URL.createObjectURL(blob);
        outputUrlRef.current = url;
        setOutput({
          status: "success",
          message: "Split PDF ready",
          downloadUrl: url,
          downloadName: `${fileBaseName(splitFile.name)}-split.pdf`,
        });
      } else {
        const zip = new JSZip();
        for (let i = 0; i < ranges.length; i++) {
          const doc = await PDFDocument.create();
          const pages = await doc.copyPages(
            source,
            ranges[i].map((page) => page - 1),
          );
          pages.forEach((page) => doc.addPage(page));
          const bytes = await doc.save();
          const name = `${fileBaseName(splitFile.name)}-part-${i + 1}.pdf`;
          zip.file(name, bytes);
        }
        const blob = await zip.generateAsync({ type: "blob" });
        const url = URL.createObjectURL(blob);
        outputUrlRef.current = url;
        setOutput({
          status: "success",
          message: `Split into ${ranges.length} PDFs`,
          downloadUrl: url,
          downloadName: `${fileBaseName(splitFile.name)}-split.zip`,
        });
      }
    } catch (err) {
      console.error("PDF split failed", err);
      setError(err instanceof Error ? err.message : "Split failed");
    } finally {
      setIsWorking(false);
    }
  };

  const handleReorder = async () => {
    if (!reorderFile) {
      setError("Select a PDF to reorder.");
      return;
    }
    setIsWorking(true);
    setError(null);
    setOutput(null);
    revokeOutputUrl();

    try {
      const source = await PDFDocument.load(reorderFile.buffer);
      const pageCount = source.getPageCount();
      const parsed = parseRangeSpec(state.reorderPages, pageCount);
      if (parsed.error) {
        setError(parsed.error);
        setIsWorking(false);
        return;
      }

      const order = parsed.pages.length
        ? parsed.pages
        : Array.from({ length: pageCount }, (_, idx) => idx + 1);

      const doc = await PDFDocument.create();
      const pages = await doc.copyPages(
        source,
        order.map((page) => page - 1),
      );
      pages.forEach((page) => doc.addPage(page));
      const bytes = await doc.save();
      const blob = new Blob([bytes], { type: "application/pdf" });
      const url = URL.createObjectURL(blob);
      outputUrlRef.current = url;
      setOutput({
        status: "success",
        message: "Reordered PDF ready",
        downloadUrl: url,
        downloadName: `${fileBaseName(reorderFile.name)}-reordered.pdf`,
      });
    } catch (err) {
      console.error("PDF reorder failed", err);
      setError(err instanceof Error ? err.message : "Reorder failed");
    } finally {
      setIsWorking(false);
    }
  };

  const clearMerge = () => {
    setMergeFiles([]);
    setParam("mergeFileNames", "", true);
  };

  const clearSplit = () => {
    setSplitFile(null);
    setParam("splitFileName", "", true);
  };

  const clearReorder = () => {
    setReorderFile(null);
    setParam("reorderFileName", "", true);
  };

  const showOversizeWarning = oversizeKeys.some((key) =>
    ["splitRanges", "reorderPages"].includes(String(key)),
  );

  return (
    <div className="flex flex-col gap-4">
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
              <TabsTrigger value="merge">Merge</TabsTrigger>
              <TabsTrigger value="split">Split</TabsTrigger>
              <TabsTrigger value="reorder">Reorder</TabsTrigger>
            </TabsList>

            <TabsContent value="merge" className="mt-4 space-y-4">
              <div className="flex flex-wrap items-center gap-3">
                <input
                  ref={mergeInputRef}
                  type="file"
                  accept="application/pdf"
                  multiple
                  className="hidden"
                  onChange={(e) => {
                    void handleMergeSelect(e.target.files);
                    e.target.value = "";
                  }}
                />
                <Button
                  variant="secondary"
                  onClick={() => mergeInputRef.current?.click()}
                >
                  <Upload className="mr-2 h-4 w-4" />
                  Add PDFs
                </Button>
                {mergeFiles.length > 0 && (
                  <Button variant="ghost" size="sm" onClick={clearMerge}>
                    <Trash2 className="mr-2 h-4 w-4" />
                    Clear
                  </Button>
                )}
              </div>

              {mergeFiles.length ? (
                <div className="space-y-2">
                  {mergeFiles.map((entry, index) => (
                    <div
                      key={entry.id}
                      className="flex flex-wrap items-center justify-between gap-2 rounded-md border p-2 text-sm"
                    >
                      <div>
                        <div className="font-medium text-foreground">
                          {entry.name}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {entry.pageCount} pages
                        </div>
                      </div>
                      <div className="flex items-center gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => moveMergeItem(index, -1)}
                          disabled={index === 0}
                        >
                          <ArrowUp className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => moveMergeItem(index, 1)}
                          disabled={index === mergeFiles.length - 1}
                        >
                          <ArrowDown className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => removeMergeItem(index)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">
                  Add at least two PDF files to merge.
                </p>
              )}

              <Button
                onClick={handleMerge}
                disabled={isWorking || mergeFiles.length < 2}
                className="gap-2"
              >
                <Download
                  className={cn("h-4 w-4", isWorking && "animate-spin")}
                />
                Merge PDFs
              </Button>
            </TabsContent>

            <TabsContent value="split" className="mt-4 space-y-4">
              <div className="flex flex-wrap items-center gap-3">
                <input
                  ref={splitInputRef}
                  type="file"
                  accept="application/pdf"
                  className="hidden"
                  onChange={(e) => {
                    void handleSplitSelect(e.target.files?.[0] ?? null);
                    e.target.value = "";
                  }}
                />
                <Button
                  variant="secondary"
                  onClick={() => splitInputRef.current?.click()}
                >
                  <Upload className="mr-2 h-4 w-4" />
                  Select PDF
                </Button>
                {splitFile && (
                  <Button variant="ghost" size="sm" onClick={clearSplit}>
                    <Trash2 className="mr-2 h-4 w-4" />
                    Clear
                  </Button>
                )}
              </div>

              {splitFile && (
                <div className="text-sm text-muted-foreground">
                  {splitFile.name} - {splitFile.pageCount} pages
                </div>
              )}

              <div className="space-y-2">
                <Label className="text-sm">Page Ranges (optional)</Label>
                <Input
                  value={state.splitRanges}
                  onChange={(e) =>
                    setParam("splitRanges", e.target.value, true)
                  }
                  placeholder="1-3,5,8-10"
                />
                <p className="text-xs text-muted-foreground">
                  Leave empty to split every page into its own PDF.
                </p>
              </div>

              <Button
                onClick={handleSplit}
                disabled={isWorking || !splitFile}
                className="gap-2"
              >
                <Download
                  className={cn("h-4 w-4", isWorking && "animate-spin")}
                />
                Split PDF
              </Button>
            </TabsContent>

            <TabsContent value="reorder" className="mt-4 space-y-4">
              <div className="flex flex-wrap items-center gap-3">
                <input
                  ref={reorderInputRef}
                  type="file"
                  accept="application/pdf"
                  className="hidden"
                  onChange={(e) => {
                    void handleReorderSelect(e.target.files?.[0] ?? null);
                    e.target.value = "";
                  }}
                />
                <Button
                  variant="secondary"
                  onClick={() => reorderInputRef.current?.click()}
                >
                  <Upload className="mr-2 h-4 w-4" />
                  Select PDF
                </Button>
                {reorderFile && (
                  <Button variant="ghost" size="sm" onClick={clearReorder}>
                    <Trash2 className="mr-2 h-4 w-4" />
                    Clear
                  </Button>
                )}
              </div>

              {reorderFile && (
                <div className="text-sm text-muted-foreground">
                  {reorderFile.name} - {reorderFile.pageCount} pages
                </div>
              )}

              <div className="space-y-2">
                <Label className="text-sm">Page Order</Label>
                <Input
                  value={state.reorderPages}
                  onChange={(e) =>
                    setParam("reorderPages", e.target.value, true)
                  }
                  placeholder="3,1,2,4-6"
                />
                <p className="text-xs text-muted-foreground">
                  Provide the new page order. Leave empty to keep original
                  order.
                </p>
              </div>

              <Button
                onClick={handleReorder}
                disabled={isWorking || !reorderFile}
                className="gap-2"
              >
                <Download
                  className={cn("h-4 w-4", isWorking && "animate-spin")}
                />
                Reorder PDF
              </Button>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>

      {error && <p className="text-xs text-destructive">{error}</p>}

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
                <a href={output.downloadUrl} download={output.downloadName}>
                  <Download className="mr-2 h-4 w-4" />
                  Download
                </a>
              </Button>
            )}
          </div>
        </div>
      )}

      {showOversizeWarning && (
        <p className="text-xs text-muted-foreground">
          Some inputs exceed 2 KB and are not synced to the URL.
        </p>
      )}
    </div>
  );
}
