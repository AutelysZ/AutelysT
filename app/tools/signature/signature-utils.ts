import {
  ecdsaCurveMap,
  eddsaCurveMap,
  pqcDsaMap,
  pqcSlhMap,
  schnorrCurve,
  secp256k1,
  decodeKeyBytes,
  parseJwk,
  pemToArrayBuffer,
  toPem,
  parseExponent,
  isKeyPair,
  resolvePqcKeyBytes,
  getEcdsaPrivateKeyBytes,
  getEcdsaPublicKeyBytes,
  getEddsaPrivateKeyBytes,
  getEddsaPublicKeyBytes,
  getSchnorrPrivateKeyBytes,
  getSchnorrPublicKeyBytes,
  hashMessageBytes,
  getRsaSaltLength,
  createEcJwk,
  createOkpJwk,
  createPqcPublicKey,
  createPqcPrivateKey,
  type AlgorithmValue,
} from "./crypto";
import type { SignatureState } from "./signature-types";

export function getImportAlgorithm(state: SignatureState) {
  if (state.algorithm === "rsa") {
    return { name: state.rsaScheme, hash: { name: state.rsaHash } };
  }
  return null;
}

export function getKeyFields(algorithm: AlgorithmValue) {
  if (algorithm === "rsa") {
    return { privateKey: "rsaPrivateKey", publicKey: "rsaPublicKey" } as const;
  }
  if (algorithm === "ecdsa") {
    return {
      privateKey: "ecdsaPrivateKey",
      publicKey: "ecdsaPublicKey",
    } as const;
  }
  if (algorithm === "eddsa") {
    return {
      privateKey: "eddsaPrivateKey",
      publicKey: "eddsaPublicKey",
    } as const;
  }
  if (algorithm === "schnorr") {
    return {
      privateKey: "schnorrPrivateKey",
      publicKey: "schnorrPublicKey",
    } as const;
  }
  if (algorithm === "ml-dsa" || algorithm === "slh-dsa") {
    return { privateKey: "pqcPrivateKey", publicKey: "pqcPublicKey" } as const;
  }
  return { privateKey: "rsaPrivateKey", publicKey: "rsaPublicKey" } as const;
}

export function getKeySelection(state: SignatureState) {
  if (state.algorithm === "rsa") {
    return { privateKey: state.rsaPrivateKey, publicKey: state.rsaPublicKey };
  }
  if (state.algorithm === "ecdsa") {
    return {
      privateKey: state.ecdsaPrivateKey,
      publicKey: state.ecdsaPublicKey,
    };
  }
  if (state.algorithm === "eddsa") {
    return {
      privateKey: state.eddsaPrivateKey,
      publicKey: state.eddsaPublicKey,
    };
  }
  if (state.algorithm === "schnorr") {
    return {
      privateKey: state.schnorrPrivateKey,
      publicKey: state.schnorrPublicKey,
    };
  }
  if (state.algorithm === "ml-dsa" || state.algorithm === "slh-dsa") {
    return { privateKey: state.pqcPrivateKey, publicKey: state.pqcPublicKey };
  }
  return { privateKey: state.rsaPrivateKey, publicKey: state.rsaPublicKey };
}

export function getPqcSelectionKey(state: SignatureState) {
  if (state.algorithm === "ml-dsa") return `ml-dsa:${state.pqcDsaVariant}`;
  if (state.algorithm === "slh-dsa") return `slh-dsa:${state.pqcSlhVariant}`;
  return state.algorithm;
}

async function importAsymmetricKey({
  keyText,
  mode,
  state,
}: {
  keyText: string;
  mode: "sign" | "verify";
  state: SignatureState;
}) {
  const jwk = parseJwk(keyText);
  const algorithm = getImportAlgorithm(state);
  if (!algorithm) return null;
  if (jwk) {
    if (mode === "sign" && !("d" in jwk)) return null;
    return crypto.subtle.importKey("jwk", jwk, algorithm, false, [mode]);
  }
  const parsed = pemToArrayBuffer(keyText);
  if (!parsed) return null;
  if (mode === "sign" && !parsed.label.includes("PRIVATE KEY")) return null;
  const format = parsed.label.includes("PRIVATE KEY") ? "pkcs8" : "spki";
  return crypto.subtle.importKey(format, parsed.buffer, algorithm, false, [
    mode,
  ]);
}

