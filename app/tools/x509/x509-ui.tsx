"use client";

import * as React from "react";
import { Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { TabsList } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";

export type ViewSummary = {
  kind: "certificate" | "csr";
  subject: string;
  issuer?: string;
  serial?: string;
  notBefore?: string;
  notAfter?: string;
  isCa?: boolean;
  fingerprintSha256: string;
  signatureAlgorithm?: string;
  publicKeyAlgorithm?: string;
  extensions: string;
};

export function InfoRow({
  label,
  value,
  mono,
}: {
  label: string;
  value: string;
  mono?: boolean;
}) {
  return (
    <div className="flex flex-col gap-1">
      <span className="text-xs text-muted-foreground">{label}</span>
      <span className={cn("text-sm break-all", mono && "font-mono")}>
        {value}
      </span>
    </div>
  );
}

export function ScrollableTabsList({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("min-w-0 flex-1", className)}>
      <TabsList className="inline-flex h-auto max-w-full flex-wrap items-center justify-start gap-1 [&_[data-slot=tabs-trigger]]:flex-none [&_[data-slot=tabs-trigger]]:!text-sm [&_[data-slot=tabs-trigger][data-state=active]]:border-border">
        {children}
      </TabsList>
    </div>
  );
}

export function StatusRow({
  label,
  ok,
}: {
  label: string;
  ok: boolean | null;
}) {
  const text = ok === null ? "Not checked" : ok ? "Pass" : "Fail";
  const color =
    ok === null
      ? "text-muted-foreground"
      : ok
        ? "text-emerald-600"
        : "text-destructive";
  return (
    <div className="flex items-center justify-between rounded-md border px-3 py-2 text-sm">
      <span>{label}</span>
      <span className={color}>{text}</span>
    </div>
  );
}

export function UploadButton({
  accept,
  onChange,
  label = "Upload",
}: {
  accept?: string;
  onChange: (event: React.ChangeEvent<HTMLInputElement>) => void;
  label?: string;
}) {
  const inputRef = React.useRef<HTMLInputElement | null>(null);

  const handleClick = React.useCallback(() => {
    inputRef.current?.click();
  }, []);

  const handleChange = React.useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      onChange(event);
      if (inputRef.current) {
        inputRef.current.value = "";
      }
    },
    [onChange],
  );

  return (
    <>
      <input
        ref={inputRef}
        type="file"
        accept={accept}
        className="hidden"
        onChange={handleChange}
      />
      <Button
        type="button"
        variant="ghost"
        size="sm"
        onClick={handleClick}
        className="gap-2"
      >
        <Upload className="h-4 w-4" />
        {label}
      </Button>
    </>
  );
}

export function buildViewSummary(forge: any, cert: any): ViewSummary {
  const subject = formatDn(cert.subject?.attributes ?? []);
  const issuer = formatDn(cert.issuer?.attributes ?? []);
  const serial = cert.serialNumber ?? "";
  const notBefore = cert.validity?.notBefore?.toISOString?.() ?? "";
  const notAfter = cert.validity?.notAfter?.toISOString?.() ?? "";
  const isCa = Boolean(
    cert.extensions?.find((ext: any) => ext.name === "basicConstraints")?.cA,
  );

  const asn1 = forge.pki.certificateToAsn1(cert);
  const der = forge.asn1.toDer(asn1).getBytes();
  const sha256 = forge.md.sha256.create();
  sha256.update(der);

  return {
    kind: "certificate",
    subject,
    issuer,
    serial,
    notBefore,
    notAfter,
    isCa,
    fingerprintSha256: sha256.digest().toHex(),
    extensions: JSON.stringify(cert.extensions ?? [], null, 2),
  };
}

export function formatDn(
  attributes: Array<{
    shortName?: string;
    name?: string;
    type?: string;
    value?: string;
  }>,
) {
  return attributes
    .map((attr) => {
      const label = attr.shortName || attr.name || attr.type || "attr";
      return `${label}=${attr.value ?? ""}`;
    })
    .join(", ");
}
