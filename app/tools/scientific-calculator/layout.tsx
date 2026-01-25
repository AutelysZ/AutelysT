import React from "react";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Scientific Calculator - AutelysT",
  description:
    "Free online scientific calculator with trigonometric, logarithmic, exponential functions, memory operations, and keyboard support. Supports DEG, RAD, and GRAD angle modes.",
};

export default function ScientificCalculatorLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
