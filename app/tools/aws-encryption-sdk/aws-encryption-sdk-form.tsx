import * as React from "react";
import {
  RefreshCcw,
  Trash2,
  Upload,
  Check,
  Copy,
  Download,
  X,
} from "lucide-react";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";
import {
  type AwsEncryptionSdkState,
  type AwsEncryptionSdkRsaPadding,
  type AwsEncryptionSdkKeyringType,
  type AwsEncryptionSdkAesKeyLength,
  type AwsEncryptionSdkKeyEncoding,
  type AwsEncryptionSdkInputEncoding,
  type AwsEncryptionSdkOutputEncoding,
  type AwsEncryptionSdkDecryptedEncoding,
  type DecryptedHeader,
  keyringLabels,
} from "./aws-encryption-sdk-types";

type AwsEncryptionSdkFormProps = {
  state: AwsEncryptionSdkState;
  setParam: <K extends keyof AwsEncryptionSdkState>(
    key: K,
    value: AwsEncryptionSdkState[K],
    immediate?: boolean,
  ) => void;
  oversizeKeys: (keyof AwsEncryptionSdkState)[];

  // Handlers
  handleEncrypt: () => void;
  handleDecrypt: () => void; // Triggered manually or by effect
  handleClearAll: () => void;

  // Key Management
  handleGenerateKey: () => Promise<void>;
  handleKeyFileUpload: (
    type: "aes" | "rsa-private" | "rsa-public",
    event: React.ChangeEvent<HTMLInputElement>,
  ) => void;

  // Input File
  handleInputFileUpload: (event: React.ChangeEvent<HTMLInputElement>) => void;
  handleInputFileClear: () => void;
  inputFileName: string | null;

  // Encrypted File
  handleEncryptedFileUpload: (
    event: React.ChangeEvent<HTMLInputElement>,
  ) => void;
  handleEncryptedFileClear: () => void;
  encryptedFileName: string | null;

  // Output
  handleDownloadDecrypted: () => void;
  hasDecryptedBytes: boolean;

  // Status
  isEncrypting: boolean;
  isDecrypting: boolean;
  error: string | null;
  decryptedResult: string;
  decryptedContext: Record<string, string>;
  decryptedHeader: DecryptedHeader | null;
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

export default function AwsEncryptionSdkForm({
  state,
  setParam,
  oversizeKeys,
  handleEncrypt,
  handleDecrypt,
  handleClearAll,
  handleGenerateKey,
  handleKeyFileUpload,
  handleInputFileUpload,
  handleInputFileClear,
  inputFileName,
  handleEncryptedFileUpload,
  handleEncryptedFileClear,
  encryptedFileName,
  handleDownloadDecrypted,
  hasDecryptedBytes,
  isEncrypting,
  error,
  decryptedResult,
  decryptedContext,
  decryptedHeader,
}: AwsEncryptionSdkFormProps) {
  const aesFileInputRef = React.useRef<HTMLInputElement>(null);
  const rsaPrivateInputRef = React.useRef<HTMLInputElement>(null);
  const rsaPublicInputRef = React.useRef<HTMLInputElement>(null);
  const inputFileInputRef = React.useRef<HTMLInputElement>(null);
  const encryptedFileInputRef = React.useRef<HTMLInputElement>(null);

  const [copied, setCopied] = React.useState(false);
  const handleCopyEncrypted = async () => {
    if (!state.encryptedData) return;
    await navigator.clipboard.writeText(state.encryptedData);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const [copiedDecrypted, setCopiedDecrypted] = React.useState(false);
  const handleCopyDecrypted = async () => {
    if (!decryptedResult) return;
    await navigator.clipboard.writeText(decryptedResult);
    setCopiedDecrypted(true);
    setTimeout(() => setCopiedDecrypted(false), 2000);
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-start gap-3">
          <Label className="w-20 shrink-0 text-sm sm:w-28 pt-2">Keyring</Label>
          <Tabs
            value={state.keyringType}
            onValueChange={(val) =>
              setParam("keyringType", val as AwsEncryptionSdkKeyringType, true)
            }
            className="min-w-0 flex-1"
          >
            <ScrollableTabsList>
              {Object.entries(keyringLabels).map(([key, label]) => (
                <TabsTrigger key={key} value={key} className="text-xs">
                  {label}
                </TabsTrigger>
              ))}
            </ScrollableTabsList>
          </Tabs>
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={handleClearAll}
          className="h-8 gap-1.5 px-3"
        >
          <Trash2 className="h-3.5 w-3.5" /> Clear All
        </Button>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* LEFT PANEL: ENCRYPTION */}
        <section className="flex flex-col gap-6">
          {/* RAW AES CONFIG */}
          {state.keyringType === "raw-aes" && (
            <div className="space-y-4">
              <div className="flex items-center gap-3">
                <Label className="w-20 text-sm sm:w-28">Key Length</Label>
                <Tabs
                  value={state.aesKeyLength}
                  onValueChange={(v) =>
                    setParam(
                      "aesKeyLength",
                      v as AwsEncryptionSdkAesKeyLength,
                      true,
                    )
                  }
                >
                  <InlineTabsList>
                    <TabsTrigger value="128">128-bit</TabsTrigger>
                    <TabsTrigger value="192">192-bit</TabsTrigger>
                    <TabsTrigger value="256">256-bit</TabsTrigger>
                  </InlineTabsList>
                </Tabs>
              </div>
              <div className="flex items-start gap-3">
                <Label className="w-20 text-sm sm:w-28 pt-2">AES Key</Label>
                <div className="min-w-0 flex-1">
                  <Textarea
                    value={state.aesKey}
                    onChange={(e) => setParam("aesKey", e.target.value)}
                    placeholder="Enter AES secret key..."
                    className={cn(
                      "min-h-[80px] max-h-40 font-mono text-xs break-all",
                      oversizeKeys.includes("aesKey") && "border-destructive",
                    )}
                  />
                  <div className="mt-2 flex items-center justify-between gap-2">
                    <Tabs
                      value={state.aesKeyEncoding}
                      onValueChange={(v) =>
                        setParam(
                          "aesKeyEncoding",
                          v as AwsEncryptionSdkKeyEncoding,
                          true,
                        )
                      }
                    >
                      <InlineTabsList>
                        <TabsTrigger value="base64">Base64</TabsTrigger>
                        <TabsTrigger value="hex">Hex</TabsTrigger>
                        <TabsTrigger value="utf8">UTF-8</TabsTrigger>
                      </InlineTabsList>
                    </Tabs>
                    <div className="flex gap-1">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => aesFileInputRef.current?.click()}
                        className="h-7 w-7 p-0"
                      >
                        <Upload className="h-3 w-3" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={handleGenerateKey}
                        className="h-7 w-7 p-0"
                      >
                        <RefreshCcw className="h-3 w-3" />
                      </Button>
                    </div>
                  </div>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="flex flex-col gap-2">
                  <Label className="text-xs font-medium text-muted-foreground">
                    Key ID
                  </Label>
                  <Input
                    value={state.aesKeyId}
                    onChange={(e) => setParam("aesKeyId", e.target.value)}
                    className="h-8 text-xs font-mono"
                  />
                </div>
                <div className="flex flex-col gap-2">
                  <Label className="text-xs font-medium text-muted-foreground">
                    Provider ID
                  </Label>
                  <Input
                    value={state.aesKeyProviderId}
                    onChange={(e) =>
                      setParam("aesKeyProviderId", e.target.value)
                    }
                    className="h-8 text-xs font-mono"
                  />
                </div>
              </div>
              <input
                type="file"
                ref={aesFileInputRef}
                onChange={(e) => handleKeyFileUpload("aes", e)}
                className="hidden"
              />
            </div>
          )}

          {/* RAW RSA CONFIG */}
          {state.keyringType === "raw-rsa" && (
            <div className="space-y-4">
              <div className="flex items-center gap-3">
                <Label className="w-20 text-sm sm:w-28">Padding</Label>
                <Tabs
                  value={state.rsaPadding}
                  onValueChange={(v) =>
                    setParam(
                      "rsaPadding",
                      v as AwsEncryptionSdkRsaPadding,
                      true,
                    )
                  }
                >
                  <ScrollableTabsList>
                    <TabsTrigger value="OAEP-SHA1">OAEP-SHA1</TabsTrigger>
                    <TabsTrigger value="OAEP-SHA256">OAEP-SHA256</TabsTrigger>
                    <TabsTrigger value="OAEP-SHA384">OAEP-SHA384</TabsTrigger>
                    <TabsTrigger value="OAEP-SHA512">OAEP-SHA512</TabsTrigger>
                  </ScrollableTabsList>
                </Tabs>
              </div>
              {/* Public Key */}
              <div className="grid gap-4 sm:grid-cols-2">
                {/* Public Key */}
                <div className="flex flex-col gap-2">
                  <Label className="text-xs font-medium text-muted-foreground">
                    Public Key
                  </Label>
                  <div className="flex flex-col">
                    <Textarea
                      value={state.rsaPublicKey}
                      onChange={(e) => setParam("rsaPublicKey", e.target.value)}
                      placeholder="PEM or JWK Public Key..."
                      className={cn(
                        "min-h-[120px] max-h-40 font-mono text-xs break-all",
                        oversizeKeys.includes("rsaPublicKey") &&
                          "border-destructive",
                      )}
                    />
                    <div className="mt-2 flex justify-end gap-1">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => rsaPublicInputRef.current?.click()}
                        className="h-7 w-7 p-0"
                      >
                        <Upload className="h-3 w-3" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={handleGenerateKey}
                        className="h-7 w-7 p-0"
                      >
                        <RefreshCcw className="h-3 w-3" />
                      </Button>
                    </div>
                  </div>
                </div>

                {/* Private Key */}
                <div className="flex flex-col gap-2">
                  <Label className="text-xs font-medium text-muted-foreground">
                    Private Key
                  </Label>
                  <div className="flex flex-col">
                    <Textarea
                      value={state.rsaPrivateKey}
                      onChange={(e) =>
                        setParam("rsaPrivateKey", e.target.value)
                      }
                      placeholder="PEM or JWK Private Key..."
                      className={cn(
                        "min-h-[120px] max-h-40 font-mono text-xs break-all",
                        oversizeKeys.includes("rsaPrivateKey") &&
                          "border-destructive",
                      )}
                    />
                    <div className="mt-2 flex justify-end gap-1">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => rsaPrivateInputRef.current?.click()}
                        className="h-7 w-7 p-0"
                      >
                        <Upload className="h-3 w-3" />
                      </Button>
                    </div>
                  </div>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="flex flex-col gap-2">
                  <Label className="text-xs font-medium text-muted-foreground">
                    Key ID
                  </Label>
                  <Input
                    value={state.rsaKeyId}
                    onChange={(e) => setParam("rsaKeyId", e.target.value)}
                    className="h-8 text-xs font-mono"
                  />
                </div>
                <div className="flex flex-col gap-2">
                  <Label className="text-xs font-medium text-muted-foreground">
                    Provider ID
                  </Label>
                  <Input
                    value={state.rsaKeyProviderId}
                    onChange={(e) =>
                      setParam("rsaKeyProviderId", e.target.value)
                    }
                    className="h-8 text-xs font-mono"
                  />
                </div>
              </div>
              <input
                type="file"
                ref={rsaPrivateInputRef}
                onChange={(e) => handleKeyFileUpload("rsa-private", e)}
                className="hidden"
              />
              <input
                type="file"
                ref={rsaPublicInputRef}
                onChange={(e) => handleKeyFileUpload("rsa-public", e)}
                className="hidden"
              />
            </div>
          )}

          {/* ENCRYPTION CONTEXT */}
          <div className="space-y-3 pt-4 border-t">
            <Label className="text-sm">Encryption Context (JSON)</Label>
            <Textarea
              value={state.encryptionContext}
              onChange={(e) => setParam("encryptionContext", e.target.value)}
              placeholder='{"user": "id", "purpose": "test"}'
              className={cn(
                "min-h-[80px] max-h-40 font-mono text-xs",
                oversizeKeys.includes("encryptionContext") &&
                  "border-destructive",
              )}
            />
          </div>

          {/* PLAINTEXT INPUT */}
          <div className="space-y-3 pt-4 border-t">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <Label className="text-sm">Plaintext Data</Label>
                <Tabs
                  value={state.inputEncoding}
                  onValueChange={(v) =>
                    setParam(
                      "inputEncoding",
                      v as AwsEncryptionSdkInputEncoding,
                      true,
                    )
                  }
                >
                  <InlineTabsList>
                    {!inputFileName && (
                      <>
                        <TabsTrigger value="utf8">UTF-8</TabsTrigger>
                        <TabsTrigger value="base64">Base64</TabsTrigger>
                        <TabsTrigger value="hex">Hex</TabsTrigger>
                      </>
                    )}
                    {inputFileName && (
                      <TabsTrigger value="binary">Binary</TabsTrigger>
                    )}
                  </InlineTabsList>
                </Tabs>
              </div>
              <div className="flex items-center gap-1">
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 w-7 p-0"
                  onClick={() => inputFileInputRef.current?.click()}
                  title={inputFileName ? "Change File" : "Upload File"}
                >
                  <Upload className="h-4 w-4" />
                </Button>
                {inputFileName && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 w-7 p-0 text-destructive hover:text-destructive"
                    onClick={handleInputFileClear}
                    title="Clear File"
                  >
                    <X className="h-4 w-4" />
                  </Button>
                )}
                <input
                  type="file"
                  ref={inputFileInputRef}
                  onChange={handleInputFileUpload}
                  className="hidden"
                />
              </div>
            </div>

            {inputFileName ? (
              <div className="flex items-center gap-2 rounded-md border bg-muted/50 px-3 py-2 text-sm">
                <span className="shrink-0 text-muted-foreground">File:</span>
                <span className="font-medium truncate">{inputFileName}</span>
              </div>
            ) : (
              <Textarea
                value={state.inputData}
                onChange={(e) => setParam("inputData", e.target.value)}
                placeholder="Enter data to encrypt..."
                className={cn(
                  "min-h-[120px] max-h-40 font-mono text-sm",
                  oversizeKeys.includes("inputData") && "border-destructive",
                )}
                disabled={state.inputEncoding === "binary"}
              />
            )}

            <Button
              onClick={handleEncrypt}
              disabled={isEncrypting}
              className="w-full"
            >
              {isEncrypting ? "Encrypting..." : "Encrypt Data"}
            </Button>
          </div>
        </section>

        {/* RIGHT PANEL: DECRYPTION */}
        <section className="flex flex-col gap-6 lg:border-l lg:pl-6">
          <div className="flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <Label className="text-sm">Encrypted Data</Label>
                <Tabs
                  value={state.encryptedEncoding}
                  onValueChange={(v) =>
                    setParam(
                      "encryptedEncoding",
                      v as AwsEncryptionSdkOutputEncoding,
                      true,
                    )
                  }
                >
                  <InlineTabsList>
                    {!encryptedFileName && (
                      <>
                        <TabsTrigger value="base64">Base64</TabsTrigger>
                        <TabsTrigger value="base64url">URL</TabsTrigger>
                        <TabsTrigger value="hex">Hex</TabsTrigger>
                      </>
                    )}
                    {encryptedFileName && (
                      <TabsTrigger value="binary">Binary</TabsTrigger>
                    )}
                  </InlineTabsList>
                </Tabs>
              </div>
              <div className="flex items-center gap-1">
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 w-7 p-0"
                  onClick={() => encryptedFileInputRef.current?.click()}
                  title={encryptedFileName ? "Change File" : "Upload File"}
                >
                  <Upload className="h-4 w-4" />
                </Button>
                {encryptedFileName && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 w-7 p-0 text-destructive hover:text-destructive"
                    onClick={handleEncryptedFileClear}
                    title="Clear File"
                  >
                    <X className="h-4 w-4" />
                  </Button>
                )}
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleCopyEncrypted}
                  className="h-7 w-7 p-0"
                  disabled={state.encryptedEncoding === "binary"}
                  title="Copy"
                >
                  {copied ? (
                    <Check className="w-4 h-4" />
                  ) : (
                    <Copy className="w-4 h-4" />
                  )}
                </Button>
                <input
                  type="file"
                  ref={encryptedFileInputRef}
                  onChange={handleEncryptedFileUpload}
                  className="hidden"
                />
              </div>
            </div>

            {encryptedFileName ? (
              <div className="flex items-center gap-2 rounded-md border bg-muted/50 px-3 py-2 text-sm">
                <span className="shrink-0 text-muted-foreground">File:</span>
                <span className="font-medium truncate">
                  {encryptedFileName}
                </span>
              </div>
            ) : (
              <Textarea
                value={state.encryptedData}
                onChange={(e) => setParam("encryptedData", e.target.value)}
                placeholder="Encrypted output will appear here..."
                className="min-h-[120px] max-h-40 font-mono text-xs break-all bg-muted/30"
                disabled={state.encryptedEncoding === "binary"}
              />
            )}
            {error ? <p className="text-xs text-destructive">{error}</p> : null}
          </div>

          <div className="flex flex-col gap-3 pt-4 border-t">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <Label className="text-sm">Decrypted Result</Label>
                <Tabs
                  value={state.decryptedEncoding}
                  onValueChange={(v) =>
                    setParam(
                      "decryptedEncoding",
                      v as AwsEncryptionSdkDecryptedEncoding,
                      true,
                    )
                  }
                >
                  <InlineTabsList>
                    <TabsTrigger value="utf8">UTF-8</TabsTrigger>
                    <TabsTrigger value="base64">Base64</TabsTrigger>
                    <TabsTrigger value="hex">Hex</TabsTrigger>
                  </InlineTabsList>
                </Tabs>
              </div>
              <div className="flex items-center gap-1">
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 w-7 p-0"
                  onClick={handleDownloadDecrypted}
                  disabled={!hasDecryptedBytes}
                  title="Download Binary"
                >
                  <Download className="w-4 h-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 w-7 p-0"
                  onClick={handleCopyDecrypted}
                  disabled={!decryptedResult}
                  title="Copy"
                >
                  {copiedDecrypted ? (
                    <Check className="w-4 h-4" />
                  ) : (
                    <Copy className="w-4 h-4" />
                  )}
                </Button>
              </div>
            </div>

            <div className="rounded-md border bg-muted/50 p-3 min-h-[100px] break-all font-mono text-sm whitespace-pre-wrap">
              {decryptedResult || (
                <span className="text-muted-foreground italic">
                  Decryption result...
                </span>
              )}
            </div>
          </div>

          <div className="flex flex-col gap-3 pt-4 border-t">
            <Label className="text-sm">Decrypted Context</Label>
            <div className="rounded-md border bg-muted/50 p-3 min-h-[60px] font-mono text-xs whitespace-pre-wrap break-all">
              {Object.keys(decryptedContext).length > 0 ? (
                <pre className="whitespace-pre-wrap break-all font-mono text-xs">
                  {JSON.stringify(decryptedContext, null, 2)}
                </pre>
              ) : (
                <span className="text-muted-foreground italic">
                  Context not found or empty
                </span>
              )}
            </div>
          </div>

          <div className="flex flex-col gap-3 pt-4 border-t">
            <Label className="text-sm">Message Header</Label>
            <div className="rounded-md border bg-muted/50 p-3 min-h-[60px] font-mono text-xs whitespace-pre-wrap break-all">
              {decryptedHeader ? (
                <pre className="whitespace-pre-wrap break-all font-mono text-xs">
                  {JSON.stringify(decryptedHeader, null, 2)}
                </pre>
              ) : (
                <span className="text-muted-foreground italic">
                  Header not found or empty
                </span>
              )}
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
