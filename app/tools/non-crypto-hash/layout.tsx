import type React from "react"
import type { Metadata } from "next"

export const metadata: Metadata = {
  title: "Non-Crypto Hash - AutelysT",
  description:
    "Online non-cryptographic hash generator with MurmurHash, xxHash, CityHash/FarmHash, SipHash, SpookyHash, HighwayHash, FNV, and CRC32.",
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
}

export default function NonCryptoHashLayout({ children }: { children: React.ReactNode }) {
  return children
}
