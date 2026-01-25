"use client"

import { X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"

type CspDirectiveRowProps = {
  name: string
  valuesText: string
  onNameChange: (value: string) => void
  onValuesChange: (value: string) => void
  onRemove: () => void
}

export default function CspDirectiveRow({
  name,
  valuesText,
  onNameChange,
  onValuesChange,
  onRemove,
}: CspDirectiveRowProps) {
  return (
    <div className="rounded-md border bg-muted/40 p-3">
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 space-y-3">
          <div className="space-y-1">
            <Label className="text-xs">Directive</Label>
            <Input
              value={name}
              onChange={(event) => onNameChange(event.target.value)}
              placeholder="script-src"
              className="font-mono text-xs"
            />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Values</Label>
            <Textarea
              value={valuesText}
              onChange={(event) => onValuesChange(event.target.value)}
              placeholder="'self' https://cdn.example.com"
              className="min-h-[68px] resize-y font-mono text-xs"
            />
          </div>
        </div>
        <Button type="button" variant="ghost" size="icon" className="h-7 w-7" onClick={onRemove}>
          <X className="h-4 w-4" />
        </Button>
      </div>
    </div>
  )
}
