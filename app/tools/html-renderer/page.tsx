"use client"

import * as React from "react"
import { Suspense } from "react"
import { z } from "zod"
import { Fullscreen, Copy, Check, Upload, FileDown, Sparkles, ChevronDown, ChevronUp, ChevronRight, AlertTriangle, Clock, Terminal, Trash2 } from "lucide-react"
import Editor from "@monaco-editor/react"
import { useTheme } from "next-themes"
import { ToolPageWrapper, useToolHistoryContext } from "@/components/tool-ui/tool-page-wrapper"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { DEFAULT_URL_SYNC_DEBOUNCE_MS, useUrlSyncedState } from "@/lib/url-state/use-url-synced-state"
import type { HistoryEntry } from "@/lib/history/db"
import { cn } from "@/lib/utils"

const paramsSchema = z.object({
  htmlContent: z.string().default(""),
})

const defaultHtml = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Demo Page</title>
    <style>
        body {
            font-family: Arial, sans-serif;
            max-width: 800px;
            margin: 0 auto;
            padding: 20px;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            min-height: 100vh;
        }
        .container {
            background: rgba(255, 255, 255, 0.1);
            padding: 30px;
            border-radius: 10px;
            backdrop-filter: blur(10px);
        }
        h1 {
            text-align: center;
            margin-bottom: 30px;
        }
        .button {
            background: #4CAF50;
            color: white;
            padding: 10px 20px;
            border: none;
            border-radius: 5px;
            cursor: pointer;
            margin: 5px;
        }
        .button:hover {
            background: #45a049;
        }
    </style>
</head>
<body>
    <div class="container">
        <h1>Welcome to HTML Renderer</h1>
        <p>This is a demo page to showcase the HTML renderer capabilities.</p>

        <h2>Features</h2>
        <ul>
            <li>Live HTML editing</li>
            <li>Real-time preview</li>
            <li>CSS styling support</li>
            <li>JavaScript execution</li>
        </ul>

        <div style="text-align: center; margin-top: 30px;">
            <button class="button" onclick="alert('Hello, World!')">Click Me!</button>
            <button class="button" onclick="this.style.background = '#' + Math.floor(Math.random()*16777215).toString(16)">Random Color</button>
        </div>
    </div>
