import * as fflate from "fflate";
import { Archive } from "libarchive.js";
// WASM modules are dynamically imported to avoid loading during SSR/prerendering

// ============================================================================
// Types
// ============================================================================

export interface FileNode {
  id: string;
  name: string;
  type: "file" | "directory";
  path: string;
  size?: number;
  data?: Uint8Array;
  children?: FileNode[];
  selected: boolean;
  expanded?: boolean;
}

export interface CompressionFormat {
  id: string;
  name: string;
  extensions: string[];
  mimeTypes: string[];
  supportsMultipleFiles: boolean;
  supportsPassword: boolean;
  supportsCompression: boolean;
  supportsDecompression: boolean;
  description: string;
}

export interface CompressionOptions {
  format: string;
  password?: string;
  level?: number; // 0-9 for compression level
}

export interface DecompressionResult {
  files: FileNode[];
  format: string;
  encrypted: boolean;
}

// ============================================================================
// Supported Formats
// ============================================================================

export const COMPRESSION_FORMATS: CompressionFormat[] = [
  // ============================================================================
  // Fully supported formats (compression + decompression)
  // ============================================================================
  {
    id: "zip",
    name: "ZIP",
    extensions: [".zip"],
    mimeTypes: ["application/zip", "application/x-zip-compressed"],
    supportsMultipleFiles: true,
    supportsPassword: true,
    supportsCompression: true,
    supportsDecompression: true,
    description: "Standard ZIP archive format",
  },
  {
    id: "gzip",
    name: "GZIP",
    extensions: [".gz", ".gzip"],
    mimeTypes: ["application/gzip", "application/x-gzip"],
    supportsMultipleFiles: false,
    supportsPassword: false,
    supportsCompression: true,
    supportsDecompression: true,
    description: "GNU Zip compression (single file only)",
  },
  {
    id: "tar",
    name: "TAR",
    extensions: [".tar"],
    mimeTypes: ["application/x-tar"],
    supportsMultipleFiles: true,
    supportsPassword: false,
    supportsCompression: true,
    supportsDecompression: true,
    description: "Tape Archive (no compression)",
  },
  {
    id: "tar.gz",
    name: "TAR.GZ / TGZ",
    extensions: [".tar.gz", ".tgz"],
    mimeTypes: ["application/gzip", "application/x-gzip"],
    supportsMultipleFiles: true,
    supportsPassword: false,
    supportsCompression: true,
    supportsDecompression: true,
    description: "Gzipped TAR archive",
  },
  {
    id: "zlib",
    name: "ZLIB",
    extensions: [".zz", ".zlib"],
    mimeTypes: ["application/zlib"],
    supportsMultipleFiles: false,
    supportsPassword: false,
    supportsCompression: true,
    supportsDecompression: true,
    description: "ZLIB compression (single file only)",
  },
  {
    id: "jar",
    name: "JAR",
    extensions: [".jar"],
    mimeTypes: ["application/java-archive"],
    supportsMultipleFiles: true,
    supportsPassword: false,
    supportsCompression: true,
    supportsDecompression: true,
    description: "Java Archive (ZIP-based)",
  },
  // ============================================================================
  // Decompression only formats (via libarchive.js)
  // ============================================================================
  {
    id: "7z",
    name: "7-Zip",
    extensions: [".7z"],
    mimeTypes: ["application/x-7z-compressed"],
    supportsMultipleFiles: true,
    supportsPassword: true,
    supportsDecompression: true,
    supportsCompression: true,
    description: "7-Zip archive with LZMA2 compression",
  },
  {
    id: "rar",
    name: "RAR",
    extensions: [".rar"],
    mimeTypes: ["application/vnd.rar", "application/x-rar-compressed"],
    supportsMultipleFiles: true,
    supportsPassword: true,
    supportsDecompression: true,
    supportsCompression: false,
    description: "RAR archive (extract only)",
  },
  {
    id: "zipx",
    name: "ZIPX",
    extensions: [".zipx"],
    mimeTypes: ["application/x-zipx-compressed"],
    supportsMultipleFiles: true,
    supportsPassword: true,
    supportsDecompression: true,
    supportsCompression: false,
    description: "Extended ZIP archive (extract only)",
  },
  {
    id: "xz",
    name: "XZ",
    extensions: [".xz"],
    mimeTypes: ["application/x-xz"],
    supportsMultipleFiles: false,
    supportsPassword: false,
    supportsDecompression: true,
    supportsCompression: false,
    description: "XZ compression (extract only)",
  },
  {
    id: "bz2",
    name: "BZIP2",
    extensions: [".bz2", ".bzip2"],
    mimeTypes: ["application/x-bzip2"],
    supportsMultipleFiles: false,
    supportsPassword: false,
    supportsDecompression: true,
    supportsCompression: false,
    description: "BZIP2 compression (extract only)",
  },
  {
    id: "lzma",
    name: "LZMA",
    extensions: [".lzma"],
    mimeTypes: ["application/x-lzma"],
    supportsMultipleFiles: false,
    supportsPassword: false,
    supportsDecompression: true,
    supportsCompression: false,
    description: "LZMA compression (extract only)",
  },
  {
    id: "lz4",
    name: "LZ4",
    extensions: [".lz4"],
    mimeTypes: ["application/x-lz4"],
    supportsMultipleFiles: false,
    supportsPassword: false,
    supportsDecompression: true,
    supportsCompression: true,
    description: "LZ4 compression (single file)",
  },
  {
    id: "zstd",
    name: "Zstandard (ZSTD)",
    extensions: [".zst", ".zstd"],
    mimeTypes: ["application/zstd"],
    supportsMultipleFiles: false,
    supportsPassword: false,
    supportsDecompression: true,
    supportsCompression: true,
    description: "Zstandard compression (single file)",
  },
  {
    id: "z",
    name: "Z (compress)",
    extensions: [".z", ".Z"],
    mimeTypes: ["application/x-compress"],
    supportsMultipleFiles: false,
    supportsPassword: false,
    supportsDecompression: true,
    supportsCompression: false,
    description: "Unix compress (extract only)",
  },
  {
    id: "lzh",
    name: "LZH / LHA",
    extensions: [".lzh", ".lha"],
    mimeTypes: ["application/x-lzh-compressed"],
    supportsMultipleFiles: true,
    supportsPassword: false,
    supportsDecompression: true,
    supportsCompression: false,
    description: "LZH/LHA archive (extract only)",
  },
  // Combined TAR formats
  {
    id: "tar.bz2",
    name: "TAR.BZ2 / TBZ2",
    extensions: [".tar.bz2", ".tbz2", ".tbz"],
    mimeTypes: ["application/x-bzip2"],
    supportsMultipleFiles: true,
    supportsPassword: false,
    supportsDecompression: true,
    supportsCompression: false,
    description: "Bzip2 compressed TAR (extract only)",
  },
  {
    id: "tar.xz",
    name: "TAR.XZ / TXZ",
    extensions: [".tar.xz", ".txz"],
    mimeTypes: ["application/x-xz"],
    supportsMultipleFiles: true,
    supportsPassword: false,
    supportsDecompression: true,
    supportsCompression: false,
    description: "XZ compressed TAR (extract only)",
  },
  {
    id: "tar.lzma",
    name: "TAR.LZMA",
    extensions: [".tar.lzma", ".tlzma"],
    mimeTypes: ["application/x-lzma"],
    supportsMultipleFiles: true,
    supportsPassword: false,
    supportsDecompression: true,
    supportsCompression: false,
    description: "LZMA compressed TAR (extract only)",
  },
  {
    id: "tar.zst",
    name: "TAR.ZST",
    extensions: [".tar.zst", ".tzst"],
    mimeTypes: ["application/zstd"],
    supportsMultipleFiles: true,
    supportsPassword: false,
    supportsDecompression: true,
    supportsCompression: true,
    description: "Zstandard compressed TAR archive",
  },
  {
    id: "tar.lz4",
    name: "TAR.LZ4",
    extensions: [".tar.lz4"],
    mimeTypes: ["application/x-lz4"],
    supportsMultipleFiles: true,
    supportsPassword: false,
    supportsDecompression: true,
    supportsCompression: true,
    description: "LZ4 compressed TAR archive",
  },
  {
    id: "snappy",
    name: "Snappy",
    extensions: [".snappy", ".snz"],
    mimeTypes: ["application/x-snappy"],
    supportsMultipleFiles: false,
    supportsPassword: false,
    supportsDecompression: true,
    supportsCompression: true,
    description: "Snappy compression (single file)",
  },
  {
    id: "tar.snappy",
    name: "TAR.SNAPPY",
    extensions: [".tar.snappy", ".tar.snz"],
    mimeTypes: ["application/x-snappy"],
    supportsMultipleFiles: true,
    supportsPassword: false,
    supportsDecompression: true,
    supportsCompression: true,
    description: "Snappy compressed TAR archive",
  },
  // Disk images and system formats
  {
    id: "iso",
    name: "ISO",
    extensions: [".iso"],
    mimeTypes: ["application/x-iso9660-image"],
    supportsMultipleFiles: true,
    supportsPassword: false,
    supportsDecompression: true,
    supportsCompression: false,
    description: "ISO disc image (extract only)",
  },
  {
    id: "nrg",
    name: "NRG",
    extensions: [".nrg"],
    mimeTypes: ["application/x-nrg"],
    supportsMultipleFiles: true,
    supportsPassword: false,
    supportsDecompression: true,
    supportsCompression: false,
    description: "Nero disc image (extract only)",
  },
  {
    id: "udf",
    name: "UDF",
    extensions: [".udf"],
    mimeTypes: ["application/x-udf"],
    supportsMultipleFiles: true,
    supportsPassword: false,
    supportsDecompression: true,
    supportsCompression: false,
    description: "Universal Disk Format (extract only)",
  },
  // Package formats
  {
    id: "cab",
    name: "CAB",
    extensions: [".cab"],
    mimeTypes: ["application/vnd.ms-cab-compressed"],
    supportsMultipleFiles: true,
    supportsPassword: false,
    supportsDecompression: true,
    supportsCompression: false,
    description: "Windows Cabinet (extract only)",
  },
  {
    id: "deb",
    name: "DEB",
    extensions: [".deb"],
    mimeTypes: ["application/vnd.debian.binary-package"],
    supportsMultipleFiles: true,
    supportsPassword: false,
    supportsDecompression: true,
    supportsCompression: false,
    description: "Debian package (extract only)",
  },
  {
    id: "rpm",
    name: "RPM",
    extensions: [".rpm"],
    mimeTypes: ["application/x-rpm"],
    supportsMultipleFiles: true,
    supportsPassword: false,
    supportsDecompression: true,
    supportsCompression: false,
    description: "RPM package (extract only)",
  },
  {
    id: "nsis",
    name: "NSIS",
    extensions: [".exe"],
    mimeTypes: ["application/x-nsis"],
    supportsMultipleFiles: true,
    supportsPassword: false,
    supportsDecompression: true,
    supportsCompression: false,
    description: "NSIS installer (extract only)",
  },
  // Archive formats
  {
    id: "ar",
    name: "AR",
    extensions: [".ar", ".a"],
    mimeTypes: ["application/x-archive"],
    supportsMultipleFiles: true,
    supportsPassword: false,
    supportsDecompression: true,
    supportsCompression: false,
    description: "Unix archive (extract only)",
  },
  {
    id: "cpio",
    name: "CPIO",
    extensions: [".cpio"],
    mimeTypes: ["application/x-cpio"],
    supportsMultipleFiles: true,
    supportsPassword: false,
    supportsDecompression: true,
    supportsCompression: false,
    description: "CPIO archive (extract only)",
  },
  {
    id: "warc",
    name: "WARC",
    extensions: [".warc"],
    mimeTypes: ["application/warc"],
    supportsMultipleFiles: true,
    supportsPassword: false,
    supportsDecompression: true,
    supportsCompression: false,
    description: "Web Archive (extract only)",
  },
  {
    id: "xar",
    name: "XAR",
    extensions: [".xar", ".pkg"],
    mimeTypes: ["application/x-xar"],
    supportsMultipleFiles: true,
    supportsPassword: false,
    supportsDecompression: true,
    supportsCompression: false,
    description: "eXtensible Archive (extract only)",
  },
  // Filesystem images
  {
    id: "cramfs",
    name: "CramFS",
    extensions: [".cramfs"],
    mimeTypes: ["application/x-cramfs"],
    supportsMultipleFiles: true,
    supportsPassword: false,
    supportsDecompression: true,
    supportsCompression: false,
    description: "Compressed ROM filesystem (extract only)",
  },
  {
    id: "squashfs",
    name: "SquashFS",
    extensions: [".squashfs", ".sqsh", ".sfs"],
    mimeTypes: ["application/x-squashfs"],
    supportsMultipleFiles: true,
    supportsPassword: false,
    supportsDecompression: true,
    supportsCompression: false,
    description: "SquashFS filesystem (extract only)",
  },
  {
    id: "ext",
    name: "EXT2/3/4",
    extensions: [".ext", ".ext2", ".ext3", ".ext4"],
    mimeTypes: ["application/x-ext2"],
    supportsMultipleFiles: true,
    supportsPassword: false,
    supportsDecompression: true,
    supportsCompression: false,
    description: "Linux ext filesystem (extract only)",
  },
  {
    id: "fat",
    name: "FAT",
    extensions: [".fat", ".img"],
    mimeTypes: ["application/x-fat"],
    supportsMultipleFiles: true,
    supportsPassword: false,
    supportsDecompression: true,
    supportsCompression: false,
    description: "FAT filesystem image (extract only)",
  },
  {
    id: "ntfs",
    name: "NTFS",
    extensions: [".ntfs"],
    mimeTypes: ["application/x-ntfs"],
    supportsMultipleFiles: true,
    supportsPassword: false,
    supportsDecompression: true,
    supportsCompression: false,
    description: "NTFS filesystem (extract only)",
  },
  {
    id: "hfs",
    name: "HFS/HFS+",
    extensions: [".hfs", ".hfsx"],
    mimeTypes: ["application/x-hfs"],
    supportsMultipleFiles: true,
    supportsPassword: false,
    supportsDecompression: true,
    supportsCompression: false,
    description: "Apple HFS/HFS+ filesystem (extract only)",
  },
  // Nintendo formats
  {
    id: "nds",
    name: "NDS",
    extensions: [".nds"],
    mimeTypes: ["application/x-nintendo-ds-rom"],
    supportsMultipleFiles: true,
    supportsPassword: false,
    supportsDecompression: true,
    supportsCompression: false,
    description: "Nintendo DS ROM (extract only)",
  },
];

