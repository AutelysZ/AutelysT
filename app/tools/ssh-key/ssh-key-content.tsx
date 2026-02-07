"use client";

import * as React from "react";
import { z } from "zod";
import { Check, Copy, RefreshCw } from "lucide-react";
import { ed25519 } from "@noble/curves/ed25519.js";
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
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import type { HistoryEntry } from "@/lib/history/db";
import {
  base64UrlEncode,
  encodeOpenSshPublicKey,
  parseOpenSshPublicKey,
  type SshKeyType,
} from "@/lib/crypto/ssh-key";
import { decodeBase64, encodeBase64 } from "@/lib/encoding/base64";

const algorithmValues = [
  "ed25519",
  "rsa",
  "ecdsa-p256",
  "ecdsa-p384",
  "ecdsa-p521",
] as const;

const paramsSchema = z.object({
  mode: z.enum(["generate", "inspect"]).default("generate"),
  algorithm: z.enum(algorithmValues).default("ed25519"),
  rsaBits: z.coerce.number().int().min(1024).max(8192).default(2048),
  comment: z.string().default(""),
  input: z.string().default(""),
});

type ParamsState = z.infer<typeof paramsSchema>;
type AlgorithmValue = (typeof algorithmValues)[number];

type GeneratedKeypair = {
  type: SshKeyType;
  bits: number;
  publicOpenSsh: string;
  publicPem?: string;
  privatePem?: string;
  publicJwk: string;
  privateJwk?: string;
  fingerprintSha256: string;
  fingerprintMd5: string;
};

type InspectResult = {
  type: SshKeyType;
  bits: number;
  comment: string | null;
  publicOpenSsh: string;
  publicPem?: string;
  publicJwk: string;
  fingerprintSha256: string;
  fingerprintMd5: string;
  note?: string;
};

const algorithmLabels: Record<AlgorithmValue, string> = {
  ed25519: "Ed25519",
  rsa: "RSA",
  "ecdsa-p256": "ECDSA P-256",
  "ecdsa-p384": "ECDSA P-384",
  "ecdsa-p521": "ECDSA P-521",
};

export default function SshKeyContent() {
  const { state, setParam, oversizeKeys, hasUrlParams, hydrationSource } =
    useUrlSyncedState("ssh-key", {
      schema: paramsSchema,
      defaults: paramsSchema.parse({}),
    });

  const handleLoadHistory = React.useCallback(
    (entry: HistoryEntry) => {
      const { inputs, params } = entry;
      if (params.mode)
        setParam("mode", params.mode as ParamsState["mode"], true);
      if (params.algorithm)
        setParam(
          "algorithm",
          params.algorithm as ParamsState["algorithm"],
          true,
        );
      if (params.rsaBits !== undefined)
        setParam("rsaBits", Number(params.rsaBits), true);
      if (params.comment !== undefined)
        setParam("comment", String(params.comment), true);
      if (inputs.input !== undefined) {
        setParam("input", inputs.input);
        setParam("mode", "inspect", true);
      }
    },
    [setParam],
  );

  return (
    <ToolPageWrapper
      toolId="ssh-key"
      title="SSH Key Tool"
      description="Generate SSH keypairs, convert public key formats, and inspect fingerprints."
      onLoadHistory={handleLoadHistory}
    >
      <SshKeyInner
        state={state}
        setParam={setParam}
        oversizeKeys={oversizeKeys}
        hasUrlParams={hasUrlParams}
        hydrationSource={hydrationSource}
      />
    </ToolPageWrapper>
  );
}

