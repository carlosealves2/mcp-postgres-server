/**
 * Formatter module tests
 * Tests for output formatting in TEXT, YAML, JSON, and TOON formats
 */

import { test, expect, describe } from 'bun:test';
import { formatOutput, isValidFormat, VALID_FORMATS, type OutputFormat } from './formatter';

describe('formatOutput', () => {
  const sampleData = {
    name: 'test',
    count: 42,
    active: true,
    items: [1, 2, 3]
  };

  describe('JSON format', () => {
    test('formats simple object to JSON', () => {
      const result = formatOutput(sampleData, 'JSON');
      const parsed = JSON.parse(result);
      expect(parsed).toEqual(sampleData);
    });

    test('formats array of objects', () => {
      const data = [
        { id: 1, name: 'Alice' },
        { id: 2, name: 'Bob' }
      ];
      const result = formatOutput(data, 'JSON');
      const parsed = JSON.parse(result);
      expect(parsed).toEqual(data);
    });

    test('handles null values', () => {
      const data = { value: null };
      const result = formatOutput(data, 'JSON');
      const parsed = JSON.parse(result);
      expect(parsed.value).toBeNull();
    });

    test('formats with indentation', () => {
      const result = formatOutput(sampleData, 'JSON');
      expect(result).toContain('\n');
      expect(result).toContain('  ');
    });

    test('handles nested objects', () => {
      const nested = {
        user: {
          profile: {
            name: 'Test',
            age: 30
          }
        }
      };
      const result = formatOutput(nested, 'JSON');
      const parsed = JSON.parse(result);
      expect(parsed.user.profile.name).toBe('Test');
    });
  });

  describe('TEXT format', () => {
    test('formats simple object as key-value pairs', () => {
      const data = { name: 'test', count: 5 };
      const result = formatOutput(data, 'TEXT');
      expect(result).toContain('name: test');
      expect(result).toContain('count: 5');
    });

    test('formats array of objects as table', () => {
      const data = [
        { id: 1, name: 'Alice' },
        { id: 2, name: 'Bob' }
      ];
      const result = formatOutput(data, 'TEXT');
      expect(result).toContain('id');
      expect(result).toContain('name');
      expect(result).toContain('Alice');
      expect(result).toContain('Bob');
      expect(result).toContain('|');
      expect(result).toContain('-');
    });

    test('handles empty array', () => {
      const result = formatOutput([], 'TEXT');
      expect(result).toBe('(empty list)');
    });

    test('formats null as string null', () => {
      const result = formatOutput(null, 'TEXT');
      expect(result).toBe('null');
    });

    test('formats undefined as string null', () => {
      const result = formatOutput(undefined, 'TEXT');
      expect(result).toBe('null');
    });

    test('formats string directly', () => {
      const result = formatOutput('hello world', 'TEXT');
      expect(result).toBe('hello world');
    });

    test('formats number directly', () => {
      const result = formatOutput(42, 'TEXT');
      expect(result).toBe('42');
    });

    test('formats boolean directly', () => {
      const result = formatOutput(true, 'TEXT');
      expect(result).toBe('true');
    });

    test('handles null values in table cells', () => {
      const data = [
        { id: 1, name: null },
        { id: 2, name: 'Bob' }
      ];
      const result = formatOutput(data, 'TEXT');
      expect(result).toContain('null');
      expect(result).toContain('Bob');
    });

    test('handles nested objects in TEXT format', () => {
      const data = {
        user: {
          name: 'Test',
          age: 30
        }
      };
      const result = formatOutput(data, 'TEXT');
      expect(result).toContain('user:');
      expect(result).toContain('name: Test');
      expect(result).toContain('age: 30');
    });
  });

  describe('YAML format', () => {
    test('formats object to valid YAML', () => {
      const data = { name: 'test', count: 42 };
      const result = formatOutput(data, 'YAML');
      expect(result).toContain('name: test');
      expect(result).toContain('count: 42');
    });

    test('formats array to YAML', () => {
      const data = [1, 2, 3];
      const result = formatOutput(data, 'YAML');
      expect(result).toContain('- 1');
      expect(result).toContain('- 2');
      expect(result).toContain('- 3');
    });

    test('formats nested structure', () => {
      const data = {
        database: {
          host: 'localhost',
          port: 5432
        }
      };
      const result = formatOutput(data, 'YAML');
      expect(result).toContain('database:');
      expect(result).toContain('host: localhost');
      expect(result).toContain('port: 5432');
    });

    test('handles boolean values', () => {
      const data = { active: true, deleted: false };
      const result = formatOutput(data, 'YAML');
      expect(result).toContain('active: true');
      expect(result).toContain('deleted: false');
    });
  });

  describe('TOON format', () => {
    test('formats data to TOON format', () => {
      const data = { name: 'test', count: 42 };
      const result = formatOutput(data, 'TOON');
      // TOON format is token-optimized, just verify it returns a string
      expect(typeof result).toBe('string');
      expect(result.length).toBeGreaterThan(0);
    });

    test('handles arrays in TOON format', () => {
      const data = [1, 2, 3];
      const result = formatOutput(data, 'TOON');
      expect(typeof result).toBe('string');
    });

    test('handles complex nested structures', () => {
      const data = {
        users: [
          { id: 1, name: 'Alice', roles: ['admin', 'user'] },
          { id: 2, name: 'Bob', roles: ['user'] }
        ],
        metadata: {
          total: 2,
          page: 1
        }
      };
      const result = formatOutput(data, 'TOON');
      expect(typeof result).toBe('string');
      expect(result.length).toBeGreaterThan(0);
    });
  });

  describe('default behavior', () => {
    test('defaults to TOON format when not specified', () => {
      const data = { test: 'value' };
      const defaultResult = formatOutput(data);
      const toonResult = formatOutput(data, 'TOON');
      expect(defaultResult).toBe(toonResult);
    });

    test('handles case-insensitive format', () => {
      const data = { test: 'value' };
      const result = formatOutput(data, 'json' as OutputFormat);
      const parsed = JSON.parse(result);
      expect(parsed).toEqual(data);
    });

    test('falls back to JSON for unknown format', () => {
      const data = { test: 'value' };
      const result = formatOutput(data, 'UNKNOWN' as OutputFormat);
      const parsed = JSON.parse(result);
      expect(parsed).toEqual(data);
    });
  });

  describe('edge cases', () => {
    test('handles empty object', () => {
      const result = formatOutput({}, 'JSON');
      expect(JSON.parse(result)).toEqual({});
    });

    test('handles deeply nested arrays', () => {
      const data = {
        level1: {
          level2: {
            items: [
              [1, 2],
              [3, 4]
            ]
          }
        }
      };
      const result = formatOutput(data, 'JSON');
      const parsed = JSON.parse(result);
      expect(parsed.level1.level2.items[0][0]).toBe(1);
    });

    test('handles special characters in strings', () => {
      const data = { text: 'Line 1\nLine 2\tTabbed' };
      const result = formatOutput(data, 'JSON');
      const parsed = JSON.parse(result);
      expect(parsed.text).toContain('\n');
      expect(parsed.text).toContain('\t');
    });

    test('handles large numbers', () => {
      const data = { big: 9007199254740991 }; // MAX_SAFE_INTEGER
      const result = formatOutput(data, 'JSON');
      const parsed = JSON.parse(result);
      expect(parsed.big).toBe(9007199254740991);
    });

    test('handles Date objects in JSON', () => {
      const date = new Date('2024-01-01T00:00:00Z');
      const data = { created: date };
      const result = formatOutput(data, 'JSON');
      expect(result).toContain('2024-01-01');
    });
  });
});