// Formats that are not supported in browser (listed for reference)
export const UNSUPPORTED_FORMATS: CompressionFormat[] = [
  // Self-extracting and installers
  {
    id: "exe-sfx",
    name: "EXE (Self-extracting)",
    extensions: [".exe"],
    mimeTypes: ["application/x-msdownload"],
    supportsMultipleFiles: true,
    supportsPassword: true,
    supportsDecompression: false,
    supportsCompression: false,
    description: "Self-extracting archive",
  },
  {
    id: "dmg",
    name: "DMG",
    extensions: [".dmg"],
    mimeTypes: ["application/x-apple-diskimage"],
    supportsMultipleFiles: true,
    supportsPassword: false,
    supportsDecompression: false,
    supportsCompression: false,
    description: "macOS disk image",
  },
  {
    id: "msi",
    name: "MSI",
    extensions: [".msi"],
    mimeTypes: ["application/x-msi"],
    supportsMultipleFiles: true,
    supportsPassword: false,
    supportsDecompression: false,
    supportsCompression: false,
    description: "Windows Installer",
  },
  // Virtual disk formats
  {
    id: "wim",
    name: "WIM",
    extensions: [".wim", ".swm", ".esd"],
    mimeTypes: ["application/x-ms-wim"],
    supportsMultipleFiles: true,
    supportsPassword: false,
    supportsDecompression: false,
    supportsCompression: false,
    description: "Windows Imaging Format",
  },
  {
    id: "vhd",
    name: "VHD/VHDX",
    extensions: [".vhd", ".vhdx"],
    mimeTypes: ["application/x-vhd"],
    supportsMultipleFiles: true,
    supportsPassword: false,
    supportsDecompression: false,
    supportsCompression: false,
    description: "Virtual Hard Disk",
  },
  {
    id: "vmdk",
    name: "VMDK",
    extensions: [".vmdk"],
    mimeTypes: ["application/x-vmdk"],
    supportsMultipleFiles: true,
    supportsPassword: false,
    supportsDecompression: false,
    supportsCompression: false,
    description: "VMware Disk",
  },
  {
    id: "vdi",
    name: "VDI",
    extensions: [".vdi"],
    mimeTypes: ["application/x-virtualbox-vdi"],
    supportsMultipleFiles: true,
    supportsPassword: false,
    supportsDecompression: false,
    supportsCompression: false,
    description: "VirtualBox Disk Image",
  },
  {
    id: "qcow2",
    name: "QCOW2",
    extensions: [".qcow2", ".qcow"],
    mimeTypes: ["application/x-qemu-disk"],
    supportsMultipleFiles: true,
    supportsPassword: false,
    supportsDecompression: false,
    supportsCompression: false,
    description: "QEMU disk image",
  },
  // Legacy archive formats
  {
    id: "ace",
    name: "ACE",
    extensions: [".ace"],
    mimeTypes: ["application/x-ace-compressed"],
    supportsMultipleFiles: true,
    supportsPassword: true,
    supportsDecompression: false,
    supportsCompression: false,
    description: "ACE archive",
  },
  {
    id: "alz",
    name: "ALZ",
    extensions: [".alz"],
    mimeTypes: ["application/x-alz-compressed"],
    supportsMultipleFiles: true,
    supportsPassword: false,
    supportsDecompression: false,
    supportsCompression: false,
    description: "ALZip archive",
  },
  {
    id: "arc",
    name: "ARC",
    extensions: [".arc"],
    mimeTypes: ["application/x-arc"],
    supportsMultipleFiles: true,
    supportsPassword: false,
    supportsDecompression: false,
    supportsCompression: false,
    description: "ARC archive",
  },
  {
    id: "arj",
    name: "ARJ",
    extensions: [".arj"],
    mimeTypes: ["application/x-arj"],
    supportsMultipleFiles: true,
    supportsPassword: true,
    supportsDecompression: false,
    supportsCompression: false,
    description: "ARJ archive",
  },
  {
    id: "sit",
    name: "StuffIt",
    extensions: [".sit", ".sitx"],
    mimeTypes: ["application/x-stuffit"],
    supportsMultipleFiles: true,
    supportsPassword: false,
    supportsDecompression: false,
    supportsCompression: false,
    description: "StuffIt archive (macOS)",
  },
  {
    id: "zoo",
    name: "ZOO",
    extensions: [".zoo"],
    mimeTypes: ["application/x-zoo"],
    supportsMultipleFiles: true,
    supportsPassword: false,
    supportsDecompression: false,
    supportsCompression: false,
    description: "ZOO archive",
  },
  {
    id: "lbr",
    name: "LBR",
    extensions: [".lbr"],
    mimeTypes: ["application/x-lbr"],
    supportsMultipleFiles: true,
    supportsPassword: false,
    supportsDecompression: false,
    supportsCompression: false,
    description: "LBR archive",
  },
  // Disc image formats
  {
    id: "bin",
    name: "BIN/CUE",
    extensions: [".bin", ".cue"],
    mimeTypes: ["application/x-cue"],
    supportsMultipleFiles: true,
    supportsPassword: false,
    supportsDecompression: false,
    supportsCompression: false,
    description: "CD/DVD binary image",
  },
  {
    id: "cdi",
    name: "CDI",
    extensions: [".cdi"],
    mimeTypes: ["application/x-discjuggler"],
    supportsMultipleFiles: true,
    supportsPassword: false,
    supportsDecompression: false,
    supportsCompression: false,
    description: "DiscJuggler image",
  },
  {
    id: "mdf",
    name: "MDF/MDS",
    extensions: [".mdf", ".mds"],
    mimeTypes: ["application/x-mdf"],
    supportsMultipleFiles: true,
    supportsPassword: false,
    supportsDecompression: false,
    supportsCompression: false,
    description: "Alcohol 120% image",
  },
  // Other formats
  {
    id: "chm",
    name: "CHM",
    extensions: [".chm"],
    mimeTypes: ["application/vnd.ms-htmlhelp"],
    supportsMultipleFiles: true,
    supportsPassword: false,
    supportsDecompression: false,
    supportsCompression: false,
    description: "Compiled HTML Help",
  },
  {
    id: "swf",
    name: "SWF",
    extensions: [".swf"],
    mimeTypes: ["application/x-shockwave-flash"],
    supportsMultipleFiles: true,
    supportsPassword: false,
    supportsDecompression: false,
    supportsCompression: false,
    description: "Shockwave Flash",
  },
  {
    id: "pdf",
    name: "PDF (embedded)",
    extensions: [".pdf"],
    mimeTypes: ["application/pdf"],
    supportsMultipleFiles: true,
    supportsPassword: true,
    supportsDecompression: false,
    supportsCompression: false,
    description: "PDF with embedded files",
  },
  {
    id: "uefi",
    name: "UEFI",
    extensions: [".efi", ".rom"],
    mimeTypes: ["application/x-uefi"],
    supportsMultipleFiles: true,
    supportsPassword: false,
    supportsDecompression: false,
    supportsCompression: false,
    description: "UEFI firmware",
  },
  {
    id: "mbr",
    name: "MBR",
    extensions: [".mbr"],
    mimeTypes: ["application/x-mbr"],
    supportsMultipleFiles: false,
    supportsPassword: false,
    supportsDecompression: false,
    supportsCompression: false,
    description: "Master Boot Record",
  },
  {
    id: "gpt",
    name: "GPT",
    extensions: [".gpt"],
    mimeTypes: ["application/x-gpt"],
    supportsMultipleFiles: true,
    supportsPassword: false,
    supportsDecompression: false,
    supportsCompression: false,
    description: "GUID Partition Table",
  },
  {
    id: "ihex",
    name: "Intel HEX",
    extensions: [".hex", ".ihex"],
    mimeTypes: ["text/x-hex"],
    supportsMultipleFiles: false,
    supportsPassword: false,
    supportsDecompression: false,
    supportsCompression: false,
    description: "Intel HEX format",
  },
  {
    id: "nsa",
    name: "NSA",
    extensions: [".nsa", ".sar"],
    mimeTypes: ["application/x-nsa"],
    supportsMultipleFiles: true,
    supportsPassword: false,
    supportsDecompression: false,
    supportsCompression: false,
    description: "NScripter archive",
  },
  {
    id: "pak",
    name: "PAK",
    extensions: [".pak"],
    mimeTypes: ["application/x-pak"],
    supportsMultipleFiles: true,
    supportsPassword: false,
    supportsDecompression: false,
    supportsCompression: false,
    description: "Game PAK archive",
  },
  {
    id: "pit",
    name: "PIT",
    extensions: [".pit"],
    mimeTypes: ["application/x-pit"],
    supportsMultipleFiles: true,
    supportsPassword: false,
    supportsDecompression: false,
    supportsCompression: false,
    description: "Samsung PIT partition",
  },
  {
    id: "dms",
    name: "DMS",
    extensions: [".dms"],
    mimeTypes: ["application/x-dms"],
    supportsMultipleFiles: true,
    supportsPassword: false,
    supportsDecompression: false,
    supportsCompression: false,
    description: "Amiga DMS archive",
  },
  {
    id: "dd",
    name: "DD (raw disk)",
    extensions: [".dd", ".raw"],
    mimeTypes: ["application/x-raw-disk-image"],
    supportsMultipleFiles: true,
    supportsPassword: false,
    supportsDecompression: false,
    supportsCompression: false,
    description: "Raw disk image",
  },
  {
    id: "cpt",
    name: "Compact Pro",
    extensions: [".cpt"],
    mimeTypes: ["application/x-cpt"],
    supportsMultipleFiles: true,
    supportsPassword: false,
    supportsDecompression: false,
    supportsCompression: false,
    description: "Compact Pro archive (macOS)",
  },
  {
    id: "snappy",
    name: "Snappy",
    extensions: [".snappy", ".sz"],
    mimeTypes: ["application/x-snappy"],
    supportsMultipleFiles: false,
    supportsPassword: false,
    supportsDecompression: false,
    supportsCompression: false,
    description: "Snappy compression",
  },
  {
    id: "lzm",
    name: "LZM",
    extensions: [".lzm"],
    mimeTypes: ["application/x-lzm"],
    supportsMultipleFiles: true,
    supportsPassword: false,
    supportsDecompression: false,
    supportsCompression: false,
    description: "Slax module",
  },
  {
    id: "crunch",
    name: "Crunch",
    extensions: [".crunch"],
    mimeTypes: ["application/x-crunch"],
    supportsMultipleFiles: false,
    supportsPassword: false,
    supportsDecompression: false,
    supportsCompression: false,
    description: "Crunch compression",
  },
  {
    id: "squeeze",
    name: "Squeeze",
    extensions: [".sqz"],
    mimeTypes: ["application/x-squeeze"],
    supportsMultipleFiles: true,
    supportsPassword: false,
    supportsDecompression: false,
    supportsCompression: false,
    description: "Squeeze archive",
  },
  {
    id: "pp",
    name: "PowerPacker",
    extensions: [".pp"],
    mimeTypes: ["application/x-powerpacker"],
    supportsMultipleFiles: false,
    supportsPassword: false,
    supportsDecompression: false,
    supportsCompression: false,
    description: "PowerPacker (Amiga)",
  },
  {
    id: "zi",
    name: "ZI",
    extensions: [".zi"],
    mimeTypes: ["application/x-zi"],
    supportsMultipleFiles: true,
    supportsPassword: false,
    supportsDecompression: false,
    supportsCompression: false,
    description: "ZI archive",
  },
];

