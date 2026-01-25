import type React from "react";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "UUID Generator/Parser - AutelysT",
  description:
    "Online UUID generator and parser for v1/v4/v6/v7 with timestamp and node/clock fields.",
  keywords: [
    "uuid",
    "uuid generator",
    "uuid parser",
    "guid",
    "v1",
    "v4",
    "v6",
    "v7",
    "timestamp",
  ],
};

export default function UUIDLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
