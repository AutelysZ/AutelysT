"use client";

import * as React from "react";
import type { HistoryEntry } from "@/lib/history/db";
import { ToolPageWrapper } from "@/components/tool-ui/tool-page-wrapper";
import { useUrlSyncedState } from "@/lib/url-state/use-url-synced-state";
import BencodeInner from "./bencode-inner";
import { paramsSchema, type BencodeState } from "./bencode-types";

export default function BencodeContent() {
  const { state, setParam, oversizeKeys, resetToDefaults } = useUrlSyncedState(
    "bencode",
    {
      schema: paramsSchema,
      defaults: paramsSchema.parse({}),
    },
  );

  const [fileName, setFileName] = React.useState<string | null>(null);

  const handleLoadHistory = React.useCallback(
    (entry: HistoryEntry) => {
      const { inputs, params } = entry;
      if (params.fileName) {
        alert(
          "This history entry contains an uploaded file and cannot be restored.",
        );
        return;
      }
      setFileName(null);
      if (inputs.input !== undefined) setParam("input", inputs.input);
      const typedParams = params as Partial<BencodeState>;
      (Object.keys(paramsSchema.shape) as (keyof BencodeState)[]).forEach(
        (key) => {
          if (typedParams[key] !== undefined) {
            setParam(key, typedParams[key] as BencodeState[typeof key]);
          }
        },
      );
    },
    [setParam],
  );

  return (
    <ToolPageWrapper
      toolId="bencode"
      title="Bencode"
      description="Encode and decode Bencode data with JSON/YAML conversion and type details."
      onLoadHistory={handleLoadHistory}
    >
      <BencodeInner
        state={state}
        setParam={setParam}
        oversizeKeys={oversizeKeys}
        resetToDefaults={resetToDefaults}
        fileName={fileName}
        setFileName={setFileName}
      />
    </ToolPageWrapper>
  );
}