export async function signMessage({
  messageBytes,
  state,
  privateKeyText,
}: {
  messageBytes: Uint8Array<ArrayBuffer>;
  state: SignatureState;
  privateKeyText: string;
}) {
  if (state.algorithm === "hmac") {
    if (!globalThis.crypto?.subtle) {
      throw new Error("Web Crypto is unavailable in this environment.");
    }
    const keyBytes = decodeKeyBytes(state.hmacKey, state.hmacKeyEncoding);
    const key = await crypto.subtle.importKey(
      "raw",
      keyBytes,
      {
        name: "HMAC",
        hash: { name: state.hmacHash },
      },
      false,
      ["sign"],
    );
    const signature = await crypto.subtle.sign("HMAC", key, messageBytes);
    return new Uint8Array(signature);
  }
  if (state.algorithm === "rsa") {
    if (!globalThis.crypto?.subtle) {
      throw new Error("Web Crypto is unavailable in this environment.");
    }
    const keyText = privateKeyText.trim();
    if (!keyText) {
      throw new Error("Private key is required to sign.");
    }
    const key = await importAsymmetricKey({ keyText, mode: "sign", state });
    if (!key) {
      throw new Error("Invalid private key format. Use PKCS8 PEM or JWK.");
    }
    if (state.rsaScheme === "RSA-PSS") {
      const signature = await crypto.subtle.sign(
        {
          name: "RSA-PSS",
          saltLength: getRsaSaltLength(state.rsaHash, state.rsaSaltLength),
        },
        key,
        messageBytes,
      );
      return new Uint8Array(signature);
    }
    const signature = await crypto.subtle.sign(
      "RSASSA-PKCS1-v1_5",
      key,
      messageBytes,
    );
    return new Uint8Array(signature);
  }
  if (state.algorithm === "ecdsa") {
    const keyText = privateKeyText.trim();
    if (!keyText) {
      throw new Error("Private key is required to sign.");
    }
    const secretKey = await getEcdsaPrivateKeyBytes(keyText, state.ecdsaCurve);
    const digest = await hashMessageBytes(messageBytes, state.ecdsaHash);
    return ecdsaCurveMap[state.ecdsaCurve].sign(digest, secretKey, {
      prehash: false,
    });
  }
  if (state.algorithm === "eddsa") {
    const keyText = privateKeyText.trim();
    if (!keyText) {
      throw new Error("Private key is required to sign.");
    }
    const secretKey = await getEddsaPrivateKeyBytes(keyText, state.eddsaCurve);
    return eddsaCurveMap[state.eddsaCurve].sign(messageBytes, secretKey);
  }
  if (state.algorithm === "ml-dsa") {
    const keyText = privateKeyText.trim();
    if (!keyText) {
      throw new Error("Private key is required to sign.");
    }
    const secretKey = resolvePqcKeyBytes(
      keyText,
      state.pqcKeyEncoding,
      "private",
    );
    const expectedLength = pqcDsaMap[state.pqcDsaVariant].lengths.secretKey;
    if (expectedLength && secretKey.length !== expectedLength) {
      throw new Error(
        `Invalid private key length for ${state.pqcDsaVariant}. Expected ${expectedLength} bytes, got ${secretKey.length}. Please generate a new key.`,
      );
    }
    return pqcDsaMap[state.pqcDsaVariant].sign(messageBytes, secretKey);
  }
  if (state.algorithm === "slh-dsa") {
    const keyText = privateKeyText.trim();
    if (!keyText) {
      throw new Error("Private key is required to sign.");
    }
    const secretKey = resolvePqcKeyBytes(
      keyText,
      state.pqcKeyEncoding,
      "private",
    );
    const expectedLength = pqcSlhMap[state.pqcSlhVariant].lengths.secretKey;
    if (expectedLength && secretKey.length !== expectedLength) {
      throw new Error(
        `Invalid private key length for ${state.pqcSlhVariant}. Expected ${expectedLength} bytes, got ${secretKey.length}. Please generate a new key.`,
      );
    }
    return pqcSlhMap[state.pqcSlhVariant].sign(messageBytes, secretKey);
  }
  const keyText = privateKeyText.trim();
  if (!keyText) {
    throw new Error("Private key is required to sign.");
  }
  const secretKey = await getSchnorrPrivateKeyBytes(keyText);
  return schnorrCurve.sign(messageBytes, secretKey);
}

