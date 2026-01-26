import { z } from "zod";
import { OUTPUT_FORMATS } from "@/lib/phone-number/phone-number";

export const paramsSchema = z.object({
  leftText: z.string().default(""),
  rightText: z.string().default(""),
  activeSide: z.enum(["left", "right"]).default("left"),
  rightView: z.enum(["table", "json"]).default("table"),
  defaultCountry: z.string().default("US"),
  outputFormat: z.enum(OUTPUT_FORMATS).default("E.164"),
});

export type PhoneNumberState = z.infer<typeof paramsSchema>;
