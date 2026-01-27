import * as React from "react";
import {
  RefreshCcw,
  Trash2,
  Upload,
  Lock,
  Unlock,
  Check,
  Copy,
  Plus,
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
  keyringLabels,
  encodingLabels,
} from "./aws-encryption-sdk-types";
import { generateAesKey, generateRsaKey } from "./crypto";

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

  // Status
  isEncrypting: boolean;
  isDecrypting: boolean;
  error: string | null;
  decryptedResult: string;
  decryptedContext: Record<string, string>;
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
  isEncrypting,
  isDecrypting,
  error,
  decryptedResult,
  decryptedContext,
}: AwsEncryptionSdkFormProps) {
  const aesFileInputRef = React.useRef<HTMLInputElement>(null);
  const rsaPrivateInputRef = React.useRef<HTMLInputElement>(null);
  const rsaPublicInputRef = React.useRef<HTMLInputElement>(null);

  // Context management helpers
  const addContextItem = () => {
    const newContext = { ...state.encryptionContext, "": "" };
    setParam("encryptionContext", newContext);
  };

  const updateContextKey = (oldKey: string, newKey: string) => {
    if (oldKey === newKey) return;
    const { [oldKey]: val, ...rest } = state.encryptionContext;
    setParam("encryptionContext", { ...rest, [newKey]: val });
  };

  const updateContextValue = (key: string, value: string) => {
    setParam("encryptionContext", { ...state.encryptionContext, [key]: value });
  };

  const removeContextItem = (key: string) => {
    const { [key]: _, ...rest } = state.encryptionContext;
    setParam("encryptionContext", rest);
  };

  const [copied, setCopied] = React.useState(false);
  const handleCopyEncrypted = async () => {
    if (!state.encryptedData) return;
    await navigator.clipboard.writeText(state.encryptedData);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
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
          <h2 className="text-sm font-semibold flex items-center gap-2">
            <Lock className="w-4 h-4" /> Encrypt
          </h2>

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
                      "min-h-[80px] font-mono text-xs break-all",
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
              <div className="flex items-center gap-3">
                <Label className="w-20 text-sm sm:w-28">Key ID</Label>
                <Input
                  value={state.aesKeyId}
                  onChange={(e) => setParam("aesKeyId", e.target.value)}
                  className="h-8 text-xs font-mono"
                />
              </div>
              <div className="flex items-center gap-3">
                <Label className="w-20 text-sm sm:w-28">Provider ID</Label>
                <Input
                  value={state.aesKeyProviderId}
                  onChange={(e) => setParam("aesKeyProviderId", e.target.value)}
                  className="h-8 text-xs font-mono"
                />
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
              <div className="flex items-start gap-3">
                <Label className="w-20 text-sm sm:w-28 pt-2">Public Key</Label>
                <div className="min-w-0 flex-1">
                  <Textarea
                    value={state.rsaPublicKey}
                    onChange={(e) => setParam("rsaPublicKey", e.target.value)}
                    placeholder="PEM or JWK Public Key..."
                    className={cn(
                      "min-h-[100px] font-mono text-xs break-all",
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
              <div className="flex items-start gap-3">
                <Label className="w-20 text-sm sm:w-28 pt-2">Private Key</Label>
                <div className="min-w-0 flex-1">
                  <Textarea
                    value={state.rsaPrivateKey}
                    onChange={(e) => setParam("rsaPrivateKey", e.target.value)}
                    placeholder="PEM or JWK Private Key..."
                    className={cn(
                      "min-h-[100px] font-mono text-xs break-all",
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
              <div className="flex items-center gap-3">
                <Label className="w-20 text-sm sm:w-28">Key ID</Label>
                <Input
                  value={state.rsaKeyId}
                  onChange={(e) => setParam("rsaKeyId", e.target.value)}
                  className="h-8 text-xs font-mono"
                />
              </div>
              <div className="flex items-center gap-3">
                <Label className="w-20 text-sm sm:w-28">Provider ID</Label>
                <Input
                  value={state.rsaKeyProviderId}
                  onChange={(e) => setParam("rsaKeyProviderId", e.target.value)}
                  className="h-8 text-xs font-mono"
                />
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
            <div className="flex items-center justify-between">
              <Label className="text-sm">Encryption Context</Label>
              <Button
                variant="ghost"
                size="sm"
                onClick={addContextItem}
                className="h-6 w-6 p-0"
              >
                <Plus className="w-3 h-3" />
              </Button>
            </div>
            {Object.entries(state.encryptionContext).map(
              ([key, value], idx) => (
                <div key={idx} className="flex gap-2 items-center">
                  <Input
                    placeholder="Key"
                    value={key}
                    onChange={(e) => updateContextKey(key, e.target.value)}
                    className="h-8 text-xs"
                  />
                  <Input
                    placeholder="Value"
                    value={value}
                    onChange={(e) => updateContextValue(key, e.target.value)}
                    className="h-8 text-xs"
                  />
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => removeContextItem(key)}
                    className="h-8 w-8 p-0 shrink-0"
                  >
                    <X className="w-3 h-3" />
                  </Button>
                </div>
              ),
            )}
            {Object.keys(state.encryptionContext).length === 0 && (
              <p className="text-xs text-muted-foreground italic">
                No context (AAD) added.
              </p>
            )}
          </div>

          {/* PLAINTEXT INPUT */}
          <div className="space-y-3 pt-4 border-t">
            <Label className="text-sm">Plaintext Data</Label>
            <Textarea
              value={state.inputData}
              onChange={(e) => setParam("inputData", e.target.value)}
              placeholder="Enter data to encrypt..."
              className={cn(
                "min-h-[120px] font-mono text-sm",
                oversizeKeys.includes("inputData") && "border-destructive",
              )}
            />
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
          <h2 className="text-sm font-semibold flex items-center gap-2">
            <Unlock className="w-4 h-4" /> Decrypt / Output
          </h2>

          <div className="flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <Label className="text-sm">Encrypted Data (Base64)</Label>
              <Button
                variant="ghost"
                size="sm"
                onClick={handleCopyEncrypted}
                className="h-6 gap-1"
              >
                {copied ? (
                  <Check className="w-3 h-3" />
                ) : (
                  <Copy className="w-3 h-3" />
                )}
                {copied ? "Copied" : "Copy"}
              </Button>
            </div>
            <Textarea
              value={state.encryptedData}
              onChange={(e) => setParam("encryptedData", e.target.value)} // Should trigger auto-decrypt via effect in parent
              placeholder="Encrypted output will appear here..."
              className="min-h-[200px] font-mono text-xs break-all bg-muted/30"
            />
            {error && <p className="text-xs text-destructive">{error}</p>}
          </div>

          <div className="flex flex-col gap-3 pt-4 border-t">
            <Label className="text-sm">Decrypted Result</Label>
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
            <div className="rounded-md border bg-muted/50 p-3 min-h-[60px] font-mono text-xs">
              {Object.keys(decryptedContext).length > 0 ? (
                <pre>{JSON.stringify(decryptedContext, null, 2)}</pre>
              ) : (
                <span className="text-muted-foreground italic">
                  Context not found or empty
                </span>
              )}
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
