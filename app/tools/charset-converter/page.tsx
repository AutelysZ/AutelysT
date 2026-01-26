import { Suspense } from "react";
import CharsetConverterContent from "./charset-converter-content";

export default function CharsetConverterPage() {
  return (
    <Suspense fallback={null}>
      <CharsetConverterContent />
    </Suspense>
  );
}
