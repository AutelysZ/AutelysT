"use client"

import * as React from "react"
import { Check, Copy, Plus } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import CspDirectiveRow from "./csp-directive-row"
import type { CspDirective } from "./csp-builder-types"
import { formatDirectiveValues, parseDirectiveValues } from "./csp-builder-utils"

type CspBuilderFormProps = {
  policy: string
  directives: CspDirective[]
  normalizedPolicy: string
  parseError: string | null
  oversizePolicy: boolean
  onPolicyChange: (value: string) => void
  onDirectivesChange: (directives: CspDirective[]) => void
}

export default function CspBuilderForm({
  policy,
  directives,
  normalizedPolicy,
  parseError,
  oversizePolicy,
  onPolicyChange,
  onDirectivesChange,
}: CspBuilderFormProps) {
  const [copiedKey, setCopiedKey] = React.useState<string | null>(null)
  const [newDirectiveName, setNewDirectiveName] = React.useState("")
  const [newDirectiveValues, setNewDirectiveValues] = React.useState("")

  const handleCopy = React.useCallback(async (text: string, key: string) => {
    if (!text) return
    try {
      await navigator.clipboard.writeText(text)
      setCopiedKey(key)
      setTimeout(() => {
        setCopiedKey((current) => (current === key ? null : current))
      }, 2000)
    } catch (error) {
      console.error("CSP Builder copy failed", error)
    }
  }, [])

  const handleDirectiveNameChange = React.useCallback(
    (index: number, value: string) => {
      const next = directives.map((directive, idx) =>
        idx === index ? { ...directive, name: value } : directive,
      )
      onDirectivesChange(next)
    },
    [directives, onDirectivesChange],
  )

  const handleDirectiveValuesChange = React.useCallback(
    (index: number, value: string) => {
      const next = directives.map((directive, idx) =>
        idx === index ? { ...directive, values: parseDirectiveValues(value) } : directive,
      )
      onDirectivesChange(next)
    },
    [directives, onDirectivesChange],
  )

  const handleRemoveDirective = React.useCallback(
    (index: number) => {
      const next = directives.filter((_, idx) => idx !== index)
      onDirectivesChange(next)
    },
    [directives, onDirectivesChange],
  )

  const handleAddDirective = React.useCallback(() => {
    const name = newDirectiveName.trim()
    if (!name) return
    const values = parseDirectiveValues(newDirectiveValues)
    const next = [...directives, { name, values }]
    onDirectivesChange(next)
    setNewDirectiveName("")
    setNewDirectiveValues("")
  }, [newDirectiveName, newDirectiveValues, directives, onDirectivesChange])

  const headerLine = normalizedPolicy ? `Content-Security-Policy: ${normalizedPolicy}` : ""

  return (
    <div className="flex flex-col gap-6">
      <div className="rounded-lg border bg-background p-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <Label className="text-sm font-medium">Policy</Label>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-7 gap-1 px-2 text-xs"
            onClick={() => handleCopy(policy, "policy")}
            disabled={!policy}
          >
            {copiedKey === "policy" ? (
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
          value={policy}
          onChange={(event) => onPolicyChange(event.target.value)}
          placeholder="default-src 'self'; script-src 'self' https://cdn.example.com;"
          className="mt-2 min-h-[140px] resize-y font-mono text-xs"
        />
        {oversizePolicy && <p className="mt-2 text-xs text-muted-foreground">Policy exceeds 2 KB and is not synced.</p>}
        {parseError && <p className="mt-2 text-xs text-destructive">{parseError}</p>}
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-lg border bg-background p-4">
          <div className="mb-2 text-sm font-medium">Directives</div>
          <p className="text-xs text-muted-foreground">Separate values with spaces or new lines. Use quotes for keywords like 'self'.</p>

          <div className="mt-4 space-y-4">
            {directives.length === 0 ? (
              <div className="rounded-md border border-dashed p-4 text-xs text-muted-foreground">
                No directives parsed yet.
              </div>
            ) : (
              directives.map((directive, index) => (
                <CspDirectiveRow
                  key={`${directive.name}-${index}`}
                  name={directive.name}
                  valuesText={formatDirectiveValues(directive.values)}
                  onNameChange={(value) => handleDirectiveNameChange(index, value)}
                  onValuesChange={(value) => handleDirectiveValuesChange(index, value)}
                  onRemove={() => handleRemoveDirective(index)}
                />
              ))
            )}
          </div>

          <div className="mt-4 rounded-md border bg-muted/30 p-3">
            <div className="mb-2 text-xs font-medium">Add directive</div>
            <div className="grid gap-2">
              <Input
                value={newDirectiveName}
                onChange={(event) => setNewDirectiveName(event.target.value)}
                placeholder="connect-src"
                className="font-mono text-xs"
              />
              <Textarea
                value={newDirectiveValues}
                onChange={(event) => setNewDirectiveValues(event.target.value)}
                placeholder="'self' https://api.example.com"
                className="min-h-[64px] resize-y font-mono text-xs"
              />
              <Button type="button" variant="secondary" size="sm" className="h-8 gap-1" onClick={handleAddDirective}>
                <Plus className="h-3 w-3" />
                Add
              </Button>
            </div>
          </div>
        </div>

        <div className="rounded-lg border bg-background p-4">
          <div className="mb-3 text-sm font-medium">Header Output</div>
          <div className="space-y-4">
            <div className="space-y-2">
              <div className="flex items-center justify-between gap-2">
                <Label className="text-xs">Policy Value</Label>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7"
                  onClick={() => handleCopy(normalizedPolicy, "value")}
                  disabled={!normalizedPolicy}
                >
                  {copiedKey === "value" ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                </Button>
              </div>
              <div className="rounded-md border bg-muted/40 px-3 py-2">
                <div className="font-mono text-xs break-all">
                  {normalizedPolicy || <span className="text-muted-foreground">No policy generated yet.</span>}
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between gap-2">
                <Label className="text-xs">Header Line</Label>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7"
                  onClick={() => handleCopy(headerLine, "header")}
                  disabled={!headerLine}
                >
                  {copiedKey === "header" ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                </Button>
              </div>
              <div className="rounded-md border bg-muted/40 px-3 py-2">
                <div className="font-mono text-xs break-all">
                  {headerLine || <span className="text-muted-foreground">Header line will appear here.</span>}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
