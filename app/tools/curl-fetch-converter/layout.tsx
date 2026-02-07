import type React from "react";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "cURL / fetch Converter - AutelysT",
  description:
    "Convert cURL commands to fetch and generate cURL from fetch options in the browser.",
  keywords: ["curl", "fetch", "http", "converter", "request", "api"],
};

export default function CurlFetchConverterLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
