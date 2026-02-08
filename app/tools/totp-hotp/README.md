# TOTP / HOTP

Generate and verify one-time passwords with RFC-compliant TOTP and HOTP workflows.

## Features

- Generate OTP codes with SHA1/SHA256/SHA512
- Verify tokens with configurable drift window
- Build and parse `otpauth://` URIs
- Generate QR codes for authenticator setup

## Parameters

- Mode, algorithm, digits, period/counter, verification window
- Issuer and account label
- Secret, token, and otpauth URI text

## Usage

- Paste or generate a Base32 secret
- Generate/verify a code
- Build URI and render QR for authenticator apps

## URL State

- Inputs/params sync with URL state (hash-based sharing)
- Large text inputs are excluded from compact URL state when needed

## History

- Input changes create debounced history entries
- Parameter changes update latest history params
- Loading history restores both inputs and parameters
