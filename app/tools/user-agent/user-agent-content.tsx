"use client";

import * as React from "react";
import { ToolPageWrapper } from "@/components/tool-ui/tool-page-wrapper";
import { useUrlSyncedState } from "@/lib/url-state/use-url-synced-state";
import type { HistoryEntry } from "@/lib/history/db";
import UserAgentInner from "./user-agent-inner";
import {
  buildUserAgentString,
  parseUserAgentString,
} from "./user-agent-utils";
import { paramsSchema, type UserAgentState } from "./user-agent-types";

const defaultUserAgent =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";

export default function UserAgentContent() {
  const defaultJson = React.useMemo(() => {
    const parsed = parseUserAgentString(defaultUserAgent);
    return parsed.json || "";
  }, []);

  const { state, setParam, oversizeKeys, hasUrlParams, hydrationSource } =
    useUrlSyncedState("user-agent", {
      schema: paramsSchema,
      defaults: paramsSchema.parse({
        leftText: defaultUserAgent,
        rightText: defaultJson,
        activeSide: "left",
        rightView: "table",
      }),
    });

  React.useEffect(() => {
    if (hydrationSource !== "default") return;
    if (hasUrlParams) return;
    if (state.leftText.trim()) return;
    if (typeof window === "undefined") return;
    const ua = window.navigator.userAgent || "";
    if (!ua) return;
    const next = ua;
    setParam("leftText", next);
    setParam("activeSide", "left", true);
  }, [hasUrlParams, hydrationSource, setParam, state.leftText]);

  const [leftError, setLeftError] = React.useState<string | null>(null);
  const [rightError, setRightError] = React.useState<string | null>(null);

  const parseLeft = React.useCallback(
    (value: string) => {
      const result = parseUserAgentString(value);
      setLeftError(result.error);
      if (!result.error) {
        setRightError(null);
        setParam("rightText", result.json);
      }
    },
    [setParam],
  );

  const parseRight = React.useCallback(
    (value: string) => {
      const result = buildUserAgentString(value);
      setRightError(result.error);
      if (!result.error) {
        setLeftError(null);
        setParam("leftText", result.ua);
      }
    },
    [setParam],
  );

  const handleLeftChange = React.useCallback(
    (value: string) => {
      setParam("leftText", value);
      setParam("activeSide", "left");
      parseLeft(value);
    },
    [parseLeft, setParam],
  );

  const handleRightChange = React.useCallback(
    (value: string) => {
      setParam("rightText", value);
      setParam("activeSide", "right");
      parseRight(value);
    },
    [parseRight, setParam],
  );

  const handleResetToCurrent = React.useCallback(() => {
    if (typeof window === "undefined") return;
    const ua = window.navigator.userAgent || "";
    if (!ua) return;
    const next = ua;
    handleLeftChange(next);
  }, [handleLeftChange]);

  const handleClearAll = React.useCallback(() => {
    setParam("leftText", "");
    setParam("rightText", "");
    setParam("activeSide", "left", true);
  }, [setParam]);

  React.useEffect(() => {
    if (state.activeSide === "left") {
      parseLeft(state.leftText);
    } else {
      parseRight(state.rightText);
    }
  }, [parseLeft, parseRight, state.activeSide, state.leftText, state.rightText]);

  const handleLoadHistory = React.useCallback(
    (entry: HistoryEntry) => {
      const { inputs, params } = entry;
      if (inputs.leftText !== undefined) setParam("leftText", inputs.leftText);
      if (inputs.rightText !== undefined)
        setParam("rightText", inputs.rightText);
      if (params.activeSide)
        setParam(
          "activeSide",
          params.activeSide as UserAgentState["activeSide"],
          true,
        );
      if (params.rightView)
        setParam(
          "rightView",
          params.rightView as UserAgentState["rightView"],
          true,
        );
    },
    [setParam],
  );

  return (
    <ToolPageWrapper
      toolId="user-agent"
      title="User Agent"
      description="Parse and build User-Agent strings with a dual-panel editor and JSON/table views."
      onLoadHistory={handleLoadHistory}
    >
      <UserAgentInner
        state={state}
        leftError={leftError}
        rightError={rightError}
        leftWarning={null}
        rightWarning={null}
        oversizeKeys={oversizeKeys}
        hasUrlParams={hasUrlParams}
        hydrationSource={hydrationSource}
        onLeftChange={handleLeftChange}
        onRightChange={handleRightChange}
        onRightViewChange={(view) => setParam("rightView", view, true)}
        onResetToCurrent={handleResetToCurrent}
        onClearAll={handleClearAll}
      />
    </ToolPageWrapper>
  );
}
