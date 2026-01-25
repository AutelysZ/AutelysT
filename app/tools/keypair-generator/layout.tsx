import type React from "react";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Keypair Generator - AutelysT",
  description:
    "Online keypair generator for RSA, EC, OKP, and post-quantum keys (ML-KEM/ML-DSA/SLH-DSA, hybrid KEM) with PEM/JWK export.",
  keywords: [
    "keypair generator",
    "rsa",
    "ecdsa",
    "ecdh",
    "schnorr",
    "secp256k1",
    "brainpool",
    "eddsa",
    "x25519",
    "x448",
    "ml-kem",
    "ml-dsa",
    "slh-dsa",
    "kyber",
    "dilithium",
    "sphincs",
    "xwing",
    "post-quantum",
    "jwk",
    "pem",
  ],
};

export default function KeypairGeneratorLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
