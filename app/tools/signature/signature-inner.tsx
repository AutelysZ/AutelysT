"use client";

import * as React from "react";
import { DEFAULT_URL_SYNC_DEBOUNCE_MS } from "@/lib/url-state/use-url-synced-state";
import { useToolHistoryContext } from "@/components/tool-ui/tool-page-wrapper";
import {
  type EcdsaCurve,
  type EddsaCurve,
  type InputEncoding,
  encodeSignatureBytes,
  decodeSignatureBytes,
  decodeInputBytes,
  randomBytes,
  randomAsciiString,
  getHmacKeyLength,
  decodeKeyBytes,
  formatSignatureError,
} from "./crypto";
import { encodeBase64 } from "@/lib/encoding/base64";
import { encodeHex } from "@/lib/encoding/hex";
import { type SignatureState } from "./signature-types";
import {
  getKeyFields,
  getKeySelection,
  getPqcSelectionKey,
  generateKeypair,
  signMessage,
  verifyMessage,
} from "./signature-utils";
import SignatureForm from "./signature-form";

export default function SignatureInner({
  state,
  setParam,
  oversizeKeys,
  hasUrlParams,
  hydrationSource,
  resetToDefaults,
  fileName,
  setFileName,
}: {
  state: SignatureState;
  setParam: <K extends keyof SignatureState>(
    key: K,
    value: SignatureState[K],
    immediate?: boolean,
  ) => void;
  oversizeKeys: (keyof SignatureState)[];
  hasUrlParams: boolean;
  hydrationSource: "default" | "url" | "history";
  resetToDefaults: () => void;
  fileName: string | null;
  setFileName: (value: string | null) => void;
}) {
  const { upsertInputEntry, upsertParams } = useToolHistoryContext();
  const [verificationStatus, setVerificationStatus] = React.useState<
    boolean | null
  >(null);
  const [error, setError] = React.useState<string | null>(null);
  const [isSigning, setIsSigning] = React.useState(false);
  const [isVerifying, setIsVerifying] = React.useState(false);
  const [copied, setCopied] = React.useState(false);

  const fileInputRef = React.useRef<HTMLInputElement>(null);
  const verifyFileInputRef = React.useRef<HTMLInputElement>(null);
  const privateKeyInputRef = React.useRef<HTMLInputElement>(null);
  const publicKeyInputRef = React.useRef<HTMLInputElement>(null);

  const ecdsaKeyCacheRef = React.useRef<
    Partial<Record<EcdsaCurve, { privateKey: string; publicKey: string }>>
  >({});
  const eddsaKeyCacheRef = React.useRef<
    Partial<Record<EddsaCurve, { privateKey: string; publicKey: string }>>
  >({});
  const pqcKeyCacheRef = React.useRef<
    Partial<Record<string, { privateKey: string; publicKey: string }>>
  >({});

  const prevEcdsaCurveRef = React.useRef<EcdsaCurve>(state.ecdsaCurve);
  const prevEddsaCurveRef = React.useRef<EddsaCurve>(state.eddsaCurve);
  const prevPqcSelectionRef = React.useRef(getPqcSelectionKey(state));

  const [isGeneratingKeys, setIsGeneratingKeys] = React.useState(false);
  const lastInputRef = React.useRef<string>("");
  const hasHydratedInputRef = React.useRef(false);

  const fileBytesRef = React.useRef<Uint8Array<ArrayBuffer> | null>(null);
  const [fileVersion, setFileVersion] = React.useState(0);
  const [fileMeta, setFileMeta] = React.useState<{
    name: string;
    size: number;
  } | null>(null);

  const verifyFileBytesRef = React.useRef<Uint8Array<ArrayBuffer> | null>(null);
  const [verifyFileVersion, setVerifyFileVersion] = React.useState(0);
  const [verifyFileMeta, setVerifyFileMeta] = React.useState<{
    name: string;
    size: number;
  } | null>(null);

  const paramsRef = React.useRef({
    algorithm: state.algorithm,
    inputEncoding: state.inputEncoding,
    verifyInputEncoding: state.verifyInputEncoding,
    signatureEncoding: state.signatureEncoding,
    hmacHash: state.hmacHash,
    hmacKey: state.hmacKey,
    hmacKeyEncoding: state.hmacKeyEncoding,
    rsaScheme: state.rsaScheme,
    rsaHash: state.rsaHash,
    rsaSaltLength: state.rsaSaltLength,
    rsaModulusLength: state.rsaModulusLength,
    rsaPublicExponent: state.rsaPublicExponent,
    ecdsaCurve: state.ecdsaCurve,
    ecdsaHash: state.ecdsaHash,
    eddsaCurve: state.eddsaCurve,
    pqcDsaVariant: state.pqcDsaVariant,
    pqcSlhVariant: state.pqcSlhVariant,
    pqcKeyEncoding: state.pqcKeyEncoding,
    rsaPrivateKey: state.rsaPrivateKey,
    rsaPublicKey: state.rsaPublicKey,
    ecdsaPrivateKey: state.ecdsaPrivateKey,
    ecdsaPublicKey: state.ecdsaPublicKey,
    eddsaPrivateKey: state.eddsaPrivateKey,
    eddsaPublicKey: state.eddsaPublicKey,
    schnorrPrivateKey: state.schnorrPrivateKey,
    schnorrPublicKey: state.schnorrPublicKey,
    pqcPrivateKey: state.pqcPrivateKey,
    pqcPublicKey: state.pqcPublicKey,
    fileName,
  });
  const hasInitializedParamsRef = React.useRef(false);
  const hasHandledUrlRef = React.useRef(false);

  const signRunRef = React.useRef(0);
  const verifyRunRef = React.useRef(0);

  const historyParams = React.useMemo(
    () => ({
      algorithm: state.algorithm,
      inputEncoding: state.inputEncoding,
      verifyInputEncoding: state.verifyInputEncoding,
      signatureEncoding: state.signatureEncoding,
      hmacHash: state.hmacHash,
      hmacKey: state.hmacKey,
      hmacKeyEncoding: state.hmacKeyEncoding,
      rsaScheme: state.rsaScheme,
      rsaHash: state.rsaHash,
      rsaSaltLength: state.rsaSaltLength,
      rsaModulusLength: state.rsaModulusLength,
      rsaPublicExponent: state.rsaPublicExponent,
      ecdsaCurve: state.ecdsaCurve,
      ecdsaHash: state.ecdsaHash,
      eddsaCurve: state.eddsaCurve,
      pqcDsaVariant: state.pqcDsaVariant,
      pqcSlhVariant: state.pqcSlhVariant,
      pqcKeyEncoding: state.pqcKeyEncoding,
      rsaPrivateKey: state.rsaPrivateKey,
      rsaPublicKey: state.rsaPublicKey,
      ecdsaPrivateKey: state.ecdsaPrivateKey,
      ecdsaPublicKey: state.ecdsaPublicKey,
      eddsaPrivateKey: state.eddsaPrivateKey,
      eddsaPublicKey: state.eddsaPublicKey,
      schnorrPrivateKey: state.schnorrPrivateKey,
      schnorrPublicKey: state.schnorrPublicKey,
      pqcPrivateKey: state.pqcPrivateKey,
      pqcPublicKey: state.pqcPublicKey,
      fileName,
    }),
    [
      state.algorithm,
      state.inputEncoding,
      state.verifyInputEncoding,
      state.signatureEncoding,
      state.hmacHash,
      state.hmacKey,
      state.hmacKeyEncoding,
      state.rsaScheme,
      state.rsaHash,
      state.rsaSaltLength,
      state.rsaModulusLength,
      state.rsaPublicExponent,
      state.ecdsaCurve,
      state.ecdsaHash,
      state.eddsaCurve,
      state.pqcDsaVariant,
      state.pqcSlhVariant,
      state.pqcKeyEncoding,
      state.rsaPrivateKey,
      state.rsaPublicKey,
      state.ecdsaPrivateKey,
      state.ecdsaPublicKey,
      state.eddsaPrivateKey,
      state.eddsaPublicKey,
      state.schnorrPrivateKey,
      state.schnorrPublicKey,
      state.pqcPrivateKey,
      state.pqcPublicKey,
      fileName,
    ],
  );

  React.useEffect(() => {
    const prevCurve = prevEcdsaCurveRef.current;
    if (prevCurve !== state.ecdsaCurve) {
      ecdsaKeyCacheRef.current[prevCurve] = {
        privateKey: state.ecdsaPrivateKey,
        publicKey: state.ecdsaPublicKey,
      };
      const cached = ecdsaKeyCacheRef.current[state.ecdsaCurve];
      const nextPrivate = cached?.privateKey ?? "";
      const nextPublic = cached?.publicKey ?? "";
      if (nextPrivate !== state.ecdsaPrivateKey)
        setParam("ecdsaPrivateKey", nextPrivate);
      if (nextPublic !== state.ecdsaPublicKey)
        setParam("ecdsaPublicKey", nextPublic);
      prevEcdsaCurveRef.current = state.ecdsaCurve;
      return;
    }
    ecdsaKeyCacheRef.current[state.ecdsaCurve] = {
      privateKey: state.ecdsaPrivateKey,
      publicKey: state.ecdsaPublicKey,
    };
  }, [state.ecdsaCurve, state.ecdsaPrivateKey, state.ecdsaPublicKey, setParam]);

  React.useEffect(() => {
    const prevCurve = prevEddsaCurveRef.current;
    if (prevCurve !== state.eddsaCurve) {
      eddsaKeyCacheRef.current[prevCurve] = {
        privateKey: state.eddsaPrivateKey,
        publicKey: state.eddsaPublicKey,
      };
      const cached = eddsaKeyCacheRef.current[state.eddsaCurve];
      const nextPrivate = cached?.privateKey ?? "";
      const nextPublic = cached?.publicKey ?? "";
      if (nextPrivate !== state.eddsaPrivateKey)
        setParam("eddsaPrivateKey", nextPrivate);
      if (nextPublic !== state.eddsaPublicKey)
        setParam("eddsaPublicKey", nextPublic);
      prevEddsaCurveRef.current = state.eddsaCurve;
      return;
    }
    eddsaKeyCacheRef.current[state.eddsaCurve] = {
      privateKey: state.eddsaPrivateKey,
      publicKey: state.eddsaPublicKey,
    };
  }, [state.eddsaCurve, state.eddsaPrivateKey, state.eddsaPublicKey, setParam]);

  React.useEffect(() => {
    if (state.algorithm !== "ml-dsa" && state.algorithm !== "slh-dsa") return;
    const selectionKey = getPqcSelectionKey(state);
    const prevKey = prevPqcSelectionRef.current;
    if (prevKey !== selectionKey) {
      pqcKeyCacheRef.current[prevKey] = {
        privateKey: state.pqcPrivateKey,
        publicKey: state.pqcPublicKey,
      };
      const cached = pqcKeyCacheRef.current[selectionKey];
      const nextPrivate = cached?.privateKey ?? "";
      const nextPublic = cached?.publicKey ?? "";
      if (nextPrivate !== state.pqcPrivateKey)
        setParam("pqcPrivateKey", nextPrivate);
      if (nextPublic !== state.pqcPublicKey)
        setParam("pqcPublicKey", nextPublic);
      prevPqcSelectionRef.current = selectionKey;
      return;
    }
    pqcKeyCacheRef.current[selectionKey] = {
      privateKey: state.pqcPrivateKey,
      publicKey: state.pqcPublicKey,
    };
  }, [
    state.algorithm,
    state.pqcDsaVariant,
    state.pqcSlhVariant,
    state.pqcPrivateKey,
    state.pqcPublicKey,
    setParam,
  ]);

  React.useEffect(() => {
    if (hasHydratedInputRef.current) return;
    if (hydrationSource === "default") return;
    const signature = fileName
      ? `file:${fileName}:${fileVersion}`
      : `text:${state.message}`;
    const inputSignature = `${signature}|sig:${state.signature}`;
    lastInputRef.current = inputSignature;
    hasHydratedInputRef.current = true;
  }, [hydrationSource, state.message, state.signature, fileName, fileVersion]);

  React.useEffect(() => {
    if (!fileName && fileBytesRef.current) {
      fileBytesRef.current = null;
      setFileMeta(null);
      if (fileVersion) setFileVersion(0);
    }
  }, [fileName, fileVersion]);

  React.useEffect(() => {
    if (!verifyFileMeta && verifyFileBytesRef.current) {
      verifyFileBytesRef.current = null;
      if (verifyFileVersion) setVerifyFileVersion(0);
    }
  }, [verifyFileMeta, verifyFileVersion]);

  React.useEffect(() => {
    const hasFile = Boolean(fileName && fileVersion);
    const signature = hasFile
      ? `file:${fileName}:${fileVersion}`
      : `text:${state.message}`;
    const inputSignature = `${signature}|sig:${state.signature}`;
    if (
      (!hasFile && !state.message && !state.signature) ||
      inputSignature === lastInputRef.current
    )
      return;

    const timer = setTimeout(() => {
      lastInputRef.current = inputSignature;
      const preview =
        fileName ??
        (state.message
          ? state.message.slice(0, 100)
          : state.signature.slice(0, 100));
      upsertInputEntry(
        { message: fileName ? "" : state.message, signature: state.signature },
        historyParams,
        "left",
        preview,
      );
    }, DEFAULT_URL_SYNC_DEBOUNCE_MS);

    return () => clearTimeout(timer);
  }, [
    state.message,
    state.signature,
    fileName,
    fileVersion,
    upsertInputEntry,
    historyParams,
  ]);

  React.useEffect(() => {
    if (hasUrlParams && !hasHandledUrlRef.current) {
      hasHandledUrlRef.current = true;
      const hasInput = Boolean(state.message || state.signature);
      if (hasInput) {
        const preview = state.message
          ? state.message.slice(0, 100)
          : state.signature.slice(0, 100);
        upsertInputEntry(
          { message: state.message, signature: state.signature },
          historyParams,
          "left",
          preview,
        );
      } else {
        upsertParams(historyParams, "interpretation");
      }
    }
  }, [
    hasUrlParams,
    state.message,
    state.signature,
    historyParams,
    upsertInputEntry,
    upsertParams,
  ]);

  React.useEffect(() => {
    const nextParams = historyParams;
    if (!hasInitializedParamsRef.current) {
      hasInitializedParamsRef.current = true;
      paramsRef.current = nextParams;
      return;
    }
    if (
      paramsRef.current.algorithm === nextParams.algorithm &&
      paramsRef.current.inputEncoding === nextParams.inputEncoding &&
      paramsRef.current.verifyInputEncoding ===
        nextParams.verifyInputEncoding &&
      paramsRef.current.signatureEncoding === nextParams.signatureEncoding &&
      paramsRef.current.hmacHash === nextParams.hmacHash &&
      paramsRef.current.hmacKey === nextParams.hmacKey &&
      paramsRef.current.hmacKeyEncoding === nextParams.hmacKeyEncoding &&
      paramsRef.current.rsaScheme === nextParams.rsaScheme &&
      paramsRef.current.rsaHash === nextParams.rsaHash &&
      paramsRef.current.rsaSaltLength === nextParams.rsaSaltLength &&
      paramsRef.current.rsaModulusLength === nextParams.rsaModulusLength &&
      paramsRef.current.rsaPublicExponent === nextParams.rsaPublicExponent &&
      paramsRef.current.ecdsaCurve === nextParams.ecdsaCurve &&
      paramsRef.current.ecdsaHash === nextParams.ecdsaHash &&
      paramsRef.current.eddsaCurve === nextParams.eddsaCurve &&
      paramsRef.current.pqcDsaVariant === nextParams.pqcDsaVariant &&
      paramsRef.current.pqcSlhVariant === nextParams.pqcSlhVariant &&
      paramsRef.current.pqcKeyEncoding === nextParams.pqcKeyEncoding &&
      paramsRef.current.rsaPrivateKey === nextParams.rsaPrivateKey &&
      paramsRef.current.rsaPublicKey === nextParams.rsaPublicKey &&
      paramsRef.current.ecdsaPrivateKey === nextParams.ecdsaPrivateKey &&
      paramsRef.current.ecdsaPublicKey === nextParams.ecdsaPublicKey &&
      paramsRef.current.eddsaPrivateKey === nextParams.eddsaPrivateKey &&
      paramsRef.current.eddsaPublicKey === nextParams.eddsaPublicKey &&
      paramsRef.current.schnorrPrivateKey === nextParams.schnorrPrivateKey &&
      paramsRef.current.schnorrPublicKey === nextParams.schnorrPublicKey &&
      paramsRef.current.pqcPrivateKey === nextParams.pqcPrivateKey &&
      paramsRef.current.pqcPublicKey === nextParams.pqcPublicKey &&
      paramsRef.current.fileName === nextParams.fileName
    ) {
      return;
    }
    paramsRef.current = nextParams;
    upsertParams(nextParams, "interpretation");
  }, [historyParams, upsertParams]);

  React.useEffect(() => {
    if (fileName) {
      if (state.inputEncoding !== "binary") {
        setParam("inputEncoding", "binary", true);
      }
    } else {
      const allowed: InputEncoding[] = ["utf8", "base64", "hex"];
      if (!allowed.includes(state.inputEncoding)) {
        setParam("inputEncoding", "utf8", true);
      }
    }
  }, [fileName, state.inputEncoding, setParam]);

  React.useEffect(() => {
    if (verifyFileMeta) {
      if (state.verifyInputEncoding !== "binary") {
        setParam("verifyInputEncoding", "binary", true);
      }
    } else {
      const allowed: InputEncoding[] = ["utf8", "base64", "hex"];
      if (!allowed.includes(state.verifyInputEncoding)) {
        setParam("verifyInputEncoding", "utf8", true);
      }
    }
  }, [verifyFileMeta, state.verifyInputEncoding, setParam]);

  const keySelection = React.useMemo(
    () => getKeySelection(state),
    [
      state.algorithm,
      state.rsaPrivateKey,
      state.rsaPublicKey,
      state.ecdsaPrivateKey,
      state.ecdsaPublicKey,
      state.eddsaPrivateKey,
      state.eddsaPublicKey,
      state.schnorrPrivateKey,
      state.schnorrPublicKey,
      state.pqcPrivateKey,
      state.pqcPublicKey,
    ],
  );

  const handleSign = async () => {
    const hasFile = Boolean(fileBytesRef.current && fileName);
    const hasMessage = hasFile || Boolean(state.message);

    // Allow signing empty message? HMAC allows it.
    // If not ready, maybe show error?

    const runId = ++signRunRef.current;
    setIsSigning(true);
    setError(null);

    try {
      const messageBytes = hasFile
        ? (fileBytesRef.current as Uint8Array<ArrayBuffer>)
        : decodeInputBytes(state.message, state.inputEncoding);

      const signatureBytes = await signMessage({
        messageBytes,
        state,
        privateKeyText: keySelection.privateKey,
      });
      const encoded = encodeSignatureBytes(
        signatureBytes,
        state.signatureEncoding,
      );
      if (signRunRef.current !== runId) return;
      setParam("signature", encoded);
      setError(null);
    } catch (err) {
      if (signRunRef.current !== runId) return;
      console.error(err);
      setError(formatSignatureError(err));
    } finally {
      if (signRunRef.current === runId) {
        setIsSigning(false);
      }
    }
  };

  // Verification Effect
  React.useEffect(() => {
    const hasFile = Boolean(verifyFileBytesRef.current && verifyFileMeta);
    const hasMessage = hasFile || Boolean(state.verifyMessage);
    const hasSignature = Boolean(state.signature);

    if (!hasMessage || !hasSignature) {
      setVerificationStatus(null);
      setIsVerifying(false);
      return;
    }

    const runId = ++verifyRunRef.current;
    setIsVerifying(true);
    // setError(null); // Separate error for verify?
    // Sign error might overlap. Use separate errors or shared?
    // Use shared error mostly for key issues.

    const run = async () => {
      try {
        // Use same encoding input for verify message for now
        // Or should verify have its own encoding?
        // Assuming same encoding for simplicity as per original design
        const messageBytes = hasFile
          ? (verifyFileBytesRef.current as Uint8Array<ArrayBuffer>)
          : decodeInputBytes(state.verifyMessage, state.verifyInputEncoding);

        const signatureBytes = decodeSignatureBytes(
          state.signature,
          state.signatureEncoding,
        );
        const valid = await verifyMessage({
          messageBytes,
          signatureBytes,
          state,
          publicKeyText: keySelection.publicKey,
          privateKeyText: keySelection.privateKey,
        });
        if (verifyRunRef.current !== runId) return;
        setVerificationStatus(valid);
      } catch (err) {
        if (verifyRunRef.current !== runId) return;
        console.error(err);
        setVerificationStatus(false);
      } finally {
        if (verifyRunRef.current === runId) {
          setIsVerifying(false);
        }
      }
    };

    const timer = setTimeout(run, 300);
    return () => clearTimeout(timer);
  }, [
    state.verifyMessage,
    state.verifyInputEncoding,
    state.signature,
    state.inputEncoding,
    state.signatureEncoding,
    state.algorithm,
    state.hmacKey,
    state.hmacKeyEncoding,
    state.hmacHash,
    state.rsaScheme,
    state.rsaHash,
    state.rsaSaltLength,
    keySelection.publicKey,
    keySelection.privateKey,
    verifyFileMeta,
    verifyFileVersion,
  ]);

  const handleCopyOutput = async () => {
    await navigator.clipboard.writeText(state.signature);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownloadOutput = () => {
    const blob = new Blob([state.signature], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `signature.${state.signatureEncoding === "hex" ? "hex" : "txt"}`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleUploadClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const buffer = reader.result;
      if (!(buffer instanceof ArrayBuffer)) return;
      fileBytesRef.current = new Uint8Array(buffer);
      setFileName(file.name);
      setFileMeta({ name: file.name, size: file.size });
      setFileVersion((prev) => prev + 1);
    };
    reader.readAsArrayBuffer(file);
  };

  const handleClearFile = () => {
    fileBytesRef.current = null;
    setFileName(null);
    setFileMeta(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleVerifyUploadClick = () => {
    verifyFileInputRef.current?.click();
  };

  const handleVerifyFileUpload = (
    event: React.ChangeEvent<HTMLInputElement>,
  ) => {
    const file = event.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const buffer = reader.result;
      if (!(buffer instanceof ArrayBuffer)) return;
      verifyFileBytesRef.current = new Uint8Array(buffer);
      setVerifyFileMeta({ name: file.name, size: file.size });
      setVerifyFileVersion((prev) => prev + 1);
    };
    reader.readAsArrayBuffer(file);
  };

  const handleVerifyClearFile = () => {
    verifyFileBytesRef.current = null;
    setVerifyFileMeta(null);
    if (verifyFileInputRef.current) verifyFileInputRef.current.value = "";
    setVerifyFileVersion((prev) => prev + 1);
  };

  const handleClearAll = React.useCallback(() => {
    signRunRef.current += 1;
    verifyRunRef.current += 1;
    resetToDefaults();
    setFileName(null);
    setFileMeta(null);
    fileBytesRef.current = null;
    if (fileInputRef.current) fileInputRef.current.value = "";
    setFileVersion(0);

    setVerifyFileMeta(null);
    verifyFileBytesRef.current = null;
    if (verifyFileInputRef.current) verifyFileInputRef.current.value = "";
    setVerifyFileVersion(0);

    setVerificationStatus(null);
    setError(null);
    setIsSigning(false);
    setIsVerifying(false);
    setCopied(false);
  }, [resetToDefaults, setFileName]);

  const handleGenerateKey = () => {
    try {
      const bytes = randomBytes(getHmacKeyLength(state.hmacHash));
      const encoded =
        state.hmacKeyEncoding === "utf8"
          ? randomAsciiString(getHmacKeyLength(state.hmacHash))
          : state.hmacKeyEncoding === "hex"
            ? encodeHex(bytes, { upperCase: false })
            : encodeBase64(bytes, { urlSafe: false, padding: true });
      setParam("hmacKey", encoded);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Unable to generate a key.",
      );
    }
  };

  const handleKeyUploadClick = (type: "private" | "public") => {
    if (type === "private") {
      privateKeyInputRef.current?.click();
    } else {
      publicKeyInputRef.current?.click();
    }
  };

  const handleKeyFileUpload = (
    type: "private" | "public",
    event: React.ChangeEvent<HTMLInputElement>,
  ) => {
    const file = event.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result;
      if (typeof result !== "string") return;
      const fields = getKeyFields(state.algorithm);
      setParam(
        type === "private" ? fields.privateKey : fields.publicKey,
        result,
      );
    };
    reader.readAsText(file);
  };

  const handleGenerateKeypair = async () => {
    try {
      setIsGeneratingKeys(true);
      setError(null);
      const { publicPem, privatePem } = await generateKeypair(state);
      const fields = getKeyFields(state.algorithm);
      setParam(fields.publicKey, publicPem);
      setParam(fields.privateKey, privatePem);
    } catch (err) {
      setError(formatSignatureError(err));
    } finally {
      setIsGeneratingKeys(false);
    }
  };

  const inputWarning =
    state.inputEncoding === "binary" && !fileName
      ? "Binary input requires a file upload."
      : null;

  return (
    <SignatureForm
      state={state}
      setParam={setParam}
      oversizeKeys={oversizeKeys}
      fileInputRef={fileInputRef}
      handleFileUpload={handleFileUpload}
      handleUploadClick={handleUploadClick}
      handleClearFile={handleClearFile}
      fileName={fileName}
      fileMeta={fileMeta}
      verifyFileInputRef={verifyFileInputRef}
      handleVerifyFileUpload={handleVerifyFileUpload}
      handleVerifyUploadClick={handleVerifyUploadClick}
      handleVerifyClearFile={handleVerifyClearFile}
      verifyFileMeta={verifyFileMeta}
      privateKeyInputRef={privateKeyInputRef}
      publicKeyInputRef={publicKeyInputRef}
      handleKeyUploadClick={handleKeyUploadClick}
      handleKeyFileUpload={handleKeyFileUpload}
      handleGenerateKey={handleGenerateKey}
      handleGenerateKeypair={handleGenerateKeypair}
      isGeneratingKeys={isGeneratingKeys}
      handleClearAll={handleClearAll}
      handleSign={handleSign}
      isSigning={isSigning}
      isVerifying={isVerifying}
      verificationStatus={verificationStatus}
      error={error}
      handleCopyOutput={handleCopyOutput}
      handleDownloadOutput={handleDownloadOutput}
      copied={copied}
      inputWarning={inputWarning}
    />
  );
}
