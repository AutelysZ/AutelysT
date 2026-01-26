import { z } from "zod";

export const paramsSchema = z.object({
  leftText: z.string().default(""),
  rightText: z.string().default(""),
  activeSide: z.enum(["left", "right"]).default("left"),
  rightView: z.enum(["table", "json"]).default("table"),
});

export type SetCookieState = z.infer<typeof paramsSchema>;

export type CookieJson = {
  name: string;
  value?: string;
  domain?: string;
  path?: string;
  expires?: string;
  maxAge?: number;
  httpOnly?: boolean;
  secure?: boolean;
  sameSite?: "lax" | "strict" | "none";
  priority?: "low" | "medium" | "high";
  partitioned?: boolean;
  extensions?: string[];
};
