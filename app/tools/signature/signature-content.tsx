"use client";

import * as React from "react";
import { ToolPageWrapper } from "@/components/tool-ui/tool-page-wrapper";
import { useUrlSyncedState } from "@/lib/url-state/use-url-synced-state";
import type { HistoryEntry } from "@/lib/history/db";
import SignatureInner from "./signature-inner";
import { paramsSchema, type SignatureState } from "./signature-types";

export default function SignatureContent() {
  const {
    state,
    setParam,
    oversizeKeys,
    hasUrlParams,
    hydrationSource,
    resetToDefaults,
  } = useUrlSyncedState("signature", {
    schema: paramsSchema,
    defaults: paramsSchema.parse({}),
  });
  const [fileName, setFileName] = React.useState<string | null>(null);

  const handleLoadHistory = React.useCallback(
    (entry: HistoryEntry) => {
      const { inputs, params } = entry;
      if (params.fileName) {
        alert(
          "This history entry contains an uploaded file and cannot be restored. Only the file name was recorded.",
        );
        return;
      }
      setFileName(null);
      if (inputs.message !== undefined) setParam("message", inputs.message);
      if (inputs.signature !== undefined)
        setParam("signature", inputs.signature);
      const typedParams = params as Partial<SignatureState>;
      (Object.keys(paramsSchema.shape) as (keyof SignatureState)[]).forEach(
        (key) => {
          if (typedParams[key] !== undefined) {
            setParam(key, typedParams[key] as SignatureState[typeof key]);
          }
        },
      );
    },
    [setParam],
  );

  return (
    <ToolPageWrapper
      toolId="signature"
      title="Signature"
      description="Sign and verify messages with HMAC, RSA, ECDSA, EdDSA, Schnorr, ML-DSA, and SLH-DSA."
      onLoadHistory={handleLoadHistory}
    >
      <SignatureInner
        state={state}
        setParam={setParam}
        oversizeKeys={oversizeKeys}
        hasUrlParams={hasUrlParams}
        hydrationSource={hydrationSource}
        resetToDefaults={resetToDefaults}
        fileName={fileName}
        setFileName={setFileName}
      />
    </ToolPageWrapper>
  );
}
