"use client";

import * as React from "react";
import { ToolPageWrapper } from "@/components/tool-ui/tool-page-wrapper";
import SourceMapViewerInner from "./source-map-viewer-inner";
import type {
  SourceFile,
  SourceMapBundle,
  SourceTreeNode,
} from "./source-map-viewer-types";
import {
  buildSourceTree,
  downloadSourceFile,
  downloadSourceMapZip,
  parseSourceMapsFromFiles,
} from "./source-map-viewer-utils";

type ActiveSelection = {
  bundle: SourceMapBundle | null;
  file: SourceFile | null;
};

function resolveActiveSelection(
  bundles: SourceMapBundle[],
  activeMapId: string,
  activeSourceId: string,
): ActiveSelection {
  const selectedBundle =
    bundles.find((bundle) => bundle.id === activeMapId) ?? null;
  const selectedFile =
    selectedBundle?.sources.find((source) => source.id === activeSourceId) ??
    null;

  if (selectedBundle && selectedFile) {
    return { bundle: selectedBundle, file: selectedFile };
  }

  const fallbackBundle = bundles[0] ?? null;
  const fallbackFile = fallbackBundle?.sources[0] ?? null;

  return { bundle: fallbackBundle, file: fallbackFile };
}

export default function SourceMapViewerContent() {
  const [bundles, setBundles] = React.useState<SourceMapBundle[]>([]);
  const [activeMapId, setActiveMapId] = React.useState("");
  const [activeSourceId, setActiveSourceId] = React.useState("");
  const [parseErrors, setParseErrors] = React.useState<string[]>([]);
  const [downloadError, setDownloadError] = React.useState<string | null>(null);

  const activeSelection = React.useMemo(
    () => resolveActiveSelection(bundles, activeMapId, activeSourceId),
    [bundles, activeMapId, activeSourceId],
  );

  const treeNodes = React.useMemo(() => buildSourceTree(bundles), [bundles]);

  React.useEffect(() => {
    if (bundles.length === 0) {
      if (activeMapId || activeSourceId) {
        setActiveMapId("");
        setActiveSourceId("");
      }
      return;
    }

    if (!activeSelection.bundle || !activeSelection.file) {
      const fallbackBundle = bundles[0];
      const fallbackFile = fallbackBundle.sources[0];
      setActiveMapId(fallbackBundle.id);
      setActiveSourceId(fallbackFile.id);
    }
  }, [
    bundles,
    activeSelection.bundle,
    activeSelection.file,
    activeMapId,
    activeSourceId,
  ]);

  const handleFilesUpload = React.useCallback(async (files: File[]) => {
    setDownloadError(null);
    setParseErrors([]);

    const { bundles: nextBundles, errors } =
      await parseSourceMapsFromFiles(files);
    if (errors.length) {
      setParseErrors(errors);
    }
    if (nextBundles.length) {
      setBundles((prev) => {
        const merged = [...prev];
        const indexByName = new Map<string, number>();
        merged.forEach((bundle, index) => {
          indexByName.set(bundle.name, index);
        });

        for (const bundle of nextBundles) {
          const existingIndex = indexByName.get(bundle.name);
          if (existingIndex !== undefined) {
            merged[existingIndex] = bundle;
          } else {
            merged.push(bundle);
            indexByName.set(bundle.name, merged.length - 1);
          }
        }

        return merged;
      });
    }
  }, []);

  const handleClear = React.useCallback(() => {
    setBundles([]);
    setParseErrors([]);
    setDownloadError(null);
    setActiveMapId("");
    setActiveSourceId("");
  }, []);

  const handleSelectFile = React.useCallback(
    (mapId: string, fileId: string) => {
      setActiveMapId(mapId);
      setActiveSourceId(fileId);
    },
    [],
  );

  const handleDownloadFile = React.useCallback(() => {
    const file = activeSelection.file;
    if (!file || file.content === null) return;

    const fileName = file.path.split("/").pop() || "source";
    downloadSourceFile(fileName, file.content);
  }, [activeSelection.file]);

  const handleDownloadAll = React.useCallback(async () => {
    setDownloadError(null);
    try {
      const result = await downloadSourceMapZip(
        bundles,
        "source-map-sources.zip",
      );
      if (!result.ok) {
        setDownloadError(result.message);
      }
    } catch (error) {
      console.error("Failed to download source map zip", error);
      setDownloadError("Failed to build ZIP archive.");
    }
  }, [bundles]);

  const handleDeleteNode = React.useCallback(
    (node: SourceTreeNode) => {
      if (!node.id.startsWith("map:")) return;
      const mapId = node.id.replace("map:", "");
      setBundles((prev) => prev.filter((bundle) => bundle.id !== mapId));
      if (activeMapId === mapId) {
        setActiveMapId("");
        setActiveSourceId("");
      }
    },
    [activeMapId],
  );

  return (
    <ToolPageWrapper
      toolId="source-map-viewer"
      title="Source Map Viewer"
      description="View and download original source files from uploaded source maps."
      showHistory={false}
    >
      <SourceMapViewerInner
        bundles={bundles}
        activeSelection={activeSelection}
        treeNodes={treeNodes}
        parseErrors={parseErrors}
        downloadError={downloadError}
        activeMapId={activeMapId}
        activeSourceId={activeSourceId}
        setBundles={setBundles}
        setActiveMapId={setActiveMapId}
        setActiveSourceId={setActiveSourceId}
        onFilesUpload={handleFilesUpload}
        onClear={handleClear}
        onSelectFile={handleSelectFile}
        onDeleteNode={handleDeleteNode}
        onDownloadFile={handleDownloadFile}
        onDownloadAll={handleDownloadAll}
      />
    </ToolPageWrapper>
  );
}
