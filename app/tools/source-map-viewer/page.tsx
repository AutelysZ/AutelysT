import { Suspense } from "react"
import SourceMapViewerContent from "./source-map-viewer-content"

export default function SourceMapViewerPage() {
  return (
    <Suspense fallback={null}>
      <SourceMapViewerContent />
    </Suspense>
  )
}
