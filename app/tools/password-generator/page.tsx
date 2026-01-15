"use client"

import * as React from "react"
import { Suspense } from "react"
import { z } from "zod"
import { ToolPageWrapper, useToolHistoryContext } from "@/components/tool-ui/tool-page-wrapper"
import { useUrlSyncedState } from "@/lib/url-state/use-url-synced-state"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Checkbox } from "@/components/ui/checkbox"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { Slider } from "@/components/ui/slider"
import { Check, Copy, RefreshCw } from "lucide-react"
import {
  DEFAULT_SYMBOLS,
  generatePassword,
  type PasswordGeneratorOptions,
  type PasswordSerialization,
  type CaseMode,
  type LengthType,
} from "@/lib/crypto/password-generator"
import type { HistoryEntry } from "@/lib/history/db"

const paramsSchema = z.object({
  serialization: z.enum(["graphic-ascii", "base64", "hex", "base58", "base45", "base32"]).default("graphic-ascii"),
  base64NoPadding: z.boolean().default(false),
  base64UrlSafe: z.boolean().default(false),
  base32NoPadding: z.boolean().default(false),
  caseMode: z.enum(["lower", "upper"]).default("lower"),
  symbols: z.string().default(DEFAULT_SYMBOLS),
  includeSymbols: z.boolean().default(true),
  includeUpper: z.boolean().default(true),
  includeLower: z.boolean().default(true),
  includeNumbers: z.boolean().default(true),
  lengthType: z.enum(["bytes", "chars"]).default("bytes"),
  lengthPreset: z.enum(["32", "24", "16", "12", "8", "custom"]).default("32"),
  lengthValue: z.coerce.number().int().min(1).max(1024).default(32),
})

const lengthPresets = [
  { value: "32", label: "32 (256 bit)" },
  { value: "24", label: "24 (192 bit)" },
  { value: "16", label: "16 (128 bit)" },
  { value: "12", label: "12 (96 bit)" },
  { value: "8", label: "8 (64 bit)" },
  { value: "custom", label: "Custom" },
]

export default function PasswordGeneratorPage() {
  return (
    <Suspense fallback={null}>
      <PasswordGeneratorContent />
    </Suspense>
  )
}

