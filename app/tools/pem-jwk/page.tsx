"use client"

import * as React from "react"
import { Suspense } from "react"
import { z } from "zod"
import { ToolPageWrapper, useToolHistoryContext } from "@/components/tool-ui/tool-page-wrapper"
import { DualPaneLayout } from "@/components/tool-ui/dual-pane-layout"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { DEFAULT_URL_SYNC_DEBOUNCE_MS, useUrlSyncedState } from "@/lib/url-state/use-url-synced-state"
import type { HistoryEntry } from "@/lib/history/db"

const algorithmValues = [
  "auto",
  "rsassa-sha256",
  "rsa-pss-sha256",
  "rsa-oaep-sha256",
  "ecdsa-p256",
  "ecdsa-p384",
  "ecdsa-p521",
  "ecdh-p256",
  "ecdh-p384",
  "ecdh-p521",
  "ed25519",
  "ed448",
  "x25519",
  "x448",
] as const

type AlgorithmValue = (typeof algorithmValues)[number]

const paramsSchema = z.object({
  activeSide: z.enum(["left", "right"]).default("left"),
  leftText: z.string().default(""),
  rightText: z.string().default(""),
  algorithm: z.enum(algorithmValues).default("auto"),
})

const algorithmLabels: Record<AlgorithmValue, string> = {
  auto: "Auto detect",
  "rsassa-sha256": "RSASSA-PKCS1-v1_5 (SHA-256)",
  "rsa-pss-sha256": "RSA-PSS (SHA-256)",
  "rsa-oaep-sha256": "RSA-OAEP (SHA-256)",
  "ecdsa-p256": "ECDSA (P-256)",
  "ecdsa-p384": "ECDSA (P-384)",
  "ecdsa-p521": "ECDSA (P-521)",
  "ecdh-p256": "ECDH (P-256)",
  "ecdh-p384": "ECDH (P-384)",
  "ecdh-p521": "ECDH (P-521)",
  ed25519: "Ed25519",
  ed448: "Ed448",
  x25519: "X25519",
  x448: "X448",
}

type HashName = "SHA-256" | "SHA-384" | "SHA-512"
type NamedCurve = "P-256" | "P-384" | "P-521"
type AlgorithmConfig =
  | { name: "RSASSA-PKCS1-v1_5"; hash: HashName }
  | { name: "RSA-PSS"; hash: HashName }
  | { name: "RSA-OAEP"; hash: HashName }
  | { name: "ECDSA"; namedCurve: NamedCurve }
  | { name: "ECDH"; namedCurve: NamedCurve }
  | { name: "Ed25519" }
  | { name: "Ed448" }
  | { name: "X25519" }
  | { name: "X448" }

const algorithmConfigByValue: Record<Exclude<AlgorithmValue, "auto">, AlgorithmConfig> = {
  "rsassa-sha256": { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
  "rsa-pss-sha256": { name: "RSA-PSS", hash: "SHA-256" },
  "rsa-oaep-sha256": { name: "RSA-OAEP", hash: "SHA-256" },
  "ecdsa-p256": { name: "ECDSA", namedCurve: "P-256" },
  "ecdsa-p384": { name: "ECDSA", namedCurve: "P-384" },
  "ecdsa-p521": { name: "ECDSA", namedCurve: "P-521" },
  "ecdh-p256": { name: "ECDH", namedCurve: "P-256" },
  "ecdh-p384": { name: "ECDH", namedCurve: "P-384" },
  "ecdh-p521": { name: "ECDH", namedCurve: "P-521" },
  ed25519: { name: "Ed25519" },
  ed448: { name: "Ed448" },
  x25519: { name: "X25519" },
  x448: { name: "X448" },
}

const pemAutoCandidates: AlgorithmConfig[] = [
  { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
  { name: "RSA-PSS", hash: "SHA-256" },
  { name: "RSA-OAEP", hash: "SHA-256" },
  { name: "ECDSA", namedCurve: "P-256" },
  { name: "ECDSA", namedCurve: "P-384" },
  { name: "ECDSA", namedCurve: "P-521" },
  { name: "ECDH", namedCurve: "P-256" },
  { name: "ECDH", namedCurve: "P-384" },
  { name: "ECDH", namedCurve: "P-521" },
  { name: "Ed25519" },
  { name: "Ed448" },
  { name: "X25519" },
  { name: "X448" },
]

function toPem(buffer: ArrayBuffer, label: "PUBLIC KEY" | "PRIVATE KEY") {
  const bytes = new Uint8Array(buffer)
  let binary = ""
  for (const byte of bytes) {
    binary += String.fromCharCode(byte)
  }
  const base64 = btoa(binary).replace(/(.{64})/g, "$1\n")
  return `-----BEGIN ${label}-----\n${base64}\n-----END ${label}-----`
}

function extractPemBlock(pem: string) {
  const trimmed = pem.trim()
  if (!trimmed) return null
  const match = trimmed.match(/-----BEGIN ([^-]+)-----([\s\S]+?)-----END \1-----/)
  if (!match) return null
  const label = match[1]
  const body = match[2].replace(/\s+/g, "")
  return { label, body }
}

function pemToArrayBuffer(pem: string) {
  const block = extractPemBlock(pem)
  if (!block) return null
  const binary = atob(block.body)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i)
  }
  return { label: block.label, buffer: bytes.buffer }
}