// All formats combined for searching
export const ALL_FORMATS: CompressionFormat[] = [
  ...COMPRESSION_FORMATS,
  ...UNSUPPORTED_FORMATS,
];

// Search formats by name, extension, or description
export function searchFormats(query: string): CompressionFormat[] {
  if (!query.trim()) return COMPRESSION_FORMATS;
  const lowerQuery = query.toLowerCase();
  return COMPRESSION_FORMATS.filter(
    (f) =>
      f.name.toLowerCase().includes(lowerQuery) ||
      f.id.toLowerCase().includes(lowerQuery) ||
      f.extensions.some((ext) => ext.toLowerCase().includes(lowerQuery)) ||
      f.description.toLowerCase().includes(lowerQuery),
  );
}

// ============================================================================
// Helper Functions
// ============================================================================

export function generateId(): string {
  return Math.random().toString(36).substring(2, 11);
}

export function detectFormat(filename: string): CompressionFormat | null {
  const lowerName = filename.toLowerCase();

  // Check combined formats first (like .tar.gz)
  for (const format of COMPRESSION_FORMATS) {
    for (const ext of format.extensions) {
      if (lowerName.endsWith(ext)) {
        return format;
      }
    }
  }

  return null;
}

export function getFormatById(id: string): CompressionFormat | null {
  return COMPRESSION_FORMATS.find((f) => f.id === id) || null;
}

