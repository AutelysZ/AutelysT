import type React from "react";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "License Generator - AutelysT",
  description:
    "Pick a software license with a guided questionnaire and generate ready-to-use license text.",
  keywords: [
    "license generator",
    "software license",
    "spdx",
    "mit license",
    "apache 2.0",
    "gpl",
    "agpl",
    "lgpl",
    "mpl",
    "bsd",
  ],
};

export default function LicenseGeneratorLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
