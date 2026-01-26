"use client";

import * as React from "react";
import { getCountries } from "libphonenumber-js";
import { DualPaneLayout } from "@/components/tool-ui/dual-pane-layout";
import { SearchableSelect } from "@/components/ui/searchable-select";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent } from "@/components/ui/card";
import type { PhoneNumberState } from "./phone-number-types";
import {
  formatPhoneNumberJson,
  parsePhoneNumberJson,
  type PhoneNumberJson,
} from "@/lib/phone-number/phone-number";

const labelCellClass = "w-40 pr-3 py-1 align-top text-xs text-muted-foreground";

const formatLabels: Record<PhoneNumberState["outputFormat"], string> = {
  "E.164": "E.164",
  INTERNATIONAL: "International",
  NATIONAL: "National",
  RFC3966: "RFC3966",
};

type PhoneNumberFormProps = {
  state: PhoneNumberState;
  leftError: string | null;
  rightError: string | null;
  leftWarning: string | null;
  rightWarning: string | null;
  onLeftChange: (value: string) => void;
  onRightChange: (value: string) => void;
  onRightViewChange: (view: PhoneNumberState["rightView"]) => void;
  onDefaultCountryChange: (value: string) => void;
  onOutputFormatChange: (value: PhoneNumberState["outputFormat"]) => void;
};

