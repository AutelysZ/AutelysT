import { Suspense } from "react";
import FileTypeDetectorContent from "./file-type-detector-content";

export default function FileTypeDetectorPage() {
  return (
    <Suspense fallback={null}>
      <FileTypeDetectorContent />
    </Suspense>
  );
}