export function buildFileTree(files: FileNode[]): FileNode[] {
  const root: FileNode[] = [];
  const pathMap = new Map<string, FileNode>();

  // Sort files so directories come first
  const sorted = [...files].sort((a, b) => {
    const aDepth = a.path.split("/").length;
    const bDepth = b.path.split("/").length;
    return aDepth - bDepth;
  });

  for (const file of sorted) {
    const parts = file.path.split("/").filter(Boolean);
    let currentPath = "";
    let currentLevel = root;

    for (let i = 0; i < parts.length - 1; i++) {
      currentPath += (currentPath ? "/" : "") + parts[i];

      let dir = pathMap.get(currentPath);
      if (!dir) {
        dir = {
          id: generateId(),
          name: parts[i],
          type: "directory",
          path: currentPath,
          children: [],
          selected: true,
          expanded: true,
        };
        pathMap.set(currentPath, dir);
        currentLevel.push(dir);
      }
      currentLevel = dir.children!;
    }

    currentLevel.push(file);
  }

  return root;
}

export function flattenFileTree(
  nodes: FileNode[],
  selectedOnly = false,
): FileNode[] {
  const result: FileNode[] = [];

  function traverse(node: FileNode) {
    if (selectedOnly && !node.selected) return;

    if (node.type === "file") {
      result.push(node);
    }

    if (node.children) {
      for (const child of node.children) {
        traverse(child);
      }
    }
  }

  for (const node of nodes) {
    traverse(node);
  }

  return result;
}

