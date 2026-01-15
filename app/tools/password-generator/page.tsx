"use client"

import * as React from "react"
import { Suspense } from "react"
import { z } from "zod"
import { ToolPageWrapper, useToolHistoryContext } from "@/components/tool-ui/tool-page-wrapper"
import { useUrlSyncedState } from "@/lib/url-state/use-url-synced-state"
import { useSearchParams } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Checkbox } from "@/components/ui/checkbox"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { Check, Copy, RefreshCw } from "lucide-react"
import {
  DEFAULT_SYMBOLS,
  generatePassword,
  type PasswordGeneratorOptions,
  type PasswordSerialization,
  type CaseMode,
  type LengthType,
} from "@/lib/crypto/password-generator"

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
  const searchParams = useSearchParams()
  const searchParamString = searchParams.toString()
  const { state, setParam, setStateSilently } = useUrlSyncedState("password-generator", {
    schema: paramsSchema,
    defaults: paramsSchema.parse({}),
    restoreFromHistory: false,
    initialSearch: searchParamString,
  })

  const [label, setLabel] = React.useState("")
  const [result, setResult] = React.useState("")
  const [error, setError] = React.useState<string | null>(null)
  const hasUrlParams = React.useMemo(
    () => Array.from(searchParams.keys()).some((key) => key in paramsSchema.shape),
    [searchParams],
  )
  const paramsForHistory = React.useMemo(
    () => ({
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
      state.lengthPreset,
      state.lengthValue,
    ],
  )

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
    if (typeof window === "undefined") return
    generate()
  }, [generate])

  React.useEffect(() => {
    if (state.lengthPreset === "custom") return
    const presetValue = Number(state.lengthPreset)
    if (!Number.isNaN(presetValue) && state.lengthValue !== presetValue) {
      setParam("lengthValue", presetValue, true)
    }
  }, [state.lengthPreset, state.lengthValue, setParam])

  return (
    <ToolPageWrapper
      toolId="password-generator"
      title="Password Generator"
      description="Generate secure passwords with multiple serialization modes and length presets"
      onLoadHistory={() => {}}
      historyVariant="password-generator"
    >
      <PasswordGeneratorInner
        state={state}
        setParam={setParam}
        setStateSilently={setStateSilently}
        label={label}
        setLabel={setLabel}
        result={result}
        error={error}
        onRegenerate={generate}
        hasUrlParams={hasUrlParams}
        paramsForHistory={paramsForHistory}
      />
    </ToolPageWrapper>
  )
}

