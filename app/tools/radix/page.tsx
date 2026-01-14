"use client"

import * as React from "react"
import { Suspense } from "react"
import { z } from "zod"
import { ToolPageWrapper } from "@/components/tool-ui/tool-page-wrapper"
import { useUrlSyncedState } from "@/lib/url-state/use-url-synced-state"
import { Card, CardContent } from "@/components/ui/card"
import { Checkbox } from "@/components/ui/checkbox"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { ArrowLeftRight } from "lucide-react"
import { convertRadix, toBase60, fromBase60, isValidBase60 } from "@/lib/numbers/radix"
import { cn } from "@/lib/utils"

const paramsSchema = z.object({
  leftRadix: z.string().default("10"),
  leftCustomRadix: z.number().default(10),
  leftUpperCase: z.boolean().default(true),
  leftPadding: z.string().default("0"),
  rightRadix: z.string().default("16"),
  rightCustomRadix: z.number().default(16),
  rightUpperCase: z.boolean().default(true),
  rightPadding: z.string().default("0"),
  activeSide: z.enum(["left", "right"]).default("left"),
  leftText: z.string().default(""),
  rightText: z.string().default(""),
})

const RADIX_OPTIONS = [
  { value: "10", label: "Decimal (10)" },
  { value: "16", label: "Hexadecimal (16)" },
  { value: "8", label: "Octal (8)" },
  { value: "2", label: "Binary (2)" },
  { value: "60", label: "Base 60" },
  { value: "custom", label: "Custom" },
]

const PADDING_OPTIONS = ["0", "1", "2", "4", "8"]
const PADDING_OPTIONS_BASE60 = ["0", "2"]

