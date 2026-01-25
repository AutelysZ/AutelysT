"use client"

import * as React from "react"
import { Check, Copy } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import UrlParamEditor from "./url-param-editor"
import UrlEncodingSelect from "./url-encoding-select"
import { buildEncodedHash, buildEncodedQuery } from "./url-builder-utils"
import type { ParsedUrlData, UrlParam } from "./url-builder-types"

type UrlBuilderFormProps = {
  url: string
  encoding: string
  encodingOptions: Array<{ value: string; label: string }>
  parsed: ParsedUrlData
  oversizeUrl: boolean
  onUrlChange: (value: string) => void
  onEncodingChange: (value: string) => void
  onPartsChange: (next: Partial<ParsedUrlData>) => void
  onQueryParamsChange: (params: UrlParam[]) => void
  onHashParamsChange: (params: UrlParam[]) => void
}

export default function UrlBuilderForm({
  url,
  encoding,
  encodingOptions,
  parsed,
  oversizeUrl,
  onUrlChange,
  onEncodingChange,
  onPartsChange,
  onQueryParamsChange,
  onHashParamsChange,
}: UrlBuilderFormProps) {
  const [copiedKey, setCopiedKey] = React.useState<string | null>(null)

  const handleCopy = React.useCallback(async (text: string, key: string) => {
    if (!text) return
    try {
      await navigator.clipboard.writeText(text)
      setCopiedKey(key)
      setTimeout(() => {
        setCopiedKey((current) => (current === key ? null : current))
      }, 2000)
    } catch (error) {
      console.error("URL Builder copy failed", error)
    }
  }, [])

  const renderCopyInput = React.useCallback(
    ({
      value,
      placeholder,
      onChange,
      fieldKey,
    }: {
      value: string
      placeholder: string
      onChange: (value: string) => void
      fieldKey: string
    }) => (
      <div className="relative">
        <Input
          value={value}
          onChange={(event) => onChange(event.target.value)}
          placeholder={placeholder}
          className="pr-9"
        />
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="absolute right-1 top-1/2 h-7 w-7 -translate-y-1/2"
          onClick={() => handleCopy(value, fieldKey)}
          disabled={!value}
        >
          {copiedKey === fieldKey ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
        </Button>
      </div>
    ),
    [copiedKey, handleCopy],
  )

  const renderReadOnlyCopy = React.useCallback(
    ({
      value,
      placeholder,
      fieldKey,
    }: {
      value: string
      placeholder: string
      fieldKey: string
    }) => (
      <div className="flex items-start justify-between gap-2 rounded-md border bg-muted/40 px-3 py-2">
        <div className="min-w-0 flex-1 font-mono text-xs text-foreground break-all">
          {value || <span className="text-muted-foreground">{placeholder}</span>}
        </div>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="h-7 w-7 shrink-0"
          onClick={() => handleCopy(value, fieldKey)}
          disabled={!value}
        >
          {copiedKey === fieldKey ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
        </Button>
      </div>
    ),
    [copiedKey, handleCopy],
  )

  const encodedQuery = buildEncodedQuery(parsed.queryParams, encoding)
  const encodedHash = buildEncodedHash(parsed.hashPathname, parsed.hashParams, encoding)

  return (
    <div className="flex flex-col gap-6">
      <div className="rounded-lg border bg-background p-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <Label className="text-sm font-medium">URL</Label>
          <Button variant="ghost" size="sm" className="h-7 gap-1 px-2 text-xs" onClick={() => handleCopy(url, "url")} disabled={!url}>
            {copiedKey === "url" ? (
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
          value={url}
          onChange={(event) => onUrlChange(event.target.value)}
          placeholder="https://example.com/path?key=value#section"
          className="mt-2 min-h-[120px] resize-y font-mono text-xs break-all"
        />
        {oversizeUrl && <p className="mt-2 text-xs text-muted-foreground">URL exceeds 2 KB and is not synced.</p>}
        <div className="mt-4 flex flex-wrap items-center gap-2">
          <Label className="text-sm font-medium">Encoding</Label>
          <UrlEncodingSelect value={encoding} options={encodingOptions} onChange={onEncodingChange} />
          <span className="text-xs text-muted-foreground">Applies to pathname, query, and hash values.</span>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-lg border bg-background p-4">
          <div className="mb-3 text-sm font-medium">Components</div>
          <div className="grid gap-3">
            <div className="grid gap-1">
              <Label className="text-xs">Protocol</Label>
              {renderCopyInput({
                value: parsed.protocol,
                placeholder: "https",
                onChange: (value) => onPartsChange({ protocol: value }),
                fieldKey: "protocol",
              })}
            </div>
            <div className="grid gap-1">
              <Label className="text-xs">Username</Label>
              {renderCopyInput({
                value: parsed.username,
                placeholder: "user",
                onChange: (value) => onPartsChange({ username: value }),
                fieldKey: "username",
              })}
            </div>
            <div className="grid gap-1">
              <Label className="text-xs">Password</Label>
              {renderCopyInput({
                value: parsed.password,
                placeholder: "password",
                onChange: (value) => onPartsChange({ password: value }),
                fieldKey: "password",
              })}
            </div>
            <div className="grid gap-1">
              <Label className="text-xs">Hostname</Label>
              {renderCopyInput({
                value: parsed.hostname,
                placeholder: "example.com",
                onChange: (value) => onPartsChange({ hostname: value }),
                fieldKey: "hostname",
              })}
            </div>
            <div className="grid gap-1">
              <Label className="text-xs">Port</Label>
              {renderCopyInput({
                value: parsed.port,
                placeholder: "443",
                onChange: (value) => onPartsChange({ port: value }),
                fieldKey: "port",
              })}
            </div>
            <div className="grid gap-1">
              <Label className="text-xs">Pathname</Label>
              {renderCopyInput({
                value: parsed.pathname,
                placeholder: "/path/to/page",
                onChange: (value) => onPartsChange({ pathname: value }),
                fieldKey: "pathname",
              })}
            </div>
          </div>
        </div>

        <div className="flex flex-col gap-4">
          <div className="rounded-lg border bg-background p-4">
            <div className="flex flex-col gap-3">
              <div className="grid gap-1">
                <Label className="text-xs">Encoded Query</Label>
                {renderReadOnlyCopy({
                  value: encodedQuery,
                  placeholder: "?key=value",
                  fieldKey: "encodedQuery",
                })}
              </div>
              <UrlParamEditor label="Query Parameters" params={parsed.queryParams} onChange={onQueryParamsChange} />
            </div>
          </div>

          <div className="rounded-lg border bg-background p-4">
            <div className="mb-3 text-sm font-medium">Hash</div>
            <div className="grid gap-3">
              <div className="grid gap-1">
                <Label className="text-xs">Encoded Hash</Label>
                {renderReadOnlyCopy({
                  value: encodedHash,
                  placeholder: "#section?key=value",
                  fieldKey: "encodedHash",
                })}
              </div>
              <div className="grid gap-1">
                <Label className="text-xs">Hash Pathname</Label>
                {renderCopyInput({
                  value: parsed.hashPathname,
                  placeholder: "section/overview",
                  onChange: (value) => onPartsChange({ hashPathname: value }),
                  fieldKey: "hashPathname",
                })}
              </div>
              <UrlParamEditor label="Hash Parameters" params={parsed.hashParams} onChange={onHashParamsChange} />
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
