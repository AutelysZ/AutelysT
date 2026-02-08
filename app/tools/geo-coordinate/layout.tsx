import type React from "react";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Geographic Coordinate Converter - AutelysT",
  description:
    "Parse map URLs and coordinates, convert between formats, and open locations in popular map platforms.",
  keywords: [
    "coordinate converter",
    "latitude longitude",
    "maps url",
    "geo uri",
    "dms",
    "ddm",
    "decimal degrees",
  ],
};

export default function GeoCoordinateLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