function PasswordGeneratorInner({
  state,
  setParam,
  setStateSilently,
  label,
  setLabel,
  result,
  error,
  onRegenerate,
  hasUrlParams,
  paramsForHistory,
}: {
  state: z.infer<typeof paramsSchema>
  setParam: (key: string, value: unknown, immediate?: boolean) => void
  setStateSilently: (
    updater: z.infer<typeof paramsSchema> | ((prev: z.infer<typeof paramsSchema>) => z.infer<typeof paramsSchema>),
  ) => void
  label: string
  setLabel: (value: string) => void
  result: string
  error: string | null
  onRegenerate: () => void
  hasUrlParams: boolean
  paramsForHistory: Record<string, unknown>
}) {
  const { entries, loading, addHistoryEntry, updateHistoryParams, updateLatestEntry } = useToolHistoryContext()
  const [copied, setCopied] = React.useState(false)
  const historyInitializedRef = React.useRef(false)

  const handleCopy = async () => {
    if (!result || error) return
    await navigator.clipboard.writeText(result)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)

    const preview = label ? `${label}: ${result}` : result
    if (entries.length === 0) {
      const saved = await addHistoryEntry({ label, password: result }, paramsForHistory, "left", preview.slice(0, 100))
      if (saved) {
        await addHistoryEntry({}, paramsForHistory)
      }
      return
    }

    await updateLatestEntry({ inputs: { label, password: result }, preview: preview.slice(0, 100) })
    await addHistoryEntry({}, paramsForHistory)
  }

  React.useEffect(() => {
    if (loading || historyInitializedRef.current) return

    if (entries.length === 0) {
      addHistoryEntry({}, paramsForHistory)
      historyInitializedRef.current = true
      return
    }

    if (hasUrlParams) {
      updateHistoryParams(paramsForHistory)
      historyInitializedRef.current = true
      return
    }

    const defaults = paramsSchema.parse({})
    const latest = entries[0]
    const merged = { ...defaults, ...latest.params }
    const parsed = paramsSchema.safeParse(merged)
    if (parsed.success) {
      setStateSilently(parsed.data)
      const hasSavedValue = Boolean(latest.inputs?.label || latest.inputs?.password)
      if (hasSavedValue) {
        addHistoryEntry({}, parsed.data)
      }
    }

    historyInitializedRef.current = true
  }, [
    addHistoryEntry,
    entries,
    hasUrlParams,
    loading,
    paramsForHistory,
    setStateSilently,
    updateHistoryParams,
  ])

  React.useEffect(() => {
    if (!historyInitializedRef.current) return
    updateHistoryParams(paramsForHistory)
  }, [paramsForHistory, updateHistoryParams])

  return (
    <div className="mx-auto flex min-h-[calc(100vh-220px)] w-full max-w-5xl flex-col justify-center gap-6 py-6">
      <div className="flex flex-col gap-5">
        <div className="flex flex-wrap items-center justify-start">
          <Label className="w-28 text-sm font-medium">Serialization</Label>
          <RadioGroup
            value={state.serialization}
            onValueChange={(value) => setParam("serialization", value, true)}
            className="flex flex-wrap"
          >
            {[
              { value: "graphic-ascii", label: "Graphic ASCII" },
              { value: "base64", label: "Base64" },
              { value: "hex", label: "Hex" },
              { value: "base58", label: "Base58" },
              { value: "base45", label: "Base45" },
              { value: "base32", label: "Base32" },
            ].map((item) => (
              <div key={item.value} className="mr-5 flex items-center gap-2">
                <RadioGroupItem id={`serialization-${item.value}`} value={item.value} />
                <Label htmlFor={`serialization-${item.value}`} className="text-sm cursor-pointer">
                  {item.label}
                </Label>
              </div>
            ))}
          </RadioGroup>
        </div>

        {state.serialization === "base64" && (
          <div className="flex flex-wrap items-center justify-start">
            <div className="w-28 shrink-0" />
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
            <div className="ml-5 flex items-center gap-2">
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
          <div className="flex flex-wrap items-center justify-start">
            <div className="w-28 shrink-0" />
            <RadioGroup
              value={state.caseMode}
              onValueChange={(value) => setParam("caseMode", value, true)}
              className="flex flex-wrap"
            >
              <div className="mr-5 flex items-center gap-2">
                <RadioGroupItem id="case-lower" value="lower" />
                <Label htmlFor="case-lower" className="text-sm cursor-pointer">
                  Lower case
                </Label>
              </div>
              <div className="mr-5 flex items-center gap-2">
                <RadioGroupItem id="case-upper" value="upper" />
                <Label htmlFor="case-upper" className="text-sm cursor-pointer">
                  Upper case
                </Label>
              </div>
            </RadioGroup>
            {state.serialization === "base32" && (
              <div className="mr-5 flex items-center gap-2">
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
          <div className="flex flex-wrap items-center justify-start">
            <div className="w-28 shrink-0" />
            <div className="mr-5 flex items-center gap-2">
              <Checkbox
                id="includeUpper"
                checked={state.includeUpper}
                onCheckedChange={(checked) => setParam("includeUpper", checked === true, true)}
              />
              <Label htmlFor="includeUpper" className="text-sm cursor-pointer">
                Upper letters
              </Label>
            </div>
            <div className="mr-5 flex items-center gap-2">
              <Checkbox
                id="includeLower"
                checked={state.includeLower}
                onCheckedChange={(checked) => setParam("includeLower", checked === true, true)}
              />
              <Label htmlFor="includeLower" className="text-sm cursor-pointer">
                Lower letters
              </Label>
            </div>
            <div className="mr-5 flex items-center gap-2">
              <Checkbox
                id="includeNumbers"
                checked={state.includeNumbers}
                onCheckedChange={(checked) => setParam("includeNumbers", checked === true, true)}
              />
              <Label htmlFor="includeNumbers" className="text-sm cursor-pointer">
                Numbers
              </Label>
            </div>
            <div className="mr-5 flex items-center gap-2 whitespace-nowrap">
              <Checkbox
                id="includeSymbols"
                checked={state.includeSymbols}
                onCheckedChange={(checked) => setParam("includeSymbols", checked === true, true)}
              />
              <Label htmlFor="includeSymbols" className="text-sm cursor-pointer">
                Symbols
              </Label>
              <div className="relative flex items-center">
                <Input
                  id="symbols"
                  value={state.symbols}
                  onChange={(e) => setParam("symbols", e.target.value)}
                  disabled={!state.includeSymbols}
                  className="h-9 w-[calc(36ch+5em)] pr-16 font-mono"
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => setParam("symbols", DEFAULT_SYMBOLS, true)}
                  disabled={!state.includeSymbols}
                  className="absolute right-1 top-1/2 h-7 -translate-y-1/2 px-2 text-xs"
                >
                  Reset
                </Button>
              </div>
            </div>
          </div>
        )}

        <div className="flex flex-wrap items-center justify-start">
          <Label className="w-28 text-sm font-medium">Length Type</Label>
          <RadioGroup
            value={state.lengthType}
            onValueChange={(value) => setParam("lengthType", value, true)}
            className="flex flex-wrap"
          >
            <div className="mr-5 flex items-center gap-2">
              <RadioGroupItem id="length-bytes" value="bytes" />
              <Label htmlFor="length-bytes" className="text-sm cursor-pointer">
                Bytes
              </Label>
            </div>
            <div className="mr-5 flex items-center gap-2">
              <RadioGroupItem id="length-chars" value="chars" />
              <Label htmlFor="length-chars" className="text-sm cursor-pointer">
                Chars
              </Label>
            </div>
          </RadioGroup>
        </div>
        <div className="flex flex-wrap items-center justify-start">
          <Label className="w-28 text-sm font-medium">Length</Label>
          <RadioGroup
            value={state.lengthPreset}
            onValueChange={(value) => {
              setParam("lengthPreset", value, true)
              if (value !== "custom") {
                setParam("lengthValue", Number(value), true)
              }
            }}
            className="flex flex-wrap"
          >
            {lengthPresets.map((preset) => (
              <div key={preset.value} className="mr-4 flex items-center gap-2">
                <RadioGroupItem id={`length-${preset.value}`} value={preset.value} />
                <Label htmlFor={`length-${preset.value}`} className="text-sm cursor-pointer">
                  {preset.label}
                </Label>
              </div>
            ))}
          </RadioGroup>
          {state.lengthPreset === "custom" && (
            <div className="mr-4 flex items-center gap-2 flex-nowrap">
              <Input
                type="number"
                min={1}
                max={1024}
                value={state.lengthValue}
                onChange={(e) => {
                  const nextValue = Math.max(1, Math.min(1024, Number(e.target.value) || 1))
                  setParam("lengthValue", nextValue, true)
                }}
                className="h-9 w-20"
              />
              <span className="text-sm text-muted-foreground">1-1024</span>
            </div>
          )}
        </div>
      </div>

      <div className="flex flex-col items-center justify-center gap-4 border-y border-border py-5">
        <div className="flex items-center gap-3">
          <div className="max-w-[80ch] font-mono text-lg font-semibold tracking-tight break-all">
            {result || "-"}
          </div>
          <Button variant="ghost" size="icon" onClick={onRegenerate} aria-label="Regenerate password">
            <RefreshCw className="h-4 w-4" />
          </Button>
        </div>
        <div className="flex items-center gap-3">
          <Input
            id="label"
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            placeholder="Optional label for history"
            className="h-9 w-[20ch]"
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
      </div>
      {error && <p className="text-xs text-destructive text-center">{error}</p>}
    </div>
  )
}
