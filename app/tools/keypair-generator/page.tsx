"use client";

import * as React from "react";
import { Suspense } from "react";
import { z } from "zod";
import { Check, Copy, FileDown } from "lucide-react";
import { secp256k1, schnorr as schnorrCurve } from "@noble/curves/secp256k1.js";
import { p256, p384, p521 } from "@noble/curves/nist.js";
import { ed25519, x25519 } from "@noble/curves/ed25519.js";
import { ed448, x448 } from "@noble/curves/ed448.js";
import {
  brainpoolP256r1,
  brainpoolP384r1,
  brainpoolP512r1,
} from "@noble/curves/misc.js";
import {
  ml_kem512,
  ml_kem768,
  ml_kem1024,
} from "@noble/post-quantum/ml-kem.js";
import { ml_dsa44, ml_dsa65, ml_dsa87 } from "@noble/post-quantum/ml-dsa.js";
import {
  slh_dsa_sha2_128f,
  slh_dsa_sha2_128s,
  slh_dsa_sha2_192f,
  slh_dsa_sha2_192s,
  slh_dsa_sha2_256f,
  slh_dsa_sha2_256s,
  slh_dsa_shake_128f,
  slh_dsa_shake_128s,
  slh_dsa_shake_192f,
  slh_dsa_shake_192s,
  slh_dsa_shake_256f,
  slh_dsa_shake_256s,
} from "@noble/post-quantum/slh-dsa.js";
import {
  ml_kem768_x25519,
  ml_kem768_p256,
  ml_kem1024_p384,
  KitchenSink_ml_kem768_x25519,
  XWing,
  QSF_ml_kem768_p256,
  QSF_ml_kem1024_p384,
} from "@noble/post-quantum/hybrid.js";
import type { ECDSA } from "@noble/curves/abstract/weierstrass.js";
import type { EdDSA } from "@noble/curves/abstract/edwards.js";
import type { KEM, Signer } from "@noble/post-quantum/utils.js";
import {
  ToolPageWrapper,
  useToolHistoryContext,
} from "@/components/tool-ui/tool-page-wrapper";
import { useUrlSyncedState } from "@/lib/url-state/use-url-synced-state";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { decodeBase64, encodeBase64 } from "@/lib/encoding/base64";
import { encodeHex } from "@/lib/encoding/hex";
import type { HistoryEntry } from "@/lib/history/db";

const algorithmValues = [
  "RSA-PSS",
  "RSASSA-PKCS1-v1_5",
  "RSA-OAEP",
  "ECDSA",
  "ECDH",
  "Schnorr",
  "Ed25519",
  "Ed448",
  "X25519",
  "X448",
  "ML-KEM",
  "ML-DSA",
  "SLH-DSA",
  "Hybrid KEM",
] as const;

const algorithmFamilies = {
  rsa: ["RSA-PSS", "RSASSA-PKCS1-v1_5", "RSA-OAEP"],
  ec: ["ECDSA", "ECDH", "Schnorr"],
  okp: ["Ed25519", "Ed448", "X25519", "X448"],
  pqc: ["ML-KEM", "ML-DSA", "SLH-DSA", "Hybrid KEM"],
} as const;

type AlgorithmFamily = keyof typeof algorithmFamilies;

const hashValues = ["SHA-1", "SHA-256", "SHA-384", "SHA-512"] as const;
const curveValues = [
  "P-256",
  "P-384",
  "P-521",
  "secp256k1",
  "brainpoolP256r1",
  "brainpoolP384r1",
  "brainpoolP512r1",
] as const;
const pqcKemVariants = ["ML-KEM-512", "ML-KEM-768", "ML-KEM-1024"] as const;
const pqcDsaVariants = ["ML-DSA-44", "ML-DSA-65", "ML-DSA-87"] as const;
const pqcSlhVariants = [
  "SLH-DSA-SHA2-128f",
  "SLH-DSA-SHA2-128s",
  "SLH-DSA-SHA2-192f",
  "SLH-DSA-SHA2-192s",
  "SLH-DSA-SHA2-256f",
  "SLH-DSA-SHA2-256s",
  "SLH-DSA-SHAKE-128f",
  "SLH-DSA-SHAKE-128s",
  "SLH-DSA-SHAKE-192f",
  "SLH-DSA-SHAKE-192s",
  "SLH-DSA-SHAKE-256f",
  "SLH-DSA-SHAKE-256s",
] as const;
const pqcHybridVariants = [
  "XWing",
  "ML-KEM-768+X25519",
  "ML-KEM-768+P-256",
  "ML-KEM-1024+P-384",
  "KitchenSink ML-KEM-768+X25519",
  "QSF ML-KEM-768+P-256",
  "QSF ML-KEM-1024+P-384",
] as const;

const keyEncodings = ["pem", "jwk", "der-base64", "der-hex"] as const;

type KeyEncoding = (typeof keyEncodings)[number];

const keyEncodingLabels: Record<KeyEncoding, string> = {
  pem: "PEM",
  jwk: "JWK",
  "der-base64": "DER Base64",
  "der-hex": "DER Hex",
};

const keyEncodingExtensions: Record<KeyEncoding, string> = {
  pem: "pem",
  jwk: "jwk.json",
  "der-base64": "der.base64",
  "der-hex": "der.hex",
};

type KeypairAlgorithm = (typeof algorithmValues)[number];
type HashAlgorithm = (typeof hashValues)[number];
type NamedCurve = (typeof curveValues)[number];
type OkpCurve = "Ed25519" | "Ed448" | "X25519" | "X448";
type PqcKemVariant = (typeof pqcKemVariants)[number];
type PqcDsaVariant = (typeof pqcDsaVariants)[number];
type PqcSlhVariant = (typeof pqcSlhVariants)[number];
type PqcHybridVariant = (typeof pqcHybridVariants)[number];

const algorithmFamilyLabels: Record<AlgorithmFamily, string> = {
  rsa: "RSA",
  ec: "EC",
  okp: "OKP",
  pqc: "PQC",
};

