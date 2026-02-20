"use client";

import { Suspense } from "react";
import { JsonViewerContent } from "./json-viewer-content";

export default function JsonViewerPage() {
  return (
    <Suspense fallback={null}>
      <JsonViewerContent />
    </Suspense>
  );
}
