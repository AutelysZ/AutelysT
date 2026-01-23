"use client"

import * as React from "react"
import { Suspense } from "react"
import { z } from "zod"
import { ToolPageWrapper, useToolHistoryContext } from "@/components/tool-ui/tool-page-wrapper"
import { DEFAULT_URL_SYNC_DEBOUNCE_MS, useUrlSyncedState } from "@/lib/url-state/use-url-synced-state"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Switch } from "@/components/ui/switch"
import { Checkbox } from "@/components/ui/checkbox"
import { DateTimePicker } from "@/components/ui/date-time-picker"
import { Copy, Check, Download, Upload, Trash2 } from "lucide-react"
import type { HistoryEntry } from "@/lib/history/db"
import { cn } from "@/lib/utils"
import {
  parseDnString,
  parseSanEntries,
  normalizeSerialNumber,
  parseCertificateInput,
  certificateToPem,
  certificateToDerBase64,
  createPkcs12Base64,
  type X509InputFormat,
} from "@/lib/x509/utils"

const paramsSchema = z.object({
  tab: z.enum(["create", "view", "validate", "convert"]).default("create"),

  createSubjectDn: z.string().default("CN=example.com"),
  createIssuerDn: z.string().default(""),
  createSelfSigned: z.coerce.boolean().default(true),
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

  viewInput: z.string().default(""),
  viewFormat: z.enum(["pem", "der", "pkcs12"]).default("pem"),
  viewPassword: z.string().default(""),
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
  certPem: string
  privateKeyPem: string
  derBase64?: string
  pkcs12Base64?: string
}

type ViewSummary = {
  subject: string
  issuer: string
  serial: string
  notBefore: string
  notAfter: string
  isCa: boolean
  fingerprintSha256: string
  extensions: string
}

type ValidationResult = {
  timeValid: boolean
  chainValid: boolean | null
  signatureValid: boolean | null
  errors: string[]
}

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

export default function X509Page() {
  return (
    <Suspense fallback={null}>
      <X509Content />
    </Suspense>
  )
}

function X509Content() {
  const { state, setParam, resetToDefaults, oversizeKeys, hasUrlParams, hydrationSource } = useUrlSyncedState("x509", {
    schema: paramsSchema,
    defaults: paramsSchema.parse({}),
  })

  const handleLoadHistory = React.useCallback(
    (entry: HistoryEntry) => {
      const { inputs, params } = entry
      Object.entries(inputs).forEach(([key, value]) => {
        setParam(key as keyof z.infer<typeof paramsSchema>, value as never)
      })
      Object.entries(params).forEach(([key, value]) => {
        setParam(key as keyof z.infer<typeof paramsSchema>, value as never)
      })
    },
    [setParam],
  )

  return (
    <ToolPageWrapper
      toolId="x509"
      title="X.509"
      description="Create, view, validate, and convert X.509 certificates with PEM, DER, and PKCS#12 support."
      onLoadHistory={handleLoadHistory}
    >
        <X509Inner
          state={state}
          setParam={setParam}
          resetToDefaults={resetToDefaults}
          oversizeKeys={oversizeKeys}
          hasUrlParams={hasUrlParams}
          hydrationSource={hydrationSource}
        />
    </ToolPageWrapper>
  )
}

function X509Inner({
  state,
  setParam,
  resetToDefaults,
  oversizeKeys,
  hasUrlParams,
  hydrationSource,
}: {
  state: z.infer<typeof paramsSchema>
  setParam: <K extends keyof z.infer<typeof paramsSchema>>(
    key: K,
    value: z.infer<typeof paramsSchema>[K],
    immediate?: boolean,
  ) => void
  resetToDefaults: () => void
  oversizeKeys: (keyof z.infer<typeof paramsSchema>)[]
  hasUrlParams: boolean
  hydrationSource: "default" | "url" | "history"
}) {
  const { upsertInputEntry, upsertParams } = useToolHistoryContext()
  const lastSavedRef = React.useRef<string>("")
  const lastParamsRef = React.useRef<string>("")
  const hasHydratedInputRef = React.useRef(false)
  const hasInitializedParamsRef = React.useRef(false)
  const hasHandledUrlRef = React.useRef(false)
  const hasInitializedDatesRef = React.useRef(false)

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
      viewInput: state.viewInput,
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
      state.viewInput,
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
      createKeyMode: state.createKeyMode,
      createKeySize: state.createKeySize,
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
      state.createKeyMode,
      state.createKeySize,
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

  const inputsSnapshot = React.useMemo(() => JSON.stringify(historyInputs), [historyInputs])
  const paramsSnapshot = React.useMemo(() => JSON.stringify(historyParams), [historyParams])
  const hasAnyInput = React.useMemo(
    () => Object.values(historyInputs).some((value) => value.trim().length > 0),
    [historyInputs],
  )
  const historyLabel = React.useMemo(() => {
    if (state.tab === "create") return state.createSubjectDn.trim() || "X.509 create"
    if (state.tab === "view") return state.viewInput.trim().slice(0, 80) || "X.509 view"
    if (state.tab === "validate") return state.validateInput.trim().slice(0, 80) || "X.509 validate"
    return state.convertInput.trim().slice(0, 80) || "X.509 convert"
  }, [state.tab, state.createSubjectDn, state.viewInput, state.validateInput, state.convertInput])

  React.useEffect(() => {
    if (hasHydratedInputRef.current) return
    if (hydrationSource === "default") return
    lastSavedRef.current = inputsSnapshot
    hasHydratedInputRef.current = true
  }, [hydrationSource, inputsSnapshot])

  React.useEffect(() => {
    if (inputsSnapshot === lastSavedRef.current) return

    const timer = setTimeout(() => {
      lastSavedRef.current = inputsSnapshot
      upsertInputEntry(historyInputs, historyParams, "left", historyLabel)
    }, DEFAULT_URL_SYNC_DEBOUNCE_MS)

    return () => clearTimeout(timer)
  }, [inputsSnapshot, historyInputs, historyParams, historyLabel, upsertInputEntry])

  React.useEffect(() => {
    if (hasUrlParams && !hasHandledUrlRef.current) {
      hasHandledUrlRef.current = true
      if (hasAnyInput) {
        upsertInputEntry(historyInputs, historyParams, "left", "X.509")
        return
      }
      upsertParams(historyParams, "deferred")
    }
  }, [hasUrlParams, hasAnyInput, historyInputs, historyParams, upsertInputEntry, upsertParams])

  React.useEffect(() => {
    if (!hasInitializedParamsRef.current) {
      hasInitializedParamsRef.current = true
      lastParamsRef.current = paramsSnapshot
      return
    }
    if (paramsSnapshot === lastParamsRef.current) return
    lastParamsRef.current = paramsSnapshot
    upsertParams(historyParams, "deferred")
  }, [paramsSnapshot, historyParams, upsertParams])

  const [createOutput, setCreateOutput] = React.useState<CreateOutput | null>(null)
  const [createError, setCreateError] = React.useState<string | null>(null)
  const [createBusy, setCreateBusy] = React.useState(false)
  const [createCopied, setCreateCopied] = React.useState(false)

  const [viewSummaries, setViewSummaries] = React.useState<ViewSummary[]>([])
  const [viewError, setViewError] = React.useState<string | null>(null)
  const [viewBusy, setViewBusy] = React.useState(false)
  const [viewCopied, setViewCopied] = React.useState(false)

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
  const [viewFileName, setViewFileName] = React.useState<string | null>(null)
  const [validateFileName, setValidateFileName] = React.useState<string | null>(null)
  const [convertFileName, setConvertFileName] = React.useState<string | null>(null)

  const handleClearAll = React.useCallback(() => {
    const currentTab = state.tab
    resetToDefaults()
    setParam("tab", currentTab, true)
    const now = new Date()
    const later = new Date(now.getTime() + 365 * 24 * 60 * 60 * 1000)
    setParam("createNotBefore", now.toISOString(), true)
    setParam("createNotAfter", later.toISOString(), true)
    setCreateOutput(null)
    setCreateError(null)
    setCreateBusy(false)
    setCreateCopied(false)
    setViewSummaries([])
    setViewError(null)
    setViewBusy(false)
    setViewCopied(false)
    setValidateResult(null)
    setValidateError(null)
    setValidateBusy(false)
    setConvertOutput(null)
    setConvertError(null)
    setConvertBusy(false)
    setViewFileName(null)
    setValidateFileName(null)
    setConvertFileName(null)
  }, [resetToDefaults, setParam, state.tab])

  const notBeforeDate = React.useMemo(() => {
    const date = new Date(state.createNotBefore)
    return Number.isNaN(date.getTime()) ? undefined : date
  }, [state.createNotBefore])
  const notAfterDate = React.useMemo(() => {
    const date = new Date(state.createNotAfter)
    return Number.isNaN(date.getTime()) ? undefined : date
  }, [state.createNotAfter])

  React.useEffect(() => {
    if (hasInitializedDatesRef.current) return
    if (hydrationSource !== "default") return
    if (state.createNotBefore || state.createNotAfter) {
      hasInitializedDatesRef.current = true
      return
    }
    const now = new Date()
    const later = new Date(now.getTime() + 365 * 24 * 60 * 60 * 1000)
    setParam("createNotBefore", now.toISOString(), true)
    setParam("createNotAfter", later.toISOString(), true)
    hasInitializedDatesRef.current = true
  }, [hydrationSource, setParam, state.createNotAfter, state.createNotBefore])

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

  const readFileAsInput = async (file: File, fallback: X509InputFormat) => {
    const inferred = inferFormatFromFilename(file.name) ?? fallback
    if (inferred === "pem") {
      return { format: inferred, content: await file.text() }
    }
    const buffer = await file.arrayBuffer()
    return { format: inferred, content: arrayBufferToBase64(buffer) }
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

  const handleCreateIssuerCertUpload = React.useCallback(
    async (event: React.ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0]
      if (!file) return
      setParam("createIssuerCertPem", await file.text())
    },
    [setParam],
  )

  const handleCreateIssuerKeyUpload = React.useCallback(
    async (event: React.ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0]
      if (!file) return
      setParam("createIssuerKeyPem", await file.text())
    },
    [setParam],
  )

  const handleCreatePrivateKeyUpload = React.useCallback(
    async (event: React.ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0]
      if (!file) return
      setParam("createPrivateKeyPem", await file.text())
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
      setParam("convertPrivateKeyPem", await file.text())
    },
    [setParam],
  )

  const handleCreate = React.useCallback(async () => {
    setCreateError(null)
    setCreateOutput(null)
    setCreateBusy(true)

    try {
      const forgeModule = await import("node-forge")
      const forge = forgeModule.default ?? forgeModule

      const subjectAttrs = parseDnString(state.createSubjectDn)
      if (!subjectAttrs.length) {
        throw new Error("Subject DN is required.")
      }

      let privateKey: any
      let publicKey: any

      if (state.createKeyMode === "generate") {
        const keyPair = await new Promise<any>((resolve, reject) => {
          forge.pki.rsa.generateKeyPair({ bits: state.createKeySize, workers: 2 }, (err: Error, pair: any) => {
            if (err) reject(err)
            else resolve(pair)
          })
        })
        privateKey = keyPair.privateKey
        publicKey = keyPair.publicKey
      } else {
        if (!state.createPrivateKeyPem.trim()) {
          throw new Error("Private key PEM is required when using an existing key.")
        }
        privateKey = forge.pki.privateKeyFromPem(state.createPrivateKeyPem)
        if (!privateKey?.n || !privateKey?.e) {
          throw new Error("Only RSA private keys are supported for custom keys.")
        }
        publicKey = forge.pki.rsa.setPublicKey(privateKey.n, privateKey.e)
      }

      let issuerCert: any | null = null
      let signingKey = privateKey
      let issuerAttrs = subjectAttrs

      if (!state.createSelfSigned) {
        if (!state.createIssuerCertPem.trim() || !state.createIssuerKeyPem.trim()) {
          throw new Error("Issuer certificate and issuer key are required for non-self-signed certificates.")
        }
        issuerCert = forge.pki.certificateFromPem(state.createIssuerCertPem)
        signingKey = forge.pki.privateKeyFromPem(state.createIssuerKeyPem)
        issuerAttrs = state.createIssuerDn.trim()
          ? parseDnString(state.createIssuerDn)
          : issuerCert.subject.attributes
      }

      const cert = forge.pki.createCertificate()
      cert.publicKey = publicKey
      cert.serialNumber = normalizeSerialNumber(state.createSerial)
      cert.validity.notBefore = notBeforeDate ?? new Date()
      cert.validity.notAfter = notAfterDate ?? new Date(Date.now() + 365 * 24 * 60 * 60 * 1000)
      cert.setSubject(subjectAttrs)
      cert.setIssuer(issuerAttrs)

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
        const keyIdentifier =
          issuerCert?.generateSubjectKeyIdentifier?.().getBytes?.() ?? true
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

      const md = forge.md[state.createHash].create()
      cert.sign(signingKey, md)

      const certPem = certificateToPem(cert)
      const privateKeyPem = forge.pki.privateKeyToPem(privateKey)
      const derBase64 = state.createIncludeDer ? certificateToDerBase64(cert) : undefined
      const pkcs12Base64 = state.createIncludePkcs12
        ? createPkcs12Base64(cert, privateKey, state.createPkcs12Password)
        : undefined

      setCreateOutput({
        certPem,
        privateKeyPem,
        derBase64,
        pkcs12Base64,
      })
    } catch (err) {
      setCreateError(err instanceof Error ? err.message : "Failed to create certificate.")
    } finally {
      setCreateBusy(false)
    }
  }, [
    state,
    notBeforeDate,
    notAfterDate,
  ])

  React.useEffect(() => {
    if (!state.viewInput.trim()) {
      setViewSummaries([])
      setViewError(null)
      return
    }

    setViewBusy(true)
    setViewError(null)

    const parse = async () => {
      try {
        const forgeModule = await import("node-forge")
        const forge = forgeModule.default ?? forgeModule
        const parsed = parseCertificateInput(state.viewInput, state.viewFormat as X509InputFormat, state.viewPassword)
        const summaries = parsed.certs.map((cert) => buildViewSummary(forge, cert))
        setViewSummaries(summaries)
        setViewError(null)
      } catch (err) {
        setViewSummaries([])
        setViewError(err instanceof Error ? err.message : "Failed to parse certificate.")
      } finally {
        setViewBusy(false)
      }
    }

    void parse()
  }, [state.viewInput, state.viewFormat, state.viewPassword])

  const handleValidate = React.useCallback(async () => {
    setValidateError(null)
    setValidateResult(null)
    setValidateBusy(true)

    try {
      const forgeModule = await import("node-forge")
      const forge = forgeModule.default ?? forgeModule
      const parsed = parseCertificateInput(state.validateInput, state.validateFormat as X509InputFormat, state.validatePassword)
      const chain = parsed.certs
      const leaf = chain[0]
      if (!leaf) throw new Error("No certificate found to validate.")

      const now = new Date()
      const timeValid = now >= leaf.validity.notBefore && now <= leaf.validity.notAfter

      let chainValid: boolean | null = null
      let signatureValid: boolean | null = null
      const errors: string[] = []

      if (state.validateCaBundle.trim()) {
        const caCerts = parseCertificateInput(state.validateCaBundle, "pem").certs
        const caStore = forge.pki.createCaStore(caCerts)
        try {
          forge.pki.verifyCertificateChain(caStore, chain)
          chainValid = true
        } catch (err) {
          chainValid = false
          errors.push(err instanceof Error ? err.message : "Certificate chain validation failed.")
        }
      }

      if (chain.length > 1) {
        try {
          signatureValid = leaf.verify(chain[1])
        } catch (err) {
          signatureValid = false
          errors.push(err instanceof Error ? err.message : "Signature validation failed.")
        }
      } else {
        try {
          signatureValid = leaf.verify(leaf)
        } catch {
          signatureValid = false
        }
      }

      if (!timeValid) {
        errors.push("Certificate is outside its validity period.")
      }

      setValidateResult({ timeValid, chainValid, signatureValid, errors })
    } catch (err) {
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
      const parsed = parseCertificateInput(state.convertInput, state.convertFormat as X509InputFormat, state.convertPassword)
      const cert = parsed.certs[0]
      if (!cert) throw new Error("No certificate found to convert.")

      const output: { pem?: string; der?: string; pkcs12?: string; note?: string } = {}
      if (parsed.certs.length > 1) {
        output.note = `Converted the first certificate (found ${parsed.certs.length}).`
      }

      if (state.convertOutputPem) {
        output.pem = certificateToPem(cert)
      }
      if (state.convertOutputDer) {
        output.der = certificateToDerBase64(cert)
      }
      if (state.convertOutputPkcs12) {
        let privateKey = parsed.privateKey
        if (!privateKey && state.convertPrivateKeyPem.trim()) {
          const forgeModule = await import("node-forge")
          const forge = forgeModule.default ?? forgeModule
          privateKey = forge.pki.privateKeyFromPem(state.convertPrivateKeyPem)
        }
        if (!privateKey) {
          throw new Error("PKCS#12 output requires a private key.")
        }
        output.pkcs12 = createPkcs12Base64(cert, privateKey, state.convertP12Password)
      }

      setConvertOutput(output)
    } catch (err) {
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
    if (state.createIncludePem) {
      zip.file("certificate.pem", createOutput.certPem)
    }
    zip.file("private-key.pem", createOutput.privateKeyPem)
    if (state.createIncludeDer && createOutput.derBase64) {
      zip.file("certificate.der", atob(createOutput.derBase64), { binary: true })
    }
    if (state.createIncludePkcs12 && createOutput.pkcs12Base64) {
      zip.file("certificate.p12", atob(createOutput.pkcs12Base64), { binary: true })
    }
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

  const selectedViewSummary = viewSummaries[state.viewSelectedIndex]

  return (
    <div className="flex flex-col gap-4">
      <Tabs
        value={state.tab}
        onValueChange={(value) => setParam("tab", value as z.infer<typeof paramsSchema>["tab"], true)}
      >
        <div className="flex items-start justify-between gap-2">
          <ScrollableTabsList>
            <TabsTrigger value="create">Create</TabsTrigger>
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
            <Card>
              <CardHeader>
                <CardTitle>Subject and Issuer</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
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
                  />
                </div>
                {!state.createSelfSigned && (
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
                          <Label>Issuer Certificate (PEM)</Label>
                          <UploadButton
                            accept=".pem,.crt,.cer"
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
                          <Label>Issuer Private Key (PEM)</Label>
                          <UploadButton
                            accept=".pem,.key,.p8"
                            onChange={handleCreateIssuerKeyUpload}
                          />
                        </div>
                        <Textarea
                          value={state.createIssuerKeyPem}
                          onChange={(e) => setParam("createIssuerKeyPem", e.target.value)}
                          placeholder="-----BEGIN PRIVATE KEY-----"
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
                <div className="grid gap-4 md:grid-cols-2">
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
                        <SelectItem value="generate">Generate RSA</SelectItem>
                        <SelectItem value="provided">Use Existing Key</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Key Size</Label>
                    <Input
                      type="number"
                      min={1024}
                      max={8192}
                      value={state.createKeySize}
                      onChange={(e) => setParam("createKeySize", Number.parseInt(e.target.value) || 2048, true)}
                      disabled={state.createKeyMode !== "generate"}
                    />
                  </div>
                </div>

                {state.createKeyMode === "provided" && (
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <Label>Private Key (PEM)</Label>
                      <UploadButton
                        accept=".pem,.key,.p8"
                        onChange={handleCreatePrivateKeyUpload}
                      />
                    </div>
                    <Textarea
                      value={state.createPrivateKeyPem}
                      onChange={(e) => setParam("createPrivateKeyPem", e.target.value)}
                      placeholder="-----BEGIN PRIVATE KEY-----"
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
                  </p>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Outputs</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex flex-wrap gap-4 text-sm">
                  <label className="flex items-center gap-2">
                    <Checkbox
                      checked={state.createIncludePem}
                      onCheckedChange={(value) => setParam("createIncludePem", Boolean(value), true)}
                    />
                    PEM
                  </label>
                  <label className="flex items-center gap-2">
                    <Checkbox
                      checked={state.createIncludeDer}
                      onCheckedChange={(value) => setParam("createIncludeDer", Boolean(value), true)}
                    />
                    DER (Base64)
                  </label>
                  <label className="flex items-center gap-2">
                    <Checkbox
                      checked={state.createIncludePkcs12}
                      onCheckedChange={(value) => setParam("createIncludePkcs12", Boolean(value), true)}
                    />
                    PKCS#12
                  </label>
                  {state.createIncludePkcs12 && (
                    <Input
                      type="password"
                      placeholder="PKCS#12 Password"
                      value={state.createPkcs12Password}
                      onChange={(e) => setParam("createPkcs12Password", e.target.value)}
                      className="w-60"
                    />
                  )}
                </div>

                <div className="flex flex-wrap gap-2">
                  <Button onClick={handleCreate} disabled={createBusy}>
                    {createBusy ? "Creating..." : "Create Certificate"}
                  </Button>
                  {createOutput && (
                    <>
                      <Button variant="outline" onClick={handleCreateZip}>
                        <Download className="h-4 w-4" />
                        Download ZIP
                      </Button>
                      <Button
                        variant="outline"
                        onClick={() => handleCopy(createOutput.certPem, setCreateCopied)}
                      >
                        {createCopied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                        Copy PEM
                      </Button>
                    </>
                  )}
                </div>

                {createError && <p className="text-sm text-destructive">{createError}</p>}
                {createOutput && (
                  <div className="grid gap-4 md:grid-cols-2">
                    {state.createIncludePem && (
                      <div className="space-y-2">
                        <Label>Certificate (PEM)</Label>
                        <Textarea value={createOutput.certPem} readOnly className="min-h-[160px] font-mono text-xs whitespace-pre-wrap break-all" />
                        <div className="flex gap-2">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => downloadTextFile(createOutput.certPem, "certificate.pem")}
                          >
                            <Download className="h-4 w-4" />
                            Download PEM
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
                    {state.createIncludeDer && createOutput.derBase64 && (
                      <div className="space-y-2">
                        <Label>Certificate (DER Base64)</Label>
                        <Textarea value={createOutput.derBase64} readOnly className="min-h-[140px] font-mono text-xs whitespace-pre-wrap break-all" />
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => downloadBase64File(createOutput.derBase64 ?? "", "certificate.der")}
                        >
                          <Download className="h-4 w-4" />
                          Download DER
                        </Button>
                      </div>
                    )}
                    {state.createIncludePkcs12 && createOutput.pkcs12Base64 && (
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

        <TabsContent value="view" className="mt-4">
          <div className="grid gap-4 md:grid-cols-[1.1fr_1fr]">
            <Card className="h-full">
              <CardHeader>
                <CardTitle>Certificate Input</CardTitle>
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
                  <Label>Certificate</Label>
                  <UploadButton
                    accept=".pem,.crt,.cer,.der,.p12,.pfx"
                    onChange={handleViewUpload}
                  />
                </div>
                {viewFileName && <p className="text-xs text-muted-foreground">{viewFileName}</p>}
                <Textarea
                  value={state.viewInput}
                  onChange={(e) => setParam("viewInput", e.target.value)}
                  placeholder="Paste certificate here..."
                  className={cn(
                    "min-h-[220px] font-mono text-xs whitespace-pre-wrap break-all",
                    viewError && "border-destructive",
                  )}
                />
                {viewError && <p className="text-sm text-destructive">{viewError}</p>}
                {viewBusy && <p className="text-xs text-muted-foreground">Parsing certificate...</p>}
              </CardContent>
            </Card>

            <Card className="h-full">
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle>Details</CardTitle>
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
                        <InfoRow label="Subject" value={selectedViewSummary.subject} />
                        <InfoRow label="Issuer" value={selectedViewSummary.issuer} />
                        <InfoRow label="Serial" value={selectedViewSummary.serial} mono />
                        <InfoRow label="Valid From" value={selectedViewSummary.notBefore} />
                        <InfoRow label="Valid To" value={selectedViewSummary.notAfter} />
                        <InfoRow label="Is CA" value={selectedViewSummary.isCa ? "Yes" : "No"} />
                        <InfoRow label="SHA-256" value={selectedViewSummary.fingerprintSha256} mono />
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
                      ? "Unable to parse certificate."
                      : "Paste a certificate to view details."}
                  </p>
                )}
              </CardContent>
            </Card>
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
                      accept=".pem,.key,.p8"
                      onChange={handleConvertKeyUpload}
                    />
                  </div>
                  <Textarea
                    value={state.convertPrivateKeyPem}
                    onChange={(e) => setParam("convertPrivateKeyPem", e.target.value)}
                    placeholder="-----BEGIN PRIVATE KEY-----"
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

function InfoRow({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="flex flex-col gap-1">
      <span className="text-xs text-muted-foreground">{label}</span>
      <span className={cn("text-sm break-all", mono && "font-mono")}>{value}</span>
    </div>
  )
}

function ScrollableTabsList({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={cn("min-w-0 flex-1", className)}>
      <TabsList className="inline-flex h-auto max-w-full flex-wrap items-center justify-start gap-1 [&_[data-slot=tabs-trigger]]:flex-none [&_[data-slot=tabs-trigger]]:!text-sm [&_[data-slot=tabs-trigger][data-state=active]]:border-border">
        {children}
      </TabsList>
    </div>
  )
}

function StatusRow({ label, ok }: { label: string; ok: boolean | null }) {
  const text =
    ok === null ? "Not checked" : ok ? "Pass" : "Fail"
  const color = ok === null ? "text-muted-foreground" : ok ? "text-emerald-600" : "text-destructive"
  return (
    <div className="flex items-center justify-between rounded-md border px-3 py-2 text-sm">
      <span>{label}</span>
      <span className={color}>{text}</span>
    </div>
  )
}

function UploadButton({
  accept,
  onChange,
  label = "Upload",
}: {
  accept?: string
  onChange: (event: React.ChangeEvent<HTMLInputElement>) => void
  label?: string
}) {
  const inputRef = React.useRef<HTMLInputElement | null>(null)

  const handleClick = React.useCallback(() => {
    inputRef.current?.click()
  }, [])

  const handleChange = React.useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      onChange(event)
      if (inputRef.current) {
        inputRef.current.value = ""
      }
    },
    [onChange],
  )

  return (
    <>
      <input ref={inputRef} type="file" accept={accept} className="hidden" onChange={handleChange} />
      <Button type="button" variant="ghost" size="sm" onClick={handleClick} className="gap-2">
        <Upload className="h-4 w-4" />
        {label}
      </Button>
    </>
  )
}

function buildViewSummary(forge: any, cert: any): ViewSummary {
  const subject = formatDn(cert.subject?.attributes ?? [])
  const issuer = formatDn(cert.issuer?.attributes ?? [])
  const serial = cert.serialNumber ?? ""
  const notBefore = cert.validity?.notBefore?.toISOString?.() ?? ""
  const notAfter = cert.validity?.notAfter?.toISOString?.() ?? ""
  const isCa = Boolean(
    cert.extensions?.find((ext: any) => ext.name === "basicConstraints")?.cA,
  )

  const asn1 = forge.pki.certificateToAsn1(cert)
  const der = forge.asn1.toDer(asn1).getBytes()
  const sha256 = forge.md.sha256.create()
  sha256.update(der)

  return {
    subject,
    issuer,
    serial,
    notBefore,
    notAfter,
    isCa,
    fingerprintSha256: sha256.digest().toHex(),
    extensions: JSON.stringify(cert.extensions ?? [], null, 2),
  }
}

function formatDn(attributes: Array<{ shortName?: string; name?: string; type?: string; value?: string }>) {
  return attributes
    .map((attr) => {
      const label = attr.shortName || attr.name || attr.type || "attr"
      return `${label}=${attr.value ?? ""}`
    })
    .join(", ")
}