export function calculateTotalSize(nodes: FileNode[]): number {
  let total = 0;

  function traverse(node: FileNode) {
    if (node.type === "file" && node.size) {
      total += node.size;
    }
    if (node.children) {
      for (const child of node.children) {
        traverse(child);
      }
    }
  }

  for (const node of nodes) {
    traverse(node);
  }

  return total;
}

export function formatFileSize(bytes: number): string {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB", "TB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
}

// ============================================================================
// Compression Functions
// ============================================================================

export async function compressFiles(
  files: FileNode[],
  options: CompressionOptions,
): Promise<Uint8Array> {
  const selectedFiles = flattenFileTree(files, true);

  if (selectedFiles.length === 0) {
    throw new Error("No files selected for compression");
  }

  const format = getFormatById(options.format);
  if (!format) {
    throw new Error(`Unknown format: ${options.format}`);
  }

  if (!format.supportsCompression) {
    throw new Error(`Compression not supported for format: ${format.name}`);
  }

  if (!format.supportsMultipleFiles && selectedFiles.length > 1) {
    throw new Error(
      `${format.name} format only supports single file compression`,
    );
  }

  switch (options.format) {
    case "zip":
    case "jar":
      return compressZip(selectedFiles, options);
    case "gzip":
      return compressGzip(selectedFiles[0], options);
    case "zlib":
      return compressZlib(selectedFiles[0], options);
    case "tar":
      return compressTar(selectedFiles);
    case "tar.gz":
      return compressTarGz(selectedFiles, options);
    case "zstd":
      return compressZstd(selectedFiles[0], options);
    case "tar.zst":
      return compressTarZst(selectedFiles, options);
    case "lz4":
      return compressLz4(selectedFiles[0]);
    case "tar.lz4":
      return compressTarLz4(selectedFiles);
    case "snappy":
      return compressSnappy(selectedFiles[0]);
    case "tar.snappy":
      return compressTarSnappy(selectedFiles);
    case "7z":
      return compress7z(selectedFiles, options);
    default:
      throw new Error(`Compression not implemented for format: ${format.name}`);
  }
}

type CompressionLevel = 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9;

function toCompressionLevel(level: number | undefined): CompressionLevel {
  const l = level ?? 6;
  return Math.max(0, Math.min(9, l)) as CompressionLevel;
}

function compressZip(
  files: FileNode[],
  options: CompressionOptions,
): Promise<Uint8Array> {
  return new Promise((resolve, reject) => {
    const zipData: fflate.Zippable = {};
    const level = toCompressionLevel(options.level);

    for (const file of files) {
      if (file.data) {
        const opts: fflate.ZipOptions = {
          level,
        };

        if (options.password) {
          // fflate supports AES encryption
          (opts as fflate.ZipOptions & { password?: string }).password =
            options.password;
        }

        zipData[file.path] = [file.data, opts];
      }
    }

    fflate.zip(zipData, { level }, (err, data) => {
      if (err) {
        reject(err);
      } else {
        resolve(data);
      }
    });
  });
}

function compressGzip(
  file: FileNode,
  options: CompressionOptions,
): Promise<Uint8Array> {
  return new Promise((resolve, reject) => {
    if (!file.data) {
      reject(new Error("No file data"));
      return;
    }

    try {
      const compressed = fflate.gzipSync(file.data, {
        level: toCompressionLevel(options.level),
        filename: file.name,
      });
      resolve(compressed);
    } catch (err) {
      reject(err);
    }
  });
}

function compressZlib(
  file: FileNode,
  options: CompressionOptions,
): Promise<Uint8Array> {
  return new Promise((resolve, reject) => {
    if (!file.data) {
      reject(new Error("No file data"));
      return;
    }

    try {
      const compressed = fflate.zlibSync(file.data, {
        level: toCompressionLevel(options.level),
      });
      resolve(compressed);
    } catch (err) {
      reject(err);
    }
  });
}

