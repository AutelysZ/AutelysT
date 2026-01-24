"use client"

import * as React from "react"
import { Suspense } from "react"
import { z } from "zod"
import { Fullscreen, Copy, Check, Upload, FileDown, Sparkles, ChevronDown, ChevronUp, AlertTriangle, Terminal } from "lucide-react"
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
       <HtmlRendererInner />
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
  const [consoleMessages, setConsoleMessages] = React.useState<Array<{type: 'log' | 'error' | 'warn', message: string, timestamp: number}>>([])
  const fileInputRef = React.useRef<HTMLInputElement>(null)
  const previewKey = React.useRef(0)
  const debounceTimerRef = React.useRef<NodeJS.Timeout | undefined>(undefined)

  const getIframeSrc = React.useCallback(() => {
    let content = state.htmlContent.trim()

    if (!content) return ""

    // Add console capture script to capture console output and send to parent
    const consoleScript = `
      <script>
        (function() {
          const originalLog = console.log;
          const originalError = console.error;
          const originalWarn = console.warn;

          function sendToParent(type, ...args) {
            parent.postMessage({
              type: 'console',
              data: {
                type: type,
                message: args.map(arg => {
                  if (typeof arg === 'object') {
                    try {
                      return JSON.stringify(arg);
                    } catch (e) {
                      return '[Object]';
                    }
                  }
                  return String(arg);
                }).join(' '),
                timestamp: Date.now(),
                stack: args.length > 1 ? args.find(arg => typeof arg === 'string' && arg.includes('at ')) : undefined
              }
            }, '*');
          }
          
          function sendToParent(type, ...args) {
            parent.postMessage({
              type: 'console',
              data: {
                type: type,
                message: args.map(arg => {
                  if (typeof arg === 'object') {
                    try {
                      return JSON.stringify(arg);
                    } catch (e) {
                      return '[Object]';
                    }
                  }
                  return String(arg);
                }).join(' '),
                timestamp: Date.now(),
                stack: args.length > 1 ? args.find(arg => typeof arg === 'string' && arg.includes('at ')) : undefined
              }
            }, '*');
          }

          // Override console methods with stack capture
          console.log = function(...args) {
            originalLog.apply(console, args);
            const stack = new Error().stack || '';
            sendToParent('log', ...args, stack);
          };
          
          console.error = function(...args) {
            originalError.apply(console, args);
            const stack = new Error().stack || '';
            sendToParent('error', ...args, stack);
          };
          
          console.warn = function(...args) {
            originalWarn.apply(console, args);
            const stack = new Error().stack || '';
            sendToParent('warn', ...args, stack);
          };

          // Capture unhandled errors and promises
          window.addEventListener('error', function(event) {
            const error = event.error || new Error(event.message);
            const stack = error.stack || '';
            sendToParent('error', 'Unhandled Error', error.message, error.filename, error.lineno, error.colno, stack);
          });
          
          window.addEventListener('unhandledrejection', function(event) {
            const reason = event.reason;
            if (reason instanceof Error) {
              const stack = reason.stack || '';
              sendToParent('error', 'Unhandled Promise Rejection', reason.message, stack);
            } else {
              sendToParent('error', 'Unhandled Promise Rejection', String(reason));
            }
          });

          window.addEventListener('unhandledrejection', function(event) {
            const reason = event.reason;
            if (reason instanceof Error) {
              sendToParent('error', 'Unhandled Promise Rejection:', reason.message);
            } else {
              sendToParent('error', 'Unhandled Promise Rejection:', String(reason));
            }
          });
        })();
      </script>
    `

    if (htmlType === "snippet") {
      const fullContent = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Preview</title>
</head>
<body>
    ${content}
    ${consoleScript}
</body>
</html>`
      content = fullContent
    } else {
      // Insert console script before closing body tag
      content = content.replace(/<\/body>/i, `${consoleScript}</body>`)
    }

    return `data:text/html;charset=utf-8,${encodeURIComponent(content)}`
  }, [state.htmlContent, htmlType])

  const handleHtmlChange = React.useCallback(
    (value: string | undefined) => {
      const content = value ?? ""
      setParam("htmlContent", content)
      const newType = detectHtmlType(content)
      setHtmlType(newType)

      // Clear console when HTML changes
      setConsoleMessages([])

      // Debounce preview refresh
      clearTimeout(debounceTimerRef.current)
      debounceTimerRef.current = setTimeout(() => {
        previewKey.current += 1
      }, 300)
    },
    [setParam, setConsoleMessages],
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
      setConsoleMessages(prev => [...prev, {
        type: 'log',
        message,
        timestamp,
        stack: undefined
      }])
    } catch (error) {
      // Send formatting error to console with stack trace
      const timestamp = Date.now()
      const stack = error instanceof Error ? error.stack : String(error)
      setConsoleMessages(prev => [...prev, {
        type: 'error',
        message: `Pretty print failed: ${error instanceof Error ? error.message : String(error)}`,
        timestamp,
        stack
      }])
      
      // Also log to browser console for additional debugging
      console.error('Pretty print error:', error)
    } finally {
      setIsFormatting(false)
    }
  }, [state.htmlContent, handleHtmlChange, setConsoleMessages])

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
        setConsoleMessages([])
      }
    },
    [handleHtmlChange],
  )

  // Handle console messages from iframe
  React.useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      if (event.data.type === 'console' && event.data.data) {
        setConsoleMessages(prev => [...prev.slice(-99), event.data.data]) // Keep last 100 messages
      }
    }

    window.addEventListener('message', handleMessage)
    return () => window.removeEventListener('message', handleMessage)
  }, [setConsoleMessages])

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
              <iframe
                key={`preview-${previewKey.current}`}
                src={getIframeSrc()}
                className="h-full w-full rounded-lg border bg-white"
                title="HTML Preview"
                sandbox="allow-scripts allow-same-origin allow-forms allow-modals"
              />
            </div>

            {/* Console Panel in Fullscreen */}
            <div className="border-t">
              <div
                className="flex items-center justify-between px-3 py-2 bg-muted/50 cursor-pointer hover:bg-muted/80 transition-colors"
                onClick={() => setIsConsoleExpanded(!isConsoleExpanded)}
              >
                <div className="flex items-center gap-2">
                  <Terminal className="h-3 w-3" />
                  <span className="text-sm font-medium">Console</span>
                  {consoleMessages.some((msg: any) => msg.type === 'error' || msg.type === 'warn') && (
                    <AlertTriangle className="h-3 w-3 text-destructive" />
                  )}
                  {consoleMessages.length > 0 && (
                    <span className="text-xs text-muted-foreground ml-2">
                      {consoleMessages.length}
                    </span>
                  )}
                </div>
                {isConsoleExpanded ? (
                  <ChevronDown className="h-3 w-3" />
                ) : (
                  <ChevronUp className="h-3 w-3" />
                )}
              </div>

              {isConsoleExpanded && (
                <div className="h-48 overflow-y-auto border-t bg-background p-2">
                  {consoleMessages.length === 0 ? (
                    <div className="text-sm text-muted-foreground italic">Console output will appear here...</div>
                  ) : (
                    <div className="space-y-1">
                      {consoleMessages.map((msg: any, index: number) => (
                        <div key={`${msg.timestamp}-${index}`} className="flex gap-3 text-sm">
                          <span className="text-muted-foreground shrink-0">
                            {new Date(msg.timestamp).toLocaleTimeString()}
                          </span>
                          <div className="flex-1 min-w-0">
                            {msg.stack ? (
                              <pre className="font-mono text-xs whitespace-pre-wrap break-words overflow-x-auto bg-muted/50 rounded p-2 border border-border/50">
                                <span className="text-destructive">
                                  {msg.message}
                                </span>
                                <span className="text-muted-foreground mt-1">
                                  {msg.stack}
                                </span>
                              </pre>
                            ) : (
                              <span
                                className={cn(
                                  "font-mono whitespace-pre-wrap break-words overflow-x-auto",
                                  msg.type === 'error' && "text-destructive",
                                  msg.type === 'warn' && "text-yellow-600 dark:text-yellow-400",
                                  msg.type === 'log' && "text-foreground"
                                )}
                              >
                                {msg.message}
                              </span>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
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
        setConsoleMessages={setConsoleMessages}
        fileInputRef={fileInputRef}
        handleHtmlChange={handleHtmlChange}
        handlePrettyPrint={handlePrettyPrint}
        handleCopy={handleCopy}
        handleDownload={handleDownload}
        handleFileUpload={handleFileUpload}
        getIframeSrc={getIframeSrc}
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
  setConsoleMessages,
  fileInputRef,
  handleHtmlChange,
  handlePrettyPrint,
  handleCopy,
  handleDownload,
  handleFileUpload,
  getIframeSrc,
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
  consoleMessages: Array<{type: 'log' | 'error' | 'warn', message: string, timestamp: number}>
  setConsoleMessages: (messages: Array<{type: 'log' | 'error' | 'warn', message: string, timestamp: number}>) => void
  fileInputRef: React.RefObject<HTMLInputElement | null>
  handleHtmlChange: (value: string | undefined) => void
  handlePrettyPrint: () => void
  handleCopy: () => void
  handleDownload: () => void
  handleFileUpload: (e: React.ChangeEvent<HTMLInputElement>) => void
  getIframeSrc: () => string
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
          <div className="flex items-center justify-between gap-2">
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
        <div className="flex w-full flex-1 flex-col md:w-0">
          <div className="flex items-center justify-between gap-2">
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
            <div className="flex-1">
              <iframe
                key={`preview-${iframeKey}`}
                src={getIframeSrc()}
                className="h-full w-full border bg-white"
                title="HTML Preview"
                sandbox="allow-scripts allow-same-origin allow-forms allow-modals"
              />
            </div>

            {/* Console Panel */}
            <div className="border-t">
              <div
                className="flex items-center justify-between px-3 py-2 bg-muted/50 cursor-pointer hover:bg-muted/80 transition-colors"
                onClick={() => setIsConsoleExpanded(!isConsoleExpanded)}
              >
                <div className="flex items-center gap-2">
                  <Terminal className="h-3 w-3" />
                  <span className="text-xs font-medium">Console</span>
                  {consoleMessages.some(msg => msg.type === 'error' || msg.type === 'warn') && (
                    <AlertTriangle className="h-3 w-3 text-destructive" />
                  )}
                </div>
                {isConsoleExpanded ? (
                  <ChevronDown className="h-3 w-3" />
                ) : (
                  <ChevronUp className="h-3 w-3" />
                )}
              </div>

              {isConsoleExpanded && (
                <div className="h-32 overflow-y-auto border-t bg-background p-2">
                  {consoleMessages.length === 0 ? (
                    <div className="text-xs text-muted-foreground italic">Console output will appear here...</div>
                  ) : (
                    <div className="space-y-1">
                      {consoleMessages.map((msg: any, index: number) => (
                        <div key={`${msg.timestamp}-${index}`} className="flex gap-2 text-xs">
                          <span className="text-muted-foreground shrink-0">
                            {new Date(msg.timestamp).toLocaleTimeString()}
                          </span>
                          <span
                            className={cn(
                              "font-mono break-all",
                              msg.type === 'error' && "text-destructive",
                              msg.type === 'warn' && "text-yellow-600 dark:text-yellow-400",
                              msg.type === 'log' && "text-foreground"
                            )}
                          >
                            {msg.message}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