</body>
</html>`

type ConsoleFilter = "all" | "error" | "warn" | "log"

type ConsoleMessage = {
  id: number
  type: "log" | "error" | "warn"
  message: string
  timestamp: number
  stack?: string
  count: number
}

function detectHtmlType(content: string): "full" | "snippet" {
  const trimmed = content.trim()
  if (!trimmed) return "snippet"

  // Check if it contains DOCTYPE, html, head, or body tags
  const hasDoctype = /<!DOCTYPE\s+html/i.test(trimmed)
  const hasHtmlTag = /<html[\s>]/i.test(trimmed)
  const hasHeadTag = /<head[\s>]/i.test(trimmed)
  const hasBodyTag = /<body[\s>]/i.test(trimmed)

  return (hasDoctype || hasHtmlTag || hasHeadTag || hasBodyTag) ? "full" : "snippet"
}

function injectConsoleScript(html: string, consoleScript: string): string {
  if (/<head[\s>]/i.test(html)) {
    return html.replace(/<head[^>]*>/i, match => `${match}\n${consoleScript}`)
  }
  if (/<body[\s>]/i.test(html)) {
    return html.replace(/<body[^>]*>/i, match => `${match}\n${consoleScript}`)
  }
  return `${consoleScript}\n${html}`
}

async function formatHtml(html: string): Promise<string> {
  try {
    const prettier = await import('prettier/standalone')
    const htmlPlugin = await import('prettier/plugins/html')

    return prettier.format(html, {
      parser: 'html',
      plugins: [htmlPlugin.default],
      htmlWhitespaceSensitivity: 'ignore',
      tabWidth: 2,
      useTabs: false,
      printWidth: 120,
      singleAttributePerLine: false,
    })
  } catch (error) {
    console.error('Error formatting HTML:', error)
    return html // Return original if formatting fails
  }
}

export default function HtmlRendererPage() {
  return (
     <Suspense fallback={null}>
       <HtmlRendererContent />
     </Suspense>
   )
}

function HtmlRendererContent() {
  const { state, setParam, oversizeKeys, hasUrlParams, hydrationSource } = useUrlSyncedState("html-renderer", {
    schema: paramsSchema,
    defaults: paramsSchema.parse({
      htmlContent: defaultHtml,
    }),
  })

  const { resolvedTheme } = useTheme()
  const [isFullscreen, setIsFullscreen] = React.useState(false)
  const [copied, setCopied] = React.useState(false)
  const [htmlType, setHtmlType] = React.useState<"full" | "snippet">(() => detectHtmlType(defaultHtml))
  const [isFormatting, setIsFormatting] = React.useState(false)
  const [isConsoleExpanded, setIsConsoleExpanded] = React.useState(false)
  const [consoleMessages, setConsoleMessages] = React.useState<ConsoleMessage[]>([])
  const [consoleFilter, setConsoleFilter] = React.useState<ConsoleFilter>("all")
  const [showConsoleTimestamps, setShowConsoleTimestamps] = React.useState(true)
  const messageIdRef = React.useRef(0)
  const fileInputRef = React.useRef<HTMLInputElement>(null)
  const previewKey = React.useRef(0)
  const debounceTimerRef = React.useRef<NodeJS.Timeout | undefined>(undefined)

  const clearConsole = React.useCallback(() => {
    messageIdRef.current = 0
    setConsoleMessages([])
  }, [])

  const appendConsoleMessage = React.useCallback((incoming: Omit<ConsoleMessage, "id" | "count">) => {
    setConsoleMessages(prev => {
      const last = prev[prev.length - 1]
      if (last && last.type === incoming.type && last.message === incoming.message && last.stack === incoming.stack) {
        const updated = {
          ...last,
          count: last.count + 1,
          timestamp: incoming.timestamp,
        }
        return [...prev.slice(0, -1), updated]
      }
      const trimmed = prev.length >= 100 ? prev.slice(-99) : prev
      messageIdRef.current += 1
      return [
        ...trimmed,
        {
          ...incoming,
          id: messageIdRef.current,
          count: 1,
        },
      ]
    })
  }, [])

  const [iframeSrc, setIframeSrc] = React.useState("about:blank")

  React.useEffect(() => {
    let content = state.htmlContent.trim()

    if (!content) {
      setIframeSrc("about:blank")
      return
    }

    // Add console capture script to capture console output and send to parent
    const consoleScript = `
      <script>
        (function() {
          const originalLog = console.log;
          const originalError = console.error;
          const originalWarn = console.warn;

          function sendToParent(type, args, stack) {
            const message = args.filter(arg => arg != null).map(arg => {
              if (arg instanceof Error) {
                return String(arg);
              }
              if (typeof arg === 'object') {
                try {
                  return JSON.stringify(arg);
                } catch (e) {
                  return '[Object]';
                }
              }
              return String(arg);
            }).join(' ');
            let resolvedStack = type === 'log' ? undefined : stack;
            if (type !== 'log') {
              for (const arg of args) {
                if (arg && typeof arg === 'object' && 'stack' in arg && arg.stack) {
                  resolvedStack = String(arg.stack);
                  break;
                }
              }
            }
            parent.postMessage({
              type: 'console',
              data: {
                type: type,
                message: message,
                timestamp: Date.now(),
                stack: resolvedStack
              }
            }, '*');
          }

          // Override console methods with stack capture
          console.log = function(...args) {
            originalLog.apply(console, args);
            sendToParent('log', args);
          };
          
          console.error = function(...args) {
            originalError.apply(console, args);
            const stack = new Error().stack || '';
            sendToParent('error', args, stack);
          };
          
          console.warn = function(...args) {
            originalWarn.apply(console, args);
            const stack = new Error().stack || '';
            sendToParent('warn', args, stack);
          };

          // Capture unhandled errors and promises
          window.addEventListener('error', function(event) {
            const error = event.error || new Error(event.message);
            const stack = error.stack || '';
            sendToParent('error', ['Unhandled Error', error.message, error.filename, error.lineno, error.colno], stack);
          });
          
          window.addEventListener('unhandledrejection', function(event) {
            const reason = event.reason;
            if (reason instanceof Error) {
              const stack = reason.stack || '';
              sendToParent('error', ['Unhandled Promise Rejection', reason.message], stack);
            } else {
              sendToParent('error', ['Unhandled Promise Rejection', String(reason)]);
            }
          });

        })();
      </script>
    `

    if (htmlType === "snippet") {
      const fullContent = injectConsoleScript(`<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Preview</title>
