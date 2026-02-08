import type React from "react";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "JSONPath / JMESPath Evaluator - AutelysT",
  description:
    "Run JSONPath and JMESPath queries against JSON data and inspect the extracted output.",
  keywords: [
    "jsonpath",
    "jmespath",
    "json query",
    "json extraction",
    "api debugging",
  ],
};

export default function JsonpathJmespathLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
