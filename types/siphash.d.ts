declare module "siphash" {
  export type SipHashResult = { h: number; l: number }
  export function hash(key: Uint32Array | number[], message: string | Uint8Array): SipHashResult
  export function hash_hex(key: Uint32Array | number[], message: string | Uint8Array): string
  export function hash_uint(key: Uint32Array | number[], message: string | Uint8Array): number
  export function string16_to_key(value: string): Uint32Array
  export function string_to_u8(value: string): Uint8Array
}
