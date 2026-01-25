"use client";

import * as React from "react";
import { Suspense } from "react";
import { z } from "zod";
import { AlertCircle, Check, Copy, Download, RefreshCcw } from "lucide-react";
import {
  Aes128Gcm,
  Aes256Gcm,
  CipherSuite,
  DhkemP256HkdfSha256,
  DhkemP384HkdfSha384,
  DhkemP521HkdfSha512,
  HkdfSha256,
  HkdfSha384,
  HkdfSha512,
} from "@hpke/core";
import {
  ToolPageWrapper,
  useToolHistoryContext,
} from "@/components/tool-ui/tool-page-wrapper";
import {
  DEFAULT_URL_SYNC_DEBOUNCE_MS,
  useUrlSyncedState,
} from "@/lib/url-state/use-url-synced-state";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { decodeBase64, encodeBase64 } from "@/lib/encoding/base64";
import { decodeHex, encodeHex } from "@/lib/encoding/hex";
import type { HistoryEntry } from "@/lib/history/db";
import { cn } from "@/lib/utils";

const standardValues = ["CMS", "OpenPGP", "JWE", "HPKE"] as const;
const modeValues = ["encrypt", "decrypt"] as const;
const cmsOutputFormats = ["pem", "base64"] as const;
const jweKeyAlgs = ["dir", "RSA-OAEP-256"] as const;
const keyEncodings = ["base64", "base64url", "hex"] as const;
const hpkeKems = ["P-256", "P-384", "P-521"] as const;
const hpkeKdfs = ["HKDF-SHA256", "HKDF-SHA384", "HKDF-SHA512"] as const;
const hpkeAeads = ["AES-128-GCM", "AES-256-GCM"] as const;
const hpkeEncodings = ["base64", "base64url", "hex"] as const;

type StandardValue = (typeof standardValues)[number];
type ModeValue = (typeof modeValues)[number];
type CmsOutputFormat = (typeof cmsOutputFormats)[number];
type JweKeyAlg = (typeof jweKeyAlgs)[number];
type KeyEncoding = (typeof keyEncodings)[number];
type HpkeKem = (typeof hpkeKems)[number];
type HpkeKdf = (typeof hpkeKdfs)[number];
type HpkeAead = (typeof hpkeAeads)[number];
type HpkeEncoding = (typeof hpkeEncodings)[number];

const paramsSchema = z.object({
  standard: z.enum(standardValues).default("CMS"),
  mode: z.enum(modeValues).default("encrypt"),
  input: z.string().default(""),
  cmsRecipientCert: z.string().default(""),
  cmsRecipientKey: z.string().default(""),
  cmsOutputFormat: z.enum(cmsOutputFormats).default("pem"),
  pgpPublicKey: z.string().default(""),
  pgpPrivateKey: z.string().default(""),
  pgpPassphrase: z.string().default(""),
  jweAlg: z.enum(jweKeyAlgs).default("dir"),
  jweKey: z.string().default(""),
  jweKeyEncoding: z.enum(keyEncodings).default("base64"),
  jwePublicKey: z.string().default(""),
  jwePrivateKey: z.string().default(""),
  hpkeKem: z.enum(hpkeKems).default("P-256"),
  hpkeKdf: z.enum(hpkeKdfs).default("HKDF-SHA256"),
  hpkeAead: z.enum(hpkeAeads).default("AES-128-GCM"),
  hpkePublicKey: z.string().default(""),
  hpkePrivateKey: z.string().default(""),
  hpkeEnc: z.string().default(""),
  hpkeOutputEncoding: z.enum(hpkeEncodings).default("base64"),
});

type HybridState = z.infer<typeof paramsSchema>;

const encodingLabels = {
  base64: "Base64",
  base64url: "Base64url",
  hex: "Hex",
} as const;

const textEncoder = new TextEncoder();
const textDecoder = new TextDecoder();

const hpkeKemMap: Record<
  HpkeKem,
  () => DhkemP256HkdfSha256 | DhkemP384HkdfSha384 | DhkemP521HkdfSha512
> = {
  "P-256": () => new DhkemP256HkdfSha256(),
  "P-384": () => new DhkemP384HkdfSha384(),
  "P-521": () => new DhkemP521HkdfSha512(),
};

const hpkeKdfMap: Record<HpkeKdf, () => HkdfSha256 | HkdfSha384 | HkdfSha512> =
  {
    "HKDF-SHA256": () => new HkdfSha256(),
    "HKDF-SHA384": () => new HkdfSha384(),
    "HKDF-SHA512": () => new HkdfSha512(),
  };

const hpkeAeadMap: Record<HpkeAead, () => Aes128Gcm | Aes256Gcm> = {
  "AES-128-GCM": () => new Aes128Gcm(),
  "AES-256-GCM": () => new Aes256Gcm(),
};

function randomBytes(length: number) {
  if (!globalThis.crypto?.getRandomValues) {
    throw new Error("Secure random generation is unavailable.");
  }
  const bytes = new Uint8Array(length);
  crypto.getRandomValues(bytes);
  return bytes;
}

function encodeKeyBytes(bytes: Uint8Array, encoding: KeyEncoding) {
  if (encoding === "hex") return encodeHex(bytes, { upperCase: false });
  if (encoding === "base64url")
    return encodeBase64(bytes, { urlSafe: true, padding: false });
  return encodeBase64(bytes, { urlSafe: false, padding: true });
}

function decodeKeyBytes(value: string, encoding: KeyEncoding) {
  if (!value) return new Uint8Array();
  if (encoding === "hex") return decodeHex(value);
  return decodeBase64(value);
}

function encodeOutputBytes(bytes: Uint8Array, encoding: HpkeEncoding) {
  if (encoding === "hex") return encodeHex(bytes, { upperCase: false });
  if (encoding === "base64url")
    return encodeBase64(bytes, { urlSafe: true, padding: false });
  return encodeBase64(bytes, { urlSafe: false, padding: true });
}

function decodeOutputBytes(value: string, encoding: HpkeEncoding) {
  if (!value) return new Uint8Array();
  if (encoding === "hex") return decodeHex(value);
  return decodeBase64(value);
}

function toPem(buffer: ArrayBuffer, label: "PUBLIC KEY" | "PRIVATE KEY") {
  const bytes = new Uint8Array(buffer);
  let binary = "";
  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }
  const base64 = btoa(binary).replace(/(.{64})/g, "$1\n");
  return `-----BEGIN ${label}-----\n${base64}\n-----END ${label}-----`;
}

