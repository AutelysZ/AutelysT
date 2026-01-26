import { z } from "zod";

export const paramsSchema = z.object({
  activeAlgorithm: z.enum(["bcrypt", "scrypt", "argon2"]).default("bcrypt"),
  bcryptPassword: z.string().default(""),
  bcryptRounds: z.coerce.number().default(10),
  bcryptVerifyPassword: z.string().default(""),
  bcryptVerifyHash: z.string().default(""),
  bcryptParseHash: z.string().default(""),
  scryptPassword: z.string().default(""),
  scryptSalt: z.string().default(""),
  scryptSaltLength: z.coerce.number().default(16),
  scryptN: z.coerce.number().default(16384),
  scryptR: z.coerce.number().default(8),
  scryptP: z.coerce.number().default(1),
  scryptDkLen: z.coerce.number().default(32),
  scryptVerifyPassword: z.string().default(""),
  scryptVerifyHash: z.string().default(""),
  scryptParseHash: z.string().default(""),
  argon2Password: z.string().default(""),
  argon2Salt: z.string().default(""),
  argon2SaltLength: z.coerce.number().default(16),
  argon2Time: z.coerce.number().default(3),
  argon2Memory: z.coerce.number().default(65536),
  argon2Parallelism: z.coerce.number().default(1),
  argon2HashLen: z.coerce.number().default(32),
  argon2Type: z.enum(["argon2d", "argon2i", "argon2id"]).default("argon2id"),
  argon2VerifyPassword: z.string().default(""),
  argon2VerifyHash: z.string().default(""),
  argon2ParseHash: z.string().default(""),
});

export type PasswordHashState = z.infer<typeof paramsSchema>;
