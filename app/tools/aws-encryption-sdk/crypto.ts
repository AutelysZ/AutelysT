import {
  RawAesKeyringWebCrypto,
  RawRsaKeyringWebCrypto,
  buildClient,
  CommitmentPolicy,
  AlgorithmSuiteIdentifier,
} from "@aws-crypto/client-browser";
import { encodeBase64, decodeBase64 } from "@/lib/encoding/base64";
import { encodeHex, decodeHex } from "@/lib/encoding/hex";
import type {
  AwsEncryptionSdkState,
  AwsEncryptionSdkKeyringType,
  DecryptedHeader,
} from "./aws-encryption-sdk-types";

// Initialize the client
const { encrypt, decrypt } = buildClient(
  CommitmentPolicy.REQUIRE_ENCRYPT_REQUIRE_DECRYPT,
);

// --- Key Import / Helpers ---

// Helper to decode key string based on encoding
export function decodeKey(
  key: string,
  encoding: "utf8" | "base64" | "hex",
): Uint8Array<ArrayBuffer> {
  if (!key) return new Uint8Array(0);
  try {
    if (encoding === "base64") return decodeBase64(key);
    if (encoding === "hex") return decodeHex(key);
    return new TextEncoder().encode(key);
  } catch (e) {
    throw new Error(`Failed to decode key with encoding ${encoding}`);
  }
}

// AES Key generation
export async function generateAesKey(
  length: 128 | 192 | 256,
): Promise<{ key: string; encoding: "base64" }> {
  const key = await window.crypto.subtle.generateKey(
    { name: "AES-GCM", length },
    true,
    ["encrypt", "decrypt"],
  );
  const exported = await window.crypto.subtle.exportKey("raw", key);
  return {
    key: encodeBase64(new Uint8Array(exported)),
    encoding: "base64",
  };
}

// RSA Key generation
export async function generateRsaKey(
  modulusLength: 2048 | 3072 | 4096 = 2048,
): Promise<{ privateKey: string; publicKey: string }> {
  const keyPair = await window.crypto.subtle.generateKey(
    {
      name: "RSA-OAEP",
      modulusLength,
      publicExponent: new Uint8Array([1, 0, 1]),
      hash: "SHA-256",
    },
    true,
    ["decrypt", "unwrapKey"], // Private key usage
  );

  const exportedPrivate = await window.crypto.subtle.exportKey(
    "pkcs8",
    keyPair.privateKey,
  );
  const exportedPublic = await window.crypto.subtle.exportKey(
    "spki",
    keyPair.publicKey,
  );

  return {
    privateKey: toPem(exportedPrivate, "PRIVATE KEY"),
    publicKey: toPem(exportedPublic, "PUBLIC KEY"),
  };
}

// PEM formatting helper
function toPem(buffer: ArrayBuffer, type: string): string {
  const b64 = encodeBase64(new Uint8Array(buffer));
  const lines = b64.match(/.{1,64}/g) || [];
  return `-----BEGIN ${type}-----\n${lines.join("\n")}\n-----END ${type}-----`;
}

// Helper to remove PEM headers/footers and newlines
function stripPem(pem: string): string {
  return pem
    .replace(/-----BEGIN [^-]+-----/, "")
    .replace(/-----END [^-]+-----/, "")
    .replace(/\s+/g, "");
}

// Import RSA Key (Handle PEM or JWK)
// For WebCrypto, we usually need SPKI for public and PKCS8 for private
async function importRsaKey(
  keyStr: string,
  type: "public" | "private",
): Promise<CryptoKey> {
  const isJwk = keyStr.trim().startsWith("{");
  if (isJwk) {
    const jwk = JSON.parse(keyStr);
    return window.crypto.subtle.importKey(
      "jwk",
      jwk,
      { name: "RSA-OAEP", hash: "SHA-256" }, // Default hash, might need adjustment based on params
      true,
      type === "public" ? ["encrypt", "wrapKey"] : ["decrypt", "unwrapKey"],
    );
  } else {
    // Assume PEM -> Convert to binary
    const b64 = stripPem(keyStr);
    const binary = decodeBase64(b64);
    return window.crypto.subtle.importKey(
      type === "public" ? "spki" : "pkcs8",
      binary,
      { name: "RSA-OAEP", hash: "SHA-256" },
      true,
      type === "public" ? ["encrypt", "wrapKey"] : ["decrypt", "unwrapKey"],
    );
  }
}

