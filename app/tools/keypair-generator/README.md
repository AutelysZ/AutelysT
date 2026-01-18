# Keypair Generator

Generate public/private keypairs across RSA, EC, and OKP curves with algorithm-specific parameters. Export JWK for every curve, plus PEM when supported.

## Features
- RSA, ECDSA/ECDH, Schnorr, Ed25519/Ed448, and X25519/X448 keypair generation
- Curve selection including P-256/P-384/P-521, secp256k1, and Brainpool curves
- Algorithm-specific parameters (modulus length, exponent, hash, curve)
- Select key usages per algorithm
- Export JWK for all keys and PEM when available, with copy/download helpers and ZIP export

## Parameters
- Algorithm
- RSA modulus length, exponent, hash
- EC named curve (P-256/P-384/P-521, secp256k1, Brainpool)
- Key usages (sign/verify, encrypt/decrypt, derive, wrap/unwrap)

## URL State
- Parameters sync to the URL
- Generated keys (PEM/JWK) are not synced

## History
- Parameter changes update a valueless history entry
- Each Generate action stores the generated keys as a valued entry
