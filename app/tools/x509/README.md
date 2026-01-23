# X.509

Create, view, validate, and convert X.509 certificates in-browser.

## Features
- Create X.509 certificates with OpenSSL-style parameters (DN, validity, serial, key usage, SAN, extensions).
- View certificate details and extensions from PEM, DER (Base64), or PKCS#12 inputs.
- Validate certificates against time validity and optional CA bundles.
- Convert between PEM, DER (Base64), and PKCS#12; export bundled formats as a ZIP.

## Parameters
- Create: subject/issuer DN, key material, validity, serial, extensions, output formats.
- View: input format, optional password.
- Validate: input format, optional password, CA bundle.
- Convert: input format, optional password, output formats and PKCS#12 password.

## Usage
- Create certificates with common fields and custom extensions.
- Paste or upload certificates to view/validate/convert.
- Convert certificates to desired formats and download single files or a ZIP bundle.
- Use Clear to reset inputs and outputs.

## URL State
- Inputs and parameters sync to the URL query.
- Inputs over 2 KB are excluded with a warning.

## History
- URL params take precedence on load; otherwise restore the latest history entry.
- Input changes create valued history entries (debounced).
- Parameter changes create/update a valueless entry until input is generated or pasted.
