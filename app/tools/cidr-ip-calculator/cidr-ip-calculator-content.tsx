"use client";

import * as React from "react";
import { z } from "zod";
import { Check, Copy } from "lucide-react";
import {
  ToolPageWrapper,
  useToolHistoryContext,
} from "@/components/tool-ui/tool-page-wrapper";
import {
  DEFAULT_URL_SYNC_DEBOUNCE_MS,
  useUrlSyncedState,
} from "@/lib/url-state/use-url-synced-state";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import type { HistoryEntry } from "@/lib/history/db";
import {
  parseCidrInput,
  getCidrDetails,
  ipv4NetmaskToPrefix,
  prefixToIpv4Netmask,
  isIpInCidr,
  type CidrDetails,
} from "@/lib/network/cidr";

const paramsSchema = z.object({
  input: z.string().default(""),
  checkIp: z.string().default(""),
  defaultIpv4Prefix: z.coerce.number().int().min(0).max(32).default(24),
  defaultIpv6Prefix: z.coerce.number().int().min(0).max(128).default(64),
  netmaskInput: z.string().default(""),
  prefixInput: z.coerce.number().int().min(0).max(32).default(24),
});

export default function CidrIpCalculatorContent() {
  const { state, setParam, oversizeKeys, hasUrlParams, hydrationSource } =
    useUrlSyncedState("cidr-ip-calculator", {
      schema: paramsSchema,
      defaults: paramsSchema.parse({}),
    });

  const handleLoadHistory = React.useCallback(
    (entry: HistoryEntry) => {
      const { inputs, params } = entry;
      if (inputs.input !== undefined) setParam("input", inputs.input);
      if (inputs.checkIp !== undefined) setParam("checkIp", inputs.checkIp);
      if (params.defaultIpv4Prefix !== undefined)
        setParam("defaultIpv4Prefix", Number(params.defaultIpv4Prefix));
      if (params.defaultIpv6Prefix !== undefined)
        setParam("defaultIpv6Prefix", Number(params.defaultIpv6Prefix));
      if (params.netmaskInput !== undefined)
        setParam("netmaskInput", String(params.netmaskInput));
      if (params.prefixInput !== undefined)
        setParam("prefixInput", Number(params.prefixInput));
    },
    [setParam],
  );

  return (
    <ToolPageWrapper
      toolId="cidr-ip-calculator"
      title="CIDR/IP Calculator"
      description="Calculate IPv4 and IPv6 subnet details, ranges, and netmasks with quick inclusion checks."
      onLoadHistory={handleLoadHistory}
    >
      <CidrIpCalculatorInner
        state={state}
        setParam={setParam}
        oversizeKeys={oversizeKeys}
        hasUrlParams={hasUrlParams}
        hydrationSource={hydrationSource}
      />
    </ToolPageWrapper>
  );
}

