"use client"

import * as React from "react"
import { Suspense } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { Search, Binary, Hash, Key } from "lucide-react"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { searchTools, getToolsGroupedByCategory, tools, type Tool } from "@/lib/tools/registry"

function HomePage() {
  const router = useRouter()
  const [query, setQuery] = React.useState("")
  const [results, setResults] = React.useState<Tool[]>([])
  const [initialized, setInitialized] = React.useState(false)
  const inputRef = React.useRef<HTMLInputElement>(null)

  const groupedTools = React.useMemo(() => getToolsGroupedByCategory(), [])

  React.useEffect(() => {
    if (typeof window === "undefined") return
    const params = new URLSearchParams(window.location.search)
    const initialQuery = params.get("q") || ""
    if (initialQuery) {
      setQuery(initialQuery)
      const matchingTools = searchTools(initialQuery)
      if (matchingTools.length === 1) {
        router.push(matchingTools[0].route)
        return
      } else if (matchingTools.length > 0) {
        setResults(matchingTools)
      }
    }
    setInitialized(true)
  }, [router])

  React.useEffect(() => {
    if (!initialized) return
    if (query.trim()) {
      setResults(searchTools(query))
      const url = new URL(window.location.href)
      url.searchParams.set("q", query)
      window.history.replaceState({}, "", url.toString())
    } else {
      setResults([])
      const url = new URL(window.location.href)
      url.searchParams.delete("q")
      window.history.replaceState({}, "", url.pathname)
    }
  }, [query, initialized])

  const getCategoryIcon = (category: string) => {
    switch (category) {
      case "Encoding":
        return <Binary className="h-4 w-4" />
      case "Numbers":
        return <Hash className="h-4 w-4" />
      case "Identifier":
        return <Key className="h-4 w-4" />
      default:
        return <Binary className="h-4 w-4" />
    }
  }

  const isSearching = query.trim().length > 0

  return (
    <div className="flex flex-1 flex-col overflow-auto">
      {/* Hero Section */}
      <section className="shrink-0 border-b border-border bg-gradient-to-b from-background to-muted/30 px-6 py-10">
        <div className="mx-auto max-w-4xl text-center">
          <h1 className="mb-3 text-balance text-3xl font-bold tracking-tight md:text-4xl">AutelysT Web Toolkit</h1>
          <p className="mx-auto mb-6 max-w-2xl text-balance text-muted-foreground">
            Free online tools for encoding, decoding, ID generation, and number conversion. Fast, private, and works
            entirely in your browser.
          </p>
          {/* Search Input */}
          <div className="relative mx-auto max-w-xl">
            <Search className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground" />
            <Input
              ref={inputRef}
              type="search"
              placeholder="Search tools by name or keyword..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="h-12 pl-12 text-lg"
            />
          </div>
        </div>
      </section>

      {/* Content */}
      <div className="flex-1 p-6">
        {isSearching ? (
          /* Search Results */
          <div className="mx-auto max-w-5xl">
            <div className="mb-4 text-sm text-muted-foreground">
              {results.length} {results.length === 1 ? "result" : "results"} for "{query}"
            </div>

            {results.length > 0 ? (
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {results.map((tool) => (
                  <Link key={tool.id} href={tool.route}>
                    <Card className="h-full transition-colors hover:border-primary/50 hover:bg-accent/50">
                      <CardHeader className="pb-2">
                        <div className="flex items-start justify-between">
                          <CardTitle className="flex items-center gap-2 text-base">
                            {getCategoryIcon(tool.category)}
                            {tool.name}
                          </CardTitle>
                          <Badge variant="secondary" className="text-xs">
                            {tool.category}
                          </Badge>
                        </div>
                      </CardHeader>
                      <CardContent>
                        <CardDescription className="text-sm">{tool.description}</CardDescription>
                        <div className="mt-3 flex flex-wrap gap-1">
                          {tool.keywords.slice(0, 4).map((kw) => (
                            <span key={kw} className="rounded bg-muted px-1.5 py-0.5 text-xs text-muted-foreground">
                              {kw}
                            </span>
                          ))}
                        </div>
                      </CardContent>
                    </Card>
                  </Link>
                ))}
              </div>
            ) : (
              <Card>
                <CardContent className="flex flex-col items-center justify-center py-12">
                  <Search className="mb-4 h-12 w-12 text-muted-foreground/50" />
                  <p className="text-lg font-medium">No tools found</p>
                  <p className="text-sm text-muted-foreground">Try a different search term</p>
                </CardContent>
              </Card>
            )}
          </div>
        ) : (
          /* Tools by Category */
          <div className="mx-auto max-w-5xl space-y-8">
            {Object.entries(groupedTools).map(([category, categoryTools]) => (
              <section key={category}>
                <div className="mb-3 flex items-center gap-2">
                  <div className="rounded bg-primary/10 p-1.5 text-primary">{getCategoryIcon(category)}</div>
                  <h2 className="text-lg font-semibold">{category}</h2>
                  <span className="text-sm text-muted-foreground">({categoryTools.length})</span>
                </div>
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {categoryTools.map((tool) => (
                    <Link key={tool.id} href={tool.route}>
                      <Card className="h-full transition-colors hover:border-primary/50 hover:bg-accent/50">
                        <CardHeader className="pb-2">
                          <CardTitle className="text-base">{tool.name}</CardTitle>
                        </CardHeader>
                        <CardContent>
                          <CardDescription className="line-clamp-2 text-sm">{tool.description}</CardDescription>
                        </CardContent>
                      </Card>
                    </Link>
                  ))}
                </div>
              </section>
            ))}

            {/* Total tools count */}
            <div className="pt-4 text-center text-sm text-muted-foreground">{tools.length} tools available</div>
          </div>
        )}
      </div>
    </div>
  )
}

export default function Home() {
  return (
    <Suspense fallback={null}>
      <HomePage />
    </Suspense>
  )
}