function inferHashFromAlg(value?: string): HashName {
  if (!value) return "SHA-256"
  if (value.includes("384")) return "SHA-384"
  if (value.includes("512")) return "SHA-512"
  return "SHA-256"
}

function inferAlgorithmFromJwk(jwk: JsonWebKey): AlgorithmConfig | null {
  if (jwk.kty === "RSA") {
    const alg = typeof jwk.alg === "string" ? jwk.alg : undefined
    const hash = inferHashFromAlg(alg)
    if (alg?.startsWith("PS")) return { name: "RSA-PSS", hash }
    if (alg?.startsWith("RS")) return { name: "RSASSA-PKCS1-v1_5", hash }
    if (alg?.startsWith("RSA-OAEP")) return { name: "RSA-OAEP", hash }
    return { name: "RSASSA-PKCS1-v1_5", hash }
  }

  if (jwk.kty === "EC") {
    const crv = jwk.crv as NamedCurve | undefined
    if (!crv) return null
    const alg = typeof jwk.alg === "string" ? jwk.alg : undefined
    if (alg?.startsWith("ECDH")) return { name: "ECDH", namedCurve: crv }
    return { name: "ECDSA", namedCurve: crv }
  }

  if (jwk.kty === "OKP") {
    const crv = jwk.crv
    if (crv === "Ed25519") return { name: "Ed25519" }
    if (crv === "Ed448") return { name: "Ed448" }
    if (crv === "X25519") return { name: "X25519" }
    if (crv === "X448") return { name: "X448" }
  }

  return null
}

function getKeyUsages(alg: AlgorithmConfig["name"], isPrivate: boolean): KeyUsage[] {
  if (alg === "RSA-OAEP") return isPrivate ? ["decrypt"] : ["encrypt"]
  if (alg === "ECDH" || alg === "X25519" || alg === "X448") return ["deriveKey", "deriveBits"]
  if (alg === "RSASSA-PKCS1-v1_5" || alg === "RSA-PSS" || alg === "ECDSA" || alg === "Ed25519" || alg === "Ed448") {
    return isPrivate ? ["sign"] : ["verify"]
  }
  return []
}

function getAlgorithmConfig(value: AlgorithmValue, jwk?: JsonWebKey): AlgorithmConfig | null {
  if (value !== "auto") return algorithmConfigByValue[value]
  if (jwk) return inferAlgorithmFromJwk(jwk)
  return null
}

function parseJwkText(value: string): JsonWebKey {
  const trimmed = value.trim()
  if (!trimmed) throw new Error("JWK is empty.")
  let parsed: unknown
  try {
    parsed = JSON.parse(trimmed)
  } catch (error) {
    throw new Error(error instanceof Error ? error.message : "Invalid JSON.")
  }
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new Error("JWK must be a JSON object.")
  }
  const jwk = parsed as JsonWebKey
  if (!jwk.kty) throw new Error("JWK is missing kty.")
  return jwk
}

type ImportAlgorithm = AlgorithmIdentifier | RsaHashedImportParams | EcKeyImportParams

function buildAlgorithmParams(config: AlgorithmConfig): ImportAlgorithm {
  if (config.name === "RSASSA-PKCS1-v1_5" || config.name === "RSA-PSS" || config.name === "RSA-OAEP") {
    return { name: config.name, hash: { name: config.hash } } as RsaHashedImportParams
  }
  if (config.name === "ECDSA" || config.name === "ECDH") {
    return { name: config.name, namedCurve: config.namedCurve } as EcKeyImportParams
  }
  return { name: config.name }
}

