"use client";

import * as React from "react";
import { Suspense } from "react";
import { z } from "zod";
import { Check, Copy, RefreshCw, Smartphone, Monitor, Tablet, Globe, Bot, HelpCircle } from "lucide-react";
import {
  ToolPageWrapper,
  useToolHistoryContext,
} from "@/components/tool-ui/tool-page-wrapper";
import {
  DEFAULT_URL_SYNC_DEBOUNCE_MS,
  useUrlSyncedState,
} from "@/lib/url-state/use-url-synced-state";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import type { HistoryEntry } from "@/lib/history/db";
import { cn } from "@/lib/utils";

const paramsSchema = z.object({
  userAgent: z.string().default(""),
});

type UserAgentState = z.infer<typeof paramsSchema>;

interface ParsedUserAgent {
  browser: {
    name: string;
    version: string;
    major: string;
  };
  engine: {
    name: string;
    version: string;
  };
  os: {
    name: string;
    version: string;
  };
  device: {
    type: string;
    vendor: string;
    model: string;
  };
  cpu: {
    architecture: string;
  };
  isBot: boolean;
  raw: string;
}

const BROWSER_PATTERNS: Array<{ name: string; regex: RegExp; versionIndex?: number }> = [
  { name: "Edge", regex: /Edg(?:e|A|iOS)?\/(\d+(?:\.\d+)*)/ },
  { name: "Opera", regex: /(?:OPR|Opera)[/ ](\d+(?:\.\d+)*)/ },
  { name: "Brave", regex: /Brave\/(\d+(?:\.\d+)*)/ },
  { name: "Vivaldi", regex: /Vivaldi\/(\d+(?:\.\d+)*)/ },
  { name: "Samsung Internet", regex: /SamsungBrowser\/(\d+(?:\.\d+)*)/ },
  { name: "UC Browser", regex: /UCBrowser\/(\d+(?:\.\d+)*)/ },
  { name: "Firefox", regex: /Firefox\/(\d+(?:\.\d+)*)/ },
  { name: "Chrome", regex: /(?:Chrome|CriOS)\/(\d+(?:\.\d+)*)/ },
  { name: "Safari", regex: /Version\/(\d+(?:\.\d+)*).*Safari/ },
  { name: "IE", regex: /(?:MSIE |rv:)(\d+(?:\.\d+)*)/ },
];

const ENGINE_PATTERNS: Array<{ name: string; regex: RegExp }> = [
  { name: "Blink", regex: /Chrome\/(\d+(?:\.\d+)*)/ },
  { name: "Gecko", regex: /Gecko\/(\d+(?:\.\d+)*)/ },
  { name: "WebKit", regex: /AppleWebKit\/(\d+(?:\.\d+)*)/ },
  { name: "Trident", regex: /Trident\/(\d+(?:\.\d+)*)/ },
  { name: "EdgeHTML", regex: /Edge\/(\d+(?:\.\d+)*)/ },
  { name: "Presto", regex: /Presto\/(\d+(?:\.\d+)*)/ },
];

const OS_PATTERNS: Array<{ name: string; regex: RegExp; versionRegex?: RegExp }> = [
  { name: "Windows 11", regex: /Windows NT 10\.0.*Win64/ },
  { name: "Windows 10", regex: /Windows NT 10\.0/ },
  { name: "Windows 8.1", regex: /Windows NT 6\.3/ },
  { name: "Windows 8", regex: /Windows NT 6\.2/ },
  { name: "Windows 7", regex: /Windows NT 6\.1/ },
  { name: "Windows Vista", regex: /Windows NT 6\.0/ },
  { name: "Windows XP", regex: /Windows NT 5\.[12]/ },
  { name: "macOS", regex: /Mac OS X (\d+[._]\d+(?:[._]\d+)?)/, versionRegex: /Mac OS X (\d+[._]\d+(?:[._]\d+)?)/ },
  { name: "iOS", regex: /(?:iPhone|iPad|iPod).*OS (\d+[._]\d+(?:[._]\d+)?)/, versionRegex: /OS (\d+[._]\d+(?:[._]\d+)?)/ },
  { name: "Android", regex: /Android (\d+(?:\.\d+)*)/, versionRegex: /Android (\d+(?:\.\d+)*)/ },
  { name: "Linux", regex: /Linux/ },
  { name: "Chrome OS", regex: /CrOS/ },
  { name: "Ubuntu", regex: /Ubuntu/ },
  { name: "Fedora", regex: /Fedora/ },
  { name: "FreeBSD", regex: /FreeBSD/ },
];

