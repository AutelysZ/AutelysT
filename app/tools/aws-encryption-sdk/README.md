# AWS Encryption SDK Tool

A browser-based tool for encrypting and decrypting data using the AWS Encryption SDK for JavaScript. This tool supports Raw AES and Raw RSA keyrings, allowing you to perform cryptographic operations directly in your browser without sending keys or data to a server.

## Features

- **Raw Keyrings**: Support for Raw AES-GCM (128/192/256-bit) and Raw RSA (OAEP padding).
- **Client-Side Encryption**: All operations are performed locally using the WebCrypto API.
- **Encryption Context**: Support for adding key-value pairs as encryption context (AAD).
- **Auto-Decryption**: Automatically attempts to decrypt encrypted data when editing or pasting.
- **Key Management**: Generate keys, upload from file, or enter manually (PEM/JWK/Base64/Hex).