describe('isValidFormat', () => {
  test('returns true for TEXT', () => {
    expect(isValidFormat('TEXT')).toBe(true);
  });

  test('returns true for YAML', () => {
    expect(isValidFormat('YAML')).toBe(true);
  });

  test('returns true for JSON', () => {
    expect(isValidFormat('JSON')).toBe(true);
  });

  test('returns true for TOON', () => {
    expect(isValidFormat('TOON')).toBe(true);
  });

  test('returns true for lowercase formats', () => {
    expect(isValidFormat('text')).toBe(true);
    expect(isValidFormat('yaml')).toBe(true);
    expect(isValidFormat('json')).toBe(true);
    expect(isValidFormat('toon')).toBe(true);
  });

  test('returns true for mixed case formats', () => {
    expect(isValidFormat('Text')).toBe(true);
    expect(isValidFormat('Json')).toBe(true);
  });

  test('returns false for invalid formats', () => {
    expect(isValidFormat('XML')).toBe(false);
    expect(isValidFormat('CSV')).toBe(false);
    expect(isValidFormat('INVALID')).toBe(false);
    expect(isValidFormat('')).toBe(false);
  });
});

describe('VALID_FORMATS constant', () => {
  test('contains exactly four formats', () => {
    expect(VALID_FORMATS).toHaveLength(4);
  });

  test('includes TEXT', () => {
    expect(VALID_FORMATS).toContain('TEXT');
  });

  test('includes YAML', () => {
    expect(VALID_FORMATS).toContain('YAML');
  });

  test('includes JSON', () => {
    expect(VALID_FORMATS).toContain('JSON');
  });

  test('includes TOON', () => {
    expect(VALID_FORMATS).toContain('TOON');
  });
});
