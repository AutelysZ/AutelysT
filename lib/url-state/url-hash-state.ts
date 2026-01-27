import { gzipSync, gunzipSync } from "fflate";
import { encodeBase64, decodeBase64 } from "@/lib/encoding/base64";

export function compressState(state: unknown): string {
  const json = JSON.stringify(state);
  const bytes = new TextEncoder().encode(json);
  const compressed = gzipSync(bytes, { level: 9, mem: 8 });
  return encodeBase64(compressed, { urlSafe: true, padding: false });
}

export function decompressState(hash: string): unknown {
  try {
    const compressed = decodeBase64(hash);
    const bytes = gunzipSync(compressed);
    const json = new TextDecoder().decode(bytes);
    return JSON.parse(json);
  } catch (e) {
    console.error("Failed to decompress state:", e);
    return null;
  }
}
