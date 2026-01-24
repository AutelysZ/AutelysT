"use client"

import * as React from "react"
import { Suspense, useCallback, useState, useEffect } from "react"
import { Clock, Calendar, AlertCircle, Check, Copy } from "lucide-react"
import { ToolPageWrapper } from "@/components/tool-ui/tool-page-wrapper"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Alert, AlertDescription } from "@/components/ui/alert"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { cn } from "@/lib/utils"
import { parseCron, getNextRuns, CRON_PRESETS, type ParsedCron } from "@/lib/cron/parser"

function CronContent() {
  const [expression, setExpression] = useState("0 9 * * 1-5")
  const [parsed, setParsed] = useState<ParsedCron | null>(null)
  const [nextRuns, setNextRuns] = useState<Date[]>([])
  const [copied, setCopied] = useState(false)
  const [runCount, setRunCount] = useState(10)

  useEffect(() => {
    if (!expression.trim()) {
      setParsed(null)
      setNextRuns([])
      return
    }

    const result = parseCron(expression)
    setParsed(result)

    if (result.isValid) {
      const runs = getNextRuns(expression, runCount)
      setNextRuns(runs)
    } else {
      setNextRuns([])
    }
  }, [expression, runCount])

  const handlePresetChange = useCallback((value: string) => {
    if (value) {
      setExpression(value)
    }
  }, [])

  const handleCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(expression)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      // Fallback
    }
  }, [expression])

  const formatDate = (date: Date) => {
    return date.toLocaleString(undefined, {
      weekday: "short",
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    })
  }

  const formatRelative = (date: Date) => {
    const now = new Date()
    const diff = date.getTime() - now.getTime()
    const seconds = Math.floor(diff / 1000)
    const minutes = Math.floor(seconds / 60)
    const hours = Math.floor(minutes / 60)
    const days = Math.floor(hours / 24)

    if (days > 0) return `in ${days} day${days > 1 ? "s" : ""}`
    if (hours > 0) return `in ${hours} hour${hours > 1 ? "s" : ""}`
    if (minutes > 0) return `in ${minutes} minute${minutes > 1 ? "s" : ""}`
    return `in ${seconds} second${seconds > 1 ? "s" : ""}`
  }

  return (
    <ToolPageWrapper
      toolId="cron"
      title="Cron Expression Parser"
      description="Parse and visualize cron expressions with next run times"
    >
      <div className="space-y-6">
        {/* Input Section */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Cron Expression</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-wrap gap-4">
              <div className="flex-1 min-w-[250px]">
                <Label className="text-sm mb-2 block">Expression</Label>
                <div className="flex gap-2">
                  <Input
                    value={expression}
                    onChange={(e) => setExpression(e.target.value)}
                    placeholder="* * * * *"
                    className="font-mono"
                  />
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={handleCopy}
                    title="Copy expression"
                  >
                    {copied ? (
                      <Check className="h-4 w-4 text-green-500" />
                    ) : (
                      <Copy className="h-4 w-4" />
                    )}
                  </Button>
                </div>
              </div>

              <div>
                <Label className="text-sm mb-2 block">Presets</Label>
                <Select onValueChange={handlePresetChange}>
                  <SelectTrigger className="w-[220px]">
                    <SelectValue placeholder="Select a preset..." />
                  </SelectTrigger>
                  <SelectContent>
                    {CRON_PRESETS.map((preset) => (
                      <SelectItem key={preset.expression} value={preset.expression}>
                        {preset.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Field reference */}
            <div className="grid grid-cols-5 md:grid-cols-6 gap-2 text-center text-xs text-muted-foreground border rounded-lg p-3 bg-muted/30">
              {parsed?.format === "extended" && (
                <div>
                  <div className="font-medium text-foreground">Second</div>
                  <div>0-59</div>
                </div>
              )}
              <div>
                <div className="font-medium text-foreground">Minute</div>
                <div>0-59</div>
              </div>
              <div>
                <div className="font-medium text-foreground">Hour</div>
                <div>0-23</div>
              </div>
              <div>
                <div className="font-medium text-foreground">Day</div>
                <div>1-31</div>
              </div>
              <div>
                <div className="font-medium text-foreground">Month</div>
                <div>1-12</div>
              </div>
              <div>
                <div className="font-medium text-foreground">Weekday</div>
                <div>0-6 (Sun-Sat)</div>
              </div>
            </div>

            {parsed?.error && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>{parsed.error}</AlertDescription>
              </Alert>
            )}
          </CardContent>
        </Card>

        {/* Description */}
        {parsed?.isValid && (
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Clock className="h-5 w-5" />
                Description
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-lg font-medium">{parsed.description}</p>

              <div className="mt-4 space-y-2">
                <Label className="text-sm text-muted-foreground">Field Breakdown</Label>
                <div className="grid gap-2">
                  {parsed.fields.map((field, index) => (
                    <div
                      key={index}
                      className={cn(
                        "flex items-center justify-between p-2 rounded-lg",
                        field.error ? "bg-destructive/10" : "bg-muted/50"
                      )}
                    >
                      <div className="flex items-center gap-3">
                        <span className="font-mono bg-background px-2 py-1 rounded text-sm min-w-[60px] text-center">
                          {field.value}
                        </span>
                        <span className="text-sm font-medium">{field.name}</span>
                      </div>
                      <span className={cn("text-sm", field.error ? "text-destructive" : "text-muted-foreground")}>
                        {field.error || field.description}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Next Runs */}
        {parsed?.isValid && nextRuns.length > 0 && (
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="text-lg flex items-center gap-2">
                  <Calendar className="h-5 w-5" />
                  Next Runs
                </CardTitle>
                <Select
                  value={String(runCount)}
                  onValueChange={(v) => setRunCount(parseInt(v, 10))}
                >
                  <SelectTrigger className="w-[100px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="5">5 runs</SelectItem>
                    <SelectItem value="10">10 runs</SelectItem>
                    <SelectItem value="20">20 runs</SelectItem>
                    <SelectItem value="50">50 runs</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {nextRuns.map((date, index) => (
                  <div
                    key={index}
                    className={cn(
                      "flex items-center justify-between p-3 rounded-lg",
                      index === 0 ? "bg-primary/10 border border-primary/20" : "bg-muted/50"
                    )}
                  >
                    <div className="flex items-center gap-3">
                      <span className="text-muted-foreground text-sm w-6">{index + 1}.</span>
                      <span className={cn("font-mono", index === 0 && "font-medium")}>
                        {formatDate(date)}
                      </span>
                    </div>
                    <span className={cn("text-sm", index === 0 ? "text-primary" : "text-muted-foreground")}>
                      {formatRelative(date)}
                    </span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Quick Reference */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Quick Reference</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid md:grid-cols-2 gap-6 text-sm">
              <div>
                <h4 className="font-medium mb-2">Special Characters</h4>
                <div className="space-y-1 text-muted-foreground">
                  <div><code className="bg-muted px-1 rounded">*</code> - Any value</div>
                  <div><code className="bg-muted px-1 rounded">,</code> - List separator (1,3,5)</div>
                  <div><code className="bg-muted px-1 rounded">-</code> - Range (1-5)</div>
                  <div><code className="bg-muted px-1 rounded">/</code> - Step (*/5 = every 5)</div>
                </div>
              </div>
              <div>
                <h4 className="font-medium mb-2">Examples</h4>
                <div className="space-y-1 text-muted-foreground font-mono text-xs">
                  <div><code>0 0 * * *</code> - Daily at midnight</div>
                  <div><code>*/15 * * * *</code> - Every 15 minutes</div>
                  <div><code>0 9 * * 1-5</code> - Weekdays at 9am</div>
                  <div><code>0 0 1 * *</code> - Monthly on 1st</div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </ToolPageWrapper>
  )
}

export default function CronPage() {
  return (
    <Suspense fallback={null}>
      <CronContent />
    </Suspense>
  )
}
