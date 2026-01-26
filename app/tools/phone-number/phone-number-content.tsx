"use client";

import * as React from "react";
import { ToolPageWrapper } from "@/components/tool-ui/tool-page-wrapper";
import { useUrlSyncedState } from "@/lib/url-state/use-url-synced-state";
import type { HistoryEntry } from "@/lib/history/db";
import PhoneNumberInner from "./phone-number-inner";
import {
  buildPhoneNumberFromJson,
  parsePhoneNumberString,
} from "@/lib/phone-number/phone-number";
import { paramsSchema, type PhoneNumberState } from "./phone-number-types";

const defaultNumber = "+12025550123";
const defaultCountry = "US";

export default function PhoneNumberContent() {
  const defaultJson = React.useMemo(() => {
    const parsed = parsePhoneNumberString(defaultNumber, defaultCountry);
    return parsed.json || "";
  }, []);

  const { state, setParam, oversizeKeys, hasUrlParams, hydrationSource } =
    useUrlSyncedState("phone-number", {
      schema: paramsSchema,
      defaults: paramsSchema.parse({
        leftText: defaultNumber,
        rightText: defaultJson,
        activeSide: "left",
        rightView: "table",
        defaultCountry,
        outputFormat: "E.164",
      }),
    });

  const [leftError, setLeftError] = React.useState<string | null>(null);
  const [rightError, setRightError] = React.useState<string | null>(null);

  const parseLeft = React.useCallback(
    (value: string) => {
      const result = parsePhoneNumberString(
        value,
        state.defaultCountry || undefined,
      );
      setLeftError(result.error);
      if (!result.error) {
        setRightError(null);
        setParam("rightText", result.json);
      }
    },
    [setParam, state.defaultCountry],
  );

  const parseRight = React.useCallback(
    (value: string) => {
      const result = buildPhoneNumberFromJson(
        value,
        state.defaultCountry || undefined,
        state.outputFormat,
      );
      setRightError(result.error);
      if (!result.error) {
        setLeftError(null);
        setParam("leftText", result.number);
      }
    },
    [setParam, state.defaultCountry, state.outputFormat],
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
          params.activeSide as PhoneNumberState["activeSide"],
          true,
        );
      if (params.rightView)
        setParam(
          "rightView",
          params.rightView as PhoneNumberState["rightView"],
          true,
        );
      if (params.defaultCountry !== undefined)
        setParam("defaultCountry", String(params.defaultCountry), true);
      if (params.outputFormat)
        setParam(
          "outputFormat",
          params.outputFormat as PhoneNumberState["outputFormat"],
          true,
        );
    },
    [setParam],
  );

  return (
    <ToolPageWrapper
      toolId="phone-number"
      title="Phone Number Parser"
      description="Parse and build phone numbers with formatting options and structured output."
      onLoadHistory={handleLoadHistory}
    >
      <PhoneNumberInner
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
        onDefaultCountryChange={(value) =>
          setParam("defaultCountry", value, true)
        }
        onOutputFormatChange={(value) => setParam("outputFormat", value, true)}
      />
    </ToolPageWrapper>
  );
}
