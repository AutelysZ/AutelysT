import { z } from "zod";

export const paramsSchema = z.object({
  step: z.number().int().min(0).max(3).default(0),
  mode: z.enum(["guided", "manual"]).default("guided"),
  licenseId: z.string().default(""),
  allowProprietary: z.enum(["yes", "no"]).default("yes"),
  patentGrant: z.enum(["yes", "no"]).default("yes"),
  permissiveMinimal: z.enum(["yes", "no"]).default("yes"),
  networkCopyleft: z.enum(["yes", "no"]).default("no"),
  libraryLinking: z.enum(["yes", "no"]).default("no"),
  fileCopyleft: z.enum(["yes", "no"]).default("no"),
  year: z.string().default(""),
  holder: z.string().default(""),
  project: z.string().default(""),
  email: z.string().default(""),
  website: z.string().default(""),
});

export type LicenseGeneratorState = z.infer<typeof paramsSchema>;

export type LicenseOption = {
  value: string;
  label: string;
};

export type LicenseTemplateData = {
  year: string;
  holder: string;
  project?: string;
  email?: string;
  website?: string;
};
