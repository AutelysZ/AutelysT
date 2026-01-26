"use client";

import * as React from "react";
import { Plus, Trash2 } from "lucide-react";
import { DualPaneLayout } from "@/components/tool-ui/dual-pane-layout";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { SetCookieState, CookieJson } from "./set-cookie-types";
import { formatCookieJson, parseCookieJson } from "./set-cookie-utils";

const labelCellClass = "w-32 pr-3 py-1 align-top text-xs text-muted-foreground";

function secondsToDuration(seconds?: number) {
  if (seconds === undefined || Number.isNaN(seconds)) return "";
  const total = Math.max(0, Math.floor(seconds));
  const days = Math.floor(total / 86400);
  const hours = Math.floor((total % 86400) / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const secs = total % 60;
  if (total === 0) return "PT0S";
  const datePart = days > 0 ? `P${days}D` : "P";
  const timeParts = [];
  if (hours > 0) timeParts.push(`${hours}H`);
  if (minutes > 0) timeParts.push(`${minutes}M`);
  if (secs > 0) timeParts.push(`${secs}S`);
  return timeParts.length ? `${datePart}T${timeParts.join("")}` : datePart;
}

function durationToSeconds(value: string): number | null {
  const trimmed = value.trim();
  if (!trimmed) return null;
  const match = /^P(?:(\d+)D)?(?:T(?:(\d+)H)?(?:(\d+)M)?(?:(\d+(?:\.\d+)?)S)?)?$/i.exec(
    trimmed,
  );
  if (!match) return null;
  const days = match[1] ? Number(match[1]) : 0;
  const hours = match[2] ? Number(match[2]) : 0;
  const minutes = match[3] ? Number(match[3]) : 0;
  const seconds = match[4] ? Number(match[4]) : 0;
  if (
    [days, hours, minutes, seconds].some(
      (value) => Number.isNaN(value) || value < 0,
    )
  ) {
    return null;
  }
  return Math.round(days * 86400 + hours * 3600 + minutes * 60 + seconds);
}

type SetCookieFormProps = {
  state: SetCookieState;
  leftError: string | null;
  rightError: string | null;
  leftWarning: string | null;
  rightWarning: string | null;
  onLeftChange: (value: string) => void;
  onRightChange: (value: string) => void;
  onRightViewChange: (view: SetCookieState["rightView"]) => void;
};

function buildCookieChange(
  cookies: CookieJson[],
  index: number,
  patch: Partial<CookieJson>,
): CookieJson[] {
  return cookies.map((cookie, idx) =>
    idx === index ? { ...cookie, ...patch } : cookie,
  );
}

export default function SetCookieForm({
  state,
  leftError,
  rightError,
  leftWarning,
  rightWarning,
  onLeftChange,
  onRightChange,
  onRightViewChange,
}: SetCookieFormProps) {
  const parsedJson = React.useMemo(
    () => parseCookieJson(state.rightText),
    [state.rightText],
  );
  const [durationDrafts, setDurationDrafts] = React.useState<
    Record<number, string>
  >({});

  const updateCookies = React.useCallback(
    (nextCookies: CookieJson[]) => {
      onRightChange(formatCookieJson(nextCookies));
    },
    [onRightChange],
  );

  const handleAddCookie = React.useCallback(() => {
    updateCookies([...parsedJson.cookies, { name: "" }]);
  }, [parsedJson.cookies, updateCookies]);

  const handleRemoveCookie = React.useCallback(
    (index: number) => {
      updateCookies(parsedJson.cookies.filter((_, idx) => idx !== index));
      setDurationDrafts((prev) => {
        const next = { ...prev };
        delete next[index];
        return next;
      });
    },
    [parsedJson.cookies, updateCookies],
  );

  const handleCookieChange = React.useCallback(
    <K extends keyof CookieJson>(index: number, key: K, value: CookieJson[K]) => {
      updateCookies(
        buildCookieChange(parsedJson.cookies, index, {
          [key]: value,
        } as Partial<CookieJson>),
      );
    },
    [parsedJson.cookies, updateCookies],
  );

  const rightHeader = (
    <div className="flex items-center gap-1">
      <Button
        type="button"
        variant={state.rightView === "table" ? "secondary" : "ghost"}
        size="sm"
        className="h-7 px-2 text-xs"
        onClick={() => onRightViewChange("table")}
      >
        Table
      </Button>
      <Button
        type="button"
        variant={state.rightView === "json" ? "secondary" : "ghost"}
        size="sm"
        className="h-7 px-2 text-xs"
        onClick={() => onRightViewChange("json")}
      >
        JSON
      </Button>
    </div>
  );

  const rightTableContent = (
    <div className="flex h-full flex-col gap-4 p-3 text-sm">
      <div className="flex items-center justify-between">
        <div className="text-xs text-muted-foreground">
          {parsedJson.cookies.length} cookie
          {parsedJson.cookies.length === 1 ? "" : "s"}
        </div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="h-7 gap-1 px-2 text-xs"
          onClick={handleAddCookie}
        >
          <Plus className="h-3.5 w-3.5" />
          Add cookie
        </Button>
      </div>
      {parsedJson.error ? (
        <div className="rounded-md border border-destructive/40 bg-destructive/5 px-3 py-2 text-xs text-destructive">
          {parsedJson.error}
        </div>
      ) : null}
      {parsedJson.cookies.length === 0 ? (
        <div className="rounded-md border border-border/60 bg-muted/20 px-3 py-4 text-xs text-muted-foreground">
          No cookies yet. Add one to start building a Set-Cookie header.
        </div>
      ) : (
        parsedJson.cookies.map((cookie, index) => (
          <div
            key={`${cookie.name}-${index}`}
            className="rounded-md border border-border/60 bg-background p-3"
          >
            <div className="mb-2 flex items-center justify-between">
              <div className="text-sm font-medium">
                Cookie {index + 1}
              </div>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-7 w-7 p-0 text-destructive hover:text-destructive"
                onClick={() => handleRemoveCookie(index)}
                aria-label="Remove cookie"
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
            <table className="w-full">
              <tbody>
                <tr>
                  <td className={labelCellClass}>Name</td>
                  <td className="py-1">
                    <Input
                      value={cookie.name ?? ""}
                      onChange={(event) =>
                        handleCookieChange(index, "name", event.target.value)
                      }
                      placeholder="session"
                      className="h-8 text-sm"
                    />
                  </td>
                </tr>
                <tr>
                  <td className={labelCellClass}>Value</td>
                  <td className="py-1">
                    <Input
                      value={cookie.value ?? ""}
                      onChange={(event) =>
                        handleCookieChange(index, "value", event.target.value)
                      }
                      placeholder="abc123"
                      className="h-8 text-sm"
                    />
                  </td>
                </tr>
                <tr>
                  <td className={labelCellClass}>Domain</td>
                  <td className="py-1">
                    <Input
                      value={cookie.domain ?? ""}
                      onChange={(event) =>
                        handleCookieChange(index, "domain", event.target.value || undefined)
                      }
                      placeholder="example.com"
                      className="h-8 text-sm"
                    />
                  </td>
                </tr>
                <tr>
                  <td className={labelCellClass}>Path</td>
                  <td className="py-1">
                    <Input
                      value={cookie.path ?? ""}
                      onChange={(event) =>
                        handleCookieChange(index, "path", event.target.value || undefined)
                      }
                      placeholder="/"
                      className="h-8 text-sm"
                    />
                  </td>
                </tr>
                <tr>
                  <td className={labelCellClass}>Expires</td>
                  <td className="py-1">
                    <Input
                      value={cookie.expires ?? ""}
                      onChange={(event) =>
                        handleCookieChange(index, "expires", event.target.value || undefined)
                      }
                      placeholder="2026-01-26T00:00:00Z"
                      className="h-8 text-sm"
                    />
                    {cookie.expires ? (
                      <p className="mt-1 text-[11px] text-muted-foreground">
                        Expires is deprecated; prefer Max-Age.
                      </p>
                    ) : null}
                  </td>
                </tr>
                <tr>
                  <td className={labelCellClass}>Max-Age</td>
                  <td className="py-1">
                    <div className="flex flex-nowrap items-center gap-2">
                      <Input
                        type="number"
                        value={cookie.maxAge ?? ""}
                        onChange={(event) => {
                          const value = event.target.value;
                          if (value === "") {
                            handleCookieChange(index, "maxAge", undefined);
                            setDurationDrafts((prev) => ({
                              ...prev,
                              [index]: "",
                            }));
                            return;
                          }
                          const numberValue = Number(value);
                          const nextValue = Number.isNaN(numberValue)
                            ? undefined
                            : numberValue;
                          handleCookieChange(index, "maxAge", nextValue);
                          setDurationDrafts((prev) => ({
                            ...prev,
                            [index]: secondsToDuration(nextValue),
                          }));
                        }}
                        placeholder="Seconds"
                        className="h-8 flex-1 text-sm"
                      />
                      <Input
                        value={
                          durationDrafts[index] ??
                          secondsToDuration(cookie.maxAge)
                        }
                        onChange={(event) => {
                          const value = event.target.value;
                          setDurationDrafts((prev) => ({
                            ...prev,
                            [index]: value,
                          }));
                        }}
                        onBlur={() => {
                          const value =
                            durationDrafts[index] ??
                            secondsToDuration(cookie.maxAge);
                          const nextSeconds = durationToSeconds(value);
                          if (nextSeconds !== null) {
                            handleCookieChange(index, "maxAge", nextSeconds);
                            setDurationDrafts((prev) => ({
                              ...prev,
                              [index]: secondsToDuration(nextSeconds),
                            }));
                          }
                        }}
                        onKeyDown={(event) => {
                          if (event.key !== "Enter") return;
                          const value =
                            durationDrafts[index] ??
                            secondsToDuration(cookie.maxAge);
                          const nextSeconds = durationToSeconds(value);
                          if (nextSeconds !== null) {
                            handleCookieChange(index, "maxAge", nextSeconds);
                            setDurationDrafts((prev) => ({
                              ...prev,
                              [index]: secondsToDuration(nextSeconds),
                            }));
                          }
                        }}
                        placeholder="ISO8601 (e.g. PT1H)"
                        className="h-8 flex-1 text-sm"
                      />
                    </div>
                  </td>
                </tr>
                <tr>
                  <td className={labelCellClass}>SameSite</td>
                  <td className="py-1">
                    <Tabs
                      value={cookie.sameSite ?? "unset"}
                      onValueChange={(value) =>
                        handleCookieChange(
                          index,
                          "sameSite",
                          value === "unset"
                            ? undefined
                            : (value as CookieJson["sameSite"]),
                        )
                      }
                    >
                      <TabsList className="h-8">
                        <TabsTrigger value="unset" className="text-xs">
                          Default
                        </TabsTrigger>
                        <TabsTrigger value="lax" className="text-xs">
                          Lax
                        </TabsTrigger>
                        <TabsTrigger value="strict" className="text-xs">
                          Strict
                        </TabsTrigger>
                        <TabsTrigger value="none" className="text-xs">
                          None
                        </TabsTrigger>
                      </TabsList>
                    </Tabs>
                  </td>
                </tr>
                <tr>
                  <td className={labelCellClass}>Priority</td>
                  <td className="py-1">
                    <Tabs
                      value={cookie.priority ?? "unset"}
                      onValueChange={(value) =>
                        handleCookieChange(
                          index,
                          "priority",
                          value === "unset"
                            ? undefined
                            : (value as CookieJson["priority"]),
                        )
                      }
                    >
                      <TabsList className="h-8">
                        <TabsTrigger value="unset" className="text-xs">
                          Default
                        </TabsTrigger>
                        <TabsTrigger value="low" className="text-xs">
                          Low
                        </TabsTrigger>
                        <TabsTrigger value="medium" className="text-xs">
                          Medium
                        </TabsTrigger>
                        <TabsTrigger value="high" className="text-xs">
                          High
                        </TabsTrigger>
                      </TabsList>
                    </Tabs>
                  </td>
                </tr>
                <tr>
                  <td className={labelCellClass}>Flags</td>
                  <td className="py-1">
                    <div className="flex flex-wrap gap-3">
                      <label className="flex items-center gap-2 text-xs">
                        <Checkbox
                          checked={cookie.httpOnly === true}
                          onCheckedChange={(checked) =>
                            handleCookieChange(index, "httpOnly", checked === true)
                          }
                        />
                        HttpOnly
                      </label>
                      <label className="flex items-center gap-2 text-xs">
                        <Checkbox
                          checked={cookie.secure === true}
                          onCheckedChange={(checked) =>
                            handleCookieChange(index, "secure", checked === true)
                          }
                        />
                        Secure
                      </label>
                      <label className="flex items-center gap-2 text-xs">
                        <Checkbox
                          checked={cookie.partitioned === true}
                          onCheckedChange={(checked) =>
                            handleCookieChange(index, "partitioned", checked === true)
                          }
                        />
                        Partitioned
                      </label>
                    </div>
                  </td>
                </tr>
                <tr>
                  <td className={labelCellClass}>Extensions</td>
                  <td className="py-1">
                    <Input
                      value={(cookie.extensions ?? []).join("; ")}
                      onChange={(event) => {
                        const raw = event.target.value;
                        const next =
                          raw.trim() === ""
                            ? undefined
                            : raw
                                .split(/[;,]+/)
                                .map((item) => item.trim())
                                .filter(Boolean);
                        handleCookieChange(index, "extensions", next);
                      }}
                      placeholder="SameParty; Priority=High"
                      className="h-8 text-sm"
                    />
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        ))
      )}
    </div>
  );

  return (
    <DualPaneLayout
      leftLabel="Set-Cookie Header"
      rightLabel="Cookie JSON"
      leftValue={state.leftText}
      rightValue={state.rightText}
      onLeftChange={onLeftChange}
      onRightChange={onRightChange}
      activeSide={state.activeSide}
      leftError={leftError}
      rightError={rightError}
      leftWarning={leftWarning}
      rightWarning={rightWarning}
      rightHeaderExtra={rightHeader}
      rightCustomContent={
        state.rightView === "table" ? rightTableContent : undefined
      }
      rightReadOnly={state.rightView === "table"}
      leftContentClassName="max-h-none h-auto overflow-visible"
      rightContentClassName="max-h-none h-auto overflow-visible"
      layoutClassName="h-auto"
      panesClassName="flex-none"
      leftPlaceholder="Set-Cookie: session=abc123; Path=/; HttpOnly; Secure"
      rightPlaceholder={`[\n  {\n    \"name\": \"session\",\n    \"value\": \"abc123\",\n    \"path\": \"/\",\n    \"httpOnly\": true,\n    \"secure\": true,\n    \"sameSite\": \"lax\"\n  }\n]`}
    />
  );
}
