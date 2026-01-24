"use client"

import * as React from "react"
import { Suspense, useCallback, useRef, useState, useEffect, useMemo } from "react"
import {
  Copy,
  Check,
  AlertTriangle,
  Clock,
  ChevronRight,
  Plus,
  Trash2,
} from "lucide-react"
import { ToolPageWrapper } from "@/components/tool-ui/tool-page-wrapper"
import { Card, CardContent } from "@/components/ui/card"
import { Textarea } from "@/components/ui/textarea"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import {
  testRegex,
  parseFullPattern,
  convertFullPattern,
  formatFullPattern,
  FLAVOR_INFO,
  COMMON_PATTERNS,
  type RegexFlavor,
  type RegexMatch,
  type RegexTestResult,
} from "@/lib/regex/engine"
import { tokenizeRegex, TOKEN_CLASSES } from "@/lib/regex/highlighter"

// Syntax-highlighted regex display
function HighlightedRegex({ pattern }: { pattern: string }) {
  const tokens = useMemo(() => tokenizeRegex(pattern), [pattern])

  return (
    <span className="font-mono whitespace-pre-wrap break-all">
      {tokens.map((token, i) => (
        <span key={i} className={TOKEN_CLASSES[token.type]}>
          {token.value}
        </span>
      ))}
    </span>
  )
}

