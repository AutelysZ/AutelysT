"use client";

import * as React from "react";
import { Suspense } from "react";
import CodeFormatterContent from "./code-formatter-content";

export default function CodeFormatterPage() {
  return (
    <Suspense fallback={null}>
      <CodeFormatterContent />
    </Suspense>
  );
}