const algorithmFamilyMap: Record<KeypairAlgorithm, AlgorithmFamily> = {
  "RSA-PSS": "rsa",
  "RSASSA-PKCS1-v1_5": "rsa",
  "RSA-OAEP": "rsa",
  ECDSA: "ec",
  ECDH: "ec",
  Schnorr: "ec",
  Ed25519: "okp",
  Ed448: "okp",
  X25519: "okp",
  X448: "okp",
  "ML-KEM": "pqc",
  "ML-DSA": "pqc",
  "SLH-DSA": "pqc",
  "Hybrid KEM": "pqc",
};

const ecCurveMap: Record<NamedCurve, ECDSA> = {
  secp256k1,
  "P-256": p256,
  "P-384": p384,
  "P-521": p521,
  brainpoolP256r1,
  brainpoolP384r1,
  brainpoolP512r1,
};

const edCurveMap: Record<"Ed25519" | "Ed448", EdDSA> = {
  Ed25519: ed25519,
  Ed448: ed448,
};

const xCurveMap = {
  X25519: x25519,
  X448: x448,
} as const;

const pqcKemMap: Record<PqcKemVariant, KEM> = {
  "ML-KEM-512": ml_kem512,
  "ML-KEM-768": ml_kem768,
  "ML-KEM-1024": ml_kem1024,
};

const pqcDsaMap: Record<PqcDsaVariant, Signer> = {
  "ML-DSA-44": ml_dsa44,
  "ML-DSA-65": ml_dsa65,
  "ML-DSA-87": ml_dsa87,
};

const pqcSlhMap: Record<PqcSlhVariant, Signer> = {
  "SLH-DSA-SHA2-128f": slh_dsa_sha2_128f,
  "SLH-DSA-SHA2-128s": slh_dsa_sha2_128s,
  "SLH-DSA-SHA2-192f": slh_dsa_sha2_192f,
  "SLH-DSA-SHA2-192s": slh_dsa_sha2_192s,
  "SLH-DSA-SHA2-256f": slh_dsa_sha2_256f,
  "SLH-DSA-SHA2-256s": slh_dsa_sha2_256s,
  "SLH-DSA-SHAKE-128f": slh_dsa_shake_128f,
  "SLH-DSA-SHAKE-128s": slh_dsa_shake_128s,
  "SLH-DSA-SHAKE-192f": slh_dsa_shake_192f,
  "SLH-DSA-SHAKE-192s": slh_dsa_shake_192s,
  "SLH-DSA-SHAKE-256f": slh_dsa_shake_256f,
  "SLH-DSA-SHAKE-256s": slh_dsa_shake_256s,
};

const pqcHybridMap: Record<PqcHybridVariant, KEM> = {
  XWing,
  "ML-KEM-768+X25519": ml_kem768_x25519,
  "ML-KEM-768+P-256": ml_kem768_p256,
  "ML-KEM-1024+P-384": ml_kem1024_p384,
  "KitchenSink ML-KEM-768+X25519": KitchenSink_ml_kem768_x25519,
  "QSF ML-KEM-768+P-256": QSF_ml_kem768_p256,
  "QSF ML-KEM-1024+P-384": QSF_ml_kem1024_p384,
};

const paramsSchema = z.object({
  algorithm: z.enum(algorithmValues).default("RSA-PSS"),
  rsaModulusLength: z.coerce.number().int().min(1024).max(16384).default(2048),
  rsaPublicExponent: z.string().default("65537"),
  rsaHash: z.enum(hashValues).default("SHA-256"),
  namedCurve: z.enum(curveValues).default("P-256"),
  pqcKemVariant: z.enum(pqcKemVariants).default("ML-KEM-768"),
  pqcDsaVariant: z.enum(pqcDsaVariants).default("ML-DSA-65"),
  pqcSlhVariant: z.enum(pqcSlhVariants).default("SLH-DSA-SHA2-128f"),
  pqcHybridVariant: z.enum(pqcHybridVariants).default("XWing"),
  usageSign: z.boolean().default(true),
  usageVerify: z.boolean().default(true),
  usageEncrypt: z.boolean().default(true),
  usageDecrypt: z.boolean().default(true),
  usageWrapKey: z.boolean().default(false),
  usageUnwrapKey: z.boolean().default(false),
  usageDeriveKey: z.boolean().default(true),
  usageDeriveBits: z.boolean().default(true),
  publicPem: z.string().default(""),
  privatePem: z.string().default(""),
  publicJwk: z.string().default(""),
  privateJwk: z.string().default(""),
});

type KeypairState = z.infer<typeof paramsSchema>;

const rsaAlgorithms = new Set<KeypairAlgorithm>([
  "RSA-PSS",
  "RSASSA-PKCS1-v1_5",
  "RSA-OAEP",
]);
const ecAlgorithms = new Set<KeypairAlgorithm>(["ECDSA", "ECDH"]);
const schnorrAlgorithms = new Set<KeypairAlgorithm>(["Schnorr"]);
const edAlgorithms = new Set<KeypairAlgorithm>(["Ed25519", "Ed448"]);
const xAlgorithms = new Set<KeypairAlgorithm>(["X25519", "X448"]);
const pqcKemAlgorithms = new Set<KeypairAlgorithm>(["ML-KEM", "Hybrid KEM"]);
const pqcSignatureAlgorithms = new Set<KeypairAlgorithm>(["ML-DSA", "SLH-DSA"]);

type UsageKey =
  | "sign"
  | "verify"
  | "encrypt"
  | "decrypt"
  | "wrapKey"
  | "unwrapKey"
  | "deriveKey"
  | "deriveBits";
type UsageStateKey =
  | "usageSign"
  | "usageVerify"
  | "usageEncrypt"
  | "usageDecrypt"
  | "usageWrapKey"
  | "usageUnwrapKey"
  | "usageDeriveKey"
  | "usageDeriveBits";

const usageLabels: Record<UsageKey, string> = {
  sign: "Sign",
  verify: "Verify",
  encrypt: "Encrypt",
  decrypt: "Decrypt",
  wrapKey: "Wrap key",
  unwrapKey: "Unwrap key",
  deriveKey: "Derive key",
  deriveBits: "Derive bits",
};

const usageKeyMap: Record<UsageKey, UsageStateKey> = {
  sign: "usageSign",
  verify: "usageVerify",
  encrypt: "usageEncrypt",
  decrypt: "usageDecrypt",
  wrapKey: "usageWrapKey",
  unwrapKey: "usageUnwrapKey",
  deriveKey: "usageDeriveKey",
  deriveBits: "usageDeriveBits",
};

