"use client";

import * as React from "react";
import { Check, Copy, Trash2 } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import type { PasswordHashState } from "./password-hash-types";
import type { BcryptParsed } from "@/lib/password-hash/bcrypt";
import type { ScryptParsed } from "@/lib/password-hash/scrypt";
import type { Argon2Parsed } from "@/lib/password-hash/argon2";

type PasswordHashFormProps = {
  state: PasswordHashState;
  setParam: <K extends keyof PasswordHashState>(
    key: K,
    value: PasswordHashState[K],
    immediate?: boolean,
  ) => void;
  oversizeKeys: (keyof PasswordHashState)[];
  onClearAll: () => void;
  bcryptError: string | null;
  bcryptVerifyResult: "valid" | "invalid" | null;
  onBcryptGenerate: () => void;
  onBcryptVerify: () => void;
  parsedBcrypt: BcryptParsed | null;
  scryptError: string | null;
  scryptVerifyResult: "valid" | "invalid" | null;
  scryptWorking: boolean;
  onScryptGenerate: () => void;
  onScryptVerify: () => void;
  parsedScrypt: ScryptParsed | null;
  argon2Error: string | null;
  argon2VerifyResult: "valid" | "invalid" | null;
  argon2Working: boolean;
  onArgon2Generate: () => void;
  onArgon2Verify: () => void;
  parsedArgon2: Argon2Parsed | null;
};

const argon2Variants: PasswordHashState["argon2Type"][] = [
  "argon2id",
  "argon2i",
  "argon2d",
];

