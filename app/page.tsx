import { Suspense } from "react"
import Link from "next/link"
import { Binary, Clock, Hash, Lightbulb, Sparkles, Star, Wrench, ArrowRight } from "lucide-react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { tools } from "@/lib/tools/registry"

const featuredToolIds = ["base64", "radix", "hex", "number-format"]

const tips = [
  {
    icon: Lightbulb,
    title: "URL State Sync",
    description: "All tool parameters are synced to the URL. Share links with your exact configuration!",
  },
  {
    icon: Clock,
    title: "History Tracking",
    description: "Your interactions are automatically saved. Access history from any tool's header.",
  },
  {
    icon: Sparkles,
    title: "Auto-Detection",
    description: "Many tools auto-detect input formats. Just paste and watch the magic happen.",
  },
]

const whatsNew = [
  {
    date: "2025-01-14",
    title: "Initial Release",
    description: "Launched with 9 encoding and number conversion tools.",
    badge: "New",
  },
  {
    date: "2025-01-14",
    title: "Dark Mode",
    description: "Full dark mode support with system preference detection.",
    badge: "Feature",
  },
  {
    date: "2025-01-14",
    title: "History Panel",
    description: "Track and restore your previous tool states.",
    badge: "Feature",
  },
]

function HomePage() {
  const featuredTools = featuredToolIds.map((id) => tools.find((t) => t.id === id)).filter(Boolean)

  return (
    <div className="flex flex-col">
      {/* Hero Section */}
      <section className="border-b border-border bg-gradient-to-b from-background to-secondary/20 px-6 py-12">
        <div className="mx-auto max-w-4xl text-center">
          <div className="mb-4 inline-flex items-center gap-2 rounded-full bg-primary/10 px-4 py-1.5 text-sm font-medium text-primary">
            <Wrench className="h-4 w-4" />
            Open Source Web Toolkit
          </div>
          <h1 className="mb-4 text-balance text-4xl font-bold tracking-tight md:text-5xl">
            Your AI-Powered Toolbox for
            <span className="bg-gradient-to-r from-primary to-primary/60 bg-clip-text text-transparent">
              {" "}
              Everything
            </span>
          </h1>
          <p className="mx-auto mb-8 max-w-2xl text-balance text-lg text-muted-foreground">
            A comprehensive collection of free online tools for encoding, decoding, number conversion, and more. Fast,
            private, and works entirely in your browser.
          </p>
          <div className="flex flex-wrap items-center justify-center gap-3">
            <Button asChild size="lg">
              <Link href="/tools/base64">
                <Binary className="mr-2 h-4 w-4" />
                Try Base64 Tool
              </Link>
            </Button>
            <Button asChild variant="outline" size="lg">
              <Link href="/search">
                Browse All Tools
                <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
            </Button>
          </div>
        </div>
      </section>

      {/* Main Content */}
      <div className="flex-1 overflow-auto p-6">
        <div className="mx-auto max-w-6xl space-y-8">
          {/* Featured Tools */}
          <section>
            <div className="mb-4 flex items-center gap-2">
              <Star className="h-5 w-5 text-yellow-500" />
              <h2 className="text-xl font-semibold">Featured Tools</h2>
            </div>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {featuredTools.map(
                (tool) =>
                  tool && (
                    <Link key={tool.id} href={tool.route}>
                      <Card className="h-full transition-colors hover:border-primary/50 hover:bg-accent/50">
                        <CardHeader className="pb-2">
                          <CardTitle className="flex items-center gap-2 text-base">
                            {tool.category === "Encoding" ? (
                              <Binary className="h-4 w-4 text-primary" />
                            ) : (
                              <Hash className="h-4 w-4 text-primary" />
                            )}
                            {tool.name}
                          </CardTitle>
                        </CardHeader>
                        <CardContent>
                          <CardDescription className="line-clamp-2 text-sm">{tool.description}</CardDescription>
                        </CardContent>
                      </Card>
                    </Link>
                  ),
              )}
            </div>
          </section>

          {/* Two Column Layout */}
          <div className="grid gap-8 lg:grid-cols-2">
            {/* What's New */}
            <section>
              <div className="mb-4 flex items-center gap-2">
                <Sparkles className="h-5 w-5 text-primary" />
                <h2 className="text-xl font-semibold">{"What's New"}</h2>
              </div>
              <Card>
                <CardContent className="divide-y divide-border p-0">
                  {whatsNew.map((item, i) => (
                    <div key={i} className="flex items-start gap-4 p-4">
                      <div className="min-w-20 text-xs text-muted-foreground">{item.date}</div>
                      <div className="flex-1">
                        <div className="mb-1 flex items-center gap-2">
                          <span className="font-medium">{item.title}</span>
                          <Badge variant="secondary" className="text-xs">
                            {item.badge}
                          </Badge>
                        </div>
                        <p className="text-sm text-muted-foreground">{item.description}</p>
                      </div>
                    </div>
                  ))}
                </CardContent>
              </Card>
            </section>

            {/* Tips */}
            <section>
              <div className="mb-4 flex items-center gap-2">
                <Lightbulb className="h-5 w-5 text-yellow-500" />
                <h2 className="text-xl font-semibold">Pro Tips</h2>
              </div>
              <div className="space-y-3">
                {tips.map((tip, i) => (
                  <Card key={i}>
                    <CardContent className="flex items-start gap-4 p-4">
                      <div className="rounded-lg bg-primary/10 p-2">
                        <tip.icon className="h-5 w-5 text-primary" />
                      </div>
                      <div>
                        <h3 className="font-medium">{tip.title}</h3>
                        <p className="text-sm text-muted-foreground">{tip.description}</p>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </section>
          </div>

          {/* All Tools Grid */}
          <section>
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-xl font-semibold">All Tools</h2>
              <Button asChild variant="ghost" size="sm">
                <Link href="/search">
                  View all
                  <ArrowRight className="ml-1 h-4 w-4" />
                </Link>
              </Button>
            </div>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {tools.map((tool) => (
                <Link key={tool.id} href={tool.route}>
                  <Card className="transition-colors hover:border-primary/50 hover:bg-accent/50">
                    <CardContent className="flex items-center gap-3 p-4">
                      <div className="rounded bg-secondary p-1.5">
                        {tool.category === "Encoding" ? <Binary className="h-4 w-4" /> : <Hash className="h-4 w-4" />}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="font-medium">{tool.name}</div>
                        <div className="truncate text-xs text-muted-foreground">{tool.category}</div>
                      </div>
                    </CardContent>
                  </Card>
                </Link>
              ))}
            </div>
          </section>
        </div>
      </div>
    </div>
  )
}

export default function Home() {
  return (
    <Suspense>
      <HomePage />
    </Suspense>
  )
}