export default function PhoneNumberForm({
  state,
  leftError,
  rightError,
  leftWarning,
  rightWarning,
  onLeftChange,
  onRightChange,
  onRightViewChange,
  onDefaultCountryChange,
  onOutputFormatChange,
}: PhoneNumberFormProps) {
  const parsedJson = React.useMemo(
    () => parsePhoneNumberJson(state.rightText),
    [state.rightText],
  );

  const updateJson = React.useCallback(
    (next: PhoneNumberJson) => {
      onRightChange(formatPhoneNumberJson(next));
    },
    [onRightChange],
  );

  const countryOptions = React.useMemo(() => {
    const displayNames =
      typeof Intl !== "undefined" && "DisplayNames" in Intl
        ? new Intl.DisplayNames(["en"], { type: "region" })
        : null;
    const options = getCountries().map((code) => {
      const name = displayNames?.of(code) || code;
      return {
        value: code,
        label: name ? `${name} (${code})` : code,
      };
    });
    options.sort((a, b) => a.label.localeCompare(b.label));
    return [{ value: "", label: "Auto" }, ...options];
  }, []);

  const rightHeader = (
    <div className="flex items-center gap-1">
      <Button
        type="button"
        variant={state.rightView === "table" ? "secondary" : "ghost"}
        size="sm"
        className="h-7 px-2 text-xs"
        onClick={() => onRightViewChange("table")}
      >
        Table
      </Button>
      <Button
        type="button"
        variant={state.rightView === "json" ? "secondary" : "ghost"}
        size="sm"
        className="h-7 px-2 text-xs"
        onClick={() => onRightViewChange("json")}
      >
        JSON
      </Button>
    </div>
  );

  const rightTableContent = (
    <div className="flex h-full flex-col gap-4 p-3 text-sm">
      {parsedJson.error ? (
        <div className="rounded-md border border-destructive/40 bg-destructive/5 px-3 py-2 text-xs text-destructive">
          {parsedJson.error}
        </div>
      ) : null}

      <div className="rounded-md border border-border/60 bg-background p-3">
        <div className="mb-2 text-xs font-medium text-muted-foreground">
          Build Input
        </div>
        <table className="w-full">
          <tbody>
            <tr>
              <td className={labelCellClass}>Number</td>
              <td className="py-1">
                <Input
                  value={parsedJson.data.number ?? ""}
                  onChange={(e) =>
                    updateJson({
                      ...parsedJson.data,
                      number: e.target.value,
                    })
                  }
                  placeholder="+1 202 555 0123"
                  className="h-8 text-sm"
                />
              </td>
            </tr>
            <tr>
              <td className={labelCellClass}>Country</td>
              <td className="py-1">
                <SearchableSelect
                  value={parsedJson.data.country ?? ""}
                  onValueChange={(value) =>
                    updateJson({
                      ...parsedJson.data,
                      country: value,
                    })
                  }
                  options={countryOptions}
                  placeholder="Auto"
                  searchPlaceholder="Search country..."
                  triggerClassName="h-8 w-[240px] justify-between text-xs"
                  className="w-[280px]"
                />
              </td>
            </tr>
            <tr>
              <td className={labelCellClass}>National Number</td>
              <td className="py-1">
                <Input
                  value={parsedJson.data.nationalNumber ?? ""}
                  onChange={(e) =>
                    updateJson({
                      ...parsedJson.data,
                      nationalNumber: e.target.value,
                    })
                  }
                  placeholder="2025550123"
                  className="h-8 text-sm"
                />
              </td>
            </tr>
            <tr>
              <td className={labelCellClass}>Calling Code</td>
              <td className="py-1">
                <Input
                  value={parsedJson.data.countryCallingCode ?? ""}
                  onChange={(e) =>
                    updateJson({
                      ...parsedJson.data,
                      countryCallingCode: e.target.value,
                    })
                  }
                  placeholder="1"
                  className="h-8 text-sm"
                />
              </td>
            </tr>
            <tr>
              <td className={labelCellClass}>Extension</td>
              <td className="py-1">
                <Input
                  value={parsedJson.data.extension ?? ""}
                  onChange={(e) =>
                    updateJson({
                      ...parsedJson.data,
                      extension: e.target.value,
                    })
                  }
                  placeholder="123"
                  className="h-8 text-sm"
                />
              </td>
            </tr>
          </tbody>
        </table>
        <p className="mt-2 text-xs text-muted-foreground">
          Provide a full number or a national number with country/calling code.
        </p>
      </div>

      <div className="rounded-md border border-border/60 bg-background p-3">
        <div className="mb-2 text-xs font-medium text-muted-foreground">
          Parsed Details
        </div>
        <table className="w-full">
          <tbody>
            <tr>
              <td className={labelCellClass}>Type</td>
              <td className="py-1 text-xs">
                {parsedJson.data.type || "-"}
              </td>
            </tr>
            <tr>
              <td className={labelCellClass}>Is Possible</td>
              <td className="py-1 text-xs">
                {parsedJson.data.isPossible ? "Yes" : "No"}
              </td>
            </tr>
            <tr>
              <td className={labelCellClass}>Is Valid</td>
              <td className="py-1 text-xs">
                {parsedJson.data.isValid ? "Yes" : "No"}
              </td>
            </tr>
            <tr>
              <td className={labelCellClass}>E.164</td>
              <td className="py-1 text-xs font-mono">
                {parsedJson.data.formats?.e164 || "-"}
              </td>
            </tr>
            <tr>
              <td className={labelCellClass}>International</td>
              <td className="py-1 text-xs font-mono">
                {parsedJson.data.formats?.international || "-"}
              </td>
            </tr>
            <tr>
              <td className={labelCellClass}>National</td>
              <td className="py-1 text-xs font-mono">
                {parsedJson.data.formats?.national || "-"}
              </td>
            </tr>
            <tr>
              <td className={labelCellClass}>RFC3966</td>
              <td className="py-1 text-xs font-mono">
                {parsedJson.data.formats?.rfc3966 || "-"}
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );

  return (
    <DualPaneLayout
      leftLabel="Phone Number"
      rightLabel="Phone JSON"
      leftValue={state.leftText}
      rightValue={state.rightText}
      onLeftChange={onLeftChange}
      onRightChange={onRightChange}
      activeSide={state.activeSide}
      leftError={leftError}
      rightError={rightError}
      leftWarning={leftWarning}
      rightWarning={rightWarning}
      rightHeaderExtra={rightHeader}
      rightCustomContent={
        state.rightView === "table" ? rightTableContent : undefined
      }
      rightReadOnly={state.rightView === "table"}
      leftContentClassName="max-h-none h-auto overflow-visible"
      rightContentClassName="max-h-none h-auto overflow-visible"
      layoutClassName="h-auto"
      panesClassName="flex-none"
      leftPlaceholder="+1 202 555 0123"
      rightPlaceholder={`{
  "number": "+12025550123",
  "country": "US",
  "nationalNumber": "2025550123"
}`}
    >
      <Card>
        <CardContent className="flex flex-wrap items-center gap-6 p-4">
          <div className="flex items-center gap-2">
            <Label className="text-sm whitespace-nowrap">Default Country</Label>
            <SearchableSelect
              value={state.defaultCountry}
              onValueChange={onDefaultCountryChange}
              options={countryOptions}
              placeholder="Auto"
              searchPlaceholder="Search country..."
              triggerClassName="w-56"
              className="w-64"
            />
          </div>
          <div className="flex items-center gap-2">
            <Label className="text-sm whitespace-nowrap">Output Format</Label>
            <Tabs
              value={state.outputFormat}
              onValueChange={(value) =>
                onOutputFormatChange(value as PhoneNumberState["outputFormat"])
              }
            >
              <TabsList className="h-7">
                {Object.entries(formatLabels).map(([value, label]) => (
                  <TabsTrigger key={value} value={value} className="px-2 text-xs">
                    {label}
                  </TabsTrigger>
                ))}
              </TabsList>
            </Tabs>
          </div>
        </CardContent>
      </Card>
    </DualPaneLayout>
  );
}
