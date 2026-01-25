"use client";

import * as React from "react";
import { Suspense } from "react";
import { z } from "zod";
import { Check, Copy, Download, HelpCircle } from "lucide-react";
import {
  ToolPageWrapper,
  useToolHistoryContext,
} from "@/components/tool-ui/tool-page-wrapper";
import {
  DEFAULT_URL_SYNC_DEBOUNCE_MS,
  useUrlSyncedState,
} from "@/lib/url-state/use-url-synced-state";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { DateTimePicker } from "@/components/ui/date-time-picker";
import {
  base64UrlEncodeString,
  decodeSecret,
  parseJwt,
  signJwtWithKey,
  verifyJwtSignatureWithKey,
  type JwtAlg,
} from "@/lib/jwt/jwt";
import type { HistoryEntry } from "@/lib/history/db";
import { cn } from "@/lib/utils";

const algOptions: JwtAlg[] = [
  "HS256",
  "HS384",
  "HS512",
  "RS256",
  "RS384",
  "RS512",
  "PS256",
  "PS384",
  "PS512",
  "ES256",
  "ES384",
  "ES512",
  "EdDSA",
  "none",
];
const registeredClaims = [
  "iss",
  "sub",
  "aud",
  "exp",
  "nbf",
  "iat",
  "jti",
] as const;
type RegisteredClaim = (typeof registeredClaims)[number];

const paramsSchema = z.object({
  tokenText: z.string().default(""),
  headerAlg: z.string().default("HS256"),
  headerTyp: z.string().default("JWT"),
  headerKid: z.string().default(""),
  headerExtraJson: z.string().default(""),
  headerView: z.enum(["table", "json"]).default("table"),
  iss: z.string().default(""),
  sub: z.string().default(""),
  audIsArray: z.boolean().default(false),
  audText: z.string().default(""),
  audListText: z.string().default(""),
  expText: z.string().default(""),
  nbfText: z.string().default(""),
  iatText: z.string().default(""),
  jti: z.string().default(""),
  extraJsonText: z.string().default(""),
  payloadView: z.enum(["table", "json"]).default("table"),
  secretText: z.string().default(""),
  secretPublicText: z.string().default(""),
  secretPrivateText: z.string().default(""),
  secretEncoding: z.enum(["utf8", "base64", "hex"]).default("utf8"),
});

type JwtState = z.infer<typeof paramsSchema>;

