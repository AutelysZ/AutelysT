"use client";

import * as React from "react";
import { Suspense } from "react";
import PasswordHashContent from "./password-hash-content";

export default function PasswordHashPage() {
  return (
    <Suspense fallback={null}>
      <PasswordHashContent />
    </Suspense>
  );
}
