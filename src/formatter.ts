/**
 * Output formatter for MCP tool results
 * Supports TEXT, YAML, JSON, and TOON formats
 */

import { stringify as yamlStringify } from 'yaml';
import { encode as toonEncode } from '@toon-format/toon';

export type OutputFormat = 'TEXT' | 'YAML' | 'JSON' | 'TOON';

export const VALID_FORMATS: OutputFormat[] = ['TEXT', 'YAML', 'JSON', 'TOON'];

export const FORMAT_SCHEMA = {
  type: 'string',
  enum: VALID_FORMATS,
  description: 'Output format: TEXT (human-readable), YAML, JSON, or TOON (Token-Oriented Object Notation - optimized for LLMs) (default)'
};

/**
 * Converts a value to human-readable TEXT format (table-like for arrays of objects)
 */
function toTEXT(data: any, indent: number = 0): string {
  const prefix = '  '.repeat(indent);

  if (data === null || data === undefined) {
    return 'null';
  }

  if (typeof data === 'string' || typeof data === 'number' || typeof data === 'boolean') {
    return String(data);
  }

  if (Array.isArray(data)) {
    if (data.length === 0) {
      return '(empty list)';
    }

    // Check if it's an array of objects (table-like data)
    if (typeof data[0] === 'object' && data[0] !== null) {
      const keys = Object.keys(data[0]);

      // Calculate column widths
      const widths: Record<string, number> = {};
      for (const key of keys) {
        widths[key] = key.length;
        for (const row of data) {
          const val = String(row[key] ?? 'null');
          widths[key] = Math.max(widths[key], val.length);
        }
      }

      // Build table
      const header = keys.map(k => k.padEnd(widths[k])).join(' | ');
      const separator = keys.map(k => '-'.repeat(widths[k])).join('-+-');
      const rows = data.map(row =>
        keys.map(k => String(row[k] ?? 'null').padEnd(widths[k])).join(' | ')
      );

      return [header, separator, ...rows].join('\n');
    }

    return data.map((item, i) => `${prefix}${i + 1}. ${toTEXT(item, indent)}`).join('\n');
  }

  if (typeof data === 'object') {
    const lines = Object.entries(data).map(([key, value]) => {
      if (Array.isArray(value) && value.length > 0 && typeof value[0] === 'object') {
        return `${prefix}${key}:\n${toTEXT(value, indent + 1)}`;
      } else if (typeof value === 'object' && value !== null) {
        return `${prefix}${key}:\n${toTEXT(value, indent + 1)}`;
      }
      return `${prefix}${key}: ${toTEXT(value, indent)}`;
    });
    return lines.join('\n');
  }

  return String(data);
}

/**
 * Formats data according to the specified output format
 * @param data - The data to format
 * @param format - The output format (TEXT, YAML, JSON, TOON)
 * @returns Formatted string
 */
export function formatOutput(data: any, format: OutputFormat = 'TOON'): string {
  switch (format.toUpperCase() as OutputFormat) {
    case 'TEXT':
      return toTEXT(data);

    case 'YAML':
      return yamlStringify(data);

    case 'TOON':
      return toonEncode(data);

    case 'JSON':
    default:
      return JSON.stringify(data, null, 2);
  }
}

/**
 * Validates if a string is a valid output format
 */
export function isValidFormat(format: string): format is OutputFormat {
  return VALID_FORMATS.includes(format.toUpperCase() as OutputFormat);
}
