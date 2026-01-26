"use client";

import * as React from "react";
import { Suspense } from "react";
import SetCookieContent from "./set-cookie-content";

export default function SetCookiePage() {
  return (
    <Suspense fallback={null}>
      <SetCookieContent />
    </Suspense>
  );
}
