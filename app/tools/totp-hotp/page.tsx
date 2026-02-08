"use client";

import * as React from "react";
import { Suspense } from "react";
import { z } from "zod";
import QRCode from "qrcode";
import {
  ToolPageWrapper,
  useToolHistoryContext,
} from "@/components/tool-ui/tool-page-wrapper";
import {
  DEFAULT_URL_SYNC_DEBOUNCE_MS,
  useUrlSyncedState,
} from "@/lib/url-state/use-url-synced-state";
import type { HistoryEntry } from "@/lib/history/db";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  buildOtpAuthUri,
  generateHotp,
  generateOtpSecret,
  generateTotp,
  parseOtpAuthUri,
  verifyHotp,
  verifyTotp,
  type OtpAlgorithm,
  type OtpMode,
} from "@/lib/crypto/totp-hotp";

const paramsSchema = z.object({
  mode: z.enum(["totp", "hotp"]).default("totp"),
  algorithm: z.enum(["SHA1", "SHA256", "SHA512"]).default("SHA1"),
  digits: z.coerce.number().int().min(6).max(10).default(6),
  period: z.coerce.number().int().min(1).max(300).default(30),
  counter: z.coerce.number().int().min(0).default(0),
  useCurrentTime: z.boolean().default(true),
  timestampInput: z.string().default(""),
  window: z.coerce.number().int().min(0).max(10).default(1),
  issuer: z.string().default("AutelysT"),
  accountName: z.string().default("user@example.com"),
  secret: z.string().default(""),
  token: z.string().default(""),
  uriText: z.string().default(""),
});

export default function TotpHotpPage() {
  return (
    <Suspense fallback={null}>
      <TotpHotpContent />
    </Suspense>
  );
}

