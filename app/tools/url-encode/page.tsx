"use client"

import * as React from "react"
import { Suspense } from "react"
import { z } from "zod"
import { Copy, Check, Link2 } from "lucide-react"
import { ToolPageWrapper, useToolHistoryContext } from "@/components/tool-ui/tool-page-wrapper"
import { DEFAULT_URL_SYNC_DEBOUNCE_MS, useUrlSyncedState } from "@/lib/url-state/use-url-synced-state"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { parseURL, encodeURL, decodeURL } from "@/lib/url/url-parser"
import type { HistoryEntry } from "@/lib/history/db"
import { cn } from "@/lib/utils"

const paramsSchema = z.object({
  encoded: z.string().default(""),
  decoded: z.string().default(""),
  activeSide: z.enum(["encoded", "decoded"]).default("decoded"),
})

export default function URLEncodePage() {
  return (
    <Suspense fallback={null}>
      <URLEncodeContent />
    </Suspense>
  )
}

function URLEncodeContent() {
  const { state, setParam, oversizeKeys, hasUrlParams, hydrationSource } = useUrlSyncedState("url-encode", {
    schema: paramsSchema,
    defaults: paramsSchema.parse({}),
    inputSide: {
      sideKey: "activeSide",
      inputKeyBySide: {
        encoded: "encoded",
        decoded: "decoded",
      },
    },
  })

  const handleEncodedChange = React.useCallback(
    (value: string) => {
      setParam("encoded", value)
      setParam("activeSide", "encoded")
      const decoded = decodeURL(value)
      setParam("decoded", decoded)
    },
    [setParam],
  )

  const handleDecodedChange = React.useCallback(
    (value: string) => {
      setParam("decoded", value)
      setParam("activeSide", "decoded")
      const encoded = encodeURL(value)
      setParam("encoded", encoded)
    },
    [setParam],
  )

  const handleLoadHistory = React.useCallback(
    (entry: HistoryEntry) => {
      const { inputs, params } = entry
      if (inputs.encoded !== undefined) setParam("encoded", inputs.encoded)
      if (inputs.decoded !== undefined) setParam("decoded", inputs.decoded)
      if (params.activeSide) setParam("activeSide", params.activeSide as "encoded" | "decoded")
    },
    [setParam],
  )

  return (
    <ToolPageWrapper
      toolId="url-encode"
      title="URL Encoder/Decoder"
      description="Encode and decode URL strings with detailed URL parsing"
      onLoadHistory={handleLoadHistory}
    >
      <URLEncodeInner
        state={state}
        oversizeKeys={oversizeKeys}
        hasUrlParams={hasUrlParams}
        hydrationSource={hydrationSource}
        handleEncodedChange={handleEncodedChange}
        handleDecodedChange={handleDecodedChange}
      />
    </ToolPageWrapper>
  )
}

function URLEncodeInner({
  state,
  oversizeKeys,
  hasUrlParams,
  hydrationSource,
  handleEncodedChange,
  handleDecodedChange,
}: {
  state: z.infer<typeof paramsSchema>
  oversizeKeys: (keyof z.infer<typeof paramsSchema>)[]
  hasUrlParams: boolean
  hydrationSource: "default" | "url" | "history"
  handleEncodedChange: (value: string) => void
  handleDecodedChange: (value: string) => void
}) {
  const { upsertInputEntry, upsertParams } = useToolHistoryContext()
  const lastInputRef = React.useRef<string>("")
  const hasHydratedInputRef = React.useRef(false)
  const hasHandledUrlRef = React.useRef(false)

  React.useEffect(() => {
    if (hasHydratedInputRef.current) return
    if (hydrationSource === "default") return
    const activeText = state.activeSide === "encoded" ? state.encoded : state.decoded
    lastInputRef.current = activeText
    hasHydratedInputRef.current = true
  }, [hydrationSource, state.activeSide, state.encoded, state.decoded])

  React.useEffect(() => {
    const activeText = state.activeSide === "encoded" ? state.encoded : state.decoded
    if (!activeText || activeText === lastInputRef.current) return

    const timer = setTimeout(() => {
      lastInputRef.current = activeText
      upsertInputEntry(
        { encoded: state.encoded, decoded: state.decoded },
        { activeSide: state.activeSide },
        state.activeSide,
        activeText.slice(0, 100),
      )
    }, DEFAULT_URL_SYNC_DEBOUNCE_MS)

    return () => clearTimeout(timer)
  }, [state.encoded, state.decoded, state.activeSide, upsertInputEntry])

  React.useEffect(() => {
    if (hasUrlParams && !hasHandledUrlRef.current) {
      hasHandledUrlRef.current = true
      const activeText = state.activeSide === "encoded" ? state.encoded : state.decoded
      if (activeText) {
        upsertInputEntry(
          { encoded: state.encoded, decoded: state.decoded },
          { activeSide: state.activeSide },
          state.activeSide,
          activeText.slice(0, 100),
        )
      } else {
        upsertParams({ activeSide: state.activeSide }, "interpretation")
      }
    }
  }, [hasUrlParams, state.encoded, state.decoded, state.activeSide, upsertInputEntry, upsertParams])

  const parsedURL = React.useMemo(() => {
    if (!state.encoded) return null
    return parseURL(state.encoded)
  }, [state.encoded])

  return (
    <div className="flex h-full flex-col gap-4 md:flex-row">
      {/* Left Column - Encoded */}
      <URLColumn
        label="URL Encoded"
        value={state.encoded}
        onChange={handleEncodedChange}
        isActive={state.activeSide === "encoded"}
        warning={oversizeKeys.includes("encoded") ? "Input exceeds 2 KB and is not synced to the URL." : null}
        showParsed={false}
        parsedURL={null}
      />

      {/* Divider */}
      <div className="hidden shrink-0 items-center justify-center md:flex">
        <Link2 className="h-5 w-5 text-muted-foreground" />
      </div>

      {/* Right Column - Decoded */}
      <URLColumn
        label="URL Decoded"
        value={state.decoded}
        onChange={handleDecodedChange}
        isActive={state.activeSide === "decoded"}
        warning={oversizeKeys.includes("decoded") ? "Input exceeds 2 KB and is not synced to the URL." : null}
        showParsed={true}
        parsedURL={parsedURL}
      />
    </div>
  )
}