function PasswordGeneratorContent() {
  const { state, setParam, setState } = useUrlSyncedState("password-generator", {
    schema: paramsSchema,
    defaults: paramsSchema.parse({}),
  })

  const [label, setLabel] = React.useState("")
  const [result, setResult] = React.useState("")
  const [error, setError] = React.useState<string | null>(null)
  const skipNextGenerateRef = React.useRef(false)
  const didRestoreParamsRef = React.useRef(false)

  const generationOptions = React.useMemo<PasswordGeneratorOptions>(
    () => ({
      serialization: state.serialization as PasswordSerialization,
      base64NoPadding: state.base64NoPadding,
      base64UrlSafe: state.base64UrlSafe,
      base32NoPadding: state.base32NoPadding,
      caseMode: state.caseMode as CaseMode,
      symbols: state.symbols,
      includeSymbols: state.includeSymbols,
      includeUpper: state.includeUpper,
      includeLower: state.includeLower,
      includeNumbers: state.includeNumbers,
      lengthType: state.lengthType as LengthType,
      length: state.lengthValue,
    }),
    [
      state.serialization,
      state.base64NoPadding,
      state.base64UrlSafe,
      state.base32NoPadding,
      state.caseMode,
      state.symbols,
      state.includeSymbols,
      state.includeUpper,
      state.includeLower,
      state.includeNumbers,
      state.lengthType,
      state.lengthValue,
    ],
  )

  const generate = React.useCallback(() => {
    const { value, error: generationError } = generatePassword(generationOptions)
    setResult(value)
    setError(generationError ?? null)
  }, [generationOptions])

  React.useEffect(() => {
    if (skipNextGenerateRef.current) {
      skipNextGenerateRef.current = false
      return
    }
    generate()
  }, [generate])

  React.useEffect(() => {
    if (state.lengthPreset === "custom") return
    const presetValue = Number(state.lengthPreset)
    if (!Number.isNaN(presetValue) && state.lengthValue !== presetValue) {
      setParam("lengthValue", presetValue, true)
    }
  }, [state.lengthPreset, state.lengthValue, setParam])

  React.useEffect(() => {
    if (typeof window === "undefined") return

    const params = {
      serialization: state.serialization,
      base64NoPadding: state.base64NoPadding,
      base64UrlSafe: state.base64UrlSafe,
      base32NoPadding: state.base32NoPadding,
      caseMode: state.caseMode,
      symbols: state.symbols,
      includeSymbols: state.includeSymbols,
      includeUpper: state.includeUpper,
      includeLower: state.includeLower,
      includeNumbers: state.includeNumbers,
      lengthType: state.lengthType,
      lengthPreset: state.lengthPreset,
      lengthValue: state.lengthValue,
    }

    sessionStorage.setItem("password-generator:params", JSON.stringify(params))
  }, [
    state.serialization,
    state.base64NoPadding,
    state.base64UrlSafe,
    state.base32NoPadding,
    state.caseMode,
    state.symbols,
    state.includeSymbols,
    state.includeUpper,
    state.includeLower,
    state.includeNumbers,
    state.lengthType,
    state.lengthPreset,
    state.lengthValue,
  ])

  React.useEffect(() => {
    if (typeof window === "undefined") return
    if (didRestoreParamsRef.current) return

    const hasUrlParams = Array.from(new URLSearchParams(window.location.search).keys()).some(
      (key) => key in paramsSchema.shape,
    )
    if (hasUrlParams) {
      didRestoreParamsRef.current = true
      return
    }

    const stored = sessionStorage.getItem("password-generator:params")
    if (!stored) {
      didRestoreParamsRef.current = true
      return
    }

    const defaults = paramsSchema.parse({})
    const isDefault = Object.keys(defaults).every((key) => state[key as keyof typeof defaults] === defaults[key])
    if (!isDefault) {
      didRestoreParamsRef.current = true
      return
    }

    let parsedJson: unknown
    try {
      parsedJson = JSON.parse(stored)
    } catch {
      didRestoreParamsRef.current = true
      return
    }

    const parsed = paramsSchema.safeParse(parsedJson)
    if (!parsed.success) {
      didRestoreParamsRef.current = true
      return
    }

    setState(parsed.data, true)
    didRestoreParamsRef.current = true
  }, [state, setState])

  const handleLoadHistory = React.useCallback(
    (entry: HistoryEntry) => {
      skipNextGenerateRef.current = true
      setError(null)
      if (entry.inputs.label !== undefined) setLabel(entry.inputs.label)
      if (entry.inputs.password !== undefined) setResult(entry.inputs.password)

      if (entry.params.serialization) setParam("serialization", entry.params.serialization as string, true)
      if (entry.params.base64NoPadding !== undefined)
        setParam("base64NoPadding", entry.params.base64NoPadding as boolean, true)
      if (entry.params.base64UrlSafe !== undefined)
        setParam("base64UrlSafe", entry.params.base64UrlSafe as boolean, true)
      if (entry.params.base32NoPadding !== undefined)
        setParam("base32NoPadding", entry.params.base32NoPadding as boolean, true)
      if (entry.params.caseMode) setParam("caseMode", entry.params.caseMode as string, true)
      if (entry.params.symbols) setParam("symbols", entry.params.symbols as string, true)
      if (entry.params.includeSymbols !== undefined)
        setParam("includeSymbols", entry.params.includeSymbols as boolean, true)
      if (entry.params.includeUpper !== undefined) setParam("includeUpper", entry.params.includeUpper as boolean, true)
      if (entry.params.includeLower !== undefined) setParam("includeLower", entry.params.includeLower as boolean, true)
      if (entry.params.includeNumbers !== undefined)
        setParam("includeNumbers", entry.params.includeNumbers as boolean, true)
      if (entry.params.lengthType) setParam("lengthType", entry.params.lengthType as string, true)
      if (entry.params.lengthPreset) setParam("lengthPreset", entry.params.lengthPreset as string, true)
      if (entry.params.lengthValue !== undefined) setParam("lengthValue", entry.params.lengthValue as number, true)
    },
    [setParam],
  )

  return (
    <ToolPageWrapper
      toolId="password-generator"
      title="Password Generator"
      description="Generate secure passwords with multiple serialization modes and length presets"
      onLoadHistory={handleLoadHistory}
    >
      <PasswordGeneratorInner
        state={state}
        setParam={setParam}
        label={label}
        setLabel={setLabel}
        result={result}
        error={error}
        onRegenerate={generate}
        paramsForHistory={{
          serialization: state.serialization,
          base64NoPadding: state.base64NoPadding,
          base64UrlSafe: state.base64UrlSafe,
          base32NoPadding: state.base32NoPadding,
          caseMode: state.caseMode,
          symbols: state.symbols,
          includeSymbols: state.includeSymbols,
          includeUpper: state.includeUpper,
          includeLower: state.includeLower,
          includeNumbers: state.includeNumbers,
          lengthType: state.lengthType,
          lengthPreset: state.lengthPreset,
          lengthValue: state.lengthValue,
        }}
      />
    </ToolPageWrapper>
  )
}

