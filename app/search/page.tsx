"use client"

import * as React from "react"
import { Suspense } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import Link from "next/link"
import { Search, Binary, Hash, ArrowRight } from "lucide-react"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { ScrollArea } from "@/components/ui/scroll-area"
import { searchTools, getToolsGroupedByCategory, type Tool } from "@/lib/tools/registry"
import { ThemeToggle } from "@/components/theme-toggle"

function SearchPageContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const initialQuery = searchParams.get("q") || ""

  const [query, setQuery] = React.useState(initialQuery)
  const [results, setResults] = React.useState<Tool[]>([])
  const inputRef = React.useRef<HTMLInputElement>(null)

  // Handle initial OpenSearch redirect
  React.useEffect(() => {
    if (initialQuery) {
      const matchingTools = searchTools(initialQuery)
      if (matchingTools.length === 1) {
        // If exact match or single result, redirect to that tool
        router.push(matchingTools[0].route)
      } else if (matchingTools.length > 0) {
        // Show results
        setResults(matchingTools)
      }
    }
  }, [initialQuery, router])

  // Update results on query change
  React.useEffect(() => {
    if (query.trim()) {
      setResults(searchTools(query))
    } else {
      setResults([])
    }
  }, [query])

  // Focus input on mount
  React.useEffect(() => {
    inputRef.current?.focus()
  }, [])

  const groupedTools = React.useMemo(() => getToolsGroupedByCategory(), [])

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <header className="flex items-center justify-between border-b border-border px-6 py-4">
        <div>
          <h1 className="text-xl font-semibold">Search Tools</h1>
          <p className="mt-0.5 text-sm text-muted-foreground">Find the right tool for your task</p>
        </div>
        <ThemeToggle />
      </header>

      {/* Search Input */}
      <div className="border-b border-border bg-muted/30 p-6">
        <div className="relative mx-auto max-w-2xl">
          <Search className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground" />
          <Input
            ref={inputRef}
            type="search"
            placeholder="Search by name, category, or keywords..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="h-12 pl-12 text-lg"
          />
        </div>
      </div>

      <ScrollArea className="flex-1">
        <div className="p-6">
          {/* Search Results */}
          {query.trim() ? (
            <div className="mx-auto max-w-4xl">
              <div className="mb-4 text-sm text-muted-foreground">
                {results.length} {results.length === 1 ? "result" : "results"} for {'"'}
                {query}
                {'"'}
              </div>

              {results.length > 0 ? (
                <div className="grid gap-3 sm:grid-cols-2">
                  {results.map((tool) => (
                    <Link key={tool.id} href={tool.route}>
                      <Card className="h-full transition-colors hover:border-primary/50 hover:bg-accent/50">
                        <CardHeader className="pb-2">
                          <div className="flex items-start justify-between">
                            <CardTitle className="flex items-center gap-2 text-base">
                              {tool.category === "Encoding" ? (
                                <Binary className="h-4 w-4 text-primary" />
                              ) : (
                                <Hash className="h-4 w-4 text-primary" />
                              )}
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
            /* Browse All Tools */
            <div className="mx-auto max-w-4xl space-y-8">
              <div className="text-center">
                <h2 className="text-lg font-medium">Browse All Tools</h2>
                <p className="text-sm text-muted-foreground">Or start typing to search</p>
              </div>

              {Object.entries(groupedTools).map(([category, categoryTools]) => (
                <section key={category}>
                  <h3 className="mb-3 flex items-center gap-2 font-medium">
                    {category === "Encoding" ? (
                      <Binary className="h-4 w-4 text-primary" />
                    ) : (
                      <Hash className="h-4 w-4 text-primary" />
                    )}
                    {category}
                    <span className="text-sm font-normal text-muted-foreground">({categoryTools.length})</span>
                  </h3>
                  <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                    {categoryTools.map((tool) => (
                      <Link
                        key={tool.id}
                        href={tool.route}
                        className="flex items-center justify-between rounded-lg border border-border p-3 transition-colors hover:border-primary/50 hover:bg-accent/50"
                      >
                        <div>
                          <div className="font-medium">{tool.name}</div>
                          <div className="text-xs text-muted-foreground">{tool.keywords.slice(0, 2).join(", ")}</div>
                        </div>
                        <ArrowRight className="h-4 w-4 text-muted-foreground" />
                      </Link>
                    ))}
                  </div>
                </section>
              ))}
            </div>
          )}
        </div>
      </ScrollArea>
    </div>
  )
}

export default function SearchPage() {
  return (
    <Suspense>
      <SearchPageContent />
    </Suspense>
  )
}
