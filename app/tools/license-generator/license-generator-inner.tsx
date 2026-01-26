"use client";

import * as React from "react";
import { DEFAULT_URL_SYNC_DEBOUNCE_MS } from "@/lib/url-state/use-url-synced-state";
import { useToolHistoryContext } from "@/components/tool-ui/tool-page-wrapper";
import { downloadFile } from "@/lib/archiver/codec";
import LicenseGeneratorForm from "./license-generator-form";
import type {
  LicenseGeneratorState,
  LicenseOption,
} from "./license-generator-types";

type LicenseGeneratorInnerProps = {
  state: LicenseGeneratorState;
  setParam: <K extends keyof LicenseGeneratorState>(
    key: K,
    value: LicenseGeneratorState[K],
    immediate?: boolean,
  ) => void;
  licenseId: string;
  licenseName: string;
  licenseText: string;
  missingFields: string[];
  licenseOptions: LicenseOption[];
  oversizeKeys: string[];
  hasUrlParams: boolean;
  hydrationSource: "default" | "url" | "history";
};

export default function LicenseGeneratorInner({
  state,
  setParam,
  licenseId,
  licenseName,
  licenseText,
  missingFields,
  licenseOptions,
  oversizeKeys,
  hasUrlParams,
  hydrationSource,
}: LicenseGeneratorInnerProps) {
  const { addHistoryEntry, updateHistoryParams } = useToolHistoryContext();
  const lastInputRef = React.useRef("");
  const hasHydratedInputRef = React.useRef(false);
  const hasHandledUrlRef = React.useRef(false);

  const inputs = React.useMemo(
    () => ({
      year: state.year,
      holder: state.holder,
      project: state.project,
      email: state.email,
      website: state.website,
    }),
    [state],
  );

  const params = React.useMemo(
    () => ({
      step: state.step,
      mode: state.mode,
      licenseId: state.licenseId,
      allowProprietary: state.allowProprietary,
      patentGrant: state.patentGrant,
      permissiveMinimal: state.permissiveMinimal,
      networkCopyleft: state.networkCopyleft,
      libraryLinking: state.libraryLinking,
      fileCopyleft: state.fileCopyleft,
    }),
    [state],
  );

  const inputSnapshot = React.useMemo(() => JSON.stringify(inputs), [inputs]);

  React.useEffect(() => {
    if (hasHydratedInputRef.current) return;
    if (hydrationSource === "default") return;
    lastInputRef.current = inputSnapshot;
    hasHydratedInputRef.current = true;
  }, [hydrationSource, inputSnapshot]);

  React.useEffect(() => {
    if (inputSnapshot === lastInputRef.current) return;
    const timer = setTimeout(() => {
      lastInputRef.current = inputSnapshot;
      addHistoryEntry(inputs, params, "left", licenseName || licenseId);
    }, DEFAULT_URL_SYNC_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [addHistoryEntry, inputSnapshot, inputs, licenseId, licenseName, params]);

  React.useEffect(() => {
    if (hasUrlParams && !hasHandledUrlRef.current) {
      hasHandledUrlRef.current = true;
      if (inputSnapshot) {
        addHistoryEntry(inputs, params, "left", licenseName || licenseId);
      } else {
        updateHistoryParams(params);
      }
    }
  }, [
    hasUrlParams,
    inputSnapshot,
    inputs,
    params,
    licenseId,
    licenseName,
    addHistoryEntry,
    updateHistoryParams,
  ]);

  React.useEffect(() => {
    updateHistoryParams(params);
  }, [params, updateHistoryParams]);

  const handleStepChange = React.useCallback(
    (step: number) => {
      setParam("step", step, true);
    },
    [setParam],
  );

  const handleModeChange = React.useCallback(
    (mode: LicenseGeneratorState["mode"]) => {
      setParam("mode", mode, true);
    },
    [setParam],
  );

  const handleLicenseChange = React.useCallback(
    (value: string) => {
      setParam("licenseId", value, true);
    },
    [setParam],
  );

  const handleAnswerChange = React.useCallback(
    <K extends keyof LicenseGeneratorState>(
      key: K,
      value: LicenseGeneratorState[K],
    ) => {
      setParam(key, value, true);
    },
    [setParam],
  );

  const handleFieldChange = React.useCallback(
    <K extends keyof LicenseGeneratorState>(
      key: K,
      value: LicenseGeneratorState[K],
    ) => {
      setParam(key, value);
    },
    [setParam],
  );

  const handleCopy = React.useCallback(async () => {
    try {
      if (!licenseText) return;
      await navigator.clipboard.writeText(licenseText);
    } catch (error) {
      console.error("Failed to copy license text", error);
    }
  }, [licenseText]);

  const handleDownload = React.useCallback(() => {
    if (!licenseText) return;
    const data = new TextEncoder().encode(licenseText);
    downloadFile(data, "LICENSE");
  }, [licenseText]);

  return (
    <LicenseGeneratorForm
      state={state}
      licenseId={licenseId}
      licenseName={licenseName}
      licenseText={licenseText}
      missingFields={missingFields}
      licenseOptions={licenseOptions}
      oversizeKeys={oversizeKeys}
      onStepChange={handleStepChange}
      onModeChange={handleModeChange}
      onLicenseChange={handleLicenseChange}
      onAnswerChange={handleAnswerChange}
      onFieldChange={handleFieldChange}
      onCopy={handleCopy}
      onDownload={handleDownload}
    />
  );
}
