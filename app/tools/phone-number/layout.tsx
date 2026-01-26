import type React from "react";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Phone Number Parser - AutelysT",
  description:
    "Parse and build phone numbers with region defaults, formatting options, and JSON/table output.",
  keywords: [
    "phone number",
    "phone parser",
    "libphonenumber",
    "e164",
    "rfc3966",
    "format",
  ],
};

export default function PhoneNumberLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
