import type React from "react";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "QR Code Generator - AutelysT",
  description:
    "Generate QR codes with custom size, colors, and error correction in the browser.",
  keywords: ["qr", "qr code", "generator", "barcode", "url"],
};

export default function QrCodeLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