// --- Keyring Builder ---

async function buildKeyring(state: AwsEncryptionSdkState) {
  if (state.keyringType === "raw-aes") {
    const keyBytes = decodeKey(state.aesKey, state.aesKeyEncoding);
    if (keyBytes.length === 0) throw new Error("AES Key is empty");

    const wrappingSuite =
      state.aesKeyLength === "128"
        ? AlgorithmSuiteIdentifier.ALG_AES128_GCM_IV12_TAG16
        : state.aesKeyLength === "192"
          ? AlgorithmSuiteIdentifier.ALG_AES192_GCM_IV12_TAG16
          : AlgorithmSuiteIdentifier.ALG_AES256_GCM_IV12_TAG16;

    // Import into WebCrypto to get a CryptoKey
    const cryptoKey = await RawAesKeyringWebCrypto.importCryptoKey(
      keyBytes,
      wrappingSuite,
    );

    return new RawAesKeyringWebCrypto({
      keyName: state.aesKeyId || "aes-key",
      keyNamespace: state.aesKeyProviderId || "raw",
      wrappingSuite: wrappingSuite,
      masterKey: cryptoKey,
    });
  } else if (state.keyringType === "raw-rsa") {
    let publicKey: CryptoKey | undefined;
    let privateKey: CryptoKey | undefined;

    if (state.rsaPublicKey.trim()) {
      try {
        publicKey = await importRsaKey(state.rsaPublicKey, "public");
      } catch (e) {
        console.error("Bad public key", e);
      }
    }
    if (state.rsaPrivateKey.trim()) {
      try {
        privateKey = await importRsaKey(state.rsaPrivateKey, "private");
      } catch (e) {
        console.error("Bad private key", e);
      }
    }

    if (!publicKey && !privateKey) {
      throw new Error(
        "RSA Keyring requires at least one key (public or private)",
      );
    }

    // Map padding to wrapping suite
    // Supported: OAEP-SHA1-MGF1, OAEP-SHA256-MGF1, OAEP-SHA384-MGF1, OAEP-SHA512-MGF1
    let paddingScheme:
      | "RSA_OAEP_SHA1_MGF1"
      | "RSA_OAEP_SHA256_MGF1"
      | "RSA_OAEP_SHA384_MGF1"
      | "RSA_OAEP_SHA512_MGF1" = "RSA_OAEP_SHA256_MGF1"; // Default
    if (state.rsaPadding.includes("SHA1")) paddingScheme = "RSA_OAEP_SHA1_MGF1";
    if (state.rsaPadding.includes("SHA384"))
      paddingScheme = "RSA_OAEP_SHA384_MGF1";
    if (state.rsaPadding.includes("SHA512"))
      paddingScheme = "RSA_OAEP_SHA512_MGF1";

    return new RawRsaKeyringWebCrypto({
      keyName: state.rsaKeyId || "rsa-key",
      keyNamespace: state.rsaKeyProviderId || "raw",
      publicKey,
      privateKey,
    });
  }
  throw new Error(`Unsupported keyring type: ${state.keyringType}`);
}

// --- Main Operations ---

