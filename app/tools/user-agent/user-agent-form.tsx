"use client";

import * as React from "react";
import { RotateCcw } from "lucide-react";
import { DualPaneLayout } from "@/components/tool-ui/dual-pane-layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { UserAgentState, UserAgentJson } from "./user-agent-types";
import {
  formatUserAgentJson,
  parseUserAgentJson,
} from "./user-agent-utils";

const labelCellClass = "w-40 pr-3 py-1 align-top text-xs text-muted-foreground";

type UserAgentFormProps = {
  state: UserAgentState;
  leftError: string | null;
  rightError: string | null;
  leftWarning: string | null;
  rightWarning: string | null;
  onLeftChange: (value: string) => void;
  onRightChange: (value: string) => void;
  onRightViewChange: (view: UserAgentState["rightView"]) => void;
  onResetToCurrent: () => void;
  onClearAll: () => void;
};

function buildUpdate(
  data: UserAgentJson,
  section: keyof UserAgentJson,
  key: string,
  value: string,
): UserAgentJson {
  const sectionValue = (data[section] ?? {}) as Record<string, string | undefined>;
  return {
    ...data,
    [section]: {
      ...sectionValue,
      [key]: value,
    },
  } as UserAgentJson;
}

export default function UserAgentForm({
  state,
  leftError,
  rightError,
  leftWarning,
  rightWarning,
  onLeftChange,
  onRightChange,
  onRightViewChange,
  onResetToCurrent,
  onClearAll,
}: UserAgentFormProps) {
  const parsedJson = React.useMemo(
    () => parseUserAgentJson(state.rightText),
    [state.rightText],
  );

  const updateJson = React.useCallback(
    (next: UserAgentJson) => {
      onRightChange(formatUserAgentJson(next));
    },
    [onRightChange],
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
      {parsedJson.error ? (
        <div className="rounded-md border border-destructive/40 bg-destructive/5 px-3 py-2 text-xs text-destructive">
          {parsedJson.error}
        </div>
      ) : null}
      <div className="rounded-md border border-border/60 bg-background p-3">
        <div className="mb-2 text-xs font-medium text-muted-foreground">
          Raw
        </div>
        <table className="w-full">
          <tbody>
            <tr>
              <td className={labelCellClass}>UA String</td>
              <td className="py-1">
                <Input
                  value={parsedJson.data.ua ?? ""}
                  onChange={(e) =>
                    updateJson({
                      ...parsedJson.data,
                      ua: e.target.value,
                    })
                  }
                  placeholder="Mozilla/5.0 ..."
                  className="h-8 text-sm"
                />
              </td>
            </tr>
          </tbody>
        </table>
        <p className="mt-2 text-xs text-muted-foreground">
          Raw UA is used only if other fields are empty.
        </p>
      </div>

      <div className="rounded-md border border-border/60 bg-background p-3">
        <div className="mb-2 text-xs font-medium text-muted-foreground">
          Browser
        </div>
        <table className="w-full">
          <tbody>
            <tr>
              <td className={labelCellClass}>Name</td>
              <td className="py-1">
                <Input
                  value={parsedJson.data.browser?.name ?? ""}
                  onChange={(e) =>
                    updateJson(buildUpdate(parsedJson.data, "browser", "name", e.target.value))
                  }
                  placeholder="Chrome"
                  className="h-8 text-sm"
                />
              </td>
            </tr>
            <tr>
              <td className={labelCellClass}>Version</td>
              <td className="py-1">
                <Input
                  value={parsedJson.data.browser?.version ?? ""}
                  onChange={(e) =>
                    updateJson(buildUpdate(parsedJson.data, "browser", "version", e.target.value))
                  }
                  placeholder="120.0.0.0"
                  className="h-8 text-sm"
                />
              </td>
            </tr>
            <tr>
              <td className={labelCellClass}>Major</td>
              <td className="py-1">
                <Input
                  value={parsedJson.data.browser?.major ?? ""}
                  onChange={(e) =>
                    updateJson(buildUpdate(parsedJson.data, "browser", "major", e.target.value))
                  }
                  placeholder="120"
                  className="h-8 text-sm"
                />
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <div className="rounded-md border border-border/60 bg-background p-3">
        <div className="mb-2 text-xs font-medium text-muted-foreground">
          Engine
        </div>
        <table className="w-full">
          <tbody>
            <tr>
              <td className={labelCellClass}>Name</td>
              <td className="py-1">
                <Input
                  value={parsedJson.data.engine?.name ?? ""}
                  onChange={(e) =>
                    updateJson(buildUpdate(parsedJson.data, "engine", "name", e.target.value))
                  }
                  placeholder="AppleWebKit"
                  className="h-8 text-sm"
                />
              </td>
            </tr>
            <tr>
              <td className={labelCellClass}>Version</td>
              <td className="py-1">
                <Input
                  value={parsedJson.data.engine?.version ?? ""}
                  onChange={(e) =>
                    updateJson(buildUpdate(parsedJson.data, "engine", "version", e.target.value))
                  }
                  placeholder="537.36"
                  className="h-8 text-sm"
                />
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <div className="rounded-md border border-border/60 bg-background p-3">
        <div className="mb-2 text-xs font-medium text-muted-foreground">
          Operating System
        </div>
        <table className="w-full">
          <tbody>
            <tr>
              <td className={labelCellClass}>Name</td>
              <td className="py-1">
                <Input
                  value={parsedJson.data.os?.name ?? ""}
                  onChange={(e) =>
                    updateJson(buildUpdate(parsedJson.data, "os", "name", e.target.value))
                  }
                  placeholder="Windows"
                  className="h-8 text-sm"
                />
              </td>
            </tr>
            <tr>
              <td className={labelCellClass}>Version</td>
              <td className="py-1">
                <Input
                  value={parsedJson.data.os?.version ?? ""}
                  onChange={(e) =>
                    updateJson(buildUpdate(parsedJson.data, "os", "version", e.target.value))
                  }
                  placeholder="10.0"
                  className="h-8 text-sm"
                />
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <div className="rounded-md border border-border/60 bg-background p-3">
        <div className="mb-2 text-xs font-medium text-muted-foreground">
          Device
        </div>
        <table className="w-full">
          <tbody>
            <tr>
              <td className={labelCellClass}>Vendor</td>
              <td className="py-1">
                <Input
                  value={parsedJson.data.device?.vendor ?? ""}
                  onChange={(e) =>
                    updateJson(buildUpdate(parsedJson.data, "device", "vendor", e.target.value))
                  }
                  placeholder="Apple"
                  className="h-8 text-sm"
                />
              </td>
            </tr>
            <tr>
              <td className={labelCellClass}>Model</td>
              <td className="py-1">
                <Input
                  value={parsedJson.data.device?.model ?? ""}
                  onChange={(e) =>
                    updateJson(buildUpdate(parsedJson.data, "device", "model", e.target.value))
                  }
                  placeholder="iPhone"
                  className="h-8 text-sm"
                />
              </td>
            </tr>
            <tr>
              <td className={labelCellClass}>Type</td>
              <td className="py-1">
                <Input
                  value={parsedJson.data.device?.type ?? ""}
                  onChange={(e) =>
                    updateJson(buildUpdate(parsedJson.data, "device", "type", e.target.value))
                  }
                  placeholder="mobile"
                  className="h-8 text-sm"
                />
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <div className="rounded-md border border-border/60 bg-background p-3">
        <div className="mb-2 text-xs font-medium text-muted-foreground">
          CPU
        </div>
        <table className="w-full">
          <tbody>
            <tr>
              <td className={labelCellClass}>Architecture</td>
              <td className="py-1">
                <Input
                  value={parsedJson.data.cpu?.architecture ?? ""}
                  onChange={(e) =>
                    updateJson(buildUpdate(parsedJson.data, "cpu", "architecture", e.target.value))
                  }
                  placeholder="x64"
                  className="h-8 text-sm"
                />
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );

  const leftHeaderExtra = (
    <div className="flex items-center gap-1">
      <Button
        type="button"
        variant="ghost"
        size="sm"
        onClick={onClearAll}
        className="h-7 px-2 text-xs"
      >
        Clear
      </Button>
      <Button
        type="button"
        variant="ghost"
        size="sm"
        onClick={onResetToCurrent}
        className="h-7 gap-1 px-2 text-xs"
      >
        <RotateCcw className="h-3 w-3" />
        Reset
      </Button>
    </div>
  );

  return (
    <DualPaneLayout
      leftLabel="User-Agent"
      rightLabel="UA JSON"
      leftValue={state.leftText}
      rightValue={state.rightText}
      onLeftChange={onLeftChange}
      onRightChange={onRightChange}
      activeSide={state.activeSide}
      leftError={leftError}
      rightError={rightError}
      leftWarning={leftWarning}
      rightWarning={rightWarning}
      leftHeaderExtra={leftHeaderExtra}
      rightHeaderExtra={rightHeader}
      rightCustomContent={
        state.rightView === "table" ? rightTableContent : undefined
      }
      rightReadOnly={state.rightView === "table"}
      leftContentClassName="max-h-none h-auto overflow-visible"
      rightContentClassName="max-h-none h-auto overflow-visible"
      layoutClassName="h-auto"
      panesClassName="flex-none"
      leftPlaceholder="Mozilla/5.0 (Windows NT 10.0; Win64; x64) ..."
      rightPlaceholder={`{
  "ua": "Mozilla/5.0 ...",
  "browser": {
    "name": "Chrome",
    "version": "120.0.0.0"
  }
}`}
    />
  );
}
