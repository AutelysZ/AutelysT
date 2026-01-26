import { z } from "zod";
import type {
  HexOutputType,
  InputEncodingType,
  OutputEncodingType,
} from "@/lib/encoding/charset-converter";

export const paramsSchema = z.object({
  inputText: z.string().default(""),
  fileName: z.string().default(""),
  fileData: z.string().default(""),
  inputEncoding: z.enum(["raw", "base64", "hex"]).default("raw"),
  inputCharset: z.string().default("UTF-8"),
  outputCharset: z.string().default("UTF-8"),
  outputEncoding: z.enum(["raw", "base64", "hex"]).default("raw"),
  outputBase64Padding: z.boolean().default(true),
  outputBase64UrlSafe: z.boolean().default(false),
  outputHexType: z.enum(["hex", "hex-escape", "url"]).default("hex"),
  outputHexUpperCase: z.boolean().default(true),
  outputBom: z.boolean().default(false),
  autoDetect: z.boolean().default(true),
});

export type ParamsState = z.infer<typeof paramsSchema>;

export const INPUT_ENCODING_OPTIONS: Array<{ value: InputEncodingType; label: string }> = [
  { value: "raw", label: "Raw" },
  { value: "base64", label: "Base64" },
  { value: "hex", label: "Hex" },
];

export const OUTPUT_ENCODING_OPTIONS: Array<{ value: OutputEncodingType; label: string }> = [
  { value: "raw", label: "Raw" },
  { value: "base64", label: "Base64" },
  { value: "hex", label: "Hex" },
];

export const OUTPUT_HEX_OPTIONS: Array<{ value: HexOutputType; label: string }> = [
  { value: "hex", label: "Hex" },
  { value: "hex-escape", label: "Hex Escape" },
  { value: "url", label: "URL" },
];
