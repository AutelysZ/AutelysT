import type React from "react";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "CUID2 Generator & Validator - AutelysT",
  description:
    "Generate and validate CUID2 identifiers with customizable length and fingerprint settings.",
  keywords: [
    "cuid2",
    "id",
    "identifier",
    "generator",
    "validator",
    "collision resistant",
  ],
};

export default function Cuid2Layout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
