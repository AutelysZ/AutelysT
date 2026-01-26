"use client";

import * as React from "react";
import { useToolHistoryContext } from "@/components/tool-ui/tool-page-wrapper";
import { DEFAULT_URL_SYNC_DEBOUNCE_MS } from "@/lib/url-state/use-url-synced-state";
import CodeFormatterForm from "./code-formatter-form";
import type { FormatterFile, ParamsState } from "./code-formatter-types";
import type { SourceTreeNode } from "../source-map-viewer/source-map-viewer-types";

type CodeFormatterInnerProps = {
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

export default function CodeFormatterInner({
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
}: CodeFormatterInnerProps) {
  const { entries, loading, addHistoryEntry, updateLatestEntry, clearHistory } =
    useToolHistoryContext();
  const paramsRef = React.useRef({
    activeFileId: state.activeFileId,
    printWidth: state.printWidth,
    tabWidth: state.tabWidth,
    useTabs: state.useTabs,
    semi: state.semi,
    singleQuote: state.singleQuote,
    trailingComma: state.trailingComma,
    bracketSpacing: state.bracketSpacing,
    arrowParens: state.arrowParens,
    endOfLine: state.endOfLine,
  });
  const hasInitializedParamsRef = React.useRef(false);
  const hasHistoryRef = React.useRef(false);
  const hasHydratedFromHistoryRef = React.useRef(false);

  React.useEffect(() => {
    if (loading) return;
    if (entries.length > 0) {
      hasHistoryRef.current = true;
    }
  }, [entries.length, loading]);

  React.useEffect(() => {
    if (loading || hasHydratedFromHistoryRef.current) return;
    hasHydratedFromHistoryRef.current = true;
    const latest = entries[0];
    if (!latest) return;
    const { inputs, params } = latest;
    if (inputs.files !== undefined) {
      setParam("files", String(inputs.files));
    }
    if (params.activeFileId) {
      setParam("activeFileId", String(params.activeFileId));
    }
    if (params.printWidth !== undefined) {
      setParam("printWidth", Number(params.printWidth));
    }
    if (params.tabWidth !== undefined) {
      setParam("tabWidth", Number(params.tabWidth));
    }
    if (params.useTabs !== undefined) {
      setParam("useTabs", Boolean(params.useTabs));
    }
    if (params.semi !== undefined) {
      setParam("semi", Boolean(params.semi));
    }
    if (params.singleQuote !== undefined) {
      setParam("singleQuote", Boolean(params.singleQuote));
    }
    if (params.trailingComma) {
      setParam(
        "trailingComma",
        String(params.trailingComma) as ParamsState["trailingComma"],
      );
    }
    if (params.bracketSpacing !== undefined) {
      setParam("bracketSpacing", Boolean(params.bracketSpacing));
    }
    if (params.arrowParens) {
      setParam(
        "arrowParens",
        String(params.arrowParens) as ParamsState["arrowParens"],
      );
    }
    if (params.endOfLine) {
      setParam(
        "endOfLine",
        String(params.endOfLine) as ParamsState["endOfLine"],
      );
    }
  }, [entries, loading, setParam]);

  React.useEffect(() => {
    if (loading) return;
    if (entries.length <= 1) return;
    const latest = entries[0];
    void clearHistory("tool").then(() => {
      void addHistoryEntry(
        latest.inputs,
        latest.params,
        latest.inputSide,
        latest.preview,
        latest.files,
      );
    });
  }, [addHistoryEntry, clearHistory, entries, loading]);

  const updateHistoryEntry = React.useCallback(async () => {
    const label =
      activeFile?.path || (files.length ? `${files.length} files` : "Empty");
    const inputs = { files: state.files };
    const params = {
      activeFileId: state.activeFileId,
      printWidth: state.printWidth,
      tabWidth: state.tabWidth,
      useTabs: state.useTabs,
      semi: state.semi,
      singleQuote: state.singleQuote,
      trailingComma: state.trailingComma,
      bracketSpacing: state.bracketSpacing,
      arrowParens: state.arrowParens,
      endOfLine: state.endOfLine,
    };
    if (!hasHistoryRef.current) {
      const entry = await addHistoryEntry(inputs, params, "left", label);
      if (entry) hasHistoryRef.current = true;
      return;
    }
    await updateLatestEntry({
      inputs,
      params,
      preview: label,
      hasInput: true,
    });
  }, [
    activeFile?.path,
    addHistoryEntry,
    files.length,
    state.files,
    state.activeFileId,
    state.printWidth,
    state.tabWidth,
    state.useTabs,
    state.semi,
    state.singleQuote,
    state.trailingComma,
    state.bracketSpacing,
    state.arrowParens,
    state.endOfLine,
    updateLatestEntry,
  ]);

  React.useEffect(() => {
    const timer = setTimeout(() => {
      void updateHistoryEntry();
    }, DEFAULT_URL_SYNC_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [updateHistoryEntry, state.files]);

  React.useEffect(() => {
    const nextParams = {
      activeFileId: state.activeFileId,
      printWidth: state.printWidth,
      tabWidth: state.tabWidth,
      useTabs: state.useTabs,
      semi: state.semi,
      singleQuote: state.singleQuote,
      trailingComma: state.trailingComma,
      bracketSpacing: state.bracketSpacing,
      arrowParens: state.arrowParens,
      endOfLine: state.endOfLine,
    };
    if (!hasInitializedParamsRef.current) {
      hasInitializedParamsRef.current = true;
      paramsRef.current = nextParams;
      return;
    }
    if (
      paramsRef.current.activeFileId === nextParams.activeFileId &&
      paramsRef.current.printWidth === nextParams.printWidth &&
      paramsRef.current.tabWidth === nextParams.tabWidth &&
      paramsRef.current.useTabs === nextParams.useTabs &&
      paramsRef.current.semi === nextParams.semi &&
      paramsRef.current.singleQuote === nextParams.singleQuote &&
      paramsRef.current.trailingComma === nextParams.trailingComma &&
      paramsRef.current.bracketSpacing === nextParams.bracketSpacing &&
      paramsRef.current.arrowParens === nextParams.arrowParens &&
      paramsRef.current.endOfLine === nextParams.endOfLine
    ) {
      return;
    }
    paramsRef.current = nextParams;
    void updateLatestEntry({
      params: nextParams,
    });
  }, [
    state.activeFileId,
    state.printWidth,
    state.tabWidth,
    state.useTabs,
    state.semi,
    state.singleQuote,
    state.trailingComma,
    state.bracketSpacing,
    state.arrowParens,
    state.endOfLine,
    updateLatestEntry,
  ]);

  return (
    <CodeFormatterForm
      state={state}
      setParam={setParam}
      files={files}
      treeNodes={treeNodes}
      activeFile={activeFile}
      parseError={parseError}
      formatErrors={formatErrors}
      activeFileError={activeFileError}
      downloadError={downloadError}
      showFileTree={showFileTree}
      isFormatting={isFormatting}
      onFilesUpload={onFilesUpload}
      onCreateFile={onCreateFile}
      onSelectFile={onSelectFile}
      onEditorChange={onEditorChange}
      onRenameActiveFile={onRenameActiveFile}
      onDeleteNode={onDeleteNode}
      onFormatActive={onFormatActive}
      onFormatAll={onFormatAll}
      onDownloadFile={onDownloadFile}
      onDownloadAll={onDownloadAll}
      onClear={onClear}
    />
  );
}