const BOT_PATTERNS = [
  /bot/i,
  /crawler/i,
  /spider/i,
  /slurp/i,
  /googlebot/i,
  /bingbot/i,
  /yandex/i,
  /baidu/i,
  /duckduckbot/i,
  /facebookexternalhit/i,
  /twitterbot/i,
  /linkedinbot/i,
  /whatsapp/i,
  /telegrambot/i,
  /applebot/i,
  /semrush/i,
  /ahrefs/i,
  /mj12bot/i,
  /dotbot/i,
  /petalbot/i,
  /bytespider/i,
  /gptbot/i,
  /claudebot/i,
  /anthropic/i,
];

function parseUserAgent(ua: string): ParsedUserAgent {
  const result: ParsedUserAgent = {
    browser: { name: "Unknown", version: "", major: "" },
    engine: { name: "Unknown", version: "" },
    os: { name: "Unknown", version: "" },
    device: { type: "Desktop", vendor: "", model: "" },
    cpu: { architecture: "" },
    isBot: false,
    raw: ua,
  };

  if (!ua) return result;

  // Check if it's a bot
  result.isBot = BOT_PATTERNS.some((pattern) => pattern.test(ua));

  // Parse browser
  for (const { name, regex } of BROWSER_PATTERNS) {
    const match = ua.match(regex);
    if (match) {
      result.browser.name = name;
      result.browser.version = match[1] || "";
      result.browser.major = result.browser.version.split(".")[0] || "";
      break;
    }
  }

  // Parse engine
  for (const { name, regex } of ENGINE_PATTERNS) {
    const match = ua.match(regex);
    if (match) {
      result.engine.name = name;
      result.engine.version = match[1] || "";
      break;
    }
  }

  // Parse OS
  for (const { name, regex, versionRegex } of OS_PATTERNS) {
    if (regex.test(ua)) {
      result.os.name = name;
      if (versionRegex) {
        const versionMatch = ua.match(versionRegex);
        if (versionMatch) {
          result.os.version = versionMatch[1]?.replace(/_/g, ".") || "";
        }
      }
      break;
    }
  }

  // Parse device type
  if (/Mobile|Android.*Mobile|iPhone|iPod|BlackBerry|IEMobile|Opera Mini/i.test(ua)) {
    result.device.type = "Mobile";
  } else if (/iPad|Android(?!.*Mobile)|Tablet/i.test(ua)) {
    result.device.type = "Tablet";
  } else if (/Smart-?TV|GoogleTV|AppleTV|HbbTV|BRAVIA|NetCast|Roku|Viera/i.test(ua)) {
    result.device.type = "Smart TV";
  } else if (/PlayStation|Xbox|Nintendo/i.test(ua)) {
    result.device.type = "Console";
  } else if (result.isBot) {
    result.device.type = "Bot";
  }

  // Parse device vendor and model
  if (/iPhone/i.test(ua)) {
    result.device.vendor = "Apple";
    result.device.model = "iPhone";
  } else if (/iPad/i.test(ua)) {
    result.device.vendor = "Apple";
    result.device.model = "iPad";
  } else if (/iPod/i.test(ua)) {
    result.device.vendor = "Apple";
    result.device.model = "iPod";
  } else if (/Macintosh/i.test(ua)) {
    result.device.vendor = "Apple";
    result.device.model = "Mac";
  } else if (/Samsung/i.test(ua)) {
    result.device.vendor = "Samsung";
    const modelMatch = ua.match(/SM-[A-Z0-9]+/i);
    if (modelMatch) result.device.model = modelMatch[0];
  } else if (/Pixel/i.test(ua)) {
    result.device.vendor = "Google";
    const modelMatch = ua.match(/Pixel[^;)]*/i);
    if (modelMatch) result.device.model = modelMatch[0].trim();
  } else if (/HUAWEI|Honor/i.test(ua)) {
    result.device.vendor = "Huawei";
  } else if (/Xiaomi|Redmi|POCO/i.test(ua)) {
    result.device.vendor = "Xiaomi";
  } else if (/OnePlus/i.test(ua)) {
    result.device.vendor = "OnePlus";
  } else if (/OPPO/i.test(ua)) {
    result.device.vendor = "OPPO";
  } else if (/vivo/i.test(ua)) {
    result.device.vendor = "Vivo";
  }

  // Parse CPU architecture
  if (/x64|x86_64|Win64|WOW64|amd64/i.test(ua)) {
    result.cpu.architecture = "x86_64";
  } else if (/arm64|aarch64/i.test(ua)) {
    result.cpu.architecture = "ARM64";
  } else if (/arm/i.test(ua)) {
    result.cpu.architecture = "ARM";
  } else if (/i[3456]86|x86/i.test(ua)) {
    result.cpu.architecture = "x86";
  }

  return result;
}