const usageByAlgorithm: Record<KeypairAlgorithm, UsageKey[]> = {
  "RSA-PSS": ["sign", "verify"],
  "RSASSA-PKCS1-v1_5": ["sign", "verify"],
  "RSA-OAEP": ["encrypt", "decrypt", "wrapKey", "unwrapKey"],
  ECDSA: ["sign", "verify"],
  ECDH: ["deriveKey", "deriveBits"],
  Schnorr: ["sign", "verify"],
  Ed25519: ["sign", "verify"],
  Ed448: ["sign", "verify"],
  X25519: ["deriveKey", "deriveBits"],
  X448: ["deriveKey", "deriveBits"],
  "ML-KEM": ["deriveKey", "deriveBits"],
  "ML-DSA": ["sign", "verify"],
  "SLH-DSA": ["sign", "verify"],
  "Hybrid KEM": ["deriveKey", "deriveBits"],
};

const defaultUsageByAlgorithm: Record<KeypairAlgorithm, UsageKey[]> = {
  "RSA-PSS": ["sign", "verify"],
  "RSASSA-PKCS1-v1_5": ["sign", "verify"],
  "RSA-OAEP": ["encrypt", "decrypt"],
  ECDSA: ["sign", "verify"],
  ECDH: ["deriveKey", "deriveBits"],
  Schnorr: ["sign", "verify"],
  Ed25519: ["sign", "verify"],
  Ed448: ["sign", "verify"],
  X25519: ["deriveKey", "deriveBits"],
  X448: ["deriveKey", "deriveBits"],
  "ML-KEM": ["deriveKey", "deriveBits"],
  "ML-DSA": ["sign", "verify"],
  "SLH-DSA": ["sign", "verify"],
  "Hybrid KEM": ["deriveKey", "deriveBits"],
};

function toPem(buffer: ArrayBuffer, label: "PUBLIC KEY" | "PRIVATE KEY") {
  const bytes = new Uint8Array(buffer);
  let binary = "";
  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }
  const base64 = btoa(binary).replace(/(.{64})/g, "$1\n");
  return `-----BEGIN ${label}-----\n${base64}\n-----END ${label}-----`;
}

