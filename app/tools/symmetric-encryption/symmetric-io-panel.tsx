import type * as React from "react"
import { AlertCircle, Check, Copy, Download, Upload, X } from "lucide-react"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { Button } from "@/components/ui/button"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { cn } from "@/lib/utils"

type EncodingLabels = {
  utf8: string
  base64: string
  base64url: string
  hex: string
  binary: string
}

type InputEncodingOption = {
  value: InputEncoding
  label: string
}

type InputEncoding = "utf8" | "base64" | "hex" | "binary"
type OutputEncoding = "base64" | "base64url" | "hex" | "binary"

type SymmetricIoState = {
  input: string
  inputEncoding: InputEncoding
  outputEncoding: OutputEncoding
  mode: "encrypt" | "decrypt"
}

type SymmetricIoPanelProps = {
  state: SymmetricIoState
  setParam: {
    (key: "inputEncoding", value: InputEncoding, immediate?: boolean): void
    (key: "outputEncoding", value: OutputEncoding, immediate?: boolean): void
  }
  output: string
  error: string | null
  isWorking: boolean
  binaryMeta: { name: string; size: number } | null
  copied: boolean
  fileName: string | null
  fileInputRef: React.RefObject<HTMLInputElement | null>
  inputWarning: string | null
  inputEncodingOptions: InputEncodingOption[]
  showInputEncodingSelect: boolean
  encodingLabels: EncodingLabels
  onFileUpload: (event: React.ChangeEvent<HTMLInputElement>) => void
  onClearFile: () => void
  onInputChange: (value: string) => void
  onCopyResult: () => void
  onDownloadTextResult: () => void
  onDownloadBinaryResult: () => void
}

function InlineTabsList({ children }: { children: React.ReactNode }) {
  return (
    <TabsList className="inline-flex h-7 flex-nowrap items-center gap-1 [&_[data-slot=tabs-trigger]]:flex-none [&_[data-slot=tabs-trigger]]:!text-xs [&_[data-slot=tabs-trigger][data-state=active]]:border-border">
      {children}
    </TabsList>
  )
}

