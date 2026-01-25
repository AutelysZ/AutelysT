import type React from "react";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Hex Escape Encoder/Decoder - AutelysT",
  description:
    "Online hex escape encoder/decoder for \xFF sequences with text encoding selection and case control.",
  keywords: [
    "hex escape",
    "encoder",
    "decoder",
    "byte escape",
    "string escape",
    "xFF",
  ],
};

export default function HexEscapeLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