function isKeyPair(key: CryptoKey | CryptoKeyPair): key is CryptoKeyPair {
  return "publicKey" in key && "privateKey" in key;
}

function parseJwk(text: string) {
  const trimmed = text.trim();
  if (!trimmed.startsWith("{")) return null;
  try {
    const jwk = JSON.parse(trimmed);
    if (jwk && typeof jwk === "object" && "kty" in jwk) {
      return jwk as JsonWebKey;
    }
  } catch {
    return null;
  }
  return null;
}

function createHpkeSuite(state: HybridState) {
  return new CipherSuite({
    kem: hpkeKemMap[state.hpkeKem](),
    kdf: hpkeKdfMap[state.hpkeKdf](),
    aead: hpkeAeadMap[state.hpkeAead](),
  });
}

async function importHpkeKey(
  keyText: string,
  type: "public" | "private",
  kem: HpkeKem,
) {
  if (!globalThis.crypto?.subtle) {
    throw new Error("Web Crypto is unavailable in this environment.");
  }
  const jwk = parseJwk(keyText);
  if (!jwk || jwk.kty !== "EC" || jwk.crv !== kem) {
    throw new Error(`HPKE key must be an EC JWK with ${kem}.`);
  }
  const algorithm = { name: "ECDH", namedCurve: kem };
  const usages: KeyUsage[] = type === "private" ? ["deriveBits"] : [];
  return crypto.subtle.importKey("jwk", jwk, algorithm, true, usages);
}

async function generateHpkeKeypair(state: HybridState) {
  if (!globalThis.crypto?.subtle) {
    throw new Error("Web Crypto is unavailable in this environment.");
  }
  const suite = createHpkeSuite(state);
  const keyPair = await suite.kem.generateKeyPair();
  const publicJwk = await crypto.subtle.exportKey("jwk", keyPair.publicKey);
  const privateJwk = await crypto.subtle.exportKey("jwk", keyPair.privateKey);
  return {
    publicJwk: JSON.stringify(publicJwk, null, 2),
    privateJwk: JSON.stringify(privateJwk, null, 2),
  };
}

function isPemBlock(value: string) {
  return value.trim().startsWith("-----BEGIN");
}

function ScrollableTabsList({ children }: { children: React.ReactNode }) {
  return (
    <div className="w-full min-w-0">
      <TabsList className="inline-flex h-auto max-w-full flex-wrap items-center justify-start gap-1 [&_[data-slot=tabs-trigger]]:flex-none [&_[data-slot=tabs-trigger]]:!text-sm [&_[data-slot=tabs-trigger][data-state=active]]:border-border">
        {children}
      </TabsList>
    </div>
  );
}

function InlineTabsList({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <TabsList
      className={cn(
        "inline-flex h-7 flex-nowrap items-center gap-1 [&_[data-slot=tabs-trigger]]:flex-none [&_[data-slot=tabs-trigger]]:!text-xs [&_[data-slot=tabs-trigger][data-state=active]]:border-border",
        className,
      )}
    >
      {children}
    </TabsList>
  );
}

export default function HybridEncryptionPage() {
  return (
    <Suspense fallback={null}>
      <HybridEncryptionContent />
    </Suspense>
  );
}

function HybridEncryptionContent() {
  const {
    state,
    setParam,
    oversizeKeys,
    hasUrlParams,
    hydrationSource,
    resetToDefaults,
  } = useUrlSyncedState("hybrid-encryption", {
    schema: paramsSchema,
    defaults: paramsSchema.parse({}),
  });

  const handleLoadHistory = React.useCallback(
    (entry: HistoryEntry) => {
      const { inputs, params } = entry;
      if (inputs.input !== undefined) setParam("input", inputs.input);
      const typedParams = params as Partial<HybridState>;
      (Object.keys(paramsSchema.shape) as (keyof HybridState)[]).forEach(
        (key) => {
          if (typedParams[key] !== undefined) {
            setParam(key, typedParams[key] as HybridState[typeof key]);
          }
        },
      );
    },
    [setParam],
  );

  return (
    <ToolPageWrapper
      toolId="hybrid-encryption"
      title="Hybrid Encryption"
      description="Encrypt or decrypt data using CMS, OpenPGP, JWE, or HPKE with modern key handling and clear outputs."
      onLoadHistory={handleLoadHistory}
    >
      <HybridEncryptionInner
        state={state}
        setParam={setParam}
        oversizeKeys={oversizeKeys}
        hasUrlParams={hasUrlParams}
        hydrationSource={hydrationSource}
        resetToDefaults={resetToDefaults}
      />
    </ToolPageWrapper>
  );
}

