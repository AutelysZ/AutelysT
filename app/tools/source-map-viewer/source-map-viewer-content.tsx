"use client"

import * as React from "react"
import { z } from "zod"
import { ToolPageWrapper } from "@/components/tool-ui/tool-page-wrapper"
import { useUrlSyncedState } from "@/lib/url-state/use-url-synced-state"
import type { HistoryEntry } from "@/lib/history/db"
import SourceMapViewerInner from "./source-map-viewer-inner"
import type { SourceFile, SourceMapBundle } from "./source-map-viewer-types"
import { buildSourceTree, downloadSourceFile, downloadSourceMapZip, parseSourceMapsFromFiles } from "./source-map-viewer-utils"

const paramsSchema = z.object({
  activeMapId: z.string().default(""),
  activeSourceId: z.string().default(""),
})

type ActiveSelection = {
  bundle: SourceMapBundle | null
  file: SourceFile | null
}

function resolveActiveSelection(
  bundles: SourceMapBundle[],
  activeMapId: string,
  activeSourceId: string,
): ActiveSelection {
  const selectedBundle = bundles.find((bundle) => bundle.id === activeMapId) ?? null
  const selectedFile = selectedBundle?.sources.find((source) => source.id === activeSourceId) ?? null

  if (selectedBundle && selectedFile) {
    return { bundle: selectedBundle, file: selectedFile }
  }

  const fallbackBundle = bundles[0] ?? null
  const fallbackFile = fallbackBundle?.sources[0] ?? null

  return { bundle: fallbackBundle, file: fallbackFile }
}

export default function SourceMapViewerContent() {
  const { state, setParam, oversizeKeys, hasUrlParams, hydrationSource } = useUrlSyncedState("source-map-viewer", {
    schema: paramsSchema,
    defaults: paramsSchema.parse({}),
  })

  const [bundles, setBundles] = React.useState<SourceMapBundle[]>([])
  const [parseErrors, setParseErrors] = React.useState<string[]>([])
  const [downloadError, setDownloadError] = React.useState<string | null>(null)

  const activeSelection = React.useMemo(
    () => resolveActiveSelection(bundles, state.activeMapId, state.activeSourceId),
    [bundles, state.activeMapId, state.activeSourceId],
  )

  const treeNodes = React.useMemo(() => buildSourceTree(bundles), [bundles])

  React.useEffect(() => {
    if (bundles.length === 0) {
      if (state.activeMapId || state.activeSourceId) {
        setParam("activeMapId", "")
        setParam("activeSourceId", "")
      }
      return
    }

    if (!activeSelection.bundle || !activeSelection.file) {
      const fallbackBundle = bundles[0]
      const fallbackFile = fallbackBundle.sources[0]
      setParam("activeMapId", fallbackBundle.id)
      setParam("activeSourceId", fallbackFile.id)
    }
  }, [bundles, activeSelection.bundle, activeSelection.file, setParam, state.activeMapId, state.activeSourceId])

  const handleFilesUpload = React.useCallback(
    async (files: File[]) => {
      setDownloadError(null)
      setParseErrors([])

      const { bundles: nextBundles, errors } = await parseSourceMapsFromFiles(files)
      if (errors.length) {
        setParseErrors(errors)
      }
      if (nextBundles.length) {
        setBundles((prev) => {
          const merged = [...prev]
          const indexByName = new Map<string, number>()
          merged.forEach((bundle, index) => {
            indexByName.set(bundle.name, index)
          })

          for (const bundle of nextBundles) {
            const existingIndex = indexByName.get(bundle.name)
            if (existingIndex !== undefined) {
              merged[existingIndex] = bundle
            } else {
              merged.push(bundle)
              indexByName.set(bundle.name, merged.length - 1)
            }
          }

          return merged
        })
      }
    },
    [],
  )

  const handleClear = React.useCallback(() => {
    setBundles([])
    setParseErrors([])
    setDownloadError(null)
    setParam("activeMapId", "")
    setParam("activeSourceId", "")
  }, [setParam])

  const handleSelectFile = React.useCallback(
    (mapId: string, fileId: string) => {
      setParam("activeMapId", mapId)
      setParam("activeSourceId", fileId)
    },
    [setParam],
  )

  const handleDownloadFile = React.useCallback(() => {
    const file = activeSelection.file
    if (!file || file.content === null) return

    const fileName = file.path.split("/").pop() || "source"
    downloadSourceFile(fileName, file.content)
  }, [activeSelection.file])

  const handleDownloadAll = React.useCallback(async () => {
    setDownloadError(null)
    try {
      const result = await downloadSourceMapZip(bundles, "source-map-sources.zip")
      if (!result.ok) {
        setDownloadError(result.message)
      }
    } catch (error) {
      console.error("Failed to download source map zip", error)
      setDownloadError("Failed to build ZIP archive.")
    }
  }, [bundles])

  const handleLoadHistory = React.useCallback(
    (entry: HistoryEntry) => {
      const { inputs, params } = entry
      if (inputs.maps) {
        try {
          const parsed = JSON.parse(inputs.maps) as SourceMapBundle[]
          setBundles(parsed)
          setParseErrors([])
        } catch (error) {
          console.error("Failed to restore source maps", error)
          setParseErrors(["Failed to restore source maps from history."])
        }
      }

      if (params.activeMapId) setParam("activeMapId", String(params.activeMapId))
      if (params.activeSourceId) setParam("activeSourceId", String(params.activeSourceId))
    },
    [setParam],
  )

  return (
    <ToolPageWrapper
      toolId="source-map-viewer"
      title="Source Map Viewer"
      description="View and download original source files from uploaded source maps."
      onLoadHistory={handleLoadHistory}
    >
      <SourceMapViewerInner
        state={state}
        bundles={bundles}
        activeSelection={activeSelection}
        treeNodes={treeNodes}
        parseErrors={parseErrors}
        downloadError={downloadError}
        oversizeKeys={oversizeKeys}
        hasUrlParams={hasUrlParams}
        hydrationSource={hydrationSource}
        onFilesUpload={handleFilesUpload}
        onClear={handleClear}
        onSelectFile={handleSelectFile}
        onDownloadFile={handleDownloadFile}
        onDownloadAll={handleDownloadAll}
      />
    </ToolPageWrapper>
  )
}
