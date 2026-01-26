"use client";

import * as React from "react";
import { ToolPageWrapper } from "@/components/tool-ui/tool-page-wrapper";
import { useUrlSyncedState } from "@/lib/url-state/use-url-synced-state";
import type { HistoryEntry } from "@/lib/history/db";
import LicenseGeneratorInner from "./license-generator-inner";
import {
  LICENSE_OPTIONS,
  buildLicenseOutput,
  getLicenseName,
  getRecommendedLicenseId,
} from "./license-generator-utils";
import {
  paramsSchema,
  type LicenseGeneratorState,
} from "./license-generator-types";

const DEFAULT_LICENSE_ID = "MIT";

export default function LicenseGeneratorContent() {
  const defaultYear = React.useMemo(
    () => new Date().getFullYear().toString(),
    [],
  );
  const { state, setParam, oversizeKeys, hasUrlParams, hydrationSource } =
    useUrlSyncedState("license-generator", {
      schema: paramsSchema,
      defaults: paramsSchema.parse({
        year: defaultYear,
        licenseId: DEFAULT_LICENSE_ID,
      }),
    });

  const recommendedId = React.useMemo(() => {
    if (state.mode === "guided") {
      return getRecommendedLicenseId(state);
    }
    return state.licenseId || DEFAULT_LICENSE_ID;
  }, [state]);

  React.useEffect(() => {
    if (state.mode === "guided" && recommendedId !== state.licenseId) {
      setParam("licenseId", recommendedId, true);
    }
  }, [recommendedId, setParam, state.licenseId, state.mode]);

  React.useEffect(() => {
    if (state.mode === "manual" && !state.licenseId) {
      setParam("licenseId", DEFAULT_LICENSE_ID, true);
    }
  }, [setParam, state.licenseId, state.mode]);

  const licenseName = getLicenseName(recommendedId);
  const output = buildLicenseOutput(recommendedId, {
    year: state.year,
    holder: state.holder,
    project: state.project || undefined,
    email: state.email || undefined,
    website: state.website || undefined,
  });

  const handleLoadHistory = React.useCallback(
    (entry: HistoryEntry) => {
      const { inputs, params } = entry;
      const applyParam = <K extends keyof LicenseGeneratorState>(
        key: K,
        value: LicenseGeneratorState[K],
        immediate = false,
      ) => setParam(key, value, immediate);

      if (inputs.year !== undefined)
        applyParam("year", String(inputs.year));
      if (inputs.holder !== undefined)
        applyParam("holder", String(inputs.holder));
      if (inputs.project !== undefined)
        applyParam("project", String(inputs.project));
      if (inputs.email !== undefined)
        applyParam("email", String(inputs.email));
      if (inputs.website !== undefined)
        applyParam("website", String(inputs.website));

      if (params.step !== undefined)
        applyParam("step", Number(params.step), true);
      if (params.mode)
        applyParam("mode", String(params.mode) as LicenseGeneratorState["mode"], true);
      if (params.licenseId)
        applyParam("licenseId", String(params.licenseId), true);
      if (params.allowProprietary)
        applyParam(
          "allowProprietary",
          String(params.allowProprietary) as LicenseGeneratorState["allowProprietary"],
          true,
        );
      if (params.patentGrant)
        applyParam(
          "patentGrant",
          String(params.patentGrant) as LicenseGeneratorState["patentGrant"],
          true,
        );
      if (params.permissiveMinimal)
        applyParam(
          "permissiveMinimal",
          String(params.permissiveMinimal) as LicenseGeneratorState["permissiveMinimal"],
          true,
        );
      if (params.networkCopyleft)
        applyParam(
          "networkCopyleft",
          String(params.networkCopyleft) as LicenseGeneratorState["networkCopyleft"],
          true,
        );
      if (params.libraryLinking)
        applyParam(
          "libraryLinking",
          String(params.libraryLinking) as LicenseGeneratorState["libraryLinking"],
          true,
        );
      if (params.fileCopyleft)
        applyParam(
          "fileCopyleft",
          String(params.fileCopyleft) as LicenseGeneratorState["fileCopyleft"],
          true,
        );
    },
    [setParam],
  );

  return (
    <ToolPageWrapper
      toolId="license-generator"
      title="License Generator"
      description="Pick a software license with a guided questionnaire and generate ready-to-use text."
      onLoadHistory={handleLoadHistory}
    >
      <LicenseGeneratorInner
        state={state}
        setParam={setParam}
        licenseId={recommendedId}
        licenseName={licenseName}
        licenseText={output.text}
        missingFields={output.missing}
        licenseOptions={LICENSE_OPTIONS}
        oversizeKeys={oversizeKeys}
        hasUrlParams={hasUrlParams}
        hydrationSource={hydrationSource}
      />
    </ToolPageWrapper>
  );
}
