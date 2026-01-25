import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Archiver - AutelysT",
  description:
    "Online file archiver to compress and decompress ZIP, TAR, GZIP, 7z, RAR, and many other archive formats.",
  keywords: [
    "archiver",
    "compress",
    "decompress",
    "zip",
    "unzip",
    "tar",
    "gzip",
    "7z",
    "rar",
    "extract",
    "file compression",
  ],
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
