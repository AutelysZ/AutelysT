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
): Promise<string> {
  if (!state.inputData) return "";

  const keyring = await buildKeyring(state);

  // Decode input data if needed (if we support binary input)
  // For now assume input is string for encryption
  const plaintext = new TextEncoder().encode(state.inputData);

  const context = state.encryptionContext;

  const { result } = await encrypt(keyring, plaintext, {
    encryptionContext: context,
  });

  // Return Base64 of the encrypted message
  return encodeBase64(result);
}

export async function decryptData(
  state: AwsEncryptionSdkState,
  encryptedDataOverride?: string,
): Promise<{ plaintext: string; context: Record<string, string> }> {
  const ciphertextB64 = encryptedDataOverride ?? state.encryptedData;
  if (!ciphertextB64) return { plaintext: "", context: {} };

  const keyring = await buildKeyring(state);
  const ciphertext = decodeBase64(ciphertextB64);

  const { plaintext, messageHeader } = await decrypt(keyring, ciphertext);

  return {
    plaintext: new TextDecoder().decode(plaintext),
    context: messageHeader.encryptionContext,
  };
}
