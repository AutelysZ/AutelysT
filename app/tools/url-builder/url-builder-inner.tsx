"use client"

import * as React from "react"
import { DEFAULT_URL_SYNC_DEBOUNCE_MS } from "@/lib/url-state/use-url-synced-state"
import { useToolHistoryContext } from "@/components/tool-ui/tool-page-wrapper"
import UrlBuilderForm from "./url-builder-form"
import type { ParsedUrlData, UrlBuilderState, UrlParam } from "./url-builder-types"
import { URL_ENCODING_OPTIONS } from "./url-builder-utils"

type UrlBuilderInnerProps = {
  state: UrlBuilderState
  parsed: ParsedUrlData
  oversizeUrl: boolean
  hasUrlParams: boolean
  hydrationSource: "default" | "url" | "history"
  onUrlChange: (value: string) => void
  onEncodingChange: (value: string) => void
  onPartsChange: (next: Partial<ParsedUrlData>) => void
  onQueryParamsChange: (params: UrlParam[]) => void
  onHashParamsChange: (params: UrlParam[]) => void
}

export default function UrlBuilderInner({
  state,
  parsed,
  oversizeUrl,
  hasUrlParams,
  hydrationSource,
  onUrlChange,
  onEncodingChange,
  onPartsChange,
  onQueryParamsChange,
  onHashParamsChange,
}: UrlBuilderInnerProps) {
  const { addHistoryEntry, updateHistoryParams } = useToolHistoryContext()
  const lastInputRef = React.useRef("")
  const hasHydratedInputRef = React.useRef(false)
  const hasHandledUrlRef = React.useRef(false)

  React.useEffect(() => {
    if (hasHydratedInputRef.current) return
    if (hydrationSource === "default") return
    lastInputRef.current = state.url
    hasHydratedInputRef.current = true
  }, [hydrationSource, state.url])

  React.useEffect(() => {
    if (!state.url || state.url === lastInputRef.current) return
    const timer = setTimeout(() => {
      lastInputRef.current = state.url
      addHistoryEntry({ url: state.url }, { encoding: state.encoding }, "left", state.url.slice(0, 120))
    }, DEFAULT_URL_SYNC_DEBOUNCE_MS)

    return () => clearTimeout(timer)
  }, [state.url, state.encoding, addHistoryEntry])

  React.useEffect(() => {
    if (hasUrlParams && !hasHandledUrlRef.current) {
      hasHandledUrlRef.current = true
      if (state.url) {
        addHistoryEntry({ url: state.url }, { encoding: state.encoding }, "left", state.url.slice(0, 120))
      } else {
        updateHistoryParams({ encoding: state.encoding })
      }
    }
  }, [hasUrlParams, state.url, state.encoding, addHistoryEntry, updateHistoryParams])

  React.useEffect(() => {
    updateHistoryParams({ encoding: state.encoding })
  }, [state.encoding, updateHistoryParams])

  return (
    <UrlBuilderForm
      url={state.url}
      encoding={state.encoding}
      encodingOptions={URL_ENCODING_OPTIONS}
      parsed={parsed}
      oversizeUrl={oversizeUrl}
      onUrlChange={onUrlChange}
      onEncodingChange={onEncodingChange}
      onPartsChange={onPartsChange}
      onQueryParamsChange={onQueryParamsChange}
      onHashParamsChange={onHashParamsChange}
    />
  )
}
