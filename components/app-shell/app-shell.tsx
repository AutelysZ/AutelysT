"use client";

import * as React from "react";
import { Menu } from "lucide-react";
import { Sidebar } from "./sidebar";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { Toaster } from "@/components/ui/sonner";
import { cn } from "@/lib/utils";

interface AppShellProps {
  children: React.ReactNode;
}

export function AppShell({ children }: AppShellProps) {
  const [navOpen, setNavOpen] = React.useState(false);
  const mobileNavContentId = "mobile-navigation-sheet";

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      <div className="hidden md:flex">
        <Sidebar />
      </div>
      <main className="flex flex-1 flex-col overflow-auto">
        <div className="flex items-center justify-between border-b border-border px-4 py-3 md:hidden">
          <Sheet open={navOpen} onOpenChange={setNavOpen}>
            <SheetTrigger asChild aria-controls={mobileNavContentId}>
              <Button
                variant="outline"
                size="icon"
                aria-label="Open navigation"
              >
                <Menu className="h-4 w-4" />
              </Button>
            </SheetTrigger>
            <SheetContent
              id={mobileNavContentId}
              side="left"
              className="w-80 p-0 sm:w-96"
              showCloseButton={false}
              title="Navigation"
            >
              <Sidebar
                className="w-full border-r-0"
                onNavigate={() => setNavOpen(false)}
              />
            </SheetContent>
          </Sheet>
          <div
            id="mobile-header-title"
            className={cn(
              "flex-1 text-center text-sm font-semibold",
              "truncate",
            )}
          />
          <div
            id="mobile-header-action"
            className="flex h-9 w-9 items-center justify-end"
          />
        </div>
        {children}
      </main>
      <Toaster />
    </div>
  );
}
