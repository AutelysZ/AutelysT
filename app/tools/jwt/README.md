# JWT

Parse, edit, and generate JSON Web Tokens (JWT).

## Features

- Dual-panel JWT editor with raw token and structured components
- Registered claim editor with timestamp picker to the second
- Signature validation with HMAC secrets and PEM keys (RSA/ECDSA/EdDSA)

## Parameters

- Token text
- Header fields (alg, typ, kid)
- Payload claims + extra JSON
- HMAC secret + encoding, or PEM/JWK public/private keys

## URL State

- Token syncs to URL when <= 2 KB
- Secret and secret encoding never sync to URL
- When token exists in URL, it is treated as the canonical input

## History

- Valued entries: token edits and successful Generate
- Right-side edits update a valueless entry only
- URL params take precedence on load; otherwise restore latest history