</head>
<body>
    ${content}
</body>
</html>`, consoleScript)
      content = fullContent
    } else {
      content = injectConsoleScript(content, consoleScript)
    }

    const blob = new Blob([content], { type: "text/html" })
    const url = URL.createObjectURL(blob)
    setIframeSrc(url)
    return () => {
      URL.revokeObjectURL(url)
    }
  }, [state.htmlContent, htmlType])

  const handleHtmlChange = React.useCallback(
    (value: string | undefined) => {
      const content = value ?? ""
      setParam("htmlContent", content)
      const newType = detectHtmlType(content)
      setHtmlType(newType)

      // Clear console when HTML changes
      clearConsole()

      // Debounce preview refresh
      clearTimeout(debounceTimerRef.current)
      debounceTimerRef.current = setTimeout(() => {
        previewKey.current += 1
      }, 300)
    },
    [setParam, clearConsole],
  )

  const handlePrettyPrint = React.useCallback(async () => {
    if (!state.htmlContent.trim()) return
    
    setIsFormatting(true)
    try {
      const formatted = await formatHtml(state.htmlContent)
      handleHtmlChange(formatted)
      
      // Send pretty print info to console
      const timestamp = Date.now()
      const message = 'HTML formatted successfully using Prettier'
      appendConsoleMessage({
        type: 'log',
        message,
        timestamp,
      })
    } catch (error) {
      // Send formatting error to console with stack trace
      const timestamp = Date.now()
      const stack = error instanceof Error ? error.stack : String(error)
      appendConsoleMessage({
        type: 'error',
        message: `Pretty print failed: ${error instanceof Error ? error.message : String(error)}`,
        timestamp,
        stack,
      })
      
      // Also log to browser console for additional debugging
      console.error('Pretty print error:', error)
    } finally {
      setIsFormatting(false)
    }
  }, [state.htmlContent, handleHtmlChange, appendConsoleMessage])

  const handleCopy = React.useCallback(async () => {
    await navigator.clipboard.writeText(state.htmlContent)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }, [state.htmlContent])

  const handleDownload = React.useCallback(() => {
    const blob = new Blob([state.htmlContent], { type: "text/html" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = htmlType === "full" ? "page.html" : "snippet.html"
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }, [state.htmlContent, htmlType])

  const handleFileUpload = React.useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0]
      if (!file) return

      const reader = new FileReader()
      reader.onload = (event) => {
        const content = event.target?.result as string
        handleHtmlChange(content)
      }
      reader.readAsText(file)
      e.target.value = ""
    },
    [handleHtmlChange],
  )

  const handleLoadHistory = React.useCallback(
    (entry: HistoryEntry) => {
      const { inputs } = entry
      if (inputs.htmlContent !== undefined) {
        handleHtmlChange(inputs.htmlContent)
        clearConsole()
      }
    },
    [handleHtmlChange, clearConsole],
  )

  // Handle console messages from iframe
  React.useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      const payload = event.data?.data
      if (event.data?.type === 'console' && payload) {
        const { type, message, timestamp, stack } = payload
        if (type === 'log' || type === 'error' || type === 'warn') {
          appendConsoleMessage({
            type,
            message: typeof message === "string" ? message : String(message ?? ""),
            timestamp: typeof timestamp === "number" ? timestamp : Date.now(),
            stack: typeof stack === "string" ? stack : undefined,
          })
        }
      }
    }

    window.addEventListener('message', handleMessage)
    return () => window.removeEventListener('message', handleMessage)
  }, [appendConsoleMessage])

  if (isFullscreen) {
    return (
      <div className="fixed inset-0 z-50 bg-background">
        <div className="flex h-full flex-col">
          <div className="flex items-center justify-between border-b p-4">
            <h2 className="text-lg font-semibold">HTML Preview - Fullscreen</h2>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setIsFullscreen(false)}
            >
              <Fullscreen className="h-4 w-4 mr-2" />
              Exit Fullscreen
            </Button>
          </div>
        <div className="flex-1 flex flex-col">
          <div className="flex-1 p-4">
            <div className="flex h-full flex-col overflow-hidden rounded-lg border bg-background">
              <div className="flex-1">
                <iframe
                  key={`preview-${previewKey.current}`}
                src={iframeSrc}
                  className="h-full w-full bg-white"
                  title="HTML Preview"
                  sandbox="allow-scripts allow-same-origin allow-forms allow-modals"
                />
              </div>

              {/* Console Panel in Fullscreen */}
              <ConsolePanel
                messages={consoleMessages}
                isExpanded={isConsoleExpanded}
                onToggleExpanded={() => setIsConsoleExpanded(!isConsoleExpanded)}
                filter={consoleFilter}
                onFilterChange={setConsoleFilter}
                showTimestamps={showConsoleTimestamps}
              onToggleTimestamps={() => setShowConsoleTimestamps(!showConsoleTimestamps)}
                onClear={clearConsole}
                density="regular"
                showOuterBorder={false}
              />
            </div>
          </div>
        </div>
        </div>
      </div>
    )
  }

  return (
    <ToolPageWrapper
      toolId="html-renderer"
      title="HTML Renderer"
      description="Edit HTML code with syntax highlighting and see instant rendered output."
      onLoadHistory={handleLoadHistory}
    >
      <HtmlRendererInner
        state={state}
        setParam={setParam}
        oversizeKeys={oversizeKeys}
        hasUrlParams={hasUrlParams}
        hydrationSource={hydrationSource}
        isFullscreen={isFullscreen}
        setIsFullscreen={setIsFullscreen}
        copied={copied}
        htmlType={htmlType}
        isFormatting={isFormatting}
        isConsoleExpanded={isConsoleExpanded}
        setIsConsoleExpanded={setIsConsoleExpanded}
        consoleMessages={consoleMessages}
        consoleFilter={consoleFilter}
        setConsoleFilter={setConsoleFilter}
        showConsoleTimestamps={showConsoleTimestamps}
        setShowConsoleTimestamps={setShowConsoleTimestamps}
        clearConsole={clearConsole}
        fileInputRef={fileInputRef}
        handleHtmlChange={handleHtmlChange}
        handlePrettyPrint={handlePrettyPrint}
        handleCopy={handleCopy}
        handleDownload={handleDownload}
        handleFileUpload={handleFileUpload}
        iframeSrc={iframeSrc}
        iframeKey={previewKey.current}
        resolvedTheme={resolvedTheme}
      />
    </ToolPageWrapper>
  )
}

function HtmlRendererInner({
  state,
  setParam,
  oversizeKeys,
  hasUrlParams,
  hydrationSource,
  isFullscreen,
  setIsFullscreen,
  copied,
  htmlType,
  isFormatting,
  isConsoleExpanded,
  setIsConsoleExpanded,
  consoleMessages,
  consoleFilter,
  setConsoleFilter,
  showConsoleTimestamps,
  setShowConsoleTimestamps,
  clearConsole,
  fileInputRef,
  handleHtmlChange,
  handlePrettyPrint,
  handleCopy,
  handleDownload,
  handleFileUpload,
  iframeSrc,
  iframeKey,
  resolvedTheme,
}: {
  state: z.infer<typeof paramsSchema>
  setParam: <K extends keyof z.infer<typeof paramsSchema>>(
    key: K,
    value: z.infer<typeof paramsSchema>[K],
    updateHistory?: boolean,
  ) => void
  oversizeKeys: (keyof z.infer<typeof paramsSchema>)[]
  hasUrlParams: boolean
  hydrationSource: "default" | "url" | "history"
  isFullscreen: boolean
  setIsFullscreen: (value: boolean) => void
  copied: boolean
  htmlType: "full" | "snippet"
  isFormatting: boolean
  isConsoleExpanded: boolean
  setIsConsoleExpanded: (value: boolean) => void
  consoleMessages: ConsoleMessage[]
  consoleFilter: ConsoleFilter
  setConsoleFilter: (value: ConsoleFilter) => void
  showConsoleTimestamps: boolean
  setShowConsoleTimestamps: (value: boolean) => void
  clearConsole: () => void
  fileInputRef: React.RefObject<HTMLInputElement | null>
  handleHtmlChange: (value: string | undefined) => void
  handlePrettyPrint: () => void
  handleCopy: () => void
  handleDownload: () => void
  handleFileUpload: (e: React.ChangeEvent<HTMLInputElement>) => void
  iframeSrc: string
  iframeKey: number
  resolvedTheme: string | undefined
}) {
  const { upsertInputEntry, upsertParams } = useToolHistoryContext()
  const lastInputRef = React.useRef<string>("")
  const hasHydratedInputRef = React.useRef(false)
  const hasInitializedParamsRef = React.useRef(false)
  const hasHandledUrlRef = React.useRef(false)

  React.useEffect(() => {
    if (hasHydratedInputRef.current) return
    if (hydrationSource === "default") return
    lastInputRef.current = state.htmlContent
    hasHydratedInputRef.current = true
  }, [hydrationSource, state.htmlContent])

  React.useEffect(() => {
    if (!state.htmlContent || state.htmlContent === lastInputRef.current) return

    const timer = setTimeout(() => {
      lastInputRef.current = state.htmlContent
      upsertInputEntry(
        { htmlContent: state.htmlContent },
        {},
        "htmlContent",
        state.htmlContent.slice(0, 100),
      )
    }, DEFAULT_URL_SYNC_DEBOUNCE_MS)

    return () => clearTimeout(timer)
  }, [state.htmlContent, upsertInputEntry])

  React.useEffect(() => {
    if (hasUrlParams && !hasHandledUrlRef.current) {
      hasHandledUrlRef.current = true
      if (state.htmlContent) {
        upsertInputEntry(
          { htmlContent: state.htmlContent },
          {},
          "htmlContent",
          state.htmlContent.slice(0, 100),
        )
      }
    }
  }, [hasUrlParams, state.htmlContent, upsertInputEntry])

  React.useEffect(() => {
    if (!hasInitializedParamsRef.current) {
      hasInitializedParamsRef.current = true
      return
    }
    upsertParams({}, "interpretation")
  }, [upsertParams])

  return (
    <div className="flex h-full flex-col gap-4">
      <div className="flex flex-col gap-4 md:flex-row">
        {/* HTML Editor Panel */}
        <div className="flex w-full flex-1 flex-col gap-2 md:w-0">
          <div className="flex h-8 items-center justify-between gap-2">
            <Label className="text-sm font-medium">HTML Editor</Label>
            <div className="flex items-center gap-1">
              <Button
                variant="ghost"
                size="sm"
                onClick={handlePrettyPrint}
                disabled={!state.htmlContent.trim() || isFormatting}
                className="h-7 w-7 p-0"
                title={isFormatting ? "Formatting..." : "Pretty print"}
              >
                <Sparkles className="h-3 w-3" />
              </Button>
              <input
                ref={fileInputRef}
                type="file"
                accept=".html,.htm"
                className="hidden"
                onChange={handleFileUpload}
              />
              <Button
                variant="ghost"
                size="sm"
                onClick={() => fileInputRef.current?.click()}
                className="h-7 w-7 p-0"
                title="Upload HTML file"
              >
                <Upload className="h-3 w-3" />
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={handleCopy}
                disabled={!state.htmlContent}
                className="h-7 w-7 p-0"
                title={copied ? "Copied!" : "Copy to clipboard"}
              >
                {copied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={handleDownload}
                disabled={!state.htmlContent}
                className="h-7 w-7 p-0"
                title="Download HTML file"
              >
                <FileDown className="h-3 w-3" />
              </Button>
            </div>
          </div>
          <div className="relative overflow-hidden rounded-md border">
            <div className="h-[calc(100vh-12rem)] min-h-[300px]">
              <Editor
                height="100%"
                language="html"
                theme={resolvedTheme === "dark" ? "vs-dark" : "light"}
                value={state.htmlContent}
                onChange={handleHtmlChange}
                options={{
                  minimap: { enabled: false },
                  fontSize: 13,
                  lineNumbers: "on",
                  scrollBeyondLastLine: false,
                  wordWrap: "on",
                  tabSize: 2,
                  automaticLayout: true,
                  padding: { top: 8, bottom: 8 },
                  scrollbar: {
                    vertical: "auto",
                    horizontal: "auto",
                    verticalScrollbarSize: 8,
                    horizontalScrollbarSize: 8,
                  },
                }}
              />
            </div>
          </div>
          {oversizeKeys.includes("htmlContent") && (
            <p className="text-xs text-muted-foreground">HTML content exceeds 2 KB and is not synced to URL.</p>
          )}
        </div>

        {/* Preview Panel */}
        <div className="flex w-full flex-1 flex-col gap-2 md:w-0">
          <div className="flex h-8 items-center justify-between gap-2">
            <Label className="text-sm font-medium">Preview</Label>
            <div className="flex items-center gap-1">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setIsFullscreen(true)}
                disabled={!state.htmlContent}
                className="h-7 w-7 p-0"
                title="Fullscreen preview"
              >
                <Fullscreen className="h-3 w-3" />
              </Button>
            </div>
          </div>
          <div className="flex-1 min-h-[300px] h-[calc(100vh-12rem)] flex flex-col">
            <div className="flex-1 flex flex-col overflow-hidden rounded-lg border bg-background">
              <div className="flex-1">
                <iframe
                  key={`preview-${iframeKey}`}
                src={iframeSrc}
                  className="h-full w-full bg-white"
                  title="HTML Preview"
                  sandbox="allow-scripts allow-same-origin allow-forms allow-modals"
                />
              </div>

              {/* Console Panel */}
              <ConsolePanel
                messages={consoleMessages}
                isExpanded={isConsoleExpanded}
                onToggleExpanded={() => setIsConsoleExpanded(!isConsoleExpanded)}
                filter={consoleFilter}
                onFilterChange={setConsoleFilter}
                showTimestamps={showConsoleTimestamps}
                onToggleTimestamps={() => setShowConsoleTimestamps(!showConsoleTimestamps)}
                onClear={clearConsole}
                density="compact"
                showOuterBorder={false}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

type ConsolePanelProps = {
  messages: ConsoleMessage[]
  isExpanded: boolean
  onToggleExpanded: () => void
  filter: ConsoleFilter
  onFilterChange: (value: ConsoleFilter) => void
  showTimestamps: boolean
  onToggleTimestamps: () => void
  onClear: () => void
  density?: "regular" | "compact"
  showOuterBorder?: boolean
}

function ConsolePanel({
  messages,
  isExpanded,
  onToggleExpanded,
  filter,
  onFilterChange,
  showTimestamps,
  onToggleTimestamps,
  onClear,
  density = "regular",
  showOuterBorder = true,
}: ConsolePanelProps) {
  const getDisplayStack = React.useCallback((msg: ConsoleMessage) => {
    if (!msg.stack) return ""
    const lines = msg.stack.split("\n")
    if (lines.length <= 1) return msg.stack
    const firstLine = lines[0].trim()
    const messageLine = msg.message.trim()
    const hasErrorPrefix = /^(Error|TypeError|ReferenceError|SyntaxError|RangeError|URIError|EvalError|AggregateError):/.test(
      firstLine,
    )
    if (
      (messageLine && firstLine.includes(messageLine)) ||
      hasErrorPrefix ||
      msg.type === "warn" ||
      msg.type === "log"
    ) {
      return lines.slice(1).join("\n")
    }
    return msg.stack
  }, [])

  const isCompact = density === "compact"
  const defaultHeight = isCompact ? 128 : 192
  const minHeight = isCompact ? 96 : 140
  const [panelHeight, setPanelHeight] = React.useState(defaultHeight)
  const [maxHeight, setMaxHeight] = React.useState(480)
  const dragStateRef = React.useRef<{ startY: number; startHeight: number } | null>(null)
  const counts = messages.reduce(
    (acc, msg) => {
      const count = msg.count || 1
      acc.total += count
      acc[msg.type] += count
      return acc
    },
    { total: 0, error: 0, warn: 0, log: 0 },
  )
  const filteredMessages = filter === "all" ? messages : messages.filter(msg => msg.type === filter)
  const rowTextClass = isCompact ? "text-xs" : "text-sm"
  const timestampClass = isCompact ? "text-[10px]" : "text-xs"
  const badgeTextClass = isCompact ? "text-[9px]" : "text-[10px]"
  const iconSizeClass = "h-3 w-3"
  const emptyTextClass = isCompact ? "text-xs" : "text-sm"
  const countBadgeClass = isCompact ? "text-[9px] px-1.5 py-0.5" : "text-[10px] px-2 py-0.5"
  const toolbarButtonClass = isCompact ? "h-6 px-2 text-[10px]" : "h-7 px-2 text-xs"
  const filterOptions: Array<{ id: ConsoleFilter; label: string; count: number }> = [
    { id: "all", label: "All", count: counts.total },
    { id: "error", label: "Errors", count: counts.error },
    { id: "warn", label: "Warnings", count: counts.warn },
    { id: "log", label: "Logs", count: counts.log },
  ]

  React.useEffect(() => {
    const updateMaxHeight = () => {
      const nextMax = Math.max(minHeight, Math.floor(window.innerHeight * 0.6))
      setMaxHeight(nextMax)
      setPanelHeight(current => Math.min(current, nextMax))
    }
    updateMaxHeight()
    window.addEventListener("resize", updateMaxHeight)
    return () => window.removeEventListener("resize", updateMaxHeight)
  }, [minHeight])

  React.useEffect(() => {
    const handleMove = (event: PointerEvent) => {
      if (!dragStateRef.current) return
      const delta = dragStateRef.current.startY - event.clientY
      const nextHeight = Math.min(
        Math.max(dragStateRef.current.startHeight + delta, minHeight),
        maxHeight,
      )
      setPanelHeight(nextHeight)
    }
    const handleUp = () => {
      if (!dragStateRef.current) return
      dragStateRef.current = null
      document.body.style.cursor = ""
      document.body.style.userSelect = ""
    }
    window.addEventListener("pointermove", handleMove)
    window.addEventListener("pointerup", handleUp)
    return () => {
      window.removeEventListener("pointermove", handleMove)
      window.removeEventListener("pointerup", handleUp)
    }
  }, [minHeight, maxHeight])

  const handleResizeStart = React.useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      dragStateRef.current = { startY: event.clientY, startHeight: panelHeight }
      document.body.style.cursor = "row-resize"
      document.body.style.userSelect = "none"
    },
    [panelHeight],
  )

  const renderMessage = (msg: ConsoleMessage) => {
    const count = msg.count || 1
    const timeLabel = new Date(msg.timestamp).toLocaleTimeString()
    const levelLabel = msg.type === "error" ? "Error" : msg.type === "warn" ? "Warn" : "Log"
    const levelClass =
      msg.type === "error"
        ? "bg-destructive/10 text-destructive"
        : msg.type === "warn"
        ? "bg-yellow-500/10 text-yellow-700 dark:text-yellow-400"
        : "bg-muted text-foreground"
    const levelTextClass =
      msg.type === "error"
        ? "text-destructive"
        : msg.type === "warn"
        ? "text-yellow-700 dark:text-yellow-400"
        : "text-foreground"
    const countBadge =
      count > 1 ? (
        <span className={cn("shrink-0 rounded-full bg-muted text-muted-foreground", countBadgeClass)}>
          {count}
        </span>
      ) : null
    const messageText = (
      <div className="flex-1 min-w-0">
        <span className={cn("block font-mono whitespace-pre-wrap", levelTextClass)}>{msg.message}</span>
      </div>
    )

    const displayStack = msg.stack ? getDisplayStack(msg) : ""
    return (
      <div key={msg.id} className={cn("flex items-start gap-2", rowTextClass)}>
        {showTimestamps && (
          <span className={cn("text-muted-foreground shrink-0", timestampClass)}>{timeLabel}</span>
        )}
        <span className={cn("rounded px-1.5 py-0.5 font-medium uppercase tracking-wide", badgeTextClass, levelClass)}>
          {levelLabel}
        </span>
        {msg.stack ? (
          <details className="group flex-1 min-w-0">
            <summary className="flex items-start gap-2 cursor-pointer list-none [&::-webkit-details-marker]:hidden">
              <span className="mt-0.5 text-muted-foreground">
                <ChevronRight className={cn(iconSizeClass, "group-open:hidden")} />
                <ChevronDown className={cn(iconSizeClass, "hidden group-open:inline")} />
              </span>
              {messageText}
              {countBadge}
            </summary>
            {displayStack && (
              <div
                className={cn(
                  "mt-2 ml-5 font-mono whitespace-pre overflow-x-auto",
                  rowTextClass,
                  levelTextClass,
                )}
              >
                {displayStack}
              </div>
            )}
          </details>
        ) : (
          <div className="flex items-start gap-2 flex-1 min-w-0">
            <span className="mt-0.5 text-muted-foreground opacity-0">
              <ChevronRight className={iconSizeClass} />
            </span>
            {messageText}
            {countBadge}
          </div>
        )}
      </div>
    )
  }

  const panelBorderClass = showOuterBorder
    ? "border rounded-lg overflow-hidden"
    : "border-t"

  return (
    <div className={panelBorderClass}>
      <div
        className="flex items-center justify-between px-3 py-2 bg-muted/50 cursor-pointer hover:bg-muted/80 transition-colors border-b"
        onClick={onToggleExpanded}
      >
        <div className="flex items-center gap-2">
          <Terminal className={iconSizeClass} />
          <span className={cn(isCompact ? "text-xs font-medium" : "text-sm font-medium")}>Console</span>
          {(counts.error > 0 || counts.warn > 0) && <AlertTriangle className={cn(iconSizeClass, "text-destructive")} />}
          {counts.total > 0 && (
            <span className={cn("text-muted-foreground ml-1", isCompact ? "text-[10px]" : "text-xs")}>
              {counts.total}
            </span>
          )}
        </div>
        {isExpanded ? (
          <ChevronDown className={iconSizeClass} />
        ) : (
          <ChevronUp className={iconSizeClass} />
        )}
      </div>

      {isExpanded && (
        <div className="bg-background flex flex-col" style={{ height: panelHeight }}>
          <div
            className="h-2 cursor-row-resize bg-muted/60 hover:bg-muted border-b"
            onPointerDown={handleResizeStart}
          />
          <div className="flex flex-wrap items-center gap-2 px-2 py-2 border-b">
            <div className="flex flex-wrap gap-1.5">
              {filterOptions.map(option => (
                <Button
                  key={option.id}
                  type="button"
                  variant={filter === option.id ? "secondary" : "ghost"}
                  size="sm"
                  className={toolbarButtonClass}
                  onClick={() => onFilterChange(option.id)}
                >
                  <span>{option.label}</span>
                  <span className="ml-1 text-[10px] text-muted-foreground">{option.count}</span>
                </Button>
              ))}
            </div>
            <div className="ml-auto flex items-center gap-1">
              <Button
                type="button"
                variant={showTimestamps ? "secondary" : "ghost"}
                size="sm"
                className={toolbarButtonClass}
                onClick={onToggleTimestamps}
              >
                <Clock className="mr-1 h-3 w-3" />
                Timestamps
              </Button>
              <Button type="button" variant="ghost" size="sm" className={toolbarButtonClass} onClick={onClear}>
                <Trash2 className="mr-1 h-3 w-3" />
                Clear
              </Button>
            </div>
          </div>
          <div className="flex-1 overflow-y-auto p-2">
            {filteredMessages.length === 0 ? (
              <div className={cn(emptyTextClass, "text-muted-foreground italic")}>
                Console output will appear here...
              </div>
            ) : (
              <div className="space-y-1">{filteredMessages.map(renderMessage)}</div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
