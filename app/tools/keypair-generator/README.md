# Keypair Generator

Generate public/private keypairs across RSA, EC, OKP, and post-quantum algorithms with algorithm-specific parameters. Export JWK for classical curves and PQC JSON for lattice/hash-based keys, plus PEM when supported.

## Features

- RSA, ECDSA/ECDH, Schnorr, Ed25519/Ed448, X25519/X448, plus ML-KEM, ML-DSA, SLH-DSA, and hybrid KEM keypair generation
- Curve selection including P-256/P-384/P-521, secp256k1, and Brainpool curves
- Algorithm-specific parameters (modulus length, exponent, hash, curve, PQC parameter sets)
- Select key usages per algorithm
- Export JWK for classical keys, PQC JSON for post-quantum keys, and PEM/DER (including raw DER in ZIP) when available, with copy helpers and ZIP export for all encodings

## Parameters

- Algorithm
- Post-quantum parameter sets (ML-KEM/ML-DSA/SLH-DSA/hybrid KEM)
- RSA modulus length, exponent, hash
- EC named curve (P-256/P-384/P-521, secp256k1, Brainpool)
- Key usages (sign/verify, encrypt/decrypt, derive, wrap/unwrap)

## URL State

- Parameters sync to the URL
- Generated keys (PEM/JWK) are not synced

## History

- Parameter changes update a valueless history entry
- Each Generate action stores the generated keys as a valued entry