export async function encryptData(
  state: AwsEncryptionSdkState,
  inputOverride?: Uint8Array,
): Promise<string> {
  // Use override if provided (e.g. from file), otherwise decode from state
  let plaintext: Uint8Array;
  if (inputOverride) {
    plaintext = inputOverride;
  } else if (!state.inputData) {
    return "";
  } else {
    // Decode input based on state encoding
    if (state.inputEncoding === "base64") {
      plaintext = decodeBase64(state.inputData);
    } else if (state.inputEncoding === "hex") {
      plaintext = decodeHex(state.inputData);
    } else {
      plaintext = new TextEncoder().encode(state.inputData);
    }
  }

  const keyring = await buildKeyring(state);

  // Parse context
  let context: Record<string, string> = {};
  if (state.encryptionContext.trim()) {
    try {
      context = JSON.parse(state.encryptionContext);
    } catch (e) {
      throw new Error("Invalid JSON in Encryption Context");
    }
  }

  const { result } = await encrypt(keyring, plaintext, {
    encryptionContext: context,
  });

  // Return formatted string based on encoded settings
  // The 'encryptedData' field in state is usually Base64 or Hex for display
  if (state.encryptedEncoding === "hex") {
    return encodeHex(result);
  } else if (state.encryptedEncoding === "base64url") {
    return encodeBase64(result, { urlSafe: true, padding: false });
  } else {
    return encodeBase64(result);
  }
}

export async function decryptData(
  state: AwsEncryptionSdkState,
  encryptedDataOverride?: Uint8Array,
): Promise<{
  plaintext: string; // Text representation for display
  plaintextBytes: Uint8Array; // Raw bytes for download
  context: Record<string, string>;
  header: DecryptedHeader | null;
}> {
  let ciphertext: Uint8Array;

  if (encryptedDataOverride) {
    ciphertext = encryptedDataOverride;
  } else if (!state.encryptedData) {
    return {
      plaintext: "",
      plaintextBytes: new Uint8Array(0),
      context: {},
      header: null,
    };
  } else {
    try {
      if (state.encryptedEncoding === "hex") {
        ciphertext = decodeHex(state.encryptedData);
      } else if (state.encryptedEncoding === "base64url") {
        ciphertext = decodeBase64(state.encryptedData);
      } else {
        ciphertext = decodeBase64(state.encryptedData);
      }
    } catch (e) {
      // If auto-decrypting while typing, might fail.
      throw new Error("Invalid encrypted data format");
    }
  }

  const keyring = await buildKeyring(state);

  const { plaintext, messageHeader } = await decrypt(keyring, ciphertext);

  let plaintextStr = "";
  try {
    if (state.decryptedEncoding === "base64") {
      plaintextStr = encodeBase64(plaintext);
    } else if (state.decryptedEncoding === "hex") {
      plaintextStr = encodeHex(plaintext);
    } else {
      // UTF-8 (default)
      plaintextStr = new TextDecoder("utf-8", { fatal: true }).decode(
        plaintext,
      );
    }
  } catch (e) {
    // If utf-8 decode fails, fallback or show warning?
    // For now we just let it throw or show placeholder if we want.
    // Spec said "provide clear feedback", we'll let the Error propagate and UI handles it,
    // or return a safe fallback.
    // Let's try to interpret as hex if UTF-8 fails?
    plaintextStr = `[Invalid UTF-8]\nHex: ${encodeHex(plaintext)}`;
  }

  return {
    plaintext: plaintextStr,
    plaintextBytes: plaintext,
    context: messageHeader.encryptionContext,
    header: {
      version: String(messageHeader.version),
      type: "type" in messageHeader ? String(messageHeader.type) : undefined,
      suiteId: String(messageHeader.suiteId),
      messageId: encodeHex(messageHeader.messageId),
      encryptionContext: messageHeader.encryptionContext,
      encryptedDataKeys: messageHeader.encryptedDataKeys.map((k) => ({
        providerId: k.providerId,
        providerInfo:
          typeof k.providerInfo === "string"
            ? k.providerInfo
            : encodeHex(k.providerInfo),
        encryptedDataKey:
          typeof k.encryptedDataKey === "string"
            ? k.encryptedDataKey
            : encodeHex(k.encryptedDataKey),
      })),
      contentType: String(messageHeader.contentType),
      headerIvLength:
        "headerIvLength" in messageHeader
          ? messageHeader.headerIvLength
          : undefined,
      frameLength: messageHeader.frameLength,
    },
  };
}