async function importPemKey(pem: string, config: AlgorithmConfig, isPrivate: boolean) {
  const parsed = pemToArrayBuffer(pem)
  if (!parsed) throw new Error("PEM block not found.")
  if (
    parsed.label !== "PUBLIC KEY" &&
    parsed.label !== "PRIVATE KEY" &&
    parsed.label.includes("PRIVATE KEY")
  ) {
    throw new Error("Unsupported PEM format. Use PKCS8 for private keys.")
  }
  if (parsed.label !== "PUBLIC KEY" && parsed.label !== "PRIVATE KEY") {
    throw new Error("Unsupported PEM format. Use SPKI public keys or PKCS8 private keys.")
  }
  const format = isPrivate ? "pkcs8" : "spki"
  const algorithm = buildAlgorithmParams(config)
  const usages = getKeyUsages(config.name, isPrivate)
  return crypto.subtle.importKey(format, parsed.buffer, algorithm, true, usages)
}

async function importJwkKey(jwk: JsonWebKey, config: AlgorithmConfig, isPrivate: boolean) {
  const algorithm = buildAlgorithmParams(config)
  const usages = getKeyUsages(config.name, isPrivate)
  return crypto.subtle.importKey("jwk", jwk, algorithm, true, usages)
}

async function convertPemToJwk(pem: string, algorithmValue: AlgorithmValue) {
  if (!globalThis.crypto?.subtle) {
    throw new Error("Web Crypto is unavailable in this browser.")
  }
  const parsed = pemToArrayBuffer(pem)
  if (!parsed) throw new Error("PEM block not found.")
  if (
    parsed.label !== "PUBLIC KEY" &&
    parsed.label !== "PRIVATE KEY" &&
    parsed.label.includes("PRIVATE KEY")
  ) {
    throw new Error("Unsupported PEM format. Use PKCS8 for private keys.")
  }
  if (parsed.label !== "PUBLIC KEY" && parsed.label !== "PRIVATE KEY") {
    throw new Error("Unsupported PEM format. Use SPKI public keys or PKCS8 private keys.")
  }
  const isPrivate = parsed.label === "PRIVATE KEY"

  const config =
    algorithmValue === "auto"
      ? null
      : algorithmConfigByValue[algorithmValue]

  if (config) {
    const key = await importPemKey(pem, config, isPrivate)
    const jwk = await crypto.subtle.exportKey("jwk", key)
    return JSON.stringify(jwk, null, 2)
  }

  for (const candidate of pemAutoCandidates) {
    try {
      const key = await importPemKey(pem, candidate, isPrivate)
      const jwk = await crypto.subtle.exportKey("jwk", key)
      return JSON.stringify(jwk, null, 2)
    } catch {
      // Try next candidate.
    }
  }

  throw new Error("Unable to detect key algorithm. Select one from the list.")
}

async function convertJwkToPem(jwkText: string, algorithmValue: AlgorithmValue) {
  if (!globalThis.crypto?.subtle) {
    throw new Error("Web Crypto is unavailable in this browser.")
  }
  const jwk = parseJwkText(jwkText)
  const isPrivate = Boolean(jwk.d)
  const config = getAlgorithmConfig(algorithmValue, jwk)
  if (!config) {
    throw new Error("Unable to detect key algorithm. Select one from the list.")
  }
  const key = await importJwkKey(jwk, config, isPrivate)
  if (isPrivate) {
    const pkcs8 = await crypto.subtle.exportKey("pkcs8", key)
    return toPem(pkcs8, "PRIVATE KEY")
  }
  const spki = await crypto.subtle.exportKey("spki", key)
  return toPem(spki, "PUBLIC KEY")
}

export default function PemJwkPage() {
  return (
    <Suspense fallback={null}>
      <PemJwkContent />
    </Suspense>
  )
}

