import type React from "react";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "CIDR/IP Calculator - AutelysT",
  description:
    "Calculate IPv4 and IPv6 subnet ranges, netmasks, and host counts with quick inclusion checks.",
  keywords: [
    "cidr calculator",
    "ip calculator",
    "subnet calculator",
    "ipv4",
    "ipv6",
    "netmask",
    "broadcast",
    "host range",
  ],
};

export default function CidrIpCalculatorLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
