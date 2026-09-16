import { z } from 'zod';

/**
 * Convert a Zod schema to a JSON Schema description for the CMS editor.
 *
 * Deliberately minimal: it covers the constructs the block registry actually
 * uses, and falls back to an untyped field rather than throwing on anything
 * exotic. The authoritative validation always remains the Zod schema on the
 * server — this exists only so the CMS can render an appropriate control.
 */
export interface JsonSchemaNode {
  type?: string;
  title?: string;
  description?: string;
  properties?: Record<string, JsonSchemaNode>;
  required?: string[];
  items?: JsonSchemaNode;
  enum?: unknown[];
  default?: unknown;
  minimum?: number;
  maximum?: number;
  minLength?: number;
  maxLength?: number;
  minItems?: number;
  maxItems?: number;
  format?: string;
  /** Hint used by the CMS to pick a richer control (media picker, link picker). */
  'x-control'?: string;
}

export function zodToJsonSchema(schema: z.ZodTypeAny, title?: string): JsonSchemaNode {
  const node = convert(schema);
  if (title) node.title = title;
  return node;
}

function convert(schema: z.ZodTypeAny, depth = 0): JsonSchemaNode {
  if (depth > 12) return {};

  const def = schema._def as { typeName?: string; [key: string]: unknown };

  switch (def.typeName) {
    case 'ZodObject': {
      const shape = (schema as z.ZodObject<z.ZodRawShape>).shape;
      const properties: Record<string, JsonSchemaNode> = {};
      const required: string[] = [];

      for (const [key, value] of Object.entries(shape)) {
        const field = value as z.ZodTypeAny;
        properties[key] = convert(field, depth + 1);
        if (!field.isOptional()) required.push(key);

        // Media and link references get a dedicated control in the CMS.
        if (key === 'assetId') properties[key]['x-control'] = 'media';
        if (key === 'pageId') properties[key]['x-control'] = 'page';
        if (key === 'body' || key === 'left' || key === 'right' || key === 'answer') {
          properties[key]['x-control'] = 'richtext';
        }
      }

      return { type: 'object', properties, ...(required.length > 0 ? { required } : {}) };
    }

    case 'ZodArray': {
      const inner = def.type as z.ZodTypeAny;
      const checks = def as { minLength?: { value: number }; maxLength?: { value: number } };
      return {
        type: 'array',
        items: convert(inner, depth + 1),
        ...(checks.minLength ? { minItems: checks.minLength.value } : {}),
        ...(checks.maxLength ? { maxItems: checks.maxLength.value } : {}),
      };
    }

    case 'ZodString': {
      const checks = (def.checks ?? []) as Array<{ kind: string; value?: number }>;
      const node: JsonSchemaNode = { type: 'string' };
      for (const check of checks) {
        if (check.kind === 'min' && typeof check.value === 'number') node.minLength = check.value;
        if (check.kind === 'max' && typeof check.value === 'number') node.maxLength = check.value;
        if (check.kind === 'url') node.format = 'uri';
        if (check.kind === 'email') node.format = 'email';
      }
      return node;
    }

    case 'ZodNumber': {
      const checks = (def.checks ?? []) as Array<{ kind: string; value?: number }>;
      const node: JsonSchemaNode = { type: 'number' };
      for (const check of checks) {
        if (check.kind === 'min' && typeof check.value === 'number') node.minimum = check.value;
        if (check.kind === 'max' && typeof check.value === 'number') node.maximum = check.value;
      }
      return node;
    }

    case 'ZodBoolean':
      return { type: 'boolean' };

    case 'ZodEnum':
      return { type: 'string', enum: def.values as unknown[] };

    case 'ZodLiteral':
      return { enum: [def.value] };

    case 'ZodDefault': {
      const inner = convert(def.innerType as z.ZodTypeAny, depth + 1);
      return { ...inner, default: (def.defaultValue as () => unknown)() };
    }

    case 'ZodOptional':
    case 'ZodNullable':
      return convert(def.innerType as z.ZodTypeAny, depth + 1);

    case 'ZodEffects':
      return convert(def.schema as z.ZodTypeAny, depth + 1);

    case 'ZodUnion': {
      const options = def.options as z.ZodTypeAny[];
      return convert(options[0] ?? z.unknown(), depth + 1);
    }

    default:
      // Unknown construct: render a generic control rather than failing the seed.
      return {};
  }
}
