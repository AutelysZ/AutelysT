import * as React from "react";
import {
  AlertCircle,
  Check,
  Copy,
  Download,
  RefreshCcw,
  Trash2,
  Upload,
  X,
} from "lucide-react";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import {
  algorithmValues,
  hmacHashes,
  rsaSchemes,
  rsaHashes,
  ecdsaCurves,
  ecdsaHashes,
  eddsaCurves,
  pqcDsaVariants,
  pqcSlhVariants,
  inputEncodings,
  signatureEncodings,
  keyEncodings,
  pqcKeyEncodings,
  encodingLabels,
  supportsPemForCurve,
  getHmacKeyLength,
  getRsaSaltLength,
  type AlgorithmValue,
  type HmacHash,
  type RsaScheme,
  type RsaHash,
  type EcdsaCurve,
  type EcdsaHash,
  type EddsaCurve,
  type PqcDsaVariant,
  type PqcSlhVariant,
  type InputEncoding,
  type SignatureEncoding,
  type KeyEncoding,
  type PqcKeyEncoding,
  decodeKeyBytes,
  decodeSignatureBytes,
  decodeInputBytes,
} from "./crypto";
import { algorithmLabels, type SignatureState } from "./signature-types";
import {
  getKeyFields,
  getKeySelection,
  getPqcSelectionKey,
} from "./signature-utils";

type SignatureFormProps = {
  state: SignatureState;
  setParam: <K extends keyof SignatureState>(
    key: K,
    value: SignatureState[K],
    immediate?: boolean,
  ) => void;
  oversizeKeys: (keyof SignatureState)[];

  // File References & Handlers
  fileInputRef: React.RefObject<HTMLInputElement | null>;
  handleFileUpload: (event: React.ChangeEvent<HTMLInputElement>) => void;
  handleUploadClick: () => void;
  handleClearFile: () => void;
  fileName: string | null;
  fileMeta: { name: string; size: number } | null;

  // Verify File Ref & Handlers
  verifyFileInputRef: React.RefObject<HTMLInputElement | null>;
  handleVerifyFileUpload: (event: React.ChangeEvent<HTMLInputElement>) => void;
  handleVerifyUploadClick: () => void;
  handleVerifyClearFile: () => void;
  verifyFileMeta: { name: string; size: number } | null;

  // Key Stuff
  privateKeyInputRef: React.RefObject<HTMLInputElement | null>;
  publicKeyInputRef: React.RefObject<HTMLInputElement | null>;
  handleKeyUploadClick: (type: "private" | "public") => void;
  handleKeyFileUpload: (
    type: "private" | "public",
    event: React.ChangeEvent<HTMLInputElement>,
  ) => void;
  handleGenerateKey: () => void;
  handleGenerateKeypair: () => void;
  isGeneratingKeys: boolean;

  // General Handlers
  handleClearAll: () => void;
  handleSign: () => void;
  isSigning: boolean;
  isVerifying: boolean;
  verificationStatus: boolean | null;
  error: string | null;

  // Output Utils
  handleCopyOutput: () => void;
  handleDownloadOutput: () => void;
  copied: boolean;

  inputWarning: string | null;
};

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

