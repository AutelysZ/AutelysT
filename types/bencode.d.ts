declare module "bencode" {
  export type BencodeValue =
    | string
    | number
    | boolean
    | Uint8Array
    | BencodeValue[]
    | { [key: string]: BencodeValue };

  export interface BencodeModule {
    encode(value: BencodeValue): Uint8Array;
    decode(
      data: Uint8Array | string,
      start?: number,
      end?: number,
      encoding?: string,
    ): BencodeValue;
    byteLength(value: BencodeValue): number;
    encodingLength(value: BencodeValue): number;
  }

  const bencode: BencodeModule;
  export default bencode;
}