function SshKeyInner({
  state,
  setParam,
  oversizeKeys,
  hasUrlParams,
  hydrationSource,
}: {
  state: ParamsState;
  setParam: <K extends keyof ParamsState>(
    key: K,
    value: ParamsState[K],
    immediate?: boolean,
  ) => void;
  oversizeKeys: (keyof ParamsState)[];
  hasUrlParams: boolean;
  hydrationSource: "default" | "url" | "history";
}) {
  const { upsertInputEntry, upsertParams, entries, loading } =
    useToolHistoryContext();
  const [mounted, setMounted] = React.useState(false);
  const [generated, setGenerated] = React.useState<GeneratedKeypair | null>(
    null,
  );
  const [generateError, setGenerateError] = React.useState<string | null>(null);
  const [generateLoading, setGenerateLoading] = React.useState(false);
  const [inspectResult, setInspectResult] =
    React.useState<InspectResult | null>(null);
  const [inspectError, setInspectError] = React.useState<string | null>(null);
  const [inspectLoading, setInspectLoading] = React.useState(false);
  const [copiedKey, setCopiedKey] = React.useState<string | null>(null);
  const [downloadError, setDownloadError] = React.useState<string | null>(null);
  const historyInitializedRef = React.useRef(false);
  const lastInputRef = React.useRef("");
  const hasHydratedInputRef = React.useRef(false);
  const hasHandledUrlRef = React.useRef(false);

  React.useEffect(() => {
    setMounted(true);
  }, []);

  const paramsForHistory = React.useMemo(
    () => ({
      mode: state.mode,
      algorithm: state.algorithm,
      rsaBits: state.rsaBits,
      comment: state.comment,
    }),
    [state.mode, state.algorithm, state.rsaBits, state.comment],
  );

  const inputWarning = oversizeKeys.includes("input")
    ? "Input exceeds 2 KB and is not synced to the URL."
    : null;

  React.useEffect(() => {
    if (hasHydratedInputRef.current) return;
    if (hydrationSource === "default") return;
    lastInputRef.current = state.input;
    hasHydratedInputRef.current = true;
  }, [hydrationSource, state.input]);

  React.useEffect(() => {
    if (state.mode !== "inspect") return;
    if (state.input === lastInputRef.current) return;

    const timer = setTimeout(() => {
      lastInputRef.current = state.input;
      upsertInputEntry(
        { input: state.input },
        paramsForHistory,
        "left",
        state.input ? state.input.slice(0, 120) : "SSH key",
      );
    }, DEFAULT_URL_SYNC_DEBOUNCE_MS);

    return () => clearTimeout(timer);
  }, [state.mode, state.input, paramsForHistory, upsertInputEntry]);

  React.useEffect(() => {
    if (hasUrlParams && !hasHandledUrlRef.current) {
      hasHandledUrlRef.current = true;
      if (state.input) {
        upsertInputEntry(
          { input: state.input },
          paramsForHistory,
          "left",
          state.input.slice(0, 120),
        );
      } else {
        upsertParams(paramsForHistory, "interpretation");
      }
    }
  }, [
    hasUrlParams,
    state.input,
    paramsForHistory,
    upsertInputEntry,
    upsertParams,
  ]);

  React.useEffect(() => {
    if (loading || historyInitializedRef.current) return;

    if (entries.length === 0) {
      upsertParams(paramsForHistory, "deferred");
      historyInitializedRef.current = true;
      return;
    }

    if (hasUrlParams) {
      upsertParams(paramsForHistory, "deferred");
      historyInitializedRef.current = true;
      return;
    }

    const defaults = paramsSchema.parse({});
    const latest = entries[0];
    const merged = { ...defaults, ...latest.params };
    const parsed = paramsSchema.safeParse(merged);
    if (parsed.success) {
      setParam("mode", parsed.data.mode, true);
      setParam("algorithm", parsed.data.algorithm, true);
      setParam("rsaBits", parsed.data.rsaBits, true);
      setParam("comment", parsed.data.comment, true);
    }

    historyInitializedRef.current = true;
  }, [
    entries,
    hasUrlParams,
    loading,
    paramsForHistory,
    setParam,
    upsertParams,
  ]);

  React.useEffect(() => {
    if (!historyInitializedRef.current) return;
    upsertParams(paramsForHistory, "deferred");
  }, [paramsForHistory, upsertParams]);

  React.useEffect(() => {
    let cancelled = false;

    async function inspectKey() {
      if (state.mode !== "inspect") return;
      const trimmed = state.input.trim();
      if (!trimmed) {
        setInspectResult(null);
        setInspectError(null);
        return;
      }

      setInspectLoading(true);
      setInspectError(null);

      try {
        if (isOpenSshPublicKey(trimmed)) {
          const parsed = parseOpenSshPublicKey(trimmed);
          if (parsed.error) {
            setInspectError(parsed.error);
            setInspectResult(null);
            return;
          }
          const pem = await exportPublicPem(parsed.result!.jwk);
          const normalized = encodeOpenSshPublicKey(
            parsed.result!.jwk,
            parsed.result!.comment ?? undefined,
          );
          if (normalized.error) {
            setInspectError(normalized.error);
            setInspectResult(null);
            return;
          }
          setInspectResult({
            type: parsed.result!.type,
            bits: parsed.result!.bits,
            comment: parsed.result!.comment,
            publicOpenSsh: normalized.result!.openSsh,
            publicPem: pem.value,
            publicJwk: JSON.stringify(parsed.result!.jwk, null, 2),
            fingerprintSha256: parsed.result!.fingerprintSha256,
            fingerprintMd5: parsed.result!.fingerprintMd5,
            note: pem.error ?? undefined,
          });
          return;
        }

        if (trimmed.startsWith("-----BEGIN")) {
          const imported = await importPemToJwk(trimmed);
          if (imported.error) {
            setInspectError(imported.error);
            setInspectResult(null);
            return;
          }
          const encoded = encodeOpenSshPublicKey(imported.result!.jwk);
          if (encoded.error) {
            setInspectError(encoded.error);
            setInspectResult(null);
            return;
          }
          setInspectResult({
            type: encoded.result!.type,
            bits: encoded.result!.bits,
            comment: null,
            publicOpenSsh: encoded.result!.openSsh,
            publicPem: imported.result!.publicPem,
            publicJwk: JSON.stringify(imported.result!.jwk, null, 2),
            fingerprintSha256: encoded.result!.fingerprintSha256,
            fingerprintMd5: encoded.result!.fingerprintMd5,
            note: imported.result!.note,
          });
          return;
        }

        setInspectError(
          "Unsupported key format. Paste an OpenSSH public key or PEM (SPKI/PKCS8).",
        );
        setInspectResult(null);
      } catch (error) {
        console.error("Failed to inspect SSH key:", error);
        setInspectError("Unable to inspect the provided key.");
        setInspectResult(null);
      } finally {
        if (!cancelled) setInspectLoading(false);
      }
    }

    inspectKey();
    return () => {
      cancelled = true;
    };
  }, [state.mode, state.input]);

  const handleGenerate = React.useCallback(async () => {
    setGenerateLoading(true);
    setGenerateError(null);
    try {
      const result = await generateKeyPair(
        state.algorithm,
        state.rsaBits,
        state.comment,
      );
      setGenerated(result);
    } catch (error) {
      console.error("Failed to generate SSH key:", error);
      setGenerateError("Unable to generate the requested keypair.");
      setGenerated(null);
    } finally {
      setGenerateLoading(false);
    }
  }, [state.algorithm, state.rsaBits, state.comment]);

  const handleCopy = async (value: string, key: string) => {
    if (!value) return;
    await navigator.clipboard.writeText(value);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  const handleDownloadAll = React.useCallback(async () => {
    if (!generated) return;
    setDownloadError(null);
    try {
      const { default: JSZip } = await import("jszip");
      const zip = new JSZip();
      const baseName = `ssh-${slugify(algorithmLabels[state.algorithm])}`;

      zip.file(`${baseName}.pub`, generated.publicOpenSsh);
      zip.file(`${baseName}.public.jwk.json`, generated.publicJwk);
      if (generated.privateJwk) {
        zip.file(`${baseName}.private.jwk.json`, generated.privateJwk);
      }
      if (generated.publicPem) {
        zip.file(`${baseName}.public.pem`, generated.publicPem);
      }
      if (generated.privatePem) {
        zip.file(`${baseName}.private.pem`, generated.privatePem);
      }

      const fingerprintNote = [
        `Type: ${generated.type}`,
        `Bits: ${generated.bits}`,
        generated.fingerprintSha256,
        generated.fingerprintMd5,
      ].join("\n");
      zip.file(`${baseName}.fingerprints.txt`, fingerprintNote);

      const blob = await zip.generateAsync({ type: "blob" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `${baseName}.zip`;
      link.click();
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error("Failed to build SSH zip:", error);
      setDownloadError(
        error instanceof Error ? error.message : "Failed to create zip file.",
      );
    }
  }, [generated, state.algorithm]);

  const handleSavePublicKey = async () => {
    if (!generated?.publicOpenSsh) return;
    await navigator.clipboard.writeText(generated.publicOpenSsh);
    setCopiedKey("generated-public");
    setTimeout(() => setCopiedKey(null), 2000);
    await upsertInputEntry(
      { input: generated.publicOpenSsh },
      { ...paramsForHistory, mode: "inspect" },
      "left",
      generated.publicOpenSsh.slice(0, 120),
    );
    await upsertParams({ ...paramsForHistory, mode: "inspect" }, "deferred");
  };

  return (
    <div className="flex w-full flex-col gap-6 py-4 sm:gap-8 sm:py-6">
      {!mounted ? (
        <p className="text-sm text-muted-foreground">Loading SSH key tool...</p>
      ) : (
        <Tabs
          value={state.mode}
          onValueChange={(value) =>
            setParam("mode", value as ParamsState["mode"], true)
          }
        >
          <TabsList>
            <TabsTrigger value="generate">Generate</TabsTrigger>
            <TabsTrigger value="inspect">Inspect</TabsTrigger>
          </TabsList>

          <TabsContent value="generate">
            <div className="grid gap-6 lg:grid-cols-2">
              <section className="flex flex-col gap-4">
                <div className="space-y-2">
                  <Label>Algorithm</Label>
                  <Select
                    value={state.algorithm}
                    onValueChange={(value) =>
                      setParam("algorithm", value as AlgorithmValue, true)
                    }
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select algorithm" />
                    </SelectTrigger>
                    <SelectContent>
                      {algorithmValues.map((value) => (
                        <SelectItem key={value} value={value}>
                          {algorithmLabels[value]}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {state.algorithm === "rsa" && (
                  <div className="space-y-2">
                    <Label>RSA Modulus Length</Label>
                    <Input
                      type="number"
                      min={1024}
                      max={8192}
                      value={state.rsaBits}
                      onChange={(event) =>
                        setParam(
                          "rsaBits",
                          Math.max(
                            1024,
                            Math.min(8192, Number(event.target.value) || 2048),
                          ),
                          true,
                        )
                      }
                    />
                  </div>
                )}

                <div className="space-y-2">
                  <Label>Comment (Optional)</Label>
                  <Input
                    value={state.comment}
                    onChange={(event) =>
                      setParam("comment", event.target.value)
                    }
                    placeholder="user@host"
                  />
                </div>

                <Button onClick={handleGenerate} disabled={generateLoading}>
                  <RefreshCw className="h-4 w-4" />
                  {generateLoading ? "Generating..." : "Generate Keypair"}
                </Button>
                {generateError && (
                  <p className="text-xs text-destructive">{generateError}</p>
                )}
              </section>

              <section className="flex flex-col gap-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h2 className="text-base font-semibold">Generated Output</h2>
                  <div className="flex items-center gap-2">
                    {generated?.publicOpenSsh && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={handleSavePublicKey}
                      >
                        {copiedKey === "generated-public" ? (
                          <>
                            <Check className="h-4 w-4" />
                            Saved
                          </>
                        ) : (
                          <>
                            <Copy className="h-4 w-4" />
                            Copy Public Key
                          </>
                        )}
                      </Button>
                    )}
                    {generated && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={handleDownloadAll}
                      >
                        Download Zip
                      </Button>
                    )}
                  </div>
                </div>

                {!generated && (
                  <p className="text-sm text-muted-foreground">
                    Generate a keypair to see OpenSSH, PEM, and JWK outputs.
                  </p>
                )}

                {generated && (
                  <div className="space-y-4">
                    {downloadError && (
                      <p className="text-xs text-destructive">
                        {downloadError}
                      </p>
                    )}
                    <div className="space-y-2">
                      <Label>OpenSSH Public Key</Label>
                      <Textarea
                        readOnly
                        value={generated.publicOpenSsh}
                        className="min-h-[96px]"
                      />
                    </div>

                    <div className="grid gap-4 sm:grid-cols-2">
                      <div className="space-y-1 text-xs text-muted-foreground">
                        <p>Type: {generated.type}</p>
                        <p>Bits: {generated.bits}</p>
                      </div>
                      <div className="space-y-1 text-xs text-muted-foreground">
                        <p>{generated.fingerprintSha256}</p>
                        <p>{generated.fingerprintMd5}</p>
                      </div>
                    </div>

                    {generated.publicPem && (
                      <div className="space-y-2">
                        <Label>Public Key (PEM)</Label>
                        <Textarea
                          readOnly
                          value={generated.publicPem}
                          className="min-h-[120px]"
                        />
                      </div>
                    )}

                    {generated.privatePem && (
                      <div className="space-y-2">
                        <Label>Private Key (PEM)</Label>
                        <Textarea
                          readOnly
                          value={generated.privatePem}
                          className="min-h-[140px]"
                        />
                      </div>
                    )}

                    <div className="space-y-2">
                      <Label>Public JWK</Label>
                      <Textarea
                        readOnly
                        value={generated.publicJwk}
                        className="min-h-[120px]"
                      />
                    </div>

                    {generated.privateJwk && (
                      <div className="space-y-2">
                        <Label>Private JWK</Label>
                        <Textarea
                          readOnly
                          value={generated.privateJwk}
                          className="min-h-[140px]"
                        />
                      </div>
                    )}
                  </div>
                )}
              </section>
            </div>
          </TabsContent>

          <TabsContent value="inspect">
            <div className="grid gap-6 lg:grid-cols-2">
              <section className="flex flex-col gap-4">
                <div className="space-y-2">
                  <Label htmlFor="ssh-input">SSH Key Input</Label>
                  <Textarea
                    id="ssh-input"
                    value={state.input}
                    onChange={(event) => setParam("input", event.target.value)}
                    placeholder="Paste an OpenSSH public key or PEM (SPKI/PKCS8)"
                    className="min-h-[160px]"
                  />
                  {inputWarning && (
                    <p className="text-xs text-muted-foreground">
                      {inputWarning}
                    </p>
                  )}
                </div>
                {inspectError && (
                  <p className="text-xs text-destructive">{inspectError}</p>
                )}
              </section>

              <section className="flex flex-col gap-4">
                <div className="flex items-center justify-between">
                  <h2 className="text-base font-semibold">Key Details</h2>
                </div>
                {inspectLoading && (
                  <p className="text-sm text-muted-foreground">Parsing...</p>
                )}
                {!inspectLoading && !inspectResult && (
                  <p className="text-sm text-muted-foreground">
                    Paste a key to see fingerprints and conversions.
                  </p>
                )}
                {inspectResult && (
                  <div className="space-y-4">
                    <div className="grid gap-4 sm:grid-cols-2">
                      <div className="space-y-1 text-xs text-muted-foreground">
                        <p>Type: {inspectResult.type}</p>
                        <p>Bits: {inspectResult.bits}</p>
                        {inspectResult.comment && (
                          <p>Comment: {inspectResult.comment}</p>
                        )}
                      </div>
                      <div className="space-y-1 text-xs text-muted-foreground">
                        <p>{inspectResult.fingerprintSha256}</p>
                        <p>{inspectResult.fingerprintMd5}</p>
                      </div>
                    </div>

                    <div className="space-y-2">
                      <div className="flex items-center justify-between gap-2">
                        <Label>OpenSSH Public Key</Label>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() =>
                            handleCopy(
                              inspectResult.publicOpenSsh,
                              "inspect-openssh",
                            )
                          }
                        >
                          {copiedKey === "inspect-openssh" ? (
                            <>
                              <Check className="h-4 w-4" />
                              Copied
                            </>
                          ) : (
                            <>
                              <Copy className="h-4 w-4" />
                              Copy
                            </>
                          )}
                        </Button>
                      </div>
                      <Textarea
                        readOnly
                        value={inspectResult.publicOpenSsh}
                        className="min-h-[96px]"
                      />
                    </div>

                    {inspectResult.publicPem && (
                      <div className="space-y-2">
                        <Label>Public Key (PEM)</Label>
                        <Textarea
                          readOnly
                          value={inspectResult.publicPem}
                          className="min-h-[120px]"
                        />
                      </div>
                    )}

                    {inspectResult.note && (
                      <p className="text-xs text-muted-foreground">
                        {inspectResult.note}
                      </p>
                    )}

                    <div className="space-y-2">
                      <Label>Public JWK</Label>
                      <Textarea
                        readOnly
                        value={inspectResult.publicJwk}
                        className="min-h-[120px]"
                      />
                    </div>
                  </div>
                )}
              </section>
            </div>
          </TabsContent>
        </Tabs>
      )}
    </div>
  );
}

function isOpenSshPublicKey(value: string) {
  return value.startsWith("ssh-") || value.startsWith("ecdsa-");
}

async function generateKeyPair(
  algorithm: AlgorithmValue,
  rsaBits: number,
  comment: string,
): Promise<GeneratedKeypair> {
  if (algorithm === "ed25519") {
    try {
      const keyPair = await crypto.subtle.generateKey(
        { name: "Ed25519" },
        true,
        ["sign", "verify"],
      );
      const publicJwk = await crypto.subtle.exportKey("jwk", keyPair.publicKey);
      const privateJwk = await crypto.subtle.exportKey(
        "jwk",
        keyPair.privateKey,
      );
      return await buildGeneratedResult(
        publicJwk,
        privateJwk,
        keyPair,
        comment,
      );
    } catch (error) {
      console.error("WebCrypto Ed25519 generation failed:", error);
      const privateKey = ed25519.utils.randomPrivateKey();
      const publicKey = ed25519.getPublicKey(privateKey);
      const publicJwk: JsonWebKey = {
        kty: "OKP",
        crv: "Ed25519",
        x: base64UrlEncode(publicKey),
        ext: true,
      };
      const privateJwk: JsonWebKey = {
        ...publicJwk,
        d: base64UrlEncode(privateKey),
      };
      return await buildGeneratedResult(publicJwk, privateJwk, null, comment);
    }
  }

  if (algorithm === "rsa") {
    const keyPair = await crypto.subtle.generateKey(
      {
        name: "RSASSA-PKCS1-v1_5",
        modulusLength: rsaBits,
        publicExponent: new Uint8Array([1, 0, 1]),
        hash: "SHA-256",
      },
      true,
      ["sign", "verify"],
    );
    const publicJwk = await crypto.subtle.exportKey("jwk", keyPair.publicKey);
    const privateJwk = await crypto.subtle.exportKey("jwk", keyPair.privateKey);
    return await buildGeneratedResult(publicJwk, privateJwk, keyPair, comment);
  }

  const curve = algorithmToCurve(algorithm);
  const keyPair = await crypto.subtle.generateKey(
    { name: "ECDSA", namedCurve: curve },
    true,
    ["sign", "verify"],
  );
  const publicJwk = await crypto.subtle.exportKey("jwk", keyPair.publicKey);
  const privateJwk = await crypto.subtle.exportKey("jwk", keyPair.privateKey);
  return await buildGeneratedResult(publicJwk, privateJwk, keyPair, comment);
}

async function buildGeneratedResult(
  publicJwk: JsonWebKey,
  privateJwk: JsonWebKey,
  keyPair: CryptoKeyPair | null,
  comment: string,
): Promise<GeneratedKeypair> {
  const encoded = encodeOpenSshPublicKey(publicJwk, comment || undefined);
  if (encoded.error || !encoded.result) {
    throw new Error(encoded.error ?? "Failed to encode OpenSSH key.");
  }

  let publicPem: string | undefined;
  let privatePem: string | undefined;

  if (keyPair) {
    publicPem = toPem(
      await crypto.subtle.exportKey("spki", keyPair.publicKey),
      "PUBLIC KEY",
    );
    privatePem = toPem(
      await crypto.subtle.exportKey("pkcs8", keyPair.privateKey),
      "PRIVATE KEY",
    );
  } else {
    const pemExport = await exportPemFromJwk(publicJwk, privateJwk);
    publicPem = pemExport.publicPem ?? undefined;
    privatePem = pemExport.privatePem ?? undefined;
  }

  return {
    type: encoded.result.type,
    bits: encoded.result.bits,
    publicOpenSsh: encoded.result.openSsh,
    publicPem,
    privatePem,
    publicJwk: JSON.stringify(publicJwk, null, 2),
    privateJwk: JSON.stringify(privateJwk, null, 2),
    fingerprintSha256: encoded.result.fingerprintSha256,
    fingerprintMd5: encoded.result.fingerprintMd5,
  };
}

function algorithmToCurve(value: AlgorithmValue) {
  switch (value) {
    case "ecdsa-p256":
      return "P-256";
    case "ecdsa-p384":
      return "P-384";
    case "ecdsa-p521":
      return "P-521";
    default:
      return "P-256";
  }
}

async function exportPublicPem(jwk: JsonWebKey): Promise<{
  value?: string;
  error?: string;
}> {
  try {
    const algo = algorithmFromJwk(jwk);
    if (!algo) return { error: "Unsupported JWK algorithm." };
    const key = await crypto.subtle.importKey("jwk", jwk, algo, true, [
      "verify",
    ]);
    const spki = await crypto.subtle.exportKey("spki", key);
    return { value: toPem(spki, "PUBLIC KEY") };
  } catch (error) {
    console.error("Failed to export PEM:", error);
    return { error: "PEM export not supported in this environment." };
  }
}

async function exportPemFromJwk(
  publicJwk: JsonWebKey,
  privateJwk: JsonWebKey,
): Promise<{ publicPem?: string; privatePem?: string }> {
  try {
    const algo = algorithmFromJwk(publicJwk);
    if (!algo) return {};
    const publicKey = await crypto.subtle.importKey(
      "jwk",
      publicJwk,
      algo,
      true,
      ["verify"],
    );
    const privateKey = await crypto.subtle.importKey(
      "jwk",
      privateJwk,
      algo,
      true,
      ["sign"],
    );
    const publicPem = toPem(
      await crypto.subtle.exportKey("spki", publicKey),
      "PUBLIC KEY",
    );
    const privatePem = toPem(
      await crypto.subtle.exportKey("pkcs8", privateKey),
      "PRIVATE KEY",
    );
    return { publicPem, privatePem };
  } catch (error) {
    console.error("Failed to export PEM from JWK:", error);
    return {};
  }
}

function algorithmFromJwk(jwk: JsonWebKey): Algorithm | null {
  if (jwk.kty === "RSA") {
    return { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" };
  }
  if (jwk.kty === "EC" && jwk.crv) {
    return { name: "ECDSA", namedCurve: jwk.crv };
  }
  if (jwk.kty === "OKP" && jwk.crv === "Ed25519") {
    return { name: "Ed25519" };
  }
  return null;
}

async function importPemToJwk(pem: string): Promise<{
  result?: { jwk: JsonWebKey; publicPem?: string; note?: string };
  error?: string;
}> {
  const block = extractPemBlock(pem);
  if (!block) return { error: "Invalid PEM block." };
  const label = block.label.toUpperCase();
  if (label === "OPENSSH PRIVATE KEY") {
    return { error: "OpenSSH private keys are not supported yet." };
  }
  if (label !== "PUBLIC KEY" && label !== "PRIVATE KEY") {
    return { error: "Only SPKI/PKCS8 PEM keys are supported." };
  }
  const isPrivate = label === "PRIVATE KEY";
  const format: KeyFormat = isPrivate ? "pkcs8" : "spki";
  let bytes: Uint8Array;
  try {
    bytes = decodeBase64(block.body.replace(/\s+/g, ""));
  } catch (error) {
    console.error("Failed to decode PEM base64:", error);
    return { error: "Invalid PEM base64 payload." };
  }

  const candidates: { algo: Algorithm; usages: KeyUsage[] }[] = [
    {
      algo: { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
      usages: ["verify"],
    },
    { algo: { name: "ECDSA", namedCurve: "P-256" }, usages: ["verify"] },
    { algo: { name: "ECDSA", namedCurve: "P-384" }, usages: ["verify"] },
    { algo: { name: "ECDSA", namedCurve: "P-521" }, usages: ["verify"] },
    { algo: { name: "Ed25519" }, usages: ["verify"] },
  ];

  for (const candidate of candidates) {
    try {
      const key = await crypto.subtle.importKey(
        format,
        bytes,
        candidate.algo,
        true,
        format === "spki" ? candidate.usages : ["sign"],
      );
      const jwk = await crypto.subtle.exportKey("jwk", key);
      const pemExport = await exportPublicPem(jwk);
      const publicPem =
        pemExport.value ?? (format === "spki" ? pem.trim() : undefined);
      const note = isPrivate
        ? "Private key loaded; displaying derived public key."
        : (pemExport.error ?? undefined);
      return { result: { jwk, publicPem, note } };
    } catch (error) {
      console.error("PEM import attempt failed:", error);
    }
  }

  return { error: "Failed to parse PEM key. Unsupported algorithm." };
}

function extractPemBlock(pem: string) {
  const match = pem
    .trim()
    .match(/-----BEGIN ([^-]+)-----([\s\S]+?)-----END \1-----/);
  if (!match) return null;
  return { label: match[1], body: match[2] };
}

function toPem(buffer: ArrayBuffer, label: string) {
  const bytes = new Uint8Array(buffer);
  const base64 = encodeBase64(bytes, { mimeFormat: true });
  return `-----BEGIN ${label}-----\n${base64}\n-----END ${label}-----`;
}

function slugify(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}
