"use client";

import * as React from "react";
import { useToolHistoryContext } from "@/components/tool-ui/tool-page-wrapper";
import { DEFAULT_URL_SYNC_DEBOUNCE_MS } from "@/lib/url-state/use-url-synced-state";
import CharsetConverterForm from "./charset-converter-form";
import type { ParamsState } from "./charset-converter-types";
import type {
  Base64Detection,
  BomDetection,
  DetectedCharset,
} from "@/lib/encoding/charset-converter";

type CharsetConverterInnerProps = {
  state: ParamsState;
  setParam: <K extends keyof ParamsState>(
    key: K,
    value: ParamsState[K],
    updateHistory?: boolean,
  ) => void;
  oversizeKeys: (keyof ParamsState)[];
  hasUrlParams: boolean;
  hydrationSource: "default" | "url" | "history";
  charsetOptions: { value: string; label: string }[];
  outputText: string;
  leftError: string | null;
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

export default function CharsetConverterInner({
  state,
  setParam,
  oversizeKeys,
  hasUrlParams,
  hydrationSource,
  charsetOptions,
  outputText,
  leftError,
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
}: CharsetConverterInnerProps) {
  const { upsertInputEntry, upsertParams } = useToolHistoryContext();
  const lastInputRef = React.useRef<string>("");
  const hasHydratedInputRef = React.useRef(false);
  const paramsRef = React.useRef({
    inputEncoding: state.inputEncoding,
    inputCharset: state.inputCharset,
    outputCharset: state.outputCharset,
    outputEncoding: state.outputEncoding,
    outputBase64Padding: state.outputBase64Padding,
    outputBase64UrlSafe: state.outputBase64UrlSafe,
    outputHexType: state.outputHexType,
    outputHexUpperCase: state.outputHexUpperCase,
    outputBom: state.outputBom,
    autoDetect: state.autoDetect,
    fileName: state.fileName,
    fileData: state.fileData,
  });
  const hasInitializedParamsRef = React.useRef(false);
  const hasHandledUrlRef = React.useRef(false);

  const leftWarning =
    oversizeKeys.includes("inputText") || oversizeKeys.includes("fileData")
      ? "Input exceeds 2 KB and is not synced to the URL."
      : null;

  React.useEffect(() => {
    if (hasHydratedInputRef.current) return;
    if (hydrationSource === "default") return;
    lastInputRef.current = state.inputText;
    hasHydratedInputRef.current = true;
  }, [hydrationSource, state.inputText]);

  React.useEffect(() => {
    if (state.inputText === lastInputRef.current) return;

    const timer = setTimeout(() => {
      lastInputRef.current = state.inputText;
      upsertInputEntry(
        { inputText: state.inputText },
        {
          inputEncoding: state.inputEncoding,
          inputCharset: state.inputCharset,
          outputCharset: state.outputCharset,
          outputEncoding: state.outputEncoding,
          outputBase64Padding: state.outputBase64Padding,
          outputBase64UrlSafe: state.outputBase64UrlSafe,
          outputHexType: state.outputHexType,
          outputHexUpperCase: state.outputHexUpperCase,
          outputBom: state.outputBom,
          autoDetect: state.autoDetect,
          fileName: state.fileName,
          fileData: state.fileData,
        },
        "left",
        state.inputText ? state.inputText.slice(0, 100) : "Empty",
      );
    }, DEFAULT_URL_SYNC_DEBOUNCE_MS);

    return () => clearTimeout(timer);
  }, [
    state.inputText,
    state.inputEncoding,
    state.inputCharset,
    state.outputCharset,
    state.outputEncoding,
    state.outputBase64Padding,
    state.outputBase64UrlSafe,
    state.outputHexType,
    state.outputHexUpperCase,
    state.outputBom,
    state.autoDetect,
    state.fileName,
    state.fileData,
    upsertInputEntry,
  ]);

  React.useEffect(() => {
    if (hasUrlParams && !hasHandledUrlRef.current) {
      hasHandledUrlRef.current = true;
      if (state.inputText) {
        upsertInputEntry(
          { inputText: state.inputText },
          {
            inputEncoding: state.inputEncoding,
            inputCharset: state.inputCharset,
            outputCharset: state.outputCharset,
            outputEncoding: state.outputEncoding,
            outputBase64Padding: state.outputBase64Padding,
            outputBase64UrlSafe: state.outputBase64UrlSafe,
            outputHexType: state.outputHexType,
            outputHexUpperCase: state.outputHexUpperCase,
            outputBom: state.outputBom,
            autoDetect: state.autoDetect,
            fileName: state.fileName,
            fileData: state.fileData,
          },
          "left",
          state.inputText.slice(0, 100),
        );
      } else {
        upsertParams(
          {
            inputEncoding: state.inputEncoding,
            inputCharset: state.inputCharset,
            outputCharset: state.outputCharset,
            outputEncoding: state.outputEncoding,
            outputBase64Padding: state.outputBase64Padding,
            outputBase64UrlSafe: state.outputBase64UrlSafe,
            outputHexType: state.outputHexType,
            outputHexUpperCase: state.outputHexUpperCase,
            outputBom: state.outputBom,
            autoDetect: state.autoDetect,
            fileName: state.fileName,
            fileData: state.fileData,
          },
          "interpretation",
        );
      }
    }
  }, [
    hasUrlParams,
    state.inputText,
    state.inputEncoding,
    state.inputCharset,
    state.outputCharset,
    state.outputEncoding,
    state.outputBase64Padding,
    state.outputBase64UrlSafe,
    state.outputHexType,
    state.outputHexUpperCase,
    state.outputBom,
    state.autoDetect,
    state.fileName,
    state.fileData,
    upsertInputEntry,
    upsertParams,
  ]);

  React.useEffect(() => {
    const nextParams = {
      inputEncoding: state.inputEncoding,
      inputCharset: state.inputCharset,
      outputCharset: state.outputCharset,
      outputEncoding: state.outputEncoding,
      outputBase64Padding: state.outputBase64Padding,
      outputBase64UrlSafe: state.outputBase64UrlSafe,
      outputHexType: state.outputHexType,
      outputHexUpperCase: state.outputHexUpperCase,
      outputBom: state.outputBom,
      autoDetect: state.autoDetect,
      fileName: state.fileName,
      fileData: state.fileData,
    };
    if (!hasInitializedParamsRef.current) {
      hasInitializedParamsRef.current = true;
      paramsRef.current = nextParams;
      return;
    }
    if (
      paramsRef.current.inputEncoding === nextParams.inputEncoding &&
      paramsRef.current.inputCharset === nextParams.inputCharset &&
      paramsRef.current.outputCharset === nextParams.outputCharset &&
      paramsRef.current.outputEncoding === nextParams.outputEncoding &&
      paramsRef.current.outputBase64Padding ===
        nextParams.outputBase64Padding &&
      paramsRef.current.outputBase64UrlSafe ===
        nextParams.outputBase64UrlSafe &&
      paramsRef.current.outputHexType === nextParams.outputHexType &&
      paramsRef.current.outputHexUpperCase === nextParams.outputHexUpperCase &&
      paramsRef.current.outputBom === nextParams.outputBom &&
      paramsRef.current.autoDetect === nextParams.autoDetect &&
      paramsRef.current.fileName === nextParams.fileName &&
      paramsRef.current.fileData === nextParams.fileData
    ) {
      return;
    }
    paramsRef.current = nextParams;
    upsertParams(nextParams, "interpretation");
  }, [
    state.inputEncoding,
    state.inputCharset,
    state.outputCharset,
    state.outputEncoding,
    state.outputBase64Padding,
    state.outputBase64UrlSafe,
    state.outputHexType,
    state.outputHexUpperCase,
    state.outputBom,
    state.autoDetect,
    state.fileName,
    state.fileData,
    upsertParams,
  ]);

  return (
    <CharsetConverterForm
      state={state}
      setParam={setParam}
      charsetOptions={charsetOptions}
      outputText={outputText}
      leftError={leftError}
      leftWarning={leftWarning}
      base64Detection={base64Detection}
      bomInfo={bomInfo}
      detectedCharsets={detectedCharsets}
      fileName={fileName}
      hasFileInput={hasFileInput}
      onLeftChange={onLeftChange}
      onFileUpload={onFileUpload}
      onDownload={onDownload}
      onRightCopy={onRightCopy}
      onClearFile={onClearFile}
      onClear={onClear}
    />
  );
}
