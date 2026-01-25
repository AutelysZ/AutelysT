import type React from "react";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Time Zone Converter - AutelysT",
  description:
    "Online time zone converter with IANA zones and Unix epoch support in seconds, milliseconds, microseconds, and nanoseconds.",
  keywords: [
    "time zone converter",
    "timezone",
    "unix timestamp",
    "epoch",
    "utc",
    "iana",
  ],
};

export default function TimezoneLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
