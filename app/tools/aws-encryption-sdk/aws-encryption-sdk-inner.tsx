import * as React from "react";
import { z } from "zod";
import { useToolHistoryContext } from "@/components/tool-ui/tool-page-wrapper";
import {
  defaultAwsEncryptionSdkState,
  type AwsEncryptionSdkState,
  type AwsEncryptionSdkKeyringType,
} from "./aws-encryption-sdk-types";
import AwsEncryptionSdkForm from "./aws-encryption-sdk-form";
import {
  encryptData,
  decryptData,
  generateAesKey,
  generateRsaKey,
  decodeKey,
} from "./crypto";

// Schema for URL syncing (basic validation)
export const awsEncryptionSdkSchema = z.object({
  keyringType: z.enum(["raw-aes", "raw-rsa"]).default("raw-aes"),
  aesKeyLength: z.enum(["128", "192", "256"]).default("256"),
  aesKey: z.string().default(""),
  aesKeyEncoding: z.enum(["base64", "hex", "utf8"]).default("base64"),
  aesKeyProviderId: z.string().default("raw-aes-params"),
  aesKeyId: z.string().default("aes-key-1"),

  rsaPadding: z
    .enum(["OAEP-SHA1", "OAEP-SHA256", "OAEP-SHA384", "OAEP-SHA512"])
    .default("OAEP-SHA256"),
  rsaPrivateKey: z.string().default(""),
  rsaPublicKey: z.string().default(""),
  rsaKeyProviderId: z.string().default("raw-rsa-params"),
  rsaKeyId: z.string().default("rsa-key-1"),

  encryptionContext: z.record(z.string()).default({}),

  inputData: z.string().default(""),
  inputEncoding: z.enum(["utf8", "base64", "hex", "binary"]).default("utf8"),

  encryptedData: z.string().default(""),
  encryptedEncoding: z.literal("base64").default("base64"),
});

type Props = {
  state: AwsEncryptionSdkState;
  setParam: <K extends keyof AwsEncryptionSdkState>(
    key: K,
    value: AwsEncryptionSdkState[K],
    immediate?: boolean,
  ) => void;
  setStateSilently: (
    updater:
      | AwsEncryptionSdkState
      | ((prev: AwsEncryptionSdkState) => AwsEncryptionSdkState),
  ) => void;
  oversizeKeys: (keyof AwsEncryptionSdkState)[];
  paramsForHistory: Record<string, unknown>;
  hasUrlParams: boolean;
};

export default function AwsEncryptionSdkInner({
  state,
  setParam,
  setStateSilently,
  oversizeKeys,
  paramsForHistory,
  hasUrlParams,
}: Props) {
  const { entries, loading, upsertInputEntry, upsertParams } =
    useToolHistoryContext();
  const historyInitializedRef = React.useRef(false);

  // Local state for results
  const [decryptedResult, setDecryptedResult] = React.useState("");
  const [decryptedContext, setDecryptedContext] = React.useState<
    Record<string, string>
  >({});
  const [error, setError] = React.useState<string | null>(null);
  const [isEncrypting, setIsEncrypting] = React.useState(false);
  const [isDecrypting, setIsDecrypting] = React.useState(false);

  // --- Handlers ---

  const handleEncrypt = async () => {
    setError(null);
    setIsEncrypting(true);
    try {
      const encrypted = await encryptData(state);
      setParam("encryptedData", encrypted);

      // Save to history
      await upsertInputEntry(
        { type: "encrypt", input: state.inputData.slice(0, 50) + "..." },
        paramsForHistory,
        "left",
        `${state.keyringType} encrypted`,
      );
      await upsertParams(paramsForHistory, "deferred");

      // Auto-decrypt the just-generated data to verify and show result immediately
      const { plaintext, context } = await decryptData(state, encrypted);
      setDecryptedResult(plaintext);
      setDecryptedContext(context);
    } catch (e: any) {
      setError(e.message || "Encryption failed");
      console.error(e);
    } finally {
      setIsEncrypting(false);
    }
  };

  const handleDecrypt = React.useCallback(async () => {
    // Don't error on empty input, just clear result
    if (!state.encryptedData) {
      setDecryptedResult("");
      setDecryptedContext({});
      setError(null);
      return;
    }

    setError(null);
    setIsDecrypting(true);
    try {
      const { plaintext, context } = await decryptData(state);
      setDecryptedResult(plaintext);
      setDecryptedContext(context);
    } catch (e: any) {
      setError(e.message || "Decryption failed");
      // Don't clear result immediately on error to prevent flickering if user is typing
      // setDecryptedResult("");
    } finally {
      setIsDecrypting(false);
    }
  }, [state]);

  // Auto-decrypt when encrypted data changes
  React.useEffect(() => {
    const timer = setTimeout(() => {
      handleDecrypt();
    }, 500); // Debounce
    return () => clearTimeout(timer);
  }, [
    state.encryptedData,
    state.aesKey,
    state.rsaPrivateKey,
    state.keyringType,
    handleDecrypt,
  ]);

  const handleClearAll = () => {
    setStateSilently(defaultAwsEncryptionSdkState);
  };

  const handleGenerateKey = async () => {
    try {
      if (state.keyringType === "raw-aes") {
        const { key } = await generateAesKey(
          Number(state.aesKeyLength) as 128 | 192 | 256,
        );
        setParam("aesKey", key);
        setParam("aesKeyEncoding", "base64");
      } else {
        const { privateKey, publicKey } = await generateRsaKey();
        setParam("rsaPrivateKey", privateKey);
        setParam("rsaPublicKey", publicKey);
      }
    } catch (e: any) {
      setError("Failed to generate key: " + e.message);
    }
  };

  const handleKeyFileUpload = async (
    type: "aes" | "rsa-private" | "rsa-public",
    event: React.ChangeEvent<HTMLInputElement>,
  ) => {
    const file = event.target.files?.[0];
    if (!file) return;
    const text = await file.text();

    if (type === "aes") {
      setParam("aesKey", text.trim());
      // Simple heuristic: if looks like base64, set encoding to base64?
      // For now let user manually select encoding or default to what they had.
    } else if (type === "rsa-private") {
      setParam("rsaPrivateKey", text.trim());
    } else if (type === "rsa-public") {
      setParam("rsaPublicKey", text.trim());
    }

    // Reset input
    event.target.value = "";
  };

  // --- History Sync ---

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

    const latest = entries[0];
    const parsed = awsEncryptionSdkSchema.safeParse(latest.params);
    if (parsed.success) {
      setStateSilently(parsed.data as any);
      if (latest.hasInput !== false) {
        upsertParams(parsed.data as any, "deferred");
      }
    }

    historyInitializedRef.current = true;
  }, [
    entries,
    hasUrlParams,
    loading,
    paramsForHistory,
    setStateSilently,
    upsertParams,
  ]);

  React.useEffect(() => {
    if (!historyInitializedRef.current) return;
    upsertParams(paramsForHistory, "deferred");
  }, [paramsForHistory, upsertParams]);

  return (
    <AwsEncryptionSdkForm
      state={state}
      setParam={setParam}
      oversizeKeys={oversizeKeys}
      handleEncrypt={handleEncrypt}
      handleDecrypt={handleDecrypt}
      handleClearAll={handleClearAll}
      handleGenerateKey={handleGenerateKey}
      handleKeyFileUpload={handleKeyFileUpload}
      isEncrypting={isEncrypting}
      isDecrypting={isDecrypting}
      error={error}
      decryptedResult={decryptedResult}
      decryptedContext={decryptedContext}
    />
  );
}
