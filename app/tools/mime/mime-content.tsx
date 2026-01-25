"use client";

import * as React from "react";
import { z } from "zod";
import { ToolPageWrapper } from "@/components/tool-ui/tool-page-wrapper";
import { useUrlSyncedState } from "@/lib/url-state/use-url-synced-state";
import type { HistoryEntry } from "@/lib/history/db";
import MimeInner from "./mime-inner";
import { getMimeTypeFromFilename } from "./mime-utils";

const paramsSchema = z.object({
  fileName: z.string().default(""),
  mimeType: z.string().default(""),
});

type FileDetection = {
  fileName: string;
  fileSize: number;
  browserMime: string;
  detectedMime: string;
  detectedExt: string;
};

export default function MimeContent() {
  const { state, setParam, oversizeKeys, hasUrlParams, hydrationSource } =
    useUrlSyncedState("mime", {
      schema: paramsSchema,
      defaults: paramsSchema.parse({}),
    });

  const handleLoadHistory = React.useCallback(
    (entry: HistoryEntry) => {
      const { inputs } = entry;
      if (inputs.fileName !== undefined) {
        setParam("fileName", inputs.fileName);
      }
      if (inputs.mimeType !== undefined) {
        setParam("mimeType", inputs.mimeType);
      }
    },
    [setParam],
  );

  const [fileDetection, setFileDetection] =
    React.useState<FileDetection | null>(null);
  const [isDetecting, setIsDetecting] = React.useState(false);
  const [detectError, setDetectError] = React.useState<string | null>(null);

  const handleFileUpload = React.useCallback(
    (file: File) => {
      if (!file) return;
      setIsDetecting(true);
      setDetectError(null);
      setParam("fileName", file.name);
      const detected = getMimeTypeFromFilename(file.name);
      setFileDetection({
        fileName: file.name,
        fileSize: file.size,
        browserMime: file.type ?? "",
        detectedMime: detected.mime,
        detectedExt: detected.ext,
      });
      setIsDetecting(false);
    },
    [setParam],
  );

  return (
    <ToolPageWrapper
      toolId="mime"
      title="MIME Lookup"
      description="Detect MIME types by filename and list known extensions."
      onLoadHistory={handleLoadHistory}
    >
      <MimeInner
        state={state}
        setParam={setParam}
        oversizeKeys={oversizeKeys}
        hasUrlParams={hasUrlParams}
        hydrationSource={hydrationSource}
        fileDetection={fileDetection}
        isDetecting={isDetecting}
        detectError={detectError}
        onFileUpload={handleFileUpload}
      />
    </ToolPageWrapper>
  );
}