// Simple TAR implementation (USTAR format)
function createTarEntry(path: string, data: Uint8Array): Uint8Array {
  const header = new Uint8Array(512);
  const encoder = new TextEncoder();

  // File name (max 100 bytes)
  const nameBytes = encoder.encode(path.slice(0, 100));
  header.set(nameBytes, 0);

  // File mode (octal)
  header.set(encoder.encode("0000644\0"), 100);

  // UID and GID
  header.set(encoder.encode("0000000\0"), 108);
  header.set(encoder.encode("0000000\0"), 116);

  // File size (octal, 11 digits)
  const sizeOctal = data.length.toString(8).padStart(11, "0");
  header.set(encoder.encode(sizeOctal + "\0"), 124);

  // Modification time (octal)
  const mtime = Math.floor(Date.now() / 1000)
    .toString(8)
    .padStart(11, "0");
  header.set(encoder.encode(mtime + "\0"), 136);

  // Type flag (0 = regular file)
  header[156] = 48; // ASCII '0'

  // USTAR magic
  header.set(encoder.encode("ustar\0"), 257);
  header.set(encoder.encode("00"), 263);

  // Calculate checksum (sum of all header bytes, treating checksum field as spaces)
  header.set(encoder.encode("        "), 148); // 8 spaces for checksum field
  let checksum = 0;
  for (let i = 0; i < 512; i++) {
    checksum += header[i];
  }
  const checksumOctal = checksum.toString(8).padStart(6, "0") + "\0 ";
  header.set(encoder.encode(checksumOctal), 148);

  // Pad data to 512-byte blocks
  const paddedSize = Math.ceil(data.length / 512) * 512;
  const paddedData = new Uint8Array(paddedSize);
  paddedData.set(data);

  // Combine header and data
  const entry = new Uint8Array(512 + paddedSize);
  entry.set(header);
  entry.set(paddedData, 512);

  return entry;
}

function createTar(files: FileNode[]): Uint8Array {
  const entries: Uint8Array[] = [];

  for (const file of files) {
    if (file.data) {
      entries.push(createTarEntry(file.path, file.data));
    }
  }

  // Add two empty 512-byte blocks at the end
  entries.push(new Uint8Array(1024));

  // Calculate total size
  const totalSize = entries.reduce((sum, entry) => sum + entry.length, 0);
  const tar = new Uint8Array(totalSize);

  let offset = 0;
  for (const entry of entries) {
    tar.set(entry, offset);
    offset += entry.length;
  }

  return tar;
}

function parseTar(data: Uint8Array): { path: string; data: Uint8Array }[] {
  const files: { path: string; data: Uint8Array }[] = [];
  let offset = 0;

  while (offset < data.length - 512) {
    // Check for empty block (end of archive)
    let isEmpty = true;
    for (let i = 0; i < 512; i++) {
      if (data[offset + i] !== 0) {
        isEmpty = false;
        break;
      }
    }
    if (isEmpty) break;

    // Parse header
    const header = data.slice(offset, offset + 512);
    const decoder = new TextDecoder();

    // Extract filename
    let nameEnd = 0;
    while (nameEnd < 100 && header[nameEnd] !== 0) nameEnd++;
    const path = decoder.decode(header.slice(0, nameEnd));

    // Extract file size (octal)
    const sizeStr = decoder
      .decode(header.slice(124, 135))
      .replace(/\0/g, "")
      .trim();
    const size = parseInt(sizeStr, 8) || 0;

    // Extract type flag
    const typeFlag = header[156];

    // Skip if not a regular file (typeFlag 0 or ASCII '0')
    if (typeFlag === 0 || typeFlag === 48) {
      const fileData = data.slice(offset + 512, offset + 512 + size);
      if (path && size > 0) {
        files.push({ path, data: fileData });
      }
    }

    // Move to next entry (header + padded data)
    const paddedSize = Math.ceil(size / 512) * 512;
    offset += 512 + paddedSize;
  }

  return files;
}

function compressTar(files: FileNode[]): Promise<Uint8Array> {
  return new Promise((resolve, reject) => {
    try {
      const tar = createTar(files);
      resolve(tar);
    } catch (err) {
      reject(err);
    }
  });
}

function compressTarGz(
  files: FileNode[],
  options: CompressionOptions,
): Promise<Uint8Array> {
  return new Promise((resolve, reject) => {
    try {
      const tar = createTar(files);
      const gzipped = fflate.gzipSync(tar, {
        level: toCompressionLevel(options.level),
      });
      resolve(gzipped);
    } catch (err) {
      reject(err);
    }
  });
}

// Initialize zstd-wasm (dynamically imported)
let zstdModule: {
  compress: (data: Uint8Array, level?: number) => Uint8Array;
  decompress: (data: Uint8Array) => Uint8Array;
} | null = null;

async function ensureZstdInitialized(): Promise<typeof zstdModule> {
  if (!zstdModule) {
    const zstd = await import("@bokuweb/zstd-wasm");
    await zstd.init();
    zstdModule = {
      compress: zstd.compress,
      decompress: zstd.decompress,
    };
  }
  return zstdModule;
}

// Convert 0-9 compression level to zstd level (1-22, default 3)
function toZstdLevel(level: number | undefined): number {
  const l = level ?? 6;
  // Map 0-9 to 1-19 (zstd range is 1-22, but 19 is a good max for browser)
  return Math.max(1, Math.min(19, Math.round(l * 2) + 1));
}

async function compressZstd(
  file: FileNode,
  options: CompressionOptions,
): Promise<Uint8Array> {
  if (!file.data) {
    throw new Error("No file data");
  }

  const zstd = await ensureZstdInitialized();
  const level = toZstdLevel(options.level);
  const compressed = zstd!.compress(file.data, level);
  return compressed;
}

async function compressTarZst(
  files: FileNode[],
  options: CompressionOptions,
): Promise<Uint8Array> {
  const tar = createTar(files);
  const zstd = await ensureZstdInitialized();
  const level = toZstdLevel(options.level);
  const compressed = zstd!.compress(tar, level);
  return compressed;
}

// LZ4 compression (dynamically imported WASM implementation)
let lz4Module: {
  compress: (data: Uint8Array) => Uint8Array;
  decompress: (data: Uint8Array) => Uint8Array;
} | null = null;

async function ensureLz4Initialized(): Promise<typeof lz4Module> {
  if (!lz4Module) {
    const lz4 = await import("lz4-wasm");
    lz4Module = {
      compress: lz4.compress,
      decompress: lz4.decompress,
    };
  }
  return lz4Module;
}

async function compressLz4(file: FileNode): Promise<Uint8Array> {
  if (!file.data) {
    throw new Error("No file data");
  }
  const lz4 = await ensureLz4Initialized();
  return lz4!.compress(file.data);
}

async function compressTarLz4(files: FileNode[]): Promise<Uint8Array> {
  const tar = createTar(files);
  const lz4 = await ensureLz4Initialized();
  return lz4!.compress(tar);
}

// Snappy compression (using snappyjs - pure JS implementation)
async function compressSnappy(file: FileNode): Promise<Uint8Array> {
  if (!file.data) {
    throw new Error("No file data");
  }
  const snappy = await import("snappyjs");
  return snappy.compress(file.data);
}