function RadixContent() {
  const { state, setParam } = useUrlSyncedState("radix", {
    schema: paramsSchema,
    defaults: paramsSchema.parse({}),
  })

  const [leftError, setLeftError] = React.useState<string | null>(null)
  const [rightError, setRightError] = React.useState<string | null>(null)

  const getEffectiveRadix = (side: "left" | "right"): number => {
    const radix = side === "left" ? state.leftRadix : state.rightRadix
    const custom = side === "left" ? state.leftCustomRadix : state.rightCustomRadix
    if (radix === "custom") return custom
    return Number.parseInt(radix, 10)
  }

  const getPadding = (side: "left" | "right"): number => {
    const padding = side === "left" ? state.leftPadding : state.rightPadding
    return Number.parseInt(padding, 10)
  }

  const convertValue = React.useCallback(
    (value: string, fromSide: "left" | "right") => {
      const toSide = fromSide === "left" ? "right" : "left"
      const fromRadix = getEffectiveRadix(fromSide)
      const toRadix = getEffectiveRadix(toSide)
      const toUpperCase = toSide === "left" ? state.leftUpperCase : state.rightUpperCase
      const toPadding = getPadding(toSide)

      try {
        if (fromSide === "left") setLeftError(null)
        else setRightError(null)

        if (!value.trim()) {
          setParam(toSide === "left" ? "leftText" : "rightText", "")
          return
        }

        let result: string

        // Handle base60 special case
        if (fromRadix === 60) {
          if (!isValidBase60(value)) throw new Error("Invalid base60 format")
          const decimal = fromBase60(value)
          if (toRadix === 60) {
            result = toBase60(decimal, toPadding as 0 | 2)
          } else {
            result = convertRadix(decimal.toString(), 10, toRadix, {
              upperCase: toUpperCase,
              padding: toPadding,
            })
          }
        } else if (toRadix === 60) {
          const decimal = BigInt(convertRadix(value, fromRadix, 10, { upperCase: true }))
          result = toBase60(decimal, toPadding as 0 | 2)
        } else {
          result = convertRadix(value, fromRadix, toRadix, {
            upperCase: toUpperCase,
            padding: toPadding,
          })
        }

        setParam(toSide === "left" ? "leftText" : "rightText", result)
      } catch (err) {
        if (fromSide === "left") setLeftError(err instanceof Error ? err.message : "Conversion failed")
        else setRightError(err instanceof Error ? err.message : "Conversion failed")
      }
    },
    [state, setParam],
  )

  const handleLeftChange = React.useCallback(
    (value: string) => {
      setParam("leftText", value)
      setParam("activeSide", "left")
      convertValue(value, "left")
    },
    [setParam, convertValue],
  )

  const handleRightChange = React.useCallback(
    (value: string) => {
      setParam("rightText", value)
      setParam("activeSide", "right")
      convertValue(value, "right")
    },
    [setParam, convertValue],
  )

  // Reconvert when params change
  React.useEffect(() => {
    if (state.activeSide === "left" && state.leftText) {
      convertValue(state.leftText, "left")
    } else if (state.activeSide === "right" && state.rightText) {
      convertValue(state.rightText, "right")
    }
  }, [
    state.leftRadix,
    state.leftCustomRadix,
    state.leftUpperCase,
    state.leftPadding,
    state.rightRadix,
    state.rightCustomRadix,
    state.rightUpperCase,
    state.rightPadding,
  ])

  const renderSidePanel = (side: "left" | "right") => {
    const isLeft = side === "left"
    const radix = isLeft ? state.leftRadix : state.rightRadix
    const customRadix = isLeft ? state.leftCustomRadix : state.rightCustomRadix
    const upperCase = isLeft ? state.leftUpperCase : state.rightUpperCase
    const padding = isLeft ? state.leftPadding : state.rightPadding
    const text = isLeft ? state.leftText : state.rightText
    const error = isLeft ? leftError : rightError
    const isActive = state.activeSide === side

    const effectiveRadix = radix === "custom" ? customRadix : Number.parseInt(radix, 10)
    const showPadding = effectiveRadix === 2 || effectiveRadix === 16 || effectiveRadix === 60
    const paddingOptions = effectiveRadix === 60 ? PADDING_OPTIONS_BASE60 : PADDING_OPTIONS

    return (
      <div className="flex flex-1 flex-col gap-3">
        <Card>
          <CardContent className="space-y-4 p-4">
            <div className="space-y-2">
              <Label className="text-xs font-medium text-muted-foreground">Radix</Label>
              <RadioGroup
                value={radix}
                onValueChange={(v) => setParam(isLeft ? "leftRadix" : "rightRadix", v, true)}
                className="grid grid-cols-3 gap-2"
              >
                {RADIX_OPTIONS.map((opt) => (
                  <div key={opt.value} className="flex items-center gap-1.5">
                    <RadioGroupItem value={opt.value} id={`${side}-radix-${opt.value}`} />
                    <Label htmlFor={`${side}-radix-${opt.value}`} className="text-sm cursor-pointer">
                      {opt.label}
                    </Label>
                  </div>
                ))}
              </RadioGroup>
              {radix === "custom" && (
                <Input
                  type="number"
                  min={2}
                  max={36}
                  value={customRadix}
                  onChange={(e) =>
                    setParam(
                      isLeft ? "leftCustomRadix" : "rightCustomRadix",
                      Number.parseInt(e.target.value) || 10,
                      true,
                    )
                  }
                  className="mt-2 w-24"
                  placeholder="2-36"
                />
              )}
            </div>

            <div className="flex flex-wrap items-center gap-4">
              <div className="flex items-center gap-2">
                <Checkbox
                  id={`${side}-uppercase`}
                  checked={upperCase}
                  onCheckedChange={(c) => setParam(isLeft ? "leftUpperCase" : "rightUpperCase", c === true, true)}
                />
                <Label htmlFor={`${side}-uppercase`} className="text-sm cursor-pointer">
                  Upper case
                </Label>
              </div>

              {showPadding && (
                <div className="flex items-center gap-2">
                  <Label className="text-sm">Padding</Label>
                  <Select
                    value={padding}
                    onValueChange={(v) => setParam(isLeft ? "leftPadding" : "rightPadding", v, true)}
                  >
                    <SelectTrigger className="w-20">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {paddingOptions.map((p) => (
                        <SelectItem key={p} value={p}>
                          {p === "0" ? "None" : p}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        <div className="flex-1">
          <Textarea
            value={text}
            onChange={(e) => (isLeft ? handleLeftChange(e.target.value) : handleRightChange(e.target.value))}
            onFocus={() => setParam("activeSide", side, true)}
            placeholder={`Enter ${effectiveRadix === 60 ? "base60 (xx:xx:xx)" : `base ${effectiveRadix}`} number...`}
            className={cn(
              "h-full min-h-[150px] resize-none font-mono",
              error && "border-destructive",
              isActive && "ring-1 ring-primary",
            )}
          />
          {error && <p className="mt-1 text-xs text-destructive">{error}</p>}
        </div>
      </div>
    )
  }

  return (
    <ToolPageWrapper
      toolId="radix"
      title="Base Conversion"
      description="Convert numbers between different bases (radixes)"
      seoContent={<RadixSEOContent />}
    >
      {() => (
        <div className="flex min-h-[400px] gap-4">
          {renderSidePanel("left")}
          <div className="flex items-center">
            <ArrowLeftRight className="h-5 w-5 text-muted-foreground" />
          </div>
          {renderSidePanel("right")}
        </div>
      )}
    </ToolPageWrapper>
  )
}

function RadixSEOContent() {
  return (
    <div className="prose prose-sm dark:prose-invert max-w-none">
      <h2>What is Base Conversion?</h2>
      <p>
        Base conversion (or radix conversion) is the process of converting numbers from one numeral system to another.
        Common bases include binary (base 2), octal (base 8), decimal (base 10), and hexadecimal (base 16).
      </p>

      <h2>Common Use Cases</h2>
      <ul>
        <li>Converting between binary and hexadecimal in programming</li>
        <li>Understanding memory addresses and byte values</li>
        <li>Converting Unix timestamps to base60 (time format)</li>
        <li>Working with custom numeral systems</li>
      </ul>

      <h2>FAQ</h2>
      <h3>What is Base 60?</h3>
      <p>
        Base 60 (sexagesimal) is used in time measurement. Our converter displays it in time-like format (xx:xx:xx)
        where each segment represents a value from 0-59.
      </p>
    </div>
  )
}

export default function RadixPage() {
  return (
    <Suspense>
      <RadixContent />
    </Suspense>
  )
}
