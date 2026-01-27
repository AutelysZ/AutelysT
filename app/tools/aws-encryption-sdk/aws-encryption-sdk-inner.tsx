import * as React from "react";
import { z } from "zod";
import { useToolHistoryContext } from "@/components/tool-ui/tool-page-wrapper";
import {
  defaultAwsEncryptionSdkState,
  type AwsEncryptionSdkState,
  type AwsEncryptionSdkKeyringType,
  type DecryptedHeader,
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

  encryptionContext: z.string().default("{}"),

  inputData: z.string().default(""),
  inputEncoding: z.enum(["utf8", "base64", "hex", "binary"]).default("utf8"),

  encryptedData: z.string().default(""),
  encryptedEncoding: z
    .enum(["base64", "base64url", "hex", "binary"])
    .default("base64"),

  decryptedEncoding: z.enum(["utf8", "base64", "hex"]).default("utf8"),
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
  const [decryptedHeader, setDecryptedHeader] =
    React.useState<DecryptedHeader | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [isEncrypting, setIsEncrypting] = React.useState(false);
  const [isDecrypting, setIsDecrypting] = React.useState(false);
  const [decryptedBytes, setDecryptedBytes] = React.useState<Uint8Array | null>(
    null,
  );

  // File Refs
  const inputBytesRef = React.useRef<Uint8Array | null>(null);
  const [inputFileName, setInputFileName] = React.useState<string | null>(null);

  const encryptedBytesRef = React.useRef<Uint8Array | null>(null);
  const [encryptedFileName, setEncryptedFileName] = React.useState<
    string | null
  >(null);

  // --- Handlers ---

  const handleEncrypt = async () => {
    setError(null);
    setIsEncrypting(true);
    try {
      const encrypted = await encryptData(
        state,
        inputFileName && inputBytesRef.current
          ? inputBytesRef.current
          : undefined,
      );
      setParam("encryptedData", encrypted);

      // Save to history
      const preview = inputFileName
        ? `[File: ${inputFileName}]`
        : state.inputData.slice(0, 50) +
          (state.inputData.length > 50 ? "..." : "");

      await upsertInputEntry(
        { type: "encrypt", input: preview },
        paramsForHistory,
        "left",
        `${state.keyringType} encrypted`,
      );
      await upsertParams(paramsForHistory, "deferred");

      // Auto-decrypt the just-generated data to verify and show result immediately
      // We pass the encrypted string we just got. Since we just generated it, it matches state.encryptedEncoding
      // But decryptData expects Uint8Array if override.
      // Actually decryptData takes override? yes.
      // But simpler: just let the effect trigger or call decrypt manually.
      // However, to be fast and show immediately without effect lag:
      // We need to decode the result string back to bytes to pass to decryptData as override,
      // OR just wait for effect. Effect is 500ms debounce.
      // Let's rely on effect for simplicity, effectively.
      // But if we want instant feedback:
      // const bytes = state.encryptedEncoding === 'hex' ? decodeHex(encrypted) : ...
      // Let's just wait for effect.
    } catch (e: any) {
      setError(e.message || "Encryption failed");
      console.error(e);
    } finally {
      setIsEncrypting(false);
    }
  };

  const handleDecrypt = React.useCallback(async () => {
    // Don't error on empty input, just clear result
    // If file is uploaded, encryptedData might be empty string? No, we should populate it?
    // Actually for binary file upload of encrypted data, we might NOT populate the text area if it's huge.
    // But for this tool usually we put it in text area if small enough, or just keep it in ref.
    // If we have file ref, use it.
    if (!state.encryptedData && !encryptedFileName) {
      setDecryptedResult("");
      setDecryptedResult("");
      setDecryptedContext({});
      setDecryptedHeader(null);
      setDecryptedBytes(null);
      setError(null);
      return;
    }

    setError(null);
    setIsDecrypting(true);
    try {
      const { plaintext, plaintextBytes, context, header } = await decryptData(
        state,
        encryptedFileName && encryptedBytesRef.current
          ? encryptedBytesRef.current
          : undefined, // Will read from state.encryptedData
      );
      setDecryptedResult(plaintext);
      // If result is huge binary, plaintext string might be the "[Invalid UTF-8]" placeholder
      setDecryptedContext(context);
      setDecryptedHeader(header);
      setDecryptedBytes(plaintextBytes);
    } catch (e: any) {
      setError(e.message || "Decryption failed");
      // Don't clear result immediately on error to prevent flickering if user is typing
      // setDecryptedResult("");
    } finally {
      setIsDecrypting(false);
    }
  }, [state, encryptedFileName]);

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
    state.encryptedEncoding,
    state.decryptedEncoding,
    encryptedFileName, // Also trigger when file changes
    handleDecrypt,
  ]);

  const handleClearAll = () => {
    setStateSilently(defaultAwsEncryptionSdkState);
    inputBytesRef.current = null;
    setInputFileName(null);
    encryptedBytesRef.current = null;
    setEncryptedFileName(null);
    setDecryptedBytes(null);
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
    } else if (type === "rsa-private") {
      setParam("rsaPrivateKey", text.trim());
    } else if (type === "rsa-public") {
      setParam("rsaPublicKey", text.trim());
    }
    event.target.value = "";
  };

  // --- File Upload Helpers ---

  const handleInputFileUpload = (
    event: React.ChangeEvent<HTMLInputElement>,
  ) => {
    const file = event.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const buffer = reader.result;
      if (!(buffer instanceof ArrayBuffer)) return;
      inputBytesRef.current = new Uint8Array(buffer);
      setInputFileName(file.name);
      setParam("inputEncoding", "binary");
    };
    reader.readAsArrayBuffer(file);
    event.target.value = "";
  };

  const handleInputFileClear = () => {
    inputBytesRef.current = null;
    setInputFileName(null);
    if (state.inputEncoding === "binary") {
      setParam("inputEncoding", "utf8");
    }
  };

  const handleEncryptedFileUpload = (
    event: React.ChangeEvent<HTMLInputElement>,
  ) => {
    const file = event.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const buffer = reader.result;
      if (!(buffer instanceof ArrayBuffer)) return;
      encryptedBytesRef.current = new Uint8Array(buffer);
      setEncryptedFileName(file.name);
      setParam("encryptedEncoding", "binary"); // Or whatever the file contains?
      // Usually binaries are raw bytes, so 'binary' is correct if we had it.
      // But encryptedEncoding list is: base64, base64url, hex, binary.
    };
    reader.readAsArrayBuffer(file);
    event.target.value = "";
  };

  const handleEncryptedFileClear = () => {
    encryptedBytesRef.current = null;
    setEncryptedFileName(null);
    if (state.encryptedEncoding === "binary") {
      setParam("encryptedEncoding", "base64");
    }
  };

  const handleDownloadDecrypted = () => {
    if (!decryptedBytes) return;
    const blob = new Blob([decryptedBytes as any], {
      // Cast to any to avoid TS lib mismatch
      type: "application/octet-stream",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "decrypted-data.bin"; // Could try to detect extension?
    a.click();
    URL.revokeObjectURL(url);
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

  // Ensure encoding consistency (unselect binary if no file)
  React.useEffect(() => {
    if (!inputFileName && state.inputEncoding === "binary") {
      setParam("inputEncoding", "utf8");
    }
    if (!encryptedFileName && state.encryptedEncoding === "binary") {
      setParam("encryptedEncoding", "base64");
    }
  }, [
    inputFileName,
    state.inputEncoding,
    encryptedFileName,
    state.encryptedEncoding,
    setParam,
  ]);

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
      decryptedHeader={decryptedHeader}
      // New props
      handleInputFileUpload={handleInputFileUpload}
      handleInputFileClear={handleInputFileClear}
      inputFileName={inputFileName}
      handleEncryptedFileUpload={handleEncryptedFileUpload}
      handleEncryptedFileClear={handleEncryptedFileClear}
      encryptedFileName={encryptedFileName}
      handleDownloadDecrypted={handleDownloadDecrypted}
      hasDecryptedBytes={!!decryptedBytes}
    />
  );
}
