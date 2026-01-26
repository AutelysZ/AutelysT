"use client";

import * as React from "react";
import { Check, Copy, Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { SearchableSelect } from "@/components/ui/searchable-select";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import type { LicenseGeneratorState, LicenseOption } from "./license-generator-types";

const STEP_LABELS = ["Start", "License", "Details", "Generate"];

type LicenseGeneratorFormProps = {
  state: LicenseGeneratorState;
  licenseId: string;
  licenseName: string;
  licenseText: string;
  missingFields: string[];
  licenseOptions: LicenseOption[];
  oversizeKeys: string[];
  onStepChange: (step: number) => void;
  onModeChange: (mode: LicenseGeneratorState["mode"]) => void;
  onLicenseChange: (licenseId: string) => void;
  onAnswerChange: <K extends keyof LicenseGeneratorState>(
    key: K,
    value: LicenseGeneratorState[K],
  ) => void;
  onFieldChange: <K extends keyof LicenseGeneratorState>(
    key: K,
    value: LicenseGeneratorState[K],
  ) => void;
  onCopy: () => Promise<void> | void;
  onDownload: () => void;
};

export default function LicenseGeneratorForm({
  state,
  licenseId,
  licenseName,
  licenseText,
  missingFields,
  licenseOptions,
  oversizeKeys,
  onStepChange,
  onModeChange,
  onLicenseChange,
  onAnswerChange,
  onFieldChange,
  onCopy,
  onDownload,
}: LicenseGeneratorFormProps) {
  const [copied, setCopied] = React.useState(false);

  const handleCopy = React.useCallback(async () => {
    await onCopy();
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [onCopy]);

  const canProceedFromMode = true;
  const canProceedFromLicense =
    state.mode === "guided" ? true : Boolean(licenseId);
  const canProceedFromDetails =
    state.year.trim().length > 0 && state.holder.trim().length > 0;

  const canContinue = (() => {
    if (state.step === 0) return canProceedFromMode;
    if (state.step === 1) return canProceedFromLicense;
    if (state.step === 2) return canProceedFromDetails;
    return false;
  })();

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
          {STEP_LABELS.map((label, index) => (
            <span
              key={label}
              className={cn(
                "rounded-full border px-3 py-1",
                state.step === index
                  ? "border-primary/30 bg-primary/10 text-primary"
                  : "border-border/60 bg-muted/30",
              )}
            >
              {index + 1}. {label}
            </span>
          ))}
        </div>
        <div className="text-xs text-muted-foreground">
          Step {state.step + 1} of {STEP_LABELS.length}
        </div>
      </div>

      {state.step === 0 && (
        <Card>
          <CardHeader>
            <CardTitle>How do you want to choose a license?</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <RadioGroup
              value={state.mode}
              onValueChange={(value) =>
                onModeChange(value as LicenseGeneratorState["mode"])
              }
              className="grid gap-3"
            >
              <label className="flex items-start gap-3 rounded-lg border border-border/60 p-3">
                <RadioGroupItem value="guided" id="mode-guided" />
                <div>
                  <div className="font-medium">Guided questionnaire</div>
                  <p className="text-xs text-muted-foreground">
                    Answer a few questions and get a recommended license.
                  </p>
                </div>
              </label>
              <label className="flex items-start gap-3 rounded-lg border border-border/60 p-3">
                <RadioGroupItem value="manual" id="mode-manual" />
                <div>
                  <div className="font-medium">Pick manually</div>
                  <p className="text-xs text-muted-foreground">
                    Choose from popular SPDX licenses directly.
                  </p>
                </div>
              </label>
            </RadioGroup>
          </CardContent>
        </Card>
      )}

      {state.step === 1 && state.mode === "guided" && (
        <Card>
          <CardHeader>
            <CardTitle>License preferences</CardTitle>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="space-y-3">
              <Label className="text-sm">
                Allow proprietary/closed-source use of your code?
              </Label>
              <RadioGroup
                value={state.allowProprietary}
                onValueChange={(value) =>
                  onAnswerChange(
                    "allowProprietary",
                    value as LicenseGeneratorState["allowProprietary"],
                  )
                }
                className="flex flex-wrap gap-4"
              >
                <label className="flex items-center gap-2 text-sm">
                  <RadioGroupItem value="yes" /> Yes
                </label>
                <label className="flex items-center gap-2 text-sm">
                  <RadioGroupItem value="no" /> No
                </label>
              </RadioGroup>
            </div>

            {state.allowProprietary === "yes" ? (
              <>
                <div className="space-y-3">
                  <Label className="text-sm">
                    Need an explicit patent grant?
                  </Label>
                  <RadioGroup
                    value={state.patentGrant}
                    onValueChange={(value) =>
                      onAnswerChange(
                        "patentGrant",
                        value as LicenseGeneratorState["patentGrant"],
                      )
                    }
                    className="flex flex-wrap gap-4"
                  >
                    <label className="flex items-center gap-2 text-sm">
                      <RadioGroupItem value="yes" /> Yes
                    </label>
                    <label className="flex items-center gap-2 text-sm">
                      <RadioGroupItem value="no" /> No
                    </label>
                  </RadioGroup>
                </div>

                {state.patentGrant === "no" && (
                  <div className="space-y-3">
                    <Label className="text-sm">
                      Prefer the shortest permissive text?
                    </Label>
                    <RadioGroup
                      value={state.permissiveMinimal}
                      onValueChange={(value) =>
                        onAnswerChange(
                          "permissiveMinimal",
                          value as LicenseGeneratorState["permissiveMinimal"],
                        )
                      }
                      className="flex flex-wrap gap-4"
                    >
                      <label className="flex items-center gap-2 text-sm">
                        <RadioGroupItem value="yes" /> Yes
                      </label>
                      <label className="flex items-center gap-2 text-sm">
                        <RadioGroupItem value="no" /> No
                      </label>
                    </RadioGroup>
                  </div>
                )}
              </>
            ) : (
              <>
                <div className="space-y-3">
                  <Label className="text-sm">
                    Require source sharing for network/SaaS use?
                  </Label>
                  <RadioGroup
                    value={state.networkCopyleft}
                    onValueChange={(value) =>
                      onAnswerChange(
                        "networkCopyleft",
                        value as LicenseGeneratorState["networkCopyleft"],
                      )
                    }
                    className="flex flex-wrap gap-4"
                  >
                    <label className="flex items-center gap-2 text-sm">
                      <RadioGroupItem value="yes" /> Yes
                    </label>
                    <label className="flex items-center gap-2 text-sm">
                      <RadioGroupItem value="no" /> No
                    </label>
                  </RadioGroup>
                </div>

                {state.networkCopyleft === "no" && (
                  <>
                    <div className="space-y-3">
                      <Label className="text-sm">
                        Is this a library meant for linking?
                      </Label>
                      <RadioGroup
                        value={state.libraryLinking}
                        onValueChange={(value) =>
                          onAnswerChange(
                            "libraryLinking",
                            value as LicenseGeneratorState["libraryLinking"],
                          )
                        }
                        className="flex flex-wrap gap-4"
                      >
                        <label className="flex items-center gap-2 text-sm">
                          <RadioGroupItem value="yes" /> Yes
                        </label>
                        <label className="flex items-center gap-2 text-sm">
                          <RadioGroupItem value="no" /> No
                        </label>
                      </RadioGroup>
                    </div>

                    {state.libraryLinking === "no" && (
                      <div className="space-y-3">
                        <Label className="text-sm">
                          Prefer file-level copyleft?
                        </Label>
                        <RadioGroup
                          value={state.fileCopyleft}
                          onValueChange={(value) =>
                            onAnswerChange(
                              "fileCopyleft",
                              value as LicenseGeneratorState["fileCopyleft"],
                            )
                          }
                          className="flex flex-wrap gap-4"
                        >
                          <label className="flex items-center gap-2 text-sm">
                            <RadioGroupItem value="yes" /> Yes
                          </label>
                          <label className="flex items-center gap-2 text-sm">
                            <RadioGroupItem value="no" /> No
                          </label>
                        </RadioGroup>
                      </div>
                    )}
                  </>
                )}
              </>
            )}

            <div className="rounded-md border border-border/60 bg-muted/20 p-3 text-sm">
              <div className="text-xs uppercase text-muted-foreground">
                Recommended license
              </div>
              <div className="mt-1 font-medium">
                {licenseId} — {licenseName}
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {state.step === 1 && state.mode === "manual" && (
        <Card>
          <CardHeader>
            <CardTitle>Select a license</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <SearchableSelect
              value={licenseId}
              onValueChange={onLicenseChange}
              options={licenseOptions}
              placeholder="Choose a license..."
              searchPlaceholder="Search licenses..."
              className="w-[min(92vw,420px)]"
              triggerClassName="h-10 w-full justify-between"
            />
            <p className="text-xs text-muted-foreground">
              Popular SPDX licenses are listed here for quick access.
            </p>
          </CardContent>
        </Card>
      )}

      {state.step === 2 && (
        <Card>
          <CardHeader>
            <CardTitle>Fill in your details</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label className="text-xs">Year *</Label>
              <Input
                value={state.year}
                onChange={(event) => onFieldChange("year", event.target.value)}
                placeholder="2026"
              />
            </div>
            <div className="space-y-2">
              <Label className="text-xs">Copyright holder *</Label>
              <Input
                value={state.holder}
                onChange={(event) => onFieldChange("holder", event.target.value)}
                placeholder="Your name or organization"
              />
            </div>
            <div className="space-y-2">
              <Label className="text-xs">Project name</Label>
              <Input
                value={state.project}
                onChange={(event) => onFieldChange("project", event.target.value)}
                placeholder="Optional"
              />
            </div>
            <div className="space-y-2">
              <Label className="text-xs">Email</Label>
              <Input
                value={state.email}
                onChange={(event) => onFieldChange("email", event.target.value)}
                placeholder="Optional"
              />
            </div>
            <div className="space-y-2 sm:col-span-2">
              <Label className="text-xs">Website</Label>
              <Input
                value={state.website}
                onChange={(event) => onFieldChange("website", event.target.value)}
                placeholder="Optional"
              />
            </div>
          </CardContent>
        </Card>
      )}

      {state.step === 3 && (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-2">
            <div>
              <CardTitle>License text</CardTitle>
              <p className="text-xs text-muted-foreground">
                {licenseId} — {licenseName}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-8 gap-1"
                onClick={handleCopy}
                disabled={!licenseText}
              >
                {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                {copied ? "Copied" : "Copy"}
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-8 gap-1"
                onClick={onDownload}
                disabled={!licenseText}
              >
                <Download className="h-4 w-4" />
                Download
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            {missingFields.length > 0 && (
              <div className="rounded-md border border-destructive/40 bg-destructive/5 px-3 py-2 text-xs text-destructive">
                Missing required fields: {missingFields.join(", ")}.
              </div>
            )}
            {oversizeKeys.length > 0 && (
              <div className="rounded-md border border-border/60 bg-muted/30 px-3 py-2 text-xs text-muted-foreground">
                Some inputs are too large to sync via URL.
              </div>
            )}
            <Textarea
              value={licenseText}
              readOnly
              className="min-h-[360px] font-mono text-xs"
              placeholder="License text will appear here."
            />
          </CardContent>
        </Card>
      )}

      <div className="flex items-center justify-between">
        <Button
          type="button"
          variant="ghost"
          onClick={() => onStepChange(Math.max(0, state.step - 1))}
          disabled={state.step === 0}
        >
          Back
        </Button>
        {state.step < STEP_LABELS.length - 1 ? (
          <Button
            type="button"
            onClick={() =>
              onStepChange(Math.min(STEP_LABELS.length - 1, state.step + 1))
            }
            disabled={!canContinue}
          >
            Next
          </Button>
        ) : null}
      </div>
    </div>
  );
}