async function compressTarSnappy(files: FileNode[]): Promise<Uint8Array> {
  const tar = createTar(files);
  const snappy = await import("snappyjs");
  return snappy.compress(tar);
}

// Initialize 7z-wasm (dynamically imported to avoid WASM loading during SSR)
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let sevenZipInstance: any = null;

async function ensure7zInitialized() {
  if (!sevenZipInstance) {
    const SevenZip = (await import("7z-wasm")).default;
    sevenZipInstance = await SevenZip();
  }
  return sevenZipInstance;
}

// Convert 0-9 compression level to 7z level (0-9)
function to7zLevel(level: number | undefined): number {
  return level ?? 5;
}

// Helper to flatten file tree for 7z compression
function flattenFilesFor7z(
  nodes: FileNode[],
  basePath: string = "",
): Array<{ path: string; data: Uint8Array }> {
  const result: Array<{ path: string; data: Uint8Array }> = [];

  for (const node of nodes) {
    if (!node.selected) continue;

    const nodePath = basePath ? `${basePath}/${node.name}` : node.name;

    if (node.type === "file" && node.data) {
      result.push({ path: nodePath, data: node.data });
    } else if (node.type === "directory" && node.children) {
      result.push(...flattenFilesFor7z(node.children, nodePath));
    }
  }

  return result;
}

async function compress7z(
  files: FileNode[],
  options: CompressionOptions,
): Promise<Uint8Array> {
  const sevenZip = await ensure7zInitialized();
  const level = to7zLevel(options.level);

  // Flatten files
  const flatFiles = flattenFilesFor7z(files);
  if (flatFiles.length === 0) {
    throw new Error("No files to compress");
  }

  // Write files to virtual filesystem
  for (const file of flatFiles) {
    // Create parent directories if needed
    const parts = file.path.split("/");
    let currentPath = "";
    for (let i = 0; i < parts.length - 1; i++) {
      currentPath = currentPath ? `${currentPath}/${parts[i]}` : parts[i];
      try {
        sevenZip.FS.mkdir(`/${currentPath}`);
      } catch {
        // Directory might already exist
      }
    }
    sevenZip.FS.writeFile(`/${file.path}`, file.data);
  }

  // Build compression command
  const archiveName = "/output.7z";
  const args = ["a", `-mx=${level}`, archiveName];

  // Add password if provided
  if (options.password) {
    args.push(`-p${options.password}`);
  }

  // Add all files
  for (const file of flatFiles) {
    args.push(`/${file.path}`);
  }

  // Run compression
  sevenZip.callMain(args);

  // Read the result
  const result = sevenZip.FS.readFile(archiveName);

  // Cleanup
  try {
    sevenZip.FS.unlink(archiveName);
  } catch {
    // Ignore
  }

  for (const file of flatFiles) {
    try {
      sevenZip.FS.unlink(`/${file.path}`);
    } catch {
      // Ignore
    }
  }

  return result;
}

// ============================================================================
// Decompression Functions
// ============================================================================

// Initialize libarchive.js worker
let archiveWorkerInitialized = false;

async function initArchiveWorker() {
  if (!archiveWorkerInitialized) {
    Archive.init({
      workerUrl: "/libarchive/worker-bundle.js",
    });
    archiveWorkerInitialized = true;
  }
}

export async function decompressFile(
  data: Uint8Array,
  filename: string,
  password?: string,
): Promise<DecompressionResult> {
  const format = detectFormat(filename);
  console.log(
    `decompressFile: ${filename}, detected format: ${format?.id || "unknown"}, data size: ${data.length}`,
  );

  // Try native decompression first for supported formats
  if (format) {
    switch (format.id) {
      case "zip":
      case "jar":
        return decompressZip(data, password);
      case "gzip":
        return decompressGzip(data, filename);
      case "zlib":
        return decompressZlib(data, filename);
      case "tar":
        return decompressTar(data);
      case "tar.gz":
        return decompressTarGz(data);
      case "zstd":
        return decompressZstdFile(data, filename);
      case "tar.zst":
        return decompressTarZst(data);
      case "lz4":
        return decompressLz4File(data, filename);
      case "tar.lz4":
        return decompressTarLz4(data);
      case "snappy":
        return decompressSnappyFile(data, filename);
      case "tar.snappy":
        return decompressTarSnappy(data);
      case "7z":
        return decompress7z(data, filename, password);
    }
  }

  // Fall back to libarchive.js for other formats (including RAR, etc.)
  console.log(`Using libarchive.js fallback for ${filename}`);
  return decompressWithLibarchive(data, filename, password);
}

async function decompressZip(
  data: Uint8Array,
  password?: string,
): Promise<DecompressionResult> {
  return new Promise((resolve, reject) => {
    const opts: fflate.UnzipOptions = {};
    if (password) {
      (opts as fflate.UnzipOptions & { password?: string }).password = password;
    }

    fflate.unzip(data, opts, (err, unzipped) => {
      if (err) {
        // Check if it's a password error
        if (
          err.message?.includes("password") ||
          err.message?.includes("encrypted")
        ) {
          reject(new Error("Password required or incorrect password"));
        } else {
          reject(err);
        }
        return;
      }

      const files: FileNode[] = [];
      for (const [path, fileData] of Object.entries(unzipped)) {
        if (!path.endsWith("/")) {
          files.push({
            id: generateId(),
            name: path.split("/").pop() || path,
            type: "file",
            path,
            size: fileData.length,
            data: fileData,
            selected: true,
          });
        }
      }

      resolve({
        files: buildFileTree(files),
        format: "zip",
        encrypted: !!password,
      });
    });
  });
}

async function decompressGzip(
  data: Uint8Array,
  filename: string,
): Promise<DecompressionResult> {
  const decompressed = fflate.gunzipSync(data);
  const outputName = filename.replace(/\.(gz|gzip)$/i, "") || "decompressed";

  return {
    files: [
      {
        id: generateId(),
        name: outputName,
        type: "file",
        path: outputName,
        size: decompressed.length,
        data: decompressed,
        selected: true,
      },
    ],
    format: "gzip",
    encrypted: false,
  };
}

async function decompressZlib(
  data: Uint8Array,
  filename: string,
): Promise<DecompressionResult> {
  const decompressed = fflate.unzlibSync(data);
  const outputName = filename.replace(/\.(zz|zlib)$/i, "") || "decompressed";

  return {
    files: [
      {
        id: generateId(),
        name: outputName,
        type: "file",
        path: outputName,
        size: decompressed.length,
        data: decompressed,
        selected: true,
      },
    ],
    format: "zlib",
    encrypted: false,
  };
}

