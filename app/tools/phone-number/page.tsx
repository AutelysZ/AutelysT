"use client";

import * as React from "react";
import { Suspense } from "react";
import PhoneNumberContent from "./phone-number-content";

export default function PhoneNumberPage() {
  return (
    <Suspense fallback={null}>
      <PhoneNumberContent />
    </Suspense>
  );
}
