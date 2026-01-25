"use client"

import * as React from "react"
import { Suspense } from "react"
import { z } from "zod"
import jsrsasign from "jsrsasign"
import * as asn1js from "asn1js"
import { ed25519 } from "@noble/curves/ed25519.js"
import { ed448 } from "@noble/curves/ed448.js"
import { sha256, sha384, sha512 } from "@noble/hashes/sha2.js"
import { BasicConstraintsExtension, TextConverter, X509Certificate } from "@peculiar/x509"
import {
  AuthenticatedSafe,
  CertBag,
  ContentInfo,
  PFX,
  PKCS8ShroudedKeyBag,
  PrivateKeyInfo,
  SafeBag,
  SafeContents,
  id_CertBag_X509Certificate,
  setEngine,
} from "pkijs"
import { ToolPageWrapper, useToolHistoryContext } from "@/components/tool-ui/tool-page-wrapper"
import { useUrlSyncedState } from "@/lib/url-state/use-url-synced-state"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Tabs, TabsContent, TabsTrigger } from "@/components/ui/tabs"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Switch } from "@/components/ui/switch"
import { Checkbox } from "@/components/ui/checkbox"
import { DateTimePicker } from "@/components/ui/date-time-picker"
import { Copy, Check, Download, Trash2 } from "lucide-react"
import { cn } from "@/lib/utils"
import {
  InfoRow,
  ScrollableTabsList,
  StatusRow,
  UploadButton,
  type ViewSummary,
} from "./x509-ui"
import {
  parseDnString,
  parseSanEntries,
  normalizeSerialNumber,
  parseCertificateInput,
  certificateToPem,
  certificateToDerBase64,
  createPkcs12Base64,
  splitPemBlocks,
  type X509InputFormat,
} from "@/lib/x509/utils"
import {
  type EcCurveId,
  type CertPublicKey,
  computeSubjectKeyIdentifier,
  createDhPrivateKeyPem,
  createDsaPrivateKeyPem,
  createEcPrivateKeyPem,
  createEdPrivateKeyPem,
  generateEcKeyPair,
  generateEdKeyPair,
  getEcCurveSpec,
  normalizeEcCurveId,
  parseDhPrivateKey,
  parseDsaPrivateKey,
  parseEcPrivateKey,
  parseEdPrivateKey,
  parseRsaKey,
  publicKeyToAsn1,
} from "@/lib/x509/keys"

const paramsSchema = z.object({
  tab: z.enum(["create", "sign", "view", "validate", "convert"]).default("create"),

  createSubjectDn: z.string().default("CN=example.com"),
  createIssuerDn: z.string().default(""),
  createSelfSigned: z.coerce.boolean().default(true),
  createOutputType: z.enum(["certificate", "csr"]).default("certificate"),
  createKeyType: z.enum(["rsa", "ec", "ed25519", "ed448", "dsa", "dh"]).default("rsa"),
  createEcCurve: z
    .enum([
      "prime256v1",
      "secp384r1",
      "secp521r1",
      "secp256k1",
      "brainpoolP256r1",
      "brainpoolP384r1",
      "brainpoolP512r1",
    ])
    .default("prime256v1"),
  createKeyMode: z.enum(["generate", "provided"]).default("generate"),
  createKeySize: z.coerce.number().int().min(1024).max(8192).default(2048),
  createPrivateKeyPem: z.string().default(""),
  createIssuerCertPem: z.string().default(""),
  createIssuerKeyPem: z.string().default(""),
  createSerial: z.string().default("01"),
  createNotBefore: z.string().default(""),
  createNotAfter: z.string().default(""),
  createHash: z.enum(["sha256", "sha384", "sha512"]).default("sha256"),
  createSan: z.string().default(""),
  createSanCritical: z.coerce.boolean().default(false),
  createIsCa: z.coerce.boolean().default(false),
  createPathLen: z.coerce.number().int().min(0).max(32).default(0),
  createBasicConstraintsCritical: z.coerce.boolean().default(true),
  createKeyUsage: z.string().default("digitalSignature,keyEncipherment"),
  createKeyUsageCritical: z.coerce.boolean().default(false),
  createExtKeyUsage: z.string().default("serverAuth,clientAuth"),
  createExtKeyUsageCritical: z.coerce.boolean().default(false),
  createSubjectKeyIdentifier: z.coerce.boolean().default(true),
  createAuthorityKeyIdentifier: z.coerce.boolean().default(true),
  createCustomExtensions: z.string().default(""),
  createIncludePem: z.coerce.boolean().default(true),
  createIncludeDer: z.coerce.boolean().default(true),
  createIncludePkcs12: z.coerce.boolean().default(false),
  createPkcs12Password: z.string().default(""),

  signCsrInput: z.string().default(""),
  signCsrFormat: z.enum(["pem", "der"]).default("pem"),
  signIssuerDn: z.string().default(""),
  signIssuerCertPem: z.string().default(""),
  signIssuerKeyPem: z.string().default(""),
  signSerial: z.string().default("01"),
  signNotBefore: z.string().default(""),
  signNotAfter: z.string().default(""),
  signHash: z.enum(["sha256", "sha384", "sha512"]).default("sha256"),
  signUseCsrExtensions: z.coerce.boolean().default(true),
  signIncludePem: z.coerce.boolean().default(true),
  signIncludeDer: z.coerce.boolean().default(true),

  viewInput: z.string().default(""),
  viewFormat: z.enum(["pem", "der", "pkcs12"]).default("pem"),
  viewPassword: z.string().default(""),
  viewPrivateKeyPem: z.string().default(""),
  viewSelectedIndex: z.coerce.number().int().min(0).default(0),

  validateInput: z.string().default(""),
  validateFormat: z.enum(["pem", "der", "pkcs12"]).default("pem"),
  validatePassword: z.string().default(""),
  validateCaBundle: z.string().default(""),

  convertInput: z.string().default(""),
  convertFormat: z.enum(["pem", "der", "pkcs12"]).default("pem"),
  convertPassword: z.string().default(""),
  convertOutputPem: z.coerce.boolean().default(true),
  convertOutputDer: z.coerce.boolean().default(false),
  convertOutputPkcs12: z.coerce.boolean().default(false),
  convertP12Password: z.string().default(""),
  convertPrivateKeyPem: z.string().default(""),
})

type CreateOutput = {
  certPem?: string
  csrPem?: string
  privateKeyPem: string
  derBase64?: string
  csrDerBase64?: string
  pkcs12Base64?: string
}

type SignOutput = {
  certPem?: string
  derBase64?: string
}

type ViewKeyOutput = {
  pem?: string
  derBase64?: string
  jwk?: string
}

type ViewOutputs = {
  kind: "certificate" | "csr"
  pem: string[]
  derBase64: string[]
  publicKey?: ViewKeyOutput
  privateKey?: ViewKeyOutput
}

type ValidationResult = {
  timeValid: boolean
  chainValid: boolean | null
  signatureValid: boolean | null
  errors: string[]
}

type SigningKey =
  | { kind: "rsa"; key: any }
  | { kind: "dsa"; key: any }
  | { kind: "ecdsa"; curve: EcCurveId; privateKey: Uint8Array }
  | { kind: "ed25519"; privateKey: Uint8Array }
  | { kind: "ed448"; privateKey: Uint8Array }

const KEY_USAGE_OPTIONS = [
  { key: "digitalSignature", label: "Digital Signature" },
  { key: "nonRepudiation", label: "Non Repudiation" },
  { key: "keyEncipherment", label: "Key Encipherment" },
  { key: "dataEncipherment", label: "Data Encipherment" },
  { key: "keyAgreement", label: "Key Agreement" },
  { key: "keyCertSign", label: "Key Cert Sign" },
  { key: "cRLSign", label: "CRL Sign" },
  { key: "encipherOnly", label: "Encipher Only" },
  { key: "decipherOnly", label: "Decipher Only" },
]

const EXT_KEY_USAGE_OPTIONS = [
  { key: "serverAuth", label: "Server Auth" },
  { key: "clientAuth", label: "Client Auth" },
  { key: "codeSigning", label: "Code Signing" },
  { key: "emailProtection", label: "Email Protection" },
  { key: "timeStamping", label: "Time Stamping" },
  { key: "ocspSigning", label: "OCSP Signing" },
]

const EC_CURVE_OPTIONS: Array<{ value: EcCurveId; label: string }> = [
  { value: "prime256v1", label: "prime256v1 (secp256r1)" },
  { value: "secp384r1", label: "secp384r1" },
  { value: "secp521r1", label: "secp521r1" },
  { value: "secp256k1", label: "secp256k1" },
  { value: "brainpoolP256r1", label: "brainpoolP256r1" },
  { value: "brainpoolP384r1", label: "brainpoolP384r1" },
  { value: "brainpoolP512r1", label: "brainpoolP512r1" },
]

const EC_CURVE_IDS = EC_CURVE_OPTIONS.map((option) => option.value)

const RSA_SIGNATURE_OIDS = {
  sha256: "1.2.840.113549.1.1.11",
  sha384: "1.2.840.113549.1.1.12",
  sha512: "1.2.840.113549.1.1.13",
} as const

const DSA_SIGNATURE_OIDS = {
  sha256: "2.16.840.1.101.3.4.3.2",
  sha384: "2.16.840.1.101.3.4.3.3",
  sha512: "2.16.840.1.101.3.4.3.4",
} as const

const ECDSA_SIGNATURE_OIDS = {
  sha256: "1.2.840.10045.4.3.2",
  sha384: "1.2.840.10045.4.3.3",
  sha512: "1.2.840.10045.4.3.4",
} as const

const RSA_SIGNATURE_ALGOS = {
  sha256: "SHA256withRSA",
  sha384: "SHA384withRSA",
  sha512: "SHA512withRSA",
} as const

const DSA_SIGNATURE_ALGOS = {
  sha256: "SHA256withDSA",
  sha384: "SHA384withDSA",
  sha512: "SHA512withDSA",
} as const

const ECDSA_SIGNATURE_ALGOS = {
  sha256: "SHA256withECDSA",
  sha384: "SHA384withECDSA",
  sha512: "SHA512withECDSA",
} as const

const PKCS12_BAG_IDS = {
  keyBag: "1.2.840.113549.1.12.10.1.1",
  pkcs8ShroudedKeyBag: "1.2.840.113549.1.12.10.1.2",
  certBag: "1.2.840.113549.1.12.10.1.3",
} as const

let pkijsEngineReady = false

const URL_EXCLUDED_KEYS: Array<keyof z.infer<typeof paramsSchema>> = [
  "createPrivateKeyPem",
  "createIssuerCertPem",
  "createIssuerKeyPem",
  "signCsrInput",
  "signIssuerCertPem",
  "signIssuerKeyPem",
  "viewInput",
  "viewPrivateKeyPem",
  "validateInput",
  "validateCaBundle",
  "convertInput",
  "convertPrivateKeyPem",
  "createPkcs12Password",
  "viewPassword",
  "validatePassword",
  "convertPassword",
  "convertP12Password",
]

const VALID_TABS = ["create", "sign", "view", "validate", "convert"] as const

function normalizeInitialTab(tab?: string) {
  if (!tab) return undefined
  return VALID_TABS.includes(tab as (typeof VALID_TABS)[number]) ? tab : undefined
}

export default function X509Client({ initialTab }: { initialTab?: string }) {
  const normalizedTab = normalizeInitialTab(initialTab)
  return (
    <Suspense fallback={null}>
      <ToolPageWrapper
        toolId="x509"
        title="X.509"
        description="Create, view, validate, and convert X.509 certificates with PEM, DER, and PKCS#12 support."
        showHistory={false}
      >
        <X509Inner initialTab={normalizedTab} />
      </ToolPageWrapper>
    </Suspense>
  )
}

