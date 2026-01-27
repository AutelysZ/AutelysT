export type AwsEncryptionSdkKeyringType = "raw-aes" | "raw-rsa";

export type AwsEncryptionSdkAesKeyLength = "128" | "192" | "256";
export type AwsEncryptionSdkRsaPadding =
  | "OAEP-SHA1"
  | "OAEP-SHA256"
  | "OAEP-SHA384"
  | "OAEP-SHA512";

export type AwsEncryptionSdkInputEncoding =
  | "utf8"
  | "base64"
  | "hex"
  | "binary";

export type AwsEncryptionSdkOutputEncoding =
  | "base64"
  | "base64url"
  | "hex"
  | "binary";

export type AwsEncryptionSdkDecryptedEncoding = "utf8" | "base64" | "hex";

export type AwsEncryptionSdkKeyEncoding = "utf8" | "base64" | "hex";

export interface AwsEncryptionSdkState {
  // Keyring Configuration
  keyringType: AwsEncryptionSdkKeyringType;

  // RAW AES Params
  aesKeyLength: AwsEncryptionSdkAesKeyLength; // For generation helper mainly
  aesKey: string;
  aesKeyEncoding: AwsEncryptionSdkKeyEncoding;
  aesKeyProviderId: string;
  aesKeyId: string;

  // RAW RSA Params
  rsaPadding: AwsEncryptionSdkRsaPadding;
  rsaPrivateKey: string;
  rsaPublicKey: string;
  rsaKeyProviderId: string;
  rsaKeyId: string;

  // Encryption Context (Raw JSON string)
  encryptionContext: string;

  // Data
  inputData: string;
  inputEncoding: AwsEncryptionSdkInputEncoding;

  // Output
  encryptedData: string;
  encryptedEncoding: AwsEncryptionSdkOutputEncoding;

  // Decryption Options
  decryptedEncoding: AwsEncryptionSdkDecryptedEncoding;
}

export const defaultAwsEncryptionSdkState: AwsEncryptionSdkState = {
  keyringType: "raw-aes",
  aesKeyLength: "256",
  aesKey: "",
  aesKeyEncoding: "base64",
  aesKeyProviderId: "raw-aes-params",
  aesKeyId: "aes-key-1",
  rsaPadding: "OAEP-SHA256",
  rsaPrivateKey: "",
  rsaPublicKey: "",
  rsaKeyProviderId: "raw-rsa-params",
  rsaKeyId: "rsa-key-1",
  encryptionContext: "{}",
  inputData: "",
  inputEncoding: "utf8",
  encryptedData: "",
  encryptedEncoding: "base64",
  decryptedEncoding: "utf8",
};

export const keyringLabels: Record<AwsEncryptionSdkKeyringType, string> = {
  "raw-aes": "Raw AES-GCM",
  "raw-rsa": "Raw RSA",
};

export const encodingLabels: Record<string, string> = {
  utf8: "UTF-8",
  base64: "Base64",
  hex: "Hex",
  binary: "Binary",
};
