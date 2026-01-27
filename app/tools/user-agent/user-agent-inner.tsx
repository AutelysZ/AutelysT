"use client";

import * as React from "react";
import { DEFAULT_URL_SYNC_DEBOUNCE_MS } from "@/lib/url-state/use-url-synced-state";
import { useToolHistoryContext } from "@/components/tool-ui/tool-page-wrapper";
import type { UserAgentState } from "./user-agent-types";
import UserAgentForm from "./user-agent-form";

type UserAgentInnerProps = {
  state: UserAgentState;
  leftError: string | null;
  rightError: string | null;
  leftWarning: string | null;
  rightWarning: string | null;
  oversizeKeys: (keyof UserAgentState)[];
  hasUrlParams: boolean;
  hydrationSource: "default" | "url" | "history";
  onLeftChange: (value: string) => void;
  onRightChange: (value: string) => void;
  onRightViewChange: (view: UserAgentState["rightView"]) => void;
  onResetToCurrent: () => void;
  onClearAll: () => void;
};

export default function UserAgentInner({
  state,
  leftError,
  rightError,
  leftWarning,
  rightWarning,
  oversizeKeys,
  hasUrlParams,
  hydrationSource,
  onLeftChange,
  onRightChange,
  onRightViewChange,
  onResetToCurrent,
  onClearAll,
}: UserAgentInnerProps) {
  const { upsertInputEntry, upsertParams } = useToolHistoryContext();
  const lastInputRef = React.useRef("");
  const hasHydratedInputRef = React.useRef(false);
  const paramsRef = React.useRef({
    activeSide: state.activeSide,
    rightView: state.rightView,
  });
  const hasInitializedParamsRef = React.useRef(false);
  const hasHandledUrlRef = React.useRef(false);

  React.useEffect(() => {
    if (hasHydratedInputRef.current) return;
    if (hydrationSource === "default") return;
    const activeText =
      state.activeSide === "left" ? state.leftText : state.rightText;
    lastInputRef.current = activeText;
    hasHydratedInputRef.current = true;
  }, [hydrationSource, state.activeSide, state.leftText, state.rightText]);

  React.useEffect(() => {
    const activeText =
      state.activeSide === "left" ? state.leftText : state.rightText;
    if (activeText === lastInputRef.current) return;

    const timer = setTimeout(() => {
      lastInputRef.current = activeText;
      upsertInputEntry(
        { leftText: state.leftText, rightText: state.rightText },
        { activeSide: state.activeSide, rightView: state.rightView },
        state.activeSide,
        activeText.slice(0, 120),
      );
    }, DEFAULT_URL_SYNC_DEBOUNCE_MS);

    return () => clearTimeout(timer);
  }, [state.leftText, state.rightText, state.activeSide, upsertInputEntry]);

  React.useEffect(() => {
    if (hasUrlParams && !hasHandledUrlRef.current) {
      hasHandledUrlRef.current = true;
      const activeText =
        state.activeSide === "left" ? state.leftText : state.rightText;
      if (activeText) {
        upsertInputEntry(
          { leftText: state.leftText, rightText: state.rightText },
          { activeSide: state.activeSide, rightView: state.rightView },
          state.activeSide,
          activeText.slice(0, 120),
        );
      } else {
        upsertParams(
          { activeSide: state.activeSide, rightView: state.rightView },
          "interpretation",
        );
      }
    }
  }, [
    hasUrlParams,
    state.leftText,
    state.rightText,
    state.activeSide,
    state.rightView,
    upsertInputEntry,
    upsertParams,
  ]);

  React.useEffect(() => {
    const nextParams = {
      activeSide: state.activeSide,
      rightView: state.rightView,
    };
    if (!hasInitializedParamsRef.current) {
      hasInitializedParamsRef.current = true;
      paramsRef.current = nextParams;
      return;
    }
    if (
      paramsRef.current.activeSide === nextParams.activeSide &&
      paramsRef.current.rightView === nextParams.rightView
    ) {
      return;
    }
    paramsRef.current = nextParams;
    upsertParams(nextParams, "interpretation");
  }, [state.activeSide, state.rightView, upsertParams]);

  const leftOversizeWarning = oversizeKeys.includes("leftText")
    ? "Input exceeds 2 KB and is not synced to the URL."
    : null;
  const rightOversizeWarning = oversizeKeys.includes("rightText")
    ? "Input exceeds 2 KB and is not synced to the URL."
    : null;

  return (
    <UserAgentForm
      state={state}
      leftError={leftError}
      rightError={rightError}
      leftWarning={leftWarning ?? leftOversizeWarning}
      rightWarning={rightWarning ?? rightOversizeWarning}
      onLeftChange={onLeftChange}
      onRightChange={onRightChange}
      onRightViewChange={onRightViewChange}
      onResetToCurrent={onResetToCurrent}
      onClearAll={onClearAll}
    />
  );
}