function CidrIpCalculatorInner({
  state,
  setParam,
  oversizeKeys,
  hasUrlParams,
  hydrationSource,
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
}) {
  const { upsertInputEntry, upsertParams } = useToolHistoryContext();
  const [copiedKey, setCopiedKey] = React.useState<string | null>(null);
  const lastInputRef = React.useRef("");
  const hasHydratedInputRef = React.useRef(false);
  const paramsRef = React.useRef({
    defaultIpv4Prefix: state.defaultIpv4Prefix,
    defaultIpv6Prefix: state.defaultIpv6Prefix,
    netmaskInput: state.netmaskInput,
    prefixInput: state.prefixInput,
  });
  const hasInitializedParamsRef = React.useRef(false);
  const hasHandledUrlRef = React.useRef(false);

  const parseResult = React.useMemo(
    () =>
      parseCidrInput(state.input, {
        ipv4: state.defaultIpv4Prefix,
        ipv6: state.defaultIpv6Prefix,
      }),
    [state.input, state.defaultIpv4Prefix, state.defaultIpv6Prefix],
  );

  const details = React.useMemo<CidrDetails | null>(() => {
    if (!parseResult.result) return null;
    return getCidrDetails(parseResult.result);
  }, [parseResult.result]);

  const checkResult = React.useMemo(() => {
    if (!state.checkIp || !parseResult.result) return null;
    return isIpInCidr(state.checkIp, parseResult.result);
  }, [state.checkIp, parseResult.result]);

  const netmaskResult = React.useMemo(() => {
    if (!state.netmaskInput.trim()) return null;
    return ipv4NetmaskToPrefix(state.netmaskInput);
  }, [state.netmaskInput]);

  const prefixNetmask = React.useMemo(
    () => prefixToIpv4Netmask(state.prefixInput),
    [state.prefixInput],
  );

  React.useEffect(() => {
    if (hasHydratedInputRef.current) return;
    if (hydrationSource === "default") return;
    lastInputRef.current = `${state.input}||${state.checkIp}`;
    hasHydratedInputRef.current = true;
  }, [hydrationSource, state.input, state.checkIp]);

  React.useEffect(() => {
    const nextKey = `${state.input}||${state.checkIp}`;
    if (nextKey === lastInputRef.current) return;

    const timer = setTimeout(() => {
      lastInputRef.current = nextKey;
      upsertInputEntry(
        { input: state.input, checkIp: state.checkIp },
        {
          defaultIpv4Prefix: state.defaultIpv4Prefix,
          defaultIpv6Prefix: state.defaultIpv6Prefix,
          netmaskInput: state.netmaskInput,
          prefixInput: state.prefixInput,
        },
        "left",
        state.input ? state.input.slice(0, 120) : "CIDR calculator",
      );
    }, DEFAULT_URL_SYNC_DEBOUNCE_MS);

    return () => clearTimeout(timer);
  }, [
    state.input,
    state.checkIp,
    state.defaultIpv4Prefix,
    state.defaultIpv6Prefix,
    state.netmaskInput,
    state.prefixInput,
    upsertInputEntry,
  ]);

  React.useEffect(() => {
    if (hasUrlParams && !hasHandledUrlRef.current) {
      hasHandledUrlRef.current = true;
      if (state.input || state.checkIp) {
        upsertInputEntry(
          { input: state.input, checkIp: state.checkIp },
          {
            defaultIpv4Prefix: state.defaultIpv4Prefix,
            defaultIpv6Prefix: state.defaultIpv6Prefix,
            netmaskInput: state.netmaskInput,
            prefixInput: state.prefixInput,
          },
          "left",
          state.input ? state.input.slice(0, 120) : "CIDR calculator",
        );
      } else {
        upsertParams(
          {
            defaultIpv4Prefix: state.defaultIpv4Prefix,
            defaultIpv6Prefix: state.defaultIpv6Prefix,
            netmaskInput: state.netmaskInput,
            prefixInput: state.prefixInput,
          },
          "interpretation",
        );
      }
    }
  }, [
    hasUrlParams,
    state.input,
    state.checkIp,
    state.defaultIpv4Prefix,
    state.defaultIpv6Prefix,
    state.netmaskInput,
    state.prefixInput,
    upsertInputEntry,
    upsertParams,
  ]);

  React.useEffect(() => {
    const nextParams = {
      defaultIpv4Prefix: state.defaultIpv4Prefix,
      defaultIpv6Prefix: state.defaultIpv6Prefix,
      netmaskInput: state.netmaskInput,
      prefixInput: state.prefixInput,
    };
    if (!hasInitializedParamsRef.current) {
      hasInitializedParamsRef.current = true;
      paramsRef.current = nextParams;
      return;
    }
    if (
      paramsRef.current.defaultIpv4Prefix === nextParams.defaultIpv4Prefix &&
      paramsRef.current.defaultIpv6Prefix === nextParams.defaultIpv6Prefix &&
      paramsRef.current.netmaskInput === nextParams.netmaskInput &&
      paramsRef.current.prefixInput === nextParams.prefixInput
    ) {
      return;
    }
    paramsRef.current = nextParams;
    upsertParams(nextParams, "interpretation");
  }, [
    state.defaultIpv4Prefix,
    state.defaultIpv6Prefix,
    state.netmaskInput,
    state.prefixInput,
    upsertParams,
  ]);

  const handleCopy = async (value: string, key: string) => {
    if (!value) return;
    await navigator.clipboard.writeText(value);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  const inputWarning = oversizeKeys.includes("input")
    ? "Input exceeds 2 KB and is not synced to the URL."
    : null;
  const checkWarning = oversizeKeys.includes("checkIp")
    ? "Check IP exceeds 2 KB and is not synced to the URL."
    : null;
  const netmaskWarning = oversizeKeys.includes("netmaskInput")
    ? "Netmask exceeds 2 KB and is not synced to the URL."
    : null;

  const detailsRows = details
    ? [
        { key: "version", label: "IP Version", value: `IPv${details.version}` },
        { key: "address", label: "Address", value: details.address },
        {
          key: "cidr",
          label: "CIDR",
          value: `${details.network}/${details.prefix}`,
        },
        { key: "network", label: "Network", value: details.network },
        ...(details.broadcast
          ? [{ key: "broadcast", label: "Broadcast", value: details.broadcast }]
          : []),
        { key: "netmask", label: "Netmask", value: details.netmask },
        ...(details.wildcard
          ? [{ key: "wildcard", label: "Wildcard", value: details.wildcard }]
          : []),
        { key: "rangeStart", label: "Range Start", value: details.rangeStart },
        { key: "rangeEnd", label: "Range End", value: details.rangeEnd },
        {
          key: "firstUsable",
          label: "First Usable",
          value: details.firstUsable,
        },
        {
          key: "lastUsable",
          label: "Last Usable",
          value: details.lastUsable,
        },
        {
          key: "totalAddresses",
          label: "Total Addresses",
          value: details.totalAddresses,
        },
        {
          key: "usableAddresses",
          label: "Usable Addresses",
          value: details.usableAddresses,
        },
      ]
    : [];

  const parseError =
    state.input.trim().length > 0 ? (parseResult.error ?? null) : null;

  return (
    <div className="flex w-full flex-col gap-6 py-4 sm:gap-8 sm:py-6">
      <div className="grid gap-6 lg:grid-cols-2">
        <section className="flex flex-col gap-4">
          <div className="space-y-2">
            <Label htmlFor="cidr-input">CIDR or IP Address</Label>
            <Input
              id="cidr-input"
              value={state.input}
              onChange={(event) => setParam("input", event.target.value)}
              placeholder="192.168.1.10/24 or 2001:db8::/64"
            />
            {inputWarning && (
              <p className="text-xs text-muted-foreground">{inputWarning}</p>
            )}
            {parseError && (
              <p className="text-xs text-destructive">{parseError}</p>
            )}
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="default-ipv4">Default IPv4 Prefix</Label>
              <Input
                id="default-ipv4"
                type="number"
                min={0}
                max={32}
                value={state.defaultIpv4Prefix}
                onChange={(event) =>
                  setParam(
                    "defaultIpv4Prefix",
                    Math.max(0, Math.min(32, Number(event.target.value) || 0)),
                    true,
                  )
                }
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="default-ipv6">Default IPv6 Prefix</Label>
              <Input
                id="default-ipv6"
                type="number"
                min={0}
                max={128}
                value={state.defaultIpv6Prefix}
                onChange={(event) =>
                  setParam(
                    "defaultIpv6Prefix",
                    Math.max(0, Math.min(128, Number(event.target.value) || 0)),
                    true,
                  )
                }
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="check-ip">Check IP in Range (Optional)</Label>
            <Input
              id="check-ip"
              value={state.checkIp}
              onChange={(event) => setParam("checkIp", event.target.value)}
              placeholder="192.168.1.42"
            />
            {checkWarning && (
              <p className="text-xs text-muted-foreground">{checkWarning}</p>
            )}
            {state.checkIp && checkResult?.error && (
              <p className="text-xs text-destructive">{checkResult.error}</p>
            )}
            {state.checkIp && checkResult?.result && (
              <p className="text-xs text-muted-foreground">
                {checkResult.result.ip} is{" "}
                <span className="font-medium">
                  {checkResult.result.inRange ? "inside" : "outside"}
                </span>{" "}
                the subnet.
              </p>
            )}
          </div>
        </section>

        <section className="flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-semibold">Subnet Details</h2>
          </div>
          {details ? (
            <div className="grid gap-4 sm:grid-cols-2">
              {detailsRows.map((row) => (
                <div key={row.key} className="space-y-2">
                  <Label className="text-xs uppercase tracking-wide text-muted-foreground">
                    {row.label}
                  </Label>
                  <div className="flex items-center gap-2">
                    <Input readOnly value={row.value} />
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={() => handleCopy(row.value, row.key)}
                      aria-label={`Copy ${row.label}`}
                    >
                      {copiedKey === row.key ? (
                        <Check className="h-4 w-4" />
                      ) : (
                        <Copy className="h-4 w-4" />
                      )}
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">
              Enter a CIDR block to see subnet details.
            </p>
          )}
        </section>
      </div>

      <section className="grid gap-4 rounded-lg border border-border p-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="netmask-input">IPv4 Netmask to Prefix</Label>
          <Input
            id="netmask-input"
            value={state.netmaskInput}
            onChange={(event) => setParam("netmaskInput", event.target.value)}
            placeholder="255.255.255.0"
          />
          {netmaskWarning && (
            <p className="text-xs text-muted-foreground">{netmaskWarning}</p>
          )}
          {state.netmaskInput && netmaskResult?.error && (
            <p className="text-xs text-destructive">{netmaskResult.error}</p>
          )}
          {state.netmaskInput && netmaskResult?.prefix !== undefined && (
            <p className="text-xs text-muted-foreground">
              Prefix: /{netmaskResult.prefix}
            </p>
          )}
        </div>
        <div className="space-y-2">
          <Label htmlFor="prefix-input">Prefix to IPv4 Netmask</Label>
          <Input
            id="prefix-input"
            type="number"
            min={0}
            max={32}
            value={state.prefixInput}
            onChange={(event) =>
              setParam(
                "prefixInput",
                Math.max(0, Math.min(32, Number(event.target.value) || 0)),
                true,
              )
            }
          />
          <p className="text-xs text-muted-foreground">
            Netmask: {prefixNetmask}
          </p>
        </div>
      </section>
    </div>
  );
}
