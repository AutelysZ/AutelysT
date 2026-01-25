"use client"

import * as React from "react"
import { DEFAULT_URL_SYNC_DEBOUNCE_MS } from "@/lib/url-state/use-url-synced-state"
import { useToolHistoryContext } from "@/components/tool-ui/tool-page-wrapper"
import SourceMapViewerForm from "./source-map-viewer-form"
import type { SourceFile, SourceMapBundle, SourceTreeNode } from "./source-map-viewer-types"

type SourceMapViewerInnerProps = {
  state: {
    activeMapId: string
    activeSourceId: string
  }
  bundles: SourceMapBundle[]
  activeSelection: {
    bundle: SourceMapBundle | null
    file: SourceFile | null
  }
  treeNodes: SourceTreeNode[]
  parseErrors: string[]
  downloadError: string | null
  oversizeKeys: string[]
  hasUrlParams: boolean
  hydrationSource: "default" | "url" | "history"
  onFilesUpload: (files: File[]) => void
  onClear: () => void
  onSelectFile: (mapId: string, fileId: string) => void
  onDownloadFile: () => void
  onDownloadAll: () => void
}

export default function SourceMapViewerInner({
  state,
  bundles,
  activeSelection,
  treeNodes,
  parseErrors,
  downloadError,
  oversizeKeys,
  hasUrlParams,
  hydrationSource,
  onFilesUpload,
  onClear,
  onSelectFile,
  onDownloadFile,
  onDownloadAll,
}: SourceMapViewerInnerProps) {
  const { addHistoryEntry, updateHistoryParams } = useToolHistoryContext()
  const lastInputRef = React.useRef("")
  const hasHydratedInputRef = React.useRef(false)
  const hasHandledUrlRef = React.useRef(false)
  const paramsRef = React.useRef({ activeMapId: state.activeMapId, activeSourceId: state.activeSourceId })
  const hasInitializedParamsRef = React.useRef(false)

  const serializedMaps = React.useMemo(() => {
    if (bundles.length === 0) return ""
    return JSON.stringify(bundles)
  }, [bundles])

  React.useEffect(() => {
    if (hasHydratedInputRef.current) return
    if (hydrationSource === "default") return
    lastInputRef.current = serializedMaps
    hasHydratedInputRef.current = true
  }, [hydrationSource, serializedMaps])

  React.useEffect(() => {
    if (!serializedMaps || serializedMaps === lastInputRef.current) return

    const previewText = activeSelection.file?.path ?? activeSelection.bundle?.name ?? "source maps"

    const timer = setTimeout(() => {
      lastInputRef.current = serializedMaps
      addHistoryEntry(
        { maps: serializedMaps },
        { activeMapId: state.activeMapId, activeSourceId: state.activeSourceId },
        "left",
        previewText.slice(0, 120),
      )
    }, DEFAULT_URL_SYNC_DEBOUNCE_MS)

    return () => clearTimeout(timer)
  }, [serializedMaps, activeSelection.file?.path, activeSelection.bundle?.name, state.activeMapId, state.activeSourceId, addHistoryEntry])

  React.useEffect(() => {
    if (hasUrlParams && !hasHandledUrlRef.current) {
      hasHandledUrlRef.current = true
      if (serializedMaps) {
        addHistoryEntry(
          { maps: serializedMaps },
          { activeMapId: state.activeMapId, activeSourceId: state.activeSourceId },
          "left",
          activeSelection.file?.path ?? activeSelection.bundle?.name ?? "source maps",
        )
      } else {
        updateHistoryParams({ activeMapId: state.activeMapId, activeSourceId: state.activeSourceId })
      }
    }
  }, [hasUrlParams, serializedMaps, state.activeMapId, state.activeSourceId, activeSelection.file?.path, activeSelection.bundle?.name, addHistoryEntry, updateHistoryParams])

  React.useEffect(() => {
    const nextParams = { activeMapId: state.activeMapId, activeSourceId: state.activeSourceId }
    if (!hasInitializedParamsRef.current) {
      hasInitializedParamsRef.current = true
      paramsRef.current = nextParams
      return
    }
    if (
      paramsRef.current.activeMapId === nextParams.activeMapId &&
      paramsRef.current.activeSourceId === nextParams.activeSourceId
    ) {
      return
    }
    paramsRef.current = nextParams
    updateHistoryParams(nextParams)
  }, [state.activeMapId, state.activeSourceId, updateHistoryParams])

  return (
    <SourceMapViewerForm
      bundles={bundles}
      treeNodes={treeNodes}
      activeBundle={activeSelection.bundle}
      activeFile={activeSelection.file}
      parseErrors={parseErrors}
      downloadError={downloadError}
      oversizeKeys={oversizeKeys}
      onFilesUpload={onFilesUpload}
      onClear={onClear}
      onSelectFile={onSelectFile}
      onDownloadFile={onDownloadFile}
      onDownloadAll={onDownloadAll}
    />
  )
}
