"use client";

import * as React from "react";
import { Suspense, useCallback, useRef, useState } from "react";
import {
  Upload,
  FileText,
  ChevronRight,
  ChevronDown,
  Copy,
  Check,
} from "lucide-react";
import { ToolPageWrapper } from "@/components/tool-ui/tool-page-wrapper";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { cn } from "@/lib/utils";
import {
  decodeASN1,
  parseInput,
  formatASN1Tree,
  type ASN1Node,
} from "@/lib/asn1/decoder";

interface TreeNodeProps {
  node: ASN1Node;
  depth: number;
  defaultExpanded?: boolean;
}

function TreeNode({ node, depth, defaultExpanded = true }: TreeNodeProps) {
  const [expanded, setExpanded] = useState(defaultExpanded || depth < 3);
  const [copied, setCopied] = useState(false);

  const hasChildren = node.children && node.children.length > 0;

  const handleCopy = useCallback(async () => {
    const text = node.decodedValue || "";
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback
      const textarea = document.createElement("textarea");
      textarea.value = text;
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand("copy");
      document.body.removeChild(textarea);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  }, [node.decodedValue]);

  const tagClassColor = {
    universal: "text-blue-600 dark:text-blue-400",
    context: "text-green-600 dark:text-green-400",
    application: "text-purple-600 dark:text-purple-400",
    private: "text-orange-600 dark:text-orange-400",
  };

  return (
    <div className="font-mono text-sm">
      <div
        className={cn(
          "flex items-start gap-1 py-0.5 hover:bg-muted/50 rounded group",
          hasChildren && "cursor-pointer",
        )}
        style={{ paddingLeft: `${depth * 16}px` }}
        onClick={() => hasChildren && setExpanded(!expanded)}
      >
        {hasChildren ? (
          <span className="w-4 h-5 flex items-center justify-center flex-shrink-0">
            {expanded ? (
              <ChevronDown className="h-3 w-3" />
            ) : (
              <ChevronRight className="h-3 w-3" />
            )}
          </span>
        ) : (
          <span className="w-4 flex-shrink-0" />
        )}

        <span className="text-muted-foreground text-xs w-12 flex-shrink-0">
          [{node.offset}]
        </span>

        <span className="text-muted-foreground text-xs w-16 flex-shrink-0">
          ({node.headerLength}+{node.length})
        </span>

        <span
          className={cn(
            "font-medium flex-shrink-0",
            tagClassColor[node.tagClass],
          )}
        >
          {node.tagName}
        </span>

        {node.decodedValue && !node.constructed && (
          <>
            <span className="text-muted-foreground mx-1">:</span>
            <span className="text-foreground break-all flex-1">
              {node.decodedValue.length > 100
                ? node.decodedValue.slice(0, 100) + "..."
                : node.decodedValue}
            </span>
            {node.decodedValue && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  handleCopy();
                }}
                className="opacity-0 group-hover:opacity-100 p-1 hover:bg-muted rounded"
                title="Copy value"
              >
                {copied ? (
                  <Check className="h-3 w-3 text-green-500" />
                ) : (
                  <Copy className="h-3 w-3" />
                )}
              </button>
            )}
          </>
        )}

        {node.constructed && node.children && (
          <span className="text-muted-foreground">
            ({node.children.length} element
            {node.children.length !== 1 ? "s" : ""})
          </span>
        )}
      </div>

      {expanded && node.children && (
        <div>
          {node.children.map((child, index) => (
            <TreeNode key={index} node={child} depth={depth + 1} />
          ))}
        </div>
      )}
    </div>
  );
}

