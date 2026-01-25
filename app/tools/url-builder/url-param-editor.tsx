"use client"

import * as React from "react"
import { Check, Copy, Plus, Trash2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import type { UrlParam } from "./url-builder-types"

type UrlParamEditorProps = {
  label: string
  params: UrlParam[]
  onChange: (params: UrlParam[]) => void
}

export default function UrlParamEditor({ label, params, onChange }: UrlParamEditorProps) {
  const [draftKey, setDraftKey] = React.useState("")
  const [draftValue, setDraftValue] = React.useState("")
  const [copiedIndex, setCopiedIndex] = React.useState<number | null>(null)

  const handleParamChange = React.useCallback(
    (index: number, nextKey: string, nextValue: string) => {
      const updated = params.map((param, i) => (i === index ? { key: nextKey, value: nextValue } : param))
      onChange(updated)
    },
    [onChange, params],
  )

  const handleRemove = React.useCallback(
    (index: number) => {
      const updated = params.filter((_, i) => i !== index)
      onChange(updated)
    },
    [onChange, params],
  )

  const handleAdd = React.useCallback(() => {
    if (!draftKey && !draftValue) return
    onChange([...params, { key: draftKey, value: draftValue }])
    setDraftKey("")
    setDraftValue("")
  }, [draftKey, draftValue, onChange, params])

  const handleCopy = React.useCallback(async (param: UrlParam, index: number) => {
    const text = param.value
    if (!text) return
    try {
      await navigator.clipboard.writeText(text)
      setCopiedIndex(index)
      setTimeout(() => {
        setCopiedIndex((current) => (current === index ? null : current))
      }, 2000)
    } catch (error) {
      console.error("URL Builder copy failed", error)
    }
  }, [])

  const hasDraft = draftKey.length > 0 || draftValue.length > 0

  return (
    <div className="flex flex-col gap-3">
      <Label className="text-sm font-medium">{label}</Label>
      {params.length ? (
        <div className="flex flex-col gap-2">
          {params.map((param, index) => (
            <div key={`${label}-${index}`} className="flex flex-wrap items-center gap-2">
              <Input
                value={param.key}
                onChange={(event) => handleParamChange(index, event.target.value, param.value)}
                placeholder="Key"
                className="min-w-[140px] flex-1"
              />
              <div className="relative min-w-[160px] flex-1">
                <Input
                  value={param.value}
                  onChange={(event) => handleParamChange(index, param.key, event.target.value)}
                  placeholder="Value"
                  className="pr-9"
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="absolute right-1 top-1/2 h-7 w-7 -translate-y-1/2"
                  onClick={() => handleCopy(param, index)}
                  disabled={!param.key && !param.value}
                >
                  {copiedIndex === index ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                </Button>
              </div>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                onClick={() => handleRemove(index)}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          ))}
        </div>
      ) : (
        <div className="text-xs text-muted-foreground">No parameters yet.</div>
      )}
      <div className="flex flex-wrap items-center gap-2">
        <Input
          value={draftKey}
          onChange={(event) => setDraftKey(event.target.value)}
          placeholder="New key"
          className="min-w-[140px] flex-1"
        />
        <Input
          value={draftValue}
          onChange={(event) => setDraftValue(event.target.value)}
          placeholder="New value"
          className="min-w-[160px] flex-1"
        />
        <Button type="button" variant="secondary" size="icon" className="h-8 w-8" onClick={handleAdd} disabled={!hasDraft}>
          <Plus className="h-4 w-4" />
        </Button>
      </div>
    </div>
  )
}