function PemJwkContent() {
  const { state, setParam, oversizeKeys, hasUrlParams, hydrationSource } = useUrlSyncedState("pem-jwk", {
    schema: paramsSchema,
    defaults: paramsSchema.parse({}),
    inputSide: {
      sideKey: "activeSide",
      inputKeyBySide: {
        left: "leftText",
        right: "rightText",
      },
    },
  })

  const [leftError, setLeftError] = React.useState<string | null>(null)
  const [rightError, setRightError] = React.useState<string | null>(null)
  const conversionRef = React.useRef(0)

  const handleLeftChange = React.useCallback(
    (value: string) => {
      setParam("leftText", value)
      setParam("activeSide", "left")
    },
    [setParam],
  )

  const handleRightChange = React.useCallback(
    (value: string) => {
      setParam("rightText", value)
      setParam("activeSide", "right")
    },
    [setParam],
  )

  React.useEffect(() => {
    if (state.activeSide !== "left") return
    const input = state.leftText
    const runId = ++conversionRef.current
    if (!input.trim()) {
      setLeftError(null)
      setRightError(null)
      if (state.rightText) {
        setParam("rightText", "")
      }
      return
    }

    void (async () => {
      try {
        const converted = await convertPemToJwk(input, state.algorithm)
        if (conversionRef.current !== runId) return
        setLeftError(null)
        setRightError(null)
        if (converted !== state.rightText) {
          setParam("rightText", converted)
        }
      } catch (error) {
        if (conversionRef.current !== runId) return
        setLeftError(error instanceof Error ? error.message : "Failed to parse PEM.")
        setRightError(null)
      }
    })()
  }, [state.activeSide, state.leftText, state.algorithm, state.rightText, setParam])

  React.useEffect(() => {
    if (state.activeSide !== "right") return
    const input = state.rightText
    const runId = ++conversionRef.current
    if (!input.trim()) {
      setRightError(null)
      setLeftError(null)
      if (state.leftText) {
        setParam("leftText", "")
      }
      return
    }

    void (async () => {
      try {
        const converted = await convertJwkToPem(input, state.algorithm)
        if (conversionRef.current !== runId) return
        setRightError(null)
        setLeftError(null)
        if (converted !== state.leftText) {
          setParam("leftText", converted)
        }
      } catch (error) {
        if (conversionRef.current !== runId) return
        setRightError(error instanceof Error ? error.message : "Failed to parse JWK.")
        setLeftError(null)
      }
    })()
  }, [state.activeSide, state.rightText, state.algorithm, state.leftText, setParam])

  const handleLoadHistory = React.useCallback(
    (entry: HistoryEntry) => {
      const { inputs, params } = entry
      if (inputs.leftText !== undefined) setParam("leftText", inputs.leftText)
      if (inputs.rightText !== undefined) setParam("rightText", inputs.rightText)
      if (params.activeSide) setParam("activeSide", params.activeSide as "left" | "right")
      if (params.algorithm) setParam("algorithm", params.algorithm as AlgorithmValue)
    },
    [setParam],
  )

  return (
    <ToolPageWrapper
      toolId="pem-jwk"
      title="PEM/JWK Converter"
      description="Convert cryptographic keys between PEM and JWK formats using Web Crypto."
      onLoadHistory={handleLoadHistory}
    >
      <PemJwkInner
        state={state}
        setParam={setParam}
        oversizeKeys={oversizeKeys}
        hasUrlParams={hasUrlParams}
        hydrationSource={hydrationSource}
        leftError={leftError}
        rightError={rightError}
        handleLeftChange={handleLeftChange}
        handleRightChange={handleRightChange}
      />
    </ToolPageWrapper>
  )
}

