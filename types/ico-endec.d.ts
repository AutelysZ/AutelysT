declare module "ico-endec" {
  const icoEndec: {
    encode: (inputs: ArrayBuffer[] | Buffer[]) => Buffer;
    decode: (input: ArrayBuffer | Buffer) => any[];
  };
  export default icoEndec;
}