function formatLocalTime(value: string) {
  const seconds = Number.parseInt(value, 10);
  if (!Number.isFinite(seconds)) return "—";
  const date = new Date(seconds * 1000);
  if (Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat(undefined, {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).format(date);
}

function parseTagList(value: string) {
  return value
    .split(/[\n,]+/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function toTagListValue(tags: string[]) {
  return tags.join(", ");
}

function TagInput({
  value,
  onChange,
  placeholder,
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}) {
  const [draft, setDraft] = React.useState("");
  const tags = React.useMemo(() => parseTagList(value), [value]);

  const addTag = React.useCallback(
    (raw: string) => {
      const next = raw.trim();
      if (!next) return;
      if (tags.includes(next)) return;
      onChange(toTagListValue([...tags, next]));
      setDraft("");
    },
    [tags, onChange],
  );

  const removeTag = React.useCallback(
    (tag: string) => {
      const next = tags.filter((item) => item !== tag);
      onChange(toTagListValue(next));
    },
    [tags, onChange],
  );

  return (
    <div className="flex flex-wrap items-center gap-2 rounded-md border border-input bg-background px-2 py-1">
      {tags.map((tag) => (
        <span
          key={tag}
          className="flex items-center gap-1 rounded bg-muted px-2 py-0.5 text-xs"
        >
          {tag}
          <button
            type="button"
            onClick={() => removeTag(tag)}
            className="text-muted-foreground hover:text-foreground"
            aria-label={`Remove ${tag}`}
          >
            ×
          </button>
        </span>
      ))}
      <Input
        value={draft}
        onChange={(event) => setDraft(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === "Enter" || event.key === ",") {
            event.preventDefault();
            addTag(draft);
          }
        }}
        onBlur={() => addTag(draft)}
        placeholder={placeholder}
        className="h-8 border-0 px-1 text-xs shadow-none focus-visible:ring-0"
      />
    </div>
  );
}

function HelpHint({ text }: { text: string }) {
  return (
    <span className="relative inline-flex items-center group">
      <HelpCircle
        className="h-3 w-3 text-muted-foreground/70"
        aria-hidden="true"
      />
      <span className="pointer-events-none absolute left-full top-1/2 z-20 ml-2 hidden w-max max-w-[480px] -translate-y-1/2 whitespace-normal rounded-md border bg-popover px-2 py-1 text-xs text-popover-foreground shadow-md group-hover:block">
        {text}
      </span>
    </span>
  );
}
export default function JwtPage() {
  return (
    <Suspense fallback={null}>
      <JwtContent />
    </Suspense>
  );
}

function JwtContent() {
  const {
    state,
    setParam,
    setState,
    oversizeKeys,
    hasUrlParams,
    urlParamKeys,
    hydrationSource,
  } = useUrlSyncedState("jwt", {
    schema: paramsSchema,
    defaults: paramsSchema.parse({}),
    shouldSyncParam: (key, _value, current) => {
      if (
        key === "secretText" ||
        key === "secretEncoding" ||
        key === "secretPublicText" ||
        key === "secretPrivateText"
      )
        return false;
      if (key === "headerView" || key === "payloadView") return true;
      if (current.tokenText) return key === "tokenText";
      return true;
    },
  });

  const [parseError, setParseError] = React.useState<string | null>(null);
  const [headerExtraError, setHeaderExtraError] = React.useState<string | null>(
    null,
  );
  const [extraError, setExtraError] = React.useState<string | null>(null);
  const [generateErrors, setGenerateErrors] = React.useState<string[]>([]);
  const [signatureStatus, setSignatureStatus] = React.useState<{
    status: string;
    message: string;
  } | null>(null);
  const [expiredStatus, setExpiredStatus] = React.useState<string>("Unknown");
  const [isGeneratingKey, setIsGeneratingKey] = React.useState(false);
  const [copyFeedback, setCopyFeedback] = React.useState(false);
  const parsedTokenRef = React.useRef<
    ReturnType<typeof parseJwt>["parsed"] | null
  >(null);

  const hasTokenInUrl = urlParamKeys.includes("tokenText");

  const handleLoadHistory = React.useCallback(
    (entry: HistoryEntry) => {
      const { inputs, params } = entry;
      if (inputs.tokenText !== undefined)
        setParam("tokenText", inputs.tokenText);
      if (params.headerAlg) setParam("headerAlg", params.headerAlg as string);
      if (params.headerTyp) setParam("headerTyp", params.headerTyp as string);
      if (params.headerKid) setParam("headerKid", params.headerKid as string);
      if (params.headerExtraJson !== undefined)
        setParam("headerExtraJson", params.headerExtraJson as string);
      if (params.headerView)
        setParam("headerView", params.headerView as JwtState["headerView"]);
      if (params.iss !== undefined) setParam("iss", params.iss as string);
      if (params.sub !== undefined) setParam("sub", params.sub as string);
      if (params.audIsArray !== undefined)
        setParam("audIsArray", params.audIsArray as boolean);
      if (params.audText !== undefined)
        setParam("audText", params.audText as string);
      if (params.audListText !== undefined)
        setParam("audListText", params.audListText as string);
      if (params.expText !== undefined)
        setParam("expText", params.expText as string);
      if (params.nbfText !== undefined)
        setParam("nbfText", params.nbfText as string);
      if (params.iatText !== undefined)
        setParam("iatText", params.iatText as string);
      if (params.jti !== undefined) setParam("jti", params.jti as string);
      if (params.extraJsonText !== undefined)
        setParam("extraJsonText", params.extraJsonText as string);
      if (params.payloadView)
        setParam("payloadView", params.payloadView as JwtState["payloadView"]);
      if (params.secretText !== undefined)
        setParam("secretText", params.secretText as string);
      if (params.secretPublicText !== undefined)
        setParam("secretPublicText", params.secretPublicText as string);
      if (params.secretPrivateText !== undefined)
        setParam("secretPrivateText", params.secretPrivateText as string);
      if (params.secretEncoding)
        setParam(
          "secretEncoding",
          params.secretEncoding as JwtState["secretEncoding"],
        );
    },
    [setParam],
  );

  React.useEffect(() => {
    if (!state.tokenText.trim()) {
      setParseError(null);
      parsedTokenRef.current = null;
      return;
    }
    const result = parseJwt(state.tokenText);
    if (!result.parsed) {
      setParseError(result.error || "Invalid token.");
      parsedTokenRef.current = null;
      return;
    }

    setParseError(null);
    parsedTokenRef.current = result.parsed;
    const header = result.parsed.header;
    const payload = result.parsed.payload;

    const headerAlg = typeof header.alg === "string" ? header.alg : "HS256";
    const headerTyp = typeof header.typ === "string" ? header.typ : "JWT";
    const headerKid = typeof header.kid === "string" ? header.kid : "";
    const headerExtras = Object.fromEntries(
      Object.entries(header).filter(
        ([key]) => !["alg", "typ", "kid"].includes(key),
      ),
    );
    const headerExtraJson = Object.keys(headerExtras).length
      ? JSON.stringify(headerExtras, null, 2)
      : "";

    const nextClaims: Partial<JwtState> = {
      iss: typeof payload.iss === "string" ? payload.iss : "",
      sub: typeof payload.sub === "string" ? payload.sub : "",
      jti: typeof payload.jti === "string" ? payload.jti : "",
      expText: payload.exp !== undefined ? String(payload.exp) : "",
      nbfText: payload.nbf !== undefined ? String(payload.nbf) : "",
      iatText: payload.iat !== undefined ? String(payload.iat) : "",
    };

    let audIsArray = false;
    let audText = "";
    let audListText = "";
    if (Array.isArray(payload.aud)) {
      audIsArray = true;
      audListText = toTagListValue(payload.aud.map(String));
    } else if (typeof payload.aud === "string") {
      audText = payload.aud;
    }

    const extraClaims = Object.fromEntries(
      Object.entries(payload).filter(
        ([key]) => !registeredClaims.includes(key as RegisteredClaim),
      ),
    );
    const extraJsonText = Object.keys(extraClaims).length
      ? JSON.stringify(extraClaims, null, 2)
      : "";

    setState((prev) => ({
      ...prev,
      headerAlg,
      headerTyp,
      headerKid,
      headerExtraJson,
      audIsArray,
      audText,
      audListText,
      extraJsonText,
      ...nextClaims,
    }));
  }, [state.tokenText, setState]);

  React.useEffect(() => {
    if (!state.headerExtraJson.trim()) {
      setHeaderExtraError(null);
      return;
    }
    try {
      const parsed = JSON.parse(state.headerExtraJson);
      if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
        setHeaderExtraError(null);
      } else {
        setHeaderExtraError("Header extra JSON must be an object.");
      }
    } catch (error) {
      setHeaderExtraError(
        error instanceof Error ? error.message : "Invalid JSON.",
      );
    }
  }, [state.headerExtraJson]);

  React.useEffect(() => {
    if (!state.extraJsonText.trim()) {
      setExtraError(null);
      return;
    }
    try {
      const parsed = JSON.parse(state.extraJsonText);
      if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
        setExtraError(null);
      } else {
        setExtraError("Extra JSON must be an object.");
      }
    } catch (error) {
      setExtraError(error instanceof Error ? error.message : "Invalid JSON.");
    }
  }, [state.extraJsonText]);

  React.useEffect(() => {
    const exp = Number.parseInt(state.expText, 10);
    if (!state.expText || !Number.isFinite(exp)) {
      setExpiredStatus("Unknown");
      return;
    }
    const now = Math.floor(Date.now() / 1000);
    setExpiredStatus(now >= exp ? "Expired" : "Not expired");
  }, [state.expText]);

  React.useEffect(() => {
    const run = async () => {
      if (!state.tokenText.trim()) {
        setSignatureStatus(null);
        return;
      }
      if (!parsedTokenRef.current) {
        setSignatureStatus({
          status: "Invalid",
          message: "Token parsing failed.",
        });
        return;
      }

      const headerAlg = parsedTokenRef.current.header.alg;
      const alg =
        typeof headerAlg === "string" ? (headerAlg as JwtAlg) : "none";
      if (!algOptions.includes(alg)) {
        setSignatureStatus({
          status: "Unsupported",
          message: "Unsupported algorithm.",
        });
        return;
      }

      if (alg === "none") {
        const ok = parsedTokenRef.current.signature.length === 0;
        setSignatureStatus({
          status: ok ? "Valid" : "Invalid",
          message: ok ? "Unsigned token." : "Unexpected signature.",
        });
        return;
      }

      const keyForVerify = alg.startsWith("HS")
        ? state.secretText
        : state.secretPublicText || state.secretPrivateText;
      if (!keyForVerify) {
        setSignatureStatus({
          status: "Unknown",
          message: alg.startsWith("HS")
            ? "Secret is required for verification."
            : "Public key is required for verification.",
        });
        return;
      }

      if (!crypto?.subtle) {
        setSignatureStatus({
          status: "Unsupported",
          message: "Web Crypto unavailable.",
        });
        return;
      }

      try {
        const ok = await verifyJwtSignatureWithKey({
          alg,
          signingInput: parsedTokenRef.current.signingInput,
          signature: parsedTokenRef.current.signature,
          secret: keyForVerify,
          encoding: state.secretEncoding,
        });
        if (ok === null) {
          setSignatureStatus({
            status: "Invalid",
            message: "Key decoding failed.",
          });
          return;
        }
        setSignatureStatus({
          status: ok ? "Valid" : "Invalid",
          message: ok ? "Signature matches." : "Signature mismatch.",
        });
      } catch (error) {
        setSignatureStatus({
          status: "Invalid",
          message:
            error instanceof Error ? error.message : "Verification failed.",
        });
      }
    };
    void run();
  }, [
    state.tokenText,
    state.secretText,
    state.secretPublicText,
    state.secretPrivateText,
    state.secretEncoding,
  ]);

  const handleTokenCopy = React.useCallback(async () => {
    if (!state.tokenText) return;
    await navigator.clipboard.writeText(state.tokenText);
    setCopyFeedback(true);
    window.setTimeout(() => setCopyFeedback(false), 1200);
  }, [state.tokenText]);

  const handleTokenDownload = React.useCallback(() => {
    if (!state.tokenText) return;
    const blob = new Blob([state.tokenText], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "jwt.txt";
    link.click();
    URL.revokeObjectURL(url);
  }, [state.tokenText]);

  const handleGenerate = React.useCallback(async () => {
    const errors: string[] = [];
    const headerExtra = state.headerExtraJson.trim();
    let headerExtraObj: Record<string, unknown> = {};
    if (headerExtra) {
      try {
        const parsed = JSON.parse(headerExtra);
        if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
          errors.push("Header extra JSON must be an object.");
        } else {
          headerExtraObj = parsed;
        }
      } catch (error) {
        errors.push(
          error instanceof Error ? error.message : "Invalid header JSON.",
        );
      }
    }

    const extraJson = state.extraJsonText.trim();
    let extraObj: Record<string, unknown> = {};
    if (extraJson) {
      try {
        const parsed = JSON.parse(extraJson);
        if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
          errors.push("Extra JSON must be an object.");
        } else {
          extraObj = parsed;
        }
      } catch (error) {
        errors.push(
          error instanceof Error ? error.message : "Invalid extra JSON.",
        );
      }
    }

    const conflictKeys = Object.keys(extraObj).filter((key) =>
      registeredClaims.includes(key as RegisteredClaim),
    );
    if (conflictKeys.length > 0) {
      errors.push(
        `Extra JSON includes registered claims: ${conflictKeys.join(", ")}`,
      );
    }

    const timeClaims: Array<{
      key: "expText" | "nbfText" | "iatText";
      label: string;
    }> = [
      { key: "expText", label: "exp" },
      { key: "nbfText", label: "nbf" },
      { key: "iatText", label: "iat" },
    ];

    for (const { key, label } of timeClaims) {
      const value = state[key].trim();
      if (!value) continue;
      const num = Number.parseInt(value, 10);
      if (!Number.isFinite(num)) {
        errors.push(`${label} must be a valid Unix timestamp in seconds.`);
      }
    }

    const alg = state.headerAlg as JwtAlg;
    if (alg !== "none") {
      if (alg.startsWith("HS")) {
        if (!state.secretText) {
          errors.push("Secret is required for signing.");
        } else if (!decodeSecret(state.secretText, state.secretEncoding)) {
          errors.push("Secret decoding failed.");
        }
      } else if (!state.secretPrivateText) {
        errors.push("Private key is required for signing.");
      }
    }

    if (errors.length > 0) {
      setGenerateErrors(errors);
      return;
    }

    setGenerateErrors([]);

    const header: Record<string, unknown> = {
      alg: state.headerAlg,
      typ: state.headerTyp || "JWT",
    };
    if (state.headerKid) header.kid = state.headerKid;
    headerExtraObj = { ...headerExtraObj };
    for (const [key, value] of Object.entries(headerExtraObj)) {
      if (["alg", "typ", "kid"].includes(key)) continue;
      header[key] = value;
    }

    const payload: Record<string, unknown> = {};
    if (state.iss) payload.iss = state.iss;
    if (state.sub) payload.sub = state.sub;
    if (state.jti) payload.jti = state.jti;
    if (state.expText) {
      const value = Number.parseInt(state.expText, 10);
      if (Number.isFinite(value)) payload.exp = value;
    }
    if (state.nbfText) {
      const value = Number.parseInt(state.nbfText, 10);
      if (Number.isFinite(value)) payload.nbf = value;
    }
    if (state.iatText) {
      const value = Number.parseInt(state.iatText, 10);
      if (Number.isFinite(value)) payload.iat = value;
    }

    if (state.audIsArray) {
      const list = parseTagList(state.audListText);
      if (list.length > 0) payload.aud = list;
    } else if (state.audText) {
      payload.aud = state.audText;
    }

    for (const [key, value] of Object.entries(extraObj)) {
      payload[key] = value;
    }

    const headerPart = base64UrlEncodeString(JSON.stringify(header));
    const payloadPart = base64UrlEncodeString(JSON.stringify(payload));
    const signingInput = `${headerPart}.${payloadPart}`;
    let signaturePart = "";

    if (alg !== "none") {
      const signed = await signJwtWithKey({
        alg,
        signingInput,
        secret: alg.startsWith("HS")
          ? state.secretText
          : state.secretPrivateText,
        encoding: state.secretEncoding,
      });
      if (signed === null) {
        setGenerateErrors(["Key decoding failed."]);
        return;
      }
      signaturePart = signed;
    }

    const token = `${signingInput}.${signaturePart}`;
    setParam("tokenText", token, true);
  }, [state, setParam]);

  const tokenWarning = oversizeKeys.includes("tokenText")
    ? "Token exceeds 2 KB and is not synced to the URL."
    : null;

  return (
    <ToolPageWrapper
      toolId="jwt"
      title="JWT"
      description="Inspect, edit, and generate JSON Web Tokens"
      onLoadHistory={handleLoadHistory}
    >
      <JwtInner
        state={state}
        setParam={setParam}
        setState={setState}
        hasUrlParams={hasUrlParams}
        hasTokenInUrl={hasTokenInUrl}
        hydrationSource={hydrationSource}
        parseError={parseError}
        headerExtraError={headerExtraError}
        extraError={extraError}
        generateErrors={generateErrors}
        signatureStatus={signatureStatus}
        expiredStatus={expiredStatus}
        tokenWarning={tokenWarning}
        onTokenCopy={handleTokenCopy}
        onTokenDownload={handleTokenDownload}
        onGenerate={handleGenerate}
        setGenerateErrors={setGenerateErrors}
        copyFeedback={copyFeedback}
      />
    </ToolPageWrapper>
  );
}