function PemJwkInner({
  state,
  setParam,
  oversizeKeys,
  hasUrlParams,
  hydrationSource,
  leftError,
  rightError,
  handleLeftChange,
  handleRightChange,
}: {
  state: z.infer<typeof paramsSchema>
  setParam: <K extends keyof z.infer<typeof paramsSchema>>(
    key: K,
    value: z.infer<typeof paramsSchema>[K],
    updateHistory?: boolean,
  ) => void
  oversizeKeys: (keyof z.infer<typeof paramsSchema>)[]
  hasUrlParams: boolean
  hydrationSource: "default" | "url" | "history"
  leftError: string | null
  rightError: string | null
  handleLeftChange: (value: string) => void
  handleRightChange: (value: string) => void
}) {
  const { upsertInputEntry, upsertParams } = useToolHistoryContext()
  const lastInputRef = React.useRef<string>("")
  const hasHydratedInputRef = React.useRef(false)
  const paramsRef = React.useRef({ activeSide: state.activeSide, algorithm: state.algorithm })
  const hasInitializedParamsRef = React.useRef(false)
  const hasHandledUrlRef = React.useRef(false)

  const downloadText = React.useCallback((value: string, filename: string) => {
    if (!value) return
    const blob = new Blob([value], { type: "text/plain" })
    const url = URL.createObjectURL(blob)
    const link = document.createElement("a")
    link.href = url
    link.download = filename
    link.click()
    URL.revokeObjectURL(url)
  }, [])

  const handleLeftFileUpload = React.useCallback(
    async (file: File) => {
      const text = await file.text()
      handleLeftChange(text)
    },
    [handleLeftChange],
  )

  const handleRightFileUpload = React.useCallback(
    async (file: File) => {
      const text = await file.text()
      handleRightChange(text)
    },
    [handleRightChange],
  )

  React.useEffect(() => {
    if (hasHydratedInputRef.current) return
    if (hydrationSource === "default") return
    const activeText = state.activeSide === "left" ? state.leftText : state.rightText
    lastInputRef.current = activeText
    hasHydratedInputRef.current = true
  }, [hydrationSource, state.activeSide, state.leftText, state.rightText])

  React.useEffect(() => {
    const activeText = state.activeSide === "left" ? state.leftText : state.rightText
    if (!activeText || activeText === lastInputRef.current) return

    const timer = setTimeout(() => {
      lastInputRef.current = activeText
      upsertInputEntry(
        { leftText: state.leftText, rightText: state.rightText },
        { activeSide: state.activeSide, algorithm: state.algorithm },
        state.activeSide,
        activeText.slice(0, 100),
      )
    }, DEFAULT_URL_SYNC_DEBOUNCE_MS)

    return () => clearTimeout(timer)
  }, [state.leftText, state.rightText, state.activeSide, state.algorithm, upsertInputEntry])

  React.useEffect(() => {
    if (hasUrlParams && !hasHandledUrlRef.current) {
      hasHandledUrlRef.current = true
      const activeText = state.activeSide === "left" ? state.leftText : state.rightText
      if (activeText) {
        upsertInputEntry(
          { leftText: state.leftText, rightText: state.rightText },
          { activeSide: state.activeSide, algorithm: state.algorithm },
          state.activeSide,
          activeText.slice(0, 100),
        )
      } else {
        upsertParams({ activeSide: state.activeSide, algorithm: state.algorithm }, "interpretation")
      }
    }
  }, [hasUrlParams, state.leftText, state.rightText, state.activeSide, state.algorithm, upsertInputEntry, upsertParams])

  React.useEffect(() => {
    const nextParams = { activeSide: state.activeSide, algorithm: state.algorithm }
    if (!hasInitializedParamsRef.current) {
      hasInitializedParamsRef.current = true
      paramsRef.current = nextParams
      return
    }
    if (
      paramsRef.current.activeSide === nextParams.activeSide &&
      paramsRef.current.algorithm === nextParams.algorithm
    ) {
      return
    }
    paramsRef.current = nextParams
    upsertParams(nextParams, "interpretation")
  }, [state.activeSide, state.algorithm, upsertParams])

  const leftWarning = oversizeKeys.includes("leftText")
    ? "Input exceeds 2 KB and is not synced to the URL."
    : null
  const rightWarning = oversizeKeys.includes("rightText")
    ? "Input exceeds 2 KB and is not synced to the URL."
    : null

  return (
    <DualPaneLayout
      leftLabel="PEM"
      rightLabel="JWK"
      leftValue={state.leftText}
      rightValue={state.rightText}
      onLeftChange={handleLeftChange}
      onRightChange={handleRightChange}
      activeSide={state.activeSide}
      leftError={leftError}
      rightError={rightError}
      leftWarning={leftWarning}
      rightWarning={rightWarning}
      leftPlaceholder="Paste PEM (SPKI/PKCS8) key..."
      rightPlaceholder="Paste JWK JSON..."
      leftFileUpload={handleLeftFileUpload}
      rightFileUpload={handleRightFileUpload}
      leftDownload={() => downloadText(state.leftText, "key.pem")}
      rightDownload={() => downloadText(state.rightText, "key.jwk.json")}
    >
      <div className="flex flex-col gap-2">
        <div className="flex items-center gap-3">
          <Label className="w-24 shrink-0 text-sm">Algorithm</Label>
          <div className="min-w-0 flex-1">
            <Select
              value={state.algorithm}
              onValueChange={(value) => setParam("algorithm", value as AlgorithmValue, true)}
            >
              <SelectTrigger className="w-full">
                <SelectValue />
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
        </div>
        <p className="text-xs text-muted-foreground">
          Auto-detect supports RSA, EC, and OKP keys. PKCS1 and SEC1 PEM blocks are not supported.
        </p>
      </div>
    </DualPaneLayout>
  )
}
