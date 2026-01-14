"use client"
import { Moon, Sun, Monitor } from "lucide-react"
import { useTheme } from "next-themes"
import { Button } from "@/components/ui/button"
import { useEffect, useState } from "react"

export function ThemeToggle() {
  const { theme, setTheme, resolvedTheme } = useTheme()
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  const cycleTheme = () => {
    if (theme === "system") {
      setTheme("light")
    } else if (theme === "light") {
      setTheme("dark")
    } else {
      setTheme("system")
    }
  }

  if (!mounted) {
    return <Button variant="ghost" size="icon" className="h-8 w-8" />
  }

  const getIcon = () => {
    if (theme === "system") {
      return <Monitor className="h-4 w-4" />
    } else if (theme === "light" || resolvedTheme === "light") {
      return <Sun className="h-4 w-4" />
    } else {
      return <Moon className="h-4 w-4" />
    }
  }

  return (
    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={cycleTheme}>
      {getIcon()}
      <span className="sr-only">Toggle theme</span>
    </Button>
  )
}