function JwtInner({
  state,
  setParam,
  setState,
  hasUrlParams,
  hasTokenInUrl,
  hydrationSource,
  parseError,
  headerExtraError,
  extraError,
  generateErrors,
  signatureStatus,
  expiredStatus,
  tokenWarning,
  onTokenCopy,
  onTokenDownload,
  onGenerate,
  setGenerateErrors,
  copyFeedback,
}: {
  state: JwtState;
  setParam: <K extends keyof JwtState>(
    key: K,
    value: JwtState[K],
    updateHistory?: boolean,
  ) => void;
  setState: (
    updater: JwtState | ((prev: JwtState) => JwtState),
    immediate?: boolean,
  ) => void;
  hasUrlParams: boolean;
  hasTokenInUrl: boolean;
  hydrationSource: "default" | "url" | "history";
  parseError: string | null;
  headerExtraError: string | null;
  extraError: string | null;
  generateErrors: string[];
  signatureStatus: { status: string; message: string } | null;
  expiredStatus: string;
  tokenWarning: string | null;
  onTokenCopy: () => void;
  onTokenDownload: () => void;
  onGenerate: () => void;
  setGenerateErrors: React.Dispatch<React.SetStateAction<string[]>>;
  copyFeedback: boolean;
}) {
  const { upsertInputEntry, upsertParams } = useToolHistoryContext();
  const lastTokenRef = React.useRef("");
  const hasHydratedInputRef = React.useRef(false);
  const hasInitializedParamsRef = React.useRef(false);
  const paramsRef = React.useRef<Record<string, unknown>>({});
  const hasHandledUrlRef = React.useRef(false);
  const [isGeneratingKey, setIsGeneratingKey] = React.useState(false);
  const [headerJsonText, setHeaderJsonText] = React.useState("");
  const [headerJsonError, setHeaderJsonError] = React.useState<string | null>(
    null,
  );
  const [payloadJsonText, setPayloadJsonText] = React.useState("");
  const [payloadJsonError, setPayloadJsonError] = React.useState<string | null>(
    null,
  );
  const headerJsonDirtyRef = React.useRef(false);
  const payloadJsonDirtyRef = React.useRef(false);

  const paramsSnapshot = React.useCallback(
    () => ({
      headerAlg: state.headerAlg,
      headerTyp: state.headerTyp,
      headerKid: state.headerKid,
      headerExtraJson: state.headerExtraJson,
      headerView: state.headerView,
      iss: state.iss,
      sub: state.sub,
      audIsArray: state.audIsArray,
      audText: state.audText,
      audListText: state.audListText,
      expText: state.expText,
      nbfText: state.nbfText,
      iatText: state.iatText,
      jti: state.jti,
      extraJsonText: state.extraJsonText,
      payloadView: state.payloadView,
      secretText: state.secretText,
      secretPublicText: state.secretPublicText,
      secretPrivateText: state.secretPrivateText,
      secretEncoding: state.secretEncoding,
    }),
    [state],
  );

  const buildHeaderObject = React.useCallback(() => {
    const header: Record<string, unknown> = {
      alg: state.headerAlg,
      typ: state.headerTyp || "JWT",
    };
    if (state.headerKid) header.kid = state.headerKid;
    const extra = state.headerExtraJson.trim();
    if (extra) {
      try {
        const parsed = JSON.parse(extra);
        if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
          for (const [key, value] of Object.entries(
            parsed as Record<string, unknown>,
          )) {
            if (["alg", "typ", "kid"].includes(key)) continue;
            header[key] = value;
          }
        }
      } catch {
        // Ignore invalid JSON; keep known header fields only.
      }
    }
    return header;
  }, [
    state.headerAlg,
    state.headerTyp,
    state.headerKid,
    state.headerExtraJson,
  ]);

  const buildPayloadObject = React.useCallback(() => {
    const payload: Record<string, unknown> = {};
    if (state.iss) payload.iss = state.iss;
    if (state.sub) payload.sub = state.sub;
    if (state.jti) payload.jti = state.jti;
    if (state.expText) payload.exp = Number.parseInt(state.expText, 10);
    if (state.nbfText) payload.nbf = Number.parseInt(state.nbfText, 10);
    if (state.iatText) payload.iat = Number.parseInt(state.iatText, 10);
    if (state.audIsArray) {
      const list = parseTagList(state.audListText);
      if (list.length > 0) payload.aud = list;
    } else if (state.audText) {
      payload.aud = state.audText;
    }
    const extra = state.extraJsonText.trim();
    if (extra) {
      try {
        const parsed = JSON.parse(extra);
        if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
          for (const [key, value] of Object.entries(
            parsed as Record<string, unknown>,
          )) {
            if (registeredClaims.includes(key as RegisteredClaim)) continue;
            payload[key] = value;
          }
        }
      } catch {
        // Ignore invalid JSON; keep known payload fields only.
      }
    }
    return payload;
  }, [
    state.iss,
    state.sub,
    state.jti,
    state.expText,
    state.nbfText,
    state.iatText,
    state.audIsArray,
    state.audListText,
    state.audText,
    state.extraJsonText,
  ]);

  React.useEffect(() => {
    if (hasHydratedInputRef.current) return;
    if (hydrationSource === "default") return;
    lastTokenRef.current = state.tokenText;
    hasHydratedInputRef.current = true;
  }, [hydrationSource, state.tokenText]);

  React.useEffect(() => {
    const nextParams = paramsSnapshot();
    if (!hasInitializedParamsRef.current) {
      hasInitializedParamsRef.current = true;
      paramsRef.current = nextParams;
      return;
    }
    const keys = Object.keys(nextParams) as Array<keyof typeof nextParams>;
    const same = keys.every(
      (key) => paramsRef.current[key] === nextParams[key],
    );
    if (same) return;
    paramsRef.current = nextParams;
    upsertParams(nextParams, "deferred");
  }, [paramsSnapshot, upsertParams]);

  React.useEffect(() => {
    if (!state.tokenText || state.tokenText === lastTokenRef.current) return;
    const timer = setTimeout(() => {
      lastTokenRef.current = state.tokenText;
      upsertInputEntry(
        { tokenText: state.tokenText },
        paramsRef.current,
        "left",
        state.tokenText.slice(0, 80),
      );
    }, DEFAULT_URL_SYNC_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [state.tokenText, upsertInputEntry]);

  React.useEffect(() => {
    if (hasUrlParams && !hasHandledUrlRef.current) {
      hasHandledUrlRef.current = true;
      if (state.tokenText) {
        upsertInputEntry(
          { tokenText: state.tokenText },
          paramsRef.current,
          "left",
          state.tokenText.slice(0, 80),
        );
      } else {
        upsertParams(paramsSnapshot(), "deferred");
      }
    }
  }, [
    hasUrlParams,
    state.tokenText,
    paramsSnapshot,
    upsertInputEntry,
    upsertParams,
  ]);

  React.useEffect(() => {
    if (state.headerView !== "json") return;
    if (headerJsonDirtyRef.current) return;
    setHeaderJsonText(JSON.stringify(buildHeaderObject(), null, 2));
  }, [state.headerView, buildHeaderObject]);

  React.useEffect(() => {
    if (state.payloadView !== "json") return;
    if (payloadJsonDirtyRef.current) return;
    setPayloadJsonText(JSON.stringify(buildPayloadObject(), null, 2));
  }, [state.payloadView, buildPayloadObject]);

  const handleTimePick = React.useCallback(
    (key: "expText" | "nbfText" | "iatText", date: Date | undefined) => {
      if (!date) return;
      const seconds = Math.floor(date.getTime() / 1000);
      setParam(key, String(seconds), true);
    },
    [setParam],
  );

  const currentTime = (value: string) => {
    const seconds = Number.parseInt(value, 10);
    if (!Number.isFinite(seconds)) return undefined;
    return new Date(seconds * 1000);
  };

  const setHeaderViewMode = React.useCallback(
    (next: "table" | "json") => {
      if (next === state.headerView) return;
      setParam("headerView", next, true);
      headerJsonDirtyRef.current = false;
      setHeaderJsonError(null);
      if (next === "json") {
        setHeaderJsonText(JSON.stringify(buildHeaderObject(), null, 2));
      }
    },
    [state.headerView, setParam, buildHeaderObject],
  );

  const setPayloadViewMode = React.useCallback(
    (next: "table" | "json") => {
      if (next === state.payloadView) return;
      setParam("payloadView", next, true);
      payloadJsonDirtyRef.current = false;
      setPayloadJsonError(null);
      if (next === "json") {
        setPayloadJsonText(JSON.stringify(buildPayloadObject(), null, 2));
      }
    },
    [state.payloadView, setParam, buildPayloadObject],
  );

  const handleHeaderJsonChange = React.useCallback(
    (value: string) => {
      headerJsonDirtyRef.current = true;
      setHeaderJsonText(value);
      if (!value.trim()) {
        setHeaderJsonError("Header JSON is required.");
        return;
      }
      try {
        const parsed = JSON.parse(value);
        if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
          setHeaderJsonError("Header JSON must be an object.");
          return;
        }
        setHeaderJsonError(null);
        const headerObj = parsed as Record<string, unknown>;
        if (
          typeof headerObj.alg === "string" &&
          algOptions.includes(headerObj.alg as JwtAlg)
        ) {
          setParam("headerAlg", headerObj.alg, true);
        }
        if (typeof headerObj.typ === "string") {
          setParam("headerTyp", headerObj.typ);
        } else {
          setParam("headerTyp", "JWT");
        }
        if (typeof headerObj.kid === "string") {
          setParam("headerKid", headerObj.kid);
        } else {
          setParam("headerKid", "");
        }
        const extras = Object.fromEntries(
          Object.entries(headerObj).filter(
            ([key]) => !["alg", "typ", "kid"].includes(key),
          ),
        );
        setParam(
          "headerExtraJson",
          Object.keys(extras).length ? JSON.stringify(extras, null, 2) : "",
        );
      } catch (error) {
        setHeaderJsonError(
          error instanceof Error ? error.message : "Invalid JSON.",
        );
      }
    },
    [setParam],
  );

  const handlePayloadJsonChange = React.useCallback(
    (value: string) => {
      payloadJsonDirtyRef.current = true;
      setPayloadJsonText(value);
      if (!value.trim()) {
        setPayloadJsonError("Payload JSON is required.");
        return;
      }
      try {
        const parsed = JSON.parse(value);
        if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
          setPayloadJsonError("Payload JSON must be an object.");
          return;
        }
        setPayloadJsonError(null);
        const payloadObj = parsed as Record<string, unknown>;
        setParam(
          "iss",
          typeof payloadObj.iss === "string" ? payloadObj.iss : "",
        );
        setParam(
          "sub",
          typeof payloadObj.sub === "string" ? payloadObj.sub : "",
        );
        setParam(
          "jti",
          typeof payloadObj.jti === "string" ? payloadObj.jti : "",
        );

        const expValue =
          typeof payloadObj.exp === "number" ||
          typeof payloadObj.exp === "string"
            ? String(payloadObj.exp)
            : "";
        const nbfValue =
          typeof payloadObj.nbf === "number" ||
          typeof payloadObj.nbf === "string"
            ? String(payloadObj.nbf)
            : "";
        const iatValue =
          typeof payloadObj.iat === "number" ||
          typeof payloadObj.iat === "string"
            ? String(payloadObj.iat)
            : "";
        setParam("expText", expValue);
        setParam("nbfText", nbfValue);
        setParam("iatText", iatValue);

        if (Array.isArray(payloadObj.aud)) {
          setParam("audIsArray", true, true);
          setParam(
            "audListText",
            toTagListValue(payloadObj.aud.map((item) => String(item))),
          );
          setParam("audText", "");
        } else if (typeof payloadObj.aud === "string") {
          setParam("audIsArray", false, true);
          setParam("audText", payloadObj.aud);
          setParam("audListText", "");
        } else {
          setParam("audIsArray", false, true);
          setParam("audText", "");
          setParam("audListText", "");
        }

        const extras = Object.fromEntries(
          Object.entries(payloadObj).filter(
            ([key]) => !registeredClaims.includes(key as RegisteredClaim),
          ),
        );
        setParam(
          "extraJsonText",
          Object.keys(extras).length ? JSON.stringify(extras, null, 2) : "",
        );
      } catch (error) {
        setPayloadJsonError(
          error instanceof Error ? error.message : "Invalid JSON.",
        );
      }
    },
    [setParam],
  );

  const copyHint = null;
  const isHmacAlg = state.headerAlg.startsWith("HS");
  const secretWarning =
    isHmacAlg && state.secretText && state.secretText.length < 8
      ? "Secret is short; verify carefully."
      : null;
  const secretHelper = isHmacAlg
    ? "HMAC secret used for signing and verification."
    : "Use PEM or JWK keys. Private key for signing, public key for verification.";
  const expiredTone =
    expiredStatus === "Expired"
      ? "text-destructive"
      : expiredStatus === "Not expired"
        ? "text-emerald-600"
        : "text-muted-foreground";
  const signatureTone = signatureStatus
    ? signatureStatus.status === "Valid"
      ? "text-emerald-600"
      : signatureStatus.status === "Invalid"
        ? "text-destructive"
        : signatureStatus.status === "Unsupported"
          ? "text-amber-600"
          : "text-muted-foreground"
    : "text-muted-foreground";
  const labelCellClass =
    "py-1 pr-3 align-middle text-xs text-muted-foreground whitespace-nowrap w-20";
  const labelWithHelp = (label: string, help: string) => (
    <span className="inline-flex items-center gap-1">
      {label}
      <HelpHint text={help} />
    </span>
  );
  const handleAutoResize = (event: React.FormEvent<HTMLTextAreaElement>) => {
    const target = event.currentTarget;
    target.style.height = "auto";
    target.style.height = `${target.scrollHeight}px`;
  };

  const generateKeyMaterial = React.useCallback(async () => {
    const alg = state.headerAlg as JwtAlg;
    if (!crypto?.subtle) {
      setGenerateErrors(["Web Crypto unavailable."]);
      return;
    }

    setGenerateErrors([]);
    setIsGeneratingKey(true);

    try {
      if (alg.startsWith("HS")) {
        const size = alg === "HS256" ? 32 : alg === "HS384" ? 48 : 64;
        const bytes = new Uint8Array(size);
        crypto.getRandomValues(bytes);
        const toHex = (data: Uint8Array) =>
          Array.from(data)
            .map((b) => b.toString(16).padStart(2, "0"))
            .join("");
        const toBase64 = (data: Uint8Array) => {
          let binary = "";
          for (const byte of data) binary += String.fromCharCode(byte);
          return btoa(binary);
        };
        const secret =
          state.secretEncoding === "hex"
            ? toHex(bytes)
            : state.secretEncoding === "base64"
              ? toBase64(bytes)
              : toBase64(bytes);
        setParam("secretText", secret);
        setParam("secretPublicText", "");
        setParam("secretPrivateText", "");
        return;
      }

      const toPem = (
        buffer: ArrayBuffer,
        label: "PUBLIC KEY" | "PRIVATE KEY",
      ) => {
        const bytes = new Uint8Array(buffer);
        let binary = "";
        for (const byte of bytes) binary += String.fromCharCode(byte);
        const base64 = btoa(binary).replace(/(.{64})/g, "$1\n");
        return `-----BEGIN ${label}-----\n${base64}\n-----END ${label}-----`;
      };

      const hash =
        alg.startsWith("RS") || alg.startsWith("PS")
          ? alg.endsWith("256")
            ? "SHA-256"
            : alg.endsWith("384")
              ? "SHA-384"
              : "SHA-512"
          : undefined;

      if (alg.startsWith("RS")) {
        const keyPair = (await crypto.subtle.generateKey(
          {
            name: "RSASSA-PKCS1-v1_5",
            modulusLength: 2048,
            publicExponent: new Uint8Array([1, 0, 1]),
            hash: { name: hash! },
          },
          true,
          ["sign", "verify"],
        )) as CryptoKeyPair;
        const publicKey = await crypto.subtle.exportKey(
          "spki",
          keyPair.publicKey,
        );
        const privateKey = await crypto.subtle.exportKey(
          "pkcs8",
          keyPair.privateKey,
        );
        setParam("secretPublicText", toPem(publicKey, "PUBLIC KEY"));
        setParam("secretPrivateText", toPem(privateKey, "PRIVATE KEY"));
        setParam("secretText", "");
        return;
      }

      if (alg.startsWith("PS")) {
        const keyPair = (await crypto.subtle.generateKey(
          {
            name: "RSA-PSS",
            modulusLength: 2048,
            publicExponent: new Uint8Array([1, 0, 1]),
            hash: { name: hash! },
          },
          true,
          ["sign", "verify"],
        )) as CryptoKeyPair;
        const publicKey = await crypto.subtle.exportKey(
          "spki",
          keyPair.publicKey,
        );
        const privateKey = await crypto.subtle.exportKey(
          "pkcs8",
          keyPair.privateKey,
        );
        setParam("secretPublicText", toPem(publicKey, "PUBLIC KEY"));
        setParam("secretPrivateText", toPem(privateKey, "PRIVATE KEY"));
        setParam("secretText", "");
        return;
      }

      if (alg.startsWith("ES")) {
        const namedCurve =
          alg === "ES256" ? "P-256" : alg === "ES384" ? "P-384" : "P-521";
        const keyPair = (await crypto.subtle.generateKey(
          {
            name: "ECDSA",
            namedCurve,
          },
          true,
          ["sign", "verify"],
        )) as CryptoKeyPair;
        const publicKey = await crypto.subtle.exportKey(
          "spki",
          keyPair.publicKey,
        );
        const privateKey = await crypto.subtle.exportKey(
          "pkcs8",
          keyPair.privateKey,
        );
        setParam("secretPublicText", toPem(publicKey, "PUBLIC KEY"));
        setParam("secretPrivateText", toPem(privateKey, "PRIVATE KEY"));
        setParam("secretText", "");
        return;
      }

      if (alg === "EdDSA") {
        const keyPair = (await crypto.subtle.generateKey(
          {
            name: "Ed25519",
          },
          true,
          ["sign", "verify"],
        )) as CryptoKeyPair;
        const publicKey = await crypto.subtle.exportKey(
          "spki",
          keyPair.publicKey,
        );
        const privateKey = await crypto.subtle.exportKey(
          "pkcs8",
          keyPair.privateKey,
        );
        setParam("secretPublicText", toPem(publicKey, "PUBLIC KEY"));
        setParam("secretPrivateText", toPem(privateKey, "PRIVATE KEY"));
        setParam("secretText", "");
      }
    } catch (error) {
      setGenerateErrors([
        error instanceof Error ? error.message : "Key generation failed.",
      ]);
    } finally {
      setIsGeneratingKey(false);
    }
  }, [state.headerAlg, state.secretEncoding, setParam, setGenerateErrors]);

  return (
    <div className="flex flex-col gap-4 lg:grid lg:grid-cols-2 lg:items-start lg:gap-8">
      <div className="w-full min-w-0 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-sm font-semibold">JWT Token</h2>
            {copyHint && (
              <p className="mt-1 text-xs text-muted-foreground">{copyHint}</p>
            )}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              className="h-7 px-2 text-xs"
              onClick={onTokenCopy}
              disabled={!state.tokenText}
            >
              {copyFeedback ? (
                <Check className="h-3.5 w-3.5" />
              ) : (
                <Copy className="h-3.5 w-3.5" />
              )}
              {copyFeedback ? "Copied" : "Copy"}
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="h-7 px-2 text-xs"
              onClick={onTokenDownload}
              disabled={!state.tokenText}
            >
              <Download className="h-3.5 w-3.5" />
              Download
            </Button>
          </div>
        </div>
        <Textarea
          value={state.tokenText}
          onChange={(event) => setParam("tokenText", event.target.value)}
          placeholder="Paste or type a JWT token..."
          className={cn(
            "min-h-[220px] w-full max-w-full break-all font-mono text-sm",
            parseError && "border-destructive",
          )}
        />
        {parseError && <p className="text-xs text-destructive">{parseError}</p>}
        {tokenWarning && (
          <p className="text-xs text-muted-foreground">{tokenWarning}</p>
        )}
        <div className="border-t pt-3 space-y-2">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold">Secret</h3>
            <Button
              variant="outline"
              size="sm"
              className="h-7 px-2 text-xs"
              onClick={generateKeyMaterial}
              disabled={isGeneratingKey}
            >
              {isGeneratingKey ? "Generating..." : "Generate"}
            </Button>
          </div>
          {isHmacAlg ? (
            <table className="w-full table-fixed text-sm">
              <tbody>
                <tr>
                  <td className={labelCellClass}>Secret</td>
                  <td className="py-1">
                    <div className="flex items-center gap-2 min-w-0">
                      <Input
                        value={state.secretText}
                        onChange={(event) =>
                          setParam("secretText", event.target.value)
                        }
                        placeholder="Enter secret"
                        className="h-8 min-w-0 flex-1 text-sm"
                      />
                      <Select
                        value={state.secretEncoding}
                        onValueChange={(value) =>
                          setParam(
                            "secretEncoding",
                            value as JwtState["secretEncoding"],
                            true,
                          )
                        }
                      >
                        <SelectTrigger className="h-8 w-24 text-xs">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="utf8">utf8</SelectItem>
                          <SelectItem value="base64">base64</SelectItem>
                          <SelectItem value="hex">hex</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </td>
                </tr>
              </tbody>
            </table>
          ) : (
            <table className="w-full table-fixed text-sm">
              <tbody>
                <tr>
                  <td className={labelCellClass}>Public Key</td>
                  <td className="py-1">
                    <Textarea
                      value={state.secretPublicText}
                      onChange={(event) =>
                        setParam("secretPublicText", event.target.value)
                      }
                      placeholder='{"kty":"RSA","n":"...","e":"..."}'
                      className="min-h-[90px] w-full min-w-0 break-all font-mono text-xs"
                    />
                  </td>
                </tr>
                <tr>
                  <td className={labelCellClass}>Private Key</td>
                  <td className="py-1">
                    <Textarea
                      value={state.secretPrivateText}
                      onChange={(event) =>
                        setParam("secretPrivateText", event.target.value)
                      }
                      placeholder='{"kty":"RSA","d":"..."}'
                      className="min-h-[90px] w-full min-w-0 break-all font-mono text-xs"
                    />
                  </td>
                </tr>
              </tbody>
            </table>
          )}
          {secretWarning && (
            <p className="text-xs text-muted-foreground">{secretWarning}</p>
          )}
          <p className="text-xs text-muted-foreground">{secretHelper}</p>
        </div>
        <div className="border-t pt-3 space-y-2 text-sm">
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">Expired</span>
            <span className={expiredTone}>{expiredStatus}</span>
          </div>
          <div className="flex items-start justify-between gap-3">
            <span className="text-muted-foreground">Signature</span>
            <span className={cn("text-right", signatureTone)}>
              {signatureStatus
                ? `${signatureStatus.status} - ${signatureStatus.message}`
                : "—"}
            </span>
          </div>
        </div>
      </div>

      <div className="w-full min-w-0 flex flex-col gap-3 text-sm">
        <div className="space-y-3 border-b pb-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold">Header</h3>
            <div className="flex items-center gap-1">
              <Button
                type="button"
                variant={state.headerView === "table" ? "secondary" : "ghost"}
                size="sm"
                className="h-7 px-2 text-xs"
                onClick={() => setHeaderViewMode("table")}
              >
                Table
              </Button>
              <Button
                type="button"
                variant={state.headerView === "json" ? "secondary" : "ghost"}
                size="sm"
                className="h-7 px-2 text-xs"
                onClick={() => setHeaderViewMode("json")}
              >
                JSON
              </Button>
            </div>
          </div>
          {state.headerView === "table" ? (
            <table className="w-full">
              <tbody>
                <tr>
                  <td className={labelCellClass}>
                    {labelWithHelp(
                      "alg",
                      "Signing algorithm used for the token.",
                    )}
                  </td>
                  <td className="py-1">
                    <div className="flex items-center gap-3">
                      <Select
                        value={state.headerAlg}
                        onValueChange={(value) =>
                          setParam("headerAlg", value, true)
                        }
                      >
                        <SelectTrigger className="h-8 w-40 text-sm">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {algOptions.map((alg) => (
                            <SelectItem key={alg} value={alg}>
                              {alg}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <div className="hidden sm:flex items-center gap-2">
                        {labelWithHelp(
                          "typ",
                          "Token type header, typically JWT.",
                        )}
                        <Input
                          value={state.headerTyp}
                          readOnly
                          className="h-8 w-28 bg-muted/50 text-sm"
                        />
                      </div>
                    </div>
                  </td>
                </tr>
                <tr className="sm:hidden">
                  <td className={labelCellClass}>
                    {labelWithHelp("typ", "Token type header, typically JWT.")}
                  </td>
                  <td className="py-1">
                    <Input
                      value={state.headerTyp}
                      readOnly
                      className="h-8 w-28 bg-muted/50 text-sm"
                    />
                  </td>
                </tr>
                <tr>
                  <td className={labelCellClass}>
                    {labelWithHelp(
                      "kid",
                      "Key identifier used to select the signing key.",
                    )}
                  </td>
                  <td className="py-1">
                    <Input
                      value={state.headerKid}
                      onChange={(event) =>
                        setParam("headerKid", event.target.value)
                      }
                      className="h-8 w-full text-sm"
                      placeholder="Key ID"
                    />
                  </td>
                </tr>
                <tr>
                  <td className={labelCellClass}>Extra</td>
                  <td className="py-1">
                    <Textarea
                      value={state.headerExtraJson}
                      onChange={(event) =>
                        setParam("headerExtraJson", event.target.value)
                      }
                      placeholder='{"cty":"JWT"}'
                      rows={2}
                      onInput={handleAutoResize}
                      className={cn(
                        "min-h-[56px] resize-y break-all font-mono text-xs",
                        headerExtraError && "border-destructive",
                      )}
                    />
                    {headerExtraError && (
                      <p className="mt-1 text-xs text-destructive">
                        {headerExtraError}
                      </p>
                    )}
                  </td>
                </tr>
              </tbody>
            </table>
          ) : (
            <div className="space-y-2">
              <Textarea
                value={headerJsonText}
                onChange={(event) => handleHeaderJsonChange(event.target.value)}
                className={cn(
                  "min-h-[120px] break-all font-mono text-xs",
                  headerJsonError && "border-destructive",
                )}
                placeholder='{"alg":"HS256","typ":"JWT"}'
              />
              {headerJsonError && (
                <p className="text-xs text-destructive">{headerJsonError}</p>
              )}
            </div>
          )}
        </div>

        <div className="space-y-3 border-b pb-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold">Payload</h3>
            <div className="flex items-center gap-1">
              <Button
                type="button"
                variant={state.payloadView === "table" ? "secondary" : "ghost"}
                size="sm"
                className="h-7 px-2 text-xs"
                onClick={() => setPayloadViewMode("table")}
              >
                Table
              </Button>
              <Button
                type="button"
                variant={state.payloadView === "json" ? "secondary" : "ghost"}
                size="sm"
                className="h-7 px-2 text-xs"
                onClick={() => setPayloadViewMode("json")}
              >
                JSON
              </Button>
            </div>
          </div>
          {state.payloadView === "table" ? (
            <table className="w-full">
              <tbody>
                <tr>
                  <td className={labelCellClass}>
                    {labelWithHelp(
                      "iss",
                      "Issuer claim identifies who issued the JWT.",
                    )}
                  </td>
                  <td className="py-1">
                    <Input
                      value={state.iss}
                      onChange={(e) => setParam("iss", e.target.value)}
                      className="h-8"
                    />
                  </td>
                </tr>
                <tr>
                  <td className={labelCellClass}>
                    {labelWithHelp(
                      "sub",
                      "Subject claim identifies the principal in the token.",
                    )}
                  </td>
                  <td className="py-1">
                    <Input
                      value={state.sub}
                      onChange={(e) => setParam("sub", e.target.value)}
                      className="h-8"
                    />
                  </td>
                </tr>
                <tr>
                  <td className={labelCellClass}>
                    {labelWithHelp(
                      "aud",
                      "Audience claim identifies intended recipients.",
                    )}
                  </td>
                  <td className="py-1 space-y-2">
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <Checkbox
                        checked={state.audIsArray}
                        onCheckedChange={(checked) =>
                          setParam("audIsArray", checked === true, true)
                        }
                      />
                      <span>Array mode</span>
                    </div>
                    {state.audIsArray ? (
                      <TagInput
                        value={state.audListText}
                        onChange={(value) => setParam("audListText", value)}
                        placeholder="Add audience and press Enter"
                      />
                    ) : (
                      <Input
                        value={state.audText}
                        onChange={(e) => setParam("audText", e.target.value)}
                        className="h-8"
                      />
                    )}
                  </td>
                </tr>
                {(["expText", "iatText", "nbfText"] as const).map((key) => (
                  <tr key={key}>
                    <td className={labelCellClass}>
                      {key === "expText"
                        ? labelWithHelp(
                            "exp",
                            "Expiration time in Unix seconds.",
                          )
                        : key === "iatText"
                          ? labelWithHelp(
                              "iat",
                              "Issued at time in Unix seconds.",
                            )
                          : labelWithHelp(
                              "nbf",
                              "Not before time in Unix seconds.",
                            )}
                    </td>
                    <td className="py-1">
                      <div className="flex items-center gap-2 min-w-0">
                        <Input
                          value={state[key]}
                          onChange={(e) => setParam(key, e.target.value)}
                          className="h-8 w-24 text-sm sm:w-32"
                          placeholder="Unix seconds"
                        />
                        <span className="text-xs text-muted-foreground truncate max-w-[140px] sm:max-w-[220px]">
                          {formatLocalTime(state[key])}
                        </span>
                        <DateTimePicker
                          date={currentTime(state[key])}
                          setDate={(date) => handleTimePick(key, date)}
                          iconOnly
                        />
                      </div>
                    </td>
                  </tr>
                ))}
                <tr>
                  <td className={labelCellClass}>
                    {labelWithHelp(
                      "jti",
                      "JWT ID provides a unique identifier for this token.",
                    )}
                  </td>
                  <td className="py-1">
                    <Input
                      value={state.jti}
                      onChange={(e) => setParam("jti", e.target.value)}
                      className="h-8"
                    />
                  </td>
                </tr>
                <tr>
                  <td className={labelCellClass}>Extra</td>
                  <td className="py-1">
                    <Textarea
                      value={state.extraJsonText}
                      onChange={(event) =>
                        setParam("extraJsonText", event.target.value)
                      }
                      placeholder='{"role":"admin"}'
                      rows={2}
                      onInput={handleAutoResize}
                      className={cn(
                        "min-h-[56px] resize-y break-all font-mono text-xs",
                        extraError && "border-destructive",
                      )}
                    />
                    {extraError && (
                      <p className="mt-1 text-xs text-destructive">
                        {extraError}
                      </p>
                    )}
                  </td>
                </tr>
              </tbody>
            </table>
          ) : (
            <div className="space-y-2">
              <Textarea
                value={payloadJsonText}
                onChange={(event) =>
                  handlePayloadJsonChange(event.target.value)
                }
                className={cn(
                  "min-h-[160px] break-all font-mono text-xs",
                  payloadJsonError && "border-destructive",
                )}
                placeholder='{"iss":"issuer","sub":"subject"}'
              />
              {payloadJsonError && (
                <p className="text-xs text-destructive">{payloadJsonError}</p>
              )}
            </div>
          )}
        </div>

        <div className="space-y-2">
          <Button className="w-full" onClick={onGenerate}>
            Generate
          </Button>
          {generateErrors.length > 0 && (
            <div className="space-y-1 text-xs text-destructive">
              {generateErrors.map((error, idx) => (
                <div key={`${error}-${idx}`}>{error}</div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
