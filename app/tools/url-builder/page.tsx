import { Suspense } from "react";
import UrlBuilderContent from "./url-builder-content";

export default function UrlBuilderPage() {
  return (
    <Suspense fallback={null}>
      <UrlBuilderContent />
    </Suspense>
  );
}
