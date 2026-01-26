import { z } from "zod";

export const paramsSchema = z.object({
  leftText: z.string().default(""),
  rightText: z.string().default(""),
  activeSide: z.enum(["left", "right"]).default("left"),
  rightView: z.enum(["table", "json"]).default("table"),
});

export type UserAgentState = z.infer<typeof paramsSchema>;

export type UserAgentJson = {
  ua?: string;
  browser?: {
    name?: string;
    version?: string;
    major?: string;
  };
  engine?: {
    name?: string;
    version?: string;
  };
  os?: {
    name?: string;
    version?: string;
  };
  device?: {
    vendor?: string;
    model?: string;
    type?: string;
  };
  cpu?: {
    architecture?: string;
  };
};