function X509Inner({ initialTab }: { initialTab?: string }) {
  const defaults = React.useMemo(() => paramsSchema.parse({ tab: initialTab }), [initialTab])
  const initialSearch = React.useMemo(
    () => (initialTab ? `tab=${encodeURIComponent(initialTab)}` : ""),
    [initialTab],
  )
  const { state, setParam, setStateSilently, resetToDefaults, oversizeKeys, hydrationSource } =
    useUrlSyncedState("x509", {
      schema: paramsSchema,
      defaults,
      shouldSyncParam: (key) => !URL_EXCLUDED_KEYS.includes(key),
      shouldParseParam: (key) => !URL_EXCLUDED_KEYS.includes(key),
      restoreFromHistory: false,
      initialSearch,
    })
  const { entries, loading, addHistoryEntry, updateLatestEntry, clearHistory } = useToolHistoryContext()
  const historySnapshotRef = React.useRef<string>("")
  const hasSeededHistoryRef = React.useRef(false)
  const hasInitializedDatesRef = React.useRef(false)
  const hasMergedRef = React.useRef(false)
  const skipNextHistoryUpdateRef = React.useRef(false)

  const historyInputs = React.useMemo(
    () => ({
      createSubjectDn: state.createSubjectDn,
      createIssuerDn: state.createIssuerDn,
      createPrivateKeyPem: state.createPrivateKeyPem,
      createIssuerCertPem: state.createIssuerCertPem,
      createIssuerKeyPem: state.createIssuerKeyPem,
      createSan: state.createSan,
      createKeyUsage: state.createKeyUsage,
      createExtKeyUsage: state.createExtKeyUsage,
      createCustomExtensions: state.createCustomExtensions,
      signCsrInput: state.signCsrInput,
      signIssuerDn: state.signIssuerDn,
      signIssuerCertPem: state.signIssuerCertPem,
      signIssuerKeyPem: state.signIssuerKeyPem,
      viewInput: state.viewInput,
      viewPrivateKeyPem: state.viewPrivateKeyPem,
      validateInput: state.validateInput,
      validateCaBundle: state.validateCaBundle,
      convertInput: state.convertInput,
      convertPrivateKeyPem: state.convertPrivateKeyPem,
    }),
    [
      state.createSubjectDn,
      state.createIssuerDn,
      state.createPrivateKeyPem,
      state.createIssuerCertPem,
      state.createIssuerKeyPem,
      state.createSan,
      state.createKeyUsage,
      state.createExtKeyUsage,
      state.createCustomExtensions,
      state.signCsrInput,
      state.signIssuerDn,
      state.signIssuerCertPem,
      state.signIssuerKeyPem,
      state.viewInput,
      state.viewPrivateKeyPem,
      state.validateInput,
      state.validateCaBundle,
      state.convertInput,
      state.convertPrivateKeyPem,
    ],
  )

  const historyParams = React.useMemo(
    () => ({
      tab: state.tab,
      createSelfSigned: state.createSelfSigned,
      createOutputType: state.createOutputType,
      createKeyType: state.createKeyType,
      createKeyMode: state.createKeyMode,
      createKeySize: state.createKeySize,
      createEcCurve: state.createEcCurve,
      createSerial: state.createSerial,
      createNotBefore: state.createNotBefore,
      createNotAfter: state.createNotAfter,
      createHash: state.createHash,
      createSanCritical: state.createSanCritical,
      createIsCa: state.createIsCa,
      createPathLen: state.createPathLen,
      createBasicConstraintsCritical: state.createBasicConstraintsCritical,
      createKeyUsageCritical: state.createKeyUsageCritical,
      createExtKeyUsageCritical: state.createExtKeyUsageCritical,
      createSubjectKeyIdentifier: state.createSubjectKeyIdentifier,
      createAuthorityKeyIdentifier: state.createAuthorityKeyIdentifier,
      createIncludePem: state.createIncludePem,
      createIncludeDer: state.createIncludeDer,
      createIncludePkcs12: state.createIncludePkcs12,
      createPkcs12Password: state.createPkcs12Password,
      signCsrFormat: state.signCsrFormat,
      signSerial: state.signSerial,
      signNotBefore: state.signNotBefore,
      signNotAfter: state.signNotAfter,
      signHash: state.signHash,
      signUseCsrExtensions: state.signUseCsrExtensions,
      signIncludePem: state.signIncludePem,
      signIncludeDer: state.signIncludeDer,
      viewFormat: state.viewFormat,
      viewPassword: state.viewPassword,
      viewSelectedIndex: state.viewSelectedIndex,
      validateFormat: state.validateFormat,
      validatePassword: state.validatePassword,
      convertFormat: state.convertFormat,
      convertPassword: state.convertPassword,
      convertOutputPem: state.convertOutputPem,
      convertOutputDer: state.convertOutputDer,
      convertOutputPkcs12: state.convertOutputPkcs12,
      convertP12Password: state.convertP12Password,
    }),
    [
      state.tab,
      state.createSelfSigned,
      state.createOutputType,
      state.createKeyType,
      state.createKeyMode,
      state.createKeySize,
      state.createEcCurve,
      state.createSerial,
      state.createNotBefore,
      state.createNotAfter,
      state.createHash,
      state.createSanCritical,
      state.createIsCa,
      state.createPathLen,
      state.createBasicConstraintsCritical,
      state.createKeyUsageCritical,
      state.createExtKeyUsageCritical,
      state.createSubjectKeyIdentifier,
      state.createAuthorityKeyIdentifier,
      state.createIncludePem,
      state.createIncludeDer,
      state.createIncludePkcs12,
      state.createPkcs12Password,
      state.signCsrFormat,
      state.signSerial,
      state.signNotBefore,
      state.signNotAfter,
      state.signHash,
      state.signUseCsrExtensions,
      state.signIncludePem,
      state.signIncludeDer,
      state.viewFormat,
      state.viewPassword,
      state.viewSelectedIndex,
      state.validateFormat,
      state.validatePassword,
      state.convertFormat,
      state.convertPassword,
      state.convertOutputPem,
      state.convertOutputDer,
      state.convertOutputPkcs12,
      state.convertP12Password,
    ],
  )

  const historyLabel = React.useMemo(() => {
    if (state.tab === "create") return state.createSubjectDn.trim() || "X.509 create"
    if (state.tab === "sign") return state.signCsrInput.trim().slice(0, 80) || "X.509 sign"
    if (state.tab === "view") return state.viewInput.trim().slice(0, 80) || "X.509 view"
    if (state.tab === "validate") return state.validateInput.trim().slice(0, 80) || "X.509 validate"
    return state.convertInput.trim().slice(0, 80) || "X.509 convert"
  }, [state.tab, state.createSubjectDn, state.signCsrInput, state.viewInput, state.validateInput, state.convertInput])

  const parseUrlState = React.useCallback(
    (search: string) => {
      const params = new URLSearchParams(search)
      const result: Record<string, unknown> = { ...defaults }

      params.forEach((value, key) => {
        if (!Object.prototype.hasOwnProperty.call(defaults, key)) return
        const typedKey = key as keyof z.infer<typeof paramsSchema>
        if (URL_EXCLUDED_KEYS.includes(typedKey)) return
        const defaultValue = defaults[typedKey]
        if (typeof defaultValue === "boolean") {
          result[key] = value === "true" || value === "1"
        } else if (typeof defaultValue === "number") {
          const num = Number(value)
          result[key] = Number.isNaN(num) ? defaultValue : num
        } else {
          result[key] = value
        }
      })

      try {
        return paramsSchema.parse(result)
      } catch {
        return defaults
      }
    },
    [defaults],
  )

  React.useEffect(() => {
    if (hasMergedRef.current) return
    if (loading) return
    if (typeof window === "undefined") return

    const params = new URLSearchParams(window.location.search)
    const urlState = parseUrlState(window.location.search)
    const merged: Record<string, unknown> = { ...urlState }
    const latest = entries[0]

    const shouldApplyHistoryValue = (key: string) => {
      if (!Object.prototype.hasOwnProperty.call(defaults, key)) return false
      const typedKey = key as keyof z.infer<typeof paramsSchema>
      if (params.has(key) && !URL_EXCLUDED_KEYS.includes(typedKey)) return false
      return true
    }

    if (latest?.inputs) {
      for (const [key, value] of Object.entries(latest.inputs)) {
        if (!shouldApplyHistoryValue(key)) continue
        merged[key] = value
      }
    }

    if (latest?.params) {
      for (const [key, value] of Object.entries(latest.params)) {
        if (!shouldApplyHistoryValue(key)) continue
        merged[key] = value
      }
    }

    const mergedResult = paramsSchema.safeParse(merged)
    const nextState = mergedResult.success ? mergedResult.data : urlState
    skipNextHistoryUpdateRef.current = true
    setStateSilently(nextState)
    hasMergedRef.current = true
  }, [defaults, entries, loading, parseUrlState, setStateSilently])

  React.useEffect(() => {
    if (!hasMergedRef.current) return
    if (loading) return
    if (skipNextHistoryUpdateRef.current) {
      skipNextHistoryUpdateRef.current = false
      return
    }
    if (entries.length === 0) {
      if (hasSeededHistoryRef.current) return
      hasSeededHistoryRef.current = true
      void addHistoryEntry({}, {}, "left", "X.509")
      return
    }
    const snapshot = JSON.stringify({ inputs: historyInputs, params: historyParams })
    if (snapshot === historySnapshotRef.current && entries[0]?.hasInput === false) return
    historySnapshotRef.current = snapshot
    updateLatestEntry({ inputs: historyInputs, params: historyParams, preview: historyLabel, hasInput: false })
  }, [loading, entries, historyInputs, historyParams, historyLabel, addHistoryEntry, updateLatestEntry])

  const [createOutput, setCreateOutput] = React.useState<CreateOutput | null>(null)
  const [createError, setCreateError] = React.useState<string | null>(null)
  const [createBusy, setCreateBusy] = React.useState(false)
  const [createCopied, setCreateCopied] = React.useState(false)

  const [signOutput, setSignOutput] = React.useState<SignOutput | null>(null)
  const [signError, setSignError] = React.useState<string | null>(null)
  const [signBusy, setSignBusy] = React.useState(false)
  const [signCopied, setSignCopied] = React.useState(false)

  const [viewSummaries, setViewSummaries] = React.useState<ViewSummary[]>([])
  const [viewError, setViewError] = React.useState<string | null>(null)
  const [viewBusy, setViewBusy] = React.useState(false)
  const [viewCopied, setViewCopied] = React.useState(false)
  const [viewCerts, setViewCerts] = React.useState<X509Certificate[]>([])
  const [viewCsrData, setViewCsrData] = React.useState<{
    pem: string
    derBase64: string
    publicKeyPem: string
  } | null>(null)
  const [viewPrivateKeyDer, setViewPrivateKeyDer] = React.useState<ArrayBuffer | null>(null)
  const [viewKeyOutputs, setViewKeyOutputs] = React.useState<{
    publicKey?: ViewKeyOutput
    privateKey?: ViewKeyOutput
  } | null>(null)

  const [validateResult, setValidateResult] = React.useState<ValidationResult | null>(null)
  const [validateError, setValidateError] = React.useState<string | null>(null)
  const [validateBusy, setValidateBusy] = React.useState(false)

  const [convertOutput, setConvertOutput] = React.useState<{
    pem?: string
    der?: string
    pkcs12?: string
    note?: string
  } | null>(null)
  const [convertError, setConvertError] = React.useState<string | null>(null)
  const [convertBusy, setConvertBusy] = React.useState(false)
  const [signFileName, setSignFileName] = React.useState<string | null>(null)
  const [viewFileName, setViewFileName] = React.useState<string | null>(null)
  const [validateFileName, setValidateFileName] = React.useState<string | null>(null)
  const [convertFileName, setConvertFileName] = React.useState<string | null>(null)

  const handleClearAll = React.useCallback(async () => {
    const currentTab = state.tab
    await clearHistory("tool")
    hasSeededHistoryRef.current = false
    historySnapshotRef.current = ""
    resetToDefaults()
    setParam("tab", currentTab, true)
    const now = new Date()
    const later = new Date(now.getTime() + 365 * 24 * 60 * 60 * 1000)
    setParam("createNotBefore", now.toISOString(), true)
    setParam("createNotAfter", later.toISOString(), true)
    setParam("signNotBefore", now.toISOString(), true)
    setParam("signNotAfter", later.toISOString(), true)
    setCreateOutput(null)
    setCreateError(null)
    setCreateBusy(false)
    setCreateCopied(false)
    setSignOutput(null)
    setSignError(null)
    setSignBusy(false)
    setSignCopied(false)
    setViewSummaries([])
    setViewError(null)
    setViewBusy(false)
    setViewCopied(false)
    setViewCerts([])
    setViewCsrData(null)
    setViewPrivateKeyDer(null)
    setViewKeyOutputs(null)
    setValidateResult(null)
    setValidateError(null)
    setValidateBusy(false)
    setConvertOutput(null)
    setConvertError(null)
    setConvertBusy(false)
    setSignFileName(null)
    setViewFileName(null)
    setValidateFileName(null)
    setConvertFileName(null)
    if (typeof window !== "undefined") {
      const params = new URLSearchParams()
      if (currentTab) params.set("tab", currentTab)
      const query = params.toString()
      const newUrl = query ? `${window.location.pathname}?${query}` : window.location.pathname
      window.history.replaceState({}, "", newUrl)
    }
  }, [clearHistory, resetToDefaults, setParam, state.tab])

  const notBeforeDate = React.useMemo(() => {
    const date = new Date(state.createNotBefore)
    return Number.isNaN(date.getTime()) ? undefined : date
  }, [state.createNotBefore])
  const notAfterDate = React.useMemo(() => {
    const date = new Date(state.createNotAfter)
    return Number.isNaN(date.getTime()) ? undefined : date
  }, [state.createNotAfter])
  const signNotBeforeDate = React.useMemo(() => {
    const date = new Date(state.signNotBefore)
    return Number.isNaN(date.getTime()) ? undefined : date
  }, [state.signNotBefore])
  const signNotAfterDate = React.useMemo(() => {
    const date = new Date(state.signNotAfter)
    return Number.isNaN(date.getTime()) ? undefined : date
  }, [state.signNotAfter])

  React.useEffect(() => {
    if (hasInitializedDatesRef.current) return
    if (hydrationSource !== "default") return
    const shouldInitCreate = !state.createNotBefore && !state.createNotAfter
    const shouldInitSign = !state.signNotBefore && !state.signNotAfter
    if (!shouldInitCreate && !shouldInitSign) {
      hasInitializedDatesRef.current = true
      return
    }
    const now = new Date()
    const later = new Date(now.getTime() + 365 * 24 * 60 * 60 * 1000)
    if (shouldInitCreate) {
      setParam("createNotBefore", now.toISOString(), true)
      setParam("createNotAfter", later.toISOString(), true)
    }
    if (shouldInitSign) {
      setParam("signNotBefore", now.toISOString(), true)
      setParam("signNotAfter", later.toISOString(), true)
    }
    hasInitializedDatesRef.current = true
  }, [
    hydrationSource,
    setParam,
    state.createNotAfter,
    state.createNotBefore,
    state.signNotAfter,
    state.signNotBefore,
  ])

  React.useEffect(() => {
    if (state.createKeyType !== "rsa" && state.createIncludePkcs12) {
      setParam("createIncludePkcs12", false, true)
    }
  }, [setParam, state.createIncludePkcs12, state.createKeyType])

  React.useEffect(() => {
    if ((state.createKeyType === "dsa" || state.createKeyType === "dh") && state.createKeyMode === "generate") {
      setParam("createKeyMode", "provided", true)
    }
  }, [setParam, state.createKeyMode, state.createKeyType])

  const updateList = React.useCallback(
    (
      field: "createKeyUsage" | "createExtKeyUsage",
      value: string,
      key: string,
      checked: boolean,
    ) => {
      const items = new Set(
        value
          .split(",")
          .map((entry) => entry.trim())
          .filter(Boolean),
      )
      if (checked) {
        items.add(key)
      } else {
        items.delete(key)
      }
      setParam(field, Array.from(items).join(","), true)
    },
    [setParam],
  )

  const inferFormatFromFilename = (name: string): X509InputFormat | null => {
    const lower = name.toLowerCase()
    if (lower.endsWith(".p12") || lower.endsWith(".pfx")) return "pkcs12"
    if (lower.endsWith(".der")) return "der"
    if (lower.endsWith(".pem") || lower.endsWith(".crt") || lower.endsWith(".cer")) return "pem"
    return null
  }

  const arrayBufferToBase64 = (buffer: ArrayBuffer) => {
    const bytes = new Uint8Array(buffer)
    const chunkSize = 0x8000
    let binary = ""
    for (let i = 0; i < bytes.length; i += chunkSize) {
      const chunk = bytes.subarray(i, i + chunkSize)
      binary += String.fromCharCode(...chunk)
    }
    return btoa(binary)
  }

  const binaryStringToBytes = (value: string) => {
    const bytes = new Uint8Array(value.length)
    for (let i = 0; i < value.length; i += 1) {
      bytes[i] = value.charCodeAt(i)
    }
    return bytes
  }

  const bytesToBase64Url = (bytes: Uint8Array) => {
    const chunkSize = 0x8000
    let binary = ""
    for (let i = 0; i < bytes.length; i += chunkSize) {
      const chunk = bytes.subarray(i, i + chunkSize)
      binary += String.fromCharCode(...chunk)
    }
    return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "")
  }

  const hexToBytes = (hex: string) => {
    const normalized = hex.length % 2 === 0 ? hex : `0${hex}`
    const bytes = new Uint8Array(normalized.length / 2)
    for (let i = 0; i < normalized.length; i += 2) {
      bytes[i / 2] = Number.parseInt(normalized.slice(i, i + 2), 16)
    }
    return bytes
  }

  const formatPemBlock = (label: string, base64: string) => {
    const clean = base64.replace(/\s+/g, "")
    const lines = clean.match(/.{1,64}/g) ?? []
    return `-----BEGIN ${label}-----\n${lines.join("\n")}\n-----END ${label}-----`
  }

  const readFileAsInput = async (file: File, fallback: X509InputFormat) => {
    const inferred = inferFormatFromFilename(file.name) ?? fallback
    if (inferred === "pem") {
      return { format: inferred, content: await file.text() }
    }
    const buffer = await file.arrayBuffer()
    return { format: inferred, content: arrayBufferToBase64(buffer) }
  }

  const readCertFileInput = async (file: File) => {
    const name = file.name.toLowerCase()
    if (name.endsWith(".der")) {
      const buffer = await file.arrayBuffer()
      return arrayBufferToBase64(buffer)
    }
    return file.text()
  }

  const readKeyFileInput = async (file: File) => {
    const name = file.name.toLowerCase()
    if (name.endsWith(".der")) {
      const buffer = await file.arrayBuffer()
      return arrayBufferToBase64(buffer)
    }
    return file.text()
  }

  const bytesToHex = (bytes: Uint8Array) => {
    let hex = ""
    for (const byte of bytes) {
      hex += byte.toString(16).padStart(2, "0")
    }
    return hex
  }

  const bigIntToHex = (value: bigint) => {
    const hex = value.toString(16)
    return hex.length % 2 === 0 ? hex : `0${hex}`
  }

  const ensurePkijsEngine = () => {
    if (pkijsEngineReady) return
    const crypto = globalThis.crypto
    if (!crypto || !crypto.subtle) {
      throw new Error("WebCrypto is unavailable in this environment.")
    }
    setEngine("browser", crypto, crypto.subtle)
    pkijsEngineReady = true
  }

  const normalizeBase64Input = (input: string) =>
    input
      .replace(/-----BEGIN [^-]+-----/g, "")
      .replace(/-----END [^-]+-----/g, "")
      .replace(/\s+/g, "")

  const base64ToArrayBuffer = (input: string) => {
    const cleaned = normalizeBase64Input(input)
    if (!cleaned) {
      throw new Error("Input is empty.")
    }
    const binary = atob(cleaned)
    const bytes = new Uint8Array(binary.length)
    for (let i = 0; i < binary.length; i += 1) {
      bytes[i] = binary.charCodeAt(i)
    }
    return bytes.buffer
  }

  const stringToArrayBuffer = (value: string) => new TextEncoder().encode(value).buffer

  const parsePkcs12Input = async (input: string, password?: string) => {
    try {
      ensurePkijsEngine()
      const der = base64ToArrayBuffer(input)
      const asn1 = asn1js.fromBER(der)
      if (asn1.offset === -1) {
        throw new Error("Invalid PKCS#12 input.")
      }
      const pfx = new PFX({ schema: asn1.result })
      const passwordBuffer = stringToArrayBuffer(password ?? "")
      await pfx.parseInternalValues({ password: passwordBuffer })

      const authenticatedSafe = pfx.parsedValue?.authenticatedSafe as AuthenticatedSafe | undefined
      if (!authenticatedSafe) {
        throw new Error("PKCS#12 input is missing authenticated safe data.")
      }

      const safeParams = authenticatedSafe.safeContents.map((content) => {
        if (content.contentType === ContentInfo.ENVELOPED_DATA) {
          throw new Error("PKCS#12 enveloped safe contents are not supported.")
        }
        if (content.contentType === ContentInfo.ENCRYPTED_DATA) {
          return { password: passwordBuffer }
        }
        return {}
      })

      await authenticatedSafe.parseInternalValues({ safeContents: safeParams })

      const safeEntries = authenticatedSafe.parsedValue?.safeContents ?? []
      const certs: X509Certificate[] = []
      let privateKey: ArrayBuffer | undefined

      for (const entry of safeEntries) {
        const safeContents = entry.value as SafeContents
        for (const bag of safeContents.safeBags) {
          if (bag.bagId === PKCS12_BAG_IDS.certBag) {
            const certBag = bag.bagValue as CertBag
            if (certBag.certId !== id_CertBag_X509Certificate) continue
            let certDer: ArrayBuffer | null = null
            if (certBag.certValue instanceof asn1js.OctetString) {
              certDer = certBag.certValue.valueBlock.valueHex
            } else if (certBag.certValue && typeof (certBag.certValue as any).toSchema === "function") {
              certDer = (certBag.certValue as any).toSchema().toBER(false)
            }
            if (certDer) {
              certs.push(new X509Certificate(certDer))
            }
            continue
          }

          if (bag.bagId === PKCS12_BAG_IDS.keyBag && !privateKey) {
            const keyInfo = bag.bagValue as PrivateKeyInfo
            privateKey = keyInfo.toSchema().toBER(false)
            continue
          }

          if (bag.bagId === PKCS12_BAG_IDS.pkcs8ShroudedKeyBag && !privateKey) {
            const keyBag = bag.bagValue as PKCS8ShroudedKeyBag
            await (keyBag as any).parseInternalValues({ password: passwordBuffer })
            if (keyBag.parsedValue) {
              privateKey = keyBag.parsedValue.toSchema().toBER(false)
            }
          }
        }
      }

      if (!certs.length) {
        throw new Error("No certificates found in PKCS#12 input.")
      }
      return { certs, privateKey }
    } catch (err) {
      console.error(err)
      const message = err instanceof Error ? err.message : ""
      if (message.includes("contentEncryptionAlgorithm")) {
        const parsed = parseCertificateInput(input, "pkcs12", password)
        const certs = parsed.certs.map((cert) => new X509Certificate(certificateToDerBase64(cert)))
        let privateKey: ArrayBuffer | undefined
        if (parsed.privateKey) {
          const forgeModule = await import("node-forge")
          const forge = forgeModule.default ?? forgeModule
          privateKey = base64ToArrayBuffer(forge.pki.privateKeyToPem(parsed.privateKey))
        }
        return { certs, privateKey }
      }
      throw err
    }
  }

  const parsePrivateKeyPkcs8 = (input: string) => {
    const trimmed = input.trim()
    if (!trimmed) {
      throw new Error("Private key input is empty.")
    }
    const { KEYUTIL } = jsrsasign

    try {
      const { key } = parseRsaKey(trimmed)
      return base64ToArrayBuffer(KEYUTIL.getPEM(key, "PKCS8PRV"))
    } catch {}

    try {
      const { privateKeyPem } = parseDsaPrivateKey(trimmed)
      return base64ToArrayBuffer(privateKeyPem)
    } catch {}

    try {
      const { privateKey } = parseEdPrivateKey(trimmed, "Ed25519")
      return base64ToArrayBuffer(createEdPrivateKeyPem("Ed25519", privateKey))
    } catch {}

    try {
      const { privateKey } = parseEdPrivateKey(trimmed, "Ed448")
      return base64ToArrayBuffer(createEdPrivateKeyPem("Ed448", privateKey))
    } catch {}

    for (const curve of EC_CURVE_IDS) {
      try {
        const { privateKey, publicKey } = parseEcPrivateKey(trimmed, curve)
        if (!publicKey) {
          throw new Error("EC public key is required.")
        }
        return base64ToArrayBuffer(createEcPrivateKeyPem(curve, privateKey, publicKey))
      } catch {}
    }

    try {
      const { params } = parseDhPrivateKey(trimmed)
      return base64ToArrayBuffer(createDhPrivateKeyPem(params))
    } catch {}

    throw new Error("Unsupported private key format. Use PEM, DER (Base64), or JWK.")
  }

  const jsbnToBigInt = (value: { toString: (radix: number) => string }) => BigInt(`0x${value.toString(16)}`)

  const parsePublicKeyPem = (pem: string): CertPublicKey => {
    const { KEYUTIL, RSAKey, KJUR } = jsrsasign
    const key = KEYUTIL.getKey(pem)
    if (key instanceof RSAKey) {
      return { type: "rsa", n: jsbnToBigInt(key.n), e: jsbnToBigInt(key.e) }
    }
    const ECDSA = KJUR.crypto.ECDSA
    const DSA = KJUR.crypto.DSA
    if (key instanceof ECDSA) {
      const curve = normalizeEcCurveId(key.curveName ?? "")
      if (!curve) {
        throw new Error("Unsupported EC curve in public key.")
      }
      const pubKeyHex = key.pubKeyHex ?? (() => {
        const xy = key.getPublicKeyXYHex()
        return `04${xy.x}${xy.y}`
      })()
      return { type: "ec", curve, publicKeyBytes: hexToBytes(pubKeyHex) }
    }
    if (key instanceof DSA) {
      return {
        type: "dsa",
        params: {
          p: jsbnToBigInt(key.p),
          q: jsbnToBigInt(key.q),
          g: jsbnToBigInt(key.g),
          y: jsbnToBigInt(key.y),
        },
      }
    }
    throw new Error("Unsupported public key format.")
  }

  const buildJwkFromPublicKey = (key: CertPublicKey) => {
    if (key.type === "rsa") {
      return {
        kty: "RSA",
        n: bytesToBase64Url(hexToBytes(bigIntToHex(key.n))),
        e: bytesToBase64Url(hexToBytes(bigIntToHex(key.e))),
      }
    }
    if (key.type === "ec") {
      const spec = getEcCurveSpec(key.curve)
      if (key.publicKeyBytes[0] !== 4) {
        throw new Error("Unsupported EC public key format.")
      }
      const coordLength = (key.publicKeyBytes.length - 1) / 2
      const x = key.publicKeyBytes.slice(1, 1 + coordLength)
      const y = key.publicKeyBytes.slice(1 + coordLength)
      return { kty: "EC", crv: spec.jwk, x: bytesToBase64Url(x), y: bytesToBase64Url(y) }
    }
    if (key.type === "ed25519" || key.type === "ed448") {
      return {
        kty: "OKP",
        crv: key.type === "ed25519" ? "Ed25519" : "Ed448",
        x: bytesToBase64Url(key.publicKeyBytes),
      }
    }
    if (key.type === "dsa") {
      return {
        kty: "DSA",
        p: bigIntToHex(key.params.p),
        q: bigIntToHex(key.params.q),
        g: bigIntToHex(key.params.g),
        y: bigIntToHex(key.params.y),
      }
    }
    // key.type === "dh"
    const dhKey = key as { type: "dh"; params: { p: bigint; g: bigint; y: bigint } }
    return {
      kty: "DH",
      p: bigIntToHex(dhKey.params.p),
      g: bigIntToHex(dhKey.params.g),
      y: bigIntToHex(dhKey.params.y),
    }
  }

  const buildJwkFromPrivateKeyInput = (input: string) => {
    try {
      const { KEYUTIL } = jsrsasign
      const { key } = parseRsaKey(input)
      return KEYUTIL.getJWKFromKey(key)
    } catch {}

    for (const curve of EC_CURVE_IDS) {
      try {
        const { privateKey, publicKey } = parseEcPrivateKey(input, curve)
        if (!publicKey) {
          throw new Error("EC public key is required.")
        }
        if (publicKey[0] !== 4) {
          throw new Error("Unsupported EC public key format.")
        }
        const spec = getEcCurveSpec(curve)
        const coordLength = (publicKey.length - 1) / 2
        const x = publicKey.slice(1, 1 + coordLength)
        const y = publicKey.slice(1 + coordLength)
        return {
          kty: "EC",
          crv: spec.jwk,
          x: bytesToBase64Url(x),
          y: bytesToBase64Url(y),
          d: bytesToBase64Url(privateKey),
        }
      } catch {}
    }

    try {
      const { privateKey, publicKey } = parseEdPrivateKey(input, "Ed25519")
      return {
        kty: "OKP",
        crv: "Ed25519",
        x: bytesToBase64Url(publicKey),
        d: bytesToBase64Url(privateKey),
      }
    } catch {}

    try {
      const { privateKey, publicKey } = parseEdPrivateKey(input, "Ed448")
      return {
        kty: "OKP",
        crv: "Ed448",
        x: bytesToBase64Url(publicKey),
        d: bytesToBase64Url(privateKey),
      }
    } catch {}

    try {
      const { params } = parseDsaPrivateKey(input)
      return {
        kty: "DSA",
        p: bigIntToHex(params.p),
        q: bigIntToHex(params.q),
        g: bigIntToHex(params.g),
        y: bigIntToHex(params.y),
        x: bigIntToHex(params.x as bigint),
      }
    } catch {}

    try {
      const { params } = parseDhPrivateKey(input)
      return {
        kty: "DH",
        p: bigIntToHex(params.p),
        g: bigIntToHex(params.g),
        y: bigIntToHex(params.y),
        x: params.x ? bigIntToHex(params.x) : undefined,
      }
    } catch {}

    throw new Error("Unsupported private key format.")
  }

  const buildPublicKeyOutputs = (pem: string): ViewKeyOutput => {
    const outputs: ViewKeyOutput = { pem, derBase64: normalizeBase64Input(pem) }
    try {
      const jwk = buildJwkFromPublicKey(parsePublicKeyPem(pem))
      outputs.jwk = JSON.stringify(jwk, null, 2)
    } catch (err) {
      console.error(err)
    }
    return outputs
  }

  const buildPrivateKeyOutputsFromDer = (der: ArrayBuffer): ViewKeyOutput => {
    const derBase64 = arrayBufferToBase64(der)
    const pem = formatPemBlock("PRIVATE KEY", derBase64)
    const outputs: ViewKeyOutput = { pem, derBase64 }
    try {
      const jwk = buildJwkFromPrivateKeyInput(pem)
      outputs.jwk = JSON.stringify(jwk, null, 2)
    } catch (err) {
      console.error(err)
    }
    return outputs
  }

  const buildPrivateKeyOutputsFromInput = (input: string): ViewKeyOutput => {
    const der = parsePrivateKeyPkcs8(input)
    const derBase64 = arrayBufferToBase64(der)
    const pem = formatPemBlock("PRIVATE KEY", derBase64)
    const outputs: ViewKeyOutput = { pem, derBase64 }
    try {
      const jwk = buildJwkFromPrivateKeyInput(input)
      outputs.jwk = JSON.stringify(jwk, null, 2)
    } catch (err) {
      console.error(err)
    }
    return outputs
  }

  const parseCsrInput = (input: string, format: "pem" | "der") => {
    const { KJUR } = jsrsasign
    const base64 = normalizeBase64Input(input)
    const hasPemHeader =
      input.includes("BEGIN CERTIFICATE REQUEST") || input.includes("BEGIN NEW CERTIFICATE REQUEST")
    const pem =
      format === "pem" && hasPemHeader
        ? input.trim()
        : formatPemBlock("CERTIFICATE REQUEST", base64)
    const derBase64 = normalizeBase64Input(pem)
    const params = KJUR.asn1.csr.CSRUtil.getParam(pem)
    const subject = typeof params.subject?.str === "string" ? params.subject.str : ""
    const publicKeyPem = typeof params.sbjpubkey === "string" ? params.sbjpubkey : ""
    const publicKey = publicKeyPem ? parsePublicKeyPem(publicKeyPem) : null
    const signatureAlgorithm = typeof params.sigalg === "string" ? params.sigalg : ""
    const extensions = params.extreq ? JSON.stringify(params.extreq, null, 2) : "[]"
    const fingerprint = bytesToHex(sha256(new Uint8Array(base64ToArrayBuffer(derBase64))))
    return {
      pem,
      derBase64,
      subject,
      publicKeyPem,
      publicKey,
      signatureAlgorithm,
      extensions,
      extreq: Array.isArray(params.extreq) ? params.extreq : [],
      fingerprintSha256: fingerprint,
    }
  }

  const getPublicKeyPemFromCert = async (cert: X509Certificate) => {
    const { KEYUTIL } = jsrsasign
    try {
      const certPem = cert.toString("pem")
      const key = KEYUTIL.getKey(certPem)
      return KEYUTIL.getPEM(key, "PKCS8PUB")
    } catch (err) {
      console.error(err)
    }
    try {
      const spki = await globalThis.crypto.subtle.exportKey("spki", cert.publicKey as unknown as CryptoKey)
      return formatPemBlock("PUBLIC KEY", arrayBufferToBase64(spki))
    } catch (err) {
      console.error(err)
    }
    return null
  }

  const describePublicKey = (key: CertPublicKey | null) => {
    if (!key) return ""
    if (key.type === "rsa") return "RSA"
    if (key.type === "ec") return `EC (${key.curve})`
    if (key.type === "ed25519") return "Ed25519"
    if (key.type === "ed448") return "Ed448"
    if (key.type === "dsa") return "DSA"
    return "DH"
  }

  const buildCsrSummary = (csr: ReturnType<typeof parseCsrInput>): ViewSummary => ({
    kind: "csr",
    subject: csr.subject,
    fingerprintSha256: csr.fingerprintSha256,
    signatureAlgorithm: csr.signatureAlgorithm,
    publicKeyAlgorithm: describePublicKey(csr.publicKey),
    extensions: csr.extensions,
  })

  const createPkcs12Base64Pkijs = async (
    cert: X509Certificate,
    privateKeyDer: ArrayBuffer,
    password: string,
  ) => {
    ensurePkijsEngine()
    const keyAsn1 = asn1js.fromBER(privateKeyDer)
    if (keyAsn1.offset === -1) {
      throw new Error("Invalid private key input for PKCS#12 output.")
    }

    const keyInfo = new PrivateKeyInfo({ schema: keyAsn1.result })
    const keyBag = new PKCS8ShroudedKeyBag({ parsedValue: keyInfo })
    const passwordBuffer = stringToArrayBuffer(password ?? "")
    await keyBag.makeInternalValues({
      password: passwordBuffer,
      contentEncryptionAlgorithm: { name: "AES-CBC", length: 256, iv: new Uint8Array(16) },
      hmacHashAlgorithm: "SHA-256",
      iterationCount: 2048,
    })

    const certBag = new CertBag({
      certId: id_CertBag_X509Certificate,
      certValue: new asn1js.OctetString({ valueHex: cert.rawData }),
    })
    const safeContents = new SafeContents({
      safeBags: [
        new SafeBag({ bagId: PKCS12_BAG_IDS.pkcs8ShroudedKeyBag, bagValue: keyBag }),
        new SafeBag({ bagId: PKCS12_BAG_IDS.certBag, bagValue: certBag }),
      ],
    })

    const authenticatedSafe = new AuthenticatedSafe({
      parsedValue: { safeContents: [{ privacyMode: 0, value: safeContents }] },
    })
    await authenticatedSafe.makeInternalValues({ safeContents: [{}] })

    const pfx = new PFX({
      parsedValue: { integrityMode: 0, authenticatedSafe },
    })
    await pfx.makeInternalValues({
      iterations: 2048,
      pbkdf2HashAlgorithm: { name: "SHA-256" },
      hmacHashAlgorithm: "SHA-256",
      password: passwordBuffer,
    })

    return arrayBufferToBase64(pfx.toSchema().toBER(false))
  }

  const parseX509Certificates = async (
    input: string,
    format: X509InputFormat,
    password?: string,
  ): Promise<{ certs: X509Certificate[]; privateKey?: ArrayBuffer }> => {
    if (!input.trim()) {
      throw new Error("Certificate input is empty.")
    }

    if (format === "pkcs12") {
      return await parsePkcs12Input(input, password)
    }

    if (format === "pem") {
      const blocks = splitPemBlocks(input, "CERTIFICATE")
      if (!blocks.length) {
        throw new Error("No certificates found in PEM input.")
      }
      return { certs: blocks.map((block) => new X509Certificate(block)), privateKey: undefined }
    }

    const raw = input.replace(/\s+/g, "")
    return { certs: [new X509Certificate(raw)], privateKey: undefined }
  }

  const buildX509Summary = (cert: X509Certificate): ViewSummary => {
    const basicConstraints = cert.getExtension(BasicConstraintsExtension)
    const fingerprint = bytesToHex(sha256(new Uint8Array(cert.rawData)))
    const extensions = cert.extensions.map((ext) => ({
      type: ext.type,
      critical: ext.critical,
      value: TextConverter.serialize(ext.toTextObject()),
    }))
    const signatureAlgorithm = cert.signatureAlgorithm?.name ?? ""
    const publicKeyAlgorithm = (cert.publicKey?.algorithm as { name?: string } | undefined)?.name ?? ""

    return {
      kind: "certificate",
      subject: cert.subject,
      issuer: cert.issuer,
      serial: cert.serialNumber,
      notBefore: cert.notBefore.toISOString(),
      notAfter: cert.notAfter.toISOString(),
      isCa: basicConstraints?.ca ?? false,
      fingerprintSha256: fingerprint,
      signatureAlgorithm,
      publicKeyAlgorithm,
      extensions: JSON.stringify(extensions, null, 2),
    }
  }

  const handleViewUpload = React.useCallback(
    async (event: React.ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0]
      if (!file) return
      setViewFileName(file.name)
      const result = await readFileAsInput(file, state.viewFormat as X509InputFormat)
      setParam("viewFormat", result.format, true)
      setParam("viewInput", result.content)
    },
    [setParam, state.viewFormat],
  )

  const handleViewPrivateKeyUpload = React.useCallback(
    async (event: React.ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0]
      if (!file) return
      setParam("viewPrivateKeyPem", await readKeyFileInput(file))
    },
    [setParam],
  )

  const handleCreateIssuerCertUpload = React.useCallback(
    async (event: React.ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0]
      if (!file) return
      setParam("createIssuerCertPem", await readCertFileInput(file))
    },
    [setParam],
  )

  const handleCreateIssuerKeyUpload = React.useCallback(
    async (event: React.ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0]
      if (!file) return
      setParam("createIssuerKeyPem", await readKeyFileInput(file))
    },
    [setParam],
  )

  const handleCreatePrivateKeyUpload = React.useCallback(
    async (event: React.ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0]
      if (!file) return
      setParam("createPrivateKeyPem", await readKeyFileInput(file))
    },
    [setParam],
  )

  const handleSignUpload = React.useCallback(
    async (event: React.ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0]
      if (!file) return
      setSignFileName(file.name)
      const result = await readFileAsInput(file, state.signCsrFormat as X509InputFormat)
      const format = result.format === "pkcs12" ? "pem" : result.format
      setParam("signCsrFormat", format as z.infer<typeof paramsSchema>["signCsrFormat"], true)
      setParam("signCsrInput", result.content)
    },
    [setParam, state.signCsrFormat],
  )

  const handleSignIssuerCertUpload = React.useCallback(
    async (event: React.ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0]
      if (!file) return
      setParam("signIssuerCertPem", await readCertFileInput(file))
    },
    [setParam],
  )

  const handleSignIssuerKeyUpload = React.useCallback(
    async (event: React.ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0]
      if (!file) return
      setParam("signIssuerKeyPem", await readKeyFileInput(file))
    },
    [setParam],
  )

  const handleValidateUpload = React.useCallback(
    async (event: React.ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0]
      if (!file) return
      setValidateFileName(file.name)
      const result = await readFileAsInput(file, state.validateFormat as X509InputFormat)
      setParam("validateFormat", result.format, true)
      setParam("validateInput", result.content)
    },
    [setParam, state.validateFormat],
  )

  const handleValidateCaUpload = React.useCallback(
    async (event: React.ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0]
      if (!file) return
      setParam("validateCaBundle", await file.text())
    },
    [setParam],
  )

  const handleConvertUpload = React.useCallback(
    async (event: React.ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0]
      if (!file) return
      setConvertFileName(file.name)
      const result = await readFileAsInput(file, state.convertFormat as X509InputFormat)
      setParam("convertFormat", result.format, true)
      setParam("convertInput", result.content)
    },
    [setParam, state.convertFormat],
  )

  const handleConvertKeyUpload = React.useCallback(
    async (event: React.ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0]
      if (!file) return
      setParam("convertPrivateKeyPem", await readKeyFileInput(file))
    },
    [setParam],
  )

  const parseSigningKey = (input: string): SigningKey => {
    try {
      const { key } = parseRsaKey(input)
      return { kind: "rsa", key }
    } catch {}
    try {
      const { params, key } = parseDsaPrivateKey(input)
      return { kind: "dsa", key }
    } catch {}
    try {
      const { privateKey } = parseEdPrivateKey(input, "Ed25519")
      return { kind: "ed25519", privateKey }
    } catch {}
    try {
      const { privateKey } = parseEdPrivateKey(input, "Ed448")
      return { kind: "ed448", privateKey }
    } catch {}
    for (const curve of EC_CURVE_IDS) {
      try {
        const { privateKey } = parseEcPrivateKey(input, curve)
        return { kind: "ecdsa", curve, privateKey }
      } catch {}
    }
    try {
      parseDhPrivateKey(input)
      throw new Error("DH keys cannot sign certificates.")
    } catch (err) {
      if (err instanceof Error && err.message.includes("DH keys cannot sign certificates.")) {
        throw err
      }
    }
    throw new Error("Unsupported issuer key format. Use PEM, DER (Base64), or JWK.")
  }

  const handleCreate = React.useCallback(async () => {
    setCreateError(null)
    setCreateOutput(null)
    setCreateBusy(true)

    try {
      const forgeModule = await import("node-forge")
      const forge = forgeModule.default ?? forgeModule
      const { KJUR, KEYUTIL } = jsrsasign

      const bytesToBinaryString = (value: Uint8Array) => forge.util.createBuffer(value).getBytes()

      const subjectAttrs = parseDnString(state.createSubjectDn)
      if (!subjectAttrs.length) {
        throw new Error("Subject DN is required.")
      }

      const hashAlgorithm = state.createHash as keyof typeof RSA_SIGNATURE_OIDS

      const signWithJsrsasign = (algorithm: string, key: any, tbsBytes: string) => {
        const signer = new KJUR.crypto.Signature({ alg: algorithm })
        signer.init(key)
        signer.updateHex(forge.util.bytesToHex(tbsBytes))
        return signer.sign()
      }

      let subjectPublicKey: CertPublicKey | null = null
      let subjectPrivateKeyPem = ""
      let subjectSigner: SigningKey | null = null

      if (state.createKeyMode === "generate") {
        if (state.createKeyType === "rsa") {
          const keyPair = await new Promise<any>((resolve, reject) => {
            forge.pki.rsa.generateKeyPair({ bits: state.createKeySize, workers: 2 }, (err: Error, pair: any) => {
              if (err) reject(err)
              else resolve(pair)
            })
          })
          const pem = forge.pki.privateKeyToPem(keyPair.privateKey)
          const { key, publicKey } = parseRsaKey(pem)
          subjectPublicKey = publicKey
          subjectSigner = { kind: "rsa", key }
          subjectPrivateKeyPem = KEYUTIL.getPEM(key, "PKCS1PRV")
        } else if (state.createKeyType === "ec") {
          const { privateKey, publicKey } = generateEcKeyPair(state.createEcCurve)
          subjectPublicKey = { type: "ec", curve: state.createEcCurve, publicKeyBytes: publicKey }
          subjectSigner = { kind: "ecdsa", curve: state.createEcCurve, privateKey }
          subjectPrivateKeyPem = createEcPrivateKeyPem(state.createEcCurve, privateKey, publicKey)
        } else if (state.createKeyType === "ed25519" || state.createKeyType === "ed448") {
          const curve = state.createKeyType === "ed25519" ? "Ed25519" : "Ed448"
          const { privateKey, publicKey } = generateEdKeyPair(curve)
          subjectPublicKey = { type: state.createKeyType, publicKeyBytes: publicKey }
          subjectSigner = { kind: state.createKeyType, privateKey }
          subjectPrivateKeyPem = createEdPrivateKeyPem(curve, privateKey)
        } else if (state.createKeyType === "dsa") {
          throw new Error("DSA key generation is not supported. Provide a DSA private key.")
        } else {
          throw new Error("DH key generation is not supported. Provide a DH private key.")
        }
      } else {
        if (!state.createPrivateKeyPem.trim()) {
          throw new Error("Private key input is required when using an existing key.")
        }
        if (state.createKeyType === "rsa") {
          const { key, publicKey } = parseRsaKey(state.createPrivateKeyPem)
          subjectPublicKey = publicKey
          subjectSigner = { kind: "rsa", key }
          subjectPrivateKeyPem = KEYUTIL.getPEM(key, "PKCS1PRV")
        } else if (state.createKeyType === "ec") {
          const { privateKey, publicKey } = parseEcPrivateKey(state.createPrivateKeyPem, state.createEcCurve)
          if (!publicKey) {
            throw new Error("EC public key is required.")
          }
          subjectPublicKey = { type: "ec", curve: state.createEcCurve, publicKeyBytes: publicKey }
          subjectSigner = { kind: "ecdsa", curve: state.createEcCurve, privateKey }
          subjectPrivateKeyPem = createEcPrivateKeyPem(state.createEcCurve, privateKey, publicKey)
        } else if (state.createKeyType === "ed25519" || state.createKeyType === "ed448") {
          const curve = state.createKeyType === "ed25519" ? "Ed25519" : "Ed448"
          const { privateKey, publicKey } = parseEdPrivateKey(state.createPrivateKeyPem, curve)
          subjectPublicKey = { type: state.createKeyType, publicKeyBytes: publicKey }
          subjectSigner = { kind: state.createKeyType, privateKey }
          subjectPrivateKeyPem = createEdPrivateKeyPem(curve, privateKey)
        } else if (state.createKeyType === "dsa") {
          const { params, key } = parseDsaPrivateKey(state.createPrivateKeyPem)
          subjectPublicKey = { type: "dsa", params }
          subjectSigner = { kind: "dsa", key }
          subjectPrivateKeyPem = createDsaPrivateKeyPem(params)
        } else {
          const { params } = parseDhPrivateKey(state.createPrivateKeyPem)
          subjectPublicKey = { type: "dh", params }
          subjectPrivateKeyPem = createDhPrivateKeyPem(params)
        }
      }

      if (!subjectPublicKey) {
        throw new Error("Subject public key is unavailable.")
      }

      if (state.createOutputType === "csr") {
        if (isDhKey) {
          throw new Error("DH keys cannot sign certificate requests.")
        }
        if (isEdKey) {
          throw new Error("Ed25519 and Ed448 certificate requests are not supported.")
        }

        const { KJUR, KEYUTIL, hextob64, BigInteger } = jsrsasign

        const buildCsrPublicKey = () => {
          if (subjectPublicKey?.type === "rsa") {
            return KEYUTIL.getKey({
              n: subjectPublicKey.n.toString(16),
              e: subjectPublicKey.e.toString(16),
            })
          }
          if (subjectPublicKey?.type === "ec") {
            const publicKeyBytes = subjectPublicKey.publicKeyBytes
            if (publicKeyBytes[0] !== 4) {
              throw new Error("Unsupported EC public key format for CSR.")
            }
            const coordLength = (publicKeyBytes.length - 1) / 2
            const x = publicKeyBytes.slice(1, 1 + coordLength)
            const y = publicKeyBytes.slice(1 + coordLength)
            const jwk = {
              kty: "EC",
              crv: getEcCurveSpec(subjectPublicKey.curve).jwk,
              x: bytesToBase64Url(x),
              y: bytesToBase64Url(y),
            }
            try {
              return KEYUTIL.getKey(jwk)
            } catch {
              throw new Error("Selected EC curve is not supported for CSR generation.")
            }
          }
          if (subjectPublicKey?.type === "dsa") {
            const { params } = subjectPublicKey
            return KEYUTIL.getKey({
              p: new BigInteger(params.p.toString(16), 16),
              q: new BigInteger(params.q.toString(16), 16),
              g: new BigInteger(params.g.toString(16), 16),
              y: new BigInteger(params.y.toString(16), 16),
            })
          }
          throw new Error("Unsupported key type for CSR generation.")
        }

        const buildCsrExtensions = () => {
          const extensions: Array<Record<string, unknown>> = []
          const keyUsageNames = state.createKeyUsage
            .split(",")
            .map((entry) => entry.trim())
            .filter(Boolean)
          if (keyUsageNames.length) {
            extensions.push({
              extname: "keyUsage",
              critical: state.createKeyUsageCritical || undefined,
              names: keyUsageNames,
            })
          }

          const extKeyUsageNames = state.createExtKeyUsage
            .split(",")
            .map((entry) => entry.trim())
            .filter(Boolean)
          if (extKeyUsageNames.length) {
            extensions.push({
              extname: "extKeyUsage",
              critical: state.createExtKeyUsageCritical || undefined,
              array: extKeyUsageNames,
            })
          }

          const sanEntries = parseSanEntries(state.createSan)
          const sanArray = sanEntries
            .map((entry) => {
              if (entry.type === 2) return { dns: entry.value }
              if (entry.type === 7) return { ip: entry.ip ?? entry.value }
              if (entry.type === 6) return { uri: entry.value }
              if (entry.type === 1) return { rfc822: entry.value }
              return null
            })
            .filter(Boolean)
          if (sanArray.length) {
            extensions.push({
              extname: "subjectAltName",
              critical: state.createSanCritical || undefined,
              array: sanArray,
            })
          }

          extensions.push({
            extname: "basicConstraints",
            critical: state.createBasicConstraintsCritical || undefined,
            cA: state.createIsCa,
            pathLen: state.createIsCa ? state.createPathLen : undefined,
          })

          if (state.createSubjectKeyIdentifier) {
            const keyIdentifier = computeSubjectKeyIdentifier(publicKeyToAsn1(subjectPublicKey as CertPublicKey))
            const keyHex = bytesToHex(binaryStringToBytes(keyIdentifier))
            extensions.push({
              extname: "subjectKeyIdentifier",
              kid: { hex: keyHex },
            })
          }

          return extensions
        }

        let signatureAlgorithm: string
        if (isRsaKey) {
          signatureAlgorithm = RSA_SIGNATURE_ALGOS[hashAlgorithm]
        } else if (isDsaKey) {
          signatureAlgorithm = DSA_SIGNATURE_ALGOS[hashAlgorithm]
        } else {
          signatureAlgorithm = ECDSA_SIGNATURE_ALGOS[hashAlgorithm]
        }

        // Convert subject DN to jsrsasign format (slash-delimited with str property)
        const subjectDnStr = state.createSubjectDn.trim().startsWith("/")
          ? state.createSubjectDn.trim()
          : "/" + state.createSubjectDn.trim().split(/\s*,\s*/).join("/")

        const csrParams: Record<string, unknown> = {
          subject: { str: subjectDnStr },
          sbjprvkey: subjectPrivateKeyPem,
          sbjpubkey: buildCsrPublicKey(),
          sigalg: signatureAlgorithm,
        }
        const csrExtensions = buildCsrExtensions()
        if (csrExtensions.length) {
          csrParams.extreq = csrExtensions
        }

        const csr = new KJUR.asn1.csr.CertificationRequest(csrParams)
        const csrPem = csr.getPEM()
        const csrDerBase64 = state.createIncludeDer ? hextob64(csr.tohex()) : undefined

        setCreateOutput({
          csrPem,
          csrDerBase64,
          privateKeyPem: subjectPrivateKeyPem,
        })
        return
      }

      let issuerCert: any | null = null
      let signingKey: SigningKey | null = subjectSigner
      let issuerAttrs = subjectAttrs

      if (!state.createSelfSigned) {
        if (!state.createIssuerCertPem.trim() || !state.createIssuerKeyPem.trim()) {
          throw new Error("Issuer certificate and issuer key are required for non-self-signed certificates.")
        }
        const issuerInput = state.createIssuerCertPem.trim()
        const issuerParsed = parseCertificateInput(
          issuerInput,
          issuerInput.includes("BEGIN CERTIFICATE") ? "pem" : "der",
        )
        issuerCert = issuerParsed.certs[0]
        signingKey = parseSigningKey(state.createIssuerKeyPem)
        issuerAttrs = state.createIssuerDn.trim()
          ? parseDnString(state.createIssuerDn)
          : issuerCert.subject.attributes
      }

      if (!signingKey) {
        throw new Error("Signing key is unavailable.")
      }
      if (state.createSelfSigned && state.createKeyType === "dh") {
        throw new Error("DH keys cannot be used to self-sign certificates.")
      }

      const cert = forge.pki.createCertificate()
      cert.publicKey = subjectPublicKey
      cert.serialNumber = normalizeSerialNumber(state.createSerial)
      cert.validity.notBefore = notBeforeDate ?? new Date()
      cert.validity.notAfter = notAfterDate ?? new Date(Date.now() + 365 * 24 * 60 * 60 * 1000)
      cert.setSubject(subjectAttrs)
      cert.setIssuer(issuerAttrs)

      const subjectKeyIdentifier = computeSubjectKeyIdentifier(publicKeyToAsn1(subjectPublicKey))
      const originalGenerateSubjectKeyIdentifier = cert.generateSubjectKeyIdentifier
      cert.generateSubjectKeyIdentifier = () => forge.util.createBuffer(subjectKeyIdentifier)

      const originalPublicKeyToAsn1 = forge.pki.publicKeyToAsn1
      forge.pki.publicKeyToAsn1 = (key: any) => {
        if (key?.type) {
          return publicKeyToAsn1(key as CertPublicKey)
        }
        return originalPublicKeyToAsn1(key)
      }

      try {
        const extensions: any[] = []
        const sanEntries = parseSanEntries(state.createSan)
        if (sanEntries.length) {
          extensions.push({
            name: "subjectAltName",
            altNames: sanEntries,
            critical: state.createSanCritical || undefined,
          })
        }

        const basicConstraints: Record<string, unknown> = {
          name: "basicConstraints",
          cA: state.createIsCa,
          critical: state.createBasicConstraintsCritical || undefined,
        }
        if (state.createIsCa) {
          basicConstraints.pathLenConstraint = state.createPathLen
        }
        extensions.push(basicConstraints)

        const keyUsageKeys = state.createKeyUsage
          .split(",")
          .map((entry) => entry.trim())
          .filter(Boolean)
        if (keyUsageKeys.length) {
          const keyUsage: Record<string, boolean> = {}
          for (const key of keyUsageKeys) keyUsage[key] = true
          extensions.push({ name: "keyUsage", critical: state.createKeyUsageCritical || undefined, ...keyUsage })
        }

        const extKeyUsageKeys = state.createExtKeyUsage
          .split(",")
          .map((entry) => entry.trim())
          .filter(Boolean)
        if (extKeyUsageKeys.length) {
          const extKeyUsage: Record<string, boolean> = {}
          for (const key of extKeyUsageKeys) extKeyUsage[key] = true
          extensions.push({ name: "extKeyUsage", critical: state.createExtKeyUsageCritical || undefined, ...extKeyUsage })
        }

        if (state.createSubjectKeyIdentifier) {
          extensions.push({ name: "subjectKeyIdentifier" })
        }

        if (state.createAuthorityKeyIdentifier) {
          let keyIdentifier: string | boolean = true
          if (issuerCert?.publicKey) {
            try {
              const issuerSpki = forge.pki.publicKeyToAsn1(issuerCert.publicKey)
              keyIdentifier = computeSubjectKeyIdentifier(issuerSpki)
            } catch {
              keyIdentifier = issuerCert?.generateSubjectKeyIdentifier?.().getBytes?.() ?? true
            }
          }
          extensions.push({ name: "authorityKeyIdentifier", keyIdentifier })
        }

        if (state.createCustomExtensions.trim()) {
          let customExtensions: any
          try {
            customExtensions = JSON.parse(state.createCustomExtensions)
          } catch {
            throw new Error("Custom extensions must be valid JSON.")
          }
          if (!Array.isArray(customExtensions)) {
            throw new Error("Custom extensions must be a JSON array.")
          }
          extensions.push(...customExtensions)
        }

        cert.setExtensions(extensions)

        let signatureOid: string
        if (signingKey.kind === "rsa") {
          signatureOid = RSA_SIGNATURE_OIDS[hashAlgorithm]
        } else if (signingKey.kind === "dsa") {
          signatureOid = DSA_SIGNATURE_OIDS[hashAlgorithm]
        } else if (signingKey.kind === "ecdsa") {
          signatureOid = ECDSA_SIGNATURE_OIDS[hashAlgorithm]
        } else if (signingKey.kind === "ed25519") {
          signatureOid = "1.3.101.112"
        } else {
          signatureOid = "1.3.101.113"
        }

        cert.signatureOid = signatureOid
        cert.siginfo.algorithmOid = signatureOid
        cert.tbsCertificate = forge.pki.getTBSCertificate(cert)
        const tbsBytes = forge.asn1.toDer(cert.tbsCertificate).getBytes()
        const tbsBinary = binaryStringToBytes(tbsBytes)

        let signature: string
        if (signingKey.kind === "rsa") {
          const signatureHex = signWithJsrsasign(RSA_SIGNATURE_ALGOS[hashAlgorithm], signingKey.key, tbsBytes)
          signature = forge.util.hexToBytes(signatureHex)
        } else if (signingKey.kind === "dsa") {
          const signatureHex = signWithJsrsasign(DSA_SIGNATURE_ALGOS[hashAlgorithm], signingKey.key, tbsBytes)
          signature = forge.util.hexToBytes(signatureHex)
        } else if (signingKey.kind === "ecdsa") {
          const spec = getEcCurveSpec(signingKey.curve)
          const digest =
            hashAlgorithm === "sha256"
              ? sha256(tbsBinary)
              : hashAlgorithm === "sha384"
                ? sha384(tbsBinary)
                : sha512(tbsBinary)
          const sigBytes = spec.noble.sign(digest, signingKey.privateKey, { prehash: false, format: "der" })
          signature = bytesToBinaryString(sigBytes)
        } else if (signingKey.kind === "ed25519") {
          const sigBytes = ed25519.sign(tbsBinary, signingKey.privateKey)
          signature = bytesToBinaryString(sigBytes)
        } else {
          const sigBytes = ed448.sign(tbsBinary, signingKey.privateKey)
          signature = bytesToBinaryString(sigBytes)
        }

        cert.signature = signature

        const certPem = certificateToPem(cert)
        const privateKeyPem = subjectPrivateKeyPem
        const derBase64 = state.createIncludeDer ? certificateToDerBase64(cert) : undefined
        const pkcs12Base64 = state.createIncludePkcs12
          ? state.createKeyType === "rsa"
            ? createPkcs12Base64(cert, forge.pki.privateKeyFromPem(subjectPrivateKeyPem), state.createPkcs12Password)
            : (() => {
                throw new Error("PKCS#12 output requires an RSA private key.")
              })()
          : undefined

        setCreateOutput({
          certPem,
          privateKeyPem,
          derBase64,
          pkcs12Base64,
        })
      } finally {
        forge.pki.publicKeyToAsn1 = originalPublicKeyToAsn1
        cert.generateSubjectKeyIdentifier = originalGenerateSubjectKeyIdentifier
      }
    } catch (err) {
      console.error(err)
      setCreateError(err instanceof Error ? err.message : "Failed to create certificate.")
    } finally {
      setCreateBusy(false)
    }
  }, [
    state,
    notBeforeDate,
    notAfterDate,
  ])

  const handleSign = React.useCallback(async () => {
    setSignError(null)
    setSignOutput(null)
    setSignBusy(true)

    try {
      const forgeModule = await import("node-forge")
      const forge = forgeModule.default ?? forgeModule
      const { KJUR } = jsrsasign

      const csr = parseCsrInput(state.signCsrInput, state.signCsrFormat)
      if (!csr.publicKey) {
        throw new Error("CSR public key is unsupported.")
      }
      const subjectAttrs = parseDnString(csr.subject)
      if (!subjectAttrs.length) {
        throw new Error("CSR subject is required.")
      }
      if (!state.signIssuerCertPem.trim() || !state.signIssuerKeyPem.trim()) {
        throw new Error("Issuer certificate and issuer key are required.")
      }

      const issuerInput = state.signIssuerCertPem.trim()
      const issuerParsed = parseCertificateInput(
        issuerInput,
        issuerInput.includes("BEGIN CERTIFICATE") ? "pem" : "der",
      )
      const issuerCert = issuerParsed.certs[0]
      if (!issuerCert) {
        throw new Error("Issuer certificate is invalid.")
      }
      const issuerAttrs = state.signIssuerDn.trim()
        ? parseDnString(state.signIssuerDn)
        : issuerCert.subject.attributes

      const signingKey = parseSigningKey(state.signIssuerKeyPem)

      const bytesToBinaryString = (value: Uint8Array) => forge.util.createBuffer(value).getBytes()

      const signWithJsrsasign = (algorithm: string, key: any, tbsBytes: string) => {
        const signer = new KJUR.crypto.Signature({ alg: algorithm })
        signer.init(key)
        signer.updateHex(forge.util.bytesToHex(tbsBytes))
        return signer.sign()
      }

      const cert = forge.pki.createCertificate()
      cert.publicKey = csr.publicKey
      cert.serialNumber = normalizeSerialNumber(state.signSerial)
      cert.validity.notBefore = signNotBeforeDate ?? new Date()
      cert.validity.notAfter = signNotAfterDate ?? new Date(Date.now() + 365 * 24 * 60 * 60 * 1000)
      cert.setSubject(subjectAttrs)
      cert.setIssuer(issuerAttrs)

      const subjectKeyIdentifier = computeSubjectKeyIdentifier(publicKeyToAsn1(csr.publicKey))
      const originalGenerateSubjectKeyIdentifier = cert.generateSubjectKeyIdentifier
      cert.generateSubjectKeyIdentifier = () => forge.util.createBuffer(subjectKeyIdentifier)

      const originalPublicKeyToAsn1 = forge.pki.publicKeyToAsn1
      forge.pki.publicKeyToAsn1 = (key: any) => {
        if (key?.type) {
          return publicKeyToAsn1(key as CertPublicKey)
        }
        return originalPublicKeyToAsn1(key)
      }

      try {
        const extensions: any[] = []

        if (state.signUseCsrExtensions && csr.extreq.length) {
          for (const ext of csr.extreq) {
            if (ext.extname === "subjectAltName" && Array.isArray(ext.array)) {
              const altNames = ext.array
                .map((entry: any) => {
                  if (entry.dns) return { type: 2, value: entry.dns }
                  if (entry.ip) return { type: 7, ip: entry.ip }
                  if (entry.uri) return { type: 6, value: entry.uri }
                  if (entry.rfc822) return { type: 1, value: entry.rfc822 }
                  if (entry.dn?.str) return { type: 4, value: entry.dn.str }
                  return null
                })
                .filter(Boolean)
              if (altNames.length) {
                extensions.push({
                  name: "subjectAltName",
                  altNames,
                  critical: ext.critical || undefined,
                })
              }
              continue
            }
            if (ext.extname === "keyUsage" && Array.isArray(ext.names)) {
              const keyUsage: Record<string, boolean> = {}
              for (const name of ext.names) {
                if (typeof name === "string" && name) {
                  keyUsage[name] = true
                }
              }
              if (Object.keys(keyUsage).length) {
                extensions.push({ name: "keyUsage", critical: ext.critical || undefined, ...keyUsage })
              }
              continue
            }
            if (ext.extname === "extKeyUsage" && Array.isArray(ext.array)) {
              const extKeyUsage: Record<string, boolean> = {}
              for (const name of ext.array) {
                if (typeof name === "string" && name) {
                  extKeyUsage[name] = true
                }
              }
              if (Object.keys(extKeyUsage).length) {
                extensions.push({ name: "extKeyUsage", critical: ext.critical || undefined, ...extKeyUsage })
              }
              continue
            }
            if (ext.extname === "basicConstraints") {
              const basicConstraints: Record<string, unknown> = {
                name: "basicConstraints",
                cA: Boolean(ext.cA),
                critical: ext.critical || undefined,
              }
              if (ext.pathLen !== undefined) {
                basicConstraints.pathLenConstraint = ext.pathLen
              }
              extensions.push(basicConstraints)
              continue
            }
          }
        }

        if (!extensions.some((ext) => ext.name === "subjectKeyIdentifier")) {
          extensions.push({ name: "subjectKeyIdentifier" })
        }

        let keyIdentifier: string | boolean = true
        if (issuerCert?.publicKey) {
          try {
            const issuerSpki = forge.pki.publicKeyToAsn1(issuerCert.publicKey)
            keyIdentifier = computeSubjectKeyIdentifier(issuerSpki)
          } catch {
            keyIdentifier = issuerCert?.generateSubjectKeyIdentifier?.().getBytes?.() ?? true
          }
        }
        extensions.push({ name: "authorityKeyIdentifier", keyIdentifier })

        if (extensions.length) {
          cert.setExtensions(extensions)
        }

        const hashAlgorithm = state.signHash as keyof typeof RSA_SIGNATURE_OIDS
        let signatureOid: string
        if (signingKey.kind === "rsa") {
          signatureOid = RSA_SIGNATURE_OIDS[hashAlgorithm]
        } else if (signingKey.kind === "dsa") {
          signatureOid = DSA_SIGNATURE_OIDS[hashAlgorithm]
        } else if (signingKey.kind === "ecdsa") {
          signatureOid = ECDSA_SIGNATURE_OIDS[hashAlgorithm]
        } else if (signingKey.kind === "ed25519") {
          signatureOid = "1.3.101.112"
        } else {
          signatureOid = "1.3.101.113"
        }

        cert.signatureOid = signatureOid
        cert.siginfo.algorithmOid = signatureOid
        cert.tbsCertificate = forge.pki.getTBSCertificate(cert)
        const tbsBytes = forge.asn1.toDer(cert.tbsCertificate).getBytes()
        const tbsBinary = binaryStringToBytes(tbsBytes)

        let signature: string
        if (signingKey.kind === "rsa") {
          const signatureHex = signWithJsrsasign(RSA_SIGNATURE_ALGOS[hashAlgorithm], signingKey.key, tbsBytes)
          signature = forge.util.hexToBytes(signatureHex)
        } else if (signingKey.kind === "dsa") {
          const signatureHex = signWithJsrsasign(DSA_SIGNATURE_ALGOS[hashAlgorithm], signingKey.key, tbsBytes)
          signature = forge.util.hexToBytes(signatureHex)
        } else if (signingKey.kind === "ecdsa") {
          const spec = getEcCurveSpec(signingKey.curve)
          const digest =
            hashAlgorithm === "sha256"
              ? sha256(tbsBinary)
              : hashAlgorithm === "sha384"
                ? sha384(tbsBinary)
                : sha512(tbsBinary)
          const sigBytes = spec.noble.sign(digest, signingKey.privateKey, { prehash: false, format: "der" })
          signature = bytesToBinaryString(sigBytes)
        } else if (signingKey.kind === "ed25519") {
          const sigBytes = ed25519.sign(tbsBinary, signingKey.privateKey)
          signature = bytesToBinaryString(sigBytes)
        } else {
          const sigBytes = ed448.sign(tbsBinary, signingKey.privateKey)
          signature = bytesToBinaryString(sigBytes)
        }

        cert.signature = signature

        const certPem = certificateToPem(cert)
        const derBase64 = state.signIncludeDer ? certificateToDerBase64(cert) : undefined

        setSignOutput({
          certPem,
          derBase64,
        })
      } finally {
        forge.pki.publicKeyToAsn1 = originalPublicKeyToAsn1
        cert.generateSubjectKeyIdentifier = originalGenerateSubjectKeyIdentifier
      }
    } catch (err) {
      console.error(err)
      setSignError(err instanceof Error ? err.message : "Failed to sign certificate.")
    } finally {
      setSignBusy(false)
    }
  }, [state, signNotBeforeDate, signNotAfterDate])

  React.useEffect(() => {
    if (!state.viewInput.trim()) {
      setViewSummaries([])
      setViewCerts([])
      setViewCsrData(null)
      setViewPrivateKeyDer(null)
      setViewKeyOutputs(null)
      setViewError(null)
      return
    }

    setViewBusy(true)
    setViewError(null)

    const parse = async () => {
      try {
        const format = state.viewFormat as X509InputFormat
        const trimmed = state.viewInput.trim()
        const looksLikeCsr =
          format !== "pkcs12" && /BEGIN (NEW )?CERTIFICATE REQUEST/.test(trimmed)

        if (looksLikeCsr) {
          const csr = parseCsrInput(trimmed, format === "der" ? "der" : "pem")
          setViewSummaries([buildCsrSummary(csr)])
          setViewCerts([])
          setViewCsrData({ pem: csr.pem, derBase64: csr.derBase64, publicKeyPem: csr.publicKeyPem })
          setViewPrivateKeyDer(null)
          setViewKeyOutputs(null)
          if (state.viewSelectedIndex !== 0) {
            setParam("viewSelectedIndex", 0, true)
          }
          setViewError(null)
          return
        }

        try {
          const parsed = await parseX509Certificates(trimmed, format, state.viewPassword)
          const summaries = parsed.certs.map((cert) => buildX509Summary(cert))
          setViewSummaries(summaries)
          setViewCerts(parsed.certs)
          setViewCsrData(null)
          setViewPrivateKeyDer(parsed.privateKey ?? null)
          setViewKeyOutputs(null)
          if (state.viewSelectedIndex >= summaries.length) {
            setParam("viewSelectedIndex", 0, true)
          }
          setViewError(null)
        } catch (certErr) {
          if (format !== "pkcs12") {
            const csr = parseCsrInput(trimmed, format === "der" ? "der" : "pem")
            setViewSummaries([buildCsrSummary(csr)])
            setViewCerts([])
            setViewCsrData({ pem: csr.pem, derBase64: csr.derBase64, publicKeyPem: csr.publicKeyPem })
            setViewPrivateKeyDer(null)
            setViewKeyOutputs(null)
            if (state.viewSelectedIndex !== 0) {
              setParam("viewSelectedIndex", 0, true)
            }
            setViewError(null)
            return
          }
          throw certErr
        }
      } catch (err) {
        console.error(err)
        setViewSummaries([])
        setViewCerts([])
        setViewCsrData(null)
        setViewPrivateKeyDer(null)
        setViewKeyOutputs(null)
        setViewError(err instanceof Error ? err.message : "Failed to parse certificate.")
      } finally {
        setViewBusy(false)
      }
    }

    void parse()
  }, [state.viewInput, state.viewFormat, state.viewPassword, setParam])

  React.useEffect(() => {
    if (!viewSummaries.length) {
      setViewKeyOutputs(null)
      return
    }

    let cancelled = false

    const update = async () => {
      try {
        const selected = viewSummaries[state.viewSelectedIndex] ?? viewSummaries[0]
        if (!selected) {
          if (!cancelled) setViewKeyOutputs(null)
          return
        }
        const outputs: { publicKey?: ViewKeyOutput; privateKey?: ViewKeyOutput } = {}

        if (selected.kind === "csr" && viewCsrData?.publicKeyPem) {
          outputs.publicKey = buildPublicKeyOutputs(viewCsrData.publicKeyPem)
        } else if (selected.kind === "certificate") {
          const cert = viewCerts[state.viewSelectedIndex] ?? viewCerts[0]
          if (cert) {
            const publicKeyPem = await getPublicKeyPemFromCert(cert)
            if (publicKeyPem) {
              outputs.publicKey = buildPublicKeyOutputs(publicKeyPem)
            }
          }
        }

        const manualKey = state.viewPrivateKeyPem.trim()
        if (manualKey) {
          outputs.privateKey = buildPrivateKeyOutputsFromInput(manualKey)
        } else if (viewPrivateKeyDer) {
          outputs.privateKey = buildPrivateKeyOutputsFromDer(viewPrivateKeyDer)
        }

        if (!cancelled) {
          setViewKeyOutputs(Object.keys(outputs).length ? outputs : null)
        }
      } catch (err) {
        console.error(err)
        if (!cancelled) {
          setViewKeyOutputs(null)
        }
      }
    }

    void update()

    return () => {
      cancelled = true
    }
  }, [
    viewSummaries,
    viewCerts,
    viewCsrData,
    viewPrivateKeyDer,
    state.viewPrivateKeyPem,
    state.viewSelectedIndex,
  ])

  const handleValidate = React.useCallback(async () => {
    setValidateError(null)
    setValidateResult(null)
    setValidateBusy(true)

    try {
      const parsed = await parseX509Certificates(
        state.validateInput,
        state.validateFormat as X509InputFormat,
        state.validatePassword,
      )
      const chain = parsed.certs
      const leaf = chain[0]
      if (!leaf) throw new Error("No certificate found to validate.")

      const now = new Date()
      const timeValid = now >= leaf.notBefore && now <= leaf.notAfter

      let chainValid: boolean | null = null
      let signatureValid: boolean | null = null
      const errors: string[] = []

      const verifyWithKey = async (cert: X509Certificate, publicKey: X509Certificate["publicKey"]) => {
        try {
          return await cert.verify({ publicKey })
        } catch (err) {
          errors.push(err instanceof Error ? err.message : "Signature validation failed.")
          return null
        }
      }

      if (chain.length > 1) {
        signatureValid = await verifyWithKey(leaf, chain[1].publicKey)
      } else {
        signatureValid = await verifyWithKey(leaf, leaf.publicKey)
      }

      if (state.validateCaBundle.trim()) {
        try {
          const caParsed = await parseX509Certificates(state.validateCaBundle, "pem")
          const caCerts = caParsed.certs
          chainValid = true

          if (chain.length > 1) {
            for (let i = 0; i < chain.length - 1; i += 1) {
              const verified = await verifyWithKey(chain[i], chain[i + 1].publicKey)
              if (verified !== true) {
                chainValid = verified === null ? null : false
                break
              }
            }
          }

          if (chainValid === true) {
            const root = chain[chain.length - 1] ?? leaf
            let rootVerified: boolean | null = false
            for (const caCert of caCerts) {
              const verified = await verifyWithKey(root, caCert.publicKey)
              if (verified === true) {
                rootVerified = true
                break
              }
              if (verified === null) {
                rootVerified = null
              }
            }
            if (rootVerified !== true) {
              chainValid = rootVerified
            }
          }
        } catch (err) {
          chainValid = false
          errors.push(err instanceof Error ? err.message : "Certificate chain validation failed.")
        }
      }

      if (!timeValid) {
        errors.push("Certificate is outside its validity period.")
      }

      setValidateResult({ timeValid, chainValid, signatureValid, errors })
    } catch (err) {
      console.error(err)
      setValidateError(err instanceof Error ? err.message : "Failed to validate certificate.")
    } finally {
      setValidateBusy(false)
    }
  }, [state.validateInput, state.validateFormat, state.validatePassword, state.validateCaBundle])

  const handleConvert = React.useCallback(async () => {
    setConvertError(null)
    setConvertOutput(null)
    setConvertBusy(true)

    try {
      const parsed = await parseX509Certificates(
        state.convertInput,
        state.convertFormat as X509InputFormat,
        state.convertPassword,
      )
      const cert = parsed.certs[0]
      if (!cert) throw new Error("No certificate found to convert.")

      const output: { pem?: string; der?: string; pkcs12?: string; note?: string } = {}
      if (parsed.certs.length > 1) {
        output.note = `Converted the first certificate (found ${parsed.certs.length}).`
      }

      if (state.convertOutputPem) {
        output.pem = cert.toString("pem")
      }
      if (state.convertOutputDer) {
        output.der = cert.toString("base64")
      }
      if (state.convertOutputPkcs12) {
        let privateKeyDer = parsed.privateKey ?? null
        if (!privateKeyDer && state.convertPrivateKeyPem.trim()) {
          privateKeyDer = parsePrivateKeyPkcs8(state.convertPrivateKeyPem)
        }
        if (!privateKeyDer) {
          throw new Error("PKCS#12 output requires a private key.")
        }
        output.pkcs12 = await createPkcs12Base64Pkijs(cert, privateKeyDer, state.convertP12Password)
      }

      setConvertOutput(output)
    } catch (err) {
      console.error(err)
      setConvertError(err instanceof Error ? err.message : "Failed to convert certificate.")
    } finally {
      setConvertBusy(false)
    }
  }, [
    state.convertInput,
    state.convertFormat,
    state.convertPassword,
    state.convertOutputPem,
    state.convertOutputDer,
    state.convertOutputPkcs12,
    state.convertP12Password,
    state.convertPrivateKeyPem,
  ])

  const handleCopy = async (text: string, setCopied: React.Dispatch<React.SetStateAction<boolean>>) => {
    await navigator.clipboard.writeText(text)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const downloadTextFile = (content: string, filename: string, type = "text/plain") => {
    const blob = new Blob([content], { type })
    downloadBlob(blob, filename)
  }

  const downloadBase64File = (base64: string, filename: string, type = "application/octet-stream") => {
    const binary = atob(base64.replace(/\s+/g, ""))
    const bytes = new Uint8Array(binary.length)
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i)
    }
    const blob = new Blob([bytes], { type })
    downloadBlob(blob, filename)
  }

  const downloadBlob = (blob: Blob, filename: string) => {
    const url = URL.createObjectURL(blob)
    const link = document.createElement("a")
    link.href = url
    link.download = filename
    link.click()
    URL.revokeObjectURL(url)
  }

  const handleCreateZip = async () => {
    if (!createOutput) return
    const JSZip = (await import("jszip")).default
    const zip = new JSZip()
    if (state.createOutputType === "csr") {
      if (state.createIncludePem && createOutput.csrPem) {
        zip.file("request.csr", createOutput.csrPem)
      }
      if (state.createIncludeDer && createOutput.csrDerBase64) {
        zip.file("request.der", atob(createOutput.csrDerBase64), { binary: true })
      }
    } else {
      if (state.createIncludePem && createOutput.certPem) {
        zip.file("certificate.pem", createOutput.certPem)
      }
      if (state.createIncludeDer && createOutput.derBase64) {
        zip.file("certificate.der", atob(createOutput.derBase64), { binary: true })
      }
      if (state.createIncludePkcs12 && createOutput.pkcs12Base64) {
        zip.file("certificate.p12", atob(createOutput.pkcs12Base64), { binary: true })
      }
    }
    zip.file("private-key.pem", createOutput.privateKeyPem)
    const blob = await zip.generateAsync({ type: "blob" })
    downloadBlob(blob, "x509-bundle.zip")
  }

  const handleConvertZip = async () => {
    if (!convertOutput) return
    const JSZip = (await import("jszip")).default
    const zip = new JSZip()
    if (convertOutput.pem) zip.file("certificate.pem", convertOutput.pem)
    if (convertOutput.der) zip.file("certificate.der", atob(convertOutput.der), { binary: true })
    if (convertOutput.pkcs12) zip.file("certificate.p12", atob(convertOutput.pkcs12), { binary: true })
    const blob = await zip.generateAsync({ type: "blob" })
    downloadBlob(blob, "x509-converted.zip")
  }

  const handleViewDownloadAllZip = async () => {
    const JSZip = (await import("jszip")).default
    const zip = new JSZip()
    const isCsrView = selectedViewSummary?.kind === "csr"
    const certFolder = isCsrView ? "csr" : "certificate"

    // Add certificate/CSR files
    if (viewPemOutputs.length > 0) {
      const pem = viewPemOutputs[state.viewSelectedIndex] ?? viewPemOutputs[0]
      const der = viewDerOutputs[state.viewSelectedIndex] ?? viewDerOutputs[0]
      zip.file(`${certFolder}/${isCsrView ? "request" : "certificate"}.pem`, pem)
      if (der) {
        zip.file(`${certFolder}/${isCsrView ? "request" : "certificate"}.der`, atob(der), { binary: true })
      }
    }

    // Add public key files
    if (viewKeyOutputs?.publicKey) {
      const pk = viewKeyOutputs.publicKey
      if (pk.pem) zip.file("public-key/public-key.pem", pk.pem)
      if (pk.derBase64) zip.file("public-key/public-key.der", atob(pk.derBase64), { binary: true })
      if (pk.jwk) zip.file("public-key/public-key.jwk", pk.jwk)
    }

    // Add private key files
    if (viewKeyOutputs?.privateKey) {
      const pk = viewKeyOutputs.privateKey
      if (pk.pem) zip.file("private-key/private-key.pem", pk.pem)
      if (pk.derBase64) zip.file("private-key/private-key.der", atob(pk.derBase64), { binary: true })
      if (pk.jwk) zip.file("private-key/private-key.jwk", pk.jwk)
    }

    const blob = await zip.generateAsync({ type: "blob" })
    downloadBlob(blob, isCsrView ? "x509-csr-bundle.zip" : "x509-certificate-bundle.zip")
  }

  const handleSignZip = async () => {
    if (!signOutput) return
    const JSZip = (await import("jszip")).default
    const zip = new JSZip()
    if (signOutput.certPem) {
      zip.file("certificate.pem", signOutput.certPem)
    }
    if (signOutput.derBase64) {
      zip.file("certificate.der", atob(signOutput.derBase64), { binary: true })
    }
    const blob = await zip.generateAsync({ type: "blob" })
    downloadBlob(blob, "x509-signed-certificate.zip")
  }

  const selectedViewSummary = viewSummaries[state.viewSelectedIndex] ?? viewSummaries[0]
  const isCsr = state.createOutputType === "csr"
  const viewIsCsr = selectedViewSummary?.kind === "csr"
  const isRsaKey = state.createKeyType === "rsa"
  const isEcKey = state.createKeyType === "ec"
  const isEdKey = state.createKeyType === "ed25519" || state.createKeyType === "ed448"
  const isDsaKey = state.createKeyType === "dsa"
  const isDhKey = state.createKeyType === "dh"
  const allowGenerateKey = !isDsaKey && !isDhKey
  const canSelectHash = !state.createSelfSigned || isRsaKey || isEcKey || isDsaKey
  const viewPemOutputs = React.useMemo(() => {
    if (viewCsrData) return [viewCsrData.pem]
    if (viewCerts.length) return viewCerts.map((cert) => cert.toString("pem"))
    return []
  }, [viewCsrData, viewCerts])
  const viewDerOutputs = React.useMemo(() => {
    if (viewCsrData) return [viewCsrData.derBase64]
    if (viewCerts.length) return viewCerts.map((cert) => cert.toString("base64"))
    return []
  }, [viewCsrData, viewCerts])

  return (
    <div className="flex flex-col gap-4">
      <Tabs
        value={state.tab}
        onValueChange={(value) => setParam("tab", value as z.infer<typeof paramsSchema>["tab"], true)}
      >
        <div className="flex items-start justify-between gap-2">
          <ScrollableTabsList>
            <TabsTrigger value="create">Create</TabsTrigger>
            <TabsTrigger value="sign">Sign</TabsTrigger>
            <TabsTrigger value="view">View</TabsTrigger>
            <TabsTrigger value="validate">Validate</TabsTrigger>
            <TabsTrigger value="convert">Convert</TabsTrigger>
          </ScrollableTabsList>
          <Button variant="ghost" size="sm" onClick={handleClearAll} className="h-8 gap-1.5 px-3 text-sm">
            <Trash2 className="h-4 w-4" />
            Clear
          </Button>
        </div>

        <TabsContent value="create" className="mt-4">
          <div className="grid gap-4">
            <Tabs
              value={state.createOutputType}
              onValueChange={(value) =>
                setParam(
                  "createOutputType",
                  value as z.infer<typeof paramsSchema>["createOutputType"],
                  true,
                )
              }
            >
              <ScrollableTabsList>
                <TabsTrigger value="certificate">Certificate</TabsTrigger>
                <TabsTrigger value="csr">Certificate Request (CSR)</TabsTrigger>
              </ScrollableTabsList>
            </Tabs>
            {isCsr && (
              <p className="text-xs text-muted-foreground">
                CSR output ignores issuer, validity, serial, and PKCS#12 options.
              </p>
            )}

            <Card>
              <CardHeader>
                <CardTitle>Subject and Issuer</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {isCsr && (
                  <p className="text-xs text-muted-foreground">
                    CSR output uses the subject and key only. Issuer inputs are ignored.
                  </p>
                )}
                <div className="space-y-2">
                  <Label>Subject DN</Label>
                  <Textarea
                    value={state.createSubjectDn}
                    onChange={(e) => setParam("createSubjectDn", e.target.value)}
                    placeholder="CN=example.com, O=Example, C=US"
                    className="min-h-[90px] font-mono text-xs whitespace-pre-wrap break-all"
                  />
                </div>
                <div className="flex items-center justify-between rounded-md border px-3 py-2">
                  <div>
                    <p className="text-sm font-medium">Self-signed certificate</p>
                    <p className="text-xs text-muted-foreground">Use subject as issuer and sign with the same key.</p>
                  </div>
                  <Switch
                    checked={state.createSelfSigned}
                    onCheckedChange={(checked) => setParam("createSelfSigned", checked, true)}
                    disabled={isCsr}
                  />
                </div>
                {!state.createSelfSigned && !isCsr && (
                  <>
                    <div className="space-y-2">
                      <Label>Issuer DN (optional override)</Label>
                      <Textarea
                        value={state.createIssuerDn}
                        onChange={(e) => setParam("createIssuerDn", e.target.value)}
                        placeholder="Leave empty to use issuer certificate subject."
                        className="min-h-[80px] font-mono text-xs whitespace-pre-wrap break-all"
                      />
                    </div>
                    <div className="grid gap-4 md:grid-cols-2">
                      <div className="space-y-2">
                        <div className="flex items-center justify-between">
                          <Label>Issuer Certificate (PEM or DER Base64)</Label>
                          <UploadButton
                            accept=".pem,.crt,.cer,.der"
                            onChange={handleCreateIssuerCertUpload}
                          />
                        </div>
                        <Textarea
                          value={state.createIssuerCertPem}
                          onChange={(e) => setParam("createIssuerCertPem", e.target.value)}
                          placeholder="-----BEGIN CERTIFICATE-----"
                          className="min-h-[140px] font-mono text-xs whitespace-pre-wrap break-all"
                        />
                      </div>
                      <div className="space-y-2">
                        <div className="flex items-center justify-between">
                          <Label>Issuer Private Key (PEM, DER Base64, or JWK)</Label>
                          <UploadButton
                            accept=".pem,.key,.p8,.der,.json,.jwk"
                            onChange={handleCreateIssuerKeyUpload}
                          />
                        </div>
                        <Textarea
                          value={state.createIssuerKeyPem}
                          onChange={(e) => setParam("createIssuerKeyPem", e.target.value)}
                          placeholder="-----BEGIN PRIVATE KEY----- or JWK JSON"
                          className="min-h-[140px] font-mono text-xs whitespace-pre-wrap break-all"
                        />
                      </div>
                    </div>
                  </>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Key and Validity</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {isCsr && (
                  <p className="text-xs text-muted-foreground">
                    CSR output ignores serial number and validity dates.
                  </p>
                )}
                <div className="grid gap-4 md:grid-cols-3">
                  <div className="space-y-2">
                    <Label>Key Type</Label>
                    <Select
                      value={state.createKeyType}
                      onValueChange={(value) => setParam("createKeyType", value as z.infer<typeof paramsSchema>["createKeyType"], true)}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="rsa">RSA</SelectItem>
                        <SelectItem value="ec">EC (ECDSA)</SelectItem>
                        <SelectItem value="ed25519">Ed25519</SelectItem>
                        <SelectItem value="ed448">Ed448</SelectItem>
                        <SelectItem value="dsa">DSA</SelectItem>
                        <SelectItem value="dh">DH</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Key Mode</Label>
                    <Select
                      value={state.createKeyMode}
                      onValueChange={(value) => setParam("createKeyMode", value as z.infer<typeof paramsSchema>["createKeyMode"], true)}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="generate" disabled={!allowGenerateKey}>Generate</SelectItem>
                        <SelectItem value="provided">Use Existing Key</SelectItem>
                      </SelectContent>
                    </Select>
                    {!allowGenerateKey && (
                      <p className="text-xs text-muted-foreground">DSA and DH keys must be provided.</p>
                    )}
                  </div>
                  <div className="space-y-2">
                    <Label>Key Size</Label>
                    <Input
                      type="number"
                      min={1024}
                      max={8192}
                      value={state.createKeySize}
                      onChange={(e) => setParam("createKeySize", Number.parseInt(e.target.value) || 2048, true)}
                      disabled={state.createKeyMode !== "generate" || !isRsaKey}
                    />
                    {!isRsaKey && (
                      <p className="text-xs text-muted-foreground">
                        {isEdKey
                          ? "Ed25519 and Ed448 use fixed-size keys."
                          : isEcKey
                            ? "EC key size is defined by the curve."
                            : "Key size is defined by the provided key."}
                      </p>
                    )}
                  </div>
                </div>

                {isEcKey && (
                  <div className="space-y-2">
                    <Label>Key Curve</Label>
                    <Select
                      value={state.createEcCurve}
                      onValueChange={(value) => setParam("createEcCurve", value as z.infer<typeof paramsSchema>["createEcCurve"], true)}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {EC_CURVE_OPTIONS.map((option) => (
                          <SelectItem key={option.value} value={option.value}>
                            {option.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {state.createKeyMode === "provided" && (
                      <p className="text-xs text-muted-foreground">Curve must match the provided key.</p>
                    )}
                  </div>
                )}

                {state.createKeyMode === "provided" && (
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <Label>Private Key (PEM, DER Base64, or JWK)</Label>
                      <UploadButton
                        accept=".pem,.key,.p8,.der,.json,.jwk"
                        onChange={handleCreatePrivateKeyUpload}
                      />
                    </div>
                    <Textarea
                      value={state.createPrivateKeyPem}
                      onChange={(e) => setParam("createPrivateKeyPem", e.target.value)}
                      placeholder="-----BEGIN PRIVATE KEY----- or JWK JSON"
                      className="min-h-[160px] font-mono text-xs whitespace-pre-wrap break-all"
                    />
                  </div>
                )}

                <div className="grid gap-4 md:grid-cols-3">
                  <div className="space-y-2">
                    <Label>Serial Number</Label>
                    <Input
                      value={state.createSerial}
                      onChange={(e) => setParam("createSerial", e.target.value)}
                      placeholder="01"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Signature Hash</Label>
                    <Select
                      value={state.createHash}
                      onValueChange={(value) => setParam("createHash", value as z.infer<typeof paramsSchema>["createHash"], true)}
                      disabled={!canSelectHash}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="sha256">SHA-256</SelectItem>
                        <SelectItem value="sha384">SHA-384</SelectItem>
                        <SelectItem value="sha512">SHA-512</SelectItem>
                      </SelectContent>
                    </Select>
                    {state.createSelfSigned && isEdKey && (
                      <p className="text-xs text-muted-foreground">Ed25519 and Ed448 signatures do not use a hash selector.</p>
                    )}
                    {state.createSelfSigned && isDhKey && (
                      <p className="text-xs text-muted-foreground">DH keys cannot sign certificates.</p>
                    )}
                  </div>
                  <div className="space-y-2">
                    <Label>Basic Constraints Critical</Label>
                    <div className="flex items-center gap-2">
                      <Switch
                        checked={state.createBasicConstraintsCritical}
                        onCheckedChange={(checked) => setParam("createBasicConstraintsCritical", checked, true)}
                      />
                      <span className="text-sm text-muted-foreground">Mark basic constraints critical</span>
                    </div>
                  </div>
                </div>

                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label>Not Before</Label>
                    <DateTimePicker
                      date={notBeforeDate}
                      setDate={(date) => setParam("createNotBefore", date ? date.toISOString() : "", true)}
                      buttonLabel={notBeforeDate ? notBeforeDate.toISOString() : "Pick"}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Not After</Label>
                    <DateTimePicker
                      date={notAfterDate}
                      setDate={(date) => setParam("createNotAfter", date ? date.toISOString() : "", true)}
                      buttonLabel={notAfterDate ? notAfterDate.toISOString() : "Pick"}
                    />
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <Switch
                    checked={state.createIsCa}
                    onCheckedChange={(checked) => setParam("createIsCa", checked, true)}
                  />
                  <Label>Certificate Authority (CA)</Label>
                  <Input
                    type="number"
                    min={0}
                    max={32}
                    value={state.createPathLen}
                    onChange={(e) => setParam("createPathLen", Number.parseInt(e.target.value) || 0, true)}
                    disabled={!state.createIsCa}
                    className="w-24"
                  />
                  <span className="text-xs text-muted-foreground">Path Length</span>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Extensions</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label>Subject Alternative Names</Label>
                  <Textarea
                    value={state.createSan}
                    onChange={(e) => setParam("createSan", e.target.value)}
                    placeholder={"DNS:example.com\nIP:127.0.0.1\nURI:https://example.com"}
                    className="min-h-[100px] font-mono text-xs whitespace-pre-wrap break-all"
                  />
                  <div className="flex items-center gap-2">
                    <Switch
                      checked={state.createSanCritical}
                      onCheckedChange={(checked) => setParam("createSanCritical", checked, true)}
                    />
                    <span className="text-xs text-muted-foreground">Mark SAN critical</span>
                  </div>
                </div>

                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label>Key Usage</Label>
                    <div className="grid gap-2 rounded-md border p-3 text-sm">
                      {KEY_USAGE_OPTIONS.map((item) => {
                        const checked = state.createKeyUsage.split(",").includes(item.key)
                        return (
                          <label key={item.key} className="flex items-center gap-2">
                            <Checkbox
                              checked={checked}
                              onCheckedChange={(value) =>
                                updateList("createKeyUsage", state.createKeyUsage, item.key, Boolean(value))
                              }
                            />
                            <span>{item.label}</span>
                          </label>
                        )
                      })}
                      <label className="flex items-center gap-2 text-xs text-muted-foreground">
                        <Switch
                          checked={state.createKeyUsageCritical}
                          onCheckedChange={(checked) => setParam("createKeyUsageCritical", checked, true)}
                        />
                        Mark key usage critical
                      </label>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label>Extended Key Usage</Label>
                    <div className="grid gap-2 rounded-md border p-3 text-sm">
                      {EXT_KEY_USAGE_OPTIONS.map((item) => {
                        const checked = state.createExtKeyUsage.split(",").includes(item.key)
                        return (
                          <label key={item.key} className="flex items-center gap-2">
                            <Checkbox
                              checked={checked}
                              onCheckedChange={(value) =>
                                updateList("createExtKeyUsage", state.createExtKeyUsage, item.key, Boolean(value))
                              }
                            />
                            <span>{item.label}</span>
                          </label>
                        )
                      })}
                      <label className="flex items-center gap-2 text-xs text-muted-foreground">
                        <Switch
                          checked={state.createExtKeyUsageCritical}
                          onCheckedChange={(checked) => setParam("createExtKeyUsageCritical", checked, true)}
                        />
                        Mark extended key usage critical
                      </label>
                    </div>
                  </div>
                </div>

                <div className="grid gap-4 md:grid-cols-2">
                  <label className="flex items-center gap-2 text-sm">
                    <Checkbox
                      checked={state.createSubjectKeyIdentifier}
                      onCheckedChange={(value) => setParam("createSubjectKeyIdentifier", Boolean(value), true)}
                    />
                    Subject Key Identifier
                  </label>
                  <label className="flex items-center gap-2 text-sm">
                    <Checkbox
                      checked={state.createAuthorityKeyIdentifier}
                      onCheckedChange={(value) => setParam("createAuthorityKeyIdentifier", Boolean(value), true)}
                    />
                    Authority Key Identifier
                  </label>
                </div>

                <div className="space-y-2">
                  <Label>Custom Extensions (JSON array)</Label>
                  <Textarea
                    value={state.createCustomExtensions}
                    onChange={(e) => setParam("createCustomExtensions", e.target.value)}
                    placeholder='[{"id":"1.2.3.4","critical":false,"value":"..."}]'
                    className="min-h-[120px] font-mono text-xs whitespace-pre-wrap break-all"
                  />
                  <p className="text-xs text-muted-foreground">
                    Use forge extension objects for advanced OpenSSL-compatible options.
                    {isCsr ? " CSR output ignores custom extensions." : ""}
                  </p>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Output Formats</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex flex-wrap gap-4 text-sm">
                  <label className="flex items-center gap-2">
                    <Checkbox
                      checked={state.createIncludePem}
                      onCheckedChange={(value) => setParam("createIncludePem", Boolean(value), true)}
                    />
                    {isCsr ? "CSR PEM" : "PEM"}
                  </label>
                  <label className="flex items-center gap-2">
                    <Checkbox
                      checked={state.createIncludeDer}
                      onCheckedChange={(value) => setParam("createIncludeDer", Boolean(value), true)}
                    />
                    {isCsr ? "CSR DER (Base64)" : "DER (Base64)"}
                  </label>
                  <label className="flex items-center gap-2">
                    <Checkbox
                      checked={state.createIncludePkcs12}
                      onCheckedChange={(value) => setParam("createIncludePkcs12", Boolean(value), true)}
                      disabled={isCsr || !isRsaKey}
                    />
                    PKCS#12
                  </label>
                  {state.createIncludePkcs12 && isRsaKey && !isCsr && (
                    <Input
                      type="password"
                      placeholder="PKCS#12 Password"
                      value={state.createPkcs12Password}
                      onChange={(e) => setParam("createPkcs12Password", e.target.value)}
                      className="w-60"
                    />
                  )}
                  {!isCsr && !isRsaKey && (
                    <span className="text-xs text-muted-foreground">PKCS#12 output is available for RSA keys only.</span>
                  )}
                </div>

                <div className="flex flex-wrap gap-2">
                  <Button onClick={handleCreate} disabled={createBusy}>
                    {createBusy ? "Creating..." : isCsr ? "Create Request" : "Create Certificate"}
                  </Button>
                  {createOutput && (
                    <>
                      <Button variant="outline" onClick={handleCreateZip}>
                        <Download className="h-4 w-4" />
                        Download ZIP
                      </Button>
                      <Button
                        variant="outline"
                        onClick={() =>
                          handleCopy(
                            isCsr ? (createOutput.csrPem ?? "") : (createOutput.certPem ?? ""),
                            setCreateCopied,
                          )
                        }
                      >
                        {createCopied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                        {isCsr ? "Copy CSR" : "Copy PEM"}
                      </Button>
                    </>
                  )}
                </div>

                {createError && <p className="text-sm text-destructive">{createError}</p>}
                {createOutput && (
                  <div className="grid gap-4 md:grid-cols-2">
                    {state.createIncludePem && (isCsr ? createOutput.csrPem : createOutput.certPem) && (
                      <div className="space-y-2">
                        <Label>{isCsr ? "Certificate Request (PEM)" : "Certificate (PEM)"}</Label>
                        <Textarea
                          value={isCsr ? createOutput.csrPem : createOutput.certPem}
                          readOnly
                          className="min-h-[160px] font-mono text-xs whitespace-pre-wrap break-all"
                        />
                        <div className="flex gap-2">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() =>
                              downloadTextFile(
                                isCsr ? (createOutput.csrPem ?? "") : (createOutput.certPem ?? ""),
                                isCsr ? "request.csr" : "certificate.pem",
                              )
                            }
                          >
                            <Download className="h-4 w-4" />
                            {isCsr ? "Download CSR" : "Download PEM"}
                          </Button>
                        </div>
                      </div>
                    )}
                    <div className="space-y-2">
                      <Label>Private Key (PEM)</Label>
                      <Textarea value={createOutput.privateKeyPem} readOnly className="min-h-[160px] font-mono text-xs whitespace-pre-wrap break-all" />
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => downloadTextFile(createOutput.privateKeyPem, "private-key.pem")}
                      >
                        <Download className="h-4 w-4" />
                        Download Key
                      </Button>
                    </div>
                    {state.createIncludeDer &&
                      (isCsr ? createOutput.csrDerBase64 : createOutput.derBase64) && (
                      <div className="space-y-2">
                        <Label>{isCsr ? "Certificate Request (DER Base64)" : "Certificate (DER Base64)"}</Label>
                        <Textarea
                          value={isCsr ? createOutput.csrDerBase64 : createOutput.derBase64}
                          readOnly
                          className="min-h-[140px] font-mono text-xs whitespace-pre-wrap break-all"
                        />
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() =>
                            downloadBase64File(
                              isCsr ? (createOutput.csrDerBase64 ?? "") : (createOutput.derBase64 ?? ""),
                              isCsr ? "request.der" : "certificate.der",
                            )
                          }
                        >
                          <Download className="h-4 w-4" />
                          {isCsr ? "Download CSR DER" : "Download DER"}
                        </Button>
                      </div>
                    )}
                    {!isCsr && state.createIncludePkcs12 && createOutput.pkcs12Base64 && (
                      <div className="space-y-2">
                        <Label>PKCS#12 (Base64)</Label>
                        <Textarea value={createOutput.pkcs12Base64} readOnly className="min-h-[140px] font-mono text-xs whitespace-pre-wrap break-all" />
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => downloadBase64File(createOutput.pkcs12Base64 ?? "", "certificate.p12")}
                        >
                          <Download className="h-4 w-4" />
                          Download P12
                        </Button>
                      </div>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="sign" className="mt-4">
          <div className="grid gap-4 md:grid-cols-[1.1fr_1fr]">
            <Card>
              <CardHeader>
                <CardTitle>CSR and Issuer</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-3 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label>CSR Format</Label>
                    <Select
                      value={state.signCsrFormat}
                      onValueChange={(value) =>
                        setParam("signCsrFormat", value as z.infer<typeof paramsSchema>["signCsrFormat"], true)
                      }
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="pem">PEM</SelectItem>
                        <SelectItem value="der">DER (Base64)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Use CSR Extensions</Label>
                    <div className="flex items-center gap-2">
                      <Switch
                        checked={state.signUseCsrExtensions}
                        onCheckedChange={(checked) => setParam("signUseCsrExtensions", checked, true)}
                      />
                      <span className="text-xs text-muted-foreground">Include requested extensions in the signed cert.</span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center justify-between">
                  <Label>Certificate Request</Label>
                  <UploadButton
                    accept=".pem,.csr,.der"
                    onChange={handleSignUpload}
                  />
                </div>
                {signFileName && <p className="text-xs text-muted-foreground">{signFileName}</p>}
                <Textarea
                  value={state.signCsrInput}
                  onChange={(e) => setParam("signCsrInput", e.target.value)}
                  placeholder="-----BEGIN CERTIFICATE REQUEST-----"
                  className="min-h-[200px] font-mono text-xs whitespace-pre-wrap break-all"
                />

                <div className="space-y-2">
                  <Label>Issuer DN (optional override)</Label>
                  <Textarea
                    value={state.signIssuerDn}
                    onChange={(e) => setParam("signIssuerDn", e.target.value)}
                    placeholder="Leave empty to use issuer certificate subject."
                    className="min-h-[80px] font-mono text-xs whitespace-pre-wrap break-all"
                  />
                </div>

                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <Label>Issuer Certificate (PEM or DER Base64)</Label>
                      <UploadButton
                        accept=".pem,.crt,.cer,.der"
                        onChange={handleSignIssuerCertUpload}
                      />
                    </div>
                    <Textarea
                      value={state.signIssuerCertPem}
                      onChange={(e) => setParam("signIssuerCertPem", e.target.value)}
                      placeholder="-----BEGIN CERTIFICATE-----"
                      className="min-h-[140px] font-mono text-xs whitespace-pre-wrap break-all"
                    />
                  </div>
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <Label>Issuer Private Key (PEM, DER Base64, or JWK)</Label>
                      <UploadButton
                        accept=".pem,.key,.p8,.der,.json,.jwk"
                        onChange={handleSignIssuerKeyUpload}
                      />
                    </div>
                    <Textarea
                      value={state.signIssuerKeyPem}
                      onChange={(e) => setParam("signIssuerKeyPem", e.target.value)}
                      placeholder="-----BEGIN PRIVATE KEY----- or JWK JSON"
                      className="min-h-[140px] font-mono text-xs whitespace-pre-wrap break-all"
                    />
                  </div>
                </div>

                <div className="grid gap-4 md:grid-cols-3">
                  <div className="space-y-2">
                    <Label>Serial Number</Label>
                    <Input
                      value={state.signSerial}
                      onChange={(e) => setParam("signSerial", e.target.value)}
                      placeholder="01"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Signature Hash</Label>
                    <Select
                      value={state.signHash}
                      onValueChange={(value) => setParam("signHash", value as z.infer<typeof paramsSchema>["signHash"], true)}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="sha256">SHA-256</SelectItem>
                        <SelectItem value="sha384">SHA-384</SelectItem>
                        <SelectItem value="sha512">SHA-512</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label>Not Before</Label>
                    <DateTimePicker
                      date={signNotBeforeDate}
                      setDate={(date) => setParam("signNotBefore", date ? date.toISOString() : "", true)}
                      buttonLabel={signNotBeforeDate ? signNotBeforeDate.toISOString() : "Pick"}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Not After</Label>
                    <DateTimePicker
                      date={signNotAfterDate}
                      setDate={(date) => setParam("signNotAfter", date ? date.toISOString() : "", true)}
                      buttonLabel={signNotAfterDate ? signNotAfterDate.toISOString() : "Pick"}
                    />
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Signed Certificate</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex flex-wrap gap-4 text-sm">
                  <label className="flex items-center gap-2">
                    <Checkbox
                      checked={state.signIncludePem}
                      onCheckedChange={(value) => setParam("signIncludePem", Boolean(value), true)}
                    />
                    PEM
                  </label>
                  <label className="flex items-center gap-2">
                    <Checkbox
                      checked={state.signIncludeDer}
                      onCheckedChange={(value) => setParam("signIncludeDer", Boolean(value), true)}
                    />
                    DER (Base64)
                  </label>
                </div>

                <div className="flex flex-wrap gap-2">
                  <Button onClick={handleSign} disabled={signBusy}>
                    {signBusy ? "Signing..." : "Sign Request"}
                  </Button>
                  {signOutput && (
                    <>
                      <Button variant="outline" onClick={handleSignZip}>
                        <Download className="h-4 w-4" />
                        Download ZIP
                      </Button>
                      <Button
                        variant="outline"
                        onClick={() => handleCopy(signOutput.certPem ?? "", setSignCopied)}
                      >
                        {signCopied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                        Copy PEM
                      </Button>
                    </>
                  )}
                </div>

                {signError && <p className="text-sm text-destructive">{signError}</p>}

                {signOutput && (
                  <div className="grid gap-4">
                    {state.signIncludePem && signOutput.certPem && (
                      <div className="space-y-2">
                        <Label>Certificate (PEM)</Label>
                        <Textarea
                          value={signOutput.certPem}
                          readOnly
                          className="min-h-[160px] font-mono text-xs whitespace-pre-wrap break-all"
                        />
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => downloadTextFile(signOutput.certPem ?? "", "certificate.pem")}
                        >
                          <Download className="h-4 w-4" />
                          Download PEM
                        </Button>
                      </div>
                    )}
                    {state.signIncludeDer && signOutput.derBase64 && (
                      <div className="space-y-2">
                        <Label>Certificate (DER Base64)</Label>
                        <Textarea
                          value={signOutput.derBase64}
                          readOnly
                          className="min-h-[140px] font-mono text-xs whitespace-pre-wrap break-all"
                        />
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => downloadBase64File(signOutput.derBase64 ?? "", "certificate.der")}
                        >
                          <Download className="h-4 w-4" />
                          Download DER
                        </Button>
                      </div>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="view" className="mt-4">
          <div className="grid gap-4">
            <div className="grid gap-4 md:grid-cols-[1.1fr_1fr]">
              <Card className="h-full">
                <CardHeader>
                  <CardTitle>Certificate / CSR Input</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="grid gap-3 md:grid-cols-2">
                    <div className="space-y-2">
                      <Label>Format</Label>
                      <Select
                        value={state.viewFormat}
                        onValueChange={(value) => setParam("viewFormat", value as z.infer<typeof paramsSchema>["viewFormat"], true)}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="pem">PEM</SelectItem>
                          <SelectItem value="der">DER (Base64)</SelectItem>
                          <SelectItem value="pkcs12">PKCS#12 (Base64)</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label>Password (if needed)</Label>
                      <Input
                        type="password"
                        value={state.viewPassword}
                        onChange={(e) => setParam("viewPassword", e.target.value)}
                      />
                    </div>
                  </div>
                  <div className="flex items-center justify-between">
                    <Label>Certificate or CSR</Label>
                    <UploadButton
                      accept=".pem,.crt,.cer,.der,.p12,.pfx,.csr"
                      onChange={handleViewUpload}
                    />
                  </div>
                  {viewFileName && <p className="text-xs text-muted-foreground">{viewFileName}</p>}
                  <Textarea
                    value={state.viewInput}
                    onChange={(e) => setParam("viewInput", e.target.value)}
                    placeholder="Paste certificate or CSR here..."
                    className={cn(
                      "min-h-[220px] font-mono text-xs whitespace-pre-wrap break-all",
                      viewError && "border-destructive",
                    )}
                  />
                  {viewError && <p className="text-sm text-destructive">{viewError}</p>}
                  {viewBusy && <p className="text-xs text-muted-foreground">Parsing...</p>}
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <Label>Private Key (optional, for download)</Label>
                      <UploadButton
                        accept=".pem,.key,.p8,.der,.json,.jwk"
                        onChange={handleViewPrivateKeyUpload}
                      />
                    </div>
                    <Textarea
                      value={state.viewPrivateKeyPem}
                      onChange={(e) => setParam("viewPrivateKeyPem", e.target.value)}
                      placeholder="-----BEGIN PRIVATE KEY----- or JWK JSON"
                      className="min-h-[100px] font-mono text-xs whitespace-pre-wrap break-all"
                    />
                  </div>
                </CardContent>
              </Card>

              <Card className="h-full">
                <CardHeader className="flex flex-row items-center justify-between">
                  <CardTitle>{viewIsCsr ? "CSR Details" : "Certificate Details"}</CardTitle>
                  {selectedViewSummary && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleCopy(selectedViewSummary.extensions, setViewCopied)}
                    >
                      {viewCopied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                      Copy Extensions
                    </Button>
                  )}
                </CardHeader>
                <CardContent className="space-y-3">
                  {viewSummaries.length ? (
                    <>
                      {viewSummaries.length > 1 && (
                        <div className="space-y-2">
                          <Label>Certificate Index</Label>
                          <Select
                            value={String(state.viewSelectedIndex)}
                            onValueChange={(value) => setParam("viewSelectedIndex", Number.parseInt(value, 10) || 0, true)}
                          >
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {viewSummaries.map((_, index) => (
                                <SelectItem key={`cert-${index}`} value={String(index)}>
                                  Certificate {index + 1}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      )}
                      {selectedViewSummary && (
                        <>
                          <InfoRow label="Type" value={selectedViewSummary.kind === "csr" ? "Certificate Signing Request (CSR)" : "Certificate"} />
                          <InfoRow label="Subject" value={selectedViewSummary.subject} />
                          {selectedViewSummary.kind === "certificate" && (
                            <>
                              <InfoRow label="Issuer" value={selectedViewSummary.issuer ?? ""} />
                              <InfoRow label="Serial" value={selectedViewSummary.serial ?? ""} mono />
                              <InfoRow label="Valid From" value={selectedViewSummary.notBefore ?? ""} />
                              <InfoRow label="Valid To" value={selectedViewSummary.notAfter ?? ""} />
                              <InfoRow label="Is CA" value={selectedViewSummary.isCa ? "Yes" : "No"} />
                            </>
                          )}
                          <InfoRow label="Signature Algorithm" value={selectedViewSummary.signatureAlgorithm || "N/A"} />
                          <InfoRow label="Public Key Algorithm" value={selectedViewSummary.publicKeyAlgorithm || "N/A"} />
                          <InfoRow label="SHA-256 Fingerprint" value={selectedViewSummary.fingerprintSha256} mono />
                          <div className="space-y-2">
                            <Label>Extensions</Label>
                            <Textarea value={selectedViewSummary.extensions} readOnly className="min-h-[120px] font-mono text-xs whitespace-pre-wrap break-all" />
                          </div>
                        </>
                      )}
                    </>
                  ) : (
                    <p className="text-sm text-muted-foreground">
                      {state.viewInput.trim()
                        ? "Unable to parse certificate or CSR."
                        : "Paste a certificate or CSR to view details."}
                    </p>
                  )}
                </CardContent>
              </Card>
            </div>

            {(viewKeyOutputs?.publicKey || viewKeyOutputs?.privateKey || viewPemOutputs.length > 0) && (
              <Card>
                <CardHeader className="flex flex-row items-center justify-between">
                  <CardTitle>Downloads</CardTitle>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleViewDownloadAllZip}
                    className="gap-2"
                  >
                    <Download className="h-4 w-4" />
                    Download All as ZIP
                  </Button>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                    {viewPemOutputs.length > 0 && (
                      <div className="space-y-2">
                        <Label>{viewIsCsr ? "CSR" : "Certificate"}</Label>
                        <div className="flex flex-wrap gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => downloadTextFile(viewPemOutputs[state.viewSelectedIndex] ?? viewPemOutputs[0], viewIsCsr ? "request.csr" : "certificate.pem")}
                          >
                            <Download className="h-4 w-4" />
                            PEM
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => downloadBase64File(viewDerOutputs[state.viewSelectedIndex] ?? viewDerOutputs[0], viewIsCsr ? "request.der" : "certificate.der")}
                          >
                            <Download className="h-4 w-4" />
                            DER
                          </Button>
                        </div>
                      </div>
                    )}
                    {viewKeyOutputs?.publicKey && (
                      <div className="space-y-2">
                        <Label>Public Key</Label>
                        <div className="flex flex-wrap gap-2">
                          {viewKeyOutputs.publicKey.pem && (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => downloadTextFile(viewKeyOutputs.publicKey!.pem!, "public-key.pem")}
                            >
                              <Download className="h-4 w-4" />
                              PEM
                            </Button>
                          )}
                          {viewKeyOutputs.publicKey.derBase64 && (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => downloadBase64File(viewKeyOutputs.publicKey!.derBase64!, "public-key.der")}
                            >
                              <Download className="h-4 w-4" />
                              DER
                            </Button>
                          )}
                          {viewKeyOutputs.publicKey.jwk && (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => downloadTextFile(viewKeyOutputs.publicKey!.jwk!, "public-key.jwk", "application/json")}
                            >
                              <Download className="h-4 w-4" />
                              JWK
                            </Button>
                          )}
                        </div>
                      </div>
                    )}
                    {viewKeyOutputs?.privateKey && (
                      <div className="space-y-2">
                        <Label>Private Key</Label>
                        <div className="flex flex-wrap gap-2">
                          {viewKeyOutputs.privateKey.pem && (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => downloadTextFile(viewKeyOutputs.privateKey!.pem!, "private-key.pem")}
                            >
                              <Download className="h-4 w-4" />
                              PEM
                            </Button>
                          )}
                          {viewKeyOutputs.privateKey.derBase64 && (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => downloadBase64File(viewKeyOutputs.privateKey!.derBase64!, "private-key.der")}
                            >
                              <Download className="h-4 w-4" />
                              DER
                            </Button>
                          )}
                          {viewKeyOutputs.privateKey.jwk && (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => downloadTextFile(viewKeyOutputs.privateKey!.jwk!, "private-key.jwk", "application/json")}
                            >
                              <Download className="h-4 w-4" />
                              JWK
                            </Button>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        </TabsContent>

        <TabsContent value="validate" className="mt-4">
          <div className="grid gap-4 md:grid-cols-[1.1fr_1fr]">
            <Card>
              <CardHeader>
                <CardTitle>Certificate to Validate</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="grid gap-3 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label>Format</Label>
                    <Select
                      value={state.validateFormat}
                      onValueChange={(value) => setParam("validateFormat", value as z.infer<typeof paramsSchema>["validateFormat"], true)}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="pem">PEM</SelectItem>
                        <SelectItem value="der">DER (Base64)</SelectItem>
                        <SelectItem value="pkcs12">PKCS#12 (Base64)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Password (if needed)</Label>
                    <Input
                      type="password"
                      value={state.validatePassword}
                      onChange={(e) => setParam("validatePassword", e.target.value)}
                    />
                  </div>
                </div>
                <div className="flex items-center justify-between">
                  <Label>Certificate Chain</Label>
                  <UploadButton
                    accept=".pem,.crt,.cer,.der,.p12,.pfx"
                    onChange={handleValidateUpload}
                  />
                </div>
                {validateFileName && <p className="text-xs text-muted-foreground">{validateFileName}</p>}
                <Textarea
                  value={state.validateInput}
                  onChange={(e) => setParam("validateInput", e.target.value)}
                  placeholder="Paste certificate chain here..."
                  className="min-h-[200px] font-mono text-xs whitespace-pre-wrap break-all"
                />
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label>CA Bundle (PEM, optional)</Label>
                    <UploadButton
                      accept=".pem,.crt,.cer"
                      onChange={handleValidateCaUpload}
                    />
                  </div>
                  <Textarea
                    value={state.validateCaBundle}
                    onChange={(e) => setParam("validateCaBundle", e.target.value)}
                    placeholder="-----BEGIN CERTIFICATE-----"
                    className="min-h-[120px] font-mono text-xs whitespace-pre-wrap break-all"
                  />
                </div>
                <Button onClick={handleValidate} disabled={validateBusy}>
                  {validateBusy ? "Validating..." : "Validate Certificate"}
                </Button>
                {validateError && <p className="text-sm text-destructive">{validateError}</p>}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Validation Results</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {validateResult ? (
                  <>
                    <StatusRow label="Time Valid" ok={validateResult.timeValid} />
                    <StatusRow label="Signature Valid" ok={validateResult.signatureValid} />
                    <StatusRow label="Chain Valid" ok={validateResult.chainValid} />
                    {validateResult.errors.length ? (
                      <div className="space-y-1 text-sm text-destructive">
                        {validateResult.errors.map((err, index) => (
                          <p key={`${err}-${index}`}>{err}</p>
                        ))}
                      </div>
                    ) : (
                      <p className="text-sm text-muted-foreground">No validation errors reported.</p>
                    )}
                  </>
                ) : (
                  <p className="text-sm text-muted-foreground">
                    {state.validateInput.trim()
                      ? "Run validation to see results."
                      : "Paste a certificate to validate."}
                  </p>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="convert" className="mt-4">
          <div className="grid gap-4 md:grid-cols-[1.1fr_1fr]">
            <Card>
              <CardHeader>
                <CardTitle>Convert Certificate</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="grid gap-3 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label>Input Format</Label>
                    <Select
                      value={state.convertFormat}
                      onValueChange={(value) => setParam("convertFormat", value as z.infer<typeof paramsSchema>["convertFormat"], true)}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="pem">PEM</SelectItem>
                        <SelectItem value="der">DER (Base64)</SelectItem>
                        <SelectItem value="pkcs12">PKCS#12 (Base64)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Password (if needed)</Label>
                    <Input
                      type="password"
                      value={state.convertPassword}
                      onChange={(e) => setParam("convertPassword", e.target.value)}
                    />
                  </div>
                </div>
                <div className="flex items-center justify-between">
                  <Label>Certificate</Label>
                  <UploadButton
                    accept=".pem,.crt,.cer,.der,.p12,.pfx"
                    onChange={handleConvertUpload}
                  />
                </div>
                {convertFileName && <p className="text-xs text-muted-foreground">{convertFileName}</p>}
                <Textarea
                  value={state.convertInput}
                  onChange={(e) => setParam("convertInput", e.target.value)}
                  placeholder="Paste certificate here..."
                  className="min-h-[200px] font-mono text-xs whitespace-pre-wrap break-all"
                />

                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label>Private Key (for PKCS#12 output)</Label>
                    <UploadButton
                      accept=".pem,.key,.p8,.der,.json,.jwk"
                      onChange={handleConvertKeyUpload}
                    />
                  </div>
                  <Textarea
                    value={state.convertPrivateKeyPem}
                    onChange={(e) => setParam("convertPrivateKeyPem", e.target.value)}
                    placeholder="-----BEGIN PRIVATE KEY----- or JWK JSON"
                    className="min-h-[120px] font-mono text-xs whitespace-pre-wrap break-all"
                  />
                </div>

                <div className="flex flex-wrap gap-4 text-sm">
                  <label className="flex items-center gap-2">
                    <Checkbox
                      checked={state.convertOutputPem}
                      onCheckedChange={(value) => setParam("convertOutputPem", Boolean(value), true)}
                    />
                    PEM
                  </label>
                  <label className="flex items-center gap-2">
                    <Checkbox
                      checked={state.convertOutputDer}
                      onCheckedChange={(value) => setParam("convertOutputDer", Boolean(value), true)}
                    />
                    DER (Base64)
                  </label>
                  <label className="flex items-center gap-2">
                    <Checkbox
                      checked={state.convertOutputPkcs12}
                      onCheckedChange={(value) => setParam("convertOutputPkcs12", Boolean(value), true)}
                    />
                    PKCS#12
                  </label>
                  {state.convertOutputPkcs12 && (
                    <Input
                      type="password"
                      placeholder="PKCS#12 Password"
                      value={state.convertP12Password}
                      onChange={(e) => setParam("convertP12Password", e.target.value)}
                      className="w-60"
                    />
                  )}
                </div>

                <div className="flex gap-2">
                  <Button onClick={handleConvert} disabled={convertBusy}>
                    {convertBusy ? "Converting..." : "Convert"}
                  </Button>
                  {convertOutput && (
                    <Button variant="outline" onClick={handleConvertZip}>
                      <Download className="h-4 w-4" />
                      Download ZIP
                    </Button>
                  )}
                </div>
                {convertError && <p className="text-sm text-destructive">{convertError}</p>}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Converted Output</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {convertOutput ? (
                  <>
                    {convertOutput.note && <p className="text-xs text-muted-foreground">{convertOutput.note}</p>}
                    {convertOutput.pem && (
                      <div className="space-y-2">
                        <Label>PEM</Label>
                        <Textarea value={convertOutput.pem} readOnly className="min-h-[160px] font-mono text-xs whitespace-pre-wrap break-all" />
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => downloadTextFile(convertOutput.pem ?? "", "certificate.pem")}
                        >
                          <Download className="h-4 w-4" />
                          Download PEM
                        </Button>
                      </div>
                    )}
                    {convertOutput.der && (
                      <div className="space-y-2">
                        <Label>DER (Base64)</Label>
                        <Textarea value={convertOutput.der} readOnly className="min-h-[140px] font-mono text-xs whitespace-pre-wrap break-all" />
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => downloadBase64File(convertOutput.der ?? "", "certificate.der")}
                        >
                          <Download className="h-4 w-4" />
                          Download DER
                        </Button>
                      </div>
                    )}
                    {convertOutput.pkcs12 && (
                      <div className="space-y-2">
                        <Label>PKCS#12 (Base64)</Label>
                        <Textarea value={convertOutput.pkcs12} readOnly className="min-h-[140px] font-mono text-xs whitespace-pre-wrap break-all" />
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => downloadBase64File(convertOutput.pkcs12 ?? "", "certificate.p12")}
                        >
                          <Download className="h-4 w-4" />
                          Download P12
                        </Button>
                      </div>
                    )}
                  </>
                ) : (
                  <p className="text-sm text-muted-foreground">
                    {state.convertInput.trim()
                      ? "Convert the certificate to see outputs."
                      : "Paste a certificate to convert."}
                  </p>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>

      {oversizeKeys.length > 0 && (
        <p className="text-xs text-muted-foreground">
          Some inputs exceed 2 KB and are not synced to the URL.
        </p>
      )}
    </div>
  )
}
