import type React from "react";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Password Hash Generator & Verifier - AutelysT",
  description:
    "Generate, verify, and parse bcrypt, scrypt, and Argon2 hashes with full parameter control.",
  keywords: [
    "password hash",
    "bcrypt",
    "scrypt",
    "argon2",
    "verify password",
    "hash parser",
  ],
};

export default function PasswordHashLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
