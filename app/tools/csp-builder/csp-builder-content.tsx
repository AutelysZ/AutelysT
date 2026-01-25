"use client"

import * as React from "react"
import { z } from "zod"
import { ToolPageWrapper } from "@/components/tool-ui/tool-page-wrapper"
import { useUrlSyncedState } from "@/lib/url-state/use-url-synced-state"
import type { HistoryEntry } from "@/lib/history/db"
import CspBuilderInner from "./csp-builder-inner"
import type { CspDirective } from "./csp-builder-types"
import { buildCspPolicy, DEFAULT_CSP_POLICY, parseCspPolicy } from "./csp-builder-utils"

const paramsSchema = z.object({
  policy: z.string().default(DEFAULT_CSP_POLICY),
})

export default function CspBuilderContent() {
  const { state, setParam, oversizeKeys, hasUrlParams, hydrationSource } = useUrlSyncedState("csp-builder", {
    schema: paramsSchema,
    defaults: paramsSchema.parse({}),
  })

  const parseResult = React.useMemo(() => parseCspPolicy(state.policy), [state.policy])
  const normalizedPolicy = React.useMemo(
    () => buildCspPolicy(parseResult.directives),
    [parseResult.directives],
  )

  const handlePolicyChange = React.useCallback(
    (value: string) => {
      setParam("policy", value)
    },
    [setParam],
  )

  const handleDirectivesChange = React.useCallback(
    (directives: CspDirective[]) => {
      const nextPolicy = buildCspPolicy(directives)
      setParam("policy", nextPolicy)
    },
    [setParam],
  )

  const handleLoadHistory = React.useCallback(
    (entry: HistoryEntry) => {
      const { inputs } = entry
      if (inputs.policy !== undefined) setParam("policy", inputs.policy)
    },
    [setParam],
  )

  return (
    <ToolPageWrapper
      toolId="csp-builder"
      title="CSP Builder"
      description="Build and edit Content-Security-Policy headers with directive-aware editing."
      onLoadHistory={handleLoadHistory}
    >
      <CspBuilderInner
        state={state}
        directives={parseResult.directives}
        normalizedPolicy={normalizedPolicy}
        parseError={parseResult.error}
        oversizePolicy={oversizeKeys.includes("policy")}
        hasUrlParams={hasUrlParams}
        hydrationSource={hydrationSource}
        onPolicyChange={handlePolicyChange}
        onDirectivesChange={handleDirectivesChange}
      />
    </ToolPageWrapper>
  )
}