export default function SignatureForm({
  state,
  setParam,
  oversizeKeys,
  fileInputRef,
  handleFileUpload,
  handleUploadClick,
  handleClearFile,
  fileName,
  fileMeta,
  verifyFileInputRef,
  handleVerifyFileUpload,
  handleVerifyUploadClick,
  handleVerifyClearFile,
  verifyFileMeta,
  privateKeyInputRef,
  publicKeyInputRef,
  handleKeyUploadClick,
  handleKeyFileUpload,
  handleGenerateKey,
  handleGenerateKeypair,
  isGeneratingKeys,
  handleClearAll,
  handleSign,
  isSigning,
  isVerifying,
  verificationStatus,
  error,
  handleCopyOutput,
  handleDownloadOutput,
  copied,
  inputWarning,
}: SignatureFormProps) {
  const hmacDefaultLength = React.useMemo(
    () => getHmacKeyLength(state.hmacHash),
    [state.hmacHash],
  );

  const hmacKeyWarning = React.useMemo(() => {
    if (!state.hmacKey.trim()) return null;
    try {
      const bytes = decodeKeyBytes(state.hmacKey, state.hmacKeyEncoding);
      if (bytes.length < hmacDefaultLength) {
        return {
          message: `Key length is ${bytes.length} bytes; recommended at least ${hmacDefaultLength} bytes for ${state.hmacHash}.`,
          tone: "warning" as const,
        };
      }
      return null;
    } catch {
      return { message: "Key encoding is invalid.", tone: "error" as const };
    }
  }, [state.hmacKey, state.hmacKeyEncoding, state.hmacHash, hmacDefaultLength]);

  const signatureWarning = React.useMemo(() => {
    if (!state.signature.trim()) return null;
    try {
      decodeSignatureBytes(state.signature, state.signatureEncoding);
      return null;
    } catch {
      return {
        message: `Invalid ${encodingLabels[state.signatureEncoding]} format.`,
        tone: "error" as const,
      };
    }
  }, [state.signature, state.signatureEncoding]);

  const messageWarning = React.useMemo(() => {
    if (!state.message.trim() || fileName) return null;
    try {
      decodeInputBytes(state.message, state.inputEncoding);
      return null;
    } catch {
      return {
        message: `Invalid ${encodingLabels[state.inputEncoding]} format.`,
        tone: "error" as const,
      };
    }
  }, [state.message, state.inputEncoding, fileName]);

  const verifyMessageWarning = React.useMemo(() => {
    if (!state.verifyMessage.trim() || verifyFileMeta) return null;
    try {
      decodeInputBytes(state.verifyMessage, state.verifyInputEncoding);
      return null;
    } catch {
      return {
        message: `Invalid ${encodingLabels[state.verifyInputEncoding]} format.`,
        tone: "error" as const,
      };
    }
  }, [state.verifyMessage, state.verifyInputEncoding, verifyFileMeta]);

  const privateKeyHint = React.useMemo(() => {
    if (state.algorithm === "rsa") return "PEM (PKCS8) or JWK";
    if (state.algorithm === "ecdsa") {
      return supportsPemForCurve(state.ecdsaCurve)
        ? "JWK (EC) or PEM (P-256/P-384/P-521)"
        : "JWK (EC)";
    }
    if (state.algorithm === "eddsa") return "JWK (OKP)";
    if (state.algorithm === "schnorr") return "JWK (EC secp256k1)";
    if (state.algorithm === "ml-dsa" || state.algorithm === "slh-dsa")
      return "PQC JSON or raw key";
    return "";
  }, [state.algorithm, state.ecdsaCurve]);

  const publicKeyHint = React.useMemo(() => {
    if (state.algorithm === "rsa") return "PEM (SPKI) or JWK";
    if (state.algorithm === "ecdsa") {
      return supportsPemForCurve(state.ecdsaCurve)
        ? "JWK (EC) or PEM (P-256/P-384/P-521)"
        : "JWK (EC)";
    }
    if (state.algorithm === "eddsa") return "JWK (OKP)";
    if (state.algorithm === "schnorr") return "JWK (EC secp256k1)";
    if (state.algorithm === "ml-dsa" || state.algorithm === "slh-dsa")
      return "PQC JSON or raw key";
    return "";
  }, [state.algorithm, state.ecdsaCurve]);

  const inputEncodingOptions: InputEncoding[] = fileName
    ? ["binary"]
    : ["utf8", "base64", "hex"];

  const verifyInputEncodingOptions: InputEncoding[] = verifyFileMeta
    ? ["binary"]
    : ["utf8", "base64", "hex"];

  const showHmac = state.algorithm === "hmac";
  const showRsa = state.algorithm === "rsa";
  const showEcdsa = state.algorithm === "ecdsa";
  const showEddsa = state.algorithm === "eddsa";
  const showSchnorr = state.algorithm === "schnorr";
  const showPqcDsa = state.algorithm === "ml-dsa";
  const showPqcSlh = state.algorithm === "slh-dsa";
  const showPqc = showPqcDsa || showPqcSlh;
  const privateKeyPlaceholder = showPqc
    ? "PQC JSON or raw key"
    : "-----BEGIN PRIVATE KEY-----";
  const publicKeyPlaceholder = showPqc
    ? "PQC JSON or raw key"
    : "-----BEGIN PUBLIC KEY-----";

  const keySelection = getKeySelection(state);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-start gap-3">
          <Label className="w-20 shrink-0 text-sm sm:w-28 pt-2">
            Algorithm
          </Label>
          <div className="min-w-0 flex-1 space-y-2">
            <Tabs
              value={state.algorithm}
              onValueChange={(value) =>
                setParam("algorithm", value as AlgorithmValue, true)
              }
              className="min-w-0 flex-1"
            >
              <ScrollableTabsList>
                {algorithmValues.map((value) => (
                  <TabsTrigger key={value} value={value} className="text-xs">
                    {algorithmLabels[value]}
                  </TabsTrigger>
                ))}
              </ScrollableTabsList>
            </Tabs>
          </div>
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={handleClearAll}
          className="h-8 gap-1.5 px-3"
        >
          <Trash2 className="h-3.5 w-3.5" />
          Clear All
        </Button>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="flex flex-col gap-4">
          {showHmac && (
            <div className="space-y-3">
              <div className="flex items-center gap-3">
                <Label className="w-20 text-sm sm:w-28">Hash</Label>
                <Tabs
                  value={state.hmacHash}
                  onValueChange={(value) =>
                    setParam("hmacHash", value as HmacHash, true)
                  }
                >
                  <ScrollableTabsList>
                    {hmacHashes.map((hash) => (
                      <TabsTrigger key={hash} value={hash} className="text-xs">
                        {hash}
                      </TabsTrigger>
                    ))}
                  </ScrollableTabsList>
                </Tabs>
              </div>
              <div className="flex items-start gap-3">
                <Label className="w-20 text-sm sm:w-28">Key</Label>
                <div className="min-w-0 flex-1">
                  <Textarea
                    value={state.hmacKey}
                    onChange={(event) =>
                      setParam("hmacKey", event.target.value)
                    }
                    placeholder="Enter secret key..."
                    className={cn(
                      "min-h-[112px] font-mono text-xs break-all",
                      oversizeKeys.includes("hmacKey") && "border-destructive",
                    )}
                  />
                  <div className="mt-2 flex items-center justify-end gap-2">
                    <Tabs
                      value={state.hmacKeyEncoding}
                      onValueChange={(value) =>
                        setParam("hmacKeyEncoding", value as KeyEncoding, true)
                      }
                      className="flex-row gap-0"
                    >
                      <InlineTabsList className="h-6 gap-1">
                        <TabsTrigger
                          value="utf8"
                          className="text-[10px] sm:text-xs px-2"
                        >
                          {encodingLabels.utf8}
                        </TabsTrigger>
                        <TabsTrigger
                          value="base64"
                          className="text-[10px] sm:text-xs px-2"
                        >
                          {encodingLabels.base64}
                        </TabsTrigger>
                        <TabsTrigger
                          value="hex"
                          className="text-[10px] sm:text-xs px-2"
                        >
                          {encodingLabels.hex}
                        </TabsTrigger>
                      </InlineTabsList>
                    </Tabs>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={handleGenerateKey}
                      className="h-7 w-7 p-0"
                      aria-label="Generate key"
                    >
                      <RefreshCcw className="h-3 w-3" />
                    </Button>
                  </div>
                </div>
              </div>
              {oversizeKeys.includes("hmacKey") && (
                <div className="flex items-start gap-3">
                  <div className="w-20 sm:w-28" />
                  <p className="text-xs text-muted-foreground">
                    Key exceeds 2 KB and is not synced to the URL.
                  </p>
                </div>
              )}
              {hmacKeyWarning && (
                <div className="flex items-start gap-3">
                  <div className="w-20 sm:w-28" />
                  <p
                    className={cn(
                      "text-xs",
                      hmacKeyWarning.tone === "error"
                        ? "text-destructive"
                        : "text-muted-foreground",
                    )}
                  >
                    {hmacKeyWarning.message}
                  </p>
                </div>
              )}
            </div>
          )}

          {showRsa && (
            <div className="space-y-3">
              <div className="flex items-center gap-3">
                <Label className="w-20 text-sm sm:w-28">Scheme</Label>
                <Tabs
                  value={state.rsaScheme}
                  onValueChange={(value) =>
                    setParam("rsaScheme", value as RsaScheme, true)
                  }
                >
                  <ScrollableTabsList>
                    {rsaSchemes.map((scheme) => (
                      <TabsTrigger
                        key={scheme}
                        value={scheme}
                        className="text-xs flex-none"
                      >
                        {scheme}
                      </TabsTrigger>
                    ))}
                  </ScrollableTabsList>
                </Tabs>
              </div>
              <div className="flex items-center gap-3">
                <Label className="w-20 text-sm sm:w-28">Hash</Label>
                <Tabs
                  value={state.rsaHash}
                  onValueChange={(value) =>
                    setParam("rsaHash", value as RsaHash, true)
                  }
                >
                  <ScrollableTabsList>
                    {rsaHashes.map((hash) => (
                      <TabsTrigger key={hash} value={hash} className="text-xs">
                        {hash}
                      </TabsTrigger>
                    ))}
                  </ScrollableTabsList>
                </Tabs>
              </div>
              {state.rsaScheme === "RSA-PSS" && (
                <div className="flex items-center gap-3">
                  <Label className="w-20 text-sm sm:w-28">Salt Length</Label>
                  <Input
                    type="number"
                    min={0}
                    max={1024}
                    value={state.rsaSaltLength}
                    onChange={(event) => {
                      const value = Number.parseInt(event.target.value, 10);
                      setParam(
                        "rsaSaltLength",
                        Number.isNaN(value) ? 0 : value,
                        true,
                      );
                    }}
                    className="h-9 w-28"
                  />
                  <span className="text-xs text-muted-foreground">
                    0 = {getRsaSaltLength(state.rsaHash, 0)} bytes
                  </span>
                </div>
              )}
            </div>
          )}

          {showEcdsa && (
            <div className="space-y-3">
              <div className="flex items-center gap-3">
                <Label className="w-20 text-sm sm:w-28">Curve</Label>
                <Tabs
                  value={state.ecdsaCurve}
                  onValueChange={(value) =>
                    setParam("ecdsaCurve", value as EcdsaCurve, true)
                  }
                >
                  <ScrollableTabsList>
                    {ecdsaCurves.map((curve) => (
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
              <div className="flex items-center gap-3">
                <Label className="w-20 text-sm sm:w-28">Hash</Label>
                <Tabs
                  value={state.ecdsaHash}
                  onValueChange={(value) =>
                    setParam("ecdsaHash", value as EcdsaHash, true)
                  }
                >
                  <ScrollableTabsList>
                    {ecdsaHashes.map((hash) => (
                      <TabsTrigger key={hash} value={hash} className="text-xs">
                        {hash}
                      </TabsTrigger>
                    ))}
                  </ScrollableTabsList>
                </Tabs>
              </div>
            </div>
          )}

          {showEddsa && (
            <div className="flex items-center gap-3">
              <Label className="w-20 text-sm sm:w-28">Curve</Label>
              <Tabs
                value={state.eddsaCurve}
                onValueChange={(value) =>
                  setParam("eddsaCurve", value as EddsaCurve, true)
                }
              >
                <ScrollableTabsList>
                  {eddsaCurves.map((curve) => (
                    <TabsTrigger
                      key={curve}
                      value={curve}
                      className="text-xs flex-none"
                    >
                      {curve}
                    </TabsTrigger>
                  ))}
                </ScrollableTabsList>
              </Tabs>
            </div>
          )}

          {showSchnorr && (
            <div className="flex items-center gap-3">
              <Label className="w-20 text-sm sm:w-28">Curve</Label>
              <span className="text-sm font-medium">secp256k1</span>
            </div>
          )}

          {showPqcDsa && (
            <div className="flex items-center gap-3">
              <Label className="w-20 text-sm sm:w-28">Parameter Set</Label>
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

          {showPqcSlh && (
            <div className="flex items-center gap-3">
              <Label className="w-20 text-sm sm:w-28">Parameter Set</Label>
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

          {!showHmac && (
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="flex flex-col gap-2">
                <Label className="text-xs font-medium text-muted-foreground">
                  Private Key
                </Label>
                <div className="flex flex-col">
                  <Textarea
                    rows={10}
                    value={keySelection.privateKey}
                    onChange={(event) =>
                      setParam(
                        getKeyFields(state.algorithm).privateKey,
                        event.target.value,
                      )
                    }
                    placeholder={privateKeyPlaceholder}
                    className={cn(
                      "min-h-[160px] max-h-[160px] overflow-auto break-all font-mono text-xs",
                      oversizeKeys.includes(
                        getKeyFields(state.algorithm).privateKey,
                      ) && "border-destructive",
                    )}
                  />
                  <div className="mt-2 flex items-center justify-between gap-2">
                    <p className="text-[10px] text-muted-foreground">
                      {privateKeyHint}
                    </p>
                    <div className="flex items-center gap-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleKeyUploadClick("private")}
                        className="h-7 w-7 p-0"
                      >
                        <Upload className="h-3 w-3" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={handleGenerateKeypair}
                        className="h-7 w-7 p-0"
                        disabled={isGeneratingKeys}
                      >
                        <RefreshCcw className="h-3 w-3" />
                      </Button>
                    </div>
                  </div>
                  {oversizeKeys.includes(
                    getKeyFields(state.algorithm).privateKey,
                  ) && (
                    <p className="text-xs text-muted-foreground">
                      Private key too large for URL sync.
                    </p>
                  )}
                </div>
              </div>

              <div className="flex flex-col gap-2">
                <Label className="text-xs font-medium text-muted-foreground">
                  Public Key
                </Label>
                <div className="flex flex-col">
                  <Textarea
                    rows={10}
                    value={keySelection.publicKey}
                    onChange={(event) =>
                      setParam(
                        getKeyFields(state.algorithm).publicKey,
                        event.target.value,
                      )
                    }
                    placeholder={publicKeyPlaceholder}
                    className={cn(
                      "min-h-[160px] max-h-[160px] overflow-auto break-all font-mono text-xs",
                      oversizeKeys.includes(
                        getKeyFields(state.algorithm).publicKey,
                      ) && "border-destructive",
                    )}
                  />
                  <div className="mt-2 flex items-center justify-between gap-2">
                    <p className="text-[10px] text-muted-foreground">
                      {publicKeyHint}
                    </p>
                    <div className="flex items-center gap-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleKeyUploadClick("public")}
                        className="h-7 w-7 p-0"
                      >
                        <Upload className="h-3 w-3" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={handleGenerateKeypair}
                        className="h-7 w-7 p-0"
                        disabled={isGeneratingKeys}
                      >
                        <RefreshCcw className="h-3 w-3" />
                      </Button>
                    </div>
                  </div>
                  {oversizeKeys.includes(
                    getKeyFields(state.algorithm).publicKey,
                  ) && (
                    <p className="text-xs text-muted-foreground">
                      Public key too large for URL sync.
                    </p>
                  )}
                </div>
              </div>
              <input
                ref={privateKeyInputRef}
                type="file"
                onChange={(event) => handleKeyFileUpload("private", event)}
                className="hidden"
              />
              <input
                ref={publicKeyInputRef}
                type="file"
                onChange={(event) => handleKeyFileUpload("public", event)}
                className="hidden"
              />
            </div>
          )}

          <div className="space-y-2 pt-4 border-t">
            <div className="flex items-center gap-3">
              <Label className="text-sm font-semibold">Sign Message</Label>
              <div className="flex-1" />
              <Tabs
                value={state.inputEncoding}
                onValueChange={(value) =>
                  setParam("inputEncoding", value as InputEncoding, true)
                }
              >
                <InlineTabsList>
                  {inputEncodingOptions.map((encoding) => (
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
              <Button
                variant="ghost"
                size="sm"
                onClick={handleUploadClick}
                className="h-7 w-7 p-0"
              >
                <Upload className="h-3 w-3" />
              </Button>
            </div>
            <div className="relative">
              <Textarea
                value={state.message}
                onChange={(event) => setParam("message", event.target.value)}
                placeholder="Enter message to sign..."
                className={cn(
                  "max-h-[320px] min-h-[200px] overflow-auto overflow-x-hidden break-all whitespace-pre-wrap font-mono text-sm",
                  oversizeKeys.includes("message") && "border-destructive",
                )}
              />
              {fileName && (
                <div className="absolute inset-0 flex items-center justify-center gap-3 rounded-md border bg-background/95 text-sm text-muted-foreground">
                  <span className="max-w-[70%] truncate font-medium text-foreground">
                    {fileMeta?.name ?? fileName}
                  </span>
                  <button
                    type="button"
                    className="inline-flex h-6 w-6 items-center justify-center rounded hover:bg-muted/60"
                    onClick={handleClearFile}
                    aria-label="Clear file"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </div>
              )}
            </div>
            <Button
              className="w-full"
              onClick={handleSign}
              disabled={isSigning}
            >
              {isSigning ? "Signing..." : "Sign Message"}
            </Button>
            <input
              ref={fileInputRef}
              type="file"
              onChange={handleFileUpload}
              className="hidden"
            />
            {oversizeKeys.includes("message") && (
              <p className="text-xs text-muted-foreground">
                Message exceeds 2 KB and is not synced to the URL.
              </p>
            )}
            {inputWarning && (
              <p className="text-xs text-muted-foreground">{inputWarning}</p>
            )}
            {messageWarning && (
              <p className="text-xs text-destructive">
                {messageWarning.message}
              </p>
            )}
          </div>
        </div>

        <div className="flex flex-col gap-4">
          <div className="space-y-2">
            <div className="flex items-center gap-3">
              <Label className="text-sm font-semibold">Signature</Label>
              <div className="flex-1" />
              <Tabs
                value={state.signatureEncoding}
                onValueChange={(value) =>
                  setParam(
                    "signatureEncoding",
                    value as SignatureEncoding,
                    true,
                  )
                }
              >
                <InlineTabsList>
                  {signatureEncodings.map((encoding) => (
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
              <div className="flex shrink-0 items-center gap-1">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleCopyOutput}
                  className="h-7 w-7 p-0"
                  aria-label="Copy signature"
                  disabled={!state.signature}
                >
                  {copied ? (
                    <Check className="h-3 w-3" />
                  ) : (
                    <Copy className="h-3 w-3" />
                  )}
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleDownloadOutput}
                  className="h-7 w-7 p-0"
                  aria-label="Download signature"
                  disabled={!state.signature}
                >
                  <Download className="h-3 w-3" />
                </Button>
              </div>
            </div>
            <Textarea
              value={state.signature}
              onChange={(event) => setParam("signature", event.target.value)}
              placeholder="Signature will appear here..."
              className={cn(
                "max-h-[320px] min-h-[160px] overflow-auto overflow-x-hidden break-all whitespace-pre-wrap font-mono text-sm",
                oversizeKeys.includes("signature") && "border-destructive",
              )}
            />
            {oversizeKeys.includes("signature") && (
              <p className="text-xs text-muted-foreground">
                Signature exceeds 2 KB and is not synced to the URL.
              </p>
            )}
            {signatureWarning && (
              <p className="text-xs text-destructive">
                {signatureWarning.message}
              </p>
            )}
          </div>

          <div className="space-y-4">
            <div className="space-y-2">
              <div className="flex items-center gap-3">
                <Label className="text-sm font-semibold">Verify Message</Label>
                <div className="flex-1" />
                <Tabs
                  value={state.verifyInputEncoding}
                  onValueChange={(value) =>
                    setParam(
                      "verifyInputEncoding",
                      value as InputEncoding,
                      true,
                    )
                  }
                >
                  <InlineTabsList>
                    {verifyInputEncodingOptions.map((encoding) => (
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
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleVerifyUploadClick}
                  className="h-7 w-7 p-0"
                >
                  <Upload className="h-3 w-3" />
                </Button>
              </div>
              <div className="relative">
                <Textarea
                  value={state.verifyMessage}
                  onChange={(event) =>
                    setParam("verifyMessage", event.target.value)
                  }
                  placeholder="Enter message to verify..."
                  className="max-h-[320px] min-h-[200px] overflow-auto overflow-x-hidden break-all whitespace-pre-wrap font-mono text-sm"
                />
                {verifyFileMeta && (
                  <div className="absolute inset-0 flex items-center justify-center gap-3 rounded-md border bg-background/95 text-sm text-muted-foreground">
                    <span className="max-w-[70%] truncate font-medium text-foreground">
                      {verifyFileMeta.name}
                    </span>
                    <button
                      type="button"
                      className="inline-flex h-6 w-6 items-center justify-center rounded hover:bg-muted/60"
                      onClick={handleVerifyClearFile}
                      aria-label="Clear file"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </div>
                )}
              </div>
              <input
                ref={verifyFileInputRef}
                type="file"
                onChange={handleVerifyFileUpload}
                className="hidden"
              />
              {verifyMessageWarning && (
                <p className="text-xs text-destructive">
                  {verifyMessageWarning.message}
                </p>
              )}
            </div>

            <div className="rounded-md border p-4">
              <div className="flex items-center justify-between">
                <Label className="text-sm font-medium">
                  Verification Result
                </Label>
                {verificationStatus !== null && (
                  <Badge
                    variant={verificationStatus ? "default" : "destructive"}
                  >
                    {verificationStatus ? "Valid" : "Invalid"}
                  </Badge>
                )}
              </div>
              {verificationStatus === null ? (
                <p className="text-sm text-muted-foreground mt-2">
                  Provide a message and signature to verify.
                </p>
              ) : verificationStatus ? (
                <p className="text-sm text-emerald-600 mt-2">
                  Signature matches the message.
                </p>
              ) : (
                <p className="text-sm text-destructive mt-2">
                  Signature does not match the message.
                </p>
              )}
            </div>
          </div>

          {(isSigning || isVerifying) && (
            <p className="text-xs text-muted-foreground">Processing...</p>
          )}
          {error && (
            <Alert variant="destructive" className="py-2">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription className="text-xs">{error}</AlertDescription>
            </Alert>
          )}
        </div>
      </div>
    </div>
  );
}
