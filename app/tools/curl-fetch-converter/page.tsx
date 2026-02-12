"use client";

import dynamic from "next/dynamic";

const CurlFetchConverterClientPage = dynamic(() => import("./client-page"), {
  ssr: false,
  loading: () => null,
});

export default function CurlFetchConverterPage() {
  return <CurlFetchConverterClientPage />;
}
