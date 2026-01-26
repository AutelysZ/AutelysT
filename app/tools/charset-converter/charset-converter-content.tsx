"use client";

import * as React from "react";
import {
  convertCharset,
  decodeBytesToText,
  decodeInputEncodingToBytes,
  detectBom,
  detectCharsets,
  encodeOutput,
  encodeTextToBytes,
  getCharsetOptions,
  getOutputBytesWithBom,
  getDownloadPayload,
  normalizeCharsetValue,
  stripBom,
  type Base64Detection,
  type BomDetection,
  type DetectedCharset,
} from "@/lib/encoding/charset-converter";
import { decodeBase64, encodeBase64 } from "@/lib/encoding/base64";
import { ToolPageWrapper } from "@/components/tool-ui/tool-page-wrapper";
import { useUrlSyncedState } from "@/lib/url-state/use-url-synced-state";
import type { HistoryEntry } from "@/lib/history/db";
import CharsetConverterInner from "./charset-converter-inner";
import { paramsSchema, type ParamsState } from "./charset-converter-types";

const charsetOptions = getCharsetOptions();

export default function CharsetConverterContent() {
  const {
    state,
    setParam,
    resetToDefaults,
    oversizeKeys,
    hasUrlParams,
    hydrationSource,
  } = useUrlSyncedState("charset-converter", {
    schema: paramsSchema,
    defaults: paramsSchema.parse({}),
  });

  const [outputText, setOutputText] = React.useState("");
  const [outputBytes, setOutputBytes] = React.useState<Uint8Array>(
    new Uint8Array(),
  );
  const [leftError, setLeftError] = React.useState<string | null>(null);
  const [base64Detection, setBase64Detection] =
    React.useState<Base64Detection | null>(null);
  const [bomInfo, setBomInfo] = React.useState<BomDetection | null>(null);
  const [detectedCharsets, setDetectedCharsets] = React.useState<
    DetectedCharset[]
  >([]);
  const [inputSource, setInputSource] = React.useState<"text" | "file">(
    "text",
  );
  const [fileName, setFileName] = React.useState<string | null>(null);
  const [fileVersion, setFileVersion] = React.useState(0);
  const fileBytesRef = React.useRef<Uint8Array | null>(null);
  const fileDataRef = React.useRef<string>("");

  const handleLeftChange = React.useCallback(
    (value: string) => {
      setParam("inputText", value);
      if (inputSource === "file") {
        fileBytesRef.current = null;
        setInputSource("text");
        setFileName(null);
        setFileVersion((version) => version + 1);
        setParam("fileName", "");
        setParam("fileData", "");
        fileDataRef.current = "";
      }
    },
    [inputSource, setParam],
  );

  const handleFileUpload = React.useCallback(
    async (file: File) => {
      try {
        const buffer = await file.arrayBuffer();
        const bytes = new Uint8Array(buffer);
        setInputSource("file");
        fileBytesRef.current = bytes;
        setFileName(file.name);
        setFileVersion((version) => version + 1);
        setLeftError(null);
        setBase64Detection(null);
        setParam("inputText", "");

        if (state.inputEncoding !== "raw") {
          setParam("inputEncoding", "raw");
        }

        if (bytes.length <= 2048) {
          const encoded = encodeBase64(bytes, { padding: true, urlSafe: false });
          setParam("fileData", encoded);
          setParam("fileName", file.name);
          fileDataRef.current = encoded;
        } else {
          setParam("fileData", "");
          setParam("fileName", "");
          fileDataRef.current = "";
        }
      } catch (error) {
        console.error("Failed to load file", error);
        setLeftError("Failed to load file");
      }
    },
    [setParam, state.inputEncoding],
  );

  const handleDownload = React.useCallback(() => {
    if (!outputText) return;

    try {
      const { content, mimeType } = getDownloadPayload(
        outputText,
        outputBytes,
        state.outputEncoding,
      );

      const blob =
        content instanceof Uint8Array
          ? new Blob([content as Uint8Array<ArrayBuffer>], { type: mimeType })
          : new Blob([content], { type: mimeType });
      const url = URL.createObjectURL(blob);
      const filename = `converted-${state.outputCharset.toLowerCase()}-${
        state.outputEncoding
      }.txt`;

      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = filename;
      document.body.appendChild(anchor);
      anchor.click();
      document.body.removeChild(anchor);
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error("Failed to prepare download", error);
      setLeftError("Failed to prepare download");
    }
  }, [outputBytes, outputText, state.outputCharset, state.outputEncoding]);

  const handleCopyOutput = React.useCallback(async () => {
    if (!outputText && outputBytes.length === 0) return;

    try {
      if (
        state.outputEncoding === "raw" &&
        typeof ClipboardItem !== "undefined" &&
        navigator.clipboard &&
        "write" in navigator.clipboard
      ) {
        const mimeType = "text/plain";
        const blob = new Blob([outputBytes], { type: mimeType });
        await navigator.clipboard.write([new ClipboardItem({ [mimeType]: blob })]);
        return;
      }

      await navigator.clipboard.writeText(outputText);
    } catch (error) {
      console.error("Failed to copy output", error);
      throw error;
    }
  }, [outputBytes, outputText, state.outputCharset, state.outputEncoding]);

  const handleClearFile = React.useCallback(() => {
    fileBytesRef.current = null;
    setFileName(null);
    setInputSource("text");
    setFileVersion((version) => version + 1);
    setParam("fileName", "");
    setParam("fileData", "");
    fileDataRef.current = "";
  }, [setParam]);

  const handleClear = React.useCallback(() => {
    fileBytesRef.current = null;
    setInputSource("text");
    setFileName(null);
    setFileVersion((version) => version + 1);
    setDetectedCharsets([]);
    setBomInfo(null);
    setBase64Detection(null);
    setLeftError(null);
    setOutputText("");
    setOutputBytes(new Uint8Array());
    resetToDefaults();
    fileDataRef.current = "";
  }, [resetToDefaults]);

  React.useEffect(() => {
    const hasFileInput = inputSource === "file" && fileBytesRef.current;
    if (!state.inputText && !hasFileInput) {
      setOutputText("");
      setOutputBytes(new Uint8Array());
      setLeftError(null);
      setBase64Detection(null);
      return;
    }

    try {
      if (hasFileInput && fileBytesRef.current) {
        const inputCharset = normalizeCharsetValue(state.inputCharset);
        const outputCharset = normalizeCharsetValue(state.outputCharset);
        const stripped = stripBom(fileBytesRef.current);
        const decodedText = decodeBytesToText(stripped.bytes, inputCharset);
        const outputBytes = encodeTextToBytes(decodedText, outputCharset);
        const outputWithBom = getOutputBytesWithBom(
          outputBytes,
          outputCharset,
          state.outputBom,
        );
        const outputText = encodeOutput(outputWithBom, state.outputEncoding, {
          outputBase64Padding: state.outputBase64Padding,
          outputBase64UrlSafe: state.outputBase64UrlSafe,
          outputHexType: state.outputHexType,
          outputHexUpperCase: state.outputHexUpperCase,
          outputCharset,
        });
        setOutputText(outputText);
        setOutputBytes(outputWithBom);
        setBase64Detection(null);
        setLeftError(null);
        return;
      }

      const result = convertCharset({
        inputText: state.inputText,
        inputEncoding: state.inputEncoding,
        inputCharset: state.inputCharset,
        outputCharset: state.outputCharset,
        outputEncoding: state.outputEncoding,
        outputBase64Padding: state.outputBase64Padding,
        outputBase64UrlSafe: state.outputBase64UrlSafe,
        outputHexType: state.outputHexType,
        outputHexUpperCase: state.outputHexUpperCase,
        outputBom: state.outputBom,
      });

      setOutputText(result.outputText);
      setOutputBytes(result.outputBytes);
      setBase64Detection(result.base64Detection ?? null);
      setLeftError(null);
    } catch (error) {
      console.error("Conversion failed", error);
      setLeftError(error instanceof Error ? error.message : "Conversion failed");
      setOutputText("");
      setOutputBytes(new Uint8Array());
      setBase64Detection(null);
    }
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
    inputSource,
    fileVersion,
  ]);

  React.useEffect(() => {
    if (!state.inputText && !fileBytesRef.current) {
      setDetectedCharsets([]);
      setBomInfo(null);
      return;
    }

    if (
      state.autoDetect &&
      state.inputEncoding === "raw" &&
      inputSource !== "file"
    ) {
      if (!state.inputText) {
        setDetectedCharsets([]);
        setBomInfo(null);
        return;
      }
      const utf8Charset = "UTF-8";
      setDetectedCharsets([
        { charset: utf8Charset, confidence: 1, source: "chardet" },
      ]);
      setBomInfo(null);
      if (normalizeCharsetValue(state.inputCharset) !== utf8Charset) {
        setParam("inputCharset", utf8Charset);
      }
      return;
    }

    let bytes: Uint8Array | null = null;

    if (inputSource === "file" && fileBytesRef.current) {
      bytes = fileBytesRef.current;
    }

    if (!bytes) {
      try {
        bytes = decodeInputEncodingToBytes(
          state.inputText,
          state.inputEncoding,
        ).bytes;
      } catch (error) {
        console.error("Failed to parse input for detection", error);
        setDetectedCharsets([]);
        setBomInfo(null);
        return;
      }
    }

    if (!bytes || bytes.length === 0) {
      setDetectedCharsets([]);
      setBomInfo(null);
      return;
    }

    if (!state.autoDetect) {
      setDetectedCharsets([]);
      setBomInfo(detectBom(bytes));
      return;
    }

    const detection = detectCharsets(bytes);
    setDetectedCharsets(detection.detected);
    setBomInfo(detection.bom);

    if (detection.detected.length > 0) {
      const normalizedCurrent = normalizeCharsetValue(state.inputCharset);
      const hasCurrent = detection.detected.some(
        (item) => normalizeCharsetValue(item.charset) === normalizedCurrent,
      );
      if (!hasCurrent) {
        setParam("inputCharset", detection.detected[0].charset);
      }
    }
  }, [
    state.inputText,
    state.inputEncoding,
    state.autoDetect,
    state.inputCharset,
    inputSource,
    fileVersion,
    setParam,
  ]);

  React.useEffect(() => {
    if (!state.fileData) return;
    if (fileDataRef.current === state.fileData && fileBytesRef.current) {
      if (state.fileName && state.fileName !== fileName) {
        setFileName(state.fileName);
      }
      return;
    }

    try {
      const bytes = decodeBase64(state.fileData);
      fileBytesRef.current = bytes;
      setInputSource("file");
      setFileVersion((version) => version + 1);
      fileDataRef.current = state.fileData;
      setFileName(state.fileName || "Uploaded file");
      if (state.inputEncoding !== "raw") {
        setParam("inputEncoding", "raw");
      }
    } catch (error) {
      console.error("Failed to restore file data", error);
      setLeftError("Failed to restore file data");
    }
  }, [fileName, state.fileData, state.fileName, state.inputEncoding, setParam]);

  React.useEffect(() => {
    if (!state.autoDetect) return;
    const hasInput =
      Boolean(state.inputText) ||
      (inputSource === "file" && Boolean(fileBytesRef.current));
    if (hasInput) return;
    if (normalizeCharsetValue(state.inputCharset) !== "UTF-8") {
      setParam("inputCharset", "UTF-8");
    }
  }, [inputSource, state.autoDetect, state.inputCharset, state.inputText, setParam]);

  const handleLoadHistory = React.useCallback(
    (entry: HistoryEntry) => {
      const { inputs, params } = entry;
      if (inputs.inputText !== undefined) {
        setParam("inputText", String(inputs.inputText));
      }
      if (params.fileName !== undefined) {
        setParam("fileName", String(params.fileName));
      }
      if (params.fileData !== undefined) {
        setParam("fileData", String(params.fileData));
      }
      if (params.inputEncoding) {
        setParam("inputEncoding", params.inputEncoding as ParamsState["inputEncoding"]);
      }
      if (params.inputCharset) {
        setParam("inputCharset", String(params.inputCharset));
      }
      if (params.outputCharset) {
        setParam("outputCharset", String(params.outputCharset));
      }
      if (params.outputEncoding) {
        setParam("outputEncoding", params.outputEncoding as ParamsState["outputEncoding"]);
      }
      if (params.outputBase64Padding !== undefined) {
        setParam("outputBase64Padding", Boolean(params.outputBase64Padding));
      }
      if (params.outputBase64UrlSafe !== undefined) {
        setParam("outputBase64UrlSafe", Boolean(params.outputBase64UrlSafe));
      }
      if (params.outputHexType) {
        setParam("outputHexType", params.outputHexType as ParamsState["outputHexType"]);
      }
      if (params.outputHexUpperCase !== undefined) {
        setParam("outputHexUpperCase", Boolean(params.outputHexUpperCase));
      }
      if (params.outputBom !== undefined) {
        setParam("outputBom", Boolean(params.outputBom));
      }
      if (params.autoDetect !== undefined) {
        setParam("autoDetect", Boolean(params.autoDetect));
      }
    },
    [setParam],
  );

  return (
    <ToolPageWrapper
      toolId="charset-converter"
      title="Charset Converter"
      description="Convert text between iconv-lite charsets with Base64 and Hex encoding support, BOM detection, and auto-detection."
      onLoadHistory={handleLoadHistory}
    >
      <CharsetConverterInner
        state={state}
        setParam={setParam}
        oversizeKeys={oversizeKeys}
        hasUrlParams={hasUrlParams}
        hydrationSource={hydrationSource}
        charsetOptions={charsetOptions}
        outputText={outputText}
        leftError={leftError}
        base64Detection={base64Detection}
        bomInfo={bomInfo}
        detectedCharsets={detectedCharsets}
        fileName={fileName}
        hasFileInput={inputSource === "file" && Boolean(fileBytesRef.current)}
        onLeftChange={handleLeftChange}
        onFileUpload={handleFileUpload}
        onDownload={handleDownload}
        onRightCopy={handleCopyOutput}
        onClearFile={handleClearFile}
        onClear={handleClear}
      />
    </ToolPageWrapper>
  );
}