function URLColumn({
  label,
  value,
  onChange,
  isActive,
  warning,
  showParsed,
  parsedURL,
}: {
  label: string
  value: string
  onChange: (value: string) => void
  isActive: boolean
  warning: string | null
  showParsed: boolean
  parsedURL: ReturnType<typeof parseURL> | null
}) {
  const [copied, setCopied] = React.useState<string | null>(null)

  const handleCopy = async (text: string, key: string) => {
    await navigator.clipboard.writeText(text)
    setCopied(key)
    setTimeout(() => setCopied(null), 2000)
  }

  const isValidURL = parsedURL !== null

  return (
    <div className="flex w-full flex-1 flex-col gap-3 md:w-0">
      {/* Row 1: Input Box */}
      <div className="shrink-0">
        <div className="mb-1 flex items-center justify-between">
          <Label className={cn("text-sm font-medium", isActive && "text-primary")}>{label}</Label>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => handleCopy(value, "input")}
            disabled={!value}
            className="h-7 gap-1 px-2 text-xs"
          >
            {copied === "input" ? (
              <>
                <Check className="h-3 w-3" />
                Copied
              </>
            ) : (
              <>
                <Copy className="h-3 w-3" />
                Copy
              </>
            )}
          </Button>
        </div>
        <Textarea
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={`Enter ${label.toLowerCase()}...`}
          className={cn(
            "max-h-[400px] min-h-[120px] overflow-auto overflow-x-hidden break-words whitespace-pre-wrap font-mono text-sm",
            isActive && "ring-1 ring-primary",
          )}
          style={{ wordBreak: "break-all", overflowWrap: "anywhere" }}
        />
        {warning && <p className="mt-1 text-xs text-muted-foreground">{warning}</p>}
      </div>

      {/* Row 2: Parsed Result */}
      {showParsed && isValidURL && parsedURL && (
        <div className="min-h-0 flex-1 space-y-2 overflow-auto text-sm">
          {/* Basic fields */}
          {Object.entries({
            Protocol: parsedURL.protocol,
            Username: parsedURL.username,
            Password: parsedURL.password,
            Hostname: parsedURL.hostname,
            Port: parsedURL.port,
            Host: parsedURL.host,
            Origin: parsedURL.origin,
            Pathname: parsedURL.pathname,
            Search: parsedURL.search,
            Hash: parsedURL.hash,
          }).map(([key, val]) => {
            if (!val) return null
            return (
              <div key={key} className="group flex items-start gap-1">
                <span className="w-20 shrink-0 text-muted-foreground">{key}:</span>
                <code className="break-all text-muted-foreground">{val}</code>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => handleCopy(val, key)}
                  className="h-5 w-5 shrink-0 opacity-0 transition-opacity group-hover:opacity-100"
                  aria-label={`Copy ${key}`}
                >
                  {copied === key ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
                </Button>
              </div>
            )
          })}

          {parsedURL.searchParams.length > 0 && (
            <div className="space-y-1">
              <div className="font-medium text-muted-foreground">Search Params:</div>
              <div className="ml-4 overflow-auto">
                <table className="w-full border-collapse text-sm">
                  <thead>
                    <tr className="border-b">
                      <th className="px-2 py-1 text-left font-medium text-muted-foreground">Key</th>
                      <th className="px-2 py-1 text-left font-medium text-muted-foreground">Value</th>
                      <th className="w-8"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {parsedURL.searchParams.map((param, idx) => (
                      <tr key={`search-${idx}`} className="group border-b last:border-0">
                        <td className="break-all px-2 py-1 font-mono text-muted-foreground">{param.key}</td>
                        <td className="break-all px-2 py-1 font-mono text-muted-foreground">{param.value}</td>
                        <td className="px-2 py-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleCopy(param.value, `search-${idx}`)}
                            className="h-5 w-5 opacity-0 transition-opacity group-hover:opacity-100"
                            aria-label={`Copy ${param.key} value`}
                          >
                            {copied === `search-${idx}` ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {parsedURL.hashParams.length > 0 && (
            <div className="space-y-1">
              <div className="font-medium text-muted-foreground">Hash Params:</div>
              <div className="ml-4 overflow-auto">
                <table className="w-full border-collapse text-sm">
                  <thead>
                    <tr className="border-b">
                      <th className="px-2 py-1 text-left font-medium text-muted-foreground">Key</th>
                      <th className="px-2 py-1 text-left font-medium text-muted-foreground">Value</th>
                      <th className="w-8"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {parsedURL.hashParams.map((param, idx) => (
                      <tr key={`hash-${idx}`} className="group border-b last:border-0">
                        <td className="break-all px-2 py-1 font-mono text-muted-foreground">{param.key}</td>
                        <td className="break-all px-2 py-1 font-mono text-muted-foreground">{param.value}</td>
                        <td className="px-2 py-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleCopy(param.value, `hash-${idx}`)}
                            className="h-5 w-5 opacity-0 transition-opacity group-hover:opacity-100"
                            aria-label={`Copy ${param.key} value`}
                          >
                            {copied === `hash-${idx}` ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
