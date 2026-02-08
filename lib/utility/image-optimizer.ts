export type ImageOutputFormat =
  | "image/jpeg"
  | "image/png"
  | "image/webp"
  | "image/avif";

export interface ImageOptimizeOptions {
  maxWidth: number;
  maxHeight: number;
  quality: number;
  outputFormat: ImageOutputFormat;
}

export interface ImageOptimizeResult {
  blob: Blob;
  width: number;
  height: number;
}

export function clampQuality(input: number): number {
  if (!Number.isFinite(input)) return 0.85;
  return Math.min(1, Math.max(0.1, input));
}

export function calculateTargetDimensions(
  width: number,
  height: number,
  maxWidth: number,
  maxHeight: number,
): { width: number; height: number } {
  if (width <= 0 || height <= 0) {
    return { width: 0, height: 0 };
  }

  const effectiveMaxWidth = maxWidth > 0 ? maxWidth : width;
  const effectiveMaxHeight = maxHeight > 0 ? maxHeight : height;
  const scale = Math.min(
    1,
    effectiveMaxWidth / width,
    effectiveMaxHeight / height,
  );

  return {
    width: Math.max(1, Math.round(width * scale)),
    height: Math.max(1, Math.round(height * scale)),
  };
}

export function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes < 0) return "0 B";
  if (bytes < 1024) return `${bytes} B`;
  const units = ["KB", "MB", "GB"];
  let value = bytes / 1024;
  let unitIndex = 0;
  while (value >= 1024 && unitIndex < units.length - 1) {
    value /= 1024;
    unitIndex += 1;
  }
  return `${value.toFixed(value < 10 ? 2 : 1)} ${units[unitIndex]}`;
}

async function loadImageFromFile(file: File): Promise<HTMLImageElement> {
  const objectUrl = URL.createObjectURL(file);
  try {
    const image = new Image();
    image.decoding = "async";
    await new Promise<void>((resolve, reject) => {
      image.onload = () => resolve();
      image.onerror = () => reject(new Error("Failed to load image."));
      image.src = objectUrl;
    });
    return image;
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}

export async function optimizeImageFile(
  file: File,
  options: ImageOptimizeOptions,
): Promise<ImageOptimizeResult> {
  if (typeof document === "undefined") {
    throw new Error("Image optimization requires a browser environment.");
  }

  const image = await loadImageFromFile(file);
  const target = calculateTargetDimensions(
    image.naturalWidth,
    image.naturalHeight,
    options.maxWidth,
    options.maxHeight,
  );
  if (target.width === 0 || target.height === 0) {
    throw new Error("Invalid source image dimensions.");
  }

  const canvas = document.createElement("canvas");
  canvas.width = target.width;
  canvas.height = target.height;
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    throw new Error("Failed to acquire 2D canvas context.");
  }

  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(image, 0, 0, target.width, target.height);

  const quality = clampQuality(options.quality);
  const blob = await new Promise<Blob | null>((resolve) => {
    canvas.toBlob(resolve, options.outputFormat, quality);
  });

  if (!blob) {
    throw new Error("Failed to encode optimized image.");
  }

  return {
    blob,
    width: target.width,
    height: target.height,
  };
}