function getDeviceIcon(type: string) {
  switch (type.toLowerCase()) {
    case "mobile":
      return <Smartphone className="h-5 w-5" />;
    case "tablet":
      return <Tablet className="h-5 w-5" />;
    case "bot":
      return <Bot className="h-5 w-5" />;
    default:
      return <Monitor className="h-5 w-5" />;
  }
}

function InfoRow({ label, value, hint }: { label: string; value: string; hint?: string }) {
  if (!value) return null;
  return (
    <div className="flex items-center justify-between py-2 border-b border-border last:border-0">
      <span className="text-sm text-muted-foreground flex items-center gap-1.5">
        {label}
        {hint && (
          <span className="relative inline-flex items-center group">
            <HelpCircle className="h-3 w-3 text-muted-foreground/70" aria-hidden="true" />
            <span className="pointer-events-none absolute left-full top-1/2 z-20 ml-2 hidden w-max max-w-[280px] -translate-y-1/2 whitespace-normal rounded-md border bg-popover px-2 py-1 text-xs text-popover-foreground shadow-md group-hover:block">
              {hint}
            </span>
          </span>
        )}
      </span>
      <span className="text-sm font-medium text-foreground">{value}</span>
    </div>
  );
}

export default function UserAgentParserPage() {
  return (
    <Suspense fallback={null}>
      <UserAgentParserContent />
    </Suspense>
  );
}

