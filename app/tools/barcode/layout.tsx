import type React from "react";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Barcode Generator - AutelysT",
  description:
    "Generate barcodes in multiple formats with custom styles and downloads.",
  keywords: ["barcode", "generator", "code128", "ean13", "upc"],
};

export default function BarcodeLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
