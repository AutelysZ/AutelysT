"use client";

import * as React from "react";
import { useToolHistoryContext } from "@/components/tool-ui/tool-page-wrapper";
import { DEFAULT_URL_SYNC_DEBOUNCE_MS } from "@/lib/url-state/use-url-synced-state";
import MimeForm from "./mime-form";

type MimeState = {
  fileName: string;
  mimeType: string;
};

type FileDetection = {
  fileName: string;
  fileSize: number;
  browserMime: string;
  detectedMime: string;
  detectedExt: string;
};

type MimeInnerProps = {
  state: MimeState;
  setParam: <K extends keyof MimeState>(
    key: K,
    value: MimeState[K],
    immediate?: boolean,
  ) => void;
  oversizeKeys: (keyof MimeState)[];
  hasUrlParams: boolean;
  hydrationSource: "default" | "url" | "history";
  fileDetection: FileDetection | null;
  isDetecting: boolean;
  detectError: string | null;
  onFileUpload: (file: File) => void;
};

export default function MimeInner({
  state,
  setParam,
  oversizeKeys,
  hasUrlParams,
  hydrationSource,
  fileDetection,
  isDetecting,
  detectError,
  onFileUpload,
}: MimeInnerProps) {
  const { upsertInputEntry } = useToolHistoryContext();
  const lastSavedRef = React.useRef<MimeState>({
    fileName: "",
    mimeType: "",
  });
  const hasHydratedInputRef = React.useRef(false);
  const hasHandledUrlRef = React.useRef(false);

  React.useEffect(() => {
    if (hasHydratedInputRef.current) return;
    if (hydrationSource === "default") return;
    lastSavedRef.current = {
      fileName: state.fileName,
      mimeType: state.mimeType,
    };
    hasHydratedInputRef.current = true;
  }, [hydrationSource, state.fileName, state.mimeType]);

  React.useEffect(() => {
    if (
      state.fileName === lastSavedRef.current.fileName &&
      state.mimeType === lastSavedRef.current.mimeType
    ) {
      return;
    }

    const timer = setTimeout(() => {
      lastSavedRef.current = {
        fileName: state.fileName,
        mimeType: state.mimeType,
      };
      const preview = state.fileName || state.mimeType || "Empty";
      upsertInputEntry(
        { fileName: state.fileName, mimeType: state.mimeType },
        {},
        undefined,
        preview.slice(0, 100),
      );
    }, DEFAULT_URL_SYNC_DEBOUNCE_MS);

    return () => clearTimeout(timer);
  }, [state.fileName, state.mimeType, upsertInputEntry]);

  React.useEffect(() => {
    if (!hasUrlParams || hasHandledUrlRef.current) return;
    hasHandledUrlRef.current = true;
    if (!state.fileName && !state.mimeType) return;
    const preview = state.fileName || state.mimeType;
    upsertInputEntry(
      { fileName: state.fileName, mimeType: state.mimeType },
      {},
      undefined,
      preview.slice(0, 100),
    );
  }, [hasUrlParams, state.fileName, state.mimeType, upsertInputEntry]);

  const handleFileNameChange = React.useCallback(
    (value: string) => {
      setParam("fileName", value);
    },
    [setParam],
  );

  const handleMimeTypeChange = React.useCallback(
    (value: string) => {
      setParam("mimeType", value);
    },
    [setParam],
  );

  return (
    <>
      <MimeForm
        fileName={state.fileName}
        mimeType={state.mimeType}
        fileDetection={fileDetection}
        isDetecting={isDetecting}
        detectError={detectError}
        onFileNameChange={handleFileNameChange}
        onMimeTypeChange={handleMimeTypeChange}
        onFileUpload={onFileUpload}
      />
      {oversizeKeys.length > 0 && (
        <p className="mt-4 text-xs text-muted-foreground">
          Some inputs are too large to sync to the URL.
        </p>
      )}
    </>
  );
}
