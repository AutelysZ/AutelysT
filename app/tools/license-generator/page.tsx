"use client";

import * as React from "react";
import { Suspense } from "react";
import LicenseGeneratorContent from "./license-generator-content";

export default function LicenseGeneratorPage() {
  return (
    <Suspense fallback={null}>
      <LicenseGeneratorContent />
    </Suspense>
  );
}
