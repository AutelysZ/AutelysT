import type React from "react";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "XPath Evaluator - AutelysT",
  description:
    "Evaluate XPath expressions against XML or HTML and inspect node, string, number, or boolean results.",
  keywords: ["xpath", "xml", "html", "query", "evaluate", "parser"],
};

export default function XPathLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
