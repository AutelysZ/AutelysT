import { NextResponse } from "next/server";

export const dynamic = "force-static";
export const revalidate = false;

const baseUrl =
  process.env.NEXT_PUBLIC_SITE_URL || "https://autelyst.vercel.app";

export async function GET() {
  const opensearchXml = `<?xml version="1.0" encoding="UTF-8"?>
<OpenSearchDescription xmlns="http://a9.com/-/spec/opensearch/1.1/">
  <ShortName>AutelysT</ShortName>
  <Description>Search AutelysT web tools - encoding, decoding, conversion, and more</Description>
  <InputEncoding>UTF-8</InputEncoding>
  <Image width="16" height="16" type="image/x-icon">${baseUrl}/favicon.ico</Image>
  <Url type="text/html" template="${baseUrl}/?q={searchTerms}"/>
  <Url type="application/opensearchdescription+xml" rel="self" template="${baseUrl}/opensearch.xml"/>
</OpenSearchDescription>`;

  return new NextResponse(opensearchXml, {
    headers: {
      "Content-Type": "application/opensearchdescription+xml",
    },
  });
}
