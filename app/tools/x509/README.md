# X.509

Create, view, validate, and convert X.509 certificates in-browser.

## Features
- Create X.509 certificates or certificate requests (CSR) with OpenSSL-style parameters (DN, key usage, SAN, extensions).
- Generate or upload RSA, EC (prime256v1, secp384r1, secp521r1, secp256k1, brainpool), Ed25519, and Ed448 keys (Create PKCS#12 output requires RSA; CSR supports RSA/EC/DSA).
- Accept DSA and DH keys for certificate creation (provided keys only).
- View certificate details and extensions from PEM, DER (Base64), or PKCS#12 inputs.
- Validate certificates against time validity and optional CA bundles.
- Convert between PEM, DER (Base64), and PKCS#12 with any key type (PKCS#12 output requires a private key).

## Parameters
- Create: output type (certificate/CSR), subject/issuer DN, key type and material, validity, serial, extensions, output formats.
- View: input format, optional password.
- Validate: input format, optional password, CA bundle.
- Convert: input format, optional password, output formats and PKCS#12 password.

## Usage
- Create certificates with common fields and custom extensions.
- Paste or upload certificates to view/validate/convert.
- Convert certificates to desired formats and download single files or a ZIP bundle.
- Use Clear to reset inputs and outputs.
- Private keys accept PEM, DER (Base64), or JWK JSON input.
- DSA and DH require provided keys; DH cannot self-sign certificates.

## URL State
- The URL syncs only non-certificate, non-key, and non-password parameters.
- Initial render applies only the `tab` parameter; URL values are merged on load.

## History
- All inputs and parameters persist in a single hidden entry (updated in place).
- URL params take precedence on load and are merged with the latest history values.
- Clear removes the entry and resets URL state (except `tab`).