function TotpHotpContent() {
  const { state, setParam, oversizeKeys, hasUrlParams, hydrationSource } =
    useUrlSyncedState("totp-hotp", {
      schema: paramsSchema,
      defaults: paramsSchema.parse({}),
    });

  const [generatedCode, setGeneratedCode] = React.useState("");
  const [generationInfo, setGenerationInfo] = React.useState("");
  const [verificationInfo, setVerificationInfo] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);
  const [qrDataUrl, setQrDataUrl] = React.useState("");

  const handleLoadHistory = React.useCallback(
    (entry: HistoryEntry) => {
      const { inputs, params } = entry;
      if (inputs.secret !== undefined) setParam("secret", inputs.secret);
      if (inputs.token !== undefined) setParam("token", inputs.token);
      if (inputs.uriText !== undefined) setParam("uriText", inputs.uriText);
      if (params.mode) setParam("mode", params.mode as OtpMode);
      if (params.algorithm)
        setParam("algorithm", params.algorithm as OtpAlgorithm);
      if (params.digits) setParam("digits", params.digits as number);
      if (params.period) setParam("period", params.period as number);
      if (params.counter !== undefined)
        setParam("counter", params.counter as number);
      if (params.window !== undefined)
        setParam("window", params.window as number);
      if (params.useCurrentTime !== undefined)
        setParam("useCurrentTime", params.useCurrentTime as boolean);
      if (params.timestampInput !== undefined)
        setParam("timestampInput", params.timestampInput as string);
      if (params.issuer !== undefined)
        setParam("issuer", params.issuer as string);
      if (params.accountName !== undefined)
        setParam("accountName", params.accountName as string);
    },
    [setParam],
  );

  const clearMessages = React.useCallback(() => {
    setError(null);
    setGenerationInfo("");
    setVerificationInfo("");
  }, []);

  const resolveTimestampMs = React.useCallback(() => {
    if (state.useCurrentTime) {
      return Date.now();
    }
    const parsed = Number(state.timestampInput);
    if (!Number.isFinite(parsed) || parsed < 0) {
      throw new Error(
        "Timestamp input must be a non-negative epoch in milliseconds.",
      );
    }
    return parsed;
  }, [state.timestampInput, state.useCurrentTime]);

  const handleGenerateCode = React.useCallback(async () => {
    try {
      clearMessages();
      if (!state.secret.trim()) {
        throw new Error("Secret is required.");
      }

      if (state.mode === "totp") {
        const timestampMs = resolveTimestampMs();
        const generated = await generateTotp(state.secret, timestampMs, {
          digits: state.digits,
          algorithm: state.algorithm,
          period: state.period,
        });
        setGeneratedCode(generated.code);
        setGenerationInfo(
          `Counter ${generated.counter} | ${generated.secondsRemaining}s remaining`,
        );
      } else {
        const generated = await generateHotp(state.secret, state.counter, {
          digits: state.digits,
          algorithm: state.algorithm,
        });
        setGeneratedCode(generated);
        setGenerationInfo(`Counter ${state.counter}`);
      }
    } catch (caught) {
      console.error(caught);
      setError(
        caught instanceof Error ? caught.message : "Failed to generate OTP.",
      );
    }
  }, [
    clearMessages,
    resolveTimestampMs,
    state.algorithm,
    state.counter,
    state.digits,
    state.mode,
    state.period,
    state.secret,
  ]);

  const handleVerifyCode = React.useCallback(async () => {
    try {
      clearMessages();
      if (!state.secret.trim()) {
        throw new Error("Secret is required.");
      }
      if (!state.token.trim()) {
        throw new Error("Token is required.");
      }

      const result =
        state.mode === "totp"
          ? await verifyTotp(
              state.secret,
              state.token,
              resolveTimestampMs(),
              state.window,
              {
                digits: state.digits,
                algorithm: state.algorithm,
                period: state.period,
              },
            )
          : await verifyHotp(
              state.secret,
              state.token,
              state.counter,
              state.window,
              {
                digits: state.digits,
                algorithm: state.algorithm,
              },
            );

      if (result.valid) {
        setVerificationInfo(
          `Valid token. Matched counter: ${result.matchedCounter} (delta ${result.delta}).`,
        );
      } else {
        setVerificationInfo("Token is not valid in the configured window.");
      }
    } catch (caught) {
      console.error(caught);
      setError(
        caught instanceof Error ? caught.message : "Failed to verify OTP.",
      );
    }
  }, [
    clearMessages,
    resolveTimestampMs,
    state.algorithm,
    state.counter,
    state.digits,
    state.mode,
    state.period,
    state.secret,
    state.token,
    state.window,
  ]);

  const handleBuildUri = React.useCallback(() => {
    try {
      clearMessages();
      const uri = buildOtpAuthUri({
        mode: state.mode,
        secret: state.secret,
        algorithm: state.algorithm,
        digits: state.digits,
        period: state.period,
        counter: state.counter,
        issuer: state.issuer,
        accountName: state.accountName,
      });
      setParam("uriText", uri, true);
    } catch (caught) {
      console.error(caught);
      setError(
        caught instanceof Error
          ? caught.message
          : "Failed to build otpauth URI.",
      );
    }
  }, [
    clearMessages,
    setParam,
    state.accountName,
    state.algorithm,
    state.counter,
    state.digits,
    state.issuer,
    state.mode,
    state.period,
    state.secret,
  ]);

  const handleParseUri = React.useCallback(() => {
    try {
      clearMessages();
      const parsed = parseOtpAuthUri(state.uriText);
      setParam("mode", parsed.mode, true);
      setParam("secret", parsed.secret, true);
      setParam("algorithm", parsed.algorithm, true);
      setParam("digits", parsed.digits, true);
      setParam("period", parsed.period, true);
      setParam("counter", parsed.counter, true);
      setParam("issuer", parsed.issuer, true);
      setParam("accountName", parsed.accountName, true);
    } catch (caught) {
      console.error(caught);
      setError(
        caught instanceof Error
          ? caught.message
          : "Failed to parse otpauth URI.",
      );
    }
  }, [clearMessages, setParam, state.uriText]);

  const handleGenerateSecret = React.useCallback(() => {
    try {
      clearMessages();
      const secret = generateOtpSecret(20);
      setParam("secret", secret, true);
    } catch (caught) {
      console.error(caught);
      setError(
        caught instanceof Error ? caught.message : "Failed to generate secret.",
      );
    }
  }, [clearMessages, setParam]);

  const handleGenerateQr = React.useCallback(async () => {
    try {
      clearMessages();
      if (!state.uriText.trim()) {
        throw new Error("otpauth URI is required.");
      }
      const dataUrl = await QRCode.toDataURL(state.uriText, {
        errorCorrectionLevel: "M",
        margin: 1,
        width: 240,
      });
      setQrDataUrl(dataUrl);
    } catch (caught) {
      console.error(caught);
      setError(
        caught instanceof Error
          ? caught.message
          : "Failed to generate QR code.",
      );
    }
  }, [clearMessages, state.uriText]);

  return (
    <ToolPageWrapper
      toolId="totp-hotp"
      title="TOTP / HOTP"
      description="Generate and verify TOTP/HOTP, and build/parse otpauth URIs with QR support."
      onLoadHistory={handleLoadHistory}
    >
      <TotpHotpInner
        state={state}
        setParam={setParam}
        oversizeKeys={oversizeKeys}
        hasUrlParams={hasUrlParams}
        hydrationSource={hydrationSource}
        generatedCode={generatedCode}
        generationInfo={generationInfo}
        verificationInfo={verificationInfo}
        error={error}
        qrDataUrl={qrDataUrl}
        onGenerateCode={handleGenerateCode}
        onVerifyCode={handleVerifyCode}
        onBuildUri={handleBuildUri}
        onParseUri={handleParseUri}
        onGenerateSecret={handleGenerateSecret}
        onGenerateQr={handleGenerateQr}
      />
    </ToolPageWrapper>
  );
}

