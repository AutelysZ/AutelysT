"use client";

import React, { Suspense } from "react";
import SignatureContent from "./signature-content";

export default function SignaturePage() {
  return (
    <Suspense fallback={null}>
      <SignatureContent />
    </Suspense>
  );
}
