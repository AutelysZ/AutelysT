"use client"

import * as React from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Checkbox } from "@/components/ui/checkbox"
import { Plus, Trash2, GripVertical, ArrowUp, ArrowDown } from "lucide-react"
import { cn } from "@/lib/utils"

// Protobuf field types
export const FIELD_TYPES = [
  { value: "string", label: "string", wireType: 2 },
  { value: "bytes", label: "bytes", wireType: 2 },
  { value: "int32", label: "int32", wireType: 0 },
  { value: "int64", label: "int64", wireType: 0 },
  { value: "uint32", label: "uint32", wireType: 0 },
  { value: "uint64", label: "uint64", wireType: 0 },
  { value: "sint32", label: "sint32", wireType: 0 },
  { value: "sint64", label: "sint64", wireType: 0 },
  { value: "bool", label: "bool", wireType: 0 },
  { value: "fixed32", label: "fixed32", wireType: 5 },
  { value: "fixed64", label: "fixed64", wireType: 1 },
  { value: "sfixed32", label: "sfixed32", wireType: 5 },
  { value: "sfixed64", label: "sfixed64", wireType: 1 },
  { value: "float", label: "float", wireType: 5 },
  { value: "double", label: "double", wireType: 1 },
] as const

export type FieldType = (typeof FIELD_TYPES)[number]["value"]

export type FieldDefinition = {
  id: string
  number: number
  name: string
  type: FieldType
  repeated: boolean
}

export type FieldTableProps = {
  fields: FieldDefinition[]
  onFieldsChange: (fields: FieldDefinition[]) => void
  readOnly?: boolean
  compact?: boolean
}

export function createEmptyField(existingFields: FieldDefinition[]): FieldDefinition {
  // Find the next available field number
  const usedNumbers = new Set(existingFields.map((f) => f.number))
  let nextNumber = 1
  while (usedNumbers.has(nextNumber)) {
    nextNumber++
  }

  return {
    id: Date.now().toString() + Math.random().toString(36).slice(2),
    number: nextNumber,
    name: `field_${nextNumber}`,
    type: "string",
    repeated: false,
  }
}