export async function verifyMessage({
  messageBytes,
  signatureBytes,
  state,
  publicKeyText,
  privateKeyText,
}: {
  messageBytes: Uint8Array<ArrayBuffer>;
  signatureBytes: Uint8Array<ArrayBuffer>;
  state: SignatureState;
  publicKeyText: string;
  privateKeyText: string;
}) {
  if (state.algorithm === "hmac") {
    if (!globalThis.crypto?.subtle) {
      throw new Error("Web Crypto is unavailable in this environment.");
    }
    const keyBytes = decodeKeyBytes(state.hmacKey, state.hmacKeyEncoding);
    const key = await crypto.subtle.importKey(
      "raw",
      keyBytes,
      {
        name: "HMAC",
        hash: { name: state.hmacHash },
      },
      false,
      ["verify"],
    );
    return crypto.subtle.verify("HMAC", key, signatureBytes, messageBytes);
  }
  if (state.algorithm === "rsa") {
    if (!globalThis.crypto?.subtle) {
      throw new Error("Web Crypto is unavailable in this environment.");
    }
    const keyText = publicKeyText.trim() || privateKeyText.trim();
    if (!keyText) {
      throw new Error("Public or private key is required to verify.");
    }
    const key = await importAsymmetricKey({ keyText, mode: "verify", state });
    if (!key) {
      throw new Error("Invalid key format. Use SPKI/PKCS8 PEM or JWK.");
    }
    if (state.rsaScheme === "RSA-PSS") {
      return crypto.subtle.verify(
        {
          name: "RSA-PSS",
          saltLength: getRsaSaltLength(state.rsaHash, state.rsaSaltLength),
        },
        key,
        signatureBytes,
        messageBytes,
      );
    }
    return crypto.subtle.verify(
      "RSASSA-PKCS1-v1_5",
      key,
      signatureBytes,
      messageBytes,
    );
  }
  if (state.algorithm === "ecdsa") {
    const keyText = publicKeyText.trim() || privateKeyText.trim();
    if (!keyText) {
      throw new Error("Public or private key is required to verify.");
    }
    const publicKey = publicKeyText.trim()
      ? await getEcdsaPublicKeyBytes(publicKeyText.trim(), state.ecdsaCurve)
      : ecdsaCurveMap[state.ecdsaCurve].getPublicKey(
          await getEcdsaPrivateKeyBytes(
            privateKeyText.trim(),
            state.ecdsaCurve,
          ),
          false,
        );
    const digest = await hashMessageBytes(messageBytes, state.ecdsaHash);
    return ecdsaCurveMap[state.ecdsaCurve].verify(
      signatureBytes,
      digest,
      publicKey,
      { prehash: false },
    );
  }
  if (state.algorithm === "eddsa") {
    const keyText = publicKeyText.trim() || privateKeyText.trim();
    if (!keyText) {
      throw new Error("Public or private key is required to verify.");
    }
    const publicKey = publicKeyText.trim()
      ? await getEddsaPublicKeyBytes(publicKeyText.trim(), state.eddsaCurve)
      : eddsaCurveMap[state.eddsaCurve].getPublicKey(
          await getEddsaPrivateKeyBytes(
            privateKeyText.trim(),
            state.eddsaCurve,
          ),
        );
    return eddsaCurveMap[state.eddsaCurve].verify(
      signatureBytes,
      messageBytes,
      publicKey,
    );
  }
  if (state.algorithm === "ml-dsa") {
    const keyText = publicKeyText.trim() || privateKeyText.trim();
    if (!keyText) {
      throw new Error("Public or private key is required to verify.");
    }
    const signer = pqcDsaMap[state.pqcDsaVariant];
    const publicKey = publicKeyText.trim()
      ? resolvePqcKeyBytes(publicKeyText.trim(), state.pqcKeyEncoding, "public")
      : signer.getPublicKey(
          resolvePqcKeyBytes(
            privateKeyText.trim(),
            state.pqcKeyEncoding,
            "private",
          ),
        );
    return signer.verify(signatureBytes, messageBytes, publicKey);
  }
  if (state.algorithm === "slh-dsa") {
    const keyText = publicKeyText.trim() || privateKeyText.trim();
    if (!keyText) {
      throw new Error("Public or private key is required to verify.");
    }
    const signer = pqcSlhMap[state.pqcSlhVariant];
    const publicKey = publicKeyText.trim()
      ? resolvePqcKeyBytes(publicKeyText.trim(), state.pqcKeyEncoding, "public")
      : signer.getPublicKey(
          resolvePqcKeyBytes(
            privateKeyText.trim(),
            state.pqcKeyEncoding,
            "private",
          ),
        );
    return signer.verify(signatureBytes, messageBytes, publicKey);
  }
  const keyText = publicKeyText.trim() || privateKeyText.trim();
  if (!keyText) {
    throw new Error("Public or private key is required to verify.");
  }
  const publicKey = publicKeyText.trim()
    ? await getSchnorrPublicKeyBytes(publicKeyText.trim())
    : schnorrCurve.getPublicKey(
        await getSchnorrPrivateKeyBytes(privateKeyText.trim()),
      );
  return schnorrCurve.verify(signatureBytes, messageBytes, publicKey);
}

