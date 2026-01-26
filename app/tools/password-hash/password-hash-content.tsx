"use client";

import * as React from "react";
import { ToolPageWrapper } from "@/components/tool-ui/tool-page-wrapper";
import { useUrlSyncedState } from "@/lib/url-state/use-url-synced-state";
import type { HistoryEntry } from "@/lib/history/db";
import PasswordHashInner from "./password-hash-inner";
import { paramsSchema, type PasswordHashState } from "./password-hash-types";

export default function PasswordHashContent() {
  const { state, setParam, oversizeKeys, hasUrlParams, hydrationSource, resetToDefaults } =
    useUrlSyncedState("password-hash", {
      schema: paramsSchema,
      defaults: paramsSchema.parse({}),
    });

  const handleLoadHistory = React.useCallback(
    (entry: HistoryEntry) => {
      const { inputs, params } = entry;
      const typedParams = params as Partial<PasswordHashState>;
      const setIfDefined = <K extends keyof PasswordHashState>(
        key: K,
        value: PasswordHashState[K] | undefined,
      ) => {
        if (value === undefined) return;
        setParam(key, value, true);
      };

      (Object.keys(paramsSchema.shape) as (keyof PasswordHashState)[]).forEach(
        (key) => {
          if (inputs[key] !== undefined) {
            setParam(key, inputs[key] as PasswordHashState[typeof key]);
          } else {
            setIfDefined(key, typedParams[key]);
          }
        },
      );
    },
    [setParam],
  );

  return (
    <ToolPageWrapper
      toolId="password-hash"
      title="Password Hash"
      description="Generate, verify, and parse bcrypt, scrypt, and Argon2 hashes with full parameter control."
      onLoadHistory={handleLoadHistory}
    >
      <PasswordHashInner
        state={state}
        setParam={setParam}
        oversizeKeys={oversizeKeys}
        hasUrlParams={hasUrlParams}
        hydrationSource={hydrationSource}
        resetToDefaults={resetToDefaults}
      />
    </ToolPageWrapper>
  );
}
