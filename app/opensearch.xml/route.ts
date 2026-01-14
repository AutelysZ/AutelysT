import { NextResponse } from "next/server"

export async function GET(request: Request) {
  const url = new URL(request.url)
  const baseUrl = `${url.protocol}//${url.host}`

  const opensearchXml = `<?xml version="1.0" encoding="UTF-8"?>
<OpenSearchDescription xmlns="http://a9.com/-/spec/opensearch/1.1/">
  <ShortName>AutelysT</ShortName>
  <Description>Search AutelysT web tools - encoding, decoding, conversion, and more</Description>
  <InputEncoding>UTF-8</InputEncoding>
  <Image width="16" height="16" type="image/x-icon">${baseUrl}/favicon.ico</Image>
  <Url type="text/html" template="${baseUrl}/search?q={searchTerms}"/>
  <Url type="application/opensearchdescription+xml" rel="self" template="${baseUrl}/opensearch.xml"/>
</OpenSearchDescription>`

  return new NextResponse(opensearchXml, {
    headers: {
      "Content-Type": "application/opensearchdescription+xml",
    },
  })
}