function slugify(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

function parseExponent(value: string) {
  const trimmed = value.trim();
  if (!/^\d+$/.test(trimmed)) return null;
  const num = Number(trimmed);
  if (!Number.isSafeInteger(num) || num <= 0) return null;
  const bytes: number[] = [];
  let remaining = num;
  while (remaining > 0) {
    bytes.unshift(remaining & 0xff);
    remaining = Math.floor(remaining / 256);
  }
  return new Uint8Array(bytes);
}

function encodeBase64Url(bytes: Uint8Array) {
  return encodeBase64(bytes, { urlSafe: true, padding: false });
}

function encodePqcKey(bytes: Uint8Array) {
  return encodeBase64(bytes, { urlSafe: false, padding: true });
}

function decodePemToDer(pem: string) {
  if (!pem) return null;
  const match = pem
    .trim()
    .match(/-----BEGIN[^-]+-----([\s\S]*?)-----END[^-]+-----/);
  if (!match) return null;
  const body = match[1]?.replace(/\s+/g, "") ?? "";
  if (!body) return null;
  try {
    return decodeBase64(body);
  } catch {
    return null;
  }
}

function createPqcPublicKey(algorithm: string, publicKey: Uint8Array) {
  return {
    kty: "PQC",
    alg: algorithm,
    encoding: "base64",
    publicKey: encodePqcKey(publicKey),
  };
}

function createPqcPrivateKey(
  algorithm: string,
  publicKey: Uint8Array,
  secretKey: Uint8Array,
) {
  return {
    kty: "PQC",
    alg: algorithm,
    encoding: "base64",
    publicKey: encodePqcKey(publicKey),
    secretKey: encodePqcKey(secretKey),
  };
}

function createEcJwk(
  curve: NamedCurve,
  publicKey: Uint8Array,
  privateKey?: Uint8Array,
) {
  const coordLength = (publicKey.length - 1) / 2;
  const x = publicKey.slice(1, 1 + coordLength);
  const y = publicKey.slice(1 + coordLength);
  const jwk: JsonWebKey = {
    kty: "EC",
    crv: curve,
    x: encodeBase64Url(x),
    y: encodeBase64Url(y),
  };
  if (privateKey) {
    jwk.d = encodeBase64Url(privateKey);
  }
  return jwk;
}

function createOkpJwk(
  curve: OkpCurve,
  publicKey: Uint8Array,
  privateKey?: Uint8Array,
) {
  const jwk: JsonWebKey = {
    kty: "OKP",
    crv: curve,
    x: encodeBase64Url(publicKey),
  };
  if (privateKey) {
    jwk.d = encodeBase64Url(privateKey);
  }
  return jwk;
}

function supportsPemForCurve(curve: NamedCurve) {
  return curve === "P-256" || curve === "P-384" || curve === "P-521";
}

async function tryExportPemFromJwk({
  jwk,
  algorithm,
  format,
  usages,
}: {
  jwk: JsonWebKey;
  algorithm: EcKeyImportParams | AlgorithmIdentifier;
  format: "public" | "private";
  usages: KeyUsage[];
}) {
  if (!globalThis.crypto?.subtle) return "";
  try {
    const key = await crypto.subtle.importKey(
      "jwk",
      jwk,
      algorithm,
      true,
      usages,
    );
    const exported = await crypto.subtle.exportKey(
      format === "public" ? "spki" : "pkcs8",
      key,
    );
    return toPem(exported, format === "public" ? "PUBLIC KEY" : "PRIVATE KEY");
  } catch {
    return "";
  }
}

function getAlgorithmFamily(algorithm: KeypairAlgorithm) {
  return algorithmFamilyMap[algorithm];
}

function getPublicUsagesForAlgorithm(algorithm: KeypairAlgorithm): KeyUsage[] {
  if (algorithm === "RSA-OAEP") return ["encrypt", "wrapKey"];
  if (algorithm === "ECDH" || algorithm === "X25519" || algorithm === "X448")
    return [];
  return ["verify"];
}

function getPrivateUsagesForAlgorithm(algorithm: KeypairAlgorithm): KeyUsage[] {
  if (algorithm === "RSA-OAEP") return ["decrypt", "unwrapKey"];
  if (algorithm === "ECDH" || algorithm === "X25519" || algorithm === "X448")
    return ["deriveKey", "deriveBits"];
  return ["sign"];
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

export default function KeypairGeneratorPage() {
  return (
    <Suspense fallback={null}>
      <KeypairGeneratorContent />
    </Suspense>
  );
}

function KeypairGeneratorContent() {
  const { state, setParam, setState, hasUrlParams } = useUrlSyncedState(
    "keypair-generator",
    {
      schema: paramsSchema,
      defaults: paramsSchema.parse({}),
      shouldSyncParam: (key) => {
        return !["publicPem", "privatePem", "publicJwk", "privateJwk"].includes(
          String(key),
        );
      },
    },
  );

  const handleLoadHistory = React.useCallback(
    (entry: HistoryEntry) => {
      const { inputs, params } = entry;
      if (params.algorithm)
        setParam("algorithm", params.algorithm as KeypairAlgorithm);
      if (params.rsaModulusLength !== undefined)
        setParam("rsaModulusLength", params.rsaModulusLength as number);
      if (params.rsaPublicExponent !== undefined)
        setParam("rsaPublicExponent", params.rsaPublicExponent as string);
      if (params.rsaHash) setParam("rsaHash", params.rsaHash as HashAlgorithm);
      if (params.namedCurve)
        setParam("namedCurve", params.namedCurve as NamedCurve);
      if (params.pqcKemVariant)
        setParam("pqcKemVariant", params.pqcKemVariant as PqcKemVariant);
      if (params.pqcDsaVariant)
        setParam("pqcDsaVariant", params.pqcDsaVariant as PqcDsaVariant);
      if (params.pqcSlhVariant)
        setParam("pqcSlhVariant", params.pqcSlhVariant as PqcSlhVariant);
      if (params.pqcHybridVariant)
        setParam(
          "pqcHybridVariant",
          params.pqcHybridVariant as PqcHybridVariant,
        );
      if (params.usageSign !== undefined)
        setParam("usageSign", params.usageSign as boolean);
      if (params.usageVerify !== undefined)
        setParam("usageVerify", params.usageVerify as boolean);
      if (params.usageEncrypt !== undefined)
        setParam("usageEncrypt", params.usageEncrypt as boolean);
      if (params.usageDecrypt !== undefined)
        setParam("usageDecrypt", params.usageDecrypt as boolean);
      if (params.usageWrapKey !== undefined)
        setParam("usageWrapKey", params.usageWrapKey as boolean);
      if (params.usageUnwrapKey !== undefined)
        setParam("usageUnwrapKey", params.usageUnwrapKey as boolean);
      if (params.usageDeriveKey !== undefined)
        setParam("usageDeriveKey", params.usageDeriveKey as boolean);
      if (params.usageDeriveBits !== undefined)
        setParam("usageDeriveBits", params.usageDeriveBits as boolean);
      if (inputs.publicPem !== undefined)
        setParam("publicPem", inputs.publicPem);
      if (inputs.privatePem !== undefined)
        setParam("privatePem", inputs.privatePem);
      if (inputs.publicJwk !== undefined)
        setParam("publicJwk", inputs.publicJwk);
      if (inputs.privateJwk !== undefined)
        setParam("privateJwk", inputs.privateJwk);
    },
    [setParam],
  );

  return (
    <ToolPageWrapper
      toolId="keypair-generator"
      title="Keypair Generator"
      description="Generate RSA, EC, OKP, and post-quantum keypairs with usage controls and PEM/JWK export."
      onLoadHistory={handleLoadHistory}
    >
      <KeypairGeneratorInner
        state={state}
        setParam={setParam}
        setState={setState}
        hasUrlParams={hasUrlParams}
      />
    </ToolPageWrapper>
  );
}

function KeypairGeneratorInner({
  state,
  setParam,
  setState,
  hasUrlParams,
}: {
  state: KeypairState;
  setParam: <K extends keyof KeypairState>(
    key: K,
    value: KeypairState[K],
    immediate?: boolean,
  ) => void;
  setState: (
    updater: KeypairState | ((prev: KeypairState) => KeypairState),
    immediate?: boolean,
  ) => void;
  hasUrlParams: boolean;
}) {
  const { upsertInputEntry, upsertParams } = useToolHistoryContext();
  const [keyEncoding, setKeyEncoding] = React.useState<KeyEncoding>("pem");
  const [status, setStatus] = React.useState<string | null>(null);
  const [copiedKey, setCopiedKey] = React.useState<string | null>(null);
  const [isGenerating, setIsGenerating] = React.useState(false);
  const [hasGenerated, setHasGenerated] = React.useState(false);
  const paramsRef = React.useRef<Record<string, unknown>>({});
  const hasInitializedParamsRef = React.useRef(false);
  const hasHandledUrlRef = React.useRef(false);

  const paramsSnapshot = React.useCallback(
    () => ({
      algorithm: state.algorithm,
      rsaModulusLength: state.rsaModulusLength,
      rsaPublicExponent: state.rsaPublicExponent,
      rsaHash: state.rsaHash,
      namedCurve: state.namedCurve,
      pqcKemVariant: state.pqcKemVariant,
      pqcDsaVariant: state.pqcDsaVariant,
      pqcSlhVariant: state.pqcSlhVariant,
      pqcHybridVariant: state.pqcHybridVariant,
      usageSign: state.usageSign,
      usageVerify: state.usageVerify,
      usageEncrypt: state.usageEncrypt,
      usageDecrypt: state.usageDecrypt,
      usageWrapKey: state.usageWrapKey,
      usageUnwrapKey: state.usageUnwrapKey,
      usageDeriveKey: state.usageDeriveKey,
      usageDeriveBits: state.usageDeriveBits,
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
    if (hasGenerated) return;
    if (
      state.publicPem ||
      state.privatePem ||
      state.publicJwk ||
      state.privateJwk
    ) {
      setHasGenerated(true);
    }
  }, [
    hasGenerated,
    state.publicPem,
    state.privatePem,
    state.publicJwk,
    state.privateJwk,
  ]);

  React.useEffect(() => {
    const allowed = usageByAlgorithm[state.algorithm];
    const selected = allowed.filter((usage) => state[usageKeyMap[usage]]);
    if (selected.length > 0) return;

    setState((prev) => {
      const next = { ...prev };
      const defaults = defaultUsageByAlgorithm[state.algorithm];
      for (const usage of allowed) {
        next[usageKeyMap[usage]] = defaults.includes(usage);
      }
      return next;
    }, true);
  }, [
    state.algorithm,
    state.usageSign,
    state.usageVerify,
    state.usageEncrypt,
    state.usageDecrypt,
    state.usageWrapKey,
    state.usageUnwrapKey,
    state.usageDeriveKey,
    state.usageDeriveBits,
    setState,
  ]);

  const handleCopy = React.useCallback(async (id: string, value: string) => {
    if (!value) return;
    await navigator.clipboard.writeText(value);
    setCopiedKey(id);
    window.setTimeout(() => setCopiedKey(null), 1500);
  }, []);

  const handleGenerate = React.useCallback(async () => {
    setStatus(null);

    const allowed = usageByAlgorithm[state.algorithm];
    const selected = allowed.filter((usage) => state[usageKeyMap[usage]]);
    if (selected.length === 0) {
      setStatus("Select at least one key usage.");
      return;
    }

    if (rsaAlgorithms.has(state.algorithm)) {
      if (
        !Number.isFinite(state.rsaModulusLength) ||
        state.rsaModulusLength < 1024
      ) {
        setStatus("RSA modulus length must be at least 1024 bits.");
        return;
      }
      const exponent = parseExponent(state.rsaPublicExponent);
      if (!exponent) {
        setStatus("RSA public exponent must be a positive integer.");
        return;
      }
    }

    if (rsaAlgorithms.has(state.algorithm) && !globalThis.crypto?.subtle) {
      setStatus("Web Crypto is unavailable in this browser.");
      return;
    }

    setIsGenerating(true);

    try {
      let publicPem = "";
      let privatePem = "";
      let publicJwk = "";
      let privateJwk = "";

      if (
        pqcKemAlgorithms.has(state.algorithm) ||
        pqcSignatureAlgorithms.has(state.algorithm)
      ) {
        let publicKey = new Uint8Array();
        let secretKey = new Uint8Array();
        let algorithmLabel: string = state.algorithm;

        if (state.algorithm === "ML-KEM") {
          const kem = pqcKemMap[state.pqcKemVariant];
          const keys = kem.keygen();
          publicKey = keys.publicKey as Uint8Array<ArrayBuffer>;
          secretKey = keys.secretKey as Uint8Array<ArrayBuffer>;
          algorithmLabel = state.pqcKemVariant;
        } else if (state.algorithm === "Hybrid KEM") {
          const kem = pqcHybridMap[state.pqcHybridVariant];
          const keys = kem.keygen();
          publicKey = keys.publicKey as Uint8Array<ArrayBuffer>;
          secretKey = keys.secretKey as Uint8Array<ArrayBuffer>;
          algorithmLabel = state.pqcHybridVariant;
        } else if (state.algorithm === "ML-DSA") {
          const signer = pqcDsaMap[state.pqcDsaVariant];
          const keys = signer.keygen();
          publicKey = keys.publicKey as Uint8Array<ArrayBuffer>;
          secretKey = keys.secretKey as Uint8Array<ArrayBuffer>;
          algorithmLabel = state.pqcDsaVariant;
        } else {
          const signer = pqcSlhMap[state.pqcSlhVariant];
          const keys = signer.keygen();
          publicKey = keys.publicKey as Uint8Array<ArrayBuffer>;
          secretKey = keys.secretKey as Uint8Array<ArrayBuffer>;
          algorithmLabel = state.pqcSlhVariant;
        }

        publicJwk = JSON.stringify(
          createPqcPublicKey(algorithmLabel, publicKey),
          null,
          2,
        );
        privateJwk = JSON.stringify(
          createPqcPrivateKey(algorithmLabel, publicKey, secretKey),
          null,
          2,
        );
      } else if (rsaAlgorithms.has(state.algorithm)) {
        const exponent = parseExponent(state.rsaPublicExponent)!;
        const algorithm = {
          name: state.algorithm,
          modulusLength: state.rsaModulusLength,
          publicExponent: exponent,
          hash: { name: state.rsaHash },
        } as RsaHashedKeyGenParams;

        const keyPair = (await crypto.subtle.generateKey(
          algorithm,
          true,
          selected,
        )) as CryptoKeyPair;
        const publicSpki = await crypto.subtle.exportKey(
          "spki",
          keyPair.publicKey,
        );
        const privatePkcs8 = await crypto.subtle.exportKey(
          "pkcs8",
          keyPair.privateKey,
        );
        publicPem = toPem(publicSpki, "PUBLIC KEY");
        privatePem = toPem(privatePkcs8, "PRIVATE KEY");
        publicJwk = JSON.stringify(
          await crypto.subtle.exportKey("jwk", keyPair.publicKey),
          null,
          2,
        );
        privateJwk = JSON.stringify(
          await crypto.subtle.exportKey("jwk", keyPair.privateKey),
          null,
          2,
        );
      } else {
        let publicJwkObject: JsonWebKey | null = null;
        let privateJwkObject: JsonWebKey | null = null;

        if (ecAlgorithms.has(state.algorithm)) {
          const curve = ecCurveMap[state.namedCurve];
          const { secretKey } = curve.keygen();
          const publicKey = curve.getPublicKey(secretKey, false);
          publicJwkObject = createEcJwk(state.namedCurve, publicKey);
          privateJwkObject = createEcJwk(
            state.namedCurve,
            publicKey,
            secretKey,
          );

          if (supportsPemForCurve(state.namedCurve)) {
            const importAlgorithm = {
              name: state.algorithm,
              namedCurve: state.namedCurve,
            } as EcKeyImportParams;
            const publicUsages = getPublicUsagesForAlgorithm(state.algorithm);
            const privateUsages = getPrivateUsagesForAlgorithm(state.algorithm);
            publicPem = await tryExportPemFromJwk({
              jwk: publicJwkObject,
              algorithm: importAlgorithm,
              format: "public",
              usages: publicUsages,
            });
            privatePem = await tryExportPemFromJwk({
              jwk: privateJwkObject,
              algorithm: importAlgorithm,
              format: "private",
              usages: privateUsages,
            });
          }
        } else if (schnorrAlgorithms.has(state.algorithm)) {
          const { secretKey } = schnorrCurve.keygen();
          const publicKey = secp256k1.getPublicKey(secretKey, false);
          publicJwkObject = createEcJwk("secp256k1", publicKey);
          privateJwkObject = createEcJwk("secp256k1", publicKey, secretKey);
        } else if (edAlgorithms.has(state.algorithm)) {
          const curve = edCurveMap[state.algorithm as "Ed25519" | "Ed448"];
          const { secretKey, publicKey } = curve.keygen();
          publicJwkObject = createOkpJwk(
            state.algorithm as OkpCurve,
            publicKey,
          );
          privateJwkObject = createOkpJwk(
            state.algorithm as OkpCurve,
            publicKey,
            secretKey,
          );

          const importAlgorithm = {
            name: state.algorithm,
          } as AlgorithmIdentifier;
          const publicUsages = getPublicUsagesForAlgorithm(state.algorithm);
          const privateUsages = getPrivateUsagesForAlgorithm(state.algorithm);
          publicPem = await tryExportPemFromJwk({
            jwk: publicJwkObject,
            algorithm: importAlgorithm,
            format: "public",
            usages: publicUsages,
          });
          privatePem = await tryExportPemFromJwk({
            jwk: privateJwkObject,
            algorithm: importAlgorithm,
            format: "private",
            usages: privateUsages,
          });
        } else if (xAlgorithms.has(state.algorithm)) {
          const curve = xCurveMap[state.algorithm as "X25519" | "X448"];
          const { secretKey, publicKey } = curve.keygen();
          publicJwkObject = createOkpJwk(
            state.algorithm as OkpCurve,
            publicKey,
          );
          privateJwkObject = createOkpJwk(
            state.algorithm as OkpCurve,
            publicKey,
            secretKey,
          );

          const importAlgorithm = {
            name: state.algorithm,
          } as AlgorithmIdentifier;
          const publicUsages = getPublicUsagesForAlgorithm(state.algorithm);
          const privateUsages = getPrivateUsagesForAlgorithm(state.algorithm);
          publicPem = await tryExportPemFromJwk({
            jwk: publicJwkObject,
            algorithm: importAlgorithm,
            format: "public",
            usages: publicUsages,
          });
          privatePem = await tryExportPemFromJwk({
            jwk: privateJwkObject,
            algorithm: importAlgorithm,
            format: "private",
            usages: privateUsages,
          });
        } else {
          setStatus("Unsupported algorithm.");
          return;
        }

        if (!publicJwkObject || !privateJwkObject) {
          setStatus("Failed to generate keypair.");
          return;
        }

        publicJwk = JSON.stringify(publicJwkObject, null, 2);
        privateJwk = JSON.stringify(privateJwkObject, null, 2);
      }

      setState(
        (prev) => ({
          ...prev,
          publicPem,
          privatePem,
          publicJwk,
          privateJwk,
        }),
        true,
      );

      const preview = `${state.algorithm} keypair`;
      upsertInputEntry(
        { publicPem, privatePem, publicJwk, privateJwk },
        paramsSnapshot(),
        "left",
        preview,
      );
      setHasGenerated(true);
    } catch (error) {
      setStatus(
        error instanceof Error ? error.message : "Failed to generate keypair.",
      );
    } finally {
      setIsGenerating(false);
    }
  }, [state, setState, upsertInputEntry, paramsSnapshot]);

  const isRsa = rsaAlgorithms.has(state.algorithm);
  const isEc = ecAlgorithms.has(state.algorithm);
  const isPqc =
    pqcKemAlgorithms.has(state.algorithm) ||
    pqcSignatureAlgorithms.has(state.algorithm);
  const isPemSupported =
    isRsa || (isEc && supportsPemForCurve(state.namedCurve));
  const pemAvailable =
    Boolean(state.publicPem || state.privatePem) || isPemSupported;
  const availableEncodings = React.useMemo(
    () => keyEncodings.filter((encoding) => encoding === "jwk" || pemAvailable),
    [pemAvailable],
  );
  const algorithmFamily = getAlgorithmFamily(state.algorithm);
  const activeAlgorithms = algorithmFamilies[algorithmFamily];
  const allowedUsages = usageByAlgorithm[state.algorithm];
  const getKeyValue = React.useCallback(
    (kind: "public" | "private", encoding: KeyEncoding) => {
      if (encoding === "jwk") {
        return kind === "public" ? state.publicJwk : state.privateJwk;
      }
      if (encoding === "pem") {
        return kind === "public" ? state.publicPem : state.privatePem;
      }
      const pemValue = kind === "public" ? state.publicPem : state.privatePem;
      const derBytes = decodePemToDer(pemValue);
      if (!derBytes) return "";
      return encoding === "der-base64"
        ? encodeBase64(derBytes, { urlSafe: false, padding: true })
        : encodeHex(derBytes, { upperCase: false });
    },
    [state],
  );

  const publicValue = getKeyValue("public", keyEncoding);
  const privateValue = getKeyValue("private", keyEncoding);

  const publicPlaceholder = React.useMemo(() => {
    if (keyEncoding === "jwk")
      return "Generate a keypair to see the public JWK.";
    if (!pemAvailable) {
      return keyEncoding === "pem"
        ? "PEM export is unavailable for this algorithm."
        : "DER export is unavailable for this algorithm.";
    }
    if (keyEncoding === "pem")
      return "Generate a keypair to see the public PEM.";
    return keyEncoding === "der-base64"
      ? "Generate a keypair to see the public DER (Base64)."
      : "Generate a keypair to see the public DER (Hex).";
  }, [keyEncoding, pemAvailable]);

  const privatePlaceholder = React.useMemo(() => {
    if (keyEncoding === "jwk")
      return "Generate a keypair to see the private JWK.";
    if (!pemAvailable) {
      return keyEncoding === "pem"
        ? "PEM export is unavailable for this algorithm."
        : "DER export is unavailable for this algorithm.";
    }
    if (keyEncoding === "pem")
      return "Generate a keypair to see the private PEM.";
    return keyEncoding === "der-base64"
      ? "Generate a keypair to see the private DER (Base64)."
      : "Generate a keypair to see the private DER (Hex).";
  }, [keyEncoding, pemAvailable]);

  React.useEffect(() => {
    if (availableEncodings.includes(keyEncoding)) return;
    setKeyEncoding(availableEncodings[0] ?? "jwk");
  }, [availableEncodings, keyEncoding]);

  const handleDownloadAll = React.useCallback(async () => {
    if (!state.publicJwk || !state.privateJwk) return;
    try {
      const { default: JSZip } = await import("jszip");
      const zip = new JSZip();
      const baseName = `keypair-${slugify(state.algorithm)}`;
      availableEncodings.forEach((encoding) => {
        const publicValue = getKeyValue("public", encoding);
        const privateValue = getKeyValue("private", encoding);
        const extension = keyEncodingExtensions[encoding];
        if (publicValue) {
          zip.file(`${baseName}-public.${extension}`, publicValue);
        }
        if (privateValue) {
          zip.file(`${baseName}-private.${extension}`, privateValue);
        }
      });
      const publicDer = decodePemToDer(state.publicPem);
      const privateDer = decodePemToDer(state.privatePem);
      if (publicDer) {
        zip.file(`${baseName}-public.der`, publicDer);
      }
      if (privateDer) {
        zip.file(`${baseName}-private.der`, privateDer);
      }
      const blob = await zip.generateAsync({ type: "blob" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `${baseName}.zip`;
      link.click();
      URL.revokeObjectURL(url);
    } catch (error) {
      setStatus(
        error instanceof Error ? error.message : "Failed to generate zip file.",
      );
    }
  }, [availableEncodings, getKeyValue, state]);

  return (
    <div className="flex w-full flex-col gap-4 py-4 sm:gap-6 sm:py-6">
      <div className="grid gap-4 sm:gap-6 lg:grid-cols-2">
        <section className="flex flex-col gap-4 sm:gap-6">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-base font-semibold">Keypair Settings</h2>
          </div>
          <div className="space-y-4 sm:space-y-6">
            <div className="flex items-start gap-3">
              <Label className="w-28 shrink-0 text-sm">Algorithm</Label>
              <div className="min-w-0 flex-1 space-y-2">
                <Tabs
                  value={algorithmFamily}
                  onValueChange={(value) => {
                    const family = value as AlgorithmFamily;
                    const next = algorithmFamilies[
                      family
                    ][0] as KeypairAlgorithm;
                    if (state.algorithm !== next) {
                      setParam("algorithm", next, true);
                    }
                  }}
                >
                  <ScrollableTabsList>
                    {(Object.keys(algorithmFamilies) as AlgorithmFamily[]).map(
                      (family) => (
                        <TabsTrigger
                          key={family}
                          value={family}
                          className="text-xs"
                        >
                          {algorithmFamilyLabels[family]}
                        </TabsTrigger>
                      ),
                    )}
                  </ScrollableTabsList>
                </Tabs>
                <Tabs
                  value={state.algorithm}
                  onValueChange={(value) =>
                    setParam("algorithm", value as KeypairAlgorithm, true)
                  }
                >
                  <ScrollableTabsList>
                    {activeAlgorithms.map((alg) => (
                      <TabsTrigger key={alg} value={alg} className="text-xs">
                        {alg}
                      </TabsTrigger>
                    ))}
                  </ScrollableTabsList>
                </Tabs>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <Label className="w-28 shrink-0 text-sm">Key Usages</Label>
              <div className="grid min-w-0 flex-1 grid-cols-2 gap-2">
                {allowedUsages.map((usage) => {
                  const stateKey = usageKeyMap[usage];
                  return (
                    <label
                      key={usage}
                      className="flex items-center gap-2 text-xs text-muted-foreground sm:text-sm"
                    >
                      <Checkbox
                        checked={state[stateKey]}
                        onCheckedChange={(checked) =>
                          setParam(stateKey, checked === true, true)
                        }
                      />
                      <span>{usageLabels[usage]}</span>
                    </label>
                  );
                })}
              </div>
            </div>

            {(isRsa || isEc) && (
              <div className="space-y-3 sm:space-y-4">
                {isRsa && (
                  <div className="space-y-3 sm:space-y-4">
                    <div className="grid gap-3 sm:gap-4 md:grid-cols-2">
                      <div className="flex items-center gap-3">
                        <Label className="w-28 shrink-0 text-xs text-muted-foreground">
                          Modulus Length
                        </Label>
                        <Input
                          type="number"
                          min={1024}
                          max={16384}
                          value={state.rsaModulusLength}
                          onChange={(event) =>
                            setParam(
                              "rsaModulusLength",
                              Number(event.target.value) || 1024,
                              true,
                            )
                          }
                          className="min-w-0 flex-1"
                        />
                      </div>
                      <div className="flex items-center gap-3">
                        <Label className="w-28 shrink-0 text-xs text-muted-foreground">
                          Public Exponent
                        </Label>
                        <Input
                          value={state.rsaPublicExponent}
                          onChange={(event) =>
                            setParam(
                              "rsaPublicExponent",
                              event.target.value,
                              true,
                            )
                          }
                          placeholder="65537"
                          className="min-w-0 flex-1"
                        />
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <Label className="w-28 shrink-0 text-xs text-muted-foreground">
                        Hash
                      </Label>
                      <Tabs
                        value={state.rsaHash}
                        onValueChange={(value) =>
                          setParam("rsaHash", value as HashAlgorithm, true)
                        }
                        className="min-w-0 flex-1"
                      >
                        <ScrollableTabsList>
                          {hashValues.map((hash) => (
                            <TabsTrigger
                              key={hash}
                              value={hash}
                              className="text-xs"
                            >
                              {hash}
                            </TabsTrigger>
                          ))}
                        </ScrollableTabsList>
                      </Tabs>
                    </div>
                  </div>
                )}
                {isEc && (
                  <div className="flex items-center gap-3">
                    <Label className="w-28 shrink-0 text-xs text-muted-foreground">
                      Named Curve
                    </Label>
                    <Tabs
                      value={state.namedCurve}
                      onValueChange={(value) =>
                        setParam("namedCurve", value as NamedCurve, true)
                      }
                      className="min-w-0 flex-1"
                    >
                      <ScrollableTabsList>
                        {curveValues.map((curve) => (
                          <TabsTrigger
                            key={curve}
                            value={curve}
                            className="text-xs"
                          >
                            {curve}
                          </TabsTrigger>
                        ))}
                      </ScrollableTabsList>
                    </Tabs>
                  </div>
                )}
              </div>
            )}

            {isPqc && (
              <div className="space-y-3 sm:space-y-4">
                {state.algorithm === "ML-KEM" && (
                  <div className="flex items-center gap-3">
                    <Label className="w-28 shrink-0 text-xs text-muted-foreground">
                      Parameter Set
                    </Label>
                    <Tabs
                      value={state.pqcKemVariant}
                      onValueChange={(value) =>
                        setParam("pqcKemVariant", value as PqcKemVariant, true)
                      }
                      className="min-w-0 flex-1"
                    >
                      <ScrollableTabsList>
                        {pqcKemVariants.map((variant) => (
                          <TabsTrigger
                            key={variant}
                            value={variant}
                            className="text-xs"
                          >
                            {variant}
                          </TabsTrigger>
                        ))}
                      </ScrollableTabsList>
                    </Tabs>
                  </div>
                )}

                {state.algorithm === "ML-DSA" && (
                  <div className="flex items-center gap-3">
                    <Label className="w-28 shrink-0 text-xs text-muted-foreground">
                      Parameter Set
                    </Label>
                    <Tabs
                      value={state.pqcDsaVariant}
                      onValueChange={(value) =>
                        setParam("pqcDsaVariant", value as PqcDsaVariant, true)
                      }
                      className="min-w-0 flex-1"
                    >
                      <ScrollableTabsList>
                        {pqcDsaVariants.map((variant) => (
                          <TabsTrigger
                            key={variant}
                            value={variant}
                            className="text-xs"
                          >
                            {variant}
                          </TabsTrigger>
                        ))}
                      </ScrollableTabsList>
                    </Tabs>
                  </div>
                )}

                {state.algorithm === "SLH-DSA" && (
                  <div className="flex items-center gap-3">
                    <Label className="w-28 shrink-0 text-xs text-muted-foreground">
                      Parameter Set
                    </Label>
                    <Tabs
                      value={state.pqcSlhVariant}
                      onValueChange={(value) =>
                        setParam("pqcSlhVariant", value as PqcSlhVariant, true)
                      }
                      className="min-w-0 flex-1"
                    >
                      <ScrollableTabsList>
                        {pqcSlhVariants.map((variant) => (
                          <TabsTrigger
                            key={variant}
                            value={variant}
                            className="text-xs"
                          >
                            {variant}
                          </TabsTrigger>
                        ))}
                      </ScrollableTabsList>
                    </Tabs>
                  </div>
                )}

                {state.algorithm === "Hybrid KEM" && (
                  <div className="flex items-center gap-3">
                    <Label className="w-28 shrink-0 text-xs text-muted-foreground">
                      Hybrid Set
                    </Label>
                    <Tabs
                      value={state.pqcHybridVariant}
                      onValueChange={(value) =>
                        setParam(
                          "pqcHybridVariant",
                          value as PqcHybridVariant,
                          true,
                        )
                      }
                      className="min-w-0 flex-1"
                    >
                      <ScrollableTabsList>
                        {pqcHybridVariants.map((variant) => (
                          <TabsTrigger
                            key={variant}
                            value={variant}
                            className="text-xs"
                          >
                            {variant}
                          </TabsTrigger>
                        ))}
                      </ScrollableTabsList>
                    </Tabs>
                  </div>
                )}
              </div>
            )}

            {status && <p className="text-xs text-destructive">{status}</p>}
            <Button
              className="w-full"
              onClick={handleGenerate}
              disabled={isGenerating}
            >
              {isGenerating ? "Generating..." : "Generate Keypair"}
            </Button>
            <hr className="border-border" />
          </div>
        </section>

        {hasGenerated && (
          <section className="flex flex-col gap-4 sm:gap-6">
            <div className="flex items-center justify-between gap-3">
              <h2 className="text-base font-semibold">Generated Keys</h2>
              <Button
                variant="outline"
                size="sm"
                onClick={handleDownloadAll}
                disabled={!state.publicJwk || !state.privateJwk}
              >
                <FileDown className="h-4 w-4" />
                Download All
              </Button>
            </div>
            <div className="flex items-center gap-3">
              <Label className="w-28 shrink-0 text-xs text-muted-foreground">
                Encoding
              </Label>
              <Tabs
                value={keyEncoding}
                onValueChange={(value) => setKeyEncoding(value as KeyEncoding)}
              >
                <ScrollableTabsList>
                  {availableEncodings.map((encoding) => (
                    <TabsTrigger
                      key={encoding}
                      value={encoding}
                      className="text-xs"
                    >
                      {keyEncodingLabels[encoding]}
                    </TabsTrigger>
                  ))}
                </ScrollableTabsList>
              </Tabs>
            </div>
            <div className="space-y-4 sm:space-y-6">
              <div className="space-y-2 sm:space-y-3">
                <div className="flex items-center justify-between">
                  <Label>Public Key</Label>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 w-7 p-0"
                    onClick={() => handleCopy("public", publicValue)}
                    aria-label="Copy public key"
                    disabled={!publicValue}
                  >
                    {copiedKey === "public" ? (
                      <Check className="h-4 w-4" />
                    ) : (
                      <Copy className="h-4 w-4" />
                    )}
                  </Button>
                </div>
                <Textarea
                  readOnly
                  rows={15}
                  value={publicValue}
                  placeholder={publicPlaceholder}
                  className="max-h-[360px] overflow-auto break-all font-mono text-xs"
                />
              </div>

              <div className="space-y-2 sm:space-y-3">
                <div className="flex items-center justify-between">
                  <Label>Private Key</Label>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 w-7 p-0"
                    onClick={() => handleCopy("private", privateValue)}
                    aria-label="Copy private key"
                    disabled={!privateValue}
                  >
                    {copiedKey === "private" ? (
                      <Check className="h-4 w-4" />
                    ) : (
                      <Copy className="h-4 w-4" />
                    )}
                  </Button>
                </div>
                <Textarea
                  readOnly
                  rows={15}
                  value={privateValue}
                  placeholder={privatePlaceholder}
                  className="max-h-[360px] overflow-auto break-all font-mono text-xs"
                />
              </div>
            </div>
          </section>
        )}
      </div>
    </div>
  );
}
