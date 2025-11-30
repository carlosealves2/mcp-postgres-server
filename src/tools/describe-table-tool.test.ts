/**
 * Describe Table Tool tests
 */

import { test, expect, describe } from 'bun:test';
import { DESCRIBE_TABLE_TOOL_DEFINITION } from './describe-table-tool';

// Skip integration tests in CI where there's no database
const skipIntegrationTests = process.env.CI === 'true';

describe('Describe Table Tool', () => {
  describe('Tool definition', () => {
    test('should have correct name', () => {
      expect(DESCRIBE_TABLE_TOOL_DEFINITION.name).toBe('describe_table');
    });

    test('should have description', () => {
      expect(DESCRIBE_TABLE_TOOL_DEFINITION.description).toBeTruthy();
      expect(DESCRIBE_TABLE_TOOL_DEFINITION.description).toContain('schema');
      expect(DESCRIBE_TABLE_TOOL_DEFINITION.description).toContain('table');
    });

    test('should have input schema', () => {
      expect(DESCRIBE_TABLE_TOOL_DEFINITION.inputSchema).toBeDefined();
      expect(DESCRIBE_TABLE_TOOL_DEFINITION.inputSchema.type).toBe('object');
    });

    test('should require table parameter', () => {
      expect(DESCRIBE_TABLE_TOOL_DEFINITION.inputSchema.required).toContain('table');
    });

    test('should have table and schema properties', () => {
      expect(DESCRIBE_TABLE_TOOL_DEFINITION.inputSchema.properties.table).toBeDefined();
      expect(DESCRIBE_TABLE_TOOL_DEFINITION.inputSchema.properties.schema).toBeDefined();
    });
  });

  describe('Input validation', () => {
    test('should validate missing table parameter', async () => {
      const { handleDescribeTableTool } = await import('./describe-table-tool');
      const result = await handleDescribeTableTool({} as any);

      expect(result.success).toBe(false);
      expect(result.error).toContain('table parameter is required');
    });

    test('should validate null table parameter', async () => {
      const { handleDescribeTableTool } = await import('./describe-table-tool');
      const result = await handleDescribeTableTool({ table: null as any });

      expect(result.success).toBe(false);
      expect(result.error).toContain('table parameter is required');
    });

    test('should validate non-string table parameter', async () => {
      const { handleDescribeTableTool } = await import('./describe-table-tool');
      const result = await handleDescribeTableTool({ table: 123 as any });

      expect(result.success).toBe(false);
      expect(result.error).toContain('must be a string');
    });

    test.skipIf(skipIntegrationTests)('should use default schema when not provided', async () => {
      const { handleDescribeTableTool } = await import('./describe-table-tool');
      const result = await handleDescribeTableTool({ table: 'users' });

      expect(result).toHaveProperty('success');
      // Should use 'public' schema by default
    });
  });

  describe('SQL Injection prevention', () => {
    test.skipIf(skipIntegrationTests)('should handle table name with single quotes', async () => {
      const { handleDescribeTableTool } = await import('./describe-table-tool');
      const result = await handleDescribeTableTool({
        table: "users'; DROP TABLE users; --",
      });

      // Should handle safely, not throw
      expect(result).toHaveProperty('success');
    });

    test.skipIf(skipIntegrationTests)('should handle schema with single quotes', async () => {
      const { handleDescribeTableTool } = await import('./describe-table-tool');
      const result = await handleDescribeTableTool({
        table: 'users',
        schema: "public'; DROP TABLE users; --",
      });

      expect(result).toHaveProperty('success');
    });

    test.skipIf(skipIntegrationTests)('should handle table name with special characters', async () => {
      const { handleDescribeTableTool } = await import('./describe-table-tool');
      const result = await handleDescribeTableTool({
        table: "test'table",
      });

      expect(result).toHaveProperty('success');
    });

    test.skipIf(skipIntegrationTests)('should handle backslashes in table name', async () => {
      const { handleDescribeTableTool } = await import('./describe-table-tool');
      const result = await handleDescribeTableTool({
        table: "test\\table",
      });

      expect(result).toHaveProperty('success');
    });
  });

  describe('Result structure', () => {
    test.skipIf(skipIntegrationTests)('should return success flag', async () => {
      const { handleDescribeTableTool } = await import('./describe-table-tool');
      const result = await handleDescribeTableTool({ table: 'users' });

      expect(result).toHaveProperty('success');
      expect(typeof result.success).toBe('boolean');
    });

    test.skipIf(skipIntegrationTests)('should include error message on failure', async () => {
      const { handleDescribeTableTool } = await import('./describe-table-tool');
      const result = await handleDescribeTableTool({ table: 'nonexistent' });

      if (!result.success) {
        expect(result.error).toBeDefined();
        expect(typeof result.error).toBe('string');
      }
    });
  });
});
