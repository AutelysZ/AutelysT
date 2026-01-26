"use client";

import * as React from "react";
import { z } from "zod";
import { ToolPageWrapper } from "@/components/tool-ui/tool-page-wrapper";
import { useUrlSyncedState } from "@/lib/url-state/use-url-synced-state";
import type { HistoryEntry } from "@/lib/history/db";
import SetCookieInner from "./set-cookie-inner";
import { buildSetCookieHeader, parseSetCookieHeader } from "./set-cookie-utils";
import { paramsSchema, type SetCookieState } from "./set-cookie-types";

const defaultHeader = `Set-Cookie: session=abc123; Path=/; HttpOnly; Secure; SameSite=Lax`;
const defaultJson = `[
  {
    "name": "session",
    "value": "abc123",
    "path": "/",
    "httpOnly": true,
    "secure": true,
    "sameSite": "lax"
  }
]`;

export default function SetCookieContent() {
  const { state, setParam, oversizeKeys, hasUrlParams, hydrationSource } =
    useUrlSyncedState("set-cookie", {
      schema: paramsSchema,
      defaults: paramsSchema.parse({
        leftText: defaultHeader,
        rightText: defaultJson,
        activeSide: "left",
        rightView: "table",
      }),
    });

  const [leftError, setLeftError] = React.useState<string | null>(null);
  const [rightError, setRightError] = React.useState<string | null>(null);

  const parseLeft = React.useCallback(
    (value: string) => {
      const result = parseSetCookieHeader(value);
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
      const result = buildSetCookieHeader(value);
      setRightError(result.error);
      if (!result.error) {
        setLeftError(null);
        setParam("leftText", result.header);
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

  React.useEffect(() => {
    if (state.activeSide === "left") {
      parseLeft(state.leftText);
    } else {
      parseRight(state.rightText);
    }
  }, [
    parseLeft,
    parseRight,
    state.activeSide,
    state.leftText,
    state.rightText,
  ]);

  const handleLoadHistory = React.useCallback(
    (entry: HistoryEntry) => {
      const { inputs, params } = entry;
      if (inputs.leftText !== undefined) setParam("leftText", inputs.leftText);
      if (inputs.rightText !== undefined)
        setParam("rightText", inputs.rightText);
      if (params.activeSide)
        setParam(
          "activeSide",
          params.activeSide as SetCookieState["activeSide"],
          true,
        );
      if (params.rightView)
        setParam(
          "rightView",
          params.rightView as SetCookieState["rightView"],
          true,
        );
    },
    [setParam],
  );

  return (
    <ToolPageWrapper
      toolId="set-cookie"
      title="Set-Cookie"
      description="Build and parse Set-Cookie headers with a dual-panel editor."
      onLoadHistory={handleLoadHistory}
    >
      <SetCookieInner
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
      />
    </ToolPageWrapper>
  );
}
