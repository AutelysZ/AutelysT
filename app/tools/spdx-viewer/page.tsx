"use client";

import * as React from "react";
import { Suspense } from "react";
import { z } from "zod";
import {
  ToolPageWrapper,
  useToolHistoryContext,
} from "@/components/tool-ui/tool-page-wrapper";
import {
  DEFAULT_URL_SYNC_DEBOUNCE_MS,
  useUrlSyncedState,
} from "@/lib/url-state/use-url-synced-state";
import type { HistoryEntry } from "@/lib/history/db";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  analyzeSpdxDocument,
  analyzeSpdxExpression,
  detectSpdxInputKind,
  type SpdxDocumentAnalysis,
  type SpdxExpressionAnalysis,
} from "@/lib/data/spdx";

const MAX_PACKAGE_ROWS = 50;

const paramsSchema = z.object({
  mode: z.enum(["auto", "expression", "document"]).default("auto"),
  input: z.string().default(""),
});

type ViewerMode = z.infer<typeof paramsSchema>["mode"];

export default function SpdxViewerPage() {
  return (
    <Suspense fallback={null}>
      <SpdxViewerContent />
    </Suspense>
  );
}

function SpdxViewerContent() {
  const { state, setParam, oversizeKeys, hasUrlParams, hydrationSource } =
    useUrlSyncedState("spdx-viewer", {
      schema: paramsSchema,
      defaults: paramsSchema.parse({}),
    });

  const inputKind = React.useMemo(
    () => detectSpdxInputKind(state.input, state.mode),
    [state.input, state.mode],
  );

  const expressionAnalysis =
    React.useMemo<SpdxExpressionAnalysis | null>(() => {
      if (inputKind !== "expression") return null;
      return analyzeSpdxExpression(state.input);
    }, [inputKind, state.input]);

  const documentAnalysis = React.useMemo<SpdxDocumentAnalysis | null>(() => {
    if (inputKind !== "document") return null;
    return analyzeSpdxDocument(state.input);
  }, [inputKind, state.input]);

  const handleLoadHistory = React.useCallback(
    (entry: HistoryEntry) => {
      const { inputs, params } = entry;
      if (inputs.input !== undefined) {
        setParam("input", inputs.input);
      }
      if (params.mode) {
        setParam("mode", params.mode as ViewerMode, true);
      }
    },
    [setParam],
  );

  return (
    <ToolPageWrapper
      toolId="spdx-viewer"
      title="SPDX Viewer"
      description="Validate SPDX expressions and inspect SPDX JSON document structure, packages, and referenced licenses."
      onLoadHistory={handleLoadHistory}
    >
      <SpdxViewerInner
        state={state}
        setParam={setParam}
        oversizeKeys={oversizeKeys}
        hasUrlParams={hasUrlParams}
        hydrationSource={hydrationSource}
        inputKind={inputKind}
        expressionAnalysis={expressionAnalysis}
        documentAnalysis={documentAnalysis}
      />
    </ToolPageWrapper>
  );
}

