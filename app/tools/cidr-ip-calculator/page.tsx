"use client";

import { Suspense } from "react";
import CidrIpCalculatorContent from "./cidr-ip-calculator-content";

export default function CidrIpCalculatorPage() {
  return (
    <Suspense fallback={null}>
      <CidrIpCalculatorContent />
    </Suspense>
  );
}
