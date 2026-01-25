"use client";

import * as React from "react";
import { DEFAULT_URL_SYNC_DEBOUNCE_MS } from "@/lib/url-state/use-url-synced-state";
import { useToolHistoryContext } from "@/components/tool-ui/tool-page-wrapper";
import CspBuilderForm from "./csp-builder-form";
import type { CspBuilderState, CspDirective } from "./csp-builder-types";

type CspBuilderInnerProps = {
  state: CspBuilderState;
  directives: CspDirective[];
  normalizedPolicy: string;
  parseError: string | null;
  oversizePolicy: boolean;
  hasUrlParams: boolean;
  hydrationSource: "default" | "url" | "history";
  onPolicyChange: (value: string) => void;
  onDirectivesChange: (directives: CspDirective[]) => void;
};

export default function CspBuilderInner({
  state,
  directives,
  normalizedPolicy,
  parseError,
  oversizePolicy,
  hasUrlParams,
  hydrationSource,
  onPolicyChange,
  onDirectivesChange,
}: CspBuilderInnerProps) {
  const { addHistoryEntry } = useToolHistoryContext();
  const lastInputRef = React.useRef("");
  const hasHydratedInputRef = React.useRef(false);
  const hasHandledUrlRef = React.useRef(false);

  React.useEffect(() => {
    if (hasHydratedInputRef.current) return;
    if (hydrationSource === "default") return;
    lastInputRef.current = state.policy;
    hasHydratedInputRef.current = true;
  }, [hydrationSource, state.policy]);

  React.useEffect(() => {
    if (!state.policy || state.policy === lastInputRef.current) return;
    const timer = setTimeout(() => {
      lastInputRef.current = state.policy;
      addHistoryEntry(
        { policy: state.policy },
        {},
        "left",
        state.policy.slice(0, 120),
      );
    }, DEFAULT_URL_SYNC_DEBOUNCE_MS);

    return () => clearTimeout(timer);
  }, [state.policy, addHistoryEntry]);

  React.useEffect(() => {
    if (hasUrlParams && !hasHandledUrlRef.current) {
      hasHandledUrlRef.current = true;
      if (state.policy) {
        addHistoryEntry(
          { policy: state.policy },
          {},
          "left",
          state.policy.slice(0, 120),
        );
      }
    }
  }, [hasUrlParams, state.policy, addHistoryEntry]);

  return (
    <CspBuilderForm
      policy={state.policy}
      directives={directives}
      normalizedPolicy={normalizedPolicy}
      parseError={parseError}
      oversizePolicy={oversizePolicy}
      onPolicyChange={onPolicyChange}
      onDirectivesChange={onDirectivesChange}
    />
  );
}