export function FieldTable({ fields, onFieldsChange, readOnly = false, compact = false }: FieldTableProps) {
  const handleAddField = () => {
    const newField = createEmptyField(fields)
    onFieldsChange([...fields, newField])
  }

  const handleRemoveField = (id: string) => {
    onFieldsChange(fields.filter((f) => f.id !== id))
  }

  const handleUpdateField = (id: string, updates: Partial<FieldDefinition>) => {
    onFieldsChange(
      fields.map((f) => (f.id === id ? { ...f, ...updates } : f))
    )
  }

  const handleMoveField = (index: number, direction: "up" | "down") => {
    const newIndex = direction === "up" ? index - 1 : index + 1
    if (newIndex < 0 || newIndex >= fields.length) return

    const newFields = [...fields]
    const [movedField] = newFields.splice(index, 1)
    newFields.splice(newIndex, 0, movedField)
    onFieldsChange(newFields)
  }

  if (fields.length === 0 && readOnly) {
    return (
      <div className="flex items-center justify-center rounded-lg border border-dashed py-6 text-sm text-muted-foreground">
        No fields defined
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-2">
      {/* Header */}
      <div className={cn(
        "grid items-center gap-2 text-xs font-medium text-muted-foreground",
        compact ? "grid-cols-[40px_60px_1fr_100px_60px_40px]" : "grid-cols-[40px_70px_1fr_120px_80px_60px]"
      )}>
        <div></div>
        <div>Number</div>
        <div>Name</div>
        <div>Type</div>
        <div>Repeated</div>
        <div></div>
      </div>

      {/* Field rows */}
      {fields.map((field, index) => (
        <div
          key={field.id}
          className={cn(
            "grid items-center gap-2 rounded-md border bg-card p-1.5",
            compact ? "grid-cols-[40px_60px_1fr_100px_60px_40px]" : "grid-cols-[40px_70px_1fr_120px_80px_60px]"
          )}
        >
          {/* Move buttons */}
          <div className="flex flex-col gap-0.5">
            {!readOnly && (
              <>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-4 w-8 p-0"
                  onClick={() => handleMoveField(index, "up")}
                  disabled={index === 0}
                >
                  <ArrowUp className="h-3 w-3" />
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-4 w-8 p-0"
                  onClick={() => handleMoveField(index, "down")}
                  disabled={index === fields.length - 1}
                >
                  <ArrowDown className="h-3 w-3" />
                </Button>
              </>
            )}
          </div>

          {/* Field number */}
          <Input
            type="number"
            min={1}
            max={536870911}
            value={field.number}
            onChange={(e) => handleUpdateField(field.id, { number: parseInt(e.target.value) || 1 })}
            className={cn("h-7 text-xs font-mono", compact && "h-6")}
            readOnly={readOnly}
          />

          {/* Field name */}
          <Input
            value={field.name}
            onChange={(e) => handleUpdateField(field.id, { name: e.target.value })}
            className={cn("h-7 text-xs", compact && "h-6")}
            placeholder="field_name"
            readOnly={readOnly}
          />

          {/* Field type */}
          {readOnly ? (
            <div className="px-2 text-xs font-mono">{field.type}</div>
          ) : (
            <Select
              value={field.type}
              onValueChange={(value) => handleUpdateField(field.id, { type: value as FieldType })}
            >
              <SelectTrigger className={cn("h-7 text-xs", compact && "h-6")}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {FIELD_TYPES.map((type) => (
                  <SelectItem key={type.value} value={type.value} className="text-xs">
                    {type.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}

          {/* Repeated checkbox */}
          <div className="flex items-center justify-center">
            <Checkbox
              checked={field.repeated}
              onCheckedChange={(checked) => handleUpdateField(field.id, { repeated: !!checked })}
              disabled={readOnly}
            />
          </div>

          {/* Delete button */}
          <div className="flex justify-center">
            {!readOnly && (
              <Button
                variant="ghost"
                size="sm"
                className="h-6 w-6 p-0 text-muted-foreground hover:text-destructive"
                onClick={() => handleRemoveField(field.id)}
              >
                <Trash2 className="h-3 w-3" />
              </Button>
            )}
          </div>
        </div>
      ))}

      {/* Add field button */}
      {!readOnly && (
        <Button
          variant="outline"
          size="sm"
          onClick={handleAddField}
          className="h-8 gap-1.5 text-xs"
        >
          <Plus className="h-3 w-3" />
          Add Field
        </Button>
      )}
    </div>
  )
}

// Helper to convert decoded fields to field definitions
export function decodedFieldsToDefinitions(
  decodedFields: Array<{
    fieldNumber: number
    wireType: number
    interpretations: Array<{ type: string; confidence: string }>
  }>
): FieldDefinition[] {
  const fieldMap = new Map<number, FieldDefinition>()

  for (const field of decodedFields) {
    if (fieldMap.has(field.fieldNumber)) {
      // Mark as repeated if we see the same field number multiple times
      const existing = fieldMap.get(field.fieldNumber)!
      existing.repeated = true
      continue
    }

    // Infer type from wire type and interpretations
    let inferredType: FieldType = "bytes"
    const highConfidence = field.interpretations.find((i) => i.confidence === "high")

    if (highConfidence) {
      switch (highConfidence.type) {
        case "string":
          inferredType = "string"
          break
        case "uint64":
        case "uint32":
          inferredType = "uint64"
          break
        case "fixed64":
          inferredType = "fixed64"
          break
        case "fixed32":
          inferredType = "fixed32"
          break
        case "double":
          inferredType = "double"
          break
        case "float":
          inferredType = "float"
          break
      }
    } else {
      // Fall back to wire type
      switch (field.wireType) {
        case 0:
          inferredType = "int64"
          break
        case 1:
          inferredType = "fixed64"
          break
        case 2:
          inferredType = "bytes"
          break
        case 5:
          inferredType = "fixed32"
          break
      }
    }

    fieldMap.set(field.fieldNumber, {
      id: `field_${field.fieldNumber}_${Date.now()}`,
      number: field.fieldNumber,
      name: `field_${field.fieldNumber}`,
      type: inferredType,
      repeated: false,
    })
  }

  return Array.from(fieldMap.values()).sort((a, b) => a.number - b.number)
}
