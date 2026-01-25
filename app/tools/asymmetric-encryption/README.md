# Asymmetric Encryption

Encrypt and decrypt messages with RSA-OAEP using PEM or JWK keys. Configure hash and encoding settings and generate keypairs in-browser.

## Features

- RSA-OAEP encryption and decryption with Web Crypto
- PEM (SPKI/PKCS8) and JWK key support
- In-browser RSA keypair generation
- Message and ciphertext encoding controls (UTF-8/Base64/Hex, Base64url)
- URL-synced inputs and parameters (output excluded)

## Parameters

- Mode (encrypt/decrypt)
- RSA hash, modulus length, public exponent
- Message encoding and ciphertext encoding
- Public/private key inputs with upload and generation

## Usage

- Encrypt: enter a message, select encodings, and provide a public key
- Decrypt: paste ciphertext, select encodings, and provide a private key

## URL State

- Inputs and parameters sync to the URL query
- Inputs over 2 KB are excluded with a warning
- Output is excluded from URL sync

## History

- Input edits create history entries
- Parameter changes update the latest entry