function TotpHotpInner({
  state,
  setParam,
  oversizeKeys,
  hasUrlParams,
  hydrationSource,
  generatedCode,
  generationInfo,
  verificationInfo,
  error,
  qrDataUrl,
  onGenerateCode,
  onVerifyCode,
  onBuildUri,
  onParseUri,
  onGenerateSecret,
  onGenerateQr,
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
  generatedCode: string;
  generationInfo: string;
  verificationInfo: string;
  error: string | null;
  qrDataUrl: string;
  onGenerateCode: () => Promise<void>;
  onVerifyCode: () => Promise<void>;
  onBuildUri: () => void;
  onParseUri: () => void;
  onGenerateSecret: () => void;
  onGenerateQr: () => Promise<void>;
}) {
  const { addHistoryEntry, updateHistoryParams } = useToolHistoryContext();
  const lastInputRef = React.useRef("");
  const hasHydratedInputRef = React.useRef(false);
  const hasHandledUrlRef = React.useRef(false);

  const paramsForHistory = React.useMemo(
    () => ({
      mode: state.mode,
      algorithm: state.algorithm,
      digits: state.digits,
      period: state.period,
      counter: state.counter,
      window: state.window,
      useCurrentTime: state.useCurrentTime,
      timestampInput: state.timestampInput,
      issuer: state.issuer,
      accountName: state.accountName,
    }),
    [
      state.accountName,
      state.algorithm,
      state.counter,
      state.digits,
      state.issuer,
      state.mode,
      state.period,
      state.timestampInput,
      state.useCurrentTime,
      state.window,
    ],
  );

  React.useEffect(() => {
    if (hasHydratedInputRef.current) return;
    if (hydrationSource === "default") return;
    lastInputRef.current = `${state.secret}\n${state.token}\n${state.uriText}`;
    hasHydratedInputRef.current = true;
  }, [hydrationSource, state.secret, state.token, state.uriText]);

  React.useEffect(() => {
    const inputSnapshot = `${state.secret}\n${state.token}\n${state.uriText}`;
    if (inputSnapshot === lastInputRef.current) return;

    const timer = setTimeout(() => {
      lastInputRef.current = inputSnapshot;
      addHistoryEntry(
        { secret: state.secret, token: state.token, uriText: state.uriText },
        paramsForHistory,
        "left",
        state.secret.slice(0, 100),
      );
    }, DEFAULT_URL_SYNC_DEBOUNCE_MS);

    return () => clearTimeout(timer);
  }, [
    addHistoryEntry,
    paramsForHistory,
    state.secret,
    state.token,
    state.uriText,
  ]);

  React.useEffect(() => {
    if (hasUrlParams && !hasHandledUrlRef.current) {
      hasHandledUrlRef.current = true;
      if (state.secret || state.token || state.uriText) {
        addHistoryEntry(
          { secret: state.secret, token: state.token, uriText: state.uriText },
          paramsForHistory,
          "left",
          state.secret.slice(0, 100),
        );
      } else {
        updateHistoryParams(paramsForHistory);
      }
    }
  }, [
    addHistoryEntry,
    hasUrlParams,
    paramsForHistory,
    state.secret,
    state.token,
    state.uriText,
    updateHistoryParams,
  ]);

  React.useEffect(() => {
    updateHistoryParams(paramsForHistory);
  }, [paramsForHistory, updateHistoryParams]);

  return (
    <div className="space-y-4 py-4 sm:py-6">
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Core Parameters</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <div className="space-y-2">
            <Label>Mode</Label>
            <Select
              value={state.mode}
              onValueChange={(v) => setParam("mode", v as OtpMode, true)}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="totp">TOTP</SelectItem>
                <SelectItem value="hotp">HOTP</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Algorithm</Label>
            <Select
              value={state.algorithm}
              onValueChange={(v) =>
                setParam("algorithm", v as OtpAlgorithm, true)
              }
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="SHA1">SHA1</SelectItem>
                <SelectItem value="SHA256">SHA256</SelectItem>
                <SelectItem value="SHA512">SHA512</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Digits</Label>
            <Input
              type="number"
              min={6}
              max={10}
              value={state.digits}
              onChange={(event) =>
                setParam("digits", Number(event.target.value) || 6, true)
              }
            />
          </div>
          <div className="space-y-2">
            <Label>Verification Window</Label>
            <Input
              type="number"
              min={0}
              max={10}
              value={state.window}
              onChange={(event) =>
                setParam("window", Number(event.target.value) || 0, true)
              }
            />
          </div>
          <div className="space-y-2">
            <Label>Period (TOTP)</Label>
            <Input
              type="number"
              min={1}
              max={300}
              value={state.period}
              onChange={(event) =>
                setParam("period", Number(event.target.value) || 30, true)
              }
            />
          </div>
          <div className="space-y-2">
            <Label>Counter (HOTP)</Label>
            <Input
              type="number"
              min={0}
              value={state.counter}
              onChange={(event) =>
                setParam("counter", Number(event.target.value) || 0, true)
              }
            />
          </div>
          <div className="space-y-2">
            <Label>Issuer</Label>
            <Input
              value={state.issuer}
              onChange={(event) => setParam("issuer", event.target.value)}
              placeholder="AutelysT"
            />
          </div>
          <div className="space-y-2">
            <Label>Account</Label>
            <Input
              value={state.accountName}
              onChange={(event) => setParam("accountName", event.target.value)}
              placeholder="user@example.com"
            />
          </div>
          <div className="space-y-2">
            <Label>Time Source</Label>
            <Button
              type="button"
              variant={state.useCurrentTime ? "default" : "outline"}
              className="w-full"
              onClick={() =>
                setParam("useCurrentTime", !state.useCurrentTime, true)
              }
            >
              {state.useCurrentTime
                ? "Use Current Time"
                : "Use Manual Timestamp"}
            </Button>
          </div>
          <div className="space-y-2">
            <Label>Manual Timestamp (ms)</Label>
            <Input
              type="number"
              min={0}
              value={state.timestampInput}
              onChange={(event) =>
                setParam("timestampInput", event.target.value)
              }
              disabled={state.useCurrentTime}
              placeholder="1735689600000"
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Secret and Token</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="space-y-2">
            <Label>Base32 Secret</Label>
            <Textarea
              value={state.secret}
              onChange={(event) => setParam("secret", event.target.value)}
              className="min-h-[90px] font-mono text-xs"
              placeholder="JBSWY3DPEHPK3PXP"
            />
            {oversizeKeys.includes("secret") ? (
              <p className="text-xs text-muted-foreground">
                Input exceeds 2 KB and is not synced to the URL.
              </p>
            ) : null}
          </div>
          <div className="space-y-2">
            <Label>Token to Verify</Label>
            <Input
              value={state.token}
              onChange={(event) => setParam("token", event.target.value)}
              placeholder="123456"
              className="font-mono"
            />
          </div>
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              variant="secondary"
              onClick={onGenerateSecret}
            >
              Generate Secret
            </Button>
            <Button type="button" onClick={() => void onGenerateCode()}>
              Generate Code
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={() => void onVerifyCode()}
            >
              Verify Token
            </Button>
          </div>
          {generatedCode ? (
            <p className="font-mono text-sm">
              Generated OTP: <strong>{generatedCode}</strong>
            </p>
          ) : null}
          {generationInfo ? (
            <p className="text-xs text-muted-foreground">{generationInfo}</p>
          ) : null}
          {verificationInfo ? (
            <p className="text-xs text-muted-foreground">{verificationInfo}</p>
          ) : null}
          {error ? <p className="text-xs text-destructive">{error}</p> : null}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">otpauth URI and QR</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <Textarea
            value={state.uriText}
            onChange={(event) => setParam("uriText", event.target.value)}
            className="min-h-[90px] font-mono text-xs"
            placeholder="otpauth://totp/Issuer:account?secret=..."
          />
          {oversizeKeys.includes("uriText") ? (
            <p className="text-xs text-muted-foreground">
              Input exceeds 2 KB and is not synced to the URL.
            </p>
          ) : null}
          <div className="flex flex-wrap gap-2">
            <Button type="button" variant="secondary" onClick={onBuildUri}>
              Build URI
            </Button>
            <Button type="button" variant="outline" onClick={onParseUri}>
              Parse URI
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={() => void onGenerateQr()}
            >
              Generate QR
            </Button>
          </div>
          {qrDataUrl ? (
            <img
              src={qrDataUrl}
              alt="otpauth QR code"
              className="h-44 w-44 rounded border object-contain"
            />
          ) : null}
        </CardContent>
      </Card>
    </div>
  );
}