function ASN1DecoderContent() {
  const [input, setInput] = useState("");
  const [result, setResult] = useState<ASN1Node | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [textOutput, setTextOutput] = useState("");
  const [viewMode, setViewMode] = useState<"tree" | "text">("tree");
  const [copiedAll, setCopiedAll] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const doDecode = useCallback((value: string) => {
    setError(null);
    setResult(null);
    setTextOutput("");

    if (!value.trim()) {
      return;
    }

    try {
      const bytes = parseInput(value);
      if (!bytes) {
        setError(
          "Invalid input. Supported formats: PEM, hex, or base64 encoded DER.",
        );
        return;
      }

      const decoded = decodeASN1(bytes);
      setResult(decoded);
      setTextOutput(formatASN1Tree(decoded));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to decode ASN.1");
    }
  }, []);

  const handleInputChange = useCallback(
    (value: string) => {
      setInput(value);

      // Clear previous timeout
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }

      // Debounce decoding by 500ms
      debounceRef.current = setTimeout(() => {
        doDecode(value);
      }, 500);
    },
    [doDecode],
  );

  const handleDecode = useCallback(() => {
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }
    doDecode(input);
  }, [input, doDecode]);

  const handleFileUpload = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;

      try {
        // Try reading as text first (for PEM files)
        const text = await file.text();
        if (text.startsWith("-----BEGIN")) {
          setInput(text);
          doDecode(text);
        } else {
          // Read as binary
          const buffer = await file.arrayBuffer();
          const bytes = new Uint8Array(buffer);
          // Convert to hex string
          const hex = Array.from(bytes)
            .map((b) => b.toString(16).padStart(2, "0"))
            .join("");
          setInput(hex);
          doDecode(hex);
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to read file");
      }

      // Reset file input
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    },
    [doDecode],
  );

  const handleCopyAll = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(textOutput);
      setCopiedAll(true);
      setTimeout(() => setCopiedAll(false), 2000);
    } catch {
      // Fallback
      const textarea = document.createElement("textarea");
      textarea.value = textOutput;
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand("copy");
      document.body.removeChild(textarea);
      setCopiedAll(true);
      setTimeout(() => setCopiedAll(false), 2000);
    }
  }, [textOutput]);

  return (
    <ToolPageWrapper
      toolId="asn1-decoder"
      title="ASN.1 Decoder"
      description="Decode and visualize ASN.1 DER/BER encoded data structures"
    >
      <div className="space-y-6">
        {/* Input Section */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Input</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label className="text-sm mb-2 block">
                Paste PEM, hex, or base64 encoded DER data
              </Label>
              <Textarea
                value={input}
                onChange={(e) => handleInputChange(e.target.value)}
                placeholder={`-----BEGIN CERTIFICATE-----
MIICpDCCAYwCCQDU+pQ4P0yBAjANBgkqhkiG9w0BAQsFADAUMRIwEAYDVQQDDAls
b2NhbGhvc3QwHhcNMjMwMTAxMDAwMDAwWhcNMjQwMTAxMDAwMDAwWjAUMRIwEAYD
...
-----END CERTIFICATE-----

Or hex: 30 82 01 22 30 0D 06 09 2A 86 48...

Or base64: MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8A...`}
                className="font-mono text-sm min-h-[150px] break-all"
              />
            </div>

            <div className="flex gap-2">
              <Button onClick={handleDecode} disabled={!input.trim()}>
                Decode
              </Button>
              <input
                ref={fileInputRef}
                type="file"
                accept=".pem,.cer,.crt,.der,.p12,.pfx,.key,.pub"
                onChange={handleFileUpload}
                className="hidden"
              />
              <Button
                variant="outline"
                onClick={() => fileInputRef.current?.click()}
              >
                <Upload className="h-4 w-4 mr-2" />
                Upload File
              </Button>
              <Button
                variant="outline"
                onClick={() => {
                  setInput("");
                  setResult(null);
                  setError(null);
                  setTextOutput("");
                }}
              >
                Clear
              </Button>
            </div>

            {error && (
              <Alert variant="destructive">
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}
          </CardContent>
        </Card>

        {/* Output Section */}
        {result && (
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="text-lg">Decoded Structure</CardTitle>
                <div className="flex items-center gap-2">
                  <div className="flex border rounded-md">
                    <Button
                      variant={viewMode === "tree" ? "secondary" : "ghost"}
                      size="sm"
                      className="rounded-r-none"
                      onClick={() => setViewMode("tree")}
                    >
                      Tree
                    </Button>
                    <Button
                      variant={viewMode === "text" ? "secondary" : "ghost"}
                      size="sm"
                      className="rounded-l-none"
                      onClick={() => setViewMode("text")}
                    >
                      Text
                    </Button>
                  </div>
                  <Button variant="outline" size="sm" onClick={handleCopyAll}>
                    {copiedAll ? (
                      <Check className="h-4 w-4 mr-2 text-green-500" />
                    ) : (
                      <Copy className="h-4 w-4 mr-2" />
                    )}
                    Copy All
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {viewMode === "tree" ? (
                <div className="overflow-auto max-h-[600px] border rounded-lg p-4 bg-muted/30">
                  <TreeNode node={result} depth={0} />
                </div>
              ) : (
                <pre className="overflow-auto max-h-[600px] border rounded-lg p-4 bg-muted/30 font-mono text-sm whitespace-pre">
                  {textOutput}
                </pre>
              )}

              {/* Legend */}
              <div className="mt-4 flex flex-wrap gap-4 text-xs text-muted-foreground">
                <span>
                  <span className="text-blue-600 dark:text-blue-400 font-medium">
                    Universal
                  </span>{" "}
                  tags
                </span>
                <span>
                  <span className="text-green-600 dark:text-green-400 font-medium">
                    [n]
                  </span>{" "}
                  Context-specific
                </span>
                <span>
                  <span className="text-purple-600 dark:text-purple-400 font-medium">
                    [APPLICATION n]
                  </span>
                </span>
                <span>[offset] (header+content length)</span>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Help Section */}
        {!result && !error && (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-12 text-muted-foreground">
              <FileText className="h-12 w-12 mb-4 opacity-50" />
              <p className="text-center">
                Paste ASN.1 data in PEM, hex, or base64 format to decode
              </p>
              <p className="text-center text-sm mt-2">
                Supports X.509 certificates, keys, PKCS#7, PKCS#8, and other
                ASN.1 structures
              </p>
            </CardContent>
          </Card>
        )}
      </div>
    </ToolPageWrapper>
  );
}

export default function ASN1DecoderPage() {
  return (
    <Suspense fallback={null}>
      <ASN1DecoderContent />
    </Suspense>
  );
}