function UserAgentParserContent() {
  const { state, setParam, hydrationSource } = useUrlSyncedState("user-agent-parser", {
    schema: paramsSchema,
    defaults: paramsSchema.parse({}),
  });

  const [copyFeedback, setCopyFeedback] = React.useState(false);

  const handleLoadHistory = React.useCallback(
    (entry: HistoryEntry) => {
      const { inputs } = entry;
      if (inputs.userAgent !== undefined) {
        setParam("userAgent", inputs.userAgent);
      }
    },
    [setParam],
  );

  const parsed = React.useMemo(() => parseUserAgent(state.userAgent), [state.userAgent]);

  const handleUseCurrentBrowser = React.useCallback(() => {
    if (typeof navigator !== "undefined") {
      setParam("userAgent", navigator.userAgent);
    }
  }, [setParam]);

  const handleCopy = React.useCallback(async () => {
    if (!state.userAgent) return;
    await navigator.clipboard.writeText(state.userAgent);
    setCopyFeedback(true);
    window.setTimeout(() => setCopyFeedback(false), 1200);
  }, [state.userAgent]);

  const historyCtx = useToolHistoryContext();

  React.useEffect(() => {
    if (hydrationSource === "defaults" || !state.userAgent) return;
    historyCtx.saveEntry({
      inputs: { userAgent: state.userAgent },
      params: {},
      outputs: {
        browser: `${parsed.browser.name} ${parsed.browser.version}`,
        os: `${parsed.os.name} ${parsed.os.version}`,
        device: parsed.device.type,
      },
      labels: { userAgent: "User Agent" },
    });
  }, [state.userAgent, parsed, hydrationSource, historyCtx]);

  return (
    <ToolPageWrapper
      toolId="user-agent-parser"
      onLoadHistory={handleLoadHistory}
    >
      <div className="flex flex-col gap-6">
        {/* Input Section */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <label htmlFor="user-agent-input" className="text-sm font-medium">
              User Agent String
            </label>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={handleUseCurrentBrowser}
                className="h-8 text-xs"
              >
                <RefreshCw className="h-3.5 w-3.5 mr-1.5" />
                Use Current Browser
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={handleCopy}
                disabled={!state.userAgent}
                className="h-8 text-xs"
              >
                {copyFeedback ? (
                  <Check className="h-3.5 w-3.5 mr-1.5" />
                ) : (
                  <Copy className="h-3.5 w-3.5 mr-1.5" />
                )}
                Copy
              </Button>
            </div>
          </div>
          <Textarea
            id="user-agent-input"
            value={state.userAgent}
            onChange={(e) => setParam("userAgent", e.target.value)}
            placeholder="Paste a user agent string here or click 'Use Current Browser'..."
            className="min-h-[100px] font-mono text-sm"
          />
        </div>

        {/* Results Section */}
        {state.userAgent && (
          <div className="grid gap-4 md:grid-cols-2">
            {/* Device Overview */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-base">
                  {getDeviceIcon(parsed.device.type)}
                  Device
                  {parsed.isBot && (
                    <Badge variant="secondary" className="ml-auto text-xs">
                      Bot Detected
                    </Badge>
                  )}
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-0">
                <InfoRow label="Type" value={parsed.device.type} />
                <InfoRow label="Vendor" value={parsed.device.vendor} />
                <InfoRow label="Model" value={parsed.device.model} />
              </CardContent>
            </Card>

            {/* Browser */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-base">
                  <Globe className="h-5 w-5" />
                  Browser
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-0">
                <InfoRow label="Name" value={parsed.browser.name} />
                <InfoRow label="Version" value={parsed.browser.version} />
                <InfoRow label="Major Version" value={parsed.browser.major} />
              </CardContent>
            </Card>

            {/* Operating System */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Operating System</CardTitle>
              </CardHeader>
              <CardContent className="pt-0">
                <InfoRow label="Name" value={parsed.os.name} />
                <InfoRow label="Version" value={parsed.os.version} />
              </CardContent>
            </Card>

            {/* Engine & CPU */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Engine & CPU</CardTitle>
              </CardHeader>
              <CardContent className="pt-0">
                <InfoRow
                  label="Engine"
                  value={parsed.engine.name}
                  hint="The browser rendering engine"
                />
                <InfoRow label="Engine Version" value={parsed.engine.version} />
                <InfoRow
                  label="CPU Architecture"
                  value={parsed.cpu.architecture}
                  hint="The processor architecture"
                />
              </CardContent>
            </Card>
          </div>
        )}

        {/* Empty State */}
        {!state.userAgent && (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <Monitor className="h-12 w-12 text-muted-foreground/50 mb-4" />
            <p className="text-muted-foreground">
              Enter a user agent string above to parse it, or click{" "}
              <button
                onClick={handleUseCurrentBrowser}
                className="text-primary hover:underline"
              >
                Use Current Browser
              </button>{" "}
              to analyze your current browser.
            </p>
          </div>
        )}
      </div>
    </ToolPageWrapper>
  );
}