function SpdxViewerInner({
  state,
  setParam,
  oversizeKeys,
  hasUrlParams,
  hydrationSource,
  inputKind,
  expressionAnalysis,
  documentAnalysis,
}: {
  state: z.infer<typeof paramsSchema>;
  setParam: <K extends keyof z.infer<typeof paramsSchema>>(
    key: K,
    value: z.infer<typeof paramsSchema>[K],
    immediate?: boolean,
  ) => void;
  oversizeKeys: (keyof z.infer<typeof paramsSchema>)[];
  hasUrlParams: boolean;
  hydrationSource: "default" | "url" | "history";
  inputKind: "empty" | "expression" | "document";
  expressionAnalysis: SpdxExpressionAnalysis | null;
  documentAnalysis: SpdxDocumentAnalysis | null;
}) {
  const { addHistoryEntry, updateHistoryParams } = useToolHistoryContext();
  const lastInputRef = React.useRef("");
  const hasHydratedInputRef = React.useRef(false);
  const hasHandledUrlRef = React.useRef(false);

  const paramsForHistory = React.useMemo(
    () => ({ mode: state.mode }),
    [state.mode],
  );

  React.useEffect(() => {
    if (hasHydratedInputRef.current) return;
    if (hydrationSource === "default") return;
    lastInputRef.current = state.input;
    hasHydratedInputRef.current = true;
  }, [hydrationSource, state.input]);

  React.useEffect(() => {
    if (state.input === lastInputRef.current) return;

    const timer = setTimeout(() => {
      lastInputRef.current = state.input;
      addHistoryEntry(
        { input: state.input },
        paramsForHistory,
        "left",
        state.input.slice(0, 120),
      );
    }, DEFAULT_URL_SYNC_DEBOUNCE_MS);

    return () => clearTimeout(timer);
  }, [addHistoryEntry, paramsForHistory, state.input]);

  React.useEffect(() => {
    if (hasUrlParams && !hasHandledUrlRef.current) {
      hasHandledUrlRef.current = true;
      if (state.input) {
        addHistoryEntry(
          { input: state.input },
          paramsForHistory,
          "left",
          state.input.slice(0, 120),
        );
      } else {
        updateHistoryParams(paramsForHistory);
      }
    }
  }, [
    addHistoryEntry,
    hasUrlParams,
    paramsForHistory,
    state.input,
    updateHistoryParams,
  ]);

  React.useEffect(() => {
    updateHistoryParams(paramsForHistory);
  }, [paramsForHistory, updateHistoryParams]);

  return (
    <div className="space-y-4 py-4 sm:py-6">
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">SPDX Input</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="max-w-xs space-y-2">
            <Label>Mode</Label>
            <Select
              value={state.mode}
              onValueChange={(value) =>
                setParam("mode", value as ViewerMode, true)
              }
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="auto">Auto Detect</SelectItem>
                <SelectItem value="expression">SPDX Expression</SelectItem>
                <SelectItem value="document">SPDX JSON Document</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Expression or SPDX JSON</Label>
            <Textarea
              value={state.input}
              onChange={(event) => setParam("input", event.target.value)}
              className="min-h-[220px] font-mono text-xs"
              placeholder='Examples: "MIT OR Apache-2.0" or {"spdxVersion":"SPDX-2.3","SPDXID":"SPDXRef-DOCUMENT"}'
            />
            {oversizeKeys.includes("input") ? (
              <p className="text-xs text-muted-foreground">
                Input exceeds 2 KB and is not synced to the URL.
              </p>
            ) : null}
          </div>
        </CardContent>
      </Card>

      {inputKind === "empty" ? (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Result</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              Paste an SPDX expression or SPDX JSON document to inspect its
              structure and license identifiers.
            </p>
          </CardContent>
        </Card>
      ) : null}

      {inputKind === "expression" && expressionAnalysis ? (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Expression Analysis</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex flex-wrap gap-2">
              <Badge
                variant={expressionAnalysis.isValid ? "default" : "destructive"}
              >
                {expressionAnalysis.isValid ? "Valid" : "Invalid"}
              </Badge>
              <Badge variant="secondary">
                {expressionAnalysis.licenseIds.length} license
                {expressionAnalysis.licenseIds.length === 1 ? "" : "s"}
              </Badge>
              <Badge variant="secondary">
                {expressionAnalysis.exceptionIds.length} exception
                {expressionAnalysis.exceptionIds.length === 1 ? "" : "s"}
              </Badge>
              {expressionAnalysis.isSpecialExpression ? (
                <Badge variant="outline">Special SPDX Value</Badge>
              ) : null}
            </div>

            {expressionAnalysis.error ? (
              <Alert variant="destructive">
                <AlertDescription>{expressionAnalysis.error}</AlertDescription>
              </Alert>
            ) : null}

            {expressionAnalysis.unknownLicenseIds.length > 0 ? (
              <Alert variant="destructive">
                <AlertDescription>
                  Unknown license IDs:{" "}
                  {expressionAnalysis.unknownLicenseIds.join(", ")}
                </AlertDescription>
              </Alert>
            ) : null}

            {expressionAnalysis.licenses.length > 0 ? (
              <div className="rounded border p-3">
                <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  Resolved Licenses
                </p>
                <div className="space-y-2 text-sm">
                  {expressionAnalysis.licenses.map((license) => (
                    <div
                      key={license.id}
                      className="flex flex-wrap items-center gap-2"
                    >
                      <Badge variant="outline">{license.id}</Badge>
                      {license.name ? (
                        <span className="text-muted-foreground">
                          {license.name}
                        </span>
                      ) : (
                        <span className="text-muted-foreground">
                          Custom LicenseRef
                        </span>
                      )}
                      {license.osiApproved !== null ? (
                        <Badge
                          variant={
                            license.osiApproved ? "secondary" : "outline"
                          }
                        >
                          {license.osiApproved ? "OSI Approved" : "Not OSI"}
                        </Badge>
                      ) : null}
                      {license.url ? (
                        <a
                          href={license.url}
                          target="_blank"
                          rel="noreferrer"
                          className="text-xs underline underline-offset-2"
                        >
                          License URL
                        </a>
                      ) : null}
                    </div>
                  ))}
                </div>
              </div>
            ) : null}

            {expressionAnalysis.exceptionIds.length > 0 ? (
              <div className="rounded border p-3">
                <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  Exceptions
                </p>
                <div className="flex flex-wrap gap-2">
                  {expressionAnalysis.exceptionIds.map((id) => (
                    <Badge key={id} variant="outline">
                      {id}
                    </Badge>
                  ))}
                </div>
              </div>
            ) : null}

            {expressionAnalysis.ast ? (
              <div className="space-y-2">
                <Label>Parsed AST</Label>
                <Textarea
                  readOnly
                  value={JSON.stringify(expressionAnalysis.ast, null, 2)}
                  className="min-h-[180px] font-mono text-xs"
                />
              </div>
            ) : null}
          </CardContent>
        </Card>
      ) : null}

      {inputKind === "document" && documentAnalysis ? (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Document Analysis</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {!documentAnalysis.isValid ? (
              <Alert variant="destructive">
                <AlertDescription>{documentAnalysis.error}</AlertDescription>
              </Alert>
            ) : (
              <>
                <div className="flex flex-wrap gap-2">
                  <Badge>Parsed</Badge>
                  <Badge variant="secondary">
                    {documentAnalysis.metadata?.packageCount ?? 0} package
                    {(documentAnalysis.metadata?.packageCount ?? 0) === 1
                      ? ""
                      : "s"}
                  </Badge>
                  <Badge variant="secondary">
                    {documentAnalysis.metadata?.fileCount ?? 0} file
                    {(documentAnalysis.metadata?.fileCount ?? 0) === 1
                      ? ""
                      : "s"}
                  </Badge>
                  <Badge variant="secondary">
                    {documentAnalysis.licenseExpressions.length} expression
                    {documentAnalysis.licenseExpressions.length === 1
                      ? ""
                      : "s"}
                  </Badge>
                </div>

                {documentAnalysis.invalidExpressions.length > 0 ? (
                  <Alert variant="destructive">
                    <AlertDescription>
                      Invalid license expressions:{" "}
                      {documentAnalysis.invalidExpressions.join(", ")}
                    </AlertDescription>
                  </Alert>
                ) : null}

                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="rounded border p-3 text-sm">
                    <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                      Document
                    </p>
                    <p>
                      <span className="text-muted-foreground">Name: </span>
                      {documentAnalysis.metadata?.name ?? "-"}
                    </p>
                    <p>
                      <span className="text-muted-foreground">SPDX ID: </span>
                      {documentAnalysis.metadata?.spdxId ?? "-"}
                    </p>
                    <p>
                      <span className="text-muted-foreground">Version: </span>
                      {documentAnalysis.metadata?.spdxVersion ?? "-"}
                    </p>
                    <p>
                      <span className="text-muted-foreground">
                        Data License:{" "}
                      </span>
                      {documentAnalysis.metadata?.dataLicense ?? "-"}
                    </p>
                  </div>
                  <div className="rounded border p-3 text-sm">
                    <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                      Creation
                    </p>
                    <p>
                      <span className="text-muted-foreground">Created: </span>
                      {documentAnalysis.metadata?.created ?? "-"}
                    </p>
                    <p>
                      <span className="text-muted-foreground">Creators: </span>
                      {documentAnalysis.metadata?.creators.length ?? 0}
                    </p>
                    <p>
                      <span className="text-muted-foreground">Namespace: </span>
                      {documentAnalysis.metadata?.documentNamespace ?? "-"}
                    </p>
                    <p>
                      <span className="text-muted-foreground">
                        Relationships:{" "}
                      </span>
                      {documentAnalysis.metadata?.relationshipCount ?? 0}
                    </p>
                  </div>
                </div>

                {documentAnalysis.licenseExpressions.length > 0 ? (
                  <div className="rounded border p-3">
                    <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                      License Expressions
                    </p>
                    <div className="space-y-2">
                      {documentAnalysis.licenseExpressions.map((analysis) => (
                        <div
                          key={analysis.expression}
                          className="flex flex-wrap items-center gap-2 text-sm"
                        >
                          <Badge
                            variant={
                              analysis.isValid ? "secondary" : "destructive"
                            }
                          >
                            {analysis.isValid ? "Valid" : "Invalid"}
                          </Badge>
                          <span className="font-mono text-xs break-all">
                            {analysis.expression}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : null}

                {documentAnalysis.packages.length > 0 ? (
                  <div className="rounded border p-3">
                    <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                      Packages
                    </p>
                    <div className="overflow-x-auto">
                      <table className="w-full min-w-[560px] text-left text-xs">
                        <thead>
                          <tr className="border-b text-muted-foreground">
                            <th className="py-1 pr-2 font-medium">Name</th>
                            <th className="py-1 pr-2 font-medium">SPDX ID</th>
                            <th className="py-1 pr-2 font-medium">Version</th>
                            <th className="py-1 pr-2 font-medium">Declared</th>
                            <th className="py-1 pr-2 font-medium">Concluded</th>
                          </tr>
                        </thead>
                        <tbody>
                          {documentAnalysis.packages
                            .slice(0, MAX_PACKAGE_ROWS)
                            .map((pkg, index) => (
                              <tr
                                key={`${pkg.spdxId ?? pkg.name}-${index}`}
                                className="border-b align-top last:border-0"
                              >
                                <td className="py-1 pr-2">{pkg.name}</td>
                                <td className="py-1 pr-2 font-mono">
                                  {pkg.spdxId ?? "-"}
                                </td>
                                <td className="py-1 pr-2">
                                  {pkg.version ?? "-"}
                                </td>
                                <td className="py-1 pr-2 font-mono">
                                  {pkg.licenseDeclared ?? "-"}
                                </td>
                                <td className="py-1 pr-2 font-mono">
                                  {pkg.licenseConcluded ?? "-"}
                                </td>
                              </tr>
                            ))}
                        </tbody>
                      </table>
                    </div>
                    {documentAnalysis.packages.length > MAX_PACKAGE_ROWS ? (
                      <p className="mt-2 text-xs text-muted-foreground">
                        Showing first {MAX_PACKAGE_ROWS} packages.
                      </p>
                    ) : null}
                  </div>
                ) : null}
              </>
            )}
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}
