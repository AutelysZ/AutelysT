"use client";

import * as React from "react";
import { z } from "zod";
import { ToolPageWrapper } from "@/components/tool-ui/tool-page-wrapper";
import { useUrlSyncedState } from "@/lib/url-state/use-url-synced-state";
import type { HistoryEntry } from "@/lib/history/db";
import UrlBuilderInner from "./url-builder-inner";
import { buildUrl, normalizeEncoding, parseUrl } from "./url-builder-utils";
import type { ParsedUrlData, UrlParam } from "./url-builder-types";

const paramsSchema = z.object({
  url: z.string().default(""),
  encoding: z.string().default("utf8"),
});

const defaultUrl =
  "https://example.com/path?ref=autelyst#section/overview?tab=details";

export default function UrlBuilderContent() {
  const { state, setParam, oversizeKeys, hasUrlParams, hydrationSource } =
    useUrlSyncedState("url-builder", {
      schema: paramsSchema,
      defaults: paramsSchema.parse({
        url: defaultUrl,
        encoding: "utf8",
      }),
    });

  const normalizedEncoding = React.useMemo(
    () => normalizeEncoding(state.encoding),
    [state.encoding],
  );
  const parsed = React.useMemo(
    () => parseUrl(state.url, normalizedEncoding),
    [state.url, normalizedEncoding],
  );
  const lastParsedRef = React.useRef(parsed);

  React.useEffect(() => {
    lastParsedRef.current = parsed;
  }, [parsed]);

  const handleUrlChange = React.useCallback(
    (value: string) => {
      setParam("url", value);
    },
    [setParam],
  );

  const handleEncodingChange = React.useCallback(
    (value: string) => {
      const normalized = normalizeEncoding(value);
      setParam("encoding", normalized, true);
      const nextUrl = buildUrl(lastParsedRef.current, normalized);
      if (nextUrl !== state.url) {
        setParam("url", nextUrl);
      }
    },
    [setParam, state.url],
  );

  const handlePartsChange = React.useCallback(
    (next: Partial<ParsedUrlData>) => {
      const merged = { ...parsed, ...next };
      const nextUrl = buildUrl(merged, normalizedEncoding);
      setParam("url", nextUrl);
    },
    [parsed, setParam, normalizedEncoding],
  );

  const handleQueryParamsChange = React.useCallback(
    (params: UrlParam[]) => {
      handlePartsChange({ queryParams: params });
    },
    [handlePartsChange],
  );

  const handleHashParamsChange = React.useCallback(
    (params: UrlParam[]) => {
      handlePartsChange({ hashParams: params });
    },
    [handlePartsChange],
  );

  const handleLoadHistory = React.useCallback(
    (entry: HistoryEntry) => {
      const { inputs, params } = entry;
      if (inputs.url !== undefined) setParam("url", inputs.url);
      if (params.encoding)
        setParam(
          "encoding",
          normalizeEncoding(params.encoding as string),
          true,
        );
    },
    [setParam],
  );

  React.useEffect(() => {
    if (normalizedEncoding !== state.encoding) {
      setParam("encoding", normalizedEncoding, true);
    }
  }, [normalizedEncoding, setParam, state.encoding]);

  return (
    <ToolPageWrapper
      toolId="url-builder"
      title="URL Builder"
      description="Parse and rebuild URLs with editable components, hash query support, and custom encodings."
      onLoadHistory={handleLoadHistory}
    >
      <UrlBuilderInner
        state={state}
        parsed={parsed}
        oversizeUrl={oversizeKeys.includes("url")}
        hasUrlParams={hasUrlParams}
        hydrationSource={hydrationSource}
        onUrlChange={handleUrlChange}
        onEncodingChange={handleEncodingChange}
        onPartsChange={handlePartsChange}
        onQueryParamsChange={handleQueryParamsChange}
        onHashParamsChange={handleHashParamsChange}
      />
    </ToolPageWrapper>
  );
}