// Single test string with results
function TestStringItem({
  id,
  value,
  onChange,
  onRemove,
  canRemove,
  result,
}: {
  id: string
  value: string
  onChange: (value: string) => void
  onRemove: () => void
  canRemove: boolean
  result: RegexTestResult | null
}) {
  return (
    <div className="group relative">
      {/* Input with inline results */}
      <div className="relative">
        <Textarea
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="Enter test string..."
          className="font-mono text-sm min-h-[80px] pr-24 resize-y"
        />
        <div className="absolute right-2 top-2 flex items-center gap-1">
          {result && value && (
            <Badge
              variant={result.matches.length > 0 ? "default" : "secondary"}
              className="text-xs"
            >
              {result.matches.length} match{result.matches.length !== 1 ? "es" : ""}
            </Badge>
          )}
          {canRemove && (
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity"
              onClick={onRemove}
            >
              <Trash2 className="h-3.5 w-3.5 text-muted-foreground hover:text-destructive" />
            </Button>
          )}
        </div>
        {result && value && (
          <div className="absolute right-2 bottom-2">
            <span className="text-[10px] text-muted-foreground flex items-center gap-1">
              <Clock className="h-2.5 w-2.5" />
              {result.executionTime.toFixed(2)}ms
            </span>
          </div>
        )}
      </div>

      {/* Highlighted matches - shown below */}
      {result && value && result.matches.length > 0 && (
        <div className="mt-1.5 p-2 bg-muted/40 rounded border text-sm font-mono break-all whitespace-pre-wrap">
          <HighlightedTestString testString={value} matches={result.matches} />
        </div>
      )}

      {/* Match details with groups */}
      {result && value && result.matches.length > 0 && (
        <div className="mt-2 space-y-1.5">
          {result.matches.map((match, idx) => (
            <div key={idx} className="text-xs border rounded p-2 bg-muted/20">
              {/* Match header */}
              <div className="flex items-center gap-2 flex-wrap">
                <Badge variant="outline" className="font-mono text-xs">
                  Match {idx + 1}
                </Badge>
                <span className="text-muted-foreground font-mono">
                  [{match.index}:{match.index + match.length}]
                </span>
                <code className="bg-yellow-200 dark:bg-yellow-800 px-1 py-0.5 rounded font-mono">
                  {match.value || "(empty)"}
                </code>
              </div>

              {/* Groups */}
              {match.groups.length > 0 && (
                <div className="mt-1.5 pt-1.5 border-t flex flex-wrap gap-x-4 gap-y-1">
                  {match.groups.map((g, i) => (
                    <div key={i} className="flex items-center gap-1 font-mono">
                      <span className="text-muted-foreground">
                        {g.name ? (
                          <span>
                            <span className="text-green-600 dark:text-green-400">{g.name}</span>
                            <span className="opacity-50"> (${g.index})</span>
                          </span>
                        ) : (
                          <span>${g.index}</span>
                        )}
                        :
                      </span>
                      {g.value !== undefined ? (
                        <code className="bg-blue-100 dark:bg-blue-900 px-1 py-0.5 rounded">
                          {g.value || "(empty)"}
                        </code>
                      ) : (
                        <span className="text-muted-foreground italic">unmatched</span>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Error */}
      {result?.error && (
        <Alert variant="destructive" className="mt-1.5 py-2">
          <AlertTriangle className="h-3 w-3" />
          <AlertDescription className="text-xs">{result.error}</AlertDescription>
        </Alert>
      )}
    </div>
  )
}

// Highlighted test string with matches
function HighlightedTestString({
  testString,
  matches,
}: {
  testString: string
  matches: RegexMatch[]
}) {
  if (matches.length === 0) {
    return <span>{testString}</span>
  }

  const segments: React.ReactNode[] = []
  let lastEnd = 0
  const sortedMatches = [...matches].sort((a, b) => a.index - b.index)

  for (const match of sortedMatches) {
    if (match.index < lastEnd) continue
    if (match.index > lastEnd) {
      segments.push(<span key={`t-${lastEnd}`}>{testString.slice(lastEnd, match.index)}</span>)
    }
    segments.push(
      <span key={`m-${match.index}`} className="bg-yellow-300 dark:bg-yellow-700 rounded-sm px-0.5">
        {match.value}
      </span>
    )
    lastEnd = match.index + match.length
  }
  if (lastEnd < testString.length) {
    segments.push(<span key={`t-${lastEnd}`}>{testString.slice(lastEnd)}</span>)
  }

  return <>{segments}</>
}

// Single flavor conversion row
function FlavorConversionRow({
  flavor,
  sourcePattern,
  sourceFlavor,
}: {
  flavor: RegexFlavor
  sourcePattern: string
  sourceFlavor: RegexFlavor
}) {
  const [copied, setCopied] = useState(false)

  const conversion = useMemo(() => {
    if (!sourcePattern.trim() || flavor === sourceFlavor) return null
    return convertFullPattern(sourcePattern, sourceFlavor, flavor)
  }, [sourcePattern, sourceFlavor, flavor])

  if (flavor === sourceFlavor || !conversion) return null

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(conversion.output)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {}
  }

  const hasIssues = conversion.warnings.length > 0

  return (
    <div className={`group flex items-start gap-3 p-2 rounded-lg hover:bg-muted/30 transition-colors ${hasIssues ? "bg-destructive/5" : ""}`}>
      <div className="w-24 flex-shrink-0 pt-0.5">
        <span className="text-sm font-medium">{FLAVOR_INFO[flavor].name}</span>
      </div>
      <div className="flex-1 min-w-0">
        <div className="font-mono text-sm break-all">
          <HighlightedRegex pattern={conversion.output} />
        </div>
        {(conversion.changes.length > 0 || conversion.warnings.length > 0) && (
          <div className="mt-1 text-xs space-y-0.5">
            {conversion.changes.length > 0 && (
              <div className="text-muted-foreground">{conversion.changes.join(", ")}</div>
            )}
            {conversion.warnings.length > 0 && (
              <div className="text-destructive flex items-center gap-1">
                <AlertTriangle className="h-3 w-3" />
                {conversion.warnings.join("; ")}
              </div>
            )}
          </div>
        )}
      </div>
      <Button
        variant="ghost"
        size="icon"
        className="h-6 w-6 flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity"
        onClick={handleCopy}
      >
        {copied ? <Check className="h-3 w-3 text-green-500" /> : <Copy className="h-3 w-3" />}
      </Button>
    </div>
  )
}

// Flag name mappings
const FLAG_NAMES: Record<string, string> = {
  g: "Global",
  i: "Ignore case",
  m: "Multiline",
  s: "Dotall",
  u: "Unicode",
  v: "Unicode sets",
  y: "Sticky",
  d: "Indices",
  x: "Extended",
  U: "Ungreedy",
  J: "Duplicate names",
  A: "Anchored",
  D: "Dollar end only",
  a: "ASCII only",
  L: "Locale",
  n: "Explicit capture",
}

function RegexContent() {
  const [fullPattern, setFullPattern] = useState("")
  const [inputFlavor, setInputFlavor] = useState<RegexFlavor>("ecmascript")
  const [testStrings, setTestStrings] = useState<{ id: string; value: string }[]>([
    { id: "1", value: "" },
  ])
  const [copied, setCopied] = useState(false)
  const [showReference, setShowReference] = useState(false)
  const [showConvert, setShowConvert] = useState(false)

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const [results, setResults] = useState<Record<string, RegexTestResult | null>>({})

  // Parse the full pattern
  const parsedInput = useMemo(() => {
    return parseFullPattern(fullPattern, inputFlavor)
  }, [fullPattern, inputFlavor])

  // Convert to ECMAScript for testing
  const ecmascriptConversion = useMemo(() => {
    if (!fullPattern.trim()) return null
    if (inputFlavor === "ecmascript") {
      return { output: fullPattern, outputPattern: parsedInput.pattern, outputFlags: parsedInput.flags || "g", warnings: [], changes: [] }
    }
    return convertFullPattern(fullPattern, inputFlavor, "ecmascript")
  }, [fullPattern, inputFlavor, parsedInput])

  const testPattern = ecmascriptConversion?.outputPattern || parsedInput.pattern
  const testFlags = useMemo(() => {
    if (ecmascriptConversion) {
      const flags = ecmascriptConversion.outputFlags || ""
      return flags.includes("g") ? flags : "g" + flags
    }
    return "g"
  }, [ecmascriptConversion])

  // Validate regex early to show errors under input
  const regexError = useMemo(() => {
    if (!testPattern) return null
    try {
      new RegExp(testPattern, testFlags)
      return null
    } catch (e) {
      return e instanceof Error ? e.message : "Invalid regular expression"
    }
  }, [testPattern, testFlags])

  // Debounced test execution
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current)

    debounceRef.current = setTimeout(() => {
      const newResults: Record<string, RegexTestResult | null> = {}
      for (const ts of testStrings) {
        if (testPattern && ts.value) {
          newResults[ts.id] = testRegex(testPattern, testFlags, ts.value)
        } else {
          newResults[ts.id] = null
        }
      }
      setResults(newResults)
    }, 300)

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current)
    }
  }, [testPattern, testFlags, testStrings])

  // Total match count
  const totalMatches = useMemo(() => {
    return Object.values(results).reduce((sum, r) => sum + (r?.matches.length || 0), 0)
  }, [results])

  const handleCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(fullPattern)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {}
  }, [fullPattern])

  const handlePresetSelect = useCallback((preset: (typeof COMMON_PATTERNS)[0]) => {
    const formatted = formatFullPattern(preset.pattern, "g", inputFlavor)
    setFullPattern(formatted)
  }, [inputFlavor])

  const addTestString = useCallback(() => {
    setTestStrings((prev) => [...prev, { id: Date.now().toString(), value: "" }])
  }, [])

  const removeTestString = useCallback((id: string) => {
    setTestStrings((prev) => prev.filter((ts) => ts.id !== id))
  }, [])

  const updateTestString = useCallback((id: string, value: string) => {
    setTestStrings((prev) => prev.map((ts) => (ts.id === id ? { ...ts, value } : ts)))
  }, [])

  const flavorInfo = FLAVOR_INFO[inputFlavor]

  return (
    <TooltipProvider>
      <ToolPageWrapper
        toolId="regex"
        title="Regex Tester & Converter"
        description="Test regular expressions and convert between ECMAScript, RE2, PCRE, Python, and more"
      >
        <div className="space-y-4">
          {/* Pattern Input - Clean, Prominent */}
          <Card>
            <CardContent className="p-4">
              <div className="space-y-3">
                {/* Flavor Select */}
                <div className="flex items-center gap-2">
                  <Label className="text-sm text-muted-foreground">Syntax</Label>
                  <Select
                    value={inputFlavor}
                    onValueChange={(v) => setInputFlavor(v as RegexFlavor)}
                  >
                    <SelectTrigger className="w-[220px]" style={{ height: 44 }}>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {Object.values(FLAVOR_INFO).map((info) => (
                        <SelectItem key={info.id} value={info.id}>
                          {info.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Pattern Input */}
                <div className="relative">
                  <Textarea
                    value={fullPattern}
                    onChange={(e) => setFullPattern(e.target.value)}
                    placeholder={
                      inputFlavor === "ecmascript" ? "/pattern/flags" :
                      inputFlavor === "python" ? "(?flags)pattern or r\"pattern\"" :
                      "(?flags)pattern"
                    }
                    className="font-mono text-base min-h-[44px] pr-10 resize-none"
                    rows={1}
                    onInput={(e) => {
                      const target = e.target as HTMLTextAreaElement
                      target.style.height = "auto"
                      target.style.height = Math.min(target.scrollHeight, 120) + "px"
                    }}
                  />
                  <div className="absolute right-2 top-1/2 -translate-y-1/2">
                    <Button variant="ghost" size="icon" className="h-7 w-7" onClick={handleCopy}>
                      {copied ? <Check className="h-4 w-4 text-green-500" /> : <Copy className="h-4 w-4" />}
                    </Button>
                  </div>
                </div>

                {/* Highlighted Pattern Display */}
                {fullPattern.trim() && (
                  <div className="flex items-start justify-between gap-4 p-3 bg-muted/40 rounded-lg border">
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-mono break-all leading-relaxed">
                        <HighlightedRegex pattern={fullPattern} />
                      </div>
                      {(parsedInput.flags || parsedInput.inlineFlags) && (
                        <div className="flex flex-wrap gap-1.5 mt-2">
                          {parsedInput.flags?.split("").map((f) => (
                            <Badge key={f} variant="secondary" className="text-xs font-normal">
                              {FLAG_NAMES[f] || f} <span className="opacity-60 ml-0.5">({f})</span>
                            </Badge>
                          ))}
                          {parsedInput.inlineFlags?.split("").map((f) => (
                            <Badge key={`i-${f}`} variant="outline" className="text-xs font-normal">
                              {FLAG_NAMES[f] || f} <span className="opacity-60 ml-0.5">(inline)</span>
                            </Badge>
                          ))}
                        </div>
                      )}
                    </div>
                    {totalMatches > 0 && (
                      <Badge variant="default" className="flex-shrink-0">
                        {totalMatches} match{totalMatches !== 1 ? "es" : ""}
                      </Badge>
                    )}
                  </div>
                )}

                {/* Parse Error */}
                {!parsedInput.isValid && parsedInput.error && (
                  <Alert variant="destructive" className="py-2">
                    <AlertTriangle className="h-4 w-4" />
                    <AlertDescription className="text-sm">{parsedInput.error}</AlertDescription>
                  </Alert>
                )}

                {/* Regex Validation Error */}
                {parsedInput.isValid && regexError && (
                  <Alert variant="destructive" className="py-2">
                    <AlertTriangle className="h-4 w-4" />
                    <AlertDescription className="text-sm">{regexError}</AlertDescription>
                  </Alert>
                )}

                {/* Common Patterns */}
                <div className="flex flex-wrap gap-1.5">
                  {COMMON_PATTERNS.slice(0, 8).map((preset) => (
                    <Tooltip key={preset.name}>
                      <TooltipTrigger asChild>
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-7 text-xs"
                          onClick={() => handlePresetSelect(preset)}
                        >
                          {preset.name}
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent side="bottom">
                        <p className="font-mono text-xs">{preset.pattern}</p>
                        <p className="text-muted-foreground text-xs mt-0.5">{preset.description}</p>
                      </TooltipContent>
                    </Tooltip>
                  ))}
                  {COMMON_PATTERNS.length > 8 && (
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button variant="ghost" size="sm" className="h-7 text-xs text-muted-foreground">
                          +{COMMON_PATTERNS.length - 8} more
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent side="bottom" className="max-w-xs">
                        <div className="grid grid-cols-2 gap-1">
                          {COMMON_PATTERNS.slice(8).map((preset) => (
                            <Button
                              key={preset.name}
                              variant="ghost"
                              size="sm"
                              className="h-auto py-1 px-2 text-xs justify-start"
                              onClick={() => handlePresetSelect(preset)}
                            >
                              {preset.name}
                            </Button>
                          ))}
                        </div>
                      </TooltipContent>
                    </Tooltip>
                  )}
                </div>

                {/* Quick Reference - Collapsible */}
                <Collapsible open={showReference} onOpenChange={setShowReference}>
                  <CollapsibleTrigger className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors">
                    <ChevronRight className="h-3 w-3 transition-transform [[data-state=open]_&]:rotate-90" />
                    <span>Reference & {flavorInfo.name} Info</span>
                  </CollapsibleTrigger>
                  <CollapsibleContent>
                    <div className="mt-2 pt-3 border-t space-y-4">
                      {/* Flavor Flags & Features */}
                      <div className="space-y-2 text-xs">
                        <div className="font-medium text-sm">{flavorInfo.name} Flavor</div>

                        {/* Supported Flags */}
                        <div className="flex flex-wrap gap-x-4 gap-y-1">
                          <span className="text-muted-foreground w-28 flex-shrink-0">Supported Flags:</span>
                          <div className="flex flex-wrap gap-1">
                            {flavorInfo.flags.map((f) => (
                              <Badge key={f} variant="secondary" className="text-xs font-normal">
                                {FLAG_NAMES[f] || f} <code className="ml-0.5 opacity-60">({f})</code>
                              </Badge>
                            ))}
                          </div>
                        </div>

                        {/* Unsupported Flags */}
                        {(() => {
                          const ALL_FLAGS = ["g", "i", "m", "s", "u", "x", "U", "y", "d", "v", "J", "A", "D", "a", "L", "n"]
                          const unsupportedFlags = ALL_FLAGS.filter(f => !flavorInfo.flags.includes(f))
                          if (unsupportedFlags.length === 0) return null
                          return (
                            <div className="flex flex-wrap gap-x-4 gap-y-1">
                              <span className="text-muted-foreground w-28 flex-shrink-0">Unsupported Flags:</span>
                              <div className="flex flex-wrap gap-1">
                                {unsupportedFlags.map((f) => (
                                  <Badge key={f} variant="outline" className="text-xs font-normal text-muted-foreground">
                                    {FLAG_NAMES[f] || f} <code className="ml-0.5 opacity-60">({f})</code>
                                  </Badge>
                                ))}
                              </div>
                            </div>
                          )
                        })()}

                        {/* Supported Features */}
                        <div className="flex flex-wrap gap-x-4 gap-y-1">
                          <span className="text-muted-foreground w-28 flex-shrink-0">Supported:</span>
                          <div className="flex flex-wrap gap-1">
                            {flavorInfo.features.map((f, i) => (
                              <Badge key={i} variant="secondary" className="text-xs font-normal">{f}</Badge>
                            ))}
                          </div>
                        </div>

                        {/* Unsupported Features */}
                        {flavorInfo.unsupported.length > 0 && (
                          <div className="flex flex-wrap gap-x-4 gap-y-1">
                            <span className="text-muted-foreground w-28 flex-shrink-0">Unsupported:</span>
                            <div className="flex flex-wrap gap-1">
                              {flavorInfo.unsupported.map((f, i) => (
                                <Badge key={i} variant="outline" className="text-xs font-normal text-destructive">{f}</Badge>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>

                      {/* Syntax Reference */}
                      <div className="pt-3 border-t">
                        <div className="font-medium text-sm mb-2">Syntax Reference</div>
                        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-4 text-xs">
                          <div>
                            <div className="font-medium mb-1.5 text-muted-foreground">Character Classes</div>
                            <div className="space-y-0.5 font-mono">
                              <div><code className="text-cyan-600 dark:text-cyan-400">[abc]</code> <span className="text-muted-foreground">a, b, or c</span></div>
                              <div><code className="text-cyan-600 dark:text-cyan-400">[^abc]</code> <span className="text-muted-foreground">not a,b,c</span></div>
                              <div><code className="text-amber-600 dark:text-amber-400">\d</code> <span className="text-muted-foreground">digit</span></div>
                              <div><code className="text-amber-600 dark:text-amber-400">\w</code> <span className="text-muted-foreground">word char</span></div>
                              <div><code className="text-amber-600 dark:text-amber-400">\s</code> <span className="text-muted-foreground">whitespace</span></div>
                            </div>
                          </div>
                          <div>
                            <div className="font-medium mb-1.5 text-muted-foreground">Quantifiers</div>
                            <div className="space-y-0.5 font-mono">
                              <div><code className="text-purple-600 dark:text-purple-400">*</code> <span className="text-muted-foreground">0 or more</span></div>
                              <div><code className="text-purple-600 dark:text-purple-400">+</code> <span className="text-muted-foreground">1 or more</span></div>
                              <div><code className="text-purple-600 dark:text-purple-400">?</code> <span className="text-muted-foreground">0 or 1</span></div>
                              <div><code className="text-purple-600 dark:text-purple-400">{"{n,m}"}</code> <span className="text-muted-foreground">n to m</span></div>
                              <div><code className="text-purple-600 dark:text-purple-400">*?</code> <span className="text-muted-foreground">lazy</span></div>
                            </div>
                          </div>
                          <div>
                            <div className="font-medium mb-1.5 text-muted-foreground">Anchors</div>
                            <div className="space-y-0.5 font-mono">
                              <div><code className="text-pink-600 dark:text-pink-400">^</code> <span className="text-muted-foreground">start</span></div>
                              <div><code className="text-pink-600 dark:text-pink-400">$</code> <span className="text-muted-foreground">end</span></div>
                              <div><code className="text-amber-600 dark:text-amber-400">\b</code> <span className="text-muted-foreground">word boundary</span></div>
                            </div>
                          </div>
                          <div>
                            <div className="font-medium mb-1.5 text-muted-foreground">Groups</div>
                            <div className="space-y-0.5 font-mono">
                              <div><code className="text-blue-600 dark:text-blue-400">(abc)</code> <span className="text-muted-foreground">capture</span></div>
                              <div><code className="text-blue-600 dark:text-blue-400">(?:abc)</code> <span className="text-muted-foreground">non-capture</span></div>
                              <div><code className="text-blue-600 dark:text-blue-400">{"(?<n>)"}</code> <span className="text-muted-foreground">named</span></div>
                              <div><code className="text-amber-600 dark:text-amber-400">\1</code> <span className="text-muted-foreground">backref</span></div>
                            </div>
                          </div>
                          <div>
                            <div className="font-medium mb-1.5 text-muted-foreground">Lookaround</div>
                            <div className="space-y-0.5 font-mono">
                              <div><code className="text-blue-600 dark:text-blue-400">(?=)</code> <span className="text-muted-foreground">lookahead</span></div>
                              <div><code className="text-blue-600 dark:text-blue-400">(?!)</code> <span className="text-muted-foreground">neg ahead</span></div>
                              <div><code className="text-blue-600 dark:text-blue-400">{"(?<=)"}</code> <span className="text-muted-foreground">lookbehind</span></div>
                              <div><code className="text-blue-600 dark:text-blue-400">{"(?<!)"}</code> <span className="text-muted-foreground">neg behind</span></div>
                            </div>
                          </div>
                          <div>
                            <div className="font-medium mb-1.5 text-muted-foreground">Special</div>
                            <div className="space-y-0.5 font-mono">
                              <div><code className="text-red-600 dark:text-red-400">|</code> <span className="text-muted-foreground">alternation</span></div>
                              <div><code className="text-orange-600 dark:text-orange-400">.</code> <span className="text-muted-foreground">any char</span></div>
                              <div><code className="text-amber-600 dark:text-amber-400">\</code> <span className="text-muted-foreground">escape</span></div>
                              <div><code className="text-emerald-600 dark:text-emerald-400">\p{"{}"}</code> <span className="text-muted-foreground">unicode</span></div>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </CollapsibleContent>
                </Collapsible>
              </div>
            </CardContent>
          </Card>

          {/* Test Strings */}
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between mb-3">
                <Label className="text-sm font-medium">Test Strings</Label>
                <Button variant="outline" size="sm" className="h-7" onClick={addTestString}>
                  <Plus className="h-3.5 w-3.5 mr-1" />
                  Add
                </Button>
              </div>

              {/* ECMAScript conversion notice */}
              {inputFlavor !== "ecmascript" && ecmascriptConversion && fullPattern.trim() && (
                <div className="mb-3 p-2 bg-blue-50 dark:bg-blue-950/30 rounded text-xs flex items-center gap-2">
                  <Badge variant="outline" className="text-xs">Testing as ECMAScript</Badge>
                  <code className="font-mono text-blue-600 dark:text-blue-400 truncate">{ecmascriptConversion.output}</code>
                </div>
              )}

              <div className="space-y-2">
                {testStrings.map((ts) => (
                  <TestStringItem
                    key={ts.id}
                    id={ts.id}
                    value={ts.value}
                    onChange={(v) => updateTestString(ts.id, v)}
                    onRemove={() => removeTestString(ts.id)}
                    canRemove={testStrings.length > 1}
                    result={results[ts.id] || null}
                  />
                ))}
              </div>

              {!fullPattern.trim() && (
                <div className="text-center py-6 text-muted-foreground text-sm">
                  Enter a pattern above to start testing
                </div>
              )}
            </CardContent>
          </Card>

          {/* Convert Section */}
          <Collapsible open={showConvert} onOpenChange={setShowConvert}>
            <Card>
              <CollapsibleTrigger className="w-full">
                <CardContent className="p-4 hover:bg-muted/30 transition-colors">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <ChevronRight className="h-4 w-4 transition-transform [[data-state=open]_&]:rotate-90" />
                      <Label className="text-sm font-medium cursor-pointer">Convert to Other Flavors</Label>
                    </div>
                    {fullPattern.trim() && (
                      <Badge variant="secondary" className="text-xs">
                        {Object.keys(FLAVOR_INFO).length - 1} flavors
                      </Badge>
                    )}
                  </div>
                </CardContent>
              </CollapsibleTrigger>
              <CollapsibleContent>
                <div className="border-t">
                  <CardContent className="p-4 pt-3">
                    {!fullPattern.trim() ? (
                      <div className="text-center py-4 text-muted-foreground text-sm">
                        Enter a pattern to see conversions
                      </div>
                    ) : (
                      <div className="space-y-2">
                        {Object.values(FLAVOR_INFO).map((info) => (
                          <FlavorConversionRow
                            key={info.id}
                            flavor={info.id}
                            sourcePattern={fullPattern}
                            sourceFlavor={inputFlavor}
                          />
                        ))}
                      </div>
                    )}
                  </CardContent>
                </div>
              </CollapsibleContent>
            </Card>
          </Collapsible>
        </div>
      </ToolPageWrapper>
    </TooltipProvider>
  )
}

export default function RegexPage() {
  return (
    <Suspense fallback={null}>
      <RegexContent />
    </Suspense>
  )
}
