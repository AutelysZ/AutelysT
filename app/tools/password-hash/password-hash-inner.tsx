"use client";

import * as React from "react";
import { DEFAULT_URL_SYNC_DEBOUNCE_MS } from "@/lib/url-state/use-url-synced-state";
import { useToolHistoryContext } from "@/components/tool-ui/tool-page-wrapper";
import type { PasswordHashState } from "./password-hash-types";
import PasswordHashForm from "./password-hash-form";
import {
  hashBcrypt,
  parseBcryptHash,
  verifyBcrypt,
} from "@/lib/password-hash/bcrypt";
import {
  hashScrypt,
  parseScryptHash,
  verifyScrypt,
} from "@/lib/password-hash/scrypt";
import {
  hashArgon2,
  parseArgon2Hash,
  verifyArgon2,
} from "@/lib/password-hash/argon2";

export default function PasswordHashInner({
  state,
  setParam,
  oversizeKeys,
  hasUrlParams,
  hydrationSource,
  resetToDefaults,
}: {
  state: PasswordHashState;
  setParam: <K extends keyof PasswordHashState>(
    key: K,
    value: PasswordHashState[K],
    immediate?: boolean,
  ) => void;
  oversizeKeys: (keyof PasswordHashState)[];
  hasUrlParams: boolean;
  hydrationSource: "default" | "url" | "history";
  resetToDefaults: () => void;
}) {
  const { upsertInputEntry, upsertParams, clearHistory } = useToolHistoryContext();
  const lastSignatureRef = React.useRef("");
  const hasHydratedRef = React.useRef(false);
  const hasHandledUrlRef = React.useRef(false);

  const [bcryptError, setBcryptError] = React.useState<string | null>(null);
  const [bcryptVerifyResult, setBcryptVerifyResult] = React.useState<
    "valid" | "invalid" | null
  >(null);

  const [scryptError, setScryptError] = React.useState<string | null>(null);
  const [scryptVerifyResult, setScryptVerifyResult] = React.useState<
    "valid" | "invalid" | null
  >(null);
  const [scryptWorking, setScryptWorking] = React.useState(false);

  const [argon2Error, setArgon2Error] = React.useState<string | null>(null);
  const [argon2VerifyResult, setArgon2VerifyResult] = React.useState<
    "valid" | "invalid" | null
  >(null);
  const [argon2Working, setArgon2Working] = React.useState(false);

  React.useEffect(() => {
    if (hasHydratedRef.current) return;
    if (hydrationSource === "default") return;
    hasHydratedRef.current = true;
    lastSignatureRef.current = JSON.stringify(state);
  }, [hydrationSource, state]);

  React.useEffect(() => {
    const signature = JSON.stringify(state);
    if (!signature || signature === lastSignatureRef.current) return;

    const timer = setTimeout(() => {
      lastSignatureRef.current = signature;
      const preview =
        state.bcryptPassword ||
        state.scryptPassword ||
        state.argon2Password ||
        state.bcryptVerifyHash ||
        state.scryptVerifyHash ||
        state.argon2VerifyHash ||
        "Password hash inputs";
      upsertInputEntry({ ...state }, {}, "left", preview.slice(0, 120));
    }, DEFAULT_URL_SYNC_DEBOUNCE_MS);

    return () => clearTimeout(timer);
  }, [state, upsertInputEntry]);

  React.useEffect(() => {
    if (hasUrlParams && !hasHandledUrlRef.current) {
      hasHandledUrlRef.current = true;
      if (lastSignatureRef.current) return;
      upsertParams({}, "interpretation");
    }
  }, [hasUrlParams, upsertParams]);

  const handleClearAll = React.useCallback(async () => {
    await clearHistory("tool");
    resetToDefaults();
    if (typeof window !== "undefined") {
      window.history.replaceState({}, "", window.location.pathname);
    }
    setBcryptError(null);
    setBcryptVerifyResult(null);
    setScryptError(null);
    setScryptVerifyResult(null);
    setArgon2Error(null);
    setArgon2VerifyResult(null);
  }, [clearHistory, resetToDefaults]);

  const handleBcryptGenerate = React.useCallback(() => {
    try {
      setBcryptError(null);
      const hash = hashBcrypt(state.bcryptPassword, state.bcryptRounds);
      setParam("bcryptParseHash", hash, true);
    } catch (error) {
      console.error(error);
      setBcryptError(
        error instanceof Error ? error.message : "Failed to generate bcrypt hash.",
      );
    }
  }, [setParam, state.bcryptPassword, state.bcryptRounds]);

  const handleBcryptVerify = React.useCallback(() => {
    if (!state.bcryptVerifyPassword || !state.bcryptParseHash) {
      setBcryptVerifyResult(null);
      return;
    }
    try {
      setBcryptError(null);
      const result = verifyBcrypt(
        state.bcryptVerifyPassword,
        state.bcryptParseHash,
      );
      setBcryptVerifyResult(result ? "valid" : "invalid");
    } catch (error) {
      console.error(error);
      setBcryptError(
        error instanceof Error ? error.message : "Failed to verify bcrypt hash.",
      );
      setBcryptVerifyResult(null);
    }
  }, [state.bcryptParseHash, state.bcryptVerifyPassword]);

  const handleScryptGenerate = React.useCallback(async () => {
    try {
      setScryptWorking(true);
      setScryptError(null);
      const hash = await hashScrypt(state.scryptPassword, {
        N: state.scryptN,
        r: state.scryptR,
        p: state.scryptP,
        dkLen: state.scryptDkLen,
        salt: state.scryptSalt,
        saltLength: state.scryptSaltLength,
      });
      setParam("scryptParseHash", hash, true);
    } catch (error) {
      console.error(error);
      setScryptError(
        error instanceof Error ? error.message : "Failed to generate scrypt hash.",
      );
    } finally {
      setScryptWorking(false);
    }
  }, [
    state.scryptPassword,
    state.scryptN,
    state.scryptR,
    state.scryptP,
    state.scryptDkLen,
    state.scryptSalt,
    state.scryptSaltLength,
    setParam,
  ]);

  const handleScryptVerify = React.useCallback(async () => {
    if (!state.scryptVerifyPassword || !state.scryptParseHash) {
      setScryptVerifyResult(null);
      return;
    }
    try {
      setScryptWorking(true);
      setScryptError(null);
      const result = await verifyScrypt(
        state.scryptVerifyPassword,
        state.scryptParseHash,
      );
      setScryptVerifyResult(result ? "valid" : "invalid");
    } catch (error) {
      console.error(error);
      setScryptError(
        error instanceof Error ? error.message : "Failed to verify scrypt hash.",
      );
      setScryptVerifyResult(null);
    } finally {
      setScryptWorking(false);
    }
  }, [state.scryptParseHash, state.scryptVerifyPassword]);

  const handleArgon2Generate = React.useCallback(async () => {
    try {
      setArgon2Working(true);
      setArgon2Error(null);
      const hash = await hashArgon2(state.argon2Password, {
        type: state.argon2Type,
        time: state.argon2Time,
        memory: state.argon2Memory,
        parallelism: state.argon2Parallelism,
        hashLen: state.argon2HashLen,
        salt: state.argon2Salt,
        saltLength: state.argon2SaltLength,
      });
      setParam("argon2ParseHash", hash, true);
    } catch (error) {
      console.error(error);
      setArgon2Error(
        error instanceof Error ? error.message : "Failed to generate Argon2 hash.",
      );
    } finally {
      setArgon2Working(false);
    }
  }, [
    state.argon2Password,
    state.argon2Type,
    state.argon2Time,
    state.argon2Memory,
    state.argon2Parallelism,
    state.argon2HashLen,
    state.argon2Salt,
    state.argon2SaltLength,
    setParam,
  ]);

  const handleArgon2Verify = React.useCallback(async () => {
    if (!state.argon2VerifyPassword || !state.argon2ParseHash) {
      setArgon2VerifyResult(null);
      return;
    }
    try {
      setArgon2Working(true);
      setArgon2Error(null);
      const result = await verifyArgon2(
        state.argon2VerifyPassword,
        state.argon2ParseHash,
      );
      setArgon2VerifyResult(result ? "valid" : "invalid");
    } catch (error) {
      console.error(error);
      setArgon2Error(
        error instanceof Error ? error.message : "Failed to verify Argon2 hash.",
      );
      setArgon2VerifyResult(null);
    } finally {
      setArgon2Working(false);
    }
  }, [state.argon2ParseHash, state.argon2VerifyPassword]);

  const parsedBcrypt = React.useMemo(
    () => parseBcryptHash(state.bcryptParseHash),
    [state.bcryptParseHash],
  );

  const parsedScrypt = React.useMemo(
    () => parseScryptHash(state.scryptParseHash),
    [state.scryptParseHash],
  );

  const parsedArgon2 = React.useMemo(
    () => parseArgon2Hash(state.argon2ParseHash),
    [state.argon2ParseHash],
  );

  React.useEffect(() => {
    setBcryptVerifyResult(null);
  }, [state.bcryptVerifyPassword, state.bcryptParseHash]);

  React.useEffect(() => {
    setScryptVerifyResult(null);
  }, [state.scryptVerifyPassword, state.scryptParseHash]);

  React.useEffect(() => {
    setArgon2VerifyResult(null);
  }, [state.argon2VerifyPassword, state.argon2ParseHash]);

  return (
    <PasswordHashForm
      state={state}
      setParam={setParam}
      oversizeKeys={oversizeKeys}
      onClearAll={handleClearAll}
      bcryptError={bcryptError}
      bcryptVerifyResult={bcryptVerifyResult}
      onBcryptGenerate={handleBcryptGenerate}
      onBcryptVerify={handleBcryptVerify}
      parsedBcrypt={parsedBcrypt}
      scryptError={scryptError}
      scryptVerifyResult={scryptVerifyResult}
      scryptWorking={scryptWorking}
      onScryptGenerate={handleScryptGenerate}
      onScryptVerify={handleScryptVerify}
      parsedScrypt={parsedScrypt}
      argon2Error={argon2Error}
      argon2VerifyResult={argon2VerifyResult}
      argon2Working={argon2Working}
      onArgon2Generate={handleArgon2Generate}
      onArgon2Verify={handleArgon2Verify}
      parsedArgon2={parsedArgon2}
    />
  );
}
