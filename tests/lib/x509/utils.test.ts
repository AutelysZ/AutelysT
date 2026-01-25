import { describe, it, expect } from "vitest";
import forge from "node-forge";
import {
  parseDnString,
  normalizeSerialNumber,
  parseSanEntries,
  splitPemBlocks,
  parseCertificateInput,
  certificateToDerBase64,
} from "../../../lib/x509/utils";

describe("x509 utils", () => {
  it("parses DN strings with slash or comma format", () => {
    const slash = parseDnString("/C=US/ST=CA/O=Example/CN=example.com");
    const comma = parseDnString("C=US, ST=CA, O=Example, CN=example.com");
    expect(slash.length).toBe(4);
    expect(comma.length).toBe(4);
    expect(slash[3]).toMatchObject({
      name: "commonName",
      value: "example.com",
    });
  });

  it("normalizes serial numbers from hex or decimal", () => {
    expect(normalizeSerialNumber("0x0A")).toBe("0a");
    expect(normalizeSerialNumber("10")).toBe("0a");
    expect(normalizeSerialNumber("01")).toBe("01");
  });

  it("parses SAN entries with prefixes", () => {
    const altNames = parseSanEntries(
      "DNS:example.com\nIP:127.0.0.1\nemail:dev@example.com",
    );
    expect(altNames).toEqual([
      { type: 2, value: "example.com" },
      { type: 7, ip: "127.0.0.1" },
      { type: 1, value: "dev@example.com" },
    ]);
  });

  it("splits PEM certificate blocks", () => {
    const pem = [
      "-----BEGIN CERTIFICATE-----",
      "ABC",
      "-----END CERTIFICATE-----",
      "-----BEGIN CERTIFICATE-----",
      "DEF",
      "-----END CERTIFICATE-----",
    ].join("\n");
    const blocks = splitPemBlocks(pem, "CERTIFICATE");
    expect(blocks).toHaveLength(2);
  });

  it("parses PEM certificate input", () => {
    const keys = forge.pki.rsa.generateKeyPair(512);
    const cert = forge.pki.createCertificate();
    cert.publicKey = keys.publicKey;
    cert.serialNumber = "01";
    cert.validity.notBefore = new Date(Date.now() - 1000);
    cert.validity.notAfter = new Date(Date.now() + 1000 * 60);
    const attrs = [{ name: "commonName", value: "example.com" }];
    cert.setSubject(attrs);
    cert.setIssuer(attrs);
    cert.sign(keys.privateKey, forge.md.sha256.create());

    const pem = forge.pki.certificateToPem(cert);
    const parsed = parseCertificateInput(pem, "pem");
    expect(parsed.certs).toHaveLength(1);
  });

  it("converts certificates to DER base64", () => {
    const keys = forge.pki.rsa.generateKeyPair(512);
    const cert = forge.pki.createCertificate();
    cert.publicKey = keys.publicKey;
    cert.serialNumber = "01";
    cert.validity.notBefore = new Date(Date.now() - 1000);
    cert.validity.notAfter = new Date(Date.now() + 1000 * 60);
    const attrs = [{ name: "commonName", value: "example.com" }];
    cert.setSubject(attrs);
    cert.setIssuer(attrs);
    cert.sign(keys.privateKey, forge.md.sha256.create());

    const der = certificateToDerBase64(cert);
    expect(typeof der).toBe("string");
    expect(der.length).toBeGreaterThan(0);
  });
});