function PasswordGeneratorInner({
  state,
  setParam,
  label,
  setLabel,
  result,
  error,
  onRegenerate,
  paramsForHistory,
}: {
  state: z.infer<typeof paramsSchema>
  setParam: (key: string, value: unknown, immediate?: boolean) => void
  label: string
  setLabel: (value: string) => void
  result: string
  error: string | null
  onRegenerate: () => void
  paramsForHistory: Record<string, unknown>
}) {
  const { addHistoryEntry } = useToolHistoryContext()
  const [copied, setCopied] = React.useState(false)

  const handleCopy = async () => {
    if (!result || error) return
    await navigator.clipboard.writeText(result)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)

    const preview = label ? `${label}: ${result}` : result
    addHistoryEntry({ label, password: result }, paramsForHistory, "left", preview.slice(0, 100))
  }

  return (
    <div className="mx-auto flex min-h-[calc(100vh-220px)] w-full max-w-5xl flex-col justify-center gap-4 py-4">
      <div className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center gap-3">
          <Label className="w-28 text-sm font-medium">Serialization</Label>
          <RadioGroup
            value={state.serialization}
            onValueChange={(value) => setParam("serialization", value, true)}
            className="flex flex-wrap gap-4"
          >
            {[
              { value: "graphic-ascii", label: "Graphic ASCII" },
              { value: "base64", label: "Base64" },
              { value: "hex", label: "Hex" },
              { value: "base58", label: "Base58" },
              { value: "base45", label: "Base45" },
              { value: "base32", label: "Base32" },
            ].map((item) => (
              <div key={item.value} className="flex items-center gap-2">
                <RadioGroupItem id={`serialization-${item.value}`} value={item.value} />
                <Label htmlFor={`serialization-${item.value}`} className="text-sm cursor-pointer">
                  {item.label}
                </Label>
              </div>
            ))}
          </RadioGroup>
        </div>

        {state.serialization === "base64" && (
          <div className="flex flex-wrap items-center gap-4">
            <Label className="w-28 text-sm font-medium">Base64</Label>
            <div className="flex items-center gap-2">
              <Checkbox
                id="base64NoPadding"
                checked={state.base64NoPadding}
                onCheckedChange={(checked) => setParam("base64NoPadding", checked === true, true)}
              />
              <Label htmlFor="base64NoPadding" className="text-sm cursor-pointer">
                No Padding
              </Label>
            </div>
            <div className="flex items-center gap-2">
              <Checkbox
                id="base64UrlSafe"
                checked={state.base64UrlSafe}
                onCheckedChange={(checked) => setParam("base64UrlSafe", checked === true, true)}
              />
              <Label htmlFor="base64UrlSafe" className="text-sm cursor-pointer">
                URL Safe
              </Label>
            </div>
          </div>
        )}

        {["hex", "base45", "base32"].includes(state.serialization) && (
          <div className="flex flex-wrap items-center gap-3">
            <Label className="w-28 text-sm font-medium">Case</Label>
            <RadioGroup
              value={state.caseMode}
              onValueChange={(value) => setParam("caseMode", value, true)}
              className="flex flex-wrap gap-4"
            >
              <div className="flex items-center gap-2">
                <RadioGroupItem id="case-lower" value="lower" />
                <Label htmlFor="case-lower" className="text-sm cursor-pointer">
                  Lower case
                </Label>
              </div>
              <div className="flex items-center gap-2">
                <RadioGroupItem id="case-upper" value="upper" />
                <Label htmlFor="case-upper" className="text-sm cursor-pointer">
                  Upper case
                </Label>
              </div>
            </RadioGroup>
            {state.serialization === "base32" && (
              <div className="flex items-center gap-2">
                <Checkbox
                  id="base32NoPadding"
                  checked={state.base32NoPadding}
                  onCheckedChange={(checked) => setParam("base32NoPadding", checked === true, true)}
                />
                <Label htmlFor="base32NoPadding" className="text-sm cursor-pointer">
                  No Padding
                </Label>
              </div>
            )}
          </div>
        )}

        {state.serialization === "graphic-ascii" && (
          <div className="flex flex-wrap items-center gap-4">
            <Label className="w-28 text-sm font-medium">Graphic</Label>
            <div className="flex items-center gap-2">
              <Checkbox
                id="includeUpper"
                checked={state.includeUpper}
                onCheckedChange={(checked) => setParam("includeUpper", checked === true, true)}
              />
              <Label htmlFor="includeUpper" className="text-sm cursor-pointer">
                Upper letters
              </Label>
            </div>
            <div className="flex items-center gap-2">
              <Checkbox
                id="includeLower"
                checked={state.includeLower}
                onCheckedChange={(checked) => setParam("includeLower", checked === true, true)}
              />
              <Label htmlFor="includeLower" className="text-sm cursor-pointer">
                Lower letters
              </Label>
            </div>
            <div className="flex items-center gap-2">
              <Checkbox
                id="includeNumbers"
                checked={state.includeNumbers}
                onCheckedChange={(checked) => setParam("includeNumbers", checked === true, true)}
              />
              <Label htmlFor="includeNumbers" className="text-sm cursor-pointer">
                Numbers
              </Label>
            </div>
            <div className="flex items-center gap-2 whitespace-nowrap">
              <Checkbox
                id="includeSymbols"
                checked={state.includeSymbols}
                onCheckedChange={(checked) => setParam("includeSymbols", checked === true, true)}
              />
              <Label htmlFor="includeSymbols" className="text-sm cursor-pointer">
                Symbols
              </Label>
              <div className="flex items-center gap-2">
                <Input
                  id="symbols"
                  value={state.symbols}
                  onChange={(e) => setParam("symbols", e.target.value)}
                  disabled={!state.includeSymbols}
                  className="h-8 w-56 font-mono"
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => setParam("symbols", DEFAULT_SYMBOLS, true)}
                  disabled={!state.includeSymbols}
                  className="h-8 px-2 text-xs"
                >
                  Reset
                </Button>
              </div>
            </div>
          </div>
        )}

        <div className="flex flex-col gap-2">
          <div className="flex flex-nowrap items-center gap-4 overflow-x-auto">
            <Label className="w-28 text-sm font-medium">Length Type</Label>
            <RadioGroup
              value={state.lengthType}
              onValueChange={(value) => setParam("lengthType", value, true)}
              className="flex flex-nowrap gap-4"
            >
              <div className="flex items-center gap-2">
                <RadioGroupItem id="length-bytes" value="bytes" />
                <Label htmlFor="length-bytes" className="text-sm cursor-pointer">
                  Bytes
                </Label>
              </div>
              <div className="flex items-center gap-2">
                <RadioGroupItem id="length-chars" value="chars" />
                <Label htmlFor="length-chars" className="text-sm cursor-pointer">
                  Chars
                </Label>
              </div>
            </RadioGroup>
          </div>
          <div className="flex flex-nowrap items-center gap-4 overflow-x-auto">
            <Label className="w-28 text-sm font-medium">Length</Label>
            <RadioGroup
              value={state.lengthPreset}
              onValueChange={(value) => {
                setParam("lengthPreset", value, true)
                if (value !== "custom") {
                  setParam("lengthValue", Number(value), true)
                }
              }}
              className="flex flex-nowrap gap-4"
            >
              {lengthPresets.map((preset) => (
                <div key={preset.value} className="flex items-center gap-2">
                  <RadioGroupItem id={`length-${preset.value}`} value={preset.value} />
                  <Label htmlFor={`length-${preset.value}`} className="text-sm cursor-pointer">
                    {preset.label}
                  </Label>
                </div>
              ))}
            </RadioGroup>
            {state.lengthPreset === "custom" && (
              <div className="flex items-center gap-3 flex-nowrap">
                <Slider
                  value={[state.lengthValue]}
                  min={1}
                  max={1024}
                  step={1}
                  onValueChange={(value) => {
                    const nextValue = value[0] ?? 1
                    setParam("lengthValue", nextValue)
                    if (state.lengthPreset !== "custom") {
                      setParam("lengthPreset", "custom", true)
                    }
                  }}
                  className="w-48 shrink-0"
                />
                <span className="w-14 text-right text-sm text-muted-foreground">{state.lengthValue}</span>
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="flex flex-col items-center justify-center gap-3 border-y border-border py-4">
        <div className="flex items-center gap-2">
          <div className="max-w-[80ch] font-mono text-lg font-semibold tracking-tight break-all">
            {result || "-"}
          </div>
          <Button variant="ghost" size="icon" onClick={onRegenerate} aria-label="Regenerate password">
            <RefreshCw className="h-4 w-4" />
          </Button>
        </div>
        <Input
          id="label"
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          placeholder="Optional label for history"
          className="h-9 w-[40ch]"
        />
        <Button onClick={handleCopy} disabled={!result || !!error}>
          {copied ? (
            <>
              <Check className="h-4 w-4" />
              Saved and Copied
            </>
          ) : (
            <>
              <Copy className="h-4 w-4" />
              Save and Copy
            </>
          )}
        </Button>
      </div>
      {error && <p className="text-xs text-destructive text-center">{error}</p>}
    </div>
  )
}
