export interface JSONSchema {
  $schema?: string;
  type?: string | string[];
  properties?: Record<string, JSONSchema>;
  items?: JSONSchema | JSONSchema[];
  required?: string[];
  additionalProperties?: boolean;
  enum?: unknown[];
  format?: string;
  minimum?: number;
  maximum?: number;
  minLength?: number;
  maxLength?: number;
  pattern?: string;
  description?: string;
  default?: unknown;
  examples?: unknown[];
}

export function generateSchema(
  value: unknown,
  options?: { includeExamples?: boolean },
): JSONSchema {
  const { includeExamples = false } = options || {};

  if (value === null) {
    return { type: "null" };
  }

  if (value === undefined) {
    return {};
  }

  if (typeof value === "boolean") {
    const schema: JSONSchema = { type: "boolean" };
    if (includeExamples) schema.examples = [value];
    return schema;
  }

  if (typeof value === "number") {
    const schema: JSONSchema = {
      type: Number.isInteger(value) ? "integer" : "number",
    };
    if (includeExamples) schema.examples = [value];
    return schema;
  }

  if (typeof value === "string") {
    const schema: JSONSchema = { type: "string" };

    // Detect formats
    if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/.test(value)) {
      schema.format = "date-time";
    } else if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
      schema.format = "date";
    } else if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) {
      schema.format = "email";
    } else if (/^https?:\/\//.test(value)) {
      schema.format = "uri";
    } else if (
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
        value,
      )
    ) {
      schema.format = "uuid";
    }

    if (includeExamples) schema.examples = [value];
    return schema;
  }

  if (Array.isArray(value)) {
    const schema: JSONSchema = { type: "array" };

    if (value.length > 0) {
      // Try to find common schema for all items
      const itemSchemas = value.map((item) => generateSchema(item, options));
      const mergedSchema = mergeSchemas(itemSchemas);
      schema.items = mergedSchema;
    }

    return schema;
  }

  if (typeof value === "object") {
    const schema: JSONSchema = {
      type: "object",
      properties: {},
      required: [],
    };

    for (const [key, val] of Object.entries(value)) {
      schema.properties![key] = generateSchema(val, options);
      if (val !== null && val !== undefined) {
        schema.required!.push(key);
      }
    }

    if (schema.required!.length === 0) {
      delete schema.required;
    }

    return schema;
  }

  return {};
}

function mergeSchemas(schemas: JSONSchema[]): JSONSchema {
  if (schemas.length === 0) return {};
  if (schemas.length === 1) return schemas[0];

  const types = new Set<string>();
  for (const schema of schemas) {
    if (schema.type) {
      if (Array.isArray(schema.type)) {
        schema.type.forEach((t) => types.add(t));
      } else {
        types.add(schema.type);
      }
    }
  }

  // If all same type, merge properties
  if (types.size === 1 && types.has("object")) {
    const merged: JSONSchema = { type: "object", properties: {} };
    const requiredCounts: Record<string, number> = {};

    for (const schema of schemas) {
      if (schema.properties) {
        for (const [key, value] of Object.entries(schema.properties)) {
          if (!merged.properties![key]) {
            merged.properties![key] = value;
            requiredCounts[key] = 1;
          } else {
            merged.properties![key] = mergeSchemas([
              merged.properties![key],
              value,
            ]);
            requiredCounts[key]++;
          }
        }
      }
    }

    // Only mark as required if present in all schemas
    const required = Object.entries(requiredCounts)
      .filter(([, count]) => count === schemas.length)
      .map(([key]) => key);
    if (required.length > 0) {
      merged.required = required;
    }

    return merged;
  }

  // Multiple types
  if (types.size > 1) {
    return { type: Array.from(types) };
  }

  return schemas[0];
}

export function formatSchema(schema: JSONSchema): string {
  return JSON.stringify(schema, null, 2);
}
