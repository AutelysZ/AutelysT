export type UrlParam = {
  key: string
  value: string
}

export type ParsedUrlData = {
  protocol: string
  username: string
  password: string
  hostname: string
  port: string
  pathname: string
  queryParams: UrlParam[]
  hashPathname: string
  hashParams: UrlParam[]
}

export type UrlBuilderState = {
  url: string
  encoding: string
}
