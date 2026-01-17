# Keypair Generator

Generate public/private keypairs using Web Crypto with algorithm-specific parameters. Export both PEM and JWK formats with copy and download helpers.

## Features
- RSA, ECDSA, ECDH, and Ed/X keypair generation
- Algorithm-specific parameters (modulus length, exponent, hash, curves)
- Select key usages per algorithm
- Export PEM + JWK, copy/download each, download all as ZIP

## Parameters
- Algorithm
- RSA modulus length, exponent, hash
- EC named curve
- Key usages (sign/verify, encrypt/decrypt, derive, wrap/unwrap)

## URL State
- Parameters sync to the URL
- Generated keys (PEM/JWK) are not synced

## History
- Parameter changes update a valueless history entry
- Each Generate action stores the generated keys as a valued entry
