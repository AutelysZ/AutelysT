import { z } from "zod";

export const inputEncodings = ["base64", "hex", "binary"] as const;
export const outputEncodings = [
  "binary",
  "base64",
  "base64url",
  "hex",
] as const;
export const inputFormats = ["json", "yaml"] as const;
export const outputFormats = ["json", "yaml"] as const;

export const paramsSchema = z.object({
  mode: z.enum(["decode", "encode"]).default("decode"),
  input: z.string().default(""),
  inputEncoding: z.enum(inputEncodings).default("base64"),
  inputFormat: z.enum(inputFormats).default("json"),
  outputEncoding: z.enum(outputEncodings).default("base64"),
  outputFormat: z.enum(outputFormats).default("json"),
});

export type BencodeState = z.infer<typeof paramsSchema>;