export function SymmetricIoPanel({
  state,
  setParam,
  output,
  error,
  isWorking,
  binaryMeta,
  copied,
  fileName,
  fileInputRef,
  inputWarning,
  inputEncodingOptions,
  showInputEncodingSelect,
  encodingLabels,
  onFileUpload,
  onClearFile,
  onInputChange,
  onCopyResult,
  onDownloadTextResult,
  onDownloadBinaryResult,
}: SymmetricIoPanelProps) {
  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between gap-2">
          <div className="flex min-w-0 flex-1 items-center gap-2">
            <Label className="text-sm font-medium">Input</Label>
            {showInputEncodingSelect ? (
              <Tabs
                value={state.inputEncoding}
                onValueChange={(value) => setParam("inputEncoding", value as InputEncoding, true)}
                className="min-w-0 flex-1"
              >
                <InlineTabsList>
                  {inputEncodingOptions.map((option) => (
                    <TabsTrigger key={option.value} value={option.value} className="whitespace-nowrap text-xs flex-none">
                      {option.label}
                    </TabsTrigger>
                  ))}
                </InlineTabsList>
              </Tabs>
            ) : (
              <span className="rounded-md border px-2 py-1 text-xs">{encodingLabels.binary}</span>
            )}
          </div>
          <div className="flex shrink-0 items-center gap-1">
            <input ref={fileInputRef} type="file" onChange={onFileUpload} className="hidden" />
            <Button
              variant="ghost"
              size="sm"
              onClick={() => fileInputRef.current?.click()}
              className="h-7 gap-1 px-2 text-xs"
            >
              <Upload className="h-3 w-3" />
              File
            </Button>
            {fileName && (
              <Button
                variant="ghost"
                size="sm"
                onClick={onClearFile}
                className="h-7 w-7 p-0"
                aria-label="Clear file"
              >
                <X className="h-3 w-3" />
              </Button>
            )}
          </div>
        </div>
        <div className="relative">
          <Textarea
            value={state.input}
            onChange={(e) => onInputChange(e.target.value)}
            readOnly={Boolean(fileName) || state.inputEncoding === "binary"}
            placeholder={
              state.inputEncoding === "binary"
                ? "Upload a file for binary input..."
                : state.mode === "encrypt"
                  ? "Paste input data to encrypt..."
                  : "Paste input data to decrypt..."
            }
            className={cn(
              "max-h-[320px] min-h-[200px] overflow-auto overflow-x-hidden break-all whitespace-pre-wrap font-mono text-sm",
              error && "border-destructive",
            )}
          />
          {fileName && (
            <div className="absolute inset-0 flex items-center justify-center gap-3 rounded-md border bg-background/95 text-sm text-muted-foreground">
              <span className="max-w-[70%] truncate font-medium text-foreground">{fileName}</span>
              <button
                type="button"
                className="inline-flex h-6 w-6 items-center justify-center rounded hover:bg-muted/60"
                onClick={onClearFile}
                aria-label="Clear file"
              >
                <X className="h-3 w-3" />
              </button>
            </div>
          )}
        </div>
        {inputWarning && <p className="text-xs text-muted-foreground">{inputWarning}</p>}
      </div>

      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between gap-2">
          <div className="flex min-w-0 flex-1 items-center gap-2">
            <Label className="text-sm font-medium">Result</Label>
            <Tabs
              value={state.outputEncoding}
              onValueChange={(value) => setParam("outputEncoding", value as OutputEncoding, true)}
              className="min-w-0 flex-1"
            >
              <InlineTabsList>
                <TabsTrigger value="base64" className="whitespace-nowrap text-xs flex-none">
                  {encodingLabels.base64}
                </TabsTrigger>
                <TabsTrigger value="base64url" className="whitespace-nowrap text-xs flex-none">
                  {encodingLabels.base64url}
                </TabsTrigger>
                <TabsTrigger value="hex" className="whitespace-nowrap text-xs flex-none">
                  {encodingLabels.hex}
                </TabsTrigger>
                <TabsTrigger value="binary" className="whitespace-nowrap text-xs flex-none">
                  {encodingLabels.binary}
                </TabsTrigger>
              </InlineTabsList>
            </Tabs>
          </div>
          {state.outputEncoding !== "binary" && (
            <div className="flex shrink-0 items-center gap-1">
              <Button
                variant="ghost"
                size="sm"
                onClick={onCopyResult}
                className="h-7 w-7 p-0"
                aria-label="Copy result"
                disabled={!output}
              >
                {copied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={onDownloadTextResult}
                className="h-7 w-7 p-0"
                aria-label="Download result"
                disabled={!output}
              >
                <Download className="h-3 w-3" />
              </Button>
            </div>
          )}
        </div>
        <div className="relative">
          <Textarea
            value={output}
            readOnly
            placeholder="Result will appear here..."
            className="max-h-[320px] min-h-[200px] overflow-auto overflow-x-hidden break-all whitespace-pre-wrap font-mono text-sm"
          />
          {state.outputEncoding === "binary" && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 rounded-md border bg-background/95 px-4 text-center text-sm text-muted-foreground">
              <span>Binary output cannot be displayed. Download to use it.</span>
              {binaryMeta && (
                <>
                  <div className="flex w-full items-center justify-between gap-3 text-xs">
                    <span className="truncate font-medium text-foreground">{binaryMeta.name}</span>
                    <span className="shrink-0 text-muted-foreground">{binaryMeta.size} bytes</span>
                  </div>
                  <Button variant="ghost" size="sm" onClick={onDownloadBinaryResult} className="h-7 gap-1 px-2 text-xs">
                    <Download className="h-3 w-3" />
                    Download
                  </Button>
                </>
              )}
            </div>
          )}
        </div>
        {isWorking && <p className="text-xs text-muted-foreground">Processing...</p>}
        {error && (
          <Alert variant="destructive" className="py-2">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription className="text-xs">{error}</AlertDescription>
          </Alert>
        )}
      </div>
    </div>
  )
}
