import type { Tool, ToolCategory } from "./types"

export type { Tool, ToolCategory }

export const tools: Tool[] = [
  // Encoding Tools
  {
    id: "base64",
    name: "Base64",
    description: "Encode and decode Base64 with URL-safe mode, MIME line breaks, 100+ text encodings, and file input.",
    category: "Encoding",
    route: "/tools/base64",
    keywords: ["base64", "encode", "decode", "binary", "text", "file"],
    seo: {
      title: "Base64 Encoder/Decoder - AutelysT",
      description:
        "Online Base64 encoder/decoder with URL-safe mode, MIME line breaks, 100+ text encodings, and file input.",
      keywords: ["base64", "encoder", "decoder", "url-safe", "mime", "text encoding", "file to base64"],
    },
  },
  {
    id: "base58",
    name: "Base58",
    description: "Encode and decode Base58 for Bitcoin/IPFS with raw byte file support.",
    category: "Encoding",
    route: "/tools/base58",
    keywords: ["base58", "encode", "decode", "bitcoin", "cryptocurrency"],
    seo: {
      title: "Base58 Encoder/Decoder - AutelysT",
      description: "Online Base58 encoder/decoder for Bitcoin and IPFS with raw byte file support.",
      keywords: ["base58", "encoder", "decoder", "bitcoin", "ipfs", "binary"],
    },
  },
  {
    id: "base45",
    name: "Base45",
    description: "Encode and decode Base45 for QR payloads and EU Digital COVID Certificates.",
    category: "Encoding",
    route: "/tools/base45",
    keywords: ["base45", "encode", "decode", "qr", "covid", "certificate"],
    seo: {
      title: "Base45 Encoder/Decoder - AutelysT",
      description: "Online Base45 encoder/decoder for QR payloads and EU Digital COVID Certificates.",
      keywords: ["base45", "encoder", "decoder", "qr", "digital covid certificate", "dcc"],
    },
  },
  {
    id: "base36",
    name: "Base36",
    description: "Encode and decode Base36 with text encoding selection, case control, and file input.",
    category: "Encoding",
    route: "/tools/base36",
    keywords: ["base36", "encode", "decode", "alphanumeric"],
    seo: {
      title: "Base36 Encoder/Decoder - AutelysT",
      description: "Online Base36 encoder/decoder with text encoding selection, case control, and file input.",
      keywords: ["base36", "encoder", "decoder", "alphanumeric", "text encoding", "case"],
    },
  },
  {
    id: "base32",
    name: "Base32",
    description: "Encode and decode Base32 with text encoding selection, case control, and file input.",
    category: "Encoding",
    route: "/tools/base32",
    keywords: ["base32", "encode", "decode", "totp", "2fa"],
    seo: {
      title: "Base32 Encoder/Decoder - AutelysT",
      description: "Online Base32 encoder/decoder for TOTP and file systems with text encoding selection and file input.",
      keywords: ["base32", "encoder", "decoder", "totp", "2fa", "text encoding"],
    },
  },
  {
    id: "hex",
    name: "Hex (Base16)",
    description: "Encode and decode hex (Base16) with text encoding selection, case control, and file input.",
    category: "Encoding",
    route: "/tools/hex",
    keywords: ["hex", "hexadecimal", "base16", "encode", "decode"],
    seo: {
      title: "Hex (Base16) Encoder/Decoder - AutelysT",
      description: "Online hex (Base16) encoder/decoder with text encoding selection, case control, and file input.",
      keywords: ["hex", "hexadecimal", "base16", "encoder", "decoder", "text encoding", "hex to text"],
    },
  },
  {
    id: "hex-escape",
    name: "Hex Escape",
    description: "Encode and decode hex escape sequences (\\xFF) with text encoding selection and case control.",
    category: "Encoding",
    route: "/tools/hex-escape",
    keywords: ["hex", "escape", "encode", "decode", "byte"],
    seo: {
      title: "Hex Escape Encoder/Decoder - AutelysT",
      description: "Online hex escape encoder/decoder for \\xFF sequences with text encoding selection and case control.",
      keywords: ["hex escape", "encoder", "decoder", "byte escape", "string escape", "xFF"],
    },
  },
  // Crypto Tools
  {
    id: "password-generator",
    name: "Password Generator",
    description: "Generate secure passwords with Graphic ASCII and base encodings, plus length presets.",
    category: "Crypto",
    route: "/tools/password-generator",
    keywords: ["password", "generator", "random", "secure", "ascii", "base64", "base58", "base45", "base32", "hex"],
    seo: {
      title: "Password Generator - AutelysT",
      description:
        "Online password generator with Graphic ASCII, Base64/58/45/32/Hex formats, length presets, and one-click copy.",
      keywords: [
        "password generator",
        "secure password",
        "ascii",
        "base64",
        "base58",
        "base45",
        "base32",
        "hex",
        "length preset",
      ],
    },
  },
  {
    id: "keypair-generator",
    name: "Keypair Generator",
    description:
      "Generate RSA, EC, OKP, and post-quantum keypairs (ML-KEM/ML-DSA/SLH-DSA, hybrid KEM) with usage controls and PEM/JWK export.",
    category: "Crypto",
    route: "/tools/keypair-generator",
    keywords: [
      "keypair",
      "rsa",
      "ecdsa",
      "ecdh",
      "schnorr",
      "secp256k1",
      "brainpool",
      "ed25519",
      "ed448",
      "x25519",
      "x448",
      "ml-kem",
      "ml-dsa",
      "slh-dsa",
      "kyber",
      "dilithium",
      "sphincs",
      "xwing",
      "pqc",
      "jwk",
      "pem",
      "web crypto",
    ],
    seo: {
      title: "Keypair Generator - AutelysT",
      description:
        "Online keypair generator for RSA, EC, OKP, and post-quantum keys (ML-KEM/ML-DSA/SLH-DSA, hybrid KEM) with PEM/JWK export.",
      keywords: [
        "keypair generator",
        "rsa",
        "ecdsa",
        "ecdh",
        "schnorr",
        "secp256k1",
        "brainpool",
        "eddsa",
        "x25519",
        "x448",
        "ml-kem",
        "ml-dsa",
        "slh-dsa",
        "kyber",
        "dilithium",
        "sphincs",
        "xwing",
        "post-quantum",
        "jwk",
        "pem",
        "web crypto",
      ],
    },
  },
  {
    id: "key-exchange",
    name: "Key Exchange",
    description:
      "Derive shared secrets with ECDH, X25519/X448, or post-quantum KEMs (ML-KEM/hybrid) plus optional HKDF/PBKDF2 derivation.",
    category: "Crypto",
    route: "/tools/key-exchange",
    keywords: [
      "key exchange",
      "ecdh",
      "secp256k1",
      "schnorr",
      "x25519",
      "x448",
      "shared secret",
      "ml-kem",
      "kyber",
      "xwing",
      "post-quantum",
      "pqc",
      "hkdf",
      "pbkdf2",
      "pem",
      "jwk",
    ],
    seo: {
      title: "Key Exchange (ECDH/X25519) - AutelysT",
      description:
        "Online key exchange tool for ECDH, X25519/X448, and ML-KEM/hybrid KEM with optional HKDF/PBKDF2 outputs.",
      keywords: [
        "key exchange",
        "ecdh",
        "secp256k1",
        "schnorr",
        "x25519",
        "x448",
        "shared secret",
        "ml-kem",
        "kyber",
        "xwing",
        "post-quantum",
        "pqc",
        "hkdf",
        "pbkdf2",
        "pem",
        "jwk",
      ],
    },
  },
  {
    id: "key-derivation",
    name: "Key Derivation",
    description: "Derive keys with HKDF or PBKDF2 using configurable hash, salt, and output length.",
    category: "Crypto",
    route: "/tools/key-derivation",
    keywords: ["key derivation", "hkdf", "pbkdf2", "salt", "hash", "derived key", "base64", "hex"],
    seo: {
      title: "Key Derivation (HKDF/PBKDF2) - AutelysT",
      description:
        "Online key derivation tool with HKDF and PBKDF2, flexible encodings, and configurable salt and output length.",
      keywords: ["key derivation", "hkdf", "pbkdf2", "salt", "hash", "derived key", "base64", "hex"],
    },
  },
  {
    id: "key-extractor",
    name: "Key Extractor",
    description: "Parse and convert PEM, JWK, and DER keys with algorithm detection, key details, and downloads.",
    category: "Crypto",
    route: "/tools/key-extractor",
    keywords: ["key extractor", "key parser", "pem", "jwk", "der", "key converter", "rsa", "ec", "okp"],
    seo: {
      title: "Key Extractor (PEM/JWK/DER) - AutelysT",
      description:
        "Online key extractor to parse and convert PEM, JWK, and DER keys with algorithm detection, key parameter details, and downloads.",
      keywords: ["key extractor", "pem", "jwk", "der", "key conversion", "rsa", "ec", "okp", "key parameters"],
    },
  },
  {
    id: "jwt",
    name: "JWT",
    description: "Parse, edit, and generate JSON Web Tokens with claims editing and signature validation.",
    category: "Crypto",
    route: "/tools/jwt",
    keywords: ["jwt", "json web token", "token", "claims", "signature", "hmac"],
    seo: {
      title: "JWT Parser/Generator - AutelysT",
      description:
        "Online JWT parser and generator with claims editor, HMAC/PEM signature validation, and header/payload editing.",
      keywords: ["jwt", "json web token", "jwt parser", "jwt generator", "claims", "signature", "hmac", "rsa", "ecdsa"],
    },
  },
  {
    id: "signature",
    name: "Signature",
    description: "Sign and verify messages with HMAC, RSA, ECDSA, EdDSA, Schnorr, ML-DSA, and SLH-DSA.",
    category: "Crypto",
    route: "/tools/signature",
    keywords: [
      "signature",
      "sign",
      "verify",
      "hmac",
      "rsa",
      "ecdsa",
      "eddsa",
      "schnorr",
      "secp256k1",
      "brainpool",
      "ed25519",
      "ed448",
      "ml-dsa",
      "slh-dsa",
      "dilithium",
      "sphincs",
      "pqc",
      "post-quantum",
      "pem",
      "jwk",
    ],
    seo: {
      title: "Signature Generator/Verifier - AutelysT",
      description:
        "Online signature tool for HMAC, RSA, ECDSA, EdDSA, Schnorr, ML-DSA, and SLH-DSA with PEM/JWK/PQC JSON support.",
      keywords: [
        "signature",
        "sign",
        "verify",
        "hmac",
        "rsa",
        "ecdsa",
        "eddsa",
        "schnorr",
        "secp256k1",
        "brainpool",
        "ed25519",
        "ed448",
        "ml-dsa",
        "slh-dsa",
        "dilithium",
        "sphincs",
        "pqc",
        "post-quantum",
        "pem",
        "jwk",
      ],
    },
  },
  {
    id: "asymmetric-encryption",
    name: "Asymmetric Encryption",
    description: "Encrypt and decrypt with RSA-OAEP using PEM/JWK keys and configurable hashing.",
    category: "Crypto",
    route: "/tools/asymmetric-encryption",
    keywords: ["asymmetric", "encrypt", "decrypt", "rsa-oaep", "public key", "private key", "pem", "jwk"],
    seo: {
      title: "Asymmetric Encryption (RSA-OAEP) - AutelysT",
      description: "Online RSA-OAEP encryption/decryption with PEM/JWK keys, configurable hash, and keypair generation.",
      keywords: [
        "asymmetric encryption",
        "rsa-oaep",
        "public key encryption",
        "private key decryption",
        "pem",
        "jwk",
        "keypair",
        "web crypto",
      ],
    },
  },
  {
    id: "hybrid-encryption",
    name: "Hybrid Encryption",
    description: "Encrypt and decrypt with CMS, OpenPGP, JWE, or HPKE using modern hybrid encryption standards.",
    category: "Crypto",
    route: "/tools/hybrid-encryption",
    keywords: ["hybrid encryption", "cms", "pkcs7", "openpgp", "jwe", "hpke", "encrypt", "decrypt", "a256gcm"],
    seo: {
      title: "Hybrid Encryption (CMS/OpenPGP/JWE/HPKE) - AutelysT",
      description:
        "Online hybrid encryption tool supporting CMS, OpenPGP, JWE, and HPKE with in-browser encrypt/decrypt flows.",
      keywords: [
        "hybrid encryption",
        "cms",
        "pkcs7",
        "openpgp",
        "jwe",
        "hpke",
        "encrypt",
        "decrypt",
        "key management",
      ],
    },
  },
  {
    id: "hash-generator",
    name: "Hash",
    description: "Generate cryptographic hash digests from text or files with MD, SHA, SHA-3, and BLAKE.",
    category: "Crypto",
    route: "/tools/hash-generator",
    keywords: ["hash", "digest", "checksum", "md5", "sha", "sha3", "blake"],
    seo: {
      title: "Hash Generator - AutelysT",
      description:
        "Online hash generator with MD2/MD4/MD5, SHA-1/2/3, and BLAKE2/3 plus hex/base64 outputs and file support.",
      keywords: [
        "hash generator",
        "digest",
        "md5",
        "sha256",
        "sha3",
        "blake2",
        "blake3",
        "checksum",
        "file hash",
      ],
    },
  },
  {
    id: "non-crypto-hash",
    name: "Non-Crypto Hash",
    description:
      "Generate non-cryptographic hashes with MurmurHash, xxHash, CityHash/FarmHash, SipHash, SpookyHash, HighwayHash, FNV, and CRC32.",
    category: "Crypto",
    route: "/tools/non-crypto-hash",
    keywords: [
      "non-crypto hash",
      "murmurhash",
      "xxhash",
      "cityhash",
      "farmhash",
      "siphash",
      "spookyhash",
      "highwayhash",
      "fnv",
      "crc32",
    ],
    seo: {
      title: "Non-Crypto Hash Generator - AutelysT",
      description:
        "Online non-cryptographic hash generator covering MurmurHash, xxHash, CityHash/FarmHash, SipHash, SpookyHash, HighwayHash, FNV, and CRC32.",
      keywords: [
        "non-crypto hash",
        "murmurhash",
        "xxhash",
        "cityhash",
        "farmhash",
        "siphash",
        "spookyhash",
        "highwayhash",
        "fnv",
        "crc32",
      ],
    },
  },
  {
    id: "symmetric-encryption",
    name: "Symmetric Encryption",
    description: "Encrypt and decrypt with AES, ChaCha20, Salsa20, Twofish, Blowfish, DES/3DES, plus key derivation.",
    category: "Crypto",
    route: "/tools/symmetric-encryption",
    keywords: ["symmetric", "encrypt", "decrypt", "aes", "chacha20", "salsa20", "twofish", "blowfish", "des", "3des"],
    seo: {
      title: "Symmetric Encryption - AutelysT",
      description:
        "Online symmetric encryption tool supporting AES (GCM), ChaCha20-Poly1305, Salsa20, Twofish, Blowfish, DES, and 3DES with PBKDF2/HKDF.",
      keywords: [
        "symmetric encryption",
        "decrypt",
        "aes",
        "chacha20",
        "salsa20",
        "twofish",
        "blowfish",
        "des",
        "3des",
        "pbkdf2",
        "hkdf",
      ],
    },
  },
  // Identifier Tools
  {
    id: "uuid",
    name: "UUID",
    description: "Generate and parse UUIDs v1/v4/v6/v7 with timestamp and field extraction.",
    category: "Identifier",
    route: "/tools/uuid",
    keywords: ["uuid", "guid", "generate", "parse", "v1", "v4", "v6", "v7", "timestamp"],
    seo: {
      title: "UUID Generator/Parser - AutelysT",
      description: "Online UUID generator and parser for v1/v4/v6/v7 with timestamp and node/clock fields.",
      keywords: ["uuid", "uuid generator", "uuid parser", "guid", "v1", "v4", "v6", "v7", "timestamp"],
    },
  },
  {
    id: "ulid",
    name: "ULID",
    description: "Generate and parse ULIDs with timestamp and randomness extraction.",
    category: "Identifier",
    route: "/tools/ulid",
    keywords: ["ulid", "generate", "parse", "sortable", "timestamp", "unique"],
    seo: {
      title: "ULID Generator/Parser - AutelysT",
      description: "Online ULID generator and parser with timestamp and randomness extraction.",
      keywords: ["ulid", "ulid generator", "ulid parser", "sortable identifier", "timestamp"],
    },
  },
  {
    id: "ksuid",
    name: "KSUID",
    description: "Generate and parse KSUIDs with timestamp and payload extraction.",
    category: "Identifier",
    route: "/tools/ksuid",
    keywords: ["ksuid", "generate", "parse", "sortable", "timestamp", "unique"],
    seo: {
      title: "KSUID Generator/Parser - AutelysT",
      description: "Online KSUID generator and parser with timestamp and payload extraction.",
      keywords: ["ksuid", "ksuid generator", "ksuid parser", "sortable identifier", "timestamp"],
    },
  },
  {
    id: "objectid",
    name: "BSON ObjectID",
    description: "Generate and parse MongoDB BSON ObjectIDs with timestamp and machine fields.",
    category: "Identifier",
    route: "/tools/objectid",
    keywords: ["objectid", "mongodb", "bson", "generate", "parse", "timestamp"],
    seo: {
      title: "BSON ObjectID Generator/Parser - AutelysT",
      description: "Online BSON ObjectID generator and parser with timestamp, machine ID, and counter fields.",
      keywords: ["objectid", "bson", "mongodb", "objectid generator", "objectid parser", "timestamp"],
    },
  },
  {
    id: "snowflake-id",
    name: "Snowflake ID",
    description: "Generate and parse Twitter Snowflake IDs with timestamp and node fields.",
    category: "Identifier",
    route: "/tools/snowflake-id",
    keywords: ["snowflake", "snowflake id", "twitter", "generate", "parse", "timestamp", "datacenter", "worker"],
    seo: {
      title: "Snowflake ID Generator/Parser - AutelysT",
      description:
        "Online Snowflake ID generator and parser with timestamp decoding, datacenter ID, worker ID, and sequence.",
      keywords: [
        "snowflake id",
        "snowflake generator",
        "snowflake parser",
        "twitter snowflake",
        "timestamp",
        "datacenter",
        "worker",
        "sequence",
      ],
    },
  },
  // Number Tools
  {
    id: "radix",
    name: "Base Conversion",
    description: "Convert numbers between bases including binary, octal, decimal, hex, base60, and custom.",
    category: "Numbers",
    route: "/tools/radix",
    keywords: ["radix", "base", "convert", "binary", "octal", "decimal", "hex", "base60"],
    seo: {
      title: "Base Converter (Radix) - AutelysT",
      description:
        "Online base converter for binary, octal, decimal, hex, base60, and custom radixes with padding and case options.",
      keywords: [
        "base converter",
        "radix converter",
        "binary",
        "octal",
        "decimal",
        "hexadecimal",
        "base60",
        "custom base",
      ],
    },
  },
  {
    id: "number-format",
    name: "Number Format",
    description: "Convert number formats including grouping, Chinese numerals, Roman numerals, and scientific notation.",
    category: "Numbers",
    route: "/tools/number-format",
    keywords: ["number", "format", "thousand", "separator", "chinese", "roman", "scientific"],
    seo: {
      title: "Number Format Converter - AutelysT",
      description:
        "Online number format converter for Chinese numerals, Roman numerals, scientific/engineering notation, and grouping.",
      keywords: [
        "number format",
        "chinese numerals",
        "roman numerals",
        "scientific notation",
        "engineering notation",
        "thousand separator",
      ],
    },
  },
  // Date & Time Tools
  {
    id: "timezone",
    name: "Time Zone Converter",
    description: "Convert times between IANA time zones with Unix epoch support (s/ms/us/ns).",
    category: "Date & Time",
    route: "/tools/timezone",
    keywords: ["timezone", "time", "date", "convert", "epoch", "unix", "utc", "iana"],
    seo: {
      title: "Time Zone Converter - AutelysT",
      description:
        "Online time zone converter with IANA zones and Unix epoch support in seconds, milliseconds, microseconds, and nanoseconds.",
      keywords: ["time zone converter", "timezone", "unix timestamp", "epoch", "utc", "iana"],
    },
  },
  {
    id: "world-clock",
    name: "World Clock",
    description: "Track multiple time zones with live updates or a custom reference time.",
    category: "Date & Time",
    route: "/tools/world-clock",
    keywords: ["world clock", "time zone", "time", "date", "global"],
    seo: {
      title: "World Clock - AutelysT",
      description: "Online world clock with multiple time zones, live updates, and custom reference time.",
      keywords: ["world clock", "time zone", "global time", "live clock", "time zones"],
    },
  },
  // Web Tools
  {
    id: "html-encoder",
    name: "HTML Encoder/Decoder",
    description: "Encode text to HTML entities and decode entities back to text with two-way editing.",
    category: "Web",
    route: "/tools/html-encoder",
    keywords: ["html", "encode", "decode", "entities", "escape", "unescape"],
    seo: {
      title: "HTML Encoder/Decoder - AutelysT",
      description: "Online HTML encoder/decoder with two-way editing and entity escape/unescape.",
      keywords: ["html encoder", "html decoder", "html entities", "escape", "unescape"],
    },
  },
  {
    id: "url-encode",
    name: "URL Encoder/Decoder",
    description: "Encode and decode URL strings with detailed parsing of components and query/hash params.",
    category: "Web",
    route: "/tools/url-encode",
    keywords: ["url", "encode", "decode", "percent", "uri", "query", "parser", "search params", "hash"],
    seo: {
      title: "URL Encoder/Decoder - AutelysT",
      description:
        "Online URL encoder/decoder with detailed parsing of protocol, host, path, query, and hash parameters.",
      keywords: ["url encoder", "url decoder", "percent encoding", "uri", "query string", "url parser", "hash params"],
    },
  },
  // Data Tools
  {
    id: "diff-viewer",
    name: "Diff Viewer",
    description: "Compare text, JSON, YAML, or TOML with table and unified views plus character-level highlights.",
    category: "Data",
    route: "/tools/diff-viewer",
    keywords: ["diff", "compare", "viewer", "text", "json", "yaml", "toml", "unified", "table"],
    seo: {
      title: "Diff Viewer - AutelysT",
      description:
        "Online diff viewer for text, JSON, YAML, and TOML with table view, unified diff, and character-level highlights.",
      keywords: ["diff viewer", "text diff", "json diff", "yaml diff", "toml diff", "unified diff", "table diff"],
    },
  },
  {
    id: "json-schema",
    name: "JSON Schema Generator",
    description: "Generate JSON Schema from sample JSON with automatic type and required-field inference.",
    category: "Data",
    route: "/tools/json-schema",
    keywords: ["json", "schema", "generate", "validate", "draft", "inference"],
    seo: {
      title: "JSON Schema Generator - AutelysT",
      description:
        "Online JSON Schema generator with automatic type, format, and required-field inference from sample JSON.",
      keywords: ["json schema", "schema generator", "json to schema", "json validation", "schema inference"],
    },
  },
  {
    id: "format-converter",
    name: "Format Converter",
    description: "Convert between JSON, YAML, and TOML with auto-detection and error reporting.",
    category: "Data",
    route: "/tools/format-converter",
    keywords: ["json", "yaml", "toml", "convert", "format", "transform"],
    seo: {
      title: "Format Converter - AutelysT",
      description: "Online JSON/YAML/TOML converter with auto-detection and error reporting.",
      keywords: ["format converter", "json to yaml", "yaml to json", "json to toml", "toml to json"],
    },
  },
  // Utility Tools
  {
    id: "unit-converter",
    name: "Unit Converter",
    description: "Convert between units of length, mass, temperature, volume, area, speed, pressure, energy, power, data, time, angle, and frequency.",
    category: "Utility",
    route: "/tools/unit-converter",
    keywords: [
      "unit", "converter", "length", "mass", "weight", "temperature", "volume", "area", "speed", "velocity",
      "pressure", "energy", "power", "data", "storage", "time", "duration", "angle", "frequency",
      "meter", "foot", "mile", "kilometer", "inch", "yard", "kilogram", "pound", "ounce", "gram",
      "celsius", "fahrenheit", "kelvin", "liter", "gallon", "cup", "tablespoon", "teaspoon",
      "square meter", "acre", "hectare", "mph", "kph", "knot", "pascal", "bar", "psi", "atm",
      "joule", "calorie", "watt", "horsepower", "byte", "kilobyte", "megabyte", "gigabyte", "terabyte",
      "second", "minute", "hour", "day", "week", "year", "degree", "radian", "hertz", "rpm",
    ],
    seo: {
      title: "Unit Converter - AutelysT",
      description: "Online unit converter supporting length, mass, temperature, volume, area, speed, pressure, energy, power, data storage, time, angle, and frequency conversions.",
      keywords: [
        "unit converter", "length converter", "mass converter", "temperature converter", "volume converter",
        "area converter", "speed converter", "pressure converter", "energy converter", "power converter",
        "data converter", "time converter", "angle converter", "frequency converter",
        "metric to imperial", "imperial to metric", "measurement conversion",
      ],
    },
  },
  {
    id: "scientific-calculator",
    name: "Scientific Calculator",
    description: "Full-featured scientific calculator with trigonometric, logarithmic, and exponential functions, memory operations, and calculation history.",
    category: "Utility",
    route: "/tools/scientific-calculator",
    keywords: [
      "calculator", "scientific calculator", "math", "mathematics", "arithmetic",
      "sin", "cos", "tan", "trigonometry", "logarithm", "exponential", "power", "root", "sqrt",
      "factorial", "pi", "euler", "memory", "calculation", "compute", "evaluate",
      "degree", "radian", "gradian", "expression", "formula",
    ],
    seo: {
      title: "Scientific Calculator - AutelysT",
      description: "Free online scientific calculator with trigonometric, logarithmic, exponential functions, memory operations, and keyboard support.",
      keywords: [
        "scientific calculator", "online calculator", "math calculator", "trigonometry calculator",
        "logarithm calculator", "free calculator", "web calculator",
      ],
    },
  },
]

export function getToolById(id: string): Tool | undefined {
  return tools.find((tool) => tool.id === id)
}

export function getToolsByCategory(category: ToolCategory): Tool[] {
  return tools.filter((tool) => tool.category === category)
}

export function getToolCategories(): ToolCategory[] {
  return [...new Set(tools.map((tool) => tool.category))]
}

export function searchTools(query: string): Tool[] {
  const lowerQuery = query.toLowerCase()
  return tools.filter(
    (tool) =>
      tool.name.toLowerCase().includes(lowerQuery) ||
      tool.description.toLowerCase().includes(lowerQuery) ||
      tool.keywords.some((kw) => kw.toLowerCase().includes(lowerQuery)),
  )
}

export function getToolsGroupedByCategory(): Record<ToolCategory, Tool[]> {
  const grouped: Partial<Record<ToolCategory, Tool[]>> = {}
  for (const tool of tools) {
    if (!grouped[tool.category]) {
      grouped[tool.category] = []
    }
    grouped[tool.category]!.push(tool)
  }
  return grouped as Record<ToolCategory, Tool[]>
}
