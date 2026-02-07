import type React from "react";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "SSH Key Tool - AutelysT",
  description:
    "Generate SSH keypairs, inspect fingerprints, and convert OpenSSH public keys to PEM and JWK.",
  keywords: [
    "ssh key",
    "ssh key generator",
    "openssh",
    "fingerprint",
    "pem",
    "jwk",
    "rsa",
    "ed25519",
    "ecdsa",
  ],
};

export default function SshKeyLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
