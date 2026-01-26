import { z } from "zod";

export type FormatterFile = {
  id: string;
  path: string;
  content: string;
};

export const paramsSchema = z.object({
  files: z.string().default("[]"),
  activeFileId: z.string().default(""),
  printWidth: z.number().default(80),
  tabWidth: z.number().default(2),
  useTabs: z.boolean().default(false),
  semi: z.boolean().default(true),
  singleQuote: z.boolean().default(false),
  trailingComma: z.enum(["none", "es5", "all"]).default("es5"),
  bracketSpacing: z.boolean().default(true),
  arrowParens: z.enum(["always", "avoid"]).default("always"),
  endOfLine: z.enum(["lf", "crlf", "cr", "auto"]).default("lf"),
});

export type ParamsState = z.infer<typeof paramsSchema>;
