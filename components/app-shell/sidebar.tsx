"use client"

import * as React from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { ChevronDown, ChevronRight, Clock, Search, Wrench } from "lucide-react"
import { cn } from "@/lib/utils"
import { Input } from "@/components/ui/input"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Button } from "@/components/ui/button"
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible"
import { tools, getToolsGroupedByCategory } from "@/lib/tools/registry"
import { useRecentTools } from "@/lib/history/use-tool-history"
import { ThemeToggle } from "@/components/theme-toggle"

export function Sidebar() {
  const pathname = usePathname()
  const [searchQuery, setSearchQuery] = React.useState("")
  const groupedTools = React.useMemo(() => getToolsGroupedByCategory(), [])

  const [expandedCategories, setExpandedCategories] = React.useState<Record<string, boolean>>(() => {
    const allExpanded: Record<string, boolean> = {}
    Object.keys(getToolsGroupedByCategory()).forEach((category) => {
      allExpanded[category] = true
    })
    return allExpanded
  })
  const { recentTools } = useRecentTools()

  const filteredTools = React.useMemo(() => {
    if (!searchQuery.trim()) return null
    const query = searchQuery.toLowerCase()
    return tools.filter(
      (tool) => tool.name.toLowerCase().includes(query) || tool.keywords.some((kw) => kw.toLowerCase().includes(query)),
    )
  }, [searchQuery])

  const recentToolsList = React.useMemo(() => {
    return recentTools
      .map((id) => tools.find((t) => t.id === id))
      .filter(Boolean)
      .slice(0, 5)
  }, [recentTools])

  const toggleCategory = (category: string) => {
    setExpandedCategories((prev) => ({
      ...prev,
      [category]: !prev[category],
    }))
  }

  return (
    <aside className="flex h-full min-h-0 w-64 flex-col overflow-hidden border-r border-border bg-sidebar">
      <div className="shrink-0 flex items-center justify-between border-b border-border p-4">
        <div className="flex items-center gap-2">
          <Wrench className="h-5 w-5 text-primary" />
          <Link href="/" className="font-semibold text-sidebar-foreground">
            AutelysT
          </Link>
        </div>
        <ThemeToggle />
      </div>

      {/* Search */}
      <div className="shrink-0 p-3">
        <div className="relative">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search tools..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-8"
          />
        </div>
      </div>

      {/* Search Results */}
      <ScrollArea className="min-h-0 flex-1 px-3">
        {filteredTools ? (
          <div className="space-y-1 py-2">
            <div className="px-2 py-1 text-xs font-medium text-muted-foreground">
              Search Results ({filteredTools.length})
            </div>
            {filteredTools.map((tool) => (
              <Link
                key={tool.id}
                href={tool.route}
                className={cn(
                  "flex items-center gap-2 rounded-md px-2 py-1.5 text-sm transition-colors",
                  pathname === tool.route
                    ? "bg-sidebar-accent text-sidebar-accent-foreground"
                    : "text-sidebar-foreground hover:bg-sidebar-accent/50",
                )}
              >
                {tool.name}
              </Link>
            ))}
            {filteredTools.length === 0 && (
              <div className="px-2 py-4 text-center text-sm text-muted-foreground">No tools found</div>
            )}
          </div>
        ) : (
          <>
            {/* Recent Tools */}
            {recentToolsList.length > 0 && (
              <div className="py-2">
                <div className="flex items-center gap-1 px-2 py-1 text-xs font-medium text-muted-foreground">
                  <Clock className="h-3 w-3" />
                  Recent
                </div>
                <div className="space-y-0.5">
                  {recentToolsList.map(
                    (tool) =>
                      tool && (
                        <Link
                          key={tool.id}
                          href={tool.route}
                          className={cn(
                            "flex items-center gap-2 rounded-md px-2 py-1.5 text-sm transition-colors",
                            pathname === tool.route
                              ? "bg-sidebar-accent text-sidebar-accent-foreground"
                              : "text-sidebar-foreground hover:bg-sidebar-accent/50",
                          )}
                        >
                          {tool.name}
                        </Link>
                      ),
                  )}
                </div>
              </div>
            )}

            {/* Categories */}
            {Object.entries(groupedTools).map(([category, categoryTools]) => (
              <Collapsible
                key={category}
                open={expandedCategories[category] ?? false}
                onOpenChange={() => toggleCategory(category)}
                className="py-1"
              >
                <CollapsibleTrigger asChild>
                  <Button
                    variant="ghost"
                    className="w-full justify-start gap-1 px-2 py-1.5 text-xs font-medium text-muted-foreground hover:text-foreground"
                  >
                    {expandedCategories[category] ? (
                      <ChevronDown className="h-3 w-3" />
                    ) : (
                      <ChevronRight className="h-3 w-3" />
                    )}
                    {category}
                    <span className="ml-auto text-xs opacity-50">{categoryTools.length}</span>
                  </Button>
                </CollapsibleTrigger>
                <CollapsibleContent className="space-y-0.5 pl-2">
                  {categoryTools.map((tool) => (
                    <Link
                      key={tool.id}
                      href={tool.route}
                      className={cn(
                        "flex items-center rounded-md px-2 py-1.5 text-sm transition-colors",
                        pathname === tool.route
                          ? "bg-sidebar-accent text-sidebar-accent-foreground"
                          : "text-sidebar-foreground hover:bg-sidebar-accent/50",
                      )}
                    >
                      {tool.name}
                    </Link>
                  ))}
                </CollapsibleContent>
              </Collapsible>
            ))}
          </>
        )}
      </ScrollArea>
    </aside>
  )
}
