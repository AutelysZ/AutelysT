"use client";

import { Suspense } from "react";
import SshKeyContent from "./ssh-key-content";

export default function SshKeyPage() {
  return (
    <Suspense fallback={null}>
      <SshKeyContent />
    </Suspense>
  );
}
