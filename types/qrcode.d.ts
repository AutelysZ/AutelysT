declare module "qrcode" {
  export type QRCodeRenderersOptions = Record<string, unknown>;
  export function toDataURL(
    text: string,
    options?: QRCodeRenderersOptions,
  ): Promise<string>;
  export function toString(
    text: string,
    options?: QRCodeRenderersOptions,
  ): Promise<string>;
  export function toCanvas(
    canvas: HTMLCanvasElement,
    text: string,
    options?: QRCodeRenderersOptions,
  ): Promise<void>;
}
