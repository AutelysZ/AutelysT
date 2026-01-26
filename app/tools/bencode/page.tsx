"use client";

import * as React from "react";
import { Suspense } from "react";
import BencodeContent from "./bencode-content";

export default function BencodePage() {
  return (
    <Suspense fallback={null}>
      <BencodeContent />
    </Suspense>
  );
}
