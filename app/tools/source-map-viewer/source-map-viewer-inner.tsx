"use client";

import * as React from "react";
import { useToolHistoryContext } from "@/components/tool-ui/tool-page-wrapper";
import { DEFAULT_URL_SYNC_DEBOUNCE_MS } from "@/lib/url-state/use-url-synced-state";
import SourceMapViewerForm from "./source-map-viewer-form";
import type {
  SourceFile,
  SourceMapBundle,
  SourceTreeNode,
} from "./source-map-viewer-types";

type SourceMapViewerInnerProps = {
  bundles: SourceMapBundle[];
  activeSelection: {
    bundle: SourceMapBundle | null;
    file: SourceFile | null;
  };
  activeMapId: string;
  activeSourceId: string;
  setBundles: React.Dispatch<React.SetStateAction<SourceMapBundle[]>>;
  setActiveMapId: React.Dispatch<React.SetStateAction<string>>;
  setActiveSourceId: React.Dispatch<React.SetStateAction<string>>;
  treeNodes: SourceTreeNode[];
  parseErrors: string[];
  downloadError: string | null;
  onFilesUpload: (files: File[]) => void;
  onClear: () => void;
  onSelectFile: (mapId: string, fileId: string) => void;
  onDeleteNode: (node: SourceTreeNode) => void;
  onDownloadFile: () => void;
  onDownloadAll: () => void;
};

export default function SourceMapViewerInner({
  bundles,
  activeSelection,
  activeMapId,
  activeSourceId,
  setBundles,
  setActiveMapId,
  setActiveSourceId,
  treeNodes,
  parseErrors,
  downloadError,
  onFilesUpload,
  onClear,
  onSelectFile,
  onDeleteNode,
  onDownloadFile,
  onDownloadAll,
}: SourceMapViewerInnerProps) {
  const { entries, loading, addHistoryEntry, updateLatestEntry, clearHistory } =
    useToolHistoryContext();
  const paramsRef = React.useRef({
    activeMapId,
    activeSourceId,
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
    if (inputs.maps) {
      try {
        const parsed = JSON.parse(String(inputs.maps)) as SourceMapBundle[];
        setBundles(parsed);
        if (params.activeMapId) setActiveMapId(String(params.activeMapId));
        if (params.activeSourceId)
          setActiveSourceId(String(params.activeSourceId));
      } catch (error) {
        console.error("Failed to restore source maps from history.", error);
      }
    }
  }, [entries, loading, setActiveMapId, setActiveSourceId, setBundles]);

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
    const previewText =
      activeSelection.file?.path ??
      activeSelection.bundle?.name ??
      (bundles.length ? `${bundles.length} maps` : "Source maps");
    const inputs = { maps: JSON.stringify(bundles) };
    const params = {
      activeMapId,
      activeSourceId,
    };
    if (!hasHistoryRef.current) {
      const entry = await addHistoryEntry(inputs, params, "left", previewText);
      if (entry) hasHistoryRef.current = true;
      return;
    }
    await updateLatestEntry({
      inputs,
      params,
      preview: previewText,
      hasInput: true,
    });
  }, [
    activeMapId,
    activeSelection.bundle?.name,
    activeSelection.file?.path,
    activeSourceId,
    addHistoryEntry,
    bundles,
    updateLatestEntry,
  ]);

  React.useEffect(() => {
    const timer = setTimeout(() => {
      void updateHistoryEntry();
    }, DEFAULT_URL_SYNC_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [updateHistoryEntry, bundles]);

  React.useEffect(() => {
    const nextParams = {
      activeMapId,
      activeSourceId,
    };
    if (!hasInitializedParamsRef.current) {
      hasInitializedParamsRef.current = true;
      paramsRef.current = nextParams;
      return;
    }
    if (
      paramsRef.current.activeMapId === nextParams.activeMapId &&
      paramsRef.current.activeSourceId === nextParams.activeSourceId
    ) {
      return;
    }
    paramsRef.current = nextParams;
    void updateHistoryEntry();
  }, [activeMapId, activeSourceId, updateHistoryEntry]);

  return (
    <SourceMapViewerForm
      bundles={bundles}
      treeNodes={treeNodes}
      activeBundle={activeSelection.bundle}
      activeFile={activeSelection.file}
      parseErrors={parseErrors}
      downloadError={downloadError}
      onFilesUpload={onFilesUpload}
      onClear={onClear}
      onSelectFile={onSelectFile}
      onDeleteNode={onDeleteNode}
      onDownloadFile={onDownloadFile}
      onDownloadAll={onDownloadAll}
    />
  );
}