async function decompressTar(data: Uint8Array): Promise<DecompressionResult> {
  const tarFiles = parseTar(data);
  const files: FileNode[] = [];

  for (const { path, data: fileData } of tarFiles) {
    if (!path.endsWith("/") && fileData.length > 0) {
      files.push({
        id: generateId(),
        name: path.split("/").pop() || path,
        type: "file",
        path,
        size: fileData.length,
        data: fileData,
        selected: true,
      });
    }
  }

  return {
    files: buildFileTree(files),
    format: "tar",
    encrypted: false,
  };
}

async function decompressTarGz(data: Uint8Array): Promise<DecompressionResult> {
  const gunzipped = fflate.gunzipSync(data);
  return decompressTar(gunzipped);
}

async function decompressZstdFile(
  data: Uint8Array,
  filename: string,
): Promise<DecompressionResult> {
  const zstd = await ensureZstdInitialized();
  const decompressed = zstd!.decompress(data);
  const outputName = filename.replace(/\.(zst|zstd)$/i, "") || "decompressed";

  return {
    files: [
      {
        id: generateId(),
        name: outputName,
        type: "file",
        path: outputName,
        size: decompressed.length,
        data: decompressed,
        selected: true,
      },
    ],
    format: "zstd",
    encrypted: false,
  };
}

async function decompressTarZst(
  data: Uint8Array,
): Promise<DecompressionResult> {
  const zstd = await ensureZstdInitialized();
  const decompressed = zstd!.decompress(data);
  return decompressTar(decompressed);
}

async function decompressLz4File(
  data: Uint8Array,
  filename: string,
): Promise<DecompressionResult> {
  const lz4 = await ensureLz4Initialized();
  const decompressed = lz4!.decompress(data);
  const outputName = filename.replace(/\.lz4$/i, "") || "decompressed";

  return {
    files: [
      {
        id: generateId(),
        name: outputName,
        type: "file",
        path: outputName,
        size: decompressed.length,
        data: decompressed,
        selected: true,
      },
    ],
    format: "lz4",
    encrypted: false,
  };
}

async function decompressTarLz4(
  data: Uint8Array,
): Promise<DecompressionResult> {
  const lz4 = await ensureLz4Initialized();
  const decompressed = lz4!.decompress(data);
  return decompressTar(decompressed);
}

async function decompressSnappyFile(
  data: Uint8Array,
  filename: string,
): Promise<DecompressionResult> {
  const snappy = await import("snappyjs");
  const decompressed = snappy.uncompress(data);
  const outputName = filename.replace(/\.(snappy|snz)$/i, "") || "decompressed";

  return {
    files: [
      {
        id: generateId(),
        name: outputName,
        type: "file",
        path: outputName,
        size: decompressed.length,
        data: decompressed,
        selected: true,
      },
    ],
    format: "snappy",
    encrypted: false,
  };
}

async function decompressTarSnappy(
  data: Uint8Array,
): Promise<DecompressionResult> {
  const snappy = await import("snappyjs");
  const decompressed = snappy.uncompress(data);
  return decompressTar(decompressed);
}

async function decompress7z(
  data: Uint8Array,
  filename: string,
  password?: string,
): Promise<DecompressionResult> {
  const sevenZip = await ensure7zInitialized();
  const archiveName = "/" + filename;
  const outputDir = "/output";

  // Write archive to virtual filesystem
  sevenZip.FS.writeFile(archiveName, data);

  // Create output directory
  try {
    sevenZip.FS.mkdir(outputDir);
  } catch {
    // Directory might already exist
  }

  // Build extraction command
  const args = ["x", `-o${outputDir}`, archiveName];
  if (password) {
    args.push(`-p${password}`);
  }

  // Run extraction
  try {
    sevenZip.callMain(args);
  } catch (err) {
    // Check if it's a password error
    const errMsg = String(err);
    if (errMsg.includes("password") || errMsg.includes("Wrong password")) {
      throw new Error("Password required or incorrect password");
    }
    throw err;
  }

  // Collect extracted files
  const files: FileNode[] = [];

  const readDir = (path: string, relativePath: string = "") => {
    const entries = sevenZip.FS.readdir(path);
    for (const entry of entries) {
      if (entry === "." || entry === "..") continue;
      const fullPath = `${path}/${entry}`;
      const relPath = relativePath ? `${relativePath}/${entry}` : entry;
      const stat = sevenZip.FS.stat(fullPath);

      if (sevenZip.FS.isDir(stat.mode)) {
        readDir(fullPath, relPath);
      } else {
        const fileData = sevenZip.FS.readFile(fullPath);
        files.push({
          id: generateId(),
          name: entry,
          type: "file",
          path: relPath,
          size: fileData.length,
          data: fileData,
          selected: true,
        });
      }
    }
  };

  readDir(outputDir);

  // Cleanup
  try {
    sevenZip.FS.unlink(archiveName);
  } catch {
    // Ignore
  }

  const cleanupDir = (path: string) => {
    try {
      const entries = sevenZip.FS.readdir(path);
      for (const entry of entries) {
        if (entry === "." || entry === "..") continue;
        const fullPath = `${path}/${entry}`;
        const stat = sevenZip.FS.stat(fullPath);
        if (sevenZip.FS.isDir(stat.mode)) {
          cleanupDir(fullPath);
          sevenZip.FS.rmdir(fullPath);
        } else {
          sevenZip.FS.unlink(fullPath);
        }
      }
    } catch {
      // Ignore
    }
  };
  cleanupDir(outputDir);

  return {
    files: buildFileTree(files),
    format: "7z",
    encrypted: !!password,
  };
}

async function decompressWithLibarchive(
  data: Uint8Array,
  filename: string,
  password?: string,
): Promise<DecompressionResult> {
  await initArchiveWorker();

  const archive = await Archive.open(
    new File([data as Uint8Array<ArrayBuffer>], filename),
  );

  if (password) {
    await archive.usePassword(password);
  }

  const entries = await archive.getFilesArray();
  const files: FileNode[] = [];

  for (const entry of entries) {
    if (!entry.path.endsWith("/")) {
      const fileData = await entry.file.arrayBuffer();
      files.push({
        id: generateId(),
        name: entry.path.split("/").pop() || entry.path,
        type: "file",
        path: entry.path,
        size: entry.file.size,
        data: new Uint8Array(fileData),
        selected: true,
      });
    }
  }

  const format = detectFormat(filename);

  return {
    files: buildFileTree(files),
    format: format?.id || "unknown",
    encrypted: !!password,
  };
}

// ============================================================================
// Download Helpers
// ============================================================================

export function downloadFile(data: Uint8Array, filename: string) {
  const blob = new Blob([data as Uint8Array<ArrayBuffer>], {
    type: "application/octet-stream",
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 0);
}

export function getExtensionForFormat(formatId: string): string {
  const format = getFormatById(formatId);
  return format?.extensions[0] || ".zip";
}