export default function PasswordHashForm({
  state,
  setParam,
  oversizeKeys,
  onClearAll,
  bcryptError,
  bcryptVerifyResult,
  onBcryptGenerate,
  onBcryptVerify,
  parsedBcrypt,
  scryptError,
  scryptVerifyResult,
  scryptWorking,
  onScryptGenerate,
  onScryptVerify,
  parsedScrypt,
  argon2Error,
  argon2VerifyResult,
  argon2Working,
  onArgon2Generate,
  onArgon2Verify,
  parsedArgon2,
}: PasswordHashFormProps) {
  const [copiedField, setCopiedField] = React.useState<string | null>(null);

  const handleCopy = async (value: string, key: string) => {
    if (!value) return;
    await navigator.clipboard.writeText(value);
    setCopiedField(key);
    setTimeout(() => setCopiedField(null), 1500);
  };

  const handleVerifyKeyDown = (
    event: React.KeyboardEvent<HTMLInputElement>,
    onVerify: () => void,
  ) => {
    if (event.key === "Enter") {
      event.preventDefault();
      onVerify();
    }
  };

  const oversizeMessage = oversizeKeys.length
    ? "Some inputs exceed 2 KB and are not synced to the URL."
    : null;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-start gap-3">
          <Label className="w-28 shrink-0 text-sm">Algorithm</Label>
          <div className="min-w-0 flex-1 space-y-2">
            <Tabs
              value={state.activeAlgorithm}
              onValueChange={(value) =>
                setParam(
                  "activeAlgorithm",
                  value as PasswordHashState["activeAlgorithm"],
                  true,
                )
              }
            >
              <TabsList className="h-8">
                <TabsTrigger value="bcrypt" className="px-3 text-xs">
                  bcrypt
                </TabsTrigger>
                <TabsTrigger value="scrypt" className="px-3 text-xs">
                  scrypt
                </TabsTrigger>
                <TabsTrigger value="argon2" className="px-3 text-xs">
                  Argon2
                </TabsTrigger>
              </TabsList>
            </Tabs>
          </div>
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={onClearAll}
          className="h-8 gap-1.5 px-3"
        >
          <Trash2 className="h-3.5 w-3.5" />
          Clear All
        </Button>
      </div>

      {oversizeMessage && (
        <Alert>
          <AlertDescription className="text-xs">
            {oversizeMessage}
          </AlertDescription>
        </Alert>
      )}

      {state.activeAlgorithm === "bcrypt" && (
        <div className="grid gap-6 lg:grid-cols-2">
          <div className="flex flex-col gap-4">
            <div className="text-sm font-medium">Generate</div>
            <div className="flex flex-col gap-2">
              <Label className="text-xs text-muted-foreground">Password</Label>
              <Input
                type="text"
                value={state.bcryptPassword}
                onChange={(e) => setParam("bcryptPassword", e.target.value)}
                placeholder="Enter password"
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label className="text-xs text-muted-foreground">
                Cost (rounds)
              </Label>
              <Input
                type="number"
                min={4}
                max={31}
                value={state.bcryptRounds}
                onChange={(e) =>
                  setParam("bcryptRounds", Number(e.target.value))
                }
              />
            </div>
            <Button
              onClick={onBcryptGenerate}
              disabled={!state.bcryptPassword}
              size="sm"
              className="mt-2 self-start"
            >
              Generate
            </Button>
            {bcryptError && (
              <Alert variant="destructive">
                <AlertDescription className="text-xs">
                  {bcryptError}
                </AlertDescription>
              </Alert>
            )}
          </div>
          <div className="flex flex-col gap-4">
            <div className="flex flex-col gap-2">
              <div className="flex items-center justify-between">
                <Label className="text-sm font-medium">Hash</Label>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() =>
                    handleCopy(state.bcryptParseHash, "bcryptHash")
                  }
                  className="h-7 w-7 p-0"
                >
                  {copiedField === "bcryptHash" ? (
                    <Check className="h-3.5 w-3.5" />
                  ) : (
                    <Copy className="h-3.5 w-3.5" />
                  )}
                </Button>
              </div>
              <Textarea
                value={state.bcryptParseHash}
                onChange={(e) => setParam("bcryptParseHash", e.target.value)}
                className="min-h-[140px]"
                placeholder="$2b$10$..."
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label className="text-sm font-medium">Parsed</Label>
              {parsedBcrypt ? (
                <table className="w-full text-xs">
                  <tbody>
                    <tr>
                      <td className="py-1 pr-3 text-muted-foreground">
                        Version
                      </td>
                      <td className="py-1">{parsedBcrypt.version}</td>
                    </tr>
                    <tr>
                      <td className="py-1 pr-3 text-muted-foreground">Cost</td>
                      <td className="py-1">{parsedBcrypt.cost}</td>
                    </tr>
                    <tr>
                      <td className="py-1 pr-3 text-muted-foreground">Salt</td>
                      <td className="py-1">{parsedBcrypt.salt}</td>
                    </tr>
                    <tr>
                      <td className="py-1 pr-3 text-muted-foreground">Hash</td>
                      <td className="py-1 font-mono">{parsedBcrypt.hash}</td>
                    </tr>
                  </tbody>
                </table>
              ) : (
                <div className="text-xs text-destructive">
                  {state.bcryptParseHash.trim()
                    ? "Invalid bcrypt hash format."
                    : "Enter a bcrypt hash to parse its parameters."}
                </div>
              )}
            </div>
            <div className="flex flex-col gap-2">
              <Label className="text-sm font-medium">Verify</Label>
              <Input
                type="text"
                value={state.bcryptVerifyPassword}
                onChange={(e) =>
                  setParam("bcryptVerifyPassword", e.target.value)
                }
                onBlur={onBcryptVerify}
                onKeyDown={(event) =>
                  handleVerifyKeyDown(event, onBcryptVerify)
                }
                placeholder="Password to verify"
              />
              {bcryptVerifyResult && (
                <div
                  className={cn(
                    "text-xs",
                    bcryptVerifyResult === "valid"
                      ? "text-emerald-600 dark:text-emerald-300"
                      : "text-destructive",
                  )}
                >
                  {bcryptVerifyResult === "valid"
                    ? "Password matches hash."
                    : "Password does not match."}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {state.activeAlgorithm === "scrypt" && (
        <div className="grid gap-6 lg:grid-cols-2">
          <div className="flex flex-col gap-4">
            <div className="text-sm font-medium">Generate</div>
            <div className="flex flex-col gap-2">
              <Label className="text-xs text-muted-foreground">Password</Label>
              <Input
                type="text"
                value={state.scryptPassword}
                onChange={(e) => setParam("scryptPassword", e.target.value)}
                placeholder="Enter password"
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label className="text-xs text-muted-foreground">
                Salt (text)
              </Label>
              <Input
                value={state.scryptSalt}
                onChange={(e) => setParam("scryptSalt", e.target.value)}
                placeholder="Leave empty to auto-generate"
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label className="text-xs text-muted-foreground">
                Salt length
              </Label>
              <Input
                type="number"
                min={8}
                value={state.scryptSaltLength}
                onChange={(e) =>
                  setParam("scryptSaltLength", Number(e.target.value))
                }
              />
            </div>
            <div className="grid gap-2 sm:grid-cols-2">
              <div className="flex flex-col gap-2">
                <Label className="text-xs text-muted-foreground">N</Label>
                <Input
                  type="number"
                  value={state.scryptN}
                  onChange={(e) => setParam("scryptN", Number(e.target.value))}
                />
              </div>
              <div className="flex flex-col gap-2">
                <Label className="text-xs text-muted-foreground">r</Label>
                <Input
                  type="number"
                  value={state.scryptR}
                  onChange={(e) => setParam("scryptR", Number(e.target.value))}
                />
              </div>
              <div className="flex flex-col gap-2">
                <Label className="text-xs text-muted-foreground">p</Label>
                <Input
                  type="number"
                  value={state.scryptP}
                  onChange={(e) => setParam("scryptP", Number(e.target.value))}
                />
              </div>
              <div className="flex flex-col gap-2">
                <Label className="text-xs text-muted-foreground">
                  DK length
                </Label>
                <Input
                  type="number"
                  value={state.scryptDkLen}
                  onChange={(e) =>
                    setParam("scryptDkLen", Number(e.target.value))
                  }
                />
              </div>
            </div>
            <Button
              onClick={onScryptGenerate}
              disabled={!state.scryptPassword || scryptWorking}
              size="sm"
              className="mt-2 self-start"
            >
              {scryptWorking ? "Working..." : "Generate"}
            </Button>
            {scryptError && (
              <Alert variant="destructive">
                <AlertDescription className="text-xs">
                  {scryptError}
                </AlertDescription>
              </Alert>
            )}
          </div>
          <div className="flex flex-col gap-4">
            <div className="flex flex-col gap-2">
              <div className="flex items-center justify-between">
                <Label className="text-sm font-medium">Hash</Label>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() =>
                    handleCopy(state.scryptParseHash, "scryptHash")
                  }
                  className="h-7 w-7 p-0"
                >
                  {copiedField === "scryptHash" ? (
                    <Check className="h-3.5 w-3.5" />
                  ) : (
                    <Copy className="h-3.5 w-3.5" />
                  )}
                </Button>
              </div>
              <Textarea
                value={state.scryptParseHash}
                onChange={(e) => setParam("scryptParseHash", e.target.value)}
                className="min-h-[140px]"
                placeholder="$scrypt$ln=14,r=8,p=1$..."
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label className="text-sm font-medium">Parsed</Label>
              {parsedScrypt ? (
                <table className="w-full text-xs">
                  <tbody>
                    <tr>
                      <td className="py-1 pr-3 text-muted-foreground">N</td>
                      <td className="py-1">{parsedScrypt.N}</td>
                    </tr>
                    <tr>
                      <td className="py-1 pr-3 text-muted-foreground">r</td>
                      <td className="py-1">{parsedScrypt.r}</td>
                    </tr>
                    <tr>
                      <td className="py-1 pr-3 text-muted-foreground">p</td>
                      <td className="py-1">{parsedScrypt.p}</td>
                    </tr>
                    <tr>
                      <td className="py-1 pr-3 text-muted-foreground">Salt</td>
                      <td className="py-1 font-mono">{parsedScrypt.salt}</td>
                    </tr>
                    <tr>
                      <td className="py-1 pr-3 text-muted-foreground">Hash</td>
                      <td className="py-1 font-mono">{parsedScrypt.hash}</td>
                    </tr>
                  </tbody>
                </table>
              ) : (
                <div className="text-xs text-destructive">
                  {state.scryptParseHash.trim()
                    ? "Invalid scrypt hash format."
                    : "Enter a scrypt hash to parse its parameters."}
                </div>
              )}
            </div>
            <div className="flex flex-col gap-2">
              <Label className="text-sm font-medium">Verify</Label>
              <Input
                type="text"
                value={state.scryptVerifyPassword}
                onChange={(e) =>
                  setParam("scryptVerifyPassword", e.target.value)
                }
                onBlur={onScryptVerify}
                onKeyDown={(event) =>
                  handleVerifyKeyDown(event, onScryptVerify)
                }
                placeholder="Password to verify"
              />
              {scryptVerifyResult && (
                <div
                  className={cn(
                    "text-xs",
                    scryptVerifyResult === "valid"
                      ? "text-emerald-600 dark:text-emerald-300"
                      : "text-destructive",
                  )}
                >
                  {scryptVerifyResult === "valid"
                    ? "Password matches hash."
                    : "Password does not match."}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {state.activeAlgorithm === "argon2" && (
        <div className="grid gap-6 lg:grid-cols-2">
          <div className="flex flex-col gap-4">
            <div className="text-sm font-medium">Generate</div>
            <div className="flex flex-col gap-2">
              <Label className="text-xs text-muted-foreground">Password</Label>
              <Input
                type="text"
                value={state.argon2Password}
                onChange={(e) => setParam("argon2Password", e.target.value)}
                placeholder="Enter password"
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label className="text-xs text-muted-foreground">
                Salt (text)
              </Label>
              <Input
                value={state.argon2Salt}
                onChange={(e) => setParam("argon2Salt", e.target.value)}
                placeholder="Leave empty to auto-generate"
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label className="text-xs text-muted-foreground">
                Salt length
              </Label>
              <Input
                type="number"
                min={8}
                value={state.argon2SaltLength}
                onChange={(e) =>
                  setParam("argon2SaltLength", Number(e.target.value))
                }
              />
            </div>
            <div className="grid gap-2 sm:grid-cols-2">
              <div className="flex flex-col gap-2">
                <Label className="text-xs text-muted-foreground">Variant</Label>
                <div className="flex flex-wrap items-center gap-2">
                  {argon2Variants.map((variant) => (
                    <Button
                      key={variant}
                      type="button"
                      variant={
                        state.argon2Type === variant ? "secondary" : "outline"
                      }
                      size="sm"
                      className="h-7 px-2 text-xs"
                      onClick={() => setParam("argon2Type", variant, true)}
                    >
                      {variant}
                    </Button>
                  ))}
                </div>
              </div>
              <div className="flex flex-col gap-2">
                <Label className="text-xs text-muted-foreground">Time</Label>
                <Input
                  type="number"
                  value={state.argon2Time}
                  onChange={(e) =>
                    setParam("argon2Time", Number(e.target.value))
                  }
                />
              </div>
              <div className="flex flex-col gap-2">
                <Label className="text-xs text-muted-foreground">
                  Memory (KiB)
                </Label>
                <Input
                  type="number"
                  value={state.argon2Memory}
                  onChange={(e) =>
                    setParam("argon2Memory", Number(e.target.value))
                  }
                />
              </div>
              <div className="flex flex-col gap-2">
                <Label className="text-xs text-muted-foreground">
                  Parallelism
                </Label>
                <Input
                  type="number"
                  value={state.argon2Parallelism}
                  onChange={(e) =>
                    setParam("argon2Parallelism", Number(e.target.value))
                  }
                />
              </div>
              <div className="flex flex-col gap-2">
                <Label className="text-xs text-muted-foreground">
                  Hash length
                </Label>
                <Input
                  type="number"
                  value={state.argon2HashLen}
                  onChange={(e) =>
                    setParam("argon2HashLen", Number(e.target.value))
                  }
                />
              </div>
            </div>
            <Button
              onClick={onArgon2Generate}
              disabled={!state.argon2Password || argon2Working}
              size="sm"
              className="mt-2 self-start"
            >
              {argon2Working ? "Working..." : "Generate"}
            </Button>
            {argon2Error && (
              <Alert variant="destructive">
                <AlertDescription className="text-xs">
                  {argon2Error}
                </AlertDescription>
              </Alert>
            )}
          </div>
          <div className="flex flex-col gap-4">
            <div className="flex flex-col gap-2">
              <div className="flex items-center justify-between">
                <Label className="text-sm font-medium">Hash</Label>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() =>
                    handleCopy(state.argon2ParseHash, "argon2Hash")
                  }
                  className="h-7 w-7 p-0"
                >
                  {copiedField === "argon2Hash" ? (
                    <Check className="h-3.5 w-3.5" />
                  ) : (
                    <Copy className="h-3.5 w-3.5" />
                  )}
                </Button>
              </div>
              <Textarea
                value={state.argon2ParseHash}
                onChange={(e) => setParam("argon2ParseHash", e.target.value)}
                className="min-h-[140px]"
                placeholder="$argon2id$v=19$m=65536,t=3,p=1$..."
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label className="text-sm font-medium">Parsed</Label>
              {parsedArgon2 ? (
                <table className="w-full text-xs">
                  <tbody>
                    <tr>
                      <td className="py-1 pr-3 text-muted-foreground">Type</td>
                      <td className="py-1">{parsedArgon2.type}</td>
                    </tr>
                    <tr>
                      <td className="py-1 pr-3 text-muted-foreground">
                        Version
                      </td>
                      <td className="py-1">{parsedArgon2.version ?? "-"}</td>
                    </tr>
                    <tr>
                      <td className="py-1 pr-3 text-muted-foreground">
                        Memory
                      </td>
                      <td className="py-1">{parsedArgon2.memory ?? "-"}</td>
                    </tr>
                    <tr>
                      <td className="py-1 pr-3 text-muted-foreground">Time</td>
                      <td className="py-1">{parsedArgon2.time ?? "-"}</td>
                    </tr>
                    <tr>
                      <td className="py-1 pr-3 text-muted-foreground">
                        Parallelism
                      </td>
                      <td className="py-1">
                        {parsedArgon2.parallelism ?? "-"}
                      </td>
                    </tr>
                    <tr>
                      <td className="py-1 pr-3 text-muted-foreground">Salt</td>
                      <td className="py-1 font-mono">
                        {parsedArgon2.salt ?? "-"}
                      </td>
                    </tr>
                    <tr>
                      <td className="py-1 pr-3 text-muted-foreground">Hash</td>
                      <td className="py-1 font-mono">
                        {parsedArgon2.hash ?? "-"}
                      </td>
                    </tr>
                  </tbody>
                </table>
              ) : (
                <div className="text-xs text-destructive">
                  {state.argon2ParseHash.trim()
                    ? "Invalid Argon2 hash format."
                    : "Enter an Argon2 hash to parse its parameters."}
                </div>
              )}
            </div>
            <div className="flex flex-col gap-2">
              <Label className="text-sm font-medium">Verify</Label>
              <Input
                type="text"
                value={state.argon2VerifyPassword}
                onChange={(e) =>
                  setParam("argon2VerifyPassword", e.target.value)
                }
                onBlur={onArgon2Verify}
                onKeyDown={(event) =>
                  handleVerifyKeyDown(event, onArgon2Verify)
                }
                placeholder="Password to verify"
              />
              {argon2VerifyResult && (
                <div
                  className={cn(
                    "text-xs",
                    argon2VerifyResult === "valid"
                      ? "text-emerald-600 dark:text-emerald-300"
                      : "text-destructive",
                  )}
                >
                  {argon2VerifyResult === "valid"
                    ? "Password matches hash."
                    : "Password does not match."}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
