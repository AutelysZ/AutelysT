import type React from "react";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "TOTP / HOTP Generator & Verifier - AutelysT",
  description:
    "Generate and verify TOTP/HOTP codes, build otpauth:// URIs, and create QR codes for authenticator apps.",
  keywords: [
    "totp",
    "hotp",
    "otp",
    "otpauth",
    "2fa",
    "mfa",
    "authenticator",
    "qr code",
  ],
};

export default function TotpHotpLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
