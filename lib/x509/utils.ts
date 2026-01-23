import forge from "node-forge"

export type X509InputFormat = "pem" | "der" | "pkcs12"

export type DnAttribute = {
  name?: string
  shortName?: string
  type?: string
  value: string
}

const DN_KEY_MAP: Record<string, { name?: string; shortName?: string }> = {
  CN: { name: "commonName" },
  C: { name: "countryName" },
  ST: { name: "stateOrProvinceName" },
  L: { name: "localityName" },
  O: { name: "organizationName" },
  OU: { name: "organizationalUnitName" },
  E: { name: "emailAddress" },
  EMAIL: { name: "emailAddress" },
  EMAILADDRESS: { name: "emailAddress" },
  UID: { name: "userId" },
  DC: { name: "domainComponent" },
  SN: { name: "surname" },
  GIVENNAME: { name: "givenName" },
  TITLE: { name: "title" },
}

export function parseDnString(input: string): DnAttribute[] {
  const trimmed = input.trim()
  if (!trimmed) return []

  const parts = trimmed.startsWith("/")
    ? trimmed.split("/").slice(1)
    : trimmed.split(",")

  const attributes: DnAttribute[] = []

  for (const rawPart of parts) {
    const part = rawPart.trim()
    if (!part) continue
    const eqIndex = part.indexOf("=")
    if (eqIndex === -1) continue
    const key = part.slice(0, eqIndex).trim()
    const value = part.slice(eqIndex + 1).trim()
    if (!key || !value) continue

    const upperKey = key.toUpperCase()
    const mapped = DN_KEY_MAP[upperKey]
    if (mapped) {
      attributes.push({ ...mapped, value })
      continue
    }

    if (/^\d+(\.\d+)+$/.test(key)) {
      attributes.push({ type: key, value })
      continue
    }

    attributes.push({ name: key, value })
  }

  return attributes
}

export function normalizeSerialNumber(input: string): string {
  const raw = input.trim()
  if (!raw) return "01"

  let hex = raw
  const isPrefixedHex = hex.startsWith("0x") || hex.startsWith("0X")
  if (isPrefixedHex) {
    hex = hex.slice(2)
  }

  if (/^\d+$/.test(hex) && !isPrefixedHex) {
    hex = BigInt(hex).toString(16)
  } else if (/^[0-9a-fA-F]+$/.test(hex)) {
    hex = hex.toLowerCase()
  } else {
    throw new Error("Serial number must be hex or decimal.")
  }

  if (hex.length % 2 === 1) {
    hex = `0${hex}`
  }

  return hex
}

export function parseSanEntries(input: string) {
  const entries = input
    .split(/\r?\n|,/)
    .map((entry) => entry.trim())
    .filter(Boolean)

  return entries.map((entry) => {
    const [prefix, ...rest] = entry.split(":")
    const value = rest.length ? rest.join(":").trim() : prefix
    const upperPrefix = rest.length ? prefix.trim().toUpperCase() : "DNS"

    switch (upperPrefix) {
      case "DNS":
        return { type: 2, value }
      case "IP":
        return { type: 7, ip: value }
      case "URI":
        return { type: 6, value }
      case "EMAIL":
      case "E":
        return { type: 1, value }
      case "RID":
        return { type: 8, oid: value }
      default:
        return { type: 2, value: entry }
    }
  })
}

export function splitPemBlocks(pem: string, label: string): string[] {
  const regex = new RegExp(`-----BEGIN ${label}-----[\\s\\S]+?-----END ${label}-----`, "g")
  const matches = pem.match(regex)
  return matches ? matches.map((block) => block.trim()) : []
}

export function parseCertificatesFromPem(pem: string) {
  const blocks = splitPemBlocks(pem, "CERTIFICATE")
  return blocks.map((block) => forge.pki.certificateFromPem(block))
}

export function parseCertificateInput(
  input: string,
  format: X509InputFormat,
  password?: string,
): { certs: any[]; privateKey?: any } {
  if (!input.trim()) {
    throw new Error("Certificate input is empty.")
  }

  if (format === "pem") {
    const certs = parseCertificatesFromPem(input)
    if (!certs.length) {
      throw new Error("No certificates found in PEM input.")
    }
    return { certs }
  }

  const raw = input.replace(/\s+/g, "")
  const der = forge.util.decode64(raw)
  const asn1 = forge.asn1.fromDer(der)

  if (format === "der") {
    return { certs: [forge.pki.certificateFromAsn1(asn1)] }
  }

  const p12 = forge.pkcs12.pkcs12FromAsn1(asn1, false, password ?? "")
  const certBags = p12.getBags({ bagType: forge.pki.oids.certBag })[forge.pki.oids.certBag] || []
  const certs = certBags.map((bag: any) => bag.cert).filter(Boolean)

  const keyBags =
    p12.getBags({ bagType: forge.pki.oids.pkcs8ShroudedKeyBag })[forge.pki.oids.pkcs8ShroudedKeyBag] || []
  const keyBag = keyBags[0]
  const privateKey = keyBag?.key

  if (!certs.length) {
    throw new Error("No certificates found in PKCS#12 input.")
  }

  return { certs, privateKey }
}

export function certificateToPem(cert: any) {
  return forge.pki.certificateToPem(cert)
}

export function certificateToDerBase64(cert: any) {
  const asn1 = forge.pki.certificateToAsn1(cert)
  const der = forge.asn1.toDer(asn1).getBytes()
  return forge.util.encode64(der)
}

export function createPkcs12Base64(cert: any, privateKey: any, password: string) {
  const asn1 = forge.pkcs12.toPkcs12Asn1(privateKey, cert, password, { algorithm: "3des" })
  const der = forge.asn1.toDer(asn1).getBytes()
  return forge.util.encode64(der)
}