export async function generateKeypair(state: SignatureState) {
  if (state.algorithm === "hmac") {
    throw new Error("Keypair generation is not available for HMAC.");
  }
  if (state.algorithm === "ml-dsa") {
    const signer = pqcDsaMap[state.pqcDsaVariant];
    const { publicKey, secretKey } = signer.keygen();
    const publicPayload = createPqcPublicKey(
      state.pqcDsaVariant,
      publicKey,
      state.pqcKeyEncoding,
    );
    const privatePayload = createPqcPrivateKey(
      state.pqcDsaVariant,
      publicKey,
      secretKey,
      state.pqcKeyEncoding,
    );
    return {
      publicPem: JSON.stringify(publicPayload, null, 2),
      privatePem: JSON.stringify(privatePayload, null, 2),
    };
  }
  if (state.algorithm === "slh-dsa") {
    const slhSigner = pqcSlhMap[state.pqcSlhVariant];
    const { publicKey, secretKey } = slhSigner.keygen();
    const publicPayload = createPqcPublicKey(
      state.pqcSlhVariant,
      publicKey,
      state.pqcKeyEncoding,
    );
    const privatePayload = createPqcPrivateKey(
      state.pqcSlhVariant,
      publicKey,
      secretKey,
      state.pqcKeyEncoding,
    );
    return {
      publicPem: JSON.stringify(publicPayload, null, 2),
      privatePem: JSON.stringify(privatePayload, null, 2),
    };
  }
  if (state.algorithm === "rsa") {
    if (!globalThis.crypto?.subtle) {
      throw new Error("Web Crypto is unavailable in this environment.");
    }
    const exponent = parseExponent(state.rsaPublicExponent);
    if (!exponent) {
      throw new Error("Invalid RSA public exponent.");
    }
    const algorithm = {
      name: state.rsaScheme,
      modulusLength: state.rsaModulusLength,
      publicExponent: exponent,
      hash: { name: state.rsaHash },
    };
    const keyPair = await crypto.subtle.generateKey(algorithm, true, [
      "sign",
      "verify",
    ]);
    if (!isKeyPair(keyPair)) {
      throw new Error("Keypair generation failed.");
    }
    const publicKey = await crypto.subtle.exportKey("spki", keyPair.publicKey);
    const privateKey = await crypto.subtle.exportKey(
      "pkcs8",
      keyPair.privateKey,
    );
    return {
      publicPem: toPem(publicKey, "PUBLIC KEY"),
      privatePem: toPem(privateKey, "PRIVATE KEY"),
    };
  }
  if (state.algorithm === "ecdsa") {
    const curve = ecdsaCurveMap[state.ecdsaCurve];
    const { secretKey } = curve.keygen();
    const publicKey = curve.getPublicKey(secretKey, false);
    const publicJwk = createEcJwk(state.ecdsaCurve, publicKey);
    const privateJwk = createEcJwk(state.ecdsaCurve, publicKey, secretKey);
    return {
      publicPem: JSON.stringify(publicJwk, null, 2),
      privatePem: JSON.stringify(privateJwk, null, 2),
    };
  }
  if (state.algorithm === "eddsa") {
    const curve = eddsaCurveMap[state.eddsaCurve];
    const { secretKey, publicKey } = curve.keygen();
    const publicJwk = createOkpJwk(state.eddsaCurve, publicKey);
    const privateJwk = createOkpJwk(state.eddsaCurve, publicKey, secretKey);
    return {
      publicPem: JSON.stringify(publicJwk, null, 2),
      privatePem: JSON.stringify(privateJwk, null, 2),
    };
  }
  const { secretKey } = schnorrCurve.keygen();
  const publicKey = secp256k1.getPublicKey(secretKey, false);
  const publicJwk = createEcJwk("secp256k1", publicKey);
  const privateJwk = createEcJwk("secp256k1", publicKey, secretKey);
  return {
    publicPem: JSON.stringify(publicJwk, null, 2),
    privatePem: JSON.stringify(privateJwk, null, 2),
  };
}
