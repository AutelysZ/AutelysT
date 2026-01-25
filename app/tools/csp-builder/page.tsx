import { Suspense } from "react"
import CspBuilderContent from "./csp-builder-content"

export default function CspBuilderPage() {
  return (
    <Suspense fallback={null}>
      <CspBuilderContent />
    </Suspense>
  )
}
