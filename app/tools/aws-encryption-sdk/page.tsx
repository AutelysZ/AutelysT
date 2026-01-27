"use client";

import * as React from "react";
import { Suspense } from "react";
import { useUrlSyncedState } from "@/lib/url-state/use-url-synced-state";
import { useSearchParams } from "next/navigation";
import { ToolPageWrapper } from "@/components/tool-ui/tool-page-wrapper"; // Ensure this import path is correct based on project structure
import AwsEncryptionSdkInner, {
  awsEncryptionSdkSchema,
} from "./aws-encryption-sdk-inner";
import { defaultAwsEncryptionSdkState } from "./aws-encryption-sdk-types";

export default function AwsEncryptionSdkPage() {
  return (
    <Suspense fallback={null}>
      <AwsEncryptionSdkContent />
    </Suspense>
  );
}

function AwsEncryptionSdkContent() {
  const searchParams = useSearchParams();
  const searchParamString = searchParams.toString();

  const { state, setParam, setStateSilently, hasUrlParams, oversizeKeys } =
    useUrlSyncedState("aws-encryption-sdk", {
      schema: awsEncryptionSdkSchema,
      defaults: defaultAwsEncryptionSdkState,
      restoreFromHistory: false,
      initialSearch: searchParamString,
    });

  const paramsForHistory = React.useMemo(() => ({ ...state }), [state]);

  return (
    <AwsEncryptionSdkInner
      state={state}
      setParam={setParam}
      setStateSilently={setStateSilently}
      oversizeKeys={oversizeKeys}
      paramsForHistory={paramsForHistory}
      hasUrlParams={hasUrlParams}
    />
  );
}
