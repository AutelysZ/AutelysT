"use client";

import * as React from "react";
import { X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { SearchableSelect } from "@/components/ui/searchable-select";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { DualPaneLayout } from "@/components/tool-ui/dual-pane-layout";
import {
  isUnicodeCharset,
  normalizeCharsetValue,
  type Base64Detection,
  type BomDetection,
  type DetectedCharset,
} from "@/lib/encoding/charset-converter";
import {
  INPUT_ENCODING_OPTIONS,
  OUTPUT_ENCODING_OPTIONS,
  OUTPUT_HEX_OPTIONS,
  type ParamsState,
} from "./charset-converter-types";

type CharsetConverterFormProps = {
  state: ParamsState;
  setParam: <K extends keyof ParamsState>(
    key: K,
    value: ParamsState[K],
    updateHistory?: boolean,
  ) => void;
  charsetOptions: { value: string; label: string }[];
  outputText: string;
  leftError: string | null;
  leftWarning: string | null;
  base64Detection: Base64Detection | null;
  bomInfo: BomDetection | null;
  detectedCharsets: DetectedCharset[];
  fileName: string | null;
  hasFileInput: boolean;
  onLeftChange: (value: string) => void;
  onFileUpload: (file: File) => void;
  onDownload: () => void;
  onRightCopy: () => Promise<void> | void;
  onClearFile: () => void;
  onClear: () => void;
};

export default function CharsetConverterForm({
  state,
  setParam,
  charsetOptions,
  outputText,
  leftError,
  leftWarning,
  base64Detection,
  bomInfo,
  detectedCharsets,
  fileName,
  hasFileInput,
  onLeftChange,
  onFileUpload,
  onDownload,
  onRightCopy,
  onClearFile,
  onClear,
}: CharsetConverterFormProps) {
  const outputSupportsBom = isUnicodeCharset(state.outputCharset);
  const isUtf8InputCharset = normalizeCharsetValue(state.inputCharset) === "UTF-8";
  const disallowTextInput =
    state.inputEncoding === "raw" && !hasFileInput && !isUtf8InputCharset;
  const bomLabel = bomInfo
    ? `${bomInfo.charset} (${bomInfo.length} bytes)`
    : "None";
  const hasInput = Boolean(state.inputText) || hasFileInput;
  const leftOverlay = hasFileInput ? (
    <div className="flex h-full w-full items-center justify-between rounded-md border bg-background/95 px-3 py-2">
      <div className="min-w-0">
        <div className="truncate font-mono text-sm">
          {fileName || "Uploaded file"}
        </div>
      </div>
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="h-8 w-8"
        onClick={onClearFile}
        aria-label="Remove file"
      >
        <X className="h-4 w-4" />
      </Button>
    </div>
  ) : disallowTextInput ? (
    <div className="flex h-full w-full items-center justify-center rounded-md border bg-background/95 px-4 text-center text-xs text-muted-foreground">
      Raw text input requires UTF-8. Upload a file to use raw bytes for other
      charsets.
    </div>
  ) : null;

  return (
    <div className="flex w-full flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="text-sm font-medium">Settings</div>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-8 px-3 text-xs"
          onClick={onClear}
        >
          Clear All
        </Button>
      </div>
      <div className="grid gap-4 lg:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <div className="flex items-start justify-between gap-3">
              <div>
                <CardTitle className="text-base">Input</CardTitle>
                <p className="text-xs text-muted-foreground">
                  Decode incoming text or files.
                </p>
              </div>
              <div className="flex items-center gap-2">
                <Label htmlFor="autoDetect" className="text-xs">
                  Auto Detect
                </Label>
                <Checkbox
                  id="autoDetect"
                  checked={state.autoDetect}
                  onCheckedChange={(checked) =>
                    setParam("autoDetect", checked === true)
                  }
                />
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label className="text-xs">Input Charset</Label>
              <SearchableSelect
                value={state.inputCharset}
                onValueChange={(value) => setParam("inputCharset", value)}
                options={charsetOptions}
                placeholder="Select input charset..."
                searchPlaceholder="Search..."
                triggerClassName="w-full justify-between"
                className="w-full"
                disabled={state.autoDetect}
              />
            </div>

            <div className="space-y-2">
              <Label className="text-xs">Input Encoding</Label>
              <Tabs
                value={state.inputEncoding}
                onValueChange={(value) =>
                  setParam("inputEncoding", value as ParamsState["inputEncoding"])
                }
              >
                <TabsList className="grid h-8 w-full grid-cols-3">
                  {INPUT_ENCODING_OPTIONS.map((option) => (
                    <TabsTrigger
                      key={option.value}
                      value={option.value}
                      className="text-xs"
                    >
                      {option.label}
                    </TabsTrigger>
                  ))}
                </TabsList>
              </Tabs>
              <p className="text-xs text-muted-foreground">
                Base64 auto-detects URL-safe and padding. Hex accepts plain,
                \\xNN, or %NN formats.
              </p>
            </div>

            {state.inputEncoding === "base64" && base64Detection && (
              <div className="rounded-md border bg-muted/30 px-3 py-2 text-xs text-muted-foreground">
                Detected:{" "}
                {base64Detection.isUrlSafe ? "URL-safe" : "Standard"} /{" "}
                {base64Detection.hasPadding ? "Padding" : "No padding"}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Output</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label className="text-xs">Output Charset</Label>
              <SearchableSelect
                value={state.outputCharset}
                onValueChange={(value) => setParam("outputCharset", value)}
                options={charsetOptions}
                placeholder="Select output charset..."
                searchPlaceholder="Search..."
                triggerClassName="w-full justify-between"
                className="w-full"
              />
            </div>

            <div className="space-y-2">
              <Label className="text-xs">Output Encoding</Label>
              <Tabs
                value={state.outputEncoding}
                onValueChange={(value) =>
                  setParam(
                    "outputEncoding",
                    value as ParamsState["outputEncoding"],
                  )
                }
              >
                <TabsList className="grid h-8 w-full grid-cols-3">
                  {OUTPUT_ENCODING_OPTIONS.map((option) => (
                    <TabsTrigger
                      key={option.value}
                      value={option.value}
                      className="text-xs"
                    >
                      {option.label}
                    </TabsTrigger>
                  ))}
                </TabsList>
              </Tabs>
            </div>

            {state.outputEncoding === "base64" && (
              <div className="rounded-md border bg-muted/30 px-3 py-2 text-xs">
                <div className="flex flex-wrap items-center gap-3">
                  <label className="flex items-center gap-1.5 text-xs cursor-pointer">
                    <Checkbox
                      id="outputBase64UrlSafe"
                      checked={state.outputBase64UrlSafe}
                      onCheckedChange={(checked) =>
                        setParam("outputBase64UrlSafe", checked === true)
                      }
                    />
                    <span>URL Safe</span>
                  </label>
                  <label className="flex items-center gap-1.5 text-xs cursor-pointer">
                    <Checkbox
                      id="outputBase64Padding"
                      checked={!state.outputBase64Padding}
                      onCheckedChange={(checked) =>
                        setParam("outputBase64Padding", checked !== true)
                      }
                    />
                    <span>No Padding</span>
                  </label>
                </div>
              </div>
            )}

            {state.outputEncoding === "hex" && (
              <div className="rounded-md border bg-muted/30 px-3 py-2 text-xs">
                <div className="space-y-3">
                  <div className="space-y-2">
                    <Label className="text-xs">Hex Format</Label>
                    <Tabs
                      value={state.outputHexType}
                      onValueChange={(value) =>
                        setParam(
                          "outputHexType",
                          value as ParamsState["outputHexType"],
                        )
                      }
                    >
                      <TabsList className="grid h-8 w-full grid-cols-3">
                        {OUTPUT_HEX_OPTIONS.map((option) => (
                          <TabsTrigger
                            key={option.value}
                            value={option.value}
                            className="text-xs"
                          >
                            {option.label}
                          </TabsTrigger>
                        ))}
                      </TabsList>
                    </Tabs>
                  </div>
                  <label className="flex items-center gap-1.5 text-xs cursor-pointer">
                    <Checkbox
                      id="outputHexUpperCase"
                      checked={state.outputHexUpperCase}
                      onCheckedChange={(checked) =>
                        setParam("outputHexUpperCase", checked === true)
                      }
                    />
                    <span>Uppercase</span>
                  </label>
                </div>
              </div>
            )}

            <div className="flex items-start justify-between gap-3">
              <div>
                <Label className="text-xs">Include BOM</Label>
                <p className="text-xs text-muted-foreground">
                  Applies only to Unicode output charsets.
                </p>
              </div>
              <Checkbox
                id="outputBom"
                checked={state.outputBom}
                onCheckedChange={(checked) =>
                  setParam("outputBom", checked === true)
                }
                disabled={!outputSupportsBom}
              />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Detection</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
              <span>BOM:</span>
              <Badge variant="secondary">{bomLabel}</Badge>
            </div>

            {state.autoDetect ? (
              <div className="rounded-md border bg-muted/30 p-3">
                {detectedCharsets.length > 0 ? (
                  <RadioGroup
                    value={state.inputCharset}
                    onValueChange={(value) => setParam("inputCharset", value)}
                    className="gap-2"
                  >
                    {detectedCharsets.map((item) => {
                      const confidence = Math.round(item.confidence * 100);
                      const id = `detected-${item.charset}`;
                      return (
                        <div
                          key={`${item.charset}-${item.source}`}
                          className="flex items-center justify-between gap-4"
                        >
                          <div className="flex items-center gap-2">
                            <RadioGroupItem id={id} value={item.charset} />
                            <Label htmlFor={id} className="text-xs font-normal">
                              {item.charset}
                            </Label>
                            {item.source === "bom" && (
                              <Badge variant="secondary">BOM</Badge>
                            )}
                          </div>
                          <span className="text-xs text-muted-foreground">
                            {confidence}%
                          </span>
                        </div>
                      );
                    })}
                  </RadioGroup>
                ) : (
                  <div className="text-xs text-muted-foreground">
                    {hasInput ? "No encoding detected." : "Awaiting input."}
                  </div>
                )}
              </div>
            ) : (
              <div className="text-xs text-muted-foreground">
                Enable Auto Detect to see charset candidates.
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <DualPaneLayout
        leftLabel={`Input (${state.autoDetect ? "Auto" : state.inputCharset})`}
        rightLabel={`Output (${state.outputCharset})`}
        leftValue={state.inputText}
        rightValue={outputText}
        onLeftChange={onLeftChange}
        onRightChange={() => {}}
        activeSide="left"
        leftError={leftError}
        leftWarning={leftWarning}
        leftPlaceholder="Enter text or drop a file..."
        rightPlaceholder="Converted output appears here..."
        leftFileUpload={onFileUpload}
        rightDownload={onDownload}
        leftReadOnly={hasFileInput || disallowTextInput}
        leftOverlay={leftOverlay}
        rightOnCopy={onRightCopy}
        rightReadOnly
      />
    </div>
  );
}