function HybridEncryptionInner({
  state,
  setParam,
  oversizeKeys,
  hasUrlParams,
  hydrationSource,
  resetToDefaults,
}: {
  state: HybridState;
  setParam: <K extends keyof HybridState>(
    key: K,
    value: HybridState[K],
    immediate?: boolean,
  ) => void;
  oversizeKeys: (keyof HybridState)[];
  hasUrlParams: boolean;
  hydrationSource: "default" | "url" | "history";
  resetToDefaults: () => void;
}) {
  const { upsertInputEntry, upsertParams } = useToolHistoryContext();
  const [output, setOutput] = React.useState("");
  const [hpkeEncOutput, setHpkeEncOutput] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);
  const [isWorking, setIsWorking] = React.useState(false);
  const [copied, setCopied] = React.useState<"output" | "hpkeEnc" | null>(null);
  const [isGeneratingCms, setIsGeneratingCms] = React.useState(false);
  const [isGeneratingPgp, setIsGeneratingPgp] = React.useState(false);
  const [isGeneratingJwe, setIsGeneratingJwe] = React.useState(false);
  const [isGeneratingHpke, setIsGeneratingHpke] = React.useState(false);
  const lastInputRef = React.useRef("");
  const hasHydratedInputRef = React.useRef(false);
  const hasHandledUrlRef = React.useRef(false);
  const paramsRef = React.useRef<Record<string, unknown>>({});
  const hasInitializedParamsRef = React.useRef(false);
  const runRef = React.useRef(0);

  const isEncrypt = state.mode === "encrypt";
  const isCms = state.standard === "CMS";
  const isOpenPgp = state.standard === "OpenPGP";
  const isJwe = state.standard === "JWE";
  const isHpke = state.standard === "HPKE";

  const paramsSnapshot = React.useCallback(
    () => ({
      standard: state.standard,
      mode: state.mode,
      cmsRecipientCert: state.cmsRecipientCert,
      cmsRecipientKey: state.cmsRecipientKey,
      cmsOutputFormat: state.cmsOutputFormat,
      pgpPublicKey: state.pgpPublicKey,
      pgpPrivateKey: state.pgpPrivateKey,
      pgpPassphrase: state.pgpPassphrase,
      jweAlg: state.jweAlg,
      jweKey: state.jweKey,
      jweKeyEncoding: state.jweKeyEncoding,
      jwePublicKey: state.jwePublicKey,
      jwePrivateKey: state.jwePrivateKey,
      hpkeKem: state.hpkeKem,
      hpkeKdf: state.hpkeKdf,
      hpkeAead: state.hpkeAead,
      hpkePublicKey: state.hpkePublicKey,
      hpkePrivateKey: state.hpkePrivateKey,
      hpkeEnc: state.hpkeEnc,
      hpkeOutputEncoding: state.hpkeOutputEncoding,
    }),
    [state],
  );

  React.useEffect(() => {
    const nextParams = paramsSnapshot();
    if (!hasInitializedParamsRef.current) {
      hasInitializedParamsRef.current = true;
      paramsRef.current = nextParams;
      return;
    }
    const keys = Object.keys(nextParams) as (keyof typeof nextParams)[];
    const prev = paramsRef.current as typeof nextParams;
    const same = keys.every((key) => prev[key] === nextParams[key]);
    if (same) return;
    paramsRef.current = nextParams;
    upsertParams(nextParams, "deferred");
  }, [paramsSnapshot, upsertParams]);

  React.useEffect(() => {
    if (hasUrlParams && !hasHandledUrlRef.current) {
      hasHandledUrlRef.current = true;
      upsertParams(paramsSnapshot(), "deferred");
    }
  }, [hasUrlParams, paramsSnapshot, upsertParams]);

  React.useEffect(() => {
    if (hasHydratedInputRef.current) return;
    if (hydrationSource === "default") return;
    lastInputRef.current = state.input;
    hasHydratedInputRef.current = true;
  }, [hydrationSource, state.input]);

  React.useEffect(() => {
    const signature = state.input;
    if (!signature.trim() || signature === lastInputRef.current) return;

    const timer = setTimeout(() => {
      lastInputRef.current = signature;
      const preview =
        signature.slice(0, 100) || `${state.standard} ${state.mode}`;
      upsertInputEntry(
        { input: state.input },
        paramsSnapshot(),
        "left",
        preview,
      );
    }, DEFAULT_URL_SYNC_DEBOUNCE_MS);

    return () => clearTimeout(timer);
  }, [
    state.input,
    state.standard,
    state.mode,
    upsertInputEntry,
    paramsSnapshot,
  ]);

  React.useEffect(() => {
    if (!state.input.trim()) {
      setOutput("");
      setHpkeEncOutput("");
      setError(null);
      setIsWorking(false);
      return;
    }

    const runId = ++runRef.current;
    setIsWorking(true);
    setError(null);

    const run = async () => {
      try {
        let nextOutput = "";
        let nextHpkeEnc = "";

        if (isCms) {
          const forgeModule = await import("node-forge");
          const forge = forgeModule.default ?? forgeModule;
          if (isEncrypt) {
            if (!state.cmsRecipientCert.trim()) {
              throw new Error(
                "Recipient certificate is required for CMS encryption.",
              );
            }
            const cert = forge.pki.certificateFromPem(state.cmsRecipientCert);
            const p7 = forge.pkcs7.createEnvelopedData();
            p7.addRecipient(cert);
            p7.content = forge.util.createBuffer(state.input, "utf8");
            p7.encrypt();
            const pem = forge.pkcs7.messageToPem(p7);
            if (state.cmsOutputFormat === "pem") {
              nextOutput = pem;
            } else {
              const der = forge.asn1.toDer(p7.toAsn1()).getBytes();
              nextOutput = forge.util.encode64(der);
            }
          } else {
            if (!state.cmsRecipientKey.trim()) {
              throw new Error(
                "Recipient private key is required for CMS decryption.",
              );
            }
            const privateKey = forge.pki.privateKeyFromPem(
              state.cmsRecipientKey,
            );
            const input = state.input.trim();
            const message = isPemBlock(input)
              ? forge.pkcs7.messageFromPem(input)
              : forge.pkcs7.messageFromAsn1(
                  forge.asn1.fromDer(forge.util.decode64(input)),
                );
            message.decrypt(message.recipients[0], privateKey);
            nextOutput = message.content?.data ?? "";
          }
        } else if (isOpenPgp) {
          const openpgp = await import("openpgp");
          if (isEncrypt) {
            if (!state.pgpPublicKey.trim()) {
              throw new Error("Public key is required for OpenPGP encryption.");
            }
            const publicKey = await openpgp.readKey({
              armoredKey: state.pgpPublicKey,
            });
            const message = await openpgp.createMessage({ text: state.input });
            nextOutput = await openpgp.encrypt({
              message,
              encryptionKeys: publicKey,
              format: "armored",
            });
          } else {
            if (!state.pgpPrivateKey.trim()) {
              throw new Error(
                "Private key is required for OpenPGP decryption.",
              );
            }
            const message = await openpgp.readMessage({
              armoredMessage: state.input,
            });
            const privateKey = await openpgp.readPrivateKey({
              armoredKey: state.pgpPrivateKey,
            });
            const decryptionKey = state.pgpPassphrase
              ? await openpgp.decryptKey({
                  privateKey,
                  passphrase: state.pgpPassphrase,
                })
              : privateKey;
            const { data } = await openpgp.decrypt({
              message,
              decryptionKeys: decryptionKey,
              format: "utf8",
            });
            nextOutput = String(data);
          }
        } else if (isJwe) {
          const jose = await import("jose");
          if (state.jweAlg === "dir") {
            const keyBytes = decodeKeyBytes(state.jweKey, state.jweKeyEncoding);
            if (keyBytes.length !== 32) {
              throw new Error(
                "Direct JWE key must be 32 bytes (256 bits) for A256GCM.",
              );
            }
            if (isEncrypt) {
              nextOutput = await new jose.CompactEncrypt(
                textEncoder.encode(state.input),
              )
                .setProtectedHeader({ alg: "dir", enc: "A256GCM" })
                .encrypt(keyBytes);
            } else {
              const { plaintext } = await jose.compactDecrypt(
                state.input,
                keyBytes,
              );
              nextOutput = textDecoder.decode(plaintext);
            }
          } else {
            if (isEncrypt && !state.jwePublicKey.trim()) {
              throw new Error("Public key is required for JWE RSA encryption.");
            }
            if (!isEncrypt && !state.jwePrivateKey.trim()) {
              throw new Error(
                "Private key is required for JWE RSA decryption.",
              );
            }
            const keyText = isEncrypt
              ? state.jwePublicKey
              : state.jwePrivateKey;
            const jwk = parseJwk(keyText);
            const key = jwk
              ? await jose.importJWK(jwk, "RSA-OAEP-256")
              : isEncrypt
                ? await jose.importSPKI(keyText, "RSA-OAEP-256")
                : await jose.importPKCS8(keyText, "RSA-OAEP-256");
            if (isEncrypt) {
              nextOutput = await new jose.CompactEncrypt(
                textEncoder.encode(state.input),
              )
                .setProtectedHeader({ alg: "RSA-OAEP-256", enc: "A256GCM" })
                .encrypt(key);
            } else {
              const { plaintext } = await jose.compactDecrypt(state.input, key);
              nextOutput = textDecoder.decode(plaintext);
            }
          }
        } else if (isHpke) {
          if (!globalThis.crypto?.subtle) {
            throw new Error("Web Crypto is unavailable in this environment.");
          }
          const suite = createHpkeSuite(state);
          if (isEncrypt) {
            if (!state.hpkePublicKey.trim()) {
              throw new Error(
                "Recipient public key is required for HPKE encryption.",
              );
            }
            const recipientPublicKey = await importHpkeKey(
              state.hpkePublicKey,
              "public",
              state.hpkeKem,
            );
            const sender = await suite.createSenderContext({
              recipientPublicKey,
            });
            const ciphertext = await sender.seal(
              textEncoder.encode(state.input).buffer,
            );
            const enc =
              sender.enc instanceof Uint8Array
                ? sender.enc
                : new Uint8Array(sender.enc);
            nextOutput = encodeOutputBytes(
              ciphertext instanceof Uint8Array
                ? ciphertext
                : new Uint8Array(ciphertext),
              state.hpkeOutputEncoding,
            );
            nextHpkeEnc = encodeOutputBytes(enc, state.hpkeOutputEncoding);
          } else {
            if (!state.hpkePrivateKey.trim()) {
              throw new Error(
                "Recipient private key is required for HPKE decryption.",
              );
            }
            if (!state.hpkeEnc.trim()) {
              throw new Error(
                "Encapsulated key (enc) is required for HPKE decryption.",
              );
            }
            const recipientKey = await importHpkeKey(
              state.hpkePrivateKey,
              "private",
              state.hpkeKem,
            );
            const enc = decodeOutputBytes(
              state.hpkeEnc,
              state.hpkeOutputEncoding,
            ).buffer;
            const ciphertext = decodeOutputBytes(
              state.input,
              state.hpkeOutputEncoding,
            ).buffer;
            const recipient = await suite.createRecipientContext({
              recipientKey,
              enc,
            });
            const plaintext = await recipient.open(ciphertext);
            nextOutput = textDecoder.decode(
              plaintext instanceof Uint8Array
                ? plaintext
                : new Uint8Array(plaintext),
            );
          }
        }

        if (runRef.current !== runId) return;
        setOutput(nextOutput);
        setHpkeEncOutput(nextHpkeEnc);
        setError(null);
      } catch (err) {
        if (runRef.current !== runId) return;
        setError(
          err instanceof Error
            ? err.message
            : "Failed to process hybrid encryption.",
        );
        setOutput("");
        setHpkeEncOutput("");
      } finally {
        if (runRef.current === runId) {
          setIsWorking(false);
        }
      }
    };

    run();
  }, [
    isCms,
    isOpenPgp,
    isJwe,
    isHpke,
    isEncrypt,
    state.input,
    state.cmsRecipientCert,
    state.cmsRecipientKey,
    state.cmsOutputFormat,
    state.pgpPublicKey,
    state.pgpPrivateKey,
    state.pgpPassphrase,
    state.jweAlg,
    state.jweKey,
    state.jweKeyEncoding,
    state.jwePublicKey,
    state.jwePrivateKey,
    state.hpkeKem,
    state.hpkeKdf,
    state.hpkeAead,
    state.hpkePublicKey,
    state.hpkePrivateKey,
    state.hpkeEnc,
    state.hpkeOutputEncoding,
  ]);

  const handleCopy = async (value: string, target: "output" | "hpkeEnc") => {
    if (!value) return;
    await navigator.clipboard.writeText(value);
    setCopied(target);
    setTimeout(() => setCopied(null), 2000);
  };

  const handleDownload = (value: string, name: string) => {
    if (!value) return;
    const blob = new Blob([value], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = name;
    link.click();
    URL.revokeObjectURL(url);
  };

  const handleGenerateJweKey = () => {
    const bytes = randomBytes(32);
    setParam("jweKey", encodeKeyBytes(bytes, state.jweKeyEncoding));
  };

  const handleGenerateJweKeypair = async () => {
    try {
      if (!globalThis.crypto?.subtle) {
        throw new Error("Web Crypto is unavailable in this environment.");
      }
      setIsGeneratingJwe(true);
      setError(null);
      const keyPair = await crypto.subtle.generateKey(
        {
          name: "RSA-OAEP",
          modulusLength: 2048,
          publicExponent: new Uint8Array([1, 0, 1]),
          hash: "SHA-256",
        },
        true,
        ["encrypt", "decrypt"],
      );
      if (!isKeyPair(keyPair)) {
        throw new Error("Keypair generation failed.");
      }
      const publicKey = await crypto.subtle.exportKey(
        "spki",
        keyPair.publicKey,
      );
      const privateKey = await crypto.subtle.exportKey(
        "pkcs8",
        keyPair.privateKey,
      );
      setParam("jwePublicKey", toPem(publicKey, "PUBLIC KEY"));
      setParam("jwePrivateKey", toPem(privateKey, "PRIVATE KEY"));
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to generate JWE keypair.",
      );
    } finally {
      setIsGeneratingJwe(false);
    }
  };

  const handleGenerateCmsCertificate = async () => {
    try {
      setIsGeneratingCms(true);
      setError(null);
      const forgeModule = await import("node-forge");
      const forge = forgeModule.default ?? forgeModule;
      const keypair = await new Promise<{
        publicKey: unknown;
        privateKey: unknown;
      }>((resolve, reject) => {
        forge.pki.rsa.generateKeyPair(
          { bits: 2048, e: 0x10001 },
          (
            err: unknown,
            keys: { publicKey: unknown; privateKey: unknown } | null,
          ) => {
            if (err || !keys) {
              reject(err ?? new Error("Certificate generation failed."));
              return;
            }
            resolve(keys);
          },
        );
      });
      const cert = forge.pki.createCertificate();
      cert.publicKey = keypair.publicKey;
      cert.serialNumber = String(Math.floor(Math.random() * 1e12));
      cert.validity.notBefore = new Date();
      cert.validity.notAfter = new Date();
      cert.validity.notAfter.setFullYear(
        cert.validity.notBefore.getFullYear() + 1,
      );
      const attrs = [{ name: "commonName", value: "Hybrid Encryption" }];
      cert.setSubject(attrs);
      cert.setIssuer(attrs);
      cert.sign(keypair.privateKey, forge.md.sha256.create());
      setParam("cmsRecipientCert", forge.pki.certificateToPem(cert));
      setParam(
        "cmsRecipientKey",
        forge.pki.privateKeyToPem(keypair.privateKey),
      );
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to generate certificate.",
      );
    } finally {
      setIsGeneratingCms(false);
    }
  };

  const handleGeneratePgpKeypair = async () => {
    try {
      setIsGeneratingPgp(true);
      setError(null);
      const openpgp = await import("openpgp");
      const { privateKey, publicKey } = await openpgp.generateKey({
        type: "rsa",
        rsaBits: 2048,
        userIDs: [{ name: "Hybrid Encryption", email: "user@example.com" }],
        passphrase: state.pgpPassphrase || undefined,
        format: "armored",
      });
      setParam("pgpPublicKey", publicKey);
      setParam("pgpPrivateKey", privateKey);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Failed to generate OpenPGP keypair.",
      );
    } finally {
      setIsGeneratingPgp(false);
    }
  };

  const handleGenerateHpkeKeypair = async () => {
    try {
      setIsGeneratingHpke(true);
      const { publicJwk, privateJwk } = await generateHpkeKeypair(state);
      setParam("hpkePublicKey", publicJwk);
      setParam("hpkePrivateKey", privateJwk);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to generate HPKE keypair.",
      );
    } finally {
      setIsGeneratingHpke(false);
    }
  };

  const handleClearAll = React.useCallback(() => {
    runRef.current += 1;
    resetToDefaults();
    setOutput("");
    setHpkeEncOutput("");
    setError(null);
    setIsWorking(false);
    setCopied(null);
  }, [resetToDefaults]);

  const inputLabel = isEncrypt ? "Plaintext" : "Ciphertext";
  const outputLabel = isEncrypt ? "Ciphertext" : "Plaintext";
  const inputPlaceholder = isEncrypt
    ? "Enter text to encrypt..."
    : "Paste ciphertext to decrypt...";

  return (
    <div className="flex w-full flex-col gap-4 py-4 sm:gap-6 sm:py-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-base font-semibold">Hybrid Encryption</h2>
        <Button
          variant="ghost"
          size="sm"
          onClick={handleClearAll}
          className="h-8 px-3 text-sm"
        >
          Clear
        </Button>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1.05fr_1fr]">
        <div className="flex flex-col gap-4">
          <div className="flex items-center gap-3">
            <Label className="w-24 text-sm sm:w-32">Standard</Label>
            <Tabs
              value={state.standard}
              onValueChange={(value) =>
                setParam("standard", value as StandardValue, true)
              }
              className="min-w-0 flex-1"
            >
              <ScrollableTabsList>
                {standardValues.map((value) => (
                  <TabsTrigger
                    key={value}
                    value={value}
                    className="text-xs flex-none"
                  >
                    {value}
                  </TabsTrigger>
                ))}
              </ScrollableTabsList>
            </Tabs>
          </div>

          <div className="flex items-center gap-3">
            <Label className="w-24 text-sm sm:w-32">Mode</Label>
            <Tabs
              value={state.mode}
              onValueChange={(value) =>
                setParam("mode", value as ModeValue, true)
              }
            >
              <ScrollableTabsList>
                {modeValues.map((value) => (
                  <TabsTrigger
                    key={value}
                    value={value}
                    className="text-xs flex-none"
                  >
                    {value === "encrypt" ? "Encrypt" : "Decrypt"}
                  </TabsTrigger>
                ))}
              </ScrollableTabsList>
            </Tabs>
          </div>

          {isCms && (
            <div className="space-y-3">
              {isEncrypt && (
                <div className="flex items-center gap-3">
                  <Label className="w-24 text-sm sm:w-32">Output</Label>
                  <Tabs
                    value={state.cmsOutputFormat}
                    onValueChange={(value) =>
                      setParam(
                        "cmsOutputFormat",
                        value as CmsOutputFormat,
                        true,
                      )
                    }
                    className="min-w-0 flex-1"
                  >
                    <ScrollableTabsList>
                      <TabsTrigger value="pem" className="text-xs flex-none">
                        PEM
                      </TabsTrigger>
                      <TabsTrigger value="base64" className="text-xs flex-none">
                        Base64 DER
                      </TabsTrigger>
                    </ScrollableTabsList>
                  </Tabs>
                </div>
              )}
              {isEncrypt ? (
                <div className="flex items-start gap-3">
                  <Label className="w-24 text-sm sm:w-32 pt-2">
                    Recipient Cert
                  </Label>
                  <div className="min-w-0 flex-1">
                    <Textarea
                      value={state.cmsRecipientCert}
                      onChange={(event) =>
                        setParam("cmsRecipientCert", event.target.value)
                      }
                      placeholder="-----BEGIN CERTIFICATE-----"
                      className={cn(
                        "min-h-[140px] max-h-[220px] overflow-auto break-all font-mono text-xs",
                        oversizeKeys.includes("cmsRecipientCert") &&
                          "border-destructive",
                      )}
                    />
                    <div className="mt-2 flex items-center justify-between gap-2">
                      <p className="text-xs text-muted-foreground">
                        Self-signed certificate.
                      </p>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={handleGenerateCmsCertificate}
                        className="h-7 gap-1 px-2 text-xs"
                        disabled={isGeneratingCms}
                      >
                        <RefreshCcw className="h-3 w-3" />
                        {isGeneratingCms ? "Generating..." : "Generate"}
                      </Button>
                    </div>
                    {oversizeKeys.includes("cmsRecipientCert") && (
                      <p className="text-xs text-muted-foreground">
                        Certificate exceeds 2 KB and is not synced to the URL.
                      </p>
                    )}
                  </div>
                </div>
              ) : (
                <div className="flex items-start gap-3">
                  <Label className="w-24 text-sm sm:w-32 pt-2">
                    Private Key
                  </Label>
                  <div className="min-w-0 flex-1">
                    <Textarea
                      value={state.cmsRecipientKey}
                      onChange={(event) =>
                        setParam("cmsRecipientKey", event.target.value)
                      }
                      placeholder="-----BEGIN PRIVATE KEY-----"
                      className={cn(
                        "min-h-[140px] max-h-[220px] overflow-auto break-all font-mono text-xs",
                        oversizeKeys.includes("cmsRecipientKey") &&
                          "border-destructive",
                      )}
                    />
                    <div className="mt-2 flex items-center justify-between gap-2">
                      <p className="text-xs text-muted-foreground">
                        Includes matching certificate.
                      </p>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={handleGenerateCmsCertificate}
                        className="h-7 gap-1 px-2 text-xs"
                        disabled={isGeneratingCms}
                      >
                        <RefreshCcw className="h-3 w-3" />
                        {isGeneratingCms ? "Generating..." : "Generate"}
                      </Button>
                    </div>
                    {oversizeKeys.includes("cmsRecipientKey") && (
                      <p className="text-xs text-muted-foreground">
                        Private key exceeds 2 KB and is not synced to the URL.
                      </p>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}

          {isOpenPgp && (
            <div className="space-y-3">
              {isEncrypt ? (
                <div className="flex items-start gap-3">
                  <Label className="w-24 text-sm sm:w-32 pt-2">
                    Public Key
                  </Label>
                  <div className="min-w-0 flex-1">
                    <Textarea
                      value={state.pgpPublicKey}
                      onChange={(event) =>
                        setParam("pgpPublicKey", event.target.value)
                      }
                      placeholder="-----BEGIN PGP PUBLIC KEY BLOCK-----"
                      className={cn(
                        "min-h-[140px] max-h-[220px] overflow-auto break-all font-mono text-xs",
                        oversizeKeys.includes("pgpPublicKey") &&
                          "border-destructive",
                      )}
                    />
                    <div className="mt-2 flex items-center justify-between gap-2">
                      <p className="text-xs text-muted-foreground">
                        Generates a new public/private keypair.
                      </p>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={handleGeneratePgpKeypair}
                        className="h-7 gap-1 px-2 text-xs"
                        disabled={isGeneratingPgp}
                      >
                        <RefreshCcw className="h-3 w-3" />
                        {isGeneratingPgp ? "Generating..." : "Generate"}
                      </Button>
                    </div>
                    {oversizeKeys.includes("pgpPublicKey") && (
                      <p className="text-xs text-muted-foreground">
                        Public key exceeds 2 KB and is not synced to the URL.
                      </p>
                    )}
                  </div>
                </div>
              ) : (
                <div className="space-y-3">
                  <div className="flex items-start gap-3">
                    <Label className="w-24 text-sm sm:w-32 pt-2">
                      Private Key
                    </Label>
                    <div className="min-w-0 flex-1">
                      <Textarea
                        value={state.pgpPrivateKey}
                        onChange={(event) =>
                          setParam("pgpPrivateKey", event.target.value)
                        }
                        placeholder="-----BEGIN PGP PRIVATE KEY BLOCK-----"
                        className={cn(
                          "min-h-[140px] max-h-[220px] overflow-auto break-all font-mono text-xs",
                          oversizeKeys.includes("pgpPrivateKey") &&
                            "border-destructive",
                        )}
                      />
                      <div className="mt-2 flex items-center justify-between gap-2">
                        <p className="text-xs text-muted-foreground">
                          Generates a new public/private keypair.
                        </p>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={handleGeneratePgpKeypair}
                          className="h-7 gap-1 px-2 text-xs"
                          disabled={isGeneratingPgp}
                        >
                          <RefreshCcw className="h-3 w-3" />
                          {isGeneratingPgp ? "Generating..." : "Generate"}
                        </Button>
                      </div>
                      {oversizeKeys.includes("pgpPrivateKey") && (
                        <p className="text-xs text-muted-foreground">
                          Private key exceeds 2 KB and is not synced to the URL.
                        </p>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <Label className="w-24 text-sm sm:w-32">Passphrase</Label>
                    <Input
                      type="password"
                      value={state.pgpPassphrase}
                      onChange={(event) =>
                        setParam("pgpPassphrase", event.target.value)
                      }
                      placeholder="Optional"
                      className="min-w-0 flex-1"
                    />
                  </div>
                </div>
              )}
            </div>
          )}

          {isJwe && (
            <div className="space-y-3">
              <div className="flex items-center gap-3">
                <Label className="w-24 text-sm sm:w-32">Key Alg</Label>
                <Tabs
                  value={state.jweAlg}
                  onValueChange={(value) =>
                    setParam("jweAlg", value as JweKeyAlg, true)
                  }
                >
                  <ScrollableTabsList>
                    <TabsTrigger value="dir" className="text-xs flex-none">
                      Direct
                    </TabsTrigger>
                    <TabsTrigger
                      value="RSA-OAEP-256"
                      className="text-xs flex-none"
                    >
                      RSA-OAEP-256
                    </TabsTrigger>
                  </ScrollableTabsList>
                </Tabs>
              </div>
              {state.jweAlg === "dir" ? (
                <div className="flex items-start gap-3">
                  <Label className="w-24 text-sm sm:w-32 pt-2">
                    Shared Key
                  </Label>
                  <div className="min-w-0 flex-1">
                    <Textarea
                      value={state.jweKey}
                      onChange={(event) =>
                        setParam("jweKey", event.target.value)
                      }
                      placeholder="32-byte key in Base64/Base64url/Hex"
                      className={cn(
                        "min-h-[120px] max-h-[180px] overflow-auto break-all font-mono text-xs",
                        oversizeKeys.includes("jweKey") && "border-destructive",
                      )}
                    />
                    <div className="mt-2 flex items-center justify-between gap-2">
                      <Tabs
                        value={state.jweKeyEncoding}
                        onValueChange={(value) =>
                          setParam("jweKeyEncoding", value as KeyEncoding, true)
                        }
                        className="flex-row gap-0"
                      >
                        <InlineTabsList className="h-6 gap-1">
                          {keyEncodings.map((encoding) => (
                            <TabsTrigger
                              key={encoding}
                              value={encoding}
                              className="text-[10px] sm:text-xs px-2"
                            >
                              {encodingLabels[encoding]}
                            </TabsTrigger>
                          ))}
                        </InlineTabsList>
                      </Tabs>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={handleGenerateJweKey}
                        className="h-7 w-7 p-0"
                        aria-label="Generate key"
                      >
                        <RefreshCcw className="h-3 w-3" />
                      </Button>
                    </div>
                    {oversizeKeys.includes("jweKey") && (
                      <p className="text-xs text-muted-foreground">
                        Key exceeds 2 KB and is not synced to the URL.
                      </p>
                    )}
                  </div>
                </div>
              ) : isEncrypt ? (
                <div className="flex items-start gap-3">
                  <Label className="w-24 text-sm sm:w-32 pt-2">
                    Public Key
                  </Label>
                  <div className="min-w-0 flex-1">
                    <Textarea
                      value={state.jwePublicKey}
                      onChange={(event) =>
                        setParam("jwePublicKey", event.target.value)
                      }
                      placeholder="PEM (SPKI) or JWK"
                      className={cn(
                        "min-h-[140px] max-h-[220px] overflow-auto break-all font-mono text-xs",
                        oversizeKeys.includes("jwePublicKey") &&
                          "border-destructive",
                      )}
                    />
                    <div className="mt-2 flex items-center justify-between gap-2">
                      <p className="text-xs text-muted-foreground">
                        Generate a new RSA keypair.
                      </p>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={handleGenerateJweKeypair}
                        className="h-7 gap-1 px-2 text-xs"
                        disabled={isGeneratingJwe}
                      >
                        <RefreshCcw className="h-3 w-3" />
                        {isGeneratingJwe ? "Generating..." : "Generate"}
                      </Button>
                    </div>
                    {oversizeKeys.includes("jwePublicKey") && (
                      <p className="text-xs text-muted-foreground">
                        Public key exceeds 2 KB and is not synced to the URL.
                      </p>
                    )}
                  </div>
                </div>
              ) : (
                <div className="flex items-start gap-3">
                  <Label className="w-24 text-sm sm:w-32 pt-2">
                    Private Key
                  </Label>
                  <div className="min-w-0 flex-1">
                    <Textarea
                      value={state.jwePrivateKey}
                      onChange={(event) =>
                        setParam("jwePrivateKey", event.target.value)
                      }
                      placeholder="PEM (PKCS8) or JWK"
                      className={cn(
                        "min-h-[140px] max-h-[220px] overflow-auto break-all font-mono text-xs",
                        oversizeKeys.includes("jwePrivateKey") &&
                          "border-destructive",
                      )}
                    />
                    <div className="mt-2 flex items-center justify-between gap-2">
                      <p className="text-xs text-muted-foreground">
                        Generate a new RSA keypair.
                      </p>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={handleGenerateJweKeypair}
                        className="h-7 gap-1 px-2 text-xs"
                        disabled={isGeneratingJwe}
                      >
                        <RefreshCcw className="h-3 w-3" />
                        {isGeneratingJwe ? "Generating..." : "Generate"}
                      </Button>
                    </div>
                    {oversizeKeys.includes("jwePrivateKey") && (
                      <p className="text-xs text-muted-foreground">
                        Private key exceeds 2 KB and is not synced to the URL.
                      </p>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}

          {isHpke && (
            <div className="space-y-3">
              <div className="flex items-center gap-3">
                <Label className="w-24 text-sm sm:w-32">KEM</Label>
                <Tabs
                  value={state.hpkeKem}
                  onValueChange={(value) =>
                    setParam("hpkeKem", value as HpkeKem, true)
                  }
                >
                  <ScrollableTabsList>
                    {hpkeKems.map((kem) => (
                      <TabsTrigger
                        key={kem}
                        value={kem}
                        className="text-xs flex-none"
                      >
                        {kem}
                      </TabsTrigger>
                    ))}
                  </ScrollableTabsList>
                </Tabs>
              </div>
              <div className="flex items-center gap-3">
                <Label className="w-24 text-sm sm:w-32">KDF</Label>
                <Tabs
                  value={state.hpkeKdf}
                  onValueChange={(value) =>
                    setParam("hpkeKdf", value as HpkeKdf, true)
                  }
                >
                  <ScrollableTabsList>
                    {hpkeKdfs.map((kdf) => (
                      <TabsTrigger
                        key={kdf}
                        value={kdf}
                        className="text-xs flex-none"
                      >
                        {kdf}
                      </TabsTrigger>
                    ))}
                  </ScrollableTabsList>
                </Tabs>
              </div>
              <div className="flex items-center gap-3">
                <Label className="w-24 text-sm sm:w-32">AEAD</Label>
                <Tabs
                  value={state.hpkeAead}
                  onValueChange={(value) =>
                    setParam("hpkeAead", value as HpkeAead, true)
                  }
                >
                  <ScrollableTabsList>
                    {hpkeAeads.map((aead) => (
                      <TabsTrigger
                        key={aead}
                        value={aead}
                        className="text-xs flex-none"
                      >
                        {aead}
                      </TabsTrigger>
                    ))}
                  </ScrollableTabsList>
                </Tabs>
              </div>
              {isEncrypt ? (
                <div className="flex items-start gap-3">
                  <Label className="w-24 text-sm sm:w-32 pt-2">
                    Public Key
                  </Label>
                  <div className="min-w-0 flex-1">
                    <Textarea
                      value={state.hpkePublicKey}
                      onChange={(event) =>
                        setParam("hpkePublicKey", event.target.value)
                      }
                      placeholder="JWK (EC)"
                      className={cn(
                        "min-h-[140px] max-h-[220px] overflow-auto break-all font-mono text-xs",
                        oversizeKeys.includes("hpkePublicKey") &&
                          "border-destructive",
                      )}
                    />
                    <div className="mt-2 flex items-center justify-between gap-2">
                      <p className="text-xs text-muted-foreground">
                        EC JWK only.
                      </p>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={handleGenerateHpkeKeypair}
                        className="h-7 gap-1 px-2 text-xs"
                        disabled={isGeneratingHpke}
                      >
                        <RefreshCcw className="h-3 w-3" />
                        {isGeneratingHpke ? "Generating..." : "Generate"}
                      </Button>
                    </div>
                    {oversizeKeys.includes("hpkePublicKey") && (
                      <p className="text-xs text-muted-foreground">
                        Public key exceeds 2 KB and is not synced to the URL.
                      </p>
                    )}
                  </div>
                </div>
              ) : (
                <div className="space-y-3">
                  <div className="flex items-start gap-3">
                    <Label className="w-24 text-sm sm:w-32 pt-2">
                      Private Key
                    </Label>
                    <div className="min-w-0 flex-1">
                      <Textarea
                        value={state.hpkePrivateKey}
                        onChange={(event) =>
                          setParam("hpkePrivateKey", event.target.value)
                        }
                        placeholder="JWK (EC)"
                        className={cn(
                          "min-h-[140px] max-h-[220px] overflow-auto break-all font-mono text-xs",
                          oversizeKeys.includes("hpkePrivateKey") &&
                            "border-destructive",
                        )}
                      />
                      <div className="mt-2 flex items-center justify-between gap-2">
                        <p className="text-xs text-muted-foreground">
                          EC JWK only.
                        </p>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={handleGenerateHpkeKeypair}
                          className="h-7 gap-1 px-2 text-xs"
                          disabled={isGeneratingHpke}
                        >
                          <RefreshCcw className="h-3 w-3" />
                          {isGeneratingHpke ? "Generating..." : "Generate"}
                        </Button>
                      </div>
                      {oversizeKeys.includes("hpkePrivateKey") && (
                        <p className="text-xs text-muted-foreground">
                          Private key exceeds 2 KB and is not synced to the URL.
                        </p>
                      )}
                    </div>
                  </div>
                  <div className="flex items-start gap-3">
                    <Label className="w-24 text-sm sm:w-32 pt-2">Enc</Label>
                    <div className="min-w-0 flex-1">
                      <Textarea
                        value={state.hpkeEnc}
                        onChange={(event) =>
                          setParam("hpkeEnc", event.target.value)
                        }
                        placeholder="Encapsulated key (same encoding as ciphertext)"
                        className={cn(
                          "min-h-[80px] max-h-[140px] overflow-auto break-all font-mono text-xs",
                          oversizeKeys.includes("hpkeEnc") &&
                            "border-destructive",
                        )}
                      />
                      {oversizeKeys.includes("hpkeEnc") && (
                        <p className="text-xs text-muted-foreground">
                          Enc exceeds 2 KB and is not synced to the URL.
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        <div className="flex flex-col gap-4">
          <div className="space-y-2">
            <div className="flex items-center gap-3">
              <Label className="text-sm">{inputLabel}</Label>
              {isHpke && (
                <Tabs
                  value={state.hpkeOutputEncoding}
                  onValueChange={(value) =>
                    setParam("hpkeOutputEncoding", value as HpkeEncoding, true)
                  }
                  className="min-w-0 flex-1"
                >
                  <InlineTabsList>
                    {hpkeEncodings.map((encoding) => (
                      <TabsTrigger
                        key={encoding}
                        value={encoding}
                        className="text-xs flex-none"
                      >
                        {encodingLabels[encoding]}
                      </TabsTrigger>
                    ))}
                  </InlineTabsList>
                </Tabs>
              )}
            </div>
            <Textarea
              value={state.input}
              onChange={(event) => setParam("input", event.target.value)}
              placeholder={inputPlaceholder}
              className={cn(
                "min-h-[200px] max-h-[320px] overflow-auto break-all font-mono text-xs",
                oversizeKeys.includes("input") && "border-destructive",
              )}
            />
            {oversizeKeys.includes("input") && (
              <p className="text-xs text-muted-foreground">
                Input exceeds 2 KB and is not synced to the URL.
              </p>
            )}
          </div>

          <div className="space-y-2">
            <div className="flex items-center gap-3">
              <Label className="text-sm">{outputLabel}</Label>
              <div className="flex shrink-0 items-center gap-1">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handleCopy(output, "output")}
                  className="h-7 w-7 p-0"
                  aria-label="Copy output"
                  disabled={!output}
                >
                  {copied === "output" ? (
                    <Check className="h-3 w-3" />
                  ) : (
                    <Copy className="h-3 w-3" />
                  )}
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() =>
                    handleDownload(output, "hybrid-encryption-output.txt")
                  }
                  className="h-7 w-7 p-0"
                  aria-label="Download output"
                  disabled={!output}
                >
                  <Download className="h-3 w-3" />
                </Button>
              </div>
            </div>
            <Textarea
              value={output}
              readOnly
              placeholder={
                isWorking ? "Working..." : "Output will appear here..."
              }
              className="min-h-[200px] max-h-[320px] overflow-auto break-all font-mono text-xs"
            />
          </div>

          {isHpke && isEncrypt && (
            <div className="space-y-2">
              <div className="flex items-center gap-3">
                <Label className="text-sm">Encapsulated Key</Label>
                <div className="flex shrink-0 items-center gap-1">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleCopy(hpkeEncOutput, "hpkeEnc")}
                    className="h-7 w-7 p-0"
                    aria-label="Copy enc"
                    disabled={!hpkeEncOutput}
                  >
                    {copied === "hpkeEnc" ? (
                      <Check className="h-3 w-3" />
                    ) : (
                      <Copy className="h-3 w-3" />
                    )}
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() =>
                      handleDownload(hpkeEncOutput, "hybrid-encryption-enc.txt")
                    }
                    className="h-7 w-7 p-0"
                    aria-label="Download enc"
                    disabled={!hpkeEncOutput}
                  >
                    <Download className="h-3 w-3" />
                  </Button>
                </div>
              </div>
              <Textarea
                value={hpkeEncOutput}
                readOnly
                placeholder="Encapsulated key will appear here..."
                className="min-h-[100px] max-h-[180px] overflow-auto break-all font-mono text-xs"
              />
            </div>
          )}

          {error && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}
        </div>
      </div>
    </div>
  );
}
