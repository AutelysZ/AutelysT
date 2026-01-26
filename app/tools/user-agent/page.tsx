"use client";

import * as React from "react";
import { Suspense } from "react";
import UserAgentContent from "./user-agent-content";

export default function UserAgentPage() {
  return (
    <Suspense fallback={null}>
      <UserAgentContent />
    </Suspense>
  );
}
