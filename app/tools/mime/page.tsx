import { Suspense } from "react";
import MimeContent from "./mime-content";

export default function MimePage() {
  return (
    <Suspense fallback={null}>
      <MimeContent />
    </Suspense>
  );
}
